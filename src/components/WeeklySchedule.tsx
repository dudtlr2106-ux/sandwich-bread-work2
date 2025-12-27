import React, { useState, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Check,
} from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, differenceInWeeks, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";

// 잔업/휴가/휴무 상태 타입
type WorkerStatus = "normal" | "overtime" | "vacation" | "dayoff";

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
    토: { A: [], B: [] },
    일: { A: [], B: [] },
  },
  equipment: {
    월: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    화: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    수: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    목: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    금: { A: ["이상민", "연명옥", "장영광"], B: ["오세홍", "김순기", "김용주"] },
    토: { A: [], B: [] },
    일: { A: [], B: [] },
  },
  inspection: {
    월: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    화: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    수: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    목: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    금: { A: ["백승빈", "서민성"], B: ["고장윤", "윤기은"] },
    토: { A: [], B: [] },
    일: { A: [], B: [] },
  },
  logistics: {
    월: { A: ["김광시"], B: ["강윤묵"] },
    화: { A: ["김광시"], B: ["강윤묵"] },
    수: { A: ["김광시"], B: ["강윤묵"] },
    목: { A: ["김광시"], B: ["강윤묵"] },
    금: { A: ["김광시"], B: ["강윤묵"] },
    토: { A: [], B: [] },
    일: { A: [], B: [] },
  },
};

