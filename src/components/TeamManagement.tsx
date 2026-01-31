import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit2, ArrowLeft, Users } from "lucide-react";
import { waitForRealtimeReady } from "@/lib/realtimeUtils";
import UserRoleManagement from "@/components/UserRoleManagement";

type TeamMember = {
  id: string;
  team: string;
  role: string;
  worker_name: string;
  display_order: number;
};

type TeamRole = "반장" | "1조" | "2조" | "3조";
type Team = "A조" | "B조";

interface TeamManagementProps {
  onClose: () => void;
}

const TeamManagement = ({ onClose }: TeamManagementProps) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  
  // 새 멤버 추가 폼 상태
  const [newMemberTeam, setNewMemberTeam] = useState<Team>("A조");
  const [newMemberRole, setNewMemberRole] = useState<TeamRole>("1조");
  const [newMemberName, setNewMemberName] = useState("");

  // 데이터 로드
  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("team")
        .order("display_order");

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error("Failed to load team members:", error);
      toast.error("팀원 목록을 불러오는데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();

    // 실시간 구독 (지연된 연결)
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    
    const setupRealtime = async () => {
      await waitForRealtimeReady();
      if (!isMounted) return;
      
      channel = supabase
        .channel("team-members-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "team_members" },
          () => {
            loadMembers();
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('Realtime subscription error, will retry on reconnect');
          }
        });
    };
    
    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // 멤버 추가
  const handleAddMember = async () => {
    if (!newMemberName.trim()) {
      toast.error("이름을 입력해주세요");
      return;
    }

    try {
      // 해당 팀의 최대 display_order 구하기
      const teamMembers = members.filter((m) => m.team === newMemberTeam);
      const maxOrder = Math.max(0, ...teamMembers.map((m) => m.display_order));

      const { error } = await supabase.from("team_members").insert({
        team: newMemberTeam,
        role: newMemberRole,
        worker_name: newMemberName.trim(),
        display_order: maxOrder + 1,
      });

      if (error) throw error;

      toast.success("팀원이 추가되었습니다");
      setAddDialogOpen(false);
      setNewMemberName("");
      loadMembers();
    } catch (error: any) {
      console.error("Failed to add member:", error);
      if (error.code === "23505") {
        toast.error("이미 등록된 팀원입니다");
      } else {
        toast.error("팀원 추가에 실패했습니다");
      }
    }
  };

  // 멤버 수정
  const handleEditMember = async () => {
    if (!editingMember || !editingMember.worker_name.trim()) {
      toast.error("이름을 입력해주세요");
      return;
    }

    try {
      const { error } = await supabase
        .from("team_members")
        .update({
          team: editingMember.team,
          role: editingMember.role,
          worker_name: editingMember.worker_name.trim(),
        })
        .eq("id", editingMember.id);

      if (error) throw error;

      toast.success("팀원 정보가 수정되었습니다");
      setEditDialogOpen(false);
      setEditingMember(null);
      loadMembers();
    } catch (error: any) {
      console.error("Failed to update member:", error);
      toast.error("팀원 수정에 실패했습니다");
    }
  };

  // 멤버 삭제
  const handleDeleteMember = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("팀원이 삭제되었습니다");
      loadMembers();
    } catch (error) {
      console.error("Failed to delete member:", error);
      toast.error("팀원 삭제에 실패했습니다");
    }
  };

  // 팀별로 그룹화
  const groupedMembers = {
    A조: {
      반장: members.filter((m) => m.team === "A조" && m.role === "반장"),
      "1조": members.filter((m) => m.team === "A조" && m.role === "1조"),
      "2조": members.filter((m) => m.team === "A조" && m.role === "2조"),
      "3조": members.filter((m) => m.team === "A조" && m.role === "3조"),
    },
    B조: {
      반장: members.filter((m) => m.team === "B조" && m.role === "반장"),
      "1조": members.filter((m) => m.team === "B조" && m.role === "1조"),
      "2조": members.filter((m) => m.team === "B조" && m.role === "2조"),
      "3조": members.filter((m) => m.team === "B조" && m.role === "3조"),
    },
  };

  const openEditDialog = (member: TeamMember) => {
    setEditingMember({ ...member });
    setEditDialogOpen(true);
  };

  const TeamCard = ({ team, data }: { team: Team; data: typeof groupedMembers.A조 }) => (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          {team}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(["반장", "1조", "2조", "3조"] as TeamRole[]).map((role) => (
          <div key={role} className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">{role}</div>
            <div className="space-y-1">
              {data[role].length === 0 ? (
                <div className="text-sm text-muted-foreground/60 italic">
                  등록된 인원 없음
                </div>
              ) : (
                data[role].map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                  >
                    <span className="text-sm font-medium">{member.worker_name}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEditDialog(member)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteMember(member.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">팀 관리</h1>
          </div>
          <Button onClick={() => setAddDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            팀원 추가
          </Button>
        </div>
      </div>

      {/* 팀 목록 */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            로딩 중...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TeamCard team="A조" data={groupedMembers.A조} />
            <TeamCard team="B조" data={groupedMembers.B조} />
          </div>
        )}
        
        {/* 사용자 권한 관리 */}
        <UserRoleManagement />
      </div>

      {/* 팀원 추가 다이얼로그 */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>팀원 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">팀</label>
              <Select value={newMemberTeam} onValueChange={(v) => setNewMemberTeam(v as Team)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A조">A조</SelectItem>
                  <SelectItem value="B조">B조</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">역할</label>
              <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as TeamRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="반장">반장</SelectItem>
                  <SelectItem value="1조">1조</SelectItem>
                  <SelectItem value="2조">2조</SelectItem>
                  <SelectItem value="3조">3조</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">이름</label>
              <Input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="이름 입력"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddMember}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 팀원 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>팀원 수정</DialogTitle>
          </DialogHeader>
          {editingMember && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">팀</label>
                <Select
                  value={editingMember.team}
                  onValueChange={(v) => setEditingMember({ ...editingMember, team: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A조">A조</SelectItem>
                    <SelectItem value="B조">B조</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">역할</label>
                <Select
                  value={editingMember.role}
                  onValueChange={(v) => setEditingMember({ ...editingMember, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="반장">반장</SelectItem>
                    <SelectItem value="1조">1조</SelectItem>
                    <SelectItem value="2조">2조</SelectItem>
                    <SelectItem value="3조">3조</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">이름</label>
                <Input
                  value={editingMember.worker_name}
                  onChange={(e) =>
                    setEditingMember({ ...editingMember, worker_name: e.target.value })
                  }
                  placeholder="이름 입력"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleEditMember}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamManagement;
