// 判定（AIの読み・最善手・損失）の自動チェック。`./build.sh` のあと test/ で `node judge.js`（quick で短く）
// A. 読みの性質：明らかに良い手（上がる確率が高く・期待PPが低く・期待順位が上）が、目的の値（セット期待点・決勝進出率など）で負けないこと。
//    上がれる手は上がる確率100%。目的の値は得点の表の範囲に入ること。いろいろな局面・点差・残りゲーム数・得点の表で確かめる
// B. 記録の性質：アプリを実際に打たせ（AIの読みを見る・見てすぐ打つ・選んで評価・待った も混ぜる）、記録された判定に矛盾がないこと
//    （最善より上回っているのに損失がある・最善と自分の手で逆転・練習の得点の表が10・8・5・2・0でない など）
// C. 安定性：同じ局面を2回読んで、最善手が「最善扱いの幅」を超えて入れ替わる割合（多すぎると判定がくじ引きになる）
// 失敗した局面は out/judge_fail.json に再現できる形で残す。1つでも失敗があれば終了コード1
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const QUICK = process.argv.includes('quick'), SELF = process.argv.includes('selftest'); // selftest：わざと壊した得点の表（1位0点）を混ぜて、チェックが引っかけられるか確かめる
const N_POS = QUICK ? 80 : 240, N_STEPS = QUICK ? 900 : 3000, N_STAB = QUICK ? 15 : 50;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(__dirname, 'page.html')); await pg.waitForTimeout(600);
  const fails = [], notes = [];
  const fail = (kind, info) => { fails.push(Object.assign({ kind }, info)); };

  // ---------- A. 読みの性質 ----------
  const A = await pg.evaluate(({ N, SELF }) => {
    let seed = 12345; const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
    const TABLES = SELF ? [[0, 8, 5, 2, 0]] : [[10, 8, 5, 2, 0], [10, 5, 2, 0, 0], [4, 3, 2, 1, 0], [1, 0, 0, 0, 0], [1, 1, 0.6, 0.2, 0]];
    const out = { n: 0, pairs: 0, bad: [], outBad: [], rangeBad: [] };
    for (let k = 0; k < N; k++) {
      const n = ri(3, 5), hs = ri(2, 7), hand = new Array(14).fill(0); for (let i = 0; i < hs; i++) hand[ri(1, 13)]++;
      for (let v = 1; v <= 13; v++) hand[v] = Math.min(hand[v], 4);
      const field = ri(1, 13); const cands = KB.candidates(hand, field, 8); if (cands.length < 2) continue;
      const sizes = [KB.nCounts(hand)]; for (let p = 1; p < n; p++) sizes.push(ri(1, 7));
      const discard = []; for (let i = 0; i < ri(0, 14); i++) discard.push(ri(1, 13));
      const tbl = TABLES[ri(0, TABLES.length - 1)].slice(0, n); const gm = Math.max(...tbl) || 1;
      const setPP = [0]; for (let p = 1; p < n; p++) setPP.push(ri(0, 60)); setPP[0] = ri(0, 60);
      const ctx = { setPP, gamesLeftAfter: ri(0, 4), sd: 9, mean: 10, goalTable: tbl };
      const view = { constraints: [], models: [...Array(n)].map(() => ({ level: ri(1, 5), style: 'keisan' })), me: 0, hands: [hand].concat([...Array(n - 1)].map(() => null)), handSizes: sizes, deckSize: ri(5, 30), discard, field, order: [...Array(n)].map((_, i) => i), pos: 0 };
      const ev = KB.evaluate(view, cands.concat([null]), 1600, ctx); out.n++;
      const full = ev.filter(e => e.n >= 300);
      for (const e of ev) {
        if (e.m && KB.nCounts(hand) === e.m.n && e.win < 0.999) out.outBad.push({ k, m: e.m.expr, win: e.win });
        if (e.goal < Math.min(...tbl) - 1e-9 || e.goal > gm + 1e-9) out.rangeBad.push({ k, m: e.m ? e.m.expr : '引く', goal: e.goal, tbl });
      }
      // 明らかに良い手 A（上がる確率+8%以上・期待PP−3以上・期待順位−0.2以上）が、目的の値で 5%（表の最大に対して）より大きく負けていないか
      for (const a of full) for (const c of full) {
        if (a === c) continue;
        if (a.win >= c.win + 0.08 && a.pp <= c.pp - 3 && a.rank <= c.rank - 0.2) {
          out.pairs++;
          if ((c.goal - a.goal) / gm > 0.05) { // 2手だけ同じ乱数でたっぷり読み直して確かめる
            const cf = KB.evaluate(view, [a.m, c.m], 3000, ctx);
            if ((cf[1].goal - cf[0].goal) / gm > 0.03 && cf[0].win >= cf[1].win + 0.05 && cf[0].pp <= cf[1].pp - 2)
              out.bad.push({ k, a: a.m ? a.m.expr : '引く', c: c.m ? c.m.expr : '引く', ga: cf[0].goal, gc: cf[1].goal, wa: cf[0].win, wc: cf[1].win, pa: cf[0].pp, pc: cf[1].pp, view, ctx });
          }
        }
      }
    }
    return out;
  }, { N: N_POS, SELF });
  A.bad.forEach(x => fail('読み：良い手が目的の値で負ける', x)); A.outBad.forEach(x => fail('読み：上がれる手の上がる確率が100%でない', x)); A.rangeBad.forEach(x => fail('読み：目的の値が得点の表の範囲外', x));
  notes.push(`A 読み：局面${A.n}・比べた組${A.pairs}・逆転${A.bad.length}`);

  if (SELF) { console.log(notes.join('\n')); console.log(A.bad.length ? `OK 自己テスト：壊した表で逆転を${A.bad.length}件見つけました` : 'NG 自己テスト：壊した表なのに逆転を見つけられませんでした'); await b.close(); process.exit(A.bad.length ? 0 : 1); }
  // ---------- C. 安定性 ----------
  const C = await pg.evaluate(({ N }) => {
    let seed = 777; const r = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const ri = (a, b) => a + Math.floor(r() * (b - a + 1)); let n = 0, flip = 0;
    for (let k = 0; k < N; k++) {
      const hand = new Array(14).fill(0); for (let i = 0; i < ri(3, 7); i++) hand[ri(1, 13)]++;
      const field = ri(1, 13), cands = KB.candidates(hand, field, 8); if (cands.length < 3) continue;
      const view = { constraints: [], models: [0, 1, 2, 3].map(() => ({ level: 3, style: 'keisan' })), me: 0, hands: [hand, null, null, null], handSizes: [KB.nCounts(hand), ri(2, 7), ri(2, 7), ri(2, 7)], deckSize: 20, discard: [], field, order: [0, 1, 2, 3], pos: 0 };
      const ctx = { setPP: [0, 0, 0, 0], gamesLeftAfter: 2, sd: 9, mean: 10, goalTable: [10, 8, 5, 2] };
      const sc = e => e.goal / 10 + 0.06 * e.win - 0.06 * e.pp / 30;
      const e1 = KB.evaluate(view, cands.concat([null]), 1600, ctx), e2 = KB.evaluate(view, cands.concat([null]), 1600, ctx);
      const b1 = e1.slice().sort((x, y) => sc(y) - sc(x))[0], b2 = e2.slice().sort((x, y) => sc(y) - sc(x))[0];
      n++;
      const key = e => e.m ? e.m.key : 'draw';
      if (key(b1) !== key(b2)) { const cf = KB.evaluate(view, [b1.m, b2.m], 3000, ctx); if (Math.abs(sc(cf[0]) - sc(cf[1])) > 0.015) flip++; }
    }
    return { n, flip };
  }, { N: N_STAB });
  const flipRate = C.n ? C.flip / C.n : 0;
  notes.push(`C 安定性：局面${C.n}・最善が幅を超えて入れ替わった ${C.flip}（${Math.round(flipRate * 100)}%）`);
  if (flipRate > 0.15) fail('安定性：最善手が読み直すたびに入れ替わりすぎる', { flip: C.flip, n: C.n });

  // ---------- B. 記録の性質（アプリを実際に打たせる） ----------
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'instant'; window.__dec = []; });
  await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(400);
  for (let step = 0; step < N_STEPS; step++) {
    const st = await pg.evaluate(() => {
      const S = KBAPP.S; const wk = document.querySelector('[data-act="win-ok"]'); if (wk) { wk.click(); return 'm'; }
      const md = document.querySelector('#modal'); if (md) { const bb = md.querySelector('[data-act="next-game"],[data-act="win-ok"]'); if (bb) { window.__dec.push(...(S.decisions || []).map(d => ({ d, pts: S.T.cfg.points.slice(), kind: S.T.cfg.kind }))); bb.click(); return 'm'; } md.remove(); return 'm'; }
      if (S.view === 'set-end') { KBAPP.go('setup-practice'); setTimeout(() => document.querySelector('[data-act="start-practice"]').click(), 50); return 's'; }
      const g = S.game; if (!g || g.over) return 'w'; const p = g.current(); if (p < 0 || !g.players[p].human) return 'ai';
      const ms = KB.findMoves(g.counts(p), g.field.v, 'all', 3); if (!ms.length) { document.querySelector('[data-act="draw"]').click(); return 'd'; }
      if (S.undoSnap && Math.random() < 0.15 && !window.__ju) { window.__ju = 1; KBAPP.act('undo-go'); return 'undo'; } window.__ju = 0;
      // 打つ手：AIの見立てで上位3つから（人が迷う接戦を多くする）。ときどき引く
      let mv = ms[Math.floor(Math.random() * ms.length)];
      { const cs = KB.candidates(g.counts(p), g.field.v, 6); const q = KB.evaluate(g.view(p, true), cs, 300, null).sort((a, b) => a.pp - b.pp); const pk = q[Math.min(q.length - 1, Math.floor(Math.random() * 3))]; if (pk && pk.m) mv = pk.m; }
      const play = () => { if (Math.random() < 0.08) { KBAPP.act('draw'); return; } const hand = g.hands[p].slice(); S.sel = []; for (const v of mv.vals) { const c = hand.find(c => c.v === v && !S.sel.includes(c.id)); S.sel.push(c.id); } KBAPP.act('play'); };
      const r = Math.random();
      if (r < 0.2) { KBAPP.act('hint'); play(); return 'race'; }
      if (r < 0.45) { if (!S.hint) { KBAPP.act('hint'); return 'h'; } if (S.hint.busy) return 'h';
        if (!window.__em && Math.random() < 0.5) { window.__em = 1; const hand = g.hands[p].slice(); S.sel = []; for (const v of mv.vals) { const c = hand.find(c => c.v === v && !S.sel.includes(c.id)); S.sel.push(c.id); } KBAPP.act(Math.random() < 0.7 ? 'eval-mine' : 'hint-more'); return 'h'; } window.__em = 0; play(); return 'hp'; }
      play(); return 'p';
    });
    await pg.waitForTimeout(st === 'undo' ? 2600 : st === 'h' ? 200 : 15);
  }
  const D = await pg.evaluate(() => window.__dec.map(({ d, pts, kind }) => ({ pts, kind, hand: d.hand, t: d.t, mine: d.mine, best: d.best, loss: d.loss, near: d.near, gm: d.goalMax,
    b: d.bestStats && { g: d.bestStats.goal, w: d.bestStats.win, p: d.bestStats.pp, r: d.bestStats.rank, s: d.bestStats.score }, m: d.mineStats && { g: d.mineStats.goal, w: d.mineStats.win, p: d.mineStats.pp, r: d.mineStats.rank, s: d.mineStats.score }, sutemi: !!d.sutemi })));
  let nb = 0;
  for (const d of D) {
    if (d.kind === 'practice' && d.pts.join() !== '10,8,5,2,0') fail('記録：練習の得点の表が10・8・5・2・0でない', { pts: d.pts });
    if (d.pts.some((v, i) => i && v > d.pts[i - 1])) fail('記録：得点の表が上の順位ほど高い並びでない', { pts: d.pts });
    if (!d.b || !d.m) continue; nb++;
    const gm = d.gm || 1;
    if (d.loss > 0 && d.m.s >= d.b.s - 1e-9) fail('記録：最善以上の手なのに損失がある', d);
    if (d.loss > 0.015 && d.mine === d.best) fail('記録：最善と同じ手なのに損失がある', d);
    if (d.loss > 0.015 && !d.sutemi && d.m.w >= d.b.w + 0.08 && d.m.p <= d.b.p - 3 && d.m.r <= d.b.r - 0.2 && (d.b.g - d.m.g) / gm > 0.03) fail('記録：自分の手の方が明らかに良いのに、目的の値で負けて損失', d);
  }
  notes.push(`B 記録：判定${nb}`);
  if (errs.length) fail('ページのエラー', { errs: errs.slice(0, 5) });
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out', 'judge_fail.json'), JSON.stringify(fails, null, 1));
  console.log(notes.join('\n'));
  if (fails.length) { console.log(`NG ${fails.length}件（out/judge_fail.json）`); const by = {}; fails.forEach(f => by[f.kind] = (by[f.kind] || 0) + 1); Object.entries(by).forEach(([k, v]) => console.log(`  ${k}：${v}`)); }
  else console.log('OK 判定チェックはすべて通りました');
  await b.close(); process.exit(fails.length ? 1 : 0);
})();
