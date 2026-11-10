// オンライン大会（段階2）の通しテスト：大会をひらく→一覧→エントリー→今すぐ開始→予選2セット（2卓・AIで補充）→決勝→結果
// 使い方：cd test && node otour.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbotour-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8126'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8097"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8097', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8097/api.php KB_STAGING=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8126);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(800);
  const b = await chromium.launch(), errs = [];
  const open = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://localhost:8126/'); await p.waitForTimeout(700);
    await p.fill('#new-name', name); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; }); await p.evaluate(() => KBAPP.cloudPush()); await p.waitForTimeout(500);
    await p.evaluate(() => KBAPP.go('home')); await p.waitForTimeout(800);
    return p;
  };
  const pa = await open('ケン'), pb = await open('ユイ'), pc = await open('タロウ');
  // A：大会をひらく（すぐ受付中になるよう、開始は10分後）
  await pa.click('[data-act="on-tour-new"]'); await pa.waitForTimeout(300);
  await pa.screenshot({ path: path.join(__dirname, 'out', 'ot_new.png'), fullPage: true });
  const start = new Date(Date.now() + 10 * 60000); const loc = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await pa.evaluate((loc) => { Object.assign(KBAPP.S.onTour, { name: 'テスト杯', desc: '段階2のテストです', start: loc, limit: 3, min: 6, max: 10, aiFill: true, aiLv: 2, entry: 'open', sets: 2, games: 1, finalists: 3, pts: 'std' }); document.querySelector('#ot-name').value = 'テスト杯'; document.querySelector('#ot-desc').value = '段階2のテストです'; document.querySelector('#ot-start').value = loc; }, loc);
  await pa.click('[data-act="on-tour-create"]'); await pa.waitForTimeout(800);
  ok(await pa.evaluate(() => KBAPP.S.view === 'otour' && /テスト杯/.test(document.body.innerText) && /主催 ケン/.test(document.body.innerText)), '大会をひらくと、大会の画面になる（主催は自分の名前）');
  // B：ホームの一覧に出る → 開いてエントリー
  await pb.evaluate(() => { KBAPP.ON.toursAt = 0; KBAPP.go('home'); }); await pb.waitForTimeout(1200);
  ok(await pb.evaluate(() => /テスト杯/.test(document.querySelector('.on-card').innerText) && /受付中/.test(document.querySelector('.on-card').innerText)), 'ホームの大会一覧に出る（受付中）');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'ot_list.png') });
  await pb.click('.on-trow'); await pb.waitForTimeout(800); await pb.click('[data-act="on-tour-entry"]'); await pb.waitForTimeout(800);
  ok(await pb.evaluate(() => KBAPP.ON.t.entered), 'エントリーできる');
  await pa.click('[data-act="on-tour-entry"]'); await pa.waitForTimeout(800);
  // 招待だけの大会：招待された人にだけ見える
  await pc.evaluate(async () => { const c = JSON.parse(localStorage.getItem('kb.cloud')); await fetch(KB_CLOUD_API + '?a=on_tour_new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: c.token, name: 'タロウ', tname: '招待杯', startAt: Math.round(Date.now() / 1000) + 3600, entry: 'invite', invites: ['ユイ'], min: 2, max: 4 }) }); });
  await pb.evaluate(() => { KBAPP.ON.toursAt = 0; KBAPP.go('home'); }); await pa.evaluate(() => { KBAPP.ON.toursAt = 0; }); await pb.waitForTimeout(1200);
  const seeB = await pb.evaluate(() => /招待杯/.test(document.querySelector('.on-card').innerText) && /招待されています/.test(document.querySelector('.on-card').innerText));
  const seeA = await pa.evaluate(async () => { const j = await (await fetch(KB_CLOUD_API + '?a=on_tours', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: JSON.parse(localStorage.getItem('kb.cloud')).token }) })).json(); return j.tours.some(t => t.name === '招待杯'); });
  ok(seeB && !seeA, '招待だけの大会は、招待された人にだけ見える');
  await pb.click('.on-trow'); await pb.waitForTimeout(800);
  // A：今すぐ開始（2人＋AI★2で6人に補充 → 3人卓×2）
  await pa.screenshot({ path: path.join(__dirname, 'out', 'ot_entry.png') });
  await pa.click('[data-act="on-tour-startnow"]'); await pa.waitForTimeout(1500);
  ok(await pa.evaluate(() => KBAPP.S.view === 'online' && KBAPP.ON.v && KBAPP.ON.v.tour), '始まると自分の卓に入る');
  await pb.waitForTimeout(3500);
  ok(await pb.evaluate(() => KBAPP.S.view === 'online' && KBAPP.ON.v && KBAPP.ON.v.tour), 'ほかの参加者も自動で自分の卓に入る');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'ot_room.png') });
  // C（出ていない人）：大会の画面から卓を選んで観戦（手札は届かない・席を押すと手元が替わる）
  await pc.evaluate(() => { KBAPP.ON.toursAt = 0; KBAPP.go('home'); }); await pc.waitForTimeout(1200);
  await pc.evaluate(() => [...document.querySelectorAll('.on-trow')].find(b => /テスト杯/.test(b.innerText)).click()); await pc.waitForTimeout(1200);
  ok(await pc.evaluate(() => document.querySelectorAll('[data-act="on-watch"]').length === 2), '開催中の大会の画面に、観戦する卓（2卓）が並ぶ');
  await pc.screenshot({ path: path.join(__dirname, 'out', 'ot_rooms.png') });
  await pc.click('[data-act="on-watch"]'); await pc.waitForTimeout(1500);
  const w = await pc.evaluate(() => { const v = KBAPP.ON.v; return { me: v.me, hand: v.game.hand, hands: v.game.hands, backs: document.querySelectorAll('.on-backs .card.back').length, banner: !!document.querySelector('.on-watch'), actions: !!document.querySelector('[data-act="on-play"]') }; });
  ok(w.me === -1 && w.hand === null && w.hands === null && w.backs > 0 && w.banner && !w.actions, '観戦では手札が届かず、手元の人の札は裏向き。出す・引くはない');
  await pc.screenshot({ path: path.join(__dirname, 'out', 'ot_watch.png') });
  const pov0 = await pc.evaluate(() => document.querySelector('.me .head b').textContent);
  await pc.click('[data-onpov]'); await pc.waitForTimeout(400);
  const pov1 = await pc.evaluate(() => document.querySelector('.me .head b').textContent);
  ok(pov0 !== pov1, `ほかの席を押すと、その人の席から見られる（${pov0}→${pov1}）`);
  await pc.evaluate(() => KBAPP.act('on-to-tour')); await pc.waitForTimeout(800);
  // 2人とも自分の番が来たら打つ。大会の画面に戻ったら待つ。決勝・結果まで
  const step = p => p.evaluate(() => { const S = KBAPP.S, v = KBAPP.ON.v; document.querySelectorAll('.whistle-ov').forEach(e => e.click()); if (S.view === 'otour') { const rb = document.querySelector('[data-act="on-tour-ready"]'); if (rb) { rb.click(); return 'ready'; } return 'tour:' + (KBAPP.ON.t && KBAPP.ON.t.phase); } if (S.view !== 'online' || !v || !v.game || v.phase !== 'play' || v.game.cur !== v.me || v.seats[v.me].sub) return 'wait';
    const h = v.game.hand.map(c => c[0]), ms = KB.findMoves(KB.countsOf(h), v.game.field[0], 'all', 3);
    if (ms.length) { KBAPP.ON.sel = []; const used = new Set(); for (const x of ms[0].vals) { const i = h.findIndex((y, k) => y === x && !used.has(k)); used.add(i); KBAPP.ON.sel.push(i); } KBAPP.act('on-play'); } else KBAPP.act('on-draw'); return 'acted'; });
  let sawFinal = false, done = false, sawReady = false, t0 = Date.now();
  while (Date.now() - t0 < 300000) {
    const [sa, sb] = [await step(pa), await step(pb)]; if (sa === 'ready' || sb === 'ready') { if (!sawReady) await (sa === 'ready' ? pa : pb).screenshot({ path: path.join(__dirname, 'out', 'ot_ready.png') }); sawReady = true; }
    const ph = await pa.evaluate(() => KBAPP.ON.t && KBAPP.ON.t.phase);
    if (ph === 'final' || (await pa.evaluate(() => KBAPP.ON.v && /決勝/.test(KBAPP.ON.v.label || '')))) sawFinal = true;
    if (sa === 'tour:done' || sb === 'tour:done') { done = true; break; }
    await wait(400);
  }
  ok(sawReady, 'セットの合間は「準備OK」を押してそろってから次のセット');
  ok(sawFinal, '予選のあと、上位3人で決勝');
  ok(done, '大会が最後まで進み、結果が出る');
  await pa.waitForTimeout(800); await pb.waitForTimeout(800);
  const view = (await pa.evaluate(() => KBAPP.S.view === 'otour')) ? pa : pb;
  await view.screenshot({ path: path.join(__dirname, 'out', 'ot_result.png'), fullPage: true });
  ok(await view.evaluate(() => KBAPP.ON.t.stand.length === 6 && /🥇/.test(document.body.innerText)), '最終順位（6人・上位3人にメダル）');
  ok(!errs.length, 'ページのエラーなし ' + errs.slice(0, 3).join(' / '));
  await b.close(); srv.close(); php.kill();
})();
