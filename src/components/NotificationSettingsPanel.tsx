import { useState, useEffect } from 'react';
import { Volume2, Vibrate, VolumeX, Bell, FileText, Calendar } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  getNotificationSettings, 
  saveNotificationSettings, 
  type NotificationMode,
  type NotificationSettings,
} from '@/lib/notificationSettings';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettingsPanelProps {
  onSettingsChange?: (mode: NotificationMode) => void;
}

export function NotificationSettingsPanel({ onSettingsChange }: NotificationSettingsPanelProps) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>({
    mode: 'all',
    categories: { attendance: true, notice: true, weekendAvailability: true, adminStatusChange: true },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const s = await getNotificationSettings();
        setSettings(s);
      } catch (error) {
        console.error('Error loading notification settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const save = async (newSettings: NotificationSettings) => {
    setSettings(newSettings);
    try {
      await saveNotificationSettings(newSettings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast({
        variant: 'destructive',
        title: '설정 저장 실패',
        description: '알림 설정을 저장하는 중 오류가 발생했습니다.',
      });
    }
  };

  const handleModeChange = async (newMode: NotificationMode) => {
    const newSettings = { ...settings, mode: newMode };
    await save(newSettings);
    onSettingsChange?.(newMode);
    toast({
      title: '알림 설정 저장됨',
      description: getModeDescription(newMode),
    });
  };

  const handleCategoryToggle = async (key: keyof typeof settings.categories) => {
    const newCategories = { ...settings.categories, [key]: !settings.categories[key] };
    const newSettings = { ...settings, categories: newCategories };
    await save(newSettings);
    toast({
      title: '알림 설정 저장됨',
      description: `${getCategoryLabel(key)} 알림이 ${newCategories[key] ? '켜' : '꺼'}졌습니다.`,
    });
  };

  const getModeDescription = (mode: NotificationMode): string => {
    switch (mode) {
      case 'all': return '소리와 진동으로 알려드립니다.';
      case 'sound': return '소리로만 알려드립니다.';
      case 'vibration': return '진동으로만 알려드립니다.';
      case 'silent': return '무음으로 알림이 표시됩니다.';
      default: return '';
    }
  };

  const getCategoryLabel = (key: string): string => {
    switch (key) {
      case 'attendance': return '근무 변경';
      case 'notice': return '공지사항';
      case 'weekendAvailability': return '주말출근';
      default: return '';
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
      {/* 알림 카테고리 */}
      <Label className="text-sm font-medium">알림 종류</Label>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-medium">근무 변경 알림</div>
              <div className="text-xs text-muted-foreground">근태 수정 요청/승인/반려</div>
            </div>
          </div>
          <Switch
            checked={settings.categories.attendance}
            onCheckedChange={() => handleCategoryToggle('attendance')}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-medium">공지사항 알림</div>
              <div className="text-xs text-muted-foreground">공지사항 수정 시 알림</div>
            </div>
          </div>
          <Switch
            checked={settings.categories.notice}
            onCheckedChange={() => handleCategoryToggle('notice')}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-medium">주말출근 알림</div>
              <div className="text-xs text-muted-foreground">주말출근 가능 여부 변경</div>
            </div>
          </div>
          <Switch
            checked={settings.categories.weekendAvailability}
            onCheckedChange={() => handleCategoryToggle('weekendAvailability')}
          />
        </div>
      </div>

      <Separator />

      {/* 알림 방식 */}
      <Label className="text-sm font-medium">알림 방식</Label>
      <RadioGroup
        value={settings.mode}
        onValueChange={(value) => handleModeChange(value as NotificationMode)}
        className="space-y-2"
      >
        <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="all" id="mode-all" />
          <Label htmlFor="mode-all" className="flex items-center gap-2 cursor-pointer flex-1">
            <Bell className="h-4 w-4 text-primary" />
            <div>
              <div className="font-medium">소리 + 진동</div>
              <div className="text-xs text-muted-foreground">소리와 진동 모두 사용</div>
            </div>
          </Label>
        </div>

        <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="sound" id="mode-sound" />
          <Label htmlFor="mode-sound" className="flex items-center gap-2 cursor-pointer flex-1">
            <Volume2 className="h-4 w-4 text-primary" />
            <div>
              <div className="font-medium">소리만</div>
              <div className="text-xs text-muted-foreground">진동 없이 소리로만 알림</div>
            </div>
          </Label>
        </div>

        <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="vibration" id="mode-vibration" />
          <Label htmlFor="mode-vibration" className="flex items-center gap-2 cursor-pointer flex-1">
            <Vibrate className="h-4 w-4 text-primary" />
            <div>
              <div className="font-medium">진동만</div>
              <div className="text-xs text-muted-foreground">소리 없이 진동으로만 알림</div>
            </div>
          </Label>
        </div>

        <div className="flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors">
          <RadioGroupItem value="silent" id="mode-silent" />
          <Label htmlFor="mode-silent" className="flex items-center gap-2 cursor-pointer flex-1">
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
