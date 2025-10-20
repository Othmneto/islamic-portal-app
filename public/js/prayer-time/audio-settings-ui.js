// public/js/prayer-time/audio-settings-ui.js
// UI handlers for audio settings controls

export class AudioSettingsUI {
  constructor(core, audio) {
    console.log('[AudioSettingsUI] Initializing');
    this.core = core;
    this.audio = audio;
    
    // Map voice names to file paths
    this.voiceFiles = {
      madinah: '/audio/adhan_madinah.mp3',
      makkah: '/audio/adhan.mp3',
      egypt: '/audio/adhan.mp3',
      short: '/audio/adhan.mp3',
      silent: null
    };
  }

  async initialize() {
    console.log('[AudioSettingsUI] Setting up audio settings UI...');
    
    // Get DOM elements
    this.elements = {
      audioEnabled: document.getElementById('audio-enabled-toggle'),
      voiceMain: document.getElementById('audio-voice-main'),
      voiceReminder: document.getElementById('audio-voice-reminder'),
      volumeSlider: document.getElementById('adhan-volume-slider'),
      volumeValue: document.getElementById('volume-value'),
      fadeinSlider: document.getElementById('audio-fadein-slider'),
      fadeinValue: document.getElementById('fadein-value'),
      cooldownSlider: document.getElementById('audio-cooldown-slider'),
      cooldownValue: document.getElementById('cooldown-value'),
      vibrateOnly: document.getElementById('audio-vibrate-only-toggle'),
      previewMain: document.getElementById('preview-main-voice-btn'),
      previewReminder: document.getElementById('preview-reminder-voice-btn'),
      stopAudio: document.getElementById('stop-audio-btn')
    };

    // Load current settings from state
    this.loadSettings();
    
    // Setup event listeners
    this.setupEventListeners();
    
    console.log('[AudioSettingsUI] Audio settings UI initialized');
  }

  loadSettings() {
    const settings = this.core.state.settings;
    
    // Load audio enabled state
    if (this.elements.audioEnabled) {
      this.elements.audioEnabled.checked = settings.audioEnabled !== false;
    }
    
    // Load voice selections
    if (settings.audioProfileMain && this.elements.voiceMain) {
      this.elements.voiceMain.value = settings.audioProfileMain.name || 'madinah';
    }
    
    if (settings.audioProfileReminder && this.elements.voiceReminder) {
      this.elements.voiceReminder.value = settings.audioProfileReminder.name || 'short';
    }
    
    // Load audio settings
    const audioSettings = settings.audioSettings || {};
    
    if (this.elements.volumeSlider) {
      const volume = audioSettings.volume || 0.8;
      this.elements.volumeSlider.value = volume;
      if (this.elements.volumeValue) {
        this.elements.volumeValue.textContent = Math.round(volume * 100) + '%';
      }
    }
    
    if (this.elements.fadeinSlider) {
      const fadein = audioSettings.fadeInMs || 3000;
      this.elements.fadeinSlider.value = fadein;
      if (this.elements.fadeinValue) {
        this.elements.fadeinValue.textContent = (fadein / 1000).toFixed(1) + 's';
      }
    }
    
    if (this.elements.cooldownSlider) {
      const cooldown = audioSettings.cooldownSeconds || 30;
      this.elements.cooldownSlider.value = cooldown;
      if (this.elements.cooldownValue) {
        this.elements.cooldownValue.textContent = cooldown >= 60 ? 
          Math.round(cooldown / 60) + 'm' : cooldown + 's';
      }
    }
    
    if (this.elements.vibrateOnly) {
      this.elements.vibrateOnly.checked = audioSettings.vibrateOnly || false;
    }

    console.log('[AudioSettingsUI] Settings loaded:', { audioSettings, audioProfileMain: settings.audioProfileMain });
  }

