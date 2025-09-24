/* ------------------------------------------------------------------
   Audio Command Center
   - Master volume, output device routing (setSinkId)
   - Sound library + preview
   - Adhan playback
   - Audio device management
------------------------------------------------------------------- */

export class PrayerTimesAudio {
  constructor(core) {
    console.log("[Audio] Initializing PrayerTimesAudio");
    this.core = core;
    this.onSubscriptionUpdate = null;
  }

  // Populate audio devices
  async populateAudioDevices() {
    console.log("[Audio] Populating audio devices");
    if (!this.core.el.audioOutputSelect) {
      console.log("[Audio] No audio output select element found");
      return;
    }
    const sinkSupported = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
    if (!sinkSupported) {
      console.log("[Audio] setSinkId not supported, hiding audio output select");
      this.core.el.audioOutputSelect.parentElement?.style && (this.core.el.audioOutputSelect.parentElement.style.display = "none");
      return;
    }

    if (!navigator.mediaDevices?.enumerateDevices) {
      console.warn("[Audio] enumerateDevices() not supported.");
      this.core.el.audioOutputSelect.parentElement?.style && (this.core.el.audioOutputSelect.parentElement.style.display = "none");
      return;
    }
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => {});

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
      console.log(`[Audio] Found ${audioOutputs.length} audio output devices`);

