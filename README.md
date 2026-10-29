# Improve Your Vocabulary

App web progresiva (PWA) personal para aprender y repasar vocabulario en **inglés británico (RP)**. Se usa desde el iPhone (icono en la pantalla de inicio) y desde el PC, con los mismos datos en los dos.

Apuntas una palabra en menos de 10 segundos (con la frase y la serie donde la oíste) y la app completa la ficha sola: significados, formas, familia de palabras, ejemplos, pronunciación con audio y temas. Después la repasas con repetición espaciada (FSRS) y juegas con tus palabras.

## 1. Qué es y de qué está hecha

- **Pantallas:** Hoy · Vocabulario (con temas y series) · Añadir · Juegos · Progreso · Ajustes, más la guía de Pronunciación.
- **Siete juegos:** Parejas, Huecos, Formas verbales, Familias, Dictado, Conexiones e Historia.
- **Local primero:** todo se lee y se escribe en el dispositivo (IndexedDB), así que responde al instante y funciona sin conexión. Una función en la nube sincroniza el iPhone y el PC y sirve de copia de seguridad.
- **Sin cuentas:** eres el único usuario. Un secreto compartido (`APP_SECRET`) protege los dos endpoints. La clave de la API de Anthropic y la URL de la base de datos **solo viven en las variables de entorno de Vercel**: nunca llegan al navegador ni al repositorio.

**Stack:** Vite + React + TypeScript · Tailwind CSS v4 · React Router · Dexie (IndexedDB) · Zod (esquemas compartidos entre cliente y servidor) · ts-fsrs · vite-plugin-pwa · Vitest · funciones de Vercel en `api/` con `@anthropic-ai/sdk` y Neon (Postgres). Gráficos en SVG propio, sin librerías.

Más contexto: el plan por fases y su estado en [PLAN.md](PLAN.md), las decisiones de diseño en [DECISIONS.md](DECISIONS.md) y el documento original en [docs/SPEC.md](docs/SPEC.md).

## 2. Desarrollo local

Necesitas Node 22.12 o superior.

```bash
npm install
cp .env.example .env.local   # y rellena las variables (apartado 3)
npm run dev                  # la app y las funciones de api/ en http://localhost:5173
npm test                     # los tests
```

`npm run dev` monta los mismos manejadores de `api/` como *middleware* de Vite, así que no hace falta `vercel dev`. Sin `ANTHROPIC_API_KEY` la app sigue funcionando: completa las fichas con el diccionario gratuito y a mano. Sin `DATABASE_URL` no hay sincronización (la app lo dice en Ajustes).

