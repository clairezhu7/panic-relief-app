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

const PHASE_CONSTANTS = [
  { id: 'inhale', size: 45, color: '#7F77DD' },
  { id: 'hold-inhale', size: 45, color: '#534AB7' },
  { id: 'exhale', size: 25, color: '#9FE1CB' },
  { id: 'hold-exhale', size: 25, color: '#1D9E75' },
]

var selectedID
var numCycles = 3
var selectedTechnique
var phases

setDefaultTechnique()

function setDefaultTechnique() {
  // get from localstorage
  updateTechnique('box')
}


// dropdown
const techniqueDropdown = document.getElementById('technique-dropdown')
const dropdownSelected = document.getElementById('dropdown-selected')
const dropdownLabel = document.getElementById('selected-option')
const dropdownArrow = document.getElementById('dropdown-arrow')
const dropdownOptions = document.getElementById('dropdown-options')

document.body.appendChild(dropdownOptions)

function measureDropdownHeight() {
  dropdownOptions.style.display = 'block'
  dropdownOptions.style.visibility = 'hidden'
  dropdownOptions.style.maxHeight = 'none'
  dropdownOptions.style.height = 'auto'
  dropdownOptions.style.overflow = 'visible'

  const h = dropdownOptions.offsetHeight

  dropdownOptions.style.display = ''
  dropdownOptions.style.visibility = ''
  dropdownOptions.style.maxHeight = ''
  dropdownOptions.style.height = ''
  dropdownOptions.style.overflow = ''

  return h
}

let DROPDOWN_HEIGHT = measureDropdownHeight()

window.addEventListener('resize', () => {
  DROPDOWN_HEIGHT = measureDropdownHeight()
})

dropdownSelected.addEventListener('click', () => {
  if (running) return

  const isAlreadyOpen = dropdownOptions.classList.contains('open')
  dropdownArrow.classList.toggle('open', !isAlreadyOpen)

  if (isAlreadyOpen) {
    dropdownOptions.classList.remove('open')
    return
  }

  const rect = dropdownSelected.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const fitsBelow = spaceBelow >= DROPDOWN_HEIGHT

  dropdownOptions.style.position = 'fixed'
  dropdownOptions.style.width = rect.width + 'px'
  dropdownOptions.style.left = rect.left + 'px'
  dropdownOptions.style.top = 'auto'
  dropdownOptions.style.bottom = 'auto'

  if (fitsBelow) {
    dropdownOptions.style.top = rect.bottom + 6 + 'px'
  } else {
    dropdownOptions.style.bottom = (window.innerHeight - rect.top + 6) + 'px'
  }

  console.log('DROPDOWN_HEIGHT:', DROPDOWN_HEIGHT)
  console.log('spaceBelow:', spaceBelow)
  console.log('fitsBelow:', fitsBelow)

  dropdownOptions.classList.add('open')
})

document.addEventListener('click', e => {
  if (!techniqueDropdown.contains(e.target) && !dropdownOptions.contains(e.target)) {
    dropdownOptions.classList.remove('open')
    dropdownArrow.classList.remove('open')
  }
})

document.querySelectorAll('.dropdown-option').forEach(option => {
  option.addEventListener('click', () => {
    if (running) return

    selectedId = option.dataset.id
    dropdownLabel.textContent = option.textContent

    document.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('active'))
    option.classList.add('active')

    dropdownOptions.classList.remove('open')
    dropdownArrow.classList.remove('open')

    updateTechnique(selectedID)
  })
})

function updateTechnique(techniqueID) {
  selectedID = techniqueID
  selectedTechnique = TECHNIQUES.find(t => t.id === selectedID)
  phases = selectedTechnique.phases.map(phase => ({
    ...phase,
    ...PHASE_CONSTANTS.find(c => c.id === phase.id)
  }))
}

const SIZE_SMALL = 25
const SIZE_LARGE = 45

const RING_START_INHALE = SIZE_SMALL
const RING_END_INHALE = 70
const RING_START_EXHALE = 70
const RING_END_EXHALE = SIZE_SMALL 

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
const canvas = document.getElementById('particle-canvas')
const ctx = canvas.getContext('2d')
const rings = [
  document.getElementById('ring1'),
  document.getElementById('ring2'),
  document.getElementById('ring3'),
]

circle.addEventListener('click', handleCircleClick)
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') handleCircleClick()
})

function vminToPx(vmin) {
  return vmin * Math.min(window.innerWidth, window.innerHeight) / 100
}

function isHoldPhase(phaseName) {
  return phaseName === 'Hold' || phaseName === 'Pause'
}

function resizeCanvas() {
  const wrapper = document.getElementById('circle-wrapper')
  const overflow = Math.round(vminToPx(SIZE_LARGE) * 0.4)

  canvas.width = wrapper.offsetWidth + overflow * 2 
  canvas.height = wrapper.offsetHeight + overflow * 2  

  canvas.style.left = -overflow + 'px'
  canvas.style.top = -overflow + 'px'

  if (currentPhase) {
    circle.style.transition = 'none'
    circle.style.width = currentPhase.size + 'vmin'
    circle.style.height = currentPhase.size + 'vmin'
  }

  particles = []
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

    ring.style.transition = 'none'
    ring.style.width = startVmin + 'vmin'
    ring.style.height = startVmin + 'vmin'
    ring.style.opacity = '0'
    ring.style.transform = 'translate(-50%, -50%)'
    ring.style.borderColor = color

    const timer = setTimeout(() => {
      if (direction === 'out') {
        ring.style.transition = 'none'
        ring.style.opacity = String(0.55 - index * 0.1)

        setTimeout(() => {
          ring.style.transition = `width ${remainingSecs}s linear, height ${remainingSecs}s linear, opacity ${remainingSecs}s ease-in`
          ring.style.width = endVmin + 'vmin'
          ring.style.height = endVmin + 'vmin'
          ring.style.opacity = '0'
        }, 20)

      } else {
        const spreadStep = 6
        const ringStartVmin = startVmin - (index * spreadStep)
        const startOpacity = 0.55 - (index * 0.12)

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

    const baseGap = circleSizePx * 0.1
    const scatterSize = circleSizePx * 0.12 

    const scatter = isHold
      ? baseGap + Math.random() * scatterSize
      : baseGap * 0.5 + Math.random() * scatterSize 

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
      ? Math.random() * 0.004 + 0.002
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
      this.vx += (Math.random() - 0.5) * 0.015
      this.vy += (Math.random() - 0.5) * 0.015
      this.vx *= 0.90
      this.vy *= 0.90
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

    if (phaseIndex >= phases.length) {
      phaseIndex = 0
      cycleCount++

      if (cycleCount >= numCycles) { finish(); return }


      cycleLabel.textContent = `Cycle ${cycleCount + 1} of ${numCycles}`
    }

    const nextPhase = phases[phaseIndex]
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
  secondsLeft = phases[0].duration

  applyPhase(phases[0])
  countdown.textContent = secondsLeft + 's'
  cycleLabel.textContent = `Cycle 1 of ${numCycles}`
  techniqueDropdown.classList.add('disabled')

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
  techniqueDropdown.classList.remove('disabled')
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
  circle.style.cursor = "pointer"

  phaseText.textContent = 'Start'
  countdown.textContent = ''
  cycleLabel.textContent = ''
  techniqueDropdown.classList.remove('disabled')

  rings.forEach(r => { r.style.opacity = '0' })
}

function handleCircleClick() {
  if (!running) {
    startBreathing()
    circle.style.cursor = "default"
  }
}

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