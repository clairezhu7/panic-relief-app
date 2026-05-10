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
  { sense: 'see', icon: 'assets/icons/smile-eyes.jpg', instruction: 'Find 5 things you can see', count: 5, description: 'Look around you. Name something you notice.' },
  { sense: 'touch', icon: '✋', instruction: 'Find 4 things you can touch', count: 4, description: 'Feel the textures around you. What can you reach?' },
  { sense: 'hear', icon: '👂', instruction: 'Find 3 things you can hear', count: 3, description: 'Listen carefully. What sounds do you notice?' },
  { sense: 'smell', icon: '👃', instruction: 'Find 2 things you can smell', count: 2, description: 'Take a breath. What scents are present?' },
  { sense: 'taste', icon: '👅', instruction: 'Find 1 thing you can taste', count: 1, description: 'Notice any taste in your mouth, or take a sip of water.' }
]

let currentStepIndex = 0
let currentItemIndex = 0
let previousStepIndex = -1

const introScreen = document.getElementById('intro-screen')
const mainContent = document.getElementById('main-content')
const buttonRow = document.getElementById('button-row')
const icon = document.getElementById('sense-icon')
const instruction = document.getElementById('instruction')
const counter = document.getElementById('counter')
const description = document.getElementById('description')
const progressFill = document.getElementById('progress-fill')
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

const VOLUME_THRESHOLD = 30 // Adjust sensitivity (0-255)
let volumeHistory = []


function startExercise() {
  introScreen.style.display = 'none'
  mainContent.style.display = 'flex'
  buttonRow.style.display = 'flex'

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
      analyser.smoothingTimeConstant = 0.3
    }

    if (!microphone) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      microphone = audioContext.createMediaStreamSource(stream)
      microphone.connect(analyser)
    }

    isListening = true
    transcriptText.textContent = 'Speak naturally...'
    transcript.classList.add('active')

    detectVoiceActivity()
  } catch (e) {
    console.error('Failed to start voice detection:', e)
    hasRecognitionError = true
    transcriptText.textContent = 'Microphone access denied. Use Next button.'
    transcript.classList.add('active')
  }
}

function stopListening() {
  isListening = false
  volumeHistory = []

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

function detectVoiceActivity() {
  if (!isListening || !analyser) {
    stopListening()
    return
  }

  animationId = requestAnimationFrame(detectVoiceActivity)

  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  analyser.getByteFrequencyData(dataArray)

  // Draw waveform
  if (waveformCtx && waveformCanvas) {
    drawWaveform(dataArray)
  }

  // Calculate average volume
  let sum = 0
  for (let i = 0; i < bufferLength; i++) {
    sum += dataArray[i]
  }
  const averageVolume = sum / bufferLength

  // Track volume over time
  volumeHistory.push(averageVolume)
  if (volumeHistory.length > 10) {
    volumeHistory.shift()
  }

  const recentAverage = volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length

  // Update text based on volume (no auto-advance)
  if (recentAverage > VOLUME_THRESHOLD) {
    transcriptText.textContent = 'Speaking detected...'
  } else {
    transcriptText.textContent = 'Speak naturally...'
  }
}

// Old audio visualization functions removed - now using voice activity detection

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
    description.textContent = step.description

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
  buttonRow.style.display = 'none'
  introScreen.style.display = 'flex'

  currentStepIndex = 0
  currentItemIndex = 0
  previousStepIndex = -1

  progressFill.style.width = '0%'
  nextBtn.disabled = false
}

// Initialize - show intro screen first (already default state in HTML)
