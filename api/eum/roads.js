const { handleEumRoadsRequest } = require('../../eum-roads.cjs');

module.exports = async function roads(request, response) {
  if (!await handleEumRoadsRequest(request, response, new URL(request.url, 'http://localhost'))) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: '지원하지 않는 도로 조회입니다.' }));
  }
};
