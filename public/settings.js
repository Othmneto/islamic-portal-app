// public/settings.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('notification-settings-form');
    const messageDiv = document.getElementById('settings-message');
    // Ensure you are storing the auth token in localStorage upon login
    const token = localStorage.getItem('authToken');

    const showMessage = (text, type) => {
        messageDiv.textContent = text;
        messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
        setTimeout(() => messageDiv.textContent = '', 3000);
    };

    // Fetches current settings and populates the form
    async function loadSettings() {
        if (!token) {
            showMessage('You must be logged in to view settings.', 'error');
            return;
        }
        try {
            const response = await fetch('/api/user/preferences', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to load settings.');

            const prefs = await response.json();
            if (prefs.prayerReminders) {
                for (const prayer in prefs.prayerReminders) {
                    if (form.elements[prayer]) {
                        form.elements[prayer].checked = prefs.prayerReminders[prayer];
                    }
                }
            }
            if (form.elements.specialAnnouncements) {
                form.elements.specialAnnouncements.checked = prefs.specialAnnouncements;
            }
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    // Handles form submission to save updated settings
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!token) {
            showMessage('You must be logged in to save settings.', 'error');
            return;
        }
        showMessage('Saving...', 'info');

        const updatedPrefs = {
            prayerReminders: {
                fajr: form.elements.fajr.checked,
                dhuhr: form.elements.dhuhr.checked,
                asr: form.elements.asr.checked,
                maghrib: form.elements.maghrib.checked,
                isha: form.elements.isha.checked,
            },
            specialAnnouncements: form.elements.specialAnnouncements.checked,
        };

        try {
            const response = await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ notificationPreferences: updatedPrefs })
            });

            if (!response.ok) throw new Error('Failed to save settings.');
            showMessage('Settings saved successfully!', 'success');
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    loadSettings();
});