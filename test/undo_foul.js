// お手つき＋待ったで札の数がずれないか：札の総数・重複・手札の枚数（7＋引いた−出した）を確かめる
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { window.KB_TEST = 1; });
  await pg.goto('file://' + require('path').join(__dirname, 'page.html') + ''); await pg.waitForTimeout(500);
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'instant'; KBAPP.S.settings.judge = 'after'; });
  await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(500);
  const check = () => pg.evaluate(() => {
    const g = KBAPP.S.game, all = [];
    g.hands.forEach(h => h.forEach(c => all.push(c.id))); (g.deck || []).forEach(c => all.push(c.id)); (g.discard || []).forEach(c => all.push(c.id));
    if (g.field && g.field.id != null && !all.includes(g.field.id)) all.push(g.field.id);
    const dup = all.length - new Set(all).size;
    const bad = [];
    g.players.forEach((p, i) => { let n = 7; g.log.forEach(e => { if (e.p !== i) return; if (e.type === 'play') n -= e.vals.length; if (e.type === 'draw') n += e.foul ? e.n : (e.missedUnknown && !e.foul && e.left == null ? 0 : 1); }); if (n !== g.hands[i].length) bad.push(`${i}:${n}vs${g.hands[i].length}`); });
    return { total: all.length, dup, bad };
  });
  let undos = 0, fouls = 0, probs = [], noBtnAfterFoul = 0, retry = false;
  for (let i = 0; i < 6000 && undos < 25; i++) {
    const st = await pg.evaluate(() => {
      const S = KBAPP.S; const m = document.querySelector('#modal'); if (m) { const x = m.querySelector('[data-act="close"],[data-act="next-game"]'); if (x) x.click(); else m.remove(); return 'modal'; }
      document.querySelectorAll('.whistle-ov').forEach(e => e.remove());
      if (S.view !== 'game') return 'view';
      const g = S.game; if (S.winShow) return S.undoSnap && Math.random() < 0.5 ? 'undo' : (KBAPP.act('win-ok'), 'win'); if (g.over) return 'over';
      const p = g.current(); if (!g.players[p].human) return 'ai';
      if (document.querySelector('[data-act="draw"]').disabled) return 'wait';
      if (S.undoSnap && Math.random() < 0.35) return 'undo';
      const ms = KB.findMoves(g.counts(p), g.field.v, 'all', 3), h = g.hands[p];
      if (Math.random() < 0.3 && h.length >= 2) { // お手つきをわざと出す：場にならない2枚
        for (let a = 0; a < h.length; a++) for (let c = a + 1; c < h.length; c++) { const vals = [h[a].v, h[c].v]; if (!KB.evalSelection(vals, g.field.v)) { S.sel = [h[a].id, h[c].id]; KBAPP.act('play'); return 'foul'; } }
      }
      if (!ms.length) { KBAPP.act('draw'); return 'draw'; }
      const mv = ms[(Math.random() * ms.length) | 0], used = new Set(); S.sel = [];
      for (const v of mv.vals) { const c = h.find(c => c.v === v && !used.has(c.id)); used.add(c.id); S.sel.push(c.id); }
      KBAPP.act('play'); return 'play';
    });
    if (st === 'foul') { fouls++; await pg.waitForTimeout(60); if (!retry && !(await pg.evaluate(() => !!KBAPP.S.undoSnap))) noBtnAfterFoul++; } // やり直した手のお手つきは戻せないのが正しい
    if (['foul', 'play', 'draw'].includes(st)) retry = false;
    if (st === 'undo') {
      const before = await check();
      await pg.evaluate(() => KBAPP.act('undo')); await pg.waitForTimeout(50); await pg.evaluate(() => KBAPP.act('undo-go')); await pg.waitForTimeout(2400);
      const after = await check(); undos++; retry = true;
      if (after.dup || after.bad.length || after.total !== before.total) probs.push({ before, after });
    }
    if (st === 'view') { const v = await pg.evaluate(() => KBAPP.S.view); if (v === 'set-end') { await pg.evaluate(() => { KBAPP.S.T = null; KBAPP.go('home'); }); await pg.waitForTimeout(200); await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(400); } }
    await pg.waitForTimeout(20);
  }
  console.log((probs.length || noBtnAfterFoul ? 'NG  ' : 'OK  ') + '待った', undos, '回・お手つき', fouls, '回・ずれ', probs.length, '・お手つきのあと待ったが出ない', noBtnAfterFoul, JSON.stringify(probs.slice(0, 3)), errs.slice(0, 3));
  await b.close();
})();
