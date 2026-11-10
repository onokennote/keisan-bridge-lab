// 待ったの巻き戻し演出のスクリーンショット（ひと回りしたあと、または上がられたあとに戻す）：node undo_fx.js → out/undo_fx1〜4.png
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { window.KB_TEST = 1; });
  await pg.goto('file://' + path.join(__dirname, 'page.html')); await pg.waitForTimeout(500);
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'instant'; });
  await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(400);
  let shot = false;
  for (let i = 0; i < 6000 && !shot; i++) {
    const st = await pg.evaluate(() => {
      const S = KBAPP.S; const m = document.querySelector('#modal'); if (m) { const x = m.querySelector('[data-act="close"],[data-act="next-game"]'); if (x) x.click(); else m.remove(); return 'modal'; }
      document.querySelectorAll('.whistle-ov').forEach(e => e.remove());
      const g = S.game; if (!g) return 'nogame';
      if (S.winShow) { const me = g.players.findIndex(p => p.human); return g.winner !== me && document.querySelector('.win-strip [data-act="undo"]') ? 'target' : (KBAPP.act('win-ok'), 'skip'); }
      if (g.over) return 'over';
      const p = g.current(); if (!g.players[p].human) return 'ai';
      if (S.undoSnap && S.undoSnap.gameNo === S.gameNo && g.log.length - JSON.parse(S.undoSnap.g).log.length >= 4 && !S.thinking && document.querySelector('[data-act="undo"]')) return 'target';
      const ms = KB.findMoves(g.counts(p), g.field.v, 'all', 3);
      if (!ms.length) { KBAPP.act('draw'); return 'draw'; }
      const mv = ms[ms.length - 1], used = new Set(); S.sel = [];
      for (const v of mv.vals) { const c = g.hands[p].find(c => c.v === v && !used.has(c.id)); used.add(c.id); S.sel.push(c.id); }
      KBAPP.act('play'); return 'play';
    });
    if (st === 'target') {
      await pg.waitForTimeout(800);
      console.log('戻す手数', await pg.evaluate(() => { const S = KBAPP.S; return S.game.log.length - JSON.parse(S.undoSnap.g).log.length; }));
      await pg.screenshot({ path: path.join(__dirname, 'out', 'undo_fx0.png') });
      await pg.evaluate(() => KBAPP.act('undo')); await pg.waitForTimeout(200); await pg.evaluate(() => KBAPP.act('undo-go'));
      for (const [k, ms] of [[1, 450], [2, 450], [3, 450], [4, 1400]]) { await pg.waitForTimeout(ms); await pg.screenshot({ path: path.join(__dirname, 'out', `undo_fx${k}.png`) }); }
      shot = true;
    }
    await pg.waitForTimeout(st === 'ai' ? 60 : 30);
  }
  console.log(shot ? '撮影した' : '場面が来なかった', errs);
  await b.close();
})();
