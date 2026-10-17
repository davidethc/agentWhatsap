"""Pruebas stdlib: repositorios temporales y binarios falsos; nunca eli-crm real."""
import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "crm-agents.py"
spec = importlib.util.spec_from_file_location("crm_agents", SCRIPT)
crm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(crm)
UUID = "12345678-1234-4234-8234-123456789abc"

TMUX = r'''#!/usr/bin/env python3
import fcntl, json, os, pathlib, sys
p = pathlib.Path(os.environ['FAKE_TMUX'])
a = sys.argv[1:]
with p.with_suffix('.lock').open('a') as f:
 fcntl.flock(f, fcntl.LOCK_EX)
 d = json.loads(p.read_text()) if p.exists() else {'panes': {}, 'calls': []}
 d['calls'].append(a)
 if a[:1] == ['-L']: a = a[2:]
 cmd = a[0]
 rc = 0
 if cmd == 'has-session': rc = 0 if d['panes'] else 1
 elif cmd in ('new-session', 'new-window'):
  pane = '%' + str(len(d['panes']) + 1)
  d['panes'][pane] = True
  print(pane)
 elif cmd == 'display-message':
  pane = a[a.index('-t') + 1]
  if pane in d['panes']: print(('0:' if d['panes'][pane] else '1:') + pane + ':' + d.get('tokens', {}).get(pane, ''))
  else: rc = 1
 elif cmd == 'kill-pane': d['panes'][a[a.index('-t') + 1]] = False
 elif cmd == 'set-option' and '@eli_crm_attempt' in a:
  d.setdefault('tokens', {})[a[a.index('-t')+1]] = a[-1]
 elif cmd != 'set-option': rc = 2
 p.write_text(json.dumps(d))
 sys.exit(rc)
'''

CODEX = r'''#!/usr/bin/env python3
import json, os, pathlib, sys, time
a = sys.argv[1:]
pathlib.Path(os.environ['FAKE_ARGS']).write_text(json.dumps({'args': a, 'cwd': os.getcwd(), 'parent': os.environ.get('CRM_AGENT_RUN_ID'), 'pid': os.getpid()}))
mode = os.environ.get('FAKE_MODE', 'ok')
if mode != 'no-thread':
 print(json.dumps({'type': 'thread.started', 'thread_id': '12345678-1234-4234-8234-123456789abc'}), flush=True)
if mode == 'wait':
 time.sleep(30)
if mode == 'failed': print(json.dumps({'type': 'turn.failed', 'error': {'message': 'model unavailable'}}))
if mode not in ('empty', 'no-thread', 'runtime'):
 pathlib.Path(a[a.index('-o') + 1]).write_text('Informe: pruebas verificadas; SHA de ejemplo para revisión.')
if mode == 'runtime':
 print('modelo no disponible', file=sys.stderr)
 sys.exit(9)
'''


