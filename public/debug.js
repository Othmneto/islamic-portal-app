// public/debug.js

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    const statusAuth = document.querySelector('#status-auth .status');
    const statusSw = document.querySelector('#status-sw .status');
    const statusSub = document.querySelector('#status-sub .status');
    const subList = document.getElementById('subscriptions-list');
    const subscribeBtn = document.getElementById('subscribe-button');
    const unsubscribeBtn = document.getElementById('unsubscribe-button');

    // 1. Check Auth Token
    statusAuth.textContent = token ? 'Present ✅' : 'Missing ❌';
    statusAuth.className = token ? 'status ok' : 'status fail';
    
    // Attach click listener to the subscribe button
    subscribeBtn.addEventListener('click', () => {
        // This function now comes from push-client.js
        handleSubscribe();
    });

    // Function to update the UI with current subscription status
    async function updateSubscriptionStatus() {
        if ('serviceWorker' in navigator) {
            statusSw.textContent = 'Supported ✅';
            statusSw.className = 'status ok';
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            statusSub.textContent = sub ? 'Active ✅' : 'Inactive ❌';
            statusSub.className = sub ? 'status ok' : 'status fail';
            
            // Unsubscribe button logic
            unsubscribeBtn.onclick = async () => {
                if (sub) {
                    await sub.unsubscribe();
                    await fetch('/api/unsubscribe', {
                        method: 'POST',
                        body: JSON.stringify({ endpoint: sub.endpoint }),
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
                    });
                    alert('Unsubscribed successfully!');
                    location.reload();
                } else {
                    alert('No active subscription to unsubscribe.');
                }
            };
        } else {
            statusSw.textContent = 'Not Supported ❌';
            statusSw.className = 'status fail';
        }
    }

    // Function to fetch and display saved subscriptions from the backend
    async function listSavedSubscriptions() {
        if (!token) {
            subList.innerHTML = '<li>Auth token missing.</li>';
            return;
        }
        try {
            const response = await fetch('/api/subscriptions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error('Failed to list subscriptions: ' + response.statusText);
            }
            const subs = await response.json();
            subList.innerHTML = subs.length ? subs.map(s => `<li>${s.endpoint}</li>`).join('') : '<li>No subscriptions saved on the server.</li>';
        } catch (error) {
            subList.innerHTML = `<li>${error.message}</li>`;
        }
    }

    updateSubscriptionStatus();
    listSavedSubscriptions();
});