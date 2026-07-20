import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { sendWebPush } from "./webPush.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const legacyServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");
    let supabaseServiceKey = legacyServiceKey;

    if (!supabaseServiceKey && secretKeysJson) {
      try {
        const secretKeys = JSON.parse(secretKeysJson) as Record<string, string>;
        supabaseServiceKey = secretKeys.default ?? Object.values(secretKeys)[0];
      } catch (parseError) {
        console.error("Failed to parse SUPABASE_SECRET_KEYS:", parseError);
      }
    }
    const vapidPublicKey =
      Deno.env.get("VAPID_PUBLIC_KEY") ??
      "BItJXD2Q8B5DAauQIsbCAIyymiy_HcpZ98J01ABpagmEYV1nO7MdSx-mb_QOAwkfpSrOhU0Qih_sMB1dMjyTrXs";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    const missingConfig = [
      !supabaseUrl && "SUPABASE_URL",
      !supabaseServiceKey && "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEYS",
      !vapidPublicKey && "VAPID_PUBLIC_KEY",
      !vapidPrivateKey && "VAPID_PRIVATE_KEY",
    ].filter(Boolean);

    if (missingConfig.length > 0) {
      const isVapidConfigurationMissing =
        !vapidPublicKey || !vapidPrivateKey;
      console.error(
        `Missing function configuration: ${missingConfig.join(", ")}`,
      );
      return new Response(
        JSON.stringify({ error: "Function configuration is incomplete" }),
        {
          status: isVapidConfigurationMissing ? 424 : 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const isModernSecretKey = supabaseServiceKey.startsWith("sb_secret_");
    const adminFetch: typeof fetch = async (input, init = {}) => {
      const headers = new Headers(init.headers);

      // Modern Supabase secret keys are API keys, not JWTs. supabase-js adds the
      // project key as a Bearer token by default, so remove only that generated
      // header while keeping the required `apikey` header intact.
      if (
        isModernSecretKey &&
        headers.get("Authorization") === `Bearer ${supabaseServiceKey}`
      ) {
        headers.delete("Authorization");
      }

      return fetch(input, { ...init, headers });
    };

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { fetch: adminFetch },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    const { type, requesterName, workerName, dateKey, requestedStatus, content, resultStatus, newAvailability, startTime, endTime, adminName, previousStatus } = body;

    const isNoticeUpdate = type === 'notice_update';
    const isRequestResult = type === 'request_result';
    const isWeekendAvailability = type === 'weekend_availability';
    const isAdminStatusChange = type === 'admin_status_change';

    console.log(`Sending push notification - type: ${type || 'attendance_request'}`);

    const statusLabels: Record<string, string> = {
      normal: "정상",
      overtime: "잔업",
      partial_overtime: "시간잔업",
      vacation: "휴가",
      partial_vacation: "시간휴가",
      dayoff: "휴무",
    };

    let targetUserIds: string[] = [];

    if (isRequestResult || isAdminStatusChange) {
      // Send to the affected worker + all admins
      const targetName = isRequestResult ? requesterName : workerName;
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("display_name", targetName);

      if (profileError) {
        console.error("Error fetching target profile:", profileError);
        throw profileError;
      }

      const targetProfileUserIds = profiles ? profiles.map((p) => p.user_id) : [];
      console.log(`Found ${targetProfileUserIds.length} profile(s) for target: ${targetName}`);

      // Also fetch admin user IDs
      const { data: adminRoles, error: adminError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (adminError) {
        console.error("Error fetching admin roles:", adminError);
      }

      const adminUserIds = adminRoles ? adminRoles.map((r) => r.user_id) : [];
      console.log(`Found ${adminUserIds.length} admin users`);

      // Merge and deduplicate
      targetUserIds = [...new Set([...targetProfileUserIds, ...adminUserIds])];

      if (targetUserIds.length === 0) {
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Send to all admins
      const { data: adminRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (rolesError) {
        console.error("Error fetching admin roles:", rolesError);
        throw rolesError;
      }

      if (!adminRoles || adminRoles.length === 0) {
        console.log("No admin users found");
        return new Response(JSON.stringify({ success: true, sent: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      targetUserIds = adminRoles.map((r) => r.user_id);
      console.log(`Found ${targetUserIds.length} admin users`);
    }

    // Get push subscriptions for target users
    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for target users");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${subscriptions.length} push subscriptions`);

    // Prepare notification payload based on type
    let payload: PushPayload;

    if (isRequestResult) {
      const resultLabel = resultStatus === 'approved' ? '승인' : '반려';
      const emoji = resultStatus === 'approved' ? '✅' : '❌';
      const timeInfo = startTime && endTime ? ` (${startTime}~${endTime})` : '';
      payload = {
        title: `${emoji} 근태 수정 ${resultLabel}`,
        body: `${dateKey} ${workerName}의 ${statusLabels[requestedStatus] || requestedStatus}${timeInfo} 변경 요청이 ${resultLabel}되었습니다.`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          url: "/",
          type: "request_result",
        },
      };
    } else if (isNoticeUpdate) {
      payload = {
        title: "📢 공지사항 수정",
        body: content ? `공지사항이 수정되었습니다: ${content}` : "공지사항이 수정되었습니다.",
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          url: "/",
          type: "notice_update",
        },
      };
    } else if (isWeekendAvailability) {
      const statusText = newAvailability ? '가능 ✅' : '불가 ❌';
      payload = {
        title: "주말출근 가능 여부 변경",
        body: `${workerName}님이 주말출근 가능 여부를 ${statusText}(으)로 변경했습니다.`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          url: "/",
          type: "weekend_availability",
        },
      };
    } else if (isAdminStatusChange) {
      const prevLabel = statusLabels[previousStatus] || previousStatus || '?';
      const newLabel = statusLabels[requestedStatus] || requestedStatus;
      const timeInfo = startTime && endTime ? ` (${startTime}~${endTime})` : '';
      payload = {
        title: "🔄 근무 변경",
        body: `${adminName || '관리자'}님이 ${dateKey} ${workerName}의 근무를 ${prevLabel} → ${newLabel}${timeInfo}(으)로 변경했습니다.`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          url: "/",
          type: "admin_status_change",
        },
      };
    } else {
      const timeInfo = startTime && endTime ? ` (${startTime}~${endTime})` : '';
      payload = {
        title: "근태 수정 요청",
        body: `${requesterName}님이 ${dateKey} ${workerName}의 근태를 ${statusLabels[requestedStatus] || requestedStatus}${timeInfo}(으)로 변경 요청했습니다.`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          url: "/",
          type: "attendance_request",
        },
      };
    }

    // Send to all subscriptions
    let sentCount = 0;
    const expiredSubscriptions: string[] = [];
    let failedCount = 0;

    for (const sub of subscriptions) {
      const result = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidPublicKey,
        vapidPrivateKey
      );
      
      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
        if (result.expired) {
          expiredSubscriptions.push(sub.id);
        }
      }
    }

    // Only remove subscriptions the push service explicitly reports as expired.
    if (expiredSubscriptions.length > 0) {
      console.log(`Cleaning up ${expiredSubscriptions.length} expired subscriptions`);
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", expiredSubscriptions);
    }

    console.log(`Push delivery result: ${sentCount} sent, ${failedCount} failed`);

    const allDeliveriesFailed = sentCount === 0 && failedCount > 0;

    return new Response(
      JSON.stringify({
        success: !allDeliveriesFailed,
        sent: sentCount,
        failed: failedCount,
      }),
      {
        status: allDeliveriesFailed ? 502 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
