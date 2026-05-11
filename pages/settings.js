const DEFAULTS = {
  defaultPage: 'home',
  music: true,
  autostart: false,
  technique: 'box'
}

async function loadSettings() {
  const stored = await window.electronAPI.storageGet('settings')
  return stored ? JSON.parse(stored) : DEFAULTS
}

async function saveSetting(key, value) {
  const current = await loadSettings()
  current[key] = value
  window.electronAPI.storageSet('settings', JSON.stringify(current))
}

// section toggle
function toggleSection(id) {
  const body = document.getElementById('body-' + id)
  const arrow = document.getElementById('arrow-' + id)
  body.classList.toggle('open')
  arrow.classList.toggle('open')
}

// toggle switches
function toggleSetting(key) {
  const el = document.getElementById('toggle-' + key)
  const isOn = el.classList.toggle('on')
  saveSetting(key, isOn)
}

// dropdown setup
function setupDropdown(dropdownId, optionsId, selectedId, storageKey) {
  const selected = document.getElementById(selectedId)
  const options = document.getElementById(optionsId)
  const arrow = selected.querySelector('.dropdown-arrow')
  const label = selected.querySelector('.dropdown-label')

  selected.addEventListener('click', () => {
    const isOpen = options.classList.toggle('open')
    arrow.classList.toggle('open', isOpen)
  })

  document.addEventListener('click', e => {
    if (!document.getElementById(dropdownId).contains(e.target)) {
      options.classList.remove('open')
      arrow.classList.remove('open')
    }
  })

  options.querySelectorAll('.dropdown-option').forEach(opt => {
    opt.addEventListener('click', () => {
      label.textContent = opt.textContent
      options.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('active'))
      opt.classList.add('active')
      options.classList.remove('open')
      arrow.classList.remove('open')
      saveSetting(storageKey, opt.dataset.value)
    })
  })
}

// apply saved settings to UI
async function applyStoredSettings() {
  const s = await loadSettings()

  if (s.music) document.getElementById('toggle-music').classList.add('on')
  if (s.autostart) document.getElementById('toggle-autostart').classList.add('on')

  const setDropdown = (optionsId, selectedId, value) => {
    const opt = document.querySelector(`#${optionsId} [data-value="${value}"]`)
    if (!opt) return
    const label = document.querySelector(`#${selectedId} .dropdown-label`)
    label.textContent = opt.textContent
    document.querySelectorAll(`#${optionsId} .dropdown-option`).forEach(o => o.classList.remove('active'))
    opt.classList.add('active')
  }

  setDropdown('default-page-options', 'default-page-selected', s.defaultPage)
  setDropdown('technique-options', 'technique-selected', s.technique)
}

setupDropdown('default-page-dropdown', 'default-page-options', 'default-page-selected', 'defaultPage')
setupDropdown('technique-dropdown', 'technique-options', 'technique-selected', 'technique')

applyStoredSettings()

// open breathing section by default
toggleSection('breathing')