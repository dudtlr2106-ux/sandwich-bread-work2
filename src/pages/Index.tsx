import WeeklySchedule from "@/components/WeeklySchedule";
import AdminRequestList from "@/components/AdminRequestList";
import { useState } from "react";

import { PWAInstallButton } from "@/components/PWAInstallButton";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { isAdmin } = useAuth();
  const [scheduleVersion, setScheduleVersion] = useState(0);

  // 승인 처리가 끝난 뒤 근무표를 다시 마운트해 최신 DB 상태를 불러온다.
  const handleStatusChange = () => {
    setScheduleVersion((version) => version + 1);
  };

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-end mb-4">
          <PWAInstallButton />
        </div>
        <WeeklySchedule key={scheduleVersion} />
        
        {/* 관리자만 볼 수 있는 요청 목록 */}
        {isAdmin && <AdminRequestList onStatusChange={handleStatusChange} />}
        
      </div>
    </main>
  );
};

export default Index;
