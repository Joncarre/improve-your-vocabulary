> Copia literal del documento inicial del proyecto (2026-10-28), guardada para que sobreviva entre sesiones. Lo que se aparta de él está registrado en [DECISIONS.md](../DECISIONS.md) y el plan de trabajo en [PLAN.md](../PLAN.md).

---

# Prompt: app web personal para aprender vocabulario en inglés británico (RP)

> **Cómo usar este documento:** abre una carpeta vacía con tu agente de código (por ejemplo, Claude Code) y pégale este documento entero como instrucción inicial. Todo lo que sigue está escrito para él.

---

## 0. Tu papel y forma de trabajar

Eres un/a ingeniero/a full-stack sénior con buen criterio de diseño de producto. Vas a construir desde cero una aplicación web progresiva (PWA) para **un único usuario: yo**. La usaré sobre todo desde el icono en la pantalla de inicio de mi iPhone 13 mini, y también en el PC.

> ### ⚠️ Trabaja por fases. Es obligatorio.
>
> No construyas la app de una sola vez. Divide el desarrollo en las fases de la **sección 15**, empezando por la Fase 0 (planificación), y completa **una fase cada vez**. Cada fase termina con la app funcionando, los tests en verde, un commit y un resumen. Después **te detienes y esperas mi confirmación** antes de empezar la siguiente. Así el resultado será más robusto y más fácil de revisar y corregir.

Reglas:

- Sigue al pie de la letra el método de trabajo de la sección 15.
- **No añadas funcionalidades** que no estén aquí. Si algo es ambiguo, elige la opción más simple que cumpla el objetivo y anótala en `DECISIONS.md`.
- Antes de usar una librería, **consulta su documentación actual** (ts-fsrs, Dexie, vite-plugin-pwa, Anthropic SDK, Vercel Functions). Instala las últimas versiones estables; no fijes versiones de memoria.
- Código, nombres y comentarios en **inglés**. Interfaz en **español de España**. Contenido de aprendizaje en **inglés británico (RP)** con ortografía británica (*colour, realise, travelling*).
- TypeScript estricto. Nada de `any` sin justificar.

---

## 1. Objetivo

Aprender y retener el vocabulario inglés que me encuentro en series, películas, libros, podcasts o en cualquier sitio. El flujo central:

1. Oigo o leo algo que no entiendo → lo apunto en la app **en menos de 10 segundos**: la palabra y, si puedo, la frase donde apareció y de qué serie o película es.
2. La app completa sola la ficha: significados, tipo de palabra, todas sus formas, familia de palabras, ejemplos, pronunciación RP con audio y temas.
3. La repaso con **repetición espaciada**: lo que fallo vuelve pronto; lo que acierto una y otra vez aparece cada vez menos.
4. Juego con mis palabras para crear **conexiones** entre ellas.

Principios: rapidez al añadir, aprendizaje en contexto, sesiones cortas, cero fricción, nada superfluo.

**Dispositivos:**

- **Móvil primero.** Mi dispositivo principal es un **iPhone 13 mini** (pantalla de 375 × 812 pt). La interfaz debe ser **compacta**: elementos de tamaño contenido para que todo quepa y se vea bien en una pantalla pequeña (detalles en la sección 12).
- **También PC.** La app debe ser **responsive** y cómoda en escritorio, con navegación y atajos de teclado propios.
- **Mismos datos en los dos.** Lo que añado o repaso en un dispositivo aparece en el otro (sincronización, sección 10).

---

## 2. Referentes (qué tomar de cada uno)

- **Anki con FSRS:** algoritmo moderno de repetición espaciada, 4 botones de valoración con el intervalo previsto visible, detección de tarjetas que se fallan una y otra vez ("sanguijuelas").
- **Sentence mining** (Refold, Language Reactor, Migaku): cada palabra se guarda con la frase real donde apareció y su fuente; la frase forma parte de la tarjeta.
- **Quizlet:** varios modos de práctica cortos que mezclan reconocimiento (elegir) y producción (escribir).
- **NYT Connections:** agrupar 16 palabras en 4 grupos ocultos. Es la base del juego "Conexiones".
- **Investigación sobre agrupación de vocabulario:** agrupar palabras por **tema o situación** (*pub, pint, round, cheers*) ayuda a aprenderlas; introducir a la vez palabras de la **misma categoría estrecha** o casi sinónimas (*eye, nose, ear*; *annoyed, irritated, cross*) tiende a generar interferencia. Aplícalo: temas situacionales, y no presentes como nuevas el mismo día palabras casi sinónimas.

---

## 3. Stack (decidido)

| Capa | Elección |
|---|---|
| Frontend | Vite + React + TypeScript |
| Estilos | Tailwind CSS v4 con tokens en variables CSS |
| Animaciones | Motion (framer-motion) |
| Iconos | lucide-react |
| Rutas | React Router |
| Base de datos local | IndexedDB con **Dexie** + `dexie-react-hooks` (`useLiveQuery`) |
| Sincronización | **Postgres serverless de Neon**, añadido desde el Vercel Marketplace (plan gratuito), con su driver HTTP (`@neondatabase/serverless`) dentro de una función de Vercel |
| Repetición espaciada | **ts-fsrs** (FSRS-6) |
| Validación | Zod, con esquemas compartidos entre cliente y servidor |
| PWA | vite-plugin-pwa (manifest, service worker, modo offline) |
| IA | Una sola función serverless en Vercel (`/api/ai`) con `@anthropic-ai/sdk`. Modelo por defecto `claude-haiku-5-5` (rápido y barato), configurable con `ANTHROPIC_MODEL` |
| Diccionario auxiliar | Free Dictionary API (`https://api.dictionaryapi.dev/api/v2/entries/en/<word>`, gratis y sin clave): grabaciones UK y respaldo si falla la IA |
| Voz | Web Speech API (`speechSynthesis`) con voz `en-GB` |
| Gráficos | SVG propio, sin librerías pesadas |
| Tests | Vitest |
| Hosting | Vercel (plan gratuito), repo en GitHub, npm |

**Arquitectura local-first con sincronización:**

- **Lectura y escritura en local.** La app lee y escribe siempre en IndexedDB, así que responde al instante y funciona sin conexión (metro, avión).
- **Sincronización en segundo plano.** Un endpoint de Vercel sincroniza con Postgres, de forma que el iPhone y el PC comparten los mismos datos y la nube actúa además como copia de seguridad.
- **Sin login.** Soy el único usuario: no hay cuentas; un secreto compartido protege los endpoints.

