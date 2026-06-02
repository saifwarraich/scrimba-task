interface ScriptScene {
  index: number
  title: string
  narration: string
  visualBrief: string
  durationSeconds: number
}

interface GeneratedScene {
  index: number
  html: string
  audioBase64: string
  durationSeconds: number
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const sceneBox = document.getElementById('sceneBox')!
const loadingState = document.getElementById('loadingState')!
const loadingStage = document.getElementById('loadingStage')!
const trackEl = document.getElementById('track')!
const playPauseBtn = document.getElementById('playPauseBtn') as HTMLButtonElement
const prevBtn = document.getElementById('prevBtn') as HTMLButtonElement
const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement
const restartBtn = document.getElementById('restartBtn') as HTMLButtonElement
const skipEndBtn = document.getElementById('skipEndBtn') as HTMLButtonElement
const sceneCounter = document.getElementById('sceneCounter')!
const timeDisplay = document.getElementById('timeDisplay')!
const queryDisplay = document.getElementById('queryDisplay')!
const reconnectBtn = document.getElementById('reconnectBtn') as HTMLButtonElement

// ── State ─────────────────────────────────────────────────────────────────────
const params = new URLSearchParams(location.search)
const lessonId = params.get('id') || ''
const query = params.get('q') || ''

queryDisplay.textContent = query

let scriptScenes: ScriptScene[] = []
let generatedScenes: GeneratedScene[] = []  // indexed by scene index
let totalScenes = 0
let allDone = false

let currentIndex = -1
let playing = false
let sceneTimer: ReturnType<typeof setTimeout> | null = null
let sceneTimerStart = 0
let sceneTimerDuration = 0
let sceneTimerRemaining = 0

const iframes: HTMLIFrameElement[] = []
const audioCtx = new AudioContext()
let currentAudioSource: AudioBufferSourceNode | null = null
let audioStartTime = 0
let audioDuration = 0
let audioBuffer: AudioBuffer | null = null

// ── Loading stage cycling ─────────────────────────────────────────────────────
const stages = ['Writing script...', 'Designing visuals...', 'Adding narration...', 'Almost ready...']
const stageTimes = [0, 2000, 5000, 10000]
let stageTimer: ReturnType<typeof setTimeout> | null = null

function cycleStage(idx: number) {
  loadingStage.textContent = stages[idx]
  if (idx + 1 < stages.length) {
    stageTimer = setTimeout(() => cycleStage(idx + 1), stageTimes[idx + 1] - stageTimes[idx])
  }
}
cycleStage(0)

// ── Track segments ────────────────────────────────────────────────────────────
function initTrack(total: number) {
  trackEl.innerHTML = ''
  for (let i = 0; i < total; i++) {
    const seg = document.createElement('div')
    seg.className = 'track-segment loading'
    seg.dataset.index = String(i)
    const fill = document.createElement('div')
    fill.className = 'track-fill'
    seg.appendChild(fill)
    seg.addEventListener('click', () => {
      const idx = Number(seg.dataset.index)
      if (generatedScenes[idx] && idx !== currentIndex) {
        seek(idx)
      }
    })
    trackEl.appendChild(seg)
  }
}

function getSegment(index: number): HTMLElement | null {
  return trackEl.querySelector(`[data-index="${index}"]`)
}

function updateSegmentState(index: number, state: 'loading' | 'pending' | 'active' | 'played') {
  const seg = getSegment(index)
  if (!seg) return
  seg.className = `track-segment ${state}`
  const fill = seg.querySelector('.track-fill') as HTMLElement
  if (fill) {
    fill.style.transition = 'none'
    fill.style.width = state === 'played' ? '100%' : '0%'
  }
}

function startTrackFill(index: number, durationMs: number) {
  const seg = getSegment(index)
  if (!seg) return
  const fill = seg.querySelector('.track-fill') as HTMLElement
  if (!fill) return
  fill.style.transition = 'none'
  fill.style.width = '0%'
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.transition = `width ${durationMs}ms linear`
      fill.style.width = '100%'
    })
  })
}

function pauseTrackFill(index: number) {
  const seg = getSegment(index)
  if (!seg) return
  const fill = seg.querySelector('.track-fill') as HTMLElement
  if (!fill) return
  const computed = getComputedStyle(fill).width
  const parent = seg.getBoundingClientRect().width
  const pct = parent > 0 ? (parseFloat(computed) / parent) * 100 : 0
  fill.style.transition = 'none'
  fill.style.width = `${pct}%`
}

// ── Audio helpers ─────────────────────────────────────────────────────────────
async function decodeAudio(base64: string): Promise<AudioBuffer | null> {
  if (!base64) return null
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return await audioCtx.decodeAudioData(bytes.buffer)
  } catch {
    return null
  }
}

