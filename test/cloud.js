// クラウド保存とランキングの通しテスト：server/api.php を PHP の内蔵サーバーで動かし、公開版（dist/index.html）をつなぐ
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
  // AI研究員：ランキングに「AI」の印つきで並び、ボタンで外せる（はじめはON）。鍵がないと書き込めない
  const aiPost = (a, body) => fetch('http://localhost:8099/api.php?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  ok(!(await aiPost('ai_save', { key: 'wrong-key-000000000', cid: 'zero', data: {}, stats: {} })).ok, '鍵が違うとAI研究員は書き込めない');
  ok((await aiPost('ai_save', { key: 'test-admin-key-0123456789', cid: 'zero', data: { 'kb.x': '1' }, stats: { name: 'ゼロ', rating: 5.2, badges: 30, bp: 9000, atk: 0, streak: 40, bio: '「静かなる天才」テスト', card: { ach: [] } } })).ok, '鍵があればAI研究員を保存できる');
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.rank = null; KBAPP.go('home'); KBAPP.go('ranking'); }); await pa.waitForTimeout(1800);
  ok(await pa.evaluate(() => [...document.querySelectorAll('.rk-row')].some(r => /ゼロ/.test(r.innerText) && r.querySelector('.ai-chip')) && /ON/.test(document.querySelector('[data-act="rank-ai"]').innerText)), 'ランキングにAI研究員が「AI」の印つきで出る（はじめはON）');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rank_ai.png') });
  await pa.click('[data-act="rank-ai"]'); await pa.waitForTimeout(1800);
  ok(await pa.evaluate(() => ![...document.querySelectorAll('.rk-row')].some(r => /ゼロ/.test(r.innerText)) && /OFF/.test(document.querySelector('[data-act="rank-ai"]').innerText)), 'ボタンでAI研究員を外せる');
  await pa.click('[data-act="rank-ai"]'); await pa.waitForTimeout(1500);
  await pa.evaluate(() => { KBAPP.S.homeRank = null; KBAPP.go('home'); }); await pa.waitForTimeout(1500);
  ok(await pa.evaluate(() => [...document.querySelectorAll('.title .cast .cast-p')].some(b => /ゼロ/.test(b.title) && /AI研究員/.test(b.title)) && !document.querySelector('.title .cast .cast-p i')), 'タイトルの6人にはAI研究員も入る（順位の数字は出さない）');
  ok(await pa.evaluate(() => /総合/.test((document.querySelector('#pb-rank') || {}).textContent || '') && /AI込み/.test(document.querySelector('#pb-rank').textContent) && /人だけ/.test(document.querySelector('#pb-rank').textContent)), 'ホームのプロフィールに総合の順位（AI込み・人だけ）：' + await pa.evaluate(() => (document.querySelector('#pb-rank') || {}).textContent));
  await (await pa.$('.player-bar')).screenshot({ path: path.join(__dirname, 'out', 'pb_rank.png') });
  // タイトルの6人：BP上位でアバターを作った人がいれば並ぶ（押すと成績カード）
  ok(await pa.evaluate(() => { const r = [...document.querySelectorAll('.title .cast .cast-p')].map(b => +((b.title.match(/総合(\d+)位/) || [])[1] || 0)); return r.length >= 2 && r.every((v, i) => !i || v >= r[i - 1]) && [...document.querySelectorAll('.title .cast .cast-p')].some(b => !/AI研究員/.test(b.title)); }), 'タイトルの6人は人とAIを混ぜて総合の順位どおり');
  await pa.evaluate(() => { localStorage.setItem('kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.avatar', JSON.stringify({ hs: 'bob', shirt: '#3070d0' })); return KBAPP.cloudPush(); });
  await pa.evaluate(() => { KBAPP.S.homeRank = null; KBAPP.go('home'); }); await pa.waitForTimeout(1500);
  ok(await pa.evaluate(() => document.querySelectorAll('.title .cast > *').length === 6 && [...document.querySelectorAll('.title .cast .cast-p')].some(b => !/AI研究員/.test(b.title))), 'アバターを作った人も総合の順位どおりに入る（全部で6人）');
  await (await pa.$('.title')).screenshot({ path: path.join(__dirname, 'out', 'cast_top.png') });
  await pa.evaluate(() => [...document.querySelectorAll('.title .cast .cast-p')].find(b => !/AI研究員/.test(b.title)).click()); await pa.waitForTimeout(2500);
  ok(await pa.evaluate(() => !!document.querySelector('#modal .share-prev img') && /3枚出しの研究中/.test(document.querySelector('#modal .rk-bio').innerText)), 'タイトルのアイコンを押すと成績カードと自己紹介');
  await pa.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
  // 端末B：NGワードの名前のプレイヤー
  const B = await b.newContext(); const pb = await B.newPage(); pb.on('pageerror', e => errs.push(e.message));
  await pb.goto('http://localhost:8124/'); await pb.waitForTimeout(700);
  await pb.fill('#new-name', 'うんこマン'); await pb.click('[data-act="create-profile"]'); await pb.waitForTimeout(1000);
  ok(await pb.evaluate(() => !document.querySelector('#name-err').hidden && /使えません/.test(document.querySelector('#name-err').innerText) && !JSON.parse(localStorage.getItem('kb.profiles') || '[]').length), 'ふさわしくない名前では登録できない');
  await pb.fill('#new-name', 'ｹﾝ'); await pb.click('[data-act="create-profile"]'); await pb.waitForTimeout(1000);
  ok(await pb.evaluate(() => /もう使っています/.test(document.querySelector('#name-err').innerText) && !JSON.parse(localStorage.getItem('kb.profiles') || '[]').length), 'ほかの人が使っている名前（全角半角の違いも同じ）では登録できない');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'name_taken.png') });
  await pb.fill('#new-name', 'ハナ'); await pb.click('[data-act="create-profile"]'); await pb.waitForTimeout(1500);
  ok(await pb.evaluate(() => JSON.parse(localStorage.getItem('kb.profiles') || '[]').some(p => p.name === 'ハナ')), 'まだ使われていない名前なら登録できる');
  // 画面を通さずに使われている名前に変えても、サーバーが「研究員○○」にする
  await pb.evaluate(() => { const L = JSON.parse(localStorage.getItem('kb.profiles')); L[0].name = 'ケン'; localStorage.setItem('kb.profiles', JSON.stringify(L)); });
  await pb.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.testAch('win', 30); document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); return KBAPP.cloudPush(); }); await pb.waitForTimeout(500);
  await pb.evaluate(() => KBAPP.go('ranking')); await pb.waitForTimeout(1800);
  const names = await pb.evaluate(() => [...document.querySelectorAll('.rk-nm')].map(e => e.innerText));
  ok(names.some(n => /^研究員/.test(n)) && !names.some(n => /うんこ/.test(n)), '使われている名前に勝手に変えると「研究員○○」と表示：' + names.join(' / '));
  // ランキングでアイコンを押すと、その人の成績カードと自己紹介
  await pb.evaluate(() => [...document.querySelectorAll('.rk-row')].find(r => /ケン/.test(r.innerText)).querySelector('[data-act="rank-card"]').click()); await pb.waitForTimeout(2500);
  ok(await pb.evaluate(() => !!document.querySelector('#modal .share-prev img') && /3枚出しの研究中/.test(document.querySelector('#modal .rk-bio').innerText)), 'ほかの人のアイコンを押すと成績カードと自己紹介が出る');
  ok(await pb.evaluate(() => /ケン/.test((document.querySelector('#modal .rk-hero b') || {}).textContent || '') && !!document.querySelector('#modal .rk-hero svg')), '成績カードの上に、アイコンと名前が大きく出る');
  await pb.waitForTimeout(1500); ok(await pb.evaluate(() => /AI込み\d+位/.test(((document.querySelector('#modal .rk-hero-rk') || {}).textContent || '').replace(/\s/g, '')) && /人だけ\d+位/.test(document.querySelector('#modal .rk-hero-rk').textContent.replace(/\s/g, ''))), '成績カードに総合の順位（AI込み・人だけ）：' + await pb.evaluate(() => (document.querySelector('#modal .rk-hero-rk') || {}).textContent));
  await pb.screenshot({ path: path.join(__dirname, 'out', 'rank_card.png') });
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
  // 同じ端末の2人目：ランキングの「あなた」は今プレイしているプレイヤーだけ
  await pc.close().catch(() => { }); // 端末Cはここで閉じる（あとから保存して、Aの記録を上書きしないように）
  await pa.evaluate(() => { document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove()); KBAPP.go('home'); KBAPP.act('new-profile'); });
  await pa.fill('#new-name', 'ジロウ'); await pa.click('[data-act="create-profile"]');
  await pa.waitForFunction(() => KBAPP.S.settings.name === 'ジロウ', null, { timeout: 8000 }); await pa.waitForTimeout(500); // 名前の確認（サーバー）を待つ
  await settle(pa, () => { document.querySelectorAll('#modal,.whistle-ov,.ach-toast').forEach(e => e.remove()); KBAPP.testAch('win', 5); return KBAPP.cloudPush(); });
  // ほかの端末の新しい記録を読み込むと開き直しになることがあるので、ランキングが出るまで開き直す
  for (let k = 0; k < 6; k++) { await pa.evaluate(() => { document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); KBAPP.S.rank = null; KBAPP.go('ranking'); }).catch(() => { }); await pa.waitForTimeout(1800); if (await pa.evaluate(() => KBAPP.S.view === 'ranking' && document.querySelectorAll('.rk-sec .rk-row').length > 0).catch(() => false)) break; }
  const meRows = await pa.evaluate(() => [...document.querySelectorAll('.rk-sec')].find(e => /バッジ数/.test(e.querySelector('h2').innerText)).querySelectorAll('.rk-row').length ? [...[...document.querySelectorAll('.rk-sec')].find(e => /バッジ数/.test(e.querySelector('h2').innerText)).querySelectorAll('.rk-row')].map(r => r.querySelector('.rk-nm').innerText.replace(/\s+/g, '')) : []);
  ok(meRows.some(n => n === 'ジロウあなた') && meRows.some(n => n === 'ケン'), '「あなた」は今のプレイヤー（ジロウ）だけ、同じ端末のケンは名前だけ：' + meRows.join(' / '));
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rank_me.png') });
  // アーティファクト版（file://）ではクラウドは動かない
  const D = await b.newContext(); const pd = await D.newPage(); await pd.goto('file://' + path.join(__dirname, 'page.html')); await pd.waitForTimeout(500);
  ok(await pd.evaluate(() => !KBAPP.cloud().CLOUD_ON && !document.querySelector('[data-go="ranking"]')), 'アーティファクト版ではクラウド・ランキングは出ない');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill();
  execSync('./deploy.sh', { cwd: root }); // 元に戻す（APIなしの公開版）
})();
