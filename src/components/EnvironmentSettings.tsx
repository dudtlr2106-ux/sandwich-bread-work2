import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import TeamManagement from "@/components/TeamManagement";
import UserRoleManagement from "@/components/UserRoleManagement";

type SettingsSection = "menu" | "team" | "roles";

interface EnvironmentSettingsProps {
  onClose: () => void;
}

const EnvironmentSettings = ({ onClose }: EnvironmentSettingsProps) => {
  const [section, setSection] = useState<SettingsSection>("menu");
  const navigate = useNavigate();

  if (section === "team") {
    return <TeamManagement onClose={() => setSection("menu")} />;
  }

  if (section === "roles") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b bg-background">
          <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
            <Button variant="ghost" size="icon" onClick={() => setSection("menu")} title="환경 설정으로 돌아가기">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">사용자 권한 관리</h1>
          </div>
        </header>
        <div className="mx-auto max-w-4xl px-4 py-6">
          <UserRoleManagement />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} title="근무표로 돌아가기">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">환경 설정</h1>
            <p className="text-sm text-muted-foreground">관리자 전용 설정</p>
          </div>
        </div>

        <div className="space-y-3">
          <Button variant="outline" className="h-auto w-full justify-start gap-3 px-4 py-4 text-left" onClick={() => navigate("/pattern-management")}>
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <div className="text-base font-semibold">패턴 관리</div>
                <div className="text-sm font-normal text-muted-foreground">근무표 자동 생성 패턴을 관리합니다.</div>
              </div>
          </Button>
          <Button variant="outline" className="h-auto w-full justify-start gap-3 px-4 py-4 text-left" onClick={() => setSection("team")}>
              <Users className="h-5 w-5 text-primary" />
              <div>
                <div className="text-base font-semibold">팀 관리</div>
                <div className="text-sm font-normal text-muted-foreground">팀원과 조 편성을 관리합니다.</div>
              </div>
          </Button>
          <Button variant="outline" className="h-auto w-full justify-start gap-3 px-4 py-4 text-left" onClick={() => setSection("roles")}>
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <div className="text-base font-semibold">사용자 권한 관리</div>
                <div className="text-sm font-normal text-muted-foreground">관리자 권한을 설정합니다.</div>
              </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentSettings;
