# Guía completa: agente de WhatsApp con n8n (paso a paso)

Esta guía permite replicar desde cero el agente de citas por WhatsApp:

```
Cliente en WhatsApp → Meta → Kapso → ngrok → n8n (en tu Mac, dentro de Docker)
                                                  │
                     IA (OpenRouter) + memoria + Google Calendar (consultar / crear cita)
                                                  │
                            n8n → Kapso → respuesta por WhatsApp al cliente
```

> **Nunca subas claves a GitHub.** Las API keys, el Client Secret de Google y los tokens van
> en n8n (credenciales) o en tu `.env`, que está en `.gitignore`.

---

## Índice

0. [Cuentas que necesitas](#0-cuentas-que-necesitas)
1. [Instalar Docker](#1-instalar-docker)
2. [Levantar n8n con Docker](#2-levantar-n8n-con-docker)
3. [ngrok: dirección pública para n8n](#3-ngrok-dirección-pública-para-n8n)
4. [Kapso: conectar WhatsApp](#4-kapso-conectar-whatsapp)
5. [Google Cloud: credencial de Google Calendar](#5-google-cloud-credencial-de-google-calendar)
6. [OpenRouter: el modelo de IA](#6-openrouter-el-modelo-de-ia)
7. [Importar y configurar el workflow](#7-importar-y-configurar-el-workflow)
8. [Probar y verificar](#8-probar-y-verificar)
9. [(Opcional) Conectar Claude a n8n por MCP](#9-opcional-conectar-claude-a-n8n-por-mcp)
10. [Rutina diaria para encenderlo](#10-rutina-diaria-para-encenderlo)
11. [Comandos útiles](#11-comandos-útiles)
12. [Errores que nos salieron y su solución](#12-errores-que-nos-salieron-y-su-solución)

---

## 0. Cuentas que necesitas

| Servicio | Para qué | Enlace |
|---|---|---|
| Docker Desktop | Correr n8n en tu compu | https://www.docker.com/products/docker-desktop/ |
| GitHub | Bajar este repositorio | https://github.com |
| ngrok (gratis) | Dirección pública HTTPS para n8n | https://dashboard.ngrok.com/signup |
| Kapso | Puente con la API de WhatsApp de Meta | https://app.kapso.ai |
| Meta Business | El número de WhatsApp Business | https://business.facebook.com |
| Google Cloud | Credencial OAuth para Google Calendar | https://console.cloud.google.com |
| OpenRouter | Modelo de IA (API key) | https://openrouter.ai |

---

## 1. Instalar Docker

### macOS
1. Mira tu chip en  → *Acerca de esta Mac* (**Apple M1/M2/M3/M4** o **Intel**).
2. Descarga Docker Desktop para ese chip, abre el `.dmg` y arrástralo a *Aplicaciones*.
3. Ábrelo (o en terminal: `open -a Docker`) y espera a que la ballena 🐳 de la barra superior deje de moverse.
4. Recomendado: Docker Desktop → ⚙️ *Settings → General* → activa **Start Docker Desktop when you sign in**.

### Windows
1. PowerShell como administrador: `wsl --install` y reinicia.
2. Instala Docker Desktop con la opción **Use WSL 2**.

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER    # luego cierra sesión y vuelve a entrar
```

### Verificar
```bash
docker --version
docker compose version
docker run hello-world     # debe decir "Hello from Docker!"
```

---

## 2. Levantar n8n con Docker

```bash
cd ~
git clone https://github.com/davidethc/agentWhatsap.git
cd agentWhatsap
cp .env.example .env
docker compose up -d
```

> ⚠️ En la terminal de Mac (zsh) **no pegues comentarios `#` junto a los comandos**: zsh los toma
> como parte del comando y falla (`cp: .env is not a directory`).

> ⚠️ Todos los comandos `docker compose ...` se ejecutan **dentro de la carpeta `agentWhatsap`**.
> Si el prompt dice `~ %` estás fuera → `cd ~/agentWhatsap`. Debe decir `agentWhatsap %`.

Abre **http://localhost:5678** y crea tu cuenta de **owner** (correo + contraseña de n8n).

Qué trae `docker-compose.yml`:
- imagen oficial gratuita `docker.n8n.io/n8nio/n8n`, puerto `5678`
- volumen `n8n_data` → tus flujos y credenciales **no se pierden** al reiniciar
- lee `.env` para `WEBHOOK_URL` y la zona horaria

Edita `.env` (`open -e .env`) y deja la zona horaria de Ecuador:
```env
GENERIC_TIMEZONE=America/Guayaquil
```

---

## 3. ngrok: dirección pública para n8n

**Por qué:** Kapso, Google y Claude están en internet. Para ellos `localhost` es *su propio
servidor*, no tu Mac. ngrok crea un túnel `https://…ngrok-free.dev → tu Mac:5678`.

1. Instalar:
   ```bash
   brew install ngrok
   ```
2. Crear cuenta en https://dashboard.ngrok.com/signup, copiar el authtoken (*Your Authtoken*) y:
   ```bash
   ngrok config add-authtoken TU_TOKEN
   ```
3. Abrir el túnel (en una terminal aparte, **que se queda abierta siempre**):
   ```bash
   ngrok http 5678
   ```
   Copia la línea `Forwarding https://XXXX.ngrok-free.dev -> http://localhost:5678`.
   - En nuestro caso: `https://slighting-barbecue-unguided.ngrok-free.dev`
   - Si la dirección te cambia al reiniciar ngrok: en el dashboard → *Domains* reclama tu
     dominio fijo gratis y usa `ngrok http --url=TU-DOMINIO.ngrok-free.dev 5678`.
4. Poner esa dirección en `.env` (con `/` al final):
   ```env
   WEBHOOK_URL=https://slighting-barbecue-unguided.ngrok-free.dev/
   ```
5. Reiniciar n8n para que la tome:
   ```bash
   cd ~/agentWhatsap
   docker compose up -d
   ```
6. **Desde ahora entra a n8n por la dirección de ngrok** (`https://…ngrok-free.dev`), no por
   `localhost`. Si ngrok muestra "You are about to visit…", pulsa **Visit Site**.
   (Si conectas credenciales de Google estando en `localhost`, sale `Error: Unauthorized`.)

Panel de ngrok para ver cada petición que llega: http://127.0.0.1:4040

> Si la dirección de ngrok cambia, hay que actualizarla en: `.env`, Kapso (webhook),
> Google Cloud (orígenes + URI de redirección) y el conector MCP de Claude.

---

## 4. Kapso: conectar WhatsApp

### 4.1 Cuenta y número
1. Crea la cuenta en https://app.kapso.ai y un proyecto.
2. *Phone numbers* → conecta tu número de WhatsApp Business (Meta).
   - En nuestro caso, número **Nooki Envío Gratis**, `phone_number_id` = `1347989838397545`.
   - El *Phone Number ID* también se ve en Meta → WhatsApp Manager → Números de teléfono.

### 4.2 API key de Kapso
1. Kapso → *Integrar → claves API* → crea una clave.
2. En n8n el nodo de Kapso es un **community node**. Si no aparece al buscar "Kapso":
   n8n → *Settings → Community nodes → Install* → `@kapso/n8n-nodes-kapso`.
3. Crea la credencial **Kapso account** en n8n con esa API key.

### 4.3 Webhook (Kapso → n8n)
Kapso → *Integrar → Webhooks* → tu número → **Agregar webhook**:

| Campo | Valor |
|---|---|
| Tipo | **Kapso events** |
| Endpoint URL (pruebas) | `https://TU-DOMINIO.ngrok-free.dev/webhook-test/815c58df-43f7-4f91-bde5-6935b562214c` |
| Endpoint URL (producción) | `https://TU-DOMINIO.ngrok-free.dev/webhook/815c58df-43f7-4f91-bde5-6935b562214c` |
| Evento | ✅ **Message received** (`whatsapp.message.received`) |
| Debounce / búfer | ✅ activado, **5 s**, máximo **50** mensajes |
| Versión | v2 |
| Estado | **Activo** (interruptor verde) |

- **`/webhook-test/`** solo funciona mientras en n8n pulsas *Listen for test event* / *Execute workflow* (escucha 1 mensaje).
- **`/webhook/`** funciona cuando el workflow está **publicado/activo**. Es el que se deja fijo.
- Si falla, revisa Kapso → **Registros** (Logs). `Connection refused … localhost` = pusiste `localhost` en vez de la URL de ngrok.

---

## 5. Google Cloud: credencial de Google Calendar

> Haz **todo dentro del mismo proyecto** (nombre arriba a la izquierda, junto al logo).
> Nosotros terminamos con dos proyectos ("gogleDrive" y "calendar") y Client IDs distintos: usa uno solo.

### 5.1 Proyecto y API
1. https://console.cloud.google.com → crea un proyecto (ej. `calendar`).
2. Menú → *APIs y servicios* → **Biblioteca** → busca **Google Calendar API** → **Habilitar**.

### 5.2 Pantalla de consentimiento (Google Auth Platform)
*APIs y servicios → Pantalla de consentimiento*:
- **Información de la marca**
  - Nombre de la aplicación: `calendar`
  - Correo de asistencia: tu Gmail
  - Información de contacto del desarrollador: tu Gmail
  - Logo, página principal, políticas, **dominios autorizados**: **vacíos**
    (si subes logo, Google pide verificar la app; casillas de dominio vacías dan error
    "No se permiten dominios duplicados" → bórralas con 🗑️).
- **Público** → *Usuarios de prueba* → **+ Add users** → tu Gmail.
- Opcional: **Publicar app**. En modo *Prueba* el acceso caduca cada 7 días y hay que volver a pulsar *Sign in with Google*.

### 5.3 Cliente OAuth
*Clientes* (o *Credenciales*) → **Crear cliente** → *ID de cliente de OAuth*:

| Campo | Valor |
|---|---|
| Tipo de aplicación | **Aplicación web** |
| Nombre | `calendar` |
| Orígenes autorizados de JavaScript | `https://TU-DOMINIO.ngrok-free.dev` (sin `/` final) |
| URIs de redireccionamiento autorizados | `https://TU-DOMINIO.ngrok-free.dev/rest/oauth2-credential/callback` |

La URI de redirección **cópiala exactamente** de n8n (credencial Google Calendar → *OAuth Redirect URL*).
Pulsa **Crear** y copia el **ID de cliente** y el **Secreto del cliente**
(el secreto solo se muestra una vez; si lo pierdes: *Agregar secreto*).

### 5.4 Credencial en n8n
1. Abre n8n **por la dirección de ngrok** e inicia sesión.
2. *Credentials → Create → Google Calendar OAuth2 API*.
3. Pega **Client ID** y **Client Secret** → **Save**.
4. **Sign in with Google** → elige tu cuenta.
   - "Google no verificó esta app" → *Configuración avanzada* → *Ir a calendar (no seguro)*.
   - Acepta los permisos de Calendar.
5. Debe decir **Account connected** ✅.

---

## 6. OpenRouter: el modelo de IA

1. https://openrouter.ai → **Keys** (https://openrouter.ai/keys) → **Create Key** → copia `sk-or-v1-...`.
2. (Para modelos de pago) carga saldo en https://openrouter.ai/settings/credits.
3. En n8n: *Credentials → Create → OpenRouter* → pega la key → **Save**.
4. Elegir modelo: el agente usa **herramientas** (calendario), así que el modelo **debe soportar tools**.
   - Lista de gratis con tools: https://openrouter.ai/models?max_price=0&supported_parameters=tools
   - Nosotros usamos `nvidia/nemotron-3-super-120b-a12b:free` (gratis, ~15 s por respuesta).
   - Barato y más fiable: `openai/gpt-4.1-mini`.
   - Gratis: ~50 peticiones/día sin saldo; cada mensaje de WhatsApp gasta 2-3.

Alternativa gratis: **Google Gemini** (API key en https://aistudio.google.com/apikey) con el nodo
*Google Gemini Chat Model*, modelo *Flash*.

---

## 7. Importar y configurar el workflow

Archivos: [`workflows/barberia-agenda-gcal.json`](workflows/barberia-agenda-gcal.json) (sub-workflow, impórtalo primero)
y [`workflows/agente-citas.json`](workflows/agente-citas.json) (bot).

```
Webhook Kapso → Normalizar mensaje → Agente de citas → Responder por WhatsApp
                                          ├─ Chat Model (OpenRouter)
                                          ├─ Memoria por cliente (por número de teléfono)
                                          ├─ Consultar disponibilidad (Google Calendar)
                                          └─ Crear cita (Google Calendar)
```

1. `cd ~/agentWhatsap && git pull` para tener la última versión.
2. n8n → **Create workflow** → menú **⋯** → **Import from File** → `workflows/agente-citas.json`.
3. Si tenías otro workflow con el mismo webhook (`815c58df-…`), **desactívalo o bórralo**.
4. Configura nodo por nodo:

| Nodo | Qué configurar |
|---|---|
| **Webhook Kapso** | Nada (path `815c58df-43f7-4f91-bde5-6935b562214c`, POST, responde de inmediato). |
| **Normalizar mensaje** | Nada. Junta los mensajes del lote de Kapso y saca texto, número y nombre. |
| **Agente de citas** | En *System Message* edita **SERVICIOS** y **NEGOCIO** (nombre, horario, dirección, precios). |
| **OpenRouter** | Credencial OpenRouter + modelo con *tools*. |
| **Memoria por cliente** | Nada (recuerda 20 mensajes por número). |
| **Info negocio / Ver turnos libres / Agendar cita** | Datos de Supabase (ver [`supabase/README.md`](supabase/README.md)). |
| **Crear cita** | Credencial Google Calendar y **Calendar "From list"** (copia de la cita). |
| **Responder por WhatsApp** | Credencial Kapso. |

> ⚠️ El campo **Calendar** no debe quedar en modo *ID* con `primary` ni en "lo decide la IA"
> (`$fromAI`): n8n lo rechaza (`Calendar parameter's value is invalid`). Elígelo de la lista.

5. Guarda y pulsa **Publish** (o activa el interruptor *Active*).
6. En Kapso deja la URL de producción (`/webhook/…`).

---

## 8. Probar y verificar

1. Escribe al número de WhatsApp, un mensaje a la vez:
   - `hola`
   - `qué servicios tienen?`
   - `quiero un corte mañana a las 2 pm`
   - `sí, confirmo`
2. Cada respuesta tarda ~5-20 s (5 s del búfer de Kapso + la IA).
3. En n8n → pestaña **Executions**: cada mensaje es una ejecución.
   - Verde = bien. Rojo = abre la ejecución y mira el nodo en rojo.
   - Abre **Consultar disponibilidad** / **Crear cita**: deben estar en verde
     (`available: true` y el evento creado con su `htmlLink`).
4. Abre https://calendar.google.com → la cita aparece como `Corte de cabello - <Nombre>` con
   el teléfono en la descripción.

---

## 9. (Opcional) Conectar Claude a n8n por MCP

Permite que Claude vea, edite, ejecute y depure tus workflows.

1. n8n (por ngrok) → *Settings → Instance-level MCP* → **Enable MCP access**.
2. En cada workflow que quieras exponer: **⋯ → Settings → Available in MCP**.
3. Claude → *Conectores* → **n8n** (o *Add custom connector*) → URL del servidor:
   ```
   https://TU-DOMINIO.ngrok-free.dev/mcp-server/http
   ```
4. Te lleva a n8n para aprobar el acceso.

Solo funciona mientras tu Mac, Docker y ngrok estén encendidos.

---

## 10. Rutina diaria para encenderlo

```bash
open -a Docker                      # 1. Docker Desktop (espera la ballena quieta)
cd ~/agentWhatsap
docker compose up -d                # 2. n8n
ngrok http --url=TU-DOMINIO.ngrok-free.dev 5678   # 3. túnel (deja esta terminal abierta)
```
4. Abre `https://TU-DOMINIO.ngrok-free.dev` y comprueba que el workflow está **Published/Active**.
5. Si la dirección de ngrok cambió → actualízala en `.env`, Kapso, Google Cloud (y MCP).

> Para que funcione 24/7 sin tu Mac encendida, hay que mover n8n a un servidor (VPS) con dominio propio.

---

## 11. Comandos útiles

| Acción | Comando |
|---|---|
| Encender n8n | `docker compose up -d` |
| Apagar n8n | `docker compose down` |
| ¿Está corriendo? | `docker compose ps` |
| Ver logs | `docker compose logs -f n8n` |
| Reiniciar | `docker compose restart n8n` |
| Actualizar n8n | `docker compose pull && docker compose up -d` |
| Editar `.env` | `open -e .env` |
| Ver una variable | `grep WEBHOOK_URL .env` |
| Respaldar flujos | `docker compose exec n8n n8n export:workflow --all --output=/files/backup.json` |
| Importar flujos | `docker compose exec n8n n8n import:workflow --input=/files/backup.json` |

> ⚠️ `docker compose down -v` **borra todos tus flujos y credenciales**. No uses `-v`.

---

## 12. Errores que nos salieron y su solución

| Error | Causa | Solución |
|---|---|---|
| `cp: .env is not a directory` | Pegaste el comando con un comentario `#` en zsh | Ejecuta solo `cp .env.example .env` |
| `env file .../.env not found` | No existe `.env` | `cp .env.example .env` |
| `Cannot connect to the Docker daemon` | Docker Desktop cerrado | `open -a Docker` y espera |
| `no configuration file provided: not found` | Estás en `~`, no en el proyecto | `cd ~/agentWhatsap` |
| `localhost rechazó la conexión` (navegador) | n8n no arrancó | `docker compose ps` / `docker compose logs n8n` |
| Kapso: `Failed to open TCP connection to localhost:5678` | Webhook de Kapso apunta a `localhost` | Usa la URL de ngrok |
| `.env` con `abcd-1234.ngrok-free.app` | Era un ejemplo | Pon tu dirección real de ngrok |
| Google: "No se permiten dominios duplicados" | Casillas de dominio vacías | Bórralas o pon tu dominio ngrok sin `https://` |
| Client ID distinto al que tienes en n8n | Creaste clientes en 2 proyectos | Usa ID + secreto del **mismo** proyecto |
| `redirect_uri_mismatch` | URI de redirección distinta | Copia exacta de n8n → *OAuth Redirect URL* |
| `Error: Unauthorized` al conectar Google | Estabas en n8n por `localhost` y Google vuelve por ngrok | Entra a n8n por la URL de ngrok, inicia sesión y repite |
| "Google no verificó esta app" | App en modo prueba | *Configuración avanzada → Ir a calendar* |
| `Cannot publish workflow … Missing or invalid required parameters: calendar` | Calendar en modo ID con `primary` | Calendar → "From list" → elige el calendario |
| `Calendar parameter's value is invalid` | Calendar quedó en `$fromAI` / `primary` | Calendar fijo desde la lista |
| El agente dice "cita agendada" pero no aparece | La herramienta falló y el modelo inventó | Ya hay regla en el prompt: solo confirma si *Crear cita* respondió bien. Revisa *Executions* |
| Evento con zona `America/Mexico_City` | `.env` con zona de México | `GENERIC_TIMEZONE=America/Guayaquil` + `docker compose up -d` |
| El agente no responde | ngrok cerrado / workflow inactivo / URL de test | Revisa ngrok `online`, workflow *Active*, Kapso con `/webhook/` |
| `Rate limit exceeded: free-models-per-day` | Se acabó la cuota gratis diaria de OpenRouter (~50 peticiones) | Carga $10 de créditos en OpenRouter (sube a ~1000/día gratis) o usa un modelo de pago barato / Gemini. Mientras tanto el flujo envía un aviso amable al cliente |
| El agente no saluda como nuevo / repite respuestas viejas | La memoria guarda conversaciones anteriores | Cambia el prefijo de `sessionKey` en *Memoria por cliente* (ej. `v3-`) o reinicia n8n (`docker compose restart n8n`) |
