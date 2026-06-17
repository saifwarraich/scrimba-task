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
const downloadBtn = document.getElementById('downloadBtn') as HTMLButtonElement

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
let waitingForNext = false  // true when audio ended but next scene not generated yet
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

// Pausable timing controller, injected at the TOP of every scene (before the
// scene's own scripts run) so it can intercept their rAF/timer/animation calls.
// The scene iframe is sandboxed (cross-origin), so the parent cannot reach in to
// pause it directly — instead the parent posts {__lessonCtrl:'pause'|'resume'}
// and this controller freezes/thaws all animation from the inside.
const SCENE_TIMING_CONTROL = `<script>(function(){
  var paused = false;
  // ---- requestAnimationFrame ----
  var realRAF = window.requestAnimationFrame.bind(window);
  var realCAF = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : function(){};
  var rafQueued = [];      // callbacks deferred while paused
  var rafReal = {};        // our id -> real raf id (currently scheduled)
  var rafSeq = 1;
  window.requestAnimationFrame = function(cb){
    var id = rafSeq++;
    if (paused) { rafQueued.push({ id:id, cb:cb }); }
    else { rafReal[id] = realRAF(function(ts){ delete rafReal[id]; cb(ts); }); }
    return id;
  };
  window.cancelAnimationFrame = function(id){
    if (rafReal[id] != null) { realCAF(rafReal[id]); delete rafReal[id]; }
    rafQueued = rafQueued.filter(function(r){ return r.id !== id; });
  };
  function flushRAF(){
    var q = rafQueued; rafQueued = [];
    q.forEach(function(r){ rafReal[r.id] = realRAF(function(ts){ delete rafReal[r.id]; r.cb(ts); }); });
  }
  // ---- setTimeout / setInterval ----
  var realST = window.setTimeout.bind(window);
  var realCT = window.clearTimeout.bind(window);
  var realSI = window.setInterval.bind(window);
  var realCI = window.clearInterval.bind(window);
  var timers = {};
  var tSeq = 1;
  function schedule(rec){
    rec.start = Date.now();
    if (rec.kind === 'interval') {
      rec.realId = realSI(function(){ rec.start = Date.now(); rec.fn.apply(null, rec.args); }, rec.delay);
    } else {
      rec.realId = realST(function(){ delete timers[rec.id]; rec.fn.apply(null, rec.args); }, rec.remaining);
    }
  }
  window.setTimeout = function(fn, delay){
    var args = Array.prototype.slice.call(arguments, 2);
    var id = tSeq++;
    var rec = { id:id, kind:'timeout', fn:fn, delay:delay||0, remaining:delay||0, args:args, realId:null };
    timers[id] = rec;
    if (!paused) schedule(rec);
    return id;
  };
  window.clearTimeout = function(id){
    var rec = timers[id];
    if (rec) { if (rec.realId != null) realCT(rec.realId); delete timers[id]; }
    else realCT(id);
  };
  window.setInterval = function(fn, delay){
    var args = Array.prototype.slice.call(arguments, 2);
    var id = tSeq++;
    var rec = { id:id, kind:'interval', fn:fn, delay:delay||0, remaining:delay||0, args:args, realId:null };
    timers[id] = rec;
    if (!paused) schedule(rec);
    return id;
  };
  window.clearInterval = function(id){
    var rec = timers[id];
    if (rec) { if (rec.realId != null) realCI(rec.realId); delete timers[id]; }
    else realCI(id);
  };
  function pauseTimers(){
    Object.keys(timers).forEach(function(k){
      var rec = timers[k];
      if (rec.realId == null) return;
      if (rec.kind === 'interval') { realCI(rec.realId); rec.realId = null; }
      else { realCT(rec.realId); rec.realId = null; rec.remaining = Math.max(0, rec.remaining - (Date.now() - rec.start)); }
    });
  }
  function resumeTimers(){ Object.keys(timers).forEach(function(k){ schedule(timers[k]); }); }
  // ---- CSS / Web Animations ----
  function pauseAnims(){ try { document.getAnimations().forEach(function(a){ a.pause(); }); } catch(e){} }
  function resumeAnims(){ try { document.getAnimations().forEach(function(a){ a.play(); }); } catch(e){} }
  // ---- control ----
  function doPause(){ if (paused) return; paused = true; pauseTimers(); pauseAnims(); }
  function doResume(){ if (!paused) return; paused = false; resumeTimers(); flushRAF(); resumeAnims(); }
  window.addEventListener('message', function(e){
    var d = e && e.data;
    if (!d || typeof d !== 'object') return;
    if (d.__lessonCtrl === 'pause') doPause();
    else if (d.__lessonCtrl === 'resume') doResume();
  });
})();<\/script>`

// Inject the timing controller as early as possible (before scene scripts), and
// the visual guard at the end of <body> (after the scene's own styles so our
// reset wins and the fit pass measures the final layout).
function prepareSceneHtml(html: string): string {
  let out = html
  if (out.includes('<head>')) out = out.replace('<head>', `<head>${SCENE_TIMING_CONTROL}`)
  else if (/<html[^>]*>/.test(out)) out = out.replace(/(<html[^>]*>)/, `$1${SCENE_TIMING_CONTROL}`)
  else out = SCENE_TIMING_CONTROL + out

  if (out.includes('</body>')) out = out.replace('</body>', `${SCENE_GUARD}</body>`)
  else out = out + SCENE_GUARD
  return out
}

