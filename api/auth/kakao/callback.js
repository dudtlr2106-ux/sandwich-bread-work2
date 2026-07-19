const readCookie = (cookieHeader, name) => {
  const cookies = Object.fromEntries(
    (cookieHeader || "").split(";").map((cookie) => {
      const [key, ...value] = cookie.trim().split("=");
      return [key, value.join("=")];
    }),
  );
  return cookies[name];
};

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

export default async function handler(req, res) {
  const appOrigin = `https://${req.headers.host}`;
  const clearStateCookie = "kakao_oauth_state=; Path=/api/auth/kakao; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

  try {
    const { code, state, error } = req.query;
    const storedState = readCookie(req.headers.cookie, "kakao_oauth_state");

    if (error || !code || !state || state !== storedState) {
      res.setHeader("Set-Cookie", clearStateCookie);
      res.writeHead(302, { Location: `${appOrigin}/auth` });
      res.end();
      return;
    }

    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: requiredEnv("KAKAO_REST_API_KEY"),
        client_secret: requiredEnv("KAKAO_CLIENT_SECRET"),
        redirect_uri: requiredEnv("KAKAO_REDIRECT_URI"),
        code,
      }),
    });
    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok || !tokens.id_token) {
      throw new Error("Kakao did not return an ID token");
    }

    res.setHeader("Set-Cookie", clearStateCookie);
    res.writeHead(302, { Location: `${appOrigin}/select-worker#kakao_id_token=${encodeURIComponent(tokens.id_token)}` });
    res.end();
  } catch (error) {
    console.error(error);
    res.setHeader("Set-Cookie", clearStateCookie);
    res.writeHead(302, { Location: `${appOrigin}/auth` });
    res.end();
  }
}
