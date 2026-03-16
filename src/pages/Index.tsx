import WeeklySchedule from "@/components/WeeklySchedule";
import AdminRequestList from "@/components/AdminRequestList";

import { PWAInstallButton } from "@/components/PWAInstallButton";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { isAdmin } = useAuth();

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
        <div className="flex justify-end mb-4">
          <PWAInstallButton />
        </div>
        <WeeklySchedule />
        
        {/* 관리자만 볼 수 있는 요청 목록 */}
        {isAdmin && <AdminRequestList onStatusChange={handleStatusChange} />}
        
        {/* 관리자만 볼 수 있는 테스트 버튼 */}
        {isAdmin && (
          <div className="mt-6 flex justify-end">
            <TestPushButton />
          </div>
        )}
      </div>
    </main>
  );
};

export default Index;
