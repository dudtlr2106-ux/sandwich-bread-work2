import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, FileText, RefreshCw, History } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface AttendanceRequest {
  id: string;
  requester_name: string;
  worker_name: string;
  date_key: string;
  day: string;
  current_status: string | null;
  requested_status: string;
  reason: string | null;
  status: string;
  created_at: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface AdminRequestListProps {
  onStatusChange?: (workerName: string, dateKey: string, newStatus: string) => void;
}

const statusLabels: Record<string, string> = {
  normal: "정상",
  overtime: "잔업",
  vacation: "휴가",
  partial_vacation: "시간휴가",
  dayoff: "휴무",
};

const AdminRequestList = ({ onStatusChange }: AdminRequestListProps) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AttendanceRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const fetchRequests = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("attendance_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    // Realtime 구독
    const channel = supabase
      .channel("attendance-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_requests",
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApprove = async (request: AttendanceRequest) => {
    // 1. 요청 상태를 approved로 업데이트
    const { error: requestError } = await supabase
      .from("attendance_requests")
      .update({
        status: "approved",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestError) {
      toast({
        variant: "destructive",
        title: "승인 실패",
      });
      return;
    }

    // 2. 시간휴가(partial_vacation)는 기존 상태를 유지하고, 
    //    attendance_requests 테이블만 참조하여 표시하므로 worker_statuses를 변경하지 않음
    if (request.requested_status === "partial_vacation") {
      toast({
        title: "승인 완료",
        description: `${request.worker_name}님의 시간휴가(${request.start_time} ~ ${request.end_time})가 승인되었습니다`,
      });
      return;
    }

    // 3. 시간휴가 외의 상태는 worker_statuses 테이블에 근태 상태 반영
    const { error: statusError } = await supabase
      .from("worker_statuses")
      .upsert(
        {
          worker_name: request.worker_name,
          date_key: request.date_key,
          status: request.requested_status,
        },
        { onConflict: "worker_name,date_key" }
      );

    if (statusError) {
      toast({
        variant: "destructive",
        title: "근태 반영 실패",
        description: "요청은 승인되었지만 근태 상태 변경에 실패했습니다",
      });
    } else {
      toast({
        title: "승인 완료",
        description: `${request.worker_name}님의 근태가 ${statusLabels[request.requested_status]}(으)로 변경되었습니다`,
      });
    }
  };

  const openRejectDialog = (request: AttendanceRequest) => {
    setSelectedRequest(request);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    const { error } = await supabase
      .from("attendance_requests")
      .update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: rejectionReason.trim() || null,
      })
      .eq("id", selectedRequest.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "반려 실패",
      });
    } else {
      toast({
        title: "반려 완료",
      });
    }

    setRejectDialogOpen(false);
    setSelectedRequest(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />대기 중</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />승인됨</Badge>;
      case "rejected":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />반려됨</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const rejectedRequests = requests.filter((r) => r.status === "rejected");

  if (!isAdmin) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          근태 수정 요청
          {pendingRequests.length > 0 && (
            <Badge variant="destructive">{pendingRequests.length}</Badge>
          )}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchRequests}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                대기 중
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                승인 내역
                {approvedRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {approvedRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-1">
                <X className="h-3 w-3" />
                반려 내역
                {rejectedRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {rejectedRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* 대기 중 탭 */}
            <TabsContent value="pending" className="mt-4">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">대기 중인 요청이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg bg-yellow-50/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(request.status)}
                          <span className="font-medium">{request.worker_name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.date_key} ({request.day}) • 
                          {statusLabels[request.current_status || "normal"]} → 
                          <span className="font-medium text-primary">
                            {statusLabels[request.requested_status]}
                            {request.requested_status === "partial_vacation" && request.start_time && request.end_time && (
                              <span className="ml-1">({request.start_time} ~ {request.end_time})</span>
                            )}
                          </span>
                        </div>
                        {request.reason && (
                          <div className="text-sm text-muted-foreground">
                            사유: {request.reason}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          요청자: {request.requester_name} • 
                          {format(new Date(request.created_at), "M월 d일 HH:mm", { locale: ko })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => openRejectDialog(request)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          반려
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 승인 내역 탭 */}
            <TabsContent value="approved" className="mt-4">
              {approvedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">승인된 내역이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {approvedRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 border rounded-lg bg-green-50/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(request.status)}
                          <span className="font-medium">{request.worker_name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.date_key} ({request.day}) • 
                          {statusLabels[request.current_status || "normal"]} → 
                          <span className="font-medium text-green-700">
                            {statusLabels[request.requested_status]}
                            {request.requested_status === "partial_vacation" && request.start_time && request.end_time && (
                              <span className="ml-1">({request.start_time} ~ {request.end_time})</span>
                            )}
                          </span>
                        </div>
                        {request.reason && (
                          <div className="text-sm text-muted-foreground">
                            사유: {request.reason}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          요청자: {request.requester_name} • 
                          요청: {format(new Date(request.created_at), "M월 d일 HH:mm", { locale: ko })}
                          {request.reviewed_at && (
                            <> • 승인: {format(new Date(request.reviewed_at), "M월 d일 HH:mm", { locale: ko })}</>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 반려 내역 탭 */}
            <TabsContent value="rejected" className="mt-4">
              {rejectedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">반려된 내역이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {rejectedRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 border rounded-lg bg-red-50/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(request.status)}
                          <span className="font-medium">{request.worker_name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.date_key} ({request.day}) • 
                          {statusLabels[request.current_status || "normal"]} → {statusLabels[request.requested_status]}
                          {request.requested_status === "partial_vacation" && request.start_time && request.end_time && (
                            <span className="ml-1">({request.start_time} ~ {request.end_time})</span>
                          )}
                        </div>
                        {request.rejection_reason && (
                          <div className="text-sm text-destructive">
                            반려 사유: {request.rejection_reason}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          요청자: {request.requester_name} • 
                          요청: {format(new Date(request.created_at), "M월 d일 HH:mm", { locale: ko })}
                          {request.reviewed_at && (
                            <> • 반려: {format(new Date(request.reviewed_at), "M월 d일 HH:mm", { locale: ko })}</>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>

      {/* 반려 사유 입력 다이얼로그 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>요청 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {selectedRequest?.worker_name}님의 근태 변경 요청을 반려합니다
            </div>
            <Textarea
              placeholder="반려 사유를 입력하세요 (선택)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleReject}>
              반려
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminRequestList;
