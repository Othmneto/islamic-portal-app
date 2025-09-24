// zakat.js (Updated with manual price entry fallback)

// XSS protection function
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Element References ---
    const nisabStandardSelect = document.getElementById('nisab-standard');
    const goldPriceGroup = document.getElementById('gold-price-group');
    const silverPriceGroup = document.getElementById('silver-price-group');
    const goldPriceInput = document.getElementById('gold-price');
    const silverPriceInput = document.getElementById('silver-price');
    const calculateBtn = document.getElementById('calculate-btn');
    const formContainer = document.getElementById('zakat-form-container');
    const resultsContainer = document.getElementById('zakat-results-container');
    const recalculateBtn = document.getElementById('recalculate-btn');
    const currencySelect = document.getElementById('currency-select');

    // --- Function to fetch live Nisab data with currency ---
    async function fetchNisabData() {
        goldPriceInput.disabled = true;
        silverPriceInput.disabled = true;
        goldPriceInput.placeholder = 'Fetching live price...';
        silverPriceInput.placeholder = 'Fetching live price...';
        
        const selectedCurrency = currencySelect.value;
        
        try {
            const response = await fetch(`/api/zakat/nisab?currency=${selectedCurrency}`);
            if (!response.ok) {
                const err = await response.json();
                // This will throw an error and be caught by the catch block below
                throw new Error(err.error || 'Failed to fetch prices.');
            }
            const data = await response.json();
            
            goldPriceInput.value = data.goldPricePerGram;
            silverPriceInput.value = data.silverPricePerGram;
            
        } catch (error) {
            // <<<--- MODIFIED FALLBACK LOGIC START --->>>
            console.error(error);
            // 1. Show the user the error from the server.
            alert(error.message); 
            // 2. Enable the input fields so the user can enter the price manually.
            goldPriceInput.disabled = false;
            silverPriceInput.disabled = false;
            // 3. Update the placeholder text to guide the user.
            goldPriceInput.placeholder = 'Live price failed. Enter manually.';
            silverPriceInput.placeholder = 'Live price failed. Enter manually.';
            // <<<--- MODIFIED FALLBACK LOGIC END --->>>
        } 
    }

    // --- Accordion Logic ---
    document.querySelectorAll('.accordion').forEach(acc => {
        acc.addEventListener('click', function() {
            this.classList.toggle('active');
            const panel = this.nextElementSibling;
            panel.style.maxHeight = panel.style.maxHeight ? null : panel.scrollHeight + 'px';
        });
    });

    // --- Dynamic Row Logic ---
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('dynamic-add-btn')) {
            const container = e.target.closest('.panel-content');
            const newRow = e.target.parentElement.cloneNode(true);
            newRow.querySelectorAll('input').forEach(input => input.value = '');
            const addButton = newRow.querySelector('.dynamic-add-btn');
            if(addButton) {
                addButton.textContent = '−';
                addButton.classList.replace('dynamic-add-btn', 'dynamic-remove-btn');
            }
            container.appendChild(newRow);
            const panel = container.closest('.panel');
            if (panel.style.maxHeight) panel.style.maxHeight = panel.scrollHeight + "px";
        }
        if (e.target.classList.contains('dynamic-remove-btn')) {
            const rowToRemove = e.target.parentElement;
            const panel = rowToRemove.closest('.panel');
            const originalHeight = panel.scrollHeight;
            rowToRemove.remove();
            if (panel.style.maxHeight) panel.style.maxHeight = (originalHeight - rowToRemove.offsetHeight) + "px";
        }
    });

    // --- Nisab Dropdown UI Logic ---
    nisabStandardSelect.addEventListener('change', () => {
        if (nisabStandardSelect.value === 'gold') {
            goldPriceGroup.style.display = 'flex';
            silverPriceGroup.style.display = 'none';
        } else {
            goldPriceGroup.style.display = 'none';
            silverPriceGroup.style.display = 'flex';
        }
    });

    // --- Main Calculation Logic ---
    calculateBtn.addEventListener('click', () => {
        const goldPrice = parseFloat(goldPriceInput.value) || 0;
        const silverPrice = parseFloat(silverPriceInput.value) || 0;
        let nisabValue = 0;

        if (nisabStandardSelect.value === 'gold') {
            if (goldPrice === 0) { alert("Please enter the price per gram of gold."); return; }
            nisabValue = goldPrice * 85;
        } else {
            if (silverPrice === 0) { alert("Please enter the price per gram of silver."); return; }
            nisabValue = silverPrice * 595;
        }

        let totalAssets = 0;
        totalAssets += parseFloat(document.getElementById('cash-assets').value) || 0;
        totalAssets += parseFloat(document.getElementById('merchandise').value) || 0;
        
        const gold24 = parseFloat(document.getElementById('gold-24').value) || 0;
        const gold22 = parseFloat(document.getElementById('gold-22').value) || 0;
        const gold21 = parseFloat(document.getElementById('gold-21').value) || 0;
        const gold18 = parseFloat(document.getElementById('gold-18').value) || 0;
        if (goldPrice > 0) {
            totalAssets += (gold24 * goldPrice) + (gold22 * (goldPrice * 22/24)) + (gold21 * (goldPrice * 21/24)) + (gold18 * (goldPrice * 18/24));
        }
        
        const silverGrams = parseFloat(document.getElementById('silver-grams').value) || 0;
        if (silverPrice > 0) {
            totalAssets += silverGrams * silverPrice;
        }

        document.querySelectorAll('#shares-container .dynamic-row').forEach(row => {
            const numShares = parseFloat(row.children[1].value) || 0;
            const pricePerShare = parseFloat(row.children[2].value) || 0;
            totalAssets += numShares * pricePerShare;
        });

        document.querySelectorAll('#funds-container .dynamic-row').forEach(row => {
            const numUnits = parseFloat(row.children[1].value) || 0;
            const pricePerUnit = parseFloat(row.children[2].value) || 0;
            totalAssets += numUnits * pricePerUnit;
        });
        
        totalAssets += parseFloat(document.getElementById('receivables').value) || 0;
        const liabilities = parseFloat(document.getElementById('liabilities').value) || 0;
        const netWealth = totalAssets - liabilities;
        const zakatRate = document.getElementById('zakat-year').value === 'hijri' ? 0.025 : 0.02577;
        let zakatDue = 0;

        const selectedCurrency = currencySelect.value;
        document.querySelectorAll('.result-currency').forEach(el => el.textContent = selectedCurrency);
        document.getElementById('result-nisab').textContent = nisabValue.toFixed(2);
        document.getElementById('result-wealth').textContent = netWealth.toFixed(2);
        const finalZakatBox = document.getElementById('final-zakat-box');
        
        if (netWealth >= nisabValue) {
            zakatDue = netWealth * zakatRate;
            finalZakatBox.innerHTML = 'Zakat Due: <span class="result-value"><strong>' + escapeHtml(zakatDue.toFixed(2)) + '</strong> <span>' + escapeHtml(selectedCurrency) + '</span></span>';
        } else {
            finalZakatBox.innerHTML = `Your wealth is below the Nisab threshold.<br>No Zakat is due.`;
        }

        formContainer.style.display = 'none';
        resultsContainer.style.display = 'block';
    });
    
    recalculateBtn.addEventListener('click', () => {
        resultsContainer.style.display = 'none';
        formContainer.style.display = 'block';
    });

    currencySelect.addEventListener('change', fetchNisabData);

    function initialize() {
        fetchNisabData();
    }
    
    initialize();
});