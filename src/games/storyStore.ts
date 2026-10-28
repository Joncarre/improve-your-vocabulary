import { getActive, listActive, writeRecord } from '../db/repo.ts'
import { newId } from '../lib/id.ts'
import type { Entry, Story, StoryOutput } from '../shared/index.ts'
import { storyLevel } from './story.ts'

/** Every story that was made and kept, newest first. */
export async function loadStories(): Promise<Story[]> {
  return (await listActive('stories')).sort((a, b) => b.createdAt - a.createdAt)
}

/** Keeps a story the AI just wrote, so it is never asked for twice (spec §8). `entries` are the words it was written for. */
export async function saveStory(output: StoryOutput, entries: readonly Entry[], now = Date.now()): Promise<Story> {
  const story: Story = {
    id: newId(),
    title: output.title,
    textEn: output.textEn,
    textEs: output.textEs,
    targets: output.targets,
    entryIds: entries.map((entry) => entry.id),
    level: storyLevel(entries),
    createdAt: now,
    updatedAt: now,
  }
  return writeRecord('stories', story, { now })
}

/** Marks a story as played, so the next game asks for a new one instead of showing it again. */
export async function markStoryPlayed(id: string, now = Date.now()): Promise<void> {
  const story = await getActive('stories', id)
  if (story) await writeRecord('stories', { ...story, playedAt: now }, { now })
}
