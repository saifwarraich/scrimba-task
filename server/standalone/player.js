/* ────────────────────────────────────────────────────────────────────────────
   Scrimba Lesson Engine — Standalone Player
   This is a self-contained port of client/src/player.ts. It plays a lesson whose
   scenes (HTML + base64 audio) are baked into window.__LESSON__, with no server
   and no SSE — everything needed to play is already in this file. Sync behaviour
   is identical to the live player: the narration audio is the clock, so visuals
   stay locked to the voice. Keep this in step with player.ts when that changes.
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  var LESSON = window.__LESSON__ || { query: '', scenes: [] }
  // Scenes are baked in already-complete and in order, but sort by index defensively.
  var scenes = (LESSON.scenes || []).slice().sort(function (a, b) { return a.index - b.index })
  var totalScenes = scenes.length

  // ── DOM refs ────────────────────────────────────────────────────────────────
  var sceneBox = document.getElementById('sceneBox')
  var startOverlay = document.getElementById('startOverlay')
  var trackEl = document.getElementById('track')
  var playPauseBtn = document.getElementById('playPauseBtn')
  var prevBtn = document.getElementById('prevBtn')
  var nextBtn = document.getElementById('nextBtn')
  var restartBtn = document.getElementById('restartBtn')
  var skipEndBtn = document.getElementById('skipEndBtn')
  var sceneCounter = document.getElementById('sceneCounter')
  var timeDisplay = document.getElementById('timeDisplay')
  var queryDisplay = document.getElementById('queryDisplay')

  queryDisplay.textContent = LESSON.query || ''
  document.title = (LESSON.query ? LESSON.query + ' — ' : '') + 'Scrimba Lesson'

  // ── State ─────────────────────────────────────────────────────────────────────
  var currentIndex = -1
  var playing = false
  var sceneTimer = null
  var sceneTimerStart = 0
  var sceneTimerDuration = 0
  var sceneTimerRemaining = 0

  var iframes = []
  var audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  var currentAudioSource = null
  var audioStartTime = 0
  var audioDuration = 0
  var audioBuffer = null

  // ── Track segments ──────────────────────────────────────────────────────────
  function initTrack(total) {
    trackEl.innerHTML = ''
    for (var i = 0; i < total; i++) {
      var seg = document.createElement('div')
      seg.className = 'track-segment pending'
      seg.dataset.index = String(i)
      var fill = document.createElement('div')
      fill.className = 'track-fill'
      seg.appendChild(fill)
      seg.addEventListener('click', (function (s) {
        return function () {
          var idx = Number(s.dataset.index)
          if (idx !== currentIndex) seek(idx)
        }
      })(seg))
      trackEl.appendChild(seg)
    }
  }

  function getSegment(index) {
    return trackEl.querySelector('[data-index="' + index + '"]')
  }

  function updateSegmentState(index, state) {
    var seg = getSegment(index)
    if (!seg) return
    seg.className = 'track-segment ' + state
    var fill = seg.querySelector('.track-fill')
    if (fill) {
      fill.style.transition = 'none'
      fill.style.width = state === 'played' ? '100%' : '0%'
    }
  }

  function startTrackFill(index, durationMs) {
    var seg = getSegment(index)
    if (!seg) return
    var fill = seg.querySelector('.track-fill')
    if (!fill) return
    fill.style.transition = 'none'
    fill.style.width = '0%'
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        fill.style.transition = 'width ' + durationMs + 'ms linear'
        fill.style.width = '100%'
      })
    })
  }

  function pauseTrackFill(index) {
    var seg = getSegment(index)
    if (!seg) return
    var fill = seg.querySelector('.track-fill')
    if (!fill) return
    var computed = getComputedStyle(fill).width
    var parent = seg.getBoundingClientRect().width
    var pct = parent > 0 ? (parseFloat(computed) / parent) * 100 : 0
    fill.style.transition = 'none'
    fill.style.width = pct + '%'
  }

  // ── Audio helpers ─────────────────────────────────────────────────────────────
  function decodeAudio(base64) {
    if (!base64) return Promise.resolve(null)
    try {
      var binary = atob(base64)
      var bytes = new Uint8Array(binary.length)
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return audioCtx.decodeAudioData(bytes.buffer).catch(function () { return null })
    } catch (e) {
      return Promise.resolve(null)
    }
  }

  function stopCurrentAudio() {
    if (currentAudioSource) {
      try { currentAudioSource.stop() } catch (e) {}
      currentAudioSource.onended = null
      currentAudioSource = null
    }
  }

  function playAudioBuffer(buf) {
    return new Promise(function (resolve) {
      function go() {
        var source = audioCtx.createBufferSource()
        source.buffer = buf
        source.connect(audioCtx.destination)
        source.start()
        currentAudioSource = source
        audioBuffer = buf
        audioStartTime = audioCtx.currentTime
        audioDuration = buf.duration
        source.onended = function () { resolve() }
      }
      if (audioCtx.state === 'suspended') audioCtx.resume().then(go)
      else go()
    })
  }

  // Safety net injected into every scene — mirrors SCENE_GUARD in player.ts.
  var SCENE_GUARD = '<style id="__guard">' +
    'html, body { width:100% !important; height:100% !important; max-width:100vw !important; max-height:100vh !important; overflow:hidden !important; margin:0 !important; }' +
    'body > * , [class*="header"], [class*="visual"], [class*="caption"], [class*="side"], [class*="stage"], [class*="track"], [class*="left"], [class*="right"] { min-height:0; min-width:0; }' +
    'svg { max-width:100%; max-height:100%; }' +
    '</style>' +
    '<script>(function(){' +
    'function fit(){' +
    'var b = document.body; if(!b) return;' +
    "b.style.transform=''; b.style.width=''; b.style.height='';" +
    'var sh=b.scrollHeight, sw=b.scrollWidth, ih=window.innerHeight, iw=window.innerWidth;' +
    'var scale=Math.min(1, ih/sh, iw/sw);' +
    'if(scale<0.985){' +
    'scale=Math.max(scale,0.5);' +
    "b.style.transformOrigin='top left';" +
    "b.style.transform='scale('+scale+')';" +
    "b.style.width=(100/scale)+'vw';" +
    "b.style.height=(100/scale)+'vh';" +
    '}' +
    '}' +
    "window.addEventListener('load', function(){ fit(); setTimeout(fit,300); setTimeout(fit,900); });" +
    "window.addEventListener('resize', fit);" +
    '})();<\/script>'

  // Pausable timing controller — mirrors SCENE_TIMING_CONTROL in player.ts. Injected
  // at the top of every scene so it can intercept the scene's own rAF/timers/anims,
  // which the parent can't reach across the sandbox boundary.
  var SCENE_TIMING_CONTROL = '<script>(function(){' +
    'var paused = false;' +
    'var realRAF = window.requestAnimationFrame.bind(window);' +
    'var realCAF = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : function(){};' +
    'var rafQueued = [];' +
    'var rafReal = {};' +
    'var rafSeq = 1;' +
    'window.requestAnimationFrame = function(cb){' +
    'var id = rafSeq++;' +
    'if (paused) { rafQueued.push({ id:id, cb:cb }); }' +
    'else { rafReal[id] = realRAF(function(ts){ delete rafReal[id]; cb(ts); }); }' +
    'return id;' +
    '};' +
    'window.cancelAnimationFrame = function(id){' +
    'if (rafReal[id] != null) { realCAF(rafReal[id]); delete rafReal[id]; }' +
    'rafQueued = rafQueued.filter(function(r){ return r.id !== id; });' +
    '};' +
    'function flushRAF(){' +
    'var q = rafQueued; rafQueued = [];' +
    'q.forEach(function(r){ rafReal[r.id] = realRAF(function(ts){ delete rafReal[r.id]; r.cb(ts); }); });' +
    '}' +
    'var realST = window.setTimeout.bind(window);' +
    'var realCT = window.clearTimeout.bind(window);' +
    'var realSI = window.setInterval.bind(window);' +
    'var realCI = window.clearInterval.bind(window);' +
    'var timers = {};' +
    'var tSeq = 1;' +
    'function schedule(rec){' +
    'rec.start = Date.now();' +
    "if (rec.kind === 'interval') {" +
    'rec.realId = realSI(function(){ rec.start = Date.now(); rec.fn.apply(null, rec.args); }, rec.delay);' +
    '} else {' +
    'rec.realId = realST(function(){ delete timers[rec.id]; rec.fn.apply(null, rec.args); }, rec.remaining);' +
    '}' +
    '}' +
    'window.setTimeout = function(fn, delay){' +
    'var args = Array.prototype.slice.call(arguments, 2);' +
    'var id = tSeq++;' +
    "var rec = { id:id, kind:'timeout', fn:fn, delay:delay||0, remaining:delay||0, args:args, realId:null };" +
    'timers[id] = rec;' +
    'if (!paused) schedule(rec);' +
    'return id;' +
    '};' +
    'window.clearTimeout = function(id){' +
    'var rec = timers[id];' +
    'if (rec) { if (rec.realId != null) realCT(rec.realId); delete timers[id]; }' +
    'else realCT(id);' +
    '};' +
    'window.setInterval = function(fn, delay){' +
    'var args = Array.prototype.slice.call(arguments, 2);' +
    'var id = tSeq++;' +
    "var rec = { id:id, kind:'interval', fn:fn, delay:delay||0, remaining:delay||0, args:args, realId:null };" +
    'timers[id] = rec;' +
    'if (!paused) schedule(rec);' +
    'return id;' +
    '};' +
    'window.clearInterval = function(id){' +
    'var rec = timers[id];' +
    'if (rec) { if (rec.realId != null) realCI(rec.realId); delete timers[id]; }' +
    'else realCI(id);' +
    '};' +
    'function pauseTimers(){' +
    'Object.keys(timers).forEach(function(k){' +
    'var rec = timers[k];' +
    'if (rec.realId == null) return;' +
    "if (rec.kind === 'interval') { realCI(rec.realId); rec.realId = null; }" +
    'else { realCT(rec.realId); rec.realId = null; rec.remaining = Math.max(0, rec.remaining - (Date.now() - rec.start)); }' +
    '});' +
    '}' +
    'function resumeTimers(){ Object.keys(timers).forEach(function(k){ schedule(timers[k]); }); }' +
    'function pauseAnims(){ try { document.getAnimations().forEach(function(a){ a.pause(); }); } catch(e){} }' +
    'function resumeAnims(){ try { document.getAnimations().forEach(function(a){ a.play(); }); } catch(e){} }' +
    'function doPause(){ if (paused) return; paused = true; pauseTimers(); pauseAnims(); }' +
    'function doResume(){ if (!paused) return; paused = false; resumeTimers(); flushRAF(); resumeAnims(); }' +
    "window.addEventListener('message', function(e){" +
    'var d = e && e.data;' +
    "if (!d || typeof d !== 'object') return;" +
    "if (d.__lessonCtrl === 'pause') doPause();" +
    "else if (d.__lessonCtrl === 'resume') doResume();" +
    '});' +
    '})();<\/script>'

  function prepareSceneHtml(html) {
    var out = html
    if (out.indexOf('<head>') !== -1) out = out.replace('<head>', '<head>' + SCENE_TIMING_CONTROL)
    else if (/<html[^>]*>/.test(out)) out = out.replace(/(<html[^>]*>)/, '$1' + SCENE_TIMING_CONTROL)
    else out = SCENE_TIMING_CONTROL + out

    if (out.indexOf('</body>') !== -1) out = out.replace('</body>', SCENE_GUARD + '</body>')
    else out = out + SCENE_GUARD
    return out
  }

  function postToIframe(index, cmd) {
    try {
      if (iframes[index] && iframes[index].contentWindow) {
        iframes[index].contentWindow.postMessage({ __lessonCtrl: cmd }, '*')
      }
    } catch (e) {}
  }

  // ── iFrame management ─────────────────────────────────────────────────────────
  function ensureIframe(index) {
    if (!iframes[index]) {
      var iframe = document.createElement('iframe')
      iframe.sandbox.add('allow-scripts')
      iframe.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;border:none;opacity:0;transition:opacity 400ms ease;'
      sceneBox.appendChild(iframe)
      iframes[index] = iframe
    }
    return iframes[index]
  }

  // ── Time formatting ───────────────────────────────────────────────────────────
  function fmt(s) {
    var m = Math.floor(s / 60)
    var sec = Math.floor(s % 60)
    return m + ':' + (sec < 10 ? '0' + sec : sec)
  }

  function totalEstimatedDuration() {
    return scenes.reduce(function (s, sc) { return s + sc.durationSeconds }, 0)
  }

  function elapsedToScene(idx) {
    return scenes.slice(0, idx).reduce(function (s, sc) { return s + sc.durationSeconds }, 0)
  }

  function updateTimeDisplay() {
    if (!scenes.length) return
    var elapsed = elapsedToScene(currentIndex)
    if (currentIndex >= 0 && playing) {
      if (currentAudioSource && audioDuration > 0) {
        elapsed += Math.min(audioDuration, Math.max(0, audioCtx.currentTime - audioStartTime))
      } else {
        elapsed += Math.max(0, (sceneTimerDuration - sceneTimerRemaining) / 1000)
      }
    }
    timeDisplay.textContent = fmt(elapsed) + ' / ~' + fmt(totalEstimatedDuration())
  }

  // ── Controls state ────────────────────────────────────────────────────────────
  function updateControls() {
    var atStart = currentIndex <= 0
    var atEnd = currentIndex >= totalScenes - 1

    prevBtn.disabled = atStart
    restartBtn.disabled = currentIndex < 0
    nextBtn.disabled = atEnd
    skipEndBtn.disabled = atEnd

    playPauseBtn.textContent = playing ? '⏸' : '▶'

    if (currentIndex >= 0 && totalScenes > 0) {
      sceneCounter.textContent = 'Scene ' + (currentIndex + 1) + ' / ' + totalScenes
    }
    updateTimeDisplay()
  }

  // ── Core playback ─────────────────────────────────────────────────────────────
  function advance(fromIndex) {
    if (currentIndex !== fromIndex || !playing) return
    if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null }
    stopCurrentAudio()
    updateSegmentState(fromIndex, 'played')

    var next = fromIndex + 1
    if (next >= totalScenes) {
      playing = false
      updateControls()
      return
    }
    playScene(next)
  }

  function playScene(index) {
    var scene = scenes[index]
    if (!scene) return

    stopCurrentAudio()
    audioBuffer = null
    if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null }

    for (var i = 0; i < totalScenes; i++) {
      if (i < index) updateSegmentState(i, 'played')
      else if (i === index) updateSegmentState(i, 'active')
      else updateSegmentState(i, 'pending')
    }

    var prevIndex = currentIndex
    currentIndex = index
    playing = true

    var iframe = ensureIframe(index)
    var decodePromise = scene.audioBase64 ? decodeAudio(scene.audioBase64) : Promise.resolve(null)

    var loadPromise = new Promise(function (resolve) {
      var onLoad = function () { iframe.removeEventListener('load', onLoad); resolve() }
      iframe.addEventListener('load', onLoad)
      setTimeout(resolve, 500)
    })

    iframe.srcdoc = prepareSceneHtml(scene.html)

    if (prevIndex >= 0 && iframes[prevIndex]) {
      iframes[prevIndex].style.opacity = '0'
    }

    loadPromise.then(function () {
      if (currentIndex !== index || !playing) return
      iframe.style.opacity = '1'
      return decodePromise.then(function (buf) {
        if (currentIndex !== index || !playing) return

        if (buf) {
          // Audio is the clock — the scene lasts exactly as long as its narration.
          var durMs = buf.duration * 1000
          startTrackFill(index, durMs)
          sceneTimerDuration = durMs
          sceneTimerRemaining = durMs
          sceneTimerStart = Date.now()

          playAudioBuffer(buf).then(function () { advance(index) }).catch(function () {})
          sceneTimer = setTimeout(function () { advance(index) }, durMs + 800)
        } else {
          var d = scene.durationSeconds * 1000
          startTrackFill(index, d)
          sceneTimerDuration = d
          sceneTimerRemaining = d
          sceneTimerStart = Date.now()
          sceneTimer = setTimeout(function () { advance(index) }, d)
        }
        updateControls()
      })
    })

    updateControls()
  }

  function pause() {
    if (!playing) return
    playing = false
    stopCurrentAudio()
    pauseTrackFill(currentIndex)

    var elapsed = Date.now() - sceneTimerStart
    sceneTimerRemaining = Math.max(0, sceneTimerDuration - elapsed)
    if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null }

    postToIframe(currentIndex, 'pause')
    updateControls()
  }

  function resume() {
    if (playing || currentIndex < 0) return
    var scene = scenes[currentIndex]
    if (!scene) return

    var idx = currentIndex
    playing = true

    postToIframe(idx, 'resume')

    if (scene.audioBase64 && audioBuffer) {
      var offset = Math.max(0, audioDuration - (sceneTimerRemaining / 1000))
      if (offset < audioDuration) {
        if (audioCtx.state === 'suspended') audioCtx.resume()
        var source = audioCtx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(audioCtx.destination)
        source.onended = function () { advance(idx) }
        source.start(0, offset)
        currentAudioSource = source
        audioStartTime = audioCtx.currentTime - offset
      }
    }

    var seg = getSegment(idx)
    if (seg) {
      var fill = seg.querySelector('.track-fill')
      if (fill) {
        fill.style.transition = 'width ' + sceneTimerRemaining + 'ms linear'
        fill.style.width = '100%'
      }
    }

    sceneTimerStart = Date.now()
    sceneTimer = setTimeout(function () { advance(idx) }, sceneTimerRemaining + (scene.audioBase64 && audioBuffer ? 800 : 0))
    updateControls()
  }

  function togglePlay() {
    if (playing) pause()
    else if (currentIndex >= 0) resume()
    else playScene(0)
  }

  function seek(index) {
    if (index < 0 || index >= totalScenes) return
    stopCurrentAudio()
    if (sceneTimer) { clearTimeout(sceneTimer); sceneTimer = null }
    playing = false
    playScene(index)
  }

  // ── Start overlay (satisfies the browser's audio user-gesture requirement) ────
  function start() {
    startOverlay.style.display = 'none'
    if (audioCtx.state === 'suspended') audioCtx.resume()
    playScene(0)
  }

  // ── Wiring ────────────────────────────────────────────────────────────────────
  startOverlay.addEventListener('click', start)
  playPauseBtn.addEventListener('click', togglePlay)
  prevBtn.addEventListener('click', function () { seek(currentIndex - 1) })
  nextBtn.addEventListener('click', function () { seek(currentIndex + 1) })
  restartBtn.addEventListener('click', function () { seek(0) })
  skipEndBtn.addEventListener('click', function () { seek(totalScenes - 1) })

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') { e.preventDefault(); if (currentIndex < 0) start(); else togglePlay() }
    if (e.code === 'ArrowLeft') { e.preventDefault(); seek(currentIndex - 1) }
    if (e.code === 'ArrowRight') { e.preventDefault(); seek(currentIndex + 1) }
    if (e.key === 'r' || e.key === 'R') seek(0)
  })

  setInterval(updateTimeDisplay, 500)

  // ── Init ──────────────────────────────────────────────────────────────────────
  if (!totalScenes) {
    startOverlay.innerHTML = '<div class="start-card"><div class="start-title">This lesson is empty</div></div>'
  } else {
    initTrack(totalScenes)
    updateControls()
  }
})()
