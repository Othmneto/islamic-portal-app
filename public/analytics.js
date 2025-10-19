document.addEventListener('DOMContentLoaded', () => {
    const languageChartCanvas = document.getElementById('languageChart');
    const mostReplayedList = document.getElementById('mostReplayedList');

    // Fetch analytics data from the server
    fetch('/analytics')
        .then(response => response.json())
        .then(data => {
            console.log('Analytics data received:', data);
            renderLanguageChart(data.languageUsage);
            renderMostReplayed(data.mostReplayed);
        })
        .catch(err => {
            console.error('Failed to load analytics data:', err);
            mostReplayedList.innerHTML = '<p>Could not load analytics data.</p>';
        });

    function renderMostReplayed(replayedData) {
        if (!replayedData || replayedData.length === 0) {
            mostReplayedList.innerHTML = '<p>No translations have been replayed yet.</p>';
            return;
        }

        let html = '';
        replayedData.forEach(item => {
            html += `
                <div class="replayed-item">
                    <p>"${item.translated}"</p>
                    <div class="meta">
                        <span><strong>Original:</strong> "${item.original}"</span>
                        <br>
                        <span><strong>Replays:</strong> ${item.replayCount}</span>
                    </div>
                </div>
            `;
        });
        mostReplayedList.innerHTML = html;
    }

    function renderLanguageChart(usageData) {
        const labels = Object.keys(usageData);
        const values = Object.values(usageData);

        new Chart(languageChartCanvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Language Pairs Used',
                    data: values,
                    backgroundColor: [
                        '#3b82f6', '#ef4444', '#10b981', '#f97316', '#8b5cf6',
                        '#ec4899', '#f59e0b', '#6366f1', '#d946ef', '#06b6d4'
                    ],
                    borderColor: '#1f2937',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#ffffff'
                        }
                    }
                }
            }
        });
    }
});