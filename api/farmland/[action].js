const { handleFarmlandRequest } = require('../../farmland-service.cjs');

// Vercel invokes this handler for /api/farmland/config, info, parcel, tile and wms.
// Keep the same validated routes as the local Node server.
module.exports = async function farmland(request, response) {
  const url = new URL(request.url, 'http://localhost');
  if (!await handleFarmlandRequest(request, response, url)) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: '지원하지 않는 지도 조회입니다.' }));
  }
};
