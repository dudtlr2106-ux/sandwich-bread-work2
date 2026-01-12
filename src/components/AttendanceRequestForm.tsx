import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Clock } from "lucide-react";

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
  const [requesterName, setRequesterName] = useState("");
  const [requestedStatus, setRequestedStatus] = useState("");
  const [reason, setReason] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            근태 수정 요청
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>대상 근무자</Label>
            <Input value={workerName} disabled />
          </div>
          
          <div className="space-y-2">
            <Label>날짜</Label>
            <Input value={`${dateKey} (${day})`} disabled />
          </div>
          
          <div className="space-y-2">
            <Label>현재 상태</Label>
            <Input value={getStatusLabel(currentStatus)} disabled />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="requester">요청자 이름</Label>
            <Input
              id="requester"
              placeholder="이름을 입력하세요"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">변경할 상태</Label>
            <Select value={requestedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="상태 선택" />
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

          {requestedStatus === "partial_vacation" && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                시간휴가 시간 설정
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="startTime">시작 시간</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">종료 시간</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="reason">사유 (선택)</Label>
            <Textarea
              id="reason"
              placeholder="수정 사유를 입력하세요"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "요청 중..." : "요청하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AttendanceRequestForm;
