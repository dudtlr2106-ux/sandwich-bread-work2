import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

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

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binaryString = atob(base64 + padding);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Convert ArrayBuffer to base64url
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generate JWT for VAPID
async function generateVapidJWT(
  audience: string,
  subject: string,
  privateKeyBytes: Uint8Array
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = { aud: audience, exp, sub: subject };

  const headerB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(header)).buffer as ArrayBuffer);
  const payloadB64 = arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)).buffer as ArrayBuffer);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import private key
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes.buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw format (r || s)
  const sigArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  
  if (sigArray[0] === 0x30) {
    // DER format
    const rLen = sigArray[3];
    const rStart = 4;
    const rEnd = rStart + rLen;
    const sLen = sigArray[rEnd + 1];
    const sStart = rEnd + 2;
    
    let rBytes = sigArray.slice(rStart, rEnd);
    let sBytes = sigArray.slice(sStart, sStart + sLen);
    
    // Remove leading zeros if present
    if (rBytes[0] === 0) rBytes = rBytes.slice(1);
    if (sBytes[0] === 0) sBytes = sBytes.slice(1);
    
    // Pad to 32 bytes
    r = new Uint8Array(32);
    s = new Uint8Array(32);
    r.set(rBytes, 32 - rBytes.length);
    s.set(sBytes, 32 - sBytes.length);
  } else {
    // Already in raw format
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32, 64);
  }

  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  return `${unsignedToken}.${arrayBufferToBase64Url(rawSig.buffer as ArrayBuffer)}`;
}

// Send push notification using Web Push protocol with web-push library approach
async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    
    // Decode VAPID private key
    const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);
    
    const jwt = await generateVapidJWT(audience, "mailto:admin@example.com", privateKeyBytes);

    // Encrypt payload
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

    // Generate local key pair for encryption
    const localKeyPair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"]
    );

    // Import subscriber's public key
    const subscriberPublicKeyBytes = base64UrlToUint8Array(subscription.p256dh);
    const subscriberPublicKey = await crypto.subtle.importKey(
      "raw",
      subscriberPublicKeyBytes.buffer as ArrayBuffer,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      []
    );

    // Derive shared secret
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberPublicKey },
      localKeyPair.privateKey,
      256
    );

    // Get local public key for export
    const localPublicKeyBuffer = await crypto.subtle.exportKey("raw", localKeyPair.publicKey);
    const localPublicKey = new Uint8Array(localPublicKeyBuffer);

    // Get auth secret
    const authSecret = base64UrlToUint8Array(subscription.auth);

    // Create info for HKDF
    const keyInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
    const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

    // Create auth info
    const authInfoArray = new Uint8Array(
      "WebPush: info\0".length + subscriberPublicKeyBytes.length + localPublicKey.length
    );
    authInfoArray.set(new TextEncoder().encode("WebPush: info\0"), 0);
    authInfoArray.set(subscriberPublicKeyBytes, "WebPush: info\0".length);
    authInfoArray.set(localPublicKey, "WebPush: info\0".length + subscriberPublicKeyBytes.length);

    // Derive IKM using auth secret
    const ikmKey = await crypto.subtle.importKey(
      "raw",
      authSecret.buffer as ArrayBuffer,
      { name: "HKDF" },
      false,
      ["deriveBits"]
    );

    const prk = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(sharedSecret), info: authInfoArray },
      ikmKey,
      256
    );

    const prkKey = await crypto.subtle.importKey(
      "raw",
      prk,
      { name: "HKDF" },
      false,
      ["deriveBits"]
    );

    // Derive content encryption key and nonce
    const cekBits = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: keyInfo },
      prkKey,
      128
    );

    const nonceBits = await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: nonceInfo },
      prkKey,
      96
    );

    // Import CEK for AES-GCM
    const cek = await crypto.subtle.importKey(
      "raw",
      cekBits,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    // Add padding delimiter
    const paddedPayload = new Uint8Array(payloadBytes.length + 1);
    paddedPayload.set(payloadBytes, 0);
    paddedPayload[payloadBytes.length] = 2; // Padding delimiter

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonceBits },
      cek,
      paddedPayload
    );

    // Build body with header
    const recordSize = 4096;
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const header = new Uint8Array(86);
    const headerView = new DataView(header.buffer);
    
    // Salt (16 bytes)
    header.set(salt, 0);
    // Record size (4 bytes big endian)
    headerView.setUint32(16, recordSize, false);
    // Key ID length (1 byte)
    header[20] = 65;
    // Local public key (65 bytes)
    header.set(localPublicKey, 21);

    const body = new Uint8Array(header.length + encrypted.byteLength);
    body.set(header);
    body.set(new Uint8Array(encrypted), header.length);

    // Send to push service
    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "TTL": "86400",
        "Urgency": "high"
      },
      body
    });

    console.log(`Push notification response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Push notification failed: ${errorText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error sending push notification:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("Missing VAPID keys configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { requesterName, workerName, dateKey, requestedStatus } = await req.json();

    console.log(`Sending push notification for attendance request from ${requesterName}`);

    // Get all admin users
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

    const adminUserIds = adminRoles.map((r) => r.user_id);
    console.log(`Found ${adminUserIds.length} admin users`);

    // Get push subscriptions for admin users
    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", adminUserIds);

    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for admin users");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${subscriptions.length} push subscriptions`);

    // Prepare notification payload
    const statusLabels: Record<string, string> = {
      normal: "정상",
      overtime: "잔업",
      partial_overtime: "시간잔업",
      vacation: "휴가",
      partial_vacation: "시간휴가",
      dayoff: "휴무",
    };

    const payload: PushPayload = {
      title: "근태 수정 요청",
      body: `${requesterName}님이 ${dateKey} ${workerName}의 근태를 ${statusLabels[requestedStatus] || requestedStatus}(으)로 변경 요청했습니다.`,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: {
        url: "/",
        type: "attendance_request",
      },
    };

    // Send to all subscriptions
    let sentCount = 0;
    const failedSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      const success = await sendWebPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidPublicKey,
        vapidPrivateKey
      );
      
      if (success) {
        sentCount++;
      } else {
        failedSubscriptions.push(sub.id);
      }
    }

    // Clean up failed subscriptions (they might be expired)
    if (failedSubscriptions.length > 0) {
      console.log(`Cleaning up ${failedSubscriptions.length} failed subscriptions`);
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("id", failedSubscriptions);
    }

    console.log(`Successfully sent ${sentCount} push notifications`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount }),
      {
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
