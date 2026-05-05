const TECHNIQUES = [
  {
    name: 'Box Breathing',
    phases: [
      { name: 'Inhale', duration: 4, id: 'inhale' },
      { name: 'Hold', duration: 4, id: 'hold-inhale' },
      { name: 'Exhale', duration: 4, id: 'exhale' },
      { name: 'Hold', duration: 4, id: 'hold-exhale' }],
    id: "box"
  }, 
  {
    name: '4-7-8 Breathing',
    phases: [
      { name: 'Inhale', duration: 4, id: 'inhale' },
      { name: 'Hold', duration: 7, id: 'hold-inhale' },
      { name: 'Exhale', duration: 8, id: 'exhale' },
      { name: 'Pause', duration: 5, id: 'hold-exhale' }],
    id: "478"
  },
]

const PHASE_CONSTANTS = [
  { id: 'inhale', size: 200, color: '#7F77DD' },
  { id: 'hold-inhale', size: 200, color: '#534AB7' },
  { id: 'exhale', size: 120, color: '#9FE1CB' },
  { id: 'hold-exhale', size: 120, color: '#1D9E75' } // change from pixels to rem
]

const SELECTED_ID = "478";
const SELECTED_TECHNIQUE = TECHNIQUES.find(technique => technique.id === SELECTED_ID)

const PHASES = SELECTED_TECHNIQUE.phases.map(phase => {
  const phaseConstant = PHASE_CONSTANTS.find(constant => constant.id === phase.id);

  return {
    ... phase,
    ...phaseConstant
  }
})

const TOTAL_CYCLES = 3 // modifiable
const MID_CYCLE_MESSAGES = ['You got this.', 'Stay with it.', 'Almost there.']


// =============================================
// STATE
// Tracks where we are in the breathing session
// =============================================

let phaseIndex = 0      // which phase we're on (0=Inhale, 1=Hold, 2=Exhale, 3=Hold)
let cycleCount = 0      // how many full cycles completed
let secondsLeft = 0     // countdown within current phase
let ticker = null       // the setInterval timer
let running = false     // is session active?
let currentPhase = null // the current phase object


// =============================================
// DOM REFERENCES
// =============================================

const circle = document.getElementById('breath-circle')
const phaseText = document.getElementById('phase-text')
const countdown = document.getElementById('countdown')
const cycleLabel = document.getElementById('cycle-label')
const message = document.getElementById('message')
const startBtn = document.getElementById('start-btn')
const rings = [
  document.getElementById('ring1'),
  document.getElementById('ring2'),
  document.getElementById('ring3'),
]
const canvas = document.getElementById('particle-canvas')
const ctx = canvas.getContext('2d')


// =============================================
// CIRCLE ANIMATION
// Changes the circle's size and color smoothly
// =============================================

function applyPhase(phase) {
  currentPhase = phase

  // transition duration is slightly shorter than phase duration
  // so the animation finishes before the next phase starts
  const transitionDuration = phase.duration * 0.9

  circle.style.transition = `
    width ${transitionDuration}s ease-in-out,
    height ${transitionDuration}s ease-in-out,
    background-color 0.8s ease
  `
  circle.style.width = phase.size + 'px'
  circle.style.height = phase.size + 'px'
  circle.style.backgroundColor = phase.color

  phaseText.textContent = phase.name

  // fire ripple rings only on inhale and exhale, not holds
  if (phase.name === 'Inhale') {
    fireRipple(phase.color, 'out', phase.duration)
  } else if (phase.name === 'Exhale') {
    fireRipple(phase.color, 'in', phase.duration)
  }
}


// =============================================
// RIPPLE RINGS
// Three rings animate outward one after another (staggered)
// =============================================

let rippleTimers = []

function fireRipple(color, direction, duration) {
  rippleTimers.forEach(t => clearTimeout(t))
  rippleTimers = []

  const stagger = duration * 125

  rings.forEach((ring, index) => {
    requestAnimationFrame(() => {
      const delay = index * stagger
      const timer = setTimeout(() => {

        if (direction === 'out') {
          ring.style.transition = 'none'
          ring.style.borderColor = color
          ring.style.opacity = '0.6'
          ring.style.transform = 'translate(-50%, -50%) scale(1)'

          requestAnimationFrame(() => {
            ring.style.transition = `transform ${duration}s ease-out, opacity ${duration}s ease-out`
            ring.style.transform = 'translate(-50%, -50%) scale(2.4)'
            ring.style.opacity = '0'
          })

        } else {
          ring.style.transition = 'none'
          ring.style.borderColor = color
          ring.style.opacity = '0'
          ring.style.transform = 'translate(-50%, -50%) scale(2.4)'

          requestAnimationFrame(() => {
            ring.style.transition = `transform ${duration}s ease-in, opacity ${duration}s ease-in`
            ring.style.transform = 'translate(-50%, -50%) scale(1)'
            ring.style.opacity = '0.6'
          })
        }

      }, delay)
      rippleTimers.push(timer)
    })
  })
}


