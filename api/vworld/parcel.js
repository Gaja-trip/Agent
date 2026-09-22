const { handleVworldRequest } = require('../../vworld-service.cjs');

module.exports = async function parcel(request, response) {
  if (!await handleVworldRequest(request, response, new URL(request.url, 'http://localhost'))) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: '지원하지 않는 필지 조회입니다.' }));
  }
};
