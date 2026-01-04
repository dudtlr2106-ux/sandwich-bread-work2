import { Link } from "react-router-dom";
import WeeklySchedule from "@/components/WeeklySchedule";
import AdminRequestList from "@/components/AdminRequestList";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { isAdmin } = useAuth();

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
        <WeeklySchedule />
        
        {/* 관리자만 볼 수 있는 요청 목록 */}
        {isAdmin && <AdminRequestList onStatusChange={handleStatusChange} />}
      </div>
    </main>
  );
};

export default Index;
