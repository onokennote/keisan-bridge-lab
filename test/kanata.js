// ★6カナタの通しテスト（大会5人・決勝にカナタ・第2巡で必ず発動）：node kanata.js
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><script>window.KB_TEST=1</script></head><body>' + fs.readFileSync(require('path').join(__dirname, '../dist/artifact.html'), 'utf8') + '</body></html>';
  fs.writeFileSync(require('path').join(__dirname, 'page.html'), html);
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto('file://' + require('path').join(__dirname, 'page.html'));
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: require('path').join(__dirname, 'out', 'home.png'), fullPage: true });
  const mode = 'tour';
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'fast'; window.KB_KANATA = 1; window.KB_KANATA_AT = 2; });
  if (mode === 'practice') { await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); }
  else { await pg.click('[data-go="setup-tour"]'); await pg.fill('#t-n', '5'); await pg.fill('#t-sets', '1'); await pg.fill('#t-games', '2'); await pg.selectOption('#t-fin', '4').catch(() => {}); await pg.click('[data-act="start-tour"]'); await pg.waitForTimeout(100); await pg.evaluate(() => { if (KBAPP.S.view === 'opening') KBAPP.act('opening-start'); }); }
  await pg.waitForTimeout(400);
  let shots = 0;
  for (let step = 0; step < 4000; step++) {
    const st = await pg.evaluate(() => {
      const S = KBAPP.S; const wk = document.querySelector('[data-act="win-ok"]'); if (wk) { wk.click(); return 'modal'; } const m = document.querySelector('#modal');
      if (m) { const b = m.querySelector('[data-act="win-ok"],[data-act="next-game"],[data-act="start-final"],#tb-ok'); if (b) { b.click(); return 'modal'; } return 'modal-noop:' + m.innerText.slice(0, 80); }
      if (S.view === 'opening') { KBAPP.act('opening-start'); return 'o'; }
      if (S.view === 'entrance') { if (!window.__ent) { window.__ent = 1; return 'entshot'; } document.querySelector('[data-act="start-final"]').click(); return 'entrance'; }
      if (document.querySelector('.toushi-fx') && !window.__tx) { window.__tx = 1; return 'txshot'; }
      if (S.view === 'set-end') { const b = document.querySelector('[data-act="next-set"],[data-act="to-final"],[data-act="final-result"]'); if (b) { b.click(); return 'setend'; } return 'done-setend'; }
      if (S.view === 'result') return 'result';
      const g = S.game; if (!g || g.over) return 'wait';
      const p = g.current(); if (!g.players[p].human) return 'ai';
      const ms = KB.findMoves(g.counts(p), g.field.v, 'all', 3);
      if (!ms.length) { document.querySelector('[data-act="draw"]').click(); return 'draw'; }
      if (!S.hint) { KBAPP.act('hint'); return 'hint'; }
      if (S.hint.busy) return 'busy';
      const best = S.hint.ev[0].m;
      window.__stats = window.__stats || { n: 0, draw: 0 }; window.__stats.n++;
      if (!best) { window.__stats.draw++; S.hint = null; KBAPP.act('draw'); return 'draw'; }
      const hand = g.hands[p]; const used = new Set(); S.sel = [];
      for (const v of best.vals) { const c = hand.find(c => c.v === v && !used.has(c.id)); used.add(c.id); S.sel.push(c.id); }
      return 'select';
    });
    if (st === 'entshot') { await pg.waitForTimeout(3500); await pg.screenshot({ path: require('path').join(__dirname, 'out', 'kanata_entrance.png'), fullPage: true }); console.log('entrance', await pg.evaluate(() => KBAPP.S.T.finalists.map(id => KBAPP.S.T.players.find(p => p.id === id).ch.name).join(','))); }
    if (st === 'txshot') { await pg.waitForTimeout(1200); await pg.screenshot({ path: require('path').join(__dirname, 'out', 'kanata_fx.png') }); console.log('toushi fx shown'); }
    if (st === 'select') {
      // re-render with selection then click play
      await pg.evaluate(() => { const S = KBAPP.S; const ids = S.sel.slice(); S.sel = []; for (const id of ids) document.querySelector(`[data-card="${id}"]`).click(); });
      if (shots < 1) { await pg.screenshot({ path: require('path').join(__dirname, 'out', 'game.png'), fullPage: true }); shots++; }
      const ok = await pg.evaluate(() => !document.querySelector('[data-act="play"]').disabled); if (!ok) { await pg.evaluate(() => { KBAPP.S.sel = []; KBAPP.S.hint = null; }); continue; } await pg.click('[data-act="play"]');
    }
    if (st === 'modal' && shots === 1) { }
    if (st === 'result' || st === 'done-setend') { console.log('finished', st, 'step', step); break; }
    if (st.startsWith('modal-noop')) { console.log(st); break; }
    await pg.waitForTimeout(st === 'ai' || st === 'wait' || st === 'busy' ? 60 : 20);
    if (step % 400 === 0) console.log(step, st, await pg.evaluate(() => KBAPP.S.T && (KBAPP.S.T.phase + ' set' + KBAPP.S.T.set + ' g' + KBAPP.S.T.game)));
  }
  await pg.screenshot({ path: require('path').join(__dirname, 'out', 'end.png'), fullPage: true });
  console.log('kanataClear', await pg.evaluate(() => KBAPP.S.T && KBAPP.S.T.kanataClear), 'finalOrder', await pg.evaluate(() => KBAPP.S.T && JSON.stringify(KBAPP.S.T.finalOrder)));
  console.log('errors', errs, await pg.evaluate(() => JSON.stringify(window.__stats)));
  await b.close();
})();
