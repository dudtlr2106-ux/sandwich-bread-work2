import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";

type PushPayload = Record<string, unknown> & { type?: string };

export async function invokePushNotification(body: PushPayload) {
  const { data, error } = await supabase.functions.invoke("send-push-notification", { body });

  if (!error) return data;

  let responseDetails: string | undefined;
  let status: number | undefined;
  const context = "context" in error ? error.context : undefined;

  if (context instanceof Response) {
    status = context.status;
    responseDetails = await context.clone().text().catch(() => undefined);
  }

  const pushError = new Error(
    responseDetails
      ? `Push notification failed: ${responseDetails}`
      : `Push notification failed: ${error.message}`,
    { cause: error },
  );

  Sentry.captureException(pushError, {
    tags: {
      feature: "push-notification",
      notification_type: body.type ?? "attendance_request",
      http_status: status?.toString() ?? "unknown",
    },
  });

  throw pushError;
}
