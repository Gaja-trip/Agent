const test = require('node:test');
const assert = require('node:assert/strict');
const { createPlanService, handleEumPlanRequest, buildDetailUrl, parseDetailHtml } = require('../eum-plan.cjs');

const PNU = '5280034021119210004';
const OTHER_PNU = '5280034021119210012';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');
const keyFor = (pnu) => `1700000000000-${pnu}`;

function detailHtml(pnu = PNU, overrides = {}) {
  const key = keyFor(pnu);
  const lot = `${Number(pnu.slice(11, 15))}${Number(pnu.slice(15)) ? '-' + Number(pnu.slice(15)) : ''}`;
  return `<html><head><meta charset="utf-8"></head><body>
    <form><input type="hidden" name="pnu" value=""></form>
    <input type="hidden" name="pnu" id="pnu" value="${overrides.responsePnu || pnu}">
    <table><tbody>
      <tr><th>소재지</th><td colspan="3"><div id="present_addr" style="display:none"></div>전북특별자치도 부안군 계화면 계화리 ${lot}</td></tr>
      <tr><th>지목</th><td id="present_class"><input id="present_class_val" value="답">답</td><th>면적</th><td id="present_area">5,065.8 ㎡</td></tr>
      <tr><th>개별공시지가(㎡당)</th><td><span id="jiga">23,400원 (2026/01)</span></td></tr>
    </tbody></table>
    <table><caption>토지이용계획 - 확인도면</caption><tbody><tr><th>확인도면</th><td>
      <div class="map_a"><div class="map_a_img"><img src="${overrides.mapSource || `images?key=${key}`}" alt="해당 필지에 대한 도면"></div></div>
    </td><td>범례</td></tr><tr><td><div class="leg_area"><ul class="legend">
      <li><span><img src="${overrides.legendSource || `images?key=${key}0`}" alt="농림지역 범례"></span> 농림지역</li>
      <li><span><img src="images?key=${key}1" alt="법정동 범례"></span> 법정동</li>
    </ul></div></td></tr></tbody></table>
  </body></html>`;
}

function fixture(options = {}) {
  const calls = [];
  const detailCounts = new Map();
  const sessions = new Map();
  let clock = 1000;
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    const call = { url, headers, redirect: init.redirect };
    calls.push(call);
    if (url.pathname.endsWith('/luLandDet.jsp')) {
      const pnu = url.searchParams.get('pnu');
      const count = (detailCounts.get(pnu) || 0) + 1;
      detailCounts.set(pnu, count);
      const cookie = `JSESSIONID=session-${pnu}-${count}`;
      sessions.set(pnu, cookie);
      if (options.detailResponse) return options.detailResponse({ pnu, count, cookie, call });
      return new Response(detailHtml(pnu, options), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie + '; Path=/; HttpOnly; Secure' } });
    }
    assert.equal(url.origin, 'https://www.eum.go.kr');
    assert.equal(url.pathname, '/web/ar/lu/images');
    const key = url.searchParams.get('key') || '';
    const pnu = key.slice(key.indexOf('-') + 1, key.indexOf('-') + 20);
    assert.equal(headers.get('cookie'), sessions.get(pnu), 'each image request must use its own detail-session cookie');
    if (options.imageResponse) return options.imageResponse({ pnu, key, count: detailCounts.get(pnu), call });
    return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
  };
  return {
    calls, detailCounts,
    service: createPlanService({ fetchImpl, now: () => clock, cacheTtlMs: 100, ...options.serviceOptions }),
    advance(ms = 101) { clock += ms; },
  };
}

test('confirmation requests derive the official address parameters from a validated PNU', async () => {
  const url = new URL(buildDetailUrl(PNU, '1200'));
  assert.equal(url.origin, 'https://www.eum.go.kr');
  assert.equal(url.pathname, '/web/ar/lu/luLandDet.jsp');
  assert.equal(url.searchParams.get('pnu'), PNU);
  assert.equal(url.searchParams.get('selSido'), '52');
  assert.equal(url.searchParams.get('selSgg'), '800');
  assert.equal(url.searchParams.get('bobn'), '1921');
  assert.equal(url.searchParams.get('bubn'), '4');
  assert.equal(url.searchParams.get('scale'), '1200');
  const f = fixture();
  for (const pnu of ['', 'bad', '52800340211192100040', 'https://example.com']) {
    await assert.rejects(f.service.load(pnu));
  }
  await assert.rejects(f.service.load(PNU, 'Infinity'));
  assert.equal(f.calls.length, 0);
});

test('another parcel or external image source cannot be attributed to the requested land', () => {
  assert.throws(() => parseDetailHtml(detailHtml(PNU, { responsePnu: OTHER_PNU }), PNU));
  for (const mapSource of [`images?key=${keyFor(OTHER_PNU)}`, 'https://example.com/private.png', 'http://127.0.0.1:22/', '/web/ar/lu/images?key=anything']) {
    assert.throws(() => parseDetailHtml(detailHtml(PNU, { mapSource }), PNU));
  }
  assert.throws(() => parseDetailHtml(detailHtml(PNU, { legendSource: `images?key=${keyFor(OTHER_PNU)}0` }), PNU));
});

