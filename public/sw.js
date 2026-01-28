// Service Worker for Push Notifications

// IndexedDB helper for reading notification settings
const DB_NAME = 'notification-settings-db';
const STORE_NAME = 'settings';
const SETTINGS_KEY = 'notification-settings';

async function getNotificationSettings() {
  try {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onerror = () => {
        console.log('IndexedDB open error, using defaults');
        resolve({ mode: 'all' });
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        try {
          const transaction = db.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const getRequest = store.get(SETTINGS_KEY);
          
          getRequest.onerror = () => {
            db.close();
            resolve({ mode: 'all' });
          };
          
          getRequest.onsuccess = () => {
            db.close();
            resolve(getRequest.result || { mode: 'all' });
          };
        } catch (e) {
          db.close();
          resolve({ mode: 'all' });
        }
      };
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return { mode: 'all' };
  }
}

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  const handlePush = async () => {
    // Get notification settings from IndexedDB
    const settings = await getNotificationSettings();
    console.log('Notification settings:', settings);

    let data = {
      title: '근태 수정 요청',
      body: '새로운 근태 수정 요청이 있습니다.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url: '/' }
    };

    if (event.data) {
      try {
        data = { ...data, ...event.data.json() };
      } catch (e) {
        console.error('Error parsing push data:', e);
      }
    }

    // Build notification options with forced sound and vibration
    const options = {
      body: data.body,
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/favicon.ico',
      requireInteraction: true,
      data: data.data || { url: '/' },
      actions: [
        { action: 'view', title: '확인' },
        { action: 'close', title: '닫기' }
      ],
      vibrate: [200, 100, 200],  // 진동 패턴 강제 주입
      silent: false,             // 무음 모드 해제
      renotify: true,            // 새로운 알림 시 매번 소리/진동 발생
      tag: 'attendance-alert'    // 알림 묶기
    };

    console.log('Showing notification with forced options:', options);

    return self.registration.showNotification(data.title, options);
  };

  event.waitUntil(handlePush());
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already an open window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open a new window if none exist
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
