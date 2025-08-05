document.addEventListener('DOMContentLoaded', () => {
    // --- Gregorian to Hijri Elements ---
    const gregorianInput = document.getElementById('gregorian-date');
    const gToHResultEl = document.getElementById('g-to-h-result');

    // --- Hijri to Gregorian Elements ---
    const hijriDayInput = document.getElementById('hijri-day');
    const hijriMonthInput = document.getElementById('hijri-month');
    const hijriYearInput = document.getElementById('hijri-year');
    const hToGResultEl = document.getElementById('h-to-g-result');

    // --- Conversion from Gregorian to Hijri ---
    function convertGToH() {
        const gDate = gregorianInput.value;
        if (gDate) {
            // Use moment-hijri to format the date
            // iYYYY/iM/iD is the format for Hijri date
            // iMMMM gives the full Hijri month name
            const hijriDate = moment(gDate, 'YYYY-MM-DD').format('iDo iMMMM iYYYY');
            gToHResultEl.textContent = hijriDate;
        } else {
            gToHResultEl.textContent = '--';
        }
    }

    // --- Conversion from Hijri to Gregorian ---
    function convertHToG() {
        const hDay = hijriDayInput.value;
        const hMonth = hijriMonthInput.value;
        const hYear = hijriYearInput.value;

        if (hDay && hMonth && hYear && hDay >= 1 && hDay <= 30 && hMonth >= 1 && hMonth <= 12) {
            // Create a Hijri date string and parse it
            const hijriDateString = `${hYear}/${hMonth}/${hDay}`;
            const gregorianDate = moment(hijriDateString, 'iYYYY/iM/iD').format('dddd, MMMM Do YYYY');
            hToGResultEl.textContent = gregorianDate;
        } else {
            hToGResultEl.textContent = '--';
        }
    }

    // --- Attach Event Listeners ---
    // Update automatically when the user picks a date or types
    gregorianInput.addEventListener('change', convertGToH);
    hijriDayInput.addEventListener('input', convertHToG);
    hijriMonthInput.addEventListener('input', convertHToG);
    hijriYearInput.addEventListener('input', convertHToG);

    // Set today's date in the Gregorian input on page load
    const today = new Date().toISOString().split('T')[0];
    gregorianInput.value = today;
    convertGToH(); // Perform initial conversion for today
});