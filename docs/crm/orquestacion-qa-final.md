# ORQ-03-FINAL — segunda revisión independiente

Fecha: 2026-10-16. Rol: crm-qa-docs. Parent: ninguno.
Worktree propio: `/Users/d/agentWhatsap-crm-revision`; rama `feat/crm-revision`.
Ownership y único cambio: `docs/crm/orquestacion-qa-final.md`.

**Dictamen: F1–F4 corregidos en el código revisado; sin bloqueante nuevo identificado en este alcance.** La suite actual pasa 21/21. Esto permite entregar la revisión al coordinador; no declara Done, integración aprobada, funcionamiento CRM ni producción.

## Alcance y versiones

Fuente de aceptación: F1–F4 de `docs/crm/orquestacion-qa-revision.md`, encargo ORQ-03-FINAL y `docs/crm/transicion-v2.md` del worktree coordinador. Se consultaron también sus `AGENTS.md`, `CONTRIBUTING.md` y ocho roles `.Codex/agents/*.toml`. Sin acceso a Notion, producción, `.env` ni web; sin agentes adicionales ni costes nuevos. README, GUIA y CHANGELOG quedan al responsable documental.

Código evaluado: **`32ceccce881495f154df94d6ab9903cf56530e9e`**, HEAD de `/Users/d/agentWhatsap-crm-orquestacion`, rama `feat/crm-orquestacion`. `git diff 32ceccc -- scripts/crm-agents.py scripts/pruebas/test_crm_agents.py` dio salida vacía: la ejecución corresponde al código del commit, no a otra implementación sin guardar.

El CLI de ese commit fue leído con `git show 32ceccc:docs/crm/orquestacion-cli.md`. Su copia de trabajo tiene una adición ajena sin commit, «Resultado del simulacro real del sandbox», que explicita el bloqueo de Git y la entrega al coordinador. No se modificó. Los roles y el smoke se inspeccionaron en `/Users/d/agentWhatsap-crm`, HEAD observado `aed0c0d7844213613d32ff85380b19ba24b48a9d`: los ocho roles estaban modificados y el smoke sin seguimiento. Ese HEAD **no identifica sus contenidos actuales**; los hashes siguientes sí.

## Requisitos: estado de F1–F4

| Hallazgo original | Estado | Resultado | Evidencia sintética y límite |
|---|---|---|---|
| F1 P1: crash antes de persistir PID | Corregido | Pasa | `test_sigkill_entre_popen_y_guardar_pid`: se pausa exactamente tras Popen, tres reservas presentes, Codex fake aún no ejecutado; SIGKILL al runner provoca EOF y salida del wrapper; cuarto rechazado hasta reconciliar el pane cerrado. `test_error_persistir_pid_impide_exec_codex` confirma que un error de guardado tampoco entrega token. |
| F2 P1: PID/pane reutilizados | Corregido | Pasa | `test_pid_reutilizado_no_recibe_killpg` usa mock y verifica cero señales ante otro inicio. `test_identidad_no_verificable_conserva_cupo` conserva reserva y rechaza cuarto. `test_exec_conserva_identidad_persistida` confirma PID/identidad antes y después de exec. `test_pane_reutilizado_no_es_propio_ni_se_cierra` cambia token del pane: no se considera propio ni se cierra. |
| F3 P2: acepta feat/crmfoo | Corregido | Pasa | `test_ramas_exactas_y_ownership_sin_globs`: rechaza `feat/crmfoo` y `feat/crmfoo-otra`, admite `feat/crm`; los otros casos usan `feat/crm-*`. La guarda rechaza main y recuperación con rama cambiada. HEAD separado está rechazado por `symbolic-ref --quiet`, comprobado por lectura, sin reproducción específica en esta ejecución. |
| F4 P2: globs admitidos | Corregido | Pasa | Mismo test rechaza `src/*`, `src/**/a.py`, `src/a?.py`, `src/[ab].py`, `src/{a,b}`. `test_overlap_worktree_rama_y_ownership` cubre archivo/directorio, ascendientes/descendientes y ruta hermana válida. |

