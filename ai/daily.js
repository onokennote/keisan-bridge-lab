// AI研究員（ごちゃまぜ倶楽部のキャラ）を毎日少しずつ育てる。GitHub Actions から動かす
//   node ai/daily.js daily   … いつもの1日（何人かが1セットずつ打つ。ときどき新しいメンバーが入る）
//   node ai/daily.js seed    … 最初の投入（強い人は数セット、始めたばかりの人は1セット）
// 環境変数：KB_API（APIのURL）、KB_ADMIN_KEY（さくらの admin_key.txt と同じ鍵）
// 対局は本物のアプリ（test/page.html。./build.sh で作る）を開き、自分の席をそのキャラの強さ・性格のAIに打たせる。
// 成績・バッジ・推定実力の計算はアプリそのもの。記録はサーバーの ai_data に預け、翌日に続きから打つ
const { chromium } = require('playwright');
const path = require('path');
const API = process.env.KB_API || 'https://onoken-web.sakura.ne.jp/kb/api.php', KEY = process.env.KB_ADMIN_KEY || '';
const MODE = process.argv[2] || 'daily', MAX = 15, PAGE = 'file://' + path.join(__dirname, '..', 'test', 'page.html');
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
async function api(a, body) {
  const r = await fetch(API + '?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ key: KEY }, body || {})) });
  const j = await r.json(); if (!j.ok) throw new Error(a + ': ' + (j.error || r.status)); return j;
}
// 1人ぶん：記録を戻して、sets セット（1セット5ゲーム）打ち、記録とランキングの数字を返す
// その日の調子：毎回の判断で、ときどき1〜2段弱い打ち方になる（★5でも推定実力は4点台が中心。たまに大きく崩す）
function rollForm() {
  const r = Math.random();
  if (r < 0.2) return { name: '不調', p: 0.8, by: 2, by2: 0.6 };
  if (r < 0.7) return { name: 'ふつう', p: 0.6, by: 1, by2: 0.3 };
  return { name: '好調', p: 0.35, by: 1, by2: 0.1 };
}
async function play(b, c, data, sets, minis, form) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(PAGE); await pg.waitForTimeout(300);
  const pid = 'p' + c.id;
  await pg.evaluate(([data, c, pid]) => {
    localStorage.clear();
    if (data) for (const k in data) localStorage.setItem(k, data[k]);
    else {
      localStorage.setItem('kb.profiles', JSON.stringify([{ id: pid, name: c.name, at: Date.now() }]));
      localStorage.setItem('kb.profile', JSON.stringify(pid));
      localStorage.setItem('kb.settings', JSON.stringify({ name: c.name }));
      localStorage.setItem('kb.p.' + pid + '.avatar', JSON.stringify(KB.charToCh(KB.charById(c.id))));
    }
    // 練習の設定：4人卓・相手まんべんなく・5ゲーム（ゲーム・セットのバッジの対象）
    localStorage.setItem('kb.cfgPractice', JSON.stringify({ n: 4, games: 5, mix: 'even', opps: [0, 1, 2, 3].map(() => ({ level: 'r', style: 'r' })), points: [10, 8, 5, 2, 0] }));
  }, [data, c, pid]);
  await pg.reload(); await pg.waitForTimeout(300);
  await pg.evaluate(() => { KBAPP.S.settings.speed = 'instant'; KBAPP.S.settings.autoHint = false; document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove()); });
  for (let set = 0; set < sets; set++) {
    const f = set === 0 ? form : rollForm(); // 何セットも打つときは、セットごとに調子が変わる
    await pg.evaluate(() => { document.querySelectorAll('#modal,.whistle-ov').forEach(e => e.remove()); KBAPP.go('home'); });
    await pg.click('[data-go="setup-practice"]'); await pg.click('[data-act="start-practice"]'); await pg.waitForTimeout(200);
    for (let step = 0; step < 60000; step++) {
      const st = await pg.evaluate(([lv0, style, form]) => {
        const lv = Math.random() < form.p ? Math.max(1, lv0 - (Math.random() < form.by2 ? 2 : 1)) : lv0; // 調子の波（ときどき2段落ちる）
        const S = KBAPP.S;
        const wk = document.querySelector('[data-act="win-ok"]'); if (wk) { wk.click(); return 'modal'; }
        const m = document.querySelector('#modal'); if (m) { const bt = m.querySelector('[data-act="win-ok"],[data-act="next-game"],#tb-ok,#aim-ok'); if (bt) { bt.click(); return 'modal'; } m.remove(); return 'm'; }
        document.querySelectorAll('.whistle-ov').forEach(e => e.remove());
        if (S.view === 'set-end' || S.view === 'home' || S.view === 'result') return 'end';
        const g = S.game; if (!g || g.over) return 'wait';
        const p = g.current(); if (!g.players[p].human) return 'ai';
        // 人が考えるくらいの時間をかけたことにする（一瞬で打つと「早撃ち」のバッジばかり増えるため）
        S.turnStart = Date.now() - (6000 + Math.random() * 20000); S.stateTs = S.turnStart;
        const pl = g.players[p], sv = { level: pl.level, style: pl.style, human: pl.human };
        pl.level = lv; pl.style = style; pl.human = false; let mv; try { mv = KB.aiMove(g, p); } finally { Object.assign(pl, sv); }
        if (!mv) { KBAPP.act('draw'); return 'draw'; }
        const hand = g.hands[p], used = new Set(); S.sel = [];
        for (const v of mv.vals) { const cd = hand.find(x => x.v === v && !used.has(x.id)); used.add(cd.id); S.sel.push(cd.id); }
        KBAPP.act('play'); return 'play';
      }, [c.lv, c.st, f]);
      if (st === 'end' && step > 5) break;
      await pg.waitForTimeout(st === 'ai' || st === 'wait' ? 25 : 8);
    }
  }
  // ミニゲーム（式ハンター・アウツチャレンジ・早見表・バッジアタック）は、強さに合った結果で「遊んだことにする」（記録とバッジはアプリの本物の処理）
  await pg.evaluate(() => KBAPP.aiFixAttack()); // 半端なバッジアタックの記録を直す（前の版の分）
  const fAdj = form.name === '不調' ? -0.8 : form.name === '好調' ? 0.3 : 0; // バッジアタックのBPに効く調子
  for (const k of minis || []) console.log('  ', c.name, JSON.stringify(await pg.evaluate(([k, lv, fa]) => KBAPP.aiMini(k, lv, fa), [k, Math.max(1, c.lv - (form.name === '不調' ? 2 : form.name === 'ふつう' ? (Math.random() < 0.5 ? 1 : 0) : 0)), fAdj])));
  const out = await pg.evaluate(([pid, c]) => {
    const data = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('kb.') && !/^kb\.(cloud|recentLines|migDone|testAskName)/.test(k)) data[k] = localStorage.getItem(k); }
    const st = KBAPP.cloudStats().find(x => x.pid === pid) || {};
    const ch = KB.charById(c.id);
    st.name = c.name; st.bio = `${ch.title ? `「${ch.title}」` : ''}${ch.prof || ''}`.slice(0, 140); st.avatar = KB.charToCh(ch); // 二つ名がないキャラは「」を付けない
    return { data, stats: st };
  }, [pid, c]);
  await pg.close();
  if (errs.length) console.log('  page errors', c.name, errs.slice(0, 2));
  return out;
}
(async () => {
  if (!KEY) { console.log('KB_ADMIN_KEY がないので何もしません'); return; }
  const b = await chromium.launch();
  const pg0 = await b.newPage(); await pg0.goto(PAGE); await pg0.waitForTimeout(300);
  const roster = await pg0.evaluate(() => KB.ROSTER.map(c => ({ id: c.id, name: c.name, lv: c.lv, st: c.st }))); await pg0.close();
  if (MODE === 'reseed') { for (const x of (await api('ai_list')).list) await api('ai_del', { cid: x.cid }); console.log('いったん全員を引退させて、最初から投入し直します'); }
  const cur = (await api('ai_list')).list; const have = new Set(cur.map(x => x.cid));
  const jobs = []; // { c, data, sets }
  const pick = lv => { const cands = roster.filter(c => c.lv === lv && !have.has(c.id) && !jobs.some(j => j.c.id === c.id)); return cands[rnd(0, cands.length - 1)]; };
  const MINI = ['hunt', 'hunt', 'hunt', 'outs', 'outs', 'chart', 'chart', 'attack', 'attack'], mini = n => Array.from({ length: n }, () => MINI[rnd(0, MINI.length - 1)]);
  const add = (lv, sets) => { const c = pick(lv); if (c) jobs.push({ c, data: null, sets, minis: mini(Math.max(0, sets - 1)) }); };
  if (MODE === 'seed' || MODE === 'reseed') {
    // 最初の投入：強い人は経験を積んだ状態、弱い人は始めたばかり
    for (const [lv, a, z] of [[5, 4, 6], [5, 3, 5], [4, 3, 5], [4, 2, 4], [3, 2, 3], [3, 1, 2], [2, 1, 2], [1, 1, 1]]) if (cur.length + jobs.length < MAX) add(lv, rnd(a, z));
  } else if (MODE === 'fix') {
    // 記録の直しだけ（対局もミニゲームもしない。開いて保存し直す）
    for (const x of cur) { const c = roster.find(r => r.id === x.cid); if (c) jobs.push({ c, data: x.data, sets: 0, minis: [] }); }
  } else if (MODE === 'attack') {
    // バッジアタックの日（手で動かす）：半分くらいのメンバーが1回ずつ挑戦
    for (const x of cur) { const c = roster.find(r => r.id === x.cid); if (c && Math.random() < 0.6) jobs.push({ c, data: x.data, sets: 0, minis: ['attack'] }); }
  } else if (MODE === 'catchup') {
    // 追いつき（1回だけ）：いるメンバーに、強さに応じた数のミニゲームを遊ばせる（★5は3〜4回、★1は0〜1回）
    for (const x of cur) { const c = roster.find(r => r.id === x.cid); if (!c) continue; const n = rnd([0, 0, 1, 2, 3][c.lv - 1], [1, 1, 2, 3, 4][c.lv - 1]); if (n) jobs.push({ c, data: x.data, sets: 0, minis: mini(n) }); }
  } else {
    // いつもの1日：それぞれ6割の確率で1セット。ときどき（3割）新しいメンバーが1人入る
    // ミニゲームは4割の確率で1つ（対局しない日でも遊ぶことがある）
    // 本物の参加者に、強さに応じて追いついていく。目標＝本物のBPの1位×★ごとの割合（★1は3割…★5は同じくらい）
    //  ・目標より3割以上少ない：その日は多めに打つ（最大3セット＋ミニゲーム2つ）
    //  ・1〜3割少ない：少し多め／1割以内まで近づいた：ペースを落とす（なかなか追いつかない）
    //  ・目標に届いた・越えた：ほとんど打たない（離れていかない）
    //  ・ごくたまに（1日あたり1/14の確率で、1割以内まで近づいたAIのうち1人だけ）ラストスパートの日があり、追い抜くことがある
    let topHuman = 0, aiBp = {};
    try { const j = await (await fetch(API + '?a=rankings')).json(); (j.rankings && j.rankings.bp ? j.rankings.bp.list : []).forEach(r => { if (r.ai) aiBp[r.name] = r.bp; else topHuman = Math.max(topHuman, r.bp); }); } catch (e) { }
    const close = [];
    for (const x of cur) {
      const c = roster.find(r => r.id === x.cid); if (!c) continue;
      // 目標の割合は「今の推定実力」で決める（まだ出ていなければ★）。★1→3割・★2→45%・★3→6割・★4→8割・★5→1位より少し上（105%）。キャラごとにばらつく
      const rt = x.rating != null ? x.rating : c.lv, P = [[1, 0.3], [2, 0.45], [3, 0.6], [4, 0.8], [5, 1.05]];
      let ratio = rt <= 1 ? 0.3 : rt >= 5 ? 1.05 : 0; for (let k = 0; k < 4; k++) if (rt > P[k][0] && rt <= P[k + 1][0]) ratio = P[k][1] + (P[k + 1][1] - P[k][1]) * (rt - P[k][0]);
      const bpNow = aiBp[c.name] != null ? aiBp[c.name] : (x.bp || 0), target = topHuman * ratio, g = target > 0 ? 1 - bpNow / target : -1;
      let sets, minis, note = '';
      if (g > 0.3) { const extra = Math.min(3, Math.ceil((target - bpNow) / 200)); sets = Math.min(3, 1 + Math.floor(extra / 2)); minis = mini(Math.min(2, extra)); note = `★${rt.toFixed(1)}→目標${Math.round(target)}BP・あと${Math.round(g * 100)}%`; }
      else if (g > 0.1) { sets = Math.random() < 0.8 ? 1 + (Math.random() < 0.3 ? 1 : 0) : 0; minis = mini(Math.random() < 0.5 ? 1 : 0); note = `接近中：あと${Math.round(g * 100)}%`; }
      else if (g > 0) { sets = Math.random() < 0.45 ? 1 : 0; minis = mini(Math.random() < 0.25 ? 1 : 0); note = `目前：あと${Math.round(g * 100)}%`; close.push(c.id); }
      else if (target > 0) { sets = Math.random() < 0.2 ? 1 : 0; minis = mini(Math.random() < 0.1 ? 1 : 0); note = '目標に到達'; }
      else { sets = Math.random() < 0.6 ? 1 : 0; minis = mini(Math.random() < 0.4 ? 1 : 0); }
      if (sets || minis.length) jobs.push({ c, data: x.data, sets, minis, note });
    }
    if (close.length && Math.random() < 1 / 14) { // ラストスパート
      const id = close[rnd(0, close.length - 1)], x = cur.find(y => y.cid === id), c = roster.find(r => r.id === id), j0 = jobs.find(j => j.c.id === id);
      if (j0) Object.assign(j0, { sets: 3, minis: mini(2), note: 'ラストスパート！' }); else jobs.push({ c, data: x.data, sets: 3, minis: mini(2), note: 'ラストスパート！' });
    }
    console.log('本物の参加者のBPの1位：', topHuman);
    if (cur.length < MAX && Math.random() < 0.3) add([1, 2, 2, 3, 3, 4][rnd(0, 5)], 1);
  }
  if (process.env.KB_AI_LIMIT) { jobs.splice(+process.env.KB_AI_LIMIT); jobs.forEach(j => j.sets = 1); } // 試すとき用
  console.log(MODE, '：いる', cur.length, '人、今日打つ', jobs.length, '人', jobs.map(j => `${j.c.name}★${j.c.lv}×${j.sets}${j.minis && j.minis.length ? '+' + j.minis.join(',') : ''}${j.note ? `（${j.note}）` : ''}`).join(' / '));
  // 4人ずつ並べて打つ
  let i = 0; const worker = async () => { while (i < jobs.length) { const j = jobs[i++]; const t0 = Date.now();
    try { const form = rollForm(); const r = await play(b, j.c, j.data, j.sets, j.minis, form); await api('ai_save', { cid: j.c.id, data: r.data, stats: r.stats }); console.log(`  ${j.c.name}（${form.name}）：★${(r.stats.rating || 0).toFixed ? (r.stats.rating || 0).toFixed(2) : '-'}・バッジ${r.stats.badges}・${r.stats.bp}BP・連続${r.stats.streak}（${Math.round((Date.now() - t0) / 1000)}秒）`); }
    catch (e) { console.log('  失敗', j.c.name, e.message); } } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  await b.close();
})();
