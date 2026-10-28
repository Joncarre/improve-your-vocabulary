# Decisiones

Registro breve y fechado de las decisiones tomadas donde el documento inicial no es explícito o se aparta de él.

## 2026-10-28 · Fase 0 y 1

**Alcance y servicios**
- **La IA se mantiene.** El usuario dudó (no la quería) y después la aprobó si el coste es bajo. Va aislada en `/api/ai`: sin clave, la app funciona con el diccionario gratuito y a mano. Necesita una clave de la API de Anthropic, que **no** viene con Claude Pro (se paga por uso, con saldo de prepago). Coste estimado con Haiku 5.5: ~0,001–0,002 $ por ficha. Límite mensual de gasto en la consola de Anthropic.
- **Nombre de la app** (no definido en el documento): `name` «Improve Your Vocabulary», `short_name` «Vocab», monograma «V». Sin respuesta del usuario, se usa la propuesta.

**Modelo de datos**
- Se guarda una copia del documento original en `docs/SPEC.md` para que sobreviva entre sesiones.
- Tabla `stories` en el esquema v1 (sincronizable): la Fase 8 pide guardar la historia generada y el modelo no la incluía.
- `sharedSettings` y `deviceSettings` son dos tablas de una fila (ids `shared` y `device`) en lugar de `settings`. El secreto, la voz, la velocidad, el audio automático y el cursor de sincronización van en `deviceSettings`.
- `examples[].target` (forma exacta usada en cada ejemplo) y `Context.surface` (fragmento de la frase del usuario que corresponde a la palabra; `contextSurface` en la salida de `enrich`) son campos opcionales añadidos para que huecos y resaltado no tengan que adivinar *went* o *gave up*.
- `ReviewLog.origin` admite también `'extra'` (repaso fuera del calendario FSRS: no toca FSRS ni `due`, actualiza `stats` y no cuenta en las gráficas de repasos).
- `FsrsCard.elapsed_days` tiene valor por defecto 0: ts-fsrs 5.x lo marca como obsoleto y lo elimina en la 6.0.
- **Índice de tarjetas:** solo `due`, `entryId` y `type`. El `[suspended+due]` del documento se descarta: IndexedDB no admite booleanos como clave y dejaría las tarjetas fuera del índice sin avisar. `suspended` se filtra en código.

**Reglas de negocio (se implementan en las fases indicadas)**
- Fase 5 · **Rebelde** = 6 recaídas de FSRS (`lapses`: «Otra vez» en una tarjeta que ya estaba en repaso). Los fallos en juegos no cuentan.
- Fase 5 · La tarjeta de **producción** se desbloquea cuando la de reconocimiento sale de aprendizaje y es exigible desde el inicio del siguiente día de estudio (regla de hermanas).
- Fase 5 · **Casi sinónimas el mismo día:** no hay campo de categoría semántica; se usan `synonyms`/`antonyms` cruzados y la primera acepción en español idéntica. Los temas situacionales no cuentan como interferencia.
- Fase 5 · «Tarjetas de producción: desactivadas» solo filtra la cola; no borra ni crea tarjetas.
- Fase 6 · «Reemplazar todo» al importar con la sincronización activa marca como borrado lo que no esté en el archivo (borrado lógico con `updatedAt` nuevo) para que el servidor no lo devuelva.
- Fase 6 · La tabla `records` se crea sola (`CREATE TABLE IF NOT EXISTS`) en la primera llamada a `/api/sync`; el SQL queda también en el repo.
- Fase 8 · **Dictado** estricto con ortografía británica (la americana cuenta como error, con pista); la tarjeta de producción acepta variantes UK y US.

