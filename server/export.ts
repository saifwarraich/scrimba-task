import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

interface GeneratedScene {
  index: number
  html: string
  audioBase64: string
  durationSeconds: number
}

interface ExportLesson {
  query: string
  scenes: GeneratedScene[]
}

// Read the static assets once at startup. They live next to this module.
const TEMPLATE = readFileSync(fileURLToPath(new URL('./standalone/template.html', import.meta.url)), 'utf8')
const PLAYER_JS = readFileSync(fileURLToPath(new URL('./standalone/player.js', import.meta.url)), 'utf8')

// Escape a JSON string so it is safe to inline inside a <script> tag. The scene
// HTML contains literal "</script>", "</style>", and "<!--" sequences; escaping
// every "<" as < keeps the parser from ever leaving script context while
// remaining valid JSON/JS (it un-escapes back to the original text at parse time).
function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

// Builds a fully self-contained single-file HTML lesson: all scene HTML, the
// base64 narration audio, durations, and the player engine baked in. No server,
// no SSE, no network — it plays by opening the file in a browser. Sync is
// preserved because the embedded engine is a port of the live player (audio is
// the clock), reading from this baked-in array instead of a live connection.
export function buildStandaloneHtml(lesson: ExportLesson): string {
  const scenes = lesson.scenes
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((s) => ({
      index: s.index,
      html: s.html,
      audioBase64: s.audioBase64,
      durationSeconds: s.durationSeconds,
    }))

  const dataScript = `window.__LESSON__ = ${safeJsonForScript({ query: lesson.query, scenes })};`

  return TEMPLATE
    .replace('/*__LESSON_DATA__*/', () => dataScript)
    .replace('/*__PLAYER_JS__*/', () => PLAYER_JS)
}

// Derives a filesystem-friendly download name from the lesson query.
export function exportFilename(query: string): string {
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `lesson-${slug || 'untitled'}.html`
}
