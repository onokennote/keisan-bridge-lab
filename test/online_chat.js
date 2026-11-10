// オンライン対局のひとこと：スタンプ・自由入力・NGワード・連投の制限・ふきだし
// 使い方：cd test && node online_chat.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbochat-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8128'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8094"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8094', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8094/api.php KB_STAGING=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8128);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(800);
  const b = await chromium.launch(), errs = [];
  const open = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://localhost:8128/'); await p.waitForTimeout(700);
    await p.fill('#new-name', name); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; KBAPP.go('home'); }); await p.waitForTimeout(300);
    return p;
  };
  const pa = await open('ケン'), pb = await open('ユイ');
  await pa.evaluate(() => { KBAPP.S.onCfg = { n: 3, games: 2, limit: 60, judge: 'after3' }; KBAPP.act('on-create'); }); await pa.waitForTimeout(1200);
  const code = await pa.evaluate(() => KBAPP.ON.v.id);
  await pb.evaluate(() => { const d = document.querySelector('.on-free'); if (d) d.open = true; }); await pb.fill('#on-code', code); await pb.click('[data-act="on-join"]'); await pb.waitForTimeout(1500);
  await pa.click('[data-act="on-begin"]'); await pa.waitForTimeout(5000); await pb.waitForTimeout(500);
  await pa.evaluate(() => document.querySelectorAll('.whistle-ov,.on-open,.op-ov').forEach(e => e.remove()));
  ok(!!(await pa.$('[data-act="on-chat"]')), '対局画面に 💬 ボタン');
  await pa.click('[data-act="on-chat"]'); await pa.waitForTimeout(300);
  await pa.screenshot({ path: path.join(__dirname, 'out', 'chat_modal.png') });
  await pa.click('#modal [data-onstamp="よろしく！"]'); await pa.waitForTimeout(400);
  ok(await pa.evaluate(() => (KBAPP.ON.v.chat || []).some(c => c.t === 'よろしく！')), 'スタンプを押すと送れる');
  await pa.click('[data-act="on-chat"]'); await pa.waitForTimeout(150); await pa.fill('#on-chat-in', 'がんばろう'); await pa.click('#modal [data-act="on-chat-send"]'); await pa.waitForTimeout(300);
  ok(await pa.evaluate(() => /少し待って/.test(document.body.innerText)) && !(await pa.evaluate(() => KBAPP.ON.v.chat.some(c => c.t === 'がんばろう'))), '続けて送ると「少し待って」（連投の制限）');
  await pb.waitForTimeout(1800);
  ok(await pb.evaluate(() => [...document.querySelectorAll('.seat .bubble')].some(e => /よろしく/.test(e.textContent))), '相手の画面で、その人の席にふきだしで出る');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'chat_bubble.png') });
  await pa.waitForTimeout(1000); await pa.click('#modal [data-act="on-chat-send"]'); await pa.waitForTimeout(400);
  ok(await pa.evaluate(() => KBAPP.ON.v.chat.some(c => c.t === 'がんばろう')), '自由に入れたひとことも送れる');
  ok(await pa.evaluate(() => !!document.querySelector('.me-bub') && /がんばろう/.test(document.querySelector('.me-bub').textContent)), '自分の席にもふきだし');
  await pa.screenshot({ path: path.join(__dirname, 'out', 'chat_me.png') });
  await pb.waitForTimeout(600); await pb.click('[data-act="on-chat"]'); await pb.waitForTimeout(200); await pb.fill('#on-chat-in', 'おまえバカだな'); await pb.click('#modal [data-act="on-chat-send"]'); await pb.waitForTimeout(400);
  ok(await pb.evaluate(() => /その言葉は使えません/.test(document.body.innerText) && !KBAPP.ON.v.chat.some(c => /バカ/.test(c.t))), 'ふさわしくない言葉は送れない');
  await pb.fill('#on-chat-in', 'www.example.com'); await pb.waitForTimeout(2600); await pb.click('#modal [data-act="on-chat-send"]'); await pb.waitForTimeout(400);
  ok(await pb.evaluate(() => !KBAPP.ON.v.chat.some(c => /example/.test(c.t))), 'URLは送れない');
  await pb.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove())); await pb.waitForTimeout(1600); await pb.click('[data-act="on-chat"]'); await pb.waitForTimeout(300);
  ok(await pb.evaluate(() => /がんばろう/.test((document.querySelector('#modal .on-chat-log') || {}).textContent || '')), '💬 の画面に最近のひとこと');
  await pb.screenshot({ path: path.join(__dirname, 'out', 'chat_log.png') });
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