La clave de la API de Anthropic y la URL de la base de datos **nunca** llegan al cliente: viven solo en las variables de entorno de Vercel.

---

## 4. Modelo de datos (Dexie)

```ts
type PartOfSpeech =
  | 'noun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | 'conjunction'
  | 'pronoun' | 'determiner' | 'interjection'
  | 'phrasal_verb' | 'idiom' | 'expression';

type Register = 'neutral' | 'formal' | 'informal' | 'slang' | 'offensive' | 'old_fashioned';

interface Entry {
  id: string;                  // uuid
  lemma: string;               // forma base: "go", "give up", "go off on one"
  lemmaKey: string;            // lemma normalizado, para detectar duplicados
  seenForm?: string;           // lo que escribí si era forma flexionada: "went"
  kind: 'word' | 'phrasal_verb' | 'idiom' | 'expression';
  ipa: string;                 // RP con barras: "/ɡəʊ/"
  audioUrl?: string;           // grabación UK si existe
  senses: Sense[];             // la acepción de mi frase, primero
  forms?: Forms;
  family: FamilyMember[];      // misma raíz, otro tipo de palabra
  synonyms: string[];
  antonyms: string[];
  collocations: string[];      // "make a decision"
  learnerNote?: string;        // falsos amigos, errores típicos de hispanohablantes, trampas de pronunciación
  usNote?: string;             // diferencia con el inglés americano, si la hay
  cefr?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  topicIds: string[];          // 1–2 temas
  contexts: Context[];         // frases reales donde la encontré (puede haber varias)
  status: 'active' | 'archived' | 'pending_ai';
  isLeech: boolean;            // "rebelde"
  createdAt: number;
  updatedAt: number;
}

interface Sense {
  id: string;
  pos: PartOfSpeech;
  meaningEs: string;           // traducción en español de España
  definitionEn: string;        // definición sencilla en inglés (vocabulario B1)
  register: Register;
  examples: { en: string; es: string }[];  // 2 ejemplos
  matchesContext: boolean;     // true si es la acepción de mi frase
}

interface Forms {
  verb?: {
    base: string;
    thirdPerson: string;
    pastSimple: string[];       // ["learnt", "learned"]: variante británica preferida primero
    pastParticiple: string[];
    presentParticiple: string;
    irregular: boolean;
  };
  noun?: { plural?: string; countability: 'countable' | 'uncountable' | 'both' };
  adjective?: { comparative?: string; superlative?: string };
}

interface FamilyMember { word: string; pos: PartOfSpeech; meaningEs: string; example: string }

interface Context {
  id: string;
  sentence: string;            // tal como la vi u oí
  translationEs?: string;
  sourceId?: string;
  detail?: string;             // "T2 E5", "min 34", "cap. 3"
  addedAt: number;
}

interface Source { id: string; title: string; type: 'series' | 'film' | 'book' | 'podcast' | 'video' | 'other'; lastUsedAt: number }

interface Topic { id: string; nameEs: string; emoji: string; color: string }

interface Card {
  id: string;
  entryId: string;
  type: 'recognition' | 'production';  // EN→ES y ES→EN
  fsrs: FsrsCard;                      // objeto Card de ts-fsrs, serializado
  due: number;                         // copia indexable de fsrs.due
  unlocked: boolean;                   // production se desbloquea cuando recognition sale de "aprendizaje"
  suspended: boolean;
  stats: { seen: number; correct: number; wrong: number; streak: number; lastSeenAt?: number };
}

type GameId = 'match' | 'cloze' | 'verb_forms' | 'family' | 'dictation' | 'connections' | 'story';

interface ReviewLog {
  id: string;
  cardId: string;
  entryId: string;
  at: number;
  origin: 'review' | `game:${GameId}`;
  rating?: 1 | 2 | 3 | 4;      // solo en repasos
  correct: boolean;
  ms: number;                  // tiempo de respuesta
  fsrsLog?: unknown;           // ReviewLog de ts-fsrs, para deshacer y, en el futuro, optimizar parámetros
}

interface GameResult { id: string; game: GameId; at: number; score: number; total: number; durationMs: number }
```

- Índices mínimos: `entries: id, lemmaKey, status, *topicIds, createdAt, updatedAt` · `cards: id, entryId, due, type, [suspended+due]` · `logs: id, at, cardId, entryId, origin` · `sources: id, title, lastUsedAt` · `topics: id, nameEs` · `games: id, game, at` · `settings: id`.
- Esquema versionado con migraciones de Dexie desde el primer día.
- **Preparado para sincronizar desde la Fase 1:**
  - Todos los registros de las tablas sincronizables (`entries`, `cards`, `logs`, `sources`, `topics`, `games`, `sharedSettings`) llevan `id` UUID (nunca autoincremental), `updatedAt` y `deletedAt?` (borrado lógico; nunca se borra físicamente algo ya sincronizado).
  - Tabla local `outbox` con los ids pendientes de subir.
  - Los ajustes se dividen en `sharedSettings` (se sincronizan) y `deviceSettings` (solo en ese dispositivo).
- **Acierto** = valoración ≥ 2 (Difícil, Bien, Fácil) o respuesta correcta en un juego. **Fallo** = "Otra vez" o respuesta incorrecta. `streak` cuenta aciertos seguidos y vuelve a 0 con un fallo.

### Ajustes y valores por defecto

| Ajuste | Por defecto | Ámbito |
|---|---|---|
| Palabras nuevas por día | 10 | compartido |
| Retención objetivo (FSRS) | 0,90 (rango 0,85–0,95) | compartido |
| Tarjetas de producción (ES→EN) | activadas | compartido |
| El día empieza a las | 04:00 (veo series de noche) | compartido |
| Mostrar mi frase en el anverso | sí | compartido |
| Reproducir audio al mostrar la palabra | sí | dispositivo |
| Voz | la mejor voz `en-GB` disponible | dispositivo (las voces cambian entre iPhone y PC) |
| Velocidad de voz | 0,95 (botón "lento" a 0,7) | dispositivo |
| Secreto de la app (`APP_SECRET`) | se introduce una vez | dispositivo |

---

## 5. Añadir palabras (el flujo más importante)

