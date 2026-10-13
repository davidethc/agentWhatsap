# Video 1 · «Son las 11:47 pm» — prompt de producción (anuncio Meta)

Pega todo el bloque «PROMPT» en Claude Code u opencode (en una carpeta vacía, por ejemplo `~/videos/eli-1147`).
Usa las skills de HyperFrames ya instaladas (`hyperframes` → `general-video`, `hyperframes-creative`,
`hyperframes-animation`). Resultado: un MP4 vertical listo para subir a Meta hoy.

---

## PROMPT

Usa la skill `hyperframes` y luego `general-video` (apóyate en `hyperframes-creative` para el estilo y en
`hyperframes-animation` para el movimiento). Crea un anuncio vertical para Instagram/Facebook Reels que
vende «Eli», una asistente de IA que atiende el WhatsApp de consultorios dentales 24/7, responde en
segundos y agenda citas sola en Google Calendar. Público: dueños y doctoras de consultorios dentales en
Ecuador y Latinoamérica. Idioma: español neutro con trato de «usted» en los mensajes del paciente y de Eli.

### Especificaciones técnicas (3 formatos desde UNA sola composición)
- Construye el video con variables de layout para renderizar 3 salidas sin rehacer el diseño:
  1. **Vertical 9:16 — TikTok / Reels / Shorts / Historias**: 1080×1920.
  2. **Horizontal 16:9 — YouTube / Facebook in-stream / presentaciones**: 1920×1080.
  3. **Feed 4:5 — Instagram / Facebook feed**: 1080×1350.
- 30 fps, duración 22 s (±1 s). MP4 H.264 (perfil High, 12–16 Mbps), audio AAC 48 kHz estéreo.
- **Zonas seguras verticales (TikTok es la más estricta, úsala para el 9:16):** nada importante en el
  10 % superior, en el 20 % inferior ni en el 15 % derecho (columna de íconos de TikTok/Reels).
  Margen izquierdo mínimo 64 px.
- **Layout 16:9:** el celular a la izquierda (≈45 % del ancho, centrado en vertical) y los textos grandes a la
  derecha, alineados a la izquierda; la escena de la agenda entra a la derecha del celular. Margen 96 px.
- **Layout 4:5:** igual que el vertical pero el celular al 62 % del alto y textos arriba/abajo más compactos.
- Debe entenderse SIN sonido: todo mensaje clave va en texto en pantalla.
- TikTok premia lo nativo: en el 9:16 los primeros 0.5 s ya deben mostrar movimiento (la notificación),
  nada de pantalla quieta.

