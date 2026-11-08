// ===== 実況・解説（オリジナルキャラ） =====
(function (G) {
'use strict';
const KB = G.KB;
// 解説：ルート博士（フクロウの数学者・理知的） / 実況：ナニワのマサ（青いキャップの大阪弁ツッコミ。サッカーとポーカー好きの戦略家）
KB.CASTERS = {
  root: { name: 'ルート博士', role: '解説' },
  masa: { name: 'ナニワのマサ', role: '実況' }
};
KB.casterSVG = function (who, mood) {
  if (who === 'root') {
    const eye = mood === 'happy' ? '<path d="M33 47q5 -6 10 0M57 47q5 -6 10 0" stroke="#2a211c" stroke-width="3" fill="none" stroke-linecap="round"/>' : '<circle cx="38" cy="47" r="6" fill="#2a211c"/><circle cx="62" cy="47" r="6" fill="#2a211c"/><circle cx="40" cy="45" r="2" fill="#fff"/><circle cx="64" cy="45" r="2" fill="#fff"/>';
    return `<svg viewBox="0 0 100 100" aria-label="ルート博士"><circle cx="50" cy="50" r="49" fill="#1c3f6e"/>
<ellipse cx="50" cy="62" rx="30" ry="30" fill="#9c6b3f"/><ellipse cx="50" cy="70" rx="18" ry="20" fill="#e9d3b0"/>
<path d="M22 40 L30 22 L40 36Z M78 40 L70 22 L60 36Z" fill="#9c6b3f"/>
<circle cx="38" cy="47" r="12" fill="#fffaf0"/><circle cx="62" cy="47" r="12" fill="#fffaf0"/>${eye}
<g fill="none" stroke="#d4a017" stroke-width="2.4"><circle cx="38" cy="47" r="13"/><circle cx="62" cy="47" r="13"/><path d="M51 47h-2"/></g>
<path d="M45 58 L55 58 L50 66Z" fill="#f2b632"/>
<path d="M24 26 L50 14 L76 26 L50 36Z" fill="#222"/><rect x="44" y="26" width="12" height="8" fill="#222"/><path d="M74 26 v14" stroke="#f2b632" stroke-width="2"/><circle cx="74" cy="41" r="3" fill="#f2b632"/>
<text x="50" y="30" text-anchor="middle" font-size="9" font-weight="900" fill="#f2b632" font-family="serif">√</text></svg>`;
  }
  // ナニワのマサ：ツッコミ芸人風（白シャツに赤い蝶ネクタイ、手にハリセン、青いキャップは深めにまっすぐ）
  const ch = { gender: 'm', age: 'adult', name: 'マサ', skin: '#efc4a2', hair: '#2b2522', hs: 'buzz', shirt: '#ffffff', glasses: false };
  const base = KB.avatarSVG(ch, { mood: mood || 'happy' });
  const cap = '<g><path d="M27 37 Q27 12 50 12 Q73 12 73 37 Z" fill="#1c7ed6"/><circle cx="50" cy="12.5" r="2.2" fill="#1864ab"/><path d="M25 37 Q50 31 75 37 Q75 42 50 41 Q25 42 25 37Z" fill="#1864ab"/></g>';
  const bow = '<path d="M40 84 L50 88 L40 92Z M60 84 L50 88 L60 92Z" fill="#e03131"/><circle cx="50" cy="88" r="2.4" fill="#c92a2a"/>';
  const harisen = '<g transform="rotate(-28 80 72)"><path d="M72 96 L86 54 L99 62 Z" fill="#fffaf0" stroke="#999" stroke-width="1"/><path d="M76 86l13 -26M80 90l13 -24" stroke="#ccc" stroke-width="1"/><rect x="69" y="92" width="9" height="9" rx="2" fill="#e03131"/></g>';
  return base.replace(/<\/g>\s*<\/svg>$/, cap + bow + '</g>' + harisen + '</svg>');
};
const R = (a, r) => a[((r || Math.random)() * a.length) | 0];
const fill = (s, d) => s.replace(/\{(\w+)\}/g, (_, k) => (d[k] == null ? '' : d[k]));
const ANALYTIC = { start: 1, roundSmall: 1, roundMid: 1, roundBig: 1, field1: 1, field13: 1, field7: 1, good: 1, ok: 1, bad: 1, drewGood: 1, border: 1, borderIn: 1, borderClose: 1, borderFar: 1, finalSet: 1, lastGame: 1, final: 1, heavy: 1, tip: 1, leadSet: 1, trailSet: 1, philo: 1, setStart: 1, oppMissed: 1, oppBlunder: 1, oppNice: 1, myBigPP: 1, mySmallPP: 1, resultLucky: 1, resultUnlucky: 1, resultBoth: 1, resultBad: 1, reshuffle: 1, deckLow: 1, styleKeisan: 1, styleInochi: 1 };
const PRIO = { kanataOn: 9, kanataAgain: 8, atkStart: 7, atkHalf: 7, atk5: 7, atk1: 7, atkSet: 7, namedWin: 6, missLucky: 6, bigWait: 6, almostWinBig: 5, almostWin: 4, foul: 6, setStart: 5, divMild: 2, vague: 1, oppNice: 2, oppMissed: 3, oppBlunder: 3, tip: 0, roundSmall: 1, roundMid: 1, roundBig: 1, field1: 1, field13: 1, field7: 1, deckLow: 1, start: 2, draw: 2, play1: 2, play2: 2, heavy: 2, reshuffle: 2, styleGangan: 2, styleInochi: 2, styleIroiro: 2, styleKeisan: 2, master: 2, mul: 2, drawStreak: 3, play3: 3, div: 3, leadSet: 3, trailSet: 3, myHeavy: 3, reach: 4, myReach: 4, good: 4, ok: 3, bad: 4, drewGood: 4, streak: 5, border: 4, borderIn: 4, borderClose: 4, borderFar: 4, philo: 1, tableDefensive: 2, tableAggressive: 2, tableStuck: 2, tableClose: 2, tableRunaway: 3, tableHeavy: 2, myBigPP: 4, mySmallPP: 4, resultLucky: 4, resultUnlucky: 4, resultBoth: 4, resultBad: 4, finalSet: 5, lastGame: 5, final: 5, win: 6 };
const LINES = () => ({ root: KB.LINES_ROOT || {}, masa: KB.LINES_MASA || {} });
// 最近使ったセリフ（ブラウザに保存して、次に開いたときも続けて避ける）
let RECENT = {};
try { RECENT = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem('kb.recentLines')) || '{}') || {}; } catch (e) { RECENT = {}; }
let saveT = null;
function saveRecent() { if (saveT || typeof localStorage === 'undefined') return; saveT = setTimeout(() => { saveT = null; try { localStorage.setItem('kb.recentLines', JSON.stringify(RECENT)); } catch (e) { } }, 1500); }
// 計算した事実から作るセリフ（解説の深掘り）も、同じ仕組みで直近の重複を避ける
KB.pickFresh = function (key, list) {
  if (!list || !list.length) return null;
  const rec = RECENT[key] = RECENT[key] || [];
  const fresh = list.filter(x => !rec.includes(x.id || x));
  const pick = R(fresh.length ? fresh : list);
  rec.push(pick.id || pick); while (rec.length > Math.max(1, Math.floor(list.length * 0.6))) rec.shift();
  saveRecent(); return pick;
};
// mode: off | root | masa | both
KB.commentLine = function (mode, kind, d) {
  if (!mode || mode === 'off') return null;
  let who = mode;
  if (mode === 'tetsu') who = 'masa';
  if (mode === 'both') who = ANALYTIC[kind] ? (Math.random() < 0.7 ? 'root' : 'masa') : (Math.random() < 0.7 ? 'masa' : 'root');
  const arr = LINES()[who][kind]; if (!arr || !arr.length) return null;
  d = d || {};
  const usable = arr.filter(s => [...s.matchAll(/\{(\w+)\}/g)].every(m => d[m[1]] != null && d[m[1]] !== ''));
  // 内容の矛盾チェック（計算で判定）：大きい札・小さい札・上がり・柔軟さ・3枚出しに触れるセリフは、
  // 実際の手の比較でその通りのときだけ使う（d.checks が true のとき）
  if (d.checks) {
    const TAGS = [
      [/大きい札|重い札|でかい札|重たい札|大物|K・Q|QやK|J・Q・K|処分|捨て|PPの軽さ|合計がより減|合計を減らす|手札の合計/, 'bigOk'],
      [/小さい札|ちっちゃい札|A〜3|温存|調整役|調整札/, 'smallOk'],
      [/上がり率|上がる確率|上がりの確率|上がりの可能性|上がりまでの距離|一歩近づ|上がりへの道|上がりの道|上がりに近づ|上がりとPP/, 'winOk'],
      [/柔軟|次の場で出せる|作れる数|手札の形|残る札|残す札|次の巡に向けた|次の場にも|次の場への/, 'flexOk'],
      [/3枚|枚数を一気|ハットトリック/, 'countOk'],
      [/期待PP|点の見込み|失点の見込み/, 'ppOk']
    ];
    const ok = usable.filter(s => TAGS.every(([re, k]) => !re.test(s) || d[k]));
    usable.splice(0, usable.length, ...ok);
  }
  // 実は出せたのに引いた（あえて引いた・見逃した）ときは、「作れなかった」と言い切るセリフを使わない
  if (d.couldPlay) { const ok = usable.filter(x => !/作れ|出せず|出せなかった|しかなかった|しかない|できへん|作れへん/.test(x)); usable.splice(0, usable.length, ...ok); }
  if (kind === 'draw' && d.h != null && d.h < 6) { const light = usable.filter(s => !/重|PPのリスク|PPも重く/.test(s)); if (light.length) usable.splice(0, usable.length, ...light); }
  if (!usable.length) return null;
  // 同じセリフが続かないよう、最近使ったセリフ（候補の6割ほど）は避ける
  const rk = who + ':' + kind, rec = RECENT[rk] = RECENT[rk] || [];
  const fresh = usable.filter(x => !rec.includes(x));
  const pick = R(fresh.length ? fresh : usable);
  rec.push(pick); const keep = Math.max(1, Math.floor(arr.length * 0.6)); while (rec.length > keep) rec.shift();
  saveRecent();
  let text = fill(pick, d);
  // 口ぐせ：ときどき前置きを付けて言い回しに幅を出す（見出し的な場面は除く）
  const noPrefix = { kanataOn: 1, kanataAgain: 1, atkStart: 1, atkHalf: 1, atk5: 1, atk1: 1, atkSet: 1, foul: 1, start: 1, finalSet: 1, lastGame: 1, final: 1, win: 1, tip: 1 };
  const pf = KB.PREFIX && KB.PREFIX[who];
  if (pf && !noPrefix[kind] && Math.random() < (who === 'masa' ? 0.3 : 0.2)) text = R(pf) + text;
  // 博士はごくたまに、哲学的なひと言を添える
  if (who === 'root' && KB.PHILO && /good|bad|ok|round|field|win|result|table|streak|BigPP/.test(kind) && Math.random() < 0.07) text += ' ' + R(KB.PHILO);
  return { who, text, prio: PRIO[kind] || 1, kind, mood: /almostWinBig|almostWin|foul|bad|Bad|draw|heavy|Heavy|Stuck|BigPP|trail|Streak|myHeavy|Unlucky/.test(kind) ? 'worried' : /good|win|play3|streak|SmallPP|lead|Reach|div|Lucky|Both|oppNice|bigWait|missLucky|namedWin/.test(kind) ? 'happy' : 'normal' };
};
KB.countLines = function () { let n = 0; const L = LINES(); for (const w in L) for (const k in L[w]) n += L[w][k].length; return n; };
})(typeof window !== 'undefined' ? window : globalThis);
