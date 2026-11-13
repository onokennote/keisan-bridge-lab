// デイリートーナメントの通しテスト：グループ分け（16人以上で2グループ・空きはAI）／ホームのカード→エントリー→予選→決勝→ポイント→シーズンの締め（総ポイント・過去のシーズン）→バッジ
// 使い方：cd test && node daily.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbdaily-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8131'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8099"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8099', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8099/api.php KB_STAGING=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8131);
const wait = ms => new Promise(r => setTimeout(r, ms));
const api = async (a, body) => (await fetch('http://localhost:8099/api.php?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:8131' }, body: JSON.stringify(body || {}) })).json();
(async () => {
  await wait(800);
  // 1. グループ分け：17人がエントリー → A・Bの2グループ（どちらも15人。空きはAI）
  const reg = []; for (let i = 0; i < 17; i++) reg.push(await api('register'));
  let j = await api('daily_test', { startIn: 4, all: 1 }); const did = j.id;
  for (let i = 0; i < 17; i++) await api('on_tour_act', { token: reg[i].token, id: did, act: 'entry', name: '参加' + (i + 1), pid: 'p1' });
  await wait(5000);
  await api('on_tours', { token: reg[0].token }); j = await api('on_tours', { token: reg[0].token });
  const ds = (j.tours || []).filter(t => t.daily && t.part === 1);
  ok(ds.length === 2 && ds.every(t => t.group) && ds.some(t => t.group === 'A') && ds.some(t => t.group === 'B'), `16人以上はグループに分かれる（${ds.map(t => t.name).join(' / ')}）`);
  const A = await api('on_tour', { token: reg[0].token, id: did }), B = await api('on_tour', { token: reg[0].token, id: did + 'B' });
  ok(A.tour.stand.length === 15 && B.tour.stand.length === 15 && A.tour.stand.filter(s => !s.ai).length + B.tour.stand.filter(s => !s.ai).length === 17, `どのグループも15人（人は ${A.tour.stand.filter(s => !s.ai).length}＋${B.tour.stand.filter(s => !s.ai).length}、空きはAI）`);
  ok(A.tour.sets === 2, '予選2セット');
  const p2 = await api('daily_test', { startIn: 600, part: 2 }); // 受付中（15分前より後）の第2部
  const r0 = await api('on_tour_act', { token: reg[0].token, id: (await api('daily_test', { startIn: 3600, part: 4 })).id, act: 'entry', name: '参加1', pid: 'p1' });
  ok(r0.ok === false && /15分前/.test(r0.error || ''), 'エントリーは開始の15分前から（' + (r0.error || '') + '）');
  const r2 = await api('on_tour_act', { token: reg[0].token, id: p2.id, act: 'entry', name: '参加1', pid: 'p1' });
  ok(r2.ok === false && /1日1部/.test(r2.error || ''), '同じ日にほかの部には出られない（' + (r2.error || '') + '）');

  // 2. 画面：ホームのデイリーのカード → エントリー → 最後まで（過去のシーズンとして作り、終わったら締めを確かめる）
  j = await api('daily_test', { startIn: 25, season: '2026-10b', sets: 2, games: 1, part: 3, aiTest: 1, ais: ['zero', 'shota', 'tome'], finalGames: 2 });
  const b = await chromium.launch(), errs = [];
  const open = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://localhost:8131/'); await p.waitForTimeout(700);
    await p.fill('#new-name', name); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; }); await p.evaluate(() => KBAPP.cloudPush()); await p.waitForTimeout(500);
    await p.evaluate(() => { KBAPP.ON.toursAt = 0; KBAPP.go('home'); }); await p.waitForTimeout(1800);
    return p;
  };
  const pa = await open('ケン'), pb = await open('ユイ');
  ok(await pa.evaluate(() => { const c = document.querySelector('.dl-card'); return c && /デイリートーナメント/.test(c.innerText) && /開始まで あと/.test(c.innerText) && /テスト中/.test(c.innerText); }), 'ホームにデイリーのカード（開始までの残り時間・テスト中の注意）');
  await pa.evaluate(() => document.querySelector('.dl-card').scrollIntoView()); await pa.screenshot({ path: path.join(__dirname, 'out', 'daily_card.png') });
  for (const p of [pa, pb]) { await p.evaluate(id => document.querySelector(`.dl-card [data-id="${id}"]`).click(), j.id); await p.waitForTimeout(1000); await p.click('[data-act="on-tour-entry"]'); await p.waitForTimeout(800); }
  ok(await pa.evaluate(() => KBAPP.ON.t && KBAPP.ON.t.entered && KBAPP.ON.t.daily), 'デイリーにエントリーできる（作られたときから受付）');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'daily_tour.png') });
  const step = p => p.evaluate(() => { const S = KBAPP.S, v = KBAPP.ON.v; document.querySelectorAll('.whistle-ov').forEach(e => e.click()); if (S.view === 'otour') { const rb = document.querySelector('[data-act="on-tour-ready"]'); if (rb) { rb.click(); return 'ready'; } return 'tour:' + (KBAPP.ON.t && KBAPP.ON.t.phase); }
    if (S.view !== 'online' || !v || !v.game || v.me < 0 || v.game.turn !== v.me || v.phase !== 'play') return 'wait';
    const h = v.game.hand.map(c => c[0]), ms = KB.findMoves(KB.countsOf(h), v.game.field[0], 'all', 3);
    if (ms.length) { KBAPP.ON.sel = []; const used = new Set(); for (const x of ms[0].vals) { const i = h.findIndex((y, k) => y === x && !used.has(k)); used.add(i); KBAPP.ON.sel.push(i); } KBAPP.act('on-play'); } else KBAPP.act('on-draw'); return 'acted'; });
  let done = false; const t0 = Date.now();
  let finG = null;
  while (Date.now() - t0 < 600000) { const [sa, sb] = [await step(pa), await step(pb)]; for (const p of [pa, pb]) { const g = await p.evaluate(() => KBAPP.ON.v && /決勝/.test(KBAPP.ON.v.label || '') ? KBAPP.ON.v.cfg.games : null); if (g) finG = g; } if (sa === 'tour:done' || sb === 'tour:done') { done = true; break; } await wait(400); }
  ok(done, 'デイリーが最後まで進む（予選→決勝）');
  ok(finG === null || finG === 2, `決勝は決勝だけのゲーム数（${finG}ゲーム）`);
  await wait(1500);
  const info = await pa.evaluate(async () => { const c = KBAPP.plLink(KBAPP.S.profileId || JSON.parse(localStorage.getItem('kb.profile'))); return (await fetch(KB_CLOUD_API + '?a=daily_info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: c.token }) })).json(); });
  const past = (info.past || []).find(x => x.season === '2026-10b');
  ok(!!past && past.stand.filter(r => r.ai).length === 3 && past.stand.filter(r => !r.ai).length === 2, `AI研究員もデイリーに出てシーズン順位に入る（${past ? past.stand.map(r => r.name + (r.ai ? '(AI)' : '')).join('・') : ''}）`);
  ok(!!past && past.stand.map(r => r.bonus).join() === '100,70,50,40,20', '総ポイントのボーナスはAIも入れた順位のまま（1位から100・70・50・40・20）');
  ok(!!past && past.stand.length === 5 && past.stand.every(r => r.pts >= 1), `終わったシーズンは締められ、過去のシーズンに残る（${past ? past.stand.map(r => r.name + ' ' + r.pts + 'pt').join('・') : 'なし'}）`);
  
  ok((info.total || []).length === 5 && info.total[0].pts === 100 && info.total.some(r => r.ai), '総ポイントのランキング（AI研究員も入る）');
  await pa.evaluate(() => KBAPP.onAwardsSync()); await pa.waitForTimeout(1500);
  const bd = await pa.evaluate(() => { const g = KBAPP.G(); return { play: !!g.ach['daily_play:1'], dpod: Object.keys(g.ach).some(k => /^daily_(win|2nd|3rd):/.test(k)), spod: Object.keys(g.ach).some(k => /^season_podium:/.test(k)) }; });
  ok(bd.play, `バッジ：デイリー参加（表彰台はAIも入れた順位で3位以内のときだけ）（${JSON.stringify(bd)}）`);
  await pa.evaluate(() => { document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove()); KBAPP.ON.dinfoAt = 0; KBAPP.go('home'); }); await pa.waitForTimeout(1500);
  await pa.evaluate(() => { const e = document.createElement('b'); e.dataset.tab = 'past'; KBAPP.act('daily-rank', e); }); await pa.waitForTimeout(1200);
  ok(await pa.evaluate(() => /10月後半シーズン/.test(document.querySelector('#modal').innerText)), 'ランキングの「過去のシーズン」に出る');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'daily_rank.png') });
  await pa.click('#modal [data-tab="total"]'); await pa.waitForTimeout(400);
  await pa.screenshot({ path: path.join(__dirname, 'out', 'daily_total.png') });
  await api('daily_test', { startIn: 3000, part: 4 }); // まだ受付前の別の部
  await pa.evaluate(() => { document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove()); KBAPP.ON.toursAt = 0; KBAPP.go('home'); }); await pa.waitForTimeout(2500);
  const dc = await pa.evaluate(() => { const c = document.querySelector('.dl-card'); return { joined: /きょうは参加済み/.test(c.innerText) && /第3部.{0,3}に参加しました/.test(c.innerText), noEntry: ![...c.querySelectorAll('button')].some(b => b.textContent.trim() === 'エントリー'), result: !!c.querySelector('.dl-mine [data-act="on-tour-open"]') }; });
  ok(dc.joined && dc.noEntry && dc.result, `その日に出た人には、ほかの部のエントリーを出さず「参加済み」と結果のボタン（${JSON.stringify(dc)}）`);
  await pa.evaluate(() => document.querySelector('.dl-card').scrollIntoView()); await pa.screenshot({ path: path.join(__dirname, 'out', 'daily_joined.png') });
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.go('home'); }); await pa.waitForTimeout(1500);
  await pa.click('.dl-card [data-act="daily-rank"]'); await pa.waitForTimeout(3000);
  ok(await pa.evaluate(() => KBAPP.S.view === 'ranking' && !!document.querySelector('#rk-season') && !!document.querySelector('#rk-cup') && document.querySelectorAll('#rk-tpoints .rk-row').length >= 2), 'デイリーのカードの「ランキング」で、ランキング画面のシーズン・総ポイントの欄へ');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'daily_in_rank.png') });
  await pa.evaluate(() => document.querySelector('#rk-tpoints').scrollIntoView()); await pa.screenshot({ path: path.join(__dirname, 'out', 'daily_in_rank2.png') });
  // 順位ごとの回数でバッジ（サーバーの返事を差し替えて確かめる）：優勝2回→銀、2位1回→銅、3位3回→金
  const bd2 = await pa.evaluate(async () => { const pid = JSON.parse(localStorage.getItem('kb.profile')), f0 = window.fetch;
    window.fetch = async (u, o) => /a=on_awards/.test(String(u)) ? new Response(JSON.stringify({ ok: true, daily: 6, awards: [1, 1, 2, 3, 3, 3].map((pl, i) => ({ pid, tid: 'X' + i, tname: 'デイリー', place: pl, official: 2 })) })) : f0(u, o);
    await KBAPP.onAwardsSync(); window.fetch = f0; const g = KBAPP.G(); return ['daily_win:2', 'daily_2nd:1', 'daily_3rd:3'].map(k => !!g.ach[k]).concat([!g.ach['daily_win:3'], !g.ach['daily_2nd:2']]); });
  ok(bd2.every(Boolean), 'デイリーの順位ごとのバッジ（優勝2回で銀・2位1回で銅・3位3回で金）：' + bd2.join());
  ok(!errs.length, 'ページのエラーなし ' + errs.slice(0, 3).join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
