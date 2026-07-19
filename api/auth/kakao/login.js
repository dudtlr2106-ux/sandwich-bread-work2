import { randomUUID } from "node:crypto";

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

export default function handler(_req, res) {
  try {
    const clientId = requiredEnv("KAKAO_REST_API_KEY");
    const redirectUri = requiredEnv("KAKAO_REDIRECT_URI");
    const state = randomUUID();
    const authorizationUrl = new URL("https://kauth.kakao.com/oauth/authorize");

    authorizationUrl.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid profile_nickname profile_image",
      state,
    }).toString();

    res.setHeader("Set-Cookie", `kakao_oauth_state=${state}; Path=/api/auth/kakao; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
    res.writeHead(302, { Location: authorizationUrl.toString() });
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Kakao login is not configured" });
  }
}
