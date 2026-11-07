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
  await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(800);
  await pg.click('[data-act="chart-open"]'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => !!KBAPP.S.paused), '開いている間は対局が止まる');
  const tap = async sel => { await pg.click(sel); await pg.waitForTimeout(60); };
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
  await pg.click('tr[data-crow="26"]'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(__dirname, 'out', 'chart.png') });
  await pg.click('#modal [data-act="close"]'); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => !KBAPP.S.paused), '閉じると対局が再開する');
  ok(await pg.evaluate(() => /早見表を作成（2\//.test(document.body.innerText)), 'ボタンに進み具合が出る');
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
