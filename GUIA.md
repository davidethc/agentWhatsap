# Guía paso a paso: instalar Eli desde cero

> Eli Panel continúa en crm-v2-diseno. Consulta [SDD](docs/crm/README.md) y [lanzador Codex/tmux](docs/crm/orquestacion-cli.md). Esta guía de Eli no activa el CRM nuevo.

Al terminar esta guía tendrás a Eli respondiendo por WhatsApp, agendando en Google Calendar, con n8n
en modo queue dentro de Docker en tu computador.

```
Paciente en WhatsApp → Meta → Kapso → ngrok → n8n (Docker en tu computador)
                                                │  cola en Redis → worker
                         Gemini (IA) + memoria en Redis + Google Calendar
                                                │
                                n8n → Kapso → respuesta por WhatsApp
```

Tiempo estimado: 1 a 2 horas la primera vez, sobre todo por Google Cloud.

> **¿Usas Windows?** Sigue [docs/instalacion-windows.md](docs/instalacion-windows.md): es esta misma
> guía detallada para Windows 10/11 con WSL 2 y Docker Desktop.

> **Nunca subas claves a GitHub.** Las API keys van en las credenciales de n8n y los secretos del
> sistema en `.env`, que Git ignora. Lee [docs/seguridad.md](docs/seguridad.md).

## Índice

