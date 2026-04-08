// Service Worker for Push Notifications

// IndexedDB helper for reading notification settings
const DB_NAME = 'notification-settings-db';
const STORE_NAME = 'settings';
const SETTINGS_KEY = 'notification-settings';

async function getNotificationSettings() {
  try {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 2);
      
      request.onerror = () => {
        console.log('IndexedDB open error, using defaults');
        resolve({ mode: 'all', categories: { attendance: true, notice: true, weekendAvailability: true } });
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
            resolve({ mode: 'all', categories: { attendance: true, notice: true, weekendAvailability: true } });
          };
          
          getRequest.onsuccess = () => {
            db.close();
            const result = getRequest.result || { mode: 'all' };
            if (!result.categories) {
              result.categories = { attendance: true, notice: true, weekendAvailability: true };
            }
            resolve(result);
          };
        } catch (e) {
          db.close();
          resolve({ mode: 'all', categories: { attendance: true, notice: true, weekendAvailability: true } });
        }
      };
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return { mode: 'all', categories: { attendance: true, notice: true, weekendAvailability: true } };
  }
}

const CACHE_VERSION = 'v1';

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  const handlePush = async () => {
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
        const jsonData = event.data.json();
        data = { ...data, ...jsonData };
      } catch (e) {
        console.log('Push data is not JSON, using as text');
        try {
          const textData = event.data.text();
          if (textData) {
            data.body = textData;
          }
        } catch (textError) {
          console.error('Error reading push data as text:', textError);
        }
      }
    }

    // Check category filter
    const notifType = data.data?.type;
    const categories = settings.categories || {};
    
    if (notifType === 'attendance_request' || notifType === 'request_result') {
      if (categories.attendance === false) {
        console.log('Attendance notification blocked by user settings');
        return;
      }
    } else if (notifType === 'notice_update') {
      if (categories.notice === false) {
        console.log('Notice notification blocked by user settings');
        return;
      }
    } else if (notifType === 'weekend_availability') {
      if (categories.weekendAvailability === false) {
        console.log('Weekend availability notification blocked by user settings');
        return;
      }
    } else if (notifType === 'admin_status_change') {
      if (categories.adminStatusChange === false) {
        console.log('Admin status change notification blocked by user settings');
        return;
      }
    }

    // Build notification options
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
      vibrate: [200, 100, 200],
      silent: false,
      renotify: true,
      tag: 'attendance-alert'
    };

    console.log('Showing notification with options:', options);
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
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
