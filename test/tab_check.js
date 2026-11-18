// ホームのタブが1列に収まるか（幅320・360・390）。使い方：cd test && node tab_check.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.KB_TEST=1</script></head><body>' + fs.readFileSync(path.join(__dirname, '../dist/artifact.html'), 'utf8') + '</body></html>';
  fs.writeFileSync(path.join(__dirname, 'page.html'), html);
  const b = await chromium.launch();
  for (const w of [320, 360, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 }); await p.goto('file://' + path.join(__dirname, 'page.html')); await p.evaluate(() => { localStorage.setItem('kb.forceTabs', '1'); KBAPP.go('home'); }); await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const vis = ['h-online', 'h-prac', 'h-tour', 'h-mini', 'h-about'].filter(id => { const e = document.getElementById(id); return e && !e.hidden; }).length; const n = document.querySelector('.htabs'); const bs = [...n.querySelectorAll('button')].map(b => b.getBoundingClientRect()); return { visibleTabs: vis, rows: new Set(bs.map(x => Math.round(x.top))).size, over: n.scrollWidth > n.clientWidth + 1, right: Math.round(Math.max(...bs.map(x => x.right))), vw: innerWidth }; });
    console.log(w, JSON.stringify(r)); if (w === 360) { const n = await p.$('.htabs'); await n.screenshot({ path: path.join(__dirname, 'out', 'tabs360.png') }); }
    await p.close();
  }
  await b.close();
})();
