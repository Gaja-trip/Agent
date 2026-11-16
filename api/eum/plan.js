const { handleEumPlanRequest } = require('../../eum-plan.cjs');

module.exports = async function plan(request, response) {
  if (!await handleEumPlanRequest(request, response, new URL(request.url, 'http://localhost'))) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: '지원하지 않는 도면 조회입니다.' }));
  }
};
