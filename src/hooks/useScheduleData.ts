import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, isBefore, startOfDay, getISOWeek, getDay, getHours } from 'date-fns';
import { PatternRule } from '@/hooks/usePatternRules';
import { waitForRealtimeReady } from '@/lib/realtimeUtils';

// 잔업/휴가/휴무 상태 타입
export type WorkerStatus = "normal" | "overtime" | "vacation" | "partial_vacation" | "partial_overtime" | "dayoff";

// 시간휴가/시간잔업 정보 타입
export type PartialVacationInfo = {
  start_time: string;
  end_time: string;
};

// 시간잔업 정보 타입
export type PartialOvertimeInfo = {
  start_time: string;
  end_time: string;
};

// 직원별 일별 상태 데이터
export type WorkerStatusData = {
  [dateKey: string]: {
    [workerName: string]: WorkerStatus;
  };
};

// 시간휴가 정보 데이터
export type PartialVacationData = {
  [dateKey: string]: {
    [workerName: string]: PartialVacationInfo;
  };
};

// 시간잔업 정보 데이터
export type PartialOvertimeData = {
  [dateKey: string]: {
    [workerName: string]: PartialOvertimeInfo;
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

// 조별 근무자 구조
// A조: 반장 김영식/이준희, 1조 (김광시, 서민성, 백승빈), 2조 (장영광, 연명옥, 이상민)
// B조: 반장 박노일/이승현, 1조 (강윤묵, 김용주, 김순기), 2조 (윤기은, 오세홍, 고장윤)
export const WORKER_GROUPS = {
  A조: {
    반장: ["김영식", "이준희"],
    "1조": ["김광시", "서민성", "백승빈"],
    "2조": ["장영광", "연명옥", "이상민"],
  },
  B조: {
    반장: ["박노일", "이승현"],
    "1조": ["강윤묵", "김용주", "김순기"],
    "2조": ["윤기은", "오세홍", "고장윤"],
  },
} as const;

// 정렬된 전체 근무자 목록 (A조 → B조, 반장 → 1조 → 2조 순)
export const SORTED_ALL_WORKERS: string[] = [
  ...WORKER_GROUPS.A조.반장,
  ...WORKER_GROUPS.A조["1조"],
  ...WORKER_GROUPS.A조["2조"],
  ...WORKER_GROUPS.B조.반장,
  ...WORKER_GROUPS.B조["1조"],
  ...WORKER_GROUPS.B조["2조"],
];

// 로테이션 규칙에 따른 기본 스케줄 (주차 생성 시 사용)
// A조(초반): 반장 김영식/이준희, 1조+2조 (물류: 김광시, 검사: 서민성/백승빈, 설비: 장영광/연명옥/이상민)
// B조(중반): 반장 박노일/이승현, 1조+2조 (물류: 강윤묵, 검사: 김용주/김순기→고장윤/윤기은, 설비: 오세홍/고장윤/윤기은→윤기은/오세홍/고장윤)
export const initialScheduleData: ScheduleData = {
  foreman: {
    월: { A: ["김영식", "이준희"], B: ["박노일", "이승현"] },
    화: { A: ["김영식", "이준희"], B: ["박노일", "이승현"] },
    수: { A: ["김영식", "이준희"], B: ["박노일", "이승현"] },
    목: { A: ["김영식", "이준희"], B: ["박노일", "이승현"] },
    금: { A: ["김영식", "이준희"], B: ["박노일", "이승현"] },
    토: { A: [], B: [] },
    일: { A: [], B: [] },
  },
  equipment: {
    월: { A: ["장영광", "연명옥", "이상민"], B: ["윤기은", "오세홍", "고장윤"] },
    화: { A: ["장영광", "연명옥", "이상민"], B: ["윤기은", "오세홍", "고장윤"] },
    수: { A: ["장영광", "연명옥", "이상민"], B: ["윤기은", "오세홍", "고장윤"] },
    목: { A: ["장영광", "연명옥", "이상민"], B: ["윤기은", "오세홍", "고장윤"] },
    금: { A: ["장영광", "연명옥", "이상민"], B: ["윤기은", "오세홍", "고장윤"] },
    토: { A: [], B: [] },
    일: { A: [], B: [] },
  },
  inspection: {
    월: { A: ["서민성", "백승빈"], B: ["김용주", "김순기"] },
    화: { A: ["서민성", "백승빈"], B: ["김용주", "김순기"] },
    수: { A: ["서민성", "백승빈"], B: ["김용주", "김순기"] },
    목: { A: ["서민성", "백승빈"], B: ["김용주", "김순기"] },
    금: { A: ["서민성", "백승빈"], B: ["김용주", "김순기"] },
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
  package: {
    월: { A: [], B: [] },
    화: { A: [], B: [] },
    수: { A: [], B: [] },
    목: { A: [], B: [] },
    금: { A: [], B: [] },
    토: { A: [], B: [] },
    일: { A: [], B: [] },
  },
};

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const DEPARTMENTS = ["foreman", "equipment", "inspection", "logistics", "package"];

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
  const [partialVacationData, setPartialVacationData] = useState<PartialVacationData>({});
  const [partialOvertimeData, setPartialOvertimeData] = useState<PartialOvertimeData>({});
  const [dayOffDates, setDayOffDatesLocal] = useState<Set<string>>(new Set());
  const [specialWorkdays, setSpecialWorkdaysLocal] = useState<Set<string>>(new Set());
  const [noticeMemo, setNoticeMemoLocal] = useState("");
  const [noticeMemoIsPublic, setNoticeMemoIsPublicLocal] = useState(true);
  const [weekendAvailability, setWeekendAvailabilityLocal] = useState<{ [workerName: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // 이전 주차 키를 추적하여 주차 변경 감지
  const prevWeekStartKeyRef = useRef<string>(weekStartKey);

  // 마스터 룰 적용 함수
  const applyMasterRules = useCallback((baseData: ScheduleData, rules: PatternRule[]): ScheduleData => {
    let result = JSON.parse(JSON.stringify(baseData));
    
    rules.forEach((rule) => {
      if (!rule.is_active) return;
      
      const changes = rule.changes;
      
      // 조 스왑 처리
      if (changes.swapShifts) {
        Object.keys(result).forEach((deptId) => {
          Object.keys(result[deptId]).forEach((day) => {
            const tempA = [...(result[deptId][day].A || [])];
            const tempB = [...(result[deptId][day].B || [])];
            result[deptId][day] = { A: tempB, B: tempA };
          });
        });
      }
      
      // 인원 이동 처리
      if (changes.workerMoves && changes.workerMoves.length > 0) {
        changes.workerMoves.forEach((move) => {
          if (move.fromShift && move.toShift && move.fromShift !== move.toShift) {
            Object.keys(result).forEach((deptId) => {
              Object.keys(result[deptId]).forEach((day) => {
                const fromWorkers = result[deptId][day][move.fromShift!] as string[];
                const toWorkers = result[deptId][day][move.toShift!] as string[];
                const workerIndex = fromWorkers.indexOf(move.worker);
                
                if (workerIndex > -1) {
                  fromWorkers.splice(workerIndex, 1);
                  if (!toWorkers.includes(move.worker)) {
                    toWorkers.push(move.worker);
                  }
                }
              });
            });
          }
        });
      }
    });
    
    return result;
  }, []);

  // 부서별 로테이션 인원 수 설정
  const DEPARTMENT_ROTATION_SIZE: Record<'logistics' | 'equipment' | 'inspection' | 'foreman' | 'package', { early: number; mid: number }> = {
    logistics: { early: 1, mid: 1 },    // 물류: 초반 1명, 중반 1명 (총 2명)
    equipment: { early: 3, mid: 3 },    // 설비: 초반 3명, 중반 3명 (총 6명)
    inspection: { early: 2, mid: 2 },   // 검사: 초반 2명, 중반 2명 (총 4명)
    foreman: { early: 2, mid: 2 },      // 반장: 초반 2명, 중반 2명 (총 4명)
    package: { early: 4, mid: 4 },      // 패키지: 초반 4명, 중반 4명 (총 8명) - 3조 전용
  };

  // 부서별 로테이션 플레이리스트 적용 함수
  const applyDepartmentPlaylist = useCallback((
    baseData: ScheduleData, 
    playlist: { worker_name: string; position: number; is_dummy?: boolean }[],
    weekOffset: number,
    department: 'logistics' | 'equipment' | 'inspection' | 'foreman' | 'package'
  ): ScheduleData => {
    const rotationSize = DEPARTMENT_ROTATION_SIZE[department];
    const totalPerWeek = rotationSize.early + rotationSize.mid;
    
    if (playlist.length < totalPerWeek) return baseData;
    
    const result = JSON.parse(JSON.stringify(baseData));
    
    // 주차 오프셋에 따라 플레이리스트에서 배정할 인원 계산 (Loop 순환)
    const startIndex = (weekOffset * totalPerWeek) % playlist.length;
    
    // 초반조 인원 선택 (더미 인원 제외)
    const earlyWorkers: string[] = [];
    for (let i = 0; i < rotationSize.early; i++) {
      const idx = (startIndex + i) % playlist.length;
      const item = playlist[idx];
      // 더미 인원은 배열에서 제외
      if (item && !item.is_dummy) {
        earlyWorkers.push(item.worker_name);
      }
    }
    
    // 중반조 인원 선택 (더미 인원 제외)
    const midWorkers: string[] = [];
    for (let i = 0; i < rotationSize.mid; i++) {
      const idx = (startIndex + rotationSize.early + i) % playlist.length;
      const item = playlist[idx];
      // 더미 인원은 배열에서 제외
      if (item && !item.is_dummy) {
        midWorkers.push(item.worker_name);
      }
    }
    
    // 해당 부서에 배정 (월~금)
    const weekdays = ["월", "화", "수", "목", "금"];
    weekdays.forEach((day) => {
      if (result[department] && result[department][day]) {
        result[department][day].A = earlyWorkers.filter(Boolean);
        result[department][day].B = midWorkers.filter(Boolean);
      }
    });
    
    return result;
  }, []);

  // 데이터베이스에서 현재 주차 데이터 로드
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const weekDateKeys = getWeekDateKeys(weekStart);
      const today = startOfDay(new Date());
      const isCurrentOrFutureWeek = !isBefore(weekStart, startOfWeek(today, { weekStartsOn: 1 }));
      
      // ISO 주차 번호를 오프셋으로 사용 (패턴 관리 페이지와 동일한 로직)
      // 일요일 13시 이후면 다음 주를 기준으로 계산
      const now = new Date();
      let effectiveWeekStart = weekStart;
      if (getDay(now) === 0 && getHours(now) >= 13) {
        // 현재가 일요일 13시 이후이고, 보고 있는 주가 현재 주라면 다음 주로 간주
        const currentStandardWeekStart = startOfWeek(today, { weekStartsOn: 1 });
        if (weekStart.getTime() === currentStandardWeekStart.getTime()) {
          // 이 경우는 이미 다음 주 월요일로 넘어가있을 것
        }
      }
      const weekOffset = getISOWeek(weekStart);
      
      // 병렬로 모든 데이터 로드
      const [scheduleRes, statusRes, dayOffRes, memoRes, weekendRes, patternRes, partialVacationRes, partialOvertimeRes, logisticsPlaylistRes, equipmentPlaylistRes, inspectionPlaylistRes, foremanPlaylistRes, packagePlaylistRes] = await Promise.all([
        supabase.from('schedule_data').select('*').in('date_key', weekDateKeys),
        supabase.from('worker_statuses').select('*').in('date_key', weekDateKeys),
        supabase.from('day_offs').select('*').in('date_key', weekDateKeys),
        supabase.from('notice_memos').select('*').limit(1),
        supabase.from('weekend_availability').select('*').eq('week_key', weekStartKey).order('updated_at', { ascending: true }),
        // 현재 주 또는 미래 주차인 경우 마스터 룰도 로드
        isCurrentOrFutureWeek 
          ? supabase.from('pattern_rules').select('*').eq('is_active', true).order('applied_at', { ascending: true })
          : Promise.resolve({ data: [] }),
        // 시간휴가 정보 로드 (승인된 partial_vacation 요청에서)
        supabase.from('attendance_requests')
          .select('worker_name, date_key, start_time, end_time')
          .in('date_key', weekDateKeys)
          .eq('requested_status', 'partial_vacation')
          .eq('status', 'approved'),
        // 시간잔업 정보 로드 (승인된 partial_overtime 요청에서)
        supabase.from('attendance_requests')
          .select('worker_name, date_key, start_time, end_time')
          .in('date_key', weekDateKeys)
          .eq('requested_status', 'partial_overtime')
          .eq('status', 'approved'),
        // 물류 로테이션 플레이리스트 로드 (현재 주 포함)
        isCurrentOrFutureWeek
          ? supabase.from('logistics_rotation_playlist').select('*').order('position', { ascending: true })
          : Promise.resolve({ data: [] }),
        // 설비 로테이션 플레이리스트 로드 (현재 주 포함)
        isCurrentOrFutureWeek
          ? supabase.from('equipment_rotation_playlist').select('*').order('position', { ascending: true })
          : Promise.resolve({ data: [] }),
        // 검사 로테이션 플레이리스트 로드 (현재 주 포함)
        isCurrentOrFutureWeek
          ? supabase.from('inspection_rotation_playlist').select('*').order('position', { ascending: true })
          : Promise.resolve({ data: [] }),
        // 반장 로테이션 플레이리스트 로드 (현재 주 포함)
        isCurrentOrFutureWeek
          ? supabase.from('foreman_rotation_playlist').select('*').order('position', { ascending: true })
          : Promise.resolve({ data: [] }),
        // 패키지 로테이션 플레이리스트 로드 (현재 주 포함) - 3조 전용
        isCurrentOrFutureWeek
          ? supabase.from('package_rotation_playlist').select('*').order('position', { ascending: true })
          : Promise.resolve({ data: [] }),
      ]);

      // 스케줄 데이터 처리 - 해당 주차 데이터가 있으면 로드, 없으면 초기 데이터 사용
      let newScheduleData: ScheduleData = JSON.parse(JSON.stringify(initialScheduleData));
      const hasExistingData = scheduleRes.data && scheduleRes.data.length > 0;
      
      if (hasExistingData) {
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
      } else if (isCurrentOrFutureWeek) {
        // 미래 주차이고 기존 데이터가 없으면 각 부서 플레이리스트 + 마스터 룰 적용
        
        // 0. 반장 로테이션 플레이리스트 적용
        if (foremanPlaylistRes.data && foremanPlaylistRes.data.length >= 2) {
          newScheduleData = applyDepartmentPlaylist(newScheduleData, foremanPlaylistRes.data, weekOffset, 'foreman');
        }
        
        // 1. 물류 로테이션 플레이리스트 적용
        if (logisticsPlaylistRes.data && logisticsPlaylistRes.data.length >= 2) {
          newScheduleData = applyDepartmentPlaylist(newScheduleData, logisticsPlaylistRes.data, weekOffset, 'logistics');
        }
        
        // 2. 설비 로테이션 플레이리스트 적용
        if (equipmentPlaylistRes.data && equipmentPlaylistRes.data.length >= 2) {
          newScheduleData = applyDepartmentPlaylist(newScheduleData, equipmentPlaylistRes.data, weekOffset, 'equipment');
        }
        
        // 3. 검사 로테이션 플레이리스트 적용
        if (inspectionPlaylistRes.data && inspectionPlaylistRes.data.length >= 2) {
          newScheduleData = applyDepartmentPlaylist(newScheduleData, inspectionPlaylistRes.data, weekOffset, 'inspection');
        }
        
        // 4. 패키지 로테이션 플레이리스트 적용 (3조 전용)
        if (packagePlaylistRes.data && packagePlaylistRes.data.length >= 2) {
          newScheduleData = applyDepartmentPlaylist(newScheduleData, packagePlaylistRes.data, weekOffset, 'package');
        }
        
        // 5. 마스터 룰 적용 (플레이리스트 적용 후)
        if (patternRes.data && patternRes.data.length > 0) {
          const masterRules: PatternRule[] = patternRes.data.map((row) => ({
            id: row.id,
            command: row.command,
            action: row.action,
            description: row.description,
            changes: row.changes as PatternRule['changes'],
            previous_state: row.previous_state as ScheduleData | null,
            applied_at: row.applied_at,
            applied_by: row.applied_by,
            is_active: row.is_active,
            created_at: row.created_at,
          }));
          
          newScheduleData = applyMasterRules(newScheduleData, masterRules);
        }
      }
      
      // 주말 출근 가능자를 토요일에 자동 배치 (체크 순서대로 맨 위 부서부터 채움)
      // 부서별로 DB에 근무자가 있으면 수동 데이터로 보존, 없으면 체크 순서 기반으로 자동 배치
      const saturdayDateKey = getDateKeyForDay(weekStart, 5);
      const saturdayDBRows = scheduleRes.data ? scheduleRes.data.filter(
        (row) => row.date_key === saturdayDateKey
      ) : [];
      
      // 토요일에 이미 수동 저장된 데이터가 하나라도 있으면 자동 배치 스킵
      const hasManuallySavedSaturday = saturdayDBRows.some(
        (row) => row.workers && row.workers.length > 0
      );
      
      if (weekendRes.data && !hasManuallySavedSaturday) {
        // 체크된 인원만 updated_at 순서대로 (이미 정렬됨)
        const availableWorkers = weekendRes.data
          .filter((row) => row.is_available)
          .map((row) => row.worker_name);
        
        // 부서별 토요일 슬롯 용량 (초반조만 사용)
        const saturdayDeptOrder: { dept: string; capacity: number }[] = [
          { dept: 'foreman', capacity: DEPARTMENT_ROTATION_SIZE.foreman.early },
          { dept: 'equipment', capacity: DEPARTMENT_ROTATION_SIZE.equipment.early },
          { dept: 'inspection', capacity: DEPARTMENT_ROTATION_SIZE.inspection.early },
          { dept: 'logistics', capacity: DEPARTMENT_ROTATION_SIZE.logistics.early },
          { dept: 'package', capacity: DEPARTMENT_ROTATION_SIZE.package.early },
        ];
        
        let workerIdx = 0;
        saturdayDeptOrder.forEach(({ dept, capacity }) => {
          const deptWorkers: string[] = [];
          for (let i = 0; i < capacity && workerIdx < availableWorkers.length; i++) {
            deptWorkers.push(availableWorkers[workerIdx]);
            workerIdx++;
          }
          if (!newScheduleData[dept]) {
            newScheduleData[dept] = {};
          }
          if (!newScheduleData[dept]["토"]) {
            newScheduleData[dept]["토"] = { A: [], B: [] };
          }
          newScheduleData[dept]["토"] = { A: deptWorkers, B: [] };
        });
        
        // 용량 초과 인원은 마지막 부서에 추가
        if (workerIdx < availableWorkers.length) {
          const lastDept = saturdayDeptOrder[saturdayDeptOrder.length - 1].dept;
          while (workerIdx < availableWorkers.length) {
            newScheduleData[lastDept]["토"].A.push(availableWorkers[workerIdx]);
            workerIdx++;
          }
        }
      }
      
      // 토요일 출근자는 기본 잔업 상태로 설정 (DB 데이터 유무와 무관하게)
      const allSaturdayWorkers: string[] = [];
      DEPARTMENTS.forEach((deptId) => {
        const satData = newScheduleData[deptId]?.["토"];
        if (satData) {
          allSaturdayWorkers.push(...satData.A);
        }
      });
      if (allSaturdayWorkers.length > 0) {
        const saturdayStatuses: { [worker: string]: WorkerStatus } = {};
        allSaturdayWorkers.forEach((w) => {
          saturdayStatuses[w] = 'overtime';
        });
        setWorkerStatusDataLocal((prev) => {
          const existing = prev[saturdayDateKey] || {};
          const merged = { ...saturdayStatuses };
          Object.entries(existing).forEach(([worker, status]) => {
            merged[worker] = status;
          });
          return { ...prev, [saturdayDateKey]: merged };
        });
      }

      // 플레이리스트에서 자동 생성된 데이터가 DB에 없으면 자동 저장
      if (!hasExistingData && isCurrentOrFutureWeek) {
        try {
          const weekDateKeys2 = getWeekDateKeys(weekStart);
          const autoSaveData: { date_key: string; department: string; shift: string; workers: string[] }[] = [];
          Object.entries(newScheduleData).forEach(([deptId, days]) => {
            Object.entries(days).forEach(([day, shifts]) => {
              const dayIndex = DAYS.indexOf(day);
              if (dayIndex !== -1) {
                const dateKey = weekDateKeys2[dayIndex];
                autoSaveData.push({ date_key: dateKey, department: deptId, shift: 'A', workers: (shifts as ShiftData).A });
                autoSaveData.push({ date_key: dateKey, department: deptId, shift: 'B', workers: (shifts as ShiftData).B });
              }
            });
          });
          if (autoSaveData.length > 0) {
            await supabase
              .from('schedule_data')
              .upsert(autoSaveData, { onConflict: 'date_key,department,shift' });
            console.log('Auto-saved generated schedule data for week:', weekStartKey);
          }
        } catch (e) {
          console.error('Failed to auto-save schedule data:', e);
        }
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
        setNoticeMemoIsPublicLocal(memoRes.data[0].is_public ?? true);
      }

      // 주말 출근 가능 여부 처리
      if (weekendRes.data && weekendRes.data.length > 0) {
        const availability: { [workerName: string]: boolean } = {};
        weekendRes.data.forEach((row) => {
          availability[row.worker_name] = row.is_available;
        });
        setWeekendAvailabilityLocal(availability);
      }

      // 시간휴가 정보 처리
      if (partialVacationRes.data && partialVacationRes.data.length > 0) {
        const partialData: PartialVacationData = {};
        partialVacationRes.data.forEach((row) => {
          if (row.start_time && row.end_time) {
            if (!partialData[row.date_key]) {
              partialData[row.date_key] = {};
            }
            partialData[row.date_key][row.worker_name] = {
              start_time: row.start_time,
              end_time: row.end_time,
            };
          }
        });
        setPartialVacationData(partialData);
      } else {
        setPartialVacationData({});
      }

      // 시간잔업 정보 처리
      if (partialOvertimeRes.data && partialOvertimeRes.data.length > 0) {
        const partialData: PartialOvertimeData = {};
        partialOvertimeRes.data.forEach((row) => {
          if (row.start_time && row.end_time) {
            if (!partialData[row.date_key]) {
              partialData[row.date_key] = {};
            }
            partialData[row.date_key][row.worker_name] = {
              start_time: row.start_time,
              end_time: row.end_time,
            };
          }
        });
        setPartialOvertimeData(partialData);
      } else {
        setPartialOvertimeData({});
      }
    } catch (error) {
      console.error('Failed to load data from database:', error);
      toast.error('데이터 로드에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [weekStart, applyMasterRules]);

  // 주차가 변경되면 데이터 다시 로드
  useEffect(() => {
    if (prevWeekStartKeyRef.current !== weekStartKey) {
      // 주차가 변경됨 - 미저장 변경사항 경고 없이 새 데이터 로드
      prevWeekStartKeyRef.current = weekStartKey;
      setHasUnsavedChanges(false);
    }
    loadData();
  }, [weekStartKey, loadData]);

  // 실시간 구독 설정 (지연된 연결)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    
    const setupRealtime = async () => {
      await waitForRealtimeReady();
      if (!isMounted) return;
      
      const weekDateKeys = getWeekDateKeys(weekStart);
      
      channel = supabase
        .channel(`schedule-realtime-${weekStartKey}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'schedule_data' },
          (payload) => {
            const dateKey = (payload.new as any)?.date_key || (payload.old as any)?.date_key;
            if (weekDateKeys.includes(dateKey)) {
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
              loadData();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notice_memos' },
          () => {
            loadData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'weekend_availability' },
          () => {
            loadData();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'attendance_requests' },
          (payload) => {
            const dateKey = (payload.new as any)?.date_key || (payload.old as any)?.date_key;
            if (weekDateKeys.includes(dateKey)) {
              loadData();
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('Realtime subscription error, will retry on reconnect');
          }
        });
    };
    
    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
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
  const setNoticeMemo = useCallback(async (content: string, isPublic?: boolean) => {
    setNoticeMemoLocal(content);
    if (isPublic !== undefined) {
      setNoticeMemoIsPublicLocal(isPublic);
    }
    
    // 먼저 기존 레코드 확인
    const { data: existingMemo } = await supabase.from('notice_memos').select('id').limit(1);
    
    if (existingMemo && existingMemo.length > 0) {
      const updateData: { content: string; is_public?: boolean } = { content };
      if (isPublic !== undefined) {
        updateData.is_public = isPublic;
      }
      
      const { error } = await supabase
        .from('notice_memos')
        .update(updateData)
        .eq('id', existingMemo[0].id);

      if (error) {
        console.error('Failed to save notice memo:', error);
        toast.error('메모 저장에 실패했습니다');
      } else {
        // 공지사항 수정 시 푸시 알림 발송
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              type: 'notice_update',
              content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
            },
          });
        } catch (pushError) {
          console.error('Failed to send push notification:', pushError);
        }
      }
    }
  }, []);

  // 주말 출근 가능 여부 토글
  const toggleWeekendAvailability = useCallback(async (workerName: string, isAdmin?: boolean) => {
    const currentAvailability = weekendAvailability[workerName] || false;
    const newAvailability = !currentAvailability;
    
    // 즉시 로컬 상태 업데이트
    const updatedAvailability = { ...weekendAvailability, [workerName]: newAvailability };
    setWeekendAvailabilityLocal(updatedAvailability);

    // 토요일 근무표도 즉시 업데이트 (체크 순서대로 맨 위 부서부터 채움)
    setScheduleDataLocal((prev) => {
      const newData = JSON.parse(JSON.stringify(prev));
      
      // 현재 체크된 인원 목록 (새로운 토글 반영)
      // updated_at 순서 유지를 위해 기존 순서 보존 + 새 체크는 맨 끝에 추가
      const currentAvailableWorkers: string[] = [];
      
      // 기존 토요일 배치된 인원 순서 유지 (체크 해제된 인원 제외)
      DEPARTMENTS.forEach((deptId) => {
        const satWorkers = prev[deptId]?.["토"]?.A || [];
        satWorkers.forEach((w: string) => {
          if (w !== workerName && updatedAvailability[w] && !currentAvailableWorkers.includes(w)) {
            currentAvailableWorkers.push(w);
          }
        });
      });
      
      // 새로 체크된 인원은 맨 끝에 추가
      if (newAvailability && !currentAvailableWorkers.includes(workerName)) {
        currentAvailableWorkers.push(workerName);
      }
      
      // 부서별 용량에 따라 순서대로 채움
      const saturdayDeptOrder = [
        { dept: 'foreman', capacity: 2 },
        { dept: 'equipment', capacity: 3 },
        { dept: 'inspection', capacity: 2 },
        { dept: 'logistics', capacity: 1 },
        { dept: 'package', capacity: 4 },
      ];
      
      let workerIdx = 0;
      saturdayDeptOrder.forEach(({ dept, capacity }) => {
        const deptWorkers: string[] = [];
        for (let i = 0; i < capacity && workerIdx < currentAvailableWorkers.length; i++) {
          deptWorkers.push(currentAvailableWorkers[workerIdx]);
          workerIdx++;
        }
        newData[dept]["토"] = { A: deptWorkers, B: [] };
      });
      
      // 용량 초과 인원은 마지막 부서에 추가
      if (workerIdx < currentAvailableWorkers.length) {
        while (workerIdx < currentAvailableWorkers.length) {
          newData['package']["토"].A.push(currentAvailableWorkers[workerIdx]);
          workerIdx++;
        }
      }
      
      return newData;
    });

    // 토요일 출근자 잔업 상태 설정
    const saturdayDateKey = getDateKeyForDay(weekStart, 5);
    if (newAvailability) {
      setWorkerStatusDataLocal((prev) => ({
        ...prev,
        [saturdayDateKey]: {
          ...(prev[saturdayDateKey] || {}),
          [workerName]: 'overtime' as WorkerStatus,
        },
      }));
    }

    const { error } = await supabase
      .from('weekend_availability')
      .upsert(
        { worker_name: workerName, week_key: weekStartKey, is_available: newAvailability, updated_at: new Date().toISOString() },
        { onConflict: 'worker_name,week_key' }
      );

    if (error) {
      console.error('Failed to save weekend availability:', error);
      toast.error('주말 출근 가능 여부 저장에 실패했습니다');
    } else if (!isAdmin) {
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            type: 'weekend_availability',
            workerName,
            newAvailability,
          },
        });
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError);
      }
    }
  }, [weekendAvailability, weekStartKey]);

  // 주말 출근 가능 여부 확인
  const isWeekendAvailable = useCallback((workerName: string) => {
    return weekendAvailability[workerName] || false;
  }, [weekendAvailability]);

  // 현재 주차 데이터 삭제 후 플레이리스트 기준으로 재생성
  const regenerateFromPlaylist = useCallback(async () => {
    const weekDateKeys = getWeekDateKeys(weekStart);
    
    // 1. 현재 주차의 schedule_data 삭제
    const { error: deleteError } = await supabase
      .from('schedule_data')
      .delete()
      .in('date_key', weekDateKeys);
    
    if (deleteError) {
      console.error('Failed to delete schedule data:', deleteError);
      toast.error('근무표 삭제에 실패했습니다');
      return;
    }
    
    // 2. 데이터 다시 로드 (DB에 데이터가 없으므로 플레이리스트 기준으로 자동 생성됨)
    await loadData();
    toast.success('플레이리스트 기준으로 근무표가 재생성되었습니다');
  }, [weekStart, loadData]);

  return {
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
    toggleDayOff,
    noticeMemo,
    noticeMemoIsPublic,
    setNoticeMemo,
    weekendAvailability,
    toggleWeekendAvailability,
    isWeekendAvailable,
    isLoading,
    refreshData: loadData,
    regenerateFromPlaylist,
    getDateKey,
  };
}
