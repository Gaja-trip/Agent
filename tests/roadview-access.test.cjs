const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createSiteServer } = require('../server.cjs');
const api = require('../api/roadview/[...path].js');
const { buildUrl } = require('../assets/aerial-roadview.js');

for (const deployment of ['local server', 'Vercel function']) {
  test(`Roadview only opens from an authenticated same-origin form: ${deployment}`, async (t) => {
    const { createSession } = await import('../access-control.mjs');
    const cookie = `land_info_access=${await createSession()}`;
    const server = deployment === 'local server' ? createSiteServer() : http.createServer(async (request, response) => {
      request.headers['x-forwarded-proto'] = 'http';
      if (request.method === 'POST') {
        let body = '';
        for await (const chunk of request) body += chunk;
        request.body = Object.fromEntries(new URLSearchParams(body));
      }
      await api(request, response);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    const url = buildUrl();
    const get = (route, init = {}) => fetch(base + route, { redirect: 'manual', ...init });
    const launch = (headers = {}, body = 'launch=1', route = url) => get(route, {
      method: 'POST',
      headers: { cookie, origin: base, 'sec-fetch-site': 'same-origin', 'content-type': 'application/x-www-form-urlencoded', ...headers },
      body,
    });

    for (const headers of [{}, { cookie }]) {
      const copied = await get(url, { headers });
      assert.equal(copied.status, 403);
      assert.match(await copied.text(), /통합안내에서 로드뷰를 열어/);
      assert.doesNotMatch(await (await get(url, { headers })).text(), /class="view-card"|app\.mjs/);
    }
    const head = await get(url, { method: 'HEAD' });
    assert.equal(head.status, 403);
    assert.equal(await head.text(), '');
    assert.equal((await launch({ cookie: '' })).status, 401);
    assert.equal((await launch({ origin: 'https://other.invalid' })).status, 403);
    assert.equal((await launch({ origin: '' })).status, 403);
    assert.equal((await launch({ 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await launch({}, 'launch=0')).status, 400);
    assert.equal((await launch({}, 'launch=1', '/api/roadview/open?lat=NaN&lng=126')).status, 400);
    assert.equal((await launch({}, 'launch=1', '/api/roadview/open?lat=35&lng=181')).status, 400);
    assert.equal((await launch({}, 'launch=1&extra=' + 'a'.repeat(200))).status, 400);
    const opened = await launch();
    assert.equal(opened.status, 200);
    assert.match(opened.headers.get('cache-control'), /no-store/);
    assert.equal(opened.headers.get('referrer-policy'), 'same-origin');
    const html = await opened.text();
    assert.match(html, /<base href="\/api\/roadview\/files\/">/);
    assert.equal([...html.matchAll(/class="view-card/g)].length, 4);
    assert.match(html, /통합안내로/);
    assert.doesNotMatch(html, /링크 복사/);
    for (const name of ['app.mjs', 'viewer.html', 'viewer.mjs', 'style.css', 'icon.svg', 'geo.mjs', 'sync.mjs', 'captures.mjs', 'address-search.mjs', 'geocoding.mjs']) {
      const route = `/api/roadview/files/${name}`;
      assert.equal((await get(route)).status, 401, name);
      const file = await get(route, { headers: { cookie } });
      assert.equal(file.status, 200, name);
      assert.match(file.headers.get('cache-control'), /no-store/);
      if (name.endsWith('.mjs')) assert.match(file.headers.get('content-type'), /javascript/);
      await file.arrayBuffer();
    }
    assert.equal((await get('/api/roadview/files/index.html', { headers: { cookie } })).status, 404);
    assert.equal((await get('/api/roadview/files/server.cjs', { headers: { cookie } })).status, 404);
    if (deployment === 'local server') {
      assert.equal((await get('/roadview/index.html', { headers: { cookie } })).status, 404);
      assert.equal((await get('/roadview-service.cjs', { headers: { cookie } })).status, 404);
    }
  });
}
