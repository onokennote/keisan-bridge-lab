// Googleでまもる（テストのログイン）と、復活の呪文（復活の呪文）の声かけ・リンク。使い方：cd test && node google.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbgoogle-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8128'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8095"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8095', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8095/api.php KB_GOOGLE_TEST=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8128);
const post = (a, body) => fetch('http://localhost:8095/api.php?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), errs = [];
  const ctx = async (url) => { const X = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await X.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(url || 'http://localhost:8128/'); await p.waitForTimeout(900); return p; };
  // A：はじめての画面に「Googleでログインして戻る」
  const pa = await ctx();
  ok(!!(await pa.$('#modal .an-g')), 'はじめての名前の画面に「Googleでログインして戻る」');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'g_askname.png') });
  await pa.fill('#new-name', 'ケン'); await pa.click('[data-act="create-profile"]'); await pa.waitForTimeout(1500);
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; KBAPP.testAch('win', 7); }); await pa.evaluate(() => KBAPP.cloudPush()); await pa.waitForTimeout(600);
  const code = await pa.evaluate(() => KBAPP.plLink(JSON.parse(localStorage.getItem('kb.profile'))).code);
  ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code || ''), '復活の呪文がある：' + code);
  // 復活の呪文：3ゲーム遊んだらマサが声をかける
  await pa.evaluate(() => { const g = KBAPP.G(); g.cnt.games = 3; localStorage.setItem('kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.growth', JSON.stringify(g)); KBAPP.S.backupShown = false; KBAPP.go('home'); }); await pa.waitForTimeout(2200);
  ok(await pa.evaluate(c => { const m = document.querySelector('#modal .bk-card'); return !!m && m.innerText.includes(c); }, code), '3ゲームでマサが「復活の呪文」を控えるよう声をかける（コードのカード）');
  ok(!!(await pa.$('#modal [data-act="g-protect"]')), '声かけの中に「Googleでまもる」');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'g_backup.png') });
  await pa.click('#modal [data-act="bk-done"]'); await pa.waitForTimeout(300);
  await pa.evaluate(() => { KBAPP.S.backupShown = false; KBAPP.go('home'); }); await pa.waitForTimeout(2000);
  ok(!(await pa.$('#modal .bk-card')), '「控えた」を押すと、もう声をかけない');
  // Googleでまもる（プレイヤーの画面から）
  await pa.evaluate(() => KBAPP.act('profiles')); await pa.waitForTimeout(300);
  ok(!!(await pa.$('#modal [data-act="g-protect"]')), 'プレイヤーの画面に「Googleでまもる」');
  await pa.click('#modal [data-act="g-protect"]'); await pa.waitForTimeout(300);
  await pa.screenshot({ path: path.join(__dirname, 'out', 'g_signin.png') });
  await pa.click('#g-test'); await pa.waitForTimeout(800);
  const st = await pa.evaluate(() => { const l = KBAPP.plLink(JSON.parse(localStorage.getItem('kb.profile'))); return fetch(KBAPP.cloud().CLOUD_ON ? window.KB_CLOUD_API + '?a=g_status' : '', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: l.token, pid: JSON.parse(localStorage.getItem('kb.profile')) }) }).then(r => r.json()); });
  ok(st.ok && st.linked, 'Googleでまもると、サーバーにひもづく');
  await pa.evaluate(() => KBAPP.act('profiles')); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => /Googleでまもっています/.test(document.querySelector('#modal').innerText)), 'プレイヤーの画面に「Googleでまもっています」');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'g_panel.png') });
  // B：別の端末（データを消したあと）：Googleでログインして戻る
  const pb = await ctx();
  await pb.click('#modal .an-g'); await pb.waitForTimeout(300); await pb.click('#g-test'); await pb.waitForTimeout(800);
  ok(await pb.evaluate(() => [...document.querySelectorAll('#modal .g-pick')].some(x => /ケン/.test(x.innerText))), 'Googleでログインすると、まもっているプレイヤー（ケン）が出る');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'g_list.png') });
  await pb.click('#modal .g-pick'); await pb.waitForTimeout(2500);
  const rb = await pb.evaluate(() => { const id = JSON.parse(localStorage.getItem('kb.profile')); return { name: KBAPP.S.settings.name, win: JSON.parse(localStorage.getItem('kb.p.' + id + '.growth') || '{}').cnt?.win, linked: JSON.parse(localStorage.getItem('kb.p.' + id + '.glinked') || 'false') }; });
  ok(rb.name === 'ケン' && rb.win === 7 && rb.linked, '選ぶと、ケンの記録でこの端末でも遊べる：' + JSON.stringify(rb));
  // ほかのGoogle・まちがった指定
  const o = await post('g_list', { idt: 'test:other' }); ok(o.ok && o.list.length === 0, 'ほかのGoogleアカウントには出ない');
  const bad = await post('g_restore', { idt: 'test:other', k: 'x' }); ok(!bad.ok, 'まもっていないGoogleでは入れない');
  const bad2 = await post('g_list', { idt: 'abc' }); ok(!bad2.ok, 'でたらめなトークンは通らない');
  // C：呪文のリンク（#code=）で開くと、コードの欄に入っている
  const pc = await ctx('http://localhost:8128/#code=' + code.replace(/-/g, '')); await pc.waitForTimeout(800);
  ok(await pc.evaluate(c => { const i = document.querySelector('#an-code'); return !!i && i.value === c; }, code), '呪文のリンクで開くと、コードが入っている');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