- En el móvil, botón **+** central en la barra inferior, siempre a mano, que abre una hoja modal (bottom sheet). En escritorio, botón "Añadir" en la barra lateral (atajo `N`), que abre un diálogo centrado.
- En el iPhone 13 mini, con el teclado abierto, los campos y el botón "Analizar" deben seguir visibles. Ajusta la hoja con `visualViewport` para que el teclado no los tape.
- Campos:
  - **Palabra o expresión** (obligatorio, con foco automático; `autocapitalize="off"`, `autocorrect="off"`, `spellcheck={false}`).
  - **Frase donde la encontré** (opcional, multilínea, con botón "Pegar").
  - **Fuente** (opcional, con autocompletado). Si añadí otra palabra hace menos de 3 horas, propone la misma fuente y el mismo detalle ("modo maratón").
  - **Detalle** (opcional): "T2 E5", "min 34".
- **Analizar** → llama a `/api/ai` (`enrich`) → vista previa **editable** con todos los campos (puedo quitar acepciones, corregir la traducción o cambiar temas) → **Guardar**. Mientras carga, esqueleto animado; objetivo de menos de 3 s.
- **Formas flexionadas:** si escribo *went*, *children* o *better*, guarda el lema (*go*, *child*, *good*), conserva lo que vi en `seenForm` y muestra la nota "*went* es el pasado de *go*".
- **Unidad completa:** si en mi frase la palabra forma parte de un phrasal verb o una expresión (*She went off on one when she saw the bill* → *go off on one*), propón la unidad completa y déjame elegir qué guardar.
- **Duplicados:** si el `lemmaKey` ya existe, muestra "Ya la tienes" con la ficha y ofrece **añadir la frase como nuevo contexto** (sin duplicar tarjetas). Si la frase usa una acepción nueva, añádela a la entrada.
- **Sin conexión o error de IA:** guarda la entrada como `pending_ai` con lo que haya y complétala sola cuando vuelva la conexión. Se marca visualmente.
- **Respaldo sin IA:** si la IA no responde, rellena IPA, definición y audio desde la Free Dictionary API y deja el resto editable a mano.
- **Añadir varias:** pegar una lista (una por línea; opcionalmente `palabra — frase`). Se procesa en cola, de 2 en 2, con progreso visible.
- Al guardar se crean dos tarjetas: `recognition` (nueva) y `production` (bloqueada hasta que la de reconocimiento salga de aprendizaje).

---

## 6. Ficha de palabra

En este orden, con jerarquía visual clara:

1. **Cabecera:** lema grande, IPA RP, botón de altavoz y botón "lento", chips de tipo de palabra (con color por tipo), nivel CEFR y registro (aviso visible si es *slang* u *offensive*).
2. **Dónde la viste:** mis frases con la palabra resaltada, traducción plegable, fuente y detalle, altavoz para oír la frase.
3. **Acepciones agrupadas por tipo de palabra** (p. ej. *run* — verbo / sustantivo): significado en español, definición sencilla en inglés y 2 ejemplos con audio y traducción plegable. La acepción de mi frase va destacada.
4. **Formas:**
   - Verbo: base · 3.ª persona · past simple · past participle · -ing, con distintivo "irregular" y variantes (*learnt / learned*).
   - Sustantivo: plural y si es contable.
   - Adjetivo: comparativo y superlativo.
   - Cada forma con su altavoz.
5. **Familia de palabras:** chips con tipo (*decide* v → *decision* n → *decisive* adj → *decisively* adv → *indecisive* adj). Al tocar: si ya está en mi colección, abre su ficha; si no, botón "Añadir".
6. **Sinónimos, antónimos y colocaciones.**
7. **Nota para hispanohablantes:** falsos amigos (*actually* ≠ actualmente), errores típicos, letras mudas, diferencias UK/US.
8. **Relacionadas en tu colección:** misma familia, mismo tema o misma fuente (máximo 8).
9. **Progreso:** estado, veces vista, aciertos, fallos, % de acierto, racha actual, próxima revisión ("en 12 días") y los últimos 10 intentos como puntos verdes y rojos.
10. **Acciones:** editar, regenerar ejemplos (IA), archivar, reiniciar progreso, eliminar (con confirmación).

---

## 7. Repaso con repetición espaciada

### Algoritmo

- **ts-fsrs** con `request_retention` según ajustes, `enable_fuzz: true` y pasos de aprendizaje cortos (p. ej. 1 min y 10 min; reaprendizaje 10 min). Revisa en la documentación los nombres exactos de los parámetros.
- "Hoy" va de 04:00 a 04:00.

### Cola del día

- Entran: tarjetas en aprendizaje cuyo `due` ya pasó, repasos que vencen antes del fin del día y nuevas hasta el límite diario.
- Orden: aprendizaje cuando venza; repasos de menor a mayor *retrievability* (las más a punto de olvidarse primero); intercala 1 nueva cada 4 repasos.
- Al introducir nuevas el mismo día, evita juntar palabras casi sinónimas o de la misma categoría estrecha (ver sección 2).
- **Hermanas:** nunca muestres el mismo día la tarjeta de reconocimiento y la de producción de la misma palabra.
- Bloques de 20 tarjetas con opción de seguir. Si hay más de 150 repasos acumulados (vuelta de vacaciones), muestra primero los urgentes y no metas nuevas hasta bajar de 50.

### Tarjetas

- **Reconocimiento (EN → ES).** Anverso: palabra, IPA, altavoz (con reproducción automática según ajustes) y, opcionalmente, mi frase con la palabra resaltada. Al tocar, gira (3D) y muestra el reverso: la acepción de mi contexto destacada, formas, un ejemplo y la familia en una línea.
- **Producción (ES → EN).** Anverso: significado en español, tipo de palabra y una frase con hueco: *She ____ to leave. (decidir)*. Campo de texto opcional:
  - Si escribo, compara normalizando (minúsculas, espacios, apóstrofos tipográficos → rectos) y aceptando variantes británicas/americanas válidas y formas verbales correctas.
  - Exacto → sugiere "Bien". Un solo error de tecleo (distancia de Damerau-Levenshtein 1, si la palabra tiene más de 4 letras) → sugiere "Difícil" y resalta la diferencia. Incorrecto → sugiere "Otra vez".
  - Siempre puedo cambiar la valoración sugerida.

### Valoración

