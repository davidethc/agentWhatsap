# Guía: agente de WhatsApp con n8n, Docker y Kapso

Esta guía está pensada para Windows 10/11. Docker instala n8n y el nodo comunitario de Kapso desde el proyecto. Cada persona conecta sus propias cuentas y claves.

## 1. Requisitos en Windows

1. Instala **Git for Windows** si aún no tienes `git`: https://git-scm.com/download/win
2. Instala **Docker Desktop**: https://www.docker.com/products/docker-desktop/ . Deja habilitado WSL 2 durante la instalación.
3. Si el instalador te pide WSL 2, abre PowerShell como administrador, ejecuta `wsl --install` y reinicia Windows.
4. Abre Docker Desktop y espera a que indique que el motor está corriendo.
5. En PowerShell verifica que estén disponibles:

   ```powershell
   git --version
   docker --version
   docker compose version
   ```

## 2. Clonar y arrancar el proyecto

En PowerShell, cambia a la carpeta donde quieras guardar el proyecto y ejecuta:

```powershell
git clone https://github.com/davidethc/agentWhatsap.git
cd agentWhatsap
Copy-Item .env.example .env
docker compose up -d
```

La primera ejecución descarga n8n y puede tardar. El Compose fija n8n en una versión compatible con instalación administrada de nodos comunitarios y n8n instala Kapso automáticamente. Los siguientes arranques usan el volumen `n8n_data`, así que conservan los datos.

Abre **http://localhost:5678** y crea una cuenta de administrador. Esa cuenta pertenece a esa computadora; no uses ni compartas la cuenta de otra persona.

Comandos útiles (desde la carpeta `agentWhatsap`):

```powershell
docker compose ps
docker compose logs -f n8n
docker compose down
docker compose up -d
```

No uses `docker compose down -v` salvo que quieras borrar también los flujos, credenciales y demás datos guardados en el volumen.

## 3. Importar y preparar el workflow

1. En n8n, elige **⋯ → Import from File** y selecciona `workflows/agente-citas.json`.
2. Crea credenciales propias de **Kapso**, **Anthropic** y **Google Calendar**; luego selecciónalas en los nodos importados. El repositorio no contiene claves.
3. En el nodo **Claude**, selecciona un modelo que aparezca disponible para tu cuenta. El workflow propone `claude-sonnet-5`.
4. En los dos nodos de Google Calendar, elige la credencial y el calendario que recibirán las citas.
5. En **Responder por WhatsApp**, elige tu credencial Kapso y verifica el Phone Number ID de tu número.
6. Edita las instrucciones del agente para poner el nombre del negocio, servicios, precios, horario y dirección correctos.
7. Guarda el flujo. Aún no recibirá mensajes externos hasta configurar el webhook público en el siguiente paso.

Necesitas cuentas y acceso a sus servicios: Kapso con un número de WhatsApp conectado, una clave/API de Anthropic y una cuenta Google con Calendar. Los precios, límites y requisitos dependen de cada proveedor.

## 4. Exponer el webhook a Kapso

Kapso no puede acceder a `localhost`; para entregar mensajes a tu n8n local necesita una URL pública HTTPS. Para pruebas, puedes usar un túnel como ngrok o Cloudflare Tunnel. Por ejemplo, con ngrok:

```powershell
ngrok http 5678
```

Copia la URL HTTPS que te entrega, por ejemplo `https://ejemplo.ngrok-free.app/`. Edita `.env` y cambia solo `WEBHOOK_URL`:

```env
WEBHOOK_URL=https://ejemplo.ngrok-free.app/
```

Guarda `.env` y aplica el cambio:

```powershell
docker compose up -d
```

En n8n abre **Webhook Kapso**, copia la **Production URL** y regístrala en la configuración de webhooks de tu proyecto/número en Kapso para los mensajes entrantes. Activa el workflow. Envía un mensaje de prueba al número conectado.

Si la URL temporal del túnel cambia, reemplaza `WEBHOOK_URL`, vuelve a ejecutar `docker compose up -d` y actualiza la URL registrada en Kapso. Para recibir mensajes de forma estable hace falta una URL pública permanente, normalmente un dominio y un servicio que mantenga el túnel o aloje n8n.

## 5. Qué valores debe cambiar cada persona

- `.env`: `WEBHOOK_URL` para que use la URL pública de su propio túnel o dominio. `GENERIC_TIMEZONE` solo si utiliza otra zona horaria.
- Credenciales de n8n: cada usuario crea y selecciona sus propias credenciales de Kapso, Anthropic y Google Calendar.
- Datos del agente: nombre, servicios, precios, horario y dirección del negocio.
- Phone Number ID y webhook: deben corresponder al número y proyecto de Kapso de esa persona.

Normalmente no hace falta cambiar `N8N_HOST` ni `N8N_PROTOCOL` para abrir n8n localmente en `http://localhost:5678`; `WEBHOOK_URL` es el ajuste para construir enlaces públicos de webhook.

## 6. Claves y datos privados

`.env` ya está excluido de Git. No subas `.env`, API keys, contraseñas, copias del volumen de Docker ni exportaciones con credenciales. El archivo `.env.example` es una plantilla sin secretos. Cada instalación guarda sus credenciales en su volumen Docker local `n8n_data`.

## Solución de problemas

- **Docker no arranca:** abre Docker Desktop y espera a que el motor esté activo.
- **PowerShell no reconoce `docker compose`:** actualiza Docker Desktop y vuelve a abrir PowerShell.
- **El puerto 5678 está ocupado:** cambia el mapeo `5678:5678` a `5679:5678` en `docker-compose.yml`, recrea con `docker compose up -d` y abre `http://localhost:5679`.
- **Kapso no aparece:** revisa `docker compose logs -f n8n` y espera que termine la instalación inicial; reinicia con `docker compose up -d` si hubo un error de red.
- **Kapso no entrega mensajes:** revisa que el workflow esté activo, que el webhook registrado en Kapso sea la Production URL actual y que el túnel siga funcionando.
