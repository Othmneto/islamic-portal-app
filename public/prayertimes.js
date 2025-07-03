document.addEventListener('DOMContentLoaded', async () => {
    // --- STATE & REFERENCES ---
    let translations = {};
    let currentCoords = null;
    let currentCityName = '';
    let calendarDate = new Date();
    let countdownInterval;
    let notificationTimeouts = [];
    let searchDebounceTimeout;

    const elements = {
        loadingMessage: document.getElementById('loading-message'),
        prayerTimesContent: document.getElementById('prayer-times-content'),
        fajrTime: document.getElementById('fajr-time'),
        dhuhrTime: document.getElementById('dhuhr-time'),
        asrTime: document.getElementById('asr-time'),
        maghribTime: document.getElementById('maghrib-time'),
        ishaTime: document.getElementById('isha-time'),
        gregorianDate: document.getElementById('gregorian-date'),
        hijriDate: document.getElementById('hijri-date'),
        locationDisplay: document.getElementById('location-display'),
        nextPrayerName: document.getElementById('next-prayer-name'),
        countdownTimer: document.getElementById('countdown-timer'),
        qiblaArrow: document.getElementById('qibla-arrow'),
        qiblaDistance: document.getElementById('qibla-distance'),
        moonVisual: document.getElementById('moon-visual'),
        moonDetails: document.getElementById('moon-details'),
        moonRise: document.getElementById('moon-rise'),
        moonSet: document.getElementById('moon-set'),
        moonAge: document.getElementById('moon-age'),
        moonDistance: document.getElementById('moon-distance'),
        languageSelector: document.getElementById('language-selector'),
        notificationToggle: document.getElementById('notification-toggle'),
        adhanAudioToggle: document.getElementById('adhan-audio-toggle'),
        clockFormatToggle: document.getElementById('clock-format-toggle'),
        calculationMethodSelect: document.getElementById('calculation-method-select'),
        madhabSelect: document.getElementById('madhab-select'),
        locationSearchInput: document.getElementById('location-search-input'),
        searchResultsContainer: document.getElementById('search-results'),
        monthlyViewBtn: document.getElementById('view-monthly-btn'),
        monthlyModal: document.getElementById('monthly-view-modal'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        monthlyModalTitle: document.getElementById('monthly-modal-title'),
        prevMonthBtn: document.getElementById('prev-month-btn'),
        nextMonthBtn: document.getElementById('next-month-btn'),
        calendarBody: document.getElementById('calendar-body'),
        adhanPlayer: document.getElementById('adhan-player'),
        // <<<--- ADDED AI ASSISTANT ELEMENT REFERENCES START --->>>
        assistantModal: document.getElementById('assistant-modal'),
        openAssistantBtn: document.getElementById('open-assistant-btn'),
        closeAssistantBtn: document.getElementById('close-assistant-btn'),
        assistantSendBtn: document.getElementById('assistant-send-btn'),
        assistantInput: document.getElementById('assistant-input'),
        assistantChatWindow: document.getElementById('assistant-chat-window'),
        // <<<--- ADDED AI ASSISTANT ELEMENT REFERENCES END --->>>
    };
    
    // --- I18N (Multi-Language) LOGIC ---
    const translatePage = () => {
        if (!Object.keys(translations).length) return;
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.getAttribute('data-i18n-key');
            if (translations[key]) el.textContent = translations[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (translations[key]) el.placeholder = translations[key];
        });
    };

    const setLanguage = async (lang) => {
        localStorage.setItem('language', lang);
        elements.languageSelector.value = lang;
        try {
            const response = await fetch(`/locales/${lang}.json`);
            if (!response.ok) throw new Error(`Could not load language file for ${lang}`);
            translations = await response.json();
            document.documentElement.lang = lang;
            document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
            translatePage();
        } catch (error) {
            console.error(error);
        }
    };

    // --- ALL OTHER FUNCTIONS ---
    function formatTime(date, fallback = '--:--') {
        if (!date || isNaN(new Date(date))) return fallback;
        const use24Hour = elements.clockFormatToggle.checked;
        const lang = localStorage.getItem('language') || 'en';
        return new Date(date).toLocaleTimeString(lang, { hour: 'numeric', minute: '2-digit', hour12: !use24Hour });
    }
    
    function updateMoonPhaseUI(latitude, longitude) {
        const now = new Date();
        const illumination = SunCalc.getMoonIllumination(now);
        const position = SunCalc.getMoonPosition(now, latitude, longitude);
        const fraction = illumination.fraction;
        const phaseValue = illumination.phase;
        const moonCycle = 29.53;
        const age = phaseValue * moonCycle;
        let phaseName = '', moonEmoji = '';
        if (phaseValue < 0.03 || phaseValue > 0.97) { phaseName = "New Moon"; moonEmoji = "🌑"; }
        else if (phaseValue < 0.25) { phaseName = "Waxing Crescent"; moonEmoji = "🌒"; }
        else if (phaseValue < 0.28) { phaseName = "First Quarter"; moonEmoji = "🌓"; }
        else if (phaseValue < 0.5) { phaseName = "Waxing Gibbous"; moonEmoji = "🌔"; }
        else if (phaseValue < 0.53) { phaseName = "Full Moon"; moonEmoji = "🌕"; }
        else if (phaseValue < 0.75) { phaseName = "Waning Gibbous"; moonEmoji = "🌖"; }
        else if (phaseValue < 0.78) { phaseName = "Last Quarter"; moonEmoji = "🌗"; }
        else { phaseName = "Waning Crescent"; moonEmoji = "🌘"; }
        elements.moonVisual.textContent = moonEmoji;
        elements.moonDetails.textContent = `${phaseName}, ${(fraction * 100).toFixed(1)}% illumination`;
        const moonTimes = SunCalc.getMoonTimes(now, latitude, longitude);
        elements.moonRise.textContent = formatTime(moonTimes.rise, 'N/A');
        elements.moonSet.textContent = formatTime(moonTimes.set, 'N/A');
        elements.moonAge.textContent = `${age.toFixed(1)} days`;
        elements.moonDistance.textContent = `${Math.round(position.distance).toLocaleString()}`;
    }

    function startCountdown(prayerTimesRaw) {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            const now = new Date();
            let nextPrayerName = null, nextPrayerTime = null;
            const prayerOrder = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
            for (const name of prayerOrder) {
                const prayerTime = new Date(prayerTimesRaw[name]);
                if (prayerTime > now) {
                    nextPrayerName = name;
                    nextPrayerTime = prayerTime;
                    break;
                }
            }
            if (!nextPrayerName) {
                nextPrayerName = 'fajr';
                nextPrayerTime = new Date(new Date(prayerTimesRaw.fajr).getTime() + 24 * 60 * 60 * 1000);
            }
            const currentHighlighted = document.querySelector('.next-prayer');
            if (!currentHighlighted || currentHighlighted.dataset.key !== nextPrayerName) {
                 document.querySelectorAll('.prayer-time-card').forEach(card => card.classList.remove('next-prayer'));
                 document.querySelector(`.prayer-time-card[data-key="${nextPrayerName}"]`)?.classList.add('next-prayer');
            }
            const diff = nextPrayerTime - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            elements.nextPrayerName.textContent = translations[nextPrayerName] || nextPrayerName.charAt(0).toUpperCase() + nextPrayerName.slice(1);
            elements.countdownTimer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    }
    
    function updateUI(data) {
        if (!data || !data.timesRaw) { return; }
        elements.fajrTime.textContent = formatTime(data.timesRaw.fajr);
        elements.dhuhrTime.textContent = formatTime(data.timesRaw.dhuhr);
        elements.asrTime.textContent = formatTime(data.timesRaw.asr);
        elements.maghribTime.textContent = formatTime(data.timesRaw.maghrib);
        elements.ishaTime.textContent = formatTime(data.timesRaw.isha);
        elements.gregorianDate.textContent = data.date.gregorian;
        elements.hijriDate.textContent = data.date.hijri;
        if (data.qibla) elements.qiblaArrow.style.transform = `rotate(${data.qibla}deg)`;
        if (data.distance) elements.qiblaDistance.textContent = `${data.distance} km`;
        updateMoonPhaseUI(currentCoords.lat, currentCoords.lon);
        elements.loadingMessage.style.display = 'none';
        elements.prayerTimesContent.style.display = 'block';
        startCountdown(data.timesRaw);
    }

    function getPrayerTimes(latitude, longitude, cityName) {
        elements.loadingMessage.style.display = 'block';
        elements.prayerTimesContent.style.display = 'none';
        currentCoords = { lat: latitude, lon: longitude };
        currentCityName = cityName;
        const method = localStorage.getItem('calculationMethod') || 'MuslimWorldLeague';
        const madhab = localStorage.getItem('madhab') || 'shafii';
        fetch(`/api/prayertimes?lat=${latitude}&lon=${longitude}&method=${method}&madhab=${madhab}`)
            .then(res => res.json())
            .then(data => {
                elements.locationDisplay.textContent = cityName;
                updateUI(data);
            })
            .catch(error => { console.error(error) });
    }

    function findUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => getPrayerTimes(position.coords.latitude, position.coords.longitude, 'Your Location (Detected)'),
                () => getPrayerTimes(25.2048, 55.2708, 'Dubai, UAE (Default)')
            );
        } else {
            getPrayerTimes(25.2048, 55.2708, 'Dubai, UAE (Default)');
        }
    }
    
    // --- APP INITIALIZATION & EVENT LISTENERS ---
    async function initializeApp() {
        // Language setup
        elements.languageSelector.addEventListener('change', (e) => setLanguage(e.target.value));
        const initialLang = localStorage.getItem('language') || (navigator.language.slice(0, 2) === 'ar' ? 'ar' : 'en');
        await setLanguage(initialLang);
        
        // Settings and initial location fetch
        findUserLocation();

        // **FIXED: SEARCH EVENT LISTENER IS NOW ATTACHED**
        elements.locationSearchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimeout);
            const query = elements.locationSearchInput.value;
            if (query.length < 2) {
                elements.searchResultsContainer.innerHTML = '';
                return;
            }
            searchDebounceTimeout = setTimeout(() => {
                fetch(`/api/search-city?query=${query}`)
                    .then(res => res.json())
                    .then(cities => {
                        elements.searchResultsContainer.innerHTML = '';
                        cities.forEach(city => {
                            const item = document.createElement('div');
                            item.className = 'search-result-item';
                            item.textContent = `${city.city}, ${city.country}`;
                            item.addEventListener('click', () => {
                                elements.locationSearchInput.value = '';
                                elements.searchResultsContainer.innerHTML = '';
                                getPrayerTimes(city.lat, city.lng, `${city.city}, ${city.country}`);
                            });
                            elements.searchResultsContainer.appendChild(item);
                        });
                    });
            }, 300);
        });

        // <<<--- ADDED AI ASSISTANT LOGIC START --->>>
        elements.openAssistantBtn.addEventListener('click', () => elements.assistantModal.classList.add('active'));
        elements.closeAssistantBtn.addEventListener('click', () => elements.assistantModal.classList.remove('active'));

        const askAssistant = async () => {
            const question = elements.assistantInput.value.trim();
            if (!question) return;

            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'message user';
            userMessageDiv.textContent = question;
            elements.assistantChatWindow.appendChild(userMessageDiv);
            elements.assistantInput.value = '';
            elements.assistantChatWindow.scrollTop = elements.assistantChatWindow.scrollHeight;
            
            const thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'message assistant';
            thinkingDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            elements.assistantChatWindow.appendChild(thinkingDiv);
            elements.assistantChatWindow.scrollTop = elements.assistantChatWindow.scrollHeight;

            try {
                const response = await fetch('/api/assistant/ask', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ question: question, sessionId: getOrCreateSessionId() })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'The assistant returned an error.');
                }

                const data = await response.json();
                thinkingDiv.textContent = data.answer;

            } catch (error) {
                console.error('Assistant Error:', error);
                thinkingDiv.textContent = `Sorry, I encountered an error: ${error.message}`;
            } finally {
                 elements.assistantChatWindow.scrollTop = elements.assistantChatWindow.scrollHeight;
            }
        };

        elements.assistantSendBtn.addEventListener('click', askAssistant);
        elements.assistantInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                askAssistant();
            }
        });
        // <<<--- ADDED AI ASSISTANT LOGIC END --->>>
    }
    
    initializeApp();
});