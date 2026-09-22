const VworldParcel = require('./vworld-parcel.js');
const config = require('./vworld-config.js');

async function handleVworldRequest(request, response, url) {
  if (url.pathname !== '/api/vworld/parcel') return false;
  const send = (status, data) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(data));
  };
  if (request.method !== 'GET') { send(405, { error: '조회 요청만 지원합니다.' }); return true; }
  const pnu = url.searchParams.get('pnu') || '';
  if (!/^\d{19}$/.test(pnu)) { send(400, { error: '19자리 필지번호가 필요합니다.' }); return true; }
  try {
    const data = await VworldParcel.load(pnu, {
      key: process.env.VWORLD_API_KEY || config.key,
      domain: process.env.VWORLD_API_DOMAIN || config.domain,
      requestJson: async (upstreamUrl) => {
        // URLs are constructed by VworldParcel; never accept a caller-supplied host.
        if (upstreamUrl.origin !== 'https://api.vworld.kr') throw new Error('지원하지 않는 V-World 주소입니다.');
        try {
          const result = await fetch(upstreamUrl, { signal: AbortSignal.timeout(12000), redirect: 'error' });
          if (!result.ok) throw new Error('upstream unavailable');
          return await result.json();
        } catch {
          throw new Error('V-World 속성 서버에 연결하지 못했습니다. 잠시 후 다시 선택해 주세요.');
        }
      },
    });
    send(200, data);
  } catch (error) {
    send(502, { error: error.message });
  }
  return true;
}

module.exports = { handleVworldRequest };
