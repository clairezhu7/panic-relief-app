const TECHNIQUES = [
  {
    name: 'Box Breathing',
    id: 'box',
    phases: [
      { name: 'Inhale', duration: 4, id: 'inhale' },
      { name: 'Hold', duration: 4, id: 'hold-inhale' },
      { name: 'Exhale', duration: 4, id: 'exhale' },
      { name: 'Hold', duration: 4, id: 'hold-exhale' },
    ]
  },
  {
    name: '4-7-8 Breathing',
    id: '478',
    phases: [
      { name: 'Inhale', duration: 4, id: 'inhale' },
      { name: 'Hold', duration: 7, id: 'hold-inhale' },
      { name: 'Exhale', duration: 8, id: 'exhale' },
      { name: 'Pause', duration: 5, id: 'hold-exhale' },
    ]
  },
]

// visual properties per phase type
const PHASE_CONSTANTS = [
  { id: 'inhale', size: 45, color: '#7F77DD' },
  { id: 'hold-inhale', size: 45, color: '#534AB7' },
  { id: 'exhale', size: 25, color: '#9FE1CB' },
  { id: 'hold-exhale', size: 25, color: '#1D9E75' },
]

const SIZE_SMALL = 25   // vmin — resting / exhale size
const SIZE_LARGE = 45   // vmin — inhale size

const RING_START_INHALE = SIZE_SMALL   // rings start here on inhale (matching circle)
const RING_END_INHALE = 70           // rings expand to here on inhale
const RING_START_EXHALE = 70           // rings start here on exhale (spread out)
const RING_END_EXHALE = SIZE_SMALL   // rings shrink to here on exhale



const SELECTED_ID = '478'
const TOTAL_CYCLES = 3
const MID_CYCLE_MESSAGES = ['You got this.', 'Stay with it.', 'Almost there.']

const SELECTED_TECHNIQUE = TECHNIQUES.find(t => t.id === SELECTED_ID)

// merge phase timing with phase visual constants
const PHASES = SELECTED_TECHNIQUE.phases.map(phase => ({
  ...phase,
  ...PHASE_CONSTANTS.find(c => c.id === phase.id)
}))


let phaseIndex = 0
let cycleCount = 0
let secondsLeft = 0
let ticker = null
let running = false
let currentPhase = null
let rippleTimers = []
let particles = []
let particleSpawnInterval = null
let animationFrame = null

const circle = document.getElementById('breath-circle')
const phaseText = document.getElementById('phase-text')
const countdown = document.getElementById('countdown')
const cycleLabel = document.getElementById('cycle-label')
const message = document.getElementById('message')
const startBtn = document.getElementById('start-btn')
const canvas = document.getElementById('particle-canvas')
const ctx = canvas.getContext('2d')
const rings = [
  document.getElementById('ring1'),
  document.getElementById('ring2'),
  document.getElementById('ring3'),
]

// convert vmin to pixels based on current screen size
function vminToPx(vmin) {
  return vmin * Math.min(window.innerWidth, window.innerHeight) / 100
}

// are we in a hold/pause phase?
function isHoldPhase(phaseName) {
  return phaseName === 'Hold' || phaseName === 'Pause'
}

function resizeCanvas() {
  const wrapper = document.getElementById('circle-wrapper')
  canvas.width = wrapper.offsetWidth
  canvas.height = wrapper.offsetHeight

  // snap circle to correct size instantly (no transition during resize)
  if (currentPhase) {
    circle.style.transition = 'none'
    circle.style.width = currentPhase.size + 'vmin'
    circle.style.height = currentPhase.size + 'vmin'
  }

  particles = []  // clear particles so they respawn at correct positions
}

resizeCanvas()

window.addEventListener('resize', () => {
  resizeCanvas()

  if (running && currentPhase) {
    rippleTimers.forEach(t => clearTimeout(t))
    rippleTimers = []
    rings.forEach(r => {
      r.style.transition = 'none'
      r.style.opacity = '0'
    })
  }
})

