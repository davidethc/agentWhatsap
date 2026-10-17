# ORQ-03 — revisión independiente de orquestación

Fecha: 2026-10-16. Revisor: crm-qa-docs. Worktree: `/Users/d/agentWhatsap-crm-revision`, rama `feat/crm-revision`.

**Resultado: no integrar todavía.** Los 13 tests unitarios pasan, pero hay dos problemas P1 de ciclo de vida de procesos y dos P2 de validación confirmados. Además, falta la evidencia operativa exigida por `transicion-v2.md`. Este informe no declara Ready/Done ni valida producto o producción.

## Alcance, versión y método

Se leyeron `scripts/crm-agents.py`, `scripts/pruebas/test_crm_agents.py` y `docs/crm/orquestacion-cli.md` del worktree `/Users/d/agentWhatsap-crm-orquestacion`; `docs/crm/transicion-v2.md`, `AGENTS.md`, `CONTRIBUTING.md` y los siete roles `.Codex/agents/*.toml` de `/Users/d/agentWhatsap-crm`; y `docs/crm/auditoria-transicion.md` de `/Users/d/agentWhatsap-crm-auditoria`.

Se aplicaron las skills `code-review` y `verification-before-completion`. La revisión de estándares y de requisitos se hizo individualmente: la instrucción expresa de no usar otros agentes prevalece sobre la delegación de la skill. La base de requisitos es el encargo ORQ-03 y `transicion-v2.md`; no se pidió otro punto de comparación porque los tres archivos del autor estaban sin seguimiento y el objeto revisado era ese contenido exacto, no un diff de commits.

HEAD del autor observado: `7c0bed1350de8d8e099ae30e1f1cd5b9348fc91b`. Los tres archivos estaban `??`; ese SHA **no contiene** la implementación revisada. Sus SHA-256 permanecieron iguales entre la lectura y las reproducciones:

| Archivo del autor | SHA-256 |
|---|---|
| `scripts/crm-agents.py` | `7a55b9e0947b43e999d9e695ba0f2bd9a00398ca0b90c1b6923e108da194bf75` |
| `scripts/pruebas/test_crm_agents.py` | `5183940886eba70a34c6fc21bd3118de64b23385a699b69a651e4b5b2576bff2` |
| `docs/crm/orquestacion-cli.md` | `9ac2295f1368dbd3bbac02805ab5f015359e69057fa6592e7ba95ad32997639f` |

Las líneas citadas corresponden a estas versiones. Cualquier cambio posterior exige revisar los hallazgos contra el nuevo contenido. No se modificaron fuentes del autor, roles, auditoría, Notion ni `.env`. No hubo servicios, pruebas del producto, pacientes, agentes reales ni push. Las reproducciones mutantes se anunciaron y usaron únicamente repositorios/binarios temporales de la suite; se limpiaron los procesos fake creados.

## Requisitos y defectos confirmados

Severidad: P1 requiere corregir antes de integrar por posible proceso fuera de control o señal a proceso ajeno. P2 requiere corregir el contrato explícito de admisión antes de aprobar esta entrega.

### F1 — P1: un crash entre Popen y persistir PID deja un huérfano fuera del límite

**Código:** `scripts/crm-agents.py:278–282`, limpieza/reconciliación en `88–106`.

El runner crea Codex con `start_new_session=True` y después persiste su PID. Si el runner muere abruptamente entre ambos pasos, el registro conserva `pid=None`. El hijo tiene una sesión independiente y puede sobrevivir; cuando se cierra/muere el pane, `refrescar()` marca `interrupted` sin poder localizarlo. La reserva desaparece aunque ese Codex siga trabajando. Después pueden admitirse tres workers más, superando el máximo real de tres procesos de este lanzador.

**Reproducción ejecutada:** fixture `PruebasCLI.setUp()`, binario temporal `codex` sustituido por Python que solo hace `time.sleep(30)`. En un subprocess runner se envolvió `Lanzador.guardar`: cuando recibe el primer registro con PID, guarda ese PID en un marcador temporal y ejecuta `os._exit(88)` **antes** de llamar al guardado original. Se cerró el pane fake, se ejecutó `refrescar()` bajo lock y se comprobó `os.kill(pid, 0)`. Salida:

```text
RUNNER_EXIT 88 PID_PERSISTIDO None
TRAS_REFRESCAR interrupted CODEX_FAKE_SIGUE_VIVO True ACTIVOS 0
```

