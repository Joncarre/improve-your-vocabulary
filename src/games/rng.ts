/** A source of numbers in [0, 1): `Math.random` in the app, a seeded one in the tests. */
export type Rng = () => number

/** Small deterministic generator (mulberry32): the same seed always gives the same sequence. */
export function seededRng(seed: number): Rng {
  let state = seed | 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A shuffled copy (Fisher-Yates). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const a = result[i] as T
    result[i] = result[j] as T
    result[j] = a
  }
  return result
}

const MIN_WEIGHT = 1e-6

/**
 * `count` different items drawn with probability proportional to their weight (Efraimidis-Spirakis:
 * each item gets the key u^(1/weight) and the largest keys win). Heavier items come first on average.
 */
export function weightedSample<T>(items: readonly T[], weight: (item: T) => number, count: number, rng: Rng): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(Math.max(rng(), 1e-12), 1 / Math.max(weight(item), MIN_WEIGHT)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, Math.max(0, count))
    .map(({ item }) => item)
}