function applyPhase(phase) {
  currentPhase = phase

  const transitionDuration = phase.duration * 0.9

  circle.style.transition = `width ${transitionDuration}s ease-in-out, height ${transitionDuration}s ease-in-out, background-color 0.8s ease`
  circle.style.width = phase.size + 'vmin'
  circle.style.height = phase.size + 'vmin'
  circle.style.backgroundColor = phase.color
  phaseText.textContent = phase.name

  if (phase.name === 'Inhale') {
    fireRipple(phase.color, 'out', phase.duration, RING_START_INHALE, RING_END_INHALE)
  } else if (phase.name === 'Exhale') {
    fireRipple(phase.color, 'in', phase.duration, RING_START_EXHALE, RING_END_EXHALE)
  } else {
    // hold / pause — cancel rings and fade them out
    rippleTimers.forEach(t => clearTimeout(t))
    rippleTimers = []
    rings.forEach(r => {
      r.style.transition = 'opacity 0.5s ease'
      r.style.opacity = '0'
    })
  }
}


function fireRipple(color, direction, duration, startVmin, endVmin) {
  rippleTimers.forEach(t => clearTimeout(t))
  rippleTimers = []

  const totalMs = duration * 1000
  const inhaleStagger = (totalMs * 0.4) / rings.length
  const exhaleStagger = 200

  rings.forEach((ring, index) => {
    const delayMs = index * (direction === 'out' ? inhaleStagger : exhaleStagger)
    const remainingSecs = duration - (delayMs / 1000)

    // always reset ring before animating
    ring.style.transition = 'none'
    ring.style.width = startVmin + 'vmin'
    ring.style.height = startVmin + 'vmin'
    ring.style.opacity = '0'
    ring.style.transform = 'translate(-50%, -50%)'
    ring.style.borderColor = color

    const timer = setTimeout(() => {
      if (direction === 'out') {
        // inhale: snap visible then expand outward
        ring.style.transition = 'none'
        ring.style.opacity = String(0.55 - index * 0.1)

        setTimeout(() => {
          ring.style.transition = `width ${remainingSecs}s linear, height ${remainingSecs}s linear, opacity ${remainingSecs}s ease-in`
          ring.style.width = endVmin + 'vmin'
          ring.style.height = endVmin + 'vmin'
          ring.style.opacity = '0'
        }, 20)

      } else {
        // exhale: pre-spread rings at different sizes, fade in softly then shrink
        const spreadStep = 6
        const ringStartVmin = startVmin - (index * spreadStep)  // 70, 64, 58
        const startOpacity = 0.55 - (index * 0.12)             // 0.55, 0.43, 0.31

        ring.style.transition = 'none'
        ring.style.width = ringStartVmin + 'vmin'
        ring.style.height = ringStartVmin + 'vmin'
        ring.style.opacity = '0'

        setTimeout(() => {
          ring.style.transition = 'opacity 0.3s ease-out'
          ring.style.opacity = String(startOpacity)

          setTimeout(() => {
            ring.style.transition = `width ${remainingSecs}s linear, height ${remainingSecs}s linear, opacity ${remainingSecs}s ease-in`
            ring.style.width = endVmin + 'vmin'
            ring.style.height = endVmin + 'vmin'
            ring.style.opacity = '0'
          }, 300)
        }, 20)
      }
    }, delayMs)

    rippleTimers.push(timer)
  })
}

class Particle {
  constructor() {
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const circleSizePx = currentPhase ? vminToPx(currentPhase.size) : vminToPx(SIZE_SMALL)
    const isHold = currentPhase && isHoldPhase(currentPhase.name)

    // spawn just outside the circle edge
    const scatter = isHold
      ? Math.random() * 20 + 8   // hold: tight ring around edge
      : Math.random() * 10 + 5   // active: small scatter

    const radius = circleSizePx / 2 + scatter
    const angle = Math.random() * Math.PI * 2

    this.x = centerX + Math.cos(angle) * radius
    this.y = centerY + Math.sin(angle) * radius
    this.vx = (Math.random() - 0.5) * (isHold ? 0.08 : 0.4)
    this.vy = (Math.random() - 0.5) * (isHold ? 0.08 : 0.4)
    this.size = Math.random() * 3 + 1.5
    this.color = currentPhase ? currentPhase.color : '#AFA9EC'
    this.life = 1
    this.decay = isHold
      ? Math.random() * 0.004 + 0.002  // slower decay during hold
      : Math.random() * 0.008 + 0.004
  }

