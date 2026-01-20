import WeeklySchedule from "@/components/WeeklySchedule";
import AdminRequestList from "@/components/AdminRequestList";
import UserRoleManagement from "@/components/UserRoleManagement";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { isAdmin } = useAuth();
  const { requestPermission, permission, isSupported } = usePushNotifications();
  const { toast } = useToast();

  // Show permission prompt for admin users
  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast({
        title: "알림 활성화",
        description: "새로운 근태 수정 요청 시 알림을 받습니다.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "알림 차단됨",
        description: "브라우저 설정에서 알림을 허용해주세요.",
      });
    }
  };

  const handleStatusChange = (workerName: string, dateKey: string, newStatus: string) => {
    try {
      const saved = localStorage.getItem("workerStatusData");
      const data = saved ? JSON.parse(saved) : {};
      if (!data[dateKey]) {
        data[dateKey] = {};
      }
      data[dateKey][workerName] = newStatus;
      localStorage.setItem("workerStatusData", JSON.stringify(data));
      window.location.reload();
    } catch (e) {
      console.error("Failed to update worker status:", e);
    }
  };

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 관리자 알림 활성화 버튼 */}
        {isAdmin && isSupported && permission !== 'granted' && (
          <div className="mb-4 p-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <span className="text-sm">근태 수정 요청 알림을 받으시겠습니까?</span>
            </div>
            <Button size="sm" onClick={handleEnableNotifications}>
              알림 활성화
            </Button>
          </div>
        )}

        <WeeklySchedule />
        
        {/* 관리자만 볼 수 있는 요청 목록 */}
        {isAdmin && <AdminRequestList onStatusChange={handleStatusChange} />}
        
        {/* 관리자만 볼 수 있는 사용자 권한 관리 */}
        {isAdmin && (
          <div className="mt-6">
            <UserRoleManagement />
          </div>
        )}
      </div>
    </main>
  );
};

export default Index;
