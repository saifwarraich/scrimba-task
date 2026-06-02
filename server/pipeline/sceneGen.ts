import Anthropic from '@anthropic-ai/sdk'
import type { ScriptScene } from './scriptGen.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const FALLBACK_HTML = (title: string, narration: string) => `<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 100vw; height: 100vh; overflow: hidden;
  background: #0d1117;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-family: system-ui, sans-serif;
  color: #e6edf3;
}
h1 { font-size: 48px; font-weight: 700; margin-bottom: 24px; color: #6c4ff6; text-align: center; }
p { font-size: 20px; line-height: 1.6; max-width: 700px; text-align: center; color: #8b949e; }
</style>
</head>
<body>
<h1>${title}</h1>
<p>${narration}</p>
</body>
</html>`

async function callClaude(prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text.replace(/^```html\s*/i, '').replace(/```\s*$/, '').trim()
}

function buildPrompt(query: string, scene: ScriptScene, total: number): string {
  return `You are generating one animated scene for an educational lesson player. The scene renders full-screen in a browser (1280×720 viewport).

Topic: ${query}
Scene ${scene.index + 1} of ${total}: "${scene.title}"
Narration (plays as audio): "${scene.narration}"
Visual brief: "${scene.visualBrief}"
Duration: ${scene.durationSeconds} seconds

Generate a single complete HTML document for this scene.

TECHNICAL REQUIREMENTS:
* Full HTML document with <!DOCTYPE html>, <html>, <head>, <body>
* All styles inline in <style> tag in <head>
* All JavaScript inline in <script> tag before </body>
* GSAP is NOT available — use only CSS animations and vanilla JS
* No external resources, no images, no fonts (use system fonts)
* Body should be exactly: width 100vw, height 100vh, overflow hidden
* All animations should START automatically on page load
* Animations should loop or complete gracefully within ${scene.durationSeconds} seconds

AESTHETIC REQUIREMENTS:
* Background: dark, use #0d1117 or a dark gradient appropriate to the topic
* Color palette: pick 2-3 colors that suit the subject matter. For science: blues, teals. For CS/data: purples, greens. For civics: golds, blues.
* Typography: large, bold, clear. Use system-ui font. Key terms in large text (48-72px). Supporting text 18-24px.
* Animations: smooth, purposeful. Things should enter, transform, and exit cleanly. Use CSS @keyframes for continuous animations, JS setTimeout/requestAnimationFrame for sequenced reveals.
* Style: cinematic educational. Think 3Blue1Brown meets motion graphics. Clean shapes, bold colors, satisfying animations.

CONTENT REQUIREMENTS:
* The visual must ILLUSTRATE the concept, not just display the narration text
* Show don't tell: if narrating about light scattering, animate actual light rays
* Use SVG for diagrams, geometric shapes, and illustrations
* Text labels should annotate the visual, not replace it
* Every scene should have motion — nothing static

SCENE-SPECIFIC APPROACH: Based on the visual brief, use the most appropriate technique:
* Science/physics: particle systems, wave animations, SVG geometry with CSS transforms
* Data structures: animated SVG diagrams with elements inserting/finding/moving
* Geography/civics: SVG maps or schematic layouts with animated highlights
* Abstract concepts: metaphorical animations (flowing particles, growing trees, etc.)

Output ONLY the complete HTML document. No explanation, no markdown code fences. Start with <!DOCTYPE html> and end with </html>.`
}

export async function generateScene(
  query: string,
  scene: ScriptScene,
  total: number
): Promise<string> {
  const prompt = buildPrompt(query, scene, total)

  let html: string
  try {
    html = await callClaude(prompt)
    if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
      throw new Error('Invalid HTML output')
    }
  } catch {
    // retry with simplified prompt
    try {
      html = await callClaude(prompt)
      if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
        throw new Error('Invalid HTML output on retry')
      }
    } catch {
      html = FALLBACK_HTML(scene.title, scene.narration)
    }
  }

  return html
}

export async function generateAllScenes(
  query: string,
  scenes: ScriptScene[],
  onScene: (index: number, html: string) => Promise<void>
): Promise<void> {
  const CONCURRENCY = 3
  const queue = [...scenes]
  const running: Promise<void>[] = []

  async function processScene(scene: ScriptScene) {
    const html = await generateScene(query, scene, scenes.length)
    await onScene(scene.index, html)
  }

  while (queue.length > 0 || running.length > 0) {
    while (running.length < CONCURRENCY && queue.length > 0) {
      const scene = queue.shift()!
      const p = processScene(scene).then(() => {
        running.splice(running.indexOf(p), 1)
      })
      running.push(p)
    }
    if (running.length > 0) await Promise.race(running)
  }
}
