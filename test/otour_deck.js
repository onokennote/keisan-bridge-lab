// 大会をひらく画面の「札の形式」：選んだ札がその大会の卓だけで使われるか（日本語＝ふだんはトランプでも、花札の大会の卓では花札）
// 使い方：cd test && node otour_deck.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbdeck-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8127'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8098"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8098', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8098/api.php KB_STAGING=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8127);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(800);
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8127/'); await p.waitForTimeout(700);
  await p.fill('#new-name', 'ケン'); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; }); await p.evaluate(() => KBAPP.cloudPush()); await p.waitForTimeout(500);
  await p.evaluate(() => KBAPP.go('home')); await p.waitForTimeout(800);
  await p.click('[data-act="on-tour-new"]'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /札の形式/.test(document.querySelector('#modal').innerText) && /花札/.test(document.querySelector('#modal').innerText)), '大会をひらく画面に「札の形式」');
  await p.evaluate(() => { const b = document.querySelector('#modal [data-ot="deck"][data-v="hana"]'); b.click(); }); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#modal [data-ot="deck"]').scrollIntoView({ block: 'center' })); await p.screenshot({ path: path.join(__dirname, 'out', 'ot_deck_set.png') });
  const start = new Date(Date.now() + 10 * 60000); const loc = new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await p.evaluate((loc) => { Object.assign(KBAPP.S.onTour, { name: '花札杯', start: loc, limit: 3, min: 2, max: 10, aiFill: true, aiLv: 2, aiMix: 'even', entry: 'open', sets: 1, games: 1, finalists: 0, pts: 'std' }); document.querySelector('#ot-name').value = '花札杯'; document.querySelector('#ot-start').value = loc; }, loc);
  await p.click('[data-act="on-tour-create"]'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => KBAPP.ON.t && KBAPP.ON.t.deck === 'hana' && /札の形式[\s\S]*花札/.test(document.body.innerText)), '大会の条件に「札の形式 花札」');
  await p.click('[data-act="on-tour-entry"]'); await p.waitForTimeout(800);
  ok(!(await p.evaluate(() => document.documentElement.classList.contains('dk-hana'))), '大会の画面（卓の外）では、ふだんのトランプのまま');
  await p.click('[data-act="on-tour-startnow"]'); await p.waitForTimeout(3500);
  ok(await p.evaluate(() => KBAPP.S.view === 'online' && KBAPP.ON.v.cfg.deck === 'hana'), '卓の設定に札の形式が届く');
  await p.waitForTimeout(2500);
  const n = await p.evaluate(() => document.querySelectorAll('.card.dk-hana').length);
  ok(n > 0 && await p.evaluate(() => document.documentElement.classList.contains('dk-hana')), `日本語でも、花札の大会の卓では花札（${n}枚）`);
  await p.screenshot({ path: path.join(__dirname, 'out', 'ot_deck.png') });
  await p.evaluate(() => { KBAPP.ON.v = null; KBAPP.go('home'); }); await p.waitForTimeout(800);
  ok(await p.evaluate(() => !document.documentElement.classList.contains('dk-hana') && !document.querySelector('.card.dk-hana')), 'ホームに戻るとトランプに戻る');
  ok(!errs.length, 'ページのエラーなし ' + errs.slice(0, 2).join(' / '));
  await b.close(); srv.close(); php.kill(); process.exit();
})();
