import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlaylistItem {
  id: string;
  worker_name: string;
  position: number;
}

export interface WeekPreview {
  weekOffset: number;
  weekLabel: string;
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
  const getWeekPreviews = useCallback((numWeeks: number = 4): WeekPreview[] => {
    if (playlist.length < 2) return [];

    const previews: WeekPreview[] = [];
    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + mondayOffset);

    for (let week = 0; week < numWeeks; week++) {
      const weekMonday = new Date(thisMonday);
      weekMonday.setDate(thisMonday.getDate() + (week + 1) * 7);
      
      // Calculate which workers are assigned this week (loop through playlist)
      const earlyIndex = (week * 2) % playlist.length;
      const midIndex = (week * 2 + 1) % playlist.length;

      const weekLabel = `${weekMonday.getMonth() + 1}/${weekMonday.getDate()}주`;

      previews.push({
        weekOffset: week + 1,
        weekLabel,
        earlyShift: playlist[earlyIndex]?.worker_name || '-',
        midShift: playlist[midIndex]?.worker_name || '-',
      });
    }

    return previews;
  }, [playlist]);

  // Get current week's assignments
  const getCurrentAssignments = useCallback(() => {
    if (playlist.length < 2) return { earlyShift: '-', midShift: '-' };
    return {
      earlyShift: playlist[0]?.worker_name || '-',
      midShift: playlist[1]?.worker_name || '-',
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
