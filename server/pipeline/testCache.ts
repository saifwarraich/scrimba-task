export interface CachedLesson {
  script: { index: number; title: string; narration: string; visualBrief: string; durationSeconds: number }[]
  scenes: { index: number; html: string; audioBase64: string; durationSeconds: number }[]
}

const SKY_BLUE_CACHE: CachedLesson = {
  script: [
    { index: 0, title: "Sunlight Is Many Colors", narration: "Sunlight looks white, but it's actually a mix of all the colors of the rainbow — each one a different wavelength of light.", visualBrief: "White light beam splits into rainbow spectrum", durationSeconds: 10 },
    { index: 1, title: "Light Meets the Atmosphere", narration: "When sunlight enters Earth's atmosphere, it collides with tiny nitrogen and oxygen molecules floating in the air.", visualBrief: "Particles scattered across a dark sky field", durationSeconds: 10 },
    { index: 2, title: "Rayleigh Scattering", narration: "Shorter wavelengths like blue and violet scatter much more than longer ones like red. This is called Rayleigh scattering.", visualBrief: "Blue light rays bouncing in all directions vs red rays passing straight", durationSeconds: 12 },
    { index: 3, title: "Why Not Violet?", narration: "Violet light scatters even more than blue — but our eyes are more sensitive to blue, and some violet is absorbed high in the atmosphere.", visualBrief: "Eye sensitivity curve highlighting blue over violet", durationSeconds: 11 },
    { index: 4, title: "The Blue Sky", narration: "So wherever you look in the sky, scattered blue light reaches your eyes — painting the whole sky blue.", visualBrief: "Sky dome filling with blue scattered light rays converging to an eye", durationSeconds: 10 },
  ],
  scenes: [
    {
      index: 0,
      audioBase64: '',
      durationSeconds: 10,
      html: `<!DOCTYPE html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:100vw;height:100vh;overflow:hidden;background:#0d1117;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif}
svg{position:absolute;top:0;left:0;width:100%;height:100%}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes beam{from{stroke-dashoffset:400}to{stroke-dashoffset:0}}
@keyframes spread{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}}
.label{animation:fadeSlideIn .6s ease both}
</style></head><body>
<svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="spectrum" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#ff4444"/>
      <stop offset="20%" stop-color="#ff8800"/>
      <stop offset="40%" stop-color="#ffdd00"/>
      <stop offset="60%" stop-color="#44dd44"/>
      <stop offset="80%" stop-color="#4488ff"/>
      <stop offset="100%" stop-color="#aa44ff"/>
    </linearGradient>
  </defs>
  <!-- White beam in -->
  <line x1="100" y1="360" x2="520" y2="360" stroke="white" stroke-width="18" stroke-linecap="round"
    stroke-dasharray="420" stroke-dashoffset="420" style="animation:beam 0.8s ease forwards 0.1s"/>
  <!-- Prism -->
  <polygon points="520,280 620,360 520,440" fill="#2a3a5a" stroke="#4488ff" stroke-width="2"
    style="animation:fadeSlideIn .5s ease both 0.9s"/>
  <!-- Spectrum fan -->
  <g transform-origin="620 360" style="animation:fadeSlideIn .6s ease both 1.4s">
    <line x1="620" y1="360" x2="1100" y2="200" stroke="#ff4444" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
    <line x1="620" y1="360" x2="1100" y2="260" stroke="#ff8800" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
    <line x1="620" y1="360" x2="1100" y2="320" stroke="#ffdd00" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
    <line x1="620" y1="360" x2="1100" y2="360" stroke="#44dd44" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
    <line x1="620" y1="360" x2="1100" y2="400" stroke="#4488ff" stroke-width="7" stroke-linecap="round"/>
    <line x1="620" y1="360" x2="1100" y2="460" stroke="#aa44ff" stroke-width="5" stroke-linecap="round" opacity="0.9"/>
    <line x1="620" y1="360" x2="1100" y2="520" stroke="#cc44ff" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
  </g>
  <text x="640" y="680" text-anchor="middle" fill="#8b949e" font-size="22" style="animation:fadeSlideIn .5s ease both 2s">Sunlight contains every wavelength of visible light</text>
  <text x="160" y="340" text-anchor="middle" fill="white" font-size="20" font-weight="bold" style="animation:fadeSlideIn .5s ease both 0.2s">White</text>
  <text x="160" y="365" text-anchor="middle" fill="white" font-size="20" font-weight="bold" style="animation:fadeSlideIn .5s ease both 0.2s">Light</text>
</svg>
</body></html>`,
    },
    {
      index: 1,
      audioBase64: '',
      durationSeconds: 10,
      html: `<!DOCTYPE html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:100vw;height:100vh;overflow:hidden;background:linear-gradient(180deg,#0d1117 0%,#0a1628 100%);font-family:system-ui,sans-serif}
svg{position:absolute;top:0;left:0;width:100%;height:100%}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes sunRay{from{opacity:0;transform:scaleY(0)}to{opacity:.5;transform:scaleY(1)}}
</style></head><body>
<svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <!-- Sun -->
  <circle cx="640" cy="110" r="60" fill="#ffe566" style="animation:fadeSlideIn .6s ease both 0s"/>
  <!-- Sun rays -->
  <g style="animation:sunRay .8s ease both 0.5s;transform-origin:640px 110px">
    <line x1="640" y1="40" x2="640" y2="10" stroke="#ffe566" stroke-width="4"/>
    <line x1="690" y1="60" x2="720" y2="30" stroke="#ffe566" stroke-width="4"/>
    <line x1="590" y1="60" x2="560" y2="30" stroke="#ffe566" stroke-width="4"/>
    <line x1="710" y1="110" x2="750" y2="110" stroke="#ffe566" stroke-width="4"/>
    <line x1="570" y1="110" x2="530" y2="110" stroke="#ffe566" stroke-width="4"/>
  </g>
  <!-- Light beams into atmosphere -->
  <line x1="610" y1="170" x2="400" y2="500" stroke="#ffe566" stroke-width="3" stroke-dasharray="8 6" opacity="0.5" style="animation:fadeSlideIn .5s ease both 0.8s"/>
  <line x1="630" y1="170" x2="580" y2="500" stroke="#ffe566" stroke-width="3" stroke-dasharray="8 6" opacity="0.5" style="animation:fadeSlideIn .5s ease both 0.9s"/>
  <line x1="650" y1="170" x2="760" y2="500" stroke="#ffe566" stroke-width="3" stroke-dasharray="8 6" opacity="0.5" style="animation:fadeSlideIn .5s ease both 1.0s"/>
  <line x1="670" y1="170" x2="900" y2="500" stroke="#ffe566" stroke-width="3" stroke-dasharray="8 6" opacity="0.5" style="animation:fadeSlideIn .5s ease both 1.1s"/>
  <!-- Molecules -->
  <g style="animation:fadeSlideIn .7s ease both 1.4s">
    <circle cx="400" cy="400" r="10" fill="#4488ff" opacity="0.85"/>
    <circle cx="410" cy="415" r="6" fill="#88aaff" opacity="0.7"/>
    <circle cx="560" cy="350" r="10" fill="#4488ff" opacity="0.85"/>
    <circle cx="570" cy="365" r="6" fill="#88aaff" opacity="0.7"/>
    <circle cx="700" cy="430" r="10" fill="#4488ff" opacity="0.85"/>
    <circle cx="712" cy="445" r="6" fill="#88aaff" opacity="0.7"/>
    <circle cx="850" cy="380" r="10" fill="#4488ff" opacity="0.85"/>
    <circle cx="862" cy="395" r="6" fill="#88aaff" opacity="0.7"/>
    <circle cx="300" cy="300" r="9" fill="#4488ff" opacity="0.75"/>
    <circle cx="960" cy="340" r="9" fill="#4488ff" opacity="0.75"/>
    <circle cx="500" cy="500" r="8" fill="#88aaff" opacity="0.7"/>
    <circle cx="780" cy="310" r="8" fill="#88aaff" opacity="0.7"/>
  </g>
  <text x="640" y="580" text-anchor="middle" fill="#8b949e" font-size="22" style="animation:fadeSlideIn .5s ease both 1.9s">N₂ and O₂ molecules fill the atmosphere</text>
  <text x="640" y="655" text-anchor="middle" fill="#4488ff" font-size="18" style="animation:fadeSlideIn .5s ease both 2.2s">● Nitrogen / Oxygen molecules</text>
</svg>
</body></html>`,
    },
    {
      index: 2,
      audioBase64: '',
      durationSeconds: 12,
      html: `<!DOCTYPE html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:100vw;height:100vh;overflow:hidden;background:#0d1117;font-family:system-ui,sans-serif}
svg{position:absolute;top:0;left:0;width:100%;height:100%}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes scatterBlue{0%{transform:translate(0,0)}25%{transform:translate(-30px,-40px)}50%{transform:translate(40px,-20px)}75%{transform:translate(-20px,30px)}100%{transform:translate(0,0)}}
@keyframes passThru{from{transform:translateX(0)}to{transform:translateX(700px)}}
</style></head><body>
<svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <!-- Labels -->
  <text x="640" y="60" text-anchor="middle" fill="white" font-size="30" font-weight="bold" style="animation:fadeSlideIn .6s ease both 0s">Rayleigh Scattering</text>

  <!-- Red light — passes through -->
  <g style="animation:fadeSlideIn .5s ease both 0.4s">
    <text x="80" y="220" fill="#ff6655" font-size="20" font-weight="bold">Red light</text>
    <text x="80" y="248" fill="#8b949e" font-size="16">(long wavelength)</text>
    <line x1="80" y1="270" x2="900" y2="270" stroke="#ff6655" stroke-width="6" stroke-linecap="round" stroke-dasharray="16 6"/>
    <text x="920" y="278" fill="#ff6655" font-size="18">→ passes through</text>
  </g>

  <!-- Blue light — scatters -->
  <g style="animation:fadeSlideIn .5s ease both 1.0s">
    <text x="80" y="390" fill="#4499ff" font-size="20" font-weight="bold">Blue light</text>
    <text x="80" y="418" fill="#8b949e" font-size="16">(short wavelength)</text>
    <!-- incoming ray -->
    <line x1="80" y1="450" x2="420" y2="450" stroke="#4499ff" stroke-width="6" stroke-linecap="round"/>
    <!-- molecule -->
    <circle cx="450" cy="450" r="14" fill="#2a3a6a" stroke="#4499ff" stroke-width="2" style="animation:fadeSlideIn .4s ease both 1.4s"/>
    <!-- scatter lines -->
    <g style="animation:fadeSlideIn .5s ease both 1.8s">
      <line x1="464" y1="436" x2="560" y2="340" stroke="#4499ff" stroke-width="4" stroke-linecap="round"/>
      <line x1="464" y1="450" x2="620" y2="450" stroke="#4499ff" stroke-width="4" stroke-linecap="round"/>
      <line x1="464" y1="464" x2="560" y2="560" stroke="#4499ff" stroke-width="4" stroke-linecap="round"/>
      <line x1="450" y1="436" x2="390" y2="330" stroke="#4499ff" stroke-width="4" stroke-linecap="round"/>
      <line x1="436" y1="450" x2="300" y2="420" stroke="#4499ff" stroke-width="4" stroke-linecap="round"/>
    </g>
    <text x="680" y="458" fill="#4499ff" font-size="18" style="animation:fadeSlideIn .5s ease both 2.2s">scatters in all directions</text>
  </g>

  <text x="640" y="660" text-anchor="middle" fill="#8b949e" font-size="20" style="animation:fadeSlideIn .5s ease both 2.6s">Blue scatters ~5.5× more than red</text>
</svg>
</body></html>`,
    },
    {
      index: 3,
      audioBase64: '',
      durationSeconds: 11,
      html: `<!DOCTYPE html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:100vw;height:100vh;overflow:hidden;background:#0d1117;font-family:system-ui,sans-serif}
svg{position:absolute;top:0;left:0;width:100%;height:100%}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes growBar{from{width:0}to{width:var(--w)}}
</style></head><body>
<svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <text x="640" y="70" text-anchor="middle" fill="white" font-size="30" font-weight="bold" style="animation:fadeSlideIn .6s ease both 0s">Why Not Violet?</text>

  <!-- Spectrum bar -->
  <defs>
    <linearGradient id="spec2" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#ff4444"/>
      <stop offset="50%" stop-color="#4488ff"/>
      <stop offset="75%" stop-color="#8844ff"/>
      <stop offset="100%" stop-color="#cc22ff"/>
    </linearGradient>
  </defs>
  <rect x="200" y="130" width="880" height="30" rx="6" fill="url(#spec2)" style="animation:fadeSlideIn .6s ease both 0.3s"/>
  <text x="200" y="185" fill="#ff4444" font-size="18" style="animation:fadeSlideIn .4s ease both 0.6s">Red</text>
  <text x="990" y="185" fill="#cc22ff" font-size="18" text-anchor="end" style="animation:fadeSlideIn .4s ease both 0.6s">Violet</text>

  <!-- Eye sensitivity curve using polyline -->
  <g style="animation:fadeSlideIn .7s ease both 1.0s">
    <text x="640" y="240" text-anchor="middle" fill="#8b949e" font-size="20">Human eye sensitivity</text>
    <polyline points="200,500 300,480 400,420 500,340 580,260 640,230 700,250 780,310 900,420 1000,490 1080,510"
      fill="none" stroke="#44dd88" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <!-- Peak marker at blue -->
    <circle cx="640" cy="230" r="10" fill="#4488ff" style="animation:fadeSlideIn .4s ease both 1.6s"/>
    <line x1="640" y1="220" x2="640" y2="160" stroke="#4488ff" stroke-width="2" stroke-dasharray="6 4" style="animation:fadeSlideIn .4s ease both 1.8s"/>
    <text x="640" y="155" text-anchor="middle" fill="#4488ff" font-size="18" font-weight="bold" style="animation:fadeSlideIn .4s ease both 2.0s">Peak sensitivity</text>
  </g>

  <!-- Violet absorbed note -->
  <g style="animation:fadeSlideIn .6s ease both 2.2s">
    <rect x="900" y="290" width="280" height="80" rx="10" fill="#1a1030" stroke="#8844ff" stroke-width="1.5"/>
    <text x="1040" y="320" text-anchor="middle" fill="#cc44ff" font-size="17">Violet also absorbed</text>
    <text x="1040" y="348" text-anchor="middle" fill="#8b949e" font-size="15">by upper atmosphere</text>
  </g>

  <text x="640" y="650" text-anchor="middle" fill="#8b949e" font-size="20" style="animation:fadeSlideIn .5s ease both 2.7s">Our eyes see blue more strongly than violet</text>
</svg>
</body></html>`,
    },
    {
      index: 4,
      audioBase64: '',
      durationSeconds: 10,
      html: `<!DOCTYPE html><html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:100vw;height:100vh;overflow:hidden;background:linear-gradient(180deg,#1a4a8a 0%,#2a6abf 40%,#4a8ae0 70%,#87ceeb 100%);font-family:system-ui,sans-serif}
svg{position:absolute;top:0;left:0;width:100%;height:100%}
@keyframes fadeSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes rayPulse{0%,100%{opacity:.3}50%{opacity:.7}}
</style></head><body>
<svg viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid meet">
  <!-- Scattered rays converging to eye -->
  <g style="animation:fadeSlideIn .8s ease both 0.2s">
    <line x1="100" y1="100" x2="640" y2="460" stroke="#88ccff" stroke-width="3" stroke-dasharray="12 8" style="animation:rayPulse 2s ease-in-out infinite 0.0s"/>
    <line x1="300" y1="80"  x2="640" y2="460" stroke="#88ccff" stroke-width="3" stroke-dasharray="12 8" style="animation:rayPulse 2s ease-in-out infinite 0.3s"/>
    <line x1="500" y1="60"  x2="640" y2="460" stroke="#aaddff" stroke-width="3" stroke-dasharray="12 8" style="animation:rayPulse 2s ease-in-out infinite 0.6s"/>
    <line x1="700" y1="55"  x2="640" y2="460" stroke="#aaddff" stroke-width="3" stroke-dasharray="12 8" style="animation:rayPulse 2s ease-in-out infinite 0.9s"/>
    <line x1="900" y1="70"  x2="640" y2="460" stroke="#88ccff" stroke-width="3" stroke-dasharray="12 8" style="animation:rayPulse 2s ease-in-out infinite 1.2s"/>
    <line x1="1100" y1="110" x2="640" y2="460" stroke="#88ccff" stroke-width="3" stroke-dasharray="12 8" style="animation:rayPulse 2s ease-in-out infinite 1.5s"/>
    <line x1="200" y1="300" x2="640" y2="460" stroke="#66aaff" stroke-width="2" stroke-dasharray="10 8" style="animation:rayPulse 2s ease-in-out infinite 0.4s"/>
    <line x1="1050" y1="320" x2="640" y2="460" stroke="#66aaff" stroke-width="2" stroke-dasharray="10 8" style="animation:rayPulse 2s ease-in-out infinite 0.8s"/>
  </g>
  <!-- Eye -->
  <g style="animation:fadeSlideIn .6s ease both 1.0s">
    <ellipse cx="640" cy="480" rx="52" ry="30" fill="white"/>
    <circle cx="640" cy="480" r="20" fill="#3366cc"/>
    <circle cx="640" cy="480" r="10" fill="#111"/>
    <circle cx="648" cy="473" r="4" fill="white" opacity="0.7"/>
  </g>
  <!-- Title -->
  <text x="640" y="600" text-anchor="middle" fill="white" font-size="36" font-weight="bold" style="animation:fadeSlideIn .6s ease both 1.5s">The Sky is Blue</text>
  <text x="640" y="648" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-size="20" style="animation:fadeSlideIn .5s ease both 2.0s">Scattered blue light reaches your eyes from every direction</text>
</svg>
</body></html>`,
    },
  ],
}

const CACHE_KEYS = ['why is the sky blue', 'why sky is blue', 'why is sky blue']

export function getTestCache(query: string): CachedLesson | null {
  const q = query.toLowerCase().trim().replace(/[?!.]+$/, '').trim()
  return CACHE_KEYS.includes(q) ? SKY_BLUE_CACHE : null
}
