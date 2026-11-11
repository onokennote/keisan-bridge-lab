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
  await pa.screenshot({ path: path.join(__dirname, 'out', 'host_masa2.png') });
  await pa.evaluate(() => KBAPP.cloudPush(false, true)); await pb.evaluate(() => { KBAPP.testAch('win', 12); KBAPP.testAch('three', 70); document.querySelectorAll('#modal,.ach-toast').forEach(e => e.remove()); return KBAPP.cloudPush(false, true); }); await pa.waitForTimeout(600);
  // ランキングでハナを押して「ライバルにする」
  await pa.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.rank = null; KBAPP.go('ranking'); }); await pa.waitForTimeout(1800);
  await pa.evaluate(() => [...document.querySelectorAll('.rk-row')].find(r => /ハナ/.test(r.innerText)).click()); await pa.waitForTimeout(1500);
  ok(!!(await pa.$('#modal [data-act="rival-toggle"]')), 'ほかの人のプロフィールに「⚔ ライバルにする」');
  await pa.click('#modal [data-act="rival-toggle"]'); await pa.waitForTimeout(800);
  ok(await pa.evaluate(() => /ライバルから外す/.test(document.querySelector('#modal [data-act="rival-toggle"]').innerText)), '押すとライバルになる（ボタンが「外す」に変わる）');
  await pa.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove())); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => [...document.querySelectorAll('.rk-row')].some(r => /ハナ/.test(r.innerText) && r.querySelector('.rv-chip'))), 'ランキングのライバルに ⚔ の印');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rival_rank.png') });
  // マサ → ライバルと比較
  await pa.evaluate(() => { KBAPP.go('home'); KBAPP.act('host-masa'); }); await pa.waitForTimeout(300); await pa.click('#modal [data-act="masa-rival"]'); await pa.waitForTimeout(300);
  await pa.click('#modal [data-act="rival-cmp"]'); await pa.waitForTimeout(1200);
  const cmp = await pa.evaluate(() => document.querySelector('#modal').innerText);
  ok(/BP/.test(cmp) && /推定実力/.test(cmp) && /逆転|差|リード/.test(cmp), 'ライバルと比較：表とかんたんな対策が出る');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'rival_cmp.png') });
  // ハナの自分のプロフィールに「ケンからライバルに指定されています」
  await pb.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); const el = document.createElement('div'); el.dataset.me = '1'; KBAPP.act('rank-card', el); }); await pb.waitForTimeout(2000);
  ok(await pb.evaluate(() => /ケンさんからライバルに指定されています/.test((document.querySelector('#modal .pv-rival') || {}).textContent || '')), '指定された人のプロフィールに「ケンさんからライバルに指定されています」');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'rival_by.png') });
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
