// カナタの絶対透視の読み：①出せる手はぜんぶ比べる ②この巡でカナタのあとの誰かが場で出し切れると見えたら、いちばん重く札を切る。使い方：cd test && node kanata_clear.js
const { chromium } = require('playwright'); const path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, 'page.html')); await p.waitForTimeout(500);
  const r = await p.evaluate(() => {
    const mk = (id, lv, cl) => ({ human: false, level: lv, style: 'keisan', ch: { name: id }, clairvoyant: !!cl });
    const C = v => ({ v, s: 0, id: Math.random() });
    const setup = (hands, field, deckVals) => { const g = new KB.Game([mk('kanata', 6, 1), mk('a', 3), mk('b', 3), mk('c', 3)], 0); g.hands = hands.map(h => h.map(C)); g.field = C(field); g.deck = deckVals.map(C); g.discard = []; g.pos = 0; g.order = [0, 1, 2, 3]; return g; };
    const out = {};
    // ① カナタの番（先頭）・場7。次のaは「3と4」で7を作って上がれる → カナタは重い札を切る（13 − 6 = 7 の2枚。合計19）
    let g = setup([[13, 6, 12, 5, 2, 1], [3, 4], [9, 9, 9, 9, 9], [8, 8, 8, 8, 8]], 7, [10, 10, 10, 10, 10, 10]);
    let m = KB.aiMoveClear(g, 0); out.doom = m && m.vals.slice().sort((a, b) => a - b).join(',');
    const sums = KB.findMoves(g.counts(0), 7, 'all', 3).map(x => x.vals.reduce((a, b) => a + b, 0)); out.maxSum = Math.max(...sums); out.mySum = m ? m.vals.reduce((a, b) => a + b, 0) : 0;
    // ② だれも上がれない局面では、ふつうに全部の手を読む（時間も見る）
    g = setup([[13, 6, 12, 5, 2, 1, 11], [3, 4, 9, 10, 12], [9, 9, 2, 9, 9], [8, 8, 1, 8, 8]], 7, [10, 4, 6, 10, 2, 10, 3, 11, 13]);
    const t0 = performance.now(); m = KB.aiMoveClear(g, 0); out.ms = Math.round(performance.now() - t0); out.normal = m ? m.expr : 'draw';
    // ③ カナタがこの巡の最後・場7・次の場は山札のいちばん上の3。手札 12・9・5・2 → 「5 + 2」なら残り 12・9 が次の場3（12 − 9）で出し切れる
    g = setup([[12, 9, 5, 2], [13, 13, 11, 10, 9, 8], [13, 12, 11, 10, 9, 8], [13, 12, 11, 10, 8, 6]], 7, [10, 10, 10, 10, 10, 3]);
    g.order = [1, 2, 3, 0]; g.pos = 3; m = KB.aiMoveClear(g, 0); out.look = m ? m.vals.slice().sort((a, b) => a - b).join(',') : 'draw';
    return out;
  });
  ok(r.look === '2,5', `この巡の最後なら、次の場（山札のいちばん上）で出し切れる形を残す（選んだ札 ${r.look}）`);
  ok(r.mySum === r.maxSum, `次のプレイヤーが上がれると見えたら、いちばん重く切る（選んだ札 ${r.doom}・合計${r.mySum}／出せる最大${r.maxSum}）`);
  ok(r.ms < 4000, `ふつうの局面は全部の手を読む（${r.normal}・${r.ms}ミリ秒）`);
  ok(!errs.length, 'ページのエラーなし ' + errs.join(' / '));
  await b.close();
})();
