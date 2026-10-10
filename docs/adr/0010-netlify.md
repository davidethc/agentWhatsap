# ADR 0010: El panel se publica en Netlify gratis y no en Vercel Hobby

- **Estado:** Aceptada (Plan aprobado el 2026-10-10)
- **Fecha:** 2026-10-10

## Contexto

En la ronda 1 se eligió «Next.js en Vercel gratis». El plan Hobby de Vercel es solo para **uso personal,
no comercial**, y EliDental es un negocio. La Constitución pide $0 y avisar de los límites que afecten
el uso real.

## Decisión

Publicar el panel Next.js en **Netlify gratis**, que permite uso comercial y corre Next.js casi sin
cambios. El código no usa funciones exclusivas de Vercel.

## Opciones descartadas

- **Vercel Hobby:** va contra sus términos; Pro cuesta 20 USD/mes.
- **Cloudflare Workers (OpenNext):** gratis y comercial, pero con más pasos. Queda como plan B.

## Consecuencias

- Revisar las condiciones del plan gratis de Netlify (créditos mensuales) al crear la cuenta.
- Las skills `vercel:*` siguen sirviendo para Next.js, pero no para publicar.
