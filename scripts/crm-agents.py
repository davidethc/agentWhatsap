#!/usr/bin/env python3
"""Orquestación local de Codex; Python 3.11+, POSIX, git y tmux."""
import argparse
import ctypes
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import sys
import tomllib
import uuid
import time


ACTIVOS = {"starting", "running"}
REGLAS = """Reglas comunes obligatorias:
No uses Notion salvo si tu rol es coordinador. No accedas a producción ni .env.
No delegues fuera de scripts/crm-agents.py. Un apoyo (parent presente) no delega.
Edita únicamente los archivos propios del encargo y ownership declarado.
No reviertas trabajo ajeno, no trabajes en main y no hagas push.
Antes de comandos mutantes muestra nombre/comando y finalidad.
Entrega informe con cambios, pruebas, limitaciones y SHA de commit local.
El coordinador revisa la entrega; tu resultado no significa Done.
"""


def ahora():
    return datetime.now(timezone.utc).isoformat()


def ejecutar(args, **kw):
    return subprocess.run(args, text=True, capture_output=True, check=True, **kw).stdout.strip()


def git(wt, *args):
    return ejecutar(["git", "-C", str(wt), *args])


def solapa(a, b):
    return a == b or a.startswith(b + "/") or b.startswith(a + "/")


def identidad_proceso(pid):
    """Identidad del kernel estable durante exec; None si ya terminó.

    No se usa ps/lstart (precisión de segundos). En Linux: boot ID y ticks;
    en macOS: proc_bsdinfo con fecha de nacimiento en microsegundos.
    """
    if sys.platform.startswith("linux"):
        try:
            datos = Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
        except FileNotFoundError:
            return None
        if datos[0] == "Z":
            return None
        return {"pid": pid, "pgid": int(datos[2]), "start": datos[19],
                "boot": Path("/proc/sys/kernel/random/boot_id").read_text().strip()}
    if sys.platform == "darwin":
        class BSDInfo(ctypes.Structure):
            _fields_ = [("cabecera", ctypes.c_uint32 * 12),
                        ("comm", ctypes.c_char * 16), ("name", ctypes.c_char * 32),
                        ("grupo", ctypes.c_uint32 * 6),
                        ("sec", ctypes.c_uint64), ("usec", ctypes.c_uint64)]
        lib = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
        datos = BSDInfo()
        rc = lib.proc_pidinfo(pid, 3, 0, ctypes.byref(datos), ctypes.sizeof(datos))
        if rc == 0 and ctypes.get_errno() == 3:  # ESRCH
            return None
        if rc != ctypes.sizeof(datos):
            raise OSError(ctypes.get_errno(), "No se puede verificar identidad del proceso")
        if datos.cabecera[1] == 5:  # SZOMB
            return None
        return {"pid": int(datos.cabecera[3]), "pgid": int(datos.grupo[1]),
                "start": [int(datos.sec), int(datos.usec)]}
    raise OSError("Identidad de proceso solo implementada para Linux y macOS")


def terminar_grupo(pid, identidad):
    """Nunca envía señales si el PID actual pertenece a otra ejecución."""
    if not identidad:
        raise ValueError("Identidad ausente: reserva conservada; requiere revisión manual")
    actual = identidad_proceso(pid)
    if actual is None:
        return "Proceso ya finalizado"
    if actual != identidad:
        return "PID/identidad reutilizado: no se envió señal"
    if actual["pgid"] != pid:
        raise ValueError("El proceso no lidera un grupo exclusivo; reserva conservada")
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        return "Proceso ya finalizado"
    limite = time.monotonic() + 2
    while identidad_proceso(pid) == identidad:
        if time.monotonic() >= limite:
            raise ValueError("Proceso todavía vivo: reserva conservada")
        time.sleep(.01)
    return "Grupo detenido con identidad verificada"


def wrapper_exec(fd, comando):
    """EOF antes del token impide ejecutar Codex, incluso con SIGKILL al padre."""
    try:
        token = os.read(fd, 1)
    finally:
        os.close(fd)
    if token != b"G":
        return 125
    os.execvp(comando[0], comando)