  update() {
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const dx = centerX - this.x
    const dy = centerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const phaseName = currentPhase ? currentPhase.name : ''

    if (isHoldPhase(phaseName)) {
      // barely drift — tiny random nudge with strong drag
      this.vx += (Math.random() - 0.5) * 0.015
      this.vy += (Math.random() - 0.5) * 0.015
      this.vx *= 0.90
      this.vy *= 0.90
    } else if (phaseName === 'Inhale') {
      // pull toward center
      this.vx += (dx / dist) * 0.12
      this.vy += (dy / dist) * 0.12
      this.vx *= 0.96
      this.vy *= 0.96
    } else {
      // push away from center
      this.vx += (dx / dist) * -0.08
      this.vy += (dy / dist) * -0.08
      this.vx *= 0.96
      this.vy *= 0.96
    }

    this.x += this.vx
    this.y += this.vy
    this.life -= this.decay
    this.alpha = Math.max(0, this.life * 0.7)
  }

  draw() {
    ctx.save()
    ctx.globalAlpha = this.alpha
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function spawnParticles() {
  for (let i = 0; i < 3; i++) particles.push(new Particle())
}

function drawParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  particles = particles.filter(p => p.life > 0)
  particles.forEach(p => { p.update(); p.draw() })
}

function startParticles() {
  stopParticles()
  particleSpawnInterval = setInterval(spawnParticles, 120)
  function loop() { drawParticles(); animationFrame = requestAnimationFrame(loop) }
  loop()
}

function stopParticles() {
  if (particleSpawnInterval) clearInterval(particleSpawnInterval)
  if (animationFrame) cancelAnimationFrame(animationFrame)
  particles = []
  ctx.clearRect(0, 0, canvas.width, canvas.height)
}

function tick() {
  secondsLeft--
  countdown.textContent = secondsLeft > 0 ? secondsLeft + 's' : ''

  if (secondsLeft <= 0) {
    phaseIndex++

    if (phaseIndex >= PHASES.length) {
      phaseIndex = 0
      cycleCount++

      if (cycleCount >= TOTAL_CYCLES) { finish(); return }

      message.textContent = MID_CYCLE_MESSAGES[cycleCount] || ''
      cycleLabel.textContent = `Cycle ${cycleCount + 1} of ${TOTAL_CYCLES}`
    }

    const nextPhase = PHASES[phaseIndex]
    secondsLeft = nextPhase.duration
    applyPhase(nextPhase)
    countdown.textContent = secondsLeft + 's'
  }
}

function startBreathing() {
  if (running) return
  running = true
  phaseIndex = 0
  cycleCount = 0
  secondsLeft = PHASES[0].duration
  startBtn.disabled = true

  applyPhase(PHASES[0])
  countdown.textContent = secondsLeft + 's'
  cycleLabel.textContent = `Cycle 1 of ${TOTAL_CYCLES}`
  message.textContent = ''

  startParticles()
  ticker = setInterval(tick, 1000)
}

function finish() {
  clearInterval(ticker)
  stopParticles()
  running = false

  circle.style.transition = 'width 1s ease, height 1s ease, background-color 1s ease'
  circle.style.width = SIZE_SMALL + 'vmin'
  circle.style.height = SIZE_SMALL + 'vmin'
  circle.style.backgroundColor = '#5DCAA5'

  phaseText.textContent = 'Done'
  countdown.textContent = ''
  cycleLabel.textContent = ''
  message.textContent = 'Well done. Take a moment.'
  startBtn.disabled = false
}

function resetBreathing() {
  clearInterval(ticker)
  stopParticles()
  rippleTimers.forEach(t => clearTimeout(t))
  rippleTimers = []

  running = false
  phaseIndex = 0
  cycleCount = 0
  currentPhase = null

  circle.style.transition = 'width 0.5s ease, height 0.5s ease, background-color 0.5s ease'
  circle.style.width = SIZE_SMALL + 'vmin'
  circle.style.height = SIZE_SMALL + 'vmin'
  circle.style.backgroundColor = '#AFA9EC'

  phaseText.textContent = 'Press start'
  countdown.textContent = ''
  cycleLabel.textContent = ''
  message.textContent = SELECTED_TECHNIQUE.name

  rings.forEach(r => { r.style.opacity = '0' })
  startBtn.disabled = false
}

const music = document.getElementById('music')
music.play().catch(() => {
  document.addEventListener('click', () => music.play(), { once: true })
})