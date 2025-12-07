import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Calendar,
  Users,
  Wrench,
  Search,
  Package,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Edit2,
} from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, addDays } from "date-fns";
import { ko } from "date-fns/locale";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

interface Department {
  id: string;
  name: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
  badgeClass: string;
}

const departments: Department[] = [
  {
    id: "equipment",
    name: "설비",
    count: 3,
    icon: <Wrench className="h-4 w-4" />,
    colorClass: "department-equipment",
    badgeClass: "bg-equipment text-primary-foreground",
  },
  {
    id: "inspection",
    name: "검사",
    count: 2,
    icon: <Search className="h-4 w-4" />,
    colorClass: "department-inspection",
    badgeClass: "bg-inspection text-primary-foreground",
  },
  {
    id: "logistics",
    name: "물류",
    count: 1,
    icon: <Package className="h-4 w-4" />,
    colorClass: "department-logistics",
    badgeClass: "bg-logistics text-primary-foreground",
  },
];

type ScheduleData = {
  [key: string]: {
    [key: string]: string[];
  };
};

const initialScheduleData: ScheduleData = {
  equipment: {
    월: ["김철수", "이영희", "박민수"],
    화: ["김철수", "이영희", "박민수"],
    수: ["김철수", "이영희", "박민수"],
    목: ["김철수", "이영희", "박민수"],
    금: ["김철수", "이영희", "박민수"],
    토: ["김철수"],
    일: [],
  },
  inspection: {
    월: ["최지은", "정현우"],
    화: ["최지은", "정현우"],
    수: ["최지은", "정현우"],
    목: ["최지은", "정현우"],
    금: ["최지은", "정현우"],
    토: ["최지은"],
    일: [],
  },
  logistics: {
    월: ["한승민"],
    화: ["한승민"],
    수: ["한승민"],
    목: ["한승민"],
    금: ["한승민"],
    토: [],
    일: [],
  },
};

const WeeklySchedule = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [scheduleData, setScheduleData] = useState<ScheduleData>(initialScheduleData);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    deptId: string;
    day: string;
  } | null>(null);
  const [editingWorkers, setEditingWorkers] = useState<string[]>([]);
  const [newWorkerName, setNewWorkerName] = useState("");

  const goToPreviousWeek = () => {
    setCurrentWeekStart((prev) => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart((prev) => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const getDateForDay = (dayIndex: number) => {
    return addDays(currentWeekStart, dayIndex);
  };

  const formatWeekRange = () => {
    const weekEnd = addDays(currentWeekStart, 6);
    return `${format(currentWeekStart, "yyyy년 M월 d일", { locale: ko })} ~ ${format(weekEnd, "M월 d일", { locale: ko })}`;
  };

  const getDayHeaderClass = (day: string) => {
    if (day === "토") return "text-saturday font-semibold";
    if (day === "일") return "text-sunday font-semibold";
    return "text-foreground font-semibold";
  };

  const openEditDialog = (deptId: string, day: string) => {
    setEditingCell({ deptId, day });
    setEditingWorkers([...(scheduleData[deptId]?.[day] || [])]);
    setNewWorkerName("");
    setEditDialogOpen(true);
  };

  const addWorker = () => {
    if (newWorkerName.trim()) {
      setEditingWorkers((prev) => [...prev, newWorkerName.trim()]);
      setNewWorkerName("");
    }
  };

  const removeWorker = (index: number) => {
    setEditingWorkers((prev) => prev.filter((_, i) => i !== index));
  };

  const saveWorkers = () => {
    if (editingCell) {
      setScheduleData((prev) => ({
        ...prev,
        [editingCell.deptId]: {
          ...prev[editingCell.deptId],
          [editingCell.day]: editingWorkers,
        },
      }));
    }
    setEditDialogOpen(false);
    setEditingCell(null);
  };

  const getDeptName = (deptId: string) => {
    return departments.find((d) => d.id === deptId)?.name || deptId;
  };

  return (
    <>
      <Card className="w-full max-w-6xl mx-auto shadow-lg border-0 bg-card animate-fade-in">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  주간 근무표
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatWeekRange()}
                </p>
              </div>
            </div>
            
            {/* Week Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousWeek}
                className="h-9 w-9"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={goToCurrentWeek}
                className="px-3"
              >
                이번 주
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextWeek}
                className="h-9 w-9"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              총 {departments.reduce((acc, d) => acc + d.count, 0)}명
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              (셀을 클릭하여 편집)
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-4 text-left font-semibold text-foreground border-b border-r border-border min-w-[140px]">
                    부서
                  </th>
                  {DAYS.map((day, index) => {
                    const date = getDateForDay(index);
                    return (
                      <th
                        key={day}
                        className={`p-4 text-center border-b border-r border-border min-w-[100px] ${getDayHeaderClass(day)}`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg">{day}</span>
                          <span className="text-xs text-muted-foreground font-normal">
                            {format(date, "M/d")}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                    <td className={`p-4 border-b border-r border-border ${dept.colorClass}`}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-card shadow-sm">
                          {dept.icon}
                        </div>
                        <div>
                          <span className="font-semibold text-foreground block">
                            {dept.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className={`mt-1 ${dept.badgeClass} text-xs`}
                          >
                            {dept.count}명
                          </Badge>
                        </div>
                      </div>
                    </td>
                    {DAYS.map((day) => {
                      const workers = scheduleData[dept.id]?.[day] || [];
                      const isWeekend = day === "토" || day === "일";
                      return (
                        <td
                          key={day}
                          className={`schedule-cell border-b cursor-pointer group ${isWeekend ? "bg-muted/30" : ""}`}
                          onClick={() => openEditDialog(dept.id, day)}
                        >
                          <div className="flex flex-col gap-1 relative">
                            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Edit2 className="h-3 w-3 text-muted-foreground" />
                            </div>
                            {workers.length > 0 ? (
                              workers.map((worker, idx) => (
                                <span
                                  key={idx}
                                  className="text-sm text-foreground px-2 py-1 rounded bg-card shadow-sm inline-block"
                                >
                                  {worker}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground italic">
                                휴무
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="p-4 border-t border-border bg-muted/30">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground font-medium">범례:</span>
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${dept.badgeClass}`} />
                  <span className="text-foreground">{dept.name}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCell && `${getDeptName(editingCell.deptId)} - ${editingCell.day}요일 근무자 편집`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current workers */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                현재 근무자
              </label>
              {editingWorkers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {editingWorkers.map((worker, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1 bg-secondary px-3 py-1.5 rounded-full"
                    >
                      <span className="text-sm text-secondary-foreground">
                        {worker}
                      </span>
                      <button
                        onClick={() => removeWorker(index)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  등록된 근무자가 없습니다
                </p>
              )}
            </div>

            {/* Add new worker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                근무자 추가
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="이름 입력"
                  value={newWorkerName}
                  onChange={(e) => setNewWorkerName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addWorker();
                    }
                  }}
                />
                <Button onClick={addWorker} size="icon" variant="secondary">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={saveWorkers}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WeeklySchedule;
