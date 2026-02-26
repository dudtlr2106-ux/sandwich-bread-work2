import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  RotateCcw, 
  Calendar,
  User,
  ChevronRight,
  Loader2,
  Plus,
  X,
  Trash2,
  CheckSquare,
  Truck,
  Wrench,
  ClipboardCheck,
  Copy,
  Package,
  UserX,
  ListOrdered,
  Check,
} from 'lucide-react';
import { useRotationPlaylist, DepartmentType, PlaylistItem, DEPARTMENT_ROTATION_SIZE } from '@/hooks/useRotationPlaylist';
import { startOfWeek, startOfDay, getDay, getHours, addWeeks, getISOWeek } from 'date-fns';
import { SORTED_ALL_WORKERS } from '@/hooks/useScheduleData';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// 회전된 리스트에서의 시프트 타입 (상단부터 early, mid 순)
const getShiftTypeByDisplayIndex = (displayIndex: number, department: DepartmentType, playlistLength: number): 'early' | 'mid' | null => {
  const size = DEPARTMENT_ROTATION_SIZE[department];
  const totalPerWeek = size.early + size.mid;
  if (playlistLength < totalPerWeek) return null;
  if (displayIndex < size.early) return 'early';
  if (displayIndex < totalPerWeek) return 'mid';
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
  package: {
    icon: <Package className="h-5 w-5" />,
    title: '패키지',
    colorClass: 'text-amber-600',
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
    removeAll,
    removeSelected,
    getWeekPreviews,
    getCurrentAssignments,
    toggleDummy,
    addDummy,
  } = useRotationPlaylist(department);

  const config = DEPARTMENT_CONFIG[department];

  // 현재 주차 번호 계산
  const currentWeekNumber = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const effective = (getDay(now) === 0 && getHours(now) >= 13) ? addWeeks(weekStart, 1) : weekStart;
    return getISOWeek(effective);
  }, []);

  // 플레이리스트를 현재 주차 기준으로 회전하여 표시 (음악 플레이리스트처럼)
  const { rotatedPlaylist, startIndex: rotationStartIndex } = useMemo(() => {
    const size = DEPARTMENT_ROTATION_SIZE[department];
    const totalPerWeek = size.early + size.mid;
    if (playlist.length < totalPerWeek) return { rotatedPlaylist: playlist.map((item, i) => ({ item, originalIndex: i })), startIndex: 0 };
    
    const startIdx = (currentWeekNumber * totalPerWeek) % playlist.length;
    const rotated = [];
    for (let i = 0; i < playlist.length; i++) {
      const originalIdx = (startIdx + i) % playlist.length;
      rotated.push({ item: playlist[originalIdx], originalIndex: originalIdx });
    }
    return { rotatedPlaylist: rotated, startIndex: startIdx };
  }, [playlist, currentWeekNumber, department]);

  const shiftType = (displayIndex: number) => getShiftTypeByDisplayIndex(displayIndex, department, playlist.length);

  const [draggedItem, setDraggedItem] = useState<PlaylistItem | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<number | null>(null);
  
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlaylistItem | null>(null);
  const [team3Workers, setTeam3Workers] = useState<string[]>([]);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editOrderValues, setEditOrderValues] = useState<Record<string, string>>({});
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // 패키지 부서의 경우 3조 인원만 로드
  useEffect(() => {
    if (department === 'package') {
      const loadTeam3Workers = async () => {
        const { data, error } = await supabase
          .from('team_members')
          .select('worker_name')
          .eq('role', '3조')
          .order('team', { ascending: true });
        
        if (!error && data) {
          setTeam3Workers(data.map(d => d.worker_name));
        }
      };
      loadTeam3Workers();
    }
  }, [department]);

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

  // 패키지 부서는 3조 인원만, 나머지 부서는 전체 인원
  const baseWorkers = department === 'package' ? team3Workers : SORTED_ALL_WORKERS;
  const availableWorkers = baseWorkers.filter(
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

  const handleStartEditOrder = () => {
    const values: Record<string, string> = {};
    playlist.forEach((item, idx) => {
      values[item.id] = String(idx + 1);
    });
    setEditOrderValues(values);
    setIsEditingOrder(true);
  };

  const handleApplyEditOrder = async () => {
    // Build array of { item, newPosition }
    const entries = playlist.map((item) => ({
      item,
      newPos: parseInt(editOrderValues[item.id] || '0', 10),
    }));
    
    // Validate all values are valid numbers in range
    const len = playlist.length;
    const allValid = entries.every(e => !isNaN(e.newPos) && e.newPos >= 1 && e.newPos <= len);
    if (!allValid) return;

    // Sort by new position to create new order
    entries.sort((a, b) => a.newPos - b.newPos);
    const newPlaylist = entries.map(e => e.item);
    await updateOrder(newPlaylist);
    setIsEditingOrder(false);
    setEditOrderValues({});
  };
  const handleRemoveWorker = async () => {
    if (deleteTarget) {
      await removeWorker(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    await removeSelected(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsSelecting(false);
  };

  const handleDeleteAll = async () => {
    await removeAll();
    setDeleteAllConfirm(false);
    setIsSelecting(false);
    setSelectedIds(new Set());
  };

  const weekPreviews = getWeekPreviews(12);
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
              </div>
            </div>
            <Badge variant="outline" className="gap-1">
              <RotateCcw className="h-3 w-3" />
              Loop
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Playlist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium flex items-center gap-1">
                  <User className="h-4 w-4" />
                  순환 명단 ({playlist.length}명)
                </p>
                <div className="flex gap-1">
                  {!isEditingOrder ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStartEditOrder}
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                      title="순서 편집"
                    >
                      <ListOrdered className="h-3 w-3" />
                      순서편집
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleApplyEditOrder}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Check className="h-3 w-3" />
                        적용
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setIsEditingOrder(false); setEditOrderValues({}); }}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        취소
                      </Button>
                    </div>
                  )}
                  {!isSelecting ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsSelecting(true)}
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                      title="선택 삭제"
                      disabled={playlist.length === 0}
                    >
                      <CheckSquare className="h-3 w-3" />
                      선택
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteSelected}
                        className="h-7 px-2 text-xs gap-1"
                        disabled={selectedIds.size === 0}
                      >
                        <Trash2 className="h-3 w-3" />
                        삭제({selectedIds.size})
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setIsSelecting(false); setSelectedIds(new Set()); }}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        취소
                      </Button>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteAllConfirm(true)}
                    className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
                    title="전체 삭제"
                    disabled={playlist.length === 0}
                  >
                    <Trash2 className="h-3 w-3" />
                    전체삭제
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addDummy()}
                    className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                    title="공석 추가"
                  >
                    <UserX className="h-3 w-3" />
                    공석
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

              <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
                {rotatedPlaylist.map(({ item, originalIndex }, displayIndex) => (
                  <div
                    key={item.id}
                    draggable={!isEditingOrder && !isSelecting}
                    onDragStart={(e) => !isEditingOrder && !isSelecting && handleDragStart(e, item, originalIndex)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, originalIndex)}
                    onDrop={(e) => handleDrop(e, originalIndex)}
                    onClick={isSelecting ? () => handleToggleSelect(item.id) : undefined}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md border bg-background transition-all group",
                      !isEditingOrder && !isSelecting && "cursor-grab active:cursor-grabbing",
                      isSelecting && "cursor-pointer",
                      isSelecting && selectedIds.has(item.id) && "border-primary bg-primary/5",
                      draggedItem?.id === item.id && "opacity-50",
                      dragOverIndex === originalIndex && draggedItem?.id !== item.id && "border-primary border-2",
                      item.is_dummy && "bg-muted/50 border-dashed opacity-70",
                      !item.is_dummy && shiftType(displayIndex) === 'early' && "border-green-500/50 bg-green-500/5",
                      !item.is_dummy && shiftType(displayIndex) === 'mid' && "border-blue-500/50 bg-blue-500/5"
                    )}
                  >
                    {isSelecting && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="h-4 w-4 flex-shrink-0 accent-primary"
                      />
                    )}
                    {!isEditingOrder && !isSelecting && <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    {isEditingOrder ? (
                      <input
                        type="number"
                        min={1}
                        max={playlist.length}
                        value={editOrderValues[item.id] || ''}
                        onChange={(e) => setEditOrderValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                        className="w-8 h-6 text-xs font-mono text-center border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <span className="text-xs font-mono text-muted-foreground w-5">
                        {displayIndex + 1}
                      </span>
                    )}
                    <span className={cn("font-medium flex-1", item.is_dummy && "text-muted-foreground italic")}>
                      {item.is_dummy ? `(공석)` : item.worker_name}
                    </span>
                    {item.is_dummy ? (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                        공석
                      </Badge>
                    ) : (
                      <>
                        {shiftType(displayIndex) === 'early' && (
                          <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-700">
                            초반
                          </Badge>
                        )}
                        {shiftType(displayIndex) === 'mid' && (
                          <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-700">
                            중반
                          </Badge>
                        )}
                      </>
                    )}
                    {/* 공석 토글 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDummy(item);
                      }}
                      className={cn(
                        "opacity-0 group-hover:opacity-100 p-1 rounded transition-all",
                        item.is_dummy ? "hover:bg-primary/10" : "hover:bg-muted"
                      )}
                      title={item.is_dummy ? "공석 해제" : "공석으로 설정"}
                    >
                      <UserX className={cn("h-3 w-3", item.is_dummy ? "text-primary" : "text-muted-foreground")} />
                    </button>
                    {!item.is_dummy && (
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
                    )}
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
                미리보기
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

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>전체 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {config.title} 순환 명단의 <span className="font-semibold text-foreground">{playlist.length}명</span> 전체를 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              className="bg-destructive hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              전체 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
