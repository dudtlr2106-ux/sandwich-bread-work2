import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, CheckCircle, XCircle, ArrowRightLeft, User, Clock, History } from "lucide-react";
import { toast } from "sonner";
import { ScheduleData } from "@/hooks/useScheduleData";
import { usePatternRules, PatternRule } from "@/hooks/usePatternRules";

interface AIPatternManagerProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleData: ScheduleData;
  onApplyChanges: (changes: AIScheduleChanges, command: string, action: string, description: string) => void;
  onOpenHistory: () => void;
}

interface AIScheduleChanges {
  swapShifts?: boolean;
  workerMoves?: {
    worker: string;
    fromDept?: string;
    toDept?: string;
    fromShift?: "A" | "B";
    toShift?: "A" | "B";
  }[];
  individualChanges?: {
    worker: string;
    type: "early_leave" | "late_start" | "vacation" | "overtime";
    value?: string;
  }[];
}

interface AIResponse {
  understood: boolean;
  action: string;
  description: string;
  changes: AIScheduleChanges;
  message: string;
}

const AIPatternManager: React.FC<AIPatternManagerProps> = ({
  isOpen,
  onClose,
  scheduleData,
  onApplyChanges,
  onOpenHistory,
}) => {
  const { addPatternRule } = usePatternRules();
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!command.trim()) {
      toast.error("명령을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-schedule-manager`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          command,
          currentSchedule: scheduleData,
        }),
      });

      if (!resp.ok) {
        const errorData = await resp.json();
        if (resp.status === 429) {
          throw new Error("요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.");
        }
        if (resp.status === 402) {
          throw new Error("크레딧이 부족합니다.");
        }
        throw new Error(errorData.error || "AI 처리 중 오류가 발생했습니다.");
      }

      const data: AIResponse = await resp.json();
      setResponse(data);

      if (!data.understood) {
        setError(data.message || "명령을 이해하지 못했습니다.");
      }
    } catch (err) {
      console.error("AI Pattern Manager error:", err);
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (response?.changes) {
      // 현재 스케줄 상태를 저장 (롤백용)
      const previousState = JSON.parse(JSON.stringify(scheduleData));
      
      // 패턴 규칙을 DB에 저장
      await addPatternRule(
        command,
        response.action,
        response.description,
        response.changes,
        previousState
      );
      
      // 변경 적용
      onApplyChanges(response.changes, command, response.action, response.description);
      toast.success("근무표가 업데이트되었습니다.");
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setCommand("");
    setResponse(null);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "swap_shifts":
        return <ArrowRightLeft className="h-5 w-5" />;
      case "individual_change":
        return <User className="h-5 w-5" />;
      case "move_worker":
        return <ArrowRightLeft className="h-5 w-5" />;
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "swap_shifts":
        return "조 스왑";
      case "rotate_next_week":
        return "로테이션";
      case "individual_change":
        return "개별 변경";
      case "move_worker":
        return "인원 이동";
      default:
        return "알 수 없음";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            AI 패턴 매니저
          </DialogTitle>
          <DialogDescription>
            자연어로 근무표 변경을 명령하세요. AI가 명령을 분석하여 적용합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 예시 명령어 */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              onClick={() => setCommand("이번 주 초반조 인원을 중반조로 변경해줘")}
            >
              초반↔중반 스왑
            </Badge>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              onClick={() => setCommand("김광시를 설비로 이동해줘")}
            >
              인원 이동
            </Badge>
            <Badge
              variant="outline"
              className="cursor-pointer hover:bg-muted"
              onClick={() => setCommand("이상민 휴가 처리해줘")}
            >
              휴가 처리
            </Badge>
          </div>

          {/* 명령 입력 */}
          <div className="flex gap-2">
            <Input
              placeholder="예: '이번 주 초반조를 중반조로 로테이션해줘'"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={handleSubmit} disabled={isLoading || !command.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* 로딩 상태 */}
          {isLoading && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">
                    AI가 명령을 분석하고 있습니다...
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 에러 표시 */}
          {error && (
            <Card className="border-destructive/50 bg-destructive/10">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">처리 실패</p>
                    <p className="text-sm text-muted-foreground mt-1">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI 응답 표시 */}
          {response && response.understood && (
            <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                    {getActionIcon(response.action)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{getActionLabel(response.action)}</Badge>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <p className="text-sm font-medium">{response.description}</p>
                    <p className="text-sm text-muted-foreground mt-1">{response.message}</p>

                    {/* 변경 사항 상세 */}
                    {response.changes.swapShifts && (
                      <div className="mt-3 p-2 rounded bg-muted/50">
                        <p className="text-xs text-muted-foreground">
                          <ArrowRightLeft className="h-3 w-3 inline mr-1" />
                          초반조(A)와 중반조(B) 전체 스왑
                        </p>
                      </div>
                    )}

                    {response.changes.workerMoves && response.changes.workerMoves.length > 0 && (
                      <div className="mt-3 p-2 rounded bg-muted/50">
                        <p className="text-xs font-medium mb-1">인원 이동:</p>
                        {response.changes.workerMoves.map((move, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground">
                            • {move.worker}: {move.fromDept || move.fromShift} → {move.toDept || move.toShift}
                          </p>
                        ))}
                      </div>
                    )}

                    {response.changes.individualChanges && response.changes.individualChanges.length > 0 && (
                      <div className="mt-3 p-2 rounded bg-muted/50">
                        <p className="text-xs font-medium mb-1">개별 변경:</p>
                        {response.changes.individualChanges.map((change, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground">
                            • {change.worker}: {change.type === "vacation" ? "휴가" : change.type === "overtime" ? "잔업" : change.type === "early_leave" ? "조퇴" : "지각"} {change.value || ""}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onOpenHistory} disabled={isLoading}>
            <History className="h-4 w-4 mr-2" />
            히스토리
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={isLoading}>
            초기화
          </Button>
          {response && response.understood && (
            <Button onClick={handleApply}>
              <CheckCircle className="h-4 w-4 mr-2" />
              변경 적용
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AIPatternManager;
