// public/js/prayer-time/audio.js
// Robust Audio Playback Module with fade-in, cooldown, and cross-tab arbitration

class AdhanAudioPlayer {
  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.sourceNode = null;
    this.audioElement = null;
    this.isPlaying = false;
    this.lastPlayTime = 0;
    this.enabled = localStorage.getItem('adhan_audio_enabled') === 'true';
    this.currentPlayback = null;
    
    // Cross-tab arbitration
    this.playbackChannel = null;
    this.isPlaybackLeader = false;
    this.leaderHeartbeat = null;
    
    this.init();
  }

  /**
   * Initialize audio system
   */
  init() {
    console.log('🎵 [Audio] Initializing adhan audio player...');
    
    // Setup cross-tab coordination
    this.setupCrossTabSync();
    
    // Listen for Service Worker messages
    this.setupServiceWorkerListener();
    
    console.log(`🎵 [Audio] Audio player initialized (enabled: ${this.enabled})`);
  }

  /**
   * Setup cross-tab synchronization via BroadcastChannel
   */
  setupCrossTabSync() {
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('⚠️ [Audio] BroadcastChannel not supported, cross-tab sync disabled');
      return;
    }

    this.playbackChannel = new BroadcastChannel('adhan-playback');
    
    this.playbackChannel.onmessage = (event) => {
      const { type, timestamp, tabId } = event.data;
      
      if (type === 'PLAY_REQUEST') {
        // Another tab wants to play - if we're visible and they requested first, let them win
        if (document.visibilityState === 'visible' && !this.isPlaying) {
          // We're visible but not playing, check who requested first
          if (timestamp < (this.currentPlayback?.timestamp || Date.now())) {
            console.log('🎵 [Audio] Another tab claimed playback leadership');
            this.isPlaybackLeader = false;
          }
        }
      } else if (type === 'PLAYING') {
        // Another tab is playing - we should not play
        if (tabId !== this.tabId) {
          console.log('🎵 [Audio] Another tab is playing, staying silent');
          this.isPlaybackLeader = false;
          this.stopAdhan();
        }
      } else if (type === 'STOP_REMINDER') {
        // Main prayer fired, stop any reminder audio
        if (this.currentPlayback?.notificationType === 'reminder') {
          console.log('🎵 [Audio] Main prayer notification, stopping reminder');
          this.stopAdhan();
        }
      }
    };

    // Generate unique tab ID
    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup Service Worker message listener
   */
  setupServiceWorkerListener() {
    if (!navigator.serviceWorker) return;

    navigator.serviceWorker.addEventListener('message', (event) => {
      const data = event.data || {};
      
      if (data.type === 'PLAY_ADHAN') {
        console.log('🎵 [Audio] Received PLAY_ADHAN message from SW:', data);
        
        // Check if we should play (enabled, not vibrate-only, visible tab)
        if (!this.enabled) {
          console.log('⏭️ [Audio] Audio not enabled, skipping');
          return;
        }
        
        if (data.vibrateOnly) {
          console.log('⏭️ [Audio] Vibrate-only mode, skipping audio');
          return;
        }

        // Request playback leadership
        this.requestPlayback(data);
      }
    });
  }

  /**
   * Request playback leadership across tabs
   */
  requestPlayback(audioData) {
    const timestamp = Date.now();
    
    // Broadcast our intention to play
    if (this.playbackChannel) {
      this.playbackChannel.postMessage({
        type: 'PLAY_REQUEST',
        timestamp,
        tabId: this.tabId
      });
    }

    // Wait a brief moment to see if another visible tab claims leadership
    setTimeout(() => {
      // If we're visible and no one else is playing, claim leadership
      if (document.visibilityState === 'visible') {
        this.isPlaybackLeader = true;
        this.playAdhan(audioData);
      }
    }, 50); // 50ms race window
  }

  /**
   * Enable audio (requires user gesture)
   */
  async enableAudio() {
    try {
      // Create AudioContext if needed (unlocks audio on mobile)
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Resume if suspended (iOS requirement)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.enabled = true;
      localStorage.setItem('adhan_audio_enabled', 'true');
      
      console.log('✅ [Audio] Audio enabled successfully');
      return true;
    } catch (error) {
      console.error('❌ [Audio] Failed to enable audio:', error);
      return false;
    }
  }

  /**
   * Check cooldown period
   */
  checkCooldown(cooldownSeconds = 30) {
    const now = Date.now();
    const cooldownMs = cooldownSeconds * 1000;
    
    if (now - this.lastPlayTime < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - this.lastPlayTime)) / 1000);
      console.log(`⏸️ [Audio] Cooldown active, ${remaining}s remaining`);
      return false;
    }
    
    return true;
  }

  /**
   * Play adhan with fade-in
   */
  async playAdhan({ audioFile, volume = 0.8, fadeInMs = 3000, notificationType = 'main', cooldownSeconds = 30 }) {
    // Check if already playing
    if (this.isPlaying) {
      console.log('⏭️ [Audio] Already playing');
      return;
    }

    // Check cooldown
    if (!this.checkCooldown(cooldownSeconds)) {
      return;
    }

    try {
      console.log(`🎵 [Audio] Playing ${notificationType}: ${audioFile} (volume: ${volume}, fade: ${fadeInMs}ms)`);

      // Create AudioContext if needed
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      // Resume if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create audio element if needed
      if (!this.audioElement) {
        this.audioElement = new Audio();
        this.audioElement.preload = 'auto';
      }

      // Set source
      this.audioElement.src = audioFile;

      // Create audio graph: source -> gain -> destination
      if (!this.sourceNode) {
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.gainNode = this.audioContext.createGain();
        this.sourceNode.connect(this.gainNode).connect(this.audioContext.destination);
      }

      // Setup fade-in
      const ctx = this.audioContext;
      const gain = this.gainNode.gain;
      const targetVolume = Math.max(0, Math.min(volume, 1));
      
      gain.cancelScheduledValues(ctx.currentTime);
      gain.setValueAtTime(0.0001, ctx.currentTime);

      // Play audio
      await this.audioElement.play();
      this.isPlaying = true;
      this.lastPlayTime = Date.now();
      this.currentPlayback = { audioFile, notificationType, timestamp: this.lastPlayTime };

      // Broadcast that we're playing
      if (this.playbackChannel) {
        this.playbackChannel.postMessage({
          type: 'PLAYING',
          tabId: this.tabId,
          notificationType
        });
      }

      // Apply fade-in
      gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + (fadeInMs / 1000));

      // Setup completion handler
      this.audioElement.onended = () => {
        console.log('✅ [Audio] Playback completed');
        this.isPlaying = false;
        this.currentPlayback = null;
      };

      // Setup error handler with 2s timeout
      const playbackTimeout = setTimeout(() => {
        if (this.isPlaying) {
          console.warn('⚠️ [Audio] Playback timeout, stopping');
          this.stopAdhan();
        }
      }, 2000 + fadeInMs);

      this.audioElement.onerror = () => {
        clearTimeout(playbackTimeout);
        console.error('❌ [Audio] Playback error');
        this.isPlaying = false;
        this.currentPlayback = null;
      };

      console.log('🎵 [Audio] Playback started successfully');
      
    } catch (error) {
      console.error('❌ [Audio] Failed to play:', error);
      this.isPlaying = false;
      this.currentPlayback = null;
      
      // Show user-friendly message
      if (error.name === 'NotAllowedError') {
        console.warn('⚠️ [Audio] Autoplay blocked - user gesture required');
        this.showEnablePrompt();
      }
    }
  }

  /**
   * Stop adhan playback
   */
  stopAdhan() {
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }
    
    if (this.gainNode) {
      this.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
      this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    }
    
    this.isPlaying = false;
    this.currentPlayback = null;
    console.log('🛑 [Audio] Playback stopped');
  }

  /**
   * Show prompt to enable audio
   */
  showEnablePrompt() {
    // Only show if not already enabled
    if (this.enabled) return;

    // Create a simple banner
    const banner = document.createElement('div');
    banner.id = 'audio-enable-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #4CAF50;
      color: white;
      padding: 12px;
      text-align: center;
      z-index: 10000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    banner.innerHTML = `
      <span>🔊 Tap to enable adhan audio</span>
      <button id="enable-audio-btn" style="margin-left: 10px; padding: 4px 12px; background: white; color: #4CAF50; border: none; border-radius: 4px; cursor: pointer;">Enable</button>
      <button id="dismiss-audio-btn" style="margin-left: 5px; padding: 4px 12px; background: transparent; color: white; border: 1px solid white; border-radius: 4px; cursor: pointer;">Dismiss</button>
    `;
    
    document.body.appendChild(banner);

    // Enable button handler
    document.getElementById('enable-audio-btn')?.addEventListener('click', async () => {
      await this.enableAudio();
      banner.remove();
    });

    // Dismiss button handler
    document.getElementById('dismiss-audio-btn')?.addEventListener('click', () => {
      banner.remove();
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      banner.remove();
    }, 10000);
  }

  /**
   * Check if audio is currently playing
   */
  isAudioPlaying() {
    return this.isPlaying;
  }

  /**
   * Get audio status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      isPlaying: this.isPlaying,
      lastPlayTime: this.lastPlayTime,
      isLeader: this.isPlaybackLeader,
      currentPlayback: this.currentPlayback
    };
  }
}

// Create global instance
if (typeof window !== 'undefined') {
  window.adhanAudioPlayer = new AdhanAudioPlayer();
  console.log('✅ [Audio] Global audio player instance created');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdhanAudioPlayer;
}
