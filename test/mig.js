// 引っ越し（アーティファクト版 → 公開版）の通しテスト。./build.sh と ./deploy.sh のあとに node mig.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const root = path.join(__dirname, '..');
const art = fs.readFileSync(path.join(root, 'dist/artifact.html'), 'utf8').replace('const MIGRATE_ON = false', 'const MIGRATE_ON = true');
fs.writeFileSync(path.join(__dirname, 'page_mig.html'), '<!doctype html><html><head><meta charset="utf-8"><script>window.KB_TEST=1</script></head><body>' + art + '</body></html>');
const pub = fs.readFileSync(path.join(root, 'dist/index.html'));
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(pub); }).listen(8123);
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  // 送る側（アーティファクト版）：2人分の記録を作る
  await pg.goto('file://' + path.join(__dirname, 'page_mig.html'));
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('kb.profiles', JSON.stringify([{ id: 'pA', name: 'ケン', at: 1 }, { id: 'pB', name: 'ハナ', at: 2 }])); localStorage.setItem('kb.profile', '"pA"'); localStorage.setItem('kb.p.pA.growth', JSON.stringify({ games: 12, cnt: { win: 3 } })); localStorage.setItem('kb.p.pB.zukan', JSON.stringify({ mk: 12 })); localStorage.setItem('kb.p.pA.avatar', JSON.stringify({ hs: 'bob' })); localStorage.setItem('kb.recentLines', '{}'); });
  await pg.reload(); await pg.waitForTimeout(400);
  ok(await pg.$('[data-act="migrate-out"]'), 'ホームに「新しいサイトへ移る」ボタンがある（フラグON）');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'mig_home.png') });
  await pg.click('[data-act="migrate-out"]'); await pg.waitForSelector('#mig-go');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'mig_modal.png') });
  const href = await pg.getAttribute('#mig-go', 'href');
  ok(href.startsWith('https://keisan-bridge.lolipop-now.app/#kbmove='), '公開版URLの#にデータが入る（長さ ' + href.length + '）');
  const local = href.replace('https://keisan-bridge.lolipop-now.app/', 'http://localhost:8123/');
  // 受け取る側（公開版）：空の状態で開く
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto('http://localhost:8123/'); await p2.evaluate(() => localStorage.clear());
  await p2.goto('about:blank'); await p2.goto(local); await p2.waitForTimeout(1500);
  const st = await p2.evaluate(() => ({ hash: location.hash, prof: JSON.parse(localStorage.getItem('kb.profiles') || '[]').map(p => p.name), g: localStorage.getItem('kb.p.pB.zukan'), gA: localStorage.getItem('kb.p.pA.growth'), recent: localStorage.getItem('kb.recentLines') }));
  ok(st.hash === '', 'URLから#が消える');
  ok(st.prof.join() === 'ケン,ハナ', '全プレイヤーが引き継がれる：' + st.prof.join());
  ok(st.g && JSON.parse(st.g).mk === 12, '2人目の図鑑が引き継がれる'); ok(!!st.gA, '1人目の成長記録が引き継がれる');
  ok(!st.recent, '実況の重複よけ（kb.recentLines）は送らない');
  await p2.screenshot({ path: path.join(__dirname, 'out', 'mig_after.png') });
  // 同じURLをもう一度開く → 二重取り込みしない
  await p2.evaluate(() => localStorage.setItem('kb.p.pB.zukan', JSON.stringify({ mk: 99 })));
  await p2.goto('about:blank'); await p2.goto(local); await p2.waitForTimeout(1200);
  ok(JSON.parse(await p2.evaluate(() => localStorage.getItem('kb.p.pB.zukan'))).mk === 99, '同じデータは二度取り込まない');
  // 送る側で記録を変えて、もう一度送る → 記録があるので確認が出る
  await pg.click('[data-act="close"]').catch(() => { });
  await pg.evaluate(() => localStorage.setItem('kb.p.pB.zukan', JSON.stringify({ mk: 20 })));
  await pg.click('[data-act="migrate-out"]'); await pg.waitForSelector('#mig-go');
  const href2 = (await pg.getAttribute('#mig-go', 'href')).replace('https://keisan-bridge.lolipop-now.app/', 'http://localhost:8123/');
  await p2.goto('about:blank'); await p2.goto(href2); await p2.waitForSelector('#mig-yes', { timeout: 5000 });
  await p2.screenshot({ path: path.join(__dirname, 'out', 'mig_confirm.png') });
  ok(true, '記録があるときは上書きの確認が出る');
  await p2.click('#mig-no'); await p2.waitForTimeout(300);
  ok(JSON.parse(await p2.evaluate(() => localStorage.getItem('kb.p.pB.zukan'))).mk === 99, '「引き継がない」なら今の記録のまま');
  await pg.click('[data-act="close"]').catch(() => { });
  await pg.click('[data-act="migrate-out"]'); await pg.waitForSelector('#mig-go');
  const href3 = (await pg.getAttribute('#mig-go', 'href')).replace('https://keisan-bridge.lolipop-now.app/', 'http://localhost:8123/');
  await p2.goto('about:blank'); await p2.goto(href3); await p2.waitForSelector('#mig-yes'); await p2.click('#mig-yes'); await p2.waitForTimeout(1500);
  ok(JSON.parse(await p2.evaluate(() => localStorage.getItem('kb.p.pB.zukan'))).mk === 20, '「上書きして引き継ぐ」で前のサイトの記録になる');
  ok(await p2.evaluate(() => location.hash === ''), '上書き後もURLに#は残らない');
  // いまのビルド（アーティファクト版）ではボタンが出る
  const p3 = await ctx.newPage(); await p3.goto('file://' + path.join(__dirname, 'page.html')); await p3.waitForTimeout(400);
  await p3.evaluate(() => { localStorage.setItem('kb.profiles', JSON.stringify([{ id: 'pA', name: 'ケン', at: 1 }])); localStorage.setItem('kb.profile', '"pA"'); }); await p3.reload(); await p3.waitForTimeout(400);
  ok(!!(await p3.$('[data-act="migrate-out"]')), '引っ越しボタンが有効（アーティファクト版のホームに出る）');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close(); srv.close();
})();
