// 公式大会をひらける人（ランキングの名前「おのけん」）：大会をひらく画面に「公式大会」と総ポイント。ほかの人には出ない。使い方：cd test && node otour_official.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kboff-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8133'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8103"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8103', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8103/api.php ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8133);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(800);
  const b = await chromium.launch(), errs = [];
  const open = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://localhost:8133/'); await p.waitForTimeout(700);
    await p.fill('#new-name', name); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; }); await p.evaluate(() => KBAPP.cloudPush()); await p.waitForTimeout(800);
    await p.evaluate(() => { KBAPP.ON.toursAt = 0; KBAPP.go('home'); }); await p.waitForTimeout(1200);
    return p;
  };
  const po = await open('おのけん'), pk = await open('ケン');
  ok(await po.evaluate(() => KBAPP.ON.canOfficial === true), '「おのけん」は公式大会をひらける');
  ok(await pk.evaluate(() => !KBAPP.ON.canOfficial), 'ほかの人はひらけない');
  await po.click('[data-act="on-tour-new"]'); await po.waitForTimeout(300);
  ok(await po.evaluate(() => !!document.querySelector('#modal [data-ot="official"]')), '大会をひらく画面に「公式大会」');
  await po.click('#modal [data-ot="official"][data-v="true"]'); await po.waitForTimeout(300);
  ok(await po.evaluate(() => !!document.querySelector('#ot-tpts')), '公式大会にすると、総ポイントを設定できる');
  await po.fill('#ot-tpts', '120,80,50'); await po.evaluate(() => { const i = document.querySelector('#ot-tpts'); i.dispatchEvent(new Event('input')); });
  await (await po.$('#modal .on-new')).screenshot({ path: path.join(__dirname, 'out', 'ot_official.png') });
  await po.click('[data-act="on-tour-create"]'); await po.waitForTimeout(900);
  const t = await po.evaluate(() => KBAPP.ON.t && { official: KBAPP.ON.t.official, name: KBAPP.ON.t.name });
  ok(t && t.official === true, '公式大会としてひらける ' + JSON.stringify(t));
  await pk.click('[data-act="on-tour-new"]'); await pk.waitForTimeout(300);
  ok(await pk.evaluate(() => !document.querySelector('#modal [data-ot="official"]')), 'ほかの人の画面には「公式大会」が出ない');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
