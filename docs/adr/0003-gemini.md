# ADR 0003: Gemini como único modelo de IA

- **Estado:** Aceptada
- **Fecha:** 2026-10-07

## Contexto

El historial de modelos fue este: Claude (v1), OpenRouter con modelos gratuitos (v2–v4) y, en
`version4`, OpenRouter como modelo principal con Gemini de respaldo. Los modelos gratuitos de OpenRouter
dieron problemas: límite de unas 50 peticiones al día, keys que vencían y respuestas de unos 15
segundos.

## Decisión

El agente usa solo **Google Gemini** (`models/gemini-3.5-flash`, credencial `googlePalmApi`), con
`needsFallback: false`. Se quitó el nodo OpenRouter de `version4`.

## Consecuencias

- Un proveedor menos que mantener, y respuestas más rápidas.
- Si Gemini falla, no hay respaldo: el cliente recibe el aviso de error («escríbeme en unos minutos»).
  Para agregar un respaldo, conecta otro modelo a la segunda entrada del agente y activa *needs fallback*.
- La credencial de OpenRouter sigue guardada en n8n, pero ningún workflow activo la usa.
