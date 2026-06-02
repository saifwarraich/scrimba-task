# Lesson Engine

An AI-powered web app that turns any educational question into a fully animated visual lesson — no video files, just HTML/CSS/SVG rendered live in the browser, synchronized with AI-generated narration audio.

## Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)
- An [ElevenLabs API key](https://elevenlabs.io/)

## Setup

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and ELEVENLABS_API_KEY in .env

npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

npm run dev
```

Open **http://localhost:5173**, enter a question, and watch the lesson.

## Demo queries to try

- Why is the sky blue?
- How does the Norwegian parliament work?
- What's the difference between a hash map and a B-tree?

## Architecture

The landing page POSTs a query to the Fastify backend (`server/`), which immediately returns a `lessonId` and kicks off an async pipeline: Claude generates a 5–8 scene storyboard (`scriptGen.ts`), then generates self-contained animated HTML for each scene in parallel with up to 3 concurrent Claude calls (`sceneGen.ts`), while ElevenLabs synthesizes narration audio per scene (`tts.ts`). Completed scenes are streamed to the browser via Server-Sent Events as they finish. The vanilla-TS player (`client/src/player.ts`) renders each scene in a sandboxed iframe and synchronizes audio playback and a visual track timeline, allowing pause, seek, and keyboard navigation (Space / ← → / R).
