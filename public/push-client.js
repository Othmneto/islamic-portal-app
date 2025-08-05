// A helper function to convert the VAPID key
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

// Main function to initialize the push subscription flow
async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push messaging is not supported by this browser.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered successfully.');
    
    // Check if the user is already subscribed
    let subscription = await registration.pushManager.getSubscription();
    if (subscription === null) {
      // If not subscribed, ask for permission
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('Notification permission granted.');
        await subscribeUser(registration);
      } else {
        console.warn('Notification permission denied.');
      }
    } else {
      console.log('User is already subscribed.');
    }
  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}

// Subscribes the user to push notifications
async function subscribeUser(registration) {
  try {
    // Fetch the VAPID public key from our new backend endpoint
    const response = await fetch('/api/notifications/vapid-public-key');
    const vapidPublicKey = await response.text();
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    console.log('User subscribed successfully.');
    await sendSubscriptionToServer(subscription);
  } catch (error) {
    console.error('Failed to subscribe the user:', error);
  }
}

// Sends the subscription object to the backend
async function sendSubscriptionToServer(subscription) {
  try {
    // NOTE: You must get the JWT token from your authentication flow (e.g., localStorage)
    const token = localStorage.getItem('authToken'); // Or wherever you store your JWT

    if (!token) {
      console.error('Auth token not found. Cannot send subscription to server.');
      return;
    }

    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription: subscription, platform: 'web' }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('Subscription sent to server successfully.');
  } catch (error) {
    console.error('Error sending subscription to server:', error);
  }
}