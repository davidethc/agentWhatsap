# Instalación en Windows 10/11, paso a paso

Esta guía lleva a Eli desde cero hasta que responde por WhatsApp, en un computador con **Windows 10
u 11**. Es la versión para Windows de la [GUIA.md](../GUIA.md), que está escrita para macOS.

```
Paciente en WhatsApp → Meta → Kapso → ngrok → n8n (Docker Desktop en tu Windows)
                                                │  cola en Redis → worker
                         Gemini (IA) + memoria en Redis + Google Calendar
                                                │
                                n8n → Kapso → respuesta por WhatsApp
```

Tiempo estimado: 2 a 3 horas la primera vez. Lo más lento es instalar WSL y Docker, y configurar
Google Cloud.

> **Nunca subas claves a GitHub.** Las API keys van en las credenciales de n8n y los secretos del
> sistema en `.env`, que Git ignora. Lee [seguridad.md](seguridad.md).

## Índice

1. [Cuentas que necesitas](#1-cuentas-que-necesitas)
2. [Instalar las herramientas en Windows](#2-instalar-las-herramientas-en-windows)
3. [Descargar el proyecto y crear `.env`](#3-descargar-el-proyecto-y-crear-env)
4. [ngrok y la dirección pública](#4-ngrok-y-la-dirección-pública)
5. [Levantar el sistema](#5-levantar-el-sistema)
6. [Kapso: conectar WhatsApp](#6-kapso-conectar-whatsapp)
7. [Google Calendar y Gemini](#7-google-calendar-y-gemini)
8. [Credenciales en n8n](#8-credenciales-en-n8n)
9. [Importar y configurar el workflow](#9-importar-y-configurar-el-workflow)
10. [Probar](#10-probar)
11. [Uso diario en Windows](#11-uso-diario-en-windows)
12. [Errores frecuentes en Windows](#12-errores-frecuentes-en-windows)

### Dos terminales distintas

En esta guía usarás dos tipos de terminal. Fíjate siempre en cuál se indica:

| Terminal | Cómo se abre | Se reconoce por |
|---|---|---|
| **PowerShell** (Windows) | Menú Inicio → escribe `PowerShell` | La línea empieza con `PS C:\...>` |
| **Ubuntu** (WSL, Linux) | Menú Inicio → escribe `Ubuntu` | La línea termina en `$`, por ejemplo `usuario@PC:~$` |

Casi todo se hace en **Ubuntu**. PowerShell solo se usa para instalar WSL y para algunas
comprobaciones.

> Para pegar en la terminal de Ubuntu: clic derecho o `Ctrl+Shift+V`. Para copiar: selecciona el
> texto y `Ctrl+Shift+C`. Pega los comandos **sin** los comentarios que empiezan con `#`.

---

## 1. Cuentas que necesitas

Crea estas cuentas antes de empezar. Todas tienen un plan gratuito o de prueba, salvo los costos de
mensajes de Meta (ver [paso 6](#6-kapso-conectar-whatsapp)).

| Servicio | Para qué | Enlace |
|---|---|---|
| GitHub | Descargar este repositorio | https://github.com |
| Docker | Iniciar sesión en Docker Desktop (opcional, pero recomendado) | https://app.docker.com/signup |
| ngrok (gratis) | Dirección pública HTTPS hacia tu computador | https://dashboard.ngrok.com/signup |
| Kapso | Puente con la API de WhatsApp de Meta | https://app.kapso.ai |
| Meta Business | El número de WhatsApp Business | https://business.facebook.com |
| Google Cloud | Credencial OAuth para Google Calendar | https://console.cloud.google.com |
| Google AI Studio | API key de Gemini (tiene nivel gratuito) | https://aistudio.google.com/apikey |

Usa la **misma cuenta de Google** para Google Cloud, Google AI Studio y el calendario de la clínica.
Así evitas errores de permisos.

---

## 2. Instalar las herramientas en Windows

### ¿Por qué WSL?

Los scripts del proyecto (`scripts/init-env.sh`, `scripts/check.sh`, `scripts/backup.sh` y
`scripts/export-workflow.sh`) están escritos en **bash**, el lenguaje de terminal de Linux. Windows no
los ejecuta por sí solo. **WSL 2** (Windows Subsystem for Linux) instala un Ubuntu real dentro de
Windows. Ahí corren los scripts, y Docker Desktop usa ese mismo WSL 2 como motor.

### 2.1 Comprobar la virtualización

WSL 2 y Docker necesitan la virtualización del procesador activada.

1. Abre el **Administrador de tareas** (`Ctrl+Shift+Esc`).
2. Pestaña **Rendimiento** → **CPU**.
3. Abajo a la derecha debe decir **Virtualización: Habilitado**.

Si dice *Deshabilitado*, actívala en la BIOS/UEFI de tu computador (ver
[errores frecuentes](#12-errores-frecuentes-en-windows)).

### 2.2 Instalar WSL 2 y Ubuntu

1. Menú Inicio → escribe `PowerShell` → clic derecho → **Ejecutar como administrador**.
2. Ejecuta:
   ```powershell
   wsl --install
   ```
   Instala WSL 2 y Ubuntu.
3. **Reinicia** el computador cuando termine.
4. Al volver, se abre una ventana de Ubuntu (si no, búscala en el menú Inicio como `Ubuntu`). Espera a
   que termine y crea tu **usuario y contraseña de Linux**. Pueden ser distintos de los de Windows.
   La contraseña no se ve mientras la escribes: es normal. Anótala, la pedirá `sudo`.
5. En PowerShell, comprueba que Ubuntu usa la versión 2:
   ```powershell
   wsl -l -v
   ```
   En la columna `VERSION` debe decir `2`. Si dice `1`: `wsl --set-version Ubuntu 2`.

### 2.3 Instalar Docker Desktop

1. Descarga **Docker Desktop for Windows** desde https://www.docker.com/products/docker-desktop/.
2. Ejecuta el instalador. Cuando pregunte, deja marcada la opción **Use WSL 2 instead of Hyper-V**
   (el texto exacto puede variar según la versión).
3. Reinicia si te lo pide y abre **Docker Desktop**. Acepta los términos e inicia sesión con tu cuenta
   de Docker (o sáltalo).
4. Espera a que abajo a la izquierda diga **Engine running** (motor en marcha).
5. Configura Docker Desktop (icono de engranaje ⚙ arriba a la derecha → **Settings**):

   | Sección | Opción | Valor |
   |---|---|---|
   | General | **Use the WSL 2 based engine** | Activado |
   | General | **Start Docker Desktop when you sign in to your computer** | Activado (recomendado) |
   | Resources → **WSL integration** | **Enable integration with my default WSL distro** | Activado |
   | Resources → **WSL integration** | Interruptor de **Ubuntu** | Activado |

   Pulsa **Apply & restart**. Los nombres de las opciones pueden variar un poco entre versiones.

> La integración con WSL es lo que hace que el comando `docker` funcione dentro de Ubuntu. **No**
> instales Docker dentro de Ubuntu con `apt`: usa siempre el de Docker Desktop.

### 2.4 Instalar Git for Windows (recomendado)

El proyecto se descarga con el `git` de Ubuntu, pero Git for Windows es útil si después abres el
proyecto con un editor de Windows (por ejemplo, VS Code).

1. Descárgalo de https://git-scm.com/download/win y ejecuta el instalador.
2. En la pantalla de **finales de línea** (*Configuring the line ending conversions*), elige
   **Checkout as-is, commit Unix-style line endings**.
3. Deja el resto de opciones por defecto.
4. En PowerShell, refuerza la misma regla:
   ```powershell
   git config --global core.autocrlf input
   ```

Esto evita que Windows convierta los finales de línea de los scripts a formato Windows (CRLF), que
rompe bash (ver [errores frecuentes](#12-errores-frecuentes-en-windows)).

### 2.5 Instalar las herramientas dentro de Ubuntu

Abre **Ubuntu** y ejecuta, una línea a la vez:

```bash
sudo apt update
sudo apt install -y git jq openssl curl
git config --global core.autocrlf input
```

| Herramienta | Para qué |
|---|---|
| `git` | Descargar el proyecto |
| `jq` | Lo usan `scripts/check.sh` y `scripts/export-workflow.sh` |
| `openssl` | Lo usa `scripts/init-env.sh` para generar contraseñas |
| `curl` | Lo usa `scripts/check.sh` para revisar n8n y ngrok |

### 2.6 Instalar ngrok dentro de Ubuntu

**Recomendación de esta guía: ejecuta ngrok dentro de Ubuntu (WSL)**, no en PowerShell. El motivo:
`scripts/check.sh` revisa el túnel consultando el panel local de ngrok en `127.0.0.1:4040`. Desde
Ubuntu, ese panel solo se ve si ngrok corre también en Ubuntu.

En **Ubuntu**:

```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com bookworm main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update
sudo apt install -y ngrok
```

Si alguno de estos comandos falla, copia los de la página de descarga de ngrok
(https://ngrok.com/download, pestaña **Linux** → *Apt*), porque ngrok puede cambiarlos.

Después, copia tu authtoken del
[dashboard de ngrok](https://dashboard.ngrok.com/get-started/your-authtoken) y ejecuta:

```bash
ngrok config add-authtoken TU_TOKEN
```

> **Alternativa: ngrok para Windows.** También funciona. Descárgalo de https://ngrok.com/download
> (pestaña Windows), descomprime `ngrok.exe` y en PowerShell, en esa carpeta, ejecuta
> `.\ngrok.exe config add-authtoken TU_TOKEN`. Docker Desktop publica n8n en `127.0.0.1:5678` **también
> en Windows**, así que el túnel llega a n8n igual. La diferencia: `scripts/check.sh` mostrará
> `FALLA ngrok no está activo` en la sección *Túnel*, porque desde Ubuntu no ve el ngrok de Windows.
> En ese caso revisa el túnel abriendo http://127.0.0.1:4040 en el navegador. No uses los dos a la
> vez: elige uno.

### 2.7 Verificar

En **Ubuntu**:

```bash
docker --version
docker compose version
docker run --rm hello-world
ngrok version
jq --version
```

`docker run --rm hello-world` debe mostrar `Hello from Docker!`. Si `docker` no se encuentra, revisa la
integración con WSL (paso 2.3).

---

## 3. Descargar el proyecto y crear `.env`

### ¿Dónde guardar el proyecto?

Guárdalo **dentro de Ubuntu**, en `~/agentWhatsap` (es decir, `/home/<tu-usuario>/agentWhatsap`).
**No** lo guardes en `/mnt/c/...` (la unidad `C:` de Windows vista desde Ubuntu):

- **Rendimiento:** leer archivos de `C:` desde WSL es mucho más lento.
- **Permisos:** en `/mnt/c` los permisos de Linux no funcionan bien. `scripts/init-env.sh` deja `.env`
  con permisos 600 y `scripts/backup.sh` protege los respaldos con 700; en `/mnt/c` eso no se cumple.
- **Finales de línea:** las herramientas de Windows pueden convertir los scripts a CRLF y romperlos.

### Pasos

En **Ubuntu**:

```bash
cd ~
git clone https://github.com/davidethc/agentWhatsap.git
cd agentWhatsap
scripts/init-env.sh
```

`scripts/init-env.sh` crea `.env` con contraseñas aleatorias para PostgreSQL, Redis y los runners, y
una **clave de cifrado de n8n**.

Guarda una copia de `N8N_ENCRYPTION_KEY` en un gestor de contraseñas. Para verla:

```bash
grep N8N_ENCRYPTION_KEY .env
```

Sin esa clave no se pueden recuperar las credenciales de un respaldo. No la pegues en chats ni en
capturas.

> ⚠️ Todos los comandos siguientes se ejecutan **dentro de la carpeta `~/agentWhatsap`** en Ubuntu.
> Si abres una terminal nueva, empieza con `cd ~/agentWhatsap`.

---

## 4. ngrok y la dirección pública

Kapso y Google están en internet y no pueden llegar a `localhost`. ngrok crea un túnel
`https://TU-DOMINIO.ngrok-free.dev → tu computador:5678`.

### 4.1 Reclamar el dominio fijo gratuito

1. Entra al [dashboard de ngrok](https://dashboard.ngrok.com).
2. Menú lateral → **Domains** (puede aparecer dentro de *Universal Gateway*; el nombre del menú puede
   variar).
3. Reclama tu **dominio gratuito** (por ejemplo, `TU-DOMINIO.ngrok-free.dev`). Así la dirección no
   cambia cada vez que enciendes ngrok.

### 4.2 Editar `.env`

**Opción A, en Ubuntu con `nano` (recomendada):**

```bash
nano .env
```

Cambia estas tres líneas con tu dominio:

```env
N8N_HOST=TU-DOMINIO.ngrok-free.dev
N8N_PROTOCOL=https
WEBHOOK_URL=https://TU-DOMINIO.ngrok-free.dev/
```

- `N8N_HOST`: solo el dominio, sin `https://` y sin `/`.
- `WEBHOOK_URL`: con `https://` y **con `/` al final**.

Para guardar en `nano`: `Ctrl+O`, `Enter`. Para salir: `Ctrl+X`.

**Opción B, desde Windows:**

1. En el Explorador de archivos, escribe en la barra de direcciones:
   `\\wsl$\Ubuntu\home\<tu-usuario>\agentWhatsap`
   (en Windows 11 también funciona `\\wsl.localhost\Ubuntu\home\<tu-usuario>\agentWhatsap`).
   Atajo: en Ubuntu, dentro de la carpeta, ejecuta `explorer.exe .`
2. Abre `.env` con un editor que respete los finales de línea Unix (LF), como VS Code o el Bloc de
   notas de Windows 10/11 reciente. En VS Code, abajo a la derecha debe decir **LF**, no **CRLF**.
3. Haz los mismos cambios y guarda.

> Si después de editar desde Windows los scripts fallan con errores raros, `.env` quedó con CRLF.
> Arréglalo en Ubuntu con `sed -i 's/\r$//' .env`.

### 4.3 Abrir el túnel

Abre una **segunda pestaña de Ubuntu** (en Windows Terminal, el botón **+** o la flecha **⌄** →
*Ubuntu*). Ejecuta, con tu dominio:

```bash
ngrok http --url=TU-DOMINIO.ngrok-free.dev 5678
```

**Esa pestaña debe quedar abierta** mientras quieras que Eli responda. Si la cierras, se corta el
túnel.

Panel de ngrok con cada petición que llega: http://127.0.0.1:4040 (se abre también desde el navegador
de Windows).

---

## 5. Levantar el sistema

1. Comprueba que Docker Desktop esté abierto y diga **Engine running**.
2. En la primera pestaña de **Ubuntu**:
   ```bash
   cd ~/agentWhatsap
   docker compose up -d
   ```
   Se levantan 6 servicios: `postgres`, `redis`, `n8n`, `n8n-worker`, `n8n-runner` y
   `n8n-worker-runner` (ver [arquitectura.md](arquitectura.md)). La primera vez descarga las imágenes
   y n8n instala el nodo de Kapso, así que tarda unos minutos.
3. Comprueba:
   ```bash
   scripts/check.sh
   ```
   Todo debe salir `OK`. Si algo sale en `FALLA` justo después de arrancar, espera 1 o 2 minutos y
   repite: n8n tarda en terminar de instalar Kapso.
4. En el navegador de Windows, abre **`https://TU-DOMINIO.ngrok-free.dev`**. Si ngrok muestra un aviso,
   pulsa **Visit Site**.
5. Crea tu cuenta **owner** de n8n con un correo y una **contraseña fuerte**: el editor es accesible
   desde internet.

> Entra a n8n siempre por la dirección de ngrok, no por `localhost`: si conectas Google desde
> `localhost`, falla con `Error: Unauthorized`.

---

## 6. Kapso: conectar WhatsApp

Kapso conecta tu número de WhatsApp Business (de Meta) con n8n. La interfaz de Kapso cambia con
frecuencia: si un menú no tiene exactamente el nombre indicado, busca uno parecido.

### 6.1 Cuenta y proyecto

1. Entra a https://app.kapso.ai y crea tu cuenta.
2. Crea un **proyecto** (por ejemplo, `elidental`).

### 6.2 Conectar un número

1. En el proyecto, ve a la sección de números (**Phone numbers** / *Números*).
2. Conecta tu número de **WhatsApp Business**. Kapso abre el asistente de Meta: inicia sesión con
   Facebook, elige o crea tu cuenta de **Meta Business** y verifica el número con el código que llega
   por SMS o llamada.
   - El número **no** puede estar en uso en la app de WhatsApp normal ni en WhatsApp Business del
     teléfono al mismo tiempo. Si lo está, primero hay que eliminar esa cuenta en el teléfono.
   - Para pruebas, Kapso puede ofrecer un número propio o de prueba. Las opciones dependen de tu plan.
3. Anota el **Phone Number ID** del número. Aparece en el detalle del número en Kapso, y también en
   Meta → **WhatsApp Manager** → **Números de teléfono**. Es un número largo, distinto del teléfono.
   Lo usarás en el [paso 9](#9-importar-y-configurar-el-workflow) como `TU_PHONE_NUMBER_ID`.

### 6.3 Cobros de mensajes (Meta) y créditos de Kapso

- Desde el **1 de octubre de 2026**, Meta cobra por cada mensaje enviado, también las respuestas
  dentro de la ventana de 24 horas (ver [elidental.md, Costos](elidental.md#costos)).
- Al conectar el número, Kapso pregunta cómo se pagan esos mensajes. En general hay dos modos:
  - **Créditos de Kapso:** recargas saldo en Kapso y Kapso paga a Meta por ti.
  - **Tarjeta propia en Meta:** agregas un método de pago en Meta Business (WhatsApp Manager) y Meta
    te cobra directamente.
- **Elige con cuidado: el modo de cobro es difícil de cambiar después.** Si es para un cliente,
  decide con él quién paga antes de conectar el número.
- Sin saldo o sin método de pago, los mensajes no salen aunque n8n funcione bien.

### 6.4 API key

1. En Kapso, ve a **Integrate → API keys** (en español, *Integrar → Claves API*).
2. Crea una **API key** y cópiala. Se muestra una sola vez.
3. Guárdala en tu gestor de contraseñas. La usarás en el [paso 8](#8-credenciales-en-n8n).

### 6.5 Webhook

El webhook (Kapso → n8n) se configura en el [paso 9](#9-importar-y-configurar-el-workflow), cuando el
workflow ya esté importado y publicado.

### 6.6 Opcional: Kapso en Claude Code (MCP)

Si usas Claude Code, puedes consultar Kapso desde ahí:

```bash
claude mcp add --transport http kapso https://api.kapso.ai/mcp
```

Luego, en Claude Code: `/mcp` → *kapso* → *Authenticate*. Su herramienta `whatsapp_messages` envía
mensajes **reales**: úsala con cuidado. Más detalles en la
[GUIA, paso 12](../GUIA.md#12-opcional-claude-con-kapso-y-n8n-mcp).

---

## 7. Google Calendar y Gemini

### 7.1 Google Calendar (OAuth)

> Haz todo **dentro del mismo proyecto de Google Cloud**. El nombre del proyecto aparece arriba a la
> izquierda de la consola: revísalo antes de cada paso.

1. Abre https://console.cloud.google.com → selector de proyectos (arriba a la izquierda) →
   **Proyecto nuevo** → nombre, por ejemplo `eli` → **Crear**. Selecciónalo.
2. Menú ☰ → **APIs y servicios → Biblioteca** → busca **Google Calendar API** → **Habilitar**.
3. Menú ☰ → **APIs y servicios → Pantalla de consentimiento de OAuth** (en la consola nueva se llama
   *Google Auth Platform*; el nombre puede variar):
   - Nombre de la aplicación y correos: los tuyos. Deja vacíos el logo y los dominios. Un logo obliga
     a verificar la app; las casillas de dominio vacías pero agregadas dan «No se permiten dominios
     duplicados».
   - Tipo de usuario / público: **Externo**.
   - **Público → Usuarios de prueba** → agrega el Gmail dueño del calendario.
   - Opcional: **Publicar app**. En modo prueba, el acceso caduca cada 7 días y hay que volver a
     conectar la credencial.
4. **Clientes → Crear cliente → ID de cliente de OAuth**:

   | Campo | Valor |
   |---|---|
   | Tipo | **Aplicación web** |
   | Orígenes de JavaScript autorizados | `https://TU-DOMINIO.ngrok-free.dev` (sin `/` final) |
   | URI de redirección autorizados | `https://TU-DOMINIO.ngrok-free.dev/rest/oauth2-credential/callback` |

   Lo más seguro es copiar la URI de redirección **exactamente** como la muestra n8n: en el
   [paso 8](#8-credenciales-en-n8n), al crear la credencial `Google Calendar account`, n8n muestra el
   campo *OAuth Redirect URL*. Puedes dejar esta pestaña abierta, ir a n8n, copiarla y volver.
5. Pulsa **Crear**. Guarda el **ID de cliente** y el **secreto del cliente**: el secreto puede
   mostrarse una sola vez.

### 7.2 Gemini (la IA)

1. Abre https://aistudio.google.com/apikey → **Create API key**. Si te lo pide, elige el mismo
   proyecto de Google Cloud. Copia la clave.
2. El modelo está definido en el nodo **Gemini** del workflow (hoy `models/gemini-3.5-flash-lite`).
   Debe admitir herramientas (*tools*): el agente las necesita para consultar el calendario. Si Google
   lo retira, elige otro modelo *Flash* en ese nodo.
3. **Límite del nivel gratuito:** para este modelo es de alrededor de **20 solicitudes por día**.
   Cada mensaje de un paciente puede gastar varias solicitudes (el agente llama al modelo otra vez
   después de cada herramienta). Alcanza para probar, no para atender pacientes. Para uso real,
   **activa la facturación** en AI Studio (el nombre puede variar: *Set up billing* / *Configurar
   facturación*). Revisa tus límites actuales en AI Studio, porque Google los cambia.

---

## 8. Credenciales en n8n

En n8n (por la URL de ngrok): **Overview → Credentials → Create credential** (o el botón **+** →
*Credential*). Busca el tipo, completa los datos y, antes de guardar, **cambia el nombre** de la
credencial (arriba, al lado del icono) al nombre exacto de la tabla. Los nombres importan: el
workflow las busca por nombre.

| Nombre exacto | Tipo | Datos |
|---|---|---|
| `Kapso account` | Kapso API | La API key del [paso 6.4](#64-api-key) |
| `Google Gemini(PaLM) Api account` | Google Gemini (PaLM) API | La API key del [paso 7.2](#72-gemini-la-ia) |
| `Google Calendar account` | Google Calendar OAuth2 API | ID y secreto del [paso 7.1](#71-google-calendar-oauth) → **Sign in with Google** → debe decir *Account connected* |
| `Redis local` | Redis | Ver la tabla de abajo |

Datos de `Redis local`:

| Campo | Valor |
|---|---|
| Host | `redis` |
| Port | `6379` |
| Password | El valor de `REDIS_PASSWORD` de tu `.env`. En Ubuntu: `grep REDIS_PASSWORD .env` (copia solo lo que va después del `=`) |
| Database Number | `1` |
| User | Vacío |
| SSL | Apagado |

Notas:

- Si Google dice «Google no verificó esta app»: **Configuración avanzada → Ir a … (no seguro)**. Es tu
  propia app en modo prueba.
- Si el tipo **Kapso API** no aparece, el nodo de Kapso aún no terminó de instalarse. Espera 1 minuto,
  recarga la página y revisa `scripts/check.sh` (líneas `Kapso instalado en ...`).

---

## 9. Importar y configurar el workflow

### 9.1 Importar

1. El archivo está dentro de Ubuntu. Para tenerlo a mano en Windows, en Ubuntu ejecuta:
   ```bash
   explorer.exe ~/agentWhatsap/workflows
   ```
   Se abre el Explorador en esa carpeta.
2. En n8n → **Create workflow** → menú **⋯** (arriba a la derecha) → **Import from File** → elige
   [`eli-version4.json`](../workflows/eli-version4.json).

### 9.2 Configurar los nodos

Abre cada nodo con doble clic:

| Nodo | Qué cambiar |
|---|---|
| **Normalizar mensaje** | En el código, reemplaza `TU_PHONE_NUMBER_ID` por el Phone Number ID de tu número ([paso 6.2](#62-conectar-un-número)). Deja las comillas. Solo se atienden mensajes de ese número |
| **buscar_mis_citas**, **mover_cita**, **cancelar_cita**, **Leer Google Calendar**, **Crear evento** | Campo **Calendar**: elige el modo **From list** y selecciona el calendario **de la lista**. **Nunca** uses el modo ID con `primary` |
| **Validar pedido** | Revisa `HORARIO` (bloques por día, por ejemplo `lunes: [[9, 13], [15, 19]]`; un día sin bloques = cerrado) y `SERVICIOS` (precio `null` si no se publica) |
| **Agente version4** | En el *system message*: nombre del consultorio y de la doctora, servicios, precios, horario, dirección y estilo |
| Nodos con credencial | Si alguno marca la credencial en rojo, elige la del [paso 8](#8-credenciales-en-n8n) |

Son **5 nodos de Google Calendar**: revisa los cinco. Si uno queda mal, falla solo esa acción (por
ejemplo, cancelar) y es difícil de notar.

### 9.3 Guardar y publicar

1. Pulsa **Save**.
2. Pulsa **Publish**. Sin publicar, el webhook de producción no responde.

### 9.4 Webhook de Kapso

1. Abre el nodo **Webhook Kapso** y copia la **Production URL**
   (`https://TU-DOMINIO.ngrok-free.dev/webhook/...`).
2. En Kapso → **Integrate → Webhooks** (*Integrar → Webhooks*) → elige tu número → **Add webhook**
   (*Agregar webhook*):

   | Campo | Valor |
   |---|---|
   | Tipo | **Kapso events** |
   | Endpoint URL | La Production URL (`/webhook/...`, **no** `/webhook-test/...`) |
   | Evento | **Message received** (`whatsapp.message.received`) |
   | Búfer (debounce) | Activado, **5 s**, máximo **50** mensajes |
   | Versión | **v2** |
   | Estado | **Activo** |

3. Guarda el webhook.

---

## 10. Probar

### 10.1 Autotests sin efectos externos

No envían WhatsApp ni tocan el calendario ([detalle](operacion.md#autotests-sin-efectos-externos)).

1. En n8n, importa (igual que en el paso 9.1) los dos archivos de
   [`workflows/pruebas/`](../workflows/pruebas/): `queue-selftest.json` y `redis-selftest.json`.
2. En `redis-selftest`, elige la credencial `Redis local` en los nodos de Redis.
3. Pulsa **Save** y **Publish** en cada uno.
4. Abre en el navegador:
   - `https://TU-DOMINIO.ngrok-free.dev/webhook/queue-selftest-7f3a9c` → `{"ok":true,"sum":6,...}`
   - `https://TU-DOMINIO.ngrok-free.dev/webhook/redis-selftest-4b8e2d` → `{"valor":"ok-local"}`
5. **Desactívalos** después (mientras ngrok esté encendido, son URLs públicas).

### 10.2 Desde tu teléfono

1. Desde **tu propio teléfono**, escribe al número de WhatsApp conectado, un mensaje a la vez:
   `hola`, `cuánto cuesta una limpieza?`, `quiero una limpieza mañana a las 10`, `sí, confirmo`.
   Para probar la urgencia: `me duele mucho una muela`.
2. Cada respuesta tarda de 5 a 20 segundos (5 s del búfer de Kapso más la IA).
3. En n8n, pestaña **Executions**: verde está bien. En rojo, abre la ejecución y mira el nodo que
   falló.
4. En Google Calendar debe aparecer `🦷 <Servicio> - <Nombre>`, con el teléfono en la descripción.

Si no llega nada, mira en orden: la pestaña de ngrok (¿llegó un `POST /webhook/...`?), el panel
http://127.0.0.1:4040, **Executions** en n8n y los logs de webhooks en Kapso.

---

## 11. Uso diario en Windows

### Encender

1. Abre **Docker Desktop** (si no se abre solo al iniciar sesión) y espera a **Engine running**.
2. Abre **Ubuntu**:
   ```bash
   cd ~/agentWhatsap
   docker compose up -d
   ```
3. Abre una **segunda pestaña de Ubuntu** y déjala abierta:
   ```bash
   ngrok http --url=TU-DOMINIO.ngrok-free.dev 5678
   ```
4. En la primera pestaña:
   ```bash
   scripts/check.sh
   ```
   Todo debe salir `OK`.

> Si prefieres no dejar abierta la pestaña de ngrok, puedes lanzarlo en segundo plano, como en
> [operacion.md](operacion.md#después-de-reiniciar-el-computador):
> `nohup ngrok http --url=TU-DOMINIO.ngrok-free.dev 5678 > ~/ngrok.log 2>&1 &`. Para
> detenerlo: `pkill -f "ngrok http"`. Si cierras Ubuntu por completo o ejecutas `wsl --shutdown`,
> ngrok también se detiene.

> Si Windows se suspende o se apaga, Eli deja de responder. Para que funcione mientras estés lejos,
> en **Configuración → Sistema → Inicio/apagado y suspensión** (el nombre puede variar) pon
> *Suspender* en **Nunca** cuando esté enchufado. Para 24/7 real, hace falta un servidor.

### Apagar

En Ubuntu, dentro de `~/agentWhatsap`:

```bash
docker compose stop
```

Cierra la pestaña de ngrok con `Ctrl+C`. Los datos se conservan.

> ⚠️ **Nunca** `docker compose down -v`: borra workflows, credenciales y la base de datos. Tampoco
> uses *Clean / Purge data* ni *Reset to factory defaults* en Docker Desktop
> (*Troubleshoot*): borran los volúmenes.

### Comandos útiles

| Acción | Comando (en Ubuntu, dentro de `~/agentWhatsap`) |
|---|---|
| Estado | `docker compose ps` o `scripts/check.sh` |
| Logs | `docker compose logs -f n8n n8n-worker` (salir con `Ctrl+C`) |
| Respaldo completo | `scripts/backup.sh` |
| Exportar un workflow al repositorio | `scripts/export-workflow.sh <ID> workflows/<archivo>.json` |
| Abrir la carpeta en Windows | `explorer.exe .` |

Más procedimientos (publicar por CLI, restaurar, cambiar de URL) en [operacion.md](operacion.md).

---

## 12. Errores frecuentes en Windows

| Error | Causa | Solución |
|---|---|---|
| `wsl` no se reconoce, o `wsl --install` solo muestra la ayuda | Windows sin actualizar o WSL ya instalado a medias | Actualiza Windows (Windows Update). Luego, en PowerShell como administrador: `wsl --install -d Ubuntu`. En Windows 10 necesitas la versión 2004 o superior |
| `WslRegisterDistribution failed with error: 0x80370102` o «La virtualización no está habilitada» | Virtualización apagada en la BIOS | Reinicia, entra a la BIOS/UEFI (suele ser `F2`, `F10`, `Supr` o `Esc` al encender; varía según la marca) y activa **Intel VT-x** / **Intel Virtualization Technology** o **AMD-V** / **SVM Mode**. Comprueba en Administrador de tareas → Rendimiento → CPU |
| Docker Desktop no arranca o queda en *Starting the Docker Engine...* | WSL desactualizado o atascado | En PowerShell: `wsl --update` y luego `wsl --shutdown`. Abre Docker Desktop de nuevo. Si sigue igual, reinicia Windows |
| `docker: command not found` dentro de Ubuntu | Falta la integración con WSL | Docker Desktop → Settings → Resources → **WSL integration** → activa **Ubuntu** → *Apply & restart*. Cierra y abre Ubuntu |
| `Cannot connect to the Docker daemon` | Docker Desktop cerrado | Ábrelo y espera a **Engine running** |
| `/usr/bin/env: 'bash\r': No such file or directory` o `$'\r': command not found` | Los scripts tienen finales de línea de Windows (CRLF). Pasa si se clonó con Git for Windows o en `/mnt/c` | En Ubuntu, dentro del proyecto: `sed -i 's/\r$//' scripts/*.sh .env`. Para evitarlo: `git config --global core.autocrlf input` **antes** de clonar, y clona dentro de Ubuntu (`~/agentWhatsap`) |
| `Permission denied` al ejecutar `scripts/...` | El script perdió el permiso de ejecución | `chmod +x scripts/*.sh` |
| `ports are not available` / `address already in use` en el puerto 5678 | Otro programa usa el puerto (por ejemplo, otro n8n) | En PowerShell: `netstat -ano \| findstr :5678` muestra el PID; ciérralo en el Administrador de tareas (pestaña *Detalles*). Si es otro n8n en Docker: `docker ps` y detenlo |
| ngrok no conecta, se cierra solo, o el antivirus lo bloquea o lo borra | El antivirus o el firewall bloquea ngrok | Permite ngrok en el antivirus y en el Firewall de Windows (*Permitir una aplicación a través del firewall*). En redes de empresa, ngrok puede estar bloqueado: prueba otra red |
| `check.sh`: `FALLA ngrok no está activo` aunque el túnel funciona | ngrok corre en Windows, no en Ubuntu | Normal con la alternativa de Windows ([paso 2.6](#26-instalar-ngrok-dentro-de-ubuntu)). Revisa el túnel en http://127.0.0.1:4040, o usa ngrok dentro de Ubuntu |
| `check.sh`: `ngrok usa ... pero WEBHOOK_URL es ...` | `.env` no coincide con el dominio de ngrok | Corrige `N8N_HOST` y `WEBHOOK_URL` (con `/` final) y ejecuta `docker compose up -d` |
| Los scripts dicen valores raros o fallan al leer `.env` después de editarlo en Windows | `.env` guardado con CRLF | `sed -i 's/\r$//' .env` y `docker compose up -d` |
| `no configuration file provided` | No estás en la carpeta del proyecto | `cd ~/agentWhatsap` |
| Todo va muy lento | El proyecto está en `/mnt/c/...` | Clónalo de nuevo dentro de Ubuntu (`~/agentWhatsap`). Si ya tenías datos, haz antes `scripts/backup.sh` y conserva el mismo `.env` |

Errores generales de configuración (Kapso, Google OAuth, Gemini, calendario) en la
[GUIA, errores frecuentes](../GUIA.md#errores-frecuentes). Problemas internos (worker, runners, base de
datos) en [operacion.md](operacion.md#problemas-conocidos).
