// 5-4-3-2-1 Grounding Technique

// Auto-play background music
const music = document.getElementById('music')
const musicToggle = document.getElementById('music-toggle')
let isMusicPlaying = true

music.play().catch(() => {
  document.addEventListener('click', () => {
    music.play()
  }, { once: true })
})

function toggleMusic() {
  if (isMusicPlaying) {
    music.pause()
    musicToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>'
    isMusicPlaying = false
  } else {
    music.play()
    musicToggle.innerHTML = '<i class="fa-solid fa-music"></i>'
    isMusicPlaying = true
  }
}

const STEPS = [
  { sense: 'see', icon: '👀', instruction: 'Look around.\nWhat is something you see?', count: 5, description: 'see' },
  { sense: 'touch', icon: '✋', instruction: 'Find something you can touch!', count: 4, description: 'touch' },
  { sense: 'hear', icon: '👂', instruction: 'Listen carefully. What sounds do you notice?', count: 3, description: 'hear' },
  { sense: 'smell', icon: '👃', instruction: 'Take a deep breath.\nWhat smells do you detect?', count: 2, description: 'smell' },
  { sense: 'taste', icon: '👅', instruction: 'What do you taste in your mouth?\n As an alternative, take a sip of water.', count: 1, description: 'taste' }
]

let currentStepIndex = 0
let currentItemIndex = 0
let previousStepIndex = -1

const introScreen = document.getElementById('intro-screen')
const mainContent = document.getElementById('main-content')
const navButtons = document.getElementById('nav-buttons')
const icon = document.getElementById('sense-icon')
const instruction = document.getElementById('instruction')
const counter = document.getElementById('counter')
const description = document.getElementById('description')
const progressFill = document.getElementById('progress-fill')
const prevBtn = document.getElementById('prev-btn')
const nextBtn = document.getElementById('next-btn')
const container = document.getElementById('grounding-container')
const transcript = document.getElementById('transcript')
const transcriptText = document.getElementById('transcript-text')
const waveformCanvas = document.getElementById('waveform')
const waveformCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null

// Voice Activity Detection setup (using volume instead of speech recognition)
let isListening = false
let audioContext = null
let analyser = null
let microphone = null
let animationId = null
let hasRecognitionError = false

// --- Voice detection tuning ---
const VOICE_FREQ_MIN = 300   // Hz — lower bound of speech energy band
const VOICE_FREQ_MAX = 3400  // Hz — upper bound of speech energy band
const CALIBRATION_MS = 600   // how long to sample ambient noise before starting
const THRESHOLD_MARGIN = 14  // how far above the noise floor counts as "voice"
const MIN_THRESHOLD = 16     // never go more sensitive than this
const MAX_THRESHOLD = 55     // never require louder than this

let volumeHistory = []
let voiceFreqRange = null    // { lowIndex, highIndex } computed once analyser exists
let noiseFloor = 12          // running estimate of ambient noise, refined by calibration
let dynamicThreshold = 30    // replaces the old fixed VOLUME_THRESHOLD
const FLOOR_WINDOW_MS = 4000 // trailing window used to re-estimate the ambient floor
let floorWindow = []         // { t, value } samples for the rolling minimum

// --- Auto-advance on detected pause ---
const MIN_SPEECH_MS = 600        // must speak at least this long before a pause can "count"
const PAUSE_TO_TRIGGER_MS = 1300 // silence this long looks like end-of-sentence
const GRACE_PERIOD_MS = 1100     // window to keep talking and cancel the auto-advance

let autoAdvanceEnabled = true
let speechState = 'idle'         // 'idle' | 'speaking'
let totalSpeechMs = 0
let silenceStartTime = null
let lastFrameTime = null
let pendingAdvanceTimer = null
let pendingAdvanceActive = false


function startExercise() {
  introScreen.style.display = 'none'
  mainContent.style.display = 'flex'
  navButtons.style.display = 'flex'

  previousStepIndex = -1  // Ensure first display is a full update
  updateDisplay()
}

async function startListening() {
  if (isListening || hasRecognitionError) return

  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)()
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.25
    }

    if (!microphone) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true, // helps a lot if the app's own music bleeds into the mic via speakers
          noiseSuppression: true, // reduces steady background noise (fans, hum, etc.)
          autoGainControl: false  // keep raw levels stable - AGC fighting our own threshold math causes erratic readings
        },
        video: false
      })
      microphone = audioContext.createMediaStreamSource(stream)
      microphone.connect(analyser)
      computeVoiceFreqRange()
      transcript.classList.add('active')
      await calibrateNoiseFloor()
    }

    isListening = true
    resetSpeechState()
    transcriptText.textContent = 'Speak naturally...'
    transcript.classList.add('active')

    lastFrameTime = null
    animationId = requestAnimationFrame(detectVoiceActivity)
  } catch (e) {
    console.error('Failed to start voice detection:', e)
    hasRecognitionError = true
    transcriptText.textContent = 'Microphone access denied. Use Next button.'
    transcript.classList.add('active')
  }
}

