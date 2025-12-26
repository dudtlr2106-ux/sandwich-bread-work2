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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
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
  ArrowRightLeft,
  StickyNote,
  Sunrise,
  Sunset,
} from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, differenceInWeeks, isSameDay } from "date-fns";
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
    id: "foreman",
    name: "반장",
    count: 1,
    icon: <Users className="h-4 w-4" />,
    colorClass: "department-foreman",
    badgeClass: "bg-primary text-primary-foreground",
  },
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
  foreman: {
    월: { A: ["박노일"], B: ["김영식"] },
    화: { A: ["박노일"], B: ["김영식"] },
    수: { A: ["박노일"], B: ["김영식"] },
    목: { A: ["박노일"], B: ["김영식"] },
    금: { A: ["박노일"], B: ["김영식"] },
    토: { A: ["박노일"], B: ["김영식"] },
    일: { A: [], B: [] },
  },
  equipment: {
    월: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    화: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    수: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    목: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    금: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    토: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    일: { A: [], B: [] },
  },
  inspection: {
    월: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    화: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    수: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    목: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    금: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    토: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    일: { A: [], B: [] },
  },
  logistics: {
    월: { A: ["김광시"], B: ["강윤묵"] },
    화: { A: ["김광시"], B: ["강윤묵"] },
    수: { A: ["김광시"], B: ["강윤묵"] },
    목: { A: ["김광시"], B: ["강윤묵"] },
    금: { A: ["김광시"], B: ["강윤묵"] },
    토: { A: ["김광시"], B: ["강윤묵"] },
    일: { A: [], B: [] },
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
  
  // 휴무일 관리 (날짜별)
  const [dayOffDates, setDayOffDates] = useState<Set<string>>(new Set());
  
  // 인원 이동 다이얼로그 상태
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingWorker, setMovingWorker] = useState<{
    worker: string;
    fromDeptId: string;
    fromDay: string;
    fromShift: "A" | "B";
  } | null>(null);

  // 공지 메모 상태
  const [noticeMemo, setNoticeMemo] = useState("");
  const [tempMemo, setTempMemo] = useState("");
  const [memoSheetOpen, setMemoSheetOpen] = useState(false);

  const openMemoSheet = () => {
    setTempMemo(noticeMemo);
    setMemoSheetOpen(true);
  };

  const saveMemo = () => {
    setNoticeMemo(tempMemo);
    setMemoSheetOpen(false);
  };

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

  // 공휴일 목록 (2024-2025)
  const holidays: { date: Date; name: string }[] = [
    { date: new Date(2024, 11, 25), name: "크리스마스" },
    { date: new Date(2025, 0, 1), name: "신정" },
    { date: new Date(2025, 0, 28), name: "설날" },
    { date: new Date(2025, 0, 29), name: "설날" },
    { date: new Date(2025, 0, 30), name: "설날" },
    { date: new Date(2025, 2, 1), name: "삼일절" },
    { date: new Date(2025, 4, 5), name: "어린이날" },
    { date: new Date(2025, 5, 6), name: "현충일" },
    { date: new Date(2025, 7, 15), name: "광복절" },
    { date: new Date(2025, 9, 3), name: "개천절" },
    { date: new Date(2025, 9, 9), name: "한글날" },
    { date: new Date(2025, 11, 25), name: "크리스마스" },
  ];

  // 공휴일 체크
  const getHoliday = (date: Date) => {
    return holidays.find(h => isSameDay(h.date, date));
  };

  // 토요일 특근 체크
  const isSpecialWorkDay = (date: Date, day: string) => {
    return day === "토";
  };

  const getDayHeaderClass = (day: string, date: Date) => {
    const holiday = getHoliday(date);
    if (holiday || day === "일") return "text-sunday font-semibold";
    if (day === "토") return "text-saturday font-semibold";
    return "text-foreground font-semibold";
  };

  // 휴무일 토글
  const toggleDayOff = (dateKey: string) => {
    setDayOffDates((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

  // 휴무일 체크
  const isDayOff = (dateKey: string) => {
    return dayOffDates.has(dateKey);
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

  // 주차에 따른 조 교대 여부 계산 (이번주 기준으로 swap 상태)
  const isSwappedWeek = () => {
    const weeksDiff = differenceInWeeks(currentWeekStart, BASE_WEEK_START);
    // 이번주는 설비→검사/물류 로테이션이므로 짝수주가 swap
    return weeksDiff % 2 === 0;
  };

  // 주차에 따른 부서 로테이션 계산
  // 짝수 주차: 원래대로 (설비→설비, 검사→검사, 물류→물류)
  // 홀수 주차: 설비→검사/물류, 검사+물류→설비
  const getRotatedWorkers = (deptId: string, day: string, shift: "A" | "B"): string[] => {
    const swapped = isSwappedWeek();
    const rawData = scheduleData;
    
    // 반장은 로테이션 없이 그대로
    if (deptId === "foreman") {
      return rawData[deptId]?.[day]?.[shift] || [];
    }
    
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

  // 상태 저장
  const setWorkerStatus = (worker: string, dateKey: string, status: WorkerStatus) => {
    setWorkerStatusData((prev) => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [worker]: status,
      },
    }));
  };

  // 인원 이동 다이얼로그 열기
  const openMoveDialog = (worker: string, deptId: string, day: string, shift: "A" | "B") => {
    setMovingWorker({ worker, fromDeptId: deptId, fromDay: day, fromShift: shift });
    setMoveDialogOpen(true);
  };

  // 인원 이동 처리 (다이얼로그에서 선택 시)
  const handleMoveWorkerFromDialog = (toDeptId: string, toDay: string, toShift: "A" | "B") => {
    if (!movingWorker) return;
    
    const { worker, fromDeptId, fromDay, fromShift } = movingWorker;
    
    // 같은 위치면 무시
    if (fromDeptId === toDeptId && fromDay === toDay && fromShift === toShift) {
      setMoveDialogOpen(false);
      setMovingWorker(null);
      return;
    }
    
    moveWorker(worker, fromDeptId, fromDay, fromShift, toDeptId, toDay, toShift);
    
    setMoveDialogOpen(false);
    setMovingWorker(null);
  };

  // 직접 인원 이동 (빠른 조 전환용)
  const quickMoveWorker = (worker: string, fromDeptId: string, fromDay: string, fromShift: "A" | "B", toShift: "A" | "B") => {
    moveWorker(worker, fromDeptId, fromDay, fromShift, fromDeptId, fromDay, toShift);
  };

  // 공통 이동 로직
  const moveWorker = (worker: string, fromDeptId: string, fromDay: string, fromShift: "A" | "B", toDeptId: string, toDay: string, toShift: "A" | "B") => {
    // 같은 위치면 무시
    if (fromDeptId === toDeptId && fromDay === toDay && fromShift === toShift) {
      return;
    }
    
    setScheduleData((prev) => {
      const newData = { ...prev };
      
      // 원래 위치에서 제거
      const fromWorkers = [...(newData[fromDeptId]?.[fromDay]?.[fromShift] || [])];
      const workerIndex = fromWorkers.indexOf(worker);
      if (workerIndex > -1) {
        fromWorkers.splice(workerIndex, 1);
        newData[fromDeptId] = {
          ...newData[fromDeptId],
          [fromDay]: {
            ...newData[fromDeptId][fromDay],
            [fromShift]: fromWorkers,
          },
        };
      }
      
      // 새 위치에 추가
      const toWorkers = [...(newData[toDeptId]?.[toDay]?.[toShift] || [])];
      if (!toWorkers.includes(worker)) {
        toWorkers.push(worker);
        newData[toDeptId] = {
          ...newData[toDeptId],
          [toDay]: {
            ...newData[toDeptId][toDay],
            [toShift]: toWorkers,
          },
        };
      }
      
      return newData;
    });
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
              <Sheet open={memoSheetOpen} onOpenChange={setMemoSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" onClick={openMemoSheet}>
                    <StickyNote className="h-4 w-4 mr-2" />
                    공지 메모
                    {noticeMemo && <Badge variant="secondary" className="ml-2">1</Badge>}
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>공지 메모</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4 space-y-4">
                    <Textarea
                      placeholder="공지사항이나 메모를 입력하세요..."
                      value={tempMemo}
                      onChange={(e) => setTempMemo(e.target.value)}
                      className="min-h-[300px]"
                    />
                    <div className="flex gap-2">
                      <Button onClick={saveMemo} className="flex-1">
                        저장
                      </Button>
                      <Button variant="outline" onClick={() => setMemoSheetOpen(false)}>
                        취소
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              
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

          {/* Notice display */}
          {noticeMemo && (
            <div className="mt-4 bg-muted/50 border border-border rounded-lg p-4">
              <div className="flex items-start gap-2">
                <StickyNote className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground mb-1">공지사항</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{noticeMemo}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setNoticeMemo("")}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
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
                    const dateKey = getDateKey(index);
                    const holiday = getHoliday(date);
                    const isSpecialWork = isSpecialWorkDay(date, day);
                    const isOff = isDayOff(dateKey);
                    return (
                      <th
                        key={day}
                        className={`p-4 text-center border-b border-r border-border min-w-[100px] cursor-pointer hover:bg-muted/70 transition-colors ${getDayHeaderClass(day, date)} ${isOff ? "bg-muted/50" : ""}`}
                        onClick={() => toggleDayOff(dateKey)}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-lg">{day}</span>
                            {isOff && (
                              <span className="text-[10px] bg-gray-500 text-white px-1 rounded">
                                휴무
                              </span>
                            )}
                            {!isOff && holiday && (
                              <span className="text-[10px] bg-red-500 text-white px-1 rounded">
                                {holiday.name}
                              </span>
                            )}
                            {!isOff && isSpecialWork && !holiday && (
                              <span className="text-[10px] bg-blue-500 text-white px-1 rounded">
                                특근
                              </span>
                            )}
                          </div>
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
                    {DAYS.map((day, dayIndex) => {
                      const isWeekend = day === "토" || day === "일";
                      const swapped = isSwappedWeek();
                      const dateKey = getDateKey(dayIndex);
                      const isOff = isDayOff(dateKey);
                      
                      // 로테이션된 인원 가져오기
                      const rotatedA = getRotatedWorkers(dept.id, day, "A");
                      const rotatedB = getRotatedWorkers(dept.id, day, "B");
                      
                      // 주차에 따라 표시 순서와 인원 교대 (초반/중반 swap)
                      const firstShiftWorkers = swapped ? rotatedB : rotatedA;
                      const secondShiftWorkers = swapped ? rotatedA : rotatedB;
                      const firstShiftKey: "A" | "B" = swapped ? "B" : "A";
                      const secondShiftKey: "A" | "B" = swapped ? "A" : "B";
                      
                      // 휴무일인 경우
                      if (isOff) {
                        return (
                          <td
                            key={day}
                            className="schedule-cell border-b p-0 bg-muted/50"
                          >
                            <div className="flex items-center justify-center min-h-[120px]">
                              <span className="text-sm text-muted-foreground font-medium">휴무</span>
                            </div>
                          </td>
                        );
                      }
                      
                      return (
                        <td
                          key={day}
                          className={`schedule-cell border-b p-0 ${isWeekend ? "bg-muted/30" : ""}`}
                        >
                          <div className="flex flex-row divide-x divide-border">
                            {/* 초반 (항상 06-14) */}
                            <div
                              className="p-2 cursor-pointer group hover:bg-primary/5 transition-colors min-h-[60px] flex-1"
                              onClick={() => openEditDialog(dept.id, day, firstShiftKey)}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <Sunrise className="h-3.5 w-3.5 text-amber-500" />
                                <Edit2 className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                {firstShiftWorkers.length > 0 ? (
                                  firstShiftWorkers.map((worker, idx) => {
                                    const status = getWorkerStatus(worker, dateKey, day);
                                    const statusStyle = getStatusStyle(status);
                                    return (
                                      <DropdownMenu key={idx}>
                                        <DropdownMenuTrigger asChild>
                                          <div
                                            className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-0.5 -mx-0.5"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {statusStyle.icon}
                                            <span className={`text-xs ${statusStyle.className || "text-foreground"}`}>
                                              {worker}
                                            </span>
                                          </div>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="bg-popover" onClick={(e) => e.stopPropagation()}>
                                          <DropdownMenuItem onClick={() => quickMoveWorker(worker, dept.id, day, firstShiftKey, secondShiftKey)} className="text-blue-600">
                                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                                            중반으로 이동
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => openMoveDialog(worker, dept.id, day, firstShiftKey)}>
                                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                                            다른 위치로 이동
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "normal")}>
                                            <Users className="h-4 w-4 mr-2" />
                                            정상 근무
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "overtime")} className="text-orange-600">
                                            <Clock className="h-4 w-4 mr-2" />
                                            잔업
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "vacation")} className="text-green-600">
                                            <Palmtree className="h-4 w-4 mr-2" />
                                            휴가
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">-</span>
                                )}
                              </div>
                            </div>
                            {/* 중반 (항상 14-22, 화수목은 10-22) */}
                            <div
                              className="p-2 cursor-pointer group hover:bg-secondary/50 transition-colors min-h-[60px] flex-1"
                              onClick={() => openEditDialog(dept.id, day, secondShiftKey)}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <Sunset className="h-3.5 w-3.5 text-orange-500" />
                                <Edit2 className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                              </div>
                              <div className="flex flex-col gap-0.5">
                                {secondShiftWorkers.length > 0 ? (
                                  secondShiftWorkers.map((worker, idx) => {
                                    const status = getWorkerStatus(worker, dateKey, day);
                                    const statusStyle = getStatusStyle(status);
                                    return (
                                      <DropdownMenu key={idx}>
                                        <DropdownMenuTrigger asChild>
                                          <div
                                            className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-0.5 -mx-0.5"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {statusStyle.icon}
                                            <span className={`text-xs ${statusStyle.className || "text-foreground"}`}>
                                              {worker}
                                            </span>
                                          </div>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="bg-popover" onClick={(e) => e.stopPropagation()}>
                                          <DropdownMenuItem onClick={() => quickMoveWorker(worker, dept.id, day, secondShiftKey, firstShiftKey)} className="text-blue-600">
                                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                                            초반으로 이동
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => openMoveDialog(worker, dept.id, day, secondShiftKey)}>
                                            <ArrowRightLeft className="h-4 w-4 mr-2" />
                                            다른 위치로 이동
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "normal")}>
                                            <Users className="h-4 w-4 mr-2" />
                                            정상 근무
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "overtime")} className="text-orange-600">
                                            <Clock className="h-4 w-4 mr-2" />
                                            잔업
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "vacation")} className="text-green-600">
                                            <Palmtree className="h-4 w-4 mr-2" />
                                            휴가
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
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

      {/* Move Worker Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              {movingWorker?.worker} 이동하기
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              현재 위치: {movingWorker && getDeptName(movingWorker.fromDeptId)} - {movingWorker?.fromDay}요일 {movingWorker && getDisplayShiftName(movingWorker.fromShift)}
            </p>
            <div className="space-y-3">
              <p className="text-sm font-medium">이동할 위치를 선택하세요:</p>
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {departments.flatMap((dept) =>
                  DAYS.filter(day => day !== "일").flatMap((day) =>
                    (["A", "B"] as const).map((shiftKey) => {
                      const isCurrent = movingWorker?.fromDeptId === dept.id && 
                                       movingWorker?.fromDay === day && 
                                       movingWorker?.fromShift === shiftKey;
                      return (
                        <Button
                          key={`${dept.id}-${day}-${shiftKey}`}
                          variant={isCurrent ? "secondary" : "outline"}
                          size="sm"
                          disabled={isCurrent}
                          className="justify-start text-xs h-auto py-2"
                          onClick={() => handleMoveWorkerFromDialog(dept.id, day, shiftKey)}
                        >
                          <span className="truncate">
                            {dept.name} {day} {getDisplayShiftName(shiftKey)}
                          </span>
                        </Button>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default WeeklySchedule;
