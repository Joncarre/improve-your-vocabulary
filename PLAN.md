# PLAN — App de vocabulario en inglés británico (PWA personal)

> **Estado:** Fase 7 hecha; faltan las comprobaciones 📱 en el iPhone (fases 1 a 7) y la subida real a Neon (👤 pulsar «Sincronizar ahora» en el PC) · esperando tu confirmación para la Fase 8
> **Última actualización:** 2026-10-28

**Leyenda:** `[ ]` pendiente · `[x]` hecho · **✅** criterio de aceptación del documento · 🤖 lo verifico yo (tests, capturas, Lighthouse) · 📱 lo compruebas tú en el iPhone real · 👤 acción tuya (cuentas, paneles, claves)

> **Para tu revisión (2 minutos):** 1) responde a A1 y A2 (apartado 8); 2) lee los riesgos R1–R4 (apartado 7); 3) di «OK» o corrige lo que quieras de las decisiones B1–B17. Con eso empiezo la Fase 1.

---

## 1. Cómo trabajamos

- Una fase cada vez. Al terminarla me detengo y espero tu confirmación; no empiezo la siguiente antes.
- No adelanto trabajo de fases posteriores, salvo lo que el documento pide preparar (campos de sincronización del modelo de datos) y el adelanto mínimo de la decisión B16.
- Si algo es ambiguo, elijo la opción más simple y la anoto, con fecha, en `DECISIONS.md`.
- Código, nombres y comentarios en inglés · interfaz en español de España · contenido de aprendizaje en inglés británico (RP, ortografía británica).
- TypeScript estricto; `any` solo con justificación (regla de ESLint como error).
- Antes de usar una librería consulto su documentación vigente; instalo las últimas versiones estables que sean compatibles entre sí.
- Los cortes naturales (a, b, c…) de las fases 1, 2, 5 y 6 están marcados. Me detengo solo al final de cada fase; si alguna crece demasiado, te propongo cerrarla por subfases.
- Fuera de alcance (§16 del documento): login o multiusuario, tiempo real, notificaciones push, reconocimiento de voz, importar subtítulos, gamificación, anuncios y analíticas, otros idiomas de interfaz.

## 2. Resumen de fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Plan | hecha |
| 1 | Cimientos y despliegue | hecha y desplegada; faltan las comprobaciones en el iPhone |
| 2 | Añadir palabras con IA | hecha; faltan las comprobaciones en el iPhone |
| 3 | Ficha y audio | hecha; faltan las comprobaciones en el iPhone |
| 4 | Vocabulario, temas y fuentes | hecha; faltan las comprobaciones en el iPhone |
| 5 | Repaso (FSRS) | hecha; faltan las comprobaciones en el iPhone |
| 6 | Sincronización y copias | hecha; Neon ya conectado: falta la primera subida real (👤) y las comprobaciones en el iPhone |
| 7 | Juegos I: Parejas, Huecos, Formas verbales, Familias | hecha; faltan las comprobaciones en el iPhone |
| 8 | Juegos II: Dictado, Conexiones, Historia | pendiente |
| 9 | Progreso y pulido final | pendiente |

## 3. Cierre de fase (checklist común a las fases 1–9)

- [ ] `npm run build`, `npm run lint` y `npm run typecheck` sin errores
- [ ] `npm test` en verde (esta fase y las anteriores)
- [ ] Desplegado en Vercel (desde la Fase 1)
- [ ] Revisión visual a 375×812 y a 320 px de ancho, y en escritorio a 1280 px
- [ ] `PLAN.md` actualizado con las casillas marcadas
- [ ] Commit con mensaje claro: `feat(fase-N): …`
- [ ] Resumen para ti: qué se ha hecho, cómo probarlo en el iPhone y en el PC, problemas conocidos

## 4. Lo que he comprobado hoy (2026-10-28)

| Tema | Hallazgo | Efecto en el plan |
|---|---|---|
| Entorno | Node 22.17.1, npm 10.9.2, git con `autocrlf=true`. `origin` apunta a `github.com/Joncarre/improve-your-vocabulary` (sin commits todavía). No hay `gh` ni `vercel` instalados. | Node cumple lo que pide Vite 8 (≥ 20.19 / 22.12). Vercel lo enlazas tú una vez (A2). `.gitattributes` para forzar LF. |
| Versiones en npm (`latest`) | Vite 8.3.5 · React 19.3.1 · React Router 8.5.1 (instalada la 7.18: la 8 exige Node ≥ 22.22 y aquí hay 22.17.1) · Tailwind 4.3.3 · Dexie 4.4.7 + dexie-react-hooks 4.4.0 · Zod 4.6.7 · Motion 14.7.1 · lucide-react 1.62.0 · vite-plugin-pwa 2.0.0 (admite Vite 8) · Vitest 5.0.5 · ESLint 10.13 · @anthropic-ai/sdk 1.3.0 · @neondatabase/serverless 1.2.0 · @fontsource/fraunces y newsreader 5.3.0 | Se instalan las últimas estables compatibles entre sí y se anotan en `DECISIONS.md`. |
| TypeScript y linter | `latest` es 7.0.2, pero typescript-eslint 8.72 exige `<6.1`. La plantilla oficial de Vite (create-vite 9.3.3) ya trae TypeScript 7.0.2 con Oxlint. | Se sigue la plantilla: TypeScript 7.0.2 y Oxlint en lugar de ESLint (B13 revisada). |
| ts-fsrs | `latest` es 5.4.2; la 6.0.0 está solo en `beta` (el README de GitHub ya describe otra API asíncrona y FSRS-7). | Uso la 5.4.x estable; en la Fase 5 confirmo que es FSRS-6, como pide el documento (B13). |
| Vercel Functions | Hobby: 300 s máximo con Fluid compute; cuerpo máximo de 4,5 MB; una sola región (por defecto `iad1`, EE. UU.); handlers `export default { fetch(request) }` o `GET`/`POST`; **no** admiten los alias `paths` de tsconfig. | Los 25 s son un límite nuestro (`AbortSignal`). Lotes de sincronización limitados por tamaño. Región `fra1`. Imports relativos entre `api/` y `src/shared`. |
| Neon (Marketplace) | Inyecta `DATABASE_URL` (pooled) y `DATABASE_URL_UNPOOLED`; la región se elige al instalar. Driver 1.x: plantilla etiquetada, `sql.query(texto, params)` y `sql.transaction([...])`. | Uso `DATABASE_URL` con el driver HTTP; inserción por lotes con una sola sentencia. |
| Claude API | `claude-haiku-5-5`: 0,10 $ / 0,50 $ por millón de tokens. Piensa por defecto (adaptive). `temperature` distinto del valor por defecto y *prefill* dan 400. Structured outputs con `messages.parse` + `zodOutputFormat` y `output_config.format`; no admiten `minLength`/`maxLength`/`minimum`/`maximum` ni recursión (el SDK los quita y valida en cliente). El primer uso de un esquema nuevo paga compilación (caché de 24 h). `refusal` sin *fallback* en Haiku. | `effort: 'low'`, esquema simple, tratar `refusal` y `max_tokens` como error recuperable. Coste ≈ 0,001 $ por ficha. |
| Free Dictionary API | El JSON responde bien (200, CORS `*`, caché de 4 h). **Grabaciones UK escasísimas**: de 7 palabras probadas, solo *learnt* tiene `-uk`; el resto tiene `-us`, `-au` o nada. Los mp3 devolvieron **502** en mis pruebas (el JSON iba bien). | La voz `en-GB` del dispositivo será la vía principal de audio (R2). |
| Contraste WCAG | Pasteles ≥ 8,6:1 sobre fondos oscuros; chips ≥ 6,5:1; texto oscuro sobre relleno pastel ≥ 10:1 → todo cumple AA. **`--text-3` (`#71717A`) no**: 4,09 / 3,80 / 3,51 sobre `--bg` / `--surface` / `--surface-2`. | `#86868F` cumple (5,48 / 5,09 / 4,70) y se ve casi igual (B14). |
| Modelo de datos | IndexedDB no admite booleanos como clave: el índice `[suspended+due]` del documento dejaría las tarjetas fuera del índice sin dar error. | Se indexa solo `due` y `suspended` se filtra en código (B15). |

