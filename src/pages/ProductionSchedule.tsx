import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, parseISO, eachDayOfInterval, isSunday, isSaturday, addDays } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowLeft, Plus, Trash2, Edit2, Factory, Package, TrendingUp, AlertTriangle, CalendarDays, Target, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ProductionSchedule {
  id: string;
  model_name: string;
  start_date: string;
  end_date: string;
  target_quantity: number;
  current_quantity: number;
  good_quantity: number;
}

const ProductionSchedulePage = () => {
  const { user, isAdmin } = useAuth();
  const [schedules, setSchedules] = useState<ProductionSchedule[]>([]);
  const [dayOffs, setDayOffs] = useState<Set<string>>(new Set());
  const [workingSaturdays, setWorkingSaturdays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [satCalendarOpen, setSatCalendarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    model_name: "",
    start_date: "",
    end_date: "",
    target_quantity: 0,
    current_quantity: 0,
    good_quantity: 0,
  });

  useEffect(() => {
    fetchSchedules();
    fetchDayOffs();
    fetchWorkingSaturdays();
  }, []);

  const fetchSchedules = async () => {
    const { data, error } = await supabase
      .from("production_schedules")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) {
      toast.error("데이터를 불러오지 못했습니다");
    } else {
      setSchedules(data || []);
    }
    setLoading(false);
  };

  const fetchDayOffs = async () => {
    const { data } = await supabase.from("day_offs").select("date_key");
    if (data) {
      setDayOffs(new Set(data.map(d => d.date_key)));
    }
  };

  const fetchWorkingSaturdays = async () => {
    const { data } = await supabase.from("working_saturdays").select("date_key");
    if (data) {
      setWorkingSaturdays(new Set(data.map(d => d.date_key)));
    }
  };

  const toggleWorkingSaturday = async (date: Date) => {
    if (!isSaturday(date)) return;
    const key = format(date, "yyyy-MM-dd");
    const newSet = new Set(workingSaturdays);
    if (newSet.has(key)) {
      await supabase.from("working_saturdays").delete().eq("date_key", key);
      newSet.delete(key);
    } else {
      await supabase.from("working_saturdays").insert({ date_key: key });
      newSet.add(key);
    }
    setWorkingSaturdays(newSet);
  };

  const handleSave = async () => {
    if (!formData.model_name || !formData.start_date || !formData.end_date) {
      toast.error("모델명, 시작일, 종료일을 입력하세요");
      return;
    }

    if (editingId) {
      const { error } = await supabase
        .from("production_schedules")
        .update({ ...formData, updated_at: new Date().toISOString() })
        .eq("id", editingId);
      if (error) { toast.error("수정 실패"); return; }
      toast.success("수정되었습니다");
    } else {
      const { error } = await supabase
        .from("production_schedules")
        .insert({ ...formData, created_by: user?.id });
      if (error) { toast.error("등록 실패"); return; }
      toast.success("등록되었습니다");
    }
    setDialogOpen(false);
    setEditingId(null);
    resetForm();
    fetchSchedules();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("production_schedules").delete().eq("id", deleteId);
    if (error) { toast.error("삭제 실패"); return; }
    toast.success("삭제되었습니다");
    setDeleteId(null);
    fetchSchedules();
  };

  const openEdit = (s: ProductionSchedule) => {
    setEditingId(s.id);
    setFormData({
      model_name: s.model_name,
      start_date: s.start_date,
      end_date: s.end_date,
      target_quantity: s.target_quantity,
      current_quantity: s.current_quantity,
      good_quantity: s.good_quantity,
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ model_name: "", start_date: "", end_date: "", target_quantity: 0, current_quantity: 0, good_quantity: 0 });
  };

  const countWorkingDays = (fromDate: Date, toDate: Date) => {
    if (fromDate > toDate) return 0;
    const days = eachDayOfInterval({ start: fromDate, end: toDate });
    return days.filter(d => {
      if (isSunday(d)) return false;
      const key = format(d, "yyyy-MM-dd");
      if (dayOffs.has(key)) return false;
      return true;
    }).length;
  };

  const calc = (s: ProductionSchedule) => {
    const start = parseISO(s.start_date);
    const end = parseISO(s.end_date);
    const today = new Date();
    const totalDays = countWorkingDays(start, end);
    const remainingDays = countWorkingDays(today > start ? addDays(today, 0) : start, end);
    const remainingQty = Math.max(0, s.target_quantity - s.good_quantity);
    const dailyNeeded = remainingDays > 0 ? Math.ceil(remainingQty / remainingDays) : remainingQty;
    const defectQty = Math.max(0, s.current_quantity - s.good_quantity);
    const defectRate = s.current_quantity > 0 ? ((defectQty / s.current_quantity) * 100) : 0;
    const progressRate = s.target_quantity > 0 ? ((s.current_quantity / s.target_quantity) * 100) : 0;
    return { totalDays, remainingDays, remainingQty, dailyNeeded, defectQty, defectRate, progressRate };
  };

  return (
    <main className="min-h-screen bg-background py-6 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Factory className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">생산일정</h1>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => { resetForm(); setEditingId(null); setDialogOpen(true); }} size="sm">
              <Plus className="h-4 w-4 mr-1" /> 등록
            </Button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : schedules.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">등록된 생산일정이 없습니다</CardContent></Card>
        ) : (
          schedules.map((s) => {
            const c = calc(s);
            return (
              <Card key={s.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{s.model_name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(parseISO(s.start_date), "M/d", { locale: ko })} ~ {format(parseISO(s.end_date), "M/d", { locale: ko })} (총 {c.totalDays}일)
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">진행률</span>
                      <span className="font-semibold">{c.progressRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.min(100, c.progressRate)} className="h-3" />
                  </div>

                  {/* Metric cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MetricCard icon={<Target className="h-4 w-4" />} label="목표 수량" value={s.target_quantity.toLocaleString()} />
                    <MetricCard icon={<Package className="h-4 w-4" />} label="현재 생산" value={s.current_quantity.toLocaleString()} />
                    <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="양품 수량" value={s.good_quantity.toLocaleString()} />
                    <MetricCard icon={<Package className="h-4 w-4" />} label="남은 수량" value={c.remainingQty.toLocaleString()} accent />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MetricCard icon={<CalendarDays className="h-4 w-4" />} label="남은 일수" value={`${c.remainingDays}일`} />
                    <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="일 필요 생산량" value={c.dailyNeeded.toLocaleString()} />
                    <MetricCard
                      icon={<AlertTriangle className="h-4 w-4" />}
                      label="불량률"
                      value={`${c.defectRate.toFixed(1)}%`}
                      danger={c.defectRate > 5}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}

        {/* Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "생산일정 수정" : "생산일정 등록"}</DialogTitle>
              <DialogDescription>생산 모델 정보를 입력하세요</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>생산 모델명</Label>
                <Input value={formData.model_name} onChange={(e) => setFormData(p => ({ ...p, model_name: e.target.value }))} placeholder="모델명 입력" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>시작일</Label>
                  <Input type="date" value={formData.start_date} onChange={(e) => setFormData(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div>
                  <Label>종료일</Label>
                  <Input type="date" value={formData.end_date} onChange={(e) => setFormData(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>목표 생산 수량</Label>
                <Input type="number" value={formData.target_quantity} onChange={(e) => setFormData(p => ({ ...p, target_quantity: Number(e.target.value) }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>현재 생산 수량</Label>
                  <Input type="number" value={formData.current_quantity} onChange={(e) => setFormData(p => ({ ...p, current_quantity: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>양품 수량</Label>
                  <Input type="number" value={formData.good_quantity} onChange={(e) => setFormData(p => ({ ...p, good_quantity: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
              <Button onClick={handleSave}>{editingId ? "수정" : "등록"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>삭제 확인</AlertDialogTitle>
              <AlertDialogDescription>이 생산일정을 삭제하시겠습니까?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>삭제</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </main>
  );
};

const MetricCard = ({ icon, label, value, accent, danger }: { icon: React.ReactNode; label: string; value: string; accent?: boolean; danger?: boolean }) => (
  <div className={`rounded-lg border p-3 ${danger ? 'border-destructive/50 bg-destructive/5' : accent ? 'border-primary/50 bg-primary/5' : 'bg-muted/30'}`}>
    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <p className={`text-lg font-bold ${danger ? 'text-destructive' : accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
  </div>
);

export default ProductionSchedulePage;