- 4 botones: **Otra vez / Difícil / Bien / Fácil**, con el intervalo previsto debajo de cada uno ("10 min", "2 d", "5 d", "12 d"), calculado con la vista previa del scheduler.
- Gestos: deslizar a la izquierda = Otra vez; a la derecha = Bien.
- **Deshacer** la última valoración (en el móvil es fácil equivocarse de botón).

### Estados de cada palabra

| Estado | Criterio |
|---|---|
| Nueva | nunca vista |
| Aprendiendo | en pasos de aprendizaje o reaprendizaje |
| En repaso | estabilidad < 21 días |
| Consolidada | estabilidad ≥ 21 días |
| Dominada | racha ≥ 5 aciertos sin fallo y estabilidad ≥ 60 días |

Una palabra dominada **no se descarta**: sigue apareciendo, pero cada vez más espaciada (meses). El estado de una entrada es el de su tarjeta activa más débil. Además existe "Archivar" para palabras que ya no me interesan.

### Rebeldes

- Al llegar a 6 fallos en repaso, la entrada se marca como **rebelde**. No se suspende.
- Aparece en la lista "Rebeldes" con tres acciones: regenerar ejemplos con IA, jugar con ellas o archivarla.

### Fin de sesión

Resumen con tiempo, % de aciertos, nuevas aprendidas y palabras a reforzar, más un botón **"Jugar con las falladas"**.

---

## 8. Juegos

### Reglas comunes

- Partidas de 1 a 3 minutos (10 rondas o temporizador).
- Alcance seleccionable: Todo · Un tema · Una fuente (serie) · Rebeldes · Últimas añadidas.
- Selección ponderada: más peso a las palabras con baja *retrievability*, falladas recientemente o aprendidas esta semana. Por defecto, solo palabras ya vistas al menos una vez en repaso.
- Cada respuesta se registra en `ReviewLog` con `origin: 'game:<id>'` y actualiza las estadísticas de la palabra.
- **Efecto en el calendario:** un fallo en un juego adelanta la tarjeta a hoy si su repaso estaba previsto para más adelante. Un acierto no toca el calendario (para no inflar el algoritmo).
- Feedback inmediato (verde o rojo, respuesta correcta y audio). Al final, resumen y récord personal.
- Si no hay palabras suficientes, el juego aparece bloqueado con "Necesitas N palabras para jugar".

### Los 7 juegos

1. **Parejas.** Cuadrícula de 12 fichas (6 pares). Variantes: inglés ↔ español, palabra ↔ definición en inglés y, en modo avanzado, palabra ↔ IPA. Cronómetro y mejor tiempo. Mínimo 6 palabras.
2. **Huecos.** Una frase (preferiblemente mi frase original; si no, un ejemplo) con un hueco y 4 opciones del mismo tipo de palabra, sacadas de mi colección y a ser posible del mismo tema. Exige la forma correcta (*went*, no *go*). Nivel 2: escribir la respuesta. Mínimo 4 palabras.
3. **Formas verbales.** Dado el verbo (en español o en base), escribir o elegir past simple y past participle. Prioriza los irregulares y acepta las variantes británicas (*learnt/learned*, *spelt/spelled*, *dreamt/dreamed*). Mínimo 5 verbos.
4. **Familias.** Dada una palabra (*decide*, v), colocar en las ranuras sustantivo / adjetivo / adverbio las fichas desordenadas; o completar una frase con la forma correcta: *She's very ____ (decide)* → *decisive*. Mínimo 4 entradas con familia.
5. **Dictado.** Suena la palabra en RP (y después una frase corta); escribo lo que oigo. Botones de repetir y lento. Comprueba ortografía británica. Mínimo 5 palabras.
6. **Conexiones.** 16 palabras para separar en 4 grupos de 4 con un vínculo oculto: tema, fuente, tipo de palabra, misma familia, sinónimos o patrón verbal. Se genera **en local** a partir de mis datos, comprobando que ninguna palabra encaje en dos de los grupos elegidos. 4 vidas; cada grupo resuelto revela su vínculo con un color. Mínimo 16 palabras que formen 4 grupos válidos.
7. **Historia.** La IA escribe un microrrelato (100–150 palabras, inglés británico, nivel acorde a mis palabras) usando 6–8 de mis palabras más débiles. Primero lo leo y lo escucho, con mis palabras resaltadas y pulsables; después aparece la versión con huecos y un banco de palabras. Requiere conexión. Guarda la historia generada para no repetir gasto.

---

## 9. Pantallas y organización

Navegación con 5 destinos: **Hoy · Vocabulario · [+] · Juegos · Progreso**. En el móvil es una barra inferior estilo iOS; en escritorio, una barra lateral (ver sección 12). Ajustes, desde un icono de engranaje en Hoy.

- **Hoy:** racha de días seguidos; tarjeta principal "X por repasar · Y nuevas · ≈ N min" con botón **Empezar**; juego sugerido con mis palabras débiles; acceso a "Rebeldes (N)" y "Pendientes de completar (N)" si los hay; indicador discreto del estado de sincronización.
- **Vocabulario:**
  - Búsqueda instantánea en inglés o español, sin distinguir acentos.
  - Vistas: Todas · Por tema · Por fuente · Por tipo de palabra.
  - Filtros por estado (nuevas, aprendiendo, dominadas, rebeldes, archivadas).
  - Orden: recientes, alfabético, más falladas, próxima revisión.
- **Temas:** los asigna la IA (máximo 2 por palabra), eligiendo de mi lista actual para no duplicar ("Comida" y "Food"). Deben ser **situacionales** ("En el pub", "Discusiones y enfados", "En la oficina"), no categorías gramaticales. Puedo renombrar, fusionar y cambiar emoji o color.
- **Fuentes:** página por serie o película con sus palabras y botones "Repasar esta serie" (repaso extra que no altera el calendario FSRS) y "Jugar con esta serie".
- **Progreso:** racha; repasos por día de los últimos 30 días (barras); % de aciertos de los últimos 30 días; distribución por estado; previsión de repasos para los próximos 7 días; palabras añadidas por semana; las 10 más falladas.

---

## 10. Datos: modo offline, sincronización y copias de seguridad

### Sincronización iPhone ↔ PC

