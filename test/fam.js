// おうちの人メニューのしかけ：誕生日の挑戦状・成長のおたより・遊ぶ時間の目安・家族大会、特別クエストのバッジ（2026サンタ・2026誕生日）。使い方：cd test && node fam.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbfam-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8132'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8102"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8102', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8102/api.php KB_GOOGLE_TEST=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8132);
const post = (a, body) => fetch('http://localhost:8102/api.php?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
const shot = n => path.join(__dirname, 'out', n);
const clr = p => p.evaluate(() => document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove()));
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), errs = [];
  const X = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await X.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8132/'); await p.waitForTimeout(900);
  await p.fill('#new-name', 'ユウ'); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
  // 成長のおたより用に、ためしの記録（40日分・だんだん上達）と、遊んだ時間
  await p.evaluate(() => {
    document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off';
    const ks = KBAPP.famTest.catKeys(), g = KBAPP.G(), now = Date.now(); let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    g.games = []; for (let i = 0; i < 90; i++) { const at = now - (40 - i * 40 / 90) * 86400000, q = i / 90; g.games.push({ at, k: 'practice', ds: [0, 1, 2].map(r => ({ l: Math.max(0, (rnd() < 0.35 + q * 0.4 ? 0 : rnd() * 0.06) * (r === 2 && i % 3 ? 1.6 : 1)), c: [ks[(i + r) % ks.length]], h: 0, r: r + 1 })), f: 0, won: rnd() < 0.3, pp: 5, n: 4 }); }
    g.cnt.games = 90; g.cnt.rating = 3.6; g.ach['win:1'] = now - 3 * 86400000; g.ach['three:10'] = now - 86400000; g.ach['games:50'] = now - 5 * 86400000; localStorage.setItem('kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.growth', JSON.stringify(g));
    const d = n => new Date(now - n * 86400000).toLocaleDateString('sv-SE'), pl = {}; [25, 40, 0, 75, 30, 50, 65].forEach((m, i) => { if (m) pl[d(6 - i)] = m * 60; }); localStorage.setItem('kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.playSec', JSON.stringify(pl));
  });
  await p.evaluate(() => KBAPP.cloudPush()); await p.waitForTimeout(800);
  await p.evaluate(() => KBAPP.act('g-protect')); await p.waitForTimeout(300); await p.click('#g-test'); await p.waitForTimeout(800);
  const me = await p.evaluate(() => { const id = JSON.parse(localStorage.getItem('kb.profile')); return { token: KBAPP.plLink(id).token, pid: id }; });
  await p.evaluate(() => KBAPP.cloudPush()); await p.waitForTimeout(800);
  await p.evaluate(() => KBAPP.famTest.playPut()); await p.waitForTimeout(600); // 遊んだ時間はふつうの記録とは別に送る
  // おうちの人メニュー
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.gIdt = null; KBAPP.act('fam-menu'); }); await p.waitForTimeout(300);
  await p.click('#g-test'); await p.waitForTimeout(500);
  await p.fill('#fam-pw', 'pw2026'); await p.fill('#fam-pw2', 'pw2026'); await p.click('#fam-ok'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => ['xmas', 'bday', 'report', 'limit', 'family'].every(k => document.querySelector(`#modal [data-fam="${k}"]`))), 'メニューに5つのしかけ（サンタ・誕生日・おたより・遊ぶ時間・家族大会）');
  await (await p.$('#modal .xm-par')).screenshot({ path: shot('fam_menu5.png') });
  // ① 誕生日の挑戦状
  await p.click('#modal [data-fam="bday"]'); await p.waitForTimeout(700);
  ok(await p.evaluate(() => /誕生日の挑戦状/.test(document.querySelector('#modal').innerText) && /パティシエ/.test(document.querySelector('#modal').innerText)), '誕生日の挑戦状の保護者画面');
  await p.click('#modal [data-act="xm-edit"]'); await p.waitForTimeout(300);
  await p.fill('#xm-msg', 'お誕生日おめでとう！ケーキは冷蔵庫のいちばん下の段にかくれているよ。');
  await p.evaluate(() => { const loc = d => { const q = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${q(d.getMonth() + 1)}-${q(d.getDate())}T${q(d.getHours())}:${q(d.getMinutes())}`; }; document.querySelector('#xm-st').value = loc(new Date(Date.now() - 120000)); document.querySelector('#xm-en').value = loc(new Date(Date.now() + 3600000)); });
  await (await p.$('#modal .xm-par')).screenshot({ path: shot('bd_edit.png') });
  await p.click('#modal [data-act="xm-save"]'); await p.waitForTimeout(900);
  ok(await p.evaluate(() => /仕込み済み/.test(document.querySelector('#modal').innerText)), '誕生日の挑戦状を仕込める');
  let g = await post('xm_get', { token: me.token, pid: me.pid });
  ok(g.bd && g.bd.msg === null && g.xm === null, 'サンタとは別に記録（メッセージは優勝するまで届かない）');
  // ③ 成長のおたより
  await p.click('#modal [data-act="fam-back"]'); await p.waitForTimeout(300);
  await p.click('#modal [data-fam="report"]'); await p.waitForTimeout(300);
  await p.click('#modal [data-frep]'); await p.waitForTimeout(1200);
  const rep = await p.evaluate(() => { const m = document.querySelector('#modal .fam-rep'); return m ? m.innerText : ''; });
  ok(/推定実力/.test(rep) && /この1週間に遊んだ時間/.test(rep) && /合計 4時間45分/.test(rep) && /得意/.test(rep) && /最近30日のバッジ/.test(rep) && /博士/.test(rep), '成長のおたより（推定実力・遊んだ時間・得意と伸びしろ・バッジ・博士とマサ）');
  await (await p.$('#modal .fam-rep')).screenshot({ path: shot('fam_report.png') });
  // ④ 遊ぶ時間の目安
  await p.click('#modal [data-act="fam-rep-back"]'); await p.waitForTimeout(200); await p.click('#modal [data-act="fam-back"]'); await p.waitForTimeout(200);
  await p.click('#modal [data-fam="limit"]'); await p.waitForTimeout(300);
  for (let i = 0; i < 4; i++) { await p.click('#modal [data-lim][data-v="15"]'); await p.waitForTimeout(400); }
  ok(await p.evaluate(() => /1日 60分まで/.test(document.querySelector('#modal').innerText)), '15分きざみで決められる（60分）');
  await (await p.$('#modal .xm-par')).screenshot({ path: shot('fam_limit.png') });
  g = await post('xm_get', { token: me.token, pid: me.pid }); ok(g.lim === 60, '子どもの端末に目安が届く（60分）');
  // ⑤ 家族大会
  await p.click('#modal [data-act="fam-back"]'); await p.waitForTimeout(200);
  await p.click('#modal [data-fam="family"]'); await p.waitForTimeout(800);
  const ft = await p.evaluate(() => { const c = KBAPP.S.onTour; return c && { entry: c.entry, name: c.name, fin: c.finalists, modal: !!document.querySelector('#modal .on-new') }; });
  ok(ft && ft.entry === 'invite' && ft.modal && /家族大会/.test(ft.name) && ft.fin === 0, '家族大会：招待だけの大会の設定がすぐ開く ' + JSON.stringify(ft));
  await (await p.$('#modal .on-new')).screenshot({ path: shot('fam_tour.png') });
  ok(await p.evaluate(() => KBAPP.S.famPw === null), '家族大会の画面へ出たら、パスワードは忘れる');
  // 2回目からは、この端末ならパスワードだけ（Googleを省く）
  ok(await p.evaluate(() => !!localStorage.getItem('kb.famDev')), 'Google＋パスワードのあと、この端末を覚える');
  await clr(p); await p.evaluate(() => { KBAPP.S.gIdt = null; KBAPP.S.famCred = null; KBAPP.act('fam-menu'); }); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !document.querySelector('#g-test') && !!document.querySelector('#fam-pw')), '2回目はGoogleなしでパスワードだけ聞く');
  await p.evaluate(() => document.querySelectorAll('.toast').forEach(e => e.remove())); await (await p.$('#modal .xm-par')).screenshot({ path: shot('fam_pwonly.png') });
  await p.fill('#fam-pw', 'xx'); await p.click('#fam-ok'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!document.querySelector('#fam-pw')), 'パスワードがちがえば開かない');
  await p.fill('#fam-pw', 'pw2026'); await p.click('#fam-ok'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !!document.querySelector('#modal [data-fam="report"]') && /この端末の記憶を消す/.test(document.querySelector('#modal').innerText)), 'パスワードだけでメニューが開く（「この端末の記憶を消す」も）');
  await (await p.$('#modal .xm-par')).screenshot({ path: shot('fam_menu_dev.png') });
  await p.click('#modal [data-act="fam-forget"]'); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !localStorage.getItem('kb.famDev')), '記憶を消せる');
  await clr(p); await p.evaluate(() => { KBAPP.S.gIdt = null; KBAPP.S.famCred = null; KBAPP.act('fam-menu'); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('#g-test')), '消したあとはまたGoogleから');
  await p.click('#g-test'); await p.waitForTimeout(500); await p.fill('#fam-pw', 'pw2026'); await p.click('#fam-ok'); await p.waitForTimeout(800);
  const dv = await p.evaluate(() => JSON.parse(localStorage.getItem('kb.famDev')));
  const badL = await post('xm_list', { dev: dv.replace(/.$/, c => c === 'a' ? 'b' : 'a'), pw: 'pw2026' }); ok(!badL.list, 'ちがう合い鍵では読めない');
  const okL = await post('xm_list', { dev: dv, pw: 'pw2026' }); ok(okL.list && okL.list.length > 0, '合い鍵＋パスワードで一覧が読める');
  let nop = 0; try { const r = await post('xm_list', { dev: dv }); nop = r && r.list ? 0 : 1; } catch (e) { nop = 1; } ok(nop, '合い鍵だけ（パスワードなし）では読めない');
  await clr(p);
  // 遊ぶ時間をこえたら、マサがひと声（2回目からは言い方を変える）
  await clr(p); await p.evaluate(() => { const k = 'kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.playSec', pl = JSON.parse(localStorage.getItem(k)); pl[new Date().toLocaleDateString('sv-SE')] = 65 * 60; localStorage.setItem(k, JSON.stringify(pl)); KBAPP.S.xmAt = 0; KBAPP.ON.famLim = 60; KBAPP.S.limAt = 0; KBAPP.famTest.limCheck('game'); }); await p.waitForTimeout(1600);
  const l1 = await p.evaluate(() => { const m = document.querySelector('#modal .lim-modal'); return m ? m.innerText : ''; });
  ok(/今日はここまでにしとこか/.test(l1), '目安をこえると「今日はここまでにしとこか」');
  await (await p.$('#modal .lim-modal')).screenshot({ path: shot('lim1.png') });
  await clr(p); await p.evaluate(() => { KBAPP.S.limAt = 0; KBAPP.famTest.limCheck('home'); }); await p.waitForTimeout(1900);
  const l2 = await p.evaluate(() => { const m = document.querySelector('#modal .lim-modal'); return m ? m.innerText : ''; });
  ok(l2 && l2 !== l1 && /2回目/.test(l2), '2回目は言い方を変える');
  await (await p.$('#modal .lim-modal')).screenshot({ path: shot('lim2.png') });
  await clr(p); await p.evaluate(() => KBAPP.famTest.limCheck('home')); await p.waitForTimeout(1900);
  ok(await p.evaluate(() => !document.querySelector('#modal .lim-modal')), '続けて出しすぎない（3分あける）');
  await p.evaluate(() => { KBAPP.ON.famLim = 0; });
  // 誕生日の挑戦状：ホームのカード→挑戦（謎のパティシエ）
  await clr(p); await p.evaluate(() => { KBAPP.S.xmAt = 0; KBAPP.S.limAt = Date.now(); KBAPP.go('home'); }); await p.waitForTimeout(2600); await clr(p);
  ok(await p.evaluate(() => !!document.querySelector('.on-card #xm-cards .xm-card.bd [data-act="xm-open"][data-xk="bday"]')), 'オンライン大会の一覧に「誕生日の挑戦状」');
  await (await p.$('#xm-cards .xm-card.bd')).screenshot({ path: shot('bd_card.png') });
  await p.click('#xm-cards [data-act="xm-open"]'); await p.waitForTimeout(400);
  await (await p.$('#modal .xm-intro')).screenshot({ path: shot('bd_intro.png') });
  await p.click('#modal [data-act="xm-go"]'); await p.waitForTimeout(900);
  const T = await p.evaluate(() => { const T = KBAPP.S.T, s = T.players.find(x => x.santa); return { n: T.players.length, name: s.ch.name, acc: s.ch.acc, clair: s.clairvoyant, kind: T.xmas.kind }; });
  ok(T.n === 4 && T.name === 'パティシエ？？' && T.acc === 'chef' && T.clair && T.kind === 'bday', '謎のパティシエ（★6・絶対透視・コック帽）と4人で ' + JSON.stringify(T));
  await clr(p); await p.waitForTimeout(400); await p.screenshot({ path: shot('bd_table.png') });
  // 勝つと「2026誕生日」のバッジ（200BP）
  const bp0 = await p.evaluate(() => KBAPP.famTest.bpTotal(KBAPP.G()));
  await post('xm_result', { token: me.token, pid: me.pid, won: true, kind: 'bday' });
  await p.evaluate(() => { KBAPP.S.T = null; KBAPP.S.xmAt = 0; KBAPP.go('home'); }); await p.waitForTimeout(2500);
  const bp1 = await p.evaluate(() => KBAPP.famTest.bpTotal(KBAPP.G())), has = await p.evaluate(() => !!KBAPP.G().ach['sp_bday2026:1']);
  ok(has && bp1 - bp0 === 200, `勝つと特別クエスト「2026誕生日」（+200BP：${bp0}→${bp1}）`);
  ok(await p.evaluate(() => !!document.querySelector('#xm-cards .xm-card.bd.won')), '勝ったあとは「🎁 お誕生日のメッセージ」');
  // サンタも勝つと「2026サンタ」
  const L0 = await post('xm_list', { idt: 'test:u1', pw: 'pw2026' }), now = Math.round(Date.now() / 1000);
  await post('xm_set', { idt: 'test:u1', pw: 'pw2026', k: L0.list[0].k, kind: 'xmas', msg: 'メリークリスマス！', start: now - 60, end: now + 3600, lv: 5 });
  await post('xm_result', { token: me.token, pid: me.pid, won: true, kind: 'xmas' });
  await clr(p); await p.evaluate(() => { KBAPP.S.xmAt = 0; KBAPP.go('home'); }); await p.waitForTimeout(2500);
  ok(await p.evaluate(() => !!KBAPP.G().ach['sp_santa2026:1']), 'サンタに勝つと「2026サンタ」');
  // 成長記録：特別クエストの欄（持っている人だけ）
  await clr(p); await p.evaluate(() => KBAPP.go('growth')); await p.waitForTimeout(500);
  ok(await p.evaluate(() => { const s = document.querySelector('.sp-group'); return !!s && /2026サンタ/.test(s.innerText) && /2026誕生日/.test(s.innerText); }), '成長記録に「🎁 特別クエスト」の欄');
  await (await p.$('.sp-group')).screenshot({ path: shot('sp_badges.png') });
  // 持っていないプレイヤーには出ない
  ok(await p.evaluate(() => { const k = 'kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.growth', s0 = localStorage.getItem(k), g = JSON.parse(s0); delete g.ach['sp_santa2026:1']; delete g.ach['sp_bday2026:1']; localStorage.setItem(k, JSON.stringify(g)); KBAPP.go('growth'); const r = !document.querySelector('.sp-group'); localStorage.setItem(k, s0); return r; }), '持っていなければ特別クエストの欄は出ない');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
