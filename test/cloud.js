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
  await pa.evaluate(() => { KBAPP.testAch('win', 12); KBAPP.testAch('three', 60); KBAPP.testAch('streakMax', 7); localStorage.setItem('kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.attackBest', JSON.stringify({ 15: { bp: 820, badges: 21 } })); });
  // 自己紹介を書く（プロフィールから）
  await pa.evaluate(() => { document.querySelectorAll('#modal,.ach-toast,.toast').forEach(e => e.remove()); KBAPP.go('home'); }); await pa.waitForTimeout(300);
  await pa.click('.player-bar [data-act="profiles"]'); await pa.waitForTimeout(300); await pa.click('#modal [data-act="bio-edit"]'); await pa.waitForTimeout(200);
  await pa.fill('#bio-text', '3枚出しの研究中。目標は全員達人の大会で優勝！' + 'あ'.repeat(200));
  ok(await pa.evaluate(() => [...document.querySelector('#bio-text').value].length === 140), '自己紹介は140文字まで');
  await pa.fill('#bio-text', '3枚出しの研究中。目標は全員達人の大会で優勝！'); await pa.click('#modal [data-act="bio-save"]'); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => /3枚出しの研究中/.test(document.querySelector('#modal .pf-bio').innerText)), 'プロフィールに自己紹介が出る');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'bio_profile.png') });
  await pa.evaluate(() => KBAPP.cloudPush()); await pa.waitForTimeout(500);
  // ランキング
  await pa.evaluate(() => { document.querySelectorAll('#modal,.ach-toast,.toast').forEach(e => e.remove()); KBAPP.go('home'); }); await pa.waitForTimeout(300);
  ok(!!(await pa.$('[data-go="ranking"]')), 'ホームにランキングのボタン');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rank_home.png') });
  await pa.click('[data-go="ranking"]'); await pa.waitForTimeout(1500);
  const secs = await pa.evaluate(() => [...document.querySelectorAll('.rk-sec')].map(e => ({ h: e.querySelector('h2').innerText, t: e.querySelector('.rk-list').innerText, me: !!e.querySelector('.rk-row.me') })));
  const sec = h => secs.find(x => x.h.startsWith(h)) || {};
  ok(secs.length === 6 && secs[0].h === '総合', '6つのランキングが全部展開して出る（総合が先頭）：' + secs.map(x => x.h).join(' / '));
  ok(/ケン/.test(sec('バッジ数').t) && sec('バッジ数').me, 'バッジ数のランキングに自分（ケン）が出る');
  ok(/ケン/.test(sec('BP').t) && sec('BP').me, 'BPのランキングに自分（ケン）が出る');
  ok(/ケン/.test(sec('連続最善').t) && /7回/.test(sec('連続最善').t), '連続最善のランキングに自分（7回）が出る');
  ok(/ケン/.test(sec('総合').t) && /\d+\.\d点/.test(sec('総合').t), '総合のランキングに点数つきで出る：' + sec('総合').t.replace(/\s+/g, ' '));
  await pa.screenshot({ path: path.join(__dirname, 'out', 'ranking.png') });
  ok(/820BP/.test(sec('バッジアタック').t), 'バッジアタックの自己ベスト（820BP）が出る');
  // タイトルの6人：BP上位でアバターを作った人がいれば並ぶ（押すと成績カード）
  ok(await pa.evaluate(() => { KBAPP.go('home'); return !document.querySelector('.title .cast .cast-p'); }), 'アバターを作っていない人はタイトルに並ばない');
  await pa.evaluate(() => { localStorage.setItem('kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.avatar', JSON.stringify({ hs: 'bob', shirt: '#3070d0' })); return KBAPP.cloudPush(); });
  await pa.evaluate(() => { KBAPP.S.rank = null; KBAPP.go('ranking'); KBAPP.go('home'); }); await pa.waitForTimeout(1500);
  ok(await pa.evaluate(() => document.querySelectorAll('.title .cast > *').length === 6 && !!document.querySelector('.title .cast .cast-p')), 'BP上位でアバターを作った人がタイトルの6人に入る（全部で6人）');
  await (await pa.$('.title')).screenshot({ path: path.join(__dirname, 'out', 'cast_top.png') });
  await pa.click('.title .cast .cast-p'); await pa.waitForTimeout(2500);
  ok(await pa.evaluate(() => !!document.querySelector('#modal .share-prev img') && /3枚出しの研究中/.test(document.querySelector('#modal .rk-bio').innerText)), 'タイトルのアイコンを押すと成績カードと自己紹介');
  await pa.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
  // 端末B：NGワードの名前のプレイヤー
  const B = await b.newContext(); const pb = await B.newPage(); pb.on('pageerror', e => errs.push(e.message));
  await pb.goto('http://localhost:8124/'); await pb.waitForTimeout(700);
  await pb.fill('#new-name', 'うんこマン'); await pb.click('[data-act="create-profile"]'); await pb.waitForTimeout(1500);
  await pb.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.testAch('win', 30); document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); return KBAPP.cloudPush(); }); await pb.waitForTimeout(500);
  await pb.evaluate(() => KBAPP.go('ranking')); await pb.waitForTimeout(1800);
  const names = await pb.evaluate(() => [...document.querySelectorAll('.rk-nm')].map(e => e.innerText));
  ok(names.some(n => /^研究員/.test(n)) && !names.some(n => /うんこ/.test(n)), 'ふさわしくない名前は「研究員○○」と表示：' + names.join(' / '));
  // ランキングでアイコンを押すと、その人の成績カードと自己紹介
  await pb.evaluate(() => [...document.querySelectorAll('.rk-row')].find(r => /ケン/.test(r.innerText)).querySelector('[data-act="rank-card"]').click()); await pb.waitForTimeout(2500);
  ok(await pb.evaluate(() => !!document.querySelector('#modal .share-prev img') && /3枚出しの研究中/.test(document.querySelector('#modal .rk-bio').innerText)), 'ほかの人のアイコンを押すと成績カードと自己紹介が出る');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'rank_card.png') });
  await pb.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
  await pb.evaluate(() => document.querySelector('.rk-row.me [data-act="rank-card"]').click()); await pb.waitForTimeout(2500);
  ok(await pb.evaluate(() => !!document.querySelector('#modal .share-prev img')), '自分のアイコンを押すと自分の成績カードが出る');
  await pb.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
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
