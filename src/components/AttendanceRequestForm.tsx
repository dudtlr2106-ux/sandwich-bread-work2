import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Clock, AlertCircle } from "lucide-react";
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
  const [requesterName, setRequesterName] = useState("");
  const [requestedStatus, setRequestedStatus] = useState("");
  const [reason, setReason] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
          setRequesterName(data.display_name);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Block submission if names don't match
    if (userDisplayName && workerName !== userDisplayName) {
      toast({
        variant: "destructive",
        title: "요청 불가",
        description: "본인의 근태만 수정 요청할 수 있습니다",
      });
      return;
    }
    
    if (!requesterName.trim()) {
      toast({
        variant: "destructive",
        title: "요청자 이름을 입력하세요",
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

    if (requestedStatus === "partial_vacation") {
      if (!startTime || !endTime) {
        toast({
          variant: "destructive",
          title: "시간휴가 시간을 입력하세요",
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
      requester_name: requesterName.trim(),
      worker_name: workerName,
      date_key: dateKey,
      day: day,
      current_status: currentStatus,
      requested_status: requestedStatus,
      reason: reason.trim() || null,
      start_time: requestedStatus === "partial_vacation" ? startTime : null,
      end_time: requestedStatus === "partial_vacation" ? endTime : null,
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
      onOpenChange(false);
      setRequesterName("");
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
    if (value !== "partial_vacation") {
      setStartTime("");
      setEndTime("");
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
          {/* 본인 확인 불일치 경고 */}
          {userDisplayName && isNameMismatch && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                본인({userDisplayName})의 근태만 수정 요청할 수 있습니다.
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
          
          {/* 요청자 + 변경상태 한 줄 */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="requester" className="text-xs">요청자</Label>
              <Input
                id="requester"
                placeholder="이름"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status" className="text-xs">변경 상태</Label>
              <Select value={requestedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions
                    .filter((opt) => opt.value !== currentStatus)
                    .map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 시간휴가 시간 선택 */}
          {requestedStatus === "partial_vacation" && (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-8 text-sm"
              />
              <span className="text-muted-foreground">~</span>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-8 text-sm"
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
              disabled={isSubmitting || (userDisplayName !== null && isNameMismatch)}
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
