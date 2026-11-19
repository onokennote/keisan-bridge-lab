// マサの豆知識：大会練習モードの人数を16人に（4人卓×4）
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, 'page.html')); await p.waitForTimeout(800);
  await p.evaluate(() => { localStorage.clear(); }); await p.reload(); await p.waitForTimeout(800);
  const ok = (c, m) => console.log((c ? 'OK  ' : 'NG  ') + m);
  await p.evaluate(() => { const i = document.querySelector('input'); }); 
  if (await p.$('#name-in, input[name="name"], .ask-name input')) { await p.fill('.ask-name input, #name-in', 'テスト'); await p.keyboard.press('Enter'); await p.waitForTimeout(600); }
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.go('setup-tour'); }); await p.waitForTimeout(500);
  const n0 = await p.evaluate(() => KBAPP.S.suT && KBAPP.S.suT.nPlayers);
  ok(await p.$('.su-tip'), `15人のときマサの豆知識が出る（いま${n0}人）`);
  await p.click('.su-tip summary'); await p.waitForTimeout(300);
  await (await p.$('.su-tip')).screenshot({ path: path.join(__dirname, 'out/tip16.png') });
  await p.click('.su-tip [data-su="tnset"]'); await p.waitForTimeout(400);
  const n1 = await p.evaluate(() => KBAPP.S.suT.nPlayers), tb = await p.evaluate(() => KB.splitTables(KBAPP.S.suT.nPlayers, 5).map(x => x + '人').join(','));
  ok(n1 === 16 && tb === '4人,4人,4人,4人', `16人・4人卓×4 (${n1} ${tb})`);
  ok(!(await p.$('.su-tip')), '16人なら豆知識は消える');
  // アドバイスの「やってみる」から
  await p.evaluate(() => { KBAPP.S.suT.nPlayers = 13; KBAPP.act('tour4'); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => KBAPP.S.view === 'setup-tour' && KBAPP.S.suT.nPlayers === 16), 'アドバイスのボタンで16人の大会の設定へ');
  ok(!errs.length, 'エラーなし ' + errs.join('/'));
  await b.close();
})();
