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
  const mode = process.argv[2] || 'practice';
  const good = process.argv[3] === 'good'; // node rv.js practice good … AIの最善手どおりに打った総評
  await pg.evaluate(g => { KBAPP.S.settings.speed = 'instant'; window.__rand = g ? 0 : 1; }, good);
  if (mode === 'practice') { await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); }
  else { await pg.click('[data-go="setup-tour"]'); await pg.click('[data-act="start-tour"]'); await pg.waitForTimeout(100); await pg.evaluate(() => { if (KBAPP.S.view === 'opening') KBAPP.act('opening-start'); }); }
  await pg.waitForTimeout(400);
  let shots = 0;
  for (let step = 0; step < 4000; step++) {
    const st = await pg.evaluate(() => {
      const S = KBAPP.S; const wk = document.querySelector('[data-act="win-ok"]'); if (wk) { wk.click(); return 'modal'; } const m = document.querySelector('#modal');
      if (m) { if (!window.__rvdone && m.querySelector('[data-review="root"]')) { window.__rvlog = (window.__rvlog || []); for (const w of ['root', 'masa']) { m.querySelector('[data-review="' + w + '"]').click(); window.__rvlog.push('--- game ' + w + ': ' + document.querySelector('#modal .commentary.review .cm-text').innerText); } window.__rvdone = 1; } const b = m.querySelector('[data-act="win-ok"],[data-act="next-game"],[data-act="start-final"],#tb-ok'); if (b) { b.click(); return 'modal'; } return 'modal-noop:' + m.innerText.slice(0, 80); }
      if (S.view === 'opening') { KBAPP.act('opening-start'); return 'o'; }
      if (S.view === 'entrance') { document.querySelector('[data-act="start-final"]').click(); return 'entrance'; }
      if (S.view === 'set-end') { if (!window.__rvset && document.querySelector('[data-review="root"]')) { window.__rvset = 1; for (const w of ['root', 'masa']) { document.querySelector('[data-review="' + w + '"]').click(); window.__rvlog = (window.__rvlog || []).concat(['--- set ' + w + ': ' + document.querySelector('.commentary.review .cm-text').innerText]); } } const b = document.querySelector('[data-act="next-set"],[data-act="to-final"],[data-act="final-result"]'); if (b) { b.click(); return 'setend'; } return 'done-setend'; }
      if (S.view === 'result') return 'result';
      const g = S.game; if (!g || g.over) return 'wait';
      const p = g.current(); if (!g.players[p].human) return 'ai';
      const ms = KB.findMoves(g.counts(p), g.field.v, 'all', 3);
      if (!ms.length) { document.querySelector('[data-act="draw"]').click(); return 'draw'; }
      if (window.__rand) { const pickM = Math.random() < 0.15 ? null : ms[(Math.random() * ms.length) | 0]; if (!pickM) { if (document.querySelector('[data-act="draw"]')) { KBAPP.act('draw'); return 'draw'; } } const best = pickM || ms[0]; const hand = g.hands[p]; const used = new Set(); S.sel = []; for (const v of best.vals) { const c = hand.find(c => c.v === v && !used.has(c.id)); used.add(c.id); S.sel.push(c.id); } return 'select'; }
      if (!S.hint) { KBAPP.act('hint'); return 'hint'; }
      if (S.hint.busy) return 'busy';
      const best = S.hint.ev[0].m;
      window.__stats = window.__stats || { n: 0, draw: 0 }; window.__stats.n++;
      if (!best) { window.__stats.draw++; S.hint = null; KBAPP.act('draw'); return 'draw'; }
      const hand = g.hands[p]; const used = new Set(); S.sel = [];
      for (const v of best.vals) { const c = hand.find(c => c.v === v && !used.has(c.id)); used.add(c.id); S.sel.push(c.id); }
      return 'select';
    });
    if (st === 'select') {
      // re-render with selection then click play
      await pg.evaluate(() => { const S = KBAPP.S; const ids = S.sel.slice(); S.sel = []; for (const id of ids) document.querySelector(`[data-card="${id}"]`).click(); });
      if (shots < 1) { await pg.screenshot({ path: require('path').join(__dirname, 'out', 'game.png'), fullPage: true }); shots++; }
      const ok = await pg.evaluate(() => !document.querySelector('[data-act="play"]').disabled); if (!ok) { await pg.evaluate(() => { KBAPP.S.sel = []; KBAPP.act('draw'); }); continue; } await pg.click('[data-act="play"]');
    }
    if (st === 'modal' && shots === 1) { }
    if (st === 'result' || st === 'done-setend') { console.log('finished', st, 'step', step); break; }
    if (st.startsWith('modal-noop')) { console.log(st); break; }
    await pg.waitForTimeout(st === 'ai' || st === 'wait' || st === 'busy' ? 60 : 20);
    if (step % 400 === 0) console.log(step, st, await pg.evaluate(() => KBAPP.S.T && (KBAPP.S.T.phase + ' set' + KBAPP.S.T.set + ' g' + KBAPP.S.T.game)));
  }
  await pg.screenshot({ path: require('path').join(__dirname, 'out', 'end.png'), fullPage: true });
  console.log((await pg.evaluate(() => window.__rvlog || [])).join('\n')); await pg.screenshot({ path: require('path').join(__dirname, 'out', 'rv_end.png'), fullPage: false }); console.log('errors', errs, await pg.evaluate(() => JSON.stringify(window.__stats)));
  await b.close();
})();