**Fase 2 (añadir palabras con IA)**
- **Medición real de `/api/ai`** (Haiku 5.5, 10 palabras con y sin frase): con `effort: 'low'` y el pensamiento adaptativo por defecto tardaba 12–16 s por palabra; con `thinking: { type: 'disabled' }` baja a **5,3 s de media** (mínimo 2,5 s, típico 3–6 s) con ~3.600 tokens de entrada y ~900 de salida, es decir **~0,0008 $ por palabra**. La primera llamada tras un despliegue (o una vez al día) tarda ~12 s porque Anthropic compila el esquema. El objetivo del documento de menos de 3 s no es alcanzable con ~1.000 tokens de salida; el esqueleto animado cubre la espera.
- La salida del modelo no usa campos opcionales (los esquemas de structured outputs los evitan): todo es obligatorio, con `""`, `[]` o `null` para «no aplica». Se normaliza en `normalizeEnrich` (máx. 4 acepciones, 2 ejemplos por acepción, 2 temas y solo ids que se enviaron).
- El código solo de servidor vive en `src/server/` (no figura en §14) y se excluye de `tsconfig.app.json`; las funciones de `api/` solo lo importan.
- Códigos de error de `/api/ai` en español y estables: `unauthorized`, `bad_request`, `not_configured` (503, sin clave: la app sigue con el diccionario y a mano, sin cola de pendientes), `server_misconfigured`, `rate_limited`, `billing`, `timeout`, `refused`, `invalid_output`, `upstream`. Son reintentables `network`, `timeout`, `rate_limited`, `upstream` e `invalid_output`; esos casos dejan la palabra como `pending_ai`.
- La respuesta incluye `meta` (modelo, ms y tokens) para poder vigilar el coste.
- **Añadir** es una hoja y no una ruta: se elimina `/add`. El atajo `N` y los botones la abren desde cualquier pantalla.
- **Unidad completa:** al elegirla se vuelve a analizar la unidad (una segunda llamada), porque la IPA, las acepciones y las formas del lema suelto no valen para el phrasal verb o la expresión. `seenForm` conserva lo que se escribió.
- **Duplicados:** si la palabra escrita ya existe y no hay frase, se muestra «Ya la tienes» sin llamar a la IA. Con frase se analiza igualmente para saber si usa una acepción nueva. Si la IA falla pero la palabra existe, se ofrece igualmente añadir la frase.
- **Entradas pendientes:** al completarlas, la IA sobrescribe lo suyo (acepciones, formas, familia, notas, IPA y lema); se conservan los contextos, los temas que ya tuviera, la fecha de creación y la grabación del diccionario. Si el lema real ya existe, los contextos pasan a esa entrada y la pendiente se borra (también sus tarjetas, de forma lógica). Se procesan de una en una, se detienen en el primer fallo y reintentan a los 60 s, al volver la conexión o al guardar otra.
- **Lista en lote:** sin vista previa; duplicados añaden la frase como contexto, los errores reintentables dejan la palabra como pendiente y los demás se muestran como fallo sin guardar. No aplica la unidad completa (se guarda el lema).
- **Fuentes** creadas al añadir tienen tipo `other`: el formulario del documento no pide el tipo.
- **Listado provisional** en Vocabulario (lema, IPA, significado y marca «Pendiente») para ver lo añadido; búsqueda, vistas y filtros llegan en la Fase 4.
- Los tests nunca contienen secretos reales: un test llevó por error el `APP_SECRET` real y el clasificador de seguridad bloqueó el commit antes de que se guardara en el historial.

**Herramientas y versiones**
- **TypeScript 7.0.2 y Oxlint** (la plantilla oficial de Vite, `create-vite` 9.3.3, los trae así) en lugar de ESLint + TypeScript 6.0.3, que era lo previsto en el plan: sin typescript-eslint desaparece el conflicto de versiones con TypeScript 7. `typescript/no-explicit-any` está como error.
- **ts-fsrs 5.4.x** (estable; la 6.0 sigue en beta con otra API). En la Fase 5 se confirma que es FSRS-6.
- **React Router 7.18**: la 8.x exige Node ≥ 22.22 y aquí hay 22.17.1. Se subirá cuando se actualice Node.
- `@types/node` 24 (el Node por defecto de Vercel), aunque en local haya Node 22.
- `npm audit`: 0 vulnerabilidades en dependencias de producción; hay 4 de severidad baja en herramientas de desarrollo (`deepmerge`, vía workbox-build), sin impacto en la app.
- Fuente serif: **Fraunces variable** (eje de peso), solo el subconjunto latino en la precarga offline.
- Icono: monograma «V» con el glifo real de Fraunces extraído a SVG una sola vez (opentype.js, fuera del repo); los PNG se generan con `sharp` (`npm run icons`) y se versionan.
- `--text-3` pasa de `#71717A` a `#86868F` para cumplir AA (4,09 → 5,48:1 sobre `--bg`). Un test comprueba el contraste de todos los tokens.

**Despliegue y estructura**
- **Importaciones con `.js` en `src/shared/` y `api/`.** Vercel ejecuta `api/` como Node ESM, que exige la extensión; `tsconfig.api.json` usa `module: nodenext` para que el compilador lo verifique, y Vite/Vitest resuelven `.js` → `.ts`. Sin alias de rutas (`paths`): las funciones de Vercel no los admiten.
- Adelanto mínimo en la Fase 1: `/api/health` y el middleware de Vite que monta `api/*.ts` en desarrollo, para detectar pronto problemas de la cadena TS/ESM entre `api/` y `src/shared/`.
- **TypeScript 7 y Vercel.** El paquete `typescript` 7 ya no exporta la API clásica de JavaScript (`transpileModule`, `createProgram`…). Se revisó el código de `@vercel/node` 28: detecta ese caso y compila `api/*.ts` lanzando el `tsc` nativo del proyecto con un tsconfig temporal basado en el `tsconfig.json` de la raíz, por eso la raíz lleva `module`/`moduleResolution: nodenext`. El primer despliegue (2026-10-28) funcionó con TypeScript 7 y `/api/health` responde en Vercel. Plan B si algún día falla: bajar a TypeScript 6.0.3.
- `vercel.json` mínimo: región `fra1` (cerca de Neon en Frankfurt) y reescritura de SPA que excluye `/api`. No lleva cabeceras propias para `sw.js`: Vercel ya sirve los estáticos con revalidación.
- El service worker no responde a `/api/*` con el esqueleto de la app (`navigateFallbackDenylist`) y precarga también los chunks de las pantallas, para que todo abra sin conexión.
- Verificación visual y Lighthouse con Playwright y `npx`, fuera del `package.json` (no entran en el stack de la app). Lo que solo se ve en un iPhone real lo confirma el usuario.
- `.gitattributes` fuerza LF: el equipo es Windows (`autocrlf=true`) y Vercel construye en Linux.
