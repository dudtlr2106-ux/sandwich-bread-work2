import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfWeek, addWeeks, format, startOfDay, getDay, getHours, getISOWeek } from 'date-fns';
import { waitForRealtimeReady } from '@/lib/realtimeUtils';

export type DepartmentType = 'logistics' | 'equipment' | 'inspection' | 'foreman' | 'package';

// 일요일 13시 이후면 다음 주를 "이번 주"로 간주
const getEffectiveWeekStart = (): Date => {
  const now = new Date();
  const today = startOfDay(now);
  const standardWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  
  // 일요일(0)이고 13시 이상이면 다음 주로 간주
  if (getDay(now) === 0 && getHours(now) >= 13) {
    return addWeeks(standardWeekStart, 1);
  }
  
  return standardWeekStart;
};

export interface PlaylistItem {
  id: string;
  worker_name: string;
  position: number;
  is_dummy: boolean;
}

export interface WeekPreview {
  weekOffset: number;
  weekLabel: string;
  dateRange: string;
  earlyShift: string;
  midShift: string;
}

const TABLE_NAMES: Record<DepartmentType, string> = {
  logistics: 'logistics_rotation_playlist',
  equipment: 'equipment_rotation_playlist',
  inspection: 'inspection_rotation_playlist',
  foreman: 'foreman_rotation_playlist',
  package: 'package_rotation_playlist',
};

const DEPARTMENT_LABELS: Record<DepartmentType, string> = {
  logistics: '물류',
  equipment: '설비',
  inspection: '검사',
  foreman: '반장',
  package: '패키지',
};

// 부서별 로테이션 인원 수 설정
export const DEPARTMENT_ROTATION_SIZE: Record<DepartmentType, { early: number; mid: number }> = {
  logistics: { early: 1, mid: 1 },    // 물류: 초반 1명, 중반 1명 (총 2명)
  equipment: { early: 3, mid: 3 },    // 설비: 초반 3명, 중반 3명 (총 6명)
  inspection: { early: 2, mid: 2 },   // 검사: 초반 2명, 중반 2명 (총 4명)
  foreman: { early: 2, mid: 2 },      // 반장: 초반 2명, 중반 2명 (총 4명)
  package: { early: 4, mid: 4 },      // 패키지: 초반 4명, 중반 4명 (총 8명) - 3조 전용
};

