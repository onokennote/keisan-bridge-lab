// 見のがした式：上がれる場面で引くと記録され、成長記録で見られて、×で消せる。使い方：cd test && node missed.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>window.KB_TEST=1</script></head><body>' + fs.readFileSync(path.join(__dirname, '../dist/artifact.html'), 'utf8') + '</body></html>';
  fs.writeFileSync(path.join(__dirname, 'page.html'), html);
  const b = await chromium.launch(), errs = [];
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(__dirname, 'page.html')); await pg.waitForTimeout(500);
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'instant'; });
  await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(400);
  let got = 0, outSeen = 0;
  let sets = 0;
  for (let step = 0; step < 9000 && !got; step++) {
    const st = await pg.evaluate(() => {
      const S = KBAPP.S; const wk = document.querySelector('[data-act="win-ok"]'); if (wk) { wk.click(); return 'm'; }
      const m = document.querySelector('#modal'); if (m) { const b = m.querySelector('[data-act="next-game"],#tb-ok,[data-act="close"]'); if (b) { b.click(); return 'm'; } return 'm?'; }
      if (S.view === 'set-end') return 'end';
      const g = S.game; if (!g || g.over) return 'wait'; const p = g.current(); if (!g.players[p].human) return 'ai';
      const c = g.counts(p), n = Object.values(c).reduce((a, x) => a + x, 0), ms = KB.findMoves(c, g.field.v, 'all', 3);
      const d = document.querySelector('[data-act="draw"]');
      if (ms.some(x => x.vals.length === n)) { window.__out = (window.__out || 0) + 1; if (d && !d.disabled) { d.click(); return 'draw'; } return 'w'; } // 上がれるのに、わざと引く
      const pick = ms.filter(x => x.vals.length < n).sort((a, b) => b.vals.length - a.vals.length)[0];
      if (!pick) { if (d && !d.disabled) d.click(); return 'draw'; }
      const hand = g.hands[p], used = new Set(); window.__sel = pick.vals.map(v => { const c = hand.find(c => c.v === v && !used.has(c.id)); used.add(c.id); return c.id; }); return 'select';
    });
    if (st === 'end') { if (++sets >= 4) break; await pg.evaluate(() => { const b = document.querySelector('[data-act="practice-again"]'); if (b) b.click(); }); await pg.waitForTimeout(400); continue; }
    if (st === 'select') { await pg.evaluate(() => { for (const id of window.__sel) document.querySelector(`[data-card="${id}"]`).click(); }); await pg.evaluate(() => { const b = document.querySelector('[data-act="play"]'); if (b && !b.disabled) b.click(); }); }
    got = await pg.evaluate(() => (JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /missed$/.test(k)) || 'x') || '[]')).length);
    await pg.waitForTimeout(st === 'ai' || st === 'wait' ? 50 : 20);
  }
  outSeen = await pg.evaluate(() => window.__out || 0);
  const L = await pg.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /missed$/.test(k))) || '[]'));
  ok(L.length >= 1 && L[0].exprs.length && L[0].mine === 'あえて引く', `上がれる場面で引くと「見のがした式」に入る（上がれた場面 ${outSeen}回・記録 ${L.length}件）：場${L[0] && L[0].t} 手札${L[0] && L[0].hand} → ${L[0] && L[0].exprs}`);
  // 成長記録で見る（ためしにもう2件足して並びを見せる）
  await pg.evaluate(() => { const k = Object.keys(localStorage).find(k => /missed$/.test(k)), L = JSON.parse(localStorage.getItem(k)); L.push({ id: '7:2,5', t: 7, hand: [2, 5], exprs: ['2 + 5'], mine: '5', at: Date.now() - 86400000, n: 2 }, { id: '12:3,4', t: 12, hand: [3, 4], exprs: ['3 × 4'], mine: 'あえて引く', at: Date.now() - 2 * 86400000, n: 1 }); localStorage.setItem(k, JSON.stringify(L)); document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.T = null; KBAPP.act && 0; });
  await pg.evaluate(() => KBAPP.go('growth')); await pg.waitForTimeout(500);
  const n0 = await pg.evaluate(() => document.querySelectorAll('#missed .ms-row').length);
  ok(n0 >= 3, '成長記録に「👀 見のがした式」の一覧 ' + n0 + '件');
  await (await pg.$('#missed')).screenshot({ path: path.join(__dirname, 'out', 'missed.png') });
  await pg.click('#missed [data-msx]'); await pg.waitForTimeout(200);
  const n1 = await pg.evaluate(() => document.querySelectorAll('#missed .ms-row').length), s1 = await pg.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /missed$/.test(k)))).length);
  ok(n1 === n0 - 1 && s1 === n0 - 1, '× で消せる（記録からも消える）');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
