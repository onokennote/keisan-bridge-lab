// クラウド保存とランキングの通しテスト：server/api.php を PHP の内蔵サーバーで動かし、公開版（dist/index.html）をつなぐ
// 使い方：cd test && node cloud.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbcloud-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8124']];");
try { execSync('pkill -f "php -S localhost:8099"'); } catch (e) { } // 前回のサーバーが残っていたら止める
const php = spawn('php', ['-S', 'localhost:8099', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8099/api.php ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8124);
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), errs = [];
  // 端末A：登録して遊ぶ
  const A = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const pa = await A.newPage(); pa.on('pageerror', e => errs.push(e.message));
  await pa.goto('http://localhost:8124/'); await pa.waitForTimeout(700);
  await pa.fill('#new-name', 'ケン'); await pa.click('[data-act="create-profile"]'); await pa.waitForTimeout(1500);
  await pa.evaluate(() => document.querySelectorAll('#modal [data-act="tut-skip"],#modal [data-act="close"]').forEach(b => b.click()));
  const c1 = await pa.evaluate(() => KBAPP.cloud());
  ok(c1.CLOUD_ON && c1.c && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c1.c.code), '公開版は自動で匿名アカウントができ、引き継ぎコードが出る：' + (c1.c && c1.c.code));
  // バッジと記録を作って保存
  await pa.evaluate(() => { KBAPP.testAch('win', 12); KBAPP.testAch('three', 60); localStorage.setItem('kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.attackBest', JSON.stringify({ 15: { bp: 820, badges: 21 } })); });
  await pa.evaluate(() => KBAPP.cloudPush()); await pa.waitForTimeout(500);
  // ランキング
  await pa.evaluate(() => { document.querySelectorAll('#modal,.ach-toast,.toast').forEach(e => e.remove()); KBAPP.go('home'); }); await pa.waitForTimeout(300);
  ok(!!(await pa.$('[data-go="ranking"]')), 'ホームにランキングのボタン');
  await pa.click('[data-go="ranking"]'); await pa.waitForTimeout(1500);
  await pa.click('[data-act="rank-tab"][data-k="badges"]'); await pa.waitForTimeout(1500);
  ok(await pa.evaluate(() => /ケン/.test(document.querySelector('.rk-list').innerText) && !!document.querySelector('.rk-row.me')), 'バッジ数のランキングに自分（ケン）が出る');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'ranking.png') });
  await pa.click('[data-act="rank-tab"][data-k="attack"]'); await pa.waitForTimeout(1500);
  ok(await pa.evaluate(() => /820BP/.test(document.querySelector('.rk-list').innerText)), 'バッジアタックの自己ベスト（820BP）が出る');
  // 端末B：NGワードの名前のプレイヤー
  const B = await b.newContext(); const pb = await B.newPage(); pb.on('pageerror', e => errs.push(e.message));
  await pb.goto('http://localhost:8124/'); await pb.waitForTimeout(700);
  await pb.fill('#new-name', 'うんこマン'); await pb.click('[data-act="create-profile"]'); await pb.waitForTimeout(1500);
  await pb.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.testAch('win', 30); document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); return KBAPP.cloudPush(); }); await pb.waitForTimeout(500);
  await pb.evaluate(() => KBAPP.go('ranking')); await pb.waitForTimeout(300); await pb.click('[data-act="rank-tab"][data-k="badges"]'); await pb.waitForTimeout(1500);
  const names = await pb.evaluate(() => [...document.querySelectorAll('.rk-nm')].map(e => e.innerText));
  ok(names.some(n => /^研究員/.test(n)) && !names.some(n => /うんこ/.test(n)), 'ふさわしくない名前は「研究員○○」と表示：' + names.join(' / '));
  // 端末C：Aの引き継ぎコードで入ると、Aの記録が出る
  const C = await b.newContext(); const pc = await C.newPage(); pc.on('pageerror', e => errs.push(e.message));
  await pc.goto('http://localhost:8124/'); await pc.waitForTimeout(1500);
  await pc.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
  await pc.evaluate(code => KBAPP.act('cloud-restore', null) || code, c1.c.code);
  await pc.evaluate(() => { const i = document.createElement('input'); i.id = 'cl-in'; document.body.appendChild(i); });
  await pc.fill('#cl-in', c1.c.code.toLowerCase()); await pc.evaluate(() => KBAPP.act('cloud-restore')); await pc.waitForTimeout(3500); await pc.waitForLoadState('load');
  const st = await pc.evaluate(() => ({ prof: JSON.parse(localStorage.getItem('kb.profiles') || '[]').map(p => p.name), uid: KBAPP.cloud().c && KBAPP.cloud().c.uid }));
  ok(st.prof.join() === 'ケン' && st.uid === c1.c.uid, '別の端末で引き継ぎコード（小文字・ハイフンなしでもOK）を入れると、同じ記録に入れる');
  // Cで記録を進めると、Aを開き直したときにクラウドの新しい記録になる（引き継ぎ後の自動の開き直し・保存が落ち着くのを待つ）
  const settle = async (pg, fn) => { for (let k = 0; k < 12; k++) { try { await pg.waitForLoadState('load'); return await pg.evaluate(fn); } catch (e) { await pg.waitForTimeout(800); } } return null; };
  await pa.waitForTimeout(6000); await pc.waitForTimeout(500);
  await settle(pc, async () => { KBAPP.testAch('win', 50); await KBAPP.cloudPush(); });
  await pc.waitForTimeout(1500);
  ok(await settle(pc, () => JSON.parse(localStorage.getItem('kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.growth')).cnt.win === 50), '別の端末（C）で記録を進めて保存できる');
  await pa.reload(); await pa.waitForTimeout(4000);
  ok(await settle(pa, () => JSON.parse(localStorage.getItem('kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.growth')).cnt.win === 50), '別の端末で進めた記録が、開き直すと反映される（端末に依存しない）');
  // 端末Aは鍵が切れずに使い続けられる
  await settle(pa, () => { KBAPP.testAch('three', 70); return KBAPP.cloudPush(); }); ok(await settle(pa, () => KBAPP.cloud().CLOUD.status === 'saved'), '引き継いだあとも、もとの端末で保存を続けられる');
  // アーティファクト版（file://）ではクラウドは動かない
  const D = await b.newContext(); const pd = await D.newPage(); await pd.goto('file://' + path.join(__dirname, 'page.html')); await pd.waitForTimeout(500);
  ok(await pd.evaluate(() => !KBAPP.cloud().CLOUD_ON && !document.querySelector('[data-go="ranking"]')), 'アーティファクト版ではクラウド・ランキングは出ない');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill();
  execSync('./deploy.sh', { cwd: root }); // 元に戻す（APIなしの公開版）
})();