class PruebasCLI(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="crm pruebas '")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.repo = self.root / "repo"
        self.repo.mkdir()
        self.cmd("git", "init", "-q", "-b", "feat/crm-base", str(self.repo))
        self.cmd("git", "-C", str(self.repo), "-c", "user.name=Pruebas", "-c",
                 "user.email=pruebas@example.invalid", "commit", "--allow-empty", "-qm", "inicial")
        self.wts = []
        for n in range(5):
            wt = self.root / f"wt {n} ' $(touch INYECTADO);"
            self.cmd("git", "-C", str(self.repo), "worktree", "add", "-q", "-b", f"feat/crm-{n}", str(wt))
            self.wts.append(wt)
        roles = self.repo / ".Codex/agents"
        roles.mkdir(parents=True)
        (roles / "crm-operaciones.toml").write_text('name = "crm-operaciones"\ndescription = "Operaciones"\ndeveloper_instructions = "Solo archivos propios"\nmodel = "gpt-6.1-sol"\n')
        self.catalog = self.root / "models.json"
        self.catalog.write_text(json.dumps({"models": [{"slug": x} for x in
                                                      ("gpt-6-astra", "gpt-6.1-sol", "gpt-6-luna")]}))
        self.prompt = self.root / "prompt ' ;.txt"
        self.prompt.write_text("Implementa ORQ; literal $(touch INYECTADO) y `touch INYECTADO`.\n")
        binario = self.root / "bin"
        binario.mkdir()
        for nombre, texto in (("tmux", TMUX), ("codex", CODEX)):
            p = binario / nombre
            p.write_text(texto)
            p.chmod(0o755)
        self.env = {"PATH": str(binario) + os.pathsep + os.environ["PATH"],
                    "FAKE_TMUX": str(self.root / "tmux.json"),
                    "FAKE_ARGS": str(self.root / "args.json"), "FAKE_MODE": "ok"}
        entorno = patch.dict(os.environ, self.env)
        entorno.start()
        self.addCleanup(entorno.stop)
        self.l = crm.Lanzador(self.repo, "pruebas-crm", "socket-pruebas", self.catalog)

    def cmd(self, *args):
        return subprocess.run(args, check=True, text=True, capture_output=True)

    def start(self, n=0, **kw):
        args = dict(task=f"ORQ-{n}", role="crm-operaciones", model=None,
                    worktree=self.wts[n], prompt_file=self.prompt, owns=[f"area{n}"])
        args.update(kw)
        return self.l.start(**args)

    def runner(self, r, mode="ok"):
        return subprocess.run([sys.executable, str(SCRIPT), "--repo", str(self.repo), "_run", r["id"]],
                              env={**os.environ, "FAKE_MODE": mode}, text=True, capture_output=True)

    def cerrar(self, r):
        self.cmd(*r["tmux"], "kill-pane", "-t", r["pane"])

    def test_pane_reutilizado_no_es_propio_ni_se_cierra(self):
        r = self.start()
        p = Path(self.env["FAKE_TMUX"])
        d = json.loads(p.read_text())
        d["tokens"][r["pane"]] = "otro-intento"
        p.write_text(json.dumps(d))
        self.assertFalse(self.l.vivo(r))
        self.l.stop(r["id"])
        d = json.loads(p.read_text())
        self.assertTrue(d["panes"][r["pane"]])
        self.assertEqual(self.l.leer(r["id"])["state"], "stopped")

    def test_registro_y_escaping(self):
        r = self.start(task="ORQ; $(touch INYECTADO)")
        self.assertEqual(r["model"], "gpt-6.1-sol")
        self.assertEqual(r["tmux"], ["tmux", "-L", "socket-pruebas"])
        d = json.loads(Path(self.env["FAKE_TMUX"]).read_text())
        creacion = next(c for c in d["calls"] if "new-session" in c)
        import shlex
        shell = shlex.split(creacion[-1])
        self.assertEqual(shell[-2:], ["_run", r["id"]])
        self.assertEqual(shell[3], str(self.repo))
        self.assertIn("crm-operaciones-ORQ", creacion[creacion.index("-n") + 1])
        self.assertIn("gpt-6.1-sol", creacion[creacion.index("-n") + 1])
        self.assertTrue(any("remain-on-exit" in c for c in d["calls"]))
        # Ejecutar exactamente el shell-command entregado a tmux prueba quoting real.
        out = subprocess.run(creacion[-1], shell=True, text=True, capture_output=True)
        self.assertEqual(out.returncode, 0, out.stderr)
        r = self.l.leer(r["id"])
        self.assertEqual(r["state"], "awaiting-review")
        self.assertEqual(r["codex_session"], UUID)
        self.assertEqual(r["exit"], 0)
        self.assertTrue(self.l.vivo(r))
        datos = json.loads(Path(self.env["FAKE_ARGS"]).read_text())
        self.assertEqual(datos["cwd"], str(self.wts[0]))
        self.assertEqual(datos["parent"], r["id"])
        self.assertEqual(datos["args"][:3], ["--no-daemon", "exec", "--json"])
        self.assertEqual(datos["args"][datos["args"].index("-C") + 1], str(self.wts[0]))
        self.assertIn(self.prompt.read_text(), datos["args"][-1])
        self.assertIn("No uses Notion", datos["args"][-1])
        self.assertFalse(any(self.root.rglob("INYECTADO")))
        self.assertTrue(Path(r["attempts"][0]["log"]).read_text())
        self.assertEqual(self.cmd("git", "-C", str(self.repo), "status", "--porcelain").stdout.strip(), "?? .Codex/")

    def test_limite_concurrente_real_entre_procesos(self):
        def lanzar(n):
            return subprocess.run([sys.executable, str(SCRIPT), "--repo", str(self.repo),
                                   "--catalog", str(self.catalog), "--session", "pruebas-crm", "--socket", "socket-pruebas",
                                   "start", "--task", f"T{n}", "--role", "crm-operaciones",
                                   "--worktree", str(self.wts[n]), "--prompt-file", str(self.prompt),
                                   "--owns", f"area{n}"], text=True, capture_output=True)
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            resultados = list(pool.map(lanzar, range(5)))
        self.assertEqual(sum(x.returncode == 0 for x in resultados), 3)
        self.assertEqual(sum("Límite" in x.stderr for x in resultados), 2)
        self.assertEqual(len(self.l.todos()), 3)

    def test_parent_profundidad_y_omision(self):
        with self.assertRaisesRegex(ValueError, "parent"):
            self.start(parent="a" * 32)
        padre = self.start()
        apoyo = self.start(1, parent=padre["id"])
        with self.assertRaisesRegex(ValueError, "profundidad"):
            self.start(2, parent=apoyo["id"])
        with patch.dict(os.environ, {"CRM_AGENT_RUN_ID": padre["id"]}):
            with self.assertRaisesRegex(ValueError, "--parent"):
                self.start(2)
        self.l.stop(padre["id"])
        with self.assertRaisesRegex(ValueError, "activo"):
            self.start(2, parent=padre["id"])

    def test_overlap_worktree_rama_y_ownership(self):
        self.start(owns=["crm-v2-diseno/src"])
        with self.assertRaisesRegex(ValueError, "Worktree"):
            self.start()
        for ruta in ("crm-v2-diseno/src", "crm-v2-diseno", "crm-v2-diseno/src/a.py"):
            with self.assertRaisesRegex(ValueError, "Ownership"):
                self.start(1, owns=[ruta])
        self.start(1, owns=["crm-v2-diseno/src-otro"])
        for ruta in ("../x", "/x", "a/../x", "a/", "."):
            with self.assertRaisesRegex(ValueError, "rutas"):
                self.start(2, owns=[ruta])

    def test_guarda_rama_repo_modelo_y_rol(self):
        self.cmd("git", "-C", str(self.wts[0]), "switch", "-qc", "main")
        with self.assertRaisesRegex(ValueError, "feat/crm"):
            self.start()
        with self.assertRaisesRegex(ValueError, "catálogo"):
            self.start(1, model="modelo-inexistente")
        with self.assertRaisesRegex(ValueError, "Rol"):
            self.start(1, role="../escape")
        sub = self.wts[1] / "sub"
        sub.mkdir()
        with self.assertRaisesRegex(ValueError, "raíz"):
            self.start(1, worktree=sub)
        otro = self.root / "otro"
        self.cmd("git", "init", "-q", str(otro))
        with self.assertRaisesRegex(ValueError, "otro repositorio"):
            self.start(1, worktree=otro)

    def test_fallos_entrega_y_runtime_sin_fallback(self):
        for mode, mensaje in (("failed", "turn.failed"), ("empty", "informe"), ("runtime", "exit 9")):
            with self.subTest(mode=mode):
                r = self.start()
                out = self.runner(r, mode)
                self.assertEqual(out.returncode, 1)
                actual = self.l.leer(r["id"])
                self.assertEqual(actual["state"], "failed")
                self.assertIn(mensaje, actual["result"])
                self.assertEqual(len(actual["attempts"]), 1)
                self.assertEqual(actual["model"], "gpt-6.1-sol")
                self.assertEqual(actual["exit"], 9 if mode == "runtime" else 0)
                self.assertIn("thread.started", Path(actual["attempts"][0]["log"]).read_text())

    def test_recover_uuid_e_historial(self):
        r = self.start()
        self.runner(r, "failed")
        with self.assertRaisesRegex(ValueError, "--resume"):
            self.l.recover(r["id"], retry=True)
        with self.assertRaisesRegex(ValueError, "coincide"):
            self.l.recover(r["id"], resume="00000000-0000-4000-8000-000000000000")
        recuperado = self.l.recover(r["id"], resume=UUID)
        self.assertEqual(len(recuperado["attempts"]), 2)
        self.assertEqual(recuperado["attempts"][0]["state"], "failed")
        self.assertNotEqual(recuperado["attempts"][0]["report"], recuperado["attempts"][1]["report"])
        self.assertEqual(self.runner(recuperado).returncode, 0)
        args = json.loads(Path(self.env["FAKE_ARGS"]).read_text())["args"]
        self.assertEqual(args[:4], ["--no-daemon", "exec", "resume", UUID])
        self.assertNotIn("--last", args)
        self.assertNotIn("-C", args)

    def test_interrupted_sin_uuid_retry_explicito_y_rama_cambiada(self):
        r = self.start()
        self.cerrar(r)
        with self.l.lock():
            self.l.refrescar()
        self.assertEqual(self.l.leer(r["id"])["state"], "interrupted")
        with self.assertRaisesRegex(ValueError, "--retry"):
            self.l.recover(r["id"])
        self.cmd("git", "-C", str(self.wts[0]), "switch", "-qc", "feat/crm-cambio")
        with self.assertRaisesRegex(ValueError, "rama cambió"):
            self.l.recover(r["id"], retry=True)
        self.cmd("git", "-C", str(self.wts[0]), "switch", "feat/crm-0")
        nuevo = self.l.recover(r["id"], retry=True)
        self.assertEqual(len(nuevo["attempts"]), 2)
        self.assertEqual(nuevo["attempts"][0]["state"], "interrupted")
        self.assertEqual(self.runner(nuevo).returncode, 0)

    def test_stop_mata_codex_y_no_sobrescribe_estado(self):
        r = self.start()
        proceso = subprocess.Popen([sys.executable, str(SCRIPT), "--repo", str(self.repo), "_run", r["id"]],
                                   env={**os.environ, "FAKE_MODE": "wait"}, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL)
        self.addCleanup(lambda: proceso.poll() is None and proceso.kill())
        limite = time.monotonic() + 5
        while time.monotonic() < limite:
            actual = self.l.leer(r["id"])
            if actual.get("codex_session"):
                break
            time.sleep(.02)
        self.assertEqual(actual["codex_session"], UUID)
        pid = actual["pid"]
        detenido = self.l.stop(r["id"])
        proceso.wait(timeout=5)
        self.assertEqual(detenido["state"], "stopped")
        self.assertEqual(self.l.leer(r["id"])["state"], "stopped")
        self.assertFalse(self.l.vivo(detenido))
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_status_refresca_y_paths_invalidos(self):
        r = self.start()
        self.cerrar(r)
        out = self.cmd(sys.executable, str(SCRIPT), "--repo", str(self.repo), "status", r["id"])
        self.assertEqual(json.loads(out.stdout)["state"], "interrupted")
        with self.assertRaisesRegex(ValueError, "ID"):
            self.l.leer("../../escape")

    def test_pane_cerrado_interrumpe_proceso_y_reanuda_uuid(self):
        r = self.start()
        proceso = subprocess.Popen([sys.executable, str(SCRIPT), "--repo", str(self.repo), "_run", r["id"]],
                                   env={**os.environ, "FAKE_MODE": "wait"}, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL)
        self.addCleanup(lambda: proceso.poll() is None and proceso.kill())
        limite = time.monotonic() + 5
        while time.monotonic() < limite:
            actual = self.l.leer(r["id"])
            if actual.get("codex_session"):
                break
            time.sleep(.02)
        self.assertEqual(actual["codex_session"], UUID)
        self.cerrar(r)
        with self.l.lock():
            self.l.refrescar()
        proceso.wait(timeout=5)
        self.assertEqual(self.l.leer(r["id"])["state"], "interrupted")
        recuperado = self.l.recover(r["id"], resume=UUID)
        self.assertEqual(self.runner(recuperado).returncode, 0)
        self.assertEqual(self.l.leer(r["id"])["state"], "awaiting-review")

    def test_recover_respeta_cupo_y_modelo_explicito(self):
        r = self.start(model="gpt-6-luna")
        self.runner(r, "failed")
        for n in (1, 2, 3):
            self.start(n)
        with self.assertRaisesRegex(ValueError, "Límite"):
            self.l.recover(r["id"], resume=UUID)
        self.assertEqual(self.l.leer(r["id"])["model"], "gpt-6-luna")
        self.assertEqual(len(self.l.leer(r["id"])["attempts"]), 1)

    def test_fallo_tmux_registrado_y_recover_no_elude_parent(self):
        with patch.object(self.l, "tmux", [str(self.root / "tmux-inexistente")]):
            with self.assertRaises(FileNotFoundError):
                self.start()
        r = self.l.todos()[0]
        self.assertEqual(r["state"], "failed")
        self.assertIn("tmux-inexistente", r["result"])
        self.assertEqual(r["attempts"][0]["state"], "failed")
        with patch.dict(os.environ, {"CRM_AGENT_RUN_ID": "a" * 32}):
            with self.assertRaisesRegex(ValueError, "propio apoyo"):
                self.l.recover(r["id"], retry=True)

    def comprobar_policy(self):
        args = json.loads(Path(self.env["FAKE_ARGS"]).read_text())["args"]
        config = [args[n + 1] for n, arg in enumerate(args) if arg == "-c"]
        self.assertIn('sandbox_mode="workspace-write"', config)
        self.assertIn('approval_policy="never"', config)
        roots = next(x.split("=", 1)[1] for x in config if x.startswith("sandbox_workspace_write.writable_roots="))
        self.assertEqual(json.loads(roots), [str(self.l.base.parent)])
        self.assertFalse(any("bypass" in x or "danger-full-access" in x for x in args))
        return args

    def test_policy_start_y_resume(self):
        r = self.start()
        self.assertEqual(self.runner(r, "failed").returncode, 1)
        args = self.comprobar_policy()
        self.assertEqual(args[args.index("--add-dir") + 1], str(self.l.base.parent))
        self.assertEqual(args[args.index("--sandbox") + 1], "workspace-write")
        nuevo = self.l.recover(r["id"], resume=UUID)
        self.assertEqual(self.runner(nuevo).returncode, 0)
        args = self.comprobar_policy()
        self.assertEqual(args[:4], ["--no-daemon", "exec", "resume", UUID])
        self.assertNotIn("--add-dir", args)

    def test_ramas_exactas_y_ownership_sin_globs(self):
        for rama in ("feat/crmfoo", "feat/crmfoo-otra"):
            self.cmd("git", "-C", str(self.wts[0]), "switch", "-qc", rama)
            with self.assertRaisesRegex(ValueError, "feat/crm"):
                self.start()
        self.cmd("git", "-C", str(self.wts[0]), "switch", "-qc", "feat/crm")
        for ruta in ("src/*", "src/**/a.py", "src/a?.py", "src/[ab].py", "src/{a,b}"):
            with self.assertRaisesRegex(ValueError, "glob"):
                self.start(owns=[ruta])
        self.assertEqual(self.start()["branch"], "feat/crm")

    def test_sigkill_entre_popen_y_guardar_pid(self):
        r = self.start()
        self.start(1)
        self.start(2)
        marca = self.root / "wrapper-pid.txt"
        # Instrumentación solo en este subproceso de prueba: el launcher real no
        # incorpora hooks/env vars capaces de detener o alterar el protocolo.
        arnes = '''import importlib.util, pathlib, subprocess, sys, time
s=importlib.util.spec_from_file_location('crm_prueba', sys.argv[1])
m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
l=m.Lanzador(sys.argv[2])
real=subprocess.Popen
def pausa(*a, **kw):
    hijo=real(*a, **kw)
    marca=pathlib.Path(sys.argv[4]); tmp=marca.with_suffix('.tmp')
    tmp.write_text(str(hijo.pid)); tmp.replace(marca)
    while True: time.sleep(.05)
m.subprocess.Popen=pausa
l.runner(sys.argv[3])
'''
        padre = subprocess.Popen([sys.executable, "-c", arnes, str(SCRIPT), str(self.repo), r["id"], str(marca)],
                                 env={**os.environ, "FAKE_MODE": "wait"}, stdout=subprocess.DEVNULL,
                                 stderr=subprocess.DEVNULL)
        hijo = None
        try:
            limite = time.monotonic() + 5
            while not marca.exists() and time.monotonic() < limite:
                time.sleep(.01)
            self.assertTrue(marca.exists())
            hijo = int(marca.read_text())
            # Dar tiempo a que el Codex fake arranque en la implementación rota.
            time.sleep(.5)
            self.assertFalse(Path(self.env["FAKE_ARGS"]).exists(), "Codex ejecutado antes de persistir PID")
            self.assertIsNone(self.l.leer(r["id"])["pid"])
            self.assertEqual(sum(x["state"] in crm.ACTIVOS for x in self.l.todos()), 3)
            padre.kill()  # SIGKILL, no finally ni manejadores del runner.
            padre.wait(timeout=5)
            limite = time.monotonic() + 5
            while crm.identidad_proceso(hijo) is not None and time.monotonic() < limite:
                time.sleep(.01)
            self.assertIsNone(crm.identidad_proceso(hijo), "Wrapper vivo tras EOF del handshake")
            self.assertFalse(Path(self.env["FAKE_ARGS"]).exists())
            with self.assertRaisesRegex(ValueError, "Límite"):
                self.start(3)
            self.cerrar(r)
            with self.l.lock():
                self.l.refrescar()
            self.assertEqual(self.l.leer(r["id"])["state"], "interrupted")
            self.start(3)
            self.assertEqual(sum(x["state"] in crm.ACTIVOS for x in self.l.todos()), 3)
        finally:
            # El padre sigue bloqueado en pausa si una aserción falla: su hijo
            # directo aún no se ha recolectado y ese PID no puede reutilizarse.
            if padre.poll() is None:
                if hijo:
                    try:
                        os.kill(hijo, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                padre.kill()
            padre.wait(timeout=5)

    def test_pid_reutilizado_no_recibe_killpg(self):
        anterior = {"pid": 123, "pgid": 123, "start": [100, 1]}
        reutilizado = {**anterior, "start": [100, 2]}
        r = {"pid": 123, "process_identity": anterior}
        with patch.object(crm, "identidad_proceso", return_value=reutilizado), patch.object(crm.os, "killpg") as matar:
            self.l.limpiar_proceso(r)
            matar.assert_not_called()
        self.assertIsNone(r["pid"])
        self.assertIn("reutilizado", r["cleanup"])

    def test_identidad_no_verificable_conserva_cupo(self):
        r = self.start()
        r.update(pid=123, process_identity={"pid": 123, "pgid": 123, "start": [100, 1]})
        with self.l.lock():
            self.l.guardar(r)
        with patch.object(crm, "identidad_proceso", side_effect=OSError("identidad inaccesible")), patch.object(crm.os, "killpg") as matar:
            with self.assertRaisesRegex(OSError, "inaccesible"):
                self.l.stop(r["id"])
            matar.assert_not_called()
        self.assertIn(self.l.leer(r["id"])["state"], crm.ACTIVOS)
        self.start(1)
        self.start(2)
        with self.assertRaisesRegex(ValueError, "Límite"):
            self.start(3)

    def test_error_persistir_pid_impide_exec_codex(self):
        r = self.start()
        arnes = '''import importlib.util, sys
s=importlib.util.spec_from_file_location('crm_prueba', sys.argv[1])
m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
l=m.Lanzador(sys.argv[2]); real=l.guardar
def guardar(r):
    if r.get('pid'): raise OSError('Fallo de persistencia simulado')
    return real(r)
l.guardar=guardar
sys.exit(l.runner(sys.argv[3]))
'''
        out = subprocess.run([sys.executable, "-c", arnes, str(SCRIPT), str(self.repo), r["id"]],
                             capture_output=True, text=True, timeout=5)
        self.assertEqual(out.returncode, 1, out.stderr)
        self.assertFalse(Path(self.env["FAKE_ARGS"]).exists())
        actual = self.l.leer(r["id"])
        self.assertEqual(actual["state"], "failed")
        self.assertIn("persistencia", actual["result"])

    def test_exec_conserva_identidad_persistida(self):
        r = self.start()
        proceso = subprocess.Popen([sys.executable, str(SCRIPT), "--repo", str(self.repo), "_run", r["id"]],
                                   env={**os.environ, "FAKE_MODE": "wait"}, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL)
        try:
            limite = time.monotonic() + 5
            while time.monotonic() < limite:
                actual = self.l.leer(r["id"])
                if actual.get("codex_session"):
                    break
                time.sleep(.01)
            self.assertEqual(actual["codex_session"], UUID)
            pid = json.loads(Path(self.env["FAKE_ARGS"]).read_text())["pid"]
            self.assertEqual(actual["pid"], pid)
            self.assertEqual(actual["process_identity"], crm.identidad_proceso(pid))
            self.assertEqual(actual["attempts"][-1]["process_identity"], actual["process_identity"])
        finally:
            self.l.stop(r["id"])
            proceso.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
