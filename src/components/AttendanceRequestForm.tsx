import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Send, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AttendanceRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerName: string;
  dateKey: string;
  day: string;
  currentStatus: string;
}

const statusOptions = [
  { value: "normal", label: "정상" },
  { value: "overtime", label: "잔업" },
  { value: "partial_overtime", label: "시간잔업" },
  { value: "vacation", label: "휴가" },
  { value: "partial_vacation", label: "시간휴가" },
  { value: "dayoff", label: "휴무" },
];

const AttendanceRequestForm = ({
  open,
  onOpenChange,
  workerName,
  dateKey,
  day,
  currentStatus,
}: AttendanceRequestFormProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [requestedStatus, setRequestedStatus] = useState("");
  const [reason, setReason] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTimeRef = React.useRef<HTMLInputElement>(null);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [isNameMismatch, setIsNameMismatch] = useState(false);

  // Fetch user's display name from profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (data) {
          setUserDisplayName(data.display_name);
        }
      }
    };
    
    if (open) {
      fetchUserProfile();
    }
  }, [user, open]);

  // Check if worker name matches user's display name
  useEffect(() => {
    if (userDisplayName) {
      setIsNameMismatch(workerName !== userDisplayName);
    }
  }, [workerName, userDisplayName]);

  // 공휴일 목록
  const holidays = [
    "2024-12-25", "2025-01-01", "2025-01-28", "2025-01-29", "2025-01-30",
    "2025-03-01", "2025-05-05", "2025-06-06", "2025-08-15",
    "2025-10-03", "2025-10-09", "2025-12-25",
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-03-01", "2026-05-05", "2026-06-06", "2026-08-15",
    "2026-10-03", "2026-10-09", "2026-12-25",
  ];

  const isHolidayOrWeekend = day === "일" || holidays.includes(dateKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Block submission on holidays/weekends
    if (isHolidayOrWeekend) {
      toast({
        title: "휴일엔 카톡 부탁 드립니다",
        description: "주말 및 공휴일에는 근태 수정 요청이 불가합니다",
      });
      return;
    }

    // Block submission if not logged in
    if (!user) {
      toast({
        variant: "destructive",
        title: "요청 불가",
        description: "로그인 후 근태 수정 요청이 가능합니다",
      });
      return;
    }
    
    // Block submission if names don't match
    if (userDisplayName && workerName !== userDisplayName) {
      toast({
        variant: "destructive",
        title: "요청 불가",
        description: "본인의 근태만 수정 요청할 수 있습니다",
      });
      return;
    }
    
    if (!requestedStatus) {
      toast({
        variant: "destructive",
        title: "변경할 상태를 선택하세요",
      });
      return;
    }

    const needsTimeInput = requestedStatus === "partial_vacation" || requestedStatus === "partial_overtime";
    
    if (needsTimeInput) {
      if (!startTime || !endTime) {
        toast({
          variant: "destructive",
          title: requestedStatus === "partial_vacation" ? "시간휴가 시간을 입력하세요" : "시간잔업 시간을 입력하세요",
          description: "시작 시간과 종료 시간을 모두 입력해주세요",
        });
        return;
      }
      if (startTime >= endTime) {
        toast({
          variant: "destructive",
          title: "시간을 확인하세요",
          description: "종료 시간이 시작 시간보다 늦어야 합니다",
        });
        return;
      }
    }

    setIsSubmitting(true);

    const { error } = await supabase.from("attendance_requests").insert({
      requester_name: userDisplayName || workerName,
      worker_name: workerName,
      date_key: dateKey,
      day: day,
      current_status: currentStatus,
      requested_status: requestedStatus,
      reason: reason.trim() || null,
      start_time: needsTimeInput ? startTime : null,
      end_time: needsTimeInput ? endTime : null,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "요청 실패",
        description: "다시 시도해주세요",
      });
    } else {
      toast({
        title: "요청 완료",
        description: "관리자 승인을 기다려주세요",
      });
      
      // Send push notification to admins
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            requesterName: userDisplayName || workerName,
            workerName,
            dateKey,
            requestedStatus,
          },
        });
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError);
      }
      
      onOpenChange(false);
      setRequestedStatus("");
      setReason("");
      setStartTime("");
      setEndTime("");
    }

    setIsSubmitting(false);
  };

  const getStatusLabel = (status: string) => {
    return statusOptions.find((opt) => opt.value === status)?.label || status;
  };

  const handleStatusChange = (value: string) => {
    setRequestedStatus(value);
    if (value !== "partial_vacation" && value !== "partial_overtime") {
      setStartTime("");
      setEndTime("");
    }
    if (value === "partial_vacation" || value === "partial_overtime") {
      setTimeout(() => startTimeRef.current?.focus(), 100);
    }
  };

  // 시간 입력 시 자동 콜론 추가 + 백스페이스 시 콜론 무시
  const handleTimeChange = (value: string, setter: (val: string) => void) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 2) {
      setter(`${digits.slice(0, 2)}:${digits.slice(2, 4)}`);
    } else {
      setter(digits);
    }
  };

  const handleTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentValue: string, setter: (val: string) => void) => {
    if (e.key === "Backspace" && currentValue.includes(":")) {
      e.preventDefault();
      const digits = currentValue.replace(/\D/g, "");
      const newDigits = digits.slice(0, -1);
      if (newDigits.length >= 2) {
        setter(`${newDigits.slice(0, 2)}:${newDigits.slice(2)}`);
      } else {
        setter(newDigits);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" />
            근태 수정 요청
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 비로그인 사용자 경고 */}
          {!user && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                로그인 후 근태 수정 요청이 가능합니다.
              </AlertDescription>
            </Alert>
          )}

          {/* 본인 확인 불일치 경고 */}
          {user && userDisplayName && isNameMismatch && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                본인({userDisplayName})의 근태만 수정 요청할 수 있습니다.
              </AlertDescription>
            </Alert>
          )}

          {/* 휴일 경고 */}
          {isHolidayOrWeekend && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                휴일엔 카톡 부탁 드립니다 📱
              </AlertDescription>
            </Alert>
          )}

          {/* 대상 정보 요약 - 한눈에 보기 */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border text-sm">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground">{workerName}</span>
              <span className="text-muted-foreground">{dateKey} ({day})</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-medium">
              {getStatusLabel(currentStatus)}
            </span>
          </div>
          
          {/* 변경 상태 버튼 */}
          <div className="space-y-1.5">
            <Label className="text-xs">변경 상태</Label>
            <div className="flex flex-wrap gap-2">
              {statusOptions
                .filter((opt) => opt.value !== currentStatus)
                .map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={requestedStatus === opt.value ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-3"
                    onClick={() => handleStatusChange(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
            </div>
          </div>

          {/* 시간휴가/시간잔업 시간 선택 */}
          {(requestedStatus === "partial_vacation" || requestedStatus === "partial_overtime") && (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
              <Input
                ref={startTimeRef}
                type="text"
                inputMode="numeric"
                placeholder="14:00"
                value={startTime}
                onChange={(e) => handleTimeChange(e.target.value, setStartTime)}
                onKeyDown={(e) => handleTimeKeyDown(e, startTime, setStartTime)}
                className="h-8 text-sm text-center w-20"
                maxLength={5}
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="18:00"
                value={endTime}
                onChange={(e) => handleTimeChange(e.target.value, setEndTime)}
                onKeyDown={(e) => handleTimeKeyDown(e, endTime, setEndTime)}
                className="h-8 text-sm text-center w-20"
                maxLength={5}
              />
            </div>
          )}
          
          {/* 사유 입력 */}
          <div className="space-y-1">
            <Label htmlFor="reason" className="text-xs">사유 (선택)</Label>
            <Textarea
              id="reason"
              placeholder="수정 사유"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button 
              type="submit" 
              size="sm" 
              disabled={isSubmitting || !user || (userDisplayName !== null && isNameMismatch) || isHolidayOrWeekend}
            >
              {isSubmitting ? "요청 중..." : "요청"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceRequestForm;