- **Servidor:** endpoint `POST /api/sync`, protegido con el mismo `x-app-secret`. Usa una única tabla en Postgres:

  ```sql
  records(
    tbl        text,
    id         text,
    data       jsonb,
    updated_at bigint,
    deleted    boolean,
    seq        bigserial,
    primary key (tbl, id)
  )
  ```

  `seq` es un contador del servidor: sirve de cursor y evita depender de los relojes de los dispositivos.
- **Subida (push):** el cliente envía lo que hay en `outbox`. El servidor hace *upsert* solo si el `updated_at` entrante es mayor que el guardado (gana la última escritura) y asigna un `seq` nuevo.
- **Bajada (pull):** el cliente pide los registros con `seq` mayor que su último cursor y los aplica en local con la misma regla. Los `logs` solo se añaden, así que nunca entran en conflicto.
- **Cuándo se sincroniza:**
  - Al abrir la app y al volver a ella (`visibilitychange`).
  - Unos 5 s después de cada cambio (con *debounce*).
  - Cada 5 min mientras está abierta.
  - Con el botón "Sincronizar ahora" de Ajustes.
- **Primera sincronización de un dispositivo:** sube todo lo local y baja todo lo remoto. Por lotes de hasta 500 registros.
- **Indicador discreto:** sincronizado · pendiente · sin conexión · error. La app funciona igual sin conexión; la sincronización se reanuda sola.
- **Conflictos:** documenta en `DECISIONS.md` cómo se resuelven (por ejemplo, la misma tarjeta repasada en los dos dispositivos sin conexión). Con un único usuario, "gana la última escritura" basta.

### Almacenamiento local y copias

- Al arrancar, llama a `navigator.storage.persist()` y muestra en Ajustes si se concedió, junto con `navigator.storage.estimate()`.
- **Exportar:** JSON con `schemaVersion`, `exportedAt` y todas las tablas. Compartir con la Web Share API (`navigator.share` con un `File`) para guardarlo en Archivos o iCloud Drive; si no está disponible, descarga directa.
- **Importar:** validación con Zod, vista previa de recuentos y dos modos: **Fusionar** (por `id`; gana el `updatedAt` más reciente) o **Reemplazar todo** (con confirmación).
- **Aviso:** banner discreto si la sincronización lleva más de 7 días sin completarse. En ese caso, los datos solo están en ese dispositivo y conviene exportar.
- **Service worker:** precarga el esqueleto de la app; caché *CacheFirst* para las grabaciones mp3 de la Free Dictionary API (máximo 500). Todo funciona sin conexión salvo la IA.
- **Importante en iOS:** el almacenamiento de la app instalada en la pantalla de inicio es **independiente** del de Safari. Con la sincronización activa, ambos acaban teniendo los mismos datos, pero recomienda usar siempre el icono. Explícalo en el onboarding.

---

## 11. PWA (iPhone primero, también PC)

En el PC se usa desde el navegador o instalada como app: "Instalar" en Chrome/Edge, o "Añadir al Dock" en Safari para Mac. Todo lo que sigue sobre iOS es prioritario.

- **Manifest:** `name`, `short_name`, `display: "standalone"`, `start_url: "/"`, `scope: "/"`, `orientation: "portrait"`, `background_color` y `theme_color` oscuros, iconos 192 y 512 más uno *maskable*.
- **iOS no usa los iconos del manifest:** añade `apple-touch-icon` de 180×180, PNG opaco. Añade también `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style: black-translucent` y `viewport-fit=cover`, y respeta `env(safe-area-inset-*)`.
- **Icono:** un monograma elegante sobre fondo oscuro, hecho en SVG y rasterizado a todos los tamaños con un script.
- **Detalles de iOS:**
  - Inputs con `font-size` ≥ 16 px (evita el zoom automático).
  - `-webkit-tap-highlight-color: transparent`, `overscroll-behavior: none` y `100dvh`.
  - Nada que dependa de *hover*; zonas táctiles de al menos 44 pt.
- **Detección de modo instalado:** `matchMedia('(display-mode: standalone)')` o `navigator.standalone`. Si estoy en una pestaña de Safari en iOS, muestra una guía: Compartir → Añadir a pantalla de inicio → "Abrir como app web" activado.
- **Actualizaciones:** cuando haya un service worker nuevo, aviso discreto "Nueva versión · Actualizar".

### Audio y pronunciación

- **Palabra suelta:** primero, la grabación UK de la Free Dictionary API si existe (su URL suele contener `-uk` o `_gb_`), guardada en `audioUrl`. Si no hay, `speechSynthesis`.
- **Frases y ejemplos:** siempre `speechSynthesis`.
- En iOS, `speechSynthesis` solo funciona tras un gesto del usuario, y `getVoices()` puede devolver una lista vacía al principio. Espera al evento `voiceschanged` con un tiempo límite y fija siempre `utterance.lang = 'en-GB'`, aunque no encuentres el objeto de la voz.
- **Ajustes de voz:** lista de voces `en-GB` disponibles en el dispositivo, botón de prueba y velocidad. Incluye una nota: en el iPhone se pueden descargar voces británicas mejoradas en Ajustes → Accesibilidad → Contenido leído → Voces → Inglés (la ruta puede variar según la versión de iOS); si iOS las expone a la web, aparecerán en la lista.

---

## 12. Diseño

**Concepto:** biblioteca nocturna premium. Negro profundo, superficies con elevación sutil, **un único acento** cálido y tipografía editorial para las palabras. Todos los colores van en **tonos pastel**, suaves y poco saturados, que destacan con delicadeza sobre el fondo oscuro. Sobria, elegante, rápida. Debe sentirse como una app nativa de iOS bien hecha.

### Tokens

| Token | Valor |
|---|---|
| `--bg` | `#0A0A0C` |
| `--surface` | `#141418` |
| `--surface-2` | `#1C1C22` |
| `--border` | `rgba(255,255,255,0.07)` |
| `--text` | `#F4F4F5` |
| `--text-2` | `#A1A1AA` |
| `--text-3` | `#71717A` |
| `--accent` | `#E8D3AE` (champán pastel) |
| Otra vez / Difícil / Bien / Fácil | `#F2A7A7` (coral) / `#F3D58A` (mantequilla) / `#9FDCBF` (menta) / `#A9C8F2` (cielo) |

