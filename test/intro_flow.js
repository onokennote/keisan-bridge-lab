// 式ハンター・アウツチャレンジ：説明はホームの上に出し、「やめる」ならホームのまま、「次へ・始める」で専用の画面へ。使い方：cd test && node intro_flow.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.KB_TEST=1</script></head><body>' + fs.readFileSync(path.join(__dirname, '../dist/artifact.html'), 'utf8') + '</body></html>';
  fs.writeFileSync(path.join(__dirname, 'page.html'), html);
  const b = await chromium.launch(), errs = []; const p = await b.newPage({ viewport: { width: 390, height: 844 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'page.html')); await p.waitForTimeout(500);
  for (const [act, nm, view, btn] of [['hunt-start', '式ハンター', 'hunt', '[data-x="e0"]'], ['drill', 'アウツチャレンジ', 'drill', '[data-x="go"]']]) {
    await p.click(`.mini-t [data-act="${act}"]`); await p.waitForTimeout(500);
    ok(await p.evaluate(v => KBAPP.S.view === 'home' && !!document.querySelector('.whistle-ov'), view), `${nm}：説明はホームの上に出る（画面はまだホーム）`);
    await p.click('.whistle-ov [data-x="cancel"]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => KBAPP.S.view === 'home' && !document.querySelector('.whistle-ov')), `${nm}：やめるとホームのまま`);
    await p.click(`.mini-t [data-act="${act}"]`); await p.waitForTimeout(500); await p.click('.whistle-ov ' + btn); await p.waitForTimeout(2500);
    ok(await p.evaluate(v => KBAPP.S.view === v, view), `${nm}：次へ・始めるで専用の画面へ（${await p.evaluate(() => KBAPP.S.view)}）`);
    await p.evaluate(() => { document.querySelectorAll('.whistle-ov,#modal').forEach(e => e.remove()); KBAPP.S.hunt = null; KBAPP.go('home'); }); await p.waitForTimeout(400);
  }
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