function stopCurrentAudio() {
  if (currentAudioSource) {
    try { currentAudioSource.stop() } catch {}
    currentAudioSource.onended = null
    currentAudioSource = null
  }
}

async function playAudioBuffer(buf: AudioBuffer): Promise<void> {
  if (audioCtx.state === 'suspended') await audioCtx.resume()
  const source = audioCtx.createBufferSource()
  source.buffer = buf
  source.connect(audioCtx.destination)
  source.start()
  currentAudioSource = source
  audioBuffer = buf
  audioStartTime = audioCtx.currentTime
  audioDuration = buf.duration
  return new Promise<void>((resolve) => {
    source.onended = () => resolve()
  })
}

// Safety net injected into every scene: hard-clips the root to the viewport, lets
// grid/flex zones actually shrink (min-height:0), and auto-scales any scene whose
// content is still taller/wider than the box so nothing bleeds behind the controls.
const SCENE_GUARD = `<style id="__guard">
  html, body { width:100% !important; height:100% !important; max-width:100vw !important; max-height:100vh !important; overflow:hidden !important; margin:0 !important; }
  body > * , [class*="header"], [class*="visual"], [class*="caption"], [class*="side"], [class*="stage"], [class*="track"], [class*="left"], [class*="right"] { min-height:0; min-width:0; }
  svg { max-width:100%; max-height:100%; }
</style>
<script>(function(){
  function fit(){
    var b = document.body; if(!b) return;
    b.style.transform=''; b.style.width=''; b.style.height='';
    var sh=b.scrollHeight, sw=b.scrollWidth, ih=window.innerHeight, iw=window.innerWidth;
    var scale=Math.min(1, ih/sh, iw/sw);
    if(scale<0.985){
      scale=Math.max(scale,0.5);
      b.style.transformOrigin='top left';
      b.style.transform='scale('+scale+')';
      b.style.width=(100/scale)+'vw';
      b.style.height=(100/scale)+'vh';
    }
  }
  window.addEventListener('load', function(){ fit(); setTimeout(fit,300); setTimeout(fit,900); });
  window.addEventListener('resize', fit);
})();</script>`

// Insert the guard at the end of <body> (after the scene's own styles/scripts so
// our reset wins and the fit pass measures the final layout).
function prepareSceneHtml(html: string): string {
  if (html.includes('</body>')) return html.replace('</body>', `${SCENE_GUARD}</body>`)
  return html + SCENE_GUARD
}

// ── iFrame management ─────────────────────────────────────────────────────────
function ensureIframe(index: number): HTMLIFrameElement {
  if (!iframes[index]) {
    const iframe = document.createElement('iframe')
    iframe.sandbox.add('allow-scripts')
    iframe.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;border:none;opacity:0;transition:opacity 400ms ease;'
    sceneBox.appendChild(iframe)
    iframes[index] = iframe
  }
  return iframes[index]
}

function showIframe(index: number) {
  iframes.forEach((f, i) => {
    if (f) f.style.opacity = i === index ? '1' : '0'
  })
}

// ── Time formatting ───────────────────────────────────────────────────────────
function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function totalEstimatedDuration(): number {
  return scriptScenes.reduce((s, sc) => s + sc.durationSeconds, 0)
}

function elapsedToScene(idx: number): number {
  return scriptScenes.slice(0, idx).reduce((s, sc) => s + sc.durationSeconds, 0)
}

function updateTimeDisplay() {
  if (!scriptScenes.length) return
  let elapsed = elapsedToScene(currentIndex)
  if (currentIndex >= 0 && playing && audioCtx.state === 'running') {
    const remaining = sceneTimerRemaining > 0 ? sceneTimerRemaining : (scriptScenes[currentIndex]?.durationSeconds || 0)
    const sceneDur = scriptScenes[currentIndex]?.durationSeconds || 0
    elapsed += (sceneDur - remaining)
  }
  timeDisplay.textContent = `${fmt(elapsed)} / ~${fmt(totalEstimatedDuration())}`
}

// ── Controls state ────────────────────────────────────────────────────────────
function updateControls() {
  const atStart = currentIndex <= 0
  const atEnd = currentIndex >= totalScenes - 1
  const nextReady = !atEnd && !!generatedScenes[currentIndex + 1]

  prevBtn.disabled = atStart
  restartBtn.disabled = currentIndex < 0

  if (!nextReady && !atEnd) {
    nextBtn.disabled = true
    nextBtn.dataset.tooltip = 'Generating next scene...'
  } else {
    nextBtn.disabled = atEnd
    nextBtn.dataset.tooltip = ''
  }

  skipEndBtn.disabled = !allDone

  playPauseBtn.textContent = playing ? '⏸' : '▶'

  if (currentIndex >= 0 && totalScenes > 0) {
    sceneCounter.textContent = `Scene ${currentIndex + 1} / ${totalScenes}`
  }

  updateTimeDisplay()
}

