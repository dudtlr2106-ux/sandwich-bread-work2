import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfWeek, addWeeks, format, startOfDay } from 'date-fns';

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

export type ShiftType = 'early' | 'mid';

export function useLogisticsPlaylist(shiftType: ShiftType = 'early') {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tableName = shiftType === 'early' ? 'logistics_rotation_playlist' : 'logistics_mid_rotation_playlist';

  const loadPlaylist = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from(tableName)
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
  }, [tableName]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`logistics_${shiftType}_playlist_changes`)
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
  }, [loadPlaylist, shiftType, tableName]);

  const updateOrder = useCallback(async (newPlaylist: PlaylistItem[]) => {
    try {
      // Update positions in parallel
      const updates = newPlaylist.map((item, index) =>
        supabase
          .from(tableName)
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
  }, [loadPlaylist, tableName]);

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
        .from(tableName)
        .insert({ worker_name: workerName, position: newPosition });

      if (error) throw error;
      toast.success(`${workerName}이(가) 추가되었습니다`);
    } catch (error: any) {
      console.error('Error adding worker:', error);
      toast.error('인원 추가에 실패했습니다');
    }
  }, [playlist.length, tableName]);

  const duplicateWorker = useCallback(async (item: PlaylistItem) => {
    try {
      const newPosition = item.position + 1;
      
      // Increment positions of subsequent items
      const itemsToUpdate = playlist.filter(p => p.position >= newPosition);
      for (const itemToUpdate of itemsToUpdate) {
        await supabase
          .from(tableName)
          .update({ position: itemToUpdate.position + 1 })
          .eq('id', itemToUpdate.id);
      }

      // Insert duplicated worker
      const { error } = await supabase
        .from(tableName)
        .insert({ worker_name: item.worker_name, position: newPosition });

      if (error) throw error;
      toast.success(`${item.worker_name}이(가) 복제되었습니다`);
      loadPlaylist();
    } catch (error) {
      console.error('Error duplicating worker:', error);
      toast.error('복제에 실패했습니다');
      loadPlaylist();
    }
  }, [playlist, tableName, loadPlaylist]);

  const removeWorker = useCallback(async (workerId: string) => {
    try {
      const { error } = await supabase
        .from(tableName)
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
  }, [playlist, updateOrder, tableName]);

  // Get current week's assignment for this shift type
  const getCurrentAssignment = useCallback(() => {
    if (playlist.length < 1) return '-';
    return playlist[0]?.worker_name || '-';
  }, [playlist]);

  // Generate week previews
  const getWeekPreviews = useCallback((numWeeks: number = 4): { weekOffset: number; weekLabel: string; dateRange: string; worker: string }[] => {
    if (playlist.length < 1) return [];

    const previews: { weekOffset: number; weekLabel: string; dateRange: string; worker: string }[] = [];
    const today = startOfDay(new Date());
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

    for (let weekOffset = 1; weekOffset <= numWeeks; weekOffset++) {
      const targetWeekStart = addWeeks(currentWeekStart, weekOffset);
      
      // Calculate which worker is assigned this week
      const workerIndex = weekOffset % playlist.length;

      const weekLabel = `${targetWeekStart.getMonth() + 1}/${targetWeekStart.getDate()}주`;
      const dateRange = format(targetWeekStart, 'M/d') + '~';

      previews.push({
        weekOffset,
        weekLabel,
        dateRange,
        worker: playlist[workerIndex]?.worker_name || '-',
      });
    }

    return previews;
  }, [playlist]);

  return {
    playlist,
    isLoading,
    updateOrder,
    shufflePlaylist,
    addWorker,
    duplicateWorker,
    removeWorker,
    getCurrentAssignment,
    getWeekPreviews,
    refreshPlaylist: loadPlaylist,
    shiftType,
  };
}

// Combined hook for getting both early and mid shift data
export function useLogisticsCombinedPlaylists() {
  const earlyPlaylist = useLogisticsPlaylist('early');
  const midPlaylist = useLogisticsPlaylist('mid');

  const getCurrentAssignments = useCallback(() => {
    return {
      earlyShift: earlyPlaylist.playlist[0]?.worker_name || '-',
      midShift: midPlaylist.playlist[0]?.worker_name || '-',
    };
  }, [earlyPlaylist.playlist, midPlaylist.playlist]);

  const getWeekPreviews = useCallback((numWeeks: number = 4): WeekPreview[] => {
    if (earlyPlaylist.playlist.length < 1 && midPlaylist.playlist.length < 1) return [];

    const previews: WeekPreview[] = [];
    const today = startOfDay(new Date());
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

    for (let weekOffset = 1; weekOffset <= numWeeks; weekOffset++) {
      const targetWeekStart = addWeeks(currentWeekStart, weekOffset);
      
      const earlyIndex = earlyPlaylist.playlist.length > 0 ? weekOffset % earlyPlaylist.playlist.length : -1;
      const midIndex = midPlaylist.playlist.length > 0 ? weekOffset % midPlaylist.playlist.length : -1;

      const weekLabel = `${targetWeekStart.getMonth() + 1}/${targetWeekStart.getDate()}주`;
      const dateRange = format(targetWeekStart, 'M/d') + '~';

      previews.push({
        weekOffset,
        weekLabel,
        dateRange,
        earlyShift: earlyIndex >= 0 ? earlyPlaylist.playlist[earlyIndex]?.worker_name || '-' : '-',
        midShift: midIndex >= 0 ? midPlaylist.playlist[midIndex]?.worker_name || '-' : '-',
      });
    }

    return previews;
  }, [earlyPlaylist.playlist, midPlaylist.playlist]);

  return {
    earlyPlaylist,
    midPlaylist,
    getCurrentAssignments,
    getWeekPreviews,
    isLoading: earlyPlaylist.isLoading || midPlaylist.isLoading,
  };
}
