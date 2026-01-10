import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  Edit2,
  Trash2,
  RotateCcw,
  ArrowRightLeft,
  User,
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { PatternRule, usePatternRules } from "@/hooks/usePatternRules";
import { ScheduleData } from "@/hooks/useScheduleData";

interface PatternHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSchedule: (previousState: ScheduleData) => void;
  onReapplyChanges: (changes: PatternRule['changes']) => void;
}

const PatternHistory: React.FC<PatternHistoryProps> = ({
  isOpen,
  onClose,
  onRestoreSchedule,
  onReapplyChanges,
}) => {
  const {
    patternRules,
    isLoading,
    deactivatePatternRule,
    reactivatePatternRule,
    deletePatternRule,
    updatePatternRule,
  } = usePatternRules();

  const [editingRule, setEditingRule] = useState<PatternRule | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [deleteConfirmRule, setDeleteConfirmRule] = useState<PatternRule | null>(null);
  const [undoConfirmRule, setUndoConfirmRule] = useState<PatternRule | null>(null);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "swap_shifts":
        return <ArrowRightLeft className="h-4 w-4" />;
      case "individual_change":
        return <User className="h-4 w-4" />;
      case "move_worker":
        return <ArrowRightLeft className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
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
        return "기타";
    }
  };

  const handleEdit = (rule: PatternRule) => {
    setEditingRule(rule);
    setEditDescription(rule.description);
  };

  const handleSaveEdit = async () => {
    if (editingRule) {
      await updatePatternRule(editingRule.id, { description: editDescription });
      setEditingRule(null);
    }
  };

  const handleUndo = async (rule: PatternRule) => {
    if (rule.previous_state) {
      const previousState = await deactivatePatternRule(rule.id);
      if (previousState) {
        onRestoreSchedule(previousState);
      }
    }
    setUndoConfirmRule(null);
  };

  const handleReactivate = async (rule: PatternRule) => {
    const changes = await reactivatePatternRule(rule.id);
    if (changes) {
      onReapplyChanges(changes);
    }
  };

  const handleDelete = async (rule: PatternRule) => {
    await deletePatternRule(rule.id);
    setDeleteConfirmRule(null);
  };

  const activeRules = patternRules.filter((r) => r.is_active);
  const inactiveRules = patternRules.filter((r) => !r.is_active);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <History className="h-5 w-5 text-primary" />
              </div>
              패턴 히스토리
            </DialogTitle>
            <DialogDescription>
              AI를 통해 적용된 모든 규칙과 패턴을 관리합니다.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : patternRules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>적용된 패턴 규칙이 없습니다.</p>
                <p className="text-sm mt-1">AI 패턴 매니저를 통해 규칙을 추가해보세요.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 활성 규칙 */}
                {activeRules.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      활성 규칙 ({activeRules.length})
                    </h3>
                    <div className="space-y-3">
                      {activeRules.map((rule) => (
                        <Card key={rule.id} className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="p-1.5 rounded bg-green-100 dark:bg-green-900">
                                    {getActionIcon(rule.action)}
                                  </div>
                                  <Badge variant="secondary" className="text-xs">
                                    {getActionLabel(rule.action)}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(rule.applied_at), "M/d HH:mm", { locale: ko })}
                                  </span>
                                </div>
                                <p className="text-sm font-medium truncate">{rule.command}</p>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {rule.description}
                                </p>
                                
                                {/* 변경 사항 요약 */}
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {rule.changes.swapShifts && (
                                    <Badge variant="outline" className="text-xs">
                                      초반↔중반 스왑
                                    </Badge>
                                  )}
                                  {rule.changes.workerMoves && rule.changes.workerMoves.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      인원 이동 {rule.changes.workerMoves.length}건
                                    </Badge>
                                  )}
                                  {rule.changes.individualChanges && rule.changes.individualChanges.length > 0 && (
                                    <Badge variant="outline" className="text-xs">
                                      개별 변경 {rule.changes.individualChanges.length}건
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(rule)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-orange-600 hover:text-orange-700"
                                  onClick={() => setUndoConfirmRule(rule)}
                                  disabled={!rule.previous_state}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirmRule(rule)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* 비활성 규칙 */}
                {inactiveRules.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-gray-400" />
                      비활성 규칙 ({inactiveRules.length})
                    </h3>
                    <div className="space-y-3">
                      {inactiveRules.map((rule) => (
                        <Card key={rule.id} className="border-gray-300/50 bg-gray-50/50 dark:bg-gray-900/20 opacity-60">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="p-1.5 rounded bg-gray-100 dark:bg-gray-800">
                                    {getActionIcon(rule.action)}
                                  </div>
                                  <Badge variant="secondary" className="text-xs opacity-60">
                                    {getActionLabel(rule.action)}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(rule.applied_at), "M/d HH:mm", { locale: ko })}
                                  </span>
                                </div>
                                <p className="text-sm font-medium truncate line-through">{rule.command}</p>
                                <p className="text-xs text-muted-foreground mt-1 truncate">
                                  {rule.description}
                                </p>
                              </div>
                              
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => handleReactivate(rule)}
                                >
                                  <ChevronRight className="h-4 w-4 mr-1" />
                                  재적용
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirmRule(rule)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>규칙 설명 수정</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="규칙 설명을 입력하세요"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRule(null)}>
              취소
            </Button>
            <Button onClick={handleSaveEdit}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 되돌리기 확인 */}
      <AlertDialog open={!!undoConfirmRule} onOpenChange={(open) => !open && setUndoConfirmRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>규칙을 되돌리시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 규칙이 적용되기 전 상태로 근무표가 복구됩니다.
              <br />
              <span className="font-medium text-foreground">
                "{undoConfirmRule?.command}"
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => undoConfirmRule && handleUndo(undoConfirmRule)}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              되돌리기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteConfirmRule} onOpenChange={(open) => !open && setDeleteConfirmRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>규칙을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 규칙 히스토리에서 완전히 삭제됩니다.
              <br />
              <span className="font-medium text-foreground">
                "{deleteConfirmRule?.command}"
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmRule && handleDelete(deleteConfirmRule)}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PatternHistory;
