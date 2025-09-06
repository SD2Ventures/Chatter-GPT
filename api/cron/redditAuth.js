// OAuth helper for Reddit "script" apps.
// Requires env: REDDIT_CLIENT_ID, REDDIT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD, REDDIT_USER_AGENT

let cachedToken = null;
let tokenExpiry = 0; // epoch ms

export async function getRedditToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const cid = process.env.REDDIT_CLIENT_ID;
  const sec = process.env.REDDIT_SECRET;
  const usr = process.env.REDDIT_USERNAME;
  const pwd = process.env.REDDIT_PASSWORD;
  const ua  = process.env.REDDIT_USER_AGENT || "omni/1.0";

  if (!cid || !sec || !usr || !pwd) {
    throw new Error("Missing Reddit env vars (REDDIT_CLIENT_ID/SECRET/USERNAME/PASSWORD)");
  }

  const auth = Buffer.from(`${cid}:${sec}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "password",
    username: usr,
    password: pwd
  });

  const r = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": ua
    },
    body
  });

  const data = await r.json();
  if (!r.ok) {
    throw new Error(`Reddit auth failed (${r.status}): ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  tokenExpiry = now + Math.max(0, (data.expires_in || 3600) - 60) * 1000; // refresh 1 min early
  return cachedToken;
}

export function redditHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "User-Agent": process.env.REDDIT_USER_AGENT || "omni/1.0"
  };
}
