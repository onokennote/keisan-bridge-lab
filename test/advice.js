// ホームの博士（公式ルール）・マサ（アドバイス・ライバルと比較）、ランキングのライバルの印、プロフィールの「ライバルに指定されています」
// 使い方：cd test && node advice.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbadv-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8129'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8093"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8093', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8093/api.php KB_STAGING=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8129);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(800);
  const b = await chromium.launch(), errs = [];
  const open = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://localhost:8129/'); await p.waitForTimeout(700);
    await p.fill('#new-name', name); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; }); await p.evaluate(() => KBAPP.cloudPush(false, true)); await p.waitForTimeout(500);
    await p.evaluate(() => KBAPP.go('home')); await p.waitForTimeout(500);
    return p;
  };
  const pa = await open('ケン'), pb = await open('ハナ');
  // マサの手招き：まだ一度も押していなければ、ホームで「アドバイスするで〜」
  ok(await pa.evaluate(() => !!document.querySelector('.host-r.beckon') && /アドバイス|教えたる|おれや/.test(document.querySelector('.host-r .host-say').textContent)), 'ホームを開くと、マサが「アドバイスするで〜」と手招き');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'masa_beckon.png'), clip: { x: 0, y: 0, width: 390, height: 230 } });
  // 博士：公式ルール（博士の言葉の要約・出典つき）
  await pa.click('[data-act="host-root"]'); await pa.waitForTimeout(400);
  ok(await pa.evaluate(() => /出典/.test(document.querySelector('#modal').innerText) && !!document.querySelector('#modal a[href="https://soogackuma.com/18/"]') && document.querySelectorAll('#modal .rule-dl dt').length >= 6), '博士を押すと、ルールの要約と出典（公式ルールへのリンク）');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'host_rules.png') });
  await pa.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
  // マサ：アドバイス（はじめのころ）
  await pa.click('[data-act="host-masa"]'); await pa.waitForTimeout(400);
  const t1 = await pa.evaluate(() => [...document.querySelectorAll('#modal .adv p')].map(e => e.textContent));
  ok(t1.length === 3 && !!(await pa.$('#modal .adv [data-act="adv-go"]')), 'マサを押すと、アドバイスが3つ（やってみるボタンつき）：' + t1.map(x => x.slice(0, 20)).join(' / '));
  await pa.screenshot({ path: path.join(__dirname, 'out', 'host_masa.png') });
  let changed = false; for (let k = 0; k < 6 && !changed; k++) { await pa.click('#modal [data-act="masa-more"]'); await pa.waitForTimeout(200); const t2 = await pa.evaluate(() => [...document.querySelectorAll('#modal .adv p')].map(e => e.textContent)); changed = t2.join() !== t1.join(); }
  ok(changed, '「ほかには？」を押すと、アドバイスが変わる');
  // だいぶ進んだ人：バッジ・冠のアドバイス
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); const g = KBAPP.G(); for (let i = 0; i < 30; i++) g.games.push({ at: i, k: 'practice', ds: [{ l: 0, c: [], h: 0, r: 3 }], f: 0 }); localStorage.setItem(Object.keys(localStorage).find(k => /\.growth$/.test(k)), JSON.stringify(g)); KBAPP.testAch('win', 8); KBAPP.testAch('three', 40); KBAPP.testAch('games', 30); document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); });
  let sawBadge = false; for (let k = 0; k < 8 && !sawBadge; k++) { await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.act('host-masa'); }); await pa.waitForTimeout(150); sawBadge = await pa.evaluate(() => /まで、あと\d+回|狙い目は/.test(document.querySelector('#modal').innerText)); }
  ok(sawBadge, '進んだ人には、あと少しで取れるバッジを教える');
  let sawRv = false; for (let k = 0; k < 40 && !sawRv; k++) { await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.act('host-masa'); }); await pa.waitForTimeout(120); sawRv = await pa.evaluate(() => /ライバル視してみ/.test(document.querySelector('#modal').innerText)); }
  ok(sawRv, 'ライバルがいなければ「ライバル視すると張り合いが出るで」の案内');
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.go('home'); }); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => !document.querySelector('.host-r.beckon')), '一度マサを押したら、手招きはしない（次に開いたときの最初の10秒だけ）');
  for (let k = 0; k < 20; k++) { await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.act('host-masa'); }); await pa.waitForTimeout(120); if (await pa.evaluate(() => !!document.querySelector('#modal .adv-b'))) break; }
  const bn = await pa.evaluate(() => { const e = document.querySelector('#modal .adv-b'); return e && e.textContent; });
  await pa.click('#modal .adv-b'); await pa.waitForTimeout(400);
  ok(!!bn && await pa.evaluate(n => !!document.querySelector('#modal .bdg-talk') && document.querySelector('#modal .bdg-big b').textContent === n.replace(/[「」]/g, ''), bn), 'アドバイスのバッジ名を押すと、そのバッジの詳細が出る：' + bn);
  await pa.screenshot({ path: path.join(__dirname, 'out', 'adv_badge.png') });
  await pa.click('#modal [data-act="adv-back"]'); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => !!document.querySelector('#modal .adv-list')), '「アドバイスに戻る」で元のアドバイスに戻る');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'host_masa2.png') });
  await pa.evaluate(() => KBAPP.cloudPush(false, true)); await pb.evaluate(() => { KBAPP.testAch('win', 12); KBAPP.testAch('three', 70); document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); return KBAPP.cloudPush(false, true); }); await pa.waitForTimeout(600);
  // ランキングでハナを押して「ライバルにする」
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.rank = null; KBAPP.go('ranking'); }); await pa.waitForTimeout(1800);
  await pa.evaluate(() => [...document.querySelectorAll('.rk-row')].find(r => /ハナ/.test(r.innerText)).click()); await pa.waitForTimeout(1500);
  ok(!!(await pa.$('#modal [data-act="rival-toggle"]')), 'ほかの人のプロフィールに「⚔ ライバルにする」');
  await pa.click('#modal [data-act="rival-toggle"]'); await pa.waitForTimeout(800);
  ok(await pa.evaluate(() => /ライバル視をやめる/.test(document.querySelector('#modal [data-act="rival-toggle"]').innerText)), '押すとライバルになる（ボタンが「外す」に変わる）');
  await pa.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove())); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => [...document.querySelectorAll('.rk-row')].some(r => /ハナ/.test(r.innerText) && r.querySelector('.rv-chip'))), 'ランキングのライバルに ⚔ の印');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rival_rank.png') });
  // 表示の切り替え：ライバル／自分のまわり／上位（はじめ10人）
  await pa.click('[data-act="rk-mode"][data-k="total"][data-v="rival"]'); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => { const L = [...document.querySelectorAll('.rk-sec')][0].querySelectorAll('.rk-row'); return [...L].some(r => /ハナ/.test(r.innerText)) && [...L].every(r => /ハナ|ケン/.test(r.innerText)); }), '「⚔ ライバル」でライバルと自分だけ');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rank_rival_tab.png') });
  await pa.click('[data-act="rk-mode"][data-k="total"][data-v="near"]'); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => { const L = [...document.querySelectorAll('.rk-sec')][0].querySelectorAll('.rk-row'); return [...L].some(r => r.classList.contains('me')); }), '「📍 自分のまわり」に自分（真ん中）');
  // 30人のとき：10人分の枠でスクロール、「自分のまわり」は自分が真ん中
  await pa.evaluate(() => { const L = Array.from({ length: 30 }, (_, i) => ({ rank: i + 1, name: i === 17 ? 'ケン' : '研究員' + (i + 1), total: 90 - i * 2.5, me: i === 17 }));
    KBAPP.S.rank = { rankings: { total: { list: L, mine: [], total: 30 } }, at: Date.now(), ai: true }; KBAPP.S.rkMode = { total: 'near' }; KBAPP.go('ranking'); }); await pa.waitForTimeout(800);
  { const f = await pa.evaluate(() => { const bx = document.querySelector('.rk-scroll'), me = bx.querySelector('.me'), a = bx.getBoundingClientRect(), m = me.getBoundingClientRect(), r = bx.querySelectorAll('.rk-row')[0].getBoundingClientRect(); return { rows: bx.clientHeight / (r.height + 4), off: Math.abs(m.top + m.height / 2 - a.top - a.height / 2), sc: bx.scrollHeight > bx.clientHeight }; });
    ok(f.sc && f.rows > 9.5 && f.rows < 10.5 && f.off < 8, `「自分のまわり」は10人分の枠で、自分が真ん中（${JSON.stringify(f)}）`); }
  await (await pa.$('.rk-sec')).screenshot({ path: path.join(__dirname, 'out', 'rank_near.png') });
  await pa.click('[data-act="rk-mode"][data-k="total"][data-v="top"]'); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => { const bx = document.querySelector('.rk-scroll'); return bx.scrollTop === 0 && bx.scrollHeight > bx.clientHeight && document.querySelectorAll('.rk-sec')[0].querySelector('.rk-gap + .rk-row.me'); }), '「上位」は1位から10人分の枠、枠の下に自分の行');
  await (await pa.$('.rk-sec')).screenshot({ path: path.join(__dirname, 'out', 'rank_top.png') });
  await pa.evaluate(() => { KBAPP.S.rank = null; KBAPP.S.rkMode = {}; KBAPP.go('ranking'); }); await pa.waitForTimeout(1800);
  await pa.click('[data-act="rk-mode"][data-k="total"][data-v="top"]'); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => [...document.querySelectorAll('.rk-sec')][0].querySelector('.rk-scroll')), '「🏆 上位」は枠の中をスクロール');
  // マサ → ライバルと比較
  await pa.evaluate(() => { KBAPP.go('home'); KBAPP.act('host-masa'); }); await pa.waitForTimeout(300); await pa.click('#modal [data-act="masa-rival"]'); await pa.waitForTimeout(300);
  await pa.click('#modal [data-act="rival-cmp"]'); await pa.waitForTimeout(1200);
  const cmp = await pa.evaluate(() => document.querySelector('#modal').innerText);
  ok(/BP/.test(cmp) && /推定実力/.test(cmp) && /逆転|差|リード/.test(cmp), 'ライバルと比較：表とかんたんな対策が出る');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rival_cmp.png') });
  ok(/冠/.test(cmp), 'ライバルと比較：バッジと冠を別の行に');
  await pa.click('#modal [data-rvd] >> nth=0'); await pa.waitForTimeout(200);
  ok(await pa.evaluate(() => { const d = document.querySelector('#modal .rv-diff'); return d && !d.hidden && /だけ/.test(d.innerText); }), 'バッジの行を押すと、相手だけ・自分だけのバッジ');
  const chip = await pa.$('#modal .rv-chip'); if (chip) { await chip.click(); await pa.waitForTimeout(200); }
  ok(!chip || await pa.evaluate(() => !document.querySelector('#modal .pv-info').hidden), 'バッジを押すと説明');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rival_cmp_diff.png'), fullPage: true });
  // ライバル・ライバラー（フォロー・フォロワーのように）：ホーム・自分のプロフィール・ランキングからのプロフィール
  await pb.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.rvByAt = 0; KBAPP.go('home'); }); await pb.waitForTimeout(1500);
  ok(await pb.evaluate(() => /←被ライバル\s*1/.test((document.querySelector('#pb-rv') || {}).textContent || '')), 'ホームのプロフィールに「ライバラー 1」（ハナをライバルにしている人の数）');
  await (await pb.$('.player-bar')).screenshot({ path: path.join(__dirname, 'out', 'rival_pb.png') }).catch(() => { });
  await pb.click('#pb-rv [data-k$=":b"]'); await pb.waitForTimeout(300);
  ok(await pb.evaluate(() => [...document.querySelectorAll('#modal .rv-li')].some(e => /ケン/.test(e.textContent))), '押すと一覧に「ケン」（名前を押すとプロフィール）');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'rival_list.png') });
  await pb.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); const el = document.createElement('div'); el.dataset.me = '1'; KBAPP.act('rank-card', el); }); await pb.waitForTimeout(2000);
  ok(await pb.evaluate(() => /←被ライバル\s*1/.test((document.querySelector('#modal .pv-rvc') || {}).textContent || '')), '自分のプロフィールにも「ライバラー 1」（特別な一文はなし）');
  // ケンがランキングからハナのプロフィールを見ると、ハナのライバラーにケン
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.rank = null; KBAPP.go('ranking'); }); await pa.waitForTimeout(1800);
  await pa.evaluate(() => [...document.querySelectorAll('.rk-row')].find(r => /ハナ/.test(r.innerText)).click()); await pa.waitForTimeout(1800);
  ok(await pa.evaluate(() => /←被ライバル\s*1/.test((document.querySelector('#modal .pv-rvc') || {}).textContent || '')), 'ランキングから開いたほかの人のプロフィールにも、ライバル・ライバラーの数');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rival_prof.png') });
  await pa.evaluate(() => [...document.querySelectorAll('.rk-row')].find(r => /ケン/.test(r.innerText)) || null);
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.go('home'); }); await pa.waitForTimeout(800);
  ok(await pa.evaluate(() => /→ライバル視\s*1/.test((document.querySelector('#pb-rv') || {}).textContent || '')), 'ケンのホームには「ライバル 1」');
  // ハナがケンをライバルにし返す →「ライバルバック」
  await pb.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.rank = null; KBAPP.go('ranking'); }); await pb.waitForTimeout(1800);
  await pb.evaluate(() => [...document.querySelectorAll('.rk-row')].find(r => /ケン/.test(r.innerText)).click()); await pb.waitForTimeout(1800);
  ok(await pb.evaluate(() => /宿敵になる/.test((document.querySelector('#modal [data-act="rival-toggle"]') || {}).textContent || '')), '自分をライバルにしている人のプロフィールでは「🔁 ライバルバックする」');
  const before = await pb.evaluate(() => (document.querySelector('#modal .pv-rvc') || {}).textContent || '');
  await pb.click('#modal [data-act="rival-toggle"]'); await pb.waitForTimeout(1500);
  const after = await pb.evaluate(() => (document.querySelector('#modal .pv-rvc') || {}).textContent || '');
  ok(/⇄宿敵\s*0/.test(before) && /⇄宿敵\s*1/.test(after), `ライバルにすると、開いているプロフィールのライバラーの数がすぐ変わる（${before.replace(/\s+/g, '')} → ${after.replace(/\s+/g, '')}）`);
  await pb.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.go('home'); }); await pb.waitForTimeout(1500);
  ok(await pb.evaluate(() => /⇄宿敵\s*1/.test((document.querySelector('#pb-rv') || {}).textContent || '')), 'お互いにライバルなら「ライバルバック 1」');
  await pb.click('#pb-rv [data-k$=":m"]'); await pb.waitForTimeout(300);
  ok(await pb.evaluate(() => /宿敵/.test(document.querySelector('#modal .rv-sec b').textContent) && /ケン/.test(document.querySelector('#modal .rv-sec').textContent)), '一覧で、お互いの人に「🔁 ライバルバック」の印');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'rival_back.png') });
  ok(await pb.evaluate(() => /→ライバル視\s*1/.test(document.querySelector('#pb-rv').textContent) && /←被ライバル\s*1/.test(document.querySelector('#pb-rv').textContent)), 'ライバル視・被ライバルの数に宿敵も入る');
  await pb.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove())); await pb.click('#pb-rv [data-k$=":r"]'); await pb.waitForTimeout(300);
  ok(await pb.evaluate(() => { const r = document.querySelector('#modal .rv-sec .rv-li'); return r && /ケン/.test(r.textContent) && /⇄ 宿敵/.test(r.textContent); }), 'ライバル視の一覧に宿敵も入り、⇄ の印で上に');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'rival_list_mu.png') });
  await pb.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
  await (await pb.$('.player-bar')).screenshot({ path: path.join(__dirname, 'out', 'rival_pb.png') }).catch(() => { });
  // 通知：ケンがバッジを取る → ライバルのハナに「ライバルのケンさんが…」。ケンが招待だけの大会にハナを招待 → ハナに招待の通知
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.testAch('win', 55); document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); return KBAPP.cloudPush(false, true); }); await pa.waitForTimeout(600);
  await pa.evaluate(async () => { const l = KBAPP.cloud().l; await fetch(KB_CLOUD_API + '?a=on_tour_new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: l.token, pid: JSON.parse(localStorage.getItem('kb.profile')), name: 'ケン', tname: 'なかよし杯', startAt: Math.round(Date.now() / 1000) + 7200, limit: 30, min: 2, max: 10, aiFill: true, aiMix: 'even', entry: 'invite', invites: ['ハナ'], sets: 1, games: 1, finalists: 0 }) }); });
  await pb.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.srvNotesAt = 0; KBAPP.go('home'); }); await pb.waitForTimeout(1800);
  ok(await pb.evaluate(() => +(document.querySelector('#pb-nb') || {}).textContent > 0), 'ホームの「🔔 通知」に、まだ見ていない数');
  await pb.click('[data-act="notes-open"]'); await pb.waitForTimeout(400);
  const nts = await pb.evaluate(() => [...document.querySelectorAll('#modal .nt-row')].map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(nts.some(t => /ケンさんにハナさんがライバル視されています/.test(t)), '通知：「ケンさんがハナさんをライバルにしました」');
  ok(nts.some(t => /ライバル視しているケンさんが「.+」(ほか\d+個)?を取りました/.test(t)), '通知：ライバルがバッジを取った');
  ok(nts.some(t => /「なかよし杯」に招待されました/.test(t)), '通知：オンライン大会に招待された');
  ok(nts.some(t => /を取りました/.test(t) && !/ライバル視/.test(t)), '通知：自分のバッジ');
  ok(await pb.evaluate(() => document.querySelectorAll('#modal .nt-row .nt-av, #modal .nt-row .nt-tour, #modal .nt-row svg').length >= 3), '種類ごとに頭のアイコン（人の顔・大会・バッジ）');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'notes.png') });
  await pb.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove())); await pb.waitForTimeout(200);
  ok(await pb.evaluate(() => (document.querySelector('#pb-nb') || {}).hidden), '開いたら既読（数が消える）');
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.srvNotesAt = 0; KBAPP.go('home'); }); await pa.waitForTimeout(1800); await pa.click('[data-act="notes-open"]'); await pa.waitForTimeout(400);
  ok(await pa.evaluate(() => [...document.querySelectorAll('#modal .nt-row')].some(e => /ハナさんと宿敵になりました/.test(e.innerText))), '通知：「🔁 ハナさんがライバルバックしました」');
  await pa.evaluate(() => [...document.querySelectorAll('#modal .nt-row')].find(e => /宿敵/.test(e.innerText)).click()); await pa.waitForTimeout(1500);
  ok(await pa.evaluate(() => !!document.querySelector('#modal .pv-head')), '人の通知を押すと、その人のプロフィール');
  // ライバル系のバッジ：宿敵ができたハナに「宿命の出会い」、ライバル視・被ライバルも
  const rb = await pb.evaluate(() => { const g = KBAPP.G(); return ['rival_out:1', 'rival_in:1', 'rival_mu:1'].map(k => !!g.ach[k]); });
  ok(rb.every(Boolean), 'ライバル系のバッジ（ライバル宣言・注目の的・宿命の出会い）を取れる：' + rb.join());
  await pb.waitForTimeout(6000);
  const rk = await pb.evaluate(async () => { const g = KBAPP.G(), nm = KBAPP.S.settings.name; const j = await (await fetch(KB_CLOUD_API + '?a=rankings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: KBAPP.cloud().l && KBAPP.cloud().l.token, ai: 0 }) })).json(); const L = ((j.rankings || {}).badges || {}).list || []; const r = (Array.isArray(L) ? L : []).find(x => x.name === nm); return { local: Object.keys(g.ach).filter(k => !/^cat:/.test(k)).length, rank: r ? r.badges : null, raw: JSON.stringify(j).slice(0, 200) }; });
  ok(rk.rank === rk.local, 'ランキングのバッジ数に、ライバル系のバッジも入る：端末' + rk.local + '・ランキング' + rk.rank + ' ' + (rk.rank == null ? rk.raw : ''));
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
