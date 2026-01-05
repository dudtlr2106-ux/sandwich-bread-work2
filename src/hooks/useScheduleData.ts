import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function useScheduleData() {
  const [scheduleData, setScheduleDataLocal] = useState<ScheduleData>(initialScheduleData);
  const [workerStatusData, setWorkerStatusDataLocal] = useState<WorkerStatusData>({});
  const [dayOffDates, setDayOffDatesLocal] = useState<Set<string>>(new Set());
  const [noticeMemo, setNoticeMemoLocal] = useState("");
  const [weekendAvailability, setWeekendAvailabilityLocal] = useState<{ [workerName: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // 저장 디바운스를 위한 타이머
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 데이터베이스에서 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 병렬로 모든 데이터 로드
      const [scheduleRes, statusRes, dayOffRes, memoRes, weekendRes] = await Promise.all([
        supabase.from('schedule_data').select('*'),
        supabase.from('worker_statuses').select('*'),
        supabase.from('day_offs').select('*'),
        supabase.from('notice_memos').select('*').limit(1),
        supabase.from('weekend_availability').select('*'),
      ]);

      // 스케줄 데이터 처리
      if (scheduleRes.data && scheduleRes.data.length > 0) {
        const newScheduleData: ScheduleData = JSON.parse(JSON.stringify(initialScheduleData));
        scheduleRes.data.forEach((row) => {
          if (newScheduleData[row.department] && DAYS.includes(row.date_key)) {
            newScheduleData[row.department][row.date_key] = {
              ...newScheduleData[row.department][row.date_key],
              [row.shift]: row.workers || [],
            };
          }
        });
        setScheduleDataLocal(newScheduleData);
      }

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
      }

      // 휴무일 데이터 처리
      if (dayOffRes.data && dayOffRes.data.length > 0) {
        setDayOffDatesLocal(new Set(dayOffRes.data.map((row) => row.date_key)));
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
  }, []);

  // 컴포넌트 마운트 시 데이터 로드 및 실시간 구독
  useEffect(() => {
    loadData();

    // 실시간 구독 설정
    const channel = supabase
      .channel('schedule-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_data' },
        () => {
          console.log('Schedule data changed, reloading...');
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'worker_statuses' },
        () => {
          console.log('Worker statuses changed, reloading...');
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_offs' },
        () => {
          console.log('Day offs changed, reloading...');
          loadData();
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
  }, [loadData]);

  // 스케줄 데이터 저장 (디바운스 적용)
  const saveScheduleToDb = useCallback(async (newData: ScheduleData) => {
    const upsertData: { date_key: string; department: string; shift: string; workers: string[] }[] = [];
    Object.entries(newData).forEach(([deptId, days]) => {
      Object.entries(days).forEach(([day, shifts]) => {
        upsertData.push({
          date_key: day,
          department: deptId,
          shift: 'A',
          workers: shifts.A,
        });
        upsertData.push({
          date_key: day,
          department: deptId,
          shift: 'B',
          workers: shifts.B,
        });
      });
    });

    const { error } = await supabase
      .from('schedule_data')
      .upsert(upsertData, { onConflict: 'date_key,department,shift' });

    if (error) {
      console.error('Failed to save schedule data:', error);
      toast.error('스케줄 저장에 실패했습니다');
    }
  }, []);

  // 스케줄 데이터 업데이트 (함수 또는 직접 값)
  const setScheduleData = useCallback((newDataOrUpdater: ScheduleData | ((prev: ScheduleData) => ScheduleData)) => {
    setScheduleDataLocal((prev) => {
      const newData = typeof newDataOrUpdater === 'function' ? newDataOrUpdater(prev) : newDataOrUpdater;
      
      // 디바운스된 DB 저장
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveScheduleToDb(newData);
      }, 500);
      
      return newData;
    });
  }, [saveScheduleToDb]);

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
  };
}
