# Relevo del coordinador — ORQ-02-RELEVO

Fecha: 2026-10-16. Entrega documental; único archivo propio: `docs/crm/relevo-coordinador.md`. Fuentes: [README](README.md), [transición v2](transicion-v2.md), [tablero sincronizado](tablero-notion.md), [evidencia QA](orquestacion-qa.md) y [guía del lanzador](orquestacion-cli.md). No se consultó Notion ni se inició desarrollo.

## Estado y siguiente encargo

El espejo registra **ORQ-01, ORQ-02 y ORQ-03 Done** (TK-42–44). La evidencia histórica en `orquestacion-qa.md` documenta:

- ORQ-01: lanzador corregido en `32ceccc`; 21 pruebas y smoke PASS repetidos tras integrar en `feat/crm`.
- ORQ-02: transición SDD, roles, 41 tareas legado y 10 nuevas, con espejo y enmiendas releídos.
- ORQ-03: revisión independiente `280b747`, corrección de F1–F4 y simulacro de dos trabajadores visibles, apoyo registrado, límite, recuperación por UUID y detección de fallo.

Estos resultados se citan del espejo; no se ejecutaron de nuevo en este relevo.

Siguiente tarea: **V2-01, privacidad y bandeja (TK-45), Ready para especificar**. **V2-07, conciliación de cierres y seguridad (TK-51), Ready para auditar** TK-13, TK-36 y TK-39/S1–S5, separando evidencia local, remota y riesgos pendientes. No se ejecuta ninguna aquí.

No activar conversaciones e intervención hasta definir **permisos, conservación y eliminación**. Este relevo no establece políticas ni plazos. El producto vigente es `crm-v2-diseno`; los Done del CRM legado no lo certifican.

## Operación básica

Solo tareas Ready mediante el lanzador, con encargo y ownership explícitos; anunciar comando y finalidad antes de mutar. Ejemplos de referencia, no ejecutados en esta entrega:

```sh
python3.12 scripts/crm-agents.py start --task ID_READY --role ROL --model MODELO --worktree /ruta/worktree --prompt-file /ruta/encargo.txt --owns ruta/propia
python3.12 scripts/crm-agents.py status
python3.12 scripts/crm-agents.py status RUN_ID
python3.12 scripts/crm-agents.py recover RUN_ID --resume UUID_REGISTRADO
python3.12 scripts/crm-agents.py recover RUN_SIN_UUID --retry
python3.12 scripts/crm-agents.py stop RUN_ID
tmux attach -t eli-crm
```

`start` devuelve RUN_ID, distinto del UUID Codex. `recover` exige el UUID exacto registrado; `--retry` corresponde únicamente a ejecuciones sin UUID. En tmux, `Ctrl-b d` permite desconectarse sin detener; cerrar un panel no equivale a entregar. `stop` conserva historial y no detiene automáticamente los apoyos.

Máximo coordinador más tres trabajadores, apoyos incluidos. Solo el coordinador registra y lanza apoyos con `--parent RUN_ID`; un apoyo no delega. Respetar archivos ajenos y ramas `feat/crm`/`feat/crm-*`. Integrar secuencialmente, con revisión independiente y pruebas del commit integrado antes de Done. `awaiting-review` no equivale a aceptación. Sin push.

## Restricción y entrega

El simulacro documentó rechazo de `index.lock` del Git común por el sandbox, incluso con `writable_roots`, mientras las escrituras propias y pruebas funcionaban. Es una restricción operativa, no un fallo de producto. Si el worker no puede crear el commit, entrega sin SHA y declara el bloqueo; el coordinador revisa el diff y crea el commit local. No desactivar el sandbox ni simular éxito.

El agente entregó este relevo sin SHA y sin reintentar Git mutante por la restricción ya demostrada. La coordinación revisó contenido, IDs del tablero y diff, y lo guarda con commit local junto con README, GUIA y CHANGELOG.

Verificación de esta entrega: lectura del documento y contraste con las cinco fuentes; `git diff --check` y `git diff --no-index --check -- /dev/null docs/crm/relevo-coordinador.md` (para incluir el archivo nuevo sin añadirlo al índice). Los resultados se consignan en la entrega final.

No se ejecutaron build, pruebas del lanzador ni piloto conectado. No se accedió a producto, producción, `.env`, agentes o servicios; no se modificó Notion. Este informe no certifica el funcionamiento del CRM ni marca la entrega Done.
