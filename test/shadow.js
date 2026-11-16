// シャドー（★1・卓の最強を写す。カナタを写すと絶対透視も）。使い方：cd test && node shadow.js
const { chromium } = require('playwright'); const path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, 'page.html')); await p.waitForTimeout(600);
  const r = await p.evaluate(() => {
    const mk = id => { const c = KB.charById(id); return { human: false, level: c.lv, style: c.st, ch: KB.charToCh(c), peek: !!c.peek, shadow: !!c.shadow, clairvoyant: id === 'kanata' }; };
    const out = {};
    let ps = [{ human: true, level: 3, style: 'keisan', ch: { name: 'me' } }, mk('shadow'), mk('zero'), mk('pochi')];
    let g = new KB.Game(ps, 0); KB.kanataRoll(g); const sh = ps[1];
    out.zero = { lv: sh.level, st: sh.style, peek: sh.peek, cl: sh.clairvoyant, mimic: sh.mimic && sh.mimic.name };
    ps = [{ human: true, level: 3, style: 'keisan', ch: { name: 'me' } }, sh, mk('pochi'), mk('tama')];
    g = new KB.Game(ps, 0); KB.kanataRoll(g);
    out.low = { lv: sh.level, peek: sh.peek, mimic: sh.mimic };
    ps = [{ human: true, level: 3, style: 'keisan', ch: { name: 'me' } }, sh, mk('kanata'), mk('zero')];
    g = new KB.Game(ps, 0); KB.kanataRoll(g);
    out.kan = { lv: sh.level, cl: sh.clairvoyant, mimic: sh.mimic && sh.mimic.name, kidx: g.kanataIdx };
    window.KB_KANATA_AT = 1; out.ready = KB.kanataReady(g, 1); KB.kanataStart(g, 1); out.clear = KB.isClear(g, 1); out.kanataOn = g.kanataOn;
    let n = 0; while (!g.over && n++ < 300) { const q = g.current(); if (KB.kanataReady(g, q)) KB.kanataStart(g, q); g.apply(ps[q].human ? (KB.findMoves(g.counts(q), g.field.v, 'all', 3)[0] || null) : KB.aiMove(g, q)); }
    out.over = g.over; window.KB_KANATA_AT = 0;
    // 自動の卓（autoGame）でも
    const ag = KB.autoGame([mk('shadow'), mk('kanata'), mk('pochi'), mk('tama')], 0); out.auto = ag.over;
    out.inRoster = KB.ROSTER.some(c => c.id === 'shadow');
    return out;
  });
  ok(r.zero.lv === 5 && r.zero.peek && !r.zero.cl && r.zero.mimic === 'ゼロ', 'ゼロ（★5）を写す：強さ・性格・勘 ' + JSON.stringify(r.zero));
  ok(r.low.lv === 1 && !r.low.peek && !r.low.mimic, '★1しかいない卓では★1のまま ' + JSON.stringify(r.low));
  ok(r.kan.lv === 6 && r.kan.cl && r.kan.mimic === 'カナタ' && r.kan.kidx === 2, 'カナタを写すと絶対透視も使える ' + JSON.stringify(r.kan));
  ok(r.ready && r.clear && !r.kanataOn, 'シャドーの絶対透視は、カナタとは別に発動する');
  ok(r.over && r.auto && r.inRoster, '最後まで打てる（自動の卓も）');
  // 画面：シャドーのいる練習
  await p.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); });
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
