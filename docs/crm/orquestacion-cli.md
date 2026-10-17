# Orquestación CRM con Codex y tmux (ORQ-01)

Requiere Python 3.11+ (stdlib, incluido `tomllib`), Linux o macOS con `flock`, Git,
tmux y el CLI Codex autenticado en PATH. No instala dependencias ni crea
worktrees. El coordinador externo ocupa una plaza: hay como máximo tres
ejecuciones activas, incluyendo apoyos, entre todos los worktrees del repositorio.

## Interfaz

Opciones globales antes del subcomando: `--repo RUTA` (por defecto la raíz del
script), `--roles DIRECTORIO` (por defecto `.Codex/agents` dentro de repo),
`--catalog ARCHIVO` (por defecto `~/.codex/models_cache.json`), `--session NOMBRE`
(por defecto `eli-crm`) y `--socket NOMBRE` (socket tmux separado para pruebas).
Cambiar sesión/socket no elude el límite global del mismo Git común.

```bash
python3.12 scripts/crm-agents.py start \
  --task ORQ-01 --role crm-operaciones --model gpt-6.1-sol \
  --worktree /ruta/al/worktree-especialista \
  --prompt-file /ruta/al/encargo.txt \
  --owns scripts/crm-agents.py --owns scripts/pruebas/test_crm_agents.py \
  --owns docs/crm/orquestacion-cli.md

python3.12 scripts/crm-agents.py status
python3.12 scripts/crm-agents.py status RUN_ID
python3.12 scripts/crm-agents.py recover RUN_ID --resume UUID_REGISTRADO
python3.12 scripts/crm-agents.py recover RUN_SIN_UUID --retry
python3.12 scripts/crm-agents.py stop RUN_ID
```

La salida es JSON; los errores salen por stderr y exit 1. `start` devuelve el ID
de ejecución (32 caracteres hexadecimales), distinto del UUID de sesión Codex.
La ventana muestra rol, tarea, modelo y número de intento. Se crea la sesión si
no existe; nunca se reemplaza una sesión existente. El runner interno `_run`
es exclusivo del lanzador: no se debe invocar manualmente.

Cada rol es un archivo `ROL.toml` con `name`, `description`,
`developer_instructions` y, opcionalmente, `model`. `--model` prevalece; si faltan
ambos modelos se rechaza. Se valida el slug contra `models[].slug` del catálogo
local: los modelos previstos son `gpt-6-astra`, `gpt-6.1-sol` y `gpt-6-luna`.
La disponibilidad real se comprueba al ejecutar Codex: cualquier fallo queda
visible y registrado, sin selección automática de otro modelo.

## Ownership y apoyo

`--worktree` debe ser una raíz existente del mismo repositorio, en rama
`feat/crm` o prefijo `feat/crm-` (se rechazan `feat/crmfoo`, main y HEAD separado).
`--owns` es obligatorio y
repetible: rutas canónicas relativas a la raíz compartida del repositorio,
sin `/` inicial, `..`, `.` ni glob (se rechazan `*`, `?`, `[`, `]`, `{`, `}`).
Un directorio incluye sus descendientes.
Se rechazan worktree o rama ya activos y cualquier ownership solapado con otra
ejecución activa, incluso en worktrees diferentes. Los encargos deben declarar
todos sus archivos, incluidos documentos y pruebas. La reserva termina cuando
el proceso termina: el coordinador debe revisar antes de reasignar archivos.

El coordinador tramita la solicitud de apoyo de un worker mediante `start ... --parent RUN_ID` con otro worktree,
ownership compatible y una plaza libre. El padre debe estar activo y ser worker
raíz; un apoyo no puede delegar. Codex hereda `CRM_AGENT_RUN_ID`: un lanzamiento
desde ese entorno debe declarar ese mismo valor como `--parent`. El coordinador
debe lanzar sin esa variable heredada. Desde un worker, `recover` solo permite
recuperar sus propios apoyos y vuelve a validar la profundidad. Esto es control operativo, no una frontera
de seguridad frente a un proceso que borre variables o ignore las instrucciones.

