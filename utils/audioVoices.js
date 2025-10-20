// translator-backend/utils/audioVoices.js

/**
 * Whitelist of available adhan voices
 * Maps display names to file paths for security
 */
const AUDIO_VOICES = {
  madinah: {
    name: 'Madinah',
    fileMain: '/audio/adhan_madinah.mp3',
    fileReminder: '/audio/adhan.mp3', // short version
    description: 'Traditional adhan from Madinah'
  },
  makkah: {
    name: 'Makkah',
    fileMain: '/audio/adhan.mp3',
    fileReminder: '/audio/adhan.mp3',
    description: 'Traditional adhan from Makkah'
  },
  egypt: {
    name: 'Egypt',
    fileMain: '/audio/adhan.mp3',
    fileReminder: '/audio/adhan.mp3',
    description: 'Egyptian style adhan'
  },
  silent: {
    name: 'Silent (Vibrate Only)',
    fileMain: null,
    fileReminder: null,
    description: 'No audio, vibration only'
  }
};

/**
 * Validate and sanitize audio profile name
 * @param {string} name - Profile name to validate
 * @returns {string|null} - Valid profile name or null
 */
function validateAudioProfile(name) {
  if (!name || typeof name !== 'string') return null;
  const cleaned = name.toLowerCase().trim();
  return AUDIO_VOICES[cleaned] ? cleaned : null;
}

/**
 * Get file path for a voice profile and type
 * @param {string} profileName - Voice profile name
 * @param {string} type - 'main' or 'reminder'
 * @returns {string|null} - File path or null
 */
function getAudioFile(profileName, type = 'main') {
  const profile = AUDIO_VOICES[profileName];
  if (!profile) return null;
  
  return type === 'reminder' ? profile.fileReminder : profile.fileMain;
}

/**
 * Clamp numeric value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped value
 */
function clamp(value, min, max) {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Validate and clamp audio settings
 * @param {object} settings - Audio settings object
 * @param {object} caps - Capability limits from config
 * @returns {object} - Validated and clamped settings
 */
function validateAudioSettings(settings = {}, caps = {}) {
  return {
    volume: clamp(settings.volume, 0, caps.maxVolume || 0.9),
    fadeInMs: clamp(settings.fadeInMs, 0, caps.maxFadeMs || 10000),
    vibrateOnly: Boolean(settings.vibrateOnly),
    cooldownSeconds: clamp(settings.cooldownSeconds, 0, caps.maxCooldown || 300)
  };
}

/**
 * Get list of available voice options for UI
 * @returns {array} - Array of voice objects
 */
function getAvailableVoices() {
  return Object.keys(AUDIO_VOICES).map(key => ({
    id: key,
    name: AUDIO_VOICES[key].name,
    description: AUDIO_VOICES[key].description
  }));
}

module.exports = {
  AUDIO_VOICES,
  validateAudioProfile,
  getAudioFile,
  clamp,
  validateAudioSettings,
  getAvailableVoices
};

