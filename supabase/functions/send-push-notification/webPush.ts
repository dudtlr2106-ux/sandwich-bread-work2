import webpush from "npm:web-push@3.6.7";

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

export interface WebPushResult {
  success: boolean;
  expired: boolean;
}

export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string,
): Promise<WebPushResult> {
  try {
    webpush.setVapidDetails(
      "mailto:admin@sandwich-bread-work.app",
      vapidPublicKey,
      vapidPrivateKey,
    );

    const response = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 86400,
        urgency: "high",
        contentEncoding: "aes128gcm",
      },
    );

    console.log("Web Push accepted", { statusCode: response.statusCode });
    return {
      success: response.statusCode >= 200 && response.statusCode < 300,
      expired: false,
    };
  } catch (error) {
    const pushError = error as {
      statusCode?: number;
      body?: string;
      message?: string;
    };
    console.error("Web Push failed", {
      statusCode: pushError.statusCode,
      body: pushError.body,
      message: pushError.message,
    });
    return {
      success: false,
      expired: pushError.statusCode === 404 || pushError.statusCode === 410,
    };
  }
}
