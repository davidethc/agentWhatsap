# ORQ-03: evidencia de coordinación Codex/tmux

Fecha: 2026-10-16. Alcance: lanzador y coordinación sintética, sin producto ni producción.

## Resultado observado

La primera revisión independiente rechazó la entrega con cuatro hallazgos; se conserva en [revisión inicial](orquestacion-qa-revision.md). La versión corregida está en el commit 32ceccc de feat/crm-orquestacion. La [segunda revisión](orquestacion-qa-final.md), commit 280b747, confirmó F1–F4 corregidos sin nuevos bloqueantes. Ambas ramas se integraron secuencialmente en feat/crm y se repitieron las 21 pruebas y el smoke con resultado PASS.

| Criterio | Resultado | Evidencia |
|---|---|---|
| Dos trabajadores visibles sin pisarse | Pasa | SIM-A y SIM-B en ventanas distintas de eli-crm, worktrees y archivos propios; ambos produjeron su marcador exacto |
| Apoyo y límite global | Pasa | SIM-C con parent=SIM-A; tres activos; cuarto arranque rechazado por límite |
| Modelos disponibles | Pasa en esta ejecución | gpt-6-astra, gpt-6.1-sol y gpt-6-luna aceptados y respondieron; no se usó fallback |
| Recuperar tras cerrar panel | Pasa | Se cerró %5 de SIM-A; señal 1/exit -9 registrada; mismo UUID reanudado en intento 2, panel %8; archivo SIM_A_OK verificado |
| Detener | Pasa | SIM-STOP pasó de running con PID a stopped; grupo terminado con identidad verificada |
| Detectar entrega fallida | Pasa sintético | tmux real + Codex fake: turn.failed con exit 0 e informe no vacío produjo failed visible en panel |
| Sandbox y commits | Restricción confirmada | Escrituras propias y pruebas funcionan; index.lock de Git común bloqueado, incluso con writable_roots. Los workers declararon ausencia de SHA; coordinador revisó y creó commits |
| Revisión independiente previa | Pasa | F1–F4 detectados y corregidos antes de integrar; segunda revisión 280b747 |
| Tablero y trazabilidad | Pasa | ORQ-01/02/03 en Notion, 41 tareas legado y 10 nuevas; espejo y enmiendas releídos |

## Comandos reproducibles

Desde la raíz del worktree del CRM, con Python 3.11 o posterior:

```sh
PYTHONDONTWRITEBYTECODE=1 python3.12 -m unittest discover -s scripts/pruebas -p test_crm_agents.py -v
PYTHONDONTWRITEBYTECODE=1 python3.12 scripts/pruebas/smoke-crm-agents-tmux.py
python3.12 scripts/crm-agents.py status
tmux attach -t eli-crm
```

La suite observada pasó 21 pruebas. Incluye concurrencia entre procesos, UUID exacto, crash antes de persistir PID, EOF antes de ejecutar Codex, PID y panel reutilizados, identidad inaccesible, rama exacta, globs, quoting, errores de turno y política start/resume. La regresión de crash fue comprobada contra la versión original y falló antes de la corrección.

El smoke crea un repositorio temporal y un socket tmux propio; simula Codex sin red. No acredita autenticación/modelos reales: eso lo acreditan por separado SIM-A/B/C.

## Evidencia durable

- [Registro sintético](evidencias/orquestacion-20261016.json): run ID, padre, modelo, rama/worktree, UUID, panel, intentos y resultado.
- Registros originales del lanzador: Git común / eli-runs / RUN_ID (prompt, eventos, informes y review.json del coordinador).
- Arranque anterior al lanzador: Git común / eli-bootstrap / 20261016; se registra como bootstrap manual y no como reserva automática.
- Commits de archivos ficticios en ramas separadas: SIM-A 083844e, SIM-B 06aa477, SIM-C f4585bf. No se integran archivos ficticios al producto.

El estado runtime awaiting-review significa entrega para revisar; la aceptación y el commit del coordinador se registran aparte. Un informe que declare fallos no se convierte en éxito por tener exit 0. La primera prueba mostró precisamente este caso con Git bloqueado.

## Límites

No se repitieron las 1.026 pruebas citadas en el plan, ni la compilación de producción o el recorrido conectado del CRM. No se activaron conversaciones, servicios ni workflows. V2-01 debe definir permisos, conservación y eliminación; V2-06 cubrirá el piloto conectado. No hay push ni cambios en main.
