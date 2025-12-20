import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Users,
  Wrench,
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Edit2,
  Clock,
  Palmtree,
} from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, differenceInWeeks } from "date-fns";
import { ko } from "date-fns/locale";

// 잔업/휴가 상태 타입
type WorkerStatus = "normal" | "overtime" | "vacation";

// 직원별 일별 상태 데이터
type WorkerStatusData = {
  [dateKey: string]: {
    [workerName: string]: WorkerStatus;
  };
};

// 기준 주차 (이번 주가 짝수 주차인지 홀수 주차인지 판단용)
const BASE_WEEK_START = startOfWeek(new Date(), { weekStartsOn: 1 });

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

interface Department {
  id: string;
  name: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
  badgeClass: string;
}

const departments: Department[] = [
  {
    id: "equipment",
    name: "설비",
    count: 3,
    icon: <Wrench className="h-4 w-4" />,
    colorClass: "department-equipment",
    badgeClass: "bg-equipment text-primary-foreground",
  },
  {
    id: "inspection",
    name: "검사",
    count: 2,
    icon: <Search className="h-4 w-4" />,
    colorClass: "department-inspection",
    badgeClass: "bg-inspection text-primary-foreground",
  },
  {
    id: "logistics",
    name: "물류",
    count: 1,
    icon: <Package className="h-4 w-4" />,
    colorClass: "department-logistics",
    badgeClass: "bg-logistics text-primary-foreground",
  },
];

type ShiftData = {
  A: string[]; // 초반: 06:00-14:00
  B: string[]; // 중반: 14:00-22:00
};

type ScheduleData = {
  [deptId: string]: {
    [day: string]: ShiftData;
  };
};

const initialScheduleData: ScheduleData = {
  equipment: {
    월: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    화: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    수: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    목: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    금: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    토: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    일: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
  },
  inspection: {
    월: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    화: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    수: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    목: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    금: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    토: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    일: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
  },
  logistics: {
    월: { A: ["김광시"], B: ["강윤묵"] },
    화: { A: ["김광시"], B: ["강윤묵"] },
    수: { A: ["김광시"], B: ["강윤묵"] },
    목: { A: ["김광시"], B: ["강윤묵"] },
    금: { A: ["김광시"], B: ["강윤묵"] },
    토: { A: ["김광시"], B: ["강윤묵"] },
    일: { A: ["김광시"], B: ["강윤묵"] },
  },
};

