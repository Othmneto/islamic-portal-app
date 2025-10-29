/**
 * Calendar Internationalization Service
 * Handles multi-language support for calendar UI and holiday names
 */

class CalendarI18n {
  constructor() {
    this.currentLanguage = localStorage.getItem('calendar-language') || 'en';
    this.translations = {};
    this.rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    this.loadTranslations();
  }

  /**
   * Load translations for the current language
   */
  async loadTranslations() {
    try {
      const response = await fetch(`/locales/${this.currentLanguage}.json`);
      if (response.ok) {
        this.translations = await response.json();
        this.applyRTL();
        this.updateUI();
      } else {
        console.warn(`Failed to load translations for ${this.currentLanguage}, falling back to English`);
        await this.loadFallbackTranslations();
      }
    } catch (error) {
      console.error('Error loading translations:', error);
      await this.loadFallbackTranslations();
    }
  }

  /**
   * Load fallback English translations
   */
  async loadFallbackTranslations() {
    try {
      const response = await fetch('/locales/en.json');
      if (response.ok) {
        this.translations = await response.json();
        this.currentLanguage = 'en';
      }
    } catch (error) {
      console.error('Error loading fallback translations:', error);
      this.translations = this.getDefaultTranslations();
    }
  }

  /**
   * Get default translations if all else fails
   */
  getDefaultTranslations() {
    return {
      calendar: {
        title: "Islamic Calendar",
        views: {
          month: "Month",
          week: "Week",
          day: "Day",
          year: "Year"
        },
        navigation: {
          previous: "Previous",
          next: "Next",
          today: "Today"
        },
        events: {
          addEvent: "Add Event",
          editEvent: "Edit Event",
          deleteEvent: "Delete Event"
        },
        prayers: {
          fajr: "Fajr Prayer",
          dhuhr: "Dhuhr Prayer",
          asr: "Asr Prayer",
          maghrib: "Maghrib Prayer",
          isha: "Isha Prayer"
        }
      }
    };
  }

  /**
   * Get translation for a key
   */
  t(key, fallback = '') {
    const keys = key.split('.');
    let value = this.translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return fallback || key;
      }
    }
    
    return value || fallback || key;
  }

  /**
   * Set language and reload translations
   */
  async setLanguage(language) {
    this.currentLanguage = language;
    localStorage.setItem('calendar-language', language);
    await this.loadTranslations();
    
    // Trigger language change event
    window.dispatchEvent(new CustomEvent('calendarLanguageChanged', {
      detail: { language }
    }));
  }

  /**
   * Get current language
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }

  /**
   * Check if current language is RTL
   */
  isRTL() {
    return this.rtlLanguages.includes(this.currentLanguage);
  }

  /**
   * Apply RTL styles if needed
   */
  applyRTL() {
    const html = document.documentElement;
    const body = document.body;
    
    if (this.isRTL()) {
      html.setAttribute('dir', 'rtl');
      html.setAttribute('lang', this.currentLanguage);
      body.classList.add('rtl');
    } else {
      html.setAttribute('dir', 'ltr');
      html.setAttribute('lang', this.currentLanguage);
      body.classList.remove('rtl');
    }
  }

  /**
   * Update UI elements with translations
   */
  updateUI() {
    // Update page title
    const title = this.t('calendar.title');
    document.title = title;
    
    // Update navigation buttons
    this.updateElement('[data-i18n="nav.previous"]', this.t('calendar.navigation.previous'));
    this.updateElement('[data-i18n="nav.next"]', this.t('calendar.navigation.next'));
    this.updateElement('[data-i18n="nav.today"]', this.t('calendar.navigation.today'));
    
    // Update view buttons
    this.updateElement('[data-i18n="view.month"]', this.t('calendar.views.month'));
    this.updateElement('[data-i18n="view.week"]', this.t('calendar.views.week'));
    this.updateElement('[data-i18n="view.day"]', this.t('calendar.views.day'));
    this.updateElement('[data-i18n="view.year"]', this.t('calendar.views.year'));
    
    // Update event modal
    this.updateElement('[data-i18n="event.addEvent"]', this.t('calendar.events.addEvent'));
    this.updateElement('[data-i18n="event.editEvent"]', this.t('calendar.events.editEvent'));
    this.updateElement('[data-i18n="event.deleteEvent"]', this.t('calendar.events.deleteEvent'));
    
    // Update search placeholder
    this.updateElement('[data-i18n="search.placeholder"]', this.t('calendar.search.placeholder'));
    
    // Update prayer names
    this.updatePrayerNames();
    
    // Update category names
    this.updateCategoryNames();
  }

  /**
   * Update a single element with translation
   */
  updateElement(selector, text) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = text;
    }
  }

  /**
   * Update prayer names throughout the UI
   */
  updatePrayerNames() {
    const prayerMappings = {
      'fajr': this.t('calendar.prayers.fajr'),
      'dhuhr': this.t('calendar.prayers.dhuhr'),
      'asr': this.t('calendar.prayers.asr'),
      'maghrib': this.t('calendar.prayers.maghrib'),
      'isha': this.t('calendar.prayers.isha')
    };

    Object.entries(prayerMappings).forEach(([key, translation]) => {
      // Update prayer time elements
      document.querySelectorAll(`[data-prayer="${key}"]`).forEach(el => {
        el.textContent = translation;
      });
    });
  }

  /**
   * Update category names
   */
  updateCategoryNames() {
    const categoryMappings = {
      'personal': this.t('calendar.categories.personal'),
      'work': this.t('calendar.categories.work'),
      'religious': this.t('calendar.categories.religious'),
      'prayer': this.t('calendar.categories.prayer'),
      'holiday': this.t('calendar.categories.holiday'),
      'meeting': this.t('calendar.categories.meeting'),
      'family': this.t('calendar.categories.family')
    };

    Object.entries(categoryMappings).forEach(([key, translation]) => {
      document.querySelectorAll(`[data-category="${key}"]`).forEach(el => {
        el.textContent = translation;
      });
    });
  }

  /**
   * Translate holiday names based on language
   */
  translateHolidayName(holiday, language = this.currentLanguage) {
    if (!holiday || !holiday.name) return holiday.name;

    // If holiday has multi-language names
    if (holiday.names && holiday.names[language]) {
      return holiday.names[language];
    }

    // If holiday has localized name
    if (holiday.localizedNames && holiday.localizedNames[language]) {
      return holiday.localizedNames[language];
    }

    // Return original name as fallback
    return holiday.name;
  }

  /**
   * Get available languages
   */
  getAvailableLanguages() {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'ur', name: 'Urdu', nativeName: 'اردو' },
      { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' }
    ];
  }

  /**
   * Create language selector HTML
   */
  createLanguageSelector() {
    const languages = this.getAvailableLanguages();
    const currentLang = this.currentLanguage;
    
    return `
      <select id="language-selector" class="ring" onchange="window.calendarI18n.setLanguage(this.value)">
        ${languages.map(lang => 
          `<option value="${lang.code}" ${lang.code === currentLang ? 'selected' : ''}>
            ${lang.nativeName}
          </option>`
        ).join('')}
      </select>
    `;
  }
}

// Initialize global i18n instance
window.calendarI18n = new CalendarI18n();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CalendarI18n;
}