// Figure out which FFT bins correspond to typical speech energy (300Hz-3400Hz),
// so detection isn't diluted by averaging in silent high-frequency bins.
function computeVoiceFreqRange() {
  const nyquist = audioContext.sampleRate / 2
  const binHz = nyquist / analyser.frequencyBinCount
  const lowIndex = Math.max(1, Math.floor(VOICE_FREQ_MIN / binHz))
  const highIndex = Math.min(analyser.frequencyBinCount - 1, Math.ceil(VOICE_FREQ_MAX / binHz))
  voiceFreqRange = { lowIndex, highIndex }
}

function bandAverage(dataArray) {
  const { lowIndex, highIndex } = voiceFreqRange
  let sum = 0
  let count = 0
  for (let i = lowIndex; i <= highIndex; i++) {
    sum += dataArray[i]
    count++
  }
  return count > 0 ? sum / count : 0
}

function clampThreshold(value) {
  return Math.min(Math.max(value, MIN_THRESHOLD), MAX_THRESHOLD)
}

// Briefly sample ambient noise (assumed silence, since this runs right as the
// mic connects) so the detection threshold adapts to the room/mic instead of
// relying on one hardcoded guess.
async function calibrateNoiseFloor() {
  transcriptText.textContent = 'Getting ready...'

  const samples = []
  const start = performance.now()

  await new Promise(resolve => {
    function sample() {
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(dataArray)
      samples.push(bandAverage(dataArray))

      if (performance.now() - start < CALIBRATION_MS) {
        requestAnimationFrame(sample)
      } else {
        resolve()
      }
    }
    requestAnimationFrame(sample)
  })

  noiseFloor = samples.reduce((a, b) => a + b, 0) / (samples.length || 1)
  dynamicThreshold = clampThreshold(noiseFloor + THRESHOLD_MARGIN)
}

function stopListening() {
  isListening = false
  volumeHistory = []
  resetSpeechState()

  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }

  // Clear waveform
  if (waveformCtx && waveformCanvas) {
    waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height)
  }
}

function drawWaveform(dataArray) {
  const width = waveformCanvas.width
  const height = waveformCanvas.height
  const barCount = 20
  const barWidth = width / barCount
  const step = Math.floor(dataArray.length / barCount)

  waveformCtx.clearRect(0, 0, width, height)

  for (let i = 2; i < barCount; i++) {  // Skip first bar (i=0)
    const value = dataArray[i * step] || 0
    const barHeight = (value / 255) * height * 0.8
    const x = i * barWidth + barWidth * 0.2
    const y = height - barHeight

    waveformCtx.fillStyle = '#9FE1CB'
    waveformCtx.fillRect(x, y, barWidth * 0.6, barHeight)
  }
}

function detectVoiceActivity(timestamp) {
  if (!isListening || !analyser) {
    stopListening()
    return
  }

  animationId = requestAnimationFrame(detectVoiceActivity)

  if (lastFrameTime === null) lastFrameTime = timestamp
  const dt = timestamp - lastFrameTime
  lastFrameTime = timestamp

  const dataArray = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(dataArray)

  // Draw waveform
  if (waveformCtx && waveformCanvas) {
    drawWaveform(dataArray)
  }

  // Average only over the human-voice frequency band - much less diluted
  // than averaging across the whole spectrum, so quieter speech registers.
  const currentBand = bandAverage(dataArray)

  volumeHistory.push(currentBand)
  if (volumeHistory.length > 8) {
    volumeHistory.shift()
  }

  const recentAverage = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length

  // Continuously re-estimate the ambient floor from the quietest point in the
  // last few seconds. This runs every frame no matter what state we're in -
  // previously it only ran while "idle," which meant that if noise ever rose
  // above the threshold, the app would think it was permanently "speaking"
  // and adaptation would never run again, getting stuck for good.
  floorWindow.push({ t: timestamp, value: currentBand })
  while (floorWindow.length && timestamp - floorWindow[0].t > FLOOR_WINDOW_MS) {
    floorWindow.shift()
  }
  const windowMin = floorWindow.reduce((min, s) => Math.min(min, s.value), Infinity)
  if (Number.isFinite(windowMin)) {
    noiseFloor = windowMin
    dynamicThreshold = clampThreshold(noiseFloor + THRESHOLD_MARGIN)
  }

  const voiceDetected = recentAverage > dynamicThreshold

  if (voiceDetected) {
    handleVoiceDetected(dt)
  } else {
    handleSilence()
  }
}