Es inyección de un crash en el punto exacto, no una demostración de frecuencia en producción. El fake no escribe a stdout: un fake que emita inmediatamente puede morir por BrokenPipe y ocultar el huérfano. Se terminó el grupo fake en `finally`.

**Fix requerido:** un protocolo de arranque que permita identificar y terminar el intento incluso si el runner cae antes de guardar el PID (por ejemplo, supervisor con identidad durable y handshake antes de ejecutar Codex). No liberar cupo/ownership hasta demostrar terminación o registrar una condición incierta que bloquee admisión. Añadir regresión con crash en esa ventana, cierre y nueva admisión. El lock actual por sí solo no resuelve la supervivencia del hijo.

### F2 — P1: stop/status pueden matar un grupo ajeno por reutilización de PID

**Código:** `scripts/crm-agents.py:88–95`, llamadas desde `101–102` y `230–236`. Identidad del pane: `81–86`.

`limpiar_proceso()` ejecuta `os.killpg(pid, SIGKILL)` usando únicamente un entero persistido. No comprueba arranque de la máquina, inicio del proceso ni pertenencia al intento. Si Codex y el runner mueren sin finalizar el registro y ese PGID se reutiliza, un simple `status` con pane muerto o `stop` puede enviar SIGKILL a otro trabajo. Esto también puede ocurrir dentro del mismo arranque; la advertencia documental de no reutilizar registros entre máquinas/arranques (`orquestacion-cli.md:105–107`) no cubre ese caso.

**Reproducción ejecutada sin señalar procesos reales:** crear un run con la fixture, guardar `pid=424242`, envolver `crm.os.killpg` con `unittest.mock.patch`, llamar `stop`. Resultado: `call(424242, SIGKILL)` sin comprobación de identidad. Es prueba del camino incondicional; no se forzó reutilización real de un PID del sistema.

Además, `vivo()` solo compara `pane_dead` y `%N`. Al reiniciar el servidor tmux esos IDs se pueden reutilizar; un pane ajeno con el mismo ID se considera vivo, y `stop` usa ese mismo ID para `kill-pane`. La simulación con el fake reemplazando el inventario por un pane nuevo con el mismo `%N` devolvió `True`. No se reinició tmux real.

**Fix requerido:** guardar y verificar identidad de proceso/intento y servidor/pane antes de señalar o matar. Ante identidad no verificable, registrar incertidumbre y no enviar señales a ciegas ni liberar capacidad. Añadir pruebas de registro obsoleto, mismo PID con otra identidad, servidor nuevo con mismo pane y grupo confirmado. Un `kill(pid, 0)` adicional solo verifica existencia, no identidad.

### F3 — P2: la guarda acepta `feat/crmfoo`

**Código:** `scripts/crm-agents.py:120–122`; prueba incompleta en `scripts/pruebas/test_crm_agents.py:189–192`; documentación `orquestacion-cli.md:46–47`.

La regla de `AGENTS.md` y los roles permite `feat/crm` o `feat/crm-*`. `startswith("feat/crm")` admite también `feat/crmfoo`.

**Reproducción ejecutada:** en `wts[0]` temporal, `git switch -qc feat/crmfoo`; después `start()`. Salida: `BRANCH feat/crmfoo`. Se creó una reserva y pane fake en lugar de rechazar.

**Fix requerido:** aceptar exactamente `rama == "feat/crm"` o `rama.startswith("feat/crm-")`; documentar la misma regla. Probar los dos positivos, `feat/crmfoo`, `main` y HEAD separado, también al recuperar.

### F4 — P2: ownership admite globs y no detecta su solapamiento

**Código:** `scripts/crm-agents.py:185–189` y comparación lexical `43–44`, `138–139`; contrato `orquestacion-cli.md:48–49`.

Se promete rechazar globs, pero solo se rechazan rutas absolutas y componentes vacíos, `.` o `..`. Un operador que declare `src/*` obtiene una reserva admitida que no entra en conflicto con `src/a.py`, creando una falsa expectativa de exclusividad.

**Reproducción ejecutada:** `start(owns=["src/*"])` y `start(1, owns=["src/a.py"])`. Salida: `GLOB ['src/*'] ['src/a.py'] admitidos`.

**Fix requerido:** rechazar metacaracteres de glob conforme al contrato y añadir pruebas negativas `*`, `?`, clases `[]`, junto a conflictos archivo/directorio y rutas hermanas válidas. Precisar también si se admiten symlinks: la comparación actual no demuestra identidad canónica de destinos. No se afirma aquí una reproducción de alias por symlink.

