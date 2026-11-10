// ホームボタン（右下の🏠）のテスト：node fab.js
const { chromium } = require('playwright');
const path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 360, height: 760 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { window.KB_TEST = 1; });
  await pg.goto('file://' + path.join(__dirname, 'page.html')); await pg.waitForTimeout(500);
  ok(!(await pg.$('#home-fab')), 'ホームでは出ない');
  for (const v of ['setup-practice', 'growth', 'ranking', 'numbers', 'rules', 'zukan']) {
    await pg.evaluate(v => KBAPP.go(v), v); await pg.waitForTimeout(200);
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await pg.waitForTimeout(100);
    const vis = await pg.evaluate(() => { const b = document.getElementById('home-fab'); if (!b) return false; const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; });
    if (v === 'numbers') await pg.screenshot({ path: path.join(__dirname, 'out', 'fab_numbers.png') });
    await pg.click('#home-fab'); await pg.waitForTimeout(200);
    ok(vis && await pg.evaluate(() => KBAPP.S.view === 'home'), `${v}：下までスクロールしても見え、押すとホームへ`);
  }
  // 対局中：確認してから中断（続きから再開できる）
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'instant'; });
  await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(1500);
  await pg.screenshot({ path: path.join(__dirname, 'out', 'fab_game.png') });
  await pg.click('#home-fab'); await pg.waitForTimeout(300);
  ok(/続きから/.test(await pg.evaluate(() => (document.querySelector('#modal') || {}).textContent || '')), '対局中は、マサが「続きから再開できる」と確かめる');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'fab_ask.png') });
  await pg.click('#modal [data-act="close"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => KBAPP.S.view === 'game' && !KBAPP.S.paused), '「続ける」で対局に戻る');
  await pg.click('#home-fab'); await pg.waitForTimeout(200); await pg.click('#modal [data-act="fab-home-go"]'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => KBAPP.S.view === 'home' && !KBAPP.S.paused && !!document.querySelector('[data-act="resume"],[data-act="continue"],.resume')), 'ホームへ戻り、続きから再開できる');
  ok(!errs.length, 'ページのエラーなし ' + errs.slice(0, 2).join(' / '));
  await b.close();
})();