Reproducción: ejecutar la suite indicada abajo; cada fila remite a nombres exactos de sus tests. Se revisó además el flujo: pipe sin token antes de guardar identidad, extremos cerrados en finally, `exec` conserva identidad, comprobación PID/PGID/inicio antes de killpg y token aleatorio por intento en tmux.

La consulta de identidad y killpg siguen siendo llamadas separadas (carrera residual documentada); no se prueba ausencia absoluta de reutilización entre ambas. Tampoco se certifican descendientes que abandonen el grupo ni equivalencia de destinos mediante symlinks. No son nuevas garantías de esta revisión. Identidad Linux fue leída, no ejecutada en este entorno macOS.

## Estándares y revisión adicional

Sin incumplimiento bloqueante nuevo identificado contra las reglas aplicables al encargo. Se usaron `code-review` y `verification-before-completion`; ambos ejes se revisaron personalmente, sin la delegación sugerida por la primera skill porque el encargo la prohíbe. No se amplió a auditoría del producto.

- CLI y roles coinciden ahora en que el worker solicita apoyo y el coordinador lo registra/lanza. El apoyo no delega; límite global de tres workers y revisión previa a Done explícitos.
- Los ocho TOML se parsearon, sus nombres coinciden con los archivos y contienen campos obligatorios y fallback explícito si Git común está bloqueado. Los roles conservan modelos previstos, ownership y fuentes del CRM nuevo; no conceden permisos ni conservación del producto. Instrucciones de producción del rol n8n no autorizan ejecutarlas en este encargo.
- `--no-daemon` y sandbox `workspace-write`, approvals `never` y raíz Git común están presentes en start/resume; `test_policy_start_y_resume` verifica el argv, sin demostrar permisos efectivos de Codex real. No se desactiva sandbox para obtener un commit.
- Smoke: lectura completa y AST válido. Usa Git y worktree temporales, socket tmux aleatorio, Codex fake por PATH y limpieza `kill-server` limitada a ese socket. Verifica UUID, `turn.failed` con exit 0 y mensaje visible en pane. No cubre modelos reales, tres workers, apoyo ni recuperación. No se ejecutó tmux por esta revisión.

## Evidencia ejecutada y estados separados

Comando ejecutado en `/Users/d/agentWhatsap-crm-orquestacion`:

```sh
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest discover -s scripts/pruebas -p test_crm_agents.py -v
```

Salida: **exit 0; `Ran 21 tests in 18.757s`; `OK`**. Solo repositorios temporales y Codex/tmux ficticios. Se leyeron todos los resultados; incluye límite concurrente, parent/profundidad, quoting, stop, UUID/historial, informe vacío y fallos runtime.

Verificación estática adicional ejecutada con `PYTHONDONTWRITEBYTECODE=1 python3.12 -` y stdlib: `ast.parse(smoke.read_text())`, `tomllib.loads()` para cada rol; assertions de nombre, campos `name/description/model/developer_instructions` no vacíos y presencia de `Si el sandbox bloquea Git común`. Salida: `SMOKE_AST_OK`, ocho `ROL_OK`, exit 0. Hashes calculados con SHA-256; no se importó ni ejecutó el smoke.

| Capa / criterio | Resultado | Procedencia y pendientes |
|---|---|---|
| Código: F1–F4, no-daemon y políticas explícitas | Pasa | Lectura del commit y suite propia 21/21. |
| Local sintético: límite, apoyo, recuperación y detección de fallos | Pasa | Suite propia; no implica disponibilidad de modelos ni ejecución real de agentes. |
| Local tmux real: smoke nuevo | No probado por QA | Coordinador reporta `turn.failed` exit 0 → failed visible. Inspección propia compatible; no se repitió. |
| Local Codex real: SIM-A/B/C, cuarto rechazado, UUID y cierre/reanudación A | No probado por QA | Evidencia aportada por coordinador: A astra, B sol y C luna apoyo de A; UUID reales, cuarto rechazado; A pane %5 cerró failed señal 1, mismo UUID a intento 2 en %8. No se inspeccionaron registros ni se certifica fin posterior de A. |
| Local workers: commit en Git común | Falla según coordinador | B/C crearon archivo ficticio y pasaron cat/diff check; index.lock bloqueado pese a writable_roots. Quedan awaiting-review sin SHA inventado. No se reprodujo con Codex real. |
| Versión integrada, tablero y aceptación ORQ-03 completa | No probado | Coordinador debe revisar, conservar evidencia operativa, registrar fin de A, crear commits faltantes y verificar la versión integrada. No se consultó Notion. |
| Producto CRM / producción | No probado | Fuera del alcance; ninguna aprobación transferida. |

