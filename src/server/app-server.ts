import Koa from "koa";
import koaBody from "koa-body";
import path from "path";
import fs from "fs";
import serve from "koa-static";
import websockify from "koa-websocket";
import router from "./api/index";
import ws from "./api/ws";
import responseMiddleware from "./middleware/response";
import authMiddleware from "./middleware/auth";

const app = websockify(new Koa());
const buildDir = path.join(__dirname, "../../../build");
const indexHtmlPath = path.join(buildDir, "index.html");
const appVersion = Date.now().toString();

function setNoCache(ctx: { set: (field: string, value: string) => void }) {
  ctx.set("Cache-Control", "no-cache, no-store, must-revalidate");
  ctx.set("Pragma", "no-cache");
  ctx.set("Expires", "0");
}

// 版本探测：前端可轮询该接口，发现新版本后自动刷新页面
app.use(async (ctx, next) => {
  if (ctx.path === "/version.json") {
    setNoCache(ctx);
    ctx.type = "application/json";
    ctx.body = { version: appVersion };
    return;
  }
  await next();
});

// 提供静态文件服务
app.use(
  serve(buildDir, {
    maxage: 0,
    gzip: true,
    setHeaders: (res, filePath) => {
      const relativePath = path.relative(buildDir, filePath).replace(/\\/g, "/");
      if (
        relativePath === "index.html" ||
        relativePath === "asset-manifest.json" ||
        relativePath === "service-worker.js"
      ) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        return;
      }
      if (relativePath.startsWith("static/")) {
        // CRA 的静态资源文件名自带 hash，可长期缓存。
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=300");
    },
  })
);

// 处理API请求
app
  .use(koaBody({ multipart: true }))
  .use(responseMiddleware)
  .use(authMiddleware)
  .use(router.routes())
  .use(router.allowedMethods());

// 对于未匹配到的路由，返回index.html，让前端路由处理
app.use(async (ctx) => {
  setNoCache(ctx);
  ctx.type = "html";
  ctx.body = fs.createReadStream(indexHtmlPath);
});

app.ws.use(ws);

const rawPort = process.env.PORT || process.env.APP_PORT || "1999";
const PORT = Number.parseInt(rawPort, 10) || 1999;
app.listen(PORT);
console.log(`server at: http://localhost:${PORT}`);