const WeeklySchedule = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [scheduleData, setScheduleData] = useState<ScheduleData>(initialScheduleData);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    deptId: string;
    day: string;
    shift: "A" | "B";
  } | null>(null);
  const [editingWorkers, setEditingWorkers] = useState<string[]>([]);
  const [newWorkerName, setNewWorkerName] = useState("");
  
  // 잔업/휴가 상태 관리
  const [workerStatusData, setWorkerStatusData] = useState<WorkerStatusData>({});
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<{
    worker: string;
    dateKey: string;
  } | null>(null);

  const goToPreviousWeek = () => {
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const getDateForDay = (dayIndex: number) => {
    return addDays(currentWeekStart, dayIndex);
  };

  const formatWeekRange = () => {
    const weekEnd = addDays(currentWeekStart, 6);
    return `${format(currentWeekStart, "yyyy년 M월 d일", { locale: ko })} ~ ${format(weekEnd, "M월 d일", { locale: ko })}`;
  };

  const getDayHeaderClass = (day: string) => {
    if (day === "토") return "text-saturday font-semibold";
    if (day === "일") return "text-sunday font-semibold";
    return "text-foreground font-semibold";
  };

  const openEditDialog = (deptId: string, day: string, shift: "A" | "B") => {
    setEditingCell({ deptId, day, shift });
    setEditingWorkers([...(scheduleData[deptId]?.[day]?.[shift] || [])]);
    setNewWorkerName("");
    setEditDialogOpen(true);
  };

  const addWorker = () => {
    if (newWorkerName.trim()) {
      setEditingWorkers((prev) => [...prev, newWorkerName.trim()]);
      setNewWorkerName("");
    }
  };

  const removeWorker = (index: number) => {
    setEditingWorkers((prev) => prev.filter((_, i) => i !== index));
  };

  const saveWorkers = () => {
    if (editingCell) {
      setScheduleData((prev) => ({
        ...prev,
        [editingCell.deptId]: {
          ...prev[editingCell.deptId],
          [editingCell.day]: {
            ...prev[editingCell.deptId][editingCell.day],
            [editingCell.shift]: editingWorkers,
          },
        },
      }));
    }
    setEditDialogOpen(false);
    setEditingCell(null);
  };

  // 주차에 따른 조 교대 여부 계산 (홀수 주차면 swap)
  const isSwappedWeek = () => {
    const weeksDiff = differenceInWeeks(currentWeekStart, BASE_WEEK_START);
    return weeksDiff % 2 !== 0;
  };

  // 주차에 따른 부서 로테이션 계산
  // 짝수 주차: 원래대로 (설비→설비, 검사→검사, 물류→물류)
  // 홀수 주차: 설비→검사/물류, 검사+물류→설비
  const getRotatedWorkers = (deptId: string, day: string, shift: "A" | "B"): string[] => {
    const swapped = isSwappedWeek();
    const rawData = scheduleData;
    
    if (!swapped) {
      // 짝수 주차: 원래 부서의 인원
      return rawData[deptId]?.[day]?.[shift] || [];
    }
    
    // 홀수 주차: 부서 로테이션
    if (deptId === "equipment") {
      // 설비에는 검사 + 물류 인원이 감
      const inspectionWorkers = rawData["inspection"]?.[day]?.[shift] || [];
      const logisticsWorkers = rawData["logistics"]?.[day]?.[shift] || [];
      return [...inspectionWorkers, ...logisticsWorkers];
    } else if (deptId === "inspection") {
      // 검사에는 설비 인원 중 앞 2명이 감
      const equipmentWorkers = rawData["equipment"]?.[day]?.[shift] || [];
      return equipmentWorkers.slice(0, 2);
    } else if (deptId === "logistics") {
      // 물류에는 설비 인원 중 나머지 1명이 감
      const equipmentWorkers = rawData["equipment"]?.[day]?.[shift] || [];
      return equipmentWorkers.slice(2);
    }
    
    return [];
  };

  const getShiftLabel = (shift: "A" | "B") => {
    const swapped = isSwappedWeek();
    if (shift === "A") {
      return swapped ? "중반 (14-22시)" : "초반 (06-14시)";
    }
    return swapped ? "초반 (06-14시)" : "중반 (14-22시)";
  };

  const getDisplayShiftName = (shift: "A" | "B") => {
    const swapped = isSwappedWeek();
    if (shift === "A") return swapped ? "중반" : "초반";
    return swapped ? "초반" : "중반";
  };

  const getDisplayShiftTime = (shift: "A" | "B") => {
    const swapped = isSwappedWeek();
    if (shift === "A") return swapped ? "14-22" : "06-14";
    return swapped ? "06-14" : "14-22";
  };

  const getDeptName = (deptId: string) => {
    return departments.find((d) => d.id === deptId)?.name || deptId;
  };

  // 날짜 키 생성 (yyyy-MM-dd 형식)
  const getDateKey = (dayIndex: number) => {
    return format(getDateForDay(dayIndex), "yyyy-MM-dd");
  };

  // 화수목 체크 (기본 잔업일)
  const isOvertimeDay = (day: string) => {
    return day === "화" || day === "수" || day === "목";
  };

  // 직원 상태 가져오기 (화수목은 기본 잔업)
  const getWorkerStatus = (worker: string, dateKey: string, day: string): WorkerStatus => {
    // 수동으로 설정한 상태가 있으면 그것을 우선
    if (workerStatusData[dateKey]?.[worker]) {
      return workerStatusData[dateKey][worker];
    }
    // 화수목은 기본 잔업
    if (isOvertimeDay(day)) {
      return "overtime";
    }
    return "normal";
  };

  // 상태 다이얼로그 열기
  const openStatusDialog = (worker: string, dayIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const dateKey = getDateKey(dayIndex);
    setEditingStatus({ worker, dateKey });
    setStatusDialogOpen(true);
  };

  // 상태 저장
  const saveWorkerStatus = (status: WorkerStatus) => {
    if (editingStatus) {
      setWorkerStatusData((prev) => ({
        ...prev,
        [editingStatus.dateKey]: {
          ...prev[editingStatus.dateKey],
          [editingStatus.worker]: status,
        },
      }));
    }
    setStatusDialogOpen(false);
    setEditingStatus(null);
  };

  // 잔업 시간 정보 가져오기 (화수목 전용)
  const getOvertimeInfo = (day: string, isFirstShift: boolean) => {
    if (!isOvertimeDay(day)) return null;
    if (isFirstShift) {
      // 초반조: 06-14 + 14-18 잔업
      return "→18시";
    } else {
      // 중반조: 10-22 (10시부터 시작)
      return "10시→";
    }
  };

  // 상태별 아이콘 및 스타일
  const getStatusStyle = (status: WorkerStatus) => {
    switch (status) {
      case "overtime":
        return { icon: <Clock className="h-3 w-3 text-orange-500" />, className: "text-orange-600 font-medium" };
      case "vacation":
        return { icon: <Palmtree className="h-3 w-3 text-green-500" />, className: "text-green-600 line-through" };
      default:
        return { icon: null, className: "" };
    }
  };

  return (
    <>
      <Card className="w-full max-w-6xl mx-auto shadow-lg border-0 bg-card animate-fade-in">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  주간 근무표
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatWeekRange()}
                </p>
              </div>
            </div>
            
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
                className="h-9 w-9"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={goToCurrentWeek}
                className="px-3"
              >
                이번 주
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                className="h-9 w-9"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              총 {departments.reduce((acc, d) => acc + d.count, 0)}명
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              (셀을 클릭하여 편집)
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-4 text-left font-semibold text-foreground border-b border-r border-border min-w-[140px]">
                    부서
                  </th>
                  {DAYS.map((day, index) => {
                    const date = getDateForDay(index);
                    return (
                      <th
                        key={day}
                        className={`p-4 text-center border-b border-r border-border min-w-[100px] ${getDayHeaderClass(day)}`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg">{day}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {format(date, "M/d")}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                    <td className={`p-4 border-b border-r border-border ${dept.colorClass}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-card shadow-sm">
                          {dept.icon}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">
                            {dept.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`mt-1 ${dept.badgeClass} text-xs`}
                          >
                            {dept.count}명
                          </Badge>
                        </div>
                      </div>
                    </td>
                    {DAYS.map((day) => {
                      const isWeekend = day === "토" || day === "일";
                      const swapped = isSwappedWeek();
                      
                      // 로테이션된 인원 가져오기
                      const rotatedA = getRotatedWorkers(dept.id, day, "A");
                      const rotatedB = getRotatedWorkers(dept.id, day, "B");
                      
                      // 주차에 따라 표시 순서와 인원 교대 (초반/중반 swap)
                      const firstShiftWorkers = swapped ? rotatedB : rotatedA;
                      const secondShiftWorkers = swapped ? rotatedA : rotatedB;
                      const firstShiftKey: "A" | "B" = swapped ? "B" : "A";
                      const secondShiftKey: "A" | "B" = swapped ? "A" : "B";
                      
                      return (
                        <td
                          key={day}
                          className={`schedule-cell border-b p-0 ${isWeekend ? "bg-muted/30" : ""}`}
                        >
                          <div className="flex flex-col divide-y divide-border">
                            {/* 초반 (항상 06-14) */}
                            <div
                              className="p-2 cursor-pointer group hover:bg-primary/5 transition-colors min-h-[60px]"
                              onClick={() => openEditDialog(dept.id, day, firstShiftKey)}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-xs font-semibold text-primary">초반</span>
                                <span className="text-[10px] text-muted-foreground">06-14</span>
                                {isOvertimeDay(day) && (
                                  <span className="text-[10px] text-orange-500 font-medium">{getOvertimeInfo(day, true)}</span>
                                )}
                                <Edit2 className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                {firstShiftWorkers.length > 0 ? (
                                  firstShiftWorkers.map((worker, idx) => {
                                    const dayIndex = DAYS.indexOf(day);
                                    const dateKey = getDateKey(dayIndex);
                                    const status = getWorkerStatus(worker, dateKey, day);
                                    const statusStyle = getStatusStyle(status);
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-0.5 -mx-0.5"
                                        onClick={(e) => openStatusDialog(worker, dayIndex, e)}
                                      >
                                        {statusStyle.icon}
                                        <span className={`text-xs ${statusStyle.className || "text-foreground"}`}>
                                          {worker}
                                        </span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">-</span>
                                )}
                              </div>
                            </div>
                            {/* 중반 (항상 14-22, 화수목은 10-22) */}
                            <div
                              className="p-2 cursor-pointer group hover:bg-secondary/50 transition-colors min-h-[60px]"
                              onClick={() => openEditDialog(dept.id, day, secondShiftKey)}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <span className="text-xs font-semibold text-secondary-foreground">중반</span>
                                {isOvertimeDay(day) ? (
                                  <span className="text-[10px] text-orange-500 font-medium">10-22</span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">14-22</span>
                                )}
                                <Edit2 className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                {secondShiftWorkers.length > 0 ? (
                                  secondShiftWorkers.map((worker, idx) => {
                                    const dayIndex = DAYS.indexOf(day);
                                    const dateKey = getDateKey(dayIndex);
                                    const status = getWorkerStatus(worker, dateKey, day);
                                    const statusStyle = getStatusStyle(status);
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-0.5 -mx-0.5"
                                        onClick={(e) => openStatusDialog(worker, dayIndex, e)}
                                      >
                                        {statusStyle.icon}
                                        <span className={`text-xs ${statusStyle.className || "text-foreground"}`}>
                                          {worker}
                                        </span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">-</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="p-4 border-t border-border bg-muted/30">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground font-medium">범례:</span>
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${dept.badgeClass}`} />
                  <span className="text-foreground">{dept.name}</span>
                </div>
              ))}
              <div className="border-l border-border pl-4 ml-2 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-orange-500" />
                  <span className="text-foreground">잔업</span>
                </div>
                <div className="flex items-center gap-1">
                  <Palmtree className="h-3 w-3 text-green-500" />
                  <span className="text-foreground">휴가</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCell && `${getDeptName(editingCell.deptId)} - ${editingCell.day}요일 ${getShiftLabel(editingCell.shift)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current workers */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                현재 근무자
              </label>
              {editingWorkers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editingWorkers.map((worker, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 bg-secondary px-3 py-1.5 rounded-full"
                    >
                      <span className="text-sm text-secondary-foreground">
                        {worker}
                      </span>
                      <button
                        onClick={() => removeWorker(index)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  등록된 근무자가 없습니다
                </p>
              )}
            </div>

            {/* Add new worker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                근무자 추가
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="이름 입력"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addWorker();
                    }
                  }}
                />
                <Button onClick={addWorker} size="icon" variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={saveWorkers}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Dialog - 잔업/휴가 선택 */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {editingStatus && `${editingStatus.worker} - 상태 변경`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => saveWorkerStatus("normal")}
            >
              <Users className="h-4 w-4" />
              정상 근무
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={() => saveWorkerStatus("overtime")}
            >
              <Clock className="h-4 w-4" />
              잔업
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={() => saveWorkerStatus("vacation")}
            >
              <Palmtree className="h-4 w-4" />
              휴가
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WeeklySchedule;
