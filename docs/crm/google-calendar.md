# Google Calendar para el Eli Panel: guía paso a paso (TK-14)

> Para quien nunca ha usado Google Cloud. Tiempo: unos 20 minutos. Contexto técnico:
> [Plan, sección 6](plan.md) y [ADR 0009](../adr/0009-sync-google-calendar.md).

## ¿Para qué sirve?

El Eli Panel sincroniza las citas con Google Calendar usando una **cuenta de servicio**: es como un
«usuario robot» con su propio correo. No es una persona; solo entra a los calendarios que **tú le
compartas**. Así la sincronización funciona aunque tu computadora esté apagada.

Vas a crear: un proyecto de Google Cloud, activar la API de Calendar, la cuenta de servicio, su clave
(un archivo `.json`), un calendario de **PRUEBA** y compartirlo con el robot.

## ¿Cuesta algo? ¿Pide tarjeta?

- **La API de Google Calendar es gratis.** No tiene cobro por uso; solo tiene cuotas generosas por
  minuto/día que nuestro uso (una clínica, sincronizando cada 2 min) no alcanza.
- **Crear un proyecto, activar la API y crear cuentas de servicio y claves NO pide tarjeta.** No
  necesitas activar facturación ni la prueba gratuita de $300.
- **Si en algún momento Google te pide una tarjeta, DETENTE y avisa** (no la pongas). Esa pantalla
  sale al activar facturación o servicios de pago, que aquí no usamos.
- Hay que tener una cuenta de Google normal (Gmail). Una cuenta de Google Workspace de empresa puede
  tener políticas que bloquean crear claves (ver «Problemas comunes»).
- Para la lectura que haremos al final solo se usa cuota gratuita. Aun así, el uso real del consultorio
  no llega a ningún límite que lo afecte.

> Importante: usa **tu cuenta personal** para el calendario de PRUEBA. El calendario real de la doctora
> se comparte más tarde, con el mismo robot, solo cuando el usuario lo apruebe.

---

## Paso 1. Crear el proyecto

1. Entra a <https://console.cloud.google.com/> con tu cuenta de Google.
2. Si es la primera vez, acepta los términos (marca país y acepta). **No** actives la prueba gratuita.
3. Arriba a la izquierda, junto al logo de Google Cloud, haz clic en el selector de proyecto →
   **Proyecto nuevo**.
4. Nombre: `eli-panel`. En «Organización/Ubicación» deja lo que salga. Clic en **Crear**.
5. Espera unos segundos y, en la campanita, clic en **Seleccionar proyecto**. Verifica que arriba diga
   `eli-panel`.

## Paso 2. Activar la API de Google Calendar

1. Menú ☰ → **APIs y servicios** → **Biblioteca**.
2. Busca `Google Calendar API` → ábrela → botón **Habilitar**.
3. Debe aparecer un panel de la API con gráficas. Listo.

## Paso 3. Crear la cuenta de servicio

1. Menú ☰ → **IAM y administración** → **Cuentas de servicio** → **Crear cuenta de servicio**.
2. Nombre: `eli-calendario`. El ID se llena solo. Clic en **Crear y continuar**.
3. «Otorgar acceso a esta cuenta» y «Otorgar a los usuarios acceso»: **déjalos vacíos** y clic en
   **Listo**. (No necesita roles de Google Cloud; el permiso lo da el calendario compartido.)
4. En la lista verás un correo parecido a
   `eli-calendario@eli-panel.iam.gserviceaccount.com`. **Cópialo**: lo usarás en el paso 5.

## Paso 4. Crear la clave JSON

1. En la lista de cuentas de servicio, haz clic en `eli-calendario` → pestaña **Claves**.
2. **Agregar clave** → **Crear clave nueva** → tipo **JSON** → **Crear**.
3. Se descarga un archivo `.json` (algo como `eli-panel-1a2b3c4d5e6f.json`). **Esa es la llave del
   robot: quien la tenga puede leer y editar los calendarios compartidos.** Trátala como una contraseña.
   Google no te deja volver a descargarla; si la pierdes, creas otra y borras la vieja.
4. Muévela **fuera de las carpetas de git**, o a la carpeta `secrets/` del proyecto (ya está en
   `.gitignore`):

   ```bash
   mkdir -p secrets
   mv ~/Downloads/eli-panel-*.json secrets/google-sa.json
   ```

   El `.gitignore` ignora `secrets/` y nombres como `google-sa*.json`, `*-sa.json`,
   `*service-account*.json`. **Aun así, nunca la pegues en un chat, Notion, una captura ni un
   documento.** Si crees que se filtró: Claves → ⋮ → **Eliminar** y crea otra.

## Paso 5. Crear el calendario de PRUEBA y compartirlo

1. Entra a <https://calendar.google.com/>.
2. A la izquierda, junto a «Otros calendarios», clic en **+** → **Crear calendario nuevo**.
3. Nombre: `Eli Panel – PRUEBA`. Zona horaria: **(GMT-05:00) Hora de Ecuador** (Guayaquil). **Crear
   calendario.** (Nunca uses el calendario real para desarrollar.)
