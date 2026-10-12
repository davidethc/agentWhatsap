# TK-20 · Conectar el `version4` real al CRM: plan exacto

> Para mostrárselo al usuario **antes** de tocar nada. Este plan **no se ha ejecutado**: Eli sigue
> igual que hoy. Contexto: [Plan §5](plan.md) (contrato Eli → CRM) y [operación](../operacion.md).

## En una frase

Al `version4` real se le **agregan 8 nodos y 3 conexiones** (cuatro ramas en paralelo que avisan al CRM
sin esperar). **Ningún nodo existente cambia**: ni el modelo de Gemini, ni el prompt, ni la cadena de
medios, ni los seguimientos. Si el CRM falla, Eli responde igual.

> El filtro `scripts/crm-copia-version4.jq` es **idempotente**: se puede aplicar sobre el `version4` de
> `main` o sobre el vivo aunque ya tenga ramas CRM (reemplaza por nombre los nodos `CRM: …` y no duplica
> conexiones). Así, si el vivo ya trae las 3 primeras ramas, solo se suman los cambios de agenda.

## Qué cambia exactamente

| Dónde se cuelga (conexión existente) | Nodos nuevos | Evento al CRM |
|---|---|---|
| `¿Mensaje nuevo?` (salida «sí») → además de `¿Tiene medios?` | `CRM: armar mensaje_entrante` → `CRM: enviar mensaje_entrante (sin esperar)` | `mensaje_entrante` |
| `Responder por WhatsApp` → además de `Leer pendientes` y `Seg: leer (Eli)` | `CRM: armar mensaje_saliente` → `CRM: enviar mensaje_saliente (sin esperar)` | `mensaje_saliente` |
| `Responder por WhatsApp` (la rama va la primera) | `CRM: armar cambios de agenda` → `CRM: enviar cambios de agenda (sin esperar)` (una llamada por evento) | `cita_movida` y `cita_cancelada` |
| `Crear evento` → además de `Cita reservada` | `CRM: armar cita_reservada` → `CRM: enviar cita_reservada (sin esperar)` | `cita_reservada` |

- Cada rama nueva va **primero** en su conexión y no devuelve nada a Eli. La respuesta de la
  herramienta de agenda sigue saliendo de `Cita reservada`, como siempre.
- Los nodos nuevos tienen «continuar si hay error»; el nodo de envío **no espera** al sub-workflow.
- Los eventos **no llevan el texto del mensaje** (decisión TK-41 / ADR 0012): solo `tipo`, `telefono`,
  `nombre_whatsapp`, `message_id` o `execution_id`, y `en` (en la cita: id del evento, hora, servicio, nombre).
- **Cambios de agenda:** cuando Eli usa `mover_cita` o `cancelar_cita` (van directo a Google Calendar),
  `CRM: armar cambios de agenda` lee los pasos del agente (`intermediateSteps`: `action.tool`,
  `action.toolInput`, `observation`) y arma `cita_movida` `{telefono, gcal_event_id, inicio, fin}` o
  `cita_cancelada` `{telefono, gcal_event_id}` **solo de las llamadas que no fallaron**; si no hubo
  cambios, no manda nada. Requiere `returnIntermediateSteps` del agente (ya está activo en `main`).
- Total: 47 nodos → 55 (53 → 55 si el vivo ya trae las 3 primeras ramas). Lo demás (credenciales, webhook, prompts, modelos) queda idéntico.
- Dónde se genera: [`scripts/crm-copia-version4.jq`](../../scripts/crm-copia-version4.jq). La copia ya
  probada es [`workflows/pruebas/eli-version4-crm-copia.json`](../../workflows/pruebas/eli-version4-crm-copia.json).

## Lo que ya se probó (en copias inactivas, con datos inventados)

- Contra el CRM local: los 3 eventos dieron `{"ok":true}`; quedaron el mensaje entrante y el saliente
  **sin texto**, la cita ligada a la conversación y el paciente en **Agendó**.
- Con el CRM apagado: cada envío falla en silencio, `Cita reservada` (Eli) sigue corriendo y el evento
  cae en la lista `v4:crm:errores` de Redis (sin texto).
- Con el sub-workflow `Eli → CRM` **sin publicar**: las ramas fallan en silencio y Eli sigue (es el
  «interruptor de emergencia» de más abajo).
- **No se probó** la llamada real `Execute Workflow` → `Eli → CRM`, porque n8n exige que el sub-workflow
  esté **publicado** para llamarlo. Es lo primero que se verifica en el paso 6.

## Antes de empezar (requisitos)

1. **CRM en la nube listo** (lo hace el orquestador, TK-12): proyecto de Supabase con las migraciones,
   la función `eli-evento` desplegada y su secreto `ELI_EVENTO_SECRETO` puesto. Anota la URL
   `https://<proyecto>.supabase.co/functions/v1/eli-evento`.
