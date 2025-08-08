// public/prayertimes.js
// Complete Prayer Times Frontend with Notification Support

document.addEventListener('DOMContentLoaded', async () => {
    // --- STATE & REFERENCES ---
    let translations = {};
    let currentCoords = null;
    let currentCityName = '';
    let calendarDate = new Date();
    let countdownInterval;
    let notificationTimeouts = [];
    let searchDebounceTimeout;
    let serviceWorkerRegistration = null;
    let pushSubscription = null;

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
        adhanPlayer: document.getElementById('adhan-player'),
        // AI Assistant
        assistantModal: document.getElementById('assistant-modal'),
        openAssistantBtn: document.getElementById('open-assistant-btn'),
        closeAssistantBtn: document.getElementById('close-assistant-btn'),
        assistantSendBtn: document.getElementById('assistant-send-btn'),
        assistantInput: document.getElementById('assistant-input'),
        assistantChatWindow: document.getElementById('assistant-chat-window'),
    };

    // --- HELPER FUNCTIONS ---
    
    // Convert VAPID key
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // Get CSRF token from cookie
    function getCsrfToken() {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; XSRF-TOKEN=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Get auth token
    function getAuthToken() {
        return localStorage.getItem('authToken') || localStorage.getItem('token');
    }

    // Show notification message
    function showNotificationMessage(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification-message ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // --- SERVICE WORKER & PUSH NOTIFICATION FUNCTIONS ---

    async function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.error('Service Worker not supported');
            return null;
        }

        try {
            console.log('Registering service worker...');
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            
            // Wait for the service worker to be ready
            await navigator.serviceWorker.ready;
            
            console.log('Service Worker registered:', registration);
            serviceWorkerRegistration = registration;
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            throw error;
        }
    }

    async function subscribeToPushNotifications(registration) {
        try {
            // Check if already subscribed
            const existingSubscription = await registration.pushManager.getSubscription();
            if (existingSubscription) {
                console.log('Already subscribed:', existingSubscription);
                pushSubscription = existingSubscription;
                return existingSubscription;
            }

            // Get VAPID public key
            console.log('Fetching VAPID public key...');
            const response = await fetch('/api/notifications/vapid-public-key');
            if (!response.ok) throw new Error('Failed to fetch VAPID key');
            
            const vapidPublicKey = await response.text();
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

            // Subscribe to push notifications
            console.log('Subscribing to push notifications...');
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            console.log('Push subscription created:', subscription);
            pushSubscription = subscription;
            return subscription;
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            throw error;
        }
    }

    async function sendSubscriptionToServer(subscription) {
        const token = getAuthToken();
        const csrfToken = getCsrfToken();

        // First, try to get CSRF token if not available
        if (!csrfToken) {
            await fetch('/api/auth/csrf', { credentials: 'include' });
        }

        const response = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }),
                ...(getCsrfToken() && { 'X-CSRF-Token': getCsrfToken() })
            },
            credentials: 'include',
            body: JSON.stringify(subscription)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.msg || 'Failed to save subscription');
        }

        return response.json();
    }

    async function unsubscribeFromPushNotifications() {
        try {
            if (pushSubscription) {
                await pushSubscription.unsubscribe();
            }

            const token = getAuthToken();
            const csrfToken = getCsrfToken();

            await fetch('/api/notifications/unsubscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                    ...(csrfToken && { 'X-CSRF-Token': csrfToken })
                },
                credentials: 'include',
                body: JSON.stringify({ 
                    endpoint: pushSubscription?.endpoint 
                })
            });

            pushSubscription = null;
            console.log('Unsubscribed from push notifications');
            return true;
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            return false;
        }
    }

    async function setupPrayerNotifications() {
        try {
            // Check browser support
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                showNotificationMessage('Your browser does not support push notifications', 'error');
                return false;
            }

            // Request notification permission
            console.log('Requesting notification permission...');
            const permission = await Notification.requestPermission();
            
            if (permission !== 'granted') {
                showNotificationMessage('Please enable notifications in your browser settings', 'error');
                elements.notificationToggle.checked = false;
                return false;
            }

            // Register service worker
            const registration = await registerServiceWorker();
            if (!registration) {
                throw new Error('Service Worker registration failed');
            }

            // Subscribe to push notifications
            const subscription = await subscribeToPushNotifications(registration);
            
            // Send subscription to server
            await sendSubscriptionToServer(subscription);
            
            showNotificationMessage('Prayer notifications enabled successfully!', 'success');
            localStorage.setItem('notificationsEnabled', 'true');
            
            // Update user preferences on server
            await updateNotificationPreferences(true);
            
            return true;
        } catch (error) {
            console.error('Failed to setup notifications:', error);
            showNotificationMessage(`Failed to enable notifications: ${error.message}`, 'error');
            elements.notificationToggle.checked = false;
            return false;
        }
    }

    async function updateNotificationPreferences(enabled) {
        try {
            const token = getAuthToken();
            if (!token) {
                console.log('No auth token, skipping preference update');
                return;
            }

            const preferences = {
                prayerReminders: {
                    fajr: enabled,
                    dhuhr: enabled,
                    asr: enabled,
                    maghrib: enabled,
                    isha: enabled
                },
                specialAnnouncements: enabled
            };

            await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ notificationPreferences: preferences })
            });

            console.log('Notification preferences updated');
        } catch (error) {
            console.error('Failed to update preferences:', error);
        }
    }

    async function checkNotificationStatus() {
        try {
            if (!('serviceWorker' in navigator)) return;
            
            const registration = await navigator.serviceWorker.getRegistration();
            if (!registration) {
                elements.notificationToggle.checked = false;
                return;
            }

            const subscription = await registration.pushManager.getSubscription();
            elements.notificationToggle.checked = subscription !== null;
            
            if (subscription) {
                pushSubscription = subscription;
                serviceWorkerRegistration = registration;
            }

            // Check localStorage for saved state
            const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
            if (notificationsEnabled && !subscription) {
                // Notifications were enabled but subscription is gone, re-subscribe
                await setupPrayerNotifications();
            }
        } catch (error) {
            console.error('Error checking notification status:', error);
        }
    }

    async function sendTestNotification() {
        try {
            const token = getAuthToken();
            const csrfToken = getCsrfToken();

            if (!token) {
                showNotificationMessage('Please login to test notifications', 'error');
                return;
            }

            const response = await fetch('/api/notifications/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    ...(csrfToken && { 'X-CSRF-Token': csrfToken })
                },
                credentials: 'include'
            });

            const result = await response.json();
            
            if (response.ok) {
                showNotificationMessage('Test notification sent! Check your notifications.', 'success');
            } else {
                showNotificationMessage(result.error || 'Failed to send test notification', 'error');
            }
        } catch (error) {
            console.error('Test notification failed:', error);
            showNotificationMessage('Failed to send test notification', 'error');
        }
    }

    async function sendTestPrayerNotification() {
        try {
            const token = getAuthToken();
            const csrfToken = getCsrfToken();

            const response = await fetch('/api/notifications/test-prayer-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                    ...(csrfToken && { 'X-CSRF-Token': csrfToken })
                },
                credentials: 'include'
            });

            const result = await response.json();
            
            if (response.ok) {
                showNotificationMessage(
                    `Test sent! Next prayer: ${result.nextPrayer} at ${result.nextPrayerTime}`, 
                    'success'
                );
            } else {
                showNotificationMessage(result.error || 'Failed to send test', 'error');
            }
        } catch (error) {
            console.error('Test prayer notification failed:', error);
            showNotificationMessage('Failed to send test notification', 'error');
        }
    }

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

    // --- PRAYER TIME FUNCTIONS ---
    function formatTime(date, fallback = '--:--') {
        if (!date || isNaN(new Date(date))) return fallback;
        const use24Hour = elements.clockFormatToggle?.checked;
        const lang = localStorage.getItem('language') || 'en';
        return new Date(date).toLocaleTimeString(lang, { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: !use24Hour 
        });
    }
    
    function updateMoonPhaseUI(latitude, longitude) {
        if (!window.SunCalc) {
            console.warn('SunCalc library not loaded');
            return;
        }
        
        const now = new Date();
        const illumination = SunCalc.getMoonIllumination(now);
        const position = SunCalc.getMoonPosition(now, latitude, longitude);
        const fraction = illumination.fraction;
        const phaseValue = illumination.phase;
        const moonCycle = 29.53;
        const age = phaseValue * moonCycle;
        
        let phaseName = '', moonEmoji = '';
        if (phaseValue < 0.03 || phaseValue > 0.97) { 
            phaseName = "New Moon"; 
            moonEmoji = "🌑"; 
        } else if (phaseValue < 0.25) { 
            phaseName = "Waxing Crescent"; 
            moonEmoji = "🌒"; 
        } else if (phaseValue < 0.28) { 
            phaseName = "First Quarter"; 
            moonEmoji = "🌓"; 
        } else if (phaseValue < 0.5) { 
            phaseName = "Waxing Gibbous"; 
            moonEmoji = "🌔"; 
        } else if (phaseValue < 0.53) { 
            phaseName = "Full Moon"; 
            moonEmoji = "🌕"; 
        } else if (phaseValue < 0.75) { 
            phaseName = "Waning Gibbous"; 
            moonEmoji = "🌖"; 
        } else if (phaseValue < 0.78) { 
            phaseName = "Last Quarter"; 
            moonEmoji = "🌗"; 
        } else { 
            phaseName = "Waning Crescent"; 
            moonEmoji = "🌘"; 
        }
        
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
            
            elements.nextPrayerName.textContent = translations[nextPrayerName] || 
                nextPrayerName.charAt(0).toUpperCase() + nextPrayerName.slice(1);
            elements.countdownTimer.textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }, 1000);
    }

    function updateUI(data) {
        if (!data || !data.timesRaw) return;
        
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

        // Save location to user profile if logged in
        saveUserLocation(currentCoords.lat, currentCoords.lon, currentCityName);
    }

    async function saveUserLocation(lat, lon, city) {
        try {
            const token = getAuthToken();
            if (!token) return;

            const [cityName, country] = city.includes(',') 
                ? city.split(',').map(s => s.trim())
                : [city, ''];

            await fetch('/api/user/location', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    city: cityName,
                    country: country,
                    lat: parseFloat(lat),
                    lng: parseFloat(lon)
                })
            });

            console.log('User location saved');
        } catch (error) {
            console.error('Failed to save location:', error);
        }
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
            .catch(error => { 
                console.error(error);
                showNotificationMessage('Failed to load prayer times', 'error');
            });
    }

    function findUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => getPrayerTimes(
                    position.coords.latitude, 
                    position.coords.longitude, 
                    'Your Location (Detected)'
                ),
                () => getPrayerTimes(25.2048, 55.2708, 'Dubai, UAE (Default)')
            );
        } else {
            getPrayerTimes(25.2048, 55.2708, 'Dubai, UAE (Default)');
        }
    }

    // --- TEST NOTIFICATION BUTTON ---
    function addTestNotificationButtons() {
        const container = document.querySelector('.adhan-toggle-container');
        if (!container) return;

        // Test general notification button
        const testBtn = document.createElement('button');
        testBtn.id = 'test-notification-btn';
        testBtn.innerHTML = '<i class="fa-solid fa-bell"></i> Test Notification';
        testBtn.style.marginLeft = '10px';
        testBtn.onclick = sendTestNotification;
        container.appendChild(testBtn);

        // Test prayer notification button
        const testPrayerBtn = document.createElement('button');
        testPrayerBtn.id = 'test-prayer-notification-btn';
        testPrayerBtn.innerHTML = '<i class="fa-solid fa-mosque"></i> Test Prayer Alert';
        testPrayerBtn.style.marginLeft = '10px';
        testPrayerBtn.onclick = sendTestPrayerNotification;
        container.appendChild(testPrayerBtn);
    }

    // --- EVENT LISTENERS ---
    
    // Notification toggle
    elements.notificationToggle?.addEventListener('change', async (e) => {
        if (e.target.checked) {
            const success = await setupPrayerNotifications();
            if (!success) {
                e.target.checked = false;
            }
        } else {
            if (confirm('Are you sure you want to disable prayer notifications?')) {
                const success = await unsubscribeFromPushNotifications();
                if (success) {
                    localStorage.setItem('notificationsEnabled', 'false');
                    await updateNotificationPreferences(false);
                    showNotificationMessage('Notifications disabled', 'info');
                } else {
                    e.target.checked = true;
                }
            } else {
                e.target.checked = true;
            }
        }
    });

    // Clock format toggle
    elements.clockFormatToggle?.addEventListener('change', () => {
        localStorage.setItem('clockFormat24', elements.clockFormatToggle.checked);
        if (currentCoords) {
            getPrayerTimes(currentCoords.lat, currentCoords.lon, currentCityName);
        }
    });

    // Calculation method change
    elements.calculationMethodSelect?.addEventListener('change', (e) => {
        localStorage.setItem('calculationMethod', e.target.value);
        if (currentCoords) {
            getPrayerTimes(currentCoords.lat, currentCoords.lon, currentCityName);
        }
    });

    // Madhab change
    elements.madhabSelect?.addEventListener('change', (e) => {
        localStorage.setItem('madhab', e.target.value);
        if (currentCoords) {
            getPrayerTimes(currentCoords.lat, currentCoords.lon, currentCityName);
        }
    });

    // Language selector
    elements.languageSelector?.addEventListener('change', (e) => setLanguage(e.target.value));

    // Location search
    elements.locationSearchInput?.addEventListener('input', () => {
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
                })
                .catch(error => {
                    console.error('City search failed:', error);
                });
        }, 300);
    });

    // AI Assistant
    elements.openAssistantBtn?.addEventListener('click', () => {
        elements.assistantModal.classList.add('active');
    });

    elements.closeAssistantBtn?.addEventListener('click', () => {
        elements.assistantModal.classList.remove('active');
    });

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
        thinkingDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Thinking...';
        elements.assistantChatWindow.appendChild(thinkingDiv);
        elements.assistantChatWindow.scrollTop = elements.assistantChatWindow.scrollHeight;

        try {
            const response = await fetch('/api/assistant/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    question: question, 
                    sessionId: getOrCreateSessionId() 
                })
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

    elements.assistantSendBtn?.addEventListener('click', askAssistant);
    elements.assistantInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            askAssistant();
        }
    });

    // Simple sessionId generator for the assistant
    function getOrCreateSessionId() {
        let sessionId = localStorage.getItem('assistantSessionId');
        if (!sessionId) {
            sessionId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            localStorage.setItem('assistantSessionId', sessionId);
        }
        return sessionId;
    }

    // --- INITIALIZATION ---
    async function initializeApp() {
        console.log('Initializing Prayer Times app...');
        
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        // Language setup
        const initialLang = localStorage.getItem('language') || 
            (navigator.language.slice(0, 2) === 'ar' ? 'ar' : 'en');
        await setLanguage(initialLang);

        // Load saved preferences
        const savedClockFormat = localStorage.getItem('clockFormat24') === 'true';
        if (elements.clockFormatToggle) {
            elements.clockFormatToggle.checked = savedClockFormat;
        }

        const savedMethod = localStorage.getItem('calculationMethod');
        if (savedMethod && elements.calculationMethodSelect) {
            elements.calculationMethodSelect.value = savedMethod;
        }

        const savedMadhab = localStorage.getItem('madhab');
        if (savedMadhab && elements.madhabSelect) {
            elements.madhabSelect.value = savedMadhab;
        }

        // Check notification status
        await checkNotificationStatus();

        // Add test buttons
        addTestNotificationButtons();

        // Find user location and load prayer times
        findUserLocation();

        console.log('Prayer Times app initialized successfully');
    }

    // Start the app
    initializeApp().catch(error => {
        console.error('Failed to initialize app:', error);
        showNotificationMessage('Failed to initialize app', 'error');
    });
});