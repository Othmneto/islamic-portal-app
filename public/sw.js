// This event listener fires whenever a push notification is received.
self.addEventListener('push', event => {
  // The data sent from the server is in event.data.text()
  const data = event.data.json(); // We parse it as JSON

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico', // Use a default icon if none provided
    badge: '/favicon.ico' // Small icon for the notification bar
  };

  // The service worker waits until the notification is shown
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});