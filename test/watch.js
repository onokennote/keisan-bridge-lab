// 観戦のテスト：新規登録で誘導 → 観戦 → 1ゲーム目の感想 → 次のゲーム → やめる：node watch.js
const { chromium } = require('playwright');
const path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(__dirname, 'page.html'));
  await pg.evaluate(() => localStorage.setItem('kb.testAskName', '1')); await pg.reload(); await pg.waitForTimeout(600);
  await pg.fill('#new-name', 'おのけん'); await pg.click('[data-act="create-profile"]'); await pg.waitForTimeout(3200);
  ok(!!(await pg.$('.watch-invite')), '新規登録のあとに観戦へ誘う');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'watch_invite.png') });
  await pg.click('.watch-invite [data-act="watch-first"]'); await pg.waitForTimeout(4000);
  ok(await pg.evaluate(() => KBAPP.S.view === 'watch'), '観戦画面になる');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'watch_game.png') });
  let t0 = Date.now(); await pg.waitForSelector('.w-sum', { timeout: 240000 });
  console.log('1ゲーム目の所要 ' + Math.round((Date.now() - t0) / 1000) + '秒');
  const sum = await pg.evaluate(() => [...document.querySelectorAll('.w-sum .w-cm')].map(e => e.innerText));
  console.log(sum.join('\n'));
  ok(sum.length === 2 && /ゴール|サッカー|ハットトリック|ゴラッソ|ポーカー|ナッツ|ベンチ|ドロー/.test(sum[1]), 'ゲームごとに博士とマサの感想（マサはたとえ入り）');
  await pg.evaluate(() => document.querySelector('.w-sum').scrollIntoView());
  await pg.screenshot({ path: path.join(__dirname, 'out', 'watch_sum.png') });
  await pg.click('[data-act="watch-next"]'); await pg.waitForTimeout(3000);
  ok(await pg.evaluate(() => KBAPP.S.W && KBAPP.S.W.gi === 2 && !document.querySelector('.w-sum')), '次のゲームへ進める');
  await pg.click('[data-act="watch-quit"]'); await pg.waitForTimeout(2500);
  ok(await pg.evaluate(() => !KBAPP.S.W && KBAPP.S.view !== 'watch'), 'いつでもやめられる（タイマーも止まる）');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
