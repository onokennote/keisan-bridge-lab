// ホームの全体のスクリーンショット（クラウド版・バッジを持つ人）。使い方：cd test && node home_shot.js [名前の頭]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), tag = process.argv[2] || 'home';
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbhome-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8134'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8104"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8104', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8104/api.php ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8134);
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), errs = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8134/'); await p.waitForTimeout(800);
  await p.fill('#new-name', 'ユウ'); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); const k = 'kb.p.' + JSON.parse(localStorage.getItem('kb.profile')) + '.growth', g = KBAPP.G(); Object.assign(g.cnt, { games: 60, practice_set: 8, win: 12, three: 30, quick5: 12, set_win: 3 }); ['games:10', 'games:50', 'practice_set:1', 'practice_set:5', 'win:1', 'win:10', 'three:10', 'quick5:1', 'quick5:10', 'set_win:1'].forEach(x => g.ach[x] = Date.now()); localStorage.setItem(k, JSON.stringify(g)); KBAPP.cloudPush(); });
  await p.waitForTimeout(600);
  if (/on/.test(tag)) await p.evaluate(async () => { const id = JSON.parse(localStorage.getItem('kb.profile')), tk = KBAPP.plLink(id).token, now = Math.round(Date.now() / 1000);
    for (const [n, m] of [['夜のミニ杯', 10], ['ユウ杯', 50], ['週末オープン', 180], ['あしたの大会', 1500]]) await fetch('http://localhost:8104/api.php?a=on_tour_new', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk, pid: id, name: 'ユウ', tname: n, desc: '', startAt: now + m * 60, limit: 30, min: 2, max: 15, aiFill: true, aiLv: 2, aiMix: 'even', entry: 'open', sets: 2, games: 3, finalists: 0, points: [10, 8, 5, 2, 0], waitMin: 5 }) }).then(r => r.json()).then(j => j.ok || console.log(j.error)); });
  await p.evaluate(() => { KBAPP.ON.toursAt = 0; KBAPP.go('home'); }); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.screenshot({ path: path.join(__dirname, 'out', tag + '_full.png'), fullPage: true });
  if (/on/.test(tag)) { const oc = await p.$('#h-online'); if (oc) await oc.screenshot({ path: path.join(__dirname, 'out', tag + '_online.png') }); const ab = await p.$('[data-act="on-all"]'); if (ab) { await ab.click(); await p.waitForTimeout(400); const m = await p.$('#modal .on-allpop'); if (m) await m.screenshot({ path: path.join(__dirname, 'out', tag + '_all.png') }); await p.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove())); } }
  const pop = await p.$('.mt-bdg'); if (pop) { await pop.click(); await p.waitForTimeout(400); const m = await p.$('#modal .mb-popup'); if (m) await m.screenshot({ path: path.join(__dirname, 'out', tag + '_pop.png') });
    const bd = await p.$('#modal [data-bdg]'); if (bd) { await bd.click(); await p.waitForTimeout(300); console.log('back btn', await p.evaluate(() => (document.querySelector('#modal [data-act="adv-back"]') || {}).textContent)); await p.click('#modal [data-act="adv-back"]'); await p.waitForTimeout(300); console.log('back to popup', await p.evaluate(() => !!document.querySelector('#modal .mb-popup'))); } }
  console.log('height', h, 'errors', errs);
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
