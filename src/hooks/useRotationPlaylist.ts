import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfWeek, addWeeks, format, startOfDay } from 'date-fns';

export type DepartmentType = 'logistics' | 'equipment' | 'inspection';

export interface PlaylistItem {
  id: string;
  worker_name: string;
  position: number;
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
};

const DEPARTMENT_LABELS: Record<DepartmentType, string> = {
  logistics: '물류',
  equipment: '설비',
  inspection: '검사',
};

// 부서별 로테이션 인원 수 설정
export const DEPARTMENT_ROTATION_SIZE: Record<DepartmentType, { early: number; mid: number }> = {
  logistics: { early: 1, mid: 1 },    // 물류: 초반 1명, 중반 1명 (총 2명)
  equipment: { early: 3, mid: 3 },    // 설비: 초반 3명, 중반 3명 (총 6명)
  inspection: { early: 2, mid: 2 },   // 검사: 초반 2명, 중반 2명 (총 4명)
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
          .select('id, worker_name, position')
          .order('position', { ascending: true });
        data = result.data;
        error = result.error;
      } else if (department === 'equipment') {
        const result = await supabase
          .from('equipment_rotation_playlist')
          .select('id, worker_name, position')
          .order('position', { ascending: true });
        data = result.data;
        error = result.error;
      } else if (department === 'inspection') {
        const result = await supabase
          .from('inspection_rotation_playlist')
          .select('id, worker_name, position')
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadPlaylist, department, tableName]);

  const updateOrder = useCallback(async (newPlaylist: PlaylistItem[]) => {
    try {
      const updatePromises = newPlaylist.map(async (item, index) => {
        if (department === 'logistics') {
          return supabase.from('logistics_rotation_playlist').update({ position: index }).eq('id', item.id);
        } else if (department === 'equipment') {
          return supabase.from('equipment_rotation_playlist').update({ position: index }).eq('id', item.id);
        } else {
          return supabase.from('inspection_rotation_playlist').update({ position: index }).eq('id', item.id);
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
      } else {
        const result = await supabase.from('inspection_rotation_playlist').insert({ worker_name: workerName, position: newPosition });
        error = result.error;
      }

      if (error) throw error;
      toast.success(`${workerName}이(가) 추가되었습니다`);
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('이미 리스트에 있는 인원입니다');
      } else {
        console.error('Error adding worker:', error);
        toast.error('인원 추가에 실패했습니다');
      }
    }
  }, [playlist.length, tableName]);

  const removeWorker = useCallback(async (workerId: string) => {
    try {
      let error: any = null;

      if (department === 'logistics') {
        const result = await supabase.from('logistics_rotation_playlist').delete().eq('id', workerId);
        error = result.error;
      } else if (department === 'equipment') {
        const result = await supabase.from('equipment_rotation_playlist').delete().eq('id', workerId);
        error = result.error;
      } else {
        const result = await supabase.from('inspection_rotation_playlist').delete().eq('id', workerId);
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
    const today = startOfDay(new Date());
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

    for (let weekOffset = 1; weekOffset <= numWeeks; weekOffset++) {
      const targetWeekStart = addWeeks(currentWeekStart, weekOffset);
      
      const startIndex = (weekOffset * totalPerWeek) % playlist.length;
      
      // 초반조 인원
      const earlyWorkers: string[] = [];
      for (let i = 0; i < rotationSize.early; i++) {
        const idx = (startIndex + i) % playlist.length;
        earlyWorkers.push(playlist[idx]?.worker_name);
      }
      
      // 중반조 인원
      const midWorkers: string[] = [];
      for (let i = 0; i < rotationSize.mid; i++) {
        const idx = (startIndex + rotationSize.early + i) % playlist.length;
        midWorkers.push(playlist[idx]?.worker_name);
      }

      const weekLabel = `${targetWeekStart.getMonth() + 1}/${targetWeekStart.getDate()}주`;
      const dateRange = format(targetWeekStart, 'M/d') + '~';

      previews.push({
        weekOffset,
        weekLabel,
        dateRange,
        earlyShift: earlyWorkers.filter(Boolean).join(', ') || '-',
        midShift: midWorkers.filter(Boolean).join(', ') || '-',
      });
    }

    return previews;
  }, [playlist, department]);

  const getCurrentAssignments = useCallback(() => {
    const rotationSize = DEPARTMENT_ROTATION_SIZE[department];
    const totalPerWeek = rotationSize.early + rotationSize.mid;
    
    if (playlist.length < totalPerWeek) return { earlyShift: '-', midShift: '-' };
    
    // 초반조 인원 (playlist 앞에서부터)
    const earlyWorkers = playlist.slice(0, rotationSize.early).map(p => p.worker_name);
    // 중반조 인원 (초반조 다음부터)
    const midWorkers = playlist.slice(rotationSize.early, totalPerWeek).map(p => p.worker_name);
    
    return {
      earlyShift: earlyWorkers.join(', ') || '-',
      midShift: midWorkers.join(', ') || '-',
    };
  }, [playlist, department]);

  return {
    playlist,
    isLoading,
    updateOrder,
    shufflePlaylist,
    addWorker,
    removeWorker,
    getWeekPreviews,
    getCurrentAssignments,
    refreshPlaylist: loadPlaylist,
    departmentLabel,
  };
}