// =============================================
// PARTICLES
// Small dots that float toward the circle on inhale
// and drift away on exhale — drawn on a canvas
// =============================================

let particles = []
let particleSpawnInterval = null
let animationFrame = null

class Particle {
  constructor() {
    const centerX = 130
    const centerY = 130

    const isHold = currentPhase && currentPhase.name === 'Hold'

    // during hold, spawn further out so they take up more space
    const radius = isHold
      ? currentPhase.size * 0.65   // further from circle edge
      : currentPhase ? currentPhase.size / 2 + 10 : 70

    const angle = Math.random() * Math.PI * 2
    this.x = centerX + Math.cos(angle) * radius
    this.y = centerY + Math.sin(angle) * radius
    this.vx = (Math.random() - 0.5) * (isHold ? 0.1 : 0.4)  // slower initial velocity during hold
    this.vy = (Math.random() - 0.5) * (isHold ? 0.1 : 0.4)
    this.size = Math.random() * 3 + 1.5
    this.color = currentPhase ? currentPhase.color : '#AFA9EC'
    this.life = 1
    this.decay = Math.random() * 0.008 + 0.004
  }

  update() {
    const centerX = 130
    const centerY = 130

    const dx = centerX - this.x
    const dy = centerY - this.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1

    const phaseName = currentPhase ? currentPhase.name : ''

    if (phaseName === 'Hold') {
      // very slow random drift, almost still
      this.vx += (Math.random() - 0.5) * 0.02
      this.vy += (Math.random() - 0.5) * 0.02
      this.vx *= 0.92  // stronger drag during hold so they barely move
      this.vy *= 0.92
    } else if (phaseName === 'Inhale') {
      this.vx += (dx / dist) * 0.12
      this.vy += (dy / dist) * 0.12
      this.vx *= 0.96
      this.vy *= 0.96
    } else {
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
  // add a few new particles each spawn tick
  for (let i = 0; i < 3; i++) {
    particles.push(new Particle())
  }
}

function drawParticles() {
  ctx.clearRect(0, 0, 260, 260)

  // remove dead particles, then update and draw the rest
  particles = particles.filter(p => p.life > 0)
  particles.forEach(p => { p.update(); p.draw() })
}

function startParticles() {
  stopParticles()
  particleSpawnInterval = setInterval(spawnParticles, 120)

  function loop() {
    drawParticles()
    animationFrame = requestAnimationFrame(loop)
  }
  loop()
}

function stopParticles() {
  if (particleSpawnInterval) clearInterval(particleSpawnInterval)
  if (animationFrame) cancelAnimationFrame(animationFrame)
  particles = []
  ctx.clearRect(0, 0, 260, 260)
}


// =============================================
// MAIN TIMER
// Ticks every second, moves through phases and cycles
// =============================================

function tick() {
  secondsLeft--
  countdown.textContent = secondsLeft > 0 ? secondsLeft + 's' : ''

  if (secondsLeft <= 0) {
    // move to next phase
    phaseIndex++

    // if we've completed all 4 phases, that's one full cycle
    if (phaseIndex >= PHASES.length) {
      phaseIndex = 0
      cycleCount++

      if (cycleCount >= TOTAL_CYCLES) {
        finish()
        return
      }

      // show encouragement between cycles
      message.textContent = MID_CYCLE_MESSAGES[cycleCount] || ''
      cycleLabel.textContent = `Cycle ${cycleCount + 1} of ${TOTAL_CYCLES}`
    }

    const nextPhase = PHASES[phaseIndex]
    secondsLeft = nextPhase.duration
    applyPhase(nextPhase)
    countdown.textContent = secondsLeft + 's'
  }
}


// =============================================
// SESSION CONTROLS: start, finish, reset
// =============================================

function startBreathing() {
  if (running) return
  running = true
  startBtn.disabled = true

  phaseIndex = 0
  cycleCount = 0
  secondsLeft = PHASES[0].duration

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

  // settle the circle into a calm resting state
  circle.style.transition = 'width 1s ease, height 1s ease, background-color 1s ease'
  circle.style.width = '160px'
  circle.style.height = '160px'
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

  running = false
  phaseIndex = 0
  cycleCount = 0
  currentPhase = null

  circle.style.transition = 'width 0.5s ease, height 0.5s ease, background-color 0.5s ease'
  circle.style.width = '120px'
  circle.style.height = '120px'
  circle.style.backgroundColor = '#AFA9EC'

  phaseText.textContent = 'Press start'
  countdown.textContent = ''
  cycleLabel.textContent = ''
  message.textContent = 'Box breathing — 4 counts each phase'

  rings.forEach(r => { r.style.opacity = '0' })
  startBtn.disabled = false
}
