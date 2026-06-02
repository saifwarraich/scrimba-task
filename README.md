# Scrimba Lesson Engine

An AI-powered web app that turns any educational question into a fully animated visual lesson — no video files, just HTML/CSS/SVG rendered live in the browser, synchronized with AI-generated narration audio.

## Prerequisites

- **Node.js 18+** (uses the `--env-file` flag and native `fetch`)
- **npm** (ships with Node)
- An [Anthropic API key](https://console.anthropic.com/) — for script + scene generation
- An [ElevenLabs API key](https://elevenlabs.io/) and a voice ID — for narration audio

## Environment variables

Copy `.env.example` to `.env` (at the **project root**) and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Anthropic API key for script + scene generation |
| `ELEVENLABS_API_KEY` | yes | ElevenLabs API key for text-to-speech |
| `ELEVENLABS_VOICE_ID` | yes | ElevenLabs voice ID used for narration |
| `ANTHROPIC_MODEL` | no | Claude model to use (defaults to `claude-opus-4-8`) |
| `PORT` | no | Backend port (defaults to `3000`) |

## Setup

Install dependencies for the root, server, and client:

```bash
cp .env.example .env
# Fill in your API keys and voice ID in .env

npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

## Running the app

```bash
npm run dev
```

This starts both processes via `concurrently`:

- **Backend** (Fastify) → http://localhost:3000
- **Frontend** (Vite) → http://localhost:5173

You can also run them individually:

```bash
npm run dev:server   # backend only
npm run dev:client   # frontend only
```

Open **http://localhost:5173**, enter a question, and watch the lesson.

## Demo queries to try

- Why is the sky blue?
- How does the Norwegian parliament work?
- What's the difference between a hash map and a B-tree?

## Architecture

The landing page POSTs a query to the Fastify backend (`server/`), which immediately returns a `lessonId` and kicks off an async pipeline: Claude generates a 5–8 scene storyboard (`scriptGen.ts`), then generates self-contained animated HTML for each scene in parallel with up to 3 concurrent Claude calls (`sceneGen.ts`), while ElevenLabs synthesizes narration audio per scene (`tts.ts`). Completed scenes are streamed to the browser via Server-Sent Events as they finish. The vanilla-TS player (`client/src/player.ts`) renders each scene in a sandboxed iframe and synchronizes audio playback and a visual track timeline, allowing pause, seek, and keyboard navigation (Space / ← → / R).
