import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = 'BDPMP8DMFBU2R2IResmQfPSHnnZjfBnE_4AOIAJnB_rY9CL0N33ejX3YZ62OWsjuPheg_f9p2LNkEZwBK3mS7vo';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<any>(null);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);
  const lastPermissionCheck = useRef<number>(0);

  // Force request permission - always tries to show the browser popup
  const forceRequestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!('Notification' in window)) {
      return 'denied';
    }

    try {
      // Always request permission - this will show popup if not already decided
      // or return cached value if already decided
      const result = await Notification.requestPermission();
      console.log('Permission request result:', result);
      setPermissionStatus(result);
      return result;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return 'denied';
    }
  }, []);

  // Check and update permission status (non-blocking)
  const checkPermissionStatus = useCallback(() => {
    if ('Notification' in window) {
      const status = Notification.permission;
      const now = Date.now();
      
      // Only log if status changed or enough time passed
      if (status !== permissionStatus || now - lastPermissionCheck.current > 5000) {
        console.log('Notification permission status:', status);
        lastPermissionCheck.current = now;
      }
      
      setPermissionStatus(status);
      return status;
    }
    return null;
  }, [permissionStatus]);

  // Force update service worker and re-register
  const forceUpdateServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return null;

    try {
      // Unregister all existing service workers
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
        console.log('Service Worker unregistered:', reg.scope);
      }

      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('All caches cleared');
      }

      // Wait a bit before re-registering
      await new Promise(resolve => setTimeout(resolve, 500));

      // Re-register service worker with cache-busting
      const newReg = await navigator.serviceWorker.register('/sw.js?v=' + Date.now(), {
        updateViaCache: 'none'
      });
      
      console.log('Service Worker re-registered:', newReg);
      setRegistration(newReg);
      
      return newReg;
    } catch (error) {
      console.error('Service Worker force update failed:', error);
      return null;
    }
  }, []);

  // Reset all data including localStorage and cache, then re-request permission
  const resetAllData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // 1. Unsubscribe from push if subscribed
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          console.log('Push subscription unsubscribed');
        }
      }

      // 2. Remove subscription from database
      if (user) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id);
        console.log('Database subscription removed');
      }

      // 3. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
        console.log('All service workers unregistered');
      }

      // 4. Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('All caches cleared');
      }

      // 5. Clear ALL localStorage (complete reset)
      localStorage.clear();
      console.log('LocalStorage completely cleared');

      // 6. Clear sessionStorage too
      sessionStorage.clear();
      console.log('SessionStorage cleared');

      // 7. Reset states
      setIsSubscribed(false);
      setRegistration(null);
      setPermissionStatus(null);

      // 8. Force request permission again - this may show the popup
      const newPermission = await forceRequestPermission();
      console.log('New permission after reset:', newPermission);

      // 9. Re-register service worker after a delay
      await new Promise(resolve => setTimeout(resolve, 500));
      const newReg = await forceUpdateServiceWorker();

      // 10. If permission is granted, try to subscribe immediately
      if (newPermission === 'granted' && newReg && user && isAdmin) {
        toast({
          title: '초기화 완료',
          description: '권한이 허용되었습니다. 알림을 구독합니다...',
        });
        
        // Auto-subscribe after reset if permission granted
        await new Promise(resolve => setTimeout(resolve, 500));
        return true; // Signal to retry subscription
      }

      toast({
        title: '초기화 완료',
        description: newPermission === 'granted' 
          ? '권한이 허용되었습니다. 알림 켜기를 눌러주세요.'
          : '페이지를 새로고침하고 다시 시도해주세요.',
      });

      return newPermission === 'granted';
    } catch (error) {
      console.error('Error resetting data:', error);
      toast({
        variant: 'destructive',
        title: '초기화 실패',
        description: '데이터 초기화 중 오류가 발생했습니다.',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registration, user, isAdmin, forceUpdateServiceWorker, forceRequestPermission, toast]);

  // Auto-sync subscription status when permission becomes granted
  const syncSubscriptionStatus = useCallback(async () => {
    if (!user || !isAdmin || !registration) return;

    const currentPermission = checkPermissionStatus();
    
    if (currentPermission === 'granted') {
      try {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Verify subscription exists in database
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint)
            .maybeSingle();
          
          if (data) {
            setIsSubscribed(true);
            console.log('Subscription synced: already subscribed');
          }
        }
      } catch (error) {
        console.error('Error syncing subscription:', error);
      }
    }
  }, [user, isAdmin, registration, checkPermissionStatus]);

  // Check if push notifications are supported and register service worker
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    // Initial permission check
    const initialStatus = checkPermissionStatus();
    console.log('Initial permission status:', initialStatus);
    
    if (supported) {
      // Register service worker with cache-busting to ensure fresh version
      navigator.serviceWorker.register('/sw.js?v=' + Date.now(), {
        updateViaCache: 'none'
      })
        .then((reg) => {
          console.log('Service Worker registered:', reg);
          setRegistration(reg);
          
          // Force update check
          reg.update().catch(console.error);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Re-check permission status on visibility change and sync subscription
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const newStatus = checkPermissionStatus();
        // If permission changed to granted, sync subscription
        if (newStatus === 'granted') {
          syncSubscriptionStatus();
        }
      }
    };

    // Check on focus as well (mobile browsers may update permission on focus)
    const handleFocus = () => {
      const newStatus = checkPermissionStatus();
      if (newStatus === 'granted') {
        syncSubscriptionStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    // Also check every 3 seconds when visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        const newStatus = checkPermissionStatus();
        if (newStatus === 'granted' && !isSubscribed) {
          syncSubscriptionStatus();
        }
      }
    }, 3000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [checkPermissionStatus, syncSubscriptionStatus, isSubscribed]);

  // Check subscription status when user logs in or registration changes
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user || !isAdmin || !registration) {
        setIsSubscribed(false);
        return;
      }

      // First check permission
      const currentPermission = checkPermissionStatus();
      
      if (currentPermission !== 'granted') {
        setIsSubscribed(false);
        return;
      }

      try {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          // Verify subscription exists in database
          const { data } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint)
            .maybeSingle();
          
          setIsSubscribed(!!data);
        } else {
          setIsSubscribed(false);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [user, isAdmin, registration, checkPermissionStatus]);

  const subscribe = useCallback(async () => {
    if (!user || !isAdmin) {
      toast({
        variant: 'destructive',
        title: '알림 구독 불가',
        description: '관리자로 로그인해야 알림을 받을 수 있습니다.',
      });
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error('VAPID public key not configured');
      toast({
        variant: 'destructive',
        title: '설정 오류',
        description: 'VAPID 키가 설정되지 않았습니다.',
      });
      return false;
    }

    setIsLoading(true);

    try {
      // ALWAYS force request permission first - this will show popup if possible
      const permission = await forceRequestPermission();
      console.log('Permission after force request:', permission);

      if (permission !== 'granted') {
        if (permission === 'denied') {
          toast({
            variant: 'destructive',
            title: '알림 권한 차단됨',
            description: '브라우저/휴대폰 설정에서 이 사이트의 알림 권한을 허용으로 변경한 후, 데이터 삭제 및 초기화를 눌러주세요.',
          });
        } else {
          toast({
            variant: 'destructive',
            title: '알림 권한 필요',
            description: '알림을 받으려면 권한을 허용해주세요.',
          });
        }
        return false;
      }

      // Ensure we have a fresh service worker registration
      let currentReg = registration;
      if (!currentReg) {
        currentReg = await forceUpdateServiceWorker();
        if (!currentReg) {
          toast({
            variant: 'destructive',
            title: '서비스 워커 오류',
            description: '서비스 워커 등록에 실패했습니다. 페이지를 새로고침해주세요.',
          });
          return false;
        }
      }

      // Subscribe to push notifications
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await currentReg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      console.log('Push subscription created:', subscription);

      // Get subscription keys
      const p256dh = subscription.getKey('p256dh');
      const auth = subscription.getKey('auth');

      if (!p256dh || !auth) {
        throw new Error('Failed to get subscription keys');
      }

      // Convert keys to base64url (required for Web Push protocol)
      const arrayBufferToBase64Url = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      };

      const p256dhBase64 = arrayBufferToBase64Url(p256dh);
      const authBase64 = arrayBufferToBase64Url(auth);
      
      console.log('Subscription keys converted to base64url:', { 
        endpoint: subscription.endpoint,
        p256dhLength: p256dhBase64.length,
        authLength: authBase64.length 
      });

      // Save subscription to database
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: p256dhBase64,
        auth: authBase64,
      }, {
        onConflict: 'user_id,endpoint'
      });

      if (error) {
        throw error;
      }

      setIsSubscribed(true);
      toast({
        title: '알림 구독 완료',
        description: '근태 수정 요청 알림을 받으실 수 있습니다.',
      });

      return true;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast({
        variant: 'destructive',
        title: '구독 실패',
        description: '알림 구독 중 오류가 발생했습니다. 초기화 후 다시 시도해주세요.',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, registration, toast, forceRequestPermission, forceUpdateServiceWorker]);

  const unsubscribe = useCallback(async () => {
    if (!user || !registration) return false;

    setIsLoading(true);

    try {
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from push
        await subscription.unsubscribe();

        // Remove from database
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      toast({
        title: '알림 구독 해제',
        description: '더 이상 알림을 받지 않습니다.',
      });

      return true;
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      toast({
        variant: 'destructive',
        title: '구독 해제 실패',
        description: '알림 구독 해제 중 오류가 발생했습니다.',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, registration, toast]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    isAdmin,
    permissionStatus,
    forceUpdateServiceWorker,
    resetAllData,
    checkPermissionStatus,
    forceRequestPermission,
  };
}
