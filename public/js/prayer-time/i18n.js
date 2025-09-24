/* ------------------------------------------------------------------
   Internationalization (i18n) system
   - Language switching
   - Translation loading
   - DOM translation updates
------------------------------------------------------------------- */

export class PrayerTimesI18N {
  constructor(core) {
    console.log("[I18N] Initializing PrayerTimesI18N");
    this.core = core;
  }

  // Set language
  async setLanguage(lang) {
    console.log(`[I18N] Setting language to: ${lang}`);
    localStorage.setItem("language", lang);
    if (this.core.el.langSel) this.core.el.langSel.value = lang;
    try {
      console.log(`[I18N] Loading translations for: ${lang}`);
      const r = await fetch(`/locales/${lang}.json`);
      this.core.state.translations = r.ok ? await r.json() : {};
      console.log(`[I18N] Loaded ${Object.keys(this.core.state.translations).length} translations`);
    } catch (e) {
      console.warn(`[I18N] Failed to load translations for ${lang}:`, e);
      this.core.state.translations = {};
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    console.log(`[I18N] Document language set to: ${lang}, direction: ${lang === "ar" ? "rtl" : "ltr"}`);
    this.translateNow();
  }

  // Translate now
  translateNow() {
    const t = this.core.state.translations;
    if (!t || !Object.keys(t).length) {
      console.log("[I18N] No translations available, skipping translation");
      return;
    }
    console.log("[I18N] Applying translations to DOM elements");
    let translatedCount = 0;
    document.querySelectorAll("[data-i18n-key]").forEach((node) => {
      const k = node.getAttribute("data-i18n-key");
      if (t[k]) {
        node.textContent = t[k];
        translatedCount++;
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      const k = node.getAttribute("data-i18n-placeholder");
      if (t[k]) {
        node.placeholder = t[k];
        translatedCount++;
      }
    });
    console.log(`[I18N] Translated ${translatedCount} elements`);
  }

  // Setup language event listeners
  setupEventListeners() {
    this.core.el.langSel?.addEventListener("change", (e) => this.setLanguage(e.target.value));
  }

  // Initialize i18n
  async initialize() {
    this.setupEventListeners();
    await this.setLanguage(
      localStorage.getItem("language") || (navigator.language.slice(0, 2) === "ar" ? "ar" : "en")
    );
  }
}
