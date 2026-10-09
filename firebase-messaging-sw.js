// Avisos (notificaciones) de Jonathan Porras | Preparación Física
// Al tocar un aviso sin link, se abre la app (este listener va antes del de Firebase a propósito)
self.addEventListener('notificationclick', e => {
  const d = (e.notification && e.notification.data) || {};
  const m = d.FCM_MSG || {};
  const link = (m.fcmOptions && m.fcmOptions.link) || (m.notification && m.notification.click_action);
  if (link) return; // Firebase abre el link indicado
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return clients.openWindow('/');
  }));
});

importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCKK5ftXQrUZrzr9rz1nTN4cIrcMC2BHBA",
  authDomain: "jump-virtual.firebaseapp.com",
  projectId: "jump-virtual",
  storageBucket: "jump-virtual.firebasestorage.app",
  messagingSenderId: "1077143569086",
  appId: "1:1077143569086:web:4147cda7b5ed857d3914ef"
});
// Los avisos enviados desde la consola de Firebase se muestran solos cuando la app está cerrada
firebase.messaging();