### Estilo visual
- Fondo: azul noche muy oscuro (#0B1220) con un leve degradado; sensación de «madrugada».
- Celular: un smartphone moderno genérico (marco negro redondeado, sin marca, sin muesca de una marca
  real), centrado, ocupando ~70 % del alto. Leve inclinación 3D (5°) y sombra suave.
- Pantalla de chat ESTILO mensajería (no copies el logo ni el nombre de WhatsApp): fondo #ECE5DD,
  burbuja del paciente blanca a la izquierda, burbuja de Eli verde claro #DCF8C6 a la derecha
  (vista desde el consultorio), hora pequeña y doble check que pasa de gris a azul.
- Cabecera del chat: avatar circular con «E» blanca sobre turquesa #14B8A6, nombre «Eli · EliDental»,
  subtítulo «en línea» que cambia a «escribiendo…» cuando Eli escribe.
- Tipografía de los textos grandes: Inter o similar, peso 800, blanco, con resaltado turquesa #2DD4BF
  en la palabra clave. Tipografía del chat: sistema/Inter 400, 30–34 px.
- Acentos: turquesa #14B8A6 (marca) y ámbar #F59E0B solo para la hora 23:47.

### Guion escena por escena (tiempos exactos)
**0.0–2.0 s · GANCHO.** Pantalla negra, se enciende el celular con una notificación. Arriba, la hora
grande **«23:47»** en ámbar con un leve parpadeo. Texto en pantalla (zona central alta):
**«Son las 11:47 pm…»**. Sonido de notificación suave.

**2.0–5.0 s · EL PACIENTE ESCRIBE.** Se abre el chat. Aparece «escribiendo…» y luego la burbuja del
paciente (animación de entrada de abajo hacia arriba, 200 ms, ease-out):
> «Hola, buenas noches 😣 me duele mucho una muela, ¿atienden mañana?»
Texto en pantalla debajo del celular: **«Tu consultorio está cerrado.»** Al lado, un pequeño ícono de
consultorio con la luz apagada.

**5.0–7.5 s · ELI RESPONDE AL INSTANTE.** Indicador «escribiendo…» por 1 s; un pequeño contador
**«respondió en 3 s»** aparece junto a la burbuja. Burbuja de Eli:
> «Buenas noches, lamento la molestia 🙏 Mañana martes tengo libre a las 09:00 o a las 11:00. ¿Cuál le queda mejor?»
Texto en pantalla: **«Pero Eli no duerme.»** (resalta «no duerme» en turquesa).

**7.5–10.0 s · EL PACIENTE ELIGE.** Burbuja del paciente:
> «La de las 9 porfa, soy Andrea Torres»
El doble check pasa a azul.

**10.0–13.5 s · CITA CONFIRMADA.** «escribiendo…» 0.8 s y burbuja de Eli:
> «¡Listo, Andrea! Quedó su cita de urgencia para mañana martes a las 09:00 en EliDental. Si necesita cambiarla, me escribe por aquí 😊»
Animación de check verde grande ✓ sobre la burbuja (escala 0.6→1.0, 250 ms, rebote leve).

**13.5–16.5 s · LA AGENDA SE LLENA SOLA.** El celular se desliza a la izquierda y entra a la derecha una
tarjeta de calendario estilo Google Calendar (genérica, sin logo): columna «Mar 09:00» y aparece un
bloque turquesa **«🦷 Urgencia dental – Andrea Torres»** con un brillo. Texto en pantalla:
**«Agendada sola. Sin que nadie levantara el teléfono.»**

**16.5–19.5 s · REMATE.** Fondo se aclara a turquesa oscuro. Texto grande centrado, en dos líneas,
apareciendo palabra por palabra:
**«Mientras dormías,**
**ganaste un paciente.»**

**19.5–22.0 s · CIERRE / CTA.** Tarjeta final: logo de texto **«Eli»** (turquesa) + subtítulo
«Asistente de WhatsApp para consultorios». Debajo, botón redondeado blanco con texto turquesa:
**«Pruébala gratis por WhatsApp →»**. Línea pequeña: «Responde 24/7 · Agenda en tu calendario · Entiende audios».
Mantén la tarjeta quieta 1.5 s (Meta la usa como fotograma final).

### Audio
- Música: instrumental lo-fi/electrónica suave, 90–100 BPM, sin voz, libre de derechos (o genera con
  `hyperframes-audio` si está disponible). Volumen −18 LUFS; sube un poco en el remate.
- Efectos: notificación (0.2 s), tecleo muy suave durante «escribiendo…», «ding» de confirmación en el
  check verde (10.5 s), «whoosh» en el cambio a la agenda (13.5 s).
- Sin locución (el video se entiende con el texto). Opcional: versión B con voz en off femenina cálida
  diciendo solo el remate: «Mientras dormías, ganaste un paciente».

### Subtítulos
No hacen falta subtítulos aparte: los textos grandes ya son los mensajes. Asegura contraste AA
(texto blanco sobre fondo oscuro, sombra 0 2 8 rgba(0,0,0,.5)).

### Reglas de contenido (obligatorias)
- Todos los nombres y números son inventados (Andrea Torres). Nada de datos reales de pacientes.
- No uses el logo ni el nombre «WhatsApp» dentro de la animación (marca registrada); el estilo de chat
  basta. En el texto del anuncio sí se puede decir «WhatsApp».
- Sin cifras ni testimonios inventados. Sin promesas médicas.

### Entregables
1. `eli-1147_9x16.mp4` (TikTok/Reels), `eli-1147_16x9.mp4` (horizontal) y `eli-1147_4x5.mp4` (feed).
2. Tres variantes del gancho, en 9:16 (solo cambian los primeros 2 s y el texto inicial):
   - A: «Son las 11:47 pm…» (principal)
   - B: «¿Quién contesta el WhatsApp de tu consultorio a medianoche?»
   - C: «Este paciente iba a irse con otro dentista…»
3. Portadas PNG (segundo 12, con el check verde) en 9:16 y 16:9.
Antes de exportar, renderiza un borrador y revisa: tiempos, que ningún texto choque con las zonas
seguras y que se lea sin sonido.

---

## Texto del anuncio en Meta (copiar y pegar)

**Texto principal (variante 1):**
¿Cuántos pacientes te escriben de noche y se van con otro dentista porque nadie contestó? 🦷
Eli es la asistente de IA que atiende el WhatsApp de tu consultorio las 24 horas: responde en segundos,
entiende audios y fotos, y agenda la cita sola en tu Google Calendar.
👉 Pruébala tú mismo: escríbele como si fueras un paciente.

**Texto principal (variante 2, corta):**
Tu consultorio cierra. Tu WhatsApp no. Eli responde y agenda pacientes mientras duermes. Pruébala gratis 👇

**Título:** Tu WhatsApp agenda pacientes 24/7
**Descripción:** Asistente de IA para consultorios dentales
**Botón:** Enviar mensaje (objetivo: Interacción → Mensajes → WhatsApp)

## Configuración sugerida de la campaña
- Objetivo: Interacción con mensajes a WhatsApp (clic a WhatsApp) hacia el número DEMO de Eli
  (no el de EliDental real).
- Ubicaciones: Reels de Instagram y Facebook + historias (usa el 9:16) y feed (4:5).
- Público: Ecuador (luego Latinoamérica), 25–60 años; intereses de negocio: odontología, clínica
  dental, consultorio, emprendedores de salud, administración de consultorios. NO segmentar por
  condiciones de salud de las personas.
- Presupuesto de prueba: ~5 USD/día por cada variante de gancho (A, B, C) durante 3–4 días; quedarse con
  la de menor costo por conversación.
- Mensaje de bienvenida del chat demo: «Hola 👋 Soy Eli, la asistente de un consultorio de ejemplo.
  Escríbeme como si fueras un paciente: pregunta por un tratamiento o pide una cita.»

## Checklist antes de publicar
- [ ] Número demo de Eli listo (copia con agenda de prueba, no la de EliDental).
- [ ] Video revisado sin sonido en el celular.
- [ ] Ningún texto en las zonas seguras ni logo de WhatsApp en la animación.
- [ ] Nombres y números inventados.
- [ ] Texto del anuncio sin promesas de resultados.

## Ajustes aprobados en la revisión (12-oct-2026) — aplicar en todos los videos
- **Cabecera del chat** por debajo de la muesca: nombre «Eli · EliDental» 34 px peso 700 completo, avatar 64 px.
- **Medidas 9:16:** celular 1100 px de alto (y=400 a 1500), textos de escena encima del celular (y=200–380), nunca
  sobre el chat ni bajo y=1536. En 9:16 la agenda aparece centrada (no lado a lado). Calendario dice «Martes».
- **Más ritmo (dopamina):** duración 17–19 s; «escribiendo…» 0.4–0.6 s; burbujas con rebote (0.85→1.05→1);
  punch-in de cámara 1.0→1.08 en cada burbuja y en el ✓; contador «respondió en 3 s» animado; confeti turquesa al
  confirmar; pulso en la hora 23:47; textos palabra por palabra; whip/whoosh a la agenda.
- **Sonido obligatorio:** beat electrónico 115–125 BPM sin voz (−16 LUFS) + SFX: notificación, «pop» por
  burbuja, tecleo corto, «ding» + chispa en el ✓, whoosh en transiciones, «tap» en el botón final.
