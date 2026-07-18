import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const SelectWorker = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [workers, setWorkers] = useState<string[]>([]);
  const [selectedWorker, setSelectedWorker] = useState("");
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadWorkerSelection = async () => {
      if (isLoading) return;
      if (!user) {
        navigate("/auth", { replace: true });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile) {
        navigate("/", { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from("team_members")
        .select("worker_name")
        .order("display_order", { ascending: true });

      if (error) {
        toast.error("직원 목록을 불러오지 못했습니다");
      } else {
        setWorkers(Array.from(new Set((data || []).map((member) => member.worker_name))));
      }
      setLoadingWorkers(false);
    };

    loadWorkerSelection();
  }, [isLoading, navigate, user]);

  const handleSave = async () => {
    if (!user || !selectedWorker) return;

    setIsSaving(true);
    const { error } = await supabase.from("profiles").insert({
      user_id: user.id,
      display_name: selectedWorker,
    });

    if (error) {
      toast.error("이름 연결에 실패했습니다");
      setIsSaving(false);
      return;
    }

    toast.success("내 이름이 연결되었습니다");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>내 이름 선택</CardTitle>
          <CardDescription>근무표에서 수정 요청을 보낼 본인 이름을 선택하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="worker-name">근무표 이름</Label>
            <Select value={selectedWorker} onValueChange={setSelectedWorker} disabled={loadingWorkers || isSaving}>
              <SelectTrigger id="worker-name">
                <SelectValue placeholder={loadingWorkers ? "직원 목록 불러오는 중..." : "이름 선택"} />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker} value={worker}>{worker}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSave} disabled={!selectedWorker || isSaving}>
            {isSaving ? "저장 중..." : "이 이름으로 시작하기"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SelectWorker;