// ── Core playback ─────────────────────────────────────────────────────────────
async function playScene(index: number) {
  const scene = generatedScenes[index]
  if (!scene) return

  stopCurrentAudio()
  if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null }

  // Update track segments
  for (let i = 0; i < totalScenes; i++) {
    if (i < index) updateSegmentState(i, 'played')
    else if (i === index) updateSegmentState(i, 'active')
    else if (generatedScenes[i]) updateSegmentState(i, 'pending')
    else updateSegmentState(i, 'loading')
  }

  const prevIndex = currentIndex
  currentIndex = index
  playing = true

  // Always reload the iframe so animations restart from the beginning
  const iframe = ensureIframe(index)

  // Wait for iframe load before showing (avoids blank flash on scene 0)
  const loadPromise = new Promise<void>(resolve => {
    const onLoad = () => { iframe.removeEventListener('load', onLoad); resolve() }
    iframe.addEventListener('load', onLoad)
    // Fallback in case load already fired or never fires
    setTimeout(resolve, 500)
  })

  iframe.srcdoc = prepareSceneHtml(scene.html)

  // Cross-fade
  if (prevIndex >= 0 && iframes[prevIndex]) {
    iframes[prevIndex].style.opacity = '0'
  }
  await loadPromise
  iframe.style.opacity = '1'

  const estimatedDur = scene.durationSeconds * 1000
  startTrackFill(index, estimatedDur)

  sceneTimerDuration = estimatedDur
  sceneTimerRemaining = estimatedDur
  sceneTimerStart = Date.now()

  function scheduleAdvance(ms: number) {
    if (sceneTimer) clearTimeout(sceneTimer)
    sceneTimerDuration = ms
    sceneTimerRemaining = ms
    sceneTimerStart = Date.now()
    sceneTimer = setTimeout(() => {
      if (currentIndex === index && playing) {
        const next = index + 1
        if (next < totalScenes && generatedScenes[next]) {
          playScene(next)
        } else if (next >= totalScenes) {
          playing = false
          updateControls()
          updateSegmentState(index, 'played')
        } else {
          playing = false
          updateControls()
        }
      }
    }, ms)
  }

  scheduleAdvance(estimatedDur)

  // Decode audio, sync timer to actual duration, then advance when audio ends
  if (scene.audioBase64) {
    decodeAudio(scene.audioBase64).then((buf) => {
      if (!buf || currentIndex !== index || !playing) return
      const actualDur = Math.ceil(buf.duration * 1000) + 300
      startTrackFill(index, actualDur)
      scheduleAdvance(actualDur)
      playAudioBuffer(buf).then(() => {
        // Audio finished — advance immediately if still on this scene
        if (currentIndex === index && playing) {
          if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null }
          const next = index + 1
          if (next < totalScenes && generatedScenes[next]) {
            playScene(next)
          } else if (next >= totalScenes) {
            playing = false
            updateControls()
            updateSegmentState(index, 'played')
          } else {
            playing = false
            updateControls()
          }
        }
      }).catch(() => {})
    })
  }

  updateControls()
}

function pause() {
  if (!playing) return
  playing = false
  stopCurrentAudio()
  pauseTrackFill(currentIndex)

  const elapsed = Date.now() - sceneTimerStart
  sceneTimerRemaining = Math.max(0, sceneTimerDuration - elapsed)
  if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null }

  // Pause CSS animations in iframe
  try {
    const doc = iframes[currentIndex]?.contentDocument
    if (doc) doc.getAnimations?.()?.forEach((a) => a.pause())
  } catch {}

  updateControls()
}

