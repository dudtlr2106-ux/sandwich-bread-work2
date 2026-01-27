import React from 'react';
import { Bell, BellOff, Loader2, RefreshCw, Trash2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';
import { Separator } from '@/components/ui/separator';

export function PushNotificationToggle() {
  const { 
    isSupported, 
    isSubscribed, 
    isLoading, 
    subscribe, 
    unsubscribe, 
    isAdmin,
    permissionStatus,
    forceUpdateServiceWorker,
    resetAllData,
    forceRequestPermission,
  } = usePushNotifications();

  // Only show for admins
  if (!isAdmin) {
    return null;
  }

  // Don't show if push notifications are not supported
  if (!isSupported) {
    return null;
  }

  const handleClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleForceUpdate = async () => {
    // First request permission again
    await forceRequestPermission();
    await forceUpdateServiceWorker();
    // Retry subscription after force update
    await subscribe();
  };

  const handleReset = async () => {
    const success = await resetAllData();
    // If permission was granted after reset, try to subscribe automatically
    if (success) {
      await subscribe();
    } else {
      // Reload page after reset if not auto-subscribed
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return '✅ 권한 허용됨';
      case 'denied':
        return '❌ 권한 차단됨';
      case 'default':
        return '⏳ 권한 미설정';
      default:
        return '❓ 상태 확인 중';
    }
  };

  const getPermissionStatusColor = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'text-green-600';
      case 'denied':
        return 'text-red-600';
      default:
        return 'text-yellow-600';
    }
  };

  return (
    <TooltipProvider>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isLoading}
                className="relative"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isSubscribed ? (
                  <Bell className="h-5 w-5 text-primary" />
                ) : (
                  <BellOff className="h-5 w-5 text-muted-foreground" />
                )}
                {isSubscribed && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
                )}
                {permissionStatus === 'denied' && !isSubscribed && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {isSubscribed ? '알림 설정' : '알림 켜기'}
          </TooltipContent>
        </Tooltip>

        <PopoverContent className="w-80 p-4" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                푸시 알림 설정
              </h4>
              <div className={`text-xs ${getPermissionStatusColor()}`}>
                권한 상태: {getPermissionStatusText()}
              </div>
              <div className="text-xs text-muted-foreground">
                구독 상태: {isSubscribed ? '✅ 구독 중' : '❌ 미구독'}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant={isSubscribed ? "outline" : "default"}
                size="sm"
                className="w-full justify-start"
                onClick={handleClick}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isSubscribed ? (
                  <BellOff className="h-4 w-4 mr-2" />
                ) : (
                  <Bell className="h-4 w-4 mr-2" />
                )}
                {isSubscribed ? '알림 끄기' : '알림 켜기'}
              </Button>

              {permissionStatus === 'denied' && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                  ⚠️ 브라우저에서 알림이 차단되어 있습니다.
                  <br />
                  브라우저 설정에서 이 사이트의 알림을 허용해주세요.
                </div>
              )}
            </div>

            {/* 알림 방식 설정 - 구독 중일 때만 표시 */}
            {isSubscribed && (
              <>
                <Separator />
                <NotificationSettingsPanel />
              </>
            )}

            <Separator />
            
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                문제가 있으신가요?
              </p>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleForceUpdate}
                disabled={isLoading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                서비스 워커 새로고침
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start"
                onClick={handleReset}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                데이터 삭제 및 초기화
              </Button>

              <p className="text-xs text-muted-foreground">
                초기화 후 페이지가 자동으로 새로고침됩니다.
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
