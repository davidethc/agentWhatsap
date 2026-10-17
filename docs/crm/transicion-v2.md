# Eli Panel: transición al CRM nuevo y coordinación Codex/tmux

Fecha: 2026-10-16. Fuente: plan aprobado del usuario y hub Notion. Esta entrega prepara coordinación, SDD y verificación sintética; las seis líneas de producto requieren su especificación antes de desarrollar.

## Decisiones vigentes

- Producto: crm-v2-diseno (Next.js, PostgreSQL, Drizzle, Better Auth). crm/ y supabase/ son legado; no se trasladan sus migraciones automáticamente.
- Conversaciones e intervención de doctora con acceso restringido: ADR 0013 sustituye ADR 0012 para el nuevo producto. No activar hasta definir permisos, conservación y eliminación.
- Eli/n8n y Google Calendar siguen como referencia inicial; Gemini y conversación natural sin cambios.
- SDD: especificación → aclaraciones → plan → tareas → implementación → revisión independiente → pruebas. Ready exige alcance y aceptación suficientes; Done exige evidencia en la versión integrada.
- Código existente, pruebas locales y producción son estados distintos. Los 1.026 tests citados en el plan son evidencia previa, no una ejecución de esta entrega.

## Equipo y memoria

Roles en .Codex/agents/*.toml, cargados como instrucciones por el lanzador, sin usar el antiguo argumento --agent. Modelos previstos: gpt-6-astra para planificación/coordinación; gpt-6.1-sol para datos, frontend, n8n, QA y operaciones; gpt-6-luna para apoyo acotado. Comprobar catálogo y resultado real; registrar rechazo y sustitución explícita, nunca asumir disponibilidad por el nombre.

Sesión eli-crm, ventana por ejecución con nombre/tarea/modelo. Coordinador externo reserva un cupo: máximo tres trabajadores, con un solo nivel adicional de apoyo. El coordinador registra y lanza apoyos. Los agentes no escriben el tablero compartido ni revierten archivos ajenos. Integración secuencial en feat/crm, después de revisar commits, pruebas y aceptación. Sin push.

Encargo obligatorio: tarea y enlace, objetivo, contexto, límites, archivos propios, dependencias, criterios, comandos de prueba, evidencia y formato de entrega. Registro persistente fuera del árbol versionado: padre, modelo, rama, worktree, ventana/panel, sesión Codex, intentos, resultado e informe. Cerrar una ventana no equivale a entregar.

## Tareas nuevas

Los IDs V2/ORQ son identificadores del alcance nuevo, independientes del autonúmero TK de Notion. Las tareas de especificación se pueden ejecutar; implementar producto exige su contrato aceptado. Todas las entregas incluyen commit y matriz criterio/evidencia.

| ID | Responsable | Dependencias | Archivos permitidos | Aceptación y evidencia | Estado inicial |
|---|---|---|---|---|---|
| ORQ-01 | operaciones | plan usuario | scripts/crm-agents.py, scripts/pruebas/test_crm_agents.py, docs/crm/orquestacion-cli.md | iniciar/estado/recuperar/detener; límite; padre y UUID; fallos; pruebas sintéticas | In progress |
| ORQ-02 | apoyo + coordinador | plan usuario | docs/crm/, .Codex/agents/, docs/adr/0013*, README, GUIA, CHANGELOG, AGENTS.md | matriz 41 TK, Notion 00–06, roles y decisión explícita | In progress |
| ORQ-03 | QA independiente | ORQ-01, ORQ-02 | docs/crm/orquestacion-qa.md | dos agentes visibles; apoyo; límite; recuperación; fallo; revisión antes de integrar; trazabilidad | Ready; espera dependencias |
| V2-01 | planificador + datos | ORQ-02 | docs/crm/v2/privacidad.md | matriz permisos; lectura/envío/adjuntos; conservación y borrado incluidos backups; revocación; pausa/handoff y carrera IA-humana con pruebas negativas definidas | Ready: especificar |
| V2-02 | n8n + planificador | V2-01 | docs/crm/v2/agenda.md | fuente única Calendar; ocupación externa; duración; zona; reservas simultáneas; reprogramación/cancelación y reconciliación definidas | Backlog |
| V2-03 | datos + n8n | V2-01, V2-02 | docs/crm/v2/integracion.md | contrato firmado; idempotencia; orden; reintentos; cola durable y replay ante caída; ninguna doble respuesta | Backlog |
| V2-04 | operaciones | V2-03 | docs/crm/v2/operacion.md | proceso de fondo, volúmenes, alojamiento sin gastos nuevos y restauración aislada con RPO/RTO medidos; sin activar servicios | Backlog |
| V2-05 | frontend + planificador | V2-01, V2-03 | docs/crm/v2/doctora.md | recordatorios/resumen/alertas con destinatario, horario, permisos, reintentos y evidencia de entrega especificados | Backlog |
| V2-06 | QA | V2-01 a V2-05 implementadas y revisadas | docs/crm/v2/piloto.md | recorrido sintético conectado: mensaje→paciente→respuesta→reserva→reprogramación→cancelación→intervención; fallos y recuperación | Backlog |
| V2-07 | QA | ORQ-02 | docs/crm/v2/conciliacion-seguridad.md | reconciliar TK-13, TK-36 y TK-39 S1–S5 con evidencia actual, remoto separado y riesgos sin cerrar | Ready: auditar |

## Cierres históricos

TK-13: checksum local no acredita backup remoto ni restauración. TK-36: evidencia acumulada del panel viejo, HU-7 excluida y Calendar fuera. TK-39: conciliación pendiente de observaciones S1–S5, incluso donde Notion afirma arreglos posteriores. Mantener resultado histórico y anotar limitaciones, sin borrar tareas. Ver auditoria-transicion.md.

## Validación de orquestación

No declarar lista hasta verificar dos agentes visibles sin pisarse archivos, apoyo registrado dentro del límite, recuperación por UUID tras cerrar ventana, entrega fallida detectada, revisión independiente previa y correspondencia tarea/cambios/pruebas/tablero. Usar solo datos ficticios. La compilación y piloto conectado del producto son evidencia separada, no consecuencia de que el lanzador pase.