function handleVoiceDetected(dt) {
  if (!pendingAdvanceActive) {
    transcriptText.textContent = 'Speaking detected...'
  }

  speechState = 'speaking'
  totalSpeechMs += dt
  silenceStartTime = null

  // Talking again during the grace window cancels the pending advance.
  if (pendingAdvanceActive) {
    cancelPendingAdvance()
  }
}

function handleSilence() {
  if (pendingAdvanceActive) return // already counting down, leave the UI as-is

  transcriptText.textContent = 'Speak naturally...'

  if (speechState === 'speaking' && totalSpeechMs >= MIN_SPEECH_MS) {
    if (silenceStartTime === null) {
      silenceStartTime = performance.now()
    } else if (performance.now() - silenceStartTime >= PAUSE_TO_TRIGGER_MS) {
      triggerPendingAdvance()
    }
  } else {
    // Too little speech so far for a pause to mean anything yet.
    silenceStartTime = null
  }
}

// A pause that looks like "end of sentence" doesn't advance immediately -
// it gives a short, visible grace window so a thinking-pause can be undone
// just by continuing to talk.
function triggerPendingAdvance() {
  if (!autoAdvanceEnabled || pendingAdvanceActive) return

  pendingAdvanceActive = true
  transcript.classList.add('pending')
  transcriptText.textContent = 'Got it — moving on...'

  const fill = document.getElementById('advance-progress-fill')
  if (fill) {
    fill.style.transition = 'none'
    fill.style.width = '100%'
    void fill.offsetWidth // force reflow so the transition below animates
    fill.style.transition = `width ${GRACE_PERIOD_MS}ms linear`
    fill.style.width = '0%'
  }

  pendingAdvanceTimer = setTimeout(() => {
    pendingAdvanceActive = false
    transcript.classList.remove('pending')
    if (!nextBtn.disabled) {
      nextItem()
    }
  }, GRACE_PERIOD_MS)
}

function cancelPendingAdvance() {
  pendingAdvanceActive = false
  if (pendingAdvanceTimer) {
    clearTimeout(pendingAdvanceTimer)
    pendingAdvanceTimer = null
  }
  transcript.classList.remove('pending')
  silenceStartTime = null
}

function resetSpeechState() {
  speechState = 'idle'
  totalSpeechMs = 0
  silenceStartTime = null
  lastFrameTime = null
  floorWindow = []
  cancelPendingAdvance()
}

function toggleAutoAdvance() {
  autoAdvanceEnabled = !autoAdvanceEnabled
  const toggle = document.getElementById('auto-advance-toggle')
  if (toggle) {
    toggle.classList.toggle('on', autoAdvanceEnabled)
    toggle.setAttribute('aria-pressed', String(autoAdvanceEnabled))
    toggle.textContent = `Auto-advance: ${autoAdvanceEnabled ? 'ON' : 'OFF'}`
  }
  if (!autoAdvanceEnabled) {
    cancelPendingAdvance()
  }
}