**Chips de tipo de palabra** (fondo del color al 14 % y texto en el color): sustantivo `#A9C8F2` (cielo) · verbo `#9FDCBF` (menta) · adjetivo `#CDB4F0` (lavanda) · adverbio `#F5C29E` (melocotón) · phrasal verb `#9EDFD6` (aguamarina) · expresión o idiom `#F2B5D4` (rosa) · otros `#B8B8C2` (gris suave).

**Reglas de color pastel:**

- Una sola paleta pastel para todo: valoraciones, chips, temas, aciertos y fallos en los juegos, gráficos y estados de sincronización. Los colores de los temas se eligen de esta misma paleta.
- Usa los pasteles sobre todo como texto, iconos, bordes y fondos tenues (10–16 % de opacidad).
- Si un elemento va relleno de color (un botón de valoración pulsado, una ficha acertada en un juego), el texto encima es oscuro (`--bg`), no blanco.
- Nada de colores saturados o fluorescentes. Si añades un color nuevo, sigue el mismo criterio: tono claro, poca saturación.
- Comprueba el contraste: los pasteles sobre `--bg` y el texto oscuro sobre pastel deben cumplir WCAG AA.

### Tipografía

- Interfaz: pila del sistema (`-apple-system, BlinkMacSystemFont, …`; en el iPhone es SF Pro).
- Palabras en tarjetas y fichas: serif editorial (Fraunces o Newsreader, autoalojada con `@fontsource`, subconjunto latino).
- IPA: comprueba que se ven bien `ˈ ˌ ː ə ɜ ʊ ɒ ʌ æ θ ð ʃ ʒ ŋ`. Si la fuente del sistema falla con algún símbolo, usa Noto Sans solo para la IPA.

### Tamaños compactos (móvil; referencia: iPhone 13 mini, 375 × 812 pt)

El diseño se hace **móvil primero** y se prueba antes que nada a 375 × 812. Debe verse bien hasta 320 px de ancho, sin scroll horizontal. Define esta escala como tokens de Tailwind:

| Elemento | Tamaño en móvil |
|---|---|
| Texto base | 15 px (interlineado 1,4) |
| Texto secundario / leyendas | 13 px / 12 px |
| Títulos de sección | 17 px seminegrita |
| Título de pantalla | 24–26 px (versión compacta del título grande de iOS) |
| Palabra en la tarjeta de repaso | 30–32 px |
| Palabra en la ficha | 28 px |
| IPA | 14 px |
| Chips | texto de 11–12 px, alto de 22 px |
| Iconos | 18–20 px; barra inferior 22 px con etiquetas de 10 px; alto de 49 pt + zona segura |
| Botones | 40 px de alto (los 4 de valoración, 44 px) |
| Inputs | 40 px de alto y **texto de 16 px** (si es menor, iOS hace zoom al enfocar) |
| Márgenes laterales / padding de tarjetas | 16 px / 12–16 px; separaciones de 8–12 px |
| Filas de la lista de vocabulario | unos 52 px (palabra + significado + chip) |

- **Elementos pequeños, zonas táctiles grandes.** Aunque un icono o chip se vea pequeño, su zona táctil mide al menos 44 × 44 pt (con padding o un pseudo-elemento).
- **Repaso sin scroll.** En el 13 mini, la tarjeta y los 4 botones de valoración caben en pantalla sin desplazarse. En la tarjeta de producción, con el teclado abierto, siguen visibles la frase con hueco y el campo de texto.
- **Juegos.** Las cuadrículas (Parejas 3 × 4, Conexiones 4 × 4) caben a 375 px de ancho. Los textos largos (*indecisively*) se ajustan solos al tamaño de la ficha (mínimo 11 px) sin desbordarse.
- **Densidad.** Prioriza mostrar más contenido útil por pantalla, sin parecer abarrotado: espacio en blanco medido, no excesivo.

### Responsive y escritorio

- Puntos de corte, de menor a mayor:
  - **< 768 px:** diseño móvil descrito arriba.
  - **768–1023 px:** el mismo diseño con más aire; contenido centrado.
  - **≥ 1024 px:** barra lateral fija (Hoy, Vocabulario, Añadir, Juegos, Progreso, Ajustes) en lugar de la barra inferior.
- En escritorio, el texto base sube a 16 px.
- Anchos máximos: tarjeta de repaso centrada, unos 480 px; juegos, unos 640 px; textos, unos 720 px.
- **Vocabulario en escritorio:** vista maestro-detalle (lista a la izquierda, ficha a la derecha).
- **Hoy en escritorio:** dos columnas.
- **Hover:** estados de *hover* solo bajo `@media (hover: hover)`.
- **Atajos de teclado en escritorio:**

  | Tecla | Acción |
  |---|---|
  | `Espacio` / `Enter` | girar la tarjeta |
  | `1` `2` `3` `4` | valorar |
  | `Z` | deshacer |
  | `N` | añadir palabra |
  | `/` | buscar |
  | `Esc` | cerrar |

  Una pista discreta muestra los atajos.

### Movimiento

- Volteo 3D de tarjeta (muelle de unos 350 ms), deslizamiento con física y transiciones suaves entre pantallas.
- Nada de confeti ni efectos estridentes. Respeta `prefers-reduced-motion`.

### Calidad

- 60 fps, sin saltos de maquetación, contraste WCAG AA y etiquetas accesibles en los botones de audio (VoiceOver).
- Estados vacíos con texto amable y cargas con esqueletos, no con spinners.
- Barra inferior y cabeceras con desenfoque (`backdrop-filter`) y títulos al estilo iOS en versión compacta.

**Evita:** colores saturados, degradados chillones, emojis por todas partes (solo en temas), sombras pesadas y tipografía sin jerarquía.

---

## 13. IA: endpoint y prompts

### Endpoint `POST /api/ai`

