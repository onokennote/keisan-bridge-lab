// 上がったあとの自分のひと言の位置（「結果を見る」とかぶらない）。使い方：cd test && node bub_check.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.KB_TEST=1</script></head><body>' + fs.readFileSync(path.join(__dirname, '../dist/artifact.html'), 'utf8') + '</body></html>';
  fs.writeFileSync(path.join(__dirname, 'page.html'), html);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, 'page.html')); await p.waitForTimeout(500);
  await p.click('[data-go="setup-practice"]'); await p.click('[data-act="start-practice"]'); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const S = KBAPP.S; S.bubbles = S.bubbles || {}; S.bubbles[0] = { text: 'ヤッター！上がりや！' }; S.winShow = true; KBAPP.go('game'); const e = document.querySelector('.me-av .bubble'), bt = document.querySelector('.win-strip .btn'); e.scrollIntoView({ block: 'center' }); const a = e.getBoundingClientRect(), c = bt ? bt.getBoundingClientRect() : null; return { w: Math.round(a.width), overlap: c ? !(a.bottom <= c.top || a.top >= c.bottom || a.right <= c.left || a.left >= c.right) : null }; });
  console.log(JSON.stringify(r)); await p.screenshot({ path: path.join(__dirname, 'out', 'me_bubble.png') });
  await b.close();
})();
