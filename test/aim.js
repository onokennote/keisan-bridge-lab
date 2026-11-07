// 自動照準のテスト：所持1発で式ハンターを始め、20匹を自動で捕獲→得点0のまま→手動に戻る：node aim.js
const { chromium } = require('playwright');
const path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(__dirname, 'page.html')); await pg.waitForTimeout(500);
  // 「図鑑の場」銀を持っている状態で、決勝進出のご褒美を受け取る（大会は省略して関数を直接呼ぶ）
  await pg.evaluate(() => { KBAPP.testAch('zukan_cat', 3); document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); });
  const n0 = await pg.evaluate(() => { const T = {}; KBAPP.aimReward(T); return [T.aimGot, KBAPP.aimCount()]; });
  ok(n0[0] && n0[1] === 1, 'ご褒美で自動照準が1発増える（所持 ' + n0[1] + '）');
  await pg.evaluate(() => KBAPP.go('home')); await pg.waitForTimeout(3500);
  ok(await pg.evaluate(() => /自動照準 ×1/.test(document.body.innerText)), 'ホームの式ハンターに所持数が出る');
  await pg.click('[data-act="hunt-start"]'); await pg.waitForTimeout(300);
  ok(!!(await pg.$('[data-act="hunt-go-aim"]')), '開始前に「自動照準を使って始める」が出る');
  await pg.click('[data-act="hunt-go-aim"]');
  ok(await pg.evaluate(() => KBAPP.aimCount()) === 0, '使うと所持が減る');
  let shot = false;
  for (let i = 0; i < 160; i++) {
    await pg.waitForTimeout(500);
    const st = await pg.evaluate(() => { const H = KBAPP.S.hunt; document.querySelectorAll('.hunt-conq [data-hq="go"],.hunt-conq [data-hq="random"]').forEach(b => b.click()); return { auto: H.auto, a: H.autoRegs.length, r: H.regs.length, sc: H.score, sel: H.sel.length, over: H.over }; });
    if (!shot && st.sel === 2) { shot = true; await pg.screenshot({ path: path.join(__dirname, 'out', 'aim_hunt.png') }); }
    if (!st.auto || st.over) { console.log('state', JSON.stringify(st)); break; }
  }
  const H = await pg.evaluate(() => { const H = KBAPP.S.hunt; return { auto: H.auto, a: H.autoRegs.length, r: H.regs.length, sc: H.score, left: H.end - Date.now() }; });
  ok(H.a === 20 && !H.auto, '20匹を自動で捕獲して止まる（' + H.a + '匹、残り' + Math.round(H.left / 1000) + '秒）');
  ok(H.sc === 0 && H.r === 0, '自動の間は得点・捕獲数に入らない（得点' + H.sc + '）');
  await pg.evaluate(() => { KBAPP.S.hunt.end = Date.now() + 200; }); await pg.waitForTimeout(2600);
  await pg.screenshot({ path: path.join(__dirname, 'out', 'aim_result.png'), fullPage: true });
  ok(await pg.evaluate(() => /自動照準で捕獲：20式/.test(document.body.innerText)), '結果に自動で捕獲した数が出る');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