export function useRotationPlaylist(department: DepartmentType) {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tableName = TABLE_NAMES[department];
  const departmentLabel = DEPARTMENT_LABELS[department];

  const loadPlaylist = useCallback(async () => {
    try {
      let data: PlaylistItem[] | null = null;
      let error: any = null;

      if (department === 'logistics') {
        const result = await supabase
          .from('logistics_rotation_playlist')
          .select('id, worker_name, position, is_dummy')
          .order('position', { ascending: true });
        data = result.data;
        error = result.error;
      } else if (department === 'equipment') {
        const result = await supabase
          .from('equipment_rotation_playlist')
          .select('id, worker_name, position, is_dummy')
          .order('position', { ascending: true });
        data = result.data;
        error = result.error;
      } else if (department === 'inspection') {
        const result = await supabase
          .from('inspection_rotation_playlist')
          .select('id, worker_name, position, is_dummy')
          .order('position', { ascending: true });
        data = result.data;
        error = result.error;
      } else if (department === 'foreman') {
        const result = await supabase
          .from('foreman_rotation_playlist')
          .select('id, worker_name, position, is_dummy')
          .order('position', { ascending: true });
        data = result.data;
        error = result.error;
      } else if (department === 'package') {
        const result = await supabase
          .from('package_rotation_playlist')
          .select('id, worker_name, position, is_dummy')
          .order('position', { ascending: true });
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      setPlaylist(data || []);
    } catch (error) {
      console.error(`Error loading ${department} playlist:`, error);
      toast.error(`${departmentLabel} 플레이리스트를 불러오는 데 실패했습니다`);
    } finally {
      setIsLoading(false);
    }
  }, [tableName, department, departmentLabel]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  // Realtime subscription (delayed)
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    
    const setupRealtime = async () => {
      await waitForRealtimeReady();
      if (!isMounted) return;
      
      channel = supabase
        .channel(`${department}_playlist_changes`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: tableName,
          },
          () => {
            loadPlaylist();
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
  }, [loadPlaylist, department, tableName]);

  const updateOrder = useCallback(async (newPlaylist: PlaylistItem[]) => {
    try {
      const updatePromises = newPlaylist.map(async (item, index) => {
        if (department === 'logistics') {
          return supabase.from('logistics_rotation_playlist').update({ position: index }).eq('id', item.id);
        } else if (department === 'equipment') {
          return supabase.from('equipment_rotation_playlist').update({ position: index }).eq('id', item.id);
        } else if (department === 'inspection') {
          return supabase.from('inspection_rotation_playlist').update({ position: index }).eq('id', item.id);
        } else if (department === 'foreman') {
          return supabase.from('foreman_rotation_playlist').update({ position: index }).eq('id', item.id);
        } else {
          return supabase.from('package_rotation_playlist').update({ position: index }).eq('id', item.id);
        }
      });

      await Promise.all(updatePromises);
      setPlaylist(newPlaylist);
      toast.success('순서가 저장되었습니다');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('순서 저장에 실패했습니다');
      loadPlaylist();
    }
  }, [loadPlaylist, tableName]);

  const shufflePlaylist = useCallback(async () => {
    const shuffled = [...playlist];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    await updateOrder(shuffled);
  }, [playlist, updateOrder]);

  const addWorker = useCallback(async (workerName: string) => {
    try {
      const newPosition = playlist.length;
      let error: any = null;

      if (department === 'logistics') {
        const result = await supabase.from('logistics_rotation_playlist').insert({ worker_name: workerName, position: newPosition });
        error = result.error;
      } else if (department === 'equipment') {
        const result = await supabase.from('equipment_rotation_playlist').insert({ worker_name: workerName, position: newPosition });
        error = result.error;
      } else if (department === 'inspection') {
        const result = await supabase.from('inspection_rotation_playlist').insert({ worker_name: workerName, position: newPosition });
        error = result.error;
      } else if (department === 'foreman') {
        const result = await supabase.from('foreman_rotation_playlist').insert({ worker_name: workerName, position: newPosition });
        error = result.error;
      } else {
        const result = await supabase.from('package_rotation_playlist').insert({ worker_name: workerName, position: newPosition });
        error = result.error;
      }

      if (error) throw error;
      toast.success(`${workerName}이(가) 추가되었습니다`);
    } catch (error: any) {
      console.error('Error adding worker:', error);
      toast.error('인원 추가에 실패했습니다');
    }
  }, [playlist.length, tableName]);

  const duplicateWorker = useCallback(async (item: PlaylistItem) => {
    try {
      // 현재 아이템 다음 위치에 삽입
      const newPosition = item.position + 1;
      
      // 뒤에 있는 모든 아이템들의 position을 1씩 증가
      const itemsToUpdate = playlist.filter(p => p.position >= newPosition);
      
      for (const updateItem of itemsToUpdate) {
        if (department === 'logistics') {
          await supabase.from('logistics_rotation_playlist').update({ position: updateItem.position + 1 }).eq('id', updateItem.id);
        } else if (department === 'equipment') {
          await supabase.from('equipment_rotation_playlist').update({ position: updateItem.position + 1 }).eq('id', updateItem.id);
        } else if (department === 'inspection') {
          await supabase.from('inspection_rotation_playlist').update({ position: updateItem.position + 1 }).eq('id', updateItem.id);
        } else if (department === 'foreman') {
          await supabase.from('foreman_rotation_playlist').update({ position: updateItem.position + 1 }).eq('id', updateItem.id);
        } else {
          await supabase.from('package_rotation_playlist').update({ position: updateItem.position + 1 }).eq('id', updateItem.id);
        }
      }
      
      // 새 아이템 삽입
      let error: any = null;
      if (department === 'logistics') {
        const result = await supabase.from('logistics_rotation_playlist').insert({ worker_name: item.worker_name, position: newPosition });
        error = result.error;
      } else if (department === 'equipment') {
        const result = await supabase.from('equipment_rotation_playlist').insert({ worker_name: item.worker_name, position: newPosition });
        error = result.error;
      } else if (department === 'inspection') {
        const result = await supabase.from('inspection_rotation_playlist').insert({ worker_name: item.worker_name, position: newPosition });
        error = result.error;
      } else if (department === 'foreman') {
        const result = await supabase.from('foreman_rotation_playlist').insert({ worker_name: item.worker_name, position: newPosition });
        error = result.error;
      } else {
        const result = await supabase.from('package_rotation_playlist').insert({ worker_name: item.worker_name, position: newPosition });
        error = result.error;
      }

      if (error) throw error;
      toast.success(`${item.worker_name}이(가) 복제되었습니다`);
      loadPlaylist();
    } catch (error) {
      console.error('Error duplicating worker:', error);
      toast.error('복제에 실패했습니다');
      loadPlaylist();
    }
  }, [playlist, department, loadPlaylist]);

  const removeWorker = useCallback(async (workerId: string) => {
    try {
      let error: any = null;

      if (department === 'logistics') {
        const result = await supabase.from('logistics_rotation_playlist').delete().eq('id', workerId);
        error = result.error;
      } else if (department === 'equipment') {
        const result = await supabase.from('equipment_rotation_playlist').delete().eq('id', workerId);
        error = result.error;
      } else if (department === 'inspection') {
        const result = await supabase.from('inspection_rotation_playlist').delete().eq('id', workerId);
        error = result.error;
      } else if (department === 'foreman') {
        const result = await supabase.from('foreman_rotation_playlist').delete().eq('id', workerId);
        error = result.error;
      } else {
        const result = await supabase.from('package_rotation_playlist').delete().eq('id', workerId);
        error = result.error;
      }

      if (error) throw error;
      
      const remaining = playlist.filter(p => p.id !== workerId);
      if (remaining.length > 0) {
        await updateOrder(remaining);
      }
      toast.success('인원이 제거되었습니다');
    } catch (error) {
      console.error('Error removing worker:', error);
      toast.error('인원 제거에 실패했습니다');
    }
  }, [playlist, updateOrder, tableName]);

  const getWeekPreviews = useCallback((numWeeks: number = 4): WeekPreview[] => {
    const rotationSize = DEPARTMENT_ROTATION_SIZE[department];
    const totalPerWeek = rotationSize.early + rotationSize.mid;
    
    if (playlist.length < totalPerWeek) return [];

    const previews: WeekPreview[] = [];
    // 일요일 13시 기준 주차 전환 적용
    const currentWeekStart = getEffectiveWeekStart();
    const currentWeekNumber = getISOWeek(currentWeekStart);

    for (let weekOffset = 0; weekOffset < numWeeks; weekOffset++) {
      const targetWeekStart = addWeeks(currentWeekStart, weekOffset);
      const targetWeekNumber = currentWeekNumber + weekOffset;
      
      // 주차 번호를 오프셋으로 사용하여 인원 배열 회전
      const startIndex = (targetWeekNumber * totalPerWeek) % playlist.length;
      
      // 초반조 인원 (더미 제외)
      const earlyWorkers: string[] = [];
      for (let i = 0; i < rotationSize.early; i++) {
        const idx = (startIndex + i) % playlist.length;
        const item = playlist[idx];
        if (item && !item.is_dummy) {
          earlyWorkers.push(item.worker_name);
        }
      }
      
      // 중반조 인원 (더미 제외)
      const midWorkers: string[] = [];
      for (let i = 0; i < rotationSize.mid; i++) {
        const idx = (startIndex + rotationSize.early + i) % playlist.length;
        const item = playlist[idx];
        if (item && !item.is_dummy) {
          midWorkers.push(item.worker_name);
        }
      }

      const weekLabel = `${targetWeekStart.getMonth() + 1}/${targetWeekStart.getDate()}주`;
      const dateRange = format(targetWeekStart, 'M/d') + '~';

      previews.push({
        weekOffset,
        weekLabel,
        dateRange,
        earlyShift: earlyWorkers.length > 0 ? earlyWorkers.join(', ') : '-',
        midShift: midWorkers.length > 0 ? midWorkers.join(', ') : '-',
      });
    }

    return previews;
  }, [playlist, department]);

  const getCurrentAssignments = useCallback(() => {
    const rotationSize = DEPARTMENT_ROTATION_SIZE[department];
    const totalPerWeek = rotationSize.early + rotationSize.mid;
    
    if (playlist.length < totalPerWeek) return { earlyShift: '-', midShift: '-' };
    
    // 현재 주차 번호를 기반으로 오프셋 계산
    const currentWeekStart = getEffectiveWeekStart();
    const weekNumber = getISOWeek(currentWeekStart);
    
    // 주차 번호를 오프셋으로 사용하여 인원 배열 회전
    const startIndex = (weekNumber * totalPerWeek) % playlist.length;
    
    // 초반조 인원 (더미 제외)
    const earlyWorkers: string[] = [];
    for (let i = 0; i < rotationSize.early; i++) {
      const idx = (startIndex + i) % playlist.length;
      const item = playlist[idx];
      if (item && !item.is_dummy) {
        earlyWorkers.push(item.worker_name);
      }
    }
    
    // 중반조 인원 (더미 제외)
    const midWorkers: string[] = [];
    for (let i = 0; i < rotationSize.mid; i++) {
      const idx = (startIndex + rotationSize.early + i) % playlist.length;
      const item = playlist[idx];
      if (item && !item.is_dummy) {
        midWorkers.push(item.worker_name);
      }
    }
    
    return {
      earlyShift: earlyWorkers.length > 0 ? earlyWorkers.join(', ') : '-',
      midShift: midWorkers.length > 0 ? midWorkers.join(', ') : '-',
    };
  }, [playlist, department]);

  // 더미(공석) 토글 함수
  const toggleDummy = useCallback(async (item: PlaylistItem) => {
    try {
      const newIsDummy = !item.is_dummy;
      let error: any = null;

      if (department === 'logistics') {
        const result = await supabase.from('logistics_rotation_playlist').update({ is_dummy: newIsDummy }).eq('id', item.id);
        error = result.error;
      } else if (department === 'equipment') {
        const result = await supabase.from('equipment_rotation_playlist').update({ is_dummy: newIsDummy }).eq('id', item.id);
        error = result.error;
      } else if (department === 'inspection') {
        const result = await supabase.from('inspection_rotation_playlist').update({ is_dummy: newIsDummy }).eq('id', item.id);
        error = result.error;
      } else if (department === 'foreman') {
        const result = await supabase.from('foreman_rotation_playlist').update({ is_dummy: newIsDummy }).eq('id', item.id);
        error = result.error;
      } else {
        const result = await supabase.from('package_rotation_playlist').update({ is_dummy: newIsDummy }).eq('id', item.id);
        error = result.error;
      }

      if (error) throw error;
      toast.success(newIsDummy ? '공석으로 설정되었습니다' : '공석이 해제되었습니다');
      loadPlaylist();
    } catch (error) {
      console.error('Error toggling dummy:', error);
      toast.error('상태 변경에 실패했습니다');
    }
  }, [department, loadPlaylist]);

  // 더미(공석) 추가 함수
  const addDummy = useCallback(async () => {
    try {
      const newPosition = playlist.length;
      const dummyName = `공석${newPosition + 1}`;
      let error: any = null;

      if (department === 'logistics') {
        const result = await supabase.from('logistics_rotation_playlist').insert({ worker_name: dummyName, position: newPosition, is_dummy: true });
        error = result.error;
      } else if (department === 'equipment') {
        const result = await supabase.from('equipment_rotation_playlist').insert({ worker_name: dummyName, position: newPosition, is_dummy: true });
        error = result.error;
      } else if (department === 'inspection') {
        const result = await supabase.from('inspection_rotation_playlist').insert({ worker_name: dummyName, position: newPosition, is_dummy: true });
        error = result.error;
      } else if (department === 'foreman') {
        const result = await supabase.from('foreman_rotation_playlist').insert({ worker_name: dummyName, position: newPosition, is_dummy: true });
        error = result.error;
      } else {
        const result = await supabase.from('package_rotation_playlist').insert({ worker_name: dummyName, position: newPosition, is_dummy: true });
        error = result.error;
      }

      if (error) throw error;
      toast.success('공석이 추가되었습니다');
    } catch (error) {
      console.error('Error adding dummy:', error);
      toast.error('공석 추가에 실패했습니다');
    }
  }, [playlist.length, department]);

  return {
    playlist,
    isLoading,
    updateOrder,
    shufflePlaylist,
    addWorker,
    duplicateWorker,
    removeWorker,
    getWeekPreviews,
    getCurrentAssignments,
    refreshPlaylist: loadPlaylist,
    departmentLabel,
    toggleDummy,
    addDummy,
  };
}
