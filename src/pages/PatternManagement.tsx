import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePatternRules, PatternRule } from "@/hooks/usePatternRules";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRightLeft,
  User,
  Clock,
  Trash2,
  Edit2,
  ArrowLeft,
  Shield,
  Zap,
  Info,
  AlertTriangle,
  Circle,
  ListMusic,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { LogisticsRotationPlaylist } from "@/components/LogisticsRotationPlaylist";

interface AIInterpretation {
  targetGroup: "A조" | "B조" | "전체" | "개별";
  ruleType: string;
  affectedWorkers: string[];
  details: string;
}

interface AIValidation {
  isValid: boolean;
  warnings: string[];
  validWorkersList: string[];
}

interface AIResponse {
  understood: boolean;
  action: string;
  description: string;
  changes: PatternRule['changes'];
  message: string;
  interpretation?: AIInterpretation;
  validation?: AIValidation;
  ruleStatus?: "active" | "pending" | "error";
}

const PatternManagement = () => {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const {
    patternRules,
    isLoading: rulesLoading,
    addPatternRule,
    deletePatternRule,
    updatePatternRule,
  } = usePatternRules();

  const [command, setCommand] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingRule, setEditingRule] = useState<PatternRule | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [deleteConfirmRule, setDeleteConfirmRule] = useState<PatternRule | null>(null);

  // AI 명령 처리
  const handleSubmit = async () => {
    if (!command.trim()) {
      toast.error("명령을 입력해주세요.");
      return;
    }

    setIsProcessing(true);
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
          currentSchedule: {}, // 마스터 룰은 현재 스케줄과 무관
          isMasterRule: true, // 마스터 룰임을 표시
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
      setIsProcessing(false);
    }
  };

  // 마스터 룰로 저장
  const handleSaveAsRule = async () => {
    if (response?.changes) {
      await addPatternRule(
        command,
        response.action,
        response.description,
        response.changes,
        null // 마스터 룰은 이전 상태를 저장하지 않음
      );
      toast.success("마스터 룰이 저장되었습니다. 미래 근무표 생성 시 자동 적용됩니다.");
      handleReset();
    }
  };

  const handleReset = () => {
    setCommand("");
    setResponse(null);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isProcessing) {
      e.preventDefault();
      handleSubmit();
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

  const handleDelete = async (rule: PatternRule) => {
    await deletePatternRule(rule.id);
    setDeleteConfirmRule(null);
  };

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

  // 활성화된 마스터 룰만 표시
  const activeRules = patternRules.filter((r) => r.is_active);

  // 로딩 상태
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 비로그인 또는 비관리자
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">관리자 권한 필요</h2>
            <p className="text-muted-foreground mb-4">
              이 페이지는 관리자만 접근할 수 있습니다.
            </p>
            <Link to="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                근무표로 돌아가기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">패턴 관리</h1>
              <p className="text-sm text-muted-foreground">
                미래 근무표 자동 생성을 위한 마스터 룰
              </p>
            </div>
          </div>
        </div>

        {/* 탭 네비게이션 */}
        <Tabs defaultValue="playlist" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="playlist" className="gap-2">
              <ListMusic className="h-4 w-4" />
              물류 로테이션
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-2">
              <Sparkles className="h-4 w-4" />
              마스터 룰
            </TabsTrigger>
          </TabsList>

          {/* 물류 로테이션 플레이리스트 탭 */}
          <TabsContent value="playlist" className="mt-4 space-y-4">
            <LogisticsRotationPlaylist />
          </TabsContent>

          {/* 마스터 룰 탭 */}
          <TabsContent value="rules" className="mt-4 space-y-6">
            {/* 안내 메시지 */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground mb-1">마스터 룰 시스템</p>
                    <p className="text-muted-foreground">
                      여기서 설정한 규칙들은 <strong>미래 주차의 근무표를 새로 생성할 때</strong> 자동으로 적용됩니다.
                      현재 주차의 근무표는 직접 수정해주세요.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

        {/* AI 명령 입력 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              새 마스터 룰 추가
            </CardTitle>
            <CardDescription>
              자연어로 규칙을 입력하면 AI가 분석하여 마스터 룰로 저장합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 예시 명령어 */}
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-muted"
                onClick={() => setCommand("다음 주부터 초반조와 중반조를 교대해줘")}
              >
                조 교대
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-muted"
                onClick={() => setCommand("매주 A조는 초반, B조는 중반으로 고정해줘")}
              >
                조 고정
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-muted"
                onClick={() => setCommand("김광시를 설비로 고정 배치해줘")}
              >
                인원 고정 배치
              </Badge>
            </div>

            {/* 명령 입력 */}
            <div className="flex gap-2">
              <Input
                placeholder="예: '다음 주부터 초반조와 중반조를 교대해줘'"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                className="flex-1"
              />
              <Button onClick={handleSubmit} disabled={isProcessing || !command.trim()}>
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* 로딩 상태 */}
            {isProcessing && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  AI가 명령을 분석하고 있습니다...
                </span>
              </div>
            )}

            {/* 에러 표시 */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">처리 실패</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* AI 응답 표시 */}
            {response && response.understood && (
              <div className="space-y-3">
                {/* 경고 메시지 (이름 검증 실패) */}
                {response.validation && !response.validation.isValid && (
                  <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-500/30">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400">
                          이름 검증 경고
                        </p>
                        <ul className="mt-2 space-y-1">
                          {response.validation.warnings.map((warning, idx) => (
                            <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                              • {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* 구조화된 해석 정보 */}
                {response.interpretation && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-500/30">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-400 mb-3">
                          규칙 해석 결과
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">적용 대상:</span>
                            <Badge variant="secondary" className="ml-2">
                              {response.interpretation.targetGroup}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground">규칙 타입:</span>
                            <Badge variant="secondary" className="ml-2">
                              {response.interpretation.ruleType}
                            </Badge>
                          </div>
                        </div>
                        {response.interpretation.affectedWorkers && response.interpretation.affectedWorkers.length > 0 && (
                          <div className="mt-3">
                            <span className="text-sm text-muted-foreground">영향받는 인원:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {response.interpretation.affectedWorkers.map((name, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {response.interpretation.details && (
                          <p className="mt-3 text-sm text-muted-foreground">
                            {response.interpretation.details}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 규칙 상태 및 저장 영역 */}
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-500/30">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                      {getActionIcon(response.action)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">{getActionLabel(response.action)}</Badge>
                        {/* 상태 표시등 */}
                        {response.ruleStatus === "active" && (
                          <div className="flex items-center gap-1">
                            <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                            <span className="text-xs text-green-600">Active</span>
                          </div>
                        )}
                        {response.ruleStatus === "pending" && (
                          <div className="flex items-center gap-1">
                            <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                            <span className="text-xs text-yellow-600">Pending</span>
                          </div>
                        )}
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </div>
                      <p className="text-sm font-medium">{response.description}</p>
                      <p className="text-sm text-muted-foreground mt-1">{response.message}</p>

                      {/* 변경 사항 요약 */}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {response.changes.swapShifts && (
                          <Badge variant="outline" className="text-xs">
                            초반↔중반 스왑
                          </Badge>
                        )}
                        {response.changes.workerMoves && response.changes.workerMoves.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            인원 이동 {response.changes.workerMoves.length}건
                          </Badge>
                        )}
                        {response.changes.individualChanges && response.changes.individualChanges.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            개별 변경 {response.changes.individualChanges.length}건
                          </Badge>
                        )}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Button 
                          onClick={handleSaveAsRule} 
                          size="sm"
                          disabled={response.validation && !response.validation.isValid}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          마스터 룰로 저장
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleReset}>
                          취소
                        </Button>
                      </div>
                      {response.validation && !response.validation.isValid && (
                        <p className="text-xs text-yellow-600 mt-2">
                          ⚠️ 경고를 해결한 후 저장할 수 있습니다. 명령을 수정해주세요.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 마스터 룰 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              활성 마스터 룰 ({activeRules.length})
            </CardTitle>
            <CardDescription>
              미래 근무표 생성 시 아래 규칙들이 순서대로 적용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : activeRules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>설정된 마스터 룰이 없습니다.</p>
                <p className="text-sm mt-1">위에서 AI를 통해 규칙을 추가해보세요.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-3">
                  {activeRules.map((rule, index) => (
                    <div
                      key={rule.id}
                      className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {/* 상태 표시등 */}
                              <div className="flex items-center gap-1" title={rule.is_active ? "활성화됨" : "비활성화"}>
                                <Circle className={`h-3 w-3 ${rule.is_active ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
                              </div>
                              <div className="p-1 rounded bg-muted">
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
                            <p className="text-sm font-medium break-words whitespace-pre-wrap">{rule.command}</p>
                            <p className="text-xs text-muted-foreground mt-1 break-words whitespace-pre-wrap">
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
                        </div>

                        <div className="flex gap-1 flex-shrink-0">
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
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirmRule(rule)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 수정 다이얼로그 */}
      <AlertDialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>규칙 설명 수정</AlertDialogTitle>
            <AlertDialogDescription>
              마스터 룰의 설명을 수정합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="규칙 설명을 입력하세요"
            className="my-4"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveEdit}>저장</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteConfirmRule} onOpenChange={(open) => !open && setDeleteConfirmRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>마스터 룰 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 규칙을 삭제하시겠습니까? 삭제 후에는 미래 근무표 생성 시 이 규칙이 적용되지 않습니다.
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
    </div>
  );
};

export default PatternManagement;
