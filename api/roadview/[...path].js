const { handleRoadviewRequest } = require('../../roadview-service.cjs');

module.exports = async function roadview(request, response) {
  const protocol = request.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https';
  const url = new URL(request.url, `${protocol}://${request.headers.host}`);
  if (!await handleRoadviewRequest(request, response, url)) {
    response.writeHead(404, { 'Cache-Control': 'private, no-store' });
    response.end('Not found');
  }
};
