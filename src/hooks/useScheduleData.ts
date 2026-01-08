import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays, startOfWeek } from 'date-fns';

// 잔업/휴가/휴무 상태 타입
export type WorkerStatus = "normal" | "overtime" | "vacation" | "dayoff";

// 직원별 일별 상태 데이터
export type WorkerStatusData = {
  [dateKey: string]: {
    [workerName: string]: WorkerStatus;
  };
};

export type ShiftData = {
  A: string[]; // 초반: 06:00-14:00
  B: string[]; // 중반: 14:00-22:00
};

export type ScheduleData = {
  [deptId: string]: {
    [day: string]: ShiftData;
  };
};

// 로테이션 규칙에 따른 기본 스케줄 (주차 생성 시 사용)
export const initialScheduleData: ScheduleData = {
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

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const DEPARTMENTS = ["foreman", "equipment", "inspection", "logistics"];

// 주차 시작일을 기반으로 각 요일의 날짜 키(yyyy-MM-dd) 생성
const getDateKeyForDay = (weekStart: Date, dayIndex: number): string => {
  return format(addDays(weekStart, dayIndex), "yyyy-MM-dd");
};

// 주차 시작일을 기반으로 해당 주의 모든 날짜 키 생성
const getWeekDateKeys = (weekStart: Date): string[] => {
  return DAYS.map((_, index) => getDateKeyForDay(weekStart, index));
};

export function useScheduleData(currentWeekStart?: Date) {
  const weekStart = currentWeekStart || startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartKey = format(weekStart, "yyyy-MM-dd");
  
  const [scheduleData, setScheduleDataLocal] = useState<ScheduleData>(initialScheduleData);
  const [savedScheduleData, setSavedScheduleData] = useState<ScheduleData>(initialScheduleData);
  const [workerStatusData, setWorkerStatusDataLocal] = useState<WorkerStatusData>({});
  const [dayOffDates, setDayOffDatesLocal] = useState<Set<string>>(new Set());
  const [noticeMemo, setNoticeMemoLocal] = useState("");
  const [weekendAvailability, setWeekendAvailabilityLocal] = useState<{ [workerName: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // 이전 주차 키를 추적하여 주차 변경 감지
  const prevWeekStartKeyRef = useRef<string>(weekStartKey);

  // 데이터베이스에서 현재 주차 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const weekDateKeys = getWeekDateKeys(weekStart);
      
      // 병렬로 모든 데이터 로드
      const [scheduleRes, statusRes, dayOffRes, memoRes, weekendRes] = await Promise.all([
        supabase.from('schedule_data').select('*').in('date_key', weekDateKeys),
        supabase.from('worker_statuses').select('*').in('date_key', weekDateKeys),
        supabase.from('day_offs').select('*').in('date_key', weekDateKeys),
        supabase.from('notice_memos').select('*').limit(1),
        supabase.from('weekend_availability').select('*'),
      ]);

      // 스케줄 데이터 처리 - 해당 주차 데이터가 있으면 로드, 없으면 초기 데이터 사용
      const newScheduleData: ScheduleData = JSON.parse(JSON.stringify(initialScheduleData));
      
      if (scheduleRes.data && scheduleRes.data.length > 0) {
        // DB에서 가져온 데이터로 덮어쓰기
        scheduleRes.data.forEach((row) => {
          // date_key에서 요일 인덱스 찾기
          const dayIndex = weekDateKeys.indexOf(row.date_key);
          if (dayIndex !== -1 && DEPARTMENTS.includes(row.department)) {
            const day = DAYS[dayIndex];
            if (!newScheduleData[row.department]) {
              newScheduleData[row.department] = {};
            }
            if (!newScheduleData[row.department][day]) {
              newScheduleData[row.department][day] = { A: [], B: [] };
            }
            newScheduleData[row.department][day][row.shift as "A" | "B"] = row.workers || [];
          }
        });
      }
      
      setScheduleDataLocal(newScheduleData);
      setSavedScheduleData(newScheduleData);
      setHasUnsavedChanges(false);

      // 근무자 상태 데이터 처리
      if (statusRes.data && statusRes.data.length > 0) {
        const newStatusData: WorkerStatusData = {};
        statusRes.data.forEach((row) => {
          if (!newStatusData[row.date_key]) {
            newStatusData[row.date_key] = {};
          }
          newStatusData[row.date_key][row.worker_name] = row.status as WorkerStatus;
        });
        setWorkerStatusDataLocal(newStatusData);
      } else {
        setWorkerStatusDataLocal({});
      }

      // 휴무일 데이터 처리
      if (dayOffRes.data && dayOffRes.data.length > 0) {
        setDayOffDatesLocal(new Set(dayOffRes.data.map((row) => row.date_key)));
      } else {
        setDayOffDatesLocal(new Set());
      }

      // 공지 메모 처리
      if (memoRes.data && memoRes.data.length > 0) {
        setNoticeMemoLocal(memoRes.data[0].content || '');
      }

      // 주말 출근 가능 여부 처리
      if (weekendRes.data && weekendRes.data.length > 0) {
        const availability: { [workerName: string]: boolean } = {};
        weekendRes.data.forEach((row) => {
          availability[row.worker_name] = row.is_available;
        });
        setWeekendAvailabilityLocal(availability);
      }
    } catch (error) {
      console.error('Failed to load data from database:', error);
      toast.error('데이터 로드에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [weekStart]);

  // 주차가 변경되면 데이터 다시 로드
  useEffect(() => {
    if (prevWeekStartKeyRef.current !== weekStartKey) {
      // 주차가 변경됨 - 미저장 변경사항 경고 없이 새 데이터 로드
      prevWeekStartKeyRef.current = weekStartKey;
      setHasUnsavedChanges(false);
    }
    loadData();
  }, [weekStartKey, loadData]);

  // 실시간 구독 설정
  useEffect(() => {
    const weekDateKeys = getWeekDateKeys(weekStart);
    
    const channel = supabase
      .channel(`schedule-realtime-${weekStartKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_data' },
        (payload) => {
          // 현재 주차의 데이터 변경만 반영
          const dateKey = (payload.new as any)?.date_key || (payload.old as any)?.date_key;
          if (weekDateKeys.includes(dateKey)) {
            console.log('Schedule data changed for current week, reloading...');
            loadData();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'worker_statuses' },
        (payload) => {
          const dateKey = (payload.new as any)?.date_key || (payload.old as any)?.date_key;
          if (weekDateKeys.includes(dateKey)) {
            console.log('Worker statuses changed for current week, reloading...');
            loadData();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_offs' },
        (payload) => {
          const dateKey = (payload.new as any)?.date_key || (payload.old as any)?.date_key;
          if (weekDateKeys.includes(dateKey)) {
            console.log('Day offs changed for current week, reloading...');
            loadData();
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notice_memos' },
        () => {
          console.log('Notice memos changed, reloading...');
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'weekend_availability' },
        () => {
          console.log('Weekend availability changed, reloading...');
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [weekStartKey, weekStart, loadData]);

  // 스케줄 데이터 저장 (현재 주차의 날짜 키로 저장)
  const saveScheduleToDb = useCallback(async (newData: ScheduleData) => {
    const weekDateKeys = getWeekDateKeys(weekStart);
    const upsertData: { date_key: string; department: string; shift: string; workers: string[] }[] = [];
    
    Object.entries(newData).forEach(([deptId, days]) => {
      Object.entries(days).forEach(([day, shifts]) => {
        const dayIndex = DAYS.indexOf(day);
        if (dayIndex !== -1) {
          const dateKey = weekDateKeys[dayIndex];
          upsertData.push({
            date_key: dateKey,
            department: deptId,
            shift: 'A',
            workers: shifts.A,
          });
          upsertData.push({
            date_key: dateKey,
            department: deptId,
            shift: 'B',
            workers: shifts.B,
          });
        }
      });
    });

    const { error } = await supabase
      .from('schedule_data')
      .upsert(upsertData, { onConflict: 'date_key,department,shift' });

    if (error) {
      console.error('Failed to save schedule data:', error);
      toast.error('스케줄 저장에 실패했습니다');
      throw error;
    }
  }, [weekStart]);

  // 스케줄 데이터 업데이트 (로컬만 - DB 저장 없음)
  const setScheduleData = useCallback((newDataOrUpdater: ScheduleData | ((prev: ScheduleData) => ScheduleData)) => {
    setScheduleDataLocal((prev) => {
      const newData = typeof newDataOrUpdater === 'function' ? newDataOrUpdater(prev) : newDataOrUpdater;
      setHasUnsavedChanges(true);
      return newData;
    });
  }, []);

  // 스케줄 데이터를 DB에 저장
  const saveScheduleData = useCallback(async () => {
    try {
      await saveScheduleToDb(scheduleData);
      setSavedScheduleData(scheduleData);
      setHasUnsavedChanges(false);
      toast.success('스케줄이 저장되었습니다');
    } catch (error) {
      // Error already handled in saveScheduleToDb
    }
  }, [scheduleData, saveScheduleToDb]);

  // 변경사항 취소 (저장된 데이터로 복원)
  const discardChanges = useCallback(() => {
    setScheduleDataLocal(savedScheduleData);
    setHasUnsavedChanges(false);
  }, [savedScheduleData]);

  // 날짜 키 헬퍼 함수
  const getDateKey = useCallback((dayIndex: number): string => {
    return getDateKeyForDay(weekStart, dayIndex);
  }, [weekStart]);

  // 근무자 상태 업데이트
  const setWorkerStatusData = useCallback((newDataOrUpdater: WorkerStatusData | ((prev: WorkerStatusData) => WorkerStatusData)) => {
    setWorkerStatusDataLocal((prev) => {
      const newData = typeof newDataOrUpdater === 'function' ? newDataOrUpdater(prev) : newDataOrUpdater;
      return newData;
    });
  }, []);

  // 근무자 상태 저장
  const saveWorkerStatus = useCallback(async (dateKey: string, workerName: string, status: WorkerStatus) => {
    setWorkerStatusDataLocal((prev) => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [workerName]: status,
      },
    }));

    const { error } = await supabase
      .from('worker_statuses')
      .upsert(
        { date_key: dateKey, worker_name: workerName, status },
        { onConflict: 'worker_name,date_key' }
      );

    if (error) {
      console.error('Failed to save worker status:', error);
      toast.error('상태 저장에 실패했습니다');
    }
  }, []);

  // 휴무일 토글
  const toggleDayOff = useCallback(async (dateKey: string) => {
    const isCurrentlyOff = dayOffDates.has(dateKey);
    
    if (isCurrentlyOff) {
      setDayOffDatesLocal((prev) => {
        const newSet = new Set(prev);
        newSet.delete(dateKey);
        return newSet;
      });
      
      const { error } = await supabase
        .from('day_offs')
        .delete()
        .eq('date_key', dateKey);

      if (error) {
        console.error('Failed to remove day off:', error);
        toast.error('휴무일 제거에 실패했습니다');
      }
    } else {
      setDayOffDatesLocal((prev) => new Set([...prev, dateKey]));
      
      const { error } = await supabase
        .from('day_offs')
        .insert({ date_key: dateKey });

      if (error) {
        console.error('Failed to add day off:', error);
        toast.error('휴무일 추가에 실패했습니다');
      }
    }
  }, [dayOffDates]);

  // 공지 메모 저장
  const setNoticeMemo = useCallback(async (content: string) => {
    setNoticeMemoLocal(content);
    
    // 먼저 기존 레코드 확인
    const { data: existingMemo } = await supabase.from('notice_memos').select('id').limit(1);
    
    if (existingMemo && existingMemo.length > 0) {
      const { error } = await supabase
        .from('notice_memos')
        .update({ content })
        .eq('id', existingMemo[0].id);

      if (error) {
        console.error('Failed to save notice memo:', error);
        toast.error('메모 저장에 실패했습니다');
      }
    }
  }, []);

  // 주말 출근 가능 여부 토글
  const toggleWeekendAvailability = useCallback(async (workerName: string) => {
    const currentAvailability = weekendAvailability[workerName] || false;
    const newAvailability = !currentAvailability;
    
    setWeekendAvailabilityLocal((prev) => ({
      ...prev,
      [workerName]: newAvailability,
    }));

    const { error } = await supabase
      .from('weekend_availability')
      .upsert(
        { worker_name: workerName, is_available: newAvailability },
        { onConflict: 'worker_name' }
      );

    if (error) {
      console.error('Failed to save weekend availability:', error);
      toast.error('주말 출근 가능 여부 저장에 실패했습니다');
    }
  }, [weekendAvailability]);

  // 주말 출근 가능 여부 확인
  const isWeekendAvailable = useCallback((workerName: string) => {
    return weekendAvailability[workerName] || false;
  }, [weekendAvailability]);

  return {
    scheduleData,
    setScheduleData,
    saveScheduleData,
    discardChanges,
    hasUnsavedChanges,
    workerStatusData,
    setWorkerStatusData,
    saveWorkerStatus,
    dayOffDates,
    toggleDayOff,
    noticeMemo,
    setNoticeMemo,
    weekendAvailability,
    toggleWeekendAvailability,
    isWeekendAvailable,
    isLoading,
    refreshData: loadData,
    getDateKey,
  };
}