---

## 5. Fases en detalle

### Fase 0 — Plan

- [x] Leer el documento completo
- [x] Revisar el entorno (Node, npm, git, remoto, CLIs)
- [x] Comprobar en documentación vigente lo que más condiciona el plan (apartado 4)
- [x] Escribir este `PLAN.md` con fases, tareas, riesgos y dudas
- [x] Primer commit del repo con el plan
- [x] ✅ Tu visto bueno («continua con la fase 1»). Cambio posterior: la IA se mantiene (B18)

### Fase 1 — Cimientos y despliegue

**1a · Proyecto y herramientas**
- [x] (docs) Plantilla vigente de `create-vite` (React + TS), Tailwind v4 con `@tailwindcss/vite`, vite-plugin-pwa 2.x, Vitest 5, Oxlint
- [x] Proyecto en la raíz con npm y la estructura de carpetas de §14
- [x] TypeScript 7 estricto (`strict`, `noUncheckedIndexedAccess`, `forceConsistentCasingInFileNames`) con proyectos separados para la app, las herramientas, `api/` (módulos de Node ESM) y los tests
- [x] Oxlint con `typescript/no-explicit-any` como error; scripts `dev`, `build`, `lint`, `typecheck`, `test`
- [x] Vitest + `fake-indexeddb` + test de humo en verde
- [x] `.gitignore` y `.env.example` (de §17), `.gitattributes` (`* text=auto eol=lf`), `README.md` mínimo
- [x] `DECISIONS.md` con las decisiones aprobadas del apartado 8 (fechadas) y `docs/SPEC.md` con el documento original (B1)

**1b · Diseño y layout**
- [x] Tokens CSS con `@theme` de Tailwind v4: colores de §12 (con B14), pasteles por rol (valoración, chips, temas), escala tipográfica compacta, radios, espaciados y *safe areas*
- [x] Test de contraste WCAG de los pares de tokens (evita regresiones)
- [x] Estilos base de iOS: `-webkit-tap-highlight-color`, `overscroll-behavior: none`, `100dvh`, inputs de 16 px, `hover` solo bajo `(hover: hover)`, `prefers-reduced-motion`, zonas táctiles ≥ 44 pt
- [x] Fuentes autoalojadas: Fraunces variable (solo subconjunto latino) y bloque «Diagnóstico tipográfico» en Ajustes con los glifos IPA (`ˈ ˌ ː ə ɜ ʊ ɒ ʌ æ θ ð ʃ ʒ ŋ`); Noto Sans solo para la IPA si el sistema falla (R13)
- [x] Componentes base: Button, Card, Chip, Skeleton, cabecera con título iOS compacto, Switch/Slider/Select para Ajustes
- [x] React Router (modo SPA) con rutas perezosas: Hoy, Vocabulario, Juegos, Progreso, Ajustes
- [x] Layout responsive: barra inferior < 1024 px (49 pt + zona segura, desenfoque, botón + central) y barra lateral ≥ 1024 px (Hoy, Vocabulario, Añadir, Juegos, Progreso, Ajustes); tramo 768–1023 con más aire; anchos máximos (tarjeta 480, juegos 640, texto 720)
- [x] Pantallas esqueleto con estados vacíos amables; Hoy con engranaje hacia Ajustes; el botón + navega a un marcador (la hoja real es de la Fase 2)

**1c · Datos locales preparados para sincronizar**
- [x] (docs) Dexie 4: versionado de esquema, transacciones, `useLiveQuery`
- [x] Esquemas Zod en `src/shared` como fuente única de los tipos de §4 (más `stories`, B2); ids UUID, `updatedAt` y `deletedAt?` en las tablas sincronizables
- [x] Esquema Dexie v1 completo (`entries`, `cards`, `logs`, `sources`, `topics`, `games`, `stories`, `sharedSettings`, `deviceSettings`, `outbox`) con los índices de §4, ajustando `[suspended+due]` (B15), y una migración v2 de ejemplo en un test
- [x] Repositorios en `src/db`: toda escritura actualiza `updatedAt`, hace borrado lógico y encola en `outbox` en la misma transacción; las lecturas excluyen los borrados; lo que llega de la sincronización no se encola
- [x] Ajustes con los valores por defecto de §4 (compartidos y del dispositivo) y su hook
- [x] `navigator.storage.persist()` al arrancar y `estimate()` visible en Ajustes
- [x] Tests: UUID, `updatedAt`, borrado lógico, `outbox` (encola / no encola), valores por defecto, apertura y migración

**1d · PWA**
- [x] vite-plugin-pwa: manifest (§11), precarga del esqueleto, `registerType: 'prompt'` con aviso «Nueva versión · Actualizar», `/api/*` fuera del *fallback* de navegación y de cualquier caché
- [x] Metaetiquetas de iOS: `apple-touch-icon` de 180 px opaco, `apple-mobile-web-app-title`, `status-bar-style: black-translucent`, `viewport-fit=cover`, `theme-color`
- [x] Icono: monograma en SVG y `scripts/generate-icons` (con `sharp`) → 192, 512, *maskable* y 180
- [x] Detección de modo instalado y guía de instalación en Safari (Compartir → Añadir a pantalla de inicio → «Abrir como app web»)
- [x] Onboarding corto: usa siempre el icono (en iOS el almacenamiento de la app instalada es independiente del de Safari) y dónde se introduce el secreto
- [x] Ajustes básicos: todos los de §4 editables (voz y velocidad solo guardan el valor; la lista de voces es de la Fase 3), campo del secreto, estado del almacenamiento

