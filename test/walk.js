// 公開版（dist/index.html）をスマホ幅で通しチェック：./build.sh と ./deploy.sh のあとに node walk.js
// 初回の名前入力 → 1セット練習 → 総評 → 式ハンター → アウツチャレンジ → バッジアタック → Xシェア
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const useFonts = require('../tools/fonts');
const root = path.join(__dirname, '..'), out = path.join(__dirname, 'out');
const files = { '/': ['dist/index.html', 'text/html; charset=utf-8'], '/og.png': ['dist/og.png', 'image/png'] };
const srv = http.createServer((q, r) => { const f = files[q.url.split(/[?#]/)[0]] || files['/']; r.writeHead(200, { 'content-type': f[1] }); r.end(fs.readFileSync(path.join(root, f[0]))); }).listen(8124);
const issues = [], log = m => console.log(m);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext(Object.assign({}, devices['iPhone 13'], { deviceScaleFactor: 2 }));
  const pg = await ctx.newPage(); const errs = [];
  await useFonts(pg);
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  pg.on('popup', async p => { log('popup: ' + p.url().slice(0, 160)); });
  const shot = async (n, full) => { await pg.waitForTimeout(250); await pg.screenshot({ path: path.join(out, 'walk_' + n + '.png'), fullPage: !!full }); };
  const wide = async n => { const w = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, bad: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map(e => e.tagName + '.' + (e.className && e.className.baseVal == null ? e.className : '') ) })); if (w.sw > w.iw + 1) issues.push(`${n}: 横にはみ出し（${w.sw}px > ${w.iw}px）${w.bad.join(' ')}`); };
  await pg.goto('http://localhost:8124/'); await pg.waitForTimeout(800);
  // 1. 初回の名前入力
  const askOk = await pg.$('#new-name'); if (!askOk) issues.push('初回に名前入力が出ない');
  await shot('01_name'); await wide('名前入力');
  await pg.fill('#new-name', 'おのけん'); await pg.click('[data-act="create-profile"]'); await pg.waitForTimeout(500);
  await pg.evaluate(() => document.querySelectorAll('#modal [data-act="close"]').forEach(b => b.click()));
  await shot('02_home', true); await wide('ホーム');
  // 2. 1セット練習（AIの最善手どおりに打つ）
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'fast'; });
  await pg.click('[data-go="setup-practice"]'); await shot('03_setup'); await wide('練習の設定');
  await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(400);
  let gameShot = false, reviewShot = false;
  for (let step = 0; step < 3000; step++) {
    const st = await pg.evaluate(() => {
      const S = KBAPP.S; const wk = document.querySelector('[data-act="win-ok"]'); if (wk) { wk.click(); return 'modal'; }
      const m = document.querySelector('#modal');
      if (m) { if (m.querySelector('[data-review="masa"]') && !window.__rv) { window.__rv = 1; m.querySelector('[data-review="masa"]').click(); return 'review'; } const b = m.querySelector('[data-act="next-game"],#tb-ok,[data-act="close"]'); if (b) { b.click(); return 'modal'; } return 'modal-noop'; }
      if (S.view === 'set-end') return 'setend';
      const g = S.game; if (!g || g.over) return 'wait';
      const p = g.current(); if (!g.players[p].human) return 'ai';
      const ms = KB.findMoves(g.counts(p), g.field.v, 'all', 3);
      if (!ms.length) { document.querySelector('[data-act="draw"]').click(); return 'draw'; }
      if (!S.hint) { KBAPP.act('hint'); return 'hint'; }
      if (S.hint.busy) return 'busy';
      const best = S.hint.ev[0].m; if (!best) { S.hint = null; KBAPP.act('draw'); return 'draw'; }
      const hand = g.hands[p], used = new Set(), ids = [];
      for (const v of best.vals) { const c = hand.find(c => c.v === v && !used.has(c.id)); used.add(c.id); ids.push(c.id); }
      S.hint = null; S.sel = []; ids.forEach(id => document.querySelector(`[data-card="${id}"]`).click()); return 'select';
    });
    if (st === 'select') { if (!gameShot) { gameShot = true; await shot('04_game'); await wide('対局中'); } await pg.click('[data-act="play"]').catch(() => { }); }
    if (st === 'review' && !reviewShot) { reviewShot = true; await shot('05_review_game'); await wide('ゲーム総評'); }
    if (st === 'setend') break;
    if (st === 'modal-noop') { issues.push('閉じられないダイアログ'); break; }
    await pg.waitForTimeout(st === 'ai' || st === 'wait' || st === 'busy' ? 50 : 15);
  }
  await pg.evaluate(() => { const b = document.querySelector('[data-review="masa"]'); if (b) b.click(); });
  await shot('06_setend', true); await wide('セット終了・総評');
  // シェア（Xの投稿画面へのリンクと画像）：成長記録の画面から
  await pg.evaluate(() => KBAPP.go('growth')); await pg.waitForTimeout(400);
  const sh = await pg.$('[data-act="share-open"]');
  if (sh) {
    await sh.click(); await pg.waitForSelector('[data-act="share-save"]:not([disabled])', { timeout: 15000 }).catch(() => issues.push('シェア画像ができない'));
    await shot('07_share'); await wide('シェア');
    const x = await pg.evaluate(() => { const a = document.querySelector('.x-btn'); return a && a.href; });
    const u = x && new URL(x); log('X intent url= ' + (u && u.searchParams.get('url')) + ' text=' + (u && u.searchParams.get('text').slice(0, 60)));
    if (!u || u.searchParams.get('url') !== 'https://keisan-bridge.lolipop-now.app/') issues.push('シェアのURLが公開版になっていない: ' + (u && u.searchParams.get('url')));
    const dl = pg.waitForEvent('download', { timeout: 5000 }).catch(() => null); await pg.click('[data-act="share-save"]'); const d = await dl; log('share download: ' + (d ? d.suggestedFilename() : 'なし（長押し保存の案内）'));
    if (d) await d.saveAs(path.join(out, 'walk_share_card.png'));
    await pg.evaluate(() => document.querySelectorAll('#modal [data-act="close"]').forEach(b => b.click()));
  } else issues.push('成長記録にシェアボタンがない');
  await pg.screenshot({ path: path.join(out, 'walk_06b_growth_top.png') });
  // 3. 式ハンター（時間を短くして最後まで）
  await pg.evaluate(() => KBAPP.go('home')); await pg.waitForTimeout(300);
  await pg.click('[data-act="hunt-start"]'); await shot('08_hunt_ready'); await wide('式ハンター開始前');
  await pg.click('[data-act="hunt-go"]'); await pg.waitForTimeout(2200);
  for (let i = 0; i < 12; i++) {
    const r = await pg.evaluate(() => { const H = KBAPP.S.hunt; if (!H || H.over) return 'over'; if (H.blocked || !H.field) return 'wait'; const hand = H.hand, t = H.field.v;
      for (let a = 0; a < hand.length; a++) for (let b2 = a + 1; b2 < hand.length; b2++) for (let c = b2 + 1; c < hand.length; c++) { const m = KB.evalSelection([hand[a].v, hand[b2].v, hand[c].v], t); if (m && m.vals.length === 3) { H.sel = []; [hand[a], hand[b2], hand[c]].forEach(x => document.querySelector(`[data-act="hunt-card"][data-id="${x.id}"]`).click()); return 'sel'; } }
      return 'pass'; });
    if (r === 'over') break; if (r === 'sel') { if (i === 2) await shot('09_hunt'); await pg.click('[data-act="hunt-play"]').catch(() => { }); } else if (r === 'pass') await pg.click('[data-act="hunt-pass"]').catch(() => { });
    await pg.waitForTimeout(900);
  }
  await wide('式ハンター');
  await pg.evaluate(() => { KBAPP.S.hunt.end = Date.now() + 300; }); await pg.waitForTimeout(2500);
  await pg.evaluate(() => document.querySelectorAll('.hunt-ov,.overlay').forEach(e => e.click && e.click()));
  await pg.waitForTimeout(1500); await shot('10_hunt_result', true); await wide('式ハンター結果');
  log('hunt view: ' + await pg.evaluate(() => KBAPP.S.view));
  // 4. アウツチャレンジ（1問目を正解、2問目は最初の手）
  await pg.evaluate(() => KBAPP.go('home')); await pg.waitForTimeout(300);
  await pg.click('[data-act="drill"]'); await pg.waitForTimeout(300); await shot('11_outs'); await wide('アウツチャレンジ');
  for (let q = 0; q < 2; q++) {
    await pg.evaluate(() => { const D = KBAPP.S.drill, p = D.p, best = p.opts[0], want = (best.vals || (best.m && best.m.vals) || []).slice(), used = new Set();
      for (const v of want) { const i = p.handCards.findIndex((c, k) => c.v === v && !used.has(k)); if (i >= 0) { used.add(i); document.querySelector(`[data-dqc="${i}"]`).click(); } } });
    const en = await pg.evaluate(() => !document.querySelector('[data-act="drill-submit"]').disabled);
    if (!en) { issues.push('アウツチャレンジ：最善の出し方を選べなかった（opts の形を確認）'); break; }
    await pg.click('[data-act="drill-submit"]'); await pg.waitForTimeout(300); if (q === 0) await shot('12_outs_answer', true);
    await pg.click('[data-act="drill-next"]'); await pg.waitForTimeout(300);
  }
  await wide('アウツチャレンジ解答');
  // 5. バッジアタック（始めて1ゲームほど打ったら時間切れにする）
  await pg.evaluate(() => KBAPP.go('home')); await pg.waitForTimeout(300);
  await pg.click('[data-act="attack-start"]'); await pg.waitForTimeout(800); await shot('13_attack_intro'); await wide('バッジアタック開始');
  for (let i = 0; i < 40; i++) { const v = await pg.evaluate(() => { const b = document.querySelector('[data-x="go"]'); if (b && KBAPP.S.view !== 'game') { b.click(); return 'click'; } return KBAPP.S.view; }); if (v === 'game') break; await pg.waitForTimeout(300); }
  await pg.waitForTimeout(1500); await shot('14_attack_game'); await wide('バッジアタック対局');
  await pg.evaluate(() => { if (KBAPP.S.attack) KBAPP.S.attack.end = Date.now() + 200; }); await pg.waitForTimeout(2500);
  await pg.evaluate(() => document.querySelectorAll('#modal [data-act="close"],[data-act="win-ok"]').forEach(b => b.click())); await pg.waitForTimeout(800);
  await shot('15_attack_result', true); await wide('バッジアタック結果');
  log('attack view: ' + await pg.evaluate(() => KBAPP.S.view));
  await pg.evaluate(() => KBAPP.go('growth')); await pg.waitForTimeout(400); await shot('16_growth', true); await wide('成長記録');
  await pg.evaluate(() => KBAPP.go('home')); await pg.waitForTimeout(400); await shot('17_home_after', true);
  log('ISSUES:\n' + (issues.length ? issues.join('\n') : 'なし'));
  log('errors: ' + JSON.stringify(errs));
  await b.close(); srv.close();
})();