## Estándares y coherencia documental

- F3 contradice directamente la norma de ramas de `AGENTS.md` y las instrucciones comunes de los roles.
- F4 contradice el contrato público del CLI. Los demás controles de ownership son una reserva operativa; el propio documento reconoce que no garantizan obediencia del modelo. No se exige aquí un aislamiento de archivos que la especificación no promete.
- `transicion-v2.md` dice que el coordinador registra y lanza apoyos; los roles mandan solicitarle el apoyo. El CLI, en cambio, documenta y admite que el worker haga `start --parent`. La profundidad y atribución están implementadas; falta unificar quién debe ejecutar el lanzamiento. El coordinador debe fijar el flujo documental vigente, sin presentar esto como una frontera de seguridad.
- La auditoría preserva la distinción entre legado, evidencia local y producción, y enumera TK-1 a TK-41. No se encontró en esta lectura un bloqueante nuevo de ese informe. No se repitieron las comprobaciones de producto subyacentes ni se certifica exactitud completa de cada mapeo técnico.
- No se detectaron credenciales literales en los archivos revisados. El modo 0700 de los directorios nuevos reduce exposición local, pero prompts y logs conservan contenido sin redacción, como reconoce el CLI. Esto no certifica ausencia de secretos fuera del alcance ni autoriza datos reales.

## Pruebas ejecutadas y cobertura

Comando en `/Users/d/agentWhatsap-crm-orquestacion`:

```sh
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest discover \
  -s scripts/pruebas -p test_crm_agents.py -v
```

**Resultado observado:** exit 0, `Ran 13 tests in 10.193s`, `OK`. Las reproducciones F1–F4 importaron esa misma suite con `importlib.util` y reutilizaron `PruebasCLI`, limpiando con `doCleanups()`. No se guardaron tests adicionales en el árbol del autor.

| Criterio | Resultado | Evidencia y límites |
|---|---|---|
| Reserva global de tres | Parcial | Test concurrente: cinco procesos start, tres admitidos y dos rechazados. Registro y lock usan Git común. El fake no arranca runners automáticamente; no prueba servidores/sesiones distintos ni resuelve F1. |
| Carrera start/runner | Parcial | El lock se mantiene hasta persistir pane y remain-on-exit; runner lo toma antes de leer. No se observó el clásico overwrite de starting/running en ese camino. El fake de tmux no ejecuta el shell en paralelo a start; falta prueba del interleaving real. F1 sí falla. |
| Parent y profundidad | Pasa sintético | Padre activo, un nivel, rechazo de parent omitido desde worker y recover de apoyo ajeno. Borrar variables no es frontera de seguridad, reconocido por el contrato. |
| Recuperación UUID | Pasa sintético | UUID registrado exacto, rechazo de otro UUID y retry sin UUID; logs/report nuevos, historial, rama/modelo/cupo. No usa `--last`. |
| Stop y cierre | Parcial | Tests matan Codex fake y preservan stopped/interrupted al terminar runner. F1/F2 impiden dar por segura la limpieza general. Los apoyos independientes no se detienen con el padre, comportamiento documentado. |
| Fallo frente a exit 0 | Pasa sintético | turn.failed con exit 0, informe vacío y runtime exit 9 quedan failed; exit 0 con informe queda awaiting-review. Un informe no vacío que admita fallos requiere revisión humana, tal como documenta el CLI; no significa Done. |
| Quoting de shell | Pasa sintético | La suite ejecuta el shell-command exacto con rutas que contienen comillas, espacios y `$()`; no aparece INYECTADO. Codex se lanza como argv, no shell; nombre de ventana sanitizado. |
| Rama y ownership | Falla | F3/F4; tests existentes cubren main, repositorio ajeno, subdirectorio y solapamientos literales, pero omiten esos negativos. |
| Sandbox start/resume y Git común | No probado con Codex real | Véase siguiente apartado. |
| Dos agentes visibles/apoyo en tmux | No probado | No se lanzaron agentes reales por este encargo. El inventario fake no acredita visibilidad ni disponibilidad de modelos/autenticación. |
| Integración, aceptación y tablero | Pendiente del coordinador | El código revisado aún no estaba en commit; no se probó una versión integrada ni se consultó/escribió Notion. |

### Sandbox, resume y commit: evidencia pendiente, sin inventar resultado

Se consultaron localmente `codex --version`, `codex exec --help` y `codex exec resume --help`: CLI `0.163.0`. El inicio admite `-s/--sandbox` y `--add-dir`; el help de resume no los enumera y sí admite `-c`. No se lanzó ninguna sesión real.

