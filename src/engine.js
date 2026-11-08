// ===== 計算ブリッジ エンジン =====
(function (G) {
'use strict';
const KB = {};

// ---------- RNG ----------
function mulberry(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rnd = Math.random;
KB.seed = s => { rnd = (s == null) ? Math.random : mulberry(s); };
KB.rand = () => rnd();
function shuffle(a, r) { r = r || rnd; for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
KB.shuffle = shuffle;
function gauss(r) { r = r || rnd; let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
KB.gauss = gauss;

KB.vname = v => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[v] || String(v));
const SUITS = ['♠', '♥', '♦', '♣'];
KB.SUITS = SUITS;

// ---------- 到達表（四則＋かっこ自由） ----------
// node: {v, s, p} p: precedence 3=atom 2=*/ 1=+-
const OPSETS = { pm: '+-', pmx: '+-*', all: '+-*/' };
function comb(x, y, op) {
  let v;
  if (op === '+') v = x.v + y.v; else if (op === '-') v = x.v - y.v; else if (op === '*') v = x.v * y.v;
  else { if (y.v === 0 || x.v % y.v !== 0) return null; v = x.v / y.v; }
  const p = (op === '+' || op === '-') ? 1 : 2;
  const ls = x.p < p ? '(' + x.s + ')' : x.s;
  const rs = (y.p < p || (y.p === p && (op === '-' || op === '/'))) ? '(' + y.s + ')' : y.s;
  const sym = { '+': '+', '-': '−', '*': '×', '/': '÷' }[op];
  return { v, s: ls + ' ' + sym + ' ' + rs, p };
}
function allResults(nodes, ops) {
  if (nodes.length === 1) return [nodes[0]];
  const out = [];
  for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) {
    if (i === j) continue;
    const rest = nodes.filter((_, k) => k !== i && k !== j);
    for (const op of ops) {
      if ((op === '+' || op === '*') && i > j) continue;
      const c = comb(nodes[i], nodes[j], op); if (!c) continue;
      for (const r of allResults([c, ...rest], ops)) out.push(r);
    }
  }
  return out;
}
const MOVES = {}; // MOVES[opset][t] = [{vals, expr, n, sum}]
function buildMoves() {
  for (const key of Object.keys(OPSETS)) {
    const ops = OPSETS[key].split('');
    const byT = []; for (let t = 0; t <= 13; t++) byT.push([]);
    const msets = [];
    for (let a = 1; a <= 13; a++) { msets.push([a]); for (let b = a; b <= 13; b++) { msets.push([a, b]); for (let c = b; c <= 13; c++) msets.push([a, b, c]); } }
    for (const m of msets) {
      const best = {};
      for (const r of allResults(m.map(v => ({ v, s: String(v), p: 3 })), ops)) {
        if (r.v < 1 || r.v > 13) continue;
        if (!best[r.v] || r.s.length < best[r.v].length) best[r.v] = r.s;
      }
      const sum = m.reduce((a, b) => a + b, 0);
      for (const t in best) byT[t].push({ vals: m, expr: best[t], n: m.length, sum, key: m.join(',') });
    }
    for (const l of byT) l.sort((x, y) => y.n - x.n || y.sum - x.sum);
    // 思いつきやすさの分類：0=1枚・2枚の足し引き 1=3枚の足し引き 2=掛け算 3=割り算 4=かっこ付き
    for (const l of byT) for (const m of l) m.cls = /[()]/.test(m.expr) ? 4 : m.expr.includes('÷') ? 3 : m.expr.includes('×') ? 2 : m.n === 3 ? 1 : 0;
    MOVES[key] = byT;
  }
}
buildMoves();
KB.MOVES = MOVES;

// counts: Int array[14]
function avail(counts, vals) {
  if (vals.length === 1) return counts[vals[0]] >= 1;
  if (vals.length === 2) return vals[0] === vals[1] ? counts[vals[0]] >= 2 : (counts[vals[0]] >= 1 && counts[vals[1]] >= 1);
  const a = vals[0], b = vals[1], c = vals[2];
  if (a === b && b === c) return counts[a] >= 3;
  if (a === b) return counts[a] >= 2 && counts[c] >= 1;
  if (b === c) return counts[b] >= 2 && counts[a] >= 1;
  return counts[a] >= 1 && counts[b] >= 1 && counts[c] >= 1;
}
function findMoves(counts, t, opset, maxN) {
  const l = MOVES[opset || 'all'][t]; if (!l) return [];
  const out = []; maxN = maxN || 3;
  for (const m of l) if (m.n <= maxN && avail(counts, m.vals)) out.push(m);
  return out;
}
function firstMove(counts, t) { const l = MOVES.all[t]; for (const m of l) if (avail(counts, m.vals)) return m; return null; }
KB.findMoves = findMoves;
KB.evalSelection = function (vals, t) { // vals: array of values selected
  if (!vals.length || vals.length > 3) return null;
  const k = vals.slice().sort((a, b) => a - b).join(',');
  for (const m of MOVES.all[t]) if (m.key === k) return m;
  return null;
};
function countsOf(cards) { const c = new Array(14).fill(0); for (const x of cards) c[x.v !== undefined ? x.v : x]++; return c; }
KB.countsOf = countsOf;
function reachMask(counts) { let m = 0; for (let t = 1; t <= 13; t++) if (firstMove(counts, t)) m |= 1 << t; return m; }
KB.reachMask = reachMask;
function nextPlayableProb(counts, unseen) { // unseen: counts array of unseen values (deck candidates)
  let tot = 0, ok = 0;
  for (let t = 1; t <= 13; t++) { const w = unseen ? unseen[t] : 4; tot += w; if (w && firstMove(counts, t)) ok += w; }
  return tot ? ok / tot : 0;
}
KB.nextPlayableProb = nextPlayableProb;
function sumCounts(c) { let s = 0; for (let v = 1; v <= 13; v++) s += c[v] * v; return s; }
function nCounts(c) { let s = 0; for (let v = 1; v <= 13; v++) s += c[v]; return s; }
KB.sumCounts = sumCounts; KB.nCounts = nCounts;
function sub(counts, vals) { const c = counts.slice(); for (const v of vals) c[v]--; return c; }
KB.sub = sub;

// ---------- 戦略データ（既定） ----------
KB.DEFAULT_STRATEGY = {
  version: 1,
  note: 'AIの性格（戦略モード）と強さ（レベル）の設定。数値を変えると打ち方が変わります。',
  styles: [
    { id: 'gangan', label: 'ガンガンいこうぜ', color: '#d9480f', desc: '枚数を一気に減らして最速の上がりを狙う。', w: { cards: 10, value: 0.25, flex: 2, small: 0, high: 0 }, noise: 0.6, mc: { goal: 0.5, win: 0.5, pp: 0 } },
    { id: 'inochi', label: 'いのちだいじに', color: '#2b8a3e', desc: '大きい札(K,Q,J)を優先して処分し、負けてもPPを小さく抑える。', w: { cards: 4, value: 1.0, flex: 3, small: 0.6, high: 1.5 }, noise: 0.4, mc: { goal: 0.5, win: 0, pp: 0.5 } },
    { id: 'iroiro', label: 'いろいろやろうぜ', color: '#7048e8', desc: '気分で打ち方が変わる。読みにくい。', w: { cards: 6, value: 0.6, flex: 2, small: 0.3, high: 0.5 }, noise: 3.0, mc: { goal: 0.8, win: 0.1, pp: 0.1 } },
    { id: 'keisan', label: 'じっくりけいさん', color: '#1971c2', desc: '枚数・数字の大きさ・次も出せる柔軟さを、大量対戦で調整した重みで判断する理詰め派。', w: { cards: 14, value: 1.2, flex: 9, small: 1.6, high: 0.6 }, noise: 0.3, mc: { goal: 1, win: 0, pp: 0 } }
  ],
  levels: [
    // see：その種類の組み合わせに気づく確率（1枚・2枚の足し引き／3枚の足し引き／掛け算／割り算／かっこ付き）
    { level: 1, label: '入門', ops: 'all', maxCards: 3, miss: 0.08, see: [1, 0.55, 0.4, 0.25, 0.2], mode: 'random', mcRollouts: 0 },
    { level: 2, label: '初級', ops: 'all', maxCards: 3, miss: 0.04, see: [1, 0.85, 0.7, 0.5, 0.45], mode: 'top3', mcRollouts: 0 },
    { level: 3, label: '中級', ops: 'all', maxCards: 3, miss: 0.03, mode: 'heuristic', flexScale: 0, mcRollouts: 0 },
    { level: 4, label: '上級', ops: 'all', maxCards: 3, miss: 0, mode: 'heuristic', flexScale: 1, mcRollouts: 0 },
    { level: 5, label: '達人', ops: 'all', maxCards: 3, miss: 0, mode: 'mc', flexScale: 1, mcRollouts: 360 }
  ]
};
let STRAT = JSON.parse(JSON.stringify(KB.DEFAULT_STRATEGY));
KB.getStrategy = () => STRAT;
KB.setStrategy = s => { STRAT = s; };
KB.validateStrategy = function (s) {
  if (!s || !Array.isArray(s.styles) || !Array.isArray(s.levels)) throw new Error('styles と levels の配列が必要です');
  for (const st of s.styles) {
    if (!st.id || !st.label || !st.w) throw new Error('style には id, label, w が必要です');
    for (const k of ['cards', 'value', 'flex', 'small', 'high']) if (typeof st.w[k] !== 'number') st.w[k] = 0;
    if (typeof st.noise !== 'number') st.noise = 0.5;
    st.mc = Object.assign({ goal: 1, win: 0, pp: 0 }, st.mc || {});
    if (!st.color) st.color = '#868e96';
  }
  for (let i = 1; i <= 5; i++) if (!s.levels.find(l => l.level === i)) throw new Error('levels に level ' + i + ' がありません');
  return s;
};
KB.style = id => STRAT.styles.find(s => s.id === id) || STRAT.styles[0];
KB.levelCfg = lv => STRAT.levels.find(l => l.level === Math.min(lv, 5)) || STRAT.levels[2]; // ★6（カナタ）はふだん★5と同じ読み

// ヒューリスティック評価（1手）
function heurScore(counts, m, st, unseen, flexScale) {
  const rest = sub(counts, m.vals);
  let high = 0, small = 0;
  for (const v of m.vals) if (v >= 11) high++;
  for (let v = 1; v <= 3; v++) small += rest[v];
  const left = nCounts(rest);
  if (left === 0) return 1e6;
  const flex = flexScale ? nextPlayableProb(rest, unseen) * 10 : 0;
  return st.w.cards * m.n + st.w.value * m.sum + st.w.flex * flex * flexScale + st.w.small * Math.min(small, 3) + st.w.high * high;
}
KB.heurScore = heurScore;

// AIの手選択（MC以外）。ctxはmc用
function aiChoose(counts, t, lvCfg, st, unseen, r) {
  r = r || rnd;
  let ms = findMoves(counts, t, lvCfg.ops, lvCfg.maxCards);
  if (lvCfg.see) ms = ms.filter(m => r() < (lvCfg.see[m.cls] == null ? 1 : lvCfg.see[m.cls])); // 思いつかない組み合わせは候補に入らない
  if (!ms.length) return null;
  if (r() < lvCfg.miss) return null; // 見逃し
  const win = ms.find(m => m.n === nCounts(counts)); if (win) return win;
  if (lvCfg.mode === 'random') return ms[(r() * ms.length) | 0];
  const sc = ms.map(m => ({ m, s: heurScore(counts, m, st, unseen, lvCfg.flexScale || 0) + gauss(r) * st.noise * (lvCfg.mode === 'top3' ? 3 : 1) }));
  sc.sort((a, b) => b.s - a.s);
  if (lvCfg.mode === 'top3') return sc[Math.min(sc.length - 1, (r() * Math.min(3, sc.length)) | 0)].m;
  return sc[0].m;
}
KB.aiChoose = aiChoose;

// ---------- 高速シミュレーション（値のみ） ----------
// sim: {hands:[counts], deck:[vals], discard:[vals], field, order:[pi..], pos, pol:[policy], me}
function simDraw(sim) {
  if (!sim.deck.length) { if (!sim.discard.length) return 0; sim.deck = shuffle(sim.discard, sim.r); sim.discard = []; }
  return sim.deck.pop();
}
// ロールアウト用の相手モデル（性格・強さを反映した軽量版）
function makePolicy(level, styleId) {
  const lv = KB.levelCfg(level), st = KB.style(styleId);
  return { lv, st };
}
KB.makePolicy = makePolicy;
function polChoose(pol, h, t, r) {
  const lv = pol.lv, st = pol.st;
  const l = MOVES[lv.ops][t];
  let best = null, bs = -1e9, cnt = 0, total = nCounts(h);
  const rand = lv.mode === 'random';
  for (let i = 0; i < l.length; i++) {
    const m = l[i]; if (m.n > lv.maxCards || !avail(h, m.vals)) continue;
    if (lv.see && r() >= lv.see[m.cls]) continue;
    if (m.n === total) return m;
    cnt++;
    let s;
    if (rand) s = r();
    else {
      let high = 0; for (const v of m.vals) if (v >= 11) high++;
      let sm = 0; for (const v of m.vals) if (v <= 3) sm++;
      s = st.w.cards * m.n + st.w.value * m.sum + st.w.high * high - (st.w.small || 0) * sm + (st.noise + (lv.mode === 'top3' ? 2 : 0)) * (r() - 0.5) * 2;
    }
    if (s > bs) { bs = s; best = m; }
  }
  if (!best) return null;
  if (lv.miss && r() < lv.miss) return null;
  return best;
}
KB.polChoose = polChoose;
function simRun(sim, maxRounds) {
  let rounds = 0;
  for (;;) {
    while (sim.pos < sim.order.length) {
      const p = sim.order[sim.pos++];
      if (p === sim.me) sim.meTurns++;
      const h = sim.hands[p];
      const m = polChoose(sim.pol[p], h, sim.field, sim.r);
      if (m) { for (const v of m.vals) { h[v]--; sim.discard.push(v); } if (nCounts(h) === 0) return p; }
      else { const v = simDraw(sim); if (v) h[v]++; }
    }
    if (++rounds > (maxRounds || 60)) return -1;
    sim.discard.push(sim.field);
    const f = simDraw(sim); if (!f) return -1;
    sim.field = f; sim.pos = 0;
  }
}

// 相手の手札をサンプリング（推理つき）
// constraints:
//  {p, kind:'draw', t, add:[vals]}  … p は場 t のとき「引いた」。その後に出した札 add を手札に戻すと、
//                                     「引いた1枚」を除いた手札では t を作れなかったはず（見逃しの可能性は miss 率）
//  {p, kind:'play', t, key, add:[vals]} … p は場 t で key の組み合わせを出した。出す前の手札で、
//                                     その人の性格どおりの第一候補と一致していれば尤もらしい（不一致なら尤度を下げる）
function sampleHands(view, pool, r, pol) {
  const n = view.handSizes.length, me = view.me;
  const cons = view.constraints || [];
  for (let tries = 0; tries < 16; tries++) {
    shuffle(pool, r);
    const hands = []; let k = 0;
    for (let p = 0; p < n; p++) {
      if (p === me) { hands.push(view.hands[me]); continue; }
      const c = new Array(14).fill(0), fx = view.peek ? view.peek.hands[p] : [];
      for (const v of fx) c[v]++;
      for (let j = fx.length; j < view.handSizes[p]; j++) c[pool[k++]]++;
      hands.push(c);
    }
    let w = 1;
    for (const cs of cons) {
      const h0 = hands[cs.p]; if (!h0) continue;
      const pl = pol && pol[cs.p];
      const h = h0.slice(); if (cs.add) for (const v of cs.add) h[v]++;
      if (cs.kind === 'play') {
        if (!pl || pl.lv.mode === 'random') continue;
        for (const v of cs.vals) h[v]++; // 出す前の手札
        const b = polBest(pl, h, cs.t);
        if (b && b.key !== cs.key) w *= 0.45;
        continue;
      }
      const miss = pl ? (pl.lv.miss || 0) : 0;
      let consistent = false;
      for (let v = 1; v <= 13; v++) {
        if (!h[v]) continue;
        h[v]--; const mk = firstMoveOps(h, cs.t, pl ? pl.lv : null); h[v]++;
        if (!mk) { consistent = true; break; }
      }
      if (!consistent) {
        if (pl && pl.lv.see) { // 出せる組み合わせに一つも気づかなかった確率
          let pn = 1; for (const m of MOVES[pl.lv.ops][cs.t]) if (m.n <= pl.lv.maxCards && avail(h, m.vals)) pn *= 1 - pl.lv.see[m.cls];
          w *= miss + (1 - miss) * pn;
        } else w *= miss;
      }
    }
    if (r() < w || tries === 15) return { hands, rest: pool.slice(k) };
  }
}
// ノイズなしで、その人の性格どおりの第一候補
function polBest(pol, h, t) {
  const lv = pol.lv, st = pol.st, l = MOVES[lv.ops][t];
  let best = null, bs = -1e9; const total = nCounts(h);
  for (const m of l) {
    if (m.n > lv.maxCards || !avail(h, m.vals)) continue;
    if (m.n === total) return m;
    let high = 0; for (const v of m.vals) if (v >= 11) high++;
    const s = st.w.cards * m.n + st.w.value * m.sum + st.w.high * high;
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
function firstMoveOps(counts, t, lv) {
  const l = MOVES[lv ? lv.ops : 'all'][t]; const mx = lv ? lv.maxCards : 3;
  for (const m of l) if (m.n <= mx && avail(counts, m.vals)) return m; return null;
}

// MC評価（共通乱数＋段階的絞り込み）
// view: {me, hands, handSizes, deckSize, discard, field, order, pos, constraints, models:[{level,style}]}
// ctx: {setPP, gamesLeftAfter, sd, mean, goalTable}
function evaluate(view, cands, rollouts, ctx, r) {
  r = r || rnd;
  const n = view.handSizes.length, me = view.me;
  const known = new Array(14).fill(0);
  for (let v = 1; v <= 13; v++) known[v] += view.hands[me][v];
  for (const v of view.discard) known[v]++;
  known[view.field]++;
  const pool = [];
  for (let v = 1; v <= 13; v++) for (let k = 0; k < 4 - known[v]; k++) pool.push(v);
  const pk = view.peek;
  if (pk) { const fixed = pk.hands.flat().concat(Object.values(pk.deck)); for (const v of fixed) { const i = pool.indexOf(v); if (i >= 0) pool.splice(i, 1); } }
  const pol = [];
  for (let p = 0; p < n; p++) {
    const md = view.models && view.models[p];
    pol.push(p === me ? makePolicy(4, 'keisan') : makePolicy(md ? md.level : 3, md ? md.style : 'keisan'));
  }
  const res = cands.map(c => ({ m: c, win: 0, pp: 0, goal: 0, n: 0, ppSq: 0, danger: 0, rank: 0, alive: true }));
  const goalMax = ctx && ctx.goalTable ? Math.max(...ctx.goalTable) || 1 : 1;
  const stages = cands.length > 3 ? 3 : 1;
  const totalIters = Math.max(12, Math.floor(rollouts / Math.max(1, cands.length)) * (stages > 1 ? 1.6 : 1));
  const perStage = Math.ceil(totalIters / stages);
  for (let s = 0; s < stages; s++) {
    for (let it = 0; it < perStage; it++) {
      const smp = sampleHands(view, pool, r, pol);
      let deck;
      if (pk) { deck = []; let q = 0; for (let k = 0; k < view.deckSize; k++) deck.push(pk.deck[k] != null ? pk.deck[k] : smp.rest[q++]); }
      else deck = smp.rest.slice(0, view.deckSize);
      const noise = []; for (let p = 0; p < n; p++) noise.push(ctx && ctx.gamesLeftAfter ? gauss(r) * (ctx.sd || 10) * Math.sqrt(ctx.gamesLeftAfter) : 0);
      const seed = (r() * 4294967296) >>> 0;
      for (const rr of res) {
        if (!rr.alive) continue;
        const sr = mulberry(seed); // 共通乱数
        const hands = smp.hands.map(h => h.slice());
        const sim = { hands, deck: deck.slice(), discard: view.discard.slice(), field: view.field, order: view.order, pos: view.pos + 1, r: sr, pol, me, meTurns: 0 };
        let w;
        const m = rr.m;
        if (m) { for (const v of m.vals) { hands[me][v]--; sim.discard.push(v); } }
        else { const v = simDraw(sim); if (v) hands[me][v]++; }
        if (m && nCounts(hands[me]) === 0) w = me; else w = simRun(sim);
        const pps = hands.map(h => sumCounts(h));
        if (w >= 0) pps[w] = 0;
        rr.n++; rr.pp += pps[me]; rr.ppSq += pps[me] * pps[me]; if (w === me) rr.win++;
        if (w >= 0 && w !== me && sim.meTurns === 0) rr.danger++;
        let better = 0; for (let p = 0; p < n; p++) if (p !== me && pps[p] < pps[me]) better++;
        rr.rank += better;
        if (ctx && ctx.goalTable) {
          const proj = pps.map((x, p) => (ctx.setPP ? ctx.setPP[p] : 0) + x + noise[p]);
          let b2 = 0; for (let p = 0; p < n; p++) if (p !== me && proj[p] < proj[me] - 1e-9) b2++;
          rr.goal += ctx.goalTable[Math.min(b2, ctx.goalTable.length - 1)];
        }
      }
    }
    if (s < stages - 1) { // 下位を落とす
      const alive = res.filter(x => x.alive);
      const key = x => ctx && ctx.goalTable ? x.goal / x.n : -x.pp / x.n;
      alive.sort((a, b) => key(b) - key(a));
      const keep = Math.max(3, Math.ceil(alive.length / 2));
      for (let i = keep; i < alive.length; i++) alive[i].alive = false;
    }
  }
  for (const rr of res) {
    const N = rr.n || 1;
    rr.win /= N; rr.pp /= N; rr.danger /= N; rr.rank = rr.rank / N + 1;
    rr.goal = ctx && ctx.goalTable ? rr.goal / N : -rr.pp;
    rr.goalN = ctx && ctx.goalTable ? rr.goal / goalMax : null;
    rr.ppSd = Math.sqrt(Math.max(0, rr.ppSq / N - rr.pp * rr.pp));
    rr.se = rr.ppSd / Math.sqrt(N);
  }
  return res;
}
KB.evaluate = evaluate;

// 候補を絞る
KB.candidates = function (counts, t, limit) {
  const ms = findMoves(counts, t, 'all', 3);
  if (!ms.length) return [];
  // 同じ「残り手札」になる手は1つに
  const seen = new Set(), out = [];
  for (const m of ms) { if (!seen.has(m.key)) { seen.add(m.key); out.push(m); } }
  if (out.length <= limit) return out;
  const st = KB.style('keisan');
  out.sort((a, b) => heurScore(counts, b, st, null, 1) - heurScore(counts, a, st, null, 1));
  // 多様性：枚数別に最低1つ残す
  const pick = out.slice(0, limit);
  for (const nn of [3, 2, 1]) if (!pick.some(m => m.n === nn)) { const x = out.find(m => m.n === nn); if (x) pick[pick.length - 1] = x; }
  // 上がれる手は必ず候補に入れる
  const total = nCounts(counts), win = out.find(m => m.n === total); if (win && !pick.includes(win)) pick[0] = win;
  return pick;
};

// 理由テキスト
KB.reasons = function (counts, m, unseen, ev, best) {
  const out = [];
  const rest = sub(counts, m.vals);
  const left = nCounts(rest);
  if (left === 0) { out.push('これで上がり！'); return out; }
  out.push(`${m.n}枚出して残り${left}枚`);
  const high = m.vals.filter(v => v >= 10);
  if (high.length) out.push(`大きい札(${high.map(KB.vname).join(',')})を処分：残りPPは${sumCounts(rest)}`);
  else out.push(`残りPPは${sumCounts(rest)}`);
  const p = nextPlayableProb(rest, unseen);
  const mask = reachMask(rest); let k = 0; for (let t = 1; t <= 13; t++) if (mask & (1 << t)) k++;
  out.push(`次の場で出せる確率 ${Math.round(p * 100)}%（作れる数 ${k}/13）`);
  if (ev && best && ev !== best) {
    const d = ev.goal - best.goal;
    if (Math.abs(d) < 0.01) out.push('最善手とほぼ同等');
  }
  return out;
};

// ---------- 実ゲーム ----------
function newDeck() { const d = []; let id = 0; for (let s = 0; s < 4; s++) for (let v = 1; v <= 13; v++) d.push({ v, s, id: id++ }); return shuffle(d); }
KB.newDeck = newDeck;

// players: [{id, name, human, level, style}]
KB.Game = class {
  constructor(players, starter, opts) {
    this.opts = Object.assign({ hand: 7, maxRounds: 80 }, opts || {});
    this.players = players;
    this.n = players.length;
    this.deck = newDeck();
    this.discard = [];
    this.hands = players.map(() => []);
    for (let k = 0; k < this.opts.hand; k++) for (let p = 0; p < this.n; p++) this.hands[p].push(this.deck.pop());
    for (const h of this.hands) h.sort((a, b) => a.v - b.v || a.s - b.s);
    this.starter = starter % this.n;
    this.order = []; for (let i = 0; i < this.n; i++) this.order.push((this.starter + i) % this.n);
    this.round = 0; this.pos = 0; this.field = null; this.over = false; this.winner = -1;
    this.last = players.map(() => null); // 直近の行動
    this.log = [];
    this.drawsWhilePlayable = players.map(() => 0);
    this.played = players.map(() => []); // このゲームで出した札（出した回ごと）
    this.nextRound();
  }
  draw() {
    if (!this.deck.length) {
      if (!this.discard.length) return null;
      this.deck = shuffle(this.discard); this.discard = [];
      this.log.push({ type: 'reshuffle', round: this.round });
    }
    return this.deck.pop();
  }
  nextRound() {
    if (this.field) this.discard.push(this.field);
    this.round++;
    if (this.round > this.opts.maxRounds) { this.finish(-1); return; }
    const f = this.draw(); if (!f) { this.finish(-1); return; }
    this.field = f; this.pos = 0;
    this.prevLast = this.last || this.players.map(() => null);
    this.last = this.players.map(() => null);
    this.log.push({ type: 'field', round: this.round, v: f.v, s: f.s });
  }
  current() { return this.over ? -1 : this.order[this.pos]; }
  counts(p) { return countsOf(this.hands[p]); }
  // 公開情報（p視点）
  view(p, revealModels) {
    const constraints = [];
    // 相手ごとに履歴を新しい順にたどる：最後に「引いた」所までの「出した」を推理材料にする
    for (let i = 0; i < this.n; i++) {
      if (i === p) continue;
      const add = []; let plays = 0;
      for (let j = this.log.length - 1; j >= 0; j--) {
        const ev = this.log[j]; if (ev.p !== i) continue;
        if (ev.type === 'play') {
          if (plays < 2) constraints.push({ p: i, kind: 'play', t: ev.t, key: ev.vals.slice().sort((a, b) => a - b).join(','), vals: ev.vals.slice(), add: add.slice() });
          plays++; add.push(...ev.vals);
        } else if (ev.type === 'draw') {
          if (!ev.missedUnknown) constraints.push({ p: i, kind: 'draw', t: ev.t, add: add.slice() });
          break;
        }
      }
    }
    return {
      constraints,
      models: this.players.map(pl => revealModels ? { level: pl.level || 3, style: pl.style || 'keisan' } : { level: 3, style: 'keisan' }),
      me: p, hands: this.players.map((_, i) => i === p ? this.counts(p) : null),
      handSizes: this.hands.map(h => h.length), deckSize: this.deck.length,
      discard: this.discard.map(c => c.v), field: this.field.v, order: this.order, pos: this.pos
    };
  }
  unseenCounts(p) {
    const c = new Array(14).fill(4); c[0] = 0;
    for (const x of this.hands[p]) c[x.v]--; for (const x of this.discard) c[x.v]--; c[this.field.v]--;
    for (let v = 1; v <= 13; v++) if (c[v] < 0) c[v] = 0;
    return c;
  }
  // move: {vals, expr} or null(draw)
  apply(move) {
    const p = this.current(); if (p < 0) return;
    const h = this.hands[p];
    if (move) {
      const played = [];
      for (const v of move.vals) { const i = h.findIndex(c => c.v === v); played.push(h.splice(i, 1)[0]); }
      for (const c of played) this.discard.push(c);
      this.played[p].push({ cards: played, expr: move.expr, t: this.field.v, round: this.round });
      this.last[p] = { type: 'play', cards: played, expr: move.expr, t: this.field.v };
      this.log.push({ type: 'play', round: this.round, p, vals: move.vals.slice(), expr: move.expr, t: this.field.v, left: h.length });
      if (!h.length) { this.finish(p); return; }
    } else {
      const playable = findMoves(this.counts(p), this.field.v, 'all', 3).length > 0;
      if (playable) this.drawsWhilePlayable[p]++;
      const c = this.draw();
      if (c) { h.push(c); h.sort((a, b) => a.v - b.v || a.s - b.s); }
      this.last[p] = { type: 'draw', card: c, missed: playable };
      this.log.push({ type: 'draw', round: this.round, p, t: this.field.v, missed: playable, left: h.length, missedUnknown: !c });
    }
    this.pos++;
    if (this.pos >= this.n) this.nextRound();
  }
  // お手つき：出した札が場の数にならなかった。札は手札に戻したまま、ペナルティでk枚引いて手番終了
  foul(k, vals) {
    const p = this.current(); if (p < 0) return [];
    const h = this.hands[p]; const got = [];
    for (let i = 0; i < k; i++) { const c = this.draw(); if (!c) break; h.push(c); got.push(c); }
    h.sort((a, b) => a.v - b.v || a.s - b.s);
    this.last[p] = { type: 'draw', card: got[0] || null, foul: true, n: got.length, vals: vals.slice() };
    this.log.push({ type: 'draw', foul: true, round: this.round, p, t: this.field.v, vals: vals.slice(), n: got.length, left: h.length, missedUnknown: true });
    this.pos++;
    if (this.pos >= this.n) this.nextRound();
    return got;
  }
  finish(w) {
    this.over = true; this.winner = w;
    this.pp = this.hands.map((h, i) => i === w ? 0 : h.reduce((a, c) => a + c.v, 0));
    this.log.push({ type: 'end', winner: w, pp: this.pp.slice() });
  }
};

// ★6カナタの奥義「絶対透視」：全員の手札と山札の順番まで見通して読む
// 第1巡から、カナタの番が来るたびに50%の確率で発動する。発動したら、そのゲームの最後まで見通したまま（1ゲーム1回）。kanataAt は発動した巡
KB.kanataRoll = function (game) {
  game.kanataIdx = game.players.findIndex(pl => pl.clairvoyant); game.kanataAt = 0; game.kanataOn = false;
};
KB.kanataReady = (game, p) => p === game.kanataIdx && game.kanataIdx >= 0 && !game.kanataOn && (G.KB_KANATA_AT ? game.round >= G.KB_KANATA_AT : Math.random() < 0.5); // KB_KANATA_AT はテスト用（その巡で必ず発動）
KB.kanataStart = (game) => { game.kanataOn = true; game.kanataAt = game.round; };
function aiMoveClear(game, p, rollouts) {
  const counts = game.counts(p), t = game.field.v, total = nCounts(counts);
  const all = findMoves(counts, t, 'all', 3); if (!all.length) return null;
  const win = all.find(m => m.n === total); if (win) return win;
  const cands = KB.candidates(counts, t, 10).concat([null]);
  const hands0 = game.hands.map(h => countsOf(h)), deck0 = game.deck.map(c => c.v), disc0 = game.discard.map(c => c.v);
  const pol = game.players.map((pl, i) => i === p ? makePolicy(5, 'keisan') : makePolicy(pl.human ? 4 : Math.min(pl.level || 3, 5), pl.style || 'keisan'));
  const N = rollouts || 48; let best = null, bs = -1e9;
  for (const m of cands) {
    let win = 0, pp = 0;
    for (let it = 0; it < N; it++) {
      const hands = hands0.map(h => h.slice());
      const sim = { hands, deck: deck0.slice(), discard: disc0.slice(), field: t, order: game.order, pos: game.pos + 1, r: mulberry(1000 + it * 7919), pol, me: p, meTurns: 0 };
      if (m) { for (const v of m.vals) { hands[p][v]--; sim.discard.push(v); } } else { const v = simDraw(sim); if (v) hands[p][v]++; }
      const w = m && nCounts(hands[p]) === 0 ? p : simRun(sim);
      if (w === p) win++; else pp += sumCounts(hands[p]);
    }
    const s = win / N * 0.5 - pp / N; // 失点の見込みを最小に（同じくらいなら上がりやすい方）
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
KB.aiMoveClear = aiMoveClear;
// ゼロの隠れた力（本人も気づいていない）：ときどき、見えないはずの札が何枚か分かる。
// 分かった札は固定し、残りは毎回ランダムに埋めて先を読む。カナタほどではないが、ほかの★5より強い
const PEEK_RATE = 0.7;
// 見えないはずの札（他の人の手札＋山札の上6枚）から5〜7枚だけ分かる。分かった札は、ふだんの読み（MC）の中で固定される
function makePeek(game, p) {
  const slots = [];
  game.hands.forEach((h, i) => { if (i !== p) h.forEach(c => slots.push({ i, v: c.v })); });
  const D = game.deck.length; for (let k = Math.max(0, D - 6); k < D; k++) slots.push({ i: -1, k, v: game.deck[k].v });
  shuffle(slots);
  const pk = { hands: game.hands.map(() => []), deck: {} };
  for (const x of slots.slice(0, 5 + ((Math.random() * 3) | 0))) { if (x.i >= 0) pk.hands[x.i].push(x.v); else pk.deck[x.k] = x.v; }
  return pk;
}
// AIが1手選ぶ（実ゲーム）
KB.aiMove = function (game, p, ctx) {
  const pl = game.players[p];
  if (pl.clairvoyant && game.kanataOn) return aiMoveClear(game, p);
  const lv = KB.levelCfg(pl.level), st = KB.style(pl.style);
  const counts = game.counts(p), t = game.field.v;
  const unseen = game.unseenCounts(p);
  if (lv.mode === 'mc' && lv.mcRollouts > 0) {
    const all = findMoves(counts, t, lv.ops, lv.maxCards);
    if (!all.length) return null;
    const win = all.find(m => m.n === counts.reduce((a, b) => a + b, 0)); if (win) return win;
    const cands = KB.candidates(counts, t, 6).concat([null]); // あえて引くも検討
    const view = game.view(p);
    if (pl.peek && Math.random() < PEEK_RATE) { view.peek = makePeek(game, p); game.peeks = (game.peeks || 0) + 1; } // ゼロの隠れた力（本人は気づいていない）
    const ev = evaluate(view, cands, lv.mcRollouts, ctx);
    const mc = st.mc;
    const sc = ev.map(e => ({ m: e.m, s: mc.goal * normGoal(e, ctx) + mc.win * e.win - mc.pp * e.pp / 40 + gauss() * st.noise * 0.01 }));
    sc.sort((a, b) => b.s - a.s);
    return sc[0].m;
  }
  return aiChoose(counts, t, lv, st, unseen);
};
function normGoal(e, ctx) { if (!ctx || !ctx.goalTable) return -e.pp / 40; const mx = Math.max(...ctx.goalTable) || 1; return e.goal / mx; }
KB.normGoal = normGoal;

// 全自動で1ゲーム（他テーブル用：速さ優先でMCは上級ヒューリスティックで代用）
KB.autoGame = function (players, starter) {
  const g = new KB.Game(players, starter);
  KB.kanataRoll(g);
  let guard = 0;
  while (!g.over && guard++ < 5000) {
    const p = g.current(); const pl = players[p];
    if (KB.kanataReady(g, p)) KB.kanataStart(g);
    if (pl.clairvoyant && g.kanataOn) { g.apply(aiMoveClear(g, p, 16)); continue; }
    let lv = KB.levelCfg(pl.level); if (lv.mode === 'mc') lv = Object.assign({}, lv, { mode: 'heuristic', flexScale: 1 });
    const m = aiChoose(g.counts(p), g.field.v, lv, KB.style(pl.style), g.unseenCounts(p));
    g.apply(m);
  }
  return g;
};

// ---------- 大会ユーティリティ ----------
KB.splitTables = function (n, maxSize) {
  maxSize = maxSize || 5;
  const t = Math.ceil(n / maxSize), base = Math.floor(n / t), extra = n % t;
  const sizes = []; for (let i = 0; i < t; i++) sizes.push(base + (i < extra ? 1 : 0));
  return sizes;
};
// セット内順位（PP昇順、同点は上位を分け合う）
KB.rankByPP = function (pps) {
  return pps.map(x => pps.filter(y => y < x).length);
};

G.KB = KB;
})(typeof window !== 'undefined' ? window : globalThis);
