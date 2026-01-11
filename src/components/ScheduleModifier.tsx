import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Send, Loader2, X, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScheduleData } from "@/hooks/useScheduleData";

interface AIResponse {
  understood: boolean;
  action: string;
  description: string;
  changes: {
    swapShifts?: boolean;
    workerMoves?: Array<{
      worker: string;
      fromDept?: string;
      toDept?: string;
      fromShift?: string;
      toShift?: string;
    }>;
    individualChanges?: Array<{
      worker: string;
      type: string;
      value?: string;
    }>;
  };
  message: string;
}

interface ScheduleModifierProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleData: ScheduleData;
  onApplyChanges: (changes: AIResponse["changes"]) => void;
}

const EXAMPLE_COMMANDS = [
  "초반조를 중반조로 스왑",
  "김광시를 설비로 이동",
  "이상민 휴가 처리",
];

const ScheduleModifier: React.FC<ScheduleModifierProps> = ({
  isOpen,
  onClose,
  scheduleData,
  onApplyChanges,
}) => {
  const [command, setCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!command.trim()) {
      toast.error("명령을 입력해주세요");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAiResponse(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ai-schedule-manager", {
        body: {
          command: command.trim(),
          currentSchedule: scheduleData,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        setError(data.error);
        return;
      }

      setAiResponse(data);
    } catch (err) {
      console.error("AI 처리 오류:", err);
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (aiResponse?.changes) {
      onApplyChanges(aiResponse.changes);
      toast.success("근무표가 수정되었습니다");
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setCommand("");
    setAiResponse(null);
    setError(null);
  };

  const handleExampleClick = (example: string) => {
    setCommand(example);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 근무수정
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 예시 명령어 */}
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_COMMANDS.map((example) => (
              <Badge
                key={example}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => handleExampleClick(example)}
              >
                {example}
              </Badge>
            ))}
          </div>

          {/* 명령 입력 */}
          <div className="flex gap-2">
            <Input
              placeholder="자연어로 근무표 수정 명령을 입력하세요..."
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSubmit()}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !command.trim()}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* 로딩 상태 */}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI가 명령을 분석 중입니다...
            </div>
          )}

          {/* 에러 표시 */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* AI 응답 */}
          {aiResponse && (
            <div className="space-y-3">
              <div
                className={`flex items-start gap-2 p-3 rounded-lg border ${
                  aiResponse.understood
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-yellow-500/10 border-yellow-500/30"
                }`}
              >
                {aiResponse.understood ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{aiResponse.description}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {aiResponse.message}
                  </p>
                </div>
              </div>

              {/* 변경사항 요약 */}
              {aiResponse.understood && aiResponse.changes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">변경사항 미리보기:</p>
                  <ul className="text-sm space-y-1">
                    {aiResponse.changes.swapShifts && (
                      <li>• A조(초반)와 B조(중반) 전체 스왑</li>
                    )}
                    {aiResponse.changes.workerMoves?.map((move, i) => (
                      <li key={i}>
                        • {move.worker}: {move.fromShift || move.fromDept} → {move.toShift || move.toDept}
                      </li>
                    ))}
                    {aiResponse.changes.individualChanges?.map((change, i) => (
                      <li key={i}>
                        • {change.worker}: {change.type} {change.value && `(${change.value})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                {aiResponse.understood && (
                  <Button onClick={handleApply} className="flex-1">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    적용하기
                  </Button>
                )}
                <Button variant="outline" onClick={handleReset}>
                  <X className="h-4 w-4 mr-2" />
                  초기화
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleModifier;
