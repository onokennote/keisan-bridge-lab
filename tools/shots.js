// 紹介用スクリーンショット（スマホ幅）：node tools/shots.js → shots/*.png（先に ./build.sh と ./deploy.sh）
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const useFonts = require('./fonts');
const root = path.join(__dirname, '..'), out = path.join(root, 'shots'); fs.mkdirSync(out, { recursive: true });
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(fs.readFileSync(path.join(root, 'dist/index.html'))); }).listen(8125);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext(Object.assign({}, devices['iPhone 13'], { deviceScaleFactor: 2 }));
  const pg = await ctx.newPage(); await useFonts(pg);
  const shot = async (n, el) => { await pg.waitForTimeout(400); if (el) await (await pg.$(el)).screenshot({ path: path.join(out, n + '.png') }); else await pg.screenshot({ path: path.join(out, n + '.png') }); console.log('shots/' + n + '.png'); };
  await pg.goto('http://localhost:8125/'); await pg.waitForTimeout(800);
  await pg.fill('#new-name', 'おのけん'); await pg.click('[data-act="create-profile"]'); await pg.waitForTimeout(500);
  await pg.evaluate(() => document.querySelectorAll('#modal [data-act="close"]').forEach(b => b.click()));
  // 遊んだあとのホームにするため、先に練習を1セット打つ（AIの読みは使わず、合計がいちばん減る出し方で）
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'fast'; }); await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(400);
  let gameShot = false;
  for (let step = 0; step < 3000; step++) {
    const st = await pg.evaluate(() => {
      const S = KBAPP.S; const wk = document.querySelector('[data-act="win-ok"]'); if (wk) { wk.click(); return 'modal'; }
      const m = document.querySelector('#modal'); if (m) { const b = m.querySelector('[data-act="next-game"],#tb-ok,[data-act="close"]'); if (b) { b.click(); return 'modal'; } return 'noop:' + m.innerText.slice(0, 120); }
      if (S.view === 'set-end') return 'setend';
      const dy = document.querySelector('[data-act="draw-yes"]'); if (dy) { dy.click(); return 'drawyes'; }
      const g = S.game; if (!g || g.over) return 'wait';
      const p = g.current(); if (!g.players[p].human) return 'ai';
      const ms = KB.findMoves(g.counts(p), g.field.v, 'all', 3);
      if (!ms.length) { document.querySelector('[data-act="draw"]').click(); return 'draw'; }
      ms.sort((a, c) => c.vals.reduce((x, y) => x + y, 0) - a.vals.reduce((x, y) => x + y, 0));
      const hand = g.hands[p], used = new Set(); S.sel = [];
      for (const v of ms[0].vals) { const c = hand.find(c => c.v === v && !used.has(c.id)); used.add(c.id); S.sel.push(c.id); }
      return 'select';
    });
    if (st === 'select') { await pg.evaluate(() => { const S = KBAPP.S, ids = S.sel.slice(); S.sel = []; for (const id of ids) document.querySelector(`[data-card="${id}"]`).click(); }); const r = await pg.evaluate(() => KBAPP.S.game.round || 0); if (!gameShot && r >= 2) { gameShot = true; await pg.waitForTimeout(1500); await pg.evaluate(() => scrollTo(0, 0)); await shot('2_game'); } const en = await pg.evaluate(() => { const b = document.querySelector('[data-act="play"]'); return b && !b.disabled; }); if (en) await pg.click('[data-act="play"]'); else await pg.evaluate(() => { KBAPP.S.sel = []; KBAPP.act('draw'); }); }
    if (st === 'setend' || st.startsWith('noop')) { console.log('stop', st, step); break; }
    await pg.waitForTimeout(st === 'ai' || st === 'wait' ? 60 : 20);
  }
  // セットの総評（マサ）
  await pg.evaluate(() => { const b = document.querySelector('[data-review="masa"]'); if (b) b.click(); });
  await pg.evaluate(() => { const r = document.querySelector('.commentary.review'); if (r) r.scrollIntoView({ block: 'center' }); });
  await shot('3_review');
  // ホーム
  await pg.evaluate(() => KBAPP.go('home')); await pg.waitForTimeout(500); await pg.evaluate(() => scrollTo(0, 0)); await shot('1_home');
  // 式ハンター
  await pg.click('[data-act="hunt-start"]'); await pg.click('[data-act="hunt-go"]'); await pg.waitForTimeout(2200);
  for (let i = 0; i < 6; i++) {
    const r = await pg.evaluate(() => { const H = KBAPP.S.hunt; if (H.blocked || !H.field) return 'wait'; const hand = H.hand, t = H.field.v;
      for (let a = 0; a < hand.length; a++) for (let b2 = a + 1; b2 < hand.length; b2++) for (let c = b2 + 1; c < hand.length; c++) { const m = KB.evalSelection([hand[a].v, hand[b2].v, hand[c].v], t); if (m && m.vals.length === 3) { H.sel = []; [hand[a], hand[b2], hand[c]].forEach(x => document.querySelector(`[data-act="hunt-card"][data-id="${x.id}"]`).click()); return 'sel'; } }
      return 'pass'; });
    if (r === 'sel' && i >= 3) { await shot('4_hunt'); break; }
    if (r === 'sel') await pg.click('[data-act="hunt-play"]').catch(() => { }); else if (r === 'pass') await pg.click('[data-act="hunt-pass"]').catch(() => { });
    await pg.waitForTimeout(1000);
  }
  await pg.evaluate(() => { KBAPP.S.hunt.end = Date.now() + 200; }); await pg.waitForTimeout(3000);
  // バッジ（成長記録）
  // 紹介用に、しばらく遊んだ状態のバッジを入れる（デモ用の値）
  await pg.evaluate(() => { document.querySelectorAll('#modal,.ach-toast').forEach(m => m.remove()); for (const [k, n] of [['games', 60], ['practice_set', 6], ['win', 14], ['set_win', 2], ['three', 55], ['div_paren', 3], ['bestpair', 1], ['quick5', 12], ['quick3', 6], ['snap', 1], ['outs3', 2], ['outs4', 1], ['zukan', 60], ['zukan_cat', 3], ['streak5', 2], ['perfect', 1], ['sutemi', 1]]) KBAPP.testAch(k, n); document.querySelectorAll('#modal,.ach-toast,.toast').forEach(m => m.remove()); KBAPP.go('growth'); }); await pg.waitForTimeout(800);
  await pg.evaluate(() => { document.querySelectorAll('.ach-toast,.toast').forEach(m => m.remove()); const e = [...document.querySelectorAll('*')].find(x => x.children.length === 0 && /^勝利$/.test(x.textContent.trim())); if (e) { e.scrollIntoView({ block: 'start' }); scrollBy(0, -20); } });
  await shot('5_badges');
  await b.close(); srv.close();
})();