const WeeklySchedule = () => {
  const isMobile = useIsMobile();
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  // 스케줄 데이터 - localStorage에서 로드
  const [scheduleData, setScheduleData] = useState<ScheduleData>(() => {
    try {
      const saved = localStorage.getItem("scheduleData");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load schedule data from localStorage:", e);
    }
    return initialScheduleData;
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    deptId: string;
    day: string;
    shift: "A" | "B";
  } | null>(null);
  const [editingWorkers, setEditingWorkers] = useState<string[]>([]);
  const [newWorkerName, setNewWorkerName] = useState("");
  
  // 잔업/휴가 상태 관리 - localStorage에서 로드
  const [workerStatusData, setWorkerStatusData] = useState<WorkerStatusData>(() => {
    try {
      const saved = localStorage.getItem("workerStatusData");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load worker status from localStorage:", e);
    }
    return {};
  });
  
  // 휴무일 관리 (날짜별) - localStorage에서 로드
  const [dayOffDates, setDayOffDates] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("dayOffDates");
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load day off dates from localStorage:", e);
    }
    return new Set();
  });
  
  // 인원 이동 다이얼로그 상태
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingWorker, setMovingWorker] = useState<{
    worker: string;
    fromDeptId: string;
    fromDay: string;
    fromShift: "A" | "B";
  } | null>(null);

  // 공지 메모 상태 - localStorage에서 로드
  const [noticeMemo, setNoticeMemo] = useState(() => {
    try {
      const saved = localStorage.getItem("noticeMemo");
      if (saved) {
        return saved;
      }
    } catch (e) {
      console.error("Failed to load notice memo from localStorage:", e);
    }
    return "";
  });
  const [tempMemo, setTempMemo] = useState("");
  const [memoSheetOpen, setMemoSheetOpen] = useState(false);

  // 토요일 근무자 선택 다이얼로그 상태
  const [saturdaySelectDialogOpen, setSaturdaySelectDialogOpen] = useState(false);
  const [saturdaySelectingCell, setSaturdaySelectingCell] = useState<{
    deptId: string;
    shift: "A" | "B";
  } | null>(null);
  const [selectedSaturdayWorkers, setSelectedSaturdayWorkers] = useState<string[]>([]);

  // 주말 출근 가능 여부 (직원별) - localStorage에서 로드
  const [weekendAvailability, setWeekendAvailability] = useState<{ [dateKey: string]: Set<string> }>(() => {
    try {
      const saved = localStorage.getItem("weekendAvailability");
      if (saved) {
        const parsed = JSON.parse(saved);
        const result: { [dateKey: string]: Set<string> } = {};
        Object.entries(parsed).forEach(([dateKey, workers]) => {
          result[dateKey] = new Set(workers as string[]);
        });
        return result;
      }
    } catch (e) {
      console.error("Failed to load weekend availability from localStorage:", e);
    }
    return {};
  });

  // 데이터 변경 시 localStorage에 저장
  useEffect(() => {
    try {
      localStorage.setItem("scheduleData", JSON.stringify(scheduleData));
    } catch (e) {
      console.error("Failed to save schedule data to localStorage:", e);
    }
  }, [scheduleData]);

  useEffect(() => {
    try {
      localStorage.setItem("workerStatusData", JSON.stringify(workerStatusData));
    } catch (e) {
      console.error("Failed to save worker status to localStorage:", e);
    }
  }, [workerStatusData]);

  useEffect(() => {
    try {
      localStorage.setItem("dayOffDates", JSON.stringify(Array.from(dayOffDates)));
    } catch (e) {
      console.error("Failed to save day off dates to localStorage:", e);
    }
  }, [dayOffDates]);

  useEffect(() => {
    try {
      localStorage.setItem("noticeMemo", noticeMemo);
    } catch (e) {
      console.error("Failed to save notice memo to localStorage:", e);
    }
  }, [noticeMemo]);

  // 주말 출근 가능 여부 변경 시 localStorage에 저장
  useEffect(() => {
    try {
      const toSave: { [dateKey: string]: string[] } = {};
      Object.entries(weekendAvailability).forEach(([dateKey, workers]) => {
        toSave[dateKey] = Array.from(workers);
      });
      localStorage.setItem("weekendAvailability", JSON.stringify(toSave));
    } catch (e) {
      console.error("Failed to save weekend availability to localStorage:", e);
    }
  }, [weekendAvailability]);

  // 모바일 요일 선택 (오늘 요일로 초기화)
  const getTodayDayIndex = () => {
    const today = new Date().getDay();
    // 일요일(0)을 6으로, 나머지는 -1
    return today === 0 ? 6 : today - 1;
  };
  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayDayIndex);


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

  // 전체 근무자 목록 가져오기
  const getAllWorkers = (): string[] => {
    const workersSet = new Set<string>();
    Object.values(scheduleData).forEach((deptData) => {
      Object.values(deptData).forEach((dayData) => {
        dayData.A.forEach((worker) => workersSet.add(worker));
        dayData.B.forEach((worker) => workersSet.add(worker));
      });
    });
    return Array.from(workersSet).sort();
  };

  // 주말 출근 가능 여부 토글
  const toggleWeekendAvailability = (dateKey: string, worker: string) => {
    setWeekendAvailability((prev) => {
      const newData = { ...prev };
      if (!newData[dateKey]) {
        newData[dateKey] = new Set();
      } else {
        newData[dateKey] = new Set(prev[dateKey]);
      }
      if (newData[dateKey].has(worker)) {
        newData[dateKey].delete(worker);
      } else {
        newData[dateKey].add(worker);
      }
      return newData;
    });
  };

  // 주말 출근 가능 여부 확인
  const isWeekendAvailable = (dateKey: string, worker: string) => {
    return weekendAvailability[dateKey]?.has(worker) || false;
  };

  // 토요일이 휴무가 아닌지 확인
  const isSaturdayWorkday = () => {
    const saturdayIndex = 5; // 토요일
    const saturdayDateKey = getDateKey(saturdayIndex);
    return !isDayOff(saturdayDateKey);
  };

  // 토요일 근무자 선택 다이얼로그 열기
  const openSaturdaySelectDialog = (deptId: string, shift: "A" | "B") => {
    const saturdayDateKey = getDateKey(5);
    const currentWorkers = scheduleData[deptId]?.["토"]?.[shift] || [];
    setSaturdaySelectingCell({ deptId, shift });
    setSelectedSaturdayWorkers([...currentWorkers]);
    setSaturdaySelectDialogOpen(true);
  };

  // 토요일 근무자 선택/해제 토글
  const toggleSaturdayWorkerSelection = (worker: string) => {
    setSelectedSaturdayWorkers((prev) =>
      prev.includes(worker)
        ? prev.filter((w) => w !== worker)
        : [...prev, worker]
    );
  };

  // 토요일 근무자 저장
  const saveSaturdayWorkers = () => {
    if (saturdaySelectingCell) {
      setScheduleData((prev) => ({
        ...prev,
        [saturdaySelectingCell.deptId]: {
          ...prev[saturdaySelectingCell.deptId],
          ["토"]: {
            ...prev[saturdaySelectingCell.deptId]["토"],
            [saturdaySelectingCell.shift]: selectedSaturdayWorkers,
          },
        },
      }));
    }
    setSaturdaySelectDialogOpen(false);
    setSaturdaySelectingCell(null);
  };

  // 주말 출근 가능자 목록 (해당 날짜)
  const getAvailableWeekendWorkers = (): string[] => {
    const saturdayDateKey = getDateKey(5);
    return getAllWorkers().filter((worker) => isWeekendAvailable(saturdayDateKey, worker));
  };

  // 특정 날짜의 특정 조에서 휴가자 목록 가져오기
  const getVacationWorkers = (dateKey: string, day: string, workers: string[]): string[] => {
    return workers.filter((worker) => getWorkerStatus(worker, dateKey, day) === "vacation");
  };

  // 휴가자 발생 시 다른 조 잔업 가능 알림 메시지
  const getOvertimeNotification = (dateKey: string, day: string, firstShiftWorkers: string[], secondShiftWorkers: string[]) => {
    const firstShiftVacations = getVacationWorkers(dateKey, day, firstShiftWorkers);
    const secondShiftVacations = getVacationWorkers(dateKey, day, secondShiftWorkers);
    
    const notifications: { shift: "first" | "second"; vacationWorkers: string[] }[] = [];
    
    if (secondShiftVacations.length > 0) {
      // 중반 휴가자 → 초반 잔업 가능
      notifications.push({ shift: "first", vacationWorkers: secondShiftVacations });
    }
    if (firstShiftVacations.length > 0) {
      // 초반 휴가자 → 중반 잔업 가능
      notifications.push({ shift: "second", vacationWorkers: firstShiftVacations });
    }
    
    return notifications;
  };

  // 상태별 아이콘 및 스타일
  const getStatusStyle = (status: WorkerStatus) => {
    switch (status) {
      case "overtime":
        return { icon: null, className: "text-orange-600 font-medium" };
      case "vacation":
        return { icon: <Palmtree className="h-3 w-3 text-green-500" />, className: "text-green-600 line-through" };
      default:
        return { icon: null, className: "" };
    }
  };

  return (
    <>
      <Card className="w-full mx-auto shadow-lg border-0 bg-card animate-fade-in">
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
          {/* 모바일 요일 네비게이션 */}
          {isMobile && (
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDayIndex((prev) => (prev > 0 ? prev - 1 : 6))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                {DAYS.map((day, index) => (
                  <Button
                    key={day}
                    variant={selectedDayIndex === index ? "default" : "ghost"}
                    size="sm"
                    className="w-8 h-8 p-0"
                    onClick={() => setSelectedDayIndex(index)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDayIndex((prev) => (prev < 6 ? prev + 1 : 0))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-muted/50">
                  <th rowSpan={2} className="px-2 py-1 text-left font-semibold text-foreground border-b border-r border-border w-[50px] text-xs">
                    구분
                  </th>
                  {(isMobile ? [DAYS[selectedDayIndex]] : DAYS).map((day, index) => {
                    const actualIndex = isMobile ? selectedDayIndex : index;
                    const date = getDateForDay(actualIndex);
                    const dateKey = getDateKey(actualIndex);
                    const holiday = getHoliday(date);
                    const isSpecialWork = isSpecialWorkDay(date, day);
                    const isOff = isDayOff(dateKey);
                    return (
                      <th
                        key={day}
                        colSpan={2}
                        className={`p-2 text-center border-b border-r border-border cursor-pointer hover:bg-muted/70 transition-colors ${getDayHeaderClass(day, date)} ${isOff ? "bg-muted/50" : ""}`}
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
                <tr className="bg-muted/30">
                  {(isMobile ? [DAYS[selectedDayIndex]] : DAYS).map((day) => (
                    <>
                      <th key={`${day}-early`} className="px-2 py-1 text-center border-b border-r border-border text-xs font-semibold text-primary">
                        초반
                      </th>
                      <th key={`${day}-mid`} className="px-2 py-1 text-center border-b border-r border-border text-xs font-semibold text-secondary-foreground">
                        중반
                      </th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                    <td className={`px-2 py-1 border-b border-r border-border ${dept.colorClass}`}>
                      <span className="font-medium text-xs text-foreground">
                        {dept.name}
                      </span>
                    </td>
                    {(isMobile ? [{ day: DAYS[selectedDayIndex], dayIndex: selectedDayIndex }] : DAYS.map((day, idx) => ({ day, dayIndex: idx }))).map(({ day, dayIndex }) => {
                      const isWeekend = day === "토" || day === "일";
                      const isSaturday = day === "토";
                      const swapped = isSwappedWeek();
                      const dateKey = getDateKey(dayIndex);
                      const isOff = isDayOff(dateKey);
                      
                      // 토요일: scheduleData에서 직접 가져오기 (로테이션 없음)
                      // 다른 요일: 로테이션 적용
                      const rotatedA = isSaturday ? (scheduleData[dept.id]?.["토"]?.A || []) : getRotatedWorkers(dept.id, day, "A");
                      const rotatedB = isSaturday ? (scheduleData[dept.id]?.["토"]?.B || []) : getRotatedWorkers(dept.id, day, "B");
                      
                      // 주차에 따라 표시 순서와 인원 교대 (초반/중반 swap) - 토요일도 동일하게 적용
                      // 휴무 상태인 직원 필터링
                      const filterDayOff = (workers: string[]) => 
                        workers.filter(worker => getWorkerStatus(worker, dateKey, day) !== "dayoff");
                      
                      const firstShiftWorkers = filterDayOff(swapped ? rotatedB : rotatedA);
                      const secondShiftWorkers = filterDayOff(swapped ? rotatedA : rotatedB);
                      const firstShiftKey: "A" | "B" = swapped ? "B" : "A";
                      const secondShiftKey: "A" | "B" = swapped ? "A" : "B";
                      
                      // 휴무일인 경우
                      if (isOff) {
                        return (
                          <React.Fragment key={`${dept.id}-${day}`}>
                            <td
                              className="schedule-cell border-b border-r border-border p-0 bg-muted/50"
                            >
                              <div className="flex items-center justify-center min-h-[40px]">
                                <span className="text-xs text-muted-foreground">휴무</span>
                              </div>
                            </td>
                            <td
                              className="schedule-cell border-b border-r border-border p-0 bg-muted/50"
                            >
                              <div className="flex items-center justify-center min-h-[40px]">
                                <span className="text-xs text-muted-foreground">휴무</span>
                              </div>
                            </td>
                          </React.Fragment>
                        );
                      }
                      
                      // 휴가자에 따른 잔업 알림 계산
                      const overtimeNotifications = getOvertimeNotification(dateKey, day, firstShiftWorkers, secondShiftWorkers);
                      const firstShiftNeedsOvertime = overtimeNotifications.some(n => n.shift === "first");
                      const secondShiftNeedsOvertime = overtimeNotifications.some(n => n.shift === "second");
                      
                      return (
                        <React.Fragment key={`${dept.id}-${day}`}>
                          {/* 초반 셀 */}
                          <td
                            className={`schedule-cell border-b border-r border-border p-1 cursor-pointer group hover:bg-primary/5 transition-colors ${isWeekend ? "bg-muted/30" : ""} ${firstShiftNeedsOvertime ? "bg-orange-50 dark:bg-orange-950/30" : ""}`}
                            onClick={() => isSaturday ? openSaturdaySelectDialog(dept.id, firstShiftKey) : openEditDialog(dept.id, day, firstShiftKey)}
                          >
                            <div className="flex flex-col gap-1">
                              {firstShiftNeedsOvertime && (
                                <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-100 dark:bg-orange-900/50 px-1 py-0.5 rounded">
                                  <Clock className="h-3 w-3" />
                                  <span>잔업 가능</span>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {firstShiftWorkers.length > 0 ? (
                                  firstShiftWorkers.map((worker, idx) => {
                                    const status = getWorkerStatus(worker, dateKey, day);
                                    const statusStyle = getStatusStyle(status);
                                    return (
                                      <DropdownMenu key={idx}>
                                        <DropdownMenuTrigger asChild>
                                          <div
                                            className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-0.5"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {statusStyle.icon}
                                            <span className={`text-sm whitespace-nowrap ${statusStyle.className || "text-foreground"}`}>
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
                                          <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "dayoff")} className="text-gray-600">
                                            <X className="h-4 w-4 mr-2" />
                                            휴무
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
                          </td>
                          {/* 중반 셀 */}
                          <td
                            className={`schedule-cell border-b border-r border-border p-1 cursor-pointer group hover:bg-secondary/50 transition-colors ${isWeekend ? "bg-muted/30" : ""} ${secondShiftNeedsOvertime ? "bg-orange-50 dark:bg-orange-950/30" : ""}`}
                            onClick={() => isSaturday ? openSaturdaySelectDialog(dept.id, secondShiftKey) : openEditDialog(dept.id, day, secondShiftKey)}
                          >
                            <div className="flex flex-col gap-1">
                              {secondShiftNeedsOvertime && (
                                <div className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-100 dark:bg-orange-900/50 px-1 py-0.5 rounded">
                                  <Clock className="h-3 w-3" />
                                  <span>잔업 가능</span>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {secondShiftWorkers.length > 0 ? (
                                  secondShiftWorkers.map((worker, idx) => {
                                    const status = getWorkerStatus(worker, dateKey, day);
                                    const statusStyle = getStatusStyle(status);
                                    return (
                                      <DropdownMenu key={idx}>
                                        <DropdownMenuTrigger asChild>
                                          <div
                                            className="flex items-center gap-1 cursor-pointer hover:bg-muted/50 rounded px-0.5"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {statusStyle.icon}
                                            <span className={`text-sm whitespace-nowrap ${statusStyle.className || "text-foreground"}`}>
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
                                          <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "dayoff")} className="text-gray-600">
                                            <X className="h-4 w-4 mr-2" />
                                            휴무
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
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 주말 출근 가능 여부 체크란 - 토요일이 휴무가 아닌 경우에만 표시 */}
          {isSaturdayWorkday() && (
            <div className="p-4 border-t border-border bg-blue-50/50 dark:bg-blue-950/20">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-foreground">주말 출근 가능 여부</span>
                <span className="text-xs text-muted-foreground">(체크하면 출근 가능)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {getAllWorkers().map((worker) => {
                  const saturdayDateKey = getDateKey(5);
                  const isAvailable = isWeekendAvailable(saturdayDateKey, worker);
                  return (
                    <label
                      key={worker}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                        isAvailable
                          ? "bg-blue-100 border-blue-400 dark:bg-blue-900/50 dark:border-blue-600"
                          : "bg-background border-border hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isAvailable}
                        onChange={() => toggleWeekendAvailability(saturdayDateKey, worker)}
                        className="w-4 h-4 rounded border-border text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm ${isAvailable ? "text-blue-700 dark:text-blue-300 font-medium" : "text-foreground"}`}>
                        {worker}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

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

      {/* Saturday Worker Selection Dialog */}
      <Dialog open={saturdaySelectDialogOpen} onOpenChange={setSaturdaySelectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              {saturdaySelectingCell && `토요일 ${getDeptName(saturdaySelectingCell.deptId)} - ${getDisplayShiftName(saturdaySelectingCell.shift)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              주말 출근 가능자 중에서 근무할 인원을 선택하세요.
            </p>
            {getAvailableWeekendWorkers().length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {getAvailableWeekendWorkers().map((worker) => {
                  const isSelected = selectedSaturdayWorkers.includes(worker);
                  return (
                    <div
                      key={worker}
                      onClick={() => toggleSaturdayWorkerSelection(worker)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-blue-100 border-blue-400 dark:bg-blue-900/50 dark:border-blue-600"
                          : "bg-background border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? "bg-blue-600 border-blue-600" : "border-muted-foreground"
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className={`text-sm ${isSelected ? "text-blue-700 dark:text-blue-300 font-medium" : "text-foreground"}`}>
                        {worker}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  주말 출근 가능한 인원이 없습니다.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  하단의 "주말 출근 가능 여부"에서 체크해주세요.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaturdaySelectDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={saveSaturdayWorkers} disabled={getAvailableWeekendWorkers().length === 0}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default WeeklySchedule;
