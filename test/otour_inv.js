// 招待だけの大会：招待する人を名前でさがす・最近いっしょだった人から選ぶ（チップで外せる）
// 使い方：cd test && node otour_inv.js（php が必要）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbotinv-'));
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['http://localhost:8127'], 'test' => true];");
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8095"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8095', '-t', work], { stdio: 'ignore' });
execSync('KB_CLOUD_API=http://localhost:8095/api.php KB_STAGING=1 ./deploy.sh', { cwd: root });
const page = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page); }).listen(8127);
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(800);
  const b = await chromium.launch(), errs = [];
  const open = async (name) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://localhost:8127/'); await p.waitForTimeout(700);
    await p.fill('#new-name', name); await p.click('[data-act="create-profile"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.S.settings.sndLv = 'off'; }); await p.evaluate(() => KBAPP.cloudPush(false, true)); await p.waitForTimeout(500);
    await p.evaluate(() => KBAPP.go('home')); await p.waitForTimeout(500);
    return p;
  };
  const api = (p, a, extra) => p.evaluate(async ([a, extra]) => { const l = KBAPP.cloud().l; const body = Object.assign({ token: l.token, pid: JSON.parse(localStorage.getItem('kb.profile')), name: KBAPP.S.settings.name }, extra); return (await fetch(KB_CLOUD_API + '?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }, [a, extra]);
  const pa = await open('ケン'), pb = await open('ハナコ'), pc = await open('ハナオ'), pd = await open('ジロウ');
  // ケンがひらいた大会にハナコがエントリー（「最近いっしょだった人」になる）
  const t0 = await api(pa, 'on_tour_new', { tname: '前の大会', startAt: Math.round(Date.now() / 1000) + 600, limit: 30, min: 2, max: 10, aiFill: true, aiMix: 'even', entry: 'open', sets: 1, games: 1, finalists: 0 });
  await api(pb, 'on_tour_act', { id: t0.tour.id, act: 'entry' });
  // 大会をひらく画面で「招待した人だけ」
  await pa.click('[data-act="on-tour-new"]'); await pa.waitForTimeout(300);
  await pa.click('#modal [data-ot="entry"][data-v="invite"]'); await pa.waitForTimeout(1200);
  const recent = await pa.evaluate(() => [...document.querySelectorAll('#ot-inv-res .inv-p')].map(e => e.innerText.replace(/\s+/g, ' ')));
  ok(recent.length === 1 && /ハナコ/.test(recent[0]) && /大会でいっしょ/.test(recent[0]), '名前を入れる前は、最近の大会でいっしょだった人が並ぶ：' + recent.join(' / '));
  await pa.click('#ot-inv-q'); await pa.keyboard.type('はな'); await pa.waitForTimeout(1000);
  const found = await pa.evaluate(() => [...document.querySelectorAll('#ot-inv-res .inv-p:not(.raw) .inv-nm')].map(e => e.firstChild.textContent));
  ok(found.includes('ハナコ') && found.includes('ハナオ') && !found.includes('ジロウ') && !found.includes('ケン'), '名前でさがせる（ひらがなでもカタカナの名前が出る・自分は出ない）：' + found.join(' / '));
  await pa.screenshot({ path: path.join(__dirname, 'out', 'inv_search.png') });
  await pa.evaluate(() => [...document.querySelectorAll('#ot-inv-res .inv-p')].find(e => /ハナオ/.test(e.innerText)).click()); await pa.waitForTimeout(200);
  await pa.fill('#ot-inv-q', ''); await pa.dispatchEvent('#ot-inv-q', 'input'); await pa.waitForTimeout(300);
  await pa.evaluate(() => [...document.querySelectorAll('#ot-inv-res .inv-p')].find(e => /ハナコ/.test(e.innerText)).click()); await pa.waitForTimeout(200);
  // ランキングにない名前もそのまま（Enter）
  await pa.click('#ot-inv-q'); await pa.keyboard.type('ミライ'); await pa.waitForTimeout(800); await pa.keyboard.press('Enter'); await pa.waitForTimeout(300);
  let chips = await pa.evaluate(() => [...document.querySelectorAll('#ot-inv-chips .inv-chip')].map(e => e.firstChild.textContent));
  ok(chips.join() === 'ハナオ,ハナコ,ミライ', '押した人がチップで並ぶ（Enterで名前をそのまま加えられる）：' + chips.join());
  await pa.screenshot({ path: path.join(__dirname, 'out', 'inv_chips.png') });
  await pa.evaluate(() => [...document.querySelectorAll('#ot-inv-chips .inv-chip')].find(e => /ミライ/.test(e.innerText)).querySelector('button').click()); await pa.waitForTimeout(200);
  chips = await pa.evaluate(() => [...document.querySelectorAll('#ot-inv-chips .inv-chip')].map(e => e.firstChild.textContent));
  ok(chips.join() === 'ハナオ,ハナコ', '×で外せる');
  // ほかの設定を変えても選んだ人は残る
  await pa.click('#modal [data-ot="limit"][data-v="15"]'); await pa.waitForTimeout(800);
  chips = await pa.evaluate(() => [...document.querySelectorAll('#ot-inv-chips .inv-chip')].map(e => e.firstChild.textContent));
  ok(chips.join() === 'ハナオ,ハナコ', 'ほかの設定を変えても、選んだ人は残る');
  // ＋−を押しても、スクロールの位置はそのまま（一番上に戻らない）
  const sc = () => pa.evaluate(() => { const bg = document.querySelector('#modal'), m = bg.querySelector('.modal'); return Math.max(bg.scrollTop, m.scrollTop); });
  await pa.evaluate(() => document.querySelector('#modal [data-otn="sets"][data-v="1"]').scrollIntoView({ block: 'center' })); await pa.waitForTimeout(200);
  const s0 = await sc(); await pa.click('#modal [data-otn="sets"][data-v="1"]'); await pa.waitForTimeout(300); const s1 = await sc();
  ok(s0 > 100 && Math.abs(s1 - s0) < 5 && await pa.evaluate(() => KBAPP.S.onTour.sets === 4), `セット数の＋を押しても、スクロールの位置がそのまま（${s0}→${s1}）`);
  await pa.fill('#ot-name', '招待杯'); await pa.click('[data-act="on-tour-create"]'); await pa.waitForTimeout(1000);
  const see = async p => (await api(p, 'on_tours', {})).tours.some(t => t.name === '招待杯');
  ok(await see(pb) && await see(pc) && !(await see(pd)), '選んだ人（ハナコ・ハナオ）にだけ見え、ジロウには見えない');
  await pb.evaluate(() => { KBAPP.ON.toursAt = 0; KBAPP.go('home'); }); await pb.waitForTimeout(1500);
  await (await pb.$('.on-card')).screenshot({ path: path.join(__dirname, 'out', 'on_card.png') });
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close(); php.kill(); execSync('./deploy.sh', { cwd: root });
})();
