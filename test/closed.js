// アーティファクト版を閉じた画面（はじめての人／記録のある人）。./build.sh のあと node closed.js
const { chromium } = require('playwright');
const path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  const url = 'file://' + path.join(__dirname, 'page.html');
  // はじめての人
  await pg.goto(url); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('kb.testClosed', '1'); }); await pg.reload(); await pg.waitForTimeout(600);
  ok(await pg.evaluate(() => !!document.querySelector('.closed') && !document.querySelector('[data-go],[data-act],#new-name') && !document.querySelector('#modal')), 'はじめての人：説明だけで、遊ぶボタンも名前の入力もない');
  ok((await pg.getAttribute('#cl-go', 'href')) === 'https://keisan-bridge.lolipop-now.app/', 'はじめての人：新しいサイトを開くボタン');
  ok(await pg.evaluate(() => /非公式/.test(document.body.innerText) && !!document.querySelector('a[href*="amebaownd"]') && !!document.querySelector('a[href*="soogackuma.com/keisan-bridge"]')), '非公式の表示と公式へのリンクがある');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'closed_new.png'), fullPage: true });
  // 記録のある人
  await pg.evaluate(() => { localStorage.setItem('kb.profiles', JSON.stringify([{ id: 'pA', name: 'ケン', at: 1 }])); localStorage.setItem('kb.profile', '"pA"'); localStorage.setItem('kb.p.pA.growth', JSON.stringify({ games: [], ach: { 'win:1': 1 } })); localStorage.setItem('kb.settings', JSON.stringify({ name: 'ケン' })); });
  await pg.reload(); await pg.waitForTimeout(800);
  const href = await pg.getAttribute('#cl-go', 'href');
  ok(href.startsWith('https://keisan-bridge.lolipop-now.app/#kbmove='), '記録のある人：記録を持って移るボタン（データ入り）');
  ok((await pg.getAttribute('#cl-go2', 'href')) === 'https://keisan-bridge.lolipop-now.app/', '記録のある人：記録を持たずに移るボタン');
  ok(await pg.evaluate(() => /ケンさん/.test(document.querySelector('.cl-talk').innerText) && !document.querySelector('[data-go],[data-act]')), '名前で呼びかけ、遊ぶボタンはない');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'closed_has.png'), fullPage: true });
  const [np] = await Promise.all([ctx.waitForEvent('page', { timeout: 3000 }).catch(() => null), pg.click('#cl-go')]);
  ok(!!np, 'ボタンで新しいサイトが開く'); if (np) await np.close().catch(() => { });
  ok(await pg.evaluate(() => !document.querySelector('#cl-after').hidden && !!localStorage.getItem('kb.migSent')), '開いたあとの案内が出る');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
