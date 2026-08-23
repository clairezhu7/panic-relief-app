async function loadSettings() {
  const stored = await window.electronAPI.storageGet('settings')
  return stored ? JSON.parse(stored) : DEFAULTS
}
 
async function saveSetting(key, value) {
  const current = await loadSettings()
  current[key] = value
  window.electronAPI.storageSet('settings', JSON.stringify(current))
}