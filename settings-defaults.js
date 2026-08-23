const DEFAULTS = {
  defaultPage: 'home',
  'music-breathing': true,
  'music-grounding': true,
  autostart: false,
  technique: 'box',
  numCycles: 3,
  instructions: true,
  'auto-advance': true
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DEFAULTS
}