  setupEventListeners() {
    // Audio enabled toggle
    if (this.elements.audioEnabled) {
      this.elements.audioEnabled.addEventListener('change', async (e) => {
        this.core.state.settings.audioEnabled = e.target.checked;
        
        // Also enable/disable in the audio player
        if (e.target.checked) {
          await window.adhanAudioPlayer?.enableAudio();
        }
        
        await this.saveSettings();
        console.log('[AudioSettingsUI] Audio enabled:', e.target.checked);
      });
    }

    // Voice selection - Main
    if (this.elements.voiceMain) {
      this.elements.voiceMain.addEventListener('change', async (e) => {
        const voiceName = e.target.value;
        this.core.state.settings.audioProfileMain = {
          name: voiceName,
          file: this.voiceFiles[voiceName]
        };
        await this.saveSettings();
        console.log('[AudioSettingsUI] Main voice changed:', voiceName);
      });
    }

    // Voice selection - Reminder
    if (this.elements.voiceReminder) {
      this.elements.voiceReminder.addEventListener('change', async (e) => {
        const voiceName = e.target.value;
        this.core.state.settings.audioProfileReminder = {
          name: voiceName,
          file: this.voiceFiles[voiceName]
        };
        await this.saveSettings();
        console.log('[AudioSettingsUI] Reminder voice changed:', voiceName);
      });
    }

    // Volume slider
    if (this.elements.volumeSlider) {
      this.elements.volumeSlider.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value);
        if (this.elements.volumeValue) {
          this.elements.volumeValue.textContent = Math.round(volume * 100) + '%';
        }
      });

      this.elements.volumeSlider.addEventListener('change', async (e) => {
        const volume = parseFloat(e.target.value);
        if (!this.core.state.settings.audioSettings) {
          this.core.state.settings.audioSettings = {};
        }
        this.core.state.settings.audioSettings.volume = volume;
        await this.saveSettings();
        console.log('[AudioSettingsUI] Volume changed:', volume);
      });
    }

    // Fade-in slider
    if (this.elements.fadeinSlider) {
      this.elements.fadeinSlider.addEventListener('input', (e) => {
        const fadein = parseInt(e.target.value);
        if (this.elements.fadeinValue) {
          this.elements.fadeinValue.textContent = (fadein / 1000).toFixed(1) + 's';
        }
      });

      this.elements.fadeinSlider.addEventListener('change', async (e) => {
        const fadein = parseInt(e.target.value);
        if (!this.core.state.settings.audioSettings) {
          this.core.state.settings.audioSettings = {};
        }
        this.core.state.settings.audioSettings.fadeInMs = fadein;
        await this.saveSettings();
        console.log('[AudioSettingsUI] Fade-in changed:', fadein);
      });
    }

    // Cooldown slider
    if (this.elements.cooldownSlider) {
      this.elements.cooldownSlider.addEventListener('input', (e) => {
        const cooldown = parseInt(e.target.value);
        if (this.elements.cooldownValue) {
          this.elements.cooldownValue.textContent = cooldown >= 60 ? 
            Math.round(cooldown / 60) + 'm' : cooldown + 's';
        }
      });

      this.elements.cooldownSlider.addEventListener('change', async (e) => {
        const cooldown = parseInt(e.target.value);
        if (!this.core.state.settings.audioSettings) {
          this.core.state.settings.audioSettings = {};
        }
        this.core.state.settings.audioSettings.cooldownSeconds = cooldown;
        await this.saveSettings();
        console.log('[AudioSettingsUI] Cooldown changed:', cooldown);
      });
    }

    // Vibrate only toggle
    if (this.elements.vibrateOnly) {
      this.elements.vibrateOnly.addEventListener('change', async (e) => {
        if (!this.core.state.settings.audioSettings) {
          this.core.state.settings.audioSettings = {};
        }
        this.core.state.settings.audioSettings.vibrateOnly = e.target.checked;
        await this.saveSettings();
        console.log('[AudioSettingsUI] Vibrate only:', e.target.checked);
      });
    }

    // Preview buttons
    if (this.elements.previewMain) {
      this.elements.previewMain.addEventListener('click', async () => {
        await this.previewVoice('main');
      });
    }

    if (this.elements.previewReminder) {
      this.elements.previewReminder.addEventListener('click', async () => {
        await this.previewVoice('reminder');
      });
    }

    if (this.elements.stopAudio) {
      this.elements.stopAudio.addEventListener('click', () => {
        this.stopPreview();
      });
    }
  }

  async previewVoice(type = 'main') {
    // Enable audio player first (requires user gesture)
    await window.adhanAudioPlayer?.enableAudio();

    // Get the settings
    const audioSettings = this.core.state.settings.audioSettings || {};
    const profile = type === 'main' ? 
      this.core.state.settings.audioProfileMain : 
      this.core.state.settings.audioProfileReminder;

    const audioFile = profile?.file || '/audio/adhan.mp3';
    const volume = audioSettings.volume || 0.8;
    const fadeInMs = audioSettings.fadeInMs || 3000;
    const vibrateOnly = audioSettings.vibrateOnly || false;

    console.log('[AudioSettingsUI] Previewing', type, 'voice:', { audioFile, volume, fadeInMs, vibrateOnly });

    // Show stop button
    if (this.elements.stopAudio) {
      this.elements.stopAudio.style.display = 'inline-block';
    }

    // Play the audio
    await window.adhanAudioPlayer?.playAdhan({
      audioFile,
      volume,
      fadeInMs,
      vibrateOnly,
      notificationType: type,
      cooldownSeconds: 0  // No cooldown for preview
    });

    // Auto-hide stop button after playback
    setTimeout(() => {
      if (this.elements.stopAudio && !window.adhanAudioPlayer?.isPlaying) {
        this.elements.stopAudio.style.display = 'none';
      }
    }, 5000);
  }

  stopPreview() {
    console.log('[AudioSettingsUI] Stopping preview');
    window.adhanAudioPlayer?.stopAdhan();
    
    if (this.elements.stopAudio) {
      this.elements.stopAudio.style.display = 'none';
    }
  }

  async saveSettings() {
    // Trigger settings save
    if (this.core.settings) {
      await this.core.settings.save();
    }
  }
}