0. [Cuentas que necesitas](#0-cuentas-que-necesitas)
1. [Instalar las herramientas](#1-instalar-las-herramientas)
2. [Descargar el proyecto y crear `.env`](#2-descargar-el-proyecto-y-crear-env)
3. [ngrok: una dirección pública](#3-ngrok-una-dirección-pública)
4. [Levantar el sistema](#4-levantar-el-sistema)
5. [Kapso: conectar WhatsApp](#5-kapso-conectar-whatsapp)
6. [Google Calendar](#6-google-calendar)
7. [Gemini: la IA](#7-gemini-la-ia)
8. [Credenciales en n8n](#8-credenciales-en-n8n)
9. [Importar y configurar el workflow](#9-importar-y-configurar-el-workflow)
10. [Probar](#10-probar)
11. [Uso diario](#11-uso-diario)
12. [Opcional: Claude con Kapso y n8n (MCP)](#12-opcional-claude-con-kapso-y-n8n-mcp)
13. [Opcional: el CRM (Eli Panel)](#13-opcional-el-crm-eli-panel)
14. [Errores frecuentes](#errores-frecuentes)

---

## 0. Cuentas que necesitas

| Servicio | Para qué | Enlace |
|---|---|---|
| Docker Desktop | Correr todo el sistema | https://www.docker.com/products/docker-desktop/ |
| GitHub | Descargar este repositorio | https://github.com |
| ngrok (gratis) | Dirección pública HTTPS hacia tu computador | https://dashboard.ngrok.com/signup |
| Kapso | Puente con la API de WhatsApp de Meta | https://app.kapso.ai |
| Meta Business | El número de WhatsApp Business | https://business.facebook.com |
| Google Cloud | Credencial OAuth para Google Calendar | https://console.cloud.google.com |
| Google AI Studio | API key de Gemini (tiene nivel gratuito) | https://aistudio.google.com/apikey |

---

## 1. Instalar las herramientas

### macOS

1. Instala Docker Desktop para tu chip (Apple M o Intel: menú  → *Acerca de esta Mac*).
2. Ábrelo (`open -a Docker`) y espera a que la ballena de la barra superior quede quieta.
3. Recomendado: Docker Desktop → *Settings → General* → **Start Docker Desktop when you sign in**.
4. Con [Homebrew](https://brew.sh): `brew install git jq ngrok`.

### Windows

Guía completa para Windows: [docs/instalacion-windows.md](docs/instalacion-windows.md). Resumen:

1. En PowerShell como administrador: `wsl --install`, y reinicia.
2. Instala Docker Desktop con la opción **Use WSL 2**.
3. Abre una terminal de Ubuntu (WSL) y sigue la guía desde ahí: los scripts del proyecto usan bash.
   Dentro de WSL: `sudo apt install git jq openssl`, e instala ngrok desde su página.

### Verificar

```bash
docker --version
docker compose version
docker run --rm hello-world     # debe decir "Hello from Docker!"
```

---

## 2. Descargar el proyecto y crear `.env`

```bash
cd ~
git clone https://github.com/davidethc/agentWhatsap.git
cd agentWhatsap
scripts/init-env.sh
```

`scripts/init-env.sh` crea `.env` con contraseñas aleatorias para PostgreSQL, Redis y los runners, y
una **clave de cifrado de n8n**. Guarda una copia de `N8N_ENCRYPTION_KEY` en un gestor de contraseñas:
sin ella no se pueden recuperar las credenciales de un respaldo.

> ⚠️ Todos los comandos se ejecutan **dentro de la carpeta `agentWhatsap`**. En zsh, no pegues
> comentarios `#` junto a los comandos.

---

## 3. ngrok: una dirección pública

Kapso y Google están en internet y no pueden llegar a `localhost`. ngrok crea un túnel
`https://tu-dominio.ngrok-free.dev → tu computador:5678`.

1. Copia tu authtoken del [dashboard de ngrok](https://dashboard.ngrok.com/get-started/your-authtoken) y ejecuta:
   ```bash
   ngrok config add-authtoken TU_TOKEN
   ```
2. Dashboard → *Domains* → reclama tu **dominio fijo gratuito** (así la dirección no cambia).
3. Abre el túnel en una terminal aparte, **que debe quedar abierta**:
   ```bash
   ngrok http --url=TU-DOMINIO.ngrok-free.dev 5678
   ```
4. Edita `.env` (`open -e .env` en Mac, `nano .env` en Linux) con tu dominio:
   ```env
   N8N_HOST=TU-DOMINIO.ngrok-free.dev
   N8N_PROTOCOL=https
   WEBHOOK_URL=https://TU-DOMINIO.ngrok-free.dev/
   ```

Panel de ngrok con cada petición que llega: http://127.0.0.1:4040

---

## 4. Levantar el sistema

```bash
docker compose up -d
```

Se levantan 6 servicios: `postgres`, `redis`, `n8n`, `n8n-worker`, `n8n-runner` y
`n8n-worker-runner` (ver [docs/arquitectura.md](docs/arquitectura.md)). La primera vez descarga las
imágenes y n8n instala el nodo de Kapso, así que tarda unos minutos. Comprueba:

```bash
scripts/check.sh
```

Todo debe salir `OK`. Después abre **`https://TU-DOMINIO.ngrok-free.dev`**, pulsa *Visit Site* si ngrok
lo pide, y crea tu cuenta **owner** de n8n con una contraseña fuerte (el editor es accesible desde
internet).

> Entra a n8n siempre por la dirección de ngrok, no por `localhost`: si conectas Google desde
> `localhost`, falla con `Error: Unauthorized`.

---

## 5. Kapso: conectar WhatsApp

1. Crea una cuenta en https://app.kapso.ai y un proyecto.
2. *Phone numbers* → conecta tu número de WhatsApp Business. Anota su **Phone Number ID**: también
   aparece en Meta → WhatsApp Manager → Números de teléfono.
3. *Integrar → claves API* → crea una **API key**. La usarás en el paso 8.
4. El webhook (Kapso → n8n) se configura en el paso 9, cuando el workflow ya esté importado.

---

## 6. Google Calendar

> Haz todo **dentro del mismo proyecto de Google Cloud** (el nombre aparece arriba a la izquierda).

1. https://console.cloud.google.com → crea un proyecto (por ejemplo, `sofi`).
2. *APIs y servicios → Biblioteca* → **Google Calendar API** → **Habilitar**.
3. *Pantalla de consentimiento*:
   - Nombre de la aplicación y correos: los tuyos. Deja vacíos el logo y los dominios (un logo obliga a
     verificar la app; las casillas de dominio vacías dan «No se permiten dominios duplicados»).
   - *Público → Usuarios de prueba* → agrega tu Gmail.
   - Opcional: **Publicar app**. En modo prueba, el acceso caduca cada 7 días.
4. *Clientes → Crear cliente → ID de cliente de OAuth*:

   | Campo | Valor |
   |---|---|
   | Tipo | Aplicación web |
   | Orígenes de JavaScript | `https://TU-DOMINIO.ngrok-free.dev` (sin `/` final) |
   | URI de redirección | `https://TU-DOMINIO.ngrok-free.dev/rest/oauth2-credential/callback` |

   Copia la URI de redirección **exactamente** como la muestra n8n (paso 8). Guarda el **ID de cliente**
   y el **secreto**: el secreto se muestra una sola vez.

---

## 7. Gemini: la IA

1. https://aistudio.google.com/apikey → **Create API key** y cópiala.
2. El modelo debe admitir herramientas (*tools*), porque el agente consulta el calendario. Eli usa
   `models/gemini-3.5-flash-lite`. Si Google lo retira, elige otro modelo *Flash* de la lista del nodo.

---

## 8. Credenciales en n8n

En n8n: **Overview → Credentials → Create credential**. Los nombres importan: el workflow las busca por
nombre.

| Nombre exacto | Tipo | Datos |
|---|---|---|
| `Kapso account` | Kapso API | La API key del paso 5 |
| `Google Gemini(PaLM) Api account` | Google Gemini (PaLM) API | La API key del paso 7 |
| `Google Calendar account` | Google Calendar OAuth2 API | ID y secreto del paso 6 → **Sign in with Google** → debe decir *Account connected* |
| `Redis local` | Redis | Host `redis`, puerto `6379`, password = `REDIS_PASSWORD` de tu `.env` (`grep REDIS_PASSWORD .env`), Database Number `1`, User vacío, SSL apagado |

Si Google dice «Google no verificó esta app»: *Configuración avanzada → Ir a … (no seguro)*.

---

## 9. Importar y configurar el workflow

1. n8n → **Create workflow** → menú **⋯** → **Import from File** →
   [`workflows/eli-version4.json`](workflows/eli-version4.json).
2. Configura estos nodos:

   | Nodo | Qué cambiar |
   |---|---|
   | **Normalizar mensaje** | En el código, `TU_PHONE_NUMBER_ID` → el Phone Number ID de tu número (paso 5). Solo se atienden mensajes de ese número |
   | **buscar_mis_citas, mover_cita, cancelar_cita, Leer Google Calendar, Crear evento** | Calendar: elígelo **de la lista** (no en modo ID ni con `primary`) |
   | **Validar pedido** | `HORARIO` (bloques por día, por ejemplo `lunes: [[9, 13], [15, 19]]`; día sin bloques = cerrado) y `SERVICIOS` (precio `null` si no se publica) |
   | **Agente version4** | En el *system message*: nombre del consultorio y de la doctora, servicios, precios, horario, dirección y estilo (hoy son datos provisionales) |
   | Nodos con credencial | Si alguno marca credencial en rojo, elige la del paso 8 |

3. Pulsa **Save** y luego **Publish**.
4. Abre **Webhook Kapso** y copia la **Production URL** (`https://TU-DOMINIO.ngrok-free.dev/webhook/...`).
5. En Kapso → *Integrar → Webhooks* → tu número → **Agregar webhook**:

   | Campo | Valor |
   |---|---|
   | Tipo | Kapso events |
   | Endpoint URL | La Production URL (`/webhook/...`, no `/webhook-test/...`) |
   | Evento | Message received (`whatsapp.message.received`) |
   | Búfer (debounce) | Activado, 5 s, máximo 50 mensajes |
   | Versión | v2 |
   | Estado | Activo |

---

## 10. Probar

1. **Autotests sin efectos externos:** importa `workflows/pruebas/queue-selftest.json` y
   `redis-selftest.json` (en el segundo, elige la credencial `Redis local`), publícalos y abre:
   - `https://TU-DOMINIO.ngrok-free.dev/webhook/queue-selftest-7f3a9c` → `{"ok":true,"sum":6,...}`
   - `https://TU-DOMINIO.ngrok-free.dev/webhook/redis-selftest-4b8e2d` → `{"valor":"ok-local"}`

   Después desactívalos.
2. **Desde tu propio teléfono**, escribe al número, un mensaje a la vez: `hola`, `cuánto cuesta una
   limpieza?`, `quiero una limpieza mañana a las 10`, `sí, confirmo`. Para probar la urgencia:
   `me duele mucho una muela`.
3. Cada respuesta tarda de 5 a 20 segundos (5 s del búfer de Kapso más la IA).
4. En n8n, pestaña **Executions**: verde está bien; en rojo, abre la ejecución y mira el nodo que falló.
5. En Google Calendar debe aparecer `🦷 <Servicio> - <Nombre>`, con el teléfono en la descripción.

---

## 11. Uso diario

```bash
open -a Docker
cd ~/agentWhatsap
docker compose up -d
ngrok http --url=TU-DOMINIO.ngrok-free.dev 5678     # en otra terminal, abierta
scripts/check.sh
```

| Acción | Comando |
|---|---|
| Apagar (conserva los datos) | `docker compose stop` |
| Estado | `docker compose ps` o `scripts/check.sh` |
| Logs | `docker compose logs -f n8n n8n-worker` |
| Respaldo completo | `scripts/backup.sh` |
| Exportar un workflow al repositorio | `scripts/export-workflow.sh <ID> workflows/<archivo>.json` |

> ⚠️ **Nunca** `docker compose down -v`: borra workflows, credenciales y la base de datos.

Más procedimientos (publicar por CLI, restaurar, cambiar de URL, migrar) en
[docs/operacion.md](docs/operacion.md).

> Para atender 24/7 sin depender de tu computador, el sistema debe correr en un servidor siempre
> encendido.

---

## 12. Opcional: Claude con Kapso y n8n (MCP)

- **Kapso en Claude Code:** `claude mcp add --transport http kapso https://api.kapso.ai/mcp`, luego
  `/mcp` → *kapso* → *Authenticate*. Permite consultar números, conversaciones, plantillas, webhooks y
  logs. Su herramienta `whatsapp_messages` envía mensajes **reales**: úsala con cuidado.
- **n8n en Claude:** n8n → *Settings → Instance-level MCP* → **Enable MCP access**. En cada workflow,
  activa *⋯ → Settings → Available in MCP*. En Claude, agrega el conector con la URL
  `https://TU-DOMINIO.ngrok-free.dev/mcp-server/http`.

---

## 13. Opcional: el CRM (Eli Panel)

El **Eli Panel** es el panel de la doctora (resumen del día, tablero de pacientes, fichas y citas). Es una
parte aparte de Eli: se instala con Supabase y la carpeta `crm/`, no con los pasos de arriba, y **Eli responde
igual si el panel no está**.

- Cómo se usa: [docs/crm/guia-doctora.md](docs/crm/guia-doctora.md).
- Cómo levantarlo, cambiar la base, sacar copias y qué hacer si cae: [docs/crm/operacion.md](docs/crm/operacion.md).
- Cómo Eli le avisa (sin enviarle el texto de los mensajes): [docs/crm/eli-crm.md](docs/crm/eli-crm.md).
- Pendiente: la sincronización con **Google Calendar** del panel (la de arriba, sección 6, es la de Eli).

---

## Errores frecuentes

| Error | Causa | Solución |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop cerrado | `open -a Docker` y espera |
| `no configuration file provided` | No estás en la carpeta del proyecto | `cd ~/agentWhatsap` |
| `env file .../.env not found` | Falta `.env` | `scripts/init-env.sh` |
| `cp: .env is not a directory` | Pegaste un comentario `#` en zsh | Ejecuta el comando sin el comentario |
| `scripts/check.sh` marca un servicio en FALLA | El servicio no arrancó | `docker compose logs <servicio>` |
| Kapso: `Failed to open TCP connection to localhost:5678` | El webhook apunta a `localhost` | Usa la URL de ngrok |
| Kapso no entrega mensajes | Túnel cerrado, workflow sin publicar o URL `/webhook-test/` | ngrok abierto, workflow **Published**, URL `/webhook/` |
| Google: `redirect_uri_mismatch` | La URI de redirección no coincide | Cópiala exacta desde la credencial de n8n |
| Google: `Error: Unauthorized` | Entraste a n8n por `localhost` | Entra por la URL de ngrok y repite |
| Google: «No se permiten dominios duplicados» | Casillas de dominio vacías | Bórralas |
| Client ID distinto al de n8n | Clientes creados en dos proyectos | Usa el ID y el secreto del **mismo** proyecto |
| `Missing or invalid required parameters: calendar` | Calendar en modo ID con `primary` | Elige el calendario **de la lista** |
| Gemini: `404 model ... is no longer available` | El modelo fue retirado | Elige otro modelo *Flash* en el nodo **Gemini** |
| El bot dice «cita agendada» pero no aparece | La herramienta falló | Revisa **Executions**; el prompt prohíbe confirmar sin `reservada=true` |
| Evento con zona horaria incorrecta | `GENERIC_TIMEZONE` distinta | Corrígela en `.env` y `docker compose up -d` |
| El bot no responde nada | ngrok cerrado, workflow sin publicar o `TU_PHONE_NUMBER_ID` sin cambiar | Revisa los tres y **Executions** |

Problemas internos (worker, runners, base de datos, Mac suspendido) en
[docs/operacion.md](docs/operacion.md#problemas-conocidos).
