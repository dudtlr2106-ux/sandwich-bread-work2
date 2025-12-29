import { Link } from "react-router-dom";
import WeeklySchedule from "@/components/WeeklySchedule";
import AdminRequestList from "@/components/AdminRequestList";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Shield } from "lucide-react";

const Index = () => {
  const { user, isAdmin, signOut, isLoading } = useAuth();

  const handleStatusChange = (workerName: string, dateKey: string, newStatus: string) => {
    // WeeklySchedule에서 상태 변경을 처리하도록 로컬 스토리지 업데이트
    try {
      const saved = localStorage.getItem("workerStatusData");
      const data = saved ? JSON.parse(saved) : {};
      if (!data[dateKey]) {
        data[dateKey] = {};
      }
      data[dateKey][workerName] = newStatus;
      localStorage.setItem("workerStatusData", JSON.stringify(data));
      window.location.reload(); // 상태 반영을 위해 새로고침
    } catch (e) {
      console.error("Failed to update worker status:", e);
    }
  };

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 상단 네비게이션 */}
        <div className="flex justify-end items-center gap-2 mb-4">
          {isLoading ? (
            <div className="h-9 w-20 bg-muted animate-pulse rounded" />
          ) : user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <span className="flex items-center gap-1 text-sm text-primary">
                  <Shield className="h-4 w-4" />
                  관리자
                </span>
              )}
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </Button>
            </div>
          ) : (
            <Link to="/auth">
              <Button variant="outline" size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                관리자 로그인
              </Button>
            </Link>
          )}
        </div>

        <WeeklySchedule />
        
        {/* 관리자만 볼 수 있는 요청 목록 */}
        {isAdmin && <AdminRequestList onStatusChange={handleStatusChange} />}
      </div>
    </main>
  );
};

export default Index;
