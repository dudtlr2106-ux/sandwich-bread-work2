import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import TapOnlyDropdown from "@/components/TapOnlyDropdown";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { useScheduleData, WorkerStatus, WorkerStatusData, ScheduleData, initialScheduleData, SORTED_ALL_WORKERS, PartialVacationData, PartialOvertimeData } from "@/hooks/useScheduleData";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Users,
  Wrench,
  Search,
  Package,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Edit2,
  Clock,
  Palmtree,
  ArrowRightLeft,
  StickyNote,
  Check,
  Send,
  LogIn,
  LogOut,
  Shield,
  Settings,
  Sparkles,
  Printer,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, addDays, differenceInWeeks, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import AttendanceRequestForm from "@/components/AttendanceRequestForm";
import TeamManagement from "@/components/TeamManagement";

import { PushNotificationToggle } from "@/components/PushNotificationToggle";
// 주차 전환 시점: 일요일 13시 이후면 다음 주로 간주
const getEffectiveWeekStart = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = 일요일
  const hour = now.getHours();
  
  // 일요일 13시 이후면 다음 주로 처리
  if (dayOfWeek === 0 && hour >= 13) {
    return startOfWeek(addDays(now, 1), { weekStartsOn: 1 });
  }
  
  return startOfWeek(now, { weekStartsOn: 1 });
};

// 기준 주차 (이번 주가 짝수 주차인지 홀수 주차인지 판단용)
const BASE_WEEK_START = getEffectiveWeekStart();

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
  {
    id: "package",
    name: "패키지",
    count: 4,
    icon: <Package className="h-4 w-4" />,
    colorClass: "department-package",
    badgeClass: "bg-amber-500 text-white",
  },
];

