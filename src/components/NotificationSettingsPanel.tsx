import { useState, useEffect } from 'react';
import { Volume2, Vibrate, VolumeX, Bell } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  getNotificationSettings, 
  saveNotificationSettings, 
  type NotificationMode 
} from '@/lib/notificationSettings';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettingsPanelProps {
  onSettingsChange?: (mode: NotificationMode) => void;
}

export function NotificationSettingsPanel({ onSettingsChange }: NotificationSettingsPanelProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<NotificationMode>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getNotificationSettings();
        setMode(settings.mode);
      } catch (error) {
        console.error('Error loading notification settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleModeChange = async (newMode: NotificationMode) => {
    setMode(newMode);
    
    try {
      await saveNotificationSettings({ mode: newMode });
      onSettingsChange?.(newMode);
      
      toast({
        title: '알림 설정 저장됨',
        description: getModeDescription(newMode),
      });
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        variant: 'destructive',
        title: '설정 저장 실패',
        description: '알림 설정을 저장하는 중 오류가 발생했습니다.',
      });
    }
  };

  const getModeDescription = (mode: NotificationMode): string => {
    switch (mode) {
      case 'all':
        return '소리와 진동으로 알려드립니다.';
      case 'sound':
        return '소리로만 알려드립니다.';
      case 'vibration':
        return '진동으로만 알려드립니다.';
      case 'silent':
        return '무음으로 알림이 표시됩니다.';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="py-2 text-sm text-muted-foreground">
        설정 로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">알림 방식</Label>
      <RadioGroup
        value={mode}
        onValueChange={(value) => handleModeChange(value as NotificationMode)}
        className="space-y-2"
      >
        <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="all" id="mode-all" />
          <Label 
            htmlFor="mode-all" 
            className="flex items-center gap-2 cursor-pointer flex-1"
          >
            <Bell className="h-4 w-4 text-primary" />
            <div>
              <div className="font-medium">소리 + 진동</div>
              <div className="text-xs text-muted-foreground">소리와 진동 모두 사용</div>
            </div>
          </Label>
        </div>

        <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="sound" id="mode-sound" />
          <Label 
            htmlFor="mode-sound" 
            className="flex items-center gap-2 cursor-pointer flex-1"
          >
            <Volume2 className="h-4 w-4 text-primary" />
            <div>
              <div className="font-medium">소리만</div>
              <div className="text-xs text-muted-foreground">진동 없이 소리로만 알림</div>
            </div>
          </Label>
        </div>

        <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="vibration" id="mode-vibration" />
          <Label 
            htmlFor="mode-vibration" 
            className="flex items-center gap-2 cursor-pointer flex-1"
          >
            <Vibrate className="h-4 w-4 text-primary" />
            <div>
              <div className="font-medium">진동만</div>
              <div className="text-xs text-muted-foreground">소리 없이 진동으로만 알림</div>
            </div>
          </Label>
        </div>

        <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="silent" id="mode-silent" />
          <Label 
            htmlFor="mode-silent" 
            className="flex items-center gap-2 cursor-pointer flex-1"
          >
            <VolumeX className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">무음</div>
              <div className="text-xs text-muted-foreground">알림만 표시 (소리/진동 없음)</div>
            </div>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
