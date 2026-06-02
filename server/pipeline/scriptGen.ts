import Anthropic from '@anthropic-ai/sdk'

export interface ScriptScene {
  index: number
  title: string
  narration: string
  visualBrief: string
  durationSeconds: number
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateScript(query: string): Promise<ScriptScene[]> {
  const prompt = `You are creating an animated educational lesson about: "${query}"

Generate a lesson script as a JSON array of 5-8 scenes. Each scene should cover one clear concept or visual idea.

Return ONLY valid JSON, no markdown, no explanation:
[
  {
    "index": 0,
    "title": "Short scene title",
    "narration": "The narration text for this scene. Should be 2-4 sentences, natural spoken language, 15-25 seconds when read aloud.",
    "visualBrief": "Detailed description of what should be SHOWN visually in this scene. Be specific: what shapes, colors, animations, what appears/moves/transforms. This is the brief for an animator, not a description of the narration.",
    "durationSeconds": 20
  }
]

Rules:
* First scene: introduce the topic with a strong visual hook
* Middle scenes: build understanding progressively, each adding one concept
* Last scene: summary or memorable takeaway
* visualBrief must describe something that can be rendered as animated SVG/HTML — no photographs, no external images
* Narration should sound like a smart, engaging teacher — not a textbook`

  let attempt = 0
  while (attempt < 2) {
    try {
      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      const scenes: ScriptScene[] = JSON.parse(cleaned)
      return scenes.map((s, i) => ({ ...s, index: i }))
    } catch (err) {
      attempt++
      if (attempt >= 2) throw new Error(`scriptGen failed: ${err}`)
    }
  }
  throw new Error('scriptGen failed after retries')
}