4. A la izquierda, pasa el mouse sobre el calendario nuevo → ⋮ → **Configuración y uso compartido**.
5. Baja a **Compartir con determinadas personas o grupos** → **Añadir personas y grupos** → pega el
   correo de la cuenta de servicio (`eli-calendario@…iam.gserviceaccount.com`).
6. En permisos elige **Hacer cambios en eventos** (no «Ver» solamente: el panel debe poder crear y
   mover eventos). **Enviar.** Si Google avisa que «esa persona no usa Google Calendar», confirma:
   es normal para un robot.
7. Más abajo, en **Integrar el calendario**, copia el **ID de calendario**. Para un calendario creado
   por ti es algo como `a1b2c3d4e5@group.calendar.google.com`. Ese es tu `GCAL_CALENDAR_ID`.
8. Crea 1 o 2 eventos de prueba en las próximas semanas (ej. «Prueba 1», mañana 10:00) para que el
   script tenga algo que listar.

## Paso 6. Guardar los secretos (solo en `.env` y en Supabase)

Son dos secretos. **Nunca en git, nunca en el código, nunca en Notion ni en chats.**

| Nombre | Qué es | Dónde se guarda |
|---|---|---|
| `GOOGLE_SA_JSON` | El **contenido completo** del archivo `.json` de la clave | `.env` (local) y secretos de Supabase |
| `GCAL_CALENDAR_ID` | El ID del calendario (paso 5.7) | `.env` (local) y secretos de Supabase |

**Local, en `.env`** (ya está en `.gitignore`). El JSON debe ir en **una sola línea y entre comillas
simples**. Este comando lo agrega sin que tengas que copiar nada a mano (reemplaza el ID):

```bash
printf "GOOGLE_SA_JSON='%s'\n" "$(node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync("secrets/google-sa.json","utf8"))))')" >> .env
printf "GCAL_CALENDAR_ID=%s\n" "a1b2c3d4e5@group.calendar.google.com" >> .env
```

Alternativa sin tocar `.env`: dejar el archivo en `secrets/google-sa.json` y usar
`GOOGLE_SA_JSON_FILE=secrets/google-sa.json` (el script de prueba lo acepta).

**En la nube, secretos de Supabase** (cuando el proyecto `eli-crm` exista y la función `calendario`
vaya a desplegarse; TK-15). Con la CLI, desde la raíz:

```bash
supabase secrets set --env-file <(grep -E '^(GOOGLE_SA_JSON|GCAL_CALENDAR_ID)=' .env)
```

o en el panel: Supabase → **Edge Functions → Secrets** → agrega los dos nombres. Para la doctora
(producción) se usarán **otros** valores de `GCAL_CALENDAR_ID`, pero la misma cuenta de servicio.

**Comprobar que no entra a git:**

```bash
git status --short          # no debe aparecer secrets/ ni ningún .json de clave
git check-ignore -v secrets/google-sa.json
```

## Paso 7. Lectura de prueba

El script [`scripts/gcal-prueba.mjs`](../../scripts/gcal-prueba.mjs) solo **lee**: pide un token a
Google con la clave y lista los próximos 10 eventos del calendario. No necesita instalar nada (solo
Node 18 o más).

```bash
set -a; source .env; set +a
node scripts/gcal-prueba.mjs
```

Resultado esperado:

```
✓ Conexión correcta con «Eli Panel – PRUEBA» (zona America/Guayaquil).
  • 2026-10-12T10:00:00-05:00  Prueba 1
```

Si falla, el script dice por qué. **TK-14 se da por hecho cuando ves el «✓» con tus eventos.**

## Problemas comunes

| Mensaje | Causa y arreglo |
|---|---|
| `invalid_grant … account not found` / `Invalid JWT Signature` | Clave borrada o JSON mal copiado. Crea otra clave (paso 4) y vuelve a guardarla. |
| `Calendar respondió 404 Not Found` | `GCAL_CALENDAR_ID` mal copiado, o el calendario no está compartido con el correo de la cuenta de servicio (paso 5.5). |
| `Calendar respondió 403 … has not been used in project` | Falta habilitar la API (paso 2), o espera 1–2 min si acabas de hacerlo. |
| `403 … Forbidden` en el calendario | Compartiste con permiso de solo ver. Cambia a «Hacer cambios en eventos». |
| «El JSON no es válido» | En `.env` el JSON debe ir en una línea y entre comillas simples; usa el comando del paso 6. |
| No me deja crear la clave («políticas de la organización») | Es una cuenta de Workspace con la política `iam.disableServiceAccountKeyCreation`. Usa una cuenta Gmail personal o pide al administrador que la permita. |

## Límites y costos (resumen para el informe)

- Google Calendar API: **gratis**; sin tarjeta; cuotas muy por encima del uso del consultorio.
- Cuenta de servicio y clave JSON: **gratis**.
- Lo único a vigilar: **no activar facturación**. Si se pide tarjeta, avisar antes (Constitución,
  Costos).
- Conservar el proyecto en «sin facturación» no vence ni se apaga solo.

## Qué sigue

Con la lectura funcionando, **TK-15** (push de citas a Calendar) y **TK-16** (pull incremental) usan
estos mismos dos secretos desde la Edge Function `calendario`.
