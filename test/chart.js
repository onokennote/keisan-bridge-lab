// 早見表を作成のテスト：node chart.js
const { chromium } = require('playwright');
const path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(__dirname, 'page.html')); await pg.waitForTimeout(500);
  const men = await pg.evaluate(() => KBAPP.chartMen().map((m, i) => KBAPP.CHART_ROWS[i].length + ':' + m.length));
  ok(men.length === 37 && men.slice(0, 26).every(x => +x.split(':')[1] >= 9) && men.slice(26).every(x => +x.split(':')[1] >= 3), '37行（3枚は9面以上・2枚は3面以上）合計 ' + men.reduce((a, x) => a + +x.split(':')[1], 0) + '面');
  // 作るのはホームから
  await pg.click('[data-act="chart-open"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => /早見表/.test(document.querySelector('.whistle-ov .wh-title').innerText) && /ゲーム中/.test(document.querySelector('.whistle-ov').innerText) && /マサ/.test(document.querySelector('.whistle-ov').innerText)), 'ホームから開くと、マサの導入（ゲーム中に見られること）が出る');
  await pg.waitForTimeout(1500); await pg.screenshot({ path: require('path').join(__dirname, 'out', 'chart_intro.png') });
  await pg.click('.whistle-ov [data-x="e0"]'); await pg.waitForTimeout(500);
  ok(!!(await pg.$('#modal .ch-keys')), 'ホームから開くと入力できる');
  const tap = async sel => { await pg.click(sel); await pg.waitForTimeout(60); };
  // 式として続かないボタンはグレーアウト
  const st = () => pg.evaluate(() => { const d = q => [...document.querySelectorAll(q)].map(b => b.disabled ? 0 : 1).join(''); return { c: d('[data-ckc]'), o: d('[data-cko]'), b: d('[data-ckb],[data-ckclr]') }; });
  let s0 = await st(); ok(s0.c === '111' && s0.o === '00001' && s0.b === '00', '最初は札と「(」だけ押せる（記号・⌫・Cはグレー）：' + JSON.stringify(s0));
  await pg.keyboard.press('+'); ok(await pg.evaluate(() => KBAPP.S.chart.tok.length === 0), 'キーボードでも、式として続かない記号は入らない');
  await tap('[data-ckc="0"]'); s0 = await st(); ok(s0.c === '000' && s0.o === '11110' && s0.b === '11', '札のあとは記号だけ（札と「(」はグレー）：' + JSON.stringify(s0));
  await tap('[data-cko="+"]'); s0 = await st(); ok(s0.c === '011' && s0.o === '00001', '記号のあとは札と「(」（残り2枚なので「(」も可）：' + JSON.stringify(s0));
  await tap('[data-ckc="1"]'); await tap('[data-cko="×"]'); s0 = await st(); ok(s0.c === '001' && s0.o === '00000', '残り1枚のときは「(」もグレー：' + JSON.stringify(s0));
  await tap('[data-ckclr="1"]');
  // A・2・6 の行で (6 − 2) × A = 4。カッコは自動で閉じる
  await tap('[data-cko="("]'); await tap('[data-ckc="2"]'); await tap('[data-cko="−"]'); await tap('[data-ckc="1"]');
  ok(await pg.evaluate(() => /\(6 − 2\)/.test(document.querySelector('.ch-expr').innerText)), 'カッコが自動で閉じる');
  await tap('[data-cko="×"]'); await tap('[data-ckc="0"]'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(__dirname, 'out', 'chart_ok.png') });
  await pg.waitForTimeout(800);
  ok(await pg.evaluate(() => { const c = JSON.parse(Object.entries(localStorage).find(([k]) => /\.chart$/.test(k) || k === 'kb.chart')[1]); return c['1,2,6'] && c['1,2,6'][4] === '(6 − 2) × A'; }), '正しい式で ○ が付き、式が保存される');
  // 割り切れない割り算
  await tap('[data-ckc="0"]'); await tap('[data-cko="÷"]'); await tap('[data-ckc="1"]'); await tap('[data-cko="+"]'); await tap('[data-ckc="2"]');
  ok(await pg.evaluate(() => /割り切れない/.test(document.querySelector('.ch-expr').innerText)), '割り切れない割り算は使えないと出る');
  for (let i = 0; i < 5; i++) await tap('[data-ckb="1"]');
  // キーボード入力：6 + 2 − A = 7
  for (const k of ['6', '+', '2', '-', 'a']) { await pg.keyboard.press(k); await pg.waitForTimeout(60); }
  await pg.waitForTimeout(900);
  ok(await pg.evaluate(() => document.querySelectorAll('tr.on td.ok').length === 2), 'キーボードでも入れられる（○が2つ）');
  // 同じ答えをもう一度
  for (const k of ['6', '+', '2', '-', 'a']) { await pg.keyboard.press(k); await pg.waitForTimeout(60); }
  ok(await pg.evaluate(() => /もう埋まって/.test(document.querySelector('.ch-expr').innerText)), '同じ答えは「もう埋まっています」');
  await pg.waitForTimeout(1000);
  // ヒント：残りの場（A・2・6 の行で2つ埋めたあと）
  await pg.click('[data-chint]'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => /まだの場：/.test(document.querySelector('.ch-hintline').innerText) && document.querySelectorAll('tr.on td.hint').length === 10), '「残りの場」でまだ埋まっていない場（10個）を表示');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'chart_hint.png') });
  ok(await pg.evaluate(() => document.querySelectorAll('tr[data-crow]:not(.on) td.hint').length > 50 && /ON/.test(document.querySelector('[data-chint]').innerText)), '「残りの場」はすべての行で一律にオン（ほかの行にも？が出る）');
  ok(await pg.evaluate(() => [...document.querySelectorAll('tr.ch-sub')].map(r => r.innerText.match(/\d+面待ち/)[0]).join(',') === '12面待ち,11面待ち,10面待ち,9面待ち,4面待ち,3面待ち'), '何面待ちの小見出し（12・11・10・9・4・3面）');
  // クリア：式を途中まで入れて C で全部消える
  await tap('[data-ckc="0"]'); await tap('[data-cko="+"]'); await tap('[data-ckclr="1"]');
  ok(await pg.evaluate(() => /札と記号をタップ/.test(document.querySelector('.ch-expr').innerText)), 'C（クリア）で式が全部消える');
  // ○の長押しでチェック、もう一度長押しで外す
  const cell = 'tr.on td.ok';
  const lp = async () => { const bx = await (await pg.$(cell)).boundingBox(); await pg.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await pg.mouse.down(); await pg.waitForTimeout(650); await pg.mouse.up(); await pg.waitForTimeout(200); };
  await lp();
  ok(await pg.evaluate(() => document.querySelectorAll('tr.on td.ok.mk').length === 1 && Object.keys(JSON.parse(Object.entries(localStorage).find(([k]) => /chartMark$/.test(k))[1])).length === 1), '○を長押しするとチェック（✓）が付いて保存される');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'chart_mark.png') });
  await lp();
  ok(await pg.evaluate(() => document.querySelectorAll('tr.on td.ok.mk').length === 0), 'もう一度長押しでチェックが外れる');
  await lp();
  await pg.click('[data-chint]'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => !document.querySelector('td.hint') && /OFF/.test(document.querySelector('[data-chint]').innerText)), '「残りの場」をもう一度押すと一律にオフ');
  // 2・6 の行（3・4・8・Q）を全部埋めて完成させる
  await pg.click('tr[data-crow="26"]'); await pg.waitForTimeout(200);
  for (const ks of [['6', '/', '2'], ['6', '-', '2'], ['6', '+', '2'], ['6', '*', '2']]) { for (const k of ks) { await pg.keyboard.press(k); await pg.waitForTimeout(50); } await pg.waitForTimeout(900); }
  await pg.screenshot({ path: path.join(__dirname, 'out', 'chart.png') });
  ok(await pg.evaluate(() => { const g = JSON.parse(Object.entries(localStorage).find(([k]) => /growth$/.test(k))[1]); return g.cnt.chart === 1 && !!g.ach['chart:1']; }), '行を完成させるとバッジ「早見表の一行目」が付く');
  await pg.evaluate(() => document.querySelectorAll('.ach-toast,.ach-pop,#achq').forEach(e => e.remove()));
  await pg.click('#modal [data-act="close"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => /6\/279面/.test(document.body.innerText) && /完成 1行/.test(document.body.innerText)), 'ホームのカードに進み具合が出る');
  // 対局中は見るだけ（完成した行だけ）
  await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(800);
  ok(await pg.evaluate(() => /早見表（完成1行）/.test(document.body.innerText)), '対局画面のボタンに完成行数が出る');
  await pg.click('[data-act="chart-view"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => !!KBAPP.S.paused), '開いている間は対局が止まる');
  ok(await pg.evaluate(() => !document.querySelector('#modal .ch-keys') && document.querySelectorAll('#modal tr.full').length === 1 && document.querySelectorAll('#modal td.ok').length === 4), '対局中は入力できず、完成した行（2・6）だけ表示');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'chart_view.png') });
  await pg.click('#modal [data-act="close"]'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => !KBAPP.S.paused), '閉じると対局が再開する');
  // ぜんぶ完成していると、マサが「完成しとる」と言う
  await pg.evaluate(() => { const c = {}; KBAPP.CHART_ROWS.forEach((r, i) => { const d = {}; KBAPP.chartMen()[i].forEach(t => d[t] = 'x'); c[r.join(',')] = d; }); const pid = JSON.parse(localStorage.getItem('kb.profile') || 'null'); localStorage.setItem(pid ? 'kb.p.' + pid + '.chart' : 'kb.chart', JSON.stringify(c)); document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove()); KBAPP.go('home'); });
  await pg.click('[data-act="chart-open"]'); await pg.waitForTimeout(1600);
  ok(await pg.evaluate(() => /完成しとる/.test(document.querySelector('.whistle-ov').innerText) && /すべて完成/.test(document.querySelector('.whistle-ov .wh-sub').innerText)), '完成していれば、マサが完成していると言う');
  await pg.screenshot({ path: path.join(__dirname, 'out', 'chart_intro_done.png') });
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