      this.core.el.audioOutputSelect.innerHTML = '<option value="default">Default Device</option>';
      audioOutputs.forEach((device, idx) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || `Speaker ${idx + 1}`;
        this.core.el.audioOutputSelect.appendChild(option);
      });

      const savedSinkId = localStorage.getItem("audioSinkId");
      if (savedSinkId) {
        this.core.el.audioOutputSelect.value = savedSinkId;
        console.log(`[Audio] Restored saved audio device: ${savedSinkId}`);
      }
    } catch (err) {
      console.error("[Audio] Could not list audio devices:", err);
    }
  }

  // Render sound library
  renderSoundLibrary() {
    console.log("[Audio] Rendering sound library");
    if (!this.core.el.soundLibrary) {
      console.log("[Audio] No sound library element found");
      return;
    }

    const sounds = [
      { name: "Adhan of Makkah",  reciter: "Sheikh Ali Ahmad Mulla", src: "/audio/adhan.mp3" },
      { name: "Adhan of Madinah", reciter: "Sheikh Abdul-Majid",     src: "/audio/adhan_madinah.mp3" },
      { name: "Mishary Alafasy",  reciter: "Adhan Recitation",       src: "/audio/adhan_alafasy.mp3" },
      { name: "Simple Beep",      reciter: "Alert Tone",             src: "/audio/beep.mp3" },
    ];

    this.core.el.soundLibrary.replaceChildren();
    const currentSoundSrc = localStorage.getItem("selectedAdhanSrc") || sounds[0].src;
    console.log(`[Audio] Current sound: ${currentSoundSrc}`);

    sounds.forEach((sound) => {
      const card = document.createElement("div");
      card.className = "sound-card";
      if (sound.src === currentSoundSrc) card.classList.add("active");
      card.dataset.soundSrc = sound.src;

      const info = document.createElement("div");
      info.className = "sound-info";
      info.innerHTML = `<strong>${sound.name}</strong><span>${sound.reciter}</span>`;

      const button = document.createElement("button");
      button.className = "play-preview-btn";
      button.innerHTML = '<i class="fa-solid fa-play"></i>';
      button.setAttribute("aria-label", `Preview ${sound.name}`);

      button.addEventListener("click", (e) => {
        e.stopPropagation();
        this.playAdhan(sound.src, true);
      });

      card.addEventListener("click", async () => {
        document.querySelectorAll(".sound-card.active").forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
        localStorage.setItem("selectedAdhanSrc", sound.src);
        if (this.core.el.adhanPlayer) {
          this.core.el.adhanPlayer.src = sound.src;
          try { await this.core.el.adhanPlayer.load(); } catch {}
        }
        if (this.core.el.notifToggle?.checked) {
          // This will be handled by notifications module
          this.onSubscriptionUpdate?.();
        }
      });

      card.appendChild(info);
      card.appendChild(button);
      this.core.el.soundLibrary.appendChild(card);
    });
  }

  // Play adhan
  async playAdhan(src, isPreview = false) {
    try {
      console.log(`[Audio] playAdhan called: ${src} (preview: ${isPreview})`);
      if (!this.core.el.adhanPlayer) {
        console.warn("[Audio] No adhan player element found");
        return;
      }

      if (!isPreview) {
        const enabled = this.core.el.adhanToggle?.checked ?? true;
        localStorage.setItem("adhanEnabled", enabled ? "true" : "false");
        if (!enabled) {
          console.log("[Audio] Adhan disabled, skipping playback");
          return;
        }
      }

      const selectedSrc = src || localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3";
      if (this.core.el.adhanPlayer.getAttribute("src") !== selectedSrc) {
        this.core.el.adhanPlayer.setAttribute("src", selectedSrc);
        this.core.el.adhanPlayer.load();
      }

      const vol = parseFloat(localStorage.getItem("adhanVolume") || (this.core.el.volumeSlider?.value ?? "1"));
      this.core.el.adhanPlayer.volume = Number.isFinite(vol) ? vol : 1;

      if (typeof this.core.el.adhanPlayer.setSinkId === "function" && this.core.el.audioOutputSelect) {
        const sinkId = this.core.el.audioOutputSelect.value;
        if (sinkId && sinkId !== "default" && this.core.el.adhanPlayer.sinkId !== sinkId) {
          try { await this.core.el.adhanPlayer.setSinkId(sinkId); } catch (e) {
            console.warn("[Audio] setSinkId failed:", e?.message || e);
          }
        }
      }

      console.log("[Audio] Starting audio playback");
      await this.core.el.adhanPlayer.play();
      console.log("[Audio] Audio playback started successfully");
    } catch (e) {
      console.error("[Audio] Failed to play adhan:", e);
    }
  }

  // Unlock audio on first user gesture
  unlockAudioOnce() {
    if (!this.core.el.adhanPlayer) return;
    try {
      this.core.el.adhanPlayer.muted = true;
      this.core.el.adhanPlayer.play().then(() => {
        this.core.el.adhanPlayer.pause();
        this.core.el.adhanPlayer.currentTime = 0;
        this.core.el.adhanPlayer.muted = false;
      }).catch(() => {});
    } catch {}
  }

  // Setup audio event listeners
  setupAudioEventListeners() {
    // Volume slider
    this.core.el.volumeSlider?.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value);
      localStorage.setItem("adhanVolume", String(v));
      if (this.core.el.adhanPlayer) this.core.el.adhanPlayer.volume = Number.isFinite(v) ? v : 1;
      if (this.core.el.notifToggle?.checked) {
        // This will be handled by notifications module
        this.onSubscriptionUpdate?.();
      }
    });

    // Audio output select
    this.core.el.audioOutputSelect?.addEventListener("change", async (e) => {
      localStorage.setItem("audioSinkId", e.target.value);
      if (this.core.el.adhanPlayer && typeof this.core.el.adhanPlayer.setSinkId === "function") {
        try { await this.core.el.adhanPlayer.setSinkId(e.target.value); } catch {}
      }
      this.playAdhan(localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3", true);
    });

    // Unlock audio on first user gesture
    document.addEventListener("click", this.unlockAudioOnce.bind(this), { once: true });
  }

  // Initialize audio system
  async initialize() {
    await this.populateAudioDevices();
    this.renderSoundLibrary();
    this.setupAudioEventListeners();

    const savedVolume = localStorage.getItem("adhanVolume");
    if (savedVolume && this.core.el.volumeSlider) {
      this.core.el.volumeSlider.value = savedVolume;
      if (this.core.el.adhanPlayer) this.core.el.adhanPlayer.volume = parseFloat(savedVolume);
    }

    if (this.core.el.adhanPlayer) {
      this.core.el.adhanPlayer.src = localStorage.getItem("selectedAdhanSrc") || "/audio/adhan.mp3";
      const sinkId = localStorage.getItem("audioSinkId");
      if (typeof this.core.el.adhanPlayer.setSinkId === "function" && sinkId && sinkId !== "default") {
        try { await this.core.el.adhanPlayer.setSinkId(sinkId); } catch {}
      }
    }

    if (!this.core.el.adhanPlayer) {
      document.querySelector(".adhan-toggle-container")?.classList.add("hidden");
    }
  }
}
