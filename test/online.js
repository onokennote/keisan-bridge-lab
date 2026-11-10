// オンライン対局（段階1）の通しテスト：server/api.php を PHP の内蔵サーバーで動かし、2つのブラウザ＋AI★2で1ゲーム打つ
// 使い方：cd test && node online.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbonline-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8125'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8098"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8098', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8098/api.php KB_STAGING=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8125);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(800);
  const b = await chromium.launch(), errs = [];
  const open = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://localhost:8125/'); await p.waitForTimeout(700);
    await p.fill('#new-name', name); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => document.querySelectorAll('#modal [data-act="tut-skip"],#modal [data-act="close"]').forEach(b => b.click())); await p.waitForTimeout(300);
    await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; KBAPP.go('home'); }); await p.waitForTimeout(300);
    return p;
  };
  const pa = await open('ケン'), pb = await open('ユイ');
  ok(!!(await pa.$('.on-card')), 'テスト版のホームに「オンライン大会」のカード');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'on_home.png') });
  // A：卓をつくる（テストなので制限時間3秒）
  await pa.evaluate(() => { KBAPP.S.onCfg = { n: 3, games: 1, limit: 3, judge: 'after3' }; KBAPP.act('on-create'); }); await pa.waitForTimeout(1200);
  const code = await pa.evaluate(() => KBAPP.ON.v && KBAPP.ON.v.id);
  ok(/^[A-Z2-9]{6}$/.test(code || ''), '卓ができてコードが出る：' + code);
  // B：コードで入る
  await pb.evaluate(() => { const d = document.querySelector('.on-free'); if (d) d.open = true; }); await pb.fill('#on-code', code); await pb.click('[data-act="on-join"]'); await pb.waitForTimeout(1200);
  await pa.waitForTimeout(1800);
  ok(await pa.evaluate(() => KBAPP.ON.v.seats.length === 2 && /ユイ/.test(document.querySelector('.on-seats').innerText)), 'コードで2人目が入れる（ホストの画面に出る）');
  await pa.click('[data-act="on-addai"]'); await pa.waitForTimeout(800);
  ok(await pa.evaluate(() => KBAPP.ON.v.seats.length === 3 && KBAPP.ON.v.seats[2].ai), 'ホストはAI★2を入れられる');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'on_lobby.png') });
  ok(!(await pb.$('[data-act="on-begin"]')), 'ホスト以外は「はじめる」を押せない');
  await pa.click('[data-act="on-begin"]'); await pa.waitForTimeout(700); await pa.screenshot({ path: path.join(__dirname, 'out', 'on_open.png') }); await pa.waitForTimeout(900); await pb.waitForTimeout(1600);
  await pa.waitForTimeout(1500); await pa.screenshot({ path: path.join(__dirname, 'out', 'on_play.png') });
  // 手札はそれぞれ自分の分だけ
  const va = await pa.evaluate(() => KBAPP.ON.v), vb = await pb.evaluate(() => KBAPP.ON.v);
  ok(va.phase === 'play' && va.game.hand.length === 7 && vb.game.hand.length === 7 && !va.game.hands && JSON.stringify(va.game.hand) !== JSON.stringify(vb.game.hand), '始まると7枚ずつ。ほかの人の手札は送られてこない');
  // A は自分の番に打つ（出せれば出す）。B は何もしない → 時間切れ3回でAIが代打ち
  let subSeen = false, aTurns = 0, guard = 0, ON_SHOT = 0;
  // お手つき（出したあとに判定・3枚）：場にならない2枚を出すと、札は戻って3枚引き、番が終わる
  let foulOk = null;
  for (let i = 0; i < 60 && foulOk == null; i++) {
    foulOk = await pa.evaluate(async () => { const v = KBAPP.ON.v; if (!v || v.phase !== 'play' || v.game.cur !== v.me) return null; const h = v.game.hand.map(c => c[0]), t = v.game.field[0];
      for (let a = 0; a < h.length; a++) for (let b = a + 1; b < h.length; b++) if (!KB.evalSelection([h[a], h[b]], t)) { const n0 = h.length; KBAPP.ON.sel = [a, b]; KBAPP.act('on-play'); await new Promise(r => setTimeout(r, 800)); const w = KBAPP.ON.v; return w.game.hand.length === n0 + 3 && w.game.cur !== w.me && (w.game.log || []).some(e => e.foul && e.n === 3); }
      return 'skip'; });
    if (foulOk === 'skip') foulOk = null, await wait(400); else if (foulOk == null) await wait(400);
  }
  ok(foulOk === true, 'お手つき3枚の卓：場にならない札を出すと、戻して3枚引き、番が終わる');
  // AIに任せる：推定実力がなければ★2。ここでは★4でも試す（サーバーの★4の読みも動くか）
  await pb.evaluate(() => KBAPP.act('on-auto')); await pb.waitForTimeout(800);
  const au = await pb.evaluate(() => { const s = KBAPP.ON.v.seats[KBAPP.ON.v.me]; return { sub: s.sub, auto: s.auto, lv: s.subLv, box: /AI★2に任せています/.test(document.body.innerText) }; });
  ok(au.sub && au.auto && au.lv === 2 && au.box, '「AIに任せる」：推定実力がなければAI★2が代わりに打つ');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'on_auto.png') });
  await pb.evaluate(async () => { const c = JSON.parse(localStorage.getItem('kb.cloud')); await fetch(KB_CLOUD_API + '?a=on_act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: c.token, id: KBAPP.ON.v.id, act: 'auto', lv: 4 }) }); });
  await pb.waitForTimeout(4500);
  const lv4 = await pb.evaluate(() => { const s = KBAPP.ON.v.seats[KBAPP.ON.v.me]; return s.subLv; });
  ok(lv4 === 4 && !errs.length, 'AI★4に任せても対局が進む');
  await pb.evaluate(() => KBAPP.act('on-back')); await pb.waitForTimeout(800);
  ok(await pb.evaluate(() => !KBAPP.ON.v.seats[KBAPP.ON.v.me].sub), '「自分で打つ」で戻れる');
  while (guard++ < 400) {
    const st = await pa.evaluate(() => { const v = KBAPP.ON.v; if (!v || !v.game) return 'none'; if (v.phase !== 'play') return v.phase; if (v.game.cur !== v.me) return 'wait';
      const h = v.game.hand.map(c => c[0]), t = v.game.field[0], ms = KB.findMoves(KB.countsOf(h), t, 'all', 3);
      if (ms.length) { KBAPP.ON.sel = []; const used = new Set(); for (const x of ms[0].vals) { const i = h.findIndex((y, k) => y === x && !used.has(k)); used.add(i); KBAPP.ON.sel.push(i); } KBAPP.act('on-play'); } else KBAPP.act('on-draw'); return 'acted'; });
    if (st === 'acted') aTurns++;
    if (!subSeen) subSeen = await pb.evaluate(() => !!(KBAPP.ON.v && KBAPP.ON.v.seats[KBAPP.ON.v.me].sub));
    if (subSeen && !ON_SHOT) { ON_SHOT = 1; await pb.waitForTimeout(600); await pb.screenshot({ path: path.join(__dirname, 'out', 'on_sub.png') }); }
    if (st === 'between' || st === 'done') break;
    await wait(500);
  }
  ok(aTurns >= 1, `自分の番に出す・引くができる（${aTurns}回）`);
  ok(subSeen, '時間切れが3回続くと、AI★2が代わりに打つ');
  await pa.waitForTimeout(1600);
  await pa.screenshot({ path: path.join(__dirname, 'out', 'on_result.png') });
  const end = await pa.evaluate(() => KBAPP.ON.v);
  ok(['between', 'done'].includes(end.phase) && end.game.over && Array.isArray(end.game.hands), 'ゲームが最後まで進み、終わったら全員の手札が見える：' + end.phase);
  // 不正な手はサーバーがはじく
  const bad = await pa.evaluate(async () => { try { await fetch(KB_CLOUD_API + '?a=on_act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: JSON.parse(localStorage.getItem('kb.cloud')).token, id: KBAPP.ON.v.id, act: 'play', vals: [13, 13, 13] }) }).then(r => r.json()); } catch (e) { return 'err'; } return (await fetch(KB_CLOUD_API + '?a=on_act', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: JSON.parse(localStorage.getItem('kb.cloud')).token, id: KBAPP.ON.v.id, act: 'play', vals: [13, 13, 13] }) }).then(r => r.json())).ok; });
  ok(bad === false, '番でない・持っていない札の手はサーバーがはじく');
  ok(!errs.length, 'ページのエラーなし ' + errs.slice(0, 3).join(' / '));
  await b.close(); srv.close(); php.kill();
})();
