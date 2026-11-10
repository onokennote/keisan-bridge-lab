// プレイヤーごとの引き継ぎ：前の版（端末まるごと）から移る・プレイヤーの鍵でできないこと。使い方：cd test && node cloud_player.js
// 使い方：cd test && node cloud.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbcloud-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8124']];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true }); fs.writeFileSync(path.join(work, 'data', 'admin_key.txt'), 'test-admin-key-0123456789');
try { execSync('pkill -f "php -S localhost:8099"'); } catch (e) { } // 前回のサーバーが残っていたら止める
const php = spawn('php', ['-S', 'localhost:8099', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8099/api.php ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8124);
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const post = (a, body) => fetch('http://localhost:8099/api.php?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const reg = await post('register', {});
  // 前の版の端末：端末まるごと保存した状態
  const old = { 'kb.profiles': JSON.stringify([{ id: 'pold1', name: 'タロウ', at: 1 }]), 'kb.profile': JSON.stringify('pold1'), 'kb.p.pold1.growth': JSON.stringify({ v: 2, games: [], cnt: { win: 9 }, ach: { 'win:1': 1 } }), 'kb.settings': JSON.stringify({ name: 'タロウ' }) };
  await post('save', { token: reg.token, data: old, at: 1000, base: 0, stats: [{ pid: 'pold1', name: 'タロウ', badges: 1 }] });
  const b = await chromium.launch(), errs = [];
  const mk = async () => { const X = await b.newContext(); await X.addInitScript(([o, c]) => { if (!localStorage.getItem('kb.cloud')) { for (const k in o) localStorage.setItem(k, o[k]); localStorage.setItem('kb.cloud', JSON.stringify(c)); localStorage.setItem('kb.cloudAt', '1000'); } }, [old, { uid: reg.uid, token: reg.token, code: reg.code }]); const p = await X.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto('http://localhost:8124/'); await p.waitForTimeout(3000); return p; };
  const p1 = await mk();
  const s1 = await p1.evaluate(() => ({ l: KBAPP.plLink('pold1'), prof: JSON.parse(localStorage.getItem('kb.profiles')).map(p => p.name).join(), name: KBAPP.S.settings.name }));
  ok(s1.l && /^[A-Z2-9]{4}-/.test(s1.l.code || '') && s1.prof === 'タロウ', '前の版の端末を開くと、プレイヤーごとのコードができる：' + JSON.stringify(s1));
  await p1.evaluate(() => { KBAPP.testAch('win', 20); return KBAPP.cloudPush(); }); await p1.waitForTimeout(800);
  // 前の版で同じ記録を複製していた端末2：開くとタロウの新しい記録になる
  const p2 = await mk(); await p2.waitForTimeout(2000);
  const w2 = await p2.evaluate(() => JSON.parse(localStorage.getItem('kb.p.pold1.growth')).cnt.win);
  ok(w2 === 20, '前の版で複製していた端末も、同じプレイヤーとして新しい記録になる：' + w2);
  // 前の版のコードで新しい端末に入る
  const r = await post('p_restore', { code: reg.code }); ok(r.ok && r.pid === 'pold1', '前の版のコード（プレイヤー1人）で入れる');
  // プレイヤーの鍵では、ほかのプレイヤーや端末の記録は書けない
  const bad = await post('p_save', { token: r.token, pid: 'pother', data: {}, at: Date.now(), base: 0 }); ok(!bad.ok, 'プレイヤーの鍵で、ほかのプレイヤーは書けない');
  const bad2 = await post('save', { token: r.token, data: {}, at: Date.now(), base: 0 }); ok(!bad2.ok, 'プレイヤーの鍵で、端末まるごとの保存はできない');
  const bad3 = await post('p_del', { token: r.token, pid: 'pold1' }); ok(!bad3.ok, 'プレイヤーの鍵では消せない');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
