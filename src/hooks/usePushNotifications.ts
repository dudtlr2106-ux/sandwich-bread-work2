import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = '000000';

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
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      // Register service worker
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered:', reg);
          setRegistration(reg);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Check subscription status when user logs in
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user || !isAdmin || !registration) {
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
  }, [user, isAdmin, registration]);

  const subscribe = useCallback(async () => {
    if (!user || !isAdmin || !registration) {
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
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          variant: 'destructive',
          title: '알림 권한 거부',
          description: '브라우저에서 알림 권한을 허용해주세요.',
        });
        return false;
      }

      // Subscribe to push notifications
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
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

      // Convert keys to base64
      const p256dhBase64 = btoa(String.fromCharCode(...new Uint8Array(p256dh)));
      const authBase64 = btoa(String.fromCharCode(...new Uint8Array(auth)));

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
        description: '알림 구독 중 오류가 발생했습니다.',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isAdmin, registration, toast]);

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
  };
}
