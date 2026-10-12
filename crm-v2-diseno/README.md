# EliDental CRM

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**El CRM dental de WhatsApp para el consultorio EliDental (Loja, Ecuador).**

EliDental atiende por WhatsApp con **Eli**, una asistente de IA que agenda sola.
Este CRM es el panel donde la doctora ve esas conversaciones, el embudo de
pacientes y la agenda del consultorio. Una instancia = un solo consultorio: marca
EliDental, acento turquesa (#0e7490), moneda USD y zona `America/Guayaquil`.

## Qué incluye

- **Bandeja** de WhatsApp en tiempo real: hilo, contacto, ventana de 24 h,
  respuestas de Eli marcadas como IA y handoff a la doctora con un click.
- **Pipeline de pacientes**: Nuevo → Interesado → Agendó → Asistió → Seguimiento
  → Perdido.
- **Pacientes**: cada persona que escribe queda registrada con su ficha y notas.
- **Citas / agenda dental**: calendario Día/Semana/Mes/Lista con el horario del
  consultorio (L-V 09:00-18:00, sábado 09:00-15:00) y conectores de entrega
  (enlace fijo, Google Calendar + Meet, Zoom).
- **Agente Eli + knowledge base**: nombre, tono e instrucciones del consultorio;
  responde solo con lo que sabe y escala a la doctora.
- **Laboratorio**: pacientes simulados evalúan a Eli en un sandbox interno antes
  de que hable con pacientes reales.
- **Resultados**: números del consultorio (conversaciones, embudo, citas).
- **Ajustes**: WhatsApp, marca, plantillas, equipo, IA, agenda.

## Stack

Next.js 15 + React 19 · TypeScript · PostgreSQL 16 + Drizzle ORM · Better Auth ·
WhatsApp Cloud API oficial · IA por proveedor OpenRouter-compatible · Docker +
Caddy.

## Correrlo en local

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d postgres   # Postgres local
pnpm init-env                                              # crea .env con los secretos generados
pnpm doctor                                                # revisa el entorno y la base
pnpm seed:demo                                             # carga el consultorio de demostración EliDental
pnpm dev                                                   # http://localhost:3000
```

## Despliegue

En un VPS con Docker (2 GB de RAM bastan): con **Coolify** o con `docker compose`.
Solo hace falta un dominio apuntando al servidor (Meta exige **https** para los
webhooks) y un número en la WhatsApp Cloud API. Caddy emite el certificado solo.
La agenda viene encendida por defecto (`AGENDA=on`); coloca tus credenciales de
WhatsApp e IA en Ajustes.

## Créditos y licencia

Es un **fork white-label de [vocero-crm](https://github.com/kevinrivm/vocero-crm)**,
de [Kevin Belier](https://www.youtube.com/@KevinBelier), bajo licencia MIT.
