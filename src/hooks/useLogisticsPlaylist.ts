import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfWeek, addWeeks, format, startOfDay, getDay, getHours, getISOWeek } from 'date-fns';
import { waitForRealtimeReady } from '@/lib/realtimeUtils';

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
}

export interface WeekPreview {
  weekOffset: number;
  weekLabel: string;
  dateRange: string;
  earlyShift: string;
  midShift: string;
}

export function useLogisticsPlaylist() {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlaylist = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('logistics_rotation_playlist')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;
      setPlaylist(data || []);
    } catch (error) {
      console.error('Error loading playlist:', error);
      toast.error('플레이리스트를 불러오는 데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        .channel('logistics_playlist_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'logistics_rotation_playlist',
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
  }, [loadPlaylist]);

  const updateOrder = useCallback(async (newPlaylist: PlaylistItem[]) => {
    try {
      // Update positions in parallel
      const updates = newPlaylist.map((item, index) =>
        supabase
          .from('logistics_rotation_playlist')
          .update({ position: index })
          .eq('id', item.id)
      );

      await Promise.all(updates);
      setPlaylist(newPlaylist);
      toast.success('순서가 저장되었습니다');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('순서 저장에 실패했습니다');
      loadPlaylist(); // Reload on error
    }
  }, [loadPlaylist]);

  const shufflePlaylist = useCallback(async () => {
    const shuffled = [...playlist];
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    await updateOrder(shuffled);
  }, [playlist, updateOrder]);

  const addWorker = useCallback(async (workerName: string) => {
    try {
      const newPosition = playlist.length;
      const { error } = await supabase
        .from('logistics_rotation_playlist')
        .insert({ worker_name: workerName, position: newPosition });

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
  }, [playlist.length]);

  const removeWorker = useCallback(async (workerId: string) => {
    try {
      const { error } = await supabase
        .from('logistics_rotation_playlist')
        .delete()
        .eq('id', workerId);

      if (error) throw error;
      
      // Re-order remaining items
      const remaining = playlist.filter(p => p.id !== workerId);
      if (remaining.length > 0) {
        await updateOrder(remaining);
      }
      toast.success('인원이 제거되었습니다');
    } catch (error) {
      console.error('Error removing worker:', error);
      toast.error('인원 제거에 실패했습니다');
    }
  }, [playlist, updateOrder]);

  // Generate week previews based on current playlist order
  // Uses ISO week number as offset for rotation
  const getWeekPreviews = useCallback((numWeeks: number = 4): WeekPreview[] => {
    if (playlist.length < 2) return [];

    const previews: WeekPreview[] = [];
    // 일요일 13시 기준 주차 전환 적용
    const currentWeekStart = getEffectiveWeekStart();
    const currentWeekNumber = getISOWeek(currentWeekStart);

    for (let weekOffset = 1; weekOffset <= numWeeks; weekOffset++) {
      const targetWeekStart = addWeeks(currentWeekStart, weekOffset);
      const targetWeekNumber = currentWeekNumber + weekOffset;
      
      // 주차 번호를 오프셋으로 사용하여 인원 배열 회전
      const earlyIndex = (targetWeekNumber * 2) % playlist.length;
      const midIndex = (targetWeekNumber * 2 + 1) % playlist.length;

      const weekLabel = `${targetWeekStart.getMonth() + 1}/${targetWeekStart.getDate()}주`;
      const dateRange = format(targetWeekStart, 'M/d') + '~';

      previews.push({
        weekOffset,
        weekLabel,
        dateRange,
        earlyShift: playlist[earlyIndex]?.worker_name || '-',
        midShift: playlist[midIndex]?.worker_name || '-',
      });
    }

    return previews;
  }, [playlist]);

  // Get current week's assignments using ISO week number as offset
  const getCurrentAssignments = useCallback(() => {
    if (playlist.length < 2) return { earlyShift: '-', midShift: '-' };
    
    // 현재 주차 번호를 기반으로 오프셋 계산
    const currentWeekStart = getEffectiveWeekStart();
    const weekNumber = getISOWeek(currentWeekStart);
    
    // 주차 번호를 오프셋으로 사용하여 인원 배열 회전
    const earlyIndex = (weekNumber * 2) % playlist.length;
    const midIndex = (weekNumber * 2 + 1) % playlist.length;
    
    return {
      earlyShift: playlist[earlyIndex]?.worker_name || '-',
      midShift: playlist[midIndex]?.worker_name || '-',
    };
  }, [playlist]);

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
  };
}