- Cuerpo: `{ action: 'enrich' | 'story', payload }`.
- Cabecera `x-app-secret`: debe coincidir con `APP_SECRET` (comparación en tiempo constante). Si no coincide, 401.
- Límites: palabra ≤ 80 caracteres, frase ≤ 400, lista de temas ≤ 50. Tiempo máximo de 25 s. Errores con mensajes claros en español para la interfaz.
- Usa la firma estándar `Request → Response` que admiten las Vercel Functions en `/api` (compruébalo en su documentación).
- En desarrollo, monta el mismo handler como middleware de Vite para que `npm run dev` funcione solo, leyendo `.env.local`.
- Usa **Structured Outputs** de la Messages API con un JSON Schema generado desde los esquemas Zod compartidos (https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Valida de nuevo con Zod y reintenta una vez si falla.
- Modelo: `process.env.ANTHROPIC_MODEL ?? 'claude-haiku-5-5'`.

### `enrich`

- Entrada: `{ input, context?, sourceTitle?, existingTopics: {id, nameEs}[], mode?: 'full' | 'examples_only' }`.
- Salida: los campos de `Entry` y `Sense` (sin ids ni estadísticas), más:
  - `alternativeUnit?` — la unidad completa propuesta (phrasal verb o expresión).
  - `contextTranslationEs?`
  - `newTopic?: { nameEs, emoji }`

System prompt base (en inglés; ajústalo si hace falta):

```text
You are an expert lexicographer of British English writing dictionary entries for a native speaker of Spanish from Spain.

Rules:
1. Identify the lemma. If the input is an inflected form (went, children, better), return the lemma and note the inflection.
2. If a context sentence is given, find the exact sense used there and put it first with matchesContext = true. If the word belongs to a phrasal verb, idiom or fixed expression in that sentence, return that unit in alternativeUnit. Translate the sentence into natural Spain Spanish.
3. IPA in modern British Received Pronunciation, following the conventions of the Oxford Learner's and Cambridge (UK) dictionaries: non-rhotic, /əʊ/ in GOAT, /ɒ/ in LOT, /ɑː/ in BATH words, /e/ in DRESS, /eə/ in SQUARE, primary and secondary stress marks, between slashes.
4. Use British spelling in every English string. If American English uses a different word or spelling, explain it briefly in usNote.
5. Senses: at most 4, most useful first. Include other parts of speech of the same word when they are common (e.g. "run" as a noun). Each sense: Spain Spanish meaning; simple English definition using B1 vocabulary; register; 2 natural, everyday British example sentences of 8–16 words, each with a Spain Spanish translation.
6. Forms: for verbs, every form, irregular flag, British variants first (learnt, learned). For nouns, irregular plural and countability. For adjectives, comparative and superlative.
7. Word family: real, common words sharing the root with a different part of speech (decide → decision, decisive, decisively, indecisive). At most 6. Never invent words.
8. Synonyms and antonyms: at most 4 each. Collocations: at most 5.
9. learnerNote (Spanish, max 2 sentences): only if genuinely useful — false friends, typical mistakes of Spanish speakers, silent letters or pronunciation traps.
10. Topics: pick 1–2 from the provided list. Topics are situational themes (at the pub, arguments, the office), not grammatical or taxonomic categories. Propose newTopic only if nothing fits.
11. Estimate the CEFR level.
12. Mark slang and offensive words accurately in the register.
13. If you are not sure about a field, leave it empty rather than guessing.
```

### `story`

- Entrada: `{ words: {lemma, pos}[], level }`.
- Salida: `{ title, textEn, textEs, targets: {lemma, surfaceForm, start, end}[] }`. La versión con huecos se genera en el cliente a partir de `targets`.
- Instrucción: microrrelato coherente y con algo de humor, 100–150 palabras, inglés británico, nivel indicado, usando todas las palabras (en la forma que encaje) y vocabulario sencillo en el resto.

---

## 14. Estructura del proyecto

```text
/
├─ api/
│  ├─ ai.ts                    # función serverless (enrich, story)
│  └─ sync.ts                  # sincronización con Postgres (Neon)
├─ src/
│  ├─ app/                     # router, layout, barra inferior (móvil) y lateral (escritorio)
│  ├─ features/
│  │  ├─ today/
│  │  ├─ add/
│  │  ├─ library/
│  │  ├─ entry/
│  │  ├─ review/
│  │  ├─ games/                # match, cloze, verb-forms, family, dictation, connections, story
│  │  ├─ progress/
│  │  └─ settings/
│  ├─ db/                      # esquema Dexie, migraciones, repositorios
│  ├─ srs/                     # wrapper de ts-fsrs, cola diaria, estados, rebeldes
│  ├─ audio/                   # voces, speak(), grabaciones UK
│  ├─ ai/                      # cliente del endpoint de IA
│  ├─ sync/                    # outbox, push/pull, cursor, indicador de estado
│  ├─ shared/                  # esquemas Zod usados por cliente y servidor
│  ├─ lib/                     # normalización, Damerau-Levenshtein, fechas, backup
│  ├─ ui/                      # Button, Sheet, Chip, Card, SpeakerButton, Skeleton…
│  └─ styles/                  # tokens y estilos base
├─ public/                     # iconos
├─ scripts/                    # generación de iconos
├─ tests/
├─ .env.example
├─ .gitignore
├─ PLAN.md                     # plan por fases con casillas (sección 15)
├─ DECISIONS.md
└─ README.md
```

Carga diferida (*code splitting*) por pantalla y por juego.

---

## 15. Desarrollo por fases (obligatorio)

### Método de trabajo

1. **Empieza por la Fase 0.** Lee este documento entero y crea `PLAN.md` con todas las fases de abajo, cada una dividida en tareas pequeñas con casillas (`- [ ]`), más los riesgos y las dudas que veas. Después **detente** y espera mi visto bueno. No escribas código de la app hasta entonces.
2. **Una fase cada vez.** No empieces la siguiente hasta que la actual cumpla sus criterios de aceptación (✅) y yo te lo confirme. No adelantes trabajo de fases posteriores, salvo lo que el propio documento pide preparar (por ejemplo, los campos de sincronización del modelo de datos).
3. **Cada fase termina con:**
   - `npm run build`, el linter y la comprobación de tipos sin errores.
   - Todos los tests en verde (`npm test`), los de esta fase y los de las anteriores.
   - Despliegue en Vercel (a partir de la Fase 1), para que pueda probarla en el iPhone.
   - Revisión visual a 375 × 812 (y a 320 px de ancho) y en escritorio a 1280 px.
   - `PLAN.md` actualizado con las casillas marcadas.
   - Un commit con un mensaje claro, por ejemplo `feat(fase-3): repaso con FSRS`.
   - Un resumen breve para mí: qué se ha hecho, cómo probarlo en el iPhone y en el PC, y problemas conocidos.
4. **No rompas lo anterior.** Si algo de una fase previa falla, arréglalo antes de seguir.
5. **Si una fase crece demasiado,** divídela en subfases (3a, 3b…) en lugar de ir con prisa.

### Fases

**Fase 0 — Plan**

- `PLAN.md` con fases, tareas, riesgos y dudas.
- ✅ Lo reviso y te doy el visto bueno.

**Fase 1 — Cimientos y despliegue**

- Proyecto, tokens de diseño y escala compacta, layout responsive (barra inferior en móvil, barra lateral en escritorio), esquema Dexie completo (incluidos `updatedAt`, `deletedAt` y `outbox`), PWA (manifest, iconos, service worker), Ajustes básicos y primer despliegue en Vercel.
- ✅ Se instala en el iPhone 13 mini, abre a pantalla completa sin interfaz de Safari y respeta la muesca y la zona inferior.
- ✅ No hay scroll horizontal a 320 px. En el PC se ve con barra lateral.
- ✅ El esqueleto carga sin conexión.

**Fase 2 — Añadir palabras con IA**

- Endpoint `/api/ai` (`enrich`), hoja o diálogo de añadir, vista previa editable, lema y unidad completa, duplicados, cola `pending_ai` y respaldo con la Free Dictionary API.
- ✅ Escribo *went* con la frase *We went to the pub after work* y obtengo la entrada de *go* con formas, familia, IPA RP correcta y ejemplos.
- ✅ Con *She went off on one when she saw the bill*, me propone guardar *go off on one*.
- ✅ Una palabra añadida sin conexión se completa sola al volver la conexión.
- ✅ En el 13 mini, con el teclado abierto, se ven los campos y el botón "Analizar".

**Fase 3 — Ficha y audio**

- Ficha completa (sección 6), grabación UK + síntesis de voz y ajustes de voz.
- ✅ El audio suena en el iPhone y en el PC; la IPA se ve bien en los dos.

**Fase 4 — Vocabulario, temas y fuentes**

- Pantalla Vocabulario (búsqueda, vistas, filtros y orden), gestión de temas, páginas de fuente y vista maestro-detalle en escritorio.
- ✅ La búsqueda responde al instante con 1.000 palabras de prueba.

**Fase 5 — Repaso**

- FSRS, cola diaria, los dos tipos de tarjeta, gestos y atajos de teclado, deshacer, estados, rebeldes y resumen de sesión.
- ✅ Tests de Vitest para el wrapper del scheduler, la construcción de la cola (incluidas las hermanas), el comprobador de respuestas (normalización, variantes UK/US, errores de tecleo) y los criterios de estado.
- ✅ En el 13 mini, la tarjeta y los 4 botones caben sin scroll.

**Fase 6 — Sincronización y copias**

- Neon, `/api/sync`, `outbox`, push/pull con cursor, indicador de estado, exportar e importar.
- ✅ Añado una palabra en el iPhone y aparece en el PC en menos de un minuto tras abrir la app.
- ✅ Repaso sin conexión en el iPhone; al volver la conexión, se sincroniza sin perder registros.
- ✅ Tests: conflicto resuelto por última escritura, borrado lógico propagado e ida y vuelta de exportar → borrar → importar.

**Fase 7 — Juegos I**

- Parejas, Huecos, Formas verbales y Familias.
- ✅ Tests de los generadores: distractores del mismo tipo de palabra y mínimos de palabras.
- ✅ Las cuadrículas caben a 375 px de ancho.

**Fase 8 — Juegos II**

- Dictado, Conexiones e Historia.
- ✅ Tests: grupos de Conexiones sin ambigüedad.
- ✅ La historia generada se guarda y no se vuelve a pedir.

**Fase 9 — Progreso y pulido final**

- Pantalla Progreso, pulido visual y de animaciones, accesibilidad, rendimiento y README final.
- ✅ Lighthouse ≥ 90 en rendimiento y accesibilidad, en móvil y en escritorio.

---

## 16. Fuera de alcance

Login, cuentas o multiusuario · sincronización en tiempo real o colaboración · notificaciones push · reconocimiento de voz para evaluar mi pronunciación · importación de subtítulos · gamificación tipo XP, ligas o insignias · anuncios y analíticas · otros idiomas de interfaz.

---

## 17. Archivos que debes crear

### `.gitignore`

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Builds
dist/
dist-ssr/
dev-dist/
build/
.output/
.vercel/

# Environment variables (never commit secrets)
.env
.env.*
!.env.example
*.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Tests and coverage
coverage/

# Caches
.cache/
.eslintcache
*.tsbuildinfo

# Editors and OS
.DS_Store
Thumbs.db
.idea/
.vscode/*
!.vscode/extensions.json
*.swp

# Local data exports
backups/
*.backup.json
```

### `.env.example`

```bash
# Clave de la API de Claude (platform.claude.com)
ANTHROPIC_API_KEY=
# Cadena larga y aleatoria; la introduces una vez en Ajustes de la app
APP_SECRET=
# Modelo para completar fichas e historias
ANTHROPIC_MODEL=claude-haiku-5-5
# Cadena de conexión de Postgres (la crea la integración de Neon en Vercel)
DATABASE_URL=
```

### `README.md` (en español), con:

1. Qué es la app y su stack.
2. Desarrollo local: `npm install`, copiar `.env.example` a `.env.local`, `npm run dev` y `npm test`.
3. Cómo obtener la clave de la API de Claude y generar `APP_SECRET`.
4. Despliegue en Vercel paso a paso: importar el repo de GitHub, añadir Neon desde el Marketplace de Vercel (crea `DATABASE_URL`), añadir el resto de variables de entorno y desplegar. Cómo se crea la tabla `records` (migración o script).
5. Instalación en el iPhone: abrir la URL en Safari → Compartir → Añadir a pantalla de inicio → "Abrir como app web" activado → abrir desde el icono → Ajustes → introducir el secreto. Recomendación: usar siempre la app desde el icono.
6. Uso en el PC: abrir la URL en el navegador (o instalarla), introducir el secreto en Ajustes y esperar a la primera sincronización.
7. Copias de seguridad: la nube ya guarda una copia; además, cómo exportar a iCloud Drive.
8. Solución de problemas: no se oye el audio (volumen, modo silencio, elegir otra voz en Ajustes), la IA o la sincronización no responden (secreto o variables de entorno), la app no se actualiza (cerrar y reabrir).

### `DECISIONS.md`

Registro breve y fechado de cada decisión que tomes donde este documento no sea explícito.
