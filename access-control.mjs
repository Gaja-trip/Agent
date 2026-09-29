const COOKIE_NAME = "land_info_access";
const SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();
const sitePassword = process.env.SITE_PASSWORD || "jin";
const sessionSecret = process.env.SITE_SESSION_SECRET || "7cc3671075ef438ff955b7ce73bf7708607905e6aade055715f2652f723464d3";

export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

const pages = new Set(["/", "/index.html", "/info.html", "/process.html", "/checklist.html", "/manual.html", "/knowledge.html"]);
const publicScripts = new Set(["/styles.css", "/script.js", "/vworld-config.js", "/vworld-parcel.js"]);
let signingKey;

function getSigningKey() {
  // A password change also invalidates previously issued sessions.
  signingKey ||= crypto.subtle.importKey("raw", encoder.encode(`${sessionSecret}:${sitePassword}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return signingKey;
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createSession(now = Date.now()) {
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `v1.${expires}.${nonce}`;
  const signature = await crypto.subtle.sign("HMAC", await getSigningKey(), encoder.encode(payload));
  return `${payload}.${hex(signature)}`;
}

export async function hasAccess(request, now = Date.now()) {
  const cookie = (request.headers.get("cookie") || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const token = cookie?.slice(COOKIE_NAME.length + 1) || "";
  const match = /^(v1\.(\d{10})\.[a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const remaining = Number(match[2]) - Math.floor(now / 1000);
  if (remaining <= 0 || remaining > SESSION_SECONDS) return false;
  const signature = Uint8Array.from(match[3].match(/../g), (pair) => parseInt(pair, 16));
  return crypto.subtle.verify("HMAC", await getSigningKey(), signature, encoder.encode(match[1]));
}

function sessionCookie(request, token = "") {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_SECONDS : 0}${secure}`;
}

function textResponse(message, status) {
  return new Response(message, { status, headers: { ...privateHeaders, "Content-Type": "text/plain; charset=utf-8" } });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function safeNext(value) {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://local.invalid");
    return pages.has(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

function loginPage(next, error = "", status = 200) {
  return new Response(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>비공개 접속 | 토지정보 통합 안내</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #1f2a27; background: #f4f8f5; font-family: "Malgun Gothic", system-ui, sans-serif; line-height: 1.6; word-break: keep-all; overflow-wrap: anywhere; }
    main { min-height: 100svh; display: grid; place-items: center; padding: 24px 18px; }
    .access { width: 100%; max-width: 420px; padding: 32px; border: 1px solid #d9e2dc; border-top: 4px solid #1f6b55; border-radius: 8px; background: #fff; }
    .eyebrow { margin: 0 0 10px; color: #1f6b55; font-size: 14px; font-weight: 700; }
    h1 { margin: 0 0 28px; font-size: 24px; line-height: 1.4; letter-spacing: 0; }
    label { display: block; margin-bottom: 8px; font-size: 16px; font-weight: 700; }
    input { width: 100%; min-height: 50px; padding: 10px 12px; border: 1px solid #a9bdb2; border-radius: 6px; background: #fff; font: inherit; }
    input:focus { outline: 3px solid #d2e9e1; border-color: #1f6b55; }
    button { width: 100%; min-height: 50px; margin-top: 20px; border: 0; border-radius: 6px; background: #1f6b55; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    button:hover { background: #114636; }
    button:focus-visible { outline: 3px solid #c8872c; outline-offset: 3px; }
    .error { margin: 12px 0 0; color: #a22a25; font-size: 14px; }
    @media (max-width: 380px) { .access { padding: 24px 20px; } h1 { font-size: 22px; } }
  </style>
</head>
<body>
  <main><section class="access" aria-labelledby="access-title">
    <p class="eyebrow">비공개 페이지</p>
    <h1 id="access-title">토지정보 통합 안내</h1>
    <form action="/login" method="post">
      <input type="hidden" name="next" value="${escapeHtml(safeNext(next))}" />
      <label for="access-password">접속 암호</label>
      <input id="access-password" name="password" type="password" autocomplete="current-password" maxlength="128" required autofocus${error ? ' aria-invalid="true" aria-describedby="access-error"' : ""} />
      ${error ? `<p class="error" id="access-error" role="alert">${escapeHtml(error)}</p>` : ""}
      <button type="submit">접속하기</button>
    </form>
  </section></main>
</body></html>`, {
    status,
    headers: {
      ...privateHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      "Referrer-Policy": "same-origin",
    },
  });
}

function permittedPath(pathname) {
  if (/[\\\x00-\x1f]/.test(pathname) || pathname.split("/").some((part) => part.startsWith("."))) return false;
  return pages.has(pathname) || publicScripts.has(pathname)
    || /^\/assets\/.+\.(png|jpe?g|svg|webp|gif|ico|js|pdf)$/i.test(pathname)
    || /^\/cadastral\/.+\.(shp|shx|dbf|prj|bin)$/i.test(pathname)
    || /^\/api\/farmland\/(config|info|parcel|tile|wms)$/.test(pathname)
    || pathname === "/api/vworld/parcel";
}

async function passwordMatches(value) {
  const actual = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  const expected = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(sitePassword)));
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

async function readLoginForm(request) {
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return null;
  if (Number(request.headers.get("content-length")) > 4096) return null;
  const reader = request.body?.getReader();
  if (!reader) return new URLSearchParams();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new URLSearchParams(new TextDecoder().decode(bytes));
}

// Return null only when a protected request may continue to its original handler.
export async function authorizeRequest(request) {
  const url = new URL(request.url);
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return textResponse("Bad request", 400); }

  if (pathname === "/login" || pathname === "/logout") {
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") return textResponse("Forbidden", 403);
      if (pathname === "/logout") {
        return new Response(null, { status: 303, headers: { ...privateHeaders, Location: "/login", "Set-Cookie": sessionCookie(request) } });
      }
      const form = await readLoginForm(request);
      if (!form) return textResponse("Bad request", 400);
      const next = safeNext(form.get("next"));
      if (!await passwordMatches(form.get("password") || "")) return loginPage(next, "암호가 올바르지 않습니다. 다시 입력해 주세요.", 401);
      return new Response(null, { status: 303, headers: { ...privateHeaders, Location: next, "Set-Cookie": sessionCookie(request, await createSession()) } });
    }
    if (pathname === "/login" && (request.method === "GET" || request.method === "HEAD")) return loginPage(url.searchParams.get("next"));
    return textResponse("Method not allowed", 405);
  }

  if (!permittedPath(pathname)) return textResponse("Not found", 404);
  if (await hasAccess(request)) return null;
  if (pages.has(pathname) && (request.method === "GET" || request.method === "HEAD")) {
    return new Response(null, { status: 303, headers: { ...privateHeaders, Location: `/login?next=${encodeURIComponent(url.pathname + url.search)}` } });
  }
  return textResponse("접속 암호를 먼저 입력해 주세요.", 401);
}
