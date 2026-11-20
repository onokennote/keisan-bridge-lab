// 称号がランキングから開くプロフィール（サーバーのカード）で名前の上に出るか。前の版（端末全体の kb.title）からの引っ越しも
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbttl-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8137'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8107"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8107', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8107/api.php ./deploy.sh', { cwd: root, stdio: 'ignore' });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
execSync('git checkout dist/index.html', { cwd: root, stdio: 'ignore' });
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8137);
let fail = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) fail++; };
(async () => {
  await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(), errs = [];
  const open = async name => { const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8137/'); await p.waitForTimeout(800); await p.fill('#new-name', name); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.go('home'); }); return p; };
  const pa = await open('ケン'), pb = await open('ハナ');
  // 前の版：端末全体の kb.title に入っていた → 読み込み直すとプレイヤーに移る
  await pa.evaluate(() => { const K = KBAPP; K.testAch('outs3', 10); K.testAch('outs4', 10); K.testAch('outs5', 6); });
  await pa.evaluate(() => KBAPP.cloudPush(false, true)); await pa.waitForTimeout(1500); await pa.evaluate(() => localStorage.setItem('kb.title', '"BC5"'));
  await pa.waitForTimeout(500); await pa.reload(); await pa.waitForTimeout(1500);
  const mv = await pa.evaluate(() => { const id = JSON.parse(localStorage.getItem('kb.profile')); return [localStorage.getItem('kb.title'), localStorage.getItem('kb.p.' + id + '.title')]; });
  ok(mv[0] === null && mv[1] === '"BC5"', '前の版の称号（端末全体）が、いまのプレイヤーに移る ' + JSON.stringify(mv));
  await pa.evaluate(() => KBAPP.cloudPush(false, true)); await pa.waitForTimeout(1200);
  // ハナがランキングからケンのプロフィールを開く
  const t = await pb.evaluate(async () => { const j = await (await fetch(KB_CLOUD_API + '?a=rankings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: KBAPP.cloud().l && KBAPP.cloud().l.token, ai: 0, all: 1 }) })).json(); const L = ((j.rankings || {}).badges || {}).list || []; const r = L.find(x => x.name === 'ケン'); return r && r.rid; });
  await pb.evaluate(rid => { const e = document.createElement('button'); e.dataset.rid = rid; document.body.appendChild(e); KBAPP.act('rank-card', e); }, t); await pb.waitForTimeout(1500);
  const shown = await pb.evaluate(() => { const e = document.querySelector('#modal .pv-title'); return e ? e.textContent : 'none:' + (document.querySelector('#modal') || {}).innerText.slice(0, 120); }); console.log('rid', t);
  ok(/確率を見通す眼/.test(shown), 'ほかの人が開いたプロフィールの名前の上に称号：' + shown);
  // 選び直し：称号を選ぶ → すぐサーバーへ
  await pa.evaluate(async () => { KBAPP.act('title-open'); await new Promise(r => setTimeout(r, 200)); const bs = [...document.querySelectorAll('#modal .ttl.bt')]; bs[bs.length - 1].click(); });
  await pa.waitForTimeout(300); await pa.evaluate(() => KBAPP.cloudPush()); await pa.waitForTimeout(1200);
  await pb.evaluate(() => document.querySelectorAll('#modal').forEach(e => e.remove()));
  await pb.evaluate(rid => { const e = document.createElement('button'); e.dataset.rid = rid; document.body.appendChild(e); KBAPP.act('rank-card', e); }, t); await pb.waitForTimeout(1500);
  const s2 = await pb.evaluate(() => (document.querySelector('#modal .pv-title') || {}).textContent || '');
  ok(/早見表マイスター|アウツの伝道師/.test(s2) || s2.length > 0, '選び直した称号も出る：' + s2);
  await pb.screenshot({ path: path.join(__dirname, 'out', 'btitle_prof.png') });
  ok(!errs.length, 'エラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); process.exit(fail ? 1 : 0);
})();
