import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { generateScript } from './pipeline/scriptGen.js'
import { generateAllScenes } from './pipeline/sceneGen.js'
import { generateAudio } from './pipeline/tts.js'
import { buildStandaloneHtml, exportFilename } from './export.js'
import type { ScriptScene } from './pipeline/scriptGen.js'

interface GeneratedScene {
  index: number
  html: string
  audioBase64: string
  durationSeconds: number
}

interface SSEClient {
  reply: any
  closed: boolean
}

interface LessonState {
  query: string
  status: 'generating' | 'done' | 'error'
  script: ScriptScene[] | null
  scenes: GeneratedScene[]
  sseClients: Set<SSEClient>
}

const lessons = new Map<string, LessonState>()

function pushSSE(lesson: LessonState, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of lesson.sseClients) {
    if (!client.closed) {
      try {
        client.reply.raw.write(payload)
      } catch {
        client.closed = true
      }
    }
  }
}

async function runPipeline(lessonId: string, query: string) {
  const lesson = lessons.get(lessonId)!

  try {
    const script = await generateScript(query)
    lesson.script = script

    pushSSE(lesson, 'script_ready', { totalScenes: script.length, scenes: script })

    // Run scene generation + TTS in parallel per scene
    await generateAllScenes(query, script, async (index, html) => {
      const scriptScene = script[index]
      const audioBase64 = await generateAudio(scriptScene.narration)

      const scene: GeneratedScene = {
        index,
        html,
        audioBase64,
        durationSeconds: scriptScene.durationSeconds,
      }
      lesson.scenes.push(scene)
      pushSSE(lesson, 'scene_ready', scene)
    })

    lesson.status = 'done'
    const totalDuration = lesson.scenes.reduce((sum, s) => sum + s.durationSeconds, 0)
    pushSSE(lesson, 'done', { totalDuration })
  } catch (err) {
    console.error('Pipeline error:', err)
    lesson.status = 'error'
    pushSSE(lesson, 'error', { message: String(err) })
  }

  // Close all SSE connections
  for (const client of lesson.sseClients) {
    if (!client.closed) {
      try {
        client.reply.raw.end()
      } catch {}
    }
  }
}

const app = Fastify({ logger: true })

await app.register(cors, {
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
})

// Serve the built frontend (client/dist) so the app runs as a single service
// in production. In local dev the client is served by Vite instead; the dist
// folder simply won't exist, which is fine — these routes are only hit in prod.
const clientDist = join(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist')
await app.register(fastifyStatic, {
  root: clientDist,
  wildcard: false,
})

app.post('/api/generate', async (req, reply) => {
  const { query } = req.body as { query: string }
  if (!query?.trim()) {
    return reply.status(400).send({ error: 'query is required' })
  }

  const lessonId = crypto.randomUUID()
  lessons.set(lessonId, {
    query: query.trim(),
    status: 'generating',
    script: null,
    scenes: [],
    sseClients: new Set(),
  })

  runPipeline(lessonId, query.trim())

  return { lessonId }
})

app.get('/api/lesson/:id/stream', async (req, reply) => {
  const { id } = req.params as { id: string }
  const lesson = lessons.get(id)

  if (!lesson) {
    return reply.status(404).send({ error: 'Lesson not found' })
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    // Client is served same-origin in production and proxied in dev, so CORS
    // isn't needed; reflect the origin if present to stay permissive for any
    // direct cross-origin testing.
    'Access-Control-Allow-Origin': (req.headers.origin as string) || '*',
  })

  const client: SSEClient = { reply, closed: false }
  lesson.sseClients.add(client)

  // Send already-completed scenes to newly connecting clients
  if (lesson.script) {
    reply.raw.write(
      `event: script_ready\ndata: ${JSON.stringify({
        totalScenes: lesson.script.length,
        scenes: lesson.script,
      })}\n\n`
    )
  }
  for (const scene of lesson.scenes) {
    reply.raw.write(`event: scene_ready\ndata: ${JSON.stringify(scene)}\n\n`)
  }
  if (lesson.status === 'done') {
    const totalDuration = lesson.scenes.reduce((sum, s) => sum + s.durationSeconds, 0)
    reply.raw.write(`event: done\ndata: ${JSON.stringify({ totalDuration })}\n\n`)
    reply.raw.end()
    return
  }
  if (lesson.status === 'error') {
    reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: 'Lesson generation failed' })}\n\n`)
    reply.raw.end()
    return
  }

  req.raw.on('close', () => {
    client.closed = true
    lesson.sseClients.delete(client)
  })

  // Keep connection open — pipeline will close it when done
  await new Promise<void>((resolve) => {
    req.raw.on('close', resolve)
  })
})

// Download a fully self-contained single-file HTML version of a finished lesson.
// Only available once generation is complete, since a standalone file needs every
// scene and its audio baked in.
app.get('/api/lesson/:id/export', async (req, reply) => {
  const { id } = req.params as { id: string }
  const lesson = lessons.get(id)

  if (!lesson) {
    return reply.status(404).send({ error: 'Lesson not found' })
  }
  if (lesson.status !== 'done') {
    return reply.status(409).send({ error: 'Lesson is not finished generating yet' })
  }

  const html = buildStandaloneHtml({ query: lesson.query, scenes: lesson.scenes })

  return reply
    .header('Content-Type', 'text/html; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${exportFilename(lesson.query)}"`)
    .send(html)
})

const port = Number(process.env.PORT) || 3000
await app.listen({ port, host: '0.0.0.0' })
console.log(`Server running on http://localhost:${port}`)
