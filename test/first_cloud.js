// 使い方：node first_cloud.js（ふつう）／ node first_cloud.js slow（名前の確認の返事が来ないとき）
// クラウド版で、はじめての人の流れ（名前→はじめまして→閉じる）。本物の人と同じ（自動テスト扱いにしない）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbfr-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8142'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8112"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8112', '-t', work], { stdio: 'ignore' });
execSync('./build.sh >/dev/null && KB_CLOUD_API=http://localhost:8112/api.php KB_GOOGLE_TEST=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8142);
const shot = n => path.join(__dirname, 'out', n);
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), errs = [];
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await p.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => false }); });
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const st = () => p.evaluate(() => { const m = document.querySelector('#modal'); return m ? m.innerText.replace(/\s+/g, ' ').slice(0, 60) : null; });
  if (process.argv[2] === 'slow') await p.route(/a=name/, async r => { await new Promise(z => setTimeout(z, 60000)); r.continue().catch(() => {}); }); // 名前の確認の返事が来ない
  await p.goto('http://localhost:8142/'); await p.waitForTimeout(2000);
  console.log('最初:', await st());
  await p.fill('#new-name', 'ハジメ'); await p.click('[data-act="create-profile"]');
  for (let i = 0; i < 8; i++) { await p.waitForTimeout(700); console.log((i + 1) * 0.7 + '秒:', await st()); }
  await p.screenshot({ path: shot('fc_1.png') });
  const sk = await p.$('#modal [data-act="tut-skip"]'); if (sk) await sk.click(); await p.waitForTimeout(2000);
  console.log('知ってる のあと:', await st());
  const cl = await p.$('#modal [data-act="close"]'); if (cl) await cl.click(); 
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(1000); console.log('はじめる +' + (i + 1) + '秒:', await st()); }
  await p.screenshot({ path: shot('fc_2.png') });
  const last = await st();
  ok(process.argv[2] === 'slow' ? !/ようこそ！ あなたの名前/.test(last || '') : !last, process.argv[2] === 'slow' ? '名前の確認の返事が来なくても、6秒で先へ進む' : 'はじめまして→知ってる→はじめる で閉じる');
  ok(!errs.length, 'エラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
