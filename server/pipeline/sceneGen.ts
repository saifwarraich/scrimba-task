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
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text.replace(/^```html\s*/i, '').replace(/```\s*$/, '').trim()
}

// Shared design tokens — pasted verbatim into every scene so the whole lesson
// looks like one cohesive piece. Claude MUST keep this :root block as-is.
const DESIGN_TOKENS = `:root {
  /* Surfaces */
  --bg: #0d1117;
  --bg-grad: radial-gradient(circle at 50% 30%, #161b22 0%, #0d1117 70%);
  --panel: rgba(255, 255, 255, 0.03);
  --stroke: rgba(255, 255, 255, 0.08);

  /* Palette — pick accents from THESE; do not invent new hex values */
  --accent: #6c4ff6;        /* primary  */
  --accent-2: #4cc9f0;      /* cool secondary */
  --accent-3: #f5a623;      /* warm highlight */
  --good: #3fb950;
  --bad: #f85149;

  /* Text */
  --text: #e6edf3;
  --text-dim: #8b949e;

  /* Type scale (do not exceed --fs-hero for any text) */
  --fs-hero: 64px;
  --fs-title: 40px;
  --fs-label: 22px;
  --fs-body: 18px;
  --fs-tag: 13px;

  /* Rhythm */
  --pad: 40px;
  --gap: 20px;
  --radius: 14px;

  --font: 'Inter', system-ui, -apple-system, sans-serif;
}`

// Each template is a CSS Grid skeleton with named areas. Claude picks ONE,
// declares it on <body data-template>, and fills the named zones. Every zone
// has overflow:hidden so nothing can bleed across boundaries.
const TEMPLATES = `TEMPLATE "diagram-focus" — one hero visual, label above, caption below.
   Best for: a single concept, mechanism, process, or object to study closely.
   body { display:grid; grid-template-rows: 14% 1fr 18%;
          grid-template-areas: "header" "visual" "caption"; }
   Zones: .header (grid-area:header), .visual (grid-area:visual), .caption (grid-area:caption)

TEMPLATE "split-explain" — visual on the left, text explanation on the right.
   Best for: a concept paired with a definition, list of properties, or steps.
   body { display:grid; grid-template-columns: 58% 42%;
          grid-template-areas: "visual side"; }
   Zones: .visual (grid-area:visual), .side (grid-area:side)

TEMPLATE "title-reveal" — full-bleed centered statement over an animated backdrop.
   Best for: opening/closing scenes, a single big idea, a key term or number.
   body { display:grid; place-items:center; grid-template-areas: "stage"; }
   Zones: .stage (grid-area:stage) holds animated bg + centered headline

TEMPLATE "timeline" — header on top, a horizontal sequence of steps in the middle.
   Best for: ordered sequences, stages, history, cause→effect chains.
   body { display:grid; grid-template-rows: 16% 1fr 16%;
          grid-template-areas: "header" "track" "caption"; }
   .track is display:flex; align-items:center; justify-content:space-between;
   Zones: .header, .track (the steps), .caption

TEMPLATE "comparison" — header on top, two equal columns, caption at the bottom.
   Best for: A vs B, before/after, two contrasting ideas.
   body { display:grid; grid-template-rows: 16% 1fr 16%; grid-template-columns: 1fr 1fr;
          grid-template-areas: "header header" "left right" "caption caption"; }
   Zones: .header, .left, .right, .caption

TEMPLATE "quad-grid" — header on top, then a 2×2 grid of four equal cells.
   Best for: recaps/summaries, four parts of a whole, an overview of prior scenes.
   body { display:grid; grid-template-rows: 14% 1fr; grid-template-areas: "header" "grid"; }
   .grid { grid-area:grid; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap: var(--gap); }
   Each of the four .cell elements lives inside .grid. Keep each cell's visual + tiny label SMALL so all four fit.
   Zones: .header, .grid (containing four .cell)`