class Lanzador:
    def __init__(self, repo, session="eli-crm", socket=None, catalog=None, roles=None):
        self.repo = Path(repo).resolve()
        self.base = Path(git(self.repo, "rev-parse", "--path-format=absolute", "--git-common-dir")) / "eli-runs"
        self.session = session
        self.tmux = ["tmux"] + (["-L", socket] if socket else [])
        self.catalog = Path(catalog or Path.home() / ".codex/models_cache.json")
        self.roles = Path(roles or self.repo / ".Codex/agents").resolve()

    @contextmanager
    def lock(self):
        self.base.mkdir(mode=0o700, parents=True, exist_ok=True)
        with (self.base / "lock").open("a") as archivo:
            fcntl.flock(archivo, fcntl.LOCK_EX)
            yield

    def ruta(self, run):
        if not re.fullmatch(r"[a-f0-9]{32}", run):
            raise ValueError("ID de ejecución inválido")
        return self.base / run

    def leer(self, run):
        return json.loads((self.ruta(run) / "run.json").read_text())

    def guardar(self, r):
        r["updated_at"] = ahora()
        p = self.ruta(r["id"]) / "run.json"
        tmp = p.with_suffix(".tmp")
        with tmp.open("w") as archivo:
            archivo.write(json.dumps(r, indent=2, ensure_ascii=False) + "\n")
            archivo.flush()
            os.fsync(archivo.fileno())
        tmp.replace(p)
        directorio = os.open(p.parent, os.O_RDONLY)
        try:
            os.fsync(directorio)
        finally:
            os.close(directorio)

    def todos(self):
        return [json.loads(p.read_text()) for p in sorted(self.base.glob("*/run.json"))]

    def panel_propio(self, r, solo_vivo=False):
        if not r.get("pane") or not r.get("pane_token"):
            return False
        q = subprocess.run(r["tmux"] + ["display-message", "-p", "-t", r["pane"],
                            "#{pane_dead}:#{pane_id}:#{@eli_crm_attempt}"],
                           capture_output=True, text=True)
        permitidos = ["0"] if solo_vivo else ["0", "1"]
        return q.returncode == 0 and q.stdout.strip() in {
            dead + ":" + r["pane"] + ":" + r["pane_token"] for dead in permitidos}

    def vivo(self, r):
        return self.panel_propio(r, solo_vivo=True)

    def limpiar_proceso(self, r):
        pid = r.get("pid")
        if pid:
            r["cleanup"] = terminar_grupo(pid, r.get("process_identity"))
        r["pid"] = None
        r["process_identity"] = None

    def refrescar(self):
        registros = self.todos()
        for r in registros:
            if r["state"] in ACTIVOS and not self.vivo(r):
                self.limpiar_proceso(r)
                r["state"] = "interrupted"
                r["result"] = "Pane cerrado o runner interrumpido"
                r["attempts"][-1].update(state="interrupted", result=r["result"], ended_at=ahora())
                self.guardar(r)
        return registros

    def validar_modelo(self, modelo):
        modelos = json.loads(self.catalog.read_text())["models"]
        if not isinstance(modelo, str) or modelo not in {m["slug"] for m in modelos}:
            raise ValueError(f"Modelo fuera del catálogo: {modelo}")

    def rama(self, wt):
        if Path(git(wt, "rev-parse", "--show-toplevel")).resolve() != Path(wt):
            raise ValueError("worktree debe ser la raíz existente")
        common = Path(git(wt, "rev-parse", "--path-format=absolute", "--git-common-dir"))
        if common != self.base.parent:
            raise ValueError("Worktree de otro repositorio")
        rama = git(wt, "symbolic-ref", "--quiet", "--short", "HEAD")
        if rama != "feat/crm" and not rama.startswith("feat/crm-"):
            raise ValueError("Solo feat/crm o ramas especialistas feat/crm-*")
        return rama

    def admision(self, r, registros):
        activos = [x for x in registros if x["state"] in ACTIVOS and x["id"] != r["id"]]
        if len(activos) >= 3:
            raise ValueError("Límite: coordinador externo + 3 workers")
        if r["parent"]:
            padres = [x for x in registros if x["id"] == r["parent"]]
            if not padres or padres[0]["state"] not in ACTIVOS:
                raise ValueError("parent debe ser un worker activo registrado")
            if padres[0]["parent"]:
                raise ValueError("Un apoyo no puede delegar (profundidad máxima 1)")
        for x in activos:
            if x["worktree"] == r["worktree"] or x["branch"] == r["branch"]:
                raise ValueError("Worktree o rama ya activos")
            if any(solapa(a, b) for a in r["ownership"] for b in x["ownership"]):
                raise ValueError(f"Ownership incompatible con {x['id']}")

    def lanzar(self, r, resume=None):
        numero = len(r["attempts"]) + 1
        intento = {"number": numero, "started_at": ahora(), "resume": resume,
                   "state": "starting", "exit": None, "model": r["model"],
                   "session": r["session"],
                   "report": str(self.ruta(r["id"]) / f"report-{numero}.txt"),
                   "log": str(self.ruta(r["id"]) / f"events-{numero}.jsonl")}
        r["attempts"].append(intento)
        r.update(state="starting", pane=None, pane_token=uuid.uuid4().hex,
                 pid=None, process_identity=None, result=None, exit=None)
        intento["pane_token"] = r["pane_token"]
        self.guardar(r)
        comando = shlex.join([sys.executable, str(Path(__file__).resolve()),
                              "--repo", str(self.repo), "_run", r["id"]])
        nombre = re.sub(r"[^a-zA-Z0-9_.-]", "_", f"{r['role']}-{r['task']}-{r['model']}-{numero}")
        t = r["tmux"]
        try:
            existe = subprocess.run(t + ["has-session", "-t", "=" + r["session"]],
                                    capture_output=True).returncode == 0
            args = (["new-window", "-d", "-t", "=" + r["session"] + ":"] if existe else
                    ["new-session", "-d", "-s", r["session"]])
            r["pane"] = ejecutar(t + args + ["-n", nombre, "-P", "-F", "#{pane_id}", comando])
            intento["pane"] = r["pane"]
            ejecutar(t + ["set-option", "-p", "-t", r["pane"], "@eli_crm_attempt", r["pane_token"]])
            ejecutar(t + ["set-option", "-w", "-t", r["pane"], "remain-on-exit", "on"])
            self.guardar(r)
        except (OSError, subprocess.CalledProcessError) as e:
            if self.panel_propio(r):
                subprocess.run(t + ["kill-pane", "-t", r["pane"]], capture_output=True)
            r.update(state="failed", result=str(e))
            intento.update(state="failed", result=r["result"], ended_at=ahora())
            self.guardar(r)
            raise
        return r

    def start(self, task, role, model, worktree, prompt_file, parent=None, owns=()):
        caller = os.environ.get("CRM_AGENT_RUN_ID")
        if caller and parent != caller:
            raise ValueError("Un worker debe declarar --parent con su CRM_AGENT_RUN_ID")
        if not re.fullmatch(r"[\w-]+", role):
            raise ValueError("Rol inválido")
        rol = tomllib.loads((self.roles / (role + ".toml")).read_text())
        for campo in ("name", "description", "developer_instructions"):
            if not isinstance(rol.get(campo), str) or not rol[campo].strip():
                raise ValueError(f"Falta {campo} en el rol")
        model = model or rol.get("model")
        self.validar_modelo(model)
        ownership = []
        for p in owns:
            if any(c in p for c in "*?[]{}"):
                raise ValueError("--owns no admite globs")
            if not p or p.startswith("/") or any(x in ("", ".", "..") for x in p.split("/")):
                raise ValueError("--owns requiere rutas relativas canónicas sin ..")
            ownership.append(p)
        if not ownership:
            raise ValueError("Declara archivos/directorios propios mediante --owns")
        wt = str(Path(worktree).resolve(strict=True))
        prompt = Path(prompt_file).read_text()
        if not prompt.strip() or not task.strip():
            raise ValueError("Tarea y prompt no pueden estar vacíos")
        with self.lock():
            registros = self.refrescar()
            r = dict(id=uuid.uuid4().hex, task=task, role=role, model=model, parent=parent,
                     worktree=wt, branch=self.rama(wt), ownership=ownership, session=self.session,
                     tmux=self.tmux, codex_session=None, attempts=[], created_at=ahora())
            self.admision(r, registros)
            self.ruta(r["id"]).mkdir(mode=0o700)
            texto = (f"Rol: {rol['name']}\n{rol['description']}\n{rol['developer_instructions']}\n"
                     f"{REGLAS}\nTarea: {task}\nParent: {parent or 'ninguno'}\n"
                     f"Ownership: {json.dumps(ownership)}\nEncargo:\n{prompt}")
            (self.ruta(r["id"]) / "prompt.txt").write_text(texto)
            return self.lanzar(r)

    def recover(self, run, resume=None, retry=False):
        with self.lock():
            registros = self.refrescar()
            r = self.leer(run)
            caller = os.environ.get("CRM_AGENT_RUN_ID")
            if caller and r["parent"] != caller:
                raise ValueError("Un worker solo puede recuperar su propio apoyo")
            if r["state"] not in {"interrupted", "failed", "stopped"}:
                raise ValueError("Solo se recuperan interrupted/failed/stopped")
            if resume:
                uuid.UUID(resume)
                if resume != r["codex_session"]:
                    raise ValueError("UUID no coincide con la sesión registrada")
            elif not retry or r["codex_session"]:
                raise ValueError("Indica --resume UUID registrado; sin UUID usa --retry")
            self.validar_modelo(r["model"])
            if self.rama(r["worktree"]) != r["branch"]:
                raise ValueError("La rama cambió desde el lanzamiento")
            self.admision(r, registros)
            return self.lanzar(r, resume)

    def stop(self, run):
        with self.lock():
            r = self.leer(run)
            if r["state"] in ACTIVOS:
                self.limpiar_proceso(r)
                if self.panel_propio(r):
                    subprocess.run(r["tmux"] + ["kill-pane", "-t", r["pane"]], capture_output=True)
                r.update(state="stopped", result="Detenido explícitamente")
                r["attempts"][-1].update(state="stopped", result=r["result"], ended_at=ahora())
                self.guardar(r)
            return r

    def runner(self, run):
        proceso = None
        identidad = None
        def interrumpir(signum, frame):
            # El finally del pipe garantiza EOF incluso antes de capturar PID.
            raise InterruptedError(f"Señal {signum}")
        for sig in (signal.SIGTERM, signal.SIGHUP, signal.SIGINT):
            signal.signal(sig, interrumpir)
        # start mantiene el lock hasta configurar remain-on-exit y guardar el pane.
        with self.lock():
            r = self.leer(run)
            if r["state"] != "starting":
                return 1
            n = len(r["attempts"])
            a = r["attempts"][-1]
            prompt = (self.ruta(run) / "prompt.txt").read_text()
            cmd = ["codex", "--no-daemon", "exec"]
            if a["resume"]:
                cmd += ["resume", a["resume"]]
            cmd += ["--json", "-m", r["model"], "-o", a["report"]]
            cmd += ["-c", 'sandbox_mode="workspace-write"',
                    "-c", 'approval_policy="never"', "-c",
                    "sandbox_workspace_write.writable_roots=" + json.dumps([str(self.base.parent)])]
            if not a["resume"]:
                cmd += ["-C", r["worktree"], "--sandbox", "workspace-write",
                        "--add-dir", str(self.base.parent)]
            cmd += [prompt]
            r["state"] = a["state"] = "running"
            self.guardar(r)
        fallo = None
        codigo = None
        limpieza_pendiente = None
        try:
            with Path(a["log"]).open("a") as log:
                with self.lock():
                    actual = self.leer(run)
                    if actual["state"] != "running" or len(actual["attempts"]) != n:
                        return 1
                    lectura, escritura = os.pipe()
                    try:
                        wrapper = [sys.executable, str(Path(__file__).resolve()),
                                   "_exec", str(lectura), json.dumps(cmd)]
                        proceso = subprocess.Popen(wrapper, cwd=r["worktree"], stdout=subprocess.PIPE,
                                                   stderr=subprocess.STDOUT, text=True, start_new_session=True,
                                                   pass_fds=(lectura,),
                                                   env={**os.environ, "CRM_AGENT_RUN_ID": run})
                        os.close(lectura)
                        lectura = None
                        identidad = identidad_proceso(proceso.pid)
                        if identidad is None or identidad["pgid"] != proceso.pid:
                            raise ValueError("No se pudo identificar el wrapper exclusivo")
                        actual.update(pid=proceso.pid, process_identity=identidad)
                        actual["attempts"][-1].update(pid=proceso.pid, process_identity=identidad)
                        self.guardar(actual)
                        os.write(escritura, b"G")  # Solo después de persistir PID e identidad.
                    finally:
                        if lectura is not None:
                            os.close(lectura)
                        os.close(escritura)
                for linea in proceso.stdout:
                    log.write(linea)
                    log.flush()
                    print(linea, end="", flush=True)
                    try:
                        evento = json.loads(linea)
                    except json.JSONDecodeError:
                        continue
                    if not isinstance(evento, dict):
                        continue
                    if evento.get("type") in {"turn.failed", "error"}:
                        fallo = linea.strip()
                    if evento.get("type") == "thread.started" and evento.get("thread_id"):
                        uuid.UUID(evento["thread_id"])
                        with self.lock():
                            actual = self.leer(run)
                            if actual["state"] == "running" and len(actual["attempts"]) == n:
                                actual["codex_session"] = evento["thread_id"]
                                actual["attempts"][-1]["codex_session"] = evento["thread_id"]
                                self.guardar(actual)
                codigo = proceso.wait()
            if codigo != 0:
                fallo = fallo or f"Codex terminó con exit {codigo}"
            if not Path(a["report"]).is_file() or not Path(a["report"]).read_text().strip():
                fallo = fallo or "Entrega fallida: informe vacío o ausente"
        except (OSError, ValueError, InterruptedError) as e:
            fallo = str(e)
            if proceso is not None:
                try:
                    if identidad is not None:
                        terminar_grupo(proceso.pid, identidad)
                    # Sin identidad no hubo token: el wrapper sale por EOF.
                    codigo = proceso.wait(timeout=2)
                except (OSError, ValueError, subprocess.TimeoutExpired) as error:
                    limpieza_pendiente = str(error)
        with self.lock():
            actual = self.leer(run)
            if actual["state"] == "running" and len(actual["attempts"]) == n:
                if limpieza_pendiente:
                    actual["result"] = "Limpieza pendiente; cupo reservado: " + limpieza_pendiente
                else:
                    actual.update(state="failed" if fallo else "awaiting-review", exit=codigo,
                                  result=fallo or a["report"], pid=None, process_identity=None)
                    actual["attempts"][-1].update(state=actual["state"], exit=codigo,
                                                  result=actual["result"], ended_at=ahora())
                self.guardar(actual)
        print(f"\n{actual['state']}: {actual['result']}", flush=True)
        return 1 if fallo else 0


