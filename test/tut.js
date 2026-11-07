// チュートリアルのテスト：新規登録→ルールの説明→最後に1セット練習へ：node tut.js
const { chromium } = require('playwright');
const path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(__dirname, 'page.html'));
  ok(await pg.evaluate(() => { const c = new Array(14).fill(0); [1, 2, 3].forEach(v => c[v]++); return KB.findMoves(c, 13, 'all', 3).length === 0 && !!KB.evalSelection([11, 4], 7) && !!KB.evalSelection([12, 3], 9); }), '例題の答えが正しい（A・2・3で13は作れない など）');
  await pg.evaluate(() => localStorage.setItem('kb.testAskName', '1')); await pg.reload(); await pg.waitForTimeout(600);
  await pg.fill('#new-name', 'おのけん'); await pg.click('[data-act="create-profile"]'); await pg.waitForTimeout(3300);
  ok(!!(await pg.$('[data-act="tut-start"]')), '新規登録のあと、ルールの説明を受けるか聞く');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'tut_invite.png') });
  await pg.click('[data-act="tut-start"]'); await pg.waitForTimeout(500);
  const n = await pg.evaluate(() => KBAPP.TUT_N());
  for (let i = 0; i < n; i++) {
    await pg.waitForTimeout(900);
    if (await pg.$('[data-tutc]')) { // 場7：J と 4 で J − 4
      ok(await pg.evaluate(() => document.querySelector('[data-act="tut-next"]').disabled), 'やってみるまで次へ進めない');
      await pg.click('[data-tutc="0"]'); await pg.click('[data-tutc="1"]'); await pg.waitForTimeout(200);
      await pg.screenshot({ path: path.join(__dirname, 'out', 'tut_pick.png') });
      await pg.click('[data-tutplay]'); await pg.waitForTimeout(300);
      ok(await pg.evaluate(() => /ナイス/.test(document.querySelector('.tut-msg').innerText)), '札を選んで出すと「ナイス」');
    }
    if (await pg.$('[data-tuto]')) { await pg.click('[data-tuto="0"]'); await pg.waitForTimeout(300); if (i === 5) await pg.screenshot({ path: path.join(__dirname, 'out', 'tut_choice.png') }); }
    if (i === 9) await pg.screenshot({ path: path.join(__dirname, 'out', 'tut_menu.png') });
    if (i < n - 1) await pg.click('[data-act="tut-next"]');
  }
  await pg.screenshot({ path: path.join(__dirname, 'out', 'tut_end.png') });
  await pg.click('[data-act="tut-end"]'); await pg.waitForTimeout(400);
  ok(await pg.evaluate(() => KBAPP.S.view === 'setup-practice' && !document.querySelector('#modal')), '最後は1セット練習へ');
  await pg.click('[data-go="home"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => { const w = document.querySelector('.watch-sm'), s = document.querySelector('[data-go="setup-practice"]'); return w && s && (w.compareDocumentPosition(s) & 4); }), '観戦ボタンは練習開始ボタンの上（小さめ）');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
