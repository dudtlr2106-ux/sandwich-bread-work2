import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Shield, ShieldOff, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  role: "admin" | "user" | null;
}

const UserRoleManagement = () => {
  const { session } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!session?.access_token) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "list" },
      });

      if (error) throw error;
      setUsers(data.users || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("사용자 목록을 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [session]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!session?.access_token) return;

    setUpdating(userId);
    try {
      if (newRole === "none") {
        const { error } = await supabase.functions.invoke("manage-users", {
          body: { action: "remove_role", userId },
        });
        if (error) throw error;
        toast.success("권한이 제거되었습니다");
      } else {
        const { error } = await supabase.functions.invoke("manage-users", {
          body: { action: "assign_role", userId, role: newRole },
        });
        if (error) throw error;
        toast.success("권한이 변경되었습니다");
      }
      fetchUsers();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("권한 변경에 실패했습니다");
    } finally {
      setUpdating(null);
    }
  };

  const getRoleBadge = (role: string | null) => {
    if (role === "admin") {
      return (
        <Badge className="bg-red-500 hover:bg-red-600">
          <Shield className="w-3 h-3 mr-1" />
          관리자
        </Badge>
      );
    }
    if (role === "user") {
      return (
        <Badge variant="secondary">
          <Users className="w-3 h-3 mr-1" />
          사용자
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <ShieldOff className="w-3 h-3 mr-1" />
        권한 없음
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">로딩 중...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="w-5 h-5" />
          사용자 권한 관리
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이메일</TableHead>
                <TableHead>가입일</TableHead>
                <TableHead>현재 권한</TableHead>
                <TableHead className="text-right">권한 변경</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    등록된 사용자가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), "yyyy.MM.dd", { locale: ko })}
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={user.role || "none"}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                        disabled={updating === user.id}
                      >
                        <SelectTrigger className="w-32">
                          {updating === user.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">관리자</SelectItem>
                          <SelectItem value="user">사용자</SelectItem>
                          <SelectItem value="none">권한 없음</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserRoleManagement;