test('map and every legend retain their detail session and expose only self-contained PNG data', async () => {
  const f = fixture();
  const data = await f.service.load(PNU);
  assert.equal(data.pnu, PNU);
  assert.equal(String(data.scale), '1200');
  assert.match(data.parcel.address, /계화리 1921-4/);
  assert.equal(data.map.src, 'data:image/png;base64,' + PNG.toString('base64'));
  assert.equal(data.map.width, 1);
  assert.equal(data.map.height, 1);
  assert.deepEqual(data.legend.map((item) => item.label), ['농림지역', '법정동']);
  assert.ok(data.legend.every((item) => item.src === data.map.src && item.width === 1 && item.height === 1));
  assert.equal(f.calls.length, 4, 'one detail document and its three images');
  assert.ok(f.calls.every((call) => call.redirect === 'error'));
  assert.ok(f.calls.slice(1).every((call) => new URL(call.headers.get('referer')).pathname.endsWith('/luLandDet.jsp')));
  assert.doesNotMatch(JSON.stringify(data), /JSESSIONID|session-528|images\?key=/);
});

test('concurrent parcel lookups keep cookies separate and do not mix image sessions', async () => {
  const f = fixture();
  const [first, second] = await Promise.all([f.service.load(PNU), f.service.load(OTHER_PNU)]);
  assert.equal(first.pnu, PNU);
  assert.equal(second.pnu, OTHER_PNU);
  assert.equal(f.detailCounts.get(PNU), 1);
  assert.equal(f.detailCounts.get(OTHER_PNU), 1);
  assert.equal(f.calls.length, 8);
});

test('identical in-flight requests share work while refresh, scale and expiration obtain new images', async () => {
  const f = fixture();
  await Promise.all([f.service.load(PNU), f.service.load(PNU)]);
  assert.equal(f.detailCounts.get(PNU), 1);
  await f.service.load(PNU);
  assert.equal(f.detailCounts.get(PNU), 1);
  await f.service.load(PNU, '2400');
  assert.equal(f.detailCounts.get(PNU), 2);
  await f.service.load(PNU, '1200', { refresh: true });
  assert.equal(f.detailCounts.get(PNU), 3);
  f.advance();
  await f.service.load(PNU);
  assert.equal(f.detailCounts.get(PNU), 4);
});

test('an empty image is retried once using the same cookie without silently dropping its legend', async () => {
  let mapAttempts = 0;
  const f = fixture({ imageResponse({ key }) {
    if (key === keyFor(PNU) && ++mapAttempts === 1) return new Response(null, { headers: { 'Content-Type': 'image/png' } });
    return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
  } });
  const data = await f.service.load(PNU);
  assert.equal(mapAttempts, 2);
  assert.equal(f.detailCounts.get(PNU), 1);
  assert.equal(data.legend.length, 2);
});

test('persistently empty or invalid PNG images fail and never enter the success cache', async () => {
  let mapAttempts = 0;
  const empty = fixture({ imageResponse({ key }) {
    if (key === keyFor(PNU)) { mapAttempts += 1; return new Response(null, { headers: { 'Content-Type': 'image/png' } }); }
    return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
  } });
  await assert.rejects(empty.service.load(PNU));
  await assert.rejects(empty.service.load(PNU));
  assert.equal(mapAttempts, 4);
  assert.equal(empty.detailCounts.get(PNU), 2);
  let legendAttempts = 0;
  const missingLegend = fixture({ imageResponse({ key }) {
    if (key === keyFor(PNU) + '0') { legendAttempts += 1; return new Response(null, { headers: { 'Content-Type': 'image/png' } }); }
    return new Response(PNG, { headers: { 'Content-Type': 'image/png' } });
  } });
  await assert.rejects(missingLegend.service.load(PNU));
  assert.equal(legendAttempts, 2, 'a failed legend is retried and reported rather than omitted');
  for (const payload of [Buffer.from('<html>not an image</html>'), PNG.subarray(0, 12), PNG.subarray(0, PNG.length - 12)]) {
    const invalid = fixture({ imageResponse() { return new Response(payload, { headers: { 'Content-Type': 'image/png' } }); } });
    await assert.rejects(invalid.service.load(PNU));
  }
  const oversized = fixture({ imageResponse() { return new Response(Buffer.alloc(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'image/png' } }); } });
  await assert.rejects(oversized.service.load(PNU));
});

test('an expired successful response is not silently returned after the source fails', async () => {
  let unavailable = false;
  const f = fixture({ detailResponse({ pnu, cookie }) {
    if (unavailable) return new Response('unavailable', { status: 503 });
    return new Response(detailHtml(pnu), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie + '; Path=/' } });
  } });
  await f.service.load(PNU);
  unavailable = true;
  f.advance();
  await assert.rejects(f.service.load(PNU));
  assert.equal(f.detailCounts.get(PNU), 2);
});

test('the shared endpoint validates methods and parameters before upstream access', async () => {
  const f = fixture();
  const run = async (path, method = 'GET') => {
    const result = {};
    const handled = await handleEumPlanRequest({ method }, {
      writeHead(status, headers) { result.status = status; result.headers = headers; },
      end(body) { result.data = JSON.parse(body); },
    }, new URL(path, 'https://guide.invalid'), f.service);
    return { ...result, handled };
  };
  assert.equal((await run('/api/eum/plan?pnu=' + PNU, 'POST')).status, 405);
  for (const query of ['pnu=bad', `pnu=${PNU}&url=https://example.com`, `pnu=${PNU}&key=stolen`, `pnu=${PNU}&refresh=anything`, `pnu=${PNU}&scale=NaN`, `pnu=${PNU}&pnu=${OTHER_PNU}`, `pnu=${PNU}&scale=1200&scale=2400`]) {
    assert.equal((await run('/api/eum/plan?' + query)).status, 400, query);
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await run('/api/eum/anything')).handled, false);
  const success = await run('/api/eum/plan?pnu=' + PNU);
  assert.equal(success.status, 200);
  assert.equal(success.data.pnu, PNU);
  assert.match(success.headers['Cache-Control'], /no-store/);
  assert.equal(success.headers['Set-Cookie'], undefined);
});
