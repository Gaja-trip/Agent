const test = require("node:test");
const assert = require("node:assert/strict");
const { createSiteServer } = require("../server.cjs");

test("private site requires a password for pages, assets and APIs", async (t) => {
  const server = createSiteServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (route, init = {}) => fetch(base + route, { redirect: "manual", ...init });
  const login = (password, next = "/") => get("/login", { method: "POST", headers: { origin: base, "sec-fetch-site": "same-origin" }, body: new URLSearchParams({ password, next }) });

  for (const route of ["/", "/index.html", "/manual.html", "/checklist.html", "/knowledge.html", "/process.html", "/info.html"]) {
    const response = await get(route);
    assert.equal(response.status, 303, route);
    assert.match(response.headers.get("location"), /^\/login\?next=/);
    assert.doesNotMatch(await response.text(), /data-portal|data-guide-page/);
  }
  for (const route of ["/script.js", "/styles.css", "/assets/survey-checks.png", "/cadastral/example.shp", "/api/vworld/parcel?pnu=bad", "/api/farmland/config"]) {
    assert.equal((await get(route)).status, 401, route);
  }
  const page = await get("/login");
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("referrer-policy"), "same-origin");
  assert.match(await page.text(), /name="password" type="password"/);
  const wrong = await login("incorrect");
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get("set-cookie"), null);
  assert.match(await wrong.text(), /role="alert"/);

  const granted = await login("jin", "/manual.html#documents");
  assert.equal(granted.status, 303);
  assert.equal(granted.headers.get("location"), "/manual.html#documents");
  const setCookie = granted.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Max-Age=28800/);
  const cookie = setCookie.split(";")[0];

  for (const route of ["/", "/manual.html", "/styles.css", "/script.js", "/vworld-config.js", "/vworld-parcel.js", "/assets/land-info-logo.png", "/assets/jeonbuk-town-village-map.js", "/assets/survey-checks.png"]) {
    const response = await get(route, { headers: { cookie } });
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get("cache-control"), /no-store/);
    await response.arrayBuffer();
  }
  const range = await get("/assets/survey-checks.png", { headers: { cookie, Range: "bytes=0-7" } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 8);
  assert.equal((await get("/api/vworld/parcel?pnu=bad", { headers: { cookie } })).status, 400);
  assert.equal((await get("/api/farmland/info?pnu=bad", { headers: { cookie } })).status, 400);
  const restoredHome = await (await get("/", { headers: { cookie } })).text();
  assert.deepEqual([...restoredHome.matchAll(/data-portal="([^"]+)"/g)].map((match) => match[1]), ["eum", "map", "aerial", "farmland", "law"]);
  assert.match(restoredHome, /assets\/land-info-logo\.png/);
  assert.match(restoredHome, /data-site-search/);

  for (const route of ["/server.cjs", "/access-control.mjs", "/middleware.ts", "/.git/config", "/.env", "/.recovery/latest-v11.3-89d9245.zip", "/farmland-service.cjs", "/vworld-service.cjs", "/package.json", "/server-out.log", "/api/vworld/parcel.js", "/assets/%2e%2e%2faccess-control.mjs"]) {
    assert.equal((await get(route, { headers: { cookie } })).status, 404, route);
  }
  const logout = await get("/logout", { method: "POST", headers: { cookie } });
  assert.equal(logout.status, 303);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal((await get("/")).status, 303);
  assert.equal((await login("jin", "//example.com")).headers.get("location"), "/");
  assert.equal((await get("/login", { method: "POST", headers: { origin: "https://other.invalid" }, body: new URLSearchParams({ password: "jin" }) })).status, 403);
  assert.equal((await get("/login", { method: "POST", body: new URLSearchParams({ password: "x".repeat(5000) }) })).status, 400);
});

test("signed sessions reject forged or expired cookies and use Secure on HTTPS", async () => {
  const { createSession, authorizeRequest, hasAccess } = await import("../access-control.mjs");
  const now = Date.now();
  const token = await createSession(now);
  const request = (value) => new Request("https://guide.invalid/", { headers: { cookie: `land_info_access=${value}` } });
  assert.equal(await hasAccess(request(token), now), true);
  assert.equal(await hasAccess(request(token), now + 8 * 60 * 60 * 1000), false);
  assert.equal(await hasAccess(request(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a")), now), false);
  assert.equal(await hasAccess(request("jin"), now), false);
  const response = await authorizeRequest(new Request("https://guide.invalid/login", { method: "POST", body: new URLSearchParams({ password: "jin" }) }));
  assert.match(response.headers.get("set-cookie"), /; Secure/);
});

test("Vercel middleware applies the same protection before static and API routes", async () => {
  const { default: middleware, config } = await import("../middleware.ts");
  const { createSession } = await import("../access-control.mjs");
  assert.equal(config.matcher, "/:path*");
  assert.equal((await middleware(new Request("https://guide.invalid/"))).status, 303);
  assert.equal((await middleware(new Request("https://guide.invalid/assets/survey-checks.png"))).status, 401);
  assert.equal((await middleware(new Request("https://guide.invalid/api/farmland/config"))).status, 401);
  const response = await middleware(new Request("https://guide.invalid/checklist.html", { headers: { cookie: `land_info_access=${await createSession()}` } }));
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.match(response.headers.get("cache-control"), /no-store/);
});