**1e · Despliegue**
- [x] `vercel.json`: *rewrites* de SPA (sin `/api`) y región `fra1` (sin cabeceras propias: Vercel ya sirve los estáticos con revalidación)
- [x] Spike (B16): `/api/health` que importa un esquema de `src/shared`; comprobado con `npm run dev` y con un test. Comprobado también en Vercel con TypeScript 7 (R6 resuelto)
- [x] 👤 Importar el repo en Vercel (A2) y confirmar el despliegue automático desde `main` (hecho: https://improve-your-vocabulary.vercel.app/)
- [x] Comprobar en el despliegue: manifest, iconos, `sw.js`, reescritura de SPA y `/api/health` (R6), comprobados por HTTP. La carga sin conexión en el iPhone queda en 📱
- [x] Comprobaciones con Playwright (WebKit con perfil iPhone 13 mini a 375×812 con muesca y barra inferior simuladas, 320 px, tablet y 1280 px): sin scroll horizontal en ninguna ruta, sin errores de consola y carga sin conexión con el service worker activo (Chromium)

**Criterios de aceptación**
- [ ] ✅ 📱 Se instala en el iPhone 13 mini, abre a pantalla completa sin interfaz de Safari y respeta la muesca y la zona inferior (🤖 comprobado el layout con 47 px de muesca y 34 px de barra inferior simulados)
- [x] ✅ 🤖 No hay scroll horizontal a 320 px; en el PC se ve con barra lateral
- [ ] ✅ 🤖📱 El esqueleto carga sin conexión (🤖 comprobado en Chromium con el service worker activo; falta 📱 en el iPhone)
- [ ] 📱 Ajustes → Diagnóstico tipográfico: la serif de «decision» se ve con peso normal y la IPA aparece completa (en el WebKit de Playwright para Windows la serif sale más gruesa; en Chromium es correcta)

### Fase 2 — Añadir palabras con IA

**2a · Endpoint de IA (sin interfaz)**
- [x] (docs) `@anthropic-ai/sdk` 1.x (`messages.parse`, `zodOutputFormat`, `output_config`), structured outputs y Haiku 5.5 (`effort`, `refusal`)
- [x] 👤 Crear una clave de API en platform.claude.com con saldo de prepago (la suscripción Claude Pro no incluye la API), poner `ANTHROPIC_API_KEY`, `APP_SECRET` y `ANTHROPIC_MODEL` en `.env.local` y en Vercel, y fijar un límite mensual de gasto en la consola de Anthropic
- [x] Esquemas Zod de entrada y salida de `enrich` en `src/shared`: campos de `Entry` y `Sense` sin ids ni estadísticas, más `alternativeUnit`, `contextTranslationEs`, `newTopic` y los extras de B4; adaptados a structured outputs (objetos cerrados, sin restricciones no admitidas, vacíos en lugar de opcionales)
- [x] `api/ai.ts`: `x-app-secret` con comparación en tiempo constante (401); límites (palabra ≤ 80, frase ≤ 400, temas ≤ 50); tiempo máximo de 25 s; errores en español; validación con Zod y un reintento; `refusal` y `max_tokens` como error recuperable; modelo desde `ANTHROPIC_MODEL` (por defecto `claude-haiku-5-5`) con `effort: 'low'` y sin `temperature` ni *prefill*
- [x] System prompt de `enrich` (§13) y modo `examples_only`
- [x] Cliente `src/ai/`: `fetch` con secreto, `AbortController`, errores tipados (sin conexión, 401, 429, tiempo agotado, IA)
- [x] Medición real con tu clave: latencia y coste de 10 palabras, anotados en `DECISIONS.md` (R3)
- [x] Tests: validación de entrada y límites, comparación del secreto, parseo y validación con el SDK simulado

**2b · Hoja de añadir y guardado**
- [x] `Sheet` (móvil, con `visualViewport` para que el teclado no tape campos ni botón) y `Dialog` (escritorio); atajo `N`; `Esc` cierra
- [x] Formulario: palabra (foco automático, `autocapitalize="off"`, `autocorrect="off"`, `spellcheck={false}`), frase con «Pegar», fuente con autocompletado («modo maratón» si hay una palabra de hace menos de 3 h) y detalle
- [x] Analizar → esqueleto animado → vista previa editable (quitar acepciones, corregir la traducción, cambiar temas) → Guardar
- [x] Formas flexionadas: guarda el lema, conserva `seenForm` y muestra la nota «*went* es el pasado de *go*»
- [x] Unidad completa (`alternativeUnit`): me dejas elegir qué guardar
- [x] Temas: envío los existentes (máx. 50), asigno 1–2 y creo `newTopic` con emoji y color de la paleta pastel
- [x] Guardado en una transacción: `Entry`, `Context`, `Source` (si es nueva) y 2 `Card` (reconocimiento nueva; producción bloqueada)
- [x] Duplicados por `lemmaKey`: «Ya la tienes», añadir la frase como contexto sin duplicar tarjetas y añadir la acepción nueva si procede

**2c · Robustez y lotes**
- [x] `pending_ai`: sin conexión o con error de IA se guarda con lo que haya y se completa sola al volver la conexión (evento `online` y al abrir la app); marca visual
- [x] Respaldo con la Free Dictionary API (IPA, definición y audio solo si es `-uk`/`_gb_`); el resto, editable a mano
- [x] Sin clave configurada (`/api/ai` responde «IA no configurada»), la app trabaja en modo diccionario gratuito + manual, sin cola de pendientes: la IA queda como pieza opcional (B18)
- [x] Añadir varias: pegar una lista (`palabra — frase`), cola de 2 en 2 con progreso visible
- [x] Tests: normalización de `lemmaKey`, detección de duplicados, fusión de contextos, creación de tarjetas, parseo de la lista, mapeo de la Free Dictionary a una `Entry` parcial

**Criterios de aceptación**
- [x] ✅ 🤖📱 *went* con *We went to the pub after work* da la entrada de *go* con formas, familia, IPA RP correcta y ejemplos (🤖 comprobado con la API real; la IPA sale como /ɡəʊ/)
- [x] ✅ 🤖📱 *She went off on one when she saw the bill* propone guardar *go off on one* (🤖 comprobado con la API real: se guarda con IPA /ɡəʊ ɒf ɒn wʌn/)
- [x] ✅ 🤖📱 Una palabra añadida sin conexión se completa sola al volver la conexión (🤖 comprobado con la API real: ~5 s después de volver la conexión; y la hoja abre sin conexión en el build de producción)
- [ ] ✅ 📱 En el 13 mini, con el teclado abierto, se ven los campos y el botón «Analizar» (🤖 comprobado con un `visualViewport` simulado de 476 px de alto; falta el teclado real del iPhone)

### Fase 3 — Ficha y audio

**3a · Audio**
- [x] (docs) Web Speech API en iOS (`voiceschanged`, gesto del usuario) y formato de los mp3 de la Free Dictionary
- [x] `src/audio/`: carga de voces esperando a `voiceschanged` con tiempo límite, mejor voz `en-GB`, `speak(texto, { rate })` fijando siempre `lang = 'en-GB'`, cancelación de la anterior, desbloqueo tras un gesto en iOS
- [x] Grabación UK solo si la URL es `-uk`/`_gb_` (se descartan `-us` y `-au`): `fetch` → Blob → `Audio`, con tiempo límite y salto inmediato a voz sintética; la caché CacheFirst (máx. 500) la hace el service worker; una URL que falla no se reintenta en esa sesión
- [x] Al guardar una entrada, buscar `audioUrl` en segundo plano (sin bloquear) y rellenar las entradas ya guardadas
- [x] `SpeakerButton` (normal y lento a 0,7) con `aria-label` y estado de reproducción
- [x] Ajustes de voz: lista de voces `en-GB`, botón de prueba, velocidad y nota sobre las voces mejoradas de iOS
- [ ] El audio automático funciona (con el toque de «Empezar» y de cada valoración como gesto, R2): el ajuste y el mecanismo están hechos; se comprueba con la pantalla de repaso en la Fase 5

**3b · Ficha de palabra (`/entry/:id`)**
- [x] 1 · Cabecera: lema, IPA, altavoz y «lento», chips de tipo con color, CEFR y registro (aviso visible si es *slang* u *offensive*)
- [x] 2 · Dónde la viste: tus frases con la palabra resaltada, traducción plegable, fuente y detalle, altavoz
- [x] 3 · Acepciones agrupadas por tipo de palabra: la de tu frase destacada; 2 ejemplos con audio y traducción plegable
- [x] 4 · Formas (verbo, sustantivo, adjetivo) con distintivo «irregular», variantes y altavoz en cada forma
- [x] 5 · Familia de palabras: chips que abren la ficha si ya está en la colección o muestran «Añadir» (usa la hoja de la Fase 2)
- [x] 6 · Sinónimos, antónimos y colocaciones
- [x] 7 · Nota para hispanohablantes y diferencias UK/US
- [x] 8 · Relacionadas en tu colección (máx. 8)
- [x] 9 · Progreso: estado, veces vista, aciertos, fallos, %, racha, próxima revisión y últimos 10 intentos (con datos reales desde la Fase 5)
- [x] 10 · Acciones: editar, regenerar ejemplos (IA, con `examples_only`), archivar, reiniciar progreso, eliminar con confirmación
- [x] Resaltado de la palabra en la frase (con `contextSurface`; si no, por formas conocidas)
- [x] Editor de la ficha
- [x] Tests: resaltado, selección de voz, filtrado de URLs de audio, reinicio de progreso, archivar y eliminar (borrado lógico)

**Criterios de aceptación**
- [ ] ✅ 📱 El audio suena en el iPhone y en el PC (grabación UK si existe; si no, voz `en-GB`) (🤖 comprobado con `speechSynthesis` simulado: todo sale con `lang = en-GB`, la mejor voz británica, 0,95× y 0,7× en «despacio»; el servidor de grabaciones de la Free Dictionary devuelve 502, así que suena la voz del dispositivo)
- [x] ✅ 🤖📱 La IPA se ve bien en los dos (🤖 comprobado a 375, 320 y 1280 px en Chromium y WebKit; falta verla en el iPhone real)

**3c · Guía de pronunciación para hispanohablantes** *(petición del 2026-10-28, no figuraba en el documento)*
- [x] Tabla de todos los símbolos de la IPA británica que usa la app (vocales cortas y largas, diptongos, consonantes y marcas de acento y duración): con qué suena en español, un consejo para pronunciarlo y palabras de ejemplo con su IPA que se oyen al tocarlas
- [x] Sección «Errores típicos de un hispanohablante» con pares que se confunden (*ship/sheep*, *very/berry*, *think/sink*…) y audio
- [x] Pantalla `/phonetics`, accesible desde Vocabulario, la barra lateral y la ficha
- [x] En la ficha, «¿Cómo se lee?»: desglosa la IPA de esa palabra símbolo a símbolo con su equivalencia en español
- [x] Tests: la tabla no tiene símbolos repetidos ni campos vacíos, el desglose reconoce las transcripciones reales (acentos, `ː`, `tʃ`/`dʒ`, variantes `ɛ`/`ɹ`/`g`) y avisa de los símbolos desconocidos

**Criterios de aceptación**
- [x] ✅ 🤖 Cada símbolo que la IA puede devolver aparece en la tabla (test con 39 transcripciones reales) y el desglose de cualquier ficha reconoce todos sus símbolos (los desconocidos se avisan, no se ocultan)

### Fase 4 — Vocabulario, temas y fuentes

- [x] Función pura de estado de palabra (nueva, aprendiendo, en repaso, consolidada, dominada; §7) en `src/srs/state.ts`, con tests; la reutiliza la Fase 5 (adelantada en la Fase 3, que la usa en la ficha)
- [x] Índice de búsqueda en memoria (sin acentos, inglés y español) alimentado con `useLiveQuery`; también encuentra por tema, por serie y por la frase donde la viste
- [x] Pantalla Vocabulario: filas de ~52 px; vistas Todas / Por tema / Por fuente / Por tipo de palabra; filtros por estado (incluidos pendientes y rebeldes); orden por recientes, alfabético, más falladas y próxima revisión; atajo `/` para buscar
- [x] Estados vacíos y esqueletos
- [x] Gestión de temas: renombrar, fusionar (reasigna `topicIds` y marca el tema fusionado como borrado), emoji y color de la paleta pastel
- [x] Página de fuente (serie o película) con sus palabras; los botones «Repasar» y «Jugar» quedan ocultos hasta las fases 5 y 7
- [x] Vista maestro-detalle en escritorio (lista + ficha de la Fase 3)
- [x] Semilla de 1.000 entradas de prueba (solo en desarrollo: Ajustes → Desarrollo; 1.000 phrasal verbs en todos los estados) y test de rendimiento de la búsqueda
- [x] Tests: normalización sin acentos, filtros, orden, fusión de temas

**Criterios de aceptación**
- [x] ✅ 🤖 La búsqueda responde al instante con 1.000 palabras de prueba (medido: índice 9 ms y búsqueda más lenta 1 ms; en el navegador, ~47 ms de la tecla a la lista nueva y 131 ms la primera pintura; la lista dibuja 100 filas y carga más al acercarse al final)

### Fase 5 — Repaso

**5a · Núcleo de repetición espaciada (sin interfaz)**
- [x] (docs) ts-fsrs 5.4.x: confirmado FSRS-6 (21 parámetros), parámetros (`request_retention`, `enable_fuzz`, pasos de aprendizaje y reaprendizaje), vista previa de las 4 valoraciones, *retrievability* y deshacer
- [x] `src/srs/scheduler.ts`: ajustes → parámetros (retención, fuzz, pasos de 1 y 10 min, reaprendizaje de 10 min), `preview()` con intervalos formateados («10 min», «2 d»), `grade()`, serialización de `FsrsCard` y copia indexable `due`
- [x] Día de estudio de 04:00 a 04:00 (inicio, fin y clave), a prueba de cambios de hora
- [x] Estados de tarjeta y de entrada (la tarjeta activa más débil; dominada = racha ≥ 5 y estabilidad ≥ 60 d)
- [x] **Las palabras no desaparecen** *(petición del 2026-10-28)*: al acertar, el intervalo crece pero nunca pasa de 180 días (`maximum_interval`), también en las dominadas; nada archiva ni borra una palabra salvo tú (test: tras muchos «Fácil» seguidos, el siguiente repaso no pasa de 180 días)
- [x] **Ejemplos variados** *(petición del 2026-10-28)*: función pura que elige la frase de cada repaso entre tus frases y los ejemplos de **todas** las acepciones, sin repetir hasta agotarlas; el reverso destaca la acepción de la frase mostrada (test: recorre todas las acepciones y no repite antes de agotar)
- [x] Cola del día: aprendizaje vencido, repasos que vencen antes del fin del día (menor *retrievability* primero), nuevas hasta el límite, 1 nueva cada 4 repasos, hermanas (nunca el mismo día), casi sinónimas (B7), bloques de 20 y atasco > 150 (urgentes primero, sin nuevas hasta bajar de 50)
- [x] Desbloqueo de la tarjeta de producción (B6) y marca de rebelde a las 6 recaídas (B5)
- [x] Comprobador de respuestas: normalización (minúsculas, espacios, apóstrofos tipográficos), variantes UK/US, formas verbales válidas y Damerau-Levenshtein 1 con más de 4 letras → «Difícil»
- [x] Generación del hueco de la tarjeta de producción (con `target`, B4; respaldo por formas conocidas)
- [x] Tests (Vitest): scheduler, cola (incluidas hermanas e intercalado), comprobador, estados y día de estudio con cambio de hora

**5b · Interfaz de repaso**
- [x] Hoy: racha de días, tarjeta principal «X por repasar · Y nuevas · ≈ N min» con **Empezar**, accesos a «Rebeldes (N)» y «Pendientes de completar (N)»; dos columnas en escritorio
- [x] Tarjeta de reconocimiento: volteo 3D con muelle (~350 ms), audio automático según ajustes, tu frase en el anverso, reverso con la acepción de la frase mostrada destacada, formas, un ejemplo y la familia en una línea; la frase cambia en cada repaso
- [x] Tarjeta de producción: significado, tipo y frase con hueco; campo de texto opcional; valoración sugerida con la diferencia resaltada, que puedo cambiar
- [x] 4 botones de valoración con el intervalo previsto; gestos (izquierda = Otra vez, derecha = Bien); atajos de teclado (`Espacio`/`Intro`, `1`–`4`, `Z`, `N` —abre «Añadir» en cualquier pantalla—, `Esc`) con pista discreta; `/` solo busca en Vocabulario
- [x] Cada valoración se guarda en una sola transacción: tarjeta, `ReviewLog`, `stats`, `due` y `outbox`
- [x] Deshacer la última valoración (revierte tarjeta, log, estadísticas, marca de rebelde y desbloqueo)
- [x] Bloques de 20 con opción de seguir; resumen de sesión (tiempo, % de aciertos, nuevas aprendidas, palabras a reforzar)
- [x] Lista «Rebeldes» con acciones: regenerar ejemplos con IA y archivar (jugar llega en la Fase 7)
- [x] «Repasar esta serie» desde la página de fuente (B8)
- [x] Maquetación: tarjeta y 4 botones sin scroll en 375×812; con el teclado abierto en producción siguen visibles la frase con hueco y el campo

**Criterios de aceptación**
- [x] ✅ 🤖 Tests del scheduler, de la cola (incluidas las hermanas), del comprobador de respuestas y de los criterios de estado
- [x] ✅ 🤖📱 En el 13 mini, la tarjeta y los 4 botones caben sin scroll (🤖 comprobado en WebKit a 375×812 y a 320×568, y con un teclado simulado de 336 px; falta el iPhone real)

### Fase 6 — Sincronización y copias

**6a · Sincronización iPhone ↔ PC**
- [x] (docs) Neon (driver HTTP 1.x) y Vercel Functions
- [x] 👤 Añadir Neon desde el Marketplace de Vercel (región de Frankfurt; crea `DATABASE_URL`) y comprobar que `APP_SECRET` está en Vercel · hecho: `/api/sync` crea la tabla `records` y responde `pull` vacío en producción (comprobado el 2026-10-28)
- [ ] 👤 Primera subida real: abrir la app en el PC y pulsar «Sincronizar ahora» en Ajustes; luego compruebo que los registros están en Neon (la sentencia de subida `INSERT … ON CONFLICT` solo se ha ejecutado contra PGlite)
- [x] Tabla `records` con índice por `seq` (B11) · SQL en `src/server/sync/sqlStore.ts` (`schemaStatements`); 🤖 probado con PGlite (Postgres real compilado a WebAssembly) y, en Neon real, la creación de la tabla y la lectura (`pull`); la subida se verá con la primera sincronización
- [x] `api/sync.ts`: autenticación; *push* (*upsert* solo si el `updated_at` entrante es mayor, `seq` nuevo en cada cambio, lotes ≤ 500 registros y ≤ ~1 MB); *pull* (`seq` mayor que el cursor, paginado); validación con Zod
- [x] Núcleo puro de fusión, comprobable sin base de datos
- [x] Cliente `src/sync/`: *push* desde `outbox` (solo se vacía lo que no cambió durante el envío), *pull* con cursor en `deviceSettings` y solape pequeño (R5), aplicación local por última escritura sin re-encolar, `logs` solo añaden, primera sincronización completa (re-encola todo lo local)
- [x] Disparadores: al abrir y al volver (`visibilitychange`), ~5 s tras un cambio (*debounce*), cada 5 min y botón «Sincronizar ahora»; un solo ciclo a la vez
- [x] Indicador discreto (sincronizado · pendiente · sin conexión · error) en Hoy y Ajustes; banner si pasan más de 7 días sin sincronizar
- [x] Documentar en `DECISIONS.md` cómo se resuelven los conflictos

**6b · Copias de seguridad**
- [x] Exportar JSON (`schemaVersion`, `exportedAt` y todas las tablas) con Web Share API (`File`) o descarga directa
- [x] Importar: validación con Zod, vista previa de recuentos, **Fusionar** (por `id`; gana el `updatedAt` mayor) y **Reemplazar todo** (con confirmación; B10)
- [x] Ajustes: almacenamiento persistente concedido o no, estimación, estado de la sincronización y secreto (secciones «Acceso», «Sincronización», «Copia de seguridad» y «Almacenamiento»)
- [x] Tests: conflicto resuelto por última escritura, borrado lógico propagado, *outbox*, cursor y paginación, ida y vuelta exportar → borrar → importar

**Criterios de aceptación**
- [ ] ✅ 📱 (🤖 comprobado con dos dispositivos simulados: WebKit móvil y Chromium de escritorio contra el manejador real de `/api/sync`) Añado una palabra en el iPhone y aparece en el PC en menos de un minuto tras abrir la app
- [ ] ✅ 📱 (🤖 comprobado sin conexión → con conexión en WebKit) Repaso sin conexión en el iPhone y, al volver la conexión, se sincroniza sin perder registros
- [x] ✅ 🤖 Tests: última escritura, borrado lógico propagado y exportar → borrar → importar

### Fase 7 — Juegos I

- [x] Infraestructura común (§8; lógica en `src/games/`, pantallas en `src/features/games/`): pantalla Juegos con carga diferida por juego; alcance (Todo · Tema · Fuente · Rebeldes · Últimas añadidas); selección ponderada (por defecto solo palabras vistas al menos una vez en repaso); 10 rondas o temporizador; registro en `ReviewLog` con `game:<id>` y en `stats`; efecto en el calendario (un fallo adelanta a hoy, un acierto no toca); feedback inmediato con audio; resumen con récord (`GameResult`); bloqueo «Necesitas N palabras para jugar»
- [x] Generador reutilizable de distractores (mismo tipo de palabra y, si se puede, mismo tema)
- [x] Parejas: cuadrícula 3 × 4; inglés ↔ español, palabra ↔ definición y, en avanzado, palabra ↔ IPA; cronómetro y mejor tiempo (mín. 6 palabras)
- [x] Huecos: tu frase original o un ejemplo (rotando entre tus frases y los ejemplos de todas las acepciones); 4 opciones del mismo tipo de palabra; exige la forma correcta; nivel 2 escribiendo (mín. 4)
- [x] Formas verbales: irregulares primero; acepta variantes británicas (*learnt/learned*, *spelt/spelled*, *dreamt/dreamed*) (mín. 5 verbos)
- [x] Familias: ranuras sustantivo / adjetivo / adverbio o completar frase (mín. 4 entradas con familia)
- [x] Enlaces pendientes de fases anteriores: «Jugar con las falladas» (resumen del repaso), «Jugar con esta serie», juego sugerido en Hoy y «Jugar» en Rebeldes
- [x] Tests de generadores con aleatoriedad inyectable: distractores del mismo tipo, mínimos de palabras, selección ponderada y efecto en el calendario

**Criterios de aceptación**
- [x] ✅ 🤖 Tests de los generadores: distractores del mismo tipo de palabra y mínimos de palabras
- [ ] ✅ 🤖📱 Las cuadrículas caben a 375 px de ancho (🤖 comprobado en WebKit a 375 y 320 px y en Chromium a 1280 px: sin recortes ni desbordes, también con textos muy largos; falta verlo en el iPhone real)

### Fase 8 — Juegos II

- [ ] Dictado: suena la palabra en RP y luego una frase corta; repetir y lento; ortografía británica estricta (B12) (mín. 5 palabras)
- [ ] Conexiones: generador local con 6 tipos de vínculo (tema, fuente, tipo de palabra, familia, sinónimos, patrón verbal); garantía de que ninguna palabra encaja en dos grupos; 4 vidas; cada grupo resuelto revela su vínculo con un color (mín. 16 palabras que formen 4 grupos válidos)
- [ ] Historia: acción `story` en `/api/ai` (esquema Zod y prompt); selección de 6–8 de mis palabras más débiles; lectura y audio con palabras pulsables; versión con huecos y banco de palabras; requiere conexión; los índices de `targets` se recalculan en el cliente (R12); se guarda en `stories` y se reutiliza antes de pedir otra
- [ ] Tests: Conexiones sin ambigüedad (muchas semillas y datos sintéticos), validación y recálculo de `targets`, generación de huecos

**Criterios de aceptación**
- [ ] ✅ 🤖 Los grupos de Conexiones no tienen ambigüedad
- [ ] ✅ 🤖📱 La historia generada se guarda y no se vuelve a pedir

### Fase 9 — Progreso y pulido final

- [ ] Pantalla Progreso con gráficos SVG propios en la paleta pastel: racha, repasos de los últimos 30 días, % de aciertos de 30 días, distribución por estado, previsión de 7 días, palabras añadidas por semana y las 10 más falladas (solo `origin: 'review'` cuenta como repaso)
- [ ] Pulido visual y de animaciones: transiciones entre pantallas, estados vacíos, esqueletos y `prefers-reduced-motion`
- [ ] Accesibilidad: etiquetas para VoiceOver, foco en hojas y diálogos, contraste AA y navegación por teclado en escritorio
- [ ] Rendimiento: carga diferida por pantalla y por juego, fuentes y ausencia de saltos de maquetación
- [ ] Lighthouse en móvil y en escritorio
- [ ] README final en español (los 8 apartados de §17) y `DECISIONS.md` revisado
- [ ] Auditoría final contra el documento original y repaso de este `PLAN.md`

**Criterios de aceptación**
- [ ] ✅ 🤖 Lighthouse ≥ 90 en rendimiento y accesibilidad, en móvil y en escritorio

---

## 6. Piezas que se cablean en fases posteriores

Para que no queden botones muertos ni trabajo duplicado:

| Elemento | Se construye en | Se conecta en |
|---|---|---|
| Botón + de la barra | Fase 1 (marcador) | Fase 2 (hoja real) |
| «Añadir» desde la familia de palabras | Fase 3 | Usa la hoja de la Fase 2 |
| Regenerar ejemplos (IA) | Fase 3 (botón) | Usa `enrich` con `examples_only` de la Fase 2 |
| «Pendientes de completar (N)» | Fase 4 (filtro en Vocabulario) | Fase 5 (acceso en Hoy) |
| «Repasar esta serie» | Fase 4 (botón oculto en la página de fuente) | Fase 5 |
| «Rebeldes (N)» y su lista | Fase 5 | «Jugar» llega en la Fase 7 |
| «Jugar con las falladas», «Jugar con esta serie», juego sugerido en Hoy | Fase 7 | Fase 7 |
| Indicador de sincronización en Hoy | Fase 6 | Fase 6 |
| Dictado, Conexiones e Historia en la pantalla Juegos | Fase 8 | Tarjetas bloqueadas («Próximamente») hasta entonces |
| Progreso de la palabra (últimos 10 intentos) | Fase 3 (interfaz) | Datos reales desde la Fase 5 |
| Pantalla Progreso | Fase 9 | Marcador hasta entonces |

## 7. Riesgos

| # | Riesgo | Mitigación | Fases |
|---|---|---|---|
| R1 | **No tengo un iPhone real** (trabajo en Windows). El teclado virtual, el audio, las *safe areas*, la instalación y el service worker en iOS pueden fallar sin que mis pruebas lo vean. | Playwright con WebKit y perfil iPhone 13 mini para la maquetación. Al cerrar cada fase te dejo una lista corta «pruébalo así en el iPhone». Los ✅ marcados con 📱 los confirmas tú. | 1–3, 5 |
| R2 | **Audio UK de la Free Dictionary escaso y poco fiable** (apartado 4). Si el iPhone no tiene una buena voz británica, la pronunciación será floja. En iOS, el audio automático al mostrar la palabra necesita un gesto previo. | Vía principal: `speechSynthesis` con `en-GB`. El mp3 solo se usa si es `-uk`/`_gb_`, con tiempo límite y salto inmediato a voz sintética. `fetch` → Blob evita las peticiones `Range` de Safari. El gesto de «Empezar» y de cada valoración desbloquea el audio. Guía para descargar voces mejoradas en Ajustes. | 2–3 |
| R3 | **IA: latencia, calidad y coste.** El objetivo de menos de 3 s es ambicioso: la latencia depende de los ~1.000–1.500 tokens de salida (medido en la Fase 2: 5,3 s de media con el pensamiento desactivado y 12–16 s con el adaptativo) y el primer uso de un esquema nuevo paga compilación. Haiku puede errar IPA RP, formas o familia. | `effort: 'low'`, `max_tokens` ajustado, esquema simple y región `fra1`. Esqueleto animado y vista previa editable. Zod con un reintento y campos vacíos si hay duda. `refusal` y `max_tokens` van a `pending_ai` con el respaldo. Si la calidad no convence, `ANTHROPIC_MODEL=claude-sonnet-5-5` sin tocar código. Mido latencia y coste reales en la 2a. | 2 |
| R4 | **Seguridad del secreto compartido.** Sin login, quien lo tenga puede gastar tu crédito de Anthropic y leer o escribir tus datos. | Secreto largo y aleatorio, comparación en tiempo constante, límites de entrada, solo HTTPS, nunca en el repo ni en logs, límite mensual de gasto en la consola de Anthropic. Rotarlo = cambiar la variable en Vercel y reintroducirlo en cada dispositivo. | 2, 6 |
| R5 | **Sincronización.** (a) `bigserial` puede publicar `seq` fuera de orden entre transacciones concurrentes y un cliente saltarse filas. (b) «Gana la última escritura» depende de los relojes. (c) Cuerpo máximo de 4,5 MB. (d) La primera consulta a Neon tras inactividad tarda ~1 s. (e) «Reemplazar todo» puede resucitar datos. | (a) *Pull* con solape pequeño, idempotente por `updatedAt`. (b) Aceptado por diseño (un solo usuario); los `logs` solo añaden, así que el historial no se pierde aunque se sobrescriba el estado de una tarjeta. (c) Lotes de ≤ 500 registros y ≤ ~1 MB. (d) La sincronización va en segundo plano. (e) Borrado lógico (B10). | 6 |
| R6 | **Funciones de Vercel con código compartido.** `api/` importa `src/shared` (Zod); Vercel no admite alias `paths`; el proyecto es ESM y la resolución de extensiones en TypeScript puede fallar solo en producción. | Spike `/api/health` en la Fase 1, probado en desarrollo y en Vercel. Imports relativos. Si falla: extensiones explícitas o empaquetar `api/` con esbuild. | 1 |
| R7 | **Almacenamiento y actualizaciones en iOS.** La app instalada tiene almacenamiento separado de Safari; `persist()` puede denegarse; el service worker nuevo solo se activa al cerrar y reabrir. | Onboarding, sincronización, banner de 7 días y exportación. Aviso «Nueva versión · Actualizar». Solución de problemas en el README. | 1, 6, 9 |
| R8 | **Teclado virtual en iOS** (hoja de añadir y tarjeta de producción): `visualViewport` y `dvh` se comportan distinto en modo instalado. | Hook de `visualViewport`, pruebas con Playwright WebKit y verificación tuya en el iPhone antes de cerrar las fases 2 y 5. | 2, 5 |
| R9 | **Huecos fiables** (tarjeta de producción, Huecos, Dictado) con formas flexionadas y phrasal verbs (*went*, *gave up*). | B4 (`target` en los ejemplos) y respaldo por formas conocidas; si no se localiza, la tarjeta pide la forma base. | 2, 5, 7 |
| R10 | **Deshacer** debe revertir tarjeta, log, estadísticas, marca de rebelde, desbloqueo de la hermana y `outbox`. | Instantánea previa en memoria, una sola transacción y tests dedicados. | 5 |
| R11 | **Conexiones:** con pocas palabras puede no haber 4 grupos sin ambigüedad. | El juego aparece bloqueado hasta que sea posible; generador conservador; tests con datos sintéticos y muchas semillas. | 8 |
| R12 | **Historia:** los modelos suelen contar mal los índices `start`/`end` de `targets`. | Se recalculan buscando `surfaceForm`; los que no aparecen se descartan; los huecos los genera el cliente. | 8 |
| R13 | **IPA y tipografías:** los subconjuntos `latin` de @fontsource probablemente no cubran todos los símbolos IPA. | Banner de glifos en la Fase 1; si falla, cargar los subconjuntos necesarios de Noto Sans solo para la IPA. | 1, 3 |
| R14 | **Versiones muy nuevas** (Vite 8, React Router 8, Vitest 5, vite-plugin-pwa 2…) con dependencias entre pares y versiones de Node ajustadas (ya: React Router 8 exige Node ≥ 22.22 y aquí hay 22.17.1). | Instalar versiones mutuamente compatibles, leer los changelogs y anotarlo en `DECISIONS.md`; si algo no encaja, bajar solo esa pieza. | 1 |
| R15 | **Windows → Linux** (Vercel construye en Linux): mayúsculas en imports, saltos de línea CRLF, scripts de shell. | `forceConsistentCasingInFileNames`, `.gitattributes` y scripts npm en Node (no en bash). | 1 |

## 8. Dudas y decisiones

### A. Necesito tu respuesta antes de la Fase 1

| # | Pregunta | Mi propuesta |
|---|---|---|
| A1 | **Nombre de la app.** El documento no lo fija y lo necesito para el manifest, el título bajo el icono del iPhone y el monograma. | `name`: «Improve Your Vocabulary» · `short_name`: «Vocab» (cabe bajo el icono) · monograma «V» en serif sobre fondo oscuro, con el acento champán. |
| A2 | **Despliegue.** `origin` ya apunta a `github.com/Joncarre/improve-your-vocabulary` y no hay `gh` ni `vercel` instalados. | 👤 Tú: importar el repo en Vercel una sola vez (luego cada push a `main` despliega solo), poner las variables de entorno y, en la Fase 6, añadir Neon. 🤖 Yo: `git push origin main` al cerrar cada fase. ¿Me das permiso permanente para ese push, prefieres hacerlo tú o que te lo pida cada vez? |

*Estado: A1 sin respuesta, se aplica la propuesta («Improve Your Vocabulary», «Vocab», monograma «V»). A2 sigue abierta: hace falta tu respuesta para el push a GitHub y la importación en Vercel.*

### B. Decisiones que aplicaré salvo que me digas lo contrario

Se registrarán, con fecha, en `DECISIONS.md` al empezar la Fase 1.

| # | Decisión | Por qué |
|---|---|---|
| B1 | Guardo una copia del documento original en `docs/SPEC.md`. | El prompt de IA, los tokens y las reglas viven solo en este chat; así sobreviven entre sesiones. |
| B2 | Tabla `stories` en el esquema v1 (sincronizable: `id`, `updatedAt`, `deletedAt?`, título, textos, `targets`, ids de palabras y nivel). | La Fase 8 pide guardar la historia, pero el modelo de datos no la incluye; el esquema «completo» de la Fase 1 debe tenerla. |
| B3 | `sharedSettings` y `deviceSettings` son dos tablas de una fila (en lugar de `settings`). El secreto, la voz, la velocidad, el audio automático y el cursor de sincronización van en `deviceSettings`. | El índice de §4 dice `settings`, pero el texto distingue las dos. |
| B4 | `enrich` devuelve dos campos opcionales más: `examples[].target` (forma exacta usada en cada ejemplo) y `contextSurface` (fragmento exacto de tu frase que corresponde a la palabra o unidad). | Sin ellos, los huecos y el resaltado de tu frase tendrían que adivinar *went*, *gave up*, *off on one*. Con respaldo por formas conocidas. |
| B5 | **Rebelde** = 6 recaídas de FSRS (`lapses`: «Otra vez» en una tarjeta que ya estaba en repaso). Los fallos en juegos no cuentan. | «6 fallos en repaso» admite varias lecturas; es la definición estándar de Anki y no depende de los juegos. |
| B6 | La tarjeta de **producción** se desbloquea cuando la de reconocimiento sale de aprendizaje y es exigible desde el **inicio del siguiente día de estudio**. | Respeta la regla de hermanas (nunca el mismo día). |
| B7 | **Casi sinónimas el mismo día:** no hay campo de categoría semántica, así que uso `synonyms`/`antonyms` cruzados y la primera acepción en español idéntica. Los temas situacionales no cuentan como interferencia (son los que ayudan). | Aproximación simple y comprobable con tests. |
| B8 | **Repaso extra** («Repasar esta serie»): `ReviewLog.origin` admite también `'extra'`. Actualiza `stats`, pero no toca FSRS ni `due`, y no cuenta en las gráficas de repasos. | El modelo solo prevé `review` y `game:*`. |
| B9 | «Tarjetas de producción: desactivadas» solo **filtra la cola**: no borra ni crea tarjetas; al reactivarlas vuelven con su estado. | Reversible y sin migraciones. |
| B10 | «**Reemplazar todo**» al importar con la sincronización activa: lo que no esté en el archivo se marca como borrado (borrado lógico con `updatedAt` nuevo) y se sube, con aviso explícito. | Si no, el servidor lo devolvería en la siguiente sincronización. |
| B11 | La tabla `records` se crea sola (`CREATE TABLE IF NOT EXISTS`) en la primera llamada a `/api/sync`; el SQL queda también en el repo por si prefieres ejecutarlo a mano. | Un paso menos para ti. |
| B12 | **Dictado** estricto con ortografía británica (la americana cuenta como error, con la pista «en inglés británico: colour»); la tarjeta de producción acepta variantes UK y US. | El documento pide «comprueba ortografía británica» en Dictado y «variantes válidas» en producción. |
| B13 | **TypeScript 7.0.2 con Oxlint** (como la plantilla oficial de Vite; sustituye al plan inicial de ESLint + TypeScript 6), **ts-fsrs 5.4.2** (no la 6.0 beta) y **React Router 7.18** (la 8 exige Node ≥ 22.22). | Apartado 4. Revisada en la Fase 1. |
| B14 | `--text-3` pasa de `#71717A` a **`#86868F`**; el resto de tokens, igual. | Cumplir AA como texto pequeño (de 4,09 a 5,48:1 sobre `--bg`; 4,70:1 sobre `--surface-2`). |
| B15 | **Índice de tarjetas:** se indexa solo `due` y `suspended` se filtra en código. | IndexedDB no admite booleanos como clave; `[suspended+due]` dejaría las tarjetas fuera del índice sin avisar. |
| B16 | **Adelanto mínimo en la Fase 1:** endpoint `/api/health` y el middleware de Vite que monta `api/*.ts` en desarrollo (lo reutilizan `/api/ai` y `/api/sync`). | Para descubrir pronto problemas de la cadena TS/ESM entre `api/` y `src/shared` (R6). |
| B17 | **Verificación:** capturas y comprobaciones con Playwright (Chromium y WebKit con perfil iPhone 13 mini, 320 px y 1280 px) y Lighthouse con `npx`, fuera del `package.json` (descarga unos 300 MB fuera del repo). Lo que solo se ve en un iPhone real lo compruebas tú (📱). | No añaden dependencias a la app. |
| B18 | **La IA se mantiene** (el usuario la descartó y después la aprobó si el coste es bajo). Necesita una clave de API de pago por uso, distinta de Claude Pro; coste estimado de 0,001–0,002 $ por ficha. Queda aislada en `/api/ai`: sin clave, la app funciona con el diccionario gratuito y a mano. | Decisión del usuario el 2026-10-28. |

---

*Historial del plan: 2026-10-28 · versión 1 · versión 2 tras la Fase 1 (Oxlint y TypeScript 7, React Router 7, IA confirmada).*
