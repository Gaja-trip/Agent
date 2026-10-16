const fs = require('node:fs/promises');
const path = require('node:path');
const accessControl = import('./access-control.mjs');
const root = path.join(__dirname, 'roadview');
const files = new Set(['app.mjs', 'viewer.html', 'viewer.mjs', 'style.css', 'icon.svg', 'geo.mjs', 'sync.mjs', 'captures.mjs', 'address-search.mjs', 'geocoding.mjs']);
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

function send(request, response, status, body, type = 'text/html; charset=utf-8') {
  response.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
    'Referrer-Policy': 'same-origin',
    Vary: 'Cookie',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}

function entryNotice(request, response) {
  send(request, response, 403, `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>로드뷰 접속 안내</title><style>body{margin:0;background:#f4f8f5;color:#20332b;font:16px/1.7 system-ui,sans-serif;word-break:keep-all}main{max-width:440px;margin:16vh auto;padding:28px}h1{font-size:24px}a{display:inline-block;padding:12px 18px;border-radius:8px;background:#1f6b55;color:white;text-decoration:none}</style></head><body><main><h1>통합안내에서 로드뷰를 열어 주세요</h1><p>로드뷰 멀티뷰는 토지정보 통합안내의 항공사진 메뉴에서 로드뷰 버튼을 눌러 이용할 수 있습니다. 복사한 주소로는 직접 접속할 수 없습니다.</p><a href="/?portal=aerial">토지정보 통합안내로 이동</a></main></body></html>`);
}

async function launchRequested(request) {
  if (!request.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) return false;
  if (Number(request.headers['content-length']) > 128) return false;
  let body = request.body;
  if (body === undefined) {
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
      length += Buffer.byteLength(chunk);
      if (length > 128) return false;
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') return body.length <= 128 && new URLSearchParams(body).get('launch') === '1';
  return body && Object.keys(body).length === 1 && body.launch === '1';
}

async function handleRoadviewRequest(request, response, url) {
  if (!url.pathname.startsWith('/api/roadview/')) return false;
  if (url.pathname === '/api/roadview/open' && (request.method === 'GET' || request.method === 'HEAD')) {
    entryNotice(request, response);
    return true;
  }
  const { hasAccess } = await accessControl;
  if (!await hasAccess(new Request(url, { headers: request.headers }))) {
    send(request, response, 401, '토지정보 통합안내에 먼저 접속해 주세요.', 'text/plain; charset=utf-8');
    return true;
  }
  if (url.pathname === '/api/roadview/open') {
    if (request.method !== 'POST') {
      send(request, response, 405, 'Method not allowed', 'text/plain; charset=utf-8');
      return true;
    }
    // Require a same-origin form launch. Referrer alone is not an access check.
    const origin = request.headers.origin;
    const fetchSite = request.headers['sec-fetch-site'];
    if (origin !== url.origin || (fetchSite && fetchSite !== 'same-origin')) {
      entryNotice(request, response);
      return true;
    }
    const lat = url.searchParams.get('lat');
    const lng = url.searchParams.get('lng');
    if (!lat?.trim() || !lng?.trim() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) || Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180 || !await launchRequested(request)) {
      send(request, response, 400, '로드뷰 위치를 다시 선택해 주세요.', 'text/plain; charset=utf-8');
      return true;
    }
    const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
    send(request, response, 200, html.replace('<head>', '<head>\n  <base href="/api/roadview/files/">'));
    return true;
  }
  const name = url.pathname.slice('/api/roadview/files/'.length);
  if (!url.pathname.startsWith('/api/roadview/files/') || !files.has(name)) {
    send(request, response, 404, 'Not found', 'text/plain; charset=utf-8');
    return true;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(request, response, 405, 'Method not allowed', 'text/plain; charset=utf-8');
    return true;
  }
  send(request, response, 200, await fs.readFile(path.join(root, name)), mime[path.extname(name)]);
  return true;
}

module.exports = { handleRoadviewRequest };