El prompt conserva el rol y el encargo, y añade reglas comunes: Notion solo para
coordinador; no producción ni `.env`; delegación solo por este lanzador;
respeto al ownership y cambios ajenos; no main ni push; anuncio de comandos
mutantes; entrega de informe y commit local. El lanzador no ejecuta commits por
cuenta del especialista ni puede garantizar que un modelo respete el prompt.

## Persistencia, salida y recuperación

Los registros están en `<git-common-dir>/eli-runs/`, fuera del árbol versionado,
compartidos entre worktrees. El directorio se crea privado (0700). Cada ejecución
conserva `run.json`, `prompt.txt` y por intento `events-N.jsonl` y `report-N.txt`.
El registro incluye tarea, padre, rol/modelo, rama, worktree, ownership,
sesión/pane tmux, UUID Codex, resultado, exit y todos los intentos con fechas,
pane, modelo, informe, log, PID y la identidad de inicio del proceso por intento.
Las escrituras del registro son atómicas, con `fsync` de archivo y directorio, y se
serializan con un lock global `flock`, también durante la reserva de plazas.

Se ejecuta Codex con políticas explícitas, sin depender de los valores globales:

```text
codex exec --json -m MODEL -C WORKTREE -o REPORT
  --sandbox workspace-write --add-dir GIT_COMMON
  -c sandbox_mode="workspace-write" -c approval_policy="never"
  -c sandbox_workspace_write.writable_roots=["GIT_COMMON"] PROMPT
```

El ejemplo muestra argumentos (las comillas del TOML deben preservarse al usar
un shell); el lanzador pasa listas de argv, no concatena un comando shell para
Codex. La escritura adicional se solicita únicamente para el Git común: incluye
`eli-runs` para el informe externo `-o` y los metadatos de Git para commits locales.
No se añade la raíz del repositorio principal ni el directorio personal.
Las opciones son `workspace-write` y approvals `never` en inicio y recuperación;
no se usan modos sin sandbox ni flags de bypass. Son permisos solicitados al CLI:
no eluden restricciones gestionadas del entorno o rutas protegidas como `.git`.
Si el commit se bloquea, se informa y lo realiza el coordinador; no se intenta
ampliar permisos automáticamente. Las reglas del prompt siguen prohibiendo `.env`.

Antes de ejecutar Codex, el runner crea un pipe y lanza un wrapper Python en un
grupo/sesión de proceso propio. El wrapper solo hereda el extremo de lectura y
espera un token. Bajo el lock global, el runner captura PID, PGID e identidad de
inicio del kernel y persiste el registro; solo entonces envía el token `G`.
El wrapper hace `exec` de Codex conservando PID e identidad. Si el runner muere
por SIGKILL entre `Popen` y guardar PID, el pipe se cierra: el wrapper recibe EOF
y sale sin ejecutar Codex. Un fallo de persistencia tampoco entrega el token.
Los extremos del pipe se cierran en `finally`; no se usa `preexec_fn`.

El runner imprime y guarda los eventos; detecta `thread.started` y
`thread_id`. stderr se mezcla con stdout para conservar errores: el archivo
`.jsonl` puede contener líneas de diagnóstico que no sean JSON.
`turn.failed`, eventos `error`, exit distinto de cero o informe ausente/vacío
producen `failed`. Exit 0 con informe no vacío produce `awaiting-review`, nunca
Done. No se analiza automáticamente la calidad del informe, pruebas o SHA:
eso corresponde a la revisión del coordinador.

Las ventanas terminadas permanecen visibles (`remain-on-exit` por ventana).
`status`, `start` y `recover` reconcilian panes muertos/cerrados y marcan las
ejecuciones activas como `interrupted`; no hay daemon vigilante. Si es necesario
terminan el grupo de proceso Codex registrado. Antes de cualquier `killpg` se
consulta de nuevo PID, PGID y fecha de inicio: en Linux se usan ticks de inicio
y boot ID de `/proc`; en macOS `proc_pidinfo` aporta inicio en microsegundos.
Un PID reutilizado no recibe señal. Si falta identidad (incluidos registros
antiguos) o no se puede comprobar, la operación falla y mantiene el cupo para
revisión manual; no libera la reserva por asumir que el proceso terminó.
Tras SIGKILL se espera hasta dos segundos a que desaparezca esa identidad;
si continúa viva se conserva el cupo. `stop` mata ese grupo y el pane,
registra `stopped` y conserva el historial. No detiene automáticamente apoyos
del worker: tienen IDs y ciclos de vida independientes.

