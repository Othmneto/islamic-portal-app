document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('notification-settings-form');
    const messageDiv = document.getElementById('settings-message');
    const token = localStorage.getItem('token');

    // Function to populate the form with user's current settings
    async function loadSettings() {
        const response = await fetch('/api/user/preferences', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const prefs = await response.json();

        // Populate prayer time checkboxes
        for (const prayer in prefs.prayerReminders) {
            form.elements[prayer].checked = prefs.prayerReminders[prayer];
        }
        // Populate announcements checkbox
        form.elements.specialAnnouncements.checked = prefs.specialAnnouncements;
    }

    // Function to save the user's updated settings
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        messageDiv.textContent = 'Saving...';

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

        const response = await fetch('/api/user/preferences', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ notificationPreferences: updatedPrefs })
        });

        if (response.ok) {
            messageDiv.textContent = 'Settings saved successfully!';
            messageDiv.className = 'success-message';
        } else {
            messageDiv.textContent = 'Failed to save settings.';
            messageDiv.className = 'error-message';
        }
    });

    // Load the settings when the page loads
    if (token) {
        loadSettings();
    } else {
        messageDiv.textContent = 'You must be logged in to manage settings.';
    }
});