function buildPrompt(query: string, scene: ScriptScene, total: number): string {
  return `You are generating one animated scene for an educational lesson player. The scene renders full-screen in a browser (1280×720 viewport).

Topic: ${query}
Scene ${scene.index + 1} of ${total}: "${scene.title}"
Narration (plays as audio): "${scene.narration}"
Visual brief: "${scene.visualBrief}"
Duration: ${scene.durationSeconds} seconds

Generate a single complete HTML document for this scene.

=== STEP 1: CHOOSE A LAYOUT TEMPLATE ===
Look at the scene's content and visual brief, then pick the ONE template that best
guides the viewer's attention and presents the information clearly:

${TEMPLATES}

Declare your choice on the body: <body data-template="diagram-focus"> (etc.).
Use ITS grid definition exactly. Place every piece of content inside one of that
template's named zones — never put content directly on <body>.

=== STEP 2: USE THE SHARED DESIGN SYSTEM ===
Copy this :root block verbatim into your <style> and build everything from these
tokens (var(--accent), var(--fs-title), etc.). This keeps all scenes consistent:

${DESIGN_TOKENS}

Then add this required boilerplate so zones never overflow their boundaries:
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:100vw; height:100vh; overflow:hidden; }
body { background: var(--bg-grad); color: var(--text); font-family: var(--font); }
/* EVERY grid zone must clip its own contents AND be allowed to shrink: */
.header, .visual, .caption, .side, .stage, .track, .left, .right, .grid, .cell {
  overflow: hidden; position: relative; padding: var(--pad);
  min-height: 0; min-width: 0;   /* REQUIRED: without this, tall content pushes the grid past 100vh */
}

BOUNDARY RULES (critical — this is why we use templates):
* The whole scene MUST fit within 100vh × 100vw. The body grid is EXACTLY height:100vh. Size rows with fr/% (as given) — never let row heights sum to more than 100vh, and never use fixed px heights that could exceed the viewport.
* min-height:0 / min-width:0 on every zone is mandatory — it is what lets overflow:hidden actually clip. Do not omit it.
* All visuals and text live INSIDE a grid zone. Nothing is a direct child of <body> except the zone elements (and .grid's children are .cell elements).
* SVGs must scale to their zone: <svg width="100%" height="100%" viewBox="..." preserveAspectRatio="xMidYMid meet">. Never give an SVG a fixed pixel size larger than its zone.
* Do NOT use position:absolute to escape a zone. Absolutely-positioned children are fine ONLY relative to their zone (zones are position:relative) and must stay within it.
* Headings/labels go in .header/.side/.caption. The main animated diagram goes in .visual/.stage/.track/.left/.right/.cell. Keep them separate — text must not overlap the diagram.
* Reserve generous bottom margin in caption zones; the lesson player overlays a controls bar near the bottom of the screen, so keep essential content away from the extreme bottom edge.
* SPACING: always leave breathing room (at least var(--gap)) between a piece of text and any element it relates to — never let a label touch or crowd its visual, and never let two text blocks butt up against each other.
* NOTHING may cross a boundary: text, shapes, and SVG elements must stay fully inside their zone. If content feels tight, make it SMALLER or show LESS — do not let it spill, clip awkwardly, or run to the very edge.

=== STEP 3: TECHNICAL REQUIREMENTS ===
* Full HTML document with <!DOCTYPE html>, <html>, <head>, <body>
* All styles inline in a <style> tag in <head>; all JS inline in a <script> before </body>
* GSAP is NOT available — only CSS @keyframes and vanilla JS (setTimeout, requestAnimationFrame)
* No external resources, no images, no remote fonts
* All animations START automatically on load; loop or settle gracefully within ${scene.durationSeconds}s

=== STEP 4: CONTENT & MOTION ===
* The visual must ILLUSTRATE the concept, not just restate the narration text.
* Show don't tell: narrating light scattering → animate actual light rays. Use simple SVG shapes for diagrams and illustrations.
* KEEP VISUALS SIMPLE: use clean, basic shapes — circles, rectangles, lines, arrows, simple icons, flowing particles. Do NOT draw complicated or detailed illustrations, intricate diagrams, charts, axis graphs, or data plots. A few clear elements in motion beats a busy, complex scene.
* IMPORTANT TEXT IN THE MAIN AREA: when key terms, labels, or takeaways appear inside the main content/visual zone (.visual/.stage/.left/.right/.cell/.track), place them inside a themed color container — a rounded panel/pill (use var(--radius)) with a subtle tinted background drawn from the accent palette (e.g. a low-opacity var(--accent)/var(--accent-2)/var(--accent-3) fill and matching border). Do NOT do this to the top/header title or the main scene headline — those stay as plain styled text; only the supporting/important text within the main area gets a container.
* Text labels ANNOTATE the visual; they don't replace it. Headline text uses var(--fs-title)/var(--fs-hero); supporting text uses var(--fs-body)/var(--fs-label).
* Every scene must have motion — nothing static. Smooth, purposeful enter/transform/exit.
* Style: cinematic educational — clean, minimal motion graphics.

Technique by subject: physics/science → particles, waves, SVG geometry with CSS transforms; data structures → animated SVG nodes inserting/moving; geography/civics → schematic SVG layouts with highlights; abstract ideas → metaphorical motion (flowing particles, growing forms).

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
