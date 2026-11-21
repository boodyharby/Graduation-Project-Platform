/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC4DZ4h0g7-MKY-vEZ-q2sLoA4mURDowDY',
  authDomain: 'proe-5d109.firebaseapp.com',
  projectId: 'proe-5d109',
  storageBucket: 'proe-5d109.firebasestorage.app',
  messagingSenderId: '707334233986',
  appId: '1:707334233986:web:434518338ec546bb1db99b',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || 'إيكو-بارك AI | تنبيه ذكي';
  const body =
    payload?.notification?.body ||
    payload?.data?.body ||
    'تم تحديث حالة الموقف أو رصد تنبيه طوارئ جديد.';

  self.registration.showNotification(title, {
    body,
    tag: payload?.data?.tag || 'ecopark-fcm-alert',
    requireInteraction: payload?.data?.priority === 'high',
    data: payload?.data || {},
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
      return undefined;
    })
  );
});