def main():
    if sys.argv[1:2] == ["_exec"]:
        return wrapper_exec(int(sys.argv[2]), json.loads(sys.argv[3]))
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo", default=str(Path(__file__).resolve().parents[1]))
    p.add_argument("--session", default="eli-crm")
    p.add_argument("--socket", help="Socket tmux separado, para pruebas")
    p.add_argument("--catalog")
    p.add_argument("--roles")
    sub = p.add_subparsers(dest="command", required=True)
    s = sub.add_parser("start")
    for campo in ("task", "role", "worktree", "prompt-file"):
        s.add_argument("--" + campo, required=True)
    s.add_argument("--model")
    s.add_argument("--parent")
    s.add_argument("--owns", action="append", required=True)
    s = sub.add_parser("status")
    s.add_argument("run", nargs="?")
    s = sub.add_parser("recover")
    s.add_argument("run")
    m = s.add_mutually_exclusive_group(required=True)
    m.add_argument("--resume")
    m.add_argument("--retry", action="store_true")
    for nombre in ("stop", "_run"):
        sub.add_parser(nombre).add_argument("run")
    a = p.parse_args()
    try:
        l = Lanzador(a.repo, a.session, a.socket, a.catalog, a.roles)
        if a.command == "start":
            salida = l.start(a.task, a.role, a.model, a.worktree, a.prompt_file, a.parent, a.owns)
        elif a.command == "recover":
            salida = l.recover(a.run, a.resume, a.retry)
        elif a.command == "stop":
            salida = l.stop(a.run)
        elif a.command == "_run":
            return l.runner(a.run)
        else:
            with l.lock():
                salida = l.refrescar()
                if a.run:
                    salida = l.leer(a.run)
        print(json.dumps(salida, indent=2, ensure_ascii=False))
        return 0
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