2. **Una hora sin pacientes escribiendo.** Entre importar y publicar (y el reinicio de n8n) Eli no
   responde ~1–2 minutos. Los mensajes de esa ventana pueden perderse.
3. **Un número de prueba del equipo** (no de un paciente) para la verificación.
4. **Aprobación explícita del usuario** de este plan.

## Pasos (desde la carpeta principal `/Users/d/agentWhatsap`)

### 1. Respaldo (obligatorio)

```bash
scripts/backup.sh          # anota la carpeta: backups/<fecha>/ (workflows.json, credentials.json, postgres.dump)
```

### 2. Subir el sub-workflow `Eli → CRM` apuntando a la nube (inactivo todavía)

```bash
URL="https://<proyecto>.supabase.co/functions/v1/eli-evento"
jq --arg url "$URL" '(.nodes[] | select(.name=="Enviar a eli-evento") | .parameters.url) = $url' \
   workflows/eli-crm.json > /tmp/eli-crm-nube.json
docker compose cp /tmp/eli-crm-nube.json n8n:/tmp/eli-crm.json
docker compose exec n8n n8n import:workflow --input=/tmp/eli-crm.json
```

El secreto va en la credencial `Eli CRM secreto` (Header Auth, nombre `x-eli-secreto`). Sin dejarlo en el
historial de la terminal:

```bash
read -rs ELI_EVENTO_SECRETO          # pega el secreto de la nube; no se muestra
jq -n --arg v "$ELI_EVENTO_SECRETO" '[{id:"EliCrmSecret0001",name:"Eli CRM secreto",type:"httpHeaderAuth",data:{name:"x-eli-secreto",value:$v}}]' > /tmp/cred.json
docker compose cp /tmp/cred.json n8n:/tmp/cred.json
docker compose exec n8n n8n import:credentials --input=/tmp/cred.json
docker compose exec -u root n8n rm -f /tmp/cred.json /tmp/eli-crm.json; rm -f /tmp/cred.json; unset ELI_EVENTO_SECRETO
```

### 3. Publicar el sub-workflow

```bash
docker compose exec n8n n8n publish:workflow --id=EliCrmSubwf00001
```

Solo tiene un `executeWorkflowTrigger`: no abre ningún webhook ni cron.

### 4. Armar el `version4` nuevo **desde el workflow vivo** (no desde el JSON del repo)

El JSON del repo guarda las credenciales solo por nombre; el vivo las tiene por id. Por eso se parte
de un export del vivo, para no perder ninguna credencial:

```bash
docker compose exec n8n n8n export:workflow --id=u4hWSJLdLFVSTtjQ --output=/tmp/v4-vivo.json
docker compose cp n8n:/tmp/v4-vivo.json /tmp/v4-vivo.json
jq '.[0]' /tmp/v4-vivo.json > /tmp/v4-vivo-obj.json
CRM_REAL=1 jq -f scripts/crm-copia-version4.jq /tmp/v4-vivo-obj.json > /tmp/v4-con-crm.json
```

Comprobaciones (todas deben dar lo indicado **antes** de seguir):

```bash
jq '.nodes | length' /tmp/v4-vivo-obj.json /tmp/v4-con-crm.json            # 47 (o 53) y 55
jq '[.nodes[].name] | group_by(.) | map(select(length>1)) | length' /tmp/v4-con-crm.json   # 0 (sin nodos repetidos)
jq -r '.name, .id' /tmp/v4-con-crm.json                                      # version4 y u4hWSJLdLFVSTtjQ
diff <(jq -S '[.nodes[]|select(.credentials!=null)|{name,credentials}]' /tmp/v4-vivo-obj.json) \
     <(jq -S '[.nodes[]|select(.credentials!=null)|{name,credentials}]' /tmp/v4-con-crm.json) && echo "credenciales intactas"
jq -n --slurpfile a /tmp/v4-vivo-obj.json --slurpfile b /tmp/v4-con-crm.json \
  '[ $a[0].nodes[] as $x | ($b[0].nodes[]|select(.name==$x.name)) as $y | select($x != $y) | $x.name ]'   # []  (ningún nodo existente cambió; si el vivo ya traía ramas CRM, solo pueden salir nodos «CRM: …»)
grep -ciE "x-eli-secreto|private_key|sk-" /tmp/v4-con-crm.json              # 0
```

Si el vivo difiere del `version4` de `main` (alguien lo cambió a mano en n8n), **parar** y avisar: hay
que exportar ese cambio al repo antes (`scripts/export-workflow.sh`, ver [CONTRIBUTING](../../CONTRIBUTING.md)).

### 5. Aplicar (aquí empieza la ventana sin respuesta de Eli)