`recover` solo acepta `failed`, `interrupted` o `stopped`; vuelve a validar rama,
catálogo, ownership, padre y cupo. Con UUID registrado exige `--resume UUID`
exacto. Ejecuta `codex exec resume UUID --json -m MODEL -o REPORT` con
`-c sandbox_mode="workspace-write"`, `-c approval_policy="never"` y
`-c sandbox_workspace_write.writable_roots=["GIT_COMMON"]` desde el worktree
registrado. La ayuda instalada de `resume` admite `-c` y no ofrece `--add-dir`;
jamás se usa `--last`. Si no se capturó UUID exige `--retry`
para crear otra sesión. Cada intento tiene log e informe nuevos; un informe
antiguo no valida una recuperación. La ventana anterior se conserva.

El límite solo cuenta procesos de este lanzador más la plaza externa reservada;
no descubre agentes iniciados a mano. El lock es local al sistema de archivos:
no es coordinación distribuida. Un apagado brusco puede impedir la última
escritura; `fsync` no implica garantía absoluta ante fallos del hardware.
La identidad se consulta inmediatamente antes de `killpg`, pero son dos llamadas
al sistema: no hay un handle atómico y portable para matar grupos sin ninguna
carrera posible. No se persiguen descendientes que creen otra sesión/grupo ni
se gestionan procesos trasladados a otra máquina. Linux y macOS son las únicas
plataformas implementadas para identidad; sin consulta disponible no se envían
señales ni se libera cupo de un proceso registrado. Los logs/prompts pueden contener información del encargo;
no se aplica redacción automática ni retención/borrado programado.

## Verificación aislada

```bash
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest discover \
  -s scripts/pruebas -p test_crm_agents.py -v
```

Las pruebas usan Git temporal, worktrees temporales y ejecutables fake de
Codex/tmux, con sesión `pruebas-crm` y socket `socket-pruebas`. No arrancan agentes
ni contactan servicios y nunca operan sobre el tmux real `eli-crm`. Verifican
contención entre procesos, padre/profundidad, ownership, ramas, escaping,
persistencia, señales/stop, fallos de entrega y recuperación. Incluyen SIGKILL
exactamente en la ventana `Popen` → guardar PID (sin hijo vivo tras EOF ni Codex
arrancado), rechazo de PID reutilizado, identidad inaccesible sin liberar cupo,
fallo de persistencia antes del token y argv de sandbox/approvals/raíces en
inicio y `resume`. No sustituyen una
prueba manual autorizada de autenticación, disponibilidad de modelos y UI de
tmux en el equipo destino.

## Identidad del panel e intervención

Cada intento guarda un token aleatorio en la opción de panel @eli_crm_attempt.
status/stop comprueban ese token además del ID: un panel con %N reutilizado no
se considera propio ni se cierra. El runner usa codex --no-daemon exec, también
al reanudar, para no depender del daemon compartido.

Los workers solicitan apoyo al coordinador; él inicia --parent tras comprobar
el cupo global. Las comprobaciones de CRM_AGENT_RUN_ID protegen también llamadas
desde un worker, pero no autorizan delegación autónoma fuera del encargo.

Para enviar una indicación al UUID registrado, la ayuda instalada ofrece:
codex queue --thread UUID --message TEXTO. La entrega queda en cola y no debe
confundirse con una respuesta procesada: comprobar el informe o reanudar
explícitamente. Para intervención inmediata: stop y luego recover por UUID,
con el contexto persistente. No se debe abrir un segundo proceso de la misma
sesión mientras el primero siga activo.
