# 此刻源码

Node.js >=22.18；npm ci 安装，npm run dev 启动，npm test 测试，npm run build 构建，npm run preview 预览。

默认原创演示模式；启动后点「开始这一刻」进入 MAD 风格字幕演出。可切换三种情绪风格或滚动文字。音频、封面和文字在本地，无需在线 API。

网易云模式代理 /api 到 127.0.0.1:3001；服务端联调以队友交付为准。详细说明、来源和展示稿见包根目录 README.md、开源与AI使用声明.md 及 docs/。

tests/browser.mjs 需先启动应用，再运行 npx playwright install chromium 和 npm run test:browser。本窗口因执行环境限制未完成浏览器自动截图；用户已确认本机播放、沉浸与字幕效果正常。
