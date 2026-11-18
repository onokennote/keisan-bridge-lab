// 日本一への道のスクリーンショット（試作の確認用）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.KB_TEST=1</script></head><body>' + fs.readFileSync(path.join(__dirname, '../dist/artifact.html'), 'utf8') + '</body></html>';
  fs.writeFileSync(path.join(__dirname, 'page.html'), html);
  const b = await chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(__dirname, 'page.html')); await pg.waitForTimeout(600);
  await pg.evaluate(() => { const i = document.querySelector('#new-name'); if (i) { i.value = 'ユウ'; KBAPP.act('create-profile'); } }); await pg.waitForTimeout(800);
  await pg.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); const g = KBAPP.G(); Object.assign(g.cnt, { practice_set: 12, games: 80, chart: 14, outs3: 2, outs4: 0, rating: 3.4, quick5: 4, tour_done: 1 }); localStorage.setItem('kb.growth', JSON.stringify(g)); localStorage.setItem('kb.watched', 'true'); KBAPP.act && KBAPP.S && (KBAPP.S.view = 'road'); });
  console.log(await pg.evaluate(() => [localStorage.getItem('kb.profile'), Object.keys(localStorage).join(',')].join(' / ')));
  await pg.evaluate(() => { document.querySelector('[data-go="road"]') ? document.querySelector('[data-go="road"]').click() : 0; }); await pg.waitForTimeout(800);
  await pg.screenshot({ path: path.join(__dirname, 'out', 'road_full.png'), fullPage: true });
  await pg.screenshot({ path: path.join(__dirname, 'out', 'road_top.png') });
  await pg.evaluate(() => { document.querySelectorAll('.rd-cond')[9].open = true; document.querySelectorAll('.rd-stage')[9].scrollIntoView({ block: 'start' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(__dirname, 'out', 'road_mid.png') });
  await pg.evaluate(() => document.querySelectorAll('.rd-stage')[11].scrollIntoView({ block: 'start' })); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(__dirname, 'out', 'road_end.png') });
  await pg.evaluate(() => { document.querySelector('[data-go="home"]').click(); }); await pg.waitForTimeout(500);
  const bn = await pg.$('.road-banner'); if (bn) await bn.screenshot({ path: path.join(__dirname, 'out', 'road_banner.png') });
  console.log('errors', errs); await b.close();
})();
