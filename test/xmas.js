// サンタからの挑戦状：保護者（Googleでまもっている人）が仕込む→子どもは優勝するまでメッセージを受け取れない→3回負けると手加減→優勝で受け取る。使い方：cd test && node xmas.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbxmas-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8131'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8101"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8101', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8101/api.php KB_GOOGLE_TEST=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8131);
const post = (a, body) => fetch('http://localhost:8101/api.php?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const shot = n => path.join(__dirname, 'out', n);
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), errs = [];
  const X = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await X.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8131/'); await p.waitForTimeout(900);
  await p.fill('#new-name', 'ユウ'); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; }); await p.evaluate(() => KBAPP.cloudPush()); await p.waitForTimeout(600);
  // 子どものプレイヤーを保護者のGoogleでまもる
  await p.evaluate(() => KBAPP.act('g-protect')); await p.waitForTimeout(300); await p.click('#g-test'); await p.waitForTimeout(800);
  const me = await p.evaluate(() => { const id = JSON.parse(localStorage.getItem('kb.profile')); return { token: KBAPP.plLink(id).token, pid: id }; });
  // 「おうちの人（大人）」にしたプレイヤーには、ホームにおうちの人メニュー＋おしらせマーク。開くにはGoogle
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.act('profiles'); }); await p.waitForTimeout(300);
  await p.check('#pm-adult'); await p.waitForTimeout(200);
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.go('home'); }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!document.querySelector('.pb-fam .nb')), 'おうちの人にしたプレイヤーのホームに「おうちの人メニュー」とおしらせマーク');
  await (await p.$('.pb-fam')).screenshot({ path: shot('fam_btn.png') });
  await p.evaluate(() => { KBAPP.S.gIdt = null; KBAPP.act('fam-menu'); }); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !!document.querySelector('#modal #g-test') && !document.querySelector('#modal .fam-list')), '開くにはGoogleでのログインが必要');
  await p.click('#g-test'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!document.querySelector('#modal #fam-pw2') && !document.querySelector('#modal .fam-list')), 'Googleのあと、はじめはパスワードを決める（決めるまでメニューは出ない）');
  await (await p.$('#modal .xm-par')).screenshot({ path: shot('fam_pw.png') });
  await p.fill('#fam-pw', 'santa2026'); await p.fill('#fam-pw2', 'santa2026'); await p.click('#fam-ok'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!document.querySelector('#modal .fam-list [data-fam="xmas"] .fam-new') && !document.querySelector('.pb-fam .nb')), 'ログインすると、しかけの一覧（サンタからの挑戦状 NEW）。おしらせマークは消える');
  await (await p.$('#modal .xm-par')).screenshot({ path: shot('fam_menu.png') });
  // 保護者メニュー：Googleでログイン→子どもが一覧に出る
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.gIdt = null; KBAPP.act('xm-parent'); }); await p.waitForTimeout(300); await p.click('#g-test'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => /ユウ/.test(document.querySelector('#modal').innerText) && /まだ仕込んでいません/.test(document.querySelector('#modal').innerText)), '保護者メニューに、まもっている子ども（ユウ）が出る');
  await (await p.$('#modal .xm-par')).screenshot({ path: shot('xm_parent.png') });
  // 仕込む（画面から）
  await p.click('#modal [data-act="xm-edit"]'); await p.waitForTimeout(300);
  await p.fill('#xm-msg', 'メリークリスマス！プレゼントは本棚のいちばん上の奥にあるよ。');
  await p.evaluate(() => { const loc = d => { const q = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}T${q(d.getHours())}:${q(d.getMinutes())}`; }; document.querySelector('#xm-st').value = loc(new Date(Date.now() - 120000)); document.querySelector('#xm-en').value = loc(new Date(Date.now() + 3600000)); });
  await (await p.$('#modal .xm-par')).screenshot({ path: shot('xm_edit.png') });
  await p.click('#modal [data-act="xm-save"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => /仕込み済み/.test(document.querySelector('#modal').innerText)), '仕込むと「仕込み済み」');
  // 子ども：メッセージはまだ届かない
  let g = await post('xm_get', { token: me.token, pid: me.pid });
  ok(g.xm && g.xm.msg === null && g.xm.lv === 5, '優勝するまでメッセージはサーバーから届かない');
  ok(!(await post('xm_list', { idt: 'test:u1', pw: 'wrong' })).ok, 'パスワードがちがうと、保護者メニューは開けない');
  ok(!(await post('xm_list', { idt: 'test:other' })).ok, 'ほかのGoogleでは開けない（パスワードもない）');
  await post('fam_auth', { idt: 'test:other', newPw: 'otherpw' });
  ok(!(await post('xm_set', { idt: 'test:other', pw: 'otherpw', k: 'x', msg: 'a', start: 1, end: 2 })).ok, 'まもっていないGoogleでは仕込めない');
  // 開始の3日前から、オンライン大会の一覧に「受付前」で出る
  const L0 = await post('xm_list', { idt: 'test:u1', pw: 'santa2026' }), kk = L0.list[0].k, now = Math.round(Date.now() / 1000);
  await post('xm_set', { idt: 'test:u1', pw: 'santa2026', k: kk, msg: L0.list[0].xm.msg, start: now + 2 * 86400, end: now + 3 * 86400, lv: 5 });
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.xmAt = 0; KBAPP.go('home'); }); await p.waitForTimeout(1800);
  ok(await p.evaluate(() => { const c = document.querySelector('.on-card #xm-card.soon'); return !!c && /開始まで/.test(c.innerText) && !c.querySelector('[data-act="xm-open"]'); }), '3日前から、オンライン大会の一覧に「受付前」（開始までの残り時間）');
  await p.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove())); await (await p.$('#xm-card')).screenshot({ path: shot('xm_card_soon.png') });
  await post('xm_set', { idt: 'test:u1', pw: 'santa2026', k: kk, msg: L0.list[0].xm.msg, start: now - 120, end: now + 3600, lv: 5 });
  // ホームに挑戦状のカード
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.xmAt = 0; KBAPP.go('home'); }); await p.waitForTimeout(2600);
  ok(await p.evaluate(() => !!document.querySelector('.on-card #xm-card [data-act="xm-open"]')), '期間中は、オンライン大会の一覧の「サンタからの挑戦状」からエントリーできる');
  await p.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
  await (await p.$('#xm-card')).screenshot({ path: shot('xm_card.png') });
  // 挑戦：サンタ・カナタ（絶対透視）＋達人3人
  await p.evaluate(() => KBAPP.act('xm-open')); await p.waitForTimeout(300); await (await p.$('#modal .xm-intro')).screenshot({ path: shot('xm_intro.png') });
  await p.evaluate(() => KBAPP.act('xm-go')); await p.waitForTimeout(800);
  let T = await p.evaluate(() => { const T = KBAPP.S.T; return { n: T.players.length, santa: T.players.find(x => x.santa), lv: T.players.filter(x => !x.human && !x.santa).map(x => x.level), xm: T.xmas }; });
  ok(T.n === 5 && T.santa && T.santa.ch.name === 'サンタ？？' && T.santa.ch.acc === 'santa' && T.santa.clairvoyant && T.santa.level === 6 && T.lv.every(l => l === 5), 'サンタ・カナタ（★6・絶対透視）と★5の3人：' + JSON.stringify(T.lv));
  await p.evaluate(() => document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove())); await p.waitForTimeout(400); await p.screenshot({ path: shot('xm_table.png') });
  // 3回負けると手加減
  for (let i = 0; i < 3; i++) g = await post('xm_result', { token: me.token, pid: me.pid, won: false });
  ok(g.xm.losses === 3 && g.xm.msg === null, '負けを3回記録（メッセージはまだ）');
  await p.evaluate(() => { KBAPP.S.T = null; KBAPP.S.xmAt = 0; KBAPP.go('home'); }); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.act('xm-go'); }); await p.waitForTimeout(500);
  T = await p.evaluate(() => { const T = KBAPP.S.T; return { santa: T.players.find(x => x.santa), lv: T.players.filter(x => !x.human && !x.santa).map(x => x.level), easy: T.xmas.easy }; });
  ok(T.easy && !T.santa.clairvoyant && T.lv.every(l => l === 4), '3回負けたあとは手加減（絶対透視なし・3人が★4）');
  // 優勝 → メッセージが届く（別の端末でも同じ）
  g = await post('xm_result', { token: me.token, pid: me.pid, won: true });
  ok(g.xm.won && /本棚/.test(g.xm.msg), '優勝するとメッセージが届く');
  ok(/本棚/.test((await post('xm_get', { token: me.token, pid: me.pid })).xm.msg), 'あとから（別の端末でも）読み直せる');
  // 保護者のテストプレイ：勝ったときの演出
  await p.evaluate(() => { KBAPP.S.T = null; KBAPP.go('home'); document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.xmList = []; KBAPP.act('xm-test'); }); await p.waitForTimeout(300);
  await p.click('#modal [data-act="xm-test-reveal"]'); await p.waitForTimeout(1800);
  ok(await p.evaluate(() => /テスト/.test(document.querySelector('#modal .xm-msg').innerText)), 'テストプレイ：勝ったときの演出を見られる');
  await (await p.$('#modal .xm-reveal')).screenshot({ path: shot('xm_reveal.png') });
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.act('xm-about'); }); await p.waitForTimeout(300);
  await (await p.$('#modal .xm-par')).screenshot({ path: shot('xm_about.png') });
  // パスワードを作り直すと、そのGoogleで仕込んだ挑戦状は消える（子どもが作り直して見る、はできない）
  await post('fam_auth', { idt: 'test:u1', reset: 1 });
  ok((await post('xm_get', { token: me.token, pid: me.pid })).xm === null, 'パスワードを作り直すと、仕込んだ挑戦状は消える');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
