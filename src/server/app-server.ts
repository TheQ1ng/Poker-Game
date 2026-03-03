import Koa from "koa";
import koaBody from "koa-body";
import path from "path";
import serve from "koa-static";
import websockify from "koa-websocket";
import router from "./api/index";
import ws from "./api/ws";
import responseMiddleware from "./middleware/response";
import authMiddleware from "./middleware/auth";

const app = websockify(new Koa());

// 提供静态文件服务
app.use(serve(path.join(__dirname, "../../../build"), {
  maxage: 86400000, // 24小时缓存
  gzip: true // 启用gzip压缩
}));

// 处理API请求
app
  .use(koaBody({ multipart: true }))
  .use(responseMiddleware)
  .use(authMiddleware)
  .use(router.routes())
  .use(router.allowedMethods());

// 对于未匹配到的路由，返回index.html，让前端路由处理
app.use(async (ctx) => {
  ctx.type = 'html';
  ctx.body = require('fs').createReadStream(path.join(__dirname, "../../../build/index.html"));
});

app.ws.use(ws);

const PORT = 8086;
app.listen(PORT);
console.log(`server at: http://localhost:${PORT}`);
