const http = require("http");
const fs = require("fs");
const path = require("path");
const { Readable } = require("node:stream");
const accessControl = import("./access-control.mjs");

const root = __dirname;
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

function createSiteServer() {
  return http.createServer(async (request, response) => {
    try {
      const { authorizeRequest, privateHeaders } = await accessControl;
      const origin = `http://${request.headers.host || `127.0.0.1:${port}`}`;
      const init = { method: request.method, headers: request.headers };
      if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = Readable.toWeb(request);
        init.duplex = "half";
      }
      const accessResponse = await authorizeRequest(new Request(new URL(request.url, origin), init));
      for (const [name, value] of Object.entries(privateHeaders)) response.setHeader(name, value);
      if (accessResponse) {
        response.writeHead(accessResponse.status, Object.fromEntries(accessResponse.headers));
        response.end(request.method === "HEAD" ? undefined : Buffer.from(await accessResponse.arrayBuffer()));
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" });
        response.end("Method not allowed");
        return;
      }
    const parsedUrl = new URL(request.url, `http://127.0.0.1:${port}`);
    const pathname = decodeURIComponent(parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname);
    const filePath = path.resolve(root, `.${pathname}`);

    if (!filePath.startsWith(root + path.sep)) {
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

      const range = request.headers.range;
      const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";

      if (range) {
        const match = range.match(/^bytes=(\d+)-(\d*)$/);

        if (!match) {
          response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
          response.end();
          return;
        }

        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : stats.size - 1;

        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= stats.size || start > end) {
          response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
          response.end();
          return;
        }

        response.writeHead(206, {
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
          "Content-Range": `bytes ${start}-${end}/${stats.size}`,
          "Content-Type": contentType,
        });
        if (request.method === "HEAD") response.end();
        else fs.createReadStream(filePath, { start, end }).on("error", () => response.destroy()).pipe(response);
        return;
      }

      response.writeHead(200, {
        "Accept-Ranges": "bytes",
        "Content-Length": stats.size,
        "Content-Type": contentType,
      });
      if (request.method === "HEAD") response.end();
      else fs.createReadStream(filePath).on("error", () => response.destroy()).pipe(response);
    });
    } catch (error) {
      if (!response.headersSent) response.writeHead(500, { "Cache-Control": "no-store" });
      response.end("Unable to serve request");
    }
  });
}

if (require.main === module) {
  createSiteServer().listen(port, "127.0.0.1", () => {
    console.log(`토지정보 통합 안내: http://127.0.0.1:${port}/`);
  });
}

module.exports = { createSiteServer };
