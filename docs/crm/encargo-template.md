# Plantilla de encargo Codex

Copiar a un archivo de texto fuera de git si contiene contexto operativo. Nunca incluir secretos ni datos reales de pacientes.

- ID y enlace Notion:
- Objetivo concreto y motivo:
- Responsable, modelo y padre (si es apoyo):
- Worktree y rama feat/crm-*:
- Dependencias verificadas:
- Contexto y documentos vigentes:
- Archivos propios (idénticos a cada --owns):
- Límites y exclusiones:
- Criterios de aceptación:
- Comandos de prueba y resultado esperado:
- Evidencia exigida (solo datos ficticios):
- Entrega: informe, commit local, cambios, pruebas y pendientes.

No estás solo en el repositorio: no reviertas cambios ajenos. Antes de cada comando mutante indica qué ejecutas y para qué. No hagas push ni cambies producción. Si necesitas apoyo, solicita al coordinador un objetivo y archivos distintos; él lo registra con --parent. No inicies subagentes ocultos.

El coordinador comprueba el diff y pide revisión independiente antes de integrar. Un proceso con exit 0 y un informe no demuestra aceptación. La tarea pasa a Testing después de revisión e integración; a Done solo con pruebas de la versión integrada y evidencia vinculada en Notion.

Skills: reutilizar primero las disponibles y leer su SKILL.md cuando apliquen. En esta entrega se verificaron writing-plans, using-git-worktrees y verification-before-completion; el revisor leyó code-review. Los demás nombres de los roles son recomendaciones por tarea, no prueba de instalación en otro equipo. No se instalaron skills ni paquetes nuevos.

Si Git común está bloqueado por el sandbox, informar sin SHA. El coordinador verifica diff, pruebas y ownership y crea el commit local. No usar bypass ni pedir al agente que finja una entrega completa.
