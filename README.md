# Improve Your Vocabulary

App web progresiva (PWA) personal para aprender y repasar vocabulario en inglés británico (RP). Pensada para usarse desde el iPhone (icono en la pantalla de inicio) y desde el PC, con los mismos datos en los dos.

> **Estado:** en construcción por fases. El plan y el progreso están en [PLAN.md](PLAN.md) y las decisiones de diseño en [DECISIONS.md](DECISIONS.md). Este README se completará en la Fase 9.

## Stack

Vite + React + TypeScript · Tailwind CSS v4 · React Router · Dexie (IndexedDB) · Zod · vite-plugin-pwa · Vitest · funciones de Vercel en `api/`.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # rellena las variables cuando una fase las pida
npm run dev                  # app + funciones de api/ en http://localhost:5173
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm test` | Ejecuta los tests (Vitest) |
| `npm run lint` | Linter (Oxlint) |
| `npm run typecheck` | Comprobación de tipos |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run preview` | Sirve `dist/` (con service worker) |
| `npm run icons` | Regenera los iconos PNG a partir de `public/icon.svg` |