function resume() {
  if (playing || currentIndex < 0) return
  const scene = generatedScenes[currentIndex]
  if (!scene) return

  playing = true

  // Resume iframe animations
  try {
    const doc = iframes[currentIndex]?.contentDocument
    if (doc) doc.getAnimations?.()?.forEach((a) => a.play())
  } catch {}

  // Resume audio from position
  if (scene.audioBase64 && audioBuffer) {
    const offset = audioDuration - (sceneTimerRemaining / 1000)
    if (offset < audioDuration) {
      if (audioCtx.state === 'suspended') audioCtx.resume()
      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtx.destination)
      source.start(0, Math.max(0, offset))
      currentAudioSource = source
      audioStartTime = audioCtx.currentTime - offset
    }
  } else if (scene.audioBase64) {
    decodeAudio(scene.audioBase64).then((buf) => {
      if (buf && currentIndex === currentIndex && playing) {
        const offset = audioDuration - (sceneTimerRemaining / 1000)
        playAudioBuffer(buf).catch(() => {})
      }
    })
  }

  // Restart track fill for remaining duration
  const seg = getSegment(currentIndex)
  if (seg) {
    const fill = seg.querySelector('.track-fill') as HTMLElement
    if (fill) {
      const currentPct = parseFloat(fill.style.width) || 0
      const remainPct = 100 - currentPct
      fill.style.transition = `width ${sceneTimerRemaining}ms linear`
      fill.style.width = '100%'
    }
  }

  sceneTimerStart = Date.now()
  sceneTimer = setTimeout(() => {
    if (playing && currentIndex === currentIndex) {
      const next = currentIndex + 1
      if (next < totalScenes && generatedScenes[next]) {
        playScene(next)
      } else if (next >= totalScenes) {
        playing = false
        updateControls()
        updateSegmentState(currentIndex, 'played')
      } else {
        playing = false
        updateControls()
      }
    }
  }, sceneTimerRemaining)

  updateControls()
}

function togglePlay() {
  if (playing) pause()
  else if (currentIndex >= 0) resume()
  else if (generatedScenes[0]) playScene(0)
}

function seek(index: number) {
  if (index < 0 || index >= totalScenes) return
  if (!generatedScenes[index]) return

  stopCurrentAudio()
  if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null }
  playing = false

  playScene(index)
}

// ── Scene preload when it arrives ─────────────────────────────────────────────
function onSceneArrived(scene: GeneratedScene) {
  generatedScenes[scene.index] = scene
  updateSegmentState(scene.index, scene.index === currentIndex ? 'active' : 'pending')

  // Create iframe slot so it exists when playScene runs
  ensureIframe(scene.index)

  // If this is scene 0 and we haven't started yet, auto-play
  if (scene.index === 0 && currentIndex === -1) {
    if (stageTimer) clearTimeout(stageTimer)
    loadingState.style.display = 'none'
    playScene(0)
    return
  }

  // If player was stalled waiting for this scene, resume
  if (!playing && currentIndex >= 0 && scene.index === currentIndex + 1) {
    // auto-advance
    playScene(scene.index)
  }

  updateControls()
}

// ── SSE connection ────────────────────────────────────────────────────────────
function connectSSE() {
  const sse = new EventSource(`http://localhost:3000/api/lesson/${lessonId}/stream`)

  sse.addEventListener('script_ready', (e) => {
    const data = JSON.parse(e.data)
    totalScenes = data.totalScenes
    scriptScenes = data.scenes
    initTrack(totalScenes)
    updateControls()
  })

  sse.addEventListener('scene_ready', (e) => {
    const scene: GeneratedScene = JSON.parse(e.data)
    onSceneArrived(scene)
  })

  sse.addEventListener('done', () => {
    allDone = true
    skipEndBtn.disabled = false
    updateControls()
    sse.close()
  })

  sse.addEventListener('error', (e: any) => {
    if (sse.readyState === EventSource.CLOSED) {
      reconnectBtn.style.display = 'block'
    }
  })

  sse.onerror = () => {
    if (sse.readyState === EventSource.CLOSED) {
      reconnectBtn.style.display = 'block'
    }
  }

  reconnectBtn.onclick = () => {
    reconnectBtn.style.display = 'none'
    connectSSE()
  }
}

// ── Button wiring ─────────────────────────────────────────────────────────────
playPauseBtn.addEventListener('click', togglePlay)
prevBtn.addEventListener('click', () => seek(currentIndex - 1))
nextBtn.addEventListener('click', () => seek(currentIndex + 1))
restartBtn.addEventListener('click', () => seek(0))
skipEndBtn.addEventListener('click', () => seek(totalScenes - 1))

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return
  if (e.code === 'Space') { e.preventDefault(); togglePlay() }
  if (e.code === 'ArrowLeft') { e.preventDefault(); seek(currentIndex - 1) }
  if (e.code === 'ArrowRight') { e.preventDefault(); seek(currentIndex + 1) }
  if (e.key === 'r' || e.key === 'R') seek(0)
})

// ── Time display ticker ───────────────────────────────────────────────────────
setInterval(updateTimeDisplay, 500)

// ── Init ──────────────────────────────────────────────────────────────────────
if (!lessonId) {
  location.href = '/'
} else {
  connectSSE()
}
