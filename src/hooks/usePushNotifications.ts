import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePushNotifications = () => {
  const { user, isAdmin } = useAuth();
  const lastCountRef = useRef<number | null>(null);
  const serviceWorkerRef = useRef<ServiceWorkerRegistration | null>(null);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);
      serviceWorkerRef.current = registration;
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.log('Notification permission denied');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  // Show notification using service worker
  const showNotification = useCallback(async (title: string, body: string, data?: object) => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    // Try to use service worker first
    if (serviceWorkerRef.current?.active) {
      serviceWorkerRef.current.active.postMessage({
        type: 'SHOW_NOTIFICATION',
        title,
        body,
        data,
      });
    } else {
      // Fallback to regular notification
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'attendance-request',
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
      } as NotificationOptions);
    }
  }, [requestPermission]);

  // Check for new attendance requests
  const checkForNewRequests = useCallback(async () => {
    if (!isAdmin) return;

    const { count, error } = await supabase
      .from('attendance_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) {
      console.error('Error checking requests:', error);
      return;
    }

    const currentCount = count || 0;

    // If this is not the first check and count increased, show notification
    if (lastCountRef.current !== null && currentCount > lastCountRef.current) {
      const newCount = currentCount - lastCountRef.current;
      showNotification(
        '새로운 근태 수정 요청',
        `${newCount}건의 새로운 근태 수정 요청이 있습니다.`,
        { count: newCount }
      );
    }

    lastCountRef.current = currentCount;
  }, [isAdmin, showNotification]);

  // Initialize notifications for admin
  useEffect(() => {
    if (!user || !isAdmin) return;

    // Register service worker
    registerServiceWorker();

    // Request permission on mount
    requestPermission();

    // Initial check
    checkForNewRequests();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('attendance_requests_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_requests',
        },
        (payload) => {
          console.log('New attendance request:', payload);
          const newRequest = payload.new as { requester_name: string; worker_name: string; requested_status: string };
          showNotification(
            '새로운 근태 수정 요청',
            `${newRequest.requester_name}님이 ${newRequest.worker_name}의 근태 수정을 요청했습니다.`,
            { request: newRequest }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, registerServiceWorker, requestPermission, checkForNewRequests, showNotification]);

  return {
    requestPermission,
    showNotification,
    isSupported: 'Notification' in window && 'serviceWorker' in navigator,
    permission: typeof window !== 'undefined' && 'Notification' in window 
      ? Notification.permission 
      : 'default',
  };
};
