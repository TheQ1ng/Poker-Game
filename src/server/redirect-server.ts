import Koa from "koa";
import { getRegisterTokenSnapshot } from "./service/registerToken";

const app = new Koa();
const port = Number.parseInt(process.env.PORT || process.env.APP_PORT || "1000", 10) || 1000;
void getRegisterTokenSnapshot();
setInterval(() => {
  void getRegisterTokenSnapshot();
}, 1000);

function setNoCache(ctx: { set: (field: string, value: string) => void }) {
  ctx.set("Cache-Control", "no-cache, no-store, must-revalidate");
  ctx.set("Pragma", "no-cache");
  ctx.set("Expires", "0");
  ctx.set("X-Robots-Tag", "noindex, nofollow");
}

function renderPage() {
  const snapshot = getRegisterTokenSnapshot();
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>网页令牌</title>
  <style>
    :root {
      color-scheme: dark;
      --bg0: #060b14;
      --bg1: #0f1728;
      --bg2: #18233b;
      --card: rgba(255, 255, 255, 0.08);
      --line: rgba(255, 255, 255, 0.12);
      --text: #f4f7ff;
      --muted: #9eacc7;
      --accent: #7dd3fc;
      --accent2: #8b5cf6;
    }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background:
        radial-gradient(circle at 20% 20%, rgba(125, 211, 252, 0.18), transparent 30%),
        radial-gradient(circle at 80% 10%, rgba(139, 92, 246, 0.18), transparent 24%),
        linear-gradient(160deg, var(--bg1), var(--bg0) 60%, #04070d);
      color: var(--text);
    }
    body {
      display: grid;
      place-items: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      width: min(720px, 100%);
      padding: 32px;
      border-radius: 28px;
      background: var(--card);
      border: 1px solid var(--line);
      backdrop-filter: blur(18px);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .token {
      appearance: none;
      -webkit-appearance: none;
      width: 100%;
      padding: 24px 20px;
      border-radius: 22px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(3, 8, 18, 0.36);
      text-align: center;
      cursor: copy;
      font: inherit;
      color: inherit;
      font-size: clamp(44px, 10vw, 86px);
      line-height: 1;
      letter-spacing: 0.16em;
      font-weight: 900;
      user-select: all;
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }
    .token:hover {
      transform: translateY(-1px);
      border-color: rgba(125, 211, 252, 0.45);
      background: rgba(3, 8, 18, 0.45);
    }
    .token.copied {
      border-color: rgba(125, 211, 252, 0.75);
      box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.18), 0 18px 36px rgba(125, 211, 252, 0.12);
      background: rgba(6, 16, 32, 0.58);
    }
    .progress {
      height: 12px;
      border-radius: 999px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .progress > i {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      transform-origin: left center;
      transition: width 0.2s linear;
    }
    @media (max-width: 640px) {
      .card { padding: 24px 18px; border-radius: 22px; }
    }
  </style>
</head>
<body>
  <main class="card">
    <button class="token" id="token" type="button" title="点击复制" aria-label="点击复制网页令牌">${snapshot.current.token}</button>
    <div class="progress" aria-hidden="true"><i id="bar"></i></div>
  </main>
  <script>
    (() => {
      const rotateAt = ${snapshot.nextRotateAt};
      const intervalMs = ${snapshot.nextRotateAt - snapshot.current.issuedAt};
      const token = ${JSON.stringify(snapshot.current.token)};
      const tokenEl = document.getElementById("token");
      const barEl = document.getElementById("bar");
      let copiedTimer = null;

      if (tokenEl) tokenEl.textContent = token;

      const clearCopiedTimer = () => {
        if (copiedTimer) {
          clearTimeout(copiedTimer);
          copiedTimer = null;
        }
      };

      const markCopiedState = () => {
        if (!tokenEl) return;
        clearCopiedTimer();
        tokenEl.classList.add("copied");
        copiedTimer = window.setTimeout(() => {
          if (tokenEl) tokenEl.classList.remove("copied");
          copiedTimer = null;
        }, 900);
      };

      const copyText = async (text) => {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
          }

          const textarea = document.createElement("textarea");
          textarea.value = text;
          textarea.setAttribute("readonly", "true");
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textarea);
          return ok;
        } catch {
          return false;
        }
      };

      if (tokenEl) {
        tokenEl.addEventListener("click", () => {
          void copyText(token).then((ok) => {
            if (ok) {
              markCopiedState();
            }
          });
        });
      }

      const render = () => {
        const now = Date.now();
        const remainMs = Math.max(0, rotateAt - now);
        const progress = Math.min(100, Math.max(0, (remainMs / intervalMs) * 100));

        if (barEl) barEl.style.width = String(progress) + "%";
        if (remainMs <= 0) {
          window.location.reload();
        }
      };

      render();
      const timer = setInterval(render, 250);
      window.addEventListener("beforeunload", () => clearInterval(timer));
    })();
  </script>
</body>
</html>`;
}

app.use(async (ctx) => {
  setNoCache(ctx);
  ctx.status = 200;
  ctx.type = "html";
  ctx.body = renderPage();
});

app.listen(port, () => {
  console.log(`token server at: http://localhost:${port}`);
});
