import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import WeeklySchedule from "@/components/WeeklySchedule";
import AdminRequestList from "@/components/AdminRequestList";
import UserRoleManagement from "@/components/UserRoleManagement";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { isAdmin, user, isLoading } = useAuth();
  const navigate = useNavigate();

  // 로그인하지 않은 사용자는 인증 페이지로 리다이렉트
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

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

  // 로딩 중이거나 로그인하지 않은 경우 빈 화면 표시
  if (isLoading || !user) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">로딩 중...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
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
