import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  GripVertical, 
  Shuffle, 
  Play, 
  RotateCcw, 
  Calendar,
  User,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useLogisticsPlaylist, PlaylistItem } from '@/hooks/useLogisticsPlaylist';
import { cn } from '@/lib/utils';

export function LogisticsRotationPlaylist() {
  const {
    playlist,
    isLoading,
    updateOrder,
    shufflePlaylist,
    getWeekPreviews,
    getCurrentAssignments,
  } = useLogisticsPlaylist();

  const [draggedItem, setDraggedItem] = useState<PlaylistItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, item: PlaylistItem, index: number) => {
    setDraggedItem(item);
    dragNodeRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // Make drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedItem(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragNodeRef.current === null) return;
    if (dragNodeRef.current !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragNodeRef.current === null || dragNodeRef.current === dropIndex) return;

    const newPlaylist = [...playlist];
    const draggedIdx = dragNodeRef.current;
    const [removed] = newPlaylist.splice(draggedIdx, 1);
    newPlaylist.splice(dropIndex, 0, removed);

    await updateOrder(newPlaylist);
    setDragOverIndex(null);
  };

  const weekPreviews = getWeekPreviews(4);
  const currentAssignments = getCurrentAssignments();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">물류 로테이션 플레이리스트</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                드래그로 순서 변경 • 자동 순환 모드
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <RotateCcw className="h-3 w-3" />
              Loop
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={shufflePlaylist}
              className="gap-1"
            >
              <Shuffle className="h-4 w-4" />
              셔플
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Week Display */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs font-medium text-muted-foreground mb-2">이번 주 배정</p>
          <div className="flex gap-4">
            <div className="flex-1 text-center p-2 rounded-md bg-background">
              <p className="text-[10px] text-muted-foreground">초반조</p>
              <p className="font-bold text-primary">{currentAssignments.earlyShift}</p>
            </div>
            <div className="flex-1 text-center p-2 rounded-md bg-background">
              <p className="text-[10px] text-muted-foreground">중반조</p>
              <p className="font-bold text-primary">{currentAssignments.midShift}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Playlist */}
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-1">
              <User className="h-4 w-4" />
              순환 명단 ({playlist.length}명)
            </p>
            <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
              {playlist.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={(e) => handleDrop(e, index)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md border bg-background cursor-grab active:cursor-grabbing transition-all",
                    draggedItem?.id === item.id && "opacity-50",
                    dragOverIndex === index && draggedItem?.id !== item.id && "border-primary border-2",
                    index === 0 && "border-green-500/50 bg-green-500/5",
                    index === 1 && "border-blue-500/50 bg-blue-500/5"
                  )}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs font-mono text-muted-foreground w-5">
                    {index + 1}
                  </span>
                  <span className="font-medium flex-1">{item.worker_name}</span>
                  {index === 0 && (
                    <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-700">
                      초반
                    </Badge>
                  )}
                  {index === 1 && (
                    <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-700">
                      중반
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Week Preview */}
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              예정 주차 미리보기
            </p>
            <div className="space-y-2">
              {weekPreviews.map((preview) => (
                <div
                  key={preview.weekOffset}
                  className="flex items-center gap-2 p-2 rounded-md border bg-muted/30"
                >
                  <Badge variant="outline" className="text-xs min-w-[70px] justify-center">
                    {preview.weekLabel}
                  </Badge>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <div className="flex-1 flex gap-2 text-sm">
                    <span className="text-green-600 font-medium">{preview.earlyShift}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className="text-blue-600 font-medium">{preview.midShift}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              리스트 끝에 도달하면 처음부터 다시 순환
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
