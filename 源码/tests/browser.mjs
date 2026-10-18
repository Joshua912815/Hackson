// Run with a local app already listening on 5173: npm run test:browser
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.APP_URL || 'http://127.0.0.1:5173';
const output = new URL('../test-results/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, height] of [[1440, 900], [1280, 800], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      const OriginalAudio = window.Audio;
      window.__audioInstances = [];
      window.Audio = class extends OriginalAudio {
        constructor(...args) { super(...args); window.__audioInstances.push(this); }
      };
    });
    await page.goto(base);
    await page.getByRole('button', { name: '开始这一刻', exact: true }).waitFor();
    await page.screenshot({ path: output + width + '-discover.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '页面不应水平溢出');
    await page.getByRole('button', { name: '需要一点能量', exact: true }).click();
    assert.equal(await page.locator('.track-copy strong').first().textContent(), '把光留住');
    await page.getByRole('button', { name: '开始这一刻', exact: true }).click();
    await page.waitForFunction(() => window.__audioInstances.length === 1 && !window.__audioInstances[0].paused && window.__audioInstances[0].currentTime > .3);
    await page.getByRole('region', { name: '情绪字幕演出', exact: true }).waitFor();
    await page.getByRole('heading', { name: '今天也有值得收藏的小事', exact: true }).waitFor();
    await page.getByRole('button', { name: '微光', exact: true }).click();
    assert.equal(await page.locator('.subtitle-theatre').getAttribute('class'), 'subtitle-theatre mood-energy reduced');
    await page.screenshot({ path: output + width + '-immersive.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.getByRole('slider', { name: '播放进度' }).fill('18000');
    await page.waitForFunction(() => window.__audioInstances[0].currentTime >= 18);
    await page.getByRole('button', { name: '暂停播放', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__audioInstances[0].paused), true);
    await page.getByRole('button', { name: '开始播放', exact: true }).click();
    await page.getByRole('button', { name: '滚动文字', exact: true }).click();
    await page.getByRole('button', { name: '不必等到万事俱备', exact: true }).waitFor();
    await page.getByRole('button', { name: '字幕演出', exact: true }).click();
    await page.getByRole('button', { name: '返回发现', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__audioInstances.length), 1);
    assert.equal(await page.evaluate(() => window.__audioInstances[0].paused), false);
    await page.getByRole('button', { name: '收藏 把光留住', exact: true }).click();
    await page.getByRole('button', { name: /心动收藏/ }).click();
    assert.equal(await page.getByRole('dialog').locator('.track-row').count(), 1);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '打开播放队列' }).click();
    assert.equal(await page.getByRole('dialog').locator('.track-row').count(), 3);
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: '搜索歌曲或歌手' }).fill('不会存在的歌曲');
    await page.getByRole('button', { name: '提交搜索' }).click();
    await page.getByRole('heading', { name: '还没有找到这段旋律' }).waitFor();
    await page.getByRole('textbox', { name: '搜索歌曲或歌手' }).fill('慢慢来');
    await page.getByRole('button', { name: '提交搜索' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.track-row').length === 1);
    await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"code":"NOT_CONFIGURED"}}' }));
    await page.getByLabel('音乐来源', { exact: true }).selectOption('netease');
    await page.getByRole('heading', { name: '旋律还没连接上' }).waitFor();
    assert.equal(await page.locator('.track-row').count(), 0);
    await page.getByRole('button', { name: '切换到原创演示', exact: true }).click();
    await page.getByRole('button', { name: '开始这一刻', exact: true }).waitFor();
    assert.deepEqual(errors, [], '不应有运行时异常');
    console.log(width + '×' + height + ': 音频、切页、进度、收藏、队列、搜索和错误状态通过');
    await context.close();
  }
} finally { await browser.close(); }
