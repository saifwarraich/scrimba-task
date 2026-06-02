import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface CachedLesson {
  script: { index: number; title: string; narration: string; visualBrief: string; durationSeconds: number }[]
  scenes: { index: number; html: string; audioBase64: string; durationSeconds: number }[]
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Lives at server/.lesson-cache/ — one JSON file per query (gitignored).
const CACHE_DIR = path.join(__dirname, '..', '.lesson-cache')

// Normalize a query into a stable, filesystem-safe cache key.
function cacheKey(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function cacheFile(query: string): string {
  return path.join(CACHE_DIR, `${cacheKey(query)}.json`)
}

// Returns a cached lesson for this query, or null on miss / unreadable file.
export async function getCachedLesson(query: string): Promise<CachedLesson | null> {
  try {
    const raw = await fs.readFile(cacheFile(query), 'utf8')
    const data = JSON.parse(raw) as CachedLesson
    if (!data.script?.length || !data.scenes?.length) return null
    return data
  } catch {
    return null
  }
}

// Persist a freshly generated lesson (scenes + audio) so future runs replay it.
export async function saveCachedLesson(query: string, lesson: CachedLesson): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true })
    const scenes = [...lesson.scenes].sort((a, b) => a.index - b.index)
    await fs.writeFile(cacheFile(query), JSON.stringify({ script: lesson.script, scenes }, null, 2), 'utf8')
  } catch (err) {
    console.error('Failed to write lesson cache:', err)
  }
}
