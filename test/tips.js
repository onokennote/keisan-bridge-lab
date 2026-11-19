// マサの豆知識：全部の豆知識が文になる・式が正しい・アドバイスの下と「次の豆知識」
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const ok = (c, m) => console.log((c ? 'OK  ' : 'NG  ') + m);
  await p.goto('file://' + path.join(__dirname, 'page.html')); await p.waitForTimeout(1000);
  const all = await p.evaluate(() => KBAPP.tipTest.all());
  const flat = [...new Set(all.flat())];
  ok(all.length >= 40 && all.every(v => v.every(s => s && s.length > 20)), `豆知識${all.length}種がどれも文になる（変わる文も入れて${flat.length}通り）`);
  // 式（＝の左右）が正しいか
  const bad = [];
  flat.forEach(s => { (s.match(/[0-9AQKJ()+−×÷]+＝\d+/g) || []).forEach(e => { const [l, r] = e.split('＝'); const js = l.replace(/A/g, '1').replace(/J/g, '11').replace(/Q/g, '12').replace(/K/g, '13').replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/'); if (!/^[0-9+\-*/()]+$/.test(js)) return; const v = Function('return ' + js)(); if (Math.abs(v - +r) > 1e-9) bad.push(e); }); });
  ok(!bad.length, '豆知識の式がすべて正しい ' + bad.join(' '));
  console.log(flat.slice(0, 3).join('\n'));
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.act('host-masa'); }); await p.waitForTimeout(500);
  const t1 = await p.evaluate(() => (document.querySelector('#adv-tip') || {}).innerText || '');
  ok(/マサの豆知識/.test(t1), 'アドバイスの下に豆知識');
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.act('host-masa'); }); await p.waitForTimeout(400);
  const t2 = await p.evaluate(() => document.querySelector('#adv-tip').innerText);
  ok(t2 === t1 && !(await p.$('[data-act="tip-next"]')), '同じ日はいつも同じ豆知識（次へのボタンなし）');
  await p.evaluate(() => { localStorage.setItem('kb.tipDay', JSON.stringify({ d: 'old', s: 'x' })); document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.act('host-masa'); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !/^x$/.test(JSON.parse(localStorage.getItem('kb.tipDay')).s)), '日が変わると新しい豆知識');
  await (await p.$('#modal')).screenshot({ path: path.join(__dirname, 'out/tips_adv.png') });
  ok(/tip-box/.test(await p.evaluate(() => KBAPP.tipTest.wait())), '待ち時間用の豆知識');
  ok(!errs.length, 'エラーなし ' + errs.join('/'));
  await b.close();
})();