const WeeklySchedule = () => {
  const isMobile = useIsMobile();
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", () => {
      // orientationchange fires before resize, so delay check
      setTimeout(checkOrientation, 100);
    });
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  // 모바일 가로모드에서는 전체 주간 보기
  const showSingleDay = isMobile && !isLandscape;
  const isLandscapeMode = isMobile && isLandscape;
  const { user, isAdmin, signOut, isLoading } = useAuth();
  
  // 주차 상태를 먼저 정의 (일요일 13시 이후면 다음 주로)
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    getEffectiveWeekStart()
  );
  
  // 데이터베이스 연동 훅 사용 - 현재 주차를 전달
  const {
    scheduleData,
    setScheduleData,
    saveScheduleData,
    discardChanges,
    hasUnsavedChanges,
    workerStatusData,
    setWorkerStatusData,
    saveWorkerStatus,
    partialVacationData,
    partialOvertimeData,
    dayOffDates,
    toggleDayOff: toggleDayOffDb,
    noticeMemo,
    noticeMemoIsPublic,
    setNoticeMemo,
    weekendAvailability,
    toggleWeekendAvailability: toggleWeekendAvailabilityDb,
    isLoading: isDataLoading,
    getDateKey,
  } = useScheduleData(currentWeekStart);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    deptId: string;
    day: string;
    shift: "A" | "B";
  } | null>(null);
  const [editingWorkers, setEditingWorkers] = useState<string[]>([]);
  const [newWorkerName, setNewWorkerName] = useState("");
  
  // 인원 이동 다이얼로그 상태
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingWorker, setMovingWorker] = useState<{
    worker: string;
    fromDeptId: string;
    fromDay: string;
    fromShift: "A" | "B";
  } | null>(null);

  const [tempMemo, setTempMemo] = useState("");
  const [tempMemoIsPublic, setTempMemoIsPublic] = useState(true);
  const [memoSheetOpen, setMemoSheetOpen] = useState(false);
  const [memoConfirmOpen, setMemoConfirmOpen] = useState(false);
  const [noticeCollapsed, setNoticeCollapsed] = useState(() => {
    const saved = localStorage.getItem('noticeCollapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('noticeCollapsed', String(noticeCollapsed));
  }, [noticeCollapsed]);

  // 토요일 근무자 선택 다이얼로그 상태
  const [saturdaySelectDialogOpen, setSaturdaySelectDialogOpen] = useState(false);
  const [saturdaySelectingCell, setSaturdaySelectingCell] = useState<{
    deptId: string;
    shift: "A" | "B";
  } | null>(null);
  const [selectedSaturdayWorkers, setSelectedSaturdayWorkers] = useState<string[]>([]);

  // 근태 수정 요청 다이얼로그 상태
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestingWorker, setRequestingWorker] = useState<{
    workerName: string;
    dateKey: string;
    day: string;
    currentStatus: string;
  } | null>(null);

  // 팀 관리 화면 상태
  const [showTeamManagement, setShowTeamManagement] = useState(false);
  const [isCompact, setIsCompact] = useState(() => {
    const saved = localStorage.getItem('scheduleCompactMode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('scheduleCompactMode', String(isCompact));
  }, [isCompact]);

  // 근태 수정 요청 다이얼로그 열기
  const openRequestDialog = (workerName: string, dateKey: string, day: string, currentStatus: string) => {
    setRequestingWorker({ workerName, dateKey, day, currentStatus });
    setRequestDialogOpen(true);
  };

  // 모바일 요일 선택 (오늘 요일로 초기화)
  const getTodayDayIndex = () => {
    const today = new Date().getDay();
    // 일요일(0)을 6으로, 나머지는 -1
    return today === 0 ? 6 : today - 1;
  };
  const [selectedDayIndex, setSelectedDayIndex] = useState(getTodayDayIndex);


  const openMemoSheet = () => {
    setTempMemo(noticeMemo);
    setTempMemoIsPublic(noticeMemoIsPublic);
    setMemoSheetOpen(true);
  };

  const handleSaveMemoClick = () => {
    setMemoConfirmOpen(true);
  };

  const confirmSaveMemo = () => {
    setNoticeMemo(tempMemo, tempMemoIsPublic);
    setMemoConfirmOpen(false);
    setMemoSheetOpen(false);
  };

  // 토요일 인원 초기화 함수
  const clearSaturdayWorkers = () => {
    setScheduleData((prev) => ({
      ...prev,
      foreman: { ...prev.foreman, 토: { A: [], B: [] } },
      equipment: { ...prev.equipment, 토: { A: [], B: [] } },
      inspection: { ...prev.inspection, 토: { A: [], B: [] } },
      logistics: { ...prev.logistics, 토: { A: [], B: [] } },
    }));
  };

  const goToPreviousWeek = () => {
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
    clearSaturdayWorkers();
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
    clearSaturdayWorkers();
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(getEffectiveWeekStart());
    clearSaturdayWorkers();
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

  // 휴무일 토글 - 관리자 전용
  const toggleDayOff = (dateKey: string) => {
    if (!isAdmin) return;
    toggleDayOffDb(dateKey);
  };

  // 휴무일 체크
  const isDayOff = (dateKey: string) => {
    return dayOffDates.has(dateKey);
  };

  // 가로모드에서 일요일과 휴무일 숨김
  const getVisibleDaysList = (): string[] => {
    if (showSingleDay) return [DAYS[selectedDayIndex]];
    if (!isLandscapeMode) return DAYS;
    return DAYS.filter((day, idx) => {
      if (day === "일") return false;
      const dateKey = getDateKey(idx);
      if (isDayOff(dateKey)) return false;
      return true;
    });
  };

  const getVisibleDaysWithIndex = (): { day: string; dayIndex: number }[] => {
    if (showSingleDay) return [{ day: DAYS[selectedDayIndex], dayIndex: selectedDayIndex }];
    if (!isLandscapeMode) return DAYS.map((day, idx) => ({ day, dayIndex: idx }));
    return DAYS.map((day, idx) => ({ day, dayIndex: idx })).filter(({ day, dayIndex }) => {
      if (day === "일") return false;
      const dateKey = getDateKey(dayIndex);
      if (isDayOff(dateKey)) return false;
      return true;
    });
  };

  const openEditDialog = (deptId: string, day: string, shift: "A" | "B") => {
    // 로그인한 관리자만 편집 다이얼로그 열기 가능
    if (!user || !isAdmin) return;
    
    // 데이터베이스에서 직접 인원 가져오기
    const displayedWorkers = getWorkers(deptId, day, shift);
    setEditingCell({ deptId, day, shift });
    setEditingWorkers([...displayedWorkers]);
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
      const dateKey = getDateKey(DAYS.indexOf(editingCell.day));
      
      // 추가된 근무자들의 dayoff 상태를 normal로 초기화
      editingWorkers.forEach((worker) => {
        const currentStatus = getWorkerStatus(worker, dateKey, editingCell.day);
        if (currentStatus === "dayoff") {
          saveWorkerStatus(dateKey, worker, "normal");
        }
      });
      
      // 로테이션과 관계없이 표시된 부서에 직접 저장
      // 사용자가 클릭한 위치에 그대로 인원을 배치
      const deptId = editingCell.deptId;
      const day = editingCell.day;
      const shift = editingCell.shift;
      
      setScheduleData((prev) => {
        const currentDeptData = prev[deptId] || {};
        const currentDayData = currentDeptData[day] || { A: [], B: [] };
        
        return {
          ...prev,
          [deptId]: {
            ...currentDeptData,
            [day]: {
              ...currentDayData,
              [shift]: editingWorkers,
            },
          },
        };
      });
    }
    setEditDialogOpen(false);
    setEditingCell(null);
  };

  // 데이터베이스에서 직접 인원 가져오기 (로테이션 없음)
  const getWorkers = (deptId: string, day: string, shift: "A" | "B"): string[] => {
    return scheduleData[deptId]?.[day]?.[shift] || [];
  };

  const getShiftLabel = (shift: "A" | "B") => {
    if (shift === "A") {
      return "초반 (06-14시)";
    }
    return "중반 (14-22시)";
  };

  const getDisplayShiftName = (shift: "A" | "B") => {
    if (shift === "A") return "초반";
    return "중반";
  };

  const getDisplayShiftTime = (shift: "A" | "B") => {
    if (shift === "A") return "06-14";
    return "14-22";
  };

  const getDeptName = (deptId: string) => {
    return departments.find((d) => d.id === deptId)?.name || deptId;
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

  // 상태 저장 (DB에 저장)
  const setWorkerStatus = (worker: string, dateKey: string, status: WorkerStatus) => {
    saveWorkerStatus(dateKey, worker, status);
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

  // 공통 이동 로직 (로컬 + DB 즉시 저장)
  const moveWorker = (worker: string, fromDeptId: string, fromDay: string, fromShift: "A" | "B", toDeptId: string, toDay: string, toShift: "A" | "B") => {
    // 같은 위치면 무시
    if (fromDeptId === toDeptId && fromDay === toDay && fromShift === toShift) {
      return;
    }
    
    // 로컬 상태와 DB 저장을 위한 새 배열 계산
    let newFromWorkers: string[] = [];
    let newToWorkers: string[] = [];
    
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
      newFromWorkers = fromWorkers;
      
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
      newToWorkers = toWorkers;
      
      return newData;
    });
    
    // DB에 즉시 저장 (이동 원본 + 대상 셀)
    const fromDayIndex = DAYS.indexOf(fromDay);
    const toDayIndex = DAYS.indexOf(toDay);
    if (fromDayIndex !== -1 && toDayIndex !== -1) {
      const fromDateKey = getDateKey(fromDayIndex);
      const toDateKey = getDateKey(toDayIndex);
      
      // 비동기로 DB 저장 (두 셀 동시)
      setTimeout(async () => {
        try {
          await supabase.from('schedule_data').upsert([
            { date_key: fromDateKey, department: fromDeptId, shift: fromShift, workers: newFromWorkers },
            { date_key: toDateKey, department: toDeptId, shift: toShift, workers: newToWorkers },
          ], { onConflict: 'date_key,department,shift' });
        } catch (error) {
          console.error('Failed to save worker move:', error);
        }
      }, 0);
    }
  };

  // 시간휴가 정보 가져오기
  const getPartialVacationInfo = (worker: string, dateKey: string) => {
    return partialVacationData[dateKey]?.[worker] || null;
  };

  // 시간잔업 정보 가져오기
  const getPartialOvertimeInfo = (worker: string, dateKey: string) => {
    return partialOvertimeData[dateKey]?.[worker] || null;
  };

  // 출퇴근 시간 정보 가져오기 (시간휴가 + 시간잔업 + 잔업 동시 반영)
  const getShiftTimes = (shift: "A" | "B", day: string, status: WorkerStatus, worker?: string, dateKey?: string) => {
    const isFirstShift = shift === "A";
    const isOvertime = status === "overtime";
    
    // 시간휴가 정보 확인
    const partialVacationInfo = worker && dateKey ? partialVacationData[dateKey]?.[worker] : null;
    // 시간잔업 정보 확인
    const partialOvertimeInfo = worker && dateKey ? partialOvertimeData[dateKey]?.[worker] : null;
    
    // 기본 시간 계산
    let baseStart: number;
    let baseEnd: number;
    
    if (isFirstShift) {
      baseStart = 6;
      baseEnd = isOvertime ? 18 : 14;
    } else {
      baseStart = isOvertime ? 10 : 14;
      baseEnd = 22;
    }
    
    // 시간잔업이 있으면 잔업 시간을 반영 (마지막 변경 시간 우선)
    if (partialOvertimeInfo) {
      const overtimeStartParts = partialOvertimeInfo.start_time.split(":");
      const overtimeEndParts = partialOvertimeInfo.end_time.split(":");
      const overtimeStartHour = parseInt(overtimeStartParts[0]);
      const overtimeStartMin = parseInt(overtimeStartParts[1] || "0");
      const overtimeEndHour = parseInt(overtimeEndParts[0]);
      const overtimeEndMin = parseInt(overtimeEndParts[1] || "0");
      
      if (isFirstShift) {
        baseEnd = overtimeEndHour;
        endMin = overtimeEndMin;
      } else {
        baseStart = overtimeStartHour;
        startMin = overtimeStartMin;
      }
    }
    
    // 시간휴가가 있으면 휴가 시간을 반영
    if (partialVacationInfo) {
      const vacationStartHour = parseInt(partialVacationInfo.start_time.split(":")[0]);
      const vacationEndHour = parseInt(partialVacationInfo.end_time.split(":")[0]);
      
      if (isFirstShift) {
        // 초반조: 휴가 시간이 시작 시간과 겹치면 출근 시간을 늦춤
        if (vacationStartHour <= baseStart && vacationEndHour > baseStart) {
          baseStart = vacationEndHour;
        }
        // 초반조: 휴가 시간이 퇴근 시간과 겹치면 퇴근 시간을 앞당김
        if (vacationEndHour >= baseEnd && vacationStartHour < baseEnd) {
          baseEnd = vacationStartHour;
        }
      } else {
        // 중반조: 휴가 시간이 시작 시간(14시)과 겹치면 출근 시간을 늦춤
        if (vacationStartHour <= baseStart && vacationEndHour > baseStart) {
          baseStart = vacationEndHour;
        }
        // 중반조: 휴가 시간이 종료 시간(22시)과 겹치면 퇴근 시간을 앞당김
        if (vacationEndHour >= baseEnd && vacationStartHour < baseEnd) {
          baseEnd = vacationStartHour;
        }
      }
    }
    
    return { 
      start: baseStart.toString().padStart(2, "0"), 
      end: baseEnd.toString().padStart(2, "0") 
    };
  };

  // 전체 근무자 목록 가져오기 (조별 정렬: A조 → B조, 반장 → 1조 → 2조)
  const getAllWorkers = (): string[] => {
    const workersSet = new Set<string>();
    Object.values(scheduleData).forEach((deptData) => {
      Object.values(deptData).forEach((dayData) => {
        dayData.A.forEach((worker) => workersSet.add(worker));
        dayData.B.forEach((worker) => workersSet.add(worker));
      });
    });
    // SORTED_ALL_WORKERS 순서대로 정렬, 그 외 근무자는 뒤에 추가
    const sortedWorkers = SORTED_ALL_WORKERS.filter((w) => workersSet.has(w));
    const otherWorkers = Array.from(workersSet).filter((w) => !SORTED_ALL_WORKERS.includes(w)).sort();
    return [...sortedWorkers, ...otherWorkers];
  };

  // 주말 출근 가능 여부 토글 - 훅 사용
  const toggleWeekendAvailabilityLocal = (worker: string) => {
    toggleWeekendAvailabilityDb(worker, isAdmin);
  };

  // 주말 출근 가능 여부 확인 - 훅에서 가져온 weekendAvailability 사용
  const isWeekendAvailableLocal = (worker: string) => {
    return weekendAvailability[worker] || false;
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
      const saturdayDateKey = getDateKey(5); // 토요일
      
      // 선택된 근무자들의 dayoff 상태를 normal로 초기화
      selectedSaturdayWorkers.forEach((worker) => {
        const currentStatus = getWorkerStatus(worker, saturdayDateKey, "토");
        if (currentStatus === "dayoff") {
          saveWorkerStatus(saturdayDateKey, worker, "normal");
        }
      });
      
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

  // 주말 출근 가능자 목록
  const getAvailableWeekendWorkers = (): string[] => {
    return getAllWorkers().filter((worker) => isWeekendAvailableLocal(worker));
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

  // 상태별 아이콘 및 스타일 (시간휴가/시간잔업 포함 여부도 체크)
  const getStatusStyle = (status: WorkerStatus, hasPartialVacation?: boolean, hasPartialOvertime?: boolean) => {
    // 잔업 + 시간휴가 동시인 경우
    if (status === "overtime" && hasPartialVacation) {
      return { icon: <Clock className="h-3 w-3 text-green-500" />, className: "text-green-600", timeClassName: "text-green-600 font-medium" };
    }
    // 잔업 + 시간잔업 동시인 경우
    if (status === "overtime" && hasPartialOvertime) {
      return { icon: <Clock className="h-3 w-3 text-blue-500" />, className: "text-foreground", timeClassName: "text-blue-500 font-medium" };
    }
    
    switch (status) {
      case "overtime":
        return { icon: null, className: "text-orange-600 font-medium", timeClassName: "" };
      case "vacation":
        return { icon: <Palmtree className="h-3 w-3 text-green-500" />, className: "text-green-600 line-through", timeClassName: "" };
      case "partial_vacation":
        return { icon: <Clock className="h-3 w-3 text-green-500" />, className: "text-green-600", timeClassName: "text-green-600 font-medium" };
      case "partial_overtime":
        return { icon: <Clock className="h-3 w-3 text-blue-500" />, className: "text-foreground", timeClassName: "text-blue-500 font-medium" };
      default:
        // 정상 상태이지만 시간휴가 또는 시간잔업이 있는 경우
        if (hasPartialVacation) {
          return { icon: <Clock className="h-3 w-3 text-green-500" />, className: "text-green-600", timeClassName: "text-green-600 font-medium" };
        }
        if (hasPartialOvertime) {
          return { icon: <Clock className="h-3 w-3 text-blue-500" />, className: "text-foreground", timeClassName: "text-blue-500 font-medium" };
        }
        return { icon: null, className: "", timeClassName: "" };
    }
  };

  // 팀 관리 화면을 보여주는 경우
  if (showTeamManagement) {
    return <TeamManagement onClose={() => setShowTeamManagement(false)} />;
  }

  return (
    <>
      <Card className="w-full mx-auto shadow-lg border-0 bg-card animate-fade-in print-card">
        <CardHeader className={`${isLandscapeMode ? 'py-1 px-2' : 'pb-4'} border-b border-border card-header-print-hide`}>
          <div className={`flex items-center justify-between ${isLandscapeMode ? 'gap-1' : 'flex-col sm:flex-row items-start sm:items-center gap-4'}`}>
            <div className={`flex items-center ${isLandscapeMode ? 'gap-1' : 'gap-3'}`}>
              {!isLandscapeMode && (
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <CardTitle className={`font-bold text-foreground ${isLandscapeMode ? 'text-sm' : 'text-2xl'}`}>
                  주간근무표
                </CardTitle>
                {!isLandscapeMode && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatWeekRange()}
                  </p>
                )}
              </div>
            </div>
            
            {/* Week Navigation & Auth */}
            <div className={`flex items-center ${isLandscapeMode ? 'gap-0.5' : 'gap-2'} flex-wrap`}>
              {/* Auth Section */}
              {isLoading ? (
                <div className="h-9 w-20 bg-muted animate-pulse rounded" />
              ) : user ? (
                <div className="flex items-center gap-1">
                  <PushNotificationToggle />
                {isAdmin && (
                    <span className="flex items-center text-primary">
                      <Shield className="h-4 w-4" />
                    </span>
                  )}
                  <Button variant="outline" size="icon" onClick={signOut} className={isLandscapeMode ? 'h-7 w-7' : 'h-9 w-9'} title="로그아웃">
                    <LogOut className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                  </Button>
                </div>
              ) : (
              <Link to="/auth" aria-label="로그인">
                  <Button variant="outline" size="icon" className={isLandscapeMode ? 'h-7 w-7' : 'h-9 w-9'} aria-label="로그인" title="로그인">
                    <LogIn className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                  </Button>
                </Link>
              )}

              {!isLandscapeMode && <div className="h-6 w-px bg-border hidden sm:block" />}

              {isAdmin && (
                <Sheet open={memoSheetOpen} onOpenChange={setMemoSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" onClick={openMemoSheet} className={isLandscapeMode ? 'h-7 w-7' : 'h-9 w-9'} title="공지 메모">
                      <StickyNote className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
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
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                        <Label htmlFor="notice-visibility" className="text-sm font-medium flex items-center gap-2">
                          {tempMemoIsPublic ? (
                            <>
                              <span className="text-green-600">공개</span>
                              <span className="text-muted-foreground text-xs">- 모든 사용자에게 표시됩니다</span>
                            </>
                          ) : (
                            <>
                              <span className="text-orange-600">비공개</span>
                              <span className="text-muted-foreground text-xs">- 관리자만 볼 수 있습니다</span>
                            </>
                          )}
                        </Label>
                        <Switch
                          id="notice-visibility"
                          checked={tempMemoIsPublic}
                          onCheckedChange={setTempMemoIsPublic}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSaveMemoClick} className="flex-1">
                          저장
                        </Button>
                        <Button variant="outline" onClick={() => setMemoSheetOpen(false)}>
                          취소
                        </Button>
                      </div>

                      <AlertDialog open={memoConfirmOpen} onOpenChange={setMemoConfirmOpen}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>공지사항 수정</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-2">
                                <p>아래 내용으로 수정 하시겠습니까?</p>
                                <div className="mt-2 p-3 bg-muted rounded-md max-h-[200px] overflow-y-auto">
                                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{tempMemo || "(내용 없음)"}</p>
                                </div>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={confirmSaveMemo}>수정</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </SheetContent>
                </Sheet>
              )}

              {/* 팀 관리 버튼 - 관리자만 표시 */}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowTeamManagement(true)}
                  className={isLandscapeMode ? 'h-7 w-7' : 'h-9 w-9'}
                  title="팀 관리"
                >
                  <Settings className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                </Button>
              )}


              {/* 패턴 관리 버튼 - 관리자만 표시 */}
              {isAdmin && (
                <Link to="/pattern-management">
                  <Button
                    variant="outline"
                    size="icon"
                    className={isLandscapeMode ? 'h-7 w-7' : 'h-9 w-9'}
                    title="패턴 관리"
                  >
                    <Sparkles className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                  </Button>
                </Link>
              )}

              {/* 근무표 인쇄 버튼 - 관리자만 표시 */}
              {isAdmin && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.print()}
                  className={`print-hide ${isLandscapeMode ? 'h-7 w-7' : 'h-9 w-9'}`}
                  title="근무표 인쇄"
                >
                  <Printer className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                </Button>
              )}

              {/* 컴팩트 모드 토글 */}
              <Button
                variant={isCompact ? "default" : "outline"}
                size="icon"
                onClick={() => setIsCompact(!isCompact)}
                className={isLandscapeMode ? 'h-7 w-7' : 'h-9 w-9'}
                title={isCompact ? "일반 보기" : "컴팩트 보기"}
              >
                {isCompact ? <Maximize2 className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : <Minimize2 className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
              </Button>
              
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
                className={isLandscapeMode ? 'h-7 w-7' : 'h-9 w-9'}
                aria-label="이전 주"
              >
                <ChevronLeft className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={goToCurrentWeek}
                className={isLandscapeMode ? 'px-1.5 h-7 text-xs' : 'px-3'}
                aria-label={`${format(currentWeekStart, "M/d")} - 현재 주로 이동`}
              >
                {format(currentWeekStart, "M/d")}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                className={isLandscapeMode ? 'h-7 w-7' : 'h-9 w-9'}
                aria-label="다음 주"
              >
                <ChevronRight className={isLandscapeMode ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              </Button>

            </div>
          </div>
          

          {/* Notice display - 컴팩트 모드에서는 숨김 */}
          {!isCompact && noticeMemo && (noticeMemoIsPublic || isAdmin) && (
            <Collapsible open={!noticeCollapsed} onOpenChange={(open) => setNoticeCollapsed(!open)}>
              <div className={`mt-4 border rounded-lg p-4 ${noticeMemoIsPublic ? 'bg-muted/50 border-border' : 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'}`}>
                <div className="flex items-start gap-2">
                  <StickyNote className={`h-4 w-4 mt-0.5 flex-shrink-0 ${noticeMemoIsPublic ? 'text-muted-foreground' : 'text-orange-500'}`} />
                  <div className="flex-1 min-w-0">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer">
                        공지사항
                        {!noticeMemoIsPublic && isAdmin && (
                          <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-300">비공개</Badge>
                        )}
                        <ChevronDown className={`h-4 w-4 transition-transform ${noticeCollapsed ? '-rotate-90' : ''}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words mt-1">{noticeMemo}</p>
                    </CollapsibleContent>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setNoticeMemo("", noticeMemoIsPublic)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </Collapsible>
          )}
        </CardHeader>
        <CardContent className={`p-0 ${isCompact ? '' : 'schedule-table-container'}`}>
          {/* 인쇄 전용 제목 */}
          <h1 className="print-title hidden">
            {format(currentWeekStart, "yyyy년 M월", { locale: ko })} 주간 근무표 ({formatWeekRange()})
          </h1>
          
          {/* 모바일 요일 네비게이션 */}
          {showSingleDay && (
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDayIndex((prev) => (prev > 0 ? prev - 1 : 6))}
                aria-label="이전 요일"
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
                    aria-label={`${day}요일 선택`}
                  >
                    {day}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDayIndex((prev) => (prev < 6 ? prev + 1 : 0))}
                aria-label="다음 요일"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
          <div className={`overflow-x-auto ${isMobile && isLandscape ? "text-[9px]" : ""}`}>
            <table className={`border-collapse ${isMobile && isLandscape ? "landscape-compact w-full table-fixed" : "w-full table-fixed"}`}>
              <thead>
                <tr className="bg-muted/50">
                  <th rowSpan={2} className={`text-center font-semibold text-foreground border-b border-r border-border text-xs ${isLandscapeMode ? 'px-0.5 py-0.5 w-[30px]' : 'px-2 py-1 w-[50px]'}`}>
                    구분
                  </th>
                  {getVisibleDaysList().map((day) => {
                    const actualIndex = DAYS.indexOf(day);
                    const date = getDateForDay(actualIndex);
                    const dateKey = getDateKey(actualIndex);
                    const holiday = getHoliday(date);
                    const isSpecialWork = isSpecialWorkDay(date, day);
                    const isOff = isDayOff(dateKey);
                    // 일요일은 인쇄 시 숨김
                    const isSunday = day === "일";
                    return (
                      <th
                        key={day}
                        colSpan={2}
                        className={`${isCompact ? 'p-1' : 'p-2'} text-center border-b border-r border-border cursor-pointer hover:bg-muted/70 transition-colors ${getDayHeaderClass(day, date)} ${isOff ? "bg-muted/50" : ""} ${isSunday ? "print-hide-sunday" : ""}`}
                        onClick={() => toggleDayOff(dateKey)}
                      >
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <span className={isCompact ? "text-xs" : "text-lg"}>{day}</span>
                          <span className={`${isCompact ? 'text-[8px]' : 'text-xs'} text-muted-foreground font-normal`}>
                            {format(date, "M/d")}
                          </span>
                          {isOff && !isCompact && (
                            <span className="text-[10px] bg-gray-500 text-white px-1 rounded">
                              휴무
                            </span>
                          )}
                          {isOff && isCompact && (
                            <span className="text-[8px] text-muted-foreground">휴</span>
                          )}
                          {!isOff && holiday && !isCompact && (
                            <span className="text-[10px] bg-red-500 text-white px-1 rounded">
                              {holiday.name}
                            </span>
                          )}
                          {!isOff && isSpecialWork && !holiday && !isCompact && (
                            <span className="text-[10px] bg-blue-500 text-white px-1 rounded">
                              특근
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
                <tr className="bg-muted/30">
                  {getVisibleDaysList().map((day) => {
                    const actualIndex = DAYS.indexOf(day);
                    const dateKey = getDateKey(actualIndex);
                    const isDayOffDate = isDayOff(dateKey);
                    
                    // 모든 부서에서 휴가자 체크 (잔업 가능 표시용)
                    let hasFirstShiftVacation = false;
                    let hasSecondShiftVacation = false;
                    
                    if (!isDayOffDate) {
                      departments.forEach((dept) => {
                        const workersA = getWorkers(dept.id, day, "A");
                        const workersB = getWorkers(dept.id, day, "B");
                        const firstVacations = workersA.filter(w => getWorkerStatus(w, dateKey, day) === "vacation");
                        const secondVacations = workersB.filter(w => getWorkerStatus(w, dateKey, day) === "vacation");
                        if (firstVacations.length > 0) hasFirstShiftVacation = true;
                        if (secondVacations.length > 0) hasSecondShiftVacation = true;
                      });
                    }
                    
                    // 일요일은 인쇄 시 숨김
                    const isSundayShift = day === "일";
                    return (
                      <React.Fragment key={`${day}-shifts`}>
                        <th className={`${isCompact ? 'px-0.5 py-0.5' : 'px-2 py-1'} text-center border-b border-r border-border ${isCompact ? 'text-[9px]' : 'text-xs'} font-semibold ${!isCompact && hasSecondShiftVacation ? "bg-orange-100 dark:bg-orange-950/50" : ""} ${isSundayShift ? "print-hide-sunday" : ""}`}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-primary">{isCompact ? '초' : '초반'}</span>
                            {!isCompact && hasSecondShiftVacation && (
                              <div className="flex items-center gap-0.5 text-[9px] text-orange-600">
                                <Clock className="h-2.5 w-2.5" />
                                <span>잔업가능</span>
                              </div>
                            )}
                          </div>
                        </th>
                        <th className={`${isCompact ? 'px-0.5 py-0.5' : 'px-2 py-1'} text-center border-b border-r border-border ${isCompact ? 'text-[9px]' : 'text-xs'} font-semibold ${!isCompact && hasFirstShiftVacation ? "bg-orange-100 dark:bg-orange-950/50" : ""} ${isSundayShift ? "print-hide-sunday" : ""}`}>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-secondary-foreground">{isCompact ? '중' : '중반'}</span>
                            {!isCompact && hasFirstShiftVacation && (
                              <div className="flex items-center gap-0.5 text-[9px] text-orange-600">
                                <Clock className="h-2.5 w-2.5" />
                                <span>잔업가능</span>
                              </div>
                            )}
                          </div>
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, deptIndex) => (
                  <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                    <td className={`border-b border-r border-border text-center whitespace-nowrap ${dept.colorClass} ${isLandscapeMode ? 'px-0.5 py-0' : 'px-1 py-1'}`}>
                      <span className={`font-medium text-foreground ${isLandscapeMode ? 'text-[8px]' : 'text-xs'}`}>
                        {dept.name}
                      </span>
                    </td>
                    {getVisibleDaysWithIndex().map(({ day, dayIndex }) => {
                      const isWeekend = day === "토" || day === "일";
                      const isSaturday = day === "토";
                      const isSundayCell = day === "일";
                      const dateKey = getDateKey(dayIndex);
                      const isOff = isDayOff(dateKey);
                      
                      // 데이터베이스에서 직접 가져오기 (로테이션 없음)
                      const workersA = getWorkers(dept.id, day, "A");
                      const workersB = getWorkers(dept.id, day, "B");
                      
                      // 휴무 상태인 직원 필터링
                      const filterDayOff = (workers: string[]) => 
                        workers.filter(worker => getWorkerStatus(worker, dateKey, day) !== "dayoff");
                      
                      // A=초반, B=중반 (고정)
                      const firstShiftWorkers = filterDayOff(workersA);
                      const secondShiftWorkers = filterDayOff(workersB);
                      const firstShiftKey: "A" | "B" = "A";
                      const secondShiftKey: "A" | "B" = "B";
                      
                      // 휴무일인 경우
                      if (isOff) {
                        return (
                          <React.Fragment key={`${dept.id}-${day}`}>
                            <td
                              className={`schedule-cell border-b border-r border-border p-0 bg-muted/50 ${isSundayCell ? "print-hide-sunday" : ""}`}
                            >
                              <div className="flex items-center justify-center min-h-[40px]">
                                <span className="text-xs text-muted-foreground">휴무</span>
                              </div>
                            </td>
                            <td
                              className={`schedule-cell border-b border-r border-border p-0 bg-muted/50 ${isSundayCell ? "print-hide-sunday" : ""}`}
                            >
                              <div className="flex items-center justify-center min-h-[40px]">
                                <span className="text-xs text-muted-foreground">휴무</span>
                              </div>
                            </td>
                          </React.Fragment>
                        );
                      }
                      
                      
                      return (
                        <React.Fragment key={`${dept.id}-${day}`}>
                          {/* 초반 셀 */}
                          <td
                            className={`schedule-cell border-b border-r border-border ${isCompact ? 'p-0.5 min-h-0' : 'p-1'} cursor-pointer group hover:bg-primary/5 transition-colors ${isWeekend ? "bg-muted/30" : ""} ${isSundayCell ? "print-hide-sunday" : ""}`}
                            onClick={() => isSaturday ? openSaturdaySelectDialog(dept.id, firstShiftKey) : openEditDialog(dept.id, day, firstShiftKey)}
                          >
                            <div className={`flex flex-wrap justify-center ${isCompact ? 'gap-x-0.5 gap-y-0.5' : 'gap-x-1 gap-y-1.5'}`}>
                                {firstShiftWorkers.length > 0 ? (
                                  firstShiftWorkers.map((worker, idx) => {
                                    const status = getWorkerStatus(worker, dateKey, day);
                                    const hasPartialVacation = !!getPartialVacationInfo(worker, dateKey);
                                    const hasPartialOvertime = !!getPartialOvertimeInfo(worker, dateKey);
                                    const statusStyle = getStatusStyle(status, hasPartialVacation, hasPartialOvertime);
                                    const times = getShiftTimes(firstShiftKey, day, status, worker, dateKey);

                                    if (isCompact) {
                                      return (
                                        <span
                                          key={idx}
                                          className={`text-[10px] font-semibold whitespace-nowrap px-0.5 ${statusStyle.className || "text-foreground"}`}
                                          title={`${worker} (${times.start}~${times.end})`}
                                        >
                                          {worker}
                                        </span>
                                      );
                                    }

                                    return (
                                      <TapOnlyDropdown
                                        key={idx}
                                        trigger={
                                          <div
                                            className="flex items-center gap-0.5 cursor-pointer hover:bg-muted/50 rounded px-0.5"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span className={`text-[10px] ${statusStyle.timeClassName || "text-muted-foreground"}`}>{times.start}</span>
                                            {statusStyle.icon}
                                            <span className={`text-sm font-semibold whitespace-nowrap ${statusStyle.className || "text-foreground"}`}>
                                              {worker}
                                            </span>
                                            <span className={`text-[10px] ${statusStyle.timeClassName || "text-muted-foreground"}`}>{times.end}</span>
                                          </div>
                                        }
                                        onContentClick={(e) => e.stopPropagation()}
                                      >
                                          {isAdmin && (
                                            <>
                                              <DropdownMenuItem onClick={() => quickMoveWorker(worker, dept.id, day, firstShiftKey, secondShiftKey)} className="text-blue-600">
                                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                                중반으로 이동
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              {dept.id !== "equipment" && (
                                                <DropdownMenuItem onClick={() => moveWorker(worker, dept.id, day, firstShiftKey, "equipment", day, firstShiftKey)} className="text-equipment">
                                                  <Wrench className="h-4 w-4 mr-2" />
                                                  설비로 이동
                                                </DropdownMenuItem>
                                              )}
                                              {dept.id !== "inspection" && (
                                                <DropdownMenuItem onClick={() => moveWorker(worker, dept.id, day, firstShiftKey, "inspection", day, firstShiftKey)} className="text-inspection">
                                                  <Search className="h-4 w-4 mr-2" />
                                                  검사로 이동
                                                </DropdownMenuItem>
                                              )}
                                              {dept.id !== "logistics" && (
                                                <DropdownMenuItem onClick={() => moveWorker(worker, dept.id, day, firstShiftKey, "logistics", day, firstShiftKey)} className="text-logistics">
                                                  <Package className="h-4 w-4 mr-2" />
                                                  물류로 이동
                                                </DropdownMenuItem>
                                              )}
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "normal")}>
                                                <Users className="h-4 w-4 mr-2" />
                                                 정상
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "overtime")} className="text-orange-600">
                                                <Clock className="h-4 w-4 mr-2" />
                                                잔업
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "partial_overtime")} className="text-blue-600">
                                                <Clock className="h-4 w-4 mr-2" />
                                                시간잔업
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "vacation")} className="text-green-600">
                                                <Palmtree className="h-4 w-4 mr-2" />
                                                휴가
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "partial_vacation")} className="text-green-600">
                                                <Clock className="h-4 w-4 mr-2" />
                                                시간휴가
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "dayoff")} className="text-gray-600">
                                                <X className="h-4 w-4 mr-2" />
                                                휴무
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                            </>
                                          )}
                                          <DropdownMenuItem onClick={() => openRequestDialog(worker, dateKey, day, status)} className="text-primary">
                                            <Send className="h-4 w-4 mr-2" />
                                            근태 수정 요청
                                          </DropdownMenuItem>
                                      </TapOnlyDropdown>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">-</span>
                                )}
                            </div>
                          </td>
                          {/* 중반 셀 */}
                          <td
                            className={`schedule-cell border-b border-r border-border ${isCompact ? 'p-0.5 min-h-0' : 'p-1'} cursor-pointer group hover:bg-secondary/50 transition-colors ${isWeekend ? "bg-muted/30" : ""} ${isSundayCell ? "print-hide-sunday" : ""}`}
                            onClick={() => isSaturday ? openSaturdaySelectDialog(dept.id, secondShiftKey) : openEditDialog(dept.id, day, secondShiftKey)}
                          >
                            <div className={`flex flex-wrap justify-center ${isCompact ? 'gap-x-0.5 gap-y-0.5' : 'gap-x-1 gap-y-1.5'}`}>
                              {secondShiftWorkers.length > 0 ? (
                                  secondShiftWorkers.map((worker, idx) => {
                                    const status = getWorkerStatus(worker, dateKey, day);
                                    const hasPartialVacation = !!getPartialVacationInfo(worker, dateKey);
                                    const hasPartialOvertime = !!getPartialOvertimeInfo(worker, dateKey);
                                    const statusStyle = getStatusStyle(status, hasPartialVacation, hasPartialOvertime);
                                    const times = getShiftTimes(secondShiftKey, day, status, worker, dateKey);

                                    if (isCompact) {
                                      return (
                                        <span
                                          key={idx}
                                          className={`text-[10px] font-semibold whitespace-nowrap px-0.5 ${statusStyle.className || "text-foreground"}`}
                                          title={`${worker} (${times.start}~${times.end})`}
                                        >
                                          {worker}
                                        </span>
                                      );
                                    }

                                    return (
                                      <TapOnlyDropdown
                                        key={idx}
                                        trigger={
                                          <div
                                            className="flex items-center gap-0.5 cursor-pointer hover:bg-muted/50 rounded px-0.5"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span className={`text-[10px] ${statusStyle.timeClassName || "text-muted-foreground"}`}>{times.start}</span>
                                            {statusStyle.icon}
                                            <span className={`text-sm font-semibold whitespace-nowrap ${statusStyle.className || "text-foreground"}`}>
                                              {worker}
                                            </span>
                                            <span className={`text-[10px] ${statusStyle.timeClassName || "text-muted-foreground"}`}>{times.end}</span>
                                          </div>
                                        }
                                        onContentClick={(e) => e.stopPropagation()}
                                      >
                                          {isAdmin && (
                                            <>
                                              <DropdownMenuItem onClick={() => quickMoveWorker(worker, dept.id, day, secondShiftKey, firstShiftKey)} className="text-blue-600">
                                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                                초반으로 이동
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              {dept.id !== "equipment" && (
                                                <DropdownMenuItem onClick={() => moveWorker(worker, dept.id, day, secondShiftKey, "equipment", day, secondShiftKey)} className="text-equipment">
                                                  <Wrench className="h-4 w-4 mr-2" />
                                                  설비로 이동
                                                </DropdownMenuItem>
                                              )}
                                              {dept.id !== "inspection" && (
                                                <DropdownMenuItem onClick={() => moveWorker(worker, dept.id, day, secondShiftKey, "inspection", day, secondShiftKey)} className="text-inspection">
                                                  <Search className="h-4 w-4 mr-2" />
                                                  검사로 이동
                                                </DropdownMenuItem>
                                              )}
                                              {dept.id !== "logistics" && (
                                                <DropdownMenuItem onClick={() => moveWorker(worker, dept.id, day, secondShiftKey, "logistics", day, secondShiftKey)} className="text-logistics">
                                                  <Package className="h-4 w-4 mr-2" />
                                                  물류로 이동
                                                </DropdownMenuItem>
                                              )}
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "normal")}>
                                                <Users className="h-4 w-4 mr-2" />
                                                 정상
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "overtime")} className="text-orange-600">
                                                <Clock className="h-4 w-4 mr-2" />
                                                잔업
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "partial_overtime")} className="text-blue-600">
                                                <Clock className="h-4 w-4 mr-2" />
                                                시간잔업
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "vacation")} className="text-green-600">
                                                <Palmtree className="h-4 w-4 mr-2" />
                                                휴가
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "partial_vacation")} className="text-green-600">
                                                <Clock className="h-4 w-4 mr-2" />
                                                시간휴가
                                              </DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => setWorkerStatus(worker, dateKey, "dayoff")} className="text-gray-600">
                                                <X className="h-4 w-4 mr-2" />
                                                휴무
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                            </>
                                          )}
                                          <DropdownMenuItem onClick={() => openRequestDialog(worker, dateKey, day, status)} className="text-primary">
                                            <Send className="h-4 w-4 mr-2" />
                                            근태 수정 요청
                                          </DropdownMenuItem>
                                      </TapOnlyDropdown>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">-</span>
                                )}
                            </div>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}
                {/* 인원수 요약 행 - 출근 인원 */}
                <tr className="bg-muted/70 font-semibold">
                  <td className={`border-b border-r border-border text-center ${isLandscapeMode ? 'px-0.5 py-0.5' : 'px-2 py-2'}`}>
                    <span className={`font-bold text-foreground ${isLandscapeMode ? 'text-[8px]' : 'text-xs'}`}>출근</span>
                  </td>
                  {getVisibleDaysWithIndex().map(({ day, dayIndex }) => {
                    const dateKey = getDateKey(dayIndex);
                    const isOff = isDayOff(dateKey);
                    const isSundayCell = day === "일";
                    const isWeekendDay = day === "토" || day === "일";
                    
                    // 모든 부서의 초반/중반 인원수 계산
                    let totalFirstShift = 0;
                    let totalSecondShift = 0;
                    
                    if (!isOff) {
                      departments.forEach(dept => {
                        const workersA = getWorkers(dept.id, day, "A");
                        const workersB = getWorkers(dept.id, day, "B");
                        
                        // 평일: 휴무(dayoff), 휴가(vacation) 제외
                        // 주말: 잔업(overtime, partial_overtime) 상태인 인원만 카운트
                        const activeFirstShift = workersA.filter(worker => {
                          const status = getWorkerStatus(worker, dateKey, day);
                          if (status === "dayoff" || status === "vacation") return false;
                          if (isWeekendDay) {
                            return status === "overtime" || status === "partial_overtime";
                          }
                          return true;
                        });
                        const activeSecondShift = workersB.filter(worker => {
                          const status = getWorkerStatus(worker, dateKey, day);
                          if (status === "dayoff" || status === "vacation") return false;
                          if (isWeekendDay) {
                            return status === "overtime" || status === "partial_overtime";
                          }
                          return true;
                        });
                        
                        totalFirstShift += activeFirstShift.length;
                        totalSecondShift += activeSecondShift.length;
                      });
                    }
                    
                    if (isOff) {
                      return (
                        <React.Fragment key={`count-${day}`}>
                          <td className={`border-b border-r border-border p-2 bg-muted/50 text-center ${isSundayCell ? "print-hide-sunday" : ""}`}>
                            <span className="text-xs text-muted-foreground">-</span>
                          </td>
                          <td className={`border-b border-r border-border p-2 bg-muted/50 text-center ${isSundayCell ? "print-hide-sunday" : ""}`}>
                            <span className="text-xs text-muted-foreground">-</span>
                          </td>
                        </React.Fragment>
                      );
                    }
                    
                    return (
                      <React.Fragment key={`count-${day}`}>
                        <td className={`border-b border-r border-border p-2 text-center ${isSundayCell ? "print-hide-sunday" : ""}`}>
                          <span className="text-sm font-bold text-primary">{totalFirstShift}명</span>
                        </td>
                        <td className={`border-b border-r border-border p-2 text-center ${isSundayCell ? "print-hide-sunday" : ""}`}>
                          <span className="text-sm font-bold text-secondary-foreground">{totalSecondShift}명</span>
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
                {/* 잔업 인원 행 */}
                <tr className="bg-orange-50/50 dark:bg-orange-950/20 font-semibold">
                  <td className={`border-b border-r border-border text-center ${isLandscapeMode ? 'px-0.5 py-0.5' : 'px-2 py-2'}`}>
                    <span className={`font-bold text-orange-600 ${isLandscapeMode ? 'text-[8px]' : 'text-xs'}`}>잔업</span>
                  </td>
                  {getVisibleDaysWithIndex().map(({ day, dayIndex }) => {
                    const dateKey = getDateKey(dayIndex);
                    const isOff = isDayOff(dateKey);
                    const isSundayCell = day === "일";
                    
                    // 모든 부서의 초반/중반 잔업 인원수 계산
                    let overtimeFirstShift = 0;
                    let overtimeSecondShift = 0;
                    
                    if (!isOff) {
                      departments.forEach(dept => {
                        const workersA = getWorkers(dept.id, day, "A");
                        const workersB = getWorkers(dept.id, day, "B");
                        
                        // 잔업(overtime, partial_overtime) 상태인 인원만 카운트
                        const overtimeA = workersA.filter(worker => {
                          const status = getWorkerStatus(worker, dateKey, day);
                          return status === "overtime" || status === "partial_overtime";
                        });
                        const overtimeB = workersB.filter(worker => {
                          const status = getWorkerStatus(worker, dateKey, day);
                          return status === "overtime" || status === "partial_overtime";
                        });
                        
                        overtimeFirstShift += overtimeA.length;
                        overtimeSecondShift += overtimeB.length;
                      });
                    }
                    
                    if (isOff) {
                      return (
                        <React.Fragment key={`overtime-${day}`}>
                          <td className={`border-b border-r border-border p-2 bg-muted/50 text-center ${isSundayCell ? "print-hide-sunday" : ""}`}>
                            <span className="text-xs text-muted-foreground">-</span>
                          </td>
                          <td className={`border-b border-r border-border p-2 bg-muted/50 text-center ${isSundayCell ? "print-hide-sunday" : ""}`}>
                            <span className="text-xs text-muted-foreground">-</span>
                          </td>
                        </React.Fragment>
                      );
                    }
                    
                    return (
                      <React.Fragment key={`overtime-${day}`}>
                        <td className={`border-b border-r border-border p-2 text-center ${isSundayCell ? "print-hide-sunday" : ""}`}>
                          <span className="text-sm font-bold text-orange-600">{overtimeFirstShift}명</span>
                        </td>
                        <td className={`border-b border-r border-border p-2 text-center ${isSundayCell ? "print-hide-sunday" : ""}`}>
                          <span className="text-sm font-bold text-orange-600">{overtimeSecondShift}명</span>
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* 주말 출근 가능 여부 체크란 - 컴팩트 모드에서는 숨김 */}
          {!isCompact && isSaturdayWorkday() && (
            <div className="p-4 border-t border-border bg-blue-50/50 dark:bg-blue-950/20 print-hide">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-foreground">주말 출근 가능 여부</span>
                <span className="text-xs text-muted-foreground">(체크하면 출근 가능)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {getAllWorkers().map((worker) => {
                  const isAvailable = isWeekendAvailableLocal(worker);
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
                        onChange={() => toggleWeekendAvailabilityLocal(worker)}
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
          <div className="p-4 border-t border-border bg-muted/30 print-hide">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground font-medium">범례:</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-foreground" />
                <span className="text-foreground">정상</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-foreground">휴가</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-foreground">잔업</span>
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
                <div className="relative flex-1">
                  <Input
                    placeholder="이름 입력 또는 선택"
                    value={newWorkerName}
                    onChange={(e) => setNewWorkerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addWorker();
                      }
                    }}
                  />
                  {/* Autocomplete dropdown */}
                  {newWorkerName.length > 0 && (
                    (() => {
                      const suggestions = getAllWorkers().filter(
                        (worker) =>
                          worker.toLowerCase().includes(newWorkerName.toLowerCase()) &&
                          !editingWorkers.includes(worker)
                      );
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {suggestions.map((worker) => (
                            <button
                              key={worker}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                              onClick={() => {
                                setEditingWorkers((prev) => [...prev, worker]);
                                setNewWorkerName("");
                              }}
                            >
                              {worker}
                            </button>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
                <Button onClick={addWorker} size="icon" variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {/* Quick select existing workers */}
              {getAllWorkers().filter((w) => !editingWorkers.includes(w)).length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-2">기존 근무자 선택:</p>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                    {getAllWorkers()
                      .filter((w) => !editingWorkers.includes(w))
                      .map((worker) => (
                        <button
                          key={worker}
                          type="button"
                          className="px-2 py-1 text-xs bg-muted hover:bg-primary hover:text-primary-foreground rounded transition-colors"
                          onClick={() => setEditingWorkers((prev) => [...prev, worker])}
                        >
                          + {worker}
                        </button>
                      ))}
                  </div>
                </div>
              )}
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

      {/* 근태 수정 요청 다이얼로그 */}
      {requestingWorker && (
        <AttendanceRequestForm
          open={requestDialogOpen}
          onOpenChange={setRequestDialogOpen}
          workerName={requestingWorker.workerName}
          dateKey={requestingWorker.dateKey}
          day={requestingWorker.day}
          currentStatus={requestingWorker.currentStatus}
        />
      )}


      {/* 플로팅 저장 버튼 */}
      {hasUnsavedChanges && isAdmin && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-card border border-border rounded-full shadow-lg px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={discardChanges}
          >
            <X className="h-4 w-4 mr-1" />
            취소
          </Button>
          <Button
            size="sm"
            onClick={saveScheduleData}
            className="bg-primary text-primary-foreground"
          >
            <Check className="h-4 w-4 mr-1" />
            저장
          </Button>
        </div>
      )}
    </>
  );
};

export default WeeklySchedule;
