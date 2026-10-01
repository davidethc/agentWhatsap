# Guía: Docker + n8n Community para el agente de WhatsApp

Esta guía instala todo en **tu computadora**. Sigue la sección de tu sistema operativo.

---

## 1. Instalar Docker

### Windows 10/11
1. Activa WSL2: abre **PowerShell como administrador** y ejecuta:
   ```powershell
   wsl --install
   ```
   Reinicia la computadora.
2. Descarga **Docker Desktop**: https://www.docker.com/products/docker-desktop/
3. Instálalo dejando marcada la opción **"Use WSL 2 instead of Hyper-V"**.
4. Abre Docker Desktop y espera a que diga **"Engine running"** (ballena verde abajo a la izquierda).

### macOS (Intel o Apple Silicon M1/M2/M3/M4)
1. Descarga **Docker Desktop** (elige el chip correcto): https://www.docker.com/products/docker-desktop/
2. Arrastra Docker a *Aplicaciones* y ábrelo.
3. Espera a que la ballena de la barra superior deje de moverse.

> Alternativa por terminal con Homebrew: `brew install --cask docker`

### Linux (Ubuntu / Debian)
```bash
# Script oficial de Docker
curl -fsSL https://get.docker.com | sudo sh

# Usar docker sin sudo (cierra sesión y vuelve a entrar después)
sudo usermod -aG docker $USER

# Que arranque con el sistema
sudo systemctl enable --now docker
```

### Verificar la instalación (todos los sistemas)
```bash
docker --version
docker compose version
docker run hello-world
```
Si `hello-world` imprime "Hello from Docker!", todo está listo.

---

## 2. Instalar n8n Community dentro de Docker

### Opción A (recomendada): con este repositorio
```bash
git clone https://github.com/davidethc/agentWhatsap.git
cd agentWhatsap

cp .env.example .env
docker compose up -d
```

> En Windows PowerShell usa `copy .env.example .env` en lugar de `cp`.
> El archivo `.env` es opcional: si no existe, n8n arranca con valores por defecto.
> Ahí puedes cambiar la zona horaria (`GENERIC_TIMEZONE`).

El archivo [`docker-compose.yml`](docker-compose.yml) ya trae:
- la imagen oficial gratuita `docker.n8n.io/n8nio/n8n`
- el puerto `5678`
- un volumen `n8n_data` para que **no pierdas tus flujos** al reiniciar
- la carpeta `./local-files` montada en `/files` dentro de n8n (para leer/escribir archivos)

### Opción B: un solo comando, sin repositorio
```bash
docker volume create n8n_data

docker run -d --name n8n --restart unless-stopped \
  -p 5678:5678 \
  -e GENERIC_TIMEZONE="America/Mexico_City" \
  -e TZ="America/Mexico_City" \
  -v n8n_data:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```
(En PowerShell cambia las `\` del final de línea por `` ` ``.)

---

## 3. Primer uso

1. Abre **http://localhost:5678** en tu navegador.
2. Crea la cuenta de **owner** (correo + contraseña). Es local, solo vive en tu compu.
3. (Opcional) n8n te ofrece una licencia gratuita que desbloquea funciones extra de Community
   (historial de flujos, carpetas, etc.). Solo pide tu correo: aceptarla no cuesta nada.
4. Pulsa **"Create workflow"** y ya puedes empezar a arrastrar nodos.

---

## 4. Comandos del día a día

Ejecútalos dentro de la carpeta del proyecto:

| Acción | Comando |
|---|---|
| Encender n8n | `docker compose up -d` |
| Apagar n8n | `docker compose down` |
| Ver si está corriendo | `docker compose ps` |
| Ver logs en vivo | `docker compose logs -f n8n` |
| Reiniciar | `docker compose restart n8n` |
| Actualizar a la última versión | `docker compose pull && docker compose up -d` |
| Respaldar flujos (exportar) | `docker compose exec n8n n8n export:workflow --all --output=/files/backup.json` |
| Importar flujos | `docker compose exec n8n n8n import:workflow --input=/files/backup.json` |

> ⚠️ `docker compose down -v` **borra el volumen** con todos tus flujos y credenciales. No uses `-v` salvo que quieras empezar de cero.

---

## 5. Preparar n8n para WhatsApp

WhatsApp (Meta) necesita enviar los mensajes a una **URL pública HTTPS**; `localhost` no le sirve.
Para desarrollar en tu compu usa un túnel:

### Con ngrok
1. Crea cuenta gratis en https://ngrok.com e instala ngrok.
2. Ejecuta:
   ```bash
   ngrok http 5678
   ```
3. Copia la URL `https://xxxx.ngrok-free.app`.

### Con Cloudflare Tunnel (sin cuenta)
```bash
cloudflared tunnel --url http://localhost:5678
```

### Después de tener la URL pública
1. Edita `.env`:
   ```env
   WEBHOOK_URL=https://xxxx.ngrok-free.app/
   ```
2. Reinicia: `docker compose up -d`
3. En n8n, los nodos **Webhook** y **WhatsApp Trigger** ya mostrarán esa URL pública.

> La URL gratuita de ngrok/cloudflared cambia cada vez que lo reinicias; tendrás que actualizar `.env`
> y la configuración del webhook en Meta. Para producción conviene un servidor (VPS) con dominio propio.

### Lo que necesitarás de Meta (siguiente paso del proyecto)
1. Cuenta en https://developers.facebook.com → **Crear app** → tipo *Business*.
2. Agregar el producto **WhatsApp** → obtendrás un número de prueba, *Phone number ID* y un *Access Token*.
3. En n8n: **Credentials → WhatsApp API** (para enviar) y **WhatsApp OAuth API** (para el trigger).
4. Flujo básico del agente:
   `WhatsApp Trigger` → `AI Agent` (con un modelo de IA) → `WhatsApp → Send Message`.

---

## 6. Problemas comunes

| Síntoma | Solución |
|---|---|
| `Cannot connect to the Docker daemon` | Abre Docker Desktop (Windows/Mac) o `sudo systemctl start docker` (Linux). |
| `port is already allocated` | Algo usa el 5678. Cambia en `docker-compose.yml` a `"5679:5678"` y entra por `http://localhost:5679`. |
| `permission denied` en Linux | Ejecuta `sudo usermod -aG docker $USER` y vuelve a iniciar sesión. |
| Error de cookie segura al entrar desde otra IP | Agrega `N8N_SECURE_COOKIE=false` al `.env` (solo en red local) o usa HTTPS. |
| WSL2 no instalado (Windows) | `wsl --install` en PowerShell como admin y reinicia. |