El argv construido en `crm-agents.py:261–267` fija modelo, JSON e informe, pero no fija sandbox ni política de permisos. Resume usa `cwd` en Popen y omite `-C`; el test solo observa ese cwd en un fake que acepta cualquier argumento. **No permite afirmar** que una sesión real reanudada tenga las mismas raíces escribibles, ni que pueda escribir su informe externo, crear reservas/apoyos en Git común o hacer commit. Tampoco se inspeccionó configuración privada del usuario para inferir defaults.

En este workspace, `git rev-parse --path-format=absolute --git-common-dir` devuelve `/Users/d/agentWhatsap/.git`, fuera de las raíces escribibles del sandbox del revisor. Un linked worktree requiere escribir metadatos comunes para commit; un mensaje en el prompt no otorga ese permiso. Esta limitación actual no prueba por sí sola qué política tendrá una invocación externa del autor.

**Antes de aceptación operativa:** definir configuración reproducible de sandbox tanto en inicio como en resume y verificar en un entorno sintético autorizado con Codex real: escritura propia, informe, permisos de metadatos Git mínimos para commit local y registro de apoyo, sin producción ni `.env`. Conservar comando/configuración efectiva y evidencia de denegación fuera del alcance. No resolverlo deshabilitando indiscriminadamente el sandbox. Si el commit debe hacerlo el coordinador, ajustar explícitamente el contrato de entrega. Esta validación pendiente es distinta de los defectos reproducidos F1–F4.

## Reproducción abreviada de los negativos

Este esquema permite repetir F2–F4 con la fixture existente; usar Python 3.12 y `PYTHONDONTWRITEBYTECODE=1`, con rutas absolutas al worktree del autor. Cada caso debe tener una fixture nueva y `doCleanups()` en `finally`:

```python
import importlib.util
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "qa", "/Users/d/agentWhatsap-crm-orquestacion/scripts/pruebas/test_crm_agents.py")
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
t = qa.PruebasCLI()
t.setUp()
try:
    # F3 (ejecutar por separado de los otros casos)
    t.cmd("git", "-C", str(t.wts[0]), "switch", "-qc", "feat/crmfoo")
    print(t.start()["branch"])
    # F4, con fixture nueva:
    # print(t.start(owns=["src/*"])["ownership"])
    # print(t.start(1, owns=["src/a.py"])["ownership"])
    # F2, con fixture nueva; nunca usar killpg real:
    # r = t.start(); r["pid"] = 424242; t.l.guardar(r)
    # with patch.object(qa.crm.os, "killpg") as kill:
    #     t.l.stop(r["id"]); print(kill.call_args)
finally:
    t.doCleanups()
```

Para F1, en la fixture nueva reemplazar únicamente el ejecutable temporal `t.root / "bin/codex"` por `#!/usr/bin/env python3\nimport time\ntime.sleep(30)\n`. Lanzar runner en un subprocess que importe `crm-agents.py`, guarde la referencia original de `Lanzador.guardar` y la envuelva así:

```python
def guardar(self, r):
    if r.get("pid"):
        marker.write_text(str(r["pid"]))  # marker temporal acordado con el padre
        os._exit(88)
    return original(self, r)
```

Después de `Lanzador(repo).runner(run_id)` y del exit 88, el padre lee marker, cierra pane con `t.cerrar(r)`, llama `t.l.refrescar()` bajo lock y comprueba estado, conteo activo y `os.kill(pid, 0)`. Terminar **siempre** ese grupo fake en `finally` antes de limpiar la fixture. No ejecutar este caso contra Codex/tmux reales.

## Entrega e integración

Único archivo propio: `docs/crm/orquestacion-qa-revision.md`. No se intentó commit: el Git común queda fuera de las raíces escribibles del sandbox actual y el encargo limita la escritura a este documento. El coordinador hará el commit. No hubo cambios del autor revertidos ni push.

Requerido para integrar: corregir F1–F4 con regresiones, resolver la coherencia documental del apoyo, repetir revisión sobre los hashes/commit definitivos y conservar evidencia de la versión integrada. Para declarar lista la orquestación, además completar la validación operativa de dos agentes visibles, apoyo, límite, UUID y fallo exigida por `transicion-v2.md`; los 13 tests fake no sustituyen esa aceptación. Producto, piloto, Calendar, datos clínicos y producción siguen fuera de esta revisión.
