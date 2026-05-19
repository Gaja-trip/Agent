const http = require("http");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".cjs": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".shp": "application/octet-stream",
  ".shx": "application/octet-stream",
  ".dbf": "application/octet-stream",
  ".prj": "text/plain; charset=utf-8",
};

http
  .createServer((request, response) => {
    const parsedUrl = new URL(request.url, `http://127.0.0.1:${port}`);
    const pathname = decodeURIComponent(parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname);
    const filePath = path.resolve(root, `.${pathname}`);

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.stat(filePath, (statError, stats) => {
      if (statError || !stats.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Content-Length": stats.size,
        "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      });
      fs.createReadStream(filePath).pipe(response);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`토지정보 통합 안내: http://127.0.0.1:${port}/`);
  });
