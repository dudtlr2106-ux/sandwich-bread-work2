import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  GripVertical, 
  Shuffle, 
  Play, 
  RotateCcw, 
  Calendar,
  User,
  ChevronRight,
  Loader2,
  Plus,
  X,
  Trash2,
  Copy,
  Sun,
  Moon
} from 'lucide-react';
import { useLogisticsPlaylist, useLogisticsCombinedPlaylists, PlaylistItem, ShiftType } from '@/hooks/useLogisticsPlaylist';
import { SORTED_ALL_WORKERS } from '@/hooks/useScheduleData';
import { cn } from '@/lib/utils';

interface ShiftPlaylistProps {
  shiftType: ShiftType;
}

function ShiftPlaylist({ shiftType }: ShiftPlaylistProps) {
  const {
    playlist,
    isLoading,
    updateOrder,
    shufflePlaylist,
    addWorker,
    duplicateWorker,
    removeWorker,
    getCurrentAssignment,
  } = useLogisticsPlaylist(shiftType);

  const [draggedItem, setDraggedItem] = useState<PlaylistItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<number | null>(null);
  
  // Add worker state
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<PlaylistItem | null>(null);

  const handleDragStart = (e: React.DragEvent, item: PlaylistItem, index: number) => {
    setDraggedItem(item);
    dragNodeRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
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

  // All workers (allow duplicates in playlist)
  const filteredSuggestions = SORTED_ALL_WORKERS.filter((worker) =>
    worker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddWorker = async (workerName: string) => {
    await addWorker(workerName);
    setSearchQuery('');
    setShowSuggestions(false);
    setIsAdding(false);
  };

  const handleRemoveWorker = async () => {
    if (deleteTarget) {
      await removeWorker(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const shiftLabel = shiftType === 'early' ? '초반조' : '중반조';
  const shiftColor = shiftType === 'early' ? 'green' : 'blue';
  const currentAssignment = getCurrentAssignment();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Current Week Display */}
        <div className={cn(
          "p-3 rounded-lg border",
          shiftType === 'early' ? "bg-green-500/5 border-green-500/20" : "bg-blue-500/5 border-blue-500/20"
        )}>
          <p className="text-xs font-medium text-muted-foreground mb-2">이번 주 {shiftLabel} 배정</p>
          <div className="text-center p-2 rounded-md bg-background">
            <p className={cn(
              "font-bold text-lg",
              shiftType === 'early' ? "text-green-600" : "text-blue-600"
            )}>
              {currentAssignment}
            </p>
          </div>
        </div>

        {/* Playlist Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium flex items-center gap-1">
            <User className="h-4 w-4" />
            {shiftLabel} 순환 명단 ({playlist.length}명)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={shufflePlaylist}
              className="h-7 px-2 text-xs gap-1"
            >
              <Shuffle className="h-3 w-3" />
              셔플
            </Button>
            {!isAdding && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(true)}
                className="h-7 px-2 text-xs gap-1"
              >
                <Plus className="h-3 w-3" />
                추가
              </Button>
            )}
          </div>
        </div>

        {/* Add Worker Input */}
        {isAdding && (
          <div className="relative">
            <div className="flex gap-1">
              <div className="relative flex-1">
                <Input
                  placeholder="이름 검색..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="h-8 text-sm"
                  autoFocus
                />
                {/* Suggestions dropdown */}
                {showSuggestions && searchQuery && filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {filteredSuggestions.map((worker, idx) => (
                      <button
                        key={`${worker}-${idx}`}
                        onClick={() => handleAddWorker(worker)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                      >
                        {worker}
                      </button>
                    ))}
                  </div>
                )}
                {showSuggestions && searchQuery && filteredSuggestions.length === 0 && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-lg p-2">
                    <p className="text-xs text-muted-foreground text-center">
                      일치하는 인원이 없습니다
                    </p>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setSearchQuery('');
                  setShowSuggestions(false);
                }}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Quick add buttons */}
            {!searchQuery && (
              <div className="mt-2 flex flex-wrap gap-1">
                {SORTED_ALL_WORKERS.slice(0, 6).map((worker, idx) => (
                  <Badge
                    key={`${worker}-${idx}`}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => handleAddWorker(worker)}
                  >
                    + {worker}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Playlist Items */}
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
                "flex items-center gap-2 p-2 rounded-md border bg-background cursor-grab active:cursor-grabbing transition-all group",
                draggedItem?.id === item.id && "opacity-50",
                dragOverIndex === index && draggedItem?.id !== item.id && "border-primary border-2",
                index === 0 && shiftType === 'early' && "border-green-500/50 bg-green-500/5",
                index === 0 && shiftType === 'mid' && "border-blue-500/50 bg-blue-500/5"
              )}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-mono text-muted-foreground w-5">
                {index + 1}
              </span>
              <span className="font-medium flex-1">{item.worker_name}</span>
              {index === 0 && (
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "text-[10px]",
                    shiftType === 'early' ? "bg-green-500/10 text-green-700" : "bg-blue-500/10 text-blue-700"
                  )}
                >
                  이번주
                </Badge>
              )}
              {/* Duplicate button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateWorker(item);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
                title="복제"
              >
                <Copy className="h-3 w-3 text-muted-foreground" />
              </button>
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(item);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
                title="삭제"
              >
                <X className="h-3 w-3 text-destructive" />
              </button>
            </div>
          ))}
          {playlist.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              플레이리스트가 비어있습니다.
              <br />
              인원을 추가해주세요.
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>인원 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.worker_name}</span>님을
              {shiftLabel} 플레이리스트에서 삭제하시겠습니까?
              <br />
              삭제 후에는 로테이션 배정에서 제외됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveWorker}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function LogisticsRotationPlaylist() {
  const { getCurrentAssignments, getWeekPreviews, isLoading } = useLogisticsCombinedPlaylists();
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
                초반조/중반조 별도 관리 • 드래그로 순서 변경
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <RotateCcw className="h-3 w-3" />
            Loop
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Week Overview */}
        <div className="p-3 rounded-lg bg-muted/30 border">
          <p className="text-xs font-medium text-muted-foreground mb-2">이번 주 배정 현황</p>
          <div className="flex gap-4">
            <div className="flex-1 text-center p-2 rounded-md bg-green-500/5 border border-green-500/20">
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Sun className="h-3 w-3" />
                초반조
              </p>
              <p className="font-bold text-green-600">{currentAssignments.earlyShift}</p>
            </div>
            <div className="flex-1 text-center p-2 rounded-md bg-blue-500/5 border border-blue-500/20">
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Moon className="h-3 w-3" />
                중반조
              </p>
              <p className="font-bold text-blue-600">{currentAssignments.midShift}</p>
            </div>
          </div>
        </div>

        {/* Tabs for Early/Mid Shift */}
        <Tabs defaultValue="early" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="early" className="gap-1">
              <Sun className="h-4 w-4" />
              초반조
            </TabsTrigger>
            <TabsTrigger value="mid" className="gap-1">
              <Moon className="h-4 w-4" />
              중반조
            </TabsTrigger>
          </TabsList>
          <TabsContent value="early" className="mt-4">
            <ShiftPlaylist shiftType="early" />
          </TabsContent>
          <TabsContent value="mid" className="mt-4">
            <ShiftPlaylist shiftType="mid" />
          </TabsContent>
        </Tabs>

        {/* Week Preview */}
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2 flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            예정 주차 미리보기
          </p>
          <div className="space-y-2">
            {weekPreviews.length > 0 ? (
              weekPreviews.map((preview) => (
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
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                각 조에 최소 1명 이상 추가해야
                <br />
                미리보기를 확인할 수 있습니다.
              </div>
            )}
          </div>
          {weekPreviews.length > 0 && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              각 조별로 독립적으로 순환
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
