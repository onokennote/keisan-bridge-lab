// オンライン大会のバッジ（段階4）とアーカイブのテスト：人が10人以上の大会だけ上位3位にバッジ。終わった大会は一覧から消えてアーカイブへ
// 使い方：cd test && node otour_award.js（php が必要。2〜3分かかる）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbaward-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8127'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8096"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8096', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8096/api.php KB_STAGING=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8127);
const wait = ms => new Promise(r => setTimeout(r, ms));
const API = 'http://localhost:8096/api.php';
const call = async (a, body) => (await fetch(API + '?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })).json();
(async () => {
  await wait(800);
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8127/'); await p.waitForTimeout(700);
  await p.fill('#new-name', 'ケン'); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; });
  const me = await p.evaluate(() => ({ token: JSON.parse(localStorage.getItem('kb.cloud')).token, pid: JSON.parse(localStorage.getItem('kb.profile')) }));
  // 大会：最少2人・AIの補充なし・予選1セット1ゲーム・決勝なし・制限3秒
  const tour = (await call('on_tour_new', { token: me.token, name: 'ケン', tname: 'バッジ杯', startAt: Math.round(Date.now() / 1000) + 600, limit: 3, min: 2, max: 20, aiFill: false, sets: 1, games: 1, finalists: 0 })).tour;
  const small = (await call('on_tour_new', { token: me.token, name: 'ケン', tname: '少人数杯', startAt: Math.round(Date.now() / 1000) + 600, limit: 3, min: 2, max: 20, aiFill: false, sets: 1, games: 1, finalists: 0 })).tour;
  // 自分＋9人（APIで作ったアカウント）がエントリー → 人が10人
  await call('on_tour_act', { token: me.token, id: tour.id, act: 'entry', name: 'ケン', pid: me.pid });
  for (let i = 0; i < 9; i++) { const r = await call('register'); await call('on_tour_act', { token: r.token, id: tour.id, act: 'entry', name: '参加者' + (i + 1), pid: 'p' + i }); if (i === 0) await call('on_tour_act', { token: r.token, id: small.id, act: 'entry', name: '参加者1', pid: 'p0' }); }
  await call('on_tour_act', { token: me.token, id: small.id, act: 'entry', name: 'ケン', pid: me.pid });
  const t1 = (await call('on_tour', { token: me.token, id: tour.id })).tour;
  ok(t1.n === 10, 'バッジ杯に人が10人エントリー');
  await call('on_tour_act', { token: me.token, id: tour.id, act: 'startnow' }); await call('on_tour_act', { token: me.token, id: small.id, act: 'startnow' });
  // ブラウザの自分は大会の画面から自分の卓へ。ほかの人は時間切れ→AIの代打ちで進む
  await p.evaluate(id => KBAPP.act('on-tour-open', { dataset: { id } }), tour.id); await p.waitForTimeout(4000);
  const t0 = Date.now(); let done = false;
  while (Date.now() - t0 < 400000) {
    await p.evaluate(() => { const S = KBAPP.S, v = KBAPP.ON.v; if (S.view !== 'online' || !v || !v.game || v.phase !== 'play' || v.game.cur !== v.me || v.seats[v.me].sub) return;
      const h = v.game.hand.map(c => c[0]), ms = KB.findMoves(KB.countsOf(h), v.game.field[0], 'all', 3);
      if (ms.length) { KBAPP.ON.sel = []; const used = new Set(); for (const x of ms[0].vals) { const i = h.findIndex((y, k) => y === x && !used.has(k)); used.add(i); KBAPP.ON.sel.push(i); } KBAPP.act('on-play'); } else KBAPP.act('on-draw'); });
    const [a, s2] = [(await call('on_tour', { token: me.token, id: tour.id })).tour, (await call('on_tour', { token: me.token, id: small.id })).tour];
    if (a.phase === 'done' && s2.phase === 'done') { done = true; break; }
    await wait(1500);
  }
  ok(done, '2つの大会が最後まで進む');
  const big = (await call('on_tour', { token: me.token, id: tour.id })).tour, sm = (await call('on_tour', { token: me.token, id: small.id })).tour;
  ok(big.awardOk === true && big.awards.length === 3, '人が10人の大会は、上位3位にバッジ：' + big.awards.map(a => a.place + '位 ' + a.name).join('、'));
  ok(sm.awardOk === false && sm.awards.length === 0, '人が10人未満の大会は、バッジなし');
  // 一覧から消えて、アーカイブに出る
  const act = await call('on_tours', { token: me.token }), arch = await call('on_tours_archive', { token: me.token });
  ok(!act.tours.some(t => t.id === tour.id) && arch.tours.some(t => t.id === tour.id) && arch.tours.some(t => t.id === small.id), '終わった大会はホームの一覧から消え、アーカイブに出る');
  // 自分が上位3位ならバッジが付く（そうでなければ付かない）
  const myPlace = (big.awards.find(a => a.name === 'ケン') || {}).place || 0;
  await p.evaluate(() => KBAPP.onAwardsSync()); await p.waitForTimeout(800);
  const cnt = await p.evaluate(() => KBAPP.G().cnt.on_podium || 0);
  ok(cnt === (myPlace ? 4 - myPlace : 0), `自分のバッジ（${myPlace ? myPlace + '位' : '圏外'}）：表彰台の段階 ${cnt}`);
  await p.evaluate(() => { document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); KBAPP.go('home'); }); await p.waitForTimeout(500);
  await p.click('[data-act="on-arch"]'); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => /バッジ杯/.test(document.body.innerText) && /少人数杯/.test(document.body.innerText)), '「過去の大会」でアーカイブが見られる');
  await p.screenshot({ path: path.join(__dirname, 'out', 'ot_archive.png') });
  await p.evaluate(() => document.querySelector('.on-trow').click()); await p.waitForTimeout(1200);
  await p.screenshot({ path: path.join(__dirname, 'out', 'ot_award.png'), fullPage: true });
  ok(await p.evaluate(() => /上位3位にバッジ|バッジはなし/.test(document.body.innerText)), 'アーカイブから大会の結果とバッジの有無が見られる');
  // テスト版の仮のユーザー（称号とバッジ）：ランキングから開くプロフィールに称号とメダルの数
  await call('on_test_seed', {});
  const rk = await call('rankings', {}); const tester = rk.rankings.bp.list.find(x => x.name === 'テスト王');
  const card = tester && (await (await fetch(API + '?a=card&rid=' + tester.rid)).json()).card;
  ok(card && card.titleShow && card.titleShow.official === 1 && /オノケン杯/.test(card.titleShow.text) && card.awards.length === 3, '仮のユーザーに称号（公式）と大会の実績：' + (card && card.titleShow && card.titleShow.text));
  await p.evaluate(() => { document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove()); KBAPP.go('ranking'); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const r = [...document.querySelectorAll('.rk-row')].find(x => /テスト王/.test(x.innerText)); if (r) r.click(); }); await p.waitForTimeout(1500);
  ok(await p.evaluate(() => !!document.querySelector('#modal .pv-title.off') && document.querySelectorAll('#modal .pv-md').length >= 2), 'ランキングから開くと、名前の上に称号、公式・オンラインのメダルの数');
  await p.screenshot({ path: path.join(__dirname, 'out', 'ot_title.png') });
  // 主催者はアーカイブから削除できる（ほかの人はできない）
  const other = await call('register');
  const ng = await call('on_tour_act', { token: other.token, id: small.id, act: 'remove' });
  const okr = await call('on_tour_act', { token: me.token, id: small.id, act: 'remove' });
  const arch2 = await call('on_tours_archive', { token: me.token });
  ok(!ng.ok && okr.ok && !arch2.tours.some(t => t.id === small.id) && arch2.tours.some(t => t.id === tour.id), '主催者だけが、終わった大会をアーカイブから削除できる');
  // 受付が始まる前なら、主催者は編集・削除できる（受付中は編集できない）
  const later = (await call('on_tour_new', { token: me.token, name: 'ケン', tname: '来週杯', startAt: Math.round(Date.now() / 1000) + 7200, min: 2, max: 8 })).tour;
  await p.evaluate(() => document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove()));
  await p.evaluate(id => KBAPP.act('on-tour-open', { dataset: { id } }), later.id); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => !!document.querySelector('[data-act="on-tour-edit"]') && !!document.querySelector('[data-act="on-tour-delete"]')), '受付前の自分の大会に「編集」「削除」');
  await p.click('[data-act="on-tour-edit"]'); await p.waitForTimeout(400);
  await p.evaluate(() => { document.querySelector('#ot-name').value = '来週杯（改）'; KBAPP.S.onTour.name = '来週杯（改）'; }); await p.click('[data-act="on-tour-create"]'); await p.waitForTimeout(1000);
  ok(await p.evaluate(() => KBAPP.ON.t.name === '来週杯（改）'), '編集した名前が反映される');
  const ed2 = await call('on_tour_act', { token: me.token, id: tour.id, act: 'edit', tname: 'x', startAt: Math.round(Date.now() / 1000) + 9999 });
  ok(!ed2.ok, '始まった（終わった）大会は編集できない');
  await p.evaluate(() => KBAPP.act('on-tour-delete')); await p.waitForTimeout(800);
  ok((await call('on_tour', { token: me.token, id: later.id })).tour.phase === 'cancel', '受付前の大会を削除（中止）できる');
  // AIが大勢でも名前（キャラ）が重ならない：全員達人で20人に補充（AI★5が19人）
  const many = (await call('on_tour_new', { token: me.token, name: 'ケン', tname: '大人数杯', startAt: Math.round(Date.now() / 1000) + 600, min: 20, max: 30, aiFill: true, aiMix: 'master', sets: 1, games: 1, finalists: 0, limit: 3 })).tour;
  await call('on_tour_act', { token: me.token, id: many.id, act: 'entry', name: 'ケン', pid: me.pid }); await call('on_tour_act', { token: me.token, id: many.id, act: 'startnow' });
  const mt = (await call('on_tour', { token: me.token, id: many.id })).tour;
  const nms = await p.evaluate(st => st.map(r => r.ai ? KBAPP.onName(r) : r.name), mt.stand);
  ok(nms.length === 20 && new Set(nms).size === 20, 'AIが19人いても名前が重ならない：' + nms.slice(0, 6).join('・') + '…');
  await call('on_tour_act', { token: me.token, id: many.id, act: 'delete' });
  ok(!errs.length, 'ページのエラーなし ' + errs.slice(0, 3).join(' / '));
  await b.close(); srv.close(); php.kill();
})();