function postToIframe(index: number, cmd: 'pause' | 'resume') {
  try { iframes[index]?.contentWindow?.postMessage({ __lessonCtrl: cmd }, '*') } catch {}
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
  if (currentIndex >= 0 && playing) {
    if (currentAudioSource && audioDuration > 0) {
      // Live position from the audio clock — keeps the readout synced to narration.
      elapsed += Math.min(audioDuration, Math.max(0, audioCtx.currentTime - audioStartTime))
    } else {
      elapsed += Math.max(0, (sceneTimerDuration - sceneTimerRemaining) / 1000)
    }
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

// Single place that decides what happens when a scene's narration ends.
// Only advances when the next scene is actually generated; otherwise it parks on
// the current (finished) scene and waits — onSceneArrived() resumes the flow.
function advance(fromIndex: number) {
  if (currentIndex !== fromIndex || !playing) return
  if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null }
  stopCurrentAudio()
  updateSegmentState(fromIndex, 'played')

  const next = fromIndex + 1
  if (next >= totalScenes) {
    playing = false
    waitingForNext = false
    updateControls()
    return
  }
  if (generatedScenes[next]) {
    playScene(next)
  } else {
    // Next scene still generating — hold here (frozen on the last frame) until it
    // arrives rather than jumping to a blank/unready scene.
    playing = false
    waitingForNext = true
    postToIframe(fromIndex, 'pause')
    updateControls()
  }
}

async function playScene(index: number) {
  const scene = generatedScenes[index]
  if (!scene) return

  stopCurrentAudio()
  audioBuffer = null
  waitingForNext = false
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

  // Decode audio in parallel with the iframe load so we can sync to its real length
  const decodePromise = scene.audioBase64 ? decodeAudio(scene.audioBase64) : Promise.resolve(null)

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
  if (currentIndex !== index || !playing) return  // navigated away during load
  iframe.style.opacity = '1'

  const buf = await decodePromise
  if (currentIndex !== index || !playing) return  // navigated away during decode

  if (buf) {
    // Audio drives everything: the scene plays exactly as long as the narration.
    const durMs = buf.duration * 1000
    startTrackFill(index, durMs)
    sceneTimerDuration = durMs
    sceneTimerRemaining = durMs
    sceneTimerStart = Date.now()

    playAudioBuffer(buf).then(() => advance(index)).catch(() => {})

    // Safety net: if `onended` never fires (some browsers/edge cases), advance a
    // bit after the known duration so playback can't hang.
    sceneTimer = setTimeout(() => advance(index), durMs + 800)
  } else {
    // No audio for this scene — fall back to the script's estimated duration.
    const durMs = scene.durationSeconds * 1000
    startTrackFill(index, durMs)
    sceneTimerDuration = durMs
    sceneTimerRemaining = durMs
    sceneTimerStart = Date.now()
    sceneTimer = setTimeout(() => advance(index), durMs)
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

  // Freeze the scene's animations/timers from inside the sandboxed iframe.
  postToIframe(currentIndex, 'pause')

  updateControls()
}

function resume() {
  if (playing || currentIndex < 0) return
  const scene = generatedScenes[currentIndex]
  if (!scene) return

  const idx = currentIndex
  playing = true

  // Thaw the scene's animations/timers
  postToIframe(idx, 'resume')

  // Resume audio from where it left off; audio end remains the advance trigger.
  if (scene.audioBase64 && audioBuffer) {
    const offset = Math.max(0, audioDuration - (sceneTimerRemaining / 1000))
    if (offset < audioDuration) {
      if (audioCtx.state === 'suspended') audioCtx.resume()
      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtx.destination)
      source.onended = () => advance(idx)
      source.start(0, offset)
      currentAudioSource = source
      audioStartTime = audioCtx.currentTime - offset
    }
  }

  // Restart track fill for the remaining duration
  const seg = getSegment(idx)
  if (seg) {
    const fill = seg.querySelector('.track-fill') as HTMLElement
    if (fill) {
      fill.style.transition = `width ${sceneTimerRemaining}ms linear`
      fill.style.width = '100%'
    }
  }

  sceneTimerStart = Date.now()
  // Safety net only; the audio `onended` above is the real advance trigger.
  sceneTimer = setTimeout(() => advance(idx), sceneTimerRemaining + (scene.audioBase64 && audioBuffer ? 800 : 0))

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

  // If playback parked waiting for this exact next scene, continue now.
  // (Only when we were auto-waiting — not when the user manually paused.)
  if (waitingForNext && currentIndex >= 0 && scene.index === currentIndex + 1) {
    waitingForNext = false
    playScene(scene.index)
  }

  updateControls()
}

// ── SSE connection ────────────────────────────────────────────────────────────
function connectSSE() {
  const sse = new EventSource(`/api/lesson/${lessonId}/stream`)

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
    downloadBtn.disabled = false
    downloadBtn.dataset.tooltip = 'Download a standalone file you can play offline'
    updateControls()
    sse.close()
  })

  sse.addEventListener('error', () => {
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

// Download the finished lesson as a self-contained, offline-playable HTML file.
downloadBtn.disabled = true
downloadBtn.addEventListener('click', async () => {
  if (downloadBtn.disabled) return
  const original = downloadBtn.textContent
  downloadBtn.disabled = true
  downloadBtn.textContent = '↓ Preparing…'
  try {
    const res = await fetch(`/api/lesson/${lessonId}/export`)
    if (!res.ok) throw new Error(`Export failed (${res.status})`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Server sets the real filename via Content-Disposition; this is a fallback.
    a.download = `lesson-${query.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    alert(`Could not download lesson: ${String(err)}`)
  } finally {
    downloadBtn.textContent = original
    downloadBtn.disabled = false
  }
})

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
