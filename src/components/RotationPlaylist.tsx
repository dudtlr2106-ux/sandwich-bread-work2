import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Truck,
  Wrench,
  ClipboardCheck,
  Copy
} from 'lucide-react';
import { useRotationPlaylist, DepartmentType, PlaylistItem, DEPARTMENT_ROTATION_SIZE } from '@/hooks/useRotationPlaylist';
import { SORTED_ALL_WORKERS } from '@/hooks/useScheduleData';
import { cn } from '@/lib/utils';

// 인덱스에 따른 시프트 타입 반환
const getShiftType = (index: number, department: DepartmentType): 'early' | 'mid' | null => {
  const size = DEPARTMENT_ROTATION_SIZE[department];
  if (index < size.early) return 'early';
  if (index < size.early + size.mid) return 'mid';
  return null;
};

interface RotationPlaylistProps {
  department: DepartmentType;
}

const DEPARTMENT_CONFIG: Record<DepartmentType, { 
  icon: React.ReactNode; 
  title: string;
  colorClass: string;
}> = {
  logistics: {
    icon: <Truck className="h-5 w-5" />,
    title: '물류',
    colorClass: 'text-blue-600',
  },
  equipment: {
    icon: <Wrench className="h-5 w-5" />,
    title: '설비',
    colorClass: 'text-orange-600',
  },
  inspection: {
    icon: <ClipboardCheck className="h-5 w-5" />,
    title: '검사',
    colorClass: 'text-purple-600',
  },
  foreman: {
    icon: <User className="h-5 w-5" />,
    title: '반장',
    colorClass: 'text-green-600',
  },
};

export function RotationPlaylist({ department }: RotationPlaylistProps) {
  const {
    playlist,
    isLoading,
    updateOrder,
    shufflePlaylist,
    addWorker,
    duplicateWorker,
    removeWorker,
    getWeekPreviews,
    getCurrentAssignments,
  } = useRotationPlaylist(department);

  const config = DEPARTMENT_CONFIG[department];

  const [draggedItem, setDraggedItem] = useState<PlaylistItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<number | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
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

  const availableWorkers = SORTED_ALL_WORKERS.filter(
    (worker) => !playlist.some((p) => p.worker_name === worker)
  );

  const filteredSuggestions = availableWorkers.filter((worker) =>
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
    <>
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("p-2 rounded-lg bg-primary/10", config.colorClass)}>
                {config.icon}
              </div>
              <div>
                <CardTitle className="text-lg">{config.title}</CardTitle>
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <User className="h-4 w-4" />
                  순환 명단 ({playlist.length}명)
                </p>
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

              {/* Add Worker Input */}
              {isAdding && (
                <div className="mb-2 relative">
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
                      {showSuggestions && searchQuery && filteredSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {filteredSuggestions.map((worker) => (
                            <button
                              key={worker}
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
                  {!searchQuery && availableWorkers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {availableWorkers.slice(0, 6).map((worker) => (
                        <Badge
                          key={worker}
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
                      getShiftType(index, department) === 'early' && "border-green-500/50 bg-green-500/5",
                      getShiftType(index, department) === 'mid' && "border-blue-500/50 bg-blue-500/5"
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-mono text-muted-foreground w-5">
                      {index + 1}
                    </span>
                    <span className="font-medium flex-1">{item.worker_name}</span>
                    {getShiftType(index, department) === 'early' && (
                      <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-700">
                        초반
                      </Badge>
                    )}
                    {getShiftType(index, department) === 'mid' && (
                      <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-700">
                        중반
                      </Badge>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateWorker(item);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-primary/10 transition-all"
                      title="복제"
                    >
                      <Copy className="h-3 w-3 text-primary" />
                    </button>
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

            {/* Week Preview */}
            <div>
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
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    최소 2명 이상 추가해야
                    <br />
                    미리보기를 확인할 수 있습니다.
                  </div>
                )}
              </div>
              {weekPreviews.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-2 text-center">
                  리스트 끝에 도달하면 처음부터 다시 순환
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>인원 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.worker_name}</span>님을
              플레이리스트에서 삭제하시겠습니까?
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
