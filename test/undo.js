// 待った（巻き戻し）のテスト：練習で、①自分の手のあとに戻す ②上がられたあと（結果を見るの前）に戻す
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { window.KB_TEST = 1; });
  await pg.goto('file://' + path.join(__dirname, 'page.html')); await pg.waitForTimeout(500);
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'instant'; });
  await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(400);
  const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
  // 自分の番で、出せる手があれば最初の手を出す（なければ引く）
  const step = () => pg.evaluate(() => {
    const S = KBAPP.S; const m = document.querySelector('#modal'); if (m) { const x = m.querySelector('[data-act="close"],[data-act="next-game"]'); if (x) x.click(); else m.remove(); return 'modal'; }
    document.querySelectorAll('.whistle-ov').forEach(e => e.remove());
    const g = S.game; if (!g) return 'nogame'; if (S.winShow) return 'win'; if (g.over) return 'over';
    const p = g.current(); if (!g.players[p].human) return 'ai';
    const ms = KB.findMoves(g.counts(p), g.field.v, 'all', 3);
    if (!ms.length) { KBAPP.act('draw'); return 'draw'; }
    const mv = ms[ms.length - 1], used = new Set(); S.sel = [];
    for (const v of mv.vals) { const c = g.hands[p].find(c => c.v === v && !used.has(c.id)); used.add(c.id); S.sel.push(c.id); }
    KBAPP.act('play'); return 'play';
  });
  // ① 選択肢のある手を1回打ったら、待ったボタンが出る → 戻すと同じ巡の自分の番
  let before = null, st;
  for (let i = 0; i < 3000; i++) {
    st = await step(); if (st === 'play') { before = await pg.evaluate(() => ({ n: KBAPP.S.decisions.length, snap: KBAPP.S.undoSnap && KBAPP.S.undoSnap.round })); if (before.snap) break; }
    if (st === 'win') break; await pg.waitForTimeout(20);
  }
  ok(before && before.snap, '自分の手のあとに巻き戻し先ができる');
  await pg.waitForTimeout(100);
  const hasBtn = await pg.evaluate(() => !!document.querySelector('[data-act="undo"]'));
  ok(hasBtn, '「待った」ボタンが出る');
  await pg.evaluate(() => KBAPP.act('undo')); await pg.waitForTimeout(100);
  const ask = await pg.evaluate(() => (document.querySelector('#modal') || {}).textContent || '');
  ok(/巻き戻す/.test(ask) && /バッジ|対象外/.test(ask), 'マサが確認する：' + ask.slice(0, 60));
  await pg.evaluate(() => KBAPP.act('undo-go')); await pg.waitForTimeout(2600);
  const after = await pg.evaluate(() => { const S = KBAPP.S, g = S.game; return { n: S.decisions.length, round: g.round, human: g.players[g.current()].human, hinted: S.gameHinted, retry: S.undoRetry }; });
  ok(after.n === before.n - 1 && after.round === before.snap && after.human, `自分の番に戻る（判断 ${before.n}→${after.n}、第${after.round}巡）`);
  ok(after.hinted && after.retry, 'このゲームはバッジの対象外・やり直した手は実力に入れない');
  // やり直した手は viewedHint として記録される
  for (let i = 0; i < 400; i++) { st = await step(); if (st === 'play' || st === 'draw' || st === 'win') break; await pg.waitForTimeout(20); }
  const d = await pg.evaluate(() => { const ds = KBAPP.S.decisions; return ds[ds.length - 1]; });
  ok(!d || (d.viewedHint && d.undo), 'やり直した手には印が付く');
  await pg.waitForTimeout(100);
  ok(!(await pg.evaluate(() => !!KBAPP.S.undoSnap || !!document.querySelector('[data-act="undo"]'))), 'やり直した手は、もう戻せない');
  // ② 上がられたあと（結果を見るの前）に戻す：成長記録とセットのPPも元に戻る
  let tried = 0, done = false;
  for (let i = 0; i < 20000 && !done; i++) {
    st = await step();
    if (st === 'win') {
      const w = await pg.evaluate(() => { const S = KBAPP.S, g = S.game; return { me: g.winner === g.players.findIndex(p => p.human), undo: !!document.querySelector('.win-strip [data-act="undo"]'), games: (JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('growth')) || 'x') || '{"games":[]}').games || []).length, pp: JSON.stringify(S.T.setPP) }; });
      if (!w.me && w.undo) {
        tried++;
        await pg.evaluate(() => KBAPP.act('undo')); await pg.waitForTimeout(80); await pg.evaluate(() => KBAPP.act('undo-go')); await pg.waitForTimeout(2600);
        const r = await pg.evaluate(() => { const S = KBAPP.S, g = S.game; return { over: g.over, win: !!S.winShow, human: g.players[g.current()].human, games: (JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('growth')) || 'x') || '{"games":[]}').games || []).length, pp: JSON.stringify(S.T.setPP) }; });
        ok(!r.over && !r.win && r.human, '上がられたあとでも、自分の番まで戻れる');
        ok(r.games === w.games - 1, `そのゲームの記録は取り消される（${w.games}→${r.games}）`);
        ok(r.pp !== w.pp, 'セットのPPも戻る');
        done = true; break;
      }
      await pg.evaluate(() => KBAPP.act('win-ok'));
    }
    if (st === 'nogame' || await pg.evaluate(() => KBAPP.S.view === 'set-end')) break;
    await pg.waitForTimeout(15);
  }
  if (!done) console.log('--  上がられて戻せる場面が来なかった（このセットでは確かめられず）');
  // 巻き戻しの演出（ふつうの速さ）のスクリーンショット
  await pg.evaluate(() => { const m = document.querySelector('#modal'); if (m) m.remove(); KBAPP.S.T = null; KBAPP.go('home'); }); await pg.waitForTimeout(300);
  await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(400);
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'normal'; });
  for (let i = 0; i < 4000; i++) { st = await step(); if (st === 'play' && await pg.evaluate(() => !!KBAPP.S.undoSnap)) break; if (await pg.evaluate(() => KBAPP.S.view !== 'game')) break; await pg.waitForTimeout(30); }
  if (await pg.evaluate(() => !!KBAPP.S.undoSnap)) {
    await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(__dirname, 'out', 'undo_btn.png') });
    await pg.evaluate(() => KBAPP.act('undo')); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(__dirname, 'out', 'undo_ask.png') });
    await pg.evaluate(() => KBAPP.act('undo-go')); await pg.waitForTimeout(600); await pg.screenshot({ path: path.join(__dirname, 'out', 'undo_fx.png') });
    await pg.waitForTimeout(1600); await pg.screenshot({ path: path.join(__dirname, 'out', 'undo_after.png') });
  }
  // ③ 大会でも使える（大会のバッジも対象外になる）
  await pg.evaluate(() => { const m = document.querySelector('#modal'); if (m) m.remove(); KBAPP.S.T = null; KBAPP.S.settings.speed = 'instant'; KBAPP.go('home'); }); await pg.waitForTimeout(300);
  await pg.click('[data-go="setup-tour"]'); await pg.click('[data-act="start-tour"]'); await pg.waitForTimeout(300); await pg.evaluate(() => { if (KBAPP.S.view === 'opening') KBAPP.act('opening-start'); }); await pg.waitForTimeout(400);
  let tb = null;
  for (let i = 0; i < 3000; i++) { st = await step(); if (st === 'play' && await pg.evaluate(() => !!KBAPP.S.undoSnap)) { tb = await pg.evaluate(() => KBAPP.S.decisions.length); break; } if (st === 'win') await pg.evaluate(() => KBAPP.act('win-ok')); await pg.waitForTimeout(20); }
  await pg.waitForTimeout(100);
  ok(tb != null && await pg.evaluate(() => !!document.querySelector('[data-act="undo"]')), '大会でも「待った」ボタンが出る');
  await pg.evaluate(() => KBAPP.act('undo')); await pg.waitForTimeout(100);
  ok(/大会/.test(await pg.evaluate(() => (document.querySelector('#modal') || {}).textContent || '')), '大会では、大会のバッジも対象外になると確認する');
  await pg.evaluate(() => KBAPP.act('undo-go')); await pg.waitForTimeout(2600);
  const ta = await pg.evaluate(() => { const S = KBAPP.S, g = S.game; return { n: S.decisions.length, human: g.players[g.current()].human, th: S.T.tourHinted, q: !!S.qual }; });
  ok(ta.n === tb - 1 && ta.human && ta.th && ta.q, `大会でも一手前に戻れる（判断 ${tb}→${ta.n}）`);
  ok(!errs.length, 'ページのエラーなし ' + errs.slice(0, 2).join(' / '));
  await b.close();
})();