| Comando | Qué hace |
|---|---|
| `npm test` | Ejecuta los tests (Vitest) |
| `npm run lint` | Linter (Oxlint) |
| `npm run typecheck` | Comprobación de tipos |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run preview` | Sirve `dist/` (con service worker) |
| `npm run icons` | Regenera los iconos PNG a partir de `public/icon.svg` |

## 3. Claves y secreto

Todas van en `.env.local` (ignorado por git) y, para producción, en Vercel (apartado 4).

| Variable | Para qué | Cómo conseguirla |
|---|---|---|
| `ANTHROPIC_API_KEY` | Completar fichas e historias con IA | En [platform.claude.com](https://platform.claude.com) → *API keys* → crear clave. **Es de pago por uso y no viene con una suscripción de Claude Pro**: añade saldo de prepago y pon un límite mensual de gasto. Una ficha cuesta unos 0,001–0,002 $ y una historia unos 0,0005 $. |
| `APP_SECRET` | Protege `/api/ai` y `/api/sync` | Una cadena larga y aleatoria que inventas tú (ver abajo). La escribes una vez en Ajustes de cada dispositivo. |
| `ANTHROPIC_MODEL` | Modelo de la IA | Opcional. Por defecto `claude-haiku-5-5`. |
| `DATABASE_URL` | Base de datos para sincronizar | La crea sola la integración de Neon en Vercel (apartado 4). |

Para generar el secreto:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Nunca subas `.env.local` ni pegues una clave en un archivo del repositorio.** Si una clave se filtra, bórrala en su consola y crea otra.

## 4. Despliegue en Vercel, paso a paso

1. Sube el repositorio a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repositorio. El preset es *Vite*; no hay que cambiar nada (el `vercel.json` ya fija la región de Fráncfort y las reescrituras de la SPA).
3. **Base de datos:** en el proyecto, *Storage* → *Marketplace* → **Neon** (plan gratuito, región Fráncfort). Al conectarlo, Vercel crea `DATABASE_URL` por ti.
4. **Variables de entorno** (*Settings → Environment Variables*): `ANTHROPIC_API_KEY`, `APP_SECRET` y, si quieres otro modelo, `ANTHROPIC_MODEL`.
5. **Despliega** (o *Redeploy* si ya había un despliegue, para que lea las variables nuevas).
6. Cada `git push` a `main` vuelve a desplegar.

**La tabla `records`** no hay que crearla a mano: se crea sola (`create table if not exists`) en la primera llamada a `/api/sync`, es decir, la primera vez que pulsas «Sincronizar ahora». Si prefieres crearla tú, este es el SQL (está en `src/server/sync/sqlStore.ts`):

```sql
create table if not exists records (
  tbl text not null,
  id text not null,
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  seq bigserial,
  primary key (tbl, id)
);
create index if not exists records_seq_idx on records (seq);
```

## 5. Instalación en el iPhone

1. Abre la URL de la app en **Safari**.
2. Toca **Compartir** → **Añadir a pantalla de inicio**, y deja activado **«Abrir como app web»**.
3. Abre la app **desde el icono**.
4. Ve a **Ajustes → Acceso** y escribe el secreto (`APP_SECRET`).

> En el iPhone, la app instalada guarda sus datos **aparte de Safari**: lo que añadas en una pestaña de Safari no aparece en el icono. Usa siempre el icono. Con la sincronización activa, los dos acaban con los mismos datos, pero así te ahorras confusiones.

Para que el audio suene mejor, en el iPhone puedes descargar voces británicas mejoradas en *Ajustes → Accesibilidad → Contenido leído → Voces → Inglés* (la ruta puede variar según la versión de iOS) y elegirlas después en **Ajustes → Audio** de la app.

## 6. Uso en el PC

Abre la URL en el navegador (o instálala: «Instalar» en Chrome o Edge, «Añadir al Dock» en Safari para Mac), escribe el secreto en **Ajustes → Acceso** y espera a la primera sincronización (o pulsa **«Sincronizar ahora»** en Ajustes → Sincronización). La primera vez sube lo local y baja lo remoto.

Atajos de teclado en escritorio:

| Tecla | Acción |
|---|---|
| `N` | Añadir palabra |
| `/` | Buscar (en Vocabulario) |
| `Espacio` o `Intro` | Girar la tarjeta |
| `1` `2` `3` `4` | Valorar: Otra vez, Difícil, Bien, Fácil |
| `Z` | Deshacer la última valoración |
| `Esc` | Cerrar o salir |

## 7. Copias de seguridad

- **La nube ya guarda una copia** de todo lo que se ha sincronizado. Si la sincronización lleva más de 7 días sin completarse, la app te avisa: en ese caso tus datos solo están en ese dispositivo.
- **Exportar a un archivo:** *Ajustes → Copia de seguridad → Exportar*. En el iPhone se abre la hoja de compartir: guárdalo en **Archivos → iCloud Drive**. En el PC se descarga un `.json`.
- **Importar:** *Importar copia*, con vista previa de recuentos y dos modos: **Fusionar** (gana lo más reciente de cada registro) o **Reemplazar todo** (con confirmación).

## 8. Solución de problemas

- **No se oye el audio:** sube el volumen y quita el modo silencio del iPhone; el audio solo empieza tras un toque, así que pulsa un altavoz una vez. En *Ajustes → Audio* elige otra voz británica y usa el botón de prueba.
- **La IA no responde, o la ficha queda «pendiente»:** revisa que el secreto de Ajustes sea exactamente `APP_SECRET`, que `ANTHROPIC_API_KEY` esté en Vercel (y tenga saldo) y que hayas hecho *Redeploy* después de cambiar variables. Una palabra añadida sin conexión se completa sola al volver la conexión.
- **No sincroniza (indicador en error):** secreto distinto en un dispositivo o `DATABASE_URL` sin configurar en Vercel. El indicador de Hoy y Ajustes dicen cuál es el caso.
- **La app no se actualiza:** cuando hay versión nueva aparece «Nueva versión · Actualizar». Si no, cierra la app del todo y vuelve a abrirla.
- **Veo datos distintos en Safari y en el icono (iPhone):** son almacenamientos separados; usa solo el icono y deja que sincronice.
- **Una historia o un juego no se abre:** necesitas un mínimo de palabras ya repasadas (se muestra en cada juego). «Historia» además necesita conexión y el secreto.
