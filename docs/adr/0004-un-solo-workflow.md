# ADR 0004: Un solo workflow con la agenda como entrada interna

- **Estado:** Aceptada
- **Fecha:** 2026-10-02

## Contexto

En v2, la agenda era un sub-workflow aparte (`workflows/legacy/v2-agenda-gcal.json`). Eso causó dos
errores recurrentes: «Workflow is not active and cannot be executed», cuando el sub-workflow no estaba
publicado, y «The workflow did not return a response», cuando una rama terminaba sin nodo de salida.
Además, había que copiar el ID del sub-workflow a mano en cada instalación.

## Decisión

`version4` es **un solo workflow con dos entradas**: el webhook de Kapso y una entrada interna
(*Execute Workflow Trigger*) para la agenda. Las herramientas del agente se llaman a sí mismas con
`$workflow.id`.

## Consecuencias

- Se importa un solo archivo y funciona en cualquier instalación, sin copiar IDs.
- Publicar el bot publica también la agenda.
- El workflow es grande (34 nodos). Cada rama de la agenda termina en un nodo explícito
  (`Respuesta turnos`, `Respuesta pedido inválido`, `Cita reservada`).
