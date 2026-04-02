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
import { Check, X, Clock, FileText, RefreshCw, History, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { waitForRealtimeReady } from "@/lib/realtimeUtils";

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
  reviewed_by: string | null;
  start_time: string | null;
  end_time: string | null;
}

interface AdminRequestListProps {
  onStatusChange?: (workerName: string, dateKey: string, newStatus: string) => void;
}

const statusLabels: Record<string, string> = {
  normal: "정상",
  overtime: "잔업",
  partial_overtime: "시간잔업",
  vacation: "휴가",
  partial_vacation: "시간휴가",
  dayoff: "휴무",
};

const AdminRequestList = ({ onStatusChange }: AdminRequestListProps) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [reviewerNames, setReviewerNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AttendanceRequest | null>(null);

  const fetchRequests = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("attendance_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setRequests(data);
      
      // reviewed_by UUID들로 프로필 이름 조회
      const reviewerIds = [...new Set(data.map(r => r.reviewed_by).filter(Boolean))] as string[];
      if (reviewerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", reviewerIds);
        if (profiles) {
          const nameMap: Record<string, string> = {};
          profiles.forEach(p => { nameMap[p.user_id] = p.display_name; });
          setReviewerNames(nameMap);
        }
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    // Realtime 구독 (지연된 연결)
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    
    const setupRealtime = async () => {
      await waitForRealtimeReady();
      if (!isMounted) return;
      
      channel = supabase
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

    // 요청자에게 승인 알림 발송
    supabase.functions.invoke('send-push-notification', {
      body: {
        type: 'request_result',
        requesterName: request.requester_name,
        workerName: request.worker_name,
        dateKey: request.date_key,
        requestedStatus: request.requested_status,
        resultStatus: 'approved',
        startTime: request.start_time,
        endTime: request.end_time,
      },
    }).catch(err => console.error('승인 알림 발송 실패:', err));

    // 2. 시간휴가(partial_vacation)는 기존 상태를 유지하고, 
    //    attendance_requests 테이블만 참조하여 표시하므로 worker_statuses를 변경하지 않음
    if (request.requested_status === "partial_vacation") {
      toast({
        title: "승인 완료",
        description: `${request.worker_name}님의 시간휴가(${request.start_time} ~ ${request.end_time})가 승인되었습니다`,
      });
      return;
    }

    // 3. 시간잔업(partial_overtime)도 동일하게 처리
    if (request.requested_status === "partial_overtime") {
      toast({
        title: "승인 완료",
        description: `${request.worker_name}님의 시간잔업(${request.start_time} ~ ${request.end_time})이 승인되었습니다`,
      });
      return;
    }

    // 4. 정상/잔업/휴가/휴무로 변경 시, 기존 시간휴가/시간잔업 요청을 취소 처리
    //    (이렇게 해야 시간 표시가 제거됨)
    const { error: cancelPartialError } = await supabase
      .from("attendance_requests")
      .update({
        status: "cancelled",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("worker_name", request.worker_name)
      .eq("date_key", request.date_key)
      .eq("status", "approved")
      .in("requested_status", ["partial_vacation", "partial_overtime"])
      .neq("id", request.id);

    if (cancelPartialError) {
      console.error("기존 시간휴가/시간잔업 취소 오류:", cancelPartialError);
    }

    // 5. worker_statuses 테이블에 근태 상태 반영
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

  const handleReject = async (request: AttendanceRequest) => {
    const { error } = await supabase
      .from("attendance_requests")
      .update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", request.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "반려 실패",
      });
    } else {
      // 요청자에게 반려 알림 발송
      supabase.functions.invoke('send-push-notification', {
        body: {
          type: 'request_result',
          requesterName: request.requester_name,
          workerName: request.worker_name,
          dateKey: request.date_key,
          requestedStatus: request.requested_status,
          resultStatus: 'rejected',
          startTime: request.start_time,
          endTime: request.end_time,
        },
      }).catch(err => console.error('반려 알림 발송 실패:', err));

      toast({
        title: "반려 완료",
      });
    }
  };

  const openCancelDialog = (request: AttendanceRequest) => {
    setSelectedRequest(request);
    setCancelDialogOpen(true);
  };

  const handleCancel = async () => {
    if (!selectedRequest) return;

    try {
      // 1. 시간휴가/시간잔업이 아닌 경우 worker_statuses를 원래 상태로 되돌림
      if (selectedRequest.requested_status !== "partial_vacation" && 
          selectedRequest.requested_status !== "partial_overtime") {
        
        const originalStatus = selectedRequest.current_status || "normal";
        
        if (originalStatus === "normal") {
          // 원래 상태가 normal이면 worker_statuses에서 삭제
          const { error: deleteError } = await supabase
            .from("worker_statuses")
            .delete()
            .eq("worker_name", selectedRequest.worker_name)
            .eq("date_key", selectedRequest.date_key);
          
          if (deleteError) {
            console.error("worker_statuses 삭제 오류:", deleteError);
            // 삭제 실패해도 계속 진행 (레코드가 없을 수 있음)
          }
        } else {
          // 그 외의 경우 원래 상태로 업데이트
          const { error: upsertError } = await supabase
            .from("worker_statuses")
            .upsert(
              {
                worker_name: selectedRequest.worker_name,
                date_key: selectedRequest.date_key,
                status: originalStatus,
              },
              { onConflict: "worker_name,date_key" }
            );
          
          if (upsertError) {
            console.error("worker_statuses 업데이트 오류:", upsertError);
            toast({
              variant: "destructive",
              title: "취소 실패",
              description: "근태 상태 복원에 실패했습니다",
            });
            setCancelDialogOpen(false);
            setSelectedRequest(null);
            return;
          }
        }
      }

      // 2. 요청 상태를 cancelled로 업데이트
      const { error } = await supabase
        .from("attendance_requests")
        .update({
          status: "cancelled",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedRequest.id);

      if (error) {
        console.error("요청 취소 오류:", error);
        toast({
          variant: "destructive",
          title: "취소 실패",
          description: error.message,
        });
      } else {
        toast({
          title: "취소 완료",
          description: `${selectedRequest.worker_name}님의 근태가 ${statusLabels[selectedRequest.current_status || "normal"]}(으)로 되돌려졌습니다`,
        });
      }
    } catch (err) {
      console.error("취소 처리 중 예외:", err);
      toast({
        variant: "destructive",
        title: "취소 실패",
        description: "알 수 없는 오류가 발생했습니다",
      });
    }

    setCancelDialogOpen(false);
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
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800"><Undo2 className="h-3 w-3 mr-1" />취소됨</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const rejectedRequests = requests.filter((r) => r.status === "rejected");
  const cancelledRequests = requests.filter((r) => r.status === "cancelled");

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
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">로딩 중...</div>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="hidden sm:inline">대기 중</span>
                {pendingRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {pendingRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                <span className="hidden sm:inline">승인</span>
                {approvedRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {approvedRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rejected" className="flex items-center gap-1">
                <X className="h-3 w-3" />
                <span className="hidden sm:inline">반려</span>
                {rejectedRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {rejectedRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="flex items-center gap-1">
                <Undo2 className="h-3 w-3" />
                <span className="hidden sm:inline">취소</span>
                {cancelledRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 justify-center">
                    {cancelledRequests.length}
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
                            {(request.requested_status === "partial_vacation" || request.requested_status === "partial_overtime") && request.start_time && request.end_time && (
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
                          onClick={() => handleReject(request)}
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
                            {(request.requested_status === "partial_vacation" || request.requested_status === "partial_overtime") && request.start_time && request.end_time && (
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
                          {request.reviewed_by && reviewerNames[request.reviewed_by] && (
                            <>승인자: {reviewerNames[request.reviewed_by]}</>
                          )}
                          {request.reviewed_at && (
                            <> • 승인: {format(new Date(request.reviewed_at), "M월 d일 HH:mm", { locale: ko })}</>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openCancelDialog(request)}
                          className="text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          취소
                        </Button>
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
                          {(request.requested_status === "partial_vacation" || request.requested_status === "partial_overtime") && request.start_time && request.end_time && (
                            <span className="ml-1">({request.start_time} ~ {request.end_time})</span>
                          )}
                        </div>
                        {request.rejection_reason && (
                          <div className="text-sm text-destructive">
                            반려 사유: {request.rejection_reason}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {request.reviewed_by && reviewerNames[request.reviewed_by] && (
                            <>반려자: {reviewerNames[request.reviewed_by]}</>
                          )}
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

            {/* 취소 내역 탭 */}
            <TabsContent value="cancelled" className="mt-4">
              {cancelledRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">취소된 내역이 없습니다</div>
              ) : (
                <div className="space-y-2">
                  {cancelledRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 border rounded-lg bg-gray-50/50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(request.status)}
                          <span className="font-medium">{request.worker_name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {request.date_key} ({request.day}) • 
                          {statusLabels[request.current_status || "normal"]} → 
                          <span className="line-through text-gray-500">
                            {statusLabels[request.requested_status]}
                          </span>
                          {(request.requested_status === "partial_vacation" || request.requested_status === "partial_overtime") && request.start_time && request.end_time && (
                            <span className="ml-1 line-through text-gray-500">({request.start_time} ~ {request.end_time})</span>
                          )}
                        </div>
                        {request.reason && (
                          <div className="text-sm text-muted-foreground">
                            사유: {request.reason}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {request.reviewed_by && reviewerNames[request.reviewed_by] && (
                            <>처리자: {reviewerNames[request.reviewed_by]}</>
                          )}
                          {request.reviewed_at && (
                            <> • 취소: {format(new Date(request.reviewed_at), "M월 d일 HH:mm", { locale: ko })}</>
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


      {/* 취소 확인 다이얼로그 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>승인 취소</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {selectedRequest?.worker_name}님의 근태 변경을 취소하고 
              <span className="font-medium text-foreground"> {statusLabels[selectedRequest?.current_status || "normal"]}</span>
              (으)로 되돌리시겠습니까?
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-muted-foreground">변경 내용:</span>
              </div>
              <div className="text-foreground">
                {statusLabels[selectedRequest?.current_status || "normal"]} → 
                <span className="line-through ml-1 text-muted-foreground">
                  {statusLabels[selectedRequest?.requested_status || "normal"]}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              닫기
            </Button>
            <Button variant="secondary" onClick={handleCancel}>
              <Undo2 className="h-4 w-4 mr-1" />
              취소하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AdminRequestList;
