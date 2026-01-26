import { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export function TestPushButton() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  if (!isAdmin) return null;

  const handleTestPush = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          requesterName: '테스트',
          workerName: '테스트 작업자',
          dateKey: new Date().toISOString().split('T')[0],
          requestedStatus: 'normal',
        },
      });

      if (error) throw error;

      if (data?.sent > 0) {
        toast({
          title: '테스트 푸시 발송 완료',
          description: `${data.sent}개의 기기로 알림을 발송했습니다.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: '발송 대상 없음',
          description: '등록된 푸시 구독이 없습니다. 먼저 알림을 켜주세요.',
        });
      }
    } catch (error) {
      console.error('Test push failed:', error);
      toast({
        variant: 'destructive',
        title: '테스트 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleTestPush}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      테스트 푸시 발송
    </Button>
  );
}
