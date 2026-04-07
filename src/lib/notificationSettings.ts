// Notification settings storage using IndexedDB (accessible from Service Worker)

export type NotificationMode = 'all' | 'sound' | 'vibration' | 'silent';

export interface NotificationCategories {
  attendance: boolean;      // 근태 수정 요청/결과
  notice: boolean;          // 공지사항 변경
  weekendAvailability: boolean; // 주말출근 가능 여부 변경
}

export interface NotificationSettings {
  mode: NotificationMode;
  categories: NotificationCategories;
}

const DB_NAME = 'notification-settings-db';
const STORE_NAME = 'settings';
const SETTINGS_KEY = 'notification-settings';

// Default settings
const DEFAULT_SETTINGS: NotificationSettings = {
  mode: 'all',
  categories: {
    attendance: true,
    notice: true,
    weekendAvailability: true,
  },
};

// Open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// Get notification settings
export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(SETTINGS_KEY);
      
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      
      request.onsuccess = () => {
        db.close();
        const result = request.result || DEFAULT_SETTINGS;
        // Migrate old settings without categories
        if (!result.categories) {
          result.categories = DEFAULT_SETTINGS.categories;
        }
        resolve(result);
      };
    });
  } catch (error) {
    console.error('Error getting notification settings:', error);
    return DEFAULT_SETTINGS;
  }
}

// Save notification settings
export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(settings, SETTINGS_KEY);
      
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
      
      request.onsuccess = () => {
        db.close();
        resolve();
      };
    });
  } catch (error) {
    console.error('Error saving notification settings:', error);
    throw error;
  }
}

// Get mode label in Korean
export function getModeLabel(mode: NotificationMode): string {
  switch (mode) {
    case 'all':
      return '소리 + 진동';
    case 'sound':
      return '소리만';
    case 'vibration':
      return '진동만';
    case 'silent':
      return '무음';
    default:
      return '소리 + 진동';
  }
}
