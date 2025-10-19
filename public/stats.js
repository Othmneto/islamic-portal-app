document.addEventListener('DOMContentLoaded', () => {
    const summaryContainer = document.getElementById('stats-summary-container');
    const countryTableBody = document.getElementById('country-table-body');

    // Function to format large numbers
    function formatNumber(num) {
        if (num >= 1e9) {
            return (num / 1e9).toFixed(2) + ' Billion';
        }
        if (num >= 1e6) {
            return (num / 1e6).toFixed(2) + ' Million';
        }
        return num.toLocaleString();
    }

    fetch('/api/ummah-stats')
        .then(response => response.json())
        .then(data => {
            // --- Populate Summary Cards ---
            summaryContainer.innerHTML = '';

            const summaryCard = document.createElement('div');
            summaryCard.className = 'stat-card';
            summaryCard.innerHTML = `
                <h3>Estimated World Muslim Population</h3>
                <p class="value">${formatNumber(data.globalMuslimPopulation)}</p>
                <p class="source">Based on live population data & research percentages</p>
            `;
            summaryContainer.appendChild(summaryCard);

            // --- Populate Country Table ---
            countryTableBody.innerHTML = ''; // Clear loading message
            data.countries.forEach(country => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><img src="${country.flag}" alt="${country.name} flag"> ${country.name}</td>
                    <td>${formatNumber(country.muslimPopulation)} <small>(${country.muslimPercent}%)</small></td>
                    <td>${country.totalPopulation.toLocaleString()}</td>
                `;
                countryTableBody.appendChild(row);
            });
        })
        .catch(error => {
            console.error('Error fetching stats:', error);
            summaryContainer.innerHTML = '<p>Could not load statistics.</p>';
            countryTableBody.innerHTML = '<tr><td colspan="3">Could not load country data.</td></tr>';
        });
});