La limitación de Git no invalida F1–F4 ni se oculta como éxito. La alternativa es revisión de diff y commit por coordinador. `awaiting-review` acepta un informe no vacío aunque declare fallo de commit; no acredita aceptación ni Done.

## Huellas de los archivos inspeccionados

SHA-256 del código/test y copia local del CLI en el worktree autor:

| Archivo | SHA-256 |
|---|---|
| scripts/crm-agents.py | `4f89d6f5a710eff88d5104216e1741507e2655ca32600eac2dbb3e546f1a0b26` |
| scripts/pruebas/test_crm_agents.py | `318bd604b1107eff809fd3196f56a50a3ce7940a25276cc0a2c4fedf5e4609bb` |
| docs/crm/orquestacion-cli.md (con adición sin commit) | `aa1e95613b8351005910854be621caa10c7acbcfc10b73b49b8b0de10a6275d6` |

Huellas del worktree coordinador (versiones sin commit observadas):

| Archivo | SHA-256 |
|---|---|
| scripts/pruebas/smoke-crm-agents-tmux.py | `ec5917c0e4916c0650de4db1a0c133b3a7c18e91bd35bc449aae3ecdb9d64498` |
| .Codex/agents/crm-apoyo.toml | `651ae4a94b268ba4ff26fd6a954e71dac62d7d8f65ea429b9afa56db314e0f93` |
| .Codex/agents/crm-datos.toml | `cc8fd2ceb8b731dd5ee27f436f57b67ad8fd464058fab6a81f9d7c61e5245704` |
| .Codex/agents/crm-frontend.toml | `3040fb43ce04e6228f58e32589f6e29c88be1ff4fdfeba20424bd2d9ff2b0bd9` |
| .Codex/agents/crm-n8n.toml | `a2a136c24db2194062d063cdc2c061922bd69afed5368f97af2c056e4fac5206` |
| .Codex/agents/crm-operaciones.toml | `223709000fa126b4e0ad47be0e9b67702848dbea5d0148e04791e1fb1d677261` |
| .Codex/agents/crm-orquestador.toml | `36a37272d2f5ac0c3c94b0cba6c866ea8808b781f6b434718bf882c7131f47c8` |
| .Codex/agents/crm-planificador.toml | `11b5dea641d212cac1837e85cc341c130cee83a5e9799f286f09aea1312854f5` |
| .Codex/agents/crm-qa-docs.toml | `a5bb597066974139b26dadd263f7126971414d94338b7b6ff15f7cbd7674cc88` |

## Entrega

No se modificaron launcher, tests, smoke, roles ni archivos ajenos. No hubo push, cambios de rama, integración ni reversión. El informe se entrega al coordinador para revisión antes de integrar.

**Commit del informe: no creado.** Se intentó `git add -- docs/crm/orquestacion-qa-final.md`; exit 128: `fatal: Unable to create '/Users/d/agentWhatsap/.git/worktrees/agentWhatsap-crm-revision/index.lock': Operation not permitted`. No se ejecutó commit al fallar el paso previo. El archivo permanece sin seguimiento; el coordinador debe revisar y crear el commit local. No se amplió sandbox ni se inventó SHA. HEAD propio previo a la entrega: `3711a0c` (informe anterior); no contiene este archivo. El SHA del código evaluado sigue siendo `32ceccce881495f154df94d6ab9903cf56530e9e`.
