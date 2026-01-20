import React from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, subscribe, unsubscribe, isAdmin } = usePushNotifications();

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

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
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
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isSubscribed ? '알림 끄기' : '알림 켜기'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