```bash
docker compose cp /tmp/v4-con-crm.json n8n:/tmp/v4-con-crm.json
docker compose exec n8n n8n import:workflow --input=/tmp/v4-con-crm.json   # desactiva el workflow
docker compose exec n8n n8n publish:workflow --id=u4hWSJLdLFVSTtjQ
docker compose restart n8n                                                  # obligatorio
docker compose exec -u root n8n rm -f /tmp/v4-vivo.json /tmp/v4-con-crm.json; rm -f /tmp/v4-*.json
```

### 6. Verificar (ver la lista de abajo) y recién entonces avisar «listo».

## Cómo verificar

1. **Eli sana:** `scripts/check.sh` sin errores y `n8n list:workflow --active=true` incluye `version4` **y**
   `Eli → CRM` (y `Eli · Seguimiento`).
2. **Autotests** de [operación](../operacion.md#autotests-sin-efectos-externos) (cola y Redis) en verde.
3. **Mensaje real de prueba** desde el número de prueba: Eli responde como siempre y, en pocos segundos,
   en el CRM aparece la conversación y el paciente en **Nuevo**, con un `mensaje_entrante` y un
   `mensaje_saliente` y **sin texto**. (SQL de apoyo: `select direccion, enviado_en from mensajes order by id desc limit 5`.)
4. **Segundo mensaje** → el paciente pasa a **Conversando**.
5. **Reserva de prueba** (pedir una cita con ese número): se crea el evento en Google Calendar como
   siempre, y en el CRM aparece la cita ligada al paciente, que pasa a **Agendó**.
6. **Sin errores en cola:** `docker compose exec redis redis-cli -n 1 llen v4:crm:errores` → `0`
   (con la contraseña: `-a "$REDIS_PASSWORD"`).
7. **En n8n → Executions** de `version4`: las ejecuciones nuevas terminan en éxito y los nodos `CRM: …`
   salen en verde (no «continuaron con error»).
8. **Borrar los datos de prueba** del CRM (el paciente del número de prueba) al terminar.

Si falla el 3 o el 5 pero Eli responde bien: no es una emergencia; mirar `v4:crm:errores` (cada entrada
dice el error) y la URL/secreto del sub-workflow. Si **Eli deja de responder**: ir directo a «Volver atrás».

## Cómo volver atrás

**A. Interruptor de emergencia (30 s; no toca `version4`).** Apaga solo el aviso al CRM:

```bash
docker compose exec n8n n8n unpublish:workflow --id=EliCrmSubwf00001
docker compose restart n8n
```

Las 3 ramas pasan a fallar en silencio (probado) y Eli responde igual. Para volver a encender:
`publish:workflow` + `restart n8n`.

**B. Volver al `version4` anterior** (si el problema está en el propio `version4`). Con la carpeta del
respaldo del paso 1:

```bash
jq '.[] | select(.id=="u4hWSJLdLFVSTtjQ")' backups/<fecha>/workflows.json > /tmp/v4-anterior.json
docker compose cp /tmp/v4-anterior.json n8n:/tmp/v4-anterior.json
docker compose exec n8n n8n import:workflow --input=/tmp/v4-anterior.json
docker compose exec n8n n8n publish:workflow --id=u4hWSJLdLFVSTtjQ
docker compose restart n8n
```

**C. Todo** (último recurso): restaurar la base de n8n con `pg_restore` como indica
[operación → Restaurar](../operacion.md) (requiere la misma `N8N_ENCRYPTION_KEY`, que está en
`backups/<fecha>/env`).

Después de volver atrás, `Eli → CRM` puede quedarse importado sin publicar: no hace nada.

## Riesgos y cómo se cubren

| Riesgo | Cómo se cubre |
|---|---|
| El CRM cae o responde lento | Las ramas no esperan; timeout 5 s; 2 reintentos; el evento queda en `v4:crm:errores` (máx. 200) y Eli sigue |
| Se pierden credenciales al importar | Se parte del export del **vivo** y se comprueba que las credenciales son idénticas (paso 4) |
| Cambiar el webhook por error | El modo `CRM_REAL=1` no renombra nada; el paso 4 comprueba que ningún nodo existente cambió |
| Sub-workflow sin publicar | Paso 3 antes del paso 5; si se olvida, las ramas fallan en silencio (Eli sigue) y la verificación 3 lo delata |
| Mensajes perdidos durante la ventana | Hora sin tráfico; la ventana es de 1–2 min |
| Texto de pacientes en el CRM o en Redis | Los eventos no llevan `texto` y `Eli → CRM` lo descarta aunque llegara (TK-41) |
| Agenda y Calendar | No se tocan: `mover_cita` y `cancelar_cita` siguen escribiendo directo en Calendar. La sincronización con el panel (TK-15 a TK-17) queda para el final y **no es requisito** de TK-20 |
