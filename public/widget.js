document.addEventListener('DOMContentLoaded', () => {
    const headerEl = document.getElementById('widget-header');
    const bodyEl = document.getElementById('widget-body');

    // 1. Get settings from the URL's query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const lat = urlParams.get('lat') || '25.2048'; // Default to Dubai
    const lon = urlParams.get('lon') || '55.2708';
    const city = urlParams.get('city') || 'Dubai';
    const method = urlParams.get('method') || 'Dubai';
    const madhab = urlParams.get('madhab') || 'shafii';
    const use24Hour = urlParams.get('twentyfour') === 'true';

    // Update the header with the city name
    headerEl.textContent = `Prayer Times for ${city}`;

    // Helper function to format time
    function formatTime(dateString) {
        return new Date(dateString).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: !use24Hour,
        });
    }

    // 2. Fetch prayer times from our existing server API
    fetch(`/api/prayertimes?lat=${lat}&lon=${lon}&method=${method}&madhab=${madhab}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Could not fetch prayer times.');
            }
            return response.json();
        })
        .then(data => {
            // 3. Display the prayer times in the widget
            bodyEl.innerHTML = `
                <div class="prayer-row"><span>Fajr</span><span>${formatTime(data.timesRaw.fajr)}</span></div>
                <div class="prayer-row"><span>Dhuhr</span><span>${formatTime(data.timesRaw.dhuhr)}</span></div>
                <div class="prayer-row"><span>Asr</span><span>${formatTime(data.timesRaw.asr)}</span></div>
                <div class="prayer-row"><span>Maghrib</span><span>${formatTime(data.timesRaw.maghrib)}</span></div>
                <div class="prayer-row"><span>Isha</span><span>${formatTime(data.timesRaw.isha)}</span></div>
            `;
        })
        .catch(error => {
            console.error('Widget Error:', error);
            bodyEl.innerHTML = `<p>${error.message}</p>`;
        });
});