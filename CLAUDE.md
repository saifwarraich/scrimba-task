# Lesson Engine — Claude Context

## What this app does
Takes a natural-language educational query (e.g. "Why is the sky blue?") and generates a fully animated visual lesson that plays in the browser like a video — no MP4 files. Each lesson is a sequence of self-contained HTML/CSS/SVG scenes with synchronized AI-generated narration audio.

## Tech stack
- **Backend:** Node.js + TypeScript + Fastify, runs on port 3000
- **Frontend:** Vite + vanilla TypeScript, runs on port 5173
- **AI (script + visuals):** Anthropic Claude (`claude-opus-4-5`)
- **AI (audio):** ElevenLabs TTS API
- **Streaming:** Server-Sent Events (SSE) for scene-by-scene delivery

## Environment
- `.env` lives at the **project root** (not inside `server/`)
- Server is launched from the project root via `npx tsx watch --env-file=.env server/index.ts`
- Required vars: `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `PORT`

## Running the app
```bash
npm install && cd server && npm install && cd ../client && npm install && cd ..
npm run dev        # starts both server + client via concurrently
```
Open http://localhost:5173

---

## Program flow (end to end)

```
User types query → POST /api/generate
  → server creates lessonId, stores LessonState in memory Map
  → kicks off runPipeline() async (does NOT await)
  → returns { lessonId } immediately

Client navigates to /player.html?id={lessonId}
  → opens EventSource to GET /api/lesson/:id/stream (SSE)

runPipeline() (server/index.ts):
  1. generateScript()        → 1 Claude call → 5-8 ScriptScene objects (JSON)
     → pushes `script_ready` event to all SSE clients

  2. generateAllScenes()     → up to 3 concurrent Claude calls (one per scene)
     + generateAudio()       → 1 ElevenLabs call per scene (runs after scene HTML ready)
     → as each scene finishes, pushes `scene_ready` event with { index, html, audioBase64, durationSeconds }

  3. When all scenes done → pushes `done` event, closes SSE connections
```

## SSE event types
| Event | Payload | When |
|---|---|---|
| `script_ready` | `{ totalScenes, scenes: ScriptScene[] }` | After step 1 |
| `scene_ready` | `{ index, html, audioBase64, durationSeconds }` | After each scene |
| `done` | `{ totalDuration }` | All scenes complete |
| `error` | `{ message }` | Any pipeline failure |

Scenes may arrive **out of order** (parallel generation) — always use `index` to place them correctly.

---

## Server internals (server/)

### `index.ts`
- In-memory `Map<lessonId, LessonState>` — no database
- `LessonState` holds: `query`, `status`, `script`, `scenes[]`, `sseClients` Set
- SSE route manually writes `Access-Control-Allow-Origin` header (bypasses Fastify CORS plugin because it uses `reply.raw.writeHead()`)
- Reconnecting clients receive already-completed scenes immediately on connect

### `pipeline/scriptGen.ts`
- One Claude call, returns JSON array of `ScriptScene`
- Each scene has: `index`, `title`, `narration`, `visualBrief`, `durationSeconds`
- Auto-strips markdown code fences from Claude response
- Retries once on JSON parse failure

### `pipeline/sceneGen.ts`
- One Claude call per scene, max 3 concurrent (controlled concurrency queue)
- Returns a complete self-contained HTML document (no external deps, no iframes, inline CSS + JS)
- Falls back to a plain text scene (title + narration on dark bg) if Claude returns invalid HTML after 1 retry
- The scene generation prompt is the most critical piece — visual quality depends entirely on it

### `pipeline/tts.ts`
- POST to ElevenLabs `/v1/text-to-speech/{voiceId}`
- Returns base64-encoded MP3 string
- Silently returns `''` on failure — lesson plays without audio rather than crashing

---

## Frontend internals (client/)

### `src/main.ts` (landing page)
- POSTs query to `http://localhost:3000/api/generate`
- On success, navigates to `/player.html?id={lessonId}&q={query}`

### `src/player.ts` (player engine)
Key state variables:
- `generatedScenes[]` — sparse array indexed by scene index, fills as SSE events arrive
- `currentIndex` — which scene is playing (-1 = not started)
- `playing` — boolean
- `sceneTimerRemaining` — ms left on current scene's auto-advance timer (used for pause/resume)

**Scene rendering:** Each scene HTML is injected into a sandboxed `<iframe srcdoc>` with `sandbox="allow-scripts"`. iFrames are created once and kept in a `iframes[]` array — only opacity changes on switch (400ms crossfade).

**Audio:** Web Audio API. Base64 → `Uint8Array` → `audioCtx.decodeAudioData()` → `AudioBufferSourceNode`. On pause, remaining time is saved; resume restarts from approximate offset.

**Auto-advance:** `setTimeout` set to `durationSeconds * 1000`. On pause, timer is cancelled and remaining time saved. If next scene isn't generated yet when timer fires, playback stalls until `onSceneArrived()` is called for that index.

**Track segments:** One `<div>` per scene. States: `loading` (shimmer), `pending` (solid border), `active` (white fill animates via CSS `transition: width linear`), `played` (full width, dimmed). Segments are clickable for seek.

**Keyboard shortcuts:** Space (play/pause), ←/→ (prev/next scene), R (restart)

---

## Design system
All UI uses CSS custom properties defined in `:root`. Key values:
- `--bg-page: #0d1117` — darkest background
- `--bg-card: #161b22` — panels, topbar, controls bar
- `--accent-purple: #6c4ff6` — primary CTA, active states
- `--font-sans: 'Inter'` — imported from Google Fonts
- `--font-mono: 'JetBrains Mono'` — used in time display and scene code

## Scene HTML requirements (Claude-generated)
Each scene must be:
- A complete `<!DOCTYPE html>` document
- Self-contained: all CSS in `<style>`, all JS in `<script>`, no external resources
- `body`: `width: 100vw; height: 100vh; overflow: hidden`
- Animations start automatically on page load
- No GSAP — only CSS keyframes + vanilla JS (`setTimeout`, `requestAnimationFrame`)
- Dark background (`#0d1117` or topic-appropriate dark gradient)
- Must animate — nothing static

## Known gotchas
- SSE CORS: must set `Access-Control-Allow-Origin` manually inside `reply.raw.writeHead()` — the `@fastify/cors` plugin does not apply to raw hijacked responses
- dotenv: `.env` is at project root; server must be launched from root (not `cd server && ...`) so `--env-file=.env` resolves correctly
- Scene index ordering: Claude scene calls run in parallel and may complete out of order; always sort/index by `scene.index`
- Audio context: browsers require a user gesture before `AudioContext` can play; the play button click satisfies this
- iframe animations: pausing requires `iframe.contentDocument.getAnimations().forEach(a => a.pause())` — CSS `animation-play-state` from outside the iframe does not work cross-document
