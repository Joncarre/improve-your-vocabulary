import { listActive } from '../../db/repo.ts'

/** Everything the list and the source pages need, read together so they update as one. */
export async function loadLibrary() {
  const [entries, cards, topics, sources] = await Promise.all([
    listActive('entries'),
    listActive('cards'),
    listActive('topics'),
    listActive('sources'),
  ])
  return { entries, cards, topics, sources }
}