function updateDisplay() {
  const step = STEPS[currentStepIndex]
  const isSameSense = currentStepIndex === previousStepIndex

  // Stop listening when changing steps
  if (typeof isListening !== 'undefined' && isListening) {
    stopListening()
  }
  if (transcript) {
    transcript.classList.remove('active')
  }
  if (transcriptText) {
    transcriptText.textContent = ''
  }

  if (isSameSense) {
    // Only update counter if we're on the same sense
    counter.textContent = `${currentItemIndex + 1} / ${step.count}`

    // Auto start listening after brief delay
    setTimeout(() => {
      startListening()
    }, 300)

    updateProgress()
    updateNavButtons()
    return
  }

  // Full update when changing to a new sense
  previousStepIndex = currentStepIndex

  // Trigger animation by briefly removing and re-adding content
  icon.style.opacity = '0'
  instruction.style.opacity = '0'
  counter.style.opacity = '0'
  description.style.opacity = '0'

  setTimeout(() => {
    // Get current icon element (might have been replaced)
    const currentIcon = document.getElementById('sense-icon')
    const iconParent = currentIcon.parentNode

    // Check if icon is an image path or emoji
    if (step.icon.includes('.svg') || step.icon.includes('.png') || step.icon.includes('.jpg')) {
      // Need an img element
      if (currentIcon.tagName === 'IMG') {
        currentIcon.src = step.icon
        currentIcon.classList.remove('emoji-icon')
      } else {
        const img = document.createElement('img')
        img.id = 'sense-icon'
        img.src = step.icon
        img.alt = 'sense icon'
        img.style.opacity = '0'
        iconParent.replaceChild(img, currentIcon)
      }
    } else {
      // Need a div for emoji
      if (currentIcon.tagName === 'DIV') {
        currentIcon.textContent = step.icon
        currentIcon.className = 'emoji-icon'
      } else {
        const emojiDiv = document.createElement('div')
        emojiDiv.id = 'sense-icon'
        emojiDiv.className = 'emoji-icon'
        emojiDiv.textContent = step.icon
        emojiDiv.style.opacity = '0'
        iconParent.replaceChild(emojiDiv, currentIcon)
      }
    }

    instruction.textContent = step.instruction
    counter.textContent = `${currentItemIndex + 1} / ${step.count}`
    description.textContent = `Find ${step.count} things you can ${step.description}...`

    const finalIcon = document.getElementById('sense-icon')
    finalIcon.style.opacity = '1'
    instruction.style.opacity = '1'
    counter.style.opacity = '1'
    description.style.opacity = '1'

    // Auto start listening after display update
    setTimeout(() => {
      startListening()
    }, 600)
  }, 200)

  updateProgress()
  updateNavButtons()
}

function updateNavButtons() {
  const atStart = currentStepIndex === 0 && currentItemIndex === 0
  prevBtn.disabled = atStart
}

function updateProgress() {
  // Calculate total progress (15 items total: 5+4+3+2+1)
  let totalCompleted = 0
  for (let i = 0; i < currentStepIndex; i++) {
    totalCompleted += STEPS[i].count
  }
  totalCompleted += currentItemIndex

  const totalItems = STEPS.reduce((sum, step) => sum + step.count, 0)
  const percentage = (totalCompleted / totalItems) * 100

  progressFill.style.width = percentage + '%'
}

function prevItem() {
  // Already at the very first item - nothing to go back to
  if (currentStepIndex === 0 && currentItemIndex === 0) return

  hasRecognitionError = false
  volumeHistory = []

  currentItemIndex--

  // Move to the previous sense if we've walked back past the start of this one
  if (currentItemIndex < 0) {
    currentStepIndex--
    currentItemIndex = STEPS[currentStepIndex].count - 1
  }

  updateDisplay()
}

function nextItem() {
  const step = STEPS[currentStepIndex]

  // Reset error state when moving to next item
  hasRecognitionError = false
  volumeHistory = []

  currentItemIndex++

  // Move to next sense if current sense is complete
  if (currentItemIndex >= step.count) {
    currentStepIndex++
    currentItemIndex = 0

    // Check if all steps are complete
    if (currentStepIndex >= STEPS.length) {
      complete()
      return
    }
  }

  updateDisplay()
}

function complete() {
  container.classList.add('completed')

  stopListening()
  if (transcript) {
    transcript.classList.remove('active')
  }

  const currentIcon = document.getElementById('sense-icon')
  if (currentIcon) {
    const iconParent = currentIcon.parentNode
    if (currentIcon.tagName === 'IMG' && iconParent) {
      // Convert to div for emoji
      const emojiDiv = document.createElement('div')
      emojiDiv.id = 'sense-icon'
      emojiDiv.className = 'emoji-icon'
      emojiDiv.textContent = '✨'
      iconParent.replaceChild(emojiDiv, currentIcon)
    } else {
      currentIcon.textContent = '✨'
      currentIcon.className = 'emoji-icon'
    }
  }

  instruction.textContent = 'Well done'
  counter.textContent = ''
  description.textContent = 'You\'re here. You\'re present. Take a moment to notice how you feel.'

  progressFill.style.width = '100%'
  prevBtn.disabled = true
  nextBtn.disabled = true
}

function resetGrounding() {
  container.classList.remove('completed')

  stopListening()

  // Reset error states
  hasRecognitionError = false
  volumeHistory = []

  // Return to intro screen
  mainContent.style.display = 'none'
  navButtons.style.display = 'none'
  introScreen.style.display = 'flex'

  currentStepIndex = 0
  currentItemIndex = 0
  previousStepIndex = -1

  progressFill.style.width = '0%'
  prevBtn.disabled = true
  nextBtn.disabled = false
}

// Initialize - show intro screen first (already default state in HTML)