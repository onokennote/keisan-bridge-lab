// ===== アプリ本体 =====
(function () {
'use strict';
const KB = window.KB;
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = x => Math.round(x * 100) + '%';
const fx1 = x => (Math.round(x * 10) / 10).toFixed(1);
const BUILD = (typeof window !== 'undefined' && window.KB_BUILD) || 'dev'; // アプリのビルド番号（更新の検知用）
// プレイヤーごとに分けて保存するデータ（成長記録・続きから・中断の検知）
const PROFILE_KEYS = { notes: 1, noteMark: 1, notesSeen: 1, rivals: 1, watched: 1, chart: 1, growth: 1, session: 1, active: 1, attackBest: 1, zukan: 1, huntBest: 1, avatar: 1, huntT: 1, bio: 1, chartMark: 1 };
const raw = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } if (typeof cloudDirty === 'function') cloudDirty(k); },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } if (typeof cloudDirty === 'function') cloudDirty(k); }
};
let PID = raw.get('kb.profile', null);
const keyOf = k => PROFILE_KEYS[k] && PID ? 'kb.p.' + PID + '.' + k : 'kb.' + k;
const store = {
  get(k, d) { return raw.get(keyOf(k), d); },
  set(k, v) { if (k === 'settings' && typeof S !== 'undefined' && S.attack) v = Object.assign({}, v, S.attack.saved); raw.set(keyOf(k), v); }, // アタック中の固定設定は保存しない
  del(k) { raw.del(keyOf(k)); }
};
const profiles = () => raw.get('kb.profiles', []);
function createProfile(name) {
  const list = profiles(), first = !list.length;
  const id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  list.push({ id, name, at: Date.now() }); raw.set('kb.profiles', list);
  // 名前を登録する前のデータ（アップデート前の記録など）は、最初のプレイヤーに引き継ぐ
  if (first) for (const k in PROFILE_KEYS) { const v = raw.get('kb.' + k, null); if (v != null) { raw.set('kb.p.' + id + '.' + k, v); raw.del('kb.' + k); } }
  return id;
}

// ---------- 設定 ----------
const DEF_SETTINGS = { name: 'あなた', commentary: 'both', spoiler: true, speed: 'normal', warnMiss: false, judge: 'after3', sound: true, autoHint: false, showLevel: true, showStyle: true };
const S = {
  settings: Object.assign({}, DEF_SETTINGS, store.get('settings', {})),
  T: null, game: null, gm: null, sel: [], hint: null, decisions: [], timer: null, bubbles: {}, confirmDraw: false,
  view: 'home', sample: null, qual: null, after: null, ask: null
};
if (S.settings.commentary === 'tetsu') S.settings.commentary = 'masa';
if (!S.settings.sndLv) S.settings.sndLv = S.settings.sound === false ? 'off' : 'l';
KB.sfxLevel(S.settings.sndLv);
if (!S.settings.judgeSet) S.settings.judge = 'after3';
{ const act = store.get('active', null); if (act && act.build !== BUILD && store.get('session', null)) S.updatedNotice = true; try { store.del('active'); } catch (e) { } } // 自分で選んでいない判定設定は、初期値（出した後に判定）にそろえる
(function loadStrategy() {
  const s = store.get('strategy', null);
  if (s) { try { KB.setStrategy(KB.validateStrategy(s)); } catch (e) { } }
})();
const SPEED = { slow: 1900, normal: 1200, fast: 600, instant: 30 };
const MIX = {
  random: { label: 'ランダム', w: [1, 1, 1, 1, 1] },
  casual: { label: '初心者多め', w: [3, 3, 2, 1, 0.3] },
  even: { label: 'まんべんなく', w: [1, 1.5, 2, 1.5, 1] },
  strong: { label: '強豪ぞろい', w: [0.2, 0.5, 1.5, 3, 3] },
  master: { label: '全員達人', w: [0, 0, 0, 0, 1] }
};
const KANATA_MIX = { master: 1 }; // シード（★6カナタ）は「全員達人」の大会だけ
function pickW(w, r) { const t = w.reduce((a, b) => a + b, 0); let x = r() * t; for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i; } return w.length - 1; }

// ---------- 参加者 ----------
// AIはごちゃまぜ倶楽部の固定キャラから選ぶ（強さ・性格・名前・見た目はキャラごとに決まっている）
function makeAI(id, level, style, used) {
  const c = KB.pickChar(level, style || null, used);
  return { id, human: false, level: c.lv, style: style && c.lv === level ? style : c.st, ch: KB.charToCh(c), peek: !!c.peek };
}
// アバター編集
const AV_OPTS = {
  age: [['child', 'こども'], ['young', 'わかもの'], ['adult', 'おとな'], ['senior', 'シニア']],
  base: [['child', 'こども'], ['young', 'わかもの'], ['adult', 'おとな'], ['senior', 'シニア'], ['panda', 'パンダ'], ['lion', 'ライオン'], ['robot', 'ロボ'], ['cat', 'ねこ'], ['fox', 'キツネ'], ['ghost', 'おばけ'], ['skeleton', 'ガイコツ'], ['alien', '宇宙人']],
  hs: [['short', 'ショート'], ['spiky', 'ツンツン'], ['side', '七三'], ['buzz', '坊主'], ['bald', 'つるつる'], ['mohawk', 'モヒカン'], ['afro', 'アフロ'], ['curly', 'くるくる'], ['bob', 'ボブ'], ['long', 'ロング'], ['pony', 'ポニー'], ['twin', 'ツイン'], ['bun', 'おだんご']],
  hair: ['#1b1b1f', '#2b2522', '#5a3a24', '#a8763e', '#d9b46a', '#e8e8e8', '#b0443a', '#e8590c', '#3d5a9e', '#7048e8', '#f06595', '#20c997'],
  skin: ['#f6d7bf', '#efc4a2', '#e2ab84', '#c98d65', '#9b6646'],
  shirt: ['#f0a020', '#e03131', '#4263eb', '#20c997', '#7950f2', '#e64980', '#212529', '#f8f9fa', '#868e96', '#15aabf', '#2f9e44', '#a0522d'],
  acc: [[null, 'なし'], ['cap', 'キャップ'], ['baseball', '野球帽'], ['beret', 'ベレー帽'], ['headband', 'はちまき'], ['ribbon', 'リボン'], ['flower', 'お花'], ['headphones', 'ヘッドホン'], ['goggles', 'ゴーグル'], ['nekomimi', 'ネコ耳'], ['bunny', 'ウサ耳'], ['chef', 'コック帽'], ['towel', '手ぬぐい'], ['ninja', '忍者'], ['helmet', 'ヘルメット'], ['pirate', '海賊帽'], ['horns', 'ツノ'], ['thief', '怪盗マスク'], ['clown', 'ピエロ帽'],
    ['crown', '王冠'], ['tophat', 'シルクハット'], ['wizard', '魔法使いの帽子'], ['halo', '天使の輪'], ['turban', 'ターバン'], ['laurel', '月桂冠'], ['cowboy', 'カウボーイハット'], ['divpin', '÷のヘアピン'], ['mortarboard', '博士の角帽'], ['kinhachi', '必勝はちまき'], ['antenna', 'アンテナ'], ['goldhelm', '金のかぶと']],
  outfit: [[null, 'ふつう'], ['stripe', 'ボーダー'], ['hoodie', 'フード'], ['tie', 'ネクタイ'], ['bowtie', '蝶ネクタイ'], ['gakuran', '学ラン'], ['kimono', '着物'], ['judo', '柔道着'], ['coat', '白衣'], ['apron', 'エプロン'], ['armband', '腕章'], ['samurai', '侍'], ['butler', '執事'],
    ['medal', '金メダル'], ['cape', 'マント'], ['blackbelt', '黒帯の道着'], ['uniform', '背番号10'], ['sash', 'たすき'], ['royal', '王様のマント'], ['armor', '鎧'], ['racer', 'レーサースーツ'], ['goldjacket', '金のジャケット'], ['badgevest', 'バッジだらけのベスト'], ['champion', 'チャンピオンベルト'], ['suit', 'スーツ'], ['robe', '魔法のローブ'], ['shinobi', '忍び装束'], ['starrobe', '星のローブ'], ['spacesuit', '宇宙服']],
  face: [[null, 'なし'], ['freckles', 'そばかす'], ['blush', 'ほっぺ'], ['mustache', 'ちょびひげ'], ['beard', 'あごひげ'], ['bandage', 'ばんそうこう'], ['star', '星'], ['monocle', '片めがね'], ['kirakira', 'キラキラ'], ['flame', '炎のペイント'], ['scar', '歴戦の傷'], ['bolt', '稲妻ペイント']],
  gl: [[null, 'なし'], ['round', '丸めがね'], ['square', '四角めがね'], ['shades', 'サングラス'], ['gold', '金縁めがね'], ['star', '星めがね'], ['heart', 'ハートめがね'], ['visor', 'サイバーバイザー']],
  hold: [[null, 'なし'], ['trophy', 'トロフィー'], ['ticket', '金のチケット'], ['scroll', '奥義の巻物'], ['soccer', 'サッカーボール'], ['bokken', '木刀'], ['wand', '魔法の杖'], ['abacus', 'そろばん'], ['magnifier', '虫めがね'], ['crystal', '水晶玉'], ['flag', '旗'], ['scepter', '王笏'], ['compass', 'コンパス'], ['calc', '電卓'], ['stopwatch', 'ストップウォッチ'], ['dice', 'サイコロ'], ['hourglass', '砂時計'], ['book', '式の図鑑']],
  pet: [[null, 'なし'], ['hamster', 'ハムスター'], ['luckycat', '招き猫'], ['dragon', 'ミニドラゴン'], ['chick', 'ひよこ'], ['phoenix', '火の鳥'], ['minirobo', 'ミニロボ'], ['kitten', '黒ねこ'], ['swallow', 'つばめ'], ['bat', 'こうもり'], ['crow', 'からす'], ['ufo', 'ミニUFO']],
  bg: ['#8a9a93', '#1c7ed6', '#e8590c', '#2f9e44', '#ae3ec9', '#495057', '#e64980', '#f2b632'],
  bgpat: [[null, '柄なし'], ['pat:gold', 'ゴールド'], ['pat:fire', '炎'], ['pat:stars', '星空'], ['pat:rainbow', '虹'], ['pat:formula', '数式'], ['pat:sakura', '桜'], ['pat:spot', 'スポットライト'], ['pat:grid', '方眼'], ['pat:checker', 'チェック'], ['pat:speed', '集中線'], ['pat:moon', '月夜'], ['pat:clock', '時計'], ['pat:galaxy', '銀河']]
};
// カテゴリーの冠（コンプリート）と、各系統の金（いちばん上）バッジでアイテムが増える
// カテゴリーの冠（コンプリート）でまとめてもらえるセット
const CROWN_SETS = {
  '対局・継続': ['base:panda', 'acc:kinhachi', 'outfit:medal', 'hold:flag', 'pet:chick', 'bgpat:pat:sakura'],
  '勝利': ['base:lion', 'acc:crown', 'outfit:champion', 'hold:scepter', 'pet:phoenix', 'bgpat:pat:spot'],
  '判断の質': ['base:robot', 'acc:antenna', 'outfit:suit', 'face:monocle', 'hold:compass', 'pet:minirobo', 'bgpat:pat:grid'],
  '手と計算': ['base:cat', 'acc:wizard', 'outfit:robe', 'hold:calc', 'pet:kitten', 'bgpat:pat:checker'],
  '早撃ち': ['base:fox', 'acc:halo', 'outfit:shinobi', 'hold:stopwatch', 'pet:swallow', 'bgpat:pat:speed'],
  'アウツチャレンジ': ['base:ghost', 'acc:turban', 'outfit:starrobe', 'hold:dice', 'pet:bat', 'bgpat:pat:moon'],
  'バッジアタック': ['base:skeleton', 'acc:goldhelm', 'outfit:cape', 'hold:hourglass', 'pet:crow', 'bgpat:pat:clock'],
  '式の図鑑': ['base:alien', 'acc:tophat', 'outfit:spacesuit', 'hold:book', 'pet:ufo', 'bgpat:pat:galaxy']
};
const AV_LOCK = {
  ...(() => { const o = {}; Object.entries(CROWN_SETS).forEach(([cat, items]) => items.forEach(k => o[k] = { cat })); return o; })(),
  'hold:trophy': { badge: 'games' }, 'outfit:blackbelt': { badge: 'practice_set' }, 'pet:hamster': { badge: 'tour_done' }, 'outfit:uniform': { badge: 'win' }, 'face:kirakira': { badge: 'set_low' },
  'acc:laurel': { badge: 'all_sets' }, 'outfit:sash': { badge: 'set_win' }, 'gl:star': { badge: 'qualify' }, 'outfit:royal': { badge: 'champion' }, 'hold:ticket': { badge: 'qualify_strong' }, 'pet:dragon': { badge: 'champion_strong' },
  'face:flame': { badge: 'streak5' }, 'bgpat:pat:fire': { badge: 'streak10' }, 'gl:gold': { badge: 'perfect' }, 'face:scar': { badge: 'sutemi' }, 'hold:scroll': { badge: 'perfect_set' }, 'outfit:armor': { badge: 'no_foul_set' },
  'bgpat:pat:stars': { badge: 'rating' }, 'hold:soccer': { badge: 'three' }, 'acc:divpin': { badge: 'div_paren' }, 'gl:heart': { badge: 'bestpair' }, 'bgpat:pat:rainbow': { badge: 'miracle' }, 'pet:luckycat': { badge: 'miss_lucky' },
  'acc:cowboy': { badge: 'quick5' }, 'face:bolt': { badge: 'quick3' }, 'hold:bokken': { badge: 'snap' }, 'gl:visor': { badge: 'blitz' }, 'hold:wand': { badge: 'quickdraw' },
  'hold:abacus': { badge: 'outs3' }, 'hold:magnifier': { badge: 'outs4' }, 'hold:crystal': { badge: 'outs5' },
  'outfit:racer': { badge: 'atk_done' }, 'outfit:goldjacket': { badge: 'atk_bp' }, 'outfit:badgevest': { badge: 'atk_badges' }, 'acc:mortarboard': { badge: 'zukan' }, 'bgpat:pat:formula': { badge: 'zukan_cat' }
};
const topBadge = key => { const a = ACH.find(x => x[0] === key); return a ? { a, t: a[2][a[2].length - 1], name: a[4][a[4].length - 1] } : null; };
function goldCount(g) { let n = 0; ACH.forEach(a => a[2].forEach((t, i) => { const tier = a[5] ? a[5][i] : a[2].length === 1 ? 2 : Math.min(i, 2); if (tier === 2 && g.ach[a[0] + ':' + t]) n++; })); return n; }
function avUnlocked(key, g) {
  const L = AV_LOCK[key]; if (!L) return true; g = g || G_();
  if (L.cat) { const gi = ACH_GROUPS.findIndex(x => x[0] === L.cat); return gi >= 0 && catProgress(g, gi).done; }
  if (L.badge) { const tb = topBadge(L.badge); return !!(tb && g.ach[L.badge + ':' + tb.t]); }
  return goldCount(g) >= L.gold;
}
const avLockText = key => { const L = AV_LOCK[key]; if (!L) return ''; if (L.cat) return `「${L.cat}」のバッジをコンプリート（冠「${CAT_SPECIAL[L.cat]}」）`; if (L.badge) { const tb = topBadge(L.badge); return tb ? `「${tb.name}」バッジ（${tb.a[1]}のいちばん上）を取る` : ''; } return `金バッジを${L.gold}個`; };
const avGotText = key => { const L = AV_LOCK[key]; if (!L) return ''; if (L.cat) return `「${L.cat}」コンプリート（冠「${CAT_SPECIAL[L.cat]}」）で獲得`; const tb = topBadge(L.badge); return tb ? `「${tb.name}」バッジ（${tb.a[1]}のいちばん上）で獲得` : ''; };
const avItemName = key => { const k = key.slice(0, key.indexOf(':')), v = key.slice(key.indexOf(':') + 1); const it = (AV_OPTS[k] || []).find(x => Array.isArray(x) && String(x[0]) === v); return it ? it[1] : v; };
// 新しく使えるようになったアイテムを知らせる
function checkAvUnlocks(g) {
  const seen0 = store.get('avUnl', null), now = Object.keys(AV_LOCK).filter(k => avUnlocked(k, g));
  if (seen0 === null) { store.set('avUnl', now); return; } // 初めては黙って記録（今までの分は編集画面で確認できる）
  const seen = seen0, fresh = now.filter(k => !seen.includes(k));
  if (!fresh.length) return; store.set('avUnl', now);
  const groups = []; fresh.forEach(k => { const c = AV_LOCK[k] && AV_LOCK[k].cat; const gq = c && groups.find(x => x.cat === c); if (gq) gq.keys.push(k); else groups.push({ cat: c, keys: [k] }); });
  groups.forEach((gq, i) => setTimeout(() => toast(gq.cat ? `👑 冠「${CAT_SPECIAL[gq.cat]}」でアバターのセット${gq.keys.length}点：${gq.keys.map(avItemName).join('・')}` : `アバターに新しいアイテム：${gq.keys.map(avItemName).join('・')}`), 2600 + i * 3200));
}
function avatarEditor() {
  const d = S.avDraft || (S.avDraft = myAvatar()), g = G_();
  const lock = (key, v) => !avUnlocked(key + ':' + v, g);
  const sw = (key, list) => `<div class="av-sw">${list.map(c => { const lk = lock(key, c); return `<button class="av-c ${d[key] === c ? 'on' : ''} ${lk ? 'lock' : ''}" style="background:${c}" data-act="${lk ? 'av-locked' : 'av-set'}" data-k="${key}" data-v="${c}" aria-label="${key} ${c}${lk ? '（ロック中）' : ''}">${lk ? '🔒' : ''}</button>`; }).join('')}</div>`;
  const opt = (key, list, cur) => `<div class="av-opts">${list.map(([v, l]) => { const lk = v !== null && lock(key, v); return `<button class="av-o ${String(cur !== undefined ? cur : d[key]) === String(v) ? 'on' : ''} ${lk ? 'lock' : ''}" data-act="${lk ? 'av-locked' : 'av-set'}" data-k="${key}" data-v="${v === null ? '' : v}">${lk ? '🔒 ' : AV_LOCK[key + ':' + v] ? '★ ' : ''}${l}</button>`; }).join('')}</div>`;
  const nLock = Object.keys(AV_LOCK).filter(k => !avUnlocked(k, g)).length;
  const html = `<div class="stack av-ed"><h3 style="margin:0">アバターを編集</h3>
    <div class="av-prev">${KB.avatarSVG(Object.assign({}, d, { name: S.settings.name }), { mood: 'happy' })}</div>
    <p class="small muted" style="margin:0;text-align:center">★はごほうびアイテム。🔒は各系統のいちばん上（金）のバッジや、カテゴリーの冠（コンプリート）で使えるようになります。選んでいる★をもう一度押すと、何で獲得したかが出ます${nLock ? `（あと${nLock}個）` : '（すべて解放ずみ！）'}。</p>
    <div class="av-row"><small>ベース</small>${opt('base', AV_OPTS.base, d.base || d.age)}</div>
    ${d.base ? '<p class="small muted" style="margin:0">人間以外のベースでは、髪型・髪の色・肌・顔・服の色は使われません。</p>' : ''}<div class="av-row ${d.base ? 'av-off' : ''}"><small>髪型</small>${opt('hs', AV_OPTS.hs)}</div>
    <div class="av-row ${d.base ? 'av-off' : ''}"><small>髪の色</small>${sw('hair', AV_OPTS.hair)}</div>
    <div class="av-row ${d.base ? 'av-off' : ''}"><small>肌</small>${sw('skin', AV_OPTS.skin)}</div>
    <div class="av-row ${d.base ? 'av-off' : ''}"><small>服の色</small>${sw('shirt', AV_OPTS.shirt)}</div>
    <div class="av-row"><small>服</small>${opt('outfit', AV_OPTS.outfit)}</div>
    <div class="av-row"><small>頭</small>${opt('acc', AV_OPTS.acc)}</div>
    <div class="av-row ${d.base ? 'av-off' : ''}"><small>顔</small>${opt('face', AV_OPTS.face)}</div>
    <div class="av-row"><small>めがね</small>${opt('gl', AV_OPTS.gl)}</div>
    <div class="av-row"><small>手に持つ</small>${opt('hold', AV_OPTS.hold)}</div>
    <div class="av-row"><small>おとも</small>${opt('pet', AV_OPTS.pet)}</div>
    <div class="av-row"><small>背景の色</small>${sw('bg', AV_OPTS.bg)}</div>
    <div class="av-row"><small>背景の柄</small>${opt('bgpat', AV_OPTS.bgpat)}</div>
    <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-act="av-random">おまかせ</button><button class="btn" data-act="close">やめる</button><button class="btn primary" data-act="av-save">保存</button></div></div>`;
  const m = $('#modal .av-ed'); if (m) { const sc = m.scrollTop; m.outerHTML = html; bindModalActs(); const m2 = $('#modal .av-ed'); if (m2) m2.scrollTop = sc; } else modal(html);
}
function bindModalActs() { const m = $('#modal'); if (m) bindModal(m); }
// 自分のアバター（プレイヤーごとに保存）
const AVATAR_DEF = { gender: 'm', skin: '#efc4a2', hair: '#2b2522', hs: 'side', shirt: '#f0a020', glasses: false, acc: null, outfit: null, face: null, bg: '#8a9a93', age: 'adult', base: null, gl: null, hold: null, pet: null, bgpat: null };
function myAvatar() { const a = Object.assign({}, AVATAR_DEF, store.get('avatar', null) || {}); if (a.glasses && !a.gl) a.gl = 'round'; if (a.acc && !AV_OPTS.acc.some(x => x[0] === a.acc)) { if (!a.outfit && AV_OPTS.outfit.some(x => x[0] === a.acc)) a.outfit = a.acc; a.acc = null; } if (a.face === 'sunglasses') { a.gl = 'shades'; a.face = null; } a.glasses = false; return a; }
// ライバルが上がったときのひと言
function rivalLose(g, p, w) {
  if (w < 0 || !p.ch || !p.ch.charId) return null; const wp = g.players[w]; if (!wp || !wp.ch || KB.RIVALS[p.ch.charId] !== wp.ch.charId) return null;
  const L = { shota: ['くっそー、またゼロかよ！', 'ゼロめ…次こそ！'], zero: ['…ショウタ、強くなった'], kakeru: ['リンのやつ…覚えてろ！'], rin: ['番長に負けるなんて…校則違反です'], migi: ['ヒダリに負けた…'], hidari: ['ミギに負けた…'], pipo: ['オメガ、すごいピポ！'] }[p.ch.charId];
  return L ? L[(Math.random() * L.length) | 0] : null;
}
function makeHuman(id) {
  return { id, human: true, level: 0, style: null, ch: Object.assign({ gender: 'm', age: 'adult', name: S.settings.name || 'あなた', skin: '#efc4a2', hair: '#2b2522', hs: 'side', shirt: '#f0a020', glasses: false, ageJa: '' }, myAvatar(), { name: S.settings.name || 'あなた', kind: 'human' }) };
}
const P = id => S.T.players.find(p => p.id === id);
function nm(p) { return p.human && !p.spectator ? (S.settings.name || 'あなた') : p.ch.name; }
// 呼び名に「さん」を付ける（すでに敬称・肩書きで終わる名前には付けない）
const san = s => /(さん|くん|君|ちゃん|様|先生|博士|大将|師匠|親方|課長|部長|社長|会長|名人|先輩)$/.test(s) ? s : s + 'さん';
function av(p, mood, small) {
  const lvShow = S.settings.showLevel || S.T && S.T.revealAll;
  const stShow = S.settings.showStyle || S.T && S.T.revealAll;
  const me = p.human && !p.spectator; return KB.avatarSVG(p.ch, { mood: mood || 'normal', level: me ? 0 : (lvShow ? p.level : 0), style: me ? null : (stShow ? p.style : null) });
}
function lvChip(p) {
  if (p.human && !p.spectator) return '';
  let s = '';
  if (S.settings.showLevel) s += `<span class="chip lvchip"><span class="lv-full">${'★'.repeat(p.level)}${'☆'.repeat(Math.max(0, 5 - p.level))} ${esc(p.level >= 6 ? '奥義使い' : KB.levelCfg(p.level).label)}</span><span class="lv-short">★${p.level}</span></span>`;
  if (S.settings.showStyle) { const st = KB.style(p.style); s += `<span class="chip stchip" style="background:${esc(st.color)}"><span class="lv-full">${esc(st.label)}</span><span class="lv-short">${esc(st.label.slice(0, 4))}</span></span>`; }
  return s;
}

// ---------- セッション（練習・大会共通） ----------
function newSession(cfg) {
  KB.resetNames();
  const r = Math.random;
  const players = [makeHuman(0)], usedC = new Set();
  if (cfg.kind === 'practice') {
    cfg.opps.forEach((o, i) => {
      const lv = o.level === 'r' ? pickW(MIX[cfg.mix].w, r) + 1 : +o.level;
      const st = o.style === 'r' ? null : o.style;
      players.push(makeAI(i + 1, lv, st, usedC));
    });
    cfg.sets = 1; cfg.finalists = 0;
  } else {
    for (let i = 1; i < cfg.nPlayers; i++) players.push(makeAI(i, pickW(MIX[cfg.mix].w, r) + 1, null, usedC));
  }
  const T = {
    cfg, players, set: 1, game: 1, phase: 'prelim', tables: [], myTable: 0,
    setPP: {}, points: {}, totPP: {}, setHist: [], finalists: [], finalPP: {}, tb: {}, done: false, startedAt: Date.now()
  };
  players.forEach(p => { T.points[p.id] = 0; T.totPP[p.id] = 0; T.tb[p.id] = 0; });
  // ★6カナタ：ほかのキャラと同じ割合で大会に参加。予選には出ず、シードとして決勝にだけ現れる（決勝の卓は最大5人なので、そのときは予選からの進出を4人まで）
  if (cfg.kind === 'tournament' && cfg.finalists >= 2 && (window.KB_KANATA != null ? !!window.KB_KANATA : KANATA_MIX[cfg.mix] && Math.random() < KB.kanataRate(cfg.nPlayers - 1))) { // シードが出るのは「強豪ぞろい」「全員達人」のときだけ
    T.kanata = true; if (cfg.finalists >= 5) { T.cfg = Object.assign({}, cfg, { finalists: 4 }); T.kanataCut = true; }
  }
  return T;
}
function seatSet(T) {
  const ids = T.players.map(p => p.id);
  if (T.phase === 'final') { T.tables = [KB.shuffle(T.finalists.slice())]; }
  else if (T.cfg.kind === 'practice') { T.tables = [KB.shuffle(ids.slice())]; }
  else {
    const sizes = KB.splitTables(ids.length, 5);
    KB.shuffle(ids); T.tables = []; let k = 0;
    for (const s of sizes) { T.tables.push(ids.slice(k, k + s)); k += s; }
  }
  T.myTable = T.tables.findIndex(t => t.includes(0));
  T.setPP = {}; for (const t of T.tables) for (const id of t) T.setPP[id] = [];
}
function setTotal(T, id) { return (T.setPP[id] || []).reduce((a, b) => a + b, 0); }
function pointsTable(T) { return T.cfg.points; }
function goalLabel() {
  const T = S.T; if (!T) return '期待点';
  if (S.tiebreak) return '勝ち抜け率';
  if (T.phase === 'final') return '優勝率';
  if (T.cfg.kind === 'tournament') return '決勝進出率';
  return 'セット期待点';
}
function fmtGoal(x) {
  const T = S.T;
  if (S.tiebreak || T.phase === 'final' || T.cfg.kind === 'tournament') return pct(x);
  return fx1(x) + '点';
}

// 予選：今のセット順位 r ごとの決勝進出確率（推定）
// 全卓AIで600大会を回して測った「強さ別の1ゲームPP（平均・ばらつき）」を使い、
// 今のセットの残りゲーム → 将来セット（毎回席替え）→ 総合順位（得点→累計PP）までをまとめてシミュレーションする。
const LV_PP = { 1: [19.4, 13.6], 2: [14.5, 11.6], 3: [10.4, 9.5], 4: [9.2, 8.8], 5: [9.4, 9.0] };
function ppModel(T, p) {
  if (p.human) { // 自分：これまでの実績を平均（9.5）に寄せて使う
    let s = 0, n = 0; for (const h of T.setHist || []) { const r = h.res.find(x => x.id === p.id); if (r) { s += r.pp; n += r.games.length; } }
    const cur = T.setPP[p.id] || []; s += cur.reduce((a, b) => a + b, 0); n += cur.length;
    return [(s + 9.5 * 8) / (n + 8), 9.3];
  }
  if (!S.settings.showLevel) return null; // 強さ非表示：毎回ランダムな強さを仮定
  return LV_PP[p.level] || LV_PP[3];
}
function qualifyTable(T) {
  const F = T.cfg.finalists, pts = T.cfg.points, sets = T.cfg.sets, games = T.cfg.games;
  const myT = T.tables[T.myTable], sz = myT.length;
  const futureSets = sets - T.set;
  const gamesLeftNow = games - (T.game - 1);
  const ids = T.players.map(p => p.id);
  const models = {}; T.players.forEach(p => { models[p.id] = ppModel(T, p); });
  const draw = (id, nGames) => { // nGames ゲーム分のPP合計
    if (nGames <= 0) return 0;
    const m = models[id] || LV_PP[1 + ((KB.rand() * 5) | 0)];
    return Math.max(0, m[0] * nGames + KB.gauss() * m[1] * 1.25 * Math.sqrt(nGames));
  };
  const sizes = KB.splitTables(ids.length, 5);
  const N = 1200, out = new Array(sz).fill(0);
  for (let r = 0; r < sz; r++) {
    let q = 0;
    for (let it = 0; it < N; it++) {
      const P2 = {}, PP2 = {};
      ids.forEach(id => { P2[id] = T.points[id]; PP2[id] = T.totPP[id]; });
      // 今のセット：各卓の残りゲームを足して順位→得点（自分は順位 r に固定）
      T.tables.forEach((t, ti) => {
        const proj = t.map(id => { const add = draw(id, gamesLeftNow); PP2[id] += add; return { id, v: setTotal(T, id) + add }; });
        if (ti === T.myTable) {
          const others = proj.filter(o => o.id !== 0).sort((a, b) => a.v - b.v);
          const ranks = []; for (let k = 0; k < sz; k++) if (k !== r) ranks.push(k);
          others.forEach((o, i) => { P2[o.id] += pts[ranks[i]] || 0; });
          P2[0] += pts[r] || 0;
        } else {
          proj.sort((a, b) => a.v - b.v);
          proj.forEach((o, i) => { P2[o.id] += pts[i] || 0; });
        }
      });
      // 将来セット：毎回ランダムに席替え
      for (let f = 0; f < futureSets; f++) {
        const sh = KB.shuffle(ids.slice()); let k = 0;
        for (const s of sizes) {
          const tb = sh.slice(k, k + s); k += s;
          const v = tb.map(id => { const x = draw(id, games); PP2[id] += x; return { id, x }; }).sort((a, b) => a.x - b.x);
          v.forEach((o, i) => { P2[o.id] += pts[i] || 0; });
        }
      }
      let better = 0;
      for (const id of ids) if (id !== 0 && (P2[id] > P2[0] || (P2[id] === P2[0] && PP2[id] < PP2[0]))) better++;
      if (better < F) q++;
    }
    out[r] = q / N;
  }
  return out;
}

// 大会設定画面の目安：打ち方ごとの「1ゲーム平均PP」から決勝進出率をすばやく推定
// （AIの最善手を打ち続けた場合の平均PP 7.4 は、160大会のシミュレーションで測った値。実測の決勝進出率は80%）
const PLAY_STYLES = [
  { key: 'best', label: 'AIの最善手を打ち続けた場合', mu: 7.4 },
  { key: 'l4', label: '★4（上級AI）相当の打ち方', mu: 8.7 },
  { key: 'l3', label: '★3（中級AI）相当の打ち方', mu: 10.2 }
];
function estimateQualify(cfg, myMu) {
  const n = cfg.nPlayers, sizes = KB.splitTables(n, 5), N = 2500, W = MIX[cfg.mix].w;
  const tw = W.reduce((a, b) => a + b, 0);
  const pick = () => { let x = KB.rand() * tw; for (let i = 0; i < 5; i++) { x -= W[i]; if (x <= 0) return i + 1; } return 5; };
  let q = 0;
  for (let it = 0; it < N; it++) {
    const mus = [[myMu, 9.0]]; for (let i = 1; i < n; i++) mus.push(LV_PP[pick()]);
    const pts = new Array(n).fill(0), pp = new Array(n).fill(0);
    for (let s = 0; s < cfg.sets; s++) {
      const ids = KB.shuffle([...Array(n).keys()]); let k = 0;
      for (const z of sizes) {
        const tb = ids.slice(k, k + z); k += z;
        const v = tb.map(id => { const m = mus[id]; const x = Math.max(0, m[0] * cfg.games + KB.gauss() * m[1] * Math.sqrt(cfg.games)); pp[id] += x; return { id, x }; }).sort((a, b) => a.x - b.x);
        v.forEach((o, i) => { pts[o.id] += cfg.points[i] || 0; });
      }
    }
    let better = 0; for (let i = 1; i < n; i++) if (pts[i] > pts[0] || (pts[i] === pts[0] && pp[i] < pp[0])) better++;
    if (better < cfg.finalists) q++;
  }
  return q / N;
}
function readTourCfg() { // 閉じているグループの欄は画面にないので、そのときは下書き（suT）の値を使う
  const d = S.suT || DEF_T, v = (id, x) => { const e = $(id); return e ? e.value : x; };
  return { nPlayers: Math.max(5, Math.min(40, +v('#t-n', d.nPlayers) || 17)), sets: Math.max(1, Math.min(8, +v('#t-sets', d.sets) || 3)), games: Math.max(1, Math.min(10, +v('#t-games', d.games) || 5)), points: readPoints(v('#t-points', d.points.join(','))), finalists: Math.max(2, Math.min(5, +v('#t-fin', d.finalists) || 5)), tie: v('#t-tie', d.tie || 'janken'), mix: v('#t-mix', d.mix || 'even'), preset: d.preset };
}
function renderEst() {
  const el = $('#t-est'); const w = $('#t-est-wrap'); if (!el || !w || (w.tagName === 'DETAILS' && !w.open)) return;
  const c = readTourCfg();
  const rows = PLAY_STYLES.map(p => ({ p, v: estimateQualify(c, p.mu) }));
  const base = c.finalists / c.nPlayers;
  el.innerHTML = `${rows.map(({ p, v }, i) => `<div class="est-row ${i === 0 ? 'top' : ''}"><span>${p.label}</span><span class="est-bar"><i style="width:${Math.round(v * 100)}%"></i></span><b class="tnum">${Math.round(v * 100)}%</b></div>`).join('')}
  <div class="est-row"><span>参加者の平均（${c.finalists}/${c.nPlayers}人）</span><span class="est-bar"><i style="width:${Math.round(base * 100)}%;background:var(--muted)"></i></span><b class="tnum">${Math.round(base * 100)}%</b></div>
  <p class="small muted" style="margin:0">1ゲームあたりの平均PP（最善手7.4・★4相当8.7・★3相当10.2）と、相手の強さの混ざり方から推定した目安です。運の要素が大きいので±5%ほどの幅があります。</p>`;
}
// 総合評価：目標（決勝進出率など）を主軸に、上がり率と期待PPも加味する。
// 目標の差がわずかな序盤では、上がり率・期待PPの差で順位がつく。
function totalScore(e, ctx) {
  const gm = Math.max(...((ctx && ctx.goalTable) || [1])) || 1;
  return (ctx && ctx.goalTable ? e.goal / gm : 0) + 0.06 * e.win - 0.06 * e.pp / 30;
}
const SUTEMI_MARGIN = 0.02; // 目的の差がこれ以上（得点なら0.2点、確率なら2%）のときだけ捨て身を最善にする（セットの最後のゲーム・決勝・サドンデス）
// セットの序盤は「まず上がって失点を0にする」を優先：残りのゲームが多いほど、捨て身を最善にする差を大きくする（最後から2ゲーム目は4%、それより前は6%）
const sutemiMargin = ctx => { if (ctx && ctx.final) return SUTEMI_MARGIN; const left = ctx && ctx.gamesLeftAfter != null ? ctx.gamesLeftAfter : 0; return left <= 0 ? SUTEMI_MARGIN : left === 1 ? 0.04 : 0.06; };
const isOutEv = e => !!(e && e.m && e.win >= 0.9999 && e.pp === 0);
function rankEv(ev, ctx) {
  ev.forEach(e => { e.score = totalScore(e, ctx); });
  // 上がれる手（出せば手札がなくなる手）は基本は最善。ただし「あえて上がらず、相手に札を抱えさせたまま続ける」方が
  // セットの順位ではっきり得（差が SUTEMI_MARGIN 以上）なら、その捨て身の手を最善として残す
  // 比べるのは「目的」（セット期待点・決勝進出率など）だけ。上がりの手は上がる確率・PPの補正で有利になりやすいので、それは使わない
  const outE = ev.find(isOutEv);
  if (outE) {
    const gm = Math.max(...((ctx && ctx.goalTable) || [1])) || 1, gn = e => (e.goal || 0) / gm;
    const others = ev.filter(e => e !== outE).sort((a, b) => gn(b) - gn(a)), bo = others[0];
    const top = Math.max(...ev.map(e => e.score));
    if (bo && ctx && ctx.goalTable && gn(bo) - gn(outE) >= sutemiMargin(ctx)) { bo.score = top + 0.002; outE.score = Math.min(outE.score, top + 0.001); }
    else outE.score = top + 0.001;
  }
  ev.sort((a, b) => b.score - a.score); return ev;
}
function ctxFor(pIdx) {
  const T = S.T, g = S.game;
  const ids = g.players.map(p => p.id);
  const setPP = ids.map(id => S.tiebreak ? 0 : setTotal(T, id));
  const gamesLeftAfter = S.tiebreak ? 0 : T.cfg.games - T.game;
  let goalTable;
  const pl = g.players[pIdx];
  if (S.tiebreak) goalTable = S.tiebreak.goalTable;
  else if (T.phase === 'final') goalTable = [1, 0, 0, 0, 0];
  else if (pl.human && T.cfg.kind === 'tournament') goalTable = S.qual || T.cfg.points;
  else goalTable = T.cfg.points.slice(0, ids.length);
  return { setPP, gamesLeftAfter, sd: 9, mean: 10, goalTable, final: !S.tiebreak && T.phase === 'final' };
}

// ---------- 画面切替 ----------
// アプリ更新の検知：プレイ中の画面にいたことを、ビルド番号と一緒に記録しておく
const PLAY_VIEWS = { game: 1, 'set-end': 1, entrance: 1, opening: 1, result: 1 };
function markActive(view) { try { if (PLAY_VIEWS[view] && S.T && !S.spectate) store.set('active', { view, build: BUILD }); else store.del('active'); } catch (e) { } }
function go(view) { if (view !== 'game' && S.spectate) watchEnd(true); if (view === 'home' && CLOUD.pendingPull) { CLOUD.pendingPull = false; setTimeout(cloudPull, 200); } S.view = view; markActive(view); render(); window.scrollTo(0, 0); }
// どの画面でも右下に浮かぶ 🏠（ホームでは出さない）。ゲーム中は確認してから中断と同じ動き
// テスト版（staging）の印：画面の上に小さな帯（本番と取り違えないように）
function syncStg() { if (!window.KB_STAGING || document.getElementById('stg-band')) return; const b = document.createElement('div'); b.id = 'stg-band'; b.textContent = '🧪 テスト版'; b.title = '記録は本番と別です'; document.body.appendChild(b); }
function syncFab() {
  let b = document.getElementById('home-fab'); const show = !ARTIFACT_CLOSED && S.view !== 'home';
  if (!show) { if (b) b.remove(); document.body.classList.remove('has-fab'); return; }
  if (!b) { b = document.createElement('button'); b.id = 'home-fab'; b.type = 'button'; b.title = 'ホームへ'; b.setAttribute('aria-label', 'ホームへ'); b.innerHTML = '<span>🏠</span><small>ホーム</small>'; b.onclick = e => { e.stopPropagation(); KB.sfx('click'); fabHome(); }; document.body.appendChild(b); }
  document.body.classList.add('has-fab');
}
function fabHome() {
  if (S.view === 'game' && S.game) {
    if (S.spectate) { act('watch-quit'); return; }
    if (S.attack) { act('quit'); return; } // バッジアタックは今までどおり「中止しますか？」
    const resume = S.T && !S.tiebreak && !S.game.over;
    modal(`<div class="op-lines"><div class="op-line masa"><div class="cm-av">${KB.casterSVG('masa', 'normal')}</div><div class="op-bubble"><span class="cm-name">実況・ナニワのマサ</span>${resume ? 'いったんホームに戻るで。続きは、ホームの「続きから」でいつでも再開できるからな！' : 'ホームに戻るで。ええか？'}</div></div></div>
      <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn" data-act="close">続ける</button><button class="btn primary" data-act="fab-home-go">🏠 ホームへ</button></div>`);
    pauseGame(); return;
  }
  if (S.view === 'hunt') { const q = document.querySelector('[data-act="hunt-quit"]'); if (q && S.hunt && S.hunt.started && !S.hunt.over) { q.click(); return; } }
  go('home');
}
function render() {
  const app = $('#app'); syncFab(); syncStg();
  if (ARTIFACT_CLOSED) { app.innerHTML = closedHTML(); closedBind(); return; }
  if (S.view === 'home') { app.innerHTML = homeHTML(); homeCastLoad(); if (CLOUD_ON && PID && (S.srvNotesPid !== PID || Date.now() - (S.srvNotesAt || 0) > 60000)) notesFetch().then(notesBadge); if (CLOUD_ON && PID && (S.rvByPid !== PID || Date.now() - (S.rvByAt || 0) > 60000)) rvByFetch(true).then(() => { const b = $('#pb-rv'); if (b && S.view === 'home') { b.innerHTML = rvcHTML(rivalsOf(), rvByMine(), S.settings.name); b.querySelectorAll('[data-act]').forEach(x => x.onclick = () => act(x.dataset.act, x)); } }); if (ON_ENABLED() && Date.now() - (ON.toursAt || 0) > 10000) { ON.toursAt = Date.now(); onToursLoad(); } }
  else if (S.view === 'setup-practice') app.innerHTML = setupPracticeHTML();
  else if (S.view === 'setup-tour') app.innerHTML = setupTourHTML();
  else if (S.view === 'game') app.innerHTML = gameHTML();
  else if (S.view === 'set-end') app.innerHTML = setEndHTML();
  else if (S.view === 'result') app.innerHTML = resultHTML();
  else if (S.view === 'entrance') { app.innerHTML = entranceHTML(); entranceScroll(); }
  else if (S.view === 'opening') app.innerHTML = openingHTML();
  else if (S.view === 'strategy') app.innerHTML = strategyHTML();
  else if (S.view === 'growth') app.innerHTML = growthHTML();
  else if (S.view === 'drill') app.innerHTML = drillHTML();
  else if (S.view === 'attack-result') app.innerHTML = attackResultHTML();
  else if (S.view === 'zukan') app.innerHTML = zukanHTML();
  else if (S.view === 'hunt') app.innerHTML = huntHTML();
  else if (S.view === 'online') { app.innerHTML = onlineHTML(); setTimeout(onBind, 0); }
  else if (S.view === 'otour') { app.innerHTML = otourHTML(); setTimeout(() => { onTourClock(); onCeremony(ON.t); }, 0); }
  else if (S.view === 'oarch') app.innerHTML = oarchHTML();
  else if (S.view === 'hunt-result') app.innerHTML = huntResultHTML();
  else if (S.view === 'rules') app.innerHTML = rulesHTML();
  else if (S.view === 'story') app.innerHTML = storyHTML();
  else if (S.view === 'numbers') app.innerHTML = numbersHTML();
  else if (S.view === 'ranking') { app.innerHTML = rankingHTML(); rankingLoad(); }
  bind();
}

// ---------- 利用状況（開かれた回数・利用者数・開始/完走の回数） ----------
// 1人につき1つの記録（stats/<利用者ID>）に自分の回数だけを書く。名前や手札などは記録しない。
const STAT = { q: [], ready: false, busy: false, doc: null, ref: null, admin: false };
(async () => {
  try {
    const c = window.claude; if (!c || !c.use) return;
    const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
    if (!user) return;
    STAT.admin = !!(await user.canEdit());
    STAT.db = db;
    if (STAT.admin && S.view === 'home') render(); // 表示ボタンを出す
    if (!db) return;
    const uid = await user.id(); if (!uid) return;
    STAT.ref = db.doc('stats/' + uid);
    const snap = await STAT.ref.get();
    STAT.doc = snap.exists ? Object.assign({}, snap.data()) : { firstAt: new Date().toISOString() };
    STAT.ready = true;
    flushStats();
  } catch (e) { }
})();
function stat(k) { STAT.q.push(k); flushStats(); }
async function flushStats() {
  if (!STAT.ready || STAT.busy || !STAT.q.length) return;
  STAT.busy = true;
  const ks = STAT.q.splice(0);
  const d = STAT.doc;
  for (const k of ks) d[k] = (+d[k] || 0) + 1;
  d.lastAt = new Date().toISOString();
  try { await STAT.ref.set(d); } catch (e) { STAT.ready = false; } // 書き込めない閲覧者は数えない
  STAT.busy = false;
  if (STAT.q.length) flushStats();
}
stat('opens');
async function showStats() {
  if (!STAT.db) return;
  modal('<h2>利用状況</h2><p class="muted">集計しています…</p>');
  try {
    const qs = await STAT.db.collection('stats').get();
    const t = { opens: 0, pStart: 0, pDone: 0, tStart: 0, tDone: 0 }; let first = null, active7 = 0;
    const now = Date.now();
    qs.docs.forEach(x => { const d = x.data() || {}; for (const k in t) t[k] += +d[k] || 0; if (d.firstAt && (!first || d.firstAt < first)) first = d.firstAt; if (d.lastAt && now - Date.parse(d.lastAt) < 7 * 864e5) active7++; });
    const row = (a, b) => `<tr><td>${a}</td><td class="tnum" style="text-align:right"><b>${b}</b></td></tr>`;
    modal(`<h2>利用状況</h2><table class="st"><tbody>
      ${row('開かれた回数', t.opens)}${row('ユニークユーザー数', qs.size)}${row('うち直近7日に開いた人', active7)}
      ${row('練習を始めた回数', t.pStart)}${row('練習を最後まで終えた回数', t.pDone)}
      ${row('大会を始めた回数', t.tStart)}${row('大会を最後まで終えた回数', t.tDone)}</tbody></table>
      <p class="small muted" style="margin:0">${first ? `集計開始：${first.slice(0, 10)}。` : ''}サインインして開き、データの書き込みが許可されている人だけを数えています（共有の設定によっては、組織外からリンクで開いた人は数えられません）。名前や対局内容は記録していません。</p>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div>`);
  } catch (e) { modal('<h2>利用状況</h2><p class="muted">読み込めませんでした。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div>'); }
}

// ---------- ホームの博士とマサ：博士＝公式ルール（博士の言葉での要約・出典つき）、マサ＝次に何をするかのアドバイス・ライバルと比較 ----------
const RULE_SRC = 'https://soogackuma.com/18/', RULE_SITE = 'https://keisan-bridge.amebaownd.com/';
function hostRules() {
  const P = [
    ['使う札', 'トランプ52枚（ジョーカーなし）。A＝1、J＝11、Q＝12、K＝13 として数えます。'],
    ['はじめ', 'ひとり7枚ずつ配ります。'],
    ['場の数', '巡ごとに山札から1枚めくり、その数が「場の数」になります。'],
    ['出し方', '手番が来たら、手札の1〜3枚を ＋ − × ÷ とかっこで組み合わせ、ちょうど場の数になる式を作れたら出せます。割り算は割り切れるときだけです。'],
    ['引く', '作れないときは山札から1枚引きます。作れても、あえて出さずに引いてもかまいません。'],
    ['終わり', 'だれかの手札が0枚になった瞬間にゲーム終了。ほかの人は、残った手札の数の合計がペナルティ（PP）になります。'],
    ['順位', '何ゲームか続けて、PPの合計が少ない人ほど上位です。']];
  modal(`<div class="stack host-m"><div class="host-mh"><span class="cm-av">${KB.casterSVG('root', 'happy')}</span><div><small>解説・ルート博士</small><b>計算ブリッジのルールを、わたしの言葉でまとめておきましょう。</b></div></div>
    <dl class="rule-dl">${P.map(([h, t]) => `<dt>${h}</dt><dd>${t}</dd>`).join('')}</dl>
    <p class="small rule-src">出典：<a href="${RULE_SRC}" target="_blank" rel="noopener">計算ブリッジ 公式ルール</a>（考案：上野晋太郎さん／すうがっくま）。この画面は、公式ルールをもとに博士が要約したものです。くわしい決まりや最新のルールは、必ず公式ページでご確認ください。</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn sm" href="${RULE_SRC}" target="_blank" rel="noopener">公式ルールを開く ↗</a><a class="btn sm" href="${RULE_SITE}" target="_blank" rel="noopener">公式サイト ↗</a></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn sm" data-act="adv-go" data-go="rules">このアプリでの前提</button><button class="btn sm" data-act="adv-go" data-a="tut-start">チュートリアルで学ぶ</button><button class="btn primary" data-act="close">閉じる</button></div></div>`);
}
// バッジの進み具合（回数で数える系統だけ。決まった条件のものは別に扱う）
function advCount(g, k) { const c = g.cnt || {}; return k === 'sutemi' ? Math.min(c.aete || 0, 10) : k === 'set_low' ? (c.set_low || 0) : (c[k] || 0); }
function advNearBadges(g) {
  const out = [], skipK = ['rating', 'on_podium', 'off_podium', 'qualify_strong', 'champion_strong', 'toushi', 'set_low', 'atk_bp', 'atk_badges'];
  ACH.forEach(a => { const k = a[0]; if (skipK.includes(k)) return;
    for (let i = 0; i < a[2].length; i++) { const t = a[2][i]; if (g.ach[k + ':' + t]) continue; if (k === 'sutemi' && t > 10) break;
      const c = advCount(g, k); out.push({ k, i, t, c, left: Math.max(1, t - c), ratio: t ? c / t : 0, name: a[4][i], series: a[1], cond: a[3](t), bp: bpOf(k, i), tier: ['銅', '銀', '金'][a[5] ? a[5][i] : Math.min(i, 2)] }); break; } });
  return out.sort((x, y) => y.ratio - x.ratio || x.left - y.left);
}
// どこでその系統が進むか（アドバイスの「やってみる」ボタン）
function advWhere(k) {
  if (['hunt', 'zukan', 'zukan_cat'].includes(k) || /^quick|snap|blitz/.test(k)) return k === 'zukan' || k === 'zukan_cat' ? { a: 'hunt-start', l: '式ハンターへ' } : { go: 'setup-practice', l: '練習へ' };
  if (/^outs/.test(k)) return { a: 'drill', l: 'アウツチャレンジへ' };
  if (k === 'chart') return { a: 'chart-open', l: '早見表へ' };
  if (/^atk/.test(k)) return { a: 'attack-start', l: 'バッジアタックへ' };
  if (MB_TOUR.includes(k)) return { go: 'setup-tour', l: '大会へ' };
  return { go: 'setup-practice', l: '練習へ' };
}
// アドバイスの文の中のバッジ名を押せるように（押すとバッジの詳細。そこから「アドバイスに戻る」）
const advB = (k, i) => { const a = ACH.find(x => x[0] === k); return a ? { k, i, name: a[4][i] } : null; };
function advText(t) { let h = esc(t.text); (t.bs || []).filter(Boolean).forEach(b => { const q = `「${esc(b.name)}」`; h = h.split(q).join(`<button class="adv-b" data-advb="${b.k}:${b.i}">${q}</button>`); }); return h; }
function advModal(html) {
  modal(html);
  document.querySelectorAll('#modal [data-advb]').forEach(el => el.onclick = () => { const [k, i] = el.dataset.advb.split(':'); S.advBack = () => advModal(html); KB.sfx('select'); badgeTalk(k, +i); });
}
// ホームを開いたとき、マサが「アドバイスするで〜」と手招き（まだ一度も押していない人はずっと、押したことのある人は開いた最初の1回だけ・10秒）
const R0 = a => a[(Date.now() / 60000 | 0) % a.length];
function masaBeckon() {
  let used = false; try { used = localStorage.getItem('kb.masaUsed') === '1'; } catch (e) { }
  if (!used) return true;
  if (S.masaBeckoned) return false;
  if (!S.masaBeckonAt) { S.masaBeckonAt = Date.now(); setTimeout(() => { S.masaBeckoned = true; const b = $('.host-r.beckon'); if (b) { b.classList.remove('beckon'); const say = b.querySelector('.host-say'); if (say) say.textContent = 'ほな、いこか！'; } }, 10000); }
  return Date.now() - S.masaBeckonAt < 10000;
}
function masaAdvice(more) {
  const g = G_(), nG = (g.games || []).length, nm = san(S.settings.name || 'あなた'), r = ratingOf(g.games || []), R = a => a[(Math.random() * a.length) | 0];
  const tips = [], add = (w, text, btn, bs) => tips.push({ w: w * (0.6 + Math.random() * 0.8), text, btn, bs });
  if (nG < 10) { // はじめのころ
    add(5, `${nm}、まずは「はじめて」のセットで1セット打ってみよか！相手は★1〜2や。迷ったら「AIの読み」を開いて、最善手と見比べるんがいちばんの近道やで。`, { go: 'setup-practice', l: '練習へ' });
    add(3, 'ルールがあやふやなら、博士とおれのチュートリアルや。3分で式の作り方と「あえて引く」のコツまで分かるで！', { a: 'tut-start', l: 'チュートリアル' });
    add(3, '達人の打ち方を見るのもええ練習や。「観戦」で★5がどこで引いて、どこで3枚出すか見てみ！サッカーでもうまい人の試合を見るのが上達の早道や。', { a: 'watch-start', l: '観戦へ' });
    add(2, '早見表を1行だけ作ってみ。「A・2・6」みたいな待ちの広い組み合わせが分かると、手札の残し方が変わるで！', { a: 'chart-open', l: '早見表へ' });
  }
  const near = advNearBadges(g).filter(b => b.c > 0 || nG >= 3);
  near.slice(0, 6).forEach((b, i) => { const w = advWhere(b.k);
    add(i < 2 ? 4 : 2, R([`「${b.name}」（${b.series}・${b.tier}）まで、あと${b.left}回や！条件は「${b.cond}」。${b.bp}BPもらえるで！`, `狙い目は「${b.name}」や。${b.cond}でもらえる${b.tier}バッジ、いま${b.c}/${b.t}やから、あと${b.left}回！ゴールは近いで！`]), w, [advB(b.k, b.i)]); });
  // 冠（カテゴリーの特別バッジ）：残りが少ない系統
  ACH_GROUPS.forEach(([gn, ks], gi) => { const cp = catProgress(g, gi); if (cp.done || !cp.have) return; const miss = []; ks.forEach(k => { const a = ACH.find(x => x[0] === k); if (a) a[2].forEach((t, i) => { if (!g.ach[k + ':' + t]) miss.push(advB(k, i)); }); });
    if (miss.length <= 3) add(4, `冠「${cp.name}」（${gn}）まで、あと${miss.length}個や！残りは${miss.map(x => `「${x.name}」`).join('・')}。そろえたら${BP_CAT}BPとアバターの特別セットやで！`, null, miss); });
  // ミニゲーム
  const c = g.cnt || {};
  if (!c.outs3) add(2, 'アウツチャレンジ、まだ手ぇつけてへんな？「次の場でいくつ上がれるか」を当てる練習や。ポーカーのアウツ計算と同じで、強い人はみんなこれが速いで！', { a: 'drill', l: 'アウツチャレンジへ' });
  if ((c.chart || 0) < 10) add(2, `早見表、いま${c.chart || 0}行完成や。完成した行は対局中に見返せるから、作れば作るほど本番で得するで！`, { a: 'chart-open', l: '早見表へ' });
  if (!c.zukan || c.zukan < 50) add(2, '式ハンターで式を集めると、図鑑も早撃ちのバッジも進むで。3分だけでもええ、リフティングみたいなもんや！', { a: 'hunt-start', l: '式ハンターへ' });
  if (!c.atk_done) add(2, 'バッジアタック（15分）でどれだけBPを稼げるか、いっぺん挑戦してみ！ランキングにも載るで！', { a: 'attack-start', l: 'バッジアタックへ' });
  // 苦手な場面
  try { const cs = catStats(g.games || []).filter(x => x.n >= 5).sort((a, b) => b.bad - a.bad)[0]; if (cs && cs.bad >= 0.3) add(3, `データで見ると、苦手は「${cs.label}」の場面や（悪手の割合${Math.round(cs.bad * 100)}%）。次の練習はそこだけ意識してみ！弱点のサイドを固めたら失点は減るで！`, { go: 'growth', l: '成長記録へ' }); } catch (e) { }
  // 推定実力
  if (r.ok) { const nx = [3, 4, 4.5].find(t => !g.ach['rating:' + t]); if (nx && r.r >= nx && r.n < 40) add(3, `推定実力は★${r.r.toFixed(1)}、もう★${nx}に届いとる！「${(advB('rating', [3, 4, 4.5].indexOf(nx)) || {}).name}」は判断が40回たまったら判定やから、あと${40 - r.n}回、このまま打ち続けよ！`, { go: 'setup-practice', l: '練習へ' }, [advB('rating', [3, 4, 4.5].indexOf(nx))]); else if (nx && r.r < nx && r.r >= nx - 0.6) add(3, `推定実力★${r.r.toFixed(1)}、★${nx}のバッジ「${(advB('rating', [3, 4, 4.5].indexOf(nx)) || {}).name}」まであと少しや！直近100手の最善率と損失で決まるから、AIの読みを見ずに自分で読み切る手を増やそ！`, { go: 'setup-practice', l: '練習へ' }, [advB('rating', [3, 4, 4.5].indexOf(nx))]); }
  // 大会
  if (nG >= 10 && !c.qualify) add(3, '練習でだいぶ打てとるな。そろそろ大会で決勝進出を狙ってみよか！予選は「決勝進出率」で手を選ぶんがコツや。', { go: 'setup-tour', l: '大会へ' });
  if (c.qualify && !g.ach['qualify_strong:1']) add(2, '大会の相手を「強豪ぞろい」にして決勝に進むと、「猛者の切符」や。腕だめしにちょうどええで！', { go: 'setup-tour', l: '大会へ' }, [advB('qualify_strong', 0)]);
  if (CLOUD_ON && nG >= 3 && !rivalsOf().length) add(4, `${nm}、ライバルはまだおらんな？ランキングで実力が近い人をライバルにしてみ！ホームに相手の動きが届くし、おれが差の詰め方も教えたる。張り合いが出るで〜！サッカーもダービーマッチがいちばん燃えるんや！`, { go: 'ranking', l: 'ランキングで選ぶ' });
  const openT = (ON.tours || []).filter(t => t.phase === 'entry' && !t.entered && (t.entry !== 'invite' || t.invited));
  if (openT.length) add(4, `いま「${openT[0].name}」がエントリーできるで！オンライン大会で、人と打つ緊張感を味わってみ！`, null);
  // 重みつきで3つ（押すたびに少し変わる）
  const pick = []; const pool = tips.slice();
  while (pick.length < 3 && pool.length) { const tot = pool.reduce((a, t) => a + t.w, 0); let x = Math.random() * tot, i = 0; for (; i < pool.length; i++) { x -= pool[i].w; if (x <= 0) break; } pick.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]); }
  if (!pick.length) pick.push({ text: `${nm}、もうほとんどやり尽くしとるやんけ！あとは推定実力を上げて、ランキングのてっぺんを狙うだけや！`, btn: { go: 'ranking', l: 'ランキングへ' } });
  const intro = more ? R(['ほな、別の角度からもう一個いこか！', 'まだあるで！', 'ほんならこれはどうや！']) : R([`${nm}、次の一手で迷っとるんか？任しとき！`, `よっしゃ、${nm}のデータ見たで！`, `${nm}、作戦会議や！`]);
  advModal(`<div class="stack host-m"><div class="host-mh masa"><span class="cm-av">${KB.casterSVG('masa', 'happy')}</span><div><small>実況・ナニワのマサ</small><b>${esc(intro)}</b></div></div>
    <div class="adv-list">${pick.map((t, i) => `<div class="adv"><span class="adv-n">${i + 1}</span><div><p>${advText(t)}</p>${t.btn ? `<button class="btn sm" data-act="adv-go" ${t.btn.go ? `data-go="${t.btn.go}"` : `data-a="${t.btn.a}"`}>${esc(t.btn.l)} →</button>` : ''}</div></div>`).join('')}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end">${CLOUD_ON ? '<button class="btn" data-act="masa-rival">⚔ ライバルと比較</button>' : ''}<button class="btn" data-act="masa-more">🔄 ほかには？</button><button class="btn primary" data-act="close">閉じる</button></div></div>`);
}
// ライバル：ランキングの人を5人まで（プレイヤーごと）。ランキングに ⚔ の印、プロフィールに「だれから指定されているか」
const rivalsOf = () => store.get('rivals', []) || [];
// ---------- 通知（ホームのプロフィールの「🔔 通知」）：ライバル・ライバルの動き・大会（サーバー）と、自分のバッジ・記録・順位（端末） ----------
function noteAdd(kind, data) { try { if (!PID) return; const L = store.get('notes', []) || []; L.unshift(Object.assign({ id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now(), kind }, data)); store.set('notes', L.slice(0, 100)); notesBadge(); } catch (e) { } }
async function notesFetch() {
  const l = PID && plLink(PID); if (!l) return; S.srvNotesAt = Date.now();
  try { const j = await cloudReq('notes', { token: l.token, pid: PID }); S.srvNotes = (j.notes || []).map(n => Object.assign({ id: 's' + n.id, at: n.at * 1000, kind: n.kind }, n.data || {})); S.srvNotesPid = PID; } catch (e) { }
}
const notesAll = () => [...(store.get('notes', []) || []), ...(S.srvNotesPid === PID ? S.srvNotes || [] : [])].sort((a, b) => b.at - a.at);
const notesUnread = () => { const seen = store.get('notesSeen', 0) || 0; return notesAll().filter(n => n.at > seen).length; };
function notesBadge() { const b = $('#pb-nb'); if (!b) return; const n = notesUnread(); b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }
const agoJa = t => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'たった今' : m < 60 ? `${m}分前` : m < 1440 ? `${Math.floor(m / 60)}時間前` : `${Math.floor(m / 1440)}日前`; };
function noteText(n) {
  const me = san(S.settings.name || 'あなた'), A = (k, i) => { const a = ACH.find(x => x[0] === k); return a ? a : null; };
  const bn = key => { const [k, t] = String(key).split(':'), a = A(k); if (!a) return key; const i = a[2].indexOf(+t); return i >= 0 ? a[4][i] : key; };
  switch (n.kind) {
    case 'rival': return n.back ? ['🔁', `${san(n.who)}がライバルバックしました`] : ['⚔', `${san(n.who)}が${me}をライバルにしました`];
    case 'rv_badge': return ['🏅', `ライバルの${san(n.who)}が「${bn((n.ach || [])[0])}」${n.n > 1 ? `ほか${n.n - 1}個` : ''}を取りました`];
    case 'rv_bp': return ['📈', `ライバルの${san(n.who)}が、BPで${me}を抜きました（${n.bp}BP）`];
    case 'invite': return ['✉', `${n.host ? san(n.host) + 'から' : ''}オンライン大会「${n.tname}」に招待されました`];
    case 'award': return ['🏆', `${n.official ? '公式大会' : 'オンライン大会'}「${n.tname}」で${n.place}位に入りました`];
    case 'soon': { const d = new Date(n.at * 1000); return ['⏰', `エントリーした「${n.tname}」がまもなく始まります（${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}）`]; }
    case 'badge': { const a = A(n.k); return a ? ['🎖', `「${a[4][n.i]}」（${a[1]}・${['銅', '銀', '金'][a[5] ? a[5][n.i] : Math.min(n.i, 2)]}）を取りました`] : ['🎖', 'バッジを取りました']; }
    case 'cat': return ['👑', `冠「${CAT_SPECIAL[(ACH_GROUPS[n.gi] || [])[0]] || ''}」（${(ACH_GROUPS[n.gi] || [])[0] || ''}）を達成しました`];
    case 'rating': return ['⭐', `推定実力の最高が★${(+n.v).toFixed(1)}になりました`];
    case 'streak': return ['🔥', `連続最善の自己ベストを${n.v}回に更新しました`];
    case 'rank': return ['📊', `総合ランキング（${n.lab}）が${n.from}位から${n.v}位に上がりました`];
  }
  return ['🔔', 'お知らせ'];
}
// 頭の小さなアイコン：人の通知はその人の顔（右下に種類の印）、バッジ・冠はその絵、大会は大会の印、自分の記録は自分の顔
function noteIcon(n, mark) {
  const av = a => `<span class="nt-av">${KB.avatarSVG(Object.assign({}, AVATAR_DEF, a || {}), { mood: 'happy' })}</span>`;
  if (['rival', 'rv_badge', 'rv_bp'].includes(n.kind)) return `<span class="nt-icw">${av(n.av)}<i class="nt-mk">${mark}</i></span>`;
  if (n.kind === 'badge') { const a = ACH.find(x => x[0] === n.k); return `<span class="nt-icw">${a ? badgeSVG(a, n.i, true, 28) : mark}</span>`; }
  if (n.kind === 'cat') return `<span class="nt-icw">${emblemSVG(n.gi, true, 28)}</span>`;
  if (['invite', 'award', 'soon'].includes(n.kind)) return `<span class="nt-icw"><span class="nt-tour">🏆</span>${n.kind !== 'award' ? `<i class="nt-mk">${mark}</i>` : ''}</span>`;
  return `<span class="nt-icw">${av(myAvatar())}<i class="nt-mk">${mark}</i></span>`;
}
function notesOpen(more) {
  const L = notesAll(), N = more ? (S.notesN || 40) : (S.notesN = 40), seen = store.get('notesSeen', 0) || 0; S.notesList = L;
  const rows = L.slice(0, N).map((n, i) => { const [ic, tx] = noteText(n); return `<button class="nt-row ${n.at > seen ? 'new' : ''}" data-act="note-go" data-i="${i}"><span class="nt-ic">${noteIcon(n, ic)}</span><span class="nt-tx">${esc(tx)}</span><small class="nt-at">${agoJa(n.at)}</small></button>`; }).join('');
  modal(`<div class="stack nt-m"><h3 style="margin:0">🔔 通知</h3>${L.length ? `<div class="nt-list">${rows}</div>${L.length > N ? '<button class="btn sm" data-act="notes-more">もっと見る</button>' : ''}` : '<p class="small muted" style="margin:0">まだ通知はありません。バッジを取ったり、ライバルに指定されたりすると、ここに届きます。</p>'}
    <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div></div>`);
  if (L.length) store.set('notesSeen', Math.max(seen, L[0].at)); notesBadge();
}
function noteGo(i) {
  const n = (S.notesList || [])[i]; if (!n) return;
  if (n.rid) { rankCardOpen(n.rid, false, null); return; }
  if (n.kind === 'badge') { S.advBack = notesOpen; badgeTalk(n.k, n.i); return; }
  if (n.tid) { closeModal(); act('on-tour-open', { dataset: { id: n.tid } }); return; }
  if (n.kind === 'rank') { closeModal(); go('ranking'); return; }
  if (n.kind === 'cat' || n.kind === 'rating' || n.kind === 'streak') { closeModal(); go('growth'); return; }
}
// ライバル（自分が指定した人）・ライバラー（自分をライバルに指定した人）の数。お互いに指定していれば「ライバルバック」。フォロー・フォロワーのように、押すと一覧（名前を押すとプロフィール）
const rvByMine = () => S.rvByPid === PID ? (S.rvBy || []) : [];
async function rvByFetch(force) {
  if (!force && Date.now() - (S.rvByAt || 0) < 60000) return; S.rvByAt = Date.now();
  const l = PID && plLink(PID); if (!l) return;
  try { const j = await cloudReq('rival_by', { token: l.token, pid: PID }); S.rvBy = j.list || (j.names || []).map(n => ({ name: n })); S.rvByPid = PID; } catch (e) { }
}
function rvcHTML(rivals, by, name) {
  if (!S.rvSets || Object.keys(S.rvSets).length > 60) S.rvSets = {}; const id = 'r' + Object.keys(S.rvSets).length; S.rvSets[id] = { rivals, by, name };
  const mu = rivals.filter(x => x.rid && by.some(y => y.rid === x.rid)).length;
  return `<span class="pv-rvc"><button class="rvc" data-act="rv-list" data-k="${id}:r"><b>${rivals.length}</b> ⚔ ライバル</button><button class="rvc" data-act="rv-list" data-k="${id}:b"><b>${by.length}</b> ライバラー</button>${mu ? `<button class="rvc mu" data-act="rv-list" data-k="${id}:m"><b>${mu}</b> 🔁 ライバルバック</button>` : ''}</span>`;
}
function rvListModal(key) {
  const [id, tab] = String(key).split(':'), d = (S.rvSets || {})[id]; if (!d) return;
  const back = $('#modal') ? $('#modal .modal').innerHTML : null;
  const isMu = x => x.rid && d.rivals.some(a => a.rid === x.rid) && d.by.some(b => b.rid === x.rid);
  const row = x => x.rid ? `<button class="rv-li" data-act="rank-card" data-rid="${esc(x.rid)}"><span class="rv-nm">${esc(x.name)}${isMu(x) ? '<em class="rv-mu">🔁 ライバルバック</em>' : ''}</span><span>›</span></button>` : `<span class="rv-li">${esc(x.name)}</span>`;
  const sec = (h, L, empty) => `<div class="rv-sec"><b>${h}（${L.length}人）</b>${L.length ? L.map(row).join('') : `<small class="muted">${empty}</small>`}</div>`;
  const A = sec(`⚔ ${esc(san(d.name))}のライバル`, d.rivals, 'まだだれもライバルにしていません'), B = sec(`ライバラー（${esc(san(d.name))}をライバルにしている人）`, d.by, 'まだいません'), M = sec('🔁 ライバルバック（お互いにライバル）', d.rivals.filter(isMu), 'まだいません');
  modal(`<div class="stack rv-lm">${tab === 'm' ? M + A + B : tab === 'b' ? B + A : A + B}<p class="small muted" style="margin:0">名前を押すとプロフィールが開きます。ライバルはランキングの人のプロフィールから「⚔ ライバルにする」で登録できます（5人まで）。自分をライバルにしている人をライバルにし返すと「ライバルバック」です。</p>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div></div>`);
}
async function rivalToggle(rid, name) {
  if (!rid) return; const L = rivalsOf(), on = !L.some(x => x.rid === rid);
  if (on && L.length >= 5) { toast('ライバルは5人までです'); return; }
  const l = PID && plLink(PID);
  try { if (l) await cloudReq('rival_set', { token: l.token, pid: PID, rid, on: on ? 1 : 0 }); } catch (e) { toast(e.message || 'できませんでした'); return; }
  store.set('rivals', on ? L.concat([{ rid, name }]) : L.filter(x => x.rid !== rid));
  toast(on ? (rvByMine().some(x => x.rid === rid) ? `🔁 ${name}とライバルバック！お互いにライバルです` : `⚔ ${name}をライバルにしました`) : `${name}をライバルから外しました`); KB.sfx('select');
  const b = $('#modal [data-act="rival-toggle"]'); if (b) { b.outerHTML = rivalBtnHTML(rid, name); bindModalActs(); }
  // 開いているプロフィールの「ライバラー」の数も新しくする
  if ($('#modal .pv-rvc')) fetch(CLOUD_API + '?a=card&rid=' + encodeURIComponent(rid)).then(r => r.json()).then(j => { const bx = $('#modal .pv-rvc'); if (!j.ok || !bx) return; bx.outerHTML = rvcHTML(j.card.rivals || [], j.card.rivalBy || [], j.card.name || name); bindModalActs(); }).catch(() => { });
  S.rvByAt = 0; // ホームの数も読み直す
  if (S.view === 'ranking') render();
}
const rivalBtnHTML = (rid, name) => { const on = rivalsOf().some(x => x.rid === rid), back = rvByMine().some(x => x.rid === rid); return `<button class="btn ${on ? '' : 'primary'} sm" data-act="rival-toggle" data-rid="${esc(rid)}" data-name="${esc(name)}">${on ? 'ライバルから外す' : back ? '🔁 ライバルバックする' : '⚔ ライバルにする'}</button>`; };
function rivalPick() {
  const L = rivalsOf();
  modal(`<div class="stack host-m"><div class="host-mh masa"><span class="cm-av">${KB.casterSVG('masa', 'smug')}</span><div><small>実況・ナニワのマサ</small><b>${L.length ? 'どのライバルと比べる？' : 'ライバルがまだおらんな！'}</b></div></div>
    ${L.length ? `<div class="rv-pick">${L.map(x => `<button class="btn" data-act="rival-cmp" data-rid="${esc(x.rid)}" data-name="${esc(x.name)}">⚔ ${esc(x.name)}</button>`).join('')}</div>` : '<p class="small" style="margin:0">ランキングで気になる人を押して、プロフィールの「⚔ ライバルにする」を押してな。5人まで登録できるで！</p>'}
    <div class="row" style="gap:8px;justify-content:flex-end"><button class="btn" data-act="adv-go" data-go="ranking">ランキングで選ぶ</button><button class="btn primary" data-act="close">閉じる</button></div></div>`);
}
async function rivalCompare(rid, name) {
  modal(`<div class="stack host-m"><p class="small muted">${esc(name)}のデータを読んでいます…</p></div>`);
  let d; try { const j = await (await fetch(CLOUD_API + '?a=card&rid=' + encodeURIComponent(rid))).json(); if (!j.ok) throw new Error(j.error); d = j.card; } catch (e) { modal(`<div class="stack host-m"><p>${esc(name)}のデータを読み込めませんでした（ランキングから外れた可能性があります）。</p><div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div></div>`); return; }
  const me = cardDataOf(PID, S.settings.name), g = G_(), ra = Object.fromEntries((d.ach || []).map(k => [k, 1])), rg = { ach: ra };
  const myBp = bpTotal(g), rvBp = bpTotal(rg), myB = Object.keys(g.ach).filter(k => /^[a-z0-9_]+:\d+$/i.test(k) && g.ach[k]).length, rvB = (d.ach || []).length;
  const rows = [['推定実力', me.rating, d.rating, v => v == null ? '—' : '★' + (+v).toFixed(1)], ['BP', myBp, rvBp, v => v + ' BP'], ['バッジ', myB, rvB, v => v + '個'], ['連続最善', me.streak, d.streak || 0, v => v + '回'], ['バッジアタック', me.atk, d.atk || 0, v => v ? v + ' BP' : '—'], ['式の図鑑', me.zukan, d.zukan || 0, v => v + '式']];
  const nmR = san(name), tips = [];
  if (rvBp > myBp) { const gap = rvBp - myBp, nb = advNearBadges(g), cand = (nb.filter(b => b.c > 0).length ? nb.filter(b => b.c > 0) : nb).slice(0, 8).sort((a, b) => a.left - b.left || b.bp - a.bp); /* 手をつけている系統から */ let s2 = 0; const use = []; for (const b of cand) { if (s2 > gap) break; use.push(b); s2 += b.bp; }
    tips.push({ text: s2 > gap ? `BPは${gap}差や。${use.map(b => `「${b.name}」（+${b.bp}・あと${b.left}回）`).join('と')}で逆転できるで！` : `BPは${gap}差や。まずは${use.slice(0, 2).map(b => `「${b.name}」（+${b.bp}）`).join('と')}から詰めていこ！`, bs: use.map(b => advB(b.k, b.i)) }); }
  else tips.push(myBp > rvBp ? `BPは${myBp - rvBp}リードや！せやけど油断したらあかん、試合は90分あるんや！` : 'BPは同点や！ここからが勝負やで！');
  const theirs = ACH.flatMap(a => a[2].map((t, i) => ({ a, i, key: a[0] + ':' + t }))).filter(x => ra[x.key] && !g.ach[x.key]);
  if (theirs.length) { const x = theirs.sort((p, q) => bpOf(p.a[0], p.i) - bpOf(q.a[0], q.i))[0]; tips.push({ text: `${nmR}が持っとって、${san(S.settings.name)}が持ってへんバッジが${theirs.length}個ある。取りやすいのは「${x.a[4][x.i]}」や。条件は「${x.a[3](x.a[2][x.i])}」やで！`, bs: [advB(x.a[0], x.i)] }); }
  if (me.rating != null && d.rating != null) tips.push(d.rating > me.rating + 0.05 ? `推定実力は${nmR}が★${(d.rating - me.rating).toFixed(1)}上や。AIの読みを見ずに打った手の最善率を上げるんが一番の近道や！` : me.rating > d.rating + 0.05 ? `推定実力はこっちが★${(me.rating - d.rating).toFixed(1)}上や！判断の質では勝っとるで！` : '推定実力はほぼ互角や！ライバルとして申し分なしや！');
  if ((d.streak || 0) > me.streak) tips.push(`連続最善は${nmR}が${d.streak}回、こっちは${me.streak}回や。一手ずつ「最善かどうか」を意識して打つと伸びるで！`);
  advModal(`<div class="stack host-m"><div class="host-mh masa"><span class="cm-av">${KB.casterSVG('masa', rvBp > myBp ? 'worried' : 'happy')}</span><div><small>実況・ナニワのマサ</small><b>${esc(san(S.settings.name))} vs ${esc(nmR)}、データで比べたで！</b></div></div>
    <div class="rv-cmp"><div class="rv-h"><span></span><b>${esc(S.settings.name)}</b><b>⚔ ${esc(name)}</b></div>${rows.map(([l, a, b, f]) => { const A = a == null ? -1 : +a, B = b == null ? -1 : +b; return `<div class="rv-r"><span>${l}</span><b class="${A > B ? 'win' : ''}">${f(a)}</b><b class="${B > A ? 'win' : ''}">${f(b)}</b></div>`; }).join('')}</div>
    <div class="adv-list">${tips.slice(0, 3).map((t, i) => `<div class="adv"><span class="adv-n">${i + 1}</span><div><p>${advText(typeof t === 'string' ? { text: t } : t)}</p></div></div>`).join('')}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn" data-act="masa-rival">ほかのライバル</button><button class="btn primary" data-act="close">閉じる</button></div></div>`);
}
// ---------- 成長記録：実力レーティング・場面別の苦手分析・課題・称号 ----------
// レーティングの基準：自分の席をAIに打たせて実測した「1判断あたりの平均損失pt」と「最善率」
// 2026-11-10 測り直し（最善扱いの幅を1巡目3.5pt・2巡目2.0ptにして、1手10ptの頭打ちで、各★のAIに約400手ずつ）
// ★1 3.45pt/50%　★2 2.86pt/55%　★3 2.24pt/63%　★4 1.23pt/79%　★5 0.34pt/93%
const RATE_LOSS = [[5.5, 0.3], [3.45, 1], [2.86, 2], [2.24, 3], [1.23, 4], [0.34, 5], [0, 5.5]];
const RATE_BEST = [[0.28, 0.3], [0.50, 1], [0.55, 2], [0.63, 3], [0.79, 4], [0.93, 5], [1, 5.5]];
function interp(tbl, x, desc) {
  for (let i = 0; i < tbl.length - 1; i++) {
    const [x0, y0] = tbl[i], [x1, y1] = tbl[i + 1];
    if (desc ? (x <= x0 && x >= x1) : (x >= x0 && x <= x1)) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return desc ? (x > tbl[0][0] ? tbl[0][1] : tbl[tbl.length - 1][1]) : (x < tbl[0][0] ? tbl[0][1] : tbl[tbl.length - 1][1]);
}
// 場面の分類（判断の得意・苦手を見るため。手を選ぶ前の状況で決まるものが中心）
const CATS = {
  opening: '序盤（第1・2巡）', midgame: '中盤（第3巡以降・手札5枚以上）', endgame: '終盤（手札4枚以下）', heavy: '手札が重い（8枚以上）',
  oppNear: '相手が残り2枚以下', oppThree: '相手が残り3枚',
  smallField: '小さい場（4以下）', midField: '中くらいの場（5〜9）', bigField: '大きい場（10以上）',
  three: '3枚出しもできる', bestThree: '3枚出しが最善', bestOne: 'あえて1枚出しが最善', leaveOne: '1枚残しが最善',
  drawChoice: '引くかどうかの判断', hardExpr: '割り算・かっこが最善'
};
// 博士の解説：その場面の意味と考え方
const CAT_INFO = {
  opening: ['第1・2巡の判断です。手札が7枚前後あり、選択肢がいちばん多い時期です。', '序盤は上がりよりも、重い札を処分しつつ「次の場で出せる形」を残すことが大切です。'],
  midgame: ['第3巡以降で、まだ手札が5枚以上ある場面です。', '相手の残り枚数が減ってくる時期です。上がりを急ぐか、PPを抑えるかの切り替えを意識しましょう。'],
  endgame: ['自分の手札が4枚以下の終盤です。', '残す札の組み合わせで、次の番に上がれる場の数（アウツ）が決まります。1枚残しより2〜3枚残しの方が待ちが広いことも多いです。'],
  heavy: ['手札が8枚以上にふくらんだ場面です。', '負けたときのPPが大きくなりやすいので、大きい札を含む3枚出しで一気に軽くする判断が重要です。'],
  oppNear: ['相手の誰かが残り2枚以下の場面です。', '上がられる可能性が高いので、手札の合計（PP）を減らす手が優先になりやすい局面です。'],
  oppThree: ['相手の誰かが残り3枚の場面です。', 'まだ少し余裕がありますが、次の巡で一気に上がられることもあります。PPの重い札は早めに。'],
  smallField: ['場の数が4以下の場面です。', '小さい場でも、引き算や割り算を使えば大きい札を絡められます。K−Qのような差も狙い目です。'],
  midField: ['場の数が5〜9の場面です。', '選択肢がいちばん多くなりやすい場です。2枚か3枚か、残す札の形で比べましょう。'],
  bigField: ['場の数が10以上の場面です。', '大きい場は、大きい札をそのまま、または足し算でまとめて処分できる好機です。'],
  three: ['3枚で出せる組み合わせがある場面です（実際に3枚出すかどうかは問いません）。', '3枚出しは枚数が一気に減りますが、残る札の柔軟さが落ちることもあります。いつも3枚が正解とは限りません。'],
  bestThree: ['AIの評価で、3枚出しが最善だった場面です。', 'ここで2枚以下にしてしまうと、枚数とPPの両方で損をしやすくなります。'],
  bestOne: ['複数枚の出し方もあるのに、1枚だけ出すのが最善だった場面です。', 'あえて札を残すことで、次の場に対応しやすい形や広い待ちを保てます。気づきにくい好手です。'],
  leaveOne: ['最善手を選ぶと手札が1枚だけ残る場面です。', '1枚残しは、その数字の場が来ないと上がれません。残す1枚の数字と、残り枚数をよく見て選びましょう。'],
  drawChoice: ['あえて引くのが最善だった場面と、あなたが出さずに引いた場面です。', '出せるときでも、出すと形が崩れるなら引く方が良いことがあります。逆に、出せるのに引くのは損になりやすいので注意。'],
  hardExpr: ['割り算やかっこを使う式が最善だった場面です。', '思いつきにくい式ほど、大きい札をまとめて処分できることがあります。かっこの使い方を覚えておきましょう。']
};
function catsOf(d) {
  const c = [], C = d.counts || KB.countsOf(d.hand), bm = d.bestStats && d.bestStats.m, mm = d.mineStats && d.mineStats.m, n = KB.nCounts(C);
  const all = KB.findMoves(C, d.t, 'all', 3);
  if (d.round <= 2) c.push('opening'); else if (n >= 5) c.push('midgame');
  if (n <= 4) c.push('endgame');
  if (n >= 8) c.push('heavy');
  const oppMin = Math.min(99, ...(d.opps || []).map(o => o.h));
  if (oppMin <= 2) c.push('oppNear'); else if (oppMin === 3) c.push('oppThree');
  if (d.t <= 4) c.push('smallField'); else if (d.t >= 10) c.push('bigField'); else c.push('midField');
  if (all.some(m => m.n === 3)) c.push('three');
  if (bm && bm.n === 3) c.push('bestThree');
  if (bm && bm.n === 1 && all.some(m => m.n >= 2)) c.push('bestOne');
  if (bm && n - bm.n === 1) c.push('leaveOne');
  if (!bm || !mm) c.push('drawChoice');
  if (bm && /[÷(]/.test(bm.expr)) c.push('hardExpr');
  return c;
}
// 称号：同じ出来事を1回・3回・10回…と重ねるごとに段階が上がる
// バッジ：同じ出来事を重ねるごとに段階が上がり、段階ごとに名前が変わる [キー, 系統名, 段階, 説明, 段階ごとの名前]
const ACH = [
  // 対局・継続
  ['games', '対局', [10, 50, 200], n => `${n}ゲームを記録`, ['ルーキー', 'レギュラー', '卓の主']],
  ['practice_set', '練習', [1, 5, 20], n => `練習を${n}セット最後まで`, ['練習の虫', '努力家', '鍛錬の鬼']],
  ['tour_done', '大会完走', [1, 3, 10], n => `大会を${n}回最後まで`, ['完走', '大会好き', '大会の鉄人']],
  // 勝利
  ['win', '上がり', [1, 10, 50], n => n === 1 ? '初めて上がる' : `${n}回上がる`, ['初ゴール', 'ゴールハンター', 'エースストライカー']],
  ['set_low', '低PPセット', [80, 90, 100], n => n >= 100 ? '1セットのPP合計0' : `1セットのPP合計${100 - n}以下`, ['省エネ', '鉄壁の守り', 'パーフェクトセット']],
  ['all_sets', '全セット優勝', [1, 3, 5], n => `大会の予選で全セット優勝（卓内1位）を${n}回`, ['全勝街道', '連覇の道', '無敗の王']],
  ['set_win', 'セット優勝', [1, 5, 20], n => `セット優勝（練習・大会の卓内1位）を${n}回`, ['卓のトップ', 'セット巧者', 'セットの覇者']],
  ['qualify', '決勝進出', [1, 3, 10], n => `大会で決勝に${n}回進む`, ['決勝の舞台', 'ファイナリスト', '決勝の顔']],
  ['champion', '優勝', [1, 3, 10], n => `大会で${n}回優勝`, ['チャンピオン', '王者', '絶対王者']],
  ['toushi', '透視破り', [1], () => '決勝で奥義「絶対透視」を受けながら優勝', ['透視破り']],
  // 強豪大会：段階は「強豪ぞろい」（銀）と「全員達人」（金）。6番目の要素は段階ごとの色（0銅・1銀・2金）
  ['qualify_strong', '強豪大会 決勝進出', [1, 2], n => n >= 2 ? '相手が「全員達人」の大会で決勝に進む' : '相手が「強豪ぞろい」の大会で決勝に進む', ['猛者の切符', '達人の切符'], [1, 2]],
  ['champion_strong', '強豪大会 優勝', [1, 2], n => n >= 2 ? '相手が「全員達人」の大会で優勝' : '相手が「強豪ぞろい」の大会で優勝', ['覇王', '達人王'], [1, 2]],
  // 判断の質
  ['streak5', '5連続最善', [1, 3, 10], n => `最善手の5連続を${n}回`, ['波に乗る', '好調キープ', '絶好調']],
  ['streak10', '10連続最善', [1, 2, 3], n => `最善手の10連続を${n}回`, ['止まらない', '快進撃', '無双']],
  ['perfect', 'パーフェクト', [1, 3, 10], n => `判断がすべて最善のゲーム（3回以上判断）を${n}回`, ['冴えた一局', '読み名人', '精密機械']],
  ['sutemi', '溜めと捨て身', [3, 10, 11], n => n >= 11 ? '上がれる場面で、あえて上がらない最善手（捨て身）を1回選ぶ（銅・銀もまとめて獲得）' : `出せるのに「あえて引く」のが最善の場面で、引くのを${n}回選ぶ`, ['急がば回れ', '溜めの名人', '逆転の策士']],
  ['perfect_set', '全手好手セット', [1, 2, 3], n => `判断5回以上・お手つきなし・AIの読みなしで、1セットの判断がすべて好手以上を${n}回`, ['完璧なセット', '精密機械', '最善の求道者']],
  ['no_foul_set', 'ノーミス', [1, 3, 10], n => `判定後モードでお手つきゼロのセットを${n}回`, ['慎重派', '完璧主義', '鉄壁の計算']],
  ['rating', '推定実力', [3, 4, 4.5], n => `推定実力★${n}に到達（直近の判断40回以上で）`, ['中級の壁突破', '上級者', '達人の域']],
  // 手と計算
  ['three', '3枚出し', [10, 50, 200], n => `3枚出しを累計${n}回`, ['三枚使い', 'トリプル職人', 'ハットトリック王']],
  ['div_paren', 'かっこ割り算', [1, 3, 10], n => `かっこ付きの割り算で${n}回出す`, ['割り算デビュー', 'かっこの魔術師', '割り算の美学']],
  ['bestpair', 'ベストペア', [1, 2, 3], n => `2・6のベストペアで${n}回上がる`, ['四つ葉', 'ベストカップル', 'ペアの達人']],
  ['miracle', 'ミラクルセット', [1, 2, 3], n => `A・2・6のミラクルセットで${n}回上がる`, ['ミラクル', '奇跡の再来', 'ミラクルメーカー']],
  ['miss_lucky', 'ミスがハマる', [1, 3, 10], n => `ミスで残した札が上がりにハマるのを${n}回`, ['茶柱くん', '勝利の女神', 'ラッキー王']],
  // 早撃ち
  ['quick5', '早撃ち', [1, 10, 50], n => `自分の番になって5秒以内に最善手を出すのを${n}回`, ['ファストドロー', 'ガンマン', '伝説のガンマン']],
  ['quick3', '電光石火', [1, 5, 20], n => `3秒以内に最善手を出すのを${n}回`, ['稲妻', '雷光', '光速の頭脳']],
  ['snap', '即断即決', [1, 5, 20], n => `1ゲームの判断（3回以上）がすべて10秒以内・好手以上を${n}回`, ['即断', '一刀両断', '迷いなき剣']],
  ['blitz', '速攻', [1, 3, 10], n => `最短の第3巡で上がり、自分の番を毎回10秒以内で打つのを${n}回`, ['速攻', '電撃戦', '秒殺']],
  ['quickdraw', 'クイックドロー', [1, 5, 20], n => `割り算を含む3枚出しの最善手を10秒以内に出すのを${n}回`, ['早業', '計算の早業師', '神業']],
  // アウツチャレンジ
  ['outs3', 'アウツ3問目', [1, 3, 10], n => `アウツチャレンジで3問目までヒントなしでクリアを${n}回`, ['数え上手', 'カウンター', 'カウント職人']],
  ['outs4', 'アウツ4問目', [1, 3, 10], n => `アウツチャレンジで4問目までヒントなしでクリアを${n}回`, ['見切り上手', '読み切り名人', '確率の目']],
  ['outs5', 'アウツチャレンジ', [1, 3, 10], n => `アウツチャレンジ（5問連続正解）をヒントなしで${n}回成功`, ['アウツ見習い', 'アウツ名人', '確率の鬼']],
  // バッジアタック（15分を最後までやり切ったときだけ数える）
  ['atk_done', 'アタック完走', [1, 5, 15], n => `バッジアタックを${n}回、時間いっぱいやり切る`, ['キックオフ', '常連アタッカー', 'アタックの鬼']],
  ['atk_bp', 'アタック得点', [300, 700, 1000], n => `1回のバッジアタックで${n}BP以上`, ['得点王候補', 'ゴールゲッター', '得点王']],
  // 式の図鑑
  ['zukan', '図鑑登録', [10, 50, 200], n => `式の図鑑に${n}式を登録`, ['式の見習い', '式の収集家', '式の博士']],
  ['zukan_cat', '図鑑の場', [1, 3, 13], n => n >= 13 ? '図鑑のA〜Kすべての場をコンプリート' : `図鑑の場を${n}つコンプリート（その場の式をすべて登録）`, ['ひと場制覇', '三場制覇', '全場制覇']],
  ['chart', '早見表', [1, 10, 37], n => n >= 37 ? '早見表をすべて完成（37行）' : `早見表の行を${n}行完成（すべての待ちを自分の式で埋める）`, ['早見表の一行目', '早見表の職人', '早見表マスター']],
  // オンライン大会（人が10人以上参加した大会の上位3位）。段階は3位以上（銅）・2位以上（銀）・優勝（金）。公式大会は別のバッジ
  ['on_podium', 'オンライン大会 表彰台', [1, 2, 3], n => n >= 3 ? 'オンライン大会（人が10人以上）で優勝' : n >= 2 ? 'オンライン大会（人が10人以上）で2位以上' : 'オンライン大会（人が10人以上）で3位以上', ['表彰台', '準優勝', 'オンライン王者'], [0, 1, 2]],
  ['off_podium', '公式大会 表彰台', [1, 2, 3], n => n >= 3 ? '公式のオンライン大会（人が10人以上）で優勝' : n >= 2 ? '公式のオンライン大会（人が10人以上）で2位以上' : '公式のオンライン大会（人が10人以上）で3位以上', ['公式の表彰台', '公式準優勝', '公式チャンピオン'], [0, 1, 2]],
  ['atk_badges', 'アタック収集', [10, 20, 30], n => `1回のバッジアタックでバッジを${n}個以上`, ['収集家', 'コレクター', 'バッジマスター']]
];
const ACH_GROUPS = [["対局・継続", ["games", "practice_set", "tour_done"]], ["勝利", ["win", "set_win", "set_low", "all_sets", "qualify", "champion", "toushi", "qualify_strong", "champion_strong"]], ["判断の質", ["streak5", "streak10", "perfect", "sutemi", "perfect_set", "no_foul_set", "rating"]], ["手と計算", ["three", "div_paren", "bestpair", "miracle", "miss_lucky"]], ["早撃ち", ["quick5", "quick3", "snap", "quickdraw", "blitz"]], ["アウツチャレンジ", ["outs3", "outs4", "outs5"]], ["バッジアタック", ["atk_done", "atk_bp", "atk_badges"]], ["式の図鑑", ["zukan", "zukan_cat", "chart"]], ["オンライン大会", ["on_podium", "off_podium"]]];
const ACH_TOTAL = ACH.reduce((a, x) => a + x[2].length, 0);
// バッジの対象になる条件（ゆるい設定でバッジが取れてしまわないように）
// ゲーム：4人以上の卓で、相手の平均の強さ★2.5以上／セット：さらに1セット5ゲーム以上／大会：参加15人以上・予選3セット以上・1セット5ゲーム以上・参加AIの平均★2.5以上
const ELIG = { table: 4, oppAvg: 2.5, games: 5, tourPlayers: 15, tourSets: 3, allSets: 4 };
function badgeElig(T) {
  if (!T || S.tiebreak) return { game: false, set: false, tour: false };
  const tb = (T.tables && T.tables[T.myTable]) || [];
  // 強さの条件は、抽選の結果ではなく「設定」で判定する（ランダムの相手は、選んだ構成の平均の強さとみなす）
  const mixAvg = MIX[T.cfg.mix] ? MIX_AVG(T.cfg.mix) : 3;
  let oppAvg, aiAvg = mixAvg;
  if (T.cfg.kind === 'practice' && T.cfg.opps) { const l = T.cfg.opps.map(o => o.level === 'r' ? mixAvg : +o.level || 0); oppAvg = l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0; aiAvg = oppAvg; }
  else oppAvg = mixAvg;
  const game = tb.length >= ELIG.table && oppAvg >= ELIG.oppAvg;
  const set = game && (T.cfg.games >= ELIG.games || !!T.attack); // バッジアタックは1セット3ゲームでもセットのバッジ対象
  const tour = T.cfg.kind === 'tournament' && T.cfg.nPlayers >= ELIG.tourPlayers && T.cfg.sets >= ELIG.tourSets && T.cfg.games >= ELIG.games && aiAvg >= ELIG.oppAvg;
  return { game, set, tour, oppAvg, aiAvg };
}
const MIX_AVG = k => { const w = MIX[k].w, t = w.reduce((a, b) => a + b, 0); return w.reduce((a, x, i) => a + x * (i + 1), 0) / t; };
// 設定画面：この設定でバッジの対象になるかを、条件ごとに表示する
function ruleBoxHTML(kind) {
  const ok = b => b ? '<i class="ok">○</i>' : '<i class="ng">×</i>';
  let rows = [], all = true;
  if (kind === 'practice') {
    const n = +(($('#p-n') || {}).value || 4), games = +(($('#p-games') || {}).value || 5), mix = ($('#p-mix') || {}).value || 'random';
    const lv = [...document.querySelectorAll('.opp-row')].filter(r => !r.hidden).slice(0, n - 1).map(r => { const v = r.querySelector('.o-lv').value; return v === 'r' ? MIX_AVG(mix) : +v; });
    const avg = lv.length ? lv.reduce((a, b) => a + b, 0) / lv.length : 0, rnd = [...document.querySelectorAll('.opp-row')].filter(r => !r.hidden).some(r => r.querySelector('.o-lv').value === 'r');
    rows = [[n >= ELIG.table, `卓の人数 ${ELIG.table}人以上（いま${n}人）`], [games >= ELIG.games, `1セット ${ELIG.games}ゲーム以上（いま${games}ゲーム）`], [avg >= ELIG.oppAvg, `相手の平均の強さ ★${ELIG.oppAvg}以上（いま★${avg.toFixed(1)}${rnd ? '・ランダムは見込み。実際に決まった強さで判定' : ''}）`]];
  } else {
    const tc = readTourCfg(), n = tc.nPlayers, sets = tc.sets, games = tc.games, mix = tc.mix, avg = MIX_AVG(mix);
    rows = [[n >= ELIG.tourPlayers, `参加人数 ${ELIG.tourPlayers}人以上（いま${n}人）`], [sets >= ELIG.tourSets, `予選 ${ELIG.tourSets}セット以上（いま${sets}セット）`], [games >= ELIG.games, `1セット ${ELIG.games}ゲーム以上（いま${games}ゲーム）`], [avg >= ELIG.oppAvg, `AIの平均の強さ ★${ELIG.oppAvg}以上（いま★${avg.toFixed(1)}の見込み。実際に決まった強さで判定）`]];
  }
  all = rows.every(r => r[0]);
  return `<div class="br-head"><b>バッジの条件</b><span class="${all ? 'ok' : 'ng'}">${all ? 'この設定はバッジの対象です' : 'この設定ではバッジの一部が対象外'}</span></div>
    <ul>${rows.map(([b, t]) => `<li>${ok(b)}${esc(t)}</li>`).join('')}</ul>
    <p class="small muted" style="margin:0">${kind === 'practice' ? '上がり・3枚出しなどゲームのバッジは「人数」と「強さ」、セット優勝・低PPセットなどセットのバッジは3つすべてが条件です。' : '大会のバッジ（決勝進出・優勝・完走・全セット優勝）は上の条件すべて、各セット・各ゲームのバッジは卓4人以上・5ゲーム以上・相手の強さが条件です。'}連続最善・推定実力・アウツチャレンジはいつでも数えます。AIの読みを見たゲーム・セット・大会は、結果のバッジの対象外です。</p>`;
}
function renderRuleBox() { const el = $('#rule-box'); if (el) el.innerHTML = ruleBoxHTML(S.view === 'setup-tour' ? 'tour' : 'practice'); const sm = $('#rule-sum'); if (sm) { const all = !!(el && el.querySelector('.br-head .ok')); sm.className = all ? 'ok' : 'ng'; sm.textContent = all ? '🏅 この設定はバッジの対象です' : '⚠ この設定ではバッジの一部が対象外（タップで条件）'; } }
function G_() {
  if (S.attack) return S.attack.g; // バッジアタック中は別集計
  let g = store.get('growth', null);
  if (!g || !g.v) return { v: 2, games: [], cnt: {}, ach: {} };
  // 捨て身バッジを1・2・3回に組み直したので、回数に足りている段階を黙って付ける
  if (!g.tfix2 && g.ach) { g.tfix2 = 1; ['all_sets', 'streak10', 'perfect_set', 'miracle'].forEach(k => { const c = (g.cnt && g.cnt[k]) || 0; if (c >= 2 && !g.ach[k + ':2']) g.ach[k + ':2'] = Date.now(); }); store.set('growth', g); }
  if (!g.stfix && g.ach && g.cnt) { g.stfix = 1; if (g.cnt.sutemi1 == null) g.cnt.sutemi1 = g.cnt.sutemi || 0; g.cnt.sutemi = sutemiScore(g.cnt); Object.keys(g.ach).forEach(k => { if (/^sutemi:/.test(k)) delete g.ach[k]; }); [3, 10, 11].forEach(t => { if (g.cnt.sutemi >= t) g.ach['sutemi:' + t] = Date.now(); }); store.set('growth', g); }
  if (!g.asfix && g.ach) { g.asfix = 1; const c = (g.cnt && g.cnt.all_sets) || 0; delete g.ach['all_sets:2']; [1, 3, 5].forEach(t => { const id = 'all_sets:' + t; if (c >= t) { if (!g.ach[id]) g.ach[id] = Date.now(); } else delete g.ach[id]; }); store.set('growth', g); }
  // 「アタックの鬼」を20回→15回にしたので、15回以上の人には黙って付ける（前の20回の印は15回に移す）
  if (!g.akfix && g.ach) { g.akfix = 1; const c = (g.cnt && g.cnt.atk_done) || 0; if (g.ach['atk_done:20']) { g.ach['atk_done:15'] = g.ach['atk_done:20']; delete g.ach['atk_done:20']; } if (c >= 15 && !g.ach['atk_done:15']) g.ach['atk_done:15'] = Date.now(); store.set('growth', g); }
  if (!g.bpfix && g.ach) { g.bpfix = 1; const c = (g.cnt && g.cnt.bestpair) || 0; delete g.ach['bestpair:10']; [1, 2, 3].forEach(t => { if (c >= t && !g.ach['bestpair:' + t]) g.ach['bestpair:' + t] = Date.now(); }); store.set('growth', g); }
  if (g.v === 1) { // 旧形式からの引き継ぎ：分かる範囲で回数を数え直す
    const old = g.ach || {}, cnt = {};
    cnt.games = g.games.length; cnt.win = g.games.filter(x => x.won).length; cnt.three = g.three || 0;
    cnt.perfect = g.games.filter(x => x.ds.length >= 3 && x.ds.every(d => d.l <= 0.015) && !x.f).length;
    [['perfect_set', 'perfect_set'], ['streak5', 'streak5'], ['streak10', 'streak10'], ['div_paren', 'div_paren'], ['bestpair', 'bestpair'], ['miracle', 'miracle'], ['miss_lucky', 'miss_lucky'], ['no_foul_set', 'no_foul_set'], ['practice_set', 'practice_set'], ['qualify', 'qualify'], ['champion', 'champion'], ['tour_done', 'tour_done']].forEach(([o, k]) => { if (old[o]) cnt[k] = 1; });
    if (g.drill) cnt.outs = g.drill.ok || 0;
    g = { v: 2, games: g.games, cnt, ach: {}, drill: g.drill };
    ACH.forEach(([k, , tiers]) => tiers.forEach(t => { if ((cnt[k] || 0) >= t && k !== 'rating') g.ach[k + ':' + t] = Date.now(); }));
    store.set('growth', g);
  }
  g.cnt = g.cnt || {}; g.ach = g.ach || {};
  // 段階の基準を変えたバッジ：今の基準にない古い記録は消す（回数から付け直す）
  Object.keys(g.ach).forEach(id => { const [k, t] = id.split(':'); if (k === 'cat') return; const x = ACH.find(z => z[0] === k); if (x && !x[2].includes(+t)) delete g.ach[id]; });
  // 回数は数えていたのにバッジが付いていない段階は、黙って付けておく
  ACH.forEach(([k, , tiers]) => tiers.forEach(t => { if ((g.cnt[k] || 0) >= t && !g.ach[k + ':' + t]) g.ach[k + ':' + t] = Date.now(); }));
  return g;
}
function G_save(g) { if (S.attack) return; if (g.games.length > 300) g.games = g.games.slice(-300); store.set('growth', g); }
// 直近 n ゲームの判断から推定実力を出す（お手つきは損失10ptの判断として数える）
// 判断の質（最善率・平均損失）から出した実力から、お手つきの割合に応じて差し引く（お手つき1割で−0.5）
// 実力の計算に使う1手の損失：最善扱いの幅（BEST_LOOSE：1巡目3.5pt・2巡目2.0pt）以内は最善と同じ。巡の記録がない前の記録は、序盤（1・2巡）2.5pt以内を最善と同じに。1手の損失は10ptで頭打ち（1回の大きなミスで実力が大きく動かないように）
const RATE_CAP = 0.10, RATE_N = 100;
// AIの読みを見た手の重さ：候補の損失の平均は実測で約4.2pt（でたらめに近い打ち方）。×0.65で約2.7pt＝★2の平均損失くらい、最善は★1〜2くらいの0.5回分
const HINT_W = 0.65, HINT_B = 0.5;
const rateLoss = d => { const L = d.r ? BEST_LOOSE[d.r] : ((d.c || []).includes('opening') ? { loss: 0.025 } : null); return Math.min(RATE_CAP, L && d.l <= L.loss ? 0 : d.l); };
function ratingOf(games, n) {
  // 直近の判断100回（RATE_N）。ゲーム数で区切ると1ゲームの判断は2〜3回なので手数が少なく、上下が大きすぎた
  const N = n || RATE_N, ls = []; let fouls = 0, hinted = 0;
  // AIの読みを見た手（待ったでやり直した手も）：その場面の難しさ（候補の損失の平均 hm）×HINT_W の損失、最善は HINT_B 回分として数える（★2くらいの扱い）。
  // 外すだけだと、迷った場面でだけ見れば実力が高く出てしまうため。難しさの記録がない前の手は、今までどおり外す
  const bs = [];
  for (let i = games.length - 1; i >= 0 && ls.length < N; i--) { const x = games[i]; for (let j = x.ds.length - 1; j >= 0 && ls.length < N; j--) { const d = x.ds[j]; if (!d.h) { const l = rateLoss(d); ls.push(l); bs.push(l <= 0.015 ? 1 : 0); } else if (d.hm != null) { ls.push(Math.min(RATE_CAP, d.hm * HINT_W)); bs.push(HINT_B); hinted++; } } fouls += x.f || 0; }
  if (ls.length < 8) return { ok: false, need: 8 - ls.length, n: ls.length };
  const avg = ls.reduce((a, b) => a + b, 0) / ls.length * 100, best = bs.reduce((a, b) => a + b, 0) / bs.length;
  const base = Math.max(0.3, Math.min(5.5, (interp(RATE_LOSS, avg, true) + interp(RATE_BEST, best, false)) / 2));
  const foulRate = fouls / (ls.length + fouls), pen = Math.min(1.5, foulRate * 5);
  return { ok: true, r: Math.max(0.3, base - pen), base, pen, fouls, foulRate, avg, best, n: ls.length, hinted };
}
const rateLabel = r => r >= 4.5 ? '達人級' : r >= 3.5 ? '上級' : r >= 2.5 ? '中級' : r >= 1.5 ? '初級' : '入門';
const stars = r => '★'.repeat(Math.max(0, Math.min(5, Math.floor(r + 1e-9)))) + (r % 1 >= 0.5 && r < 5 ? '<span class="half">★</span>' : '');
function catStats(games) {
  const st = {}; for (const k in CATS) st[k] = { n: 0, sum: 0, bad: 0 };
  games.slice(-40).forEach(x => x.ds.forEach(d => !d.h && (d.c || []).forEach(k => { if (!st[k]) return; st[k].n++; st[k].sum += d.l; if (d.l > 0.05) st[k].bad++; })));
  return Object.entries(st).map(([k, o]) => ({ k, label: CATS[k], n: o.n, avg: o.n ? o.sum / o.n * 100 : 0, bad: o.n ? o.bad / o.n : 0 }));
}
// 称号：回数を数えて、段階に届いたら小さく知らせる（同時に複数出たときは順番に）
const ACH_Q = [];
const sutemiScore = c => (c.sutemi1 || 0) >= 1 ? 11 : Math.min(c.aete || 0, 10);
function bump(key, by) { const g = G_(); g.cnt[key] = (g.cnt[key] || 0) + (by == null ? 1 : by); checkAch(g, key); G_save(g); }
function setMax(key, v) { const g = G_(); if ((g.cnt[key] || 0) >= v) return; g.cnt[key] = v; checkAch(g, key); G_save(g); }
function checkAch(g, key) {
  const a = ACH.find(x => x[0] === key); if (!a) return;
  setTimeout(() => { if (!S.attack) try { checkAvUnlocks(G_()); } catch (e) { } }, 0);
  a[2].forEach((t, i) => { const id = key + ':' + t; if ((g.cnt[key] || 0) >= t && !g.ach[id]) { g.ach[id] = Date.now(); ACH_Q.push([a, i]); if (!S.attack) noteAdd('badge', { k: key, i }); if (ACH_Q.length === 1) setTimeout(showAch, 600); } });
  ACH_GROUPS.forEach((gr, gi) => { if (!gr[1].includes(key)) return; const cp = catProgress(g, gi); if (cp.done && !g.ach['cat:' + gi]) { g.ach['cat:' + gi] = Date.now(); ACH_Q.push(['cat', gi]); if (!S.attack) noteAdd('cat', { gi }); if (ACH_Q.length === 1) setTimeout(showAch, 600); } });
}

function showAch() {
  const q = ACH_Q[0]; if (!q) return; const [a, i] = q;
  // 式ハンター中は、演出に埋もれないよう大きく出す
  if (S.view === 'hunt' && S.hunt && S.hunt.started && !q.late) { q.late = 1; setTimeout(showAch, 700); return; }
  if (S.view === 'hunt' && S.hunt && S.hunt.started) {
    const tier = a === 'cat' ? 3 : a[5] ? a[5][i] : a[2].length === 1 ? 2 : Math.min(i, 2);
    const d = document.createElement('div'); d.className = 'ach-big t' + tier; d.setAttribute('role', 'status');
    d.innerHTML = `<div class="ab-rays"></div><div class="ab-in"><div class="ab-k">${a === 'cat' ? 'カテゴリー コンプリート！' : 'バッジ獲得！'}</div><div class="ab-icon">${a === 'cat' ? emblemSVG(i, true, 96) : badgeSVG(a, i, true, 96)}</div><div class="ab-n">${esc(a === 'cat' ? CAT_SPECIAL[ACH_GROUPS[i][0]] : a[4][i])}</div><div class="ab-d">${esc(a === 'cat' ? `「${ACH_GROUPS[i][0]}」のバッジをすべて獲得` : a[3](a[2][i]))}</div>${a === 'cat' ? `<div class="ab-bp">+${BP_CAT} BP・アバターのセット</div>` : `<div class="ab-bp">${['銅', '銀', '金'][tier] || ''}バッジ・${bpOf(a[0], i)} BP</div>`}</div>`;
    document.body.appendChild(d); KB.sfx('best'); setTimeout(() => KB.sfx('combo'), 250); if (tier >= 2) setTimeout(confetti, 150);
    setTimeout(() => d.classList.add('out'), 2600);
    setTimeout(() => { d.remove(); ACH_Q.shift(); showAch(); }, 3000);
    return;
  }
  const d = document.createElement('div'); d.className = 'ach-toast'; d.setAttribute('role', 'status');
  d.innerHTML = a === 'cat' ? `${emblemSVG(i, true, 30)}<span>「${esc(ACH_GROUPS[i][0])}」コンプリート！ <b>${esc(CAT_SPECIAL[ACH_GROUPS[i][0]])}</b></span>` : `${badgeSVG(a, i, true, 24)}<span>バッジ <b>${esc(a[4][i])}</b></span>`;
  if (S.attack && !(a !== 'cat' && /^zukan/.test(a[0]))) { d.insertAdjacentHTML('beforeend', `<b class="atk-bp" style="white-space:nowrap">+${a === 'cat' ? BP_CAT : bpOf(a[0], i)} BP</b>`); document.querySelectorAll('.atk-now').forEach(el => el.textContent = atkBP() + ' BP'); }
  if (a === 'cat') { d.classList.add('cat'); setTimeout(confetti, 100); }
  toastStack().appendChild(d); KB.sfx('best');
  setTimeout(() => d.classList.add('out'), 1800);
  setTimeout(() => { d.remove(); ACH_Q.shift(); showAch(); }, 2150);
}
// バッジの絵：段階ごとに銅・銀・金、系統名の頭文字
function badgeSVG(a, i, got, size) {
  const tier = a[5] ? a[5][i] : a[2].length === 1 ? 2 : Math.min(i, 2); // 段階の色が決まっているバッジ（強豪大会など）・1回だけのバッジは金色
  const cols = [['#c98a4b', '#7a4a1e'], ['#d7dde3', '#7d8790'], ['#f6c945', '#a8790c']][tier];
  const [c1, c2] = got ? cols : ['#3a4542', '#26302d'];
  const ch = a[4][i].slice(0, 1), z = size || 40;
  return `<svg class="bdg" width="${z}" height="${z}" viewBox="0 0 40 40" aria-hidden="true"><polygon points="20,1 37,10 37,30 20,39 3,30 3,10" fill="${c2}"/><polygon points="20,4 34,12 34,28 20,36 6,28 6,12" fill="${c1}"/>${tier >= 1 && got ? '<circle cx="20" cy="20" r="11" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>' : ''}<text x="20" y="25.5" text-anchor="middle" font-size="15" font-weight="900" fill="${got ? '#2a1c00' : '#6b7672'}">${esc(ch)}</text></svg>`;
}
// カテゴリーをすべて集めると付く特別バッジ
const CAT_SPECIAL = { '対局・継続': '皆勤賞', '勝利': '常勝の冠', '判断の質': '精密の極み', '手と計算': '計算の匠', 'アウツチャレンジ': '確率の賢者', '早撃ち': '神速', 'バッジアタック': '時の覇者', '式の図鑑': '式の宝庫', 'オンライン大会': '頂点の証' };
function catProgress(g, gi) { const [gn, ks] = ACH_GROUPS[gi]; const list = ks.map(k => ACH.find(x => x[0] === k)).filter(Boolean); const have = list.reduce((n, a) => n + a[2].filter(t => g.ach[a[0] + ':' + t]).length, 0), all = list.reduce((n, a) => n + a[2].length, 0); return { gn, have, all, done: all > 0 && have >= all, name: CAT_SPECIAL[gn] || gn }; }
function emblemSVG(gi, got, size) {
  const z = size || 48, id = 'em' + gi + (got ? 'g' : 'n') + z;
  const ch = (CAT_SPECIAL[ACH_GROUPS[gi][0]] || '?').slice(0, 1);
  return `<svg class="emb" width="${z}" height="${z}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${got ? '#ffe27a' : '#3d4844'}"/><stop offset=".5" stop-color="${got ? '#d9a4ff' : '#323c39'}"/><stop offset="1" stop-color="${got ? '#7ad7ff' : '#2a3330'}"/></linearGradient></defs>
    <path d="M24 2 L44 10 L44 24 C44 36 34 43 24 46 C14 43 4 36 4 24 L4 10 Z" fill="${got ? '#5a3c86' : '#232b29'}"/>
    <path d="M24 5.5 L41 12.3 L41 24 C41 34 32.5 40 24 42.8 C15.5 40 7 34 7 24 L7 12.3 Z" fill="url(#${id})"/>
    ${got ? '<path d="M24 7 l2 4.2 4.6.6-3.3 3.2.8 4.6L24 17.4l-4.1 2.2.8-4.6-3.3-3.2 4.6-.6z" fill="#fff8d0"/>' : ''}
    <text x="24" y="34" text-anchor="middle" font-size="15" font-weight="900" fill="${got ? '#2a1640' : '#66716d'}">${esc(ch)}</text></svg>`;
}
// 場面の項目を押すと、博士が解説する
function catTalk(k) {
  const g = G_(), cs = catStats(g.games), c = cs.find(x => x.k === k); if (!c) return;
  let n = 0, sm = 0; g.games.slice(-40).forEach(x => x.ds.forEach(d => { if (!d.h) { n++; sm += d.l; } })); const allAvg = n ? sm / n * 100 : 0;
  const info = CAT_INFO[k] || ['', ''];
  const diff = c.avg - allAvg;
  const verdictTxt = c.n < 3 ? 'まだ回数が少ないので、傾向は見えていません。' : diff <= -0.5 ? `あなたの平均損失は${c.avg.toFixed(1)}pt。全体の平均（${allAvg.toFixed(1)}pt）より小さく、得意な場面と言えます。` : diff >= 0.5 ? `あなたの平均損失は${c.avg.toFixed(1)}pt。全体の平均（${allAvg.toFixed(1)}pt）より大きいので、伸びしろのある場面です。` : `あなたの平均損失は${c.avg.toFixed(1)}pt。全体の平均（${allAvg.toFixed(1)}pt）とほぼ同じです。`;
  const badTxt = c.n >= 3 ? `損失5pt以上の判断は${c.n}回中${Math.round(c.bad * c.n)}回でした。` : '';
  modal(`<div class="bdg-talk"><h2 style="margin:0">${esc(c.label)}</h2>
    <div class="commentary"><div class="cm-av">${KB.casterSVG('root', diff >= 0.5 ? 'normal' : 'happy')}</div><div class="cm-body"><span class="cm-name">解説・ルート博士</span><span class="cm-text">${esc(info[0] + verdictTxt + badTxt + info[1])}</span></div></div>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div></div>`);
}
// バッジを押すと、マサが説明する
// モードごとの関連バッジ（各系統の今の段階。未獲得は影で）
const MB_TOUR = ['tour_done', 'all_sets', 'qualify', 'champion', 'toushi', 'qualify_strong', 'champion_strong'];
const MB_ATK = ['atk_done', 'atk_bp', 'atk_badges'], MB_HUNT = ['zukan', 'zukan_cat'], MB_OUTS = ['outs3', 'outs4', 'outs5'], MB_CHART = ['chart'];
const MB_PRAC = ACH.map(a => a[0]).filter(k => !MB_TOUR.concat(MB_ATK, MB_HUNT, MB_OUTS).includes(k));
// 各系統の全段階（銅・銀・金）を並べる。未獲得は影
function tierBadges(keys) {
  const g = G_();
  return `<span class="mode-bdg wrap">${keys.map(k => { const a = ACH.find(x => x[0] === k); if (!a) return ''; return `<span class="mb-ser">${a[2].map((t, i) => { const got = !!g.ach[k + ':' + t]; return `<button class="mb ${got ? 'got' : ''}" data-bdg="${k}:${i}" title="${esc(a[4][i])}：${esc(a[3](t))}${got ? '' : '（未獲得）'}">${badgeSVG(a, i, got, 23)}</button>`; }).join('')}</span>`; }).join('')}</span>`;
}
function modeBadges(keys, noEmb) {
  const g = G_();
  const cats = ACH_GROUPS.map((gr, gi) => gr[1].some(k => keys.includes(k)) ? gi : -1).filter(gi => gi >= 0);
  const embs = noEmb ? '' : cats.map(gi => { const done = catProgress(g, gi).done; return `<button class="mb emb ${done ? 'got' : ''}" data-emb="${gi}" title="冠「${esc(CAT_SPECIAL[ACH_GROUPS[gi][0]])}」（${esc(ACH_GROUPS[gi][0])}）${done ? '' : '：未獲得'}">${emblemSVG(gi, done, 30)}</button>`; }).join('');
  return `<span class="mode-bdg ${keys.length > 10 ? 'many' : ''}">${embs}${keys.map(k => { const a = ACH.find(x => x[0] === k); if (!a) return ''; let top = -1; a[2].forEach((t, i) => { if (g.ach[k + ':' + t]) top = i; });
    const show = Math.max(0, top), next = Math.min(a[2].length - 1, top + 1);
    return `<button class="mb ${top >= 0 ? 'got' : ''}" data-bdg="${k}:${top >= 0 ? show : next}" title="${esc(a[1])}${top >= 0 ? '：' + esc(a[4][show]) : '（未獲得）'}">${badgeSVG(a, show, top >= 0, 26)}</button>`; }).join('')}</span>`;
}
// カテゴリーごとに1列（冠＋そのカテゴリーのバッジ）
function modeBadgeRows(keys, allTiers) {
  const g = G_();
  const nCat = ACH_GROUPS.filter(gr => gr[1].some(k => keys.includes(k))).length;
  return `<div class="mode-rows">${ACH_GROUPS.map((gr, gi) => { const ks = gr[1].filter(k => keys.includes(k)); if (!ks.length) return ''; const done = catProgress(g, gi).done;
    return `<div class="mr"><button class="mb emb ${done ? 'got' : ''}" data-emb="${gi}" title="冠「${esc(CAT_SPECIAL[gr[0]])}」">${emblemSVG(gi, done, 26)}</button>${nCat > 1 ? `<small>${esc(gr[0])}</small>` : ''}${allTiers ? tierBadges(ks) : modeBadges(ks, true)}</div>`; }).join('')}</div>`;
}
function badgeTalk(key, i) {
  const a = ACH.find(x => x[0] === key); if (!a) return;
  const g = G_(), t = a[2][i], got = g.ach[key + ':' + t], c = g.cnt[key] || 0, name = a[4][i], cond = a[3](t);
  const R = arr => arr[(Math.random() * arr.length) | 0];
  const rank = a[5] ? ['銅', '銀', '金'][a[5][i]] : a[2].length === 1 ? '特別な金' : ['銅', '銀', '金'][Math.min(i, 2)];
  let text = R([`「${name}」は${rank}のバッジや！条件は「${cond}」。`, `これは「${name}」やな。「${cond}」でもらえる${rank}バッジや！`, `「${name}」、${rank}バッジやで！条件は「${cond}」や。`]);
  if (got) text += R([`もう持っとるやん！${new Date(got).toLocaleDateString('ja-JP')}にゲットしたで、ナイスや！`, 'ちゃんとゲット済みや！胸張ってええで！', `ゲット済みや！${i < a[2].length - 1 ? `次は「${a[4][i + 1]}」狙っていこか！` : 'この系統はもう最高ランクや、文句なしや！'}`]);
  else if (key === 'set_low') text += c ? `これまでのベストは1セットPP${100 - c}や！あと${Math.max(0, t - c)}点削ったら届くで！` : 'まずはPP20以下のセットを目指そか！でかい札から逃がすんやで！';
  else if (key === 'qualify_strong' || key === 'champion_strong') text += '大会の設定で、相手を「強豪ぞろい」にしたら銀、「全員達人」にしたら金や！腕試しにはもってこいやで！';
  else if (key === 'atk_bp' || key === 'atk_badges') text += c ? `これまでのベストは${c}${key === 'atk_bp' ? 'BP' : '個'}や！あと${Math.max(0, t - c)}${key === 'atk_bp' ? 'BP' : '個'}で届くで！` : 'まずはバッジアタックを最後までやり切ってみよか！';
  else if (key === 'sutemi' && t > 10) text += (g.cnt.sutemi1 || 0) >= 1 ? '捨て身はもう決めとるで！' : R(['回数やなくて、1回決めたらもらえるバッジや！AIの読みで「あえて上がらない」が最善と出る場面は、セットの最後のほうや決勝で出やすいで。そのときは勇気出して見送ってみ！', '上がれるのにあえて上がらん、これが一番の勝負手や。AIの読みで捨て身が最善と出たら、思い切って見送ってみ！']);
  else if (key === 'on_podium' || key === 'off_podium') text += R(['ホームの「オンライン大会」から参加できるで。表彰台、狙っていこ！', '人の集まる大会で上位に入ったらもらえるで。ホームの「オンライン大会」をのぞいてみ！']);
  else if (key === 'zukan_cat' || key === 'chart') { const u = key === 'chart' ? '行' : 'つ'; text += c ? `いまは${c}${u}、あと${Math.max(0, t - c)}${u}やで！がんばりや！` : `まずは1${u}、そろえてみよか！`; }
  else if (key === 'rating') text += R(['推定実力が上がったら自然と付いてくるで。判断の質を積み上げていこ！', '最善手を重ねていけば届くで！焦らんでええ！']);
  else text += R([`いまは${c}回、あと${Math.max(0, t - c)}回やで！がんばりや！`, `あと${Math.max(0, t - c)}回！ゴールは見えとるで！`, `いま${c}回や。コツコツいこ、ローマは一日にして成らずや！`]);
  if (['win','perfect','three','div_paren','miss_lucky','miracle','bestpair','set_win','set_low','perfect_set','no_foul_set','all_sets','qualify','champion','toushi','qualify_strong','champion_strong'].includes(key)) text += ' ちなみに、AIの読みを見たゲームやセット（大会のバッジは大会）では、このバッジは数えへんで！自分の読みで取りにいこ！';
  else if (['quick5', 'quick3', 'snap', 'quickdraw', 'blitz'].includes(key)) text += ' 時間は自分の番になった瞬間から数えるで。速さだけやなくて、最善手（即断即決は好手以上）やないとアカンからな！AIの読みを見た手は数えへんで。';
  else if (key.startsWith('atk_')) text += ' バッジアタックを15分やり切ったときだけ数えるで。途中で中断したら数えへんからな！';
  else if (key === 'streak5' || key === 'streak10') text += ' AIの読みを見た手は連続に数えへんで（途切れもせえへん）。';
  modal(`<div class="bdg-talk"><div class="bdg-big">${badgeSVG(a, i, !!got, 72)}<b>${esc(name)}</b><small>${esc(a[1])}・${rank}</small><span class="bp-tag">${bpOf(key, i)} BP</span></div>
    <div class="commentary"><div class="cm-av">${KB.casterSVG('masa', got ? 'happy' : 'normal')}</div><div class="cm-body"><span class="cm-name">実況・ナニワのマサ</span><span class="cm-text">${esc(text)}</span></div></div>
    <div class="row" style="justify-content:flex-end;gap:8px">${S.advBack ? '<button class="btn" data-act="adv-back">← アドバイスに戻る</button>' : ''}<button class="btn primary" data-act="close">閉じる</button></div></div>`);
}
// 判断ごとの記録（課題の進み具合と、連続最善・待ちの称号）
function growthOnDecision(d) {
  d.cats = catsOf(d);
  // 早撃ち：最善手を短い時間で出す（AIの読みを見た手・条件に満たない卓は対象外）
  { const mm = d.mineStats && d.mineStats.m; if (mm && d.secs != null && !d.viewedHint && d.loss <= 0.015 && badgeElig(S.T).game) { if (d.secs <= 5) bump('quick5'); if (d.secs <= 3) bump('quick3'); if (mm.n === 3 && mm.expr.includes('÷') && d.secs <= 10) bump('quickdraw'); } }
  // 溜めと捨て身：あえて引く最善手（銅3回・銀10回）／捨て身の最善手（金。1回で銅・銀もまとめて）
  if (!d.viewedHint && badgeElig(S.T).game) {
    const gs = G_(); let ch = false;
    if (d.drew && d.best === 'あえて引く' && d.loss <= 0.015) { gs.cnt.aete = (gs.cnt.aete || 0) + 1; ch = true; }
    if (d.sutemi && d.sutemi.chose) { gs.cnt.sutemi1 = (gs.cnt.sutemi1 || 0) + 1; ch = true; }
    if (ch) { gs.cnt.sutemi = sutemiScore(gs.cnt); checkAch(gs, 'sutemi'); G_save(gs); }
  }
  const g = G_(), c = g.cnt;
  const prev = c.streakMax || 0;
  if (d.viewedHint) { S.bestStreak = c.streakNow || 0; return; } // AIの読みを見た手は評価に入れない（連続も伸びず、途切れもしない）
  c.streakNow = d.loss <= 0.015 ? (c.streakNow || 0) + 1 : 0;
  S.bestStreak = c.streakNow;
  if (c.streakNow > prev) { c.streakMax = c.streakNow; if (c.streakNow >= 3 && !S.recordRun) { S.recordRun = true; setTimeout(() => toast(`連続最善の自己ベスト更新中：${c.streakNow}`), 700); } }
  if (!c.streakNow) S.recordRun = false;
  G_save(g);
  if (c.streakNow === 5) bump('streak5'); if (c.streakNow === 10) bump('streak10');
}
// ゲームごとの記録
function growthOnGame(g0) {
  if (S.tiebreak) return;
  const me = g0.players.findIndex(p => p.human), g = G_();
  const ds = S.decisions.map(d => ({ l: Math.round(d.loss * 1000) / 1000, c: d.cats || catsOf(d), h: d.viewedHint ? 1 : 0, r: d.round, ...(d.viewedHint && d.hm != null ? { hm: Math.round(d.hm * 1000) / 1000 } : {}) }));
  const threes = g0.played[me].filter(x => x.cards.length === 3).length;
  g.games.push({ at: Date.now(), k: S.T.cfg.kind, ds, f: (S.fouls || []).length, won: g0.winner === me, pp: g0.pp[me], n: g0.n });
  G_save(g);
  bump('games');
  const r = ratingOf(G_().games); if (r.ok && r.n >= 40) setMax('rating', Math.round(r.r * 10) / 10); // 判断40回以上で安定してから
  try { const c0 = G_().cnt || {}, mk = store.get('noteMark', {}) || {}; let ch = false;
    if (c0.rating && c0.rating > (mk.rating || 0)) { if (mk.rating != null) noteAdd('rating', { v: c0.rating }); mk.rating = c0.rating; ch = true; }
    if ((c0.streakMax || 0) > (mk.streak || 0)) { if (mk.streak != null && c0.streakMax >= 3) noteAdd('streak', { v: c0.streakMax }); mk.streak = c0.streakMax; ch = true; }
    if (ch) store.set('noteMark', mk); } catch (e) { }
  if (S.gameHinted || !badgeElig(S.T).game) return; // AIの読みを見たゲーム・条件に満たない卓は、結果のバッジの対象外
  { const dd = S.decisions; if (dd.length >= 3 && dd.every(d => d.secs != null && d.secs <= 10 && d.loss <= 0.05)) bump('snap'); } // 即断即決
  // 速攻：最短の第3巡で上がり、自分の番は毎回10秒以内（7枚を3回で出し切る）
  if (g0.winner === me && g0.round <= 3 && g0.played[me].length >= 3 && S.decisions.length >= g0.played[me].length && S.decisions.every(d => d.secs != null && d.secs <= 10)) bump('blitz');
  if (threes) bump('three', threes);
  if (g0.winner === me) bump('win');
  if (ds.length >= 3 && ds.every(d => d.l <= 0.015 && !d.h) && !(S.fouls || []).length) bump('perfect');
  const dp = g0.played[me].filter(x => divPraise(x.expr, x.cards.length) === 'div').length; if (dp) bump('div_paren', dp);
  if (g0.winner === me && missHit(g0, me)) bump('miss_lucky');
  // ミラクルセット・ベストペアは、その形で上がったときだけ数える
  if (g0.winner === me) { const lp = g0.played[me][g0.played[me].length - 1], k = lp ? lp.cards.map(c => c.v).sort((a, b) => a - b).join(',') : ''; if (k === '1,2,6') bump('miracle'); if (k === '2,6') bump('bestpair'); }
}
// レーティングの推移（各ゲーム時点の直近の判断100回で計算）
function ratingSeries(games) { const out = []; for (let i = 1; i <= games.length; i++) { const r = ratingOf(games.slice(0, i)); if (r.ok) out.push(r.r); } return out.slice(-40); }
function sparkSVG(vals, w, h) {
  if (vals.length < 2) return '';
  const x = i => (i / (vals.length - 1)) * (w - 8) + 4, y = v => h - 4 - (Math.max(0, Math.min(5.5, v)) / 5.5) * (h - 8);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const grid = [1, 2, 3, 4, 5].map(s => `<line x1="0" x2="${w}" y1="${y(s).toFixed(1)}" y2="${y(s).toFixed(1)}" class="sp-grid"/>${h >= 60 ? `<text x="2" y="${(y(s) - 2).toFixed(1)}" class="sp-lab">★${s}</text>` : ''}`).join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="推定実力の推移">${grid}<polyline points="${pts}" class="sp-line"/><circle cx="${x(vals.length - 1).toFixed(1)}" cy="${y(vals[vals.length - 1]).toFixed(1)}" r="3.5" class="sp-dot"/></svg>`;
}
// ---------- 式ハンター：3分間、めくられる場に3枚で式を作って、図鑑を増やす ----------
const HUNT_SEC = 180, HUNT_HAND = 5, HUNT_QUICK = 10;
// この手札（値の配列）で、場 t に作れる式の候補（未使用のもの）
function huntForms(vals, t, used) {
  const out = [], seen = new Set(), n = vals.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const key = [vals[i], vals[j], vals[k]].sort((a, b) => a - b).join(','); if (seen.has(key)) continue; seen.add(key);
    ((ZK.byCombo[key] || {})[t] || []).forEach(f => { if (!used.has(f.use)) out.push(f); });
  }
  return out;
}
const huntNew = (vals, t, used, z) => huntForms(vals, t, used).filter(f => f.id && !z[f.id]);
// 獲物（未登録の式）を作れる3枚の組み合わせ（札のidの組）
function huntPatterns(hand, t, used, z) {
  const out = [], n = hand.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    const key = [hand[i].v, hand[j].v, hand[k].v].sort((a, b) => a - b).join(',');
    if (((ZK.byCombo[key] || {})[t] || []).some(f => f.id && !z[f.id] && !used.has(f.use))) out.push([hand[i].id, hand[j].id, hand[k].id]);
  }
  return out;
}
// 毎回、新しい手札5枚と場を配る（出題の手助け：未登録の式が作れる組み合わせを選びやすくする）
// まだ捕まえられる未登録の式（標的を固定していればその数だけ）
const huntLeftT = (t, z, H) => ZUKAN.filter(e => e.n === 3 && e.t === t && !z[e.id] && !H.used.has(e.t + '#' + e.id.split('#')[1]));
const huntLeft = (H, z) => ZUKAN.filter(e => e.n === 3 && !z[e.id] && (!H.target || e.t === H.target) && !H.used.has(e.t + '#' + e.id.split('#')[1]));
function huntDeal(H) {
  // 獲物（未登録の式）がいない配りは、何度か配り直して避ける。獲物がいれば、その時点の配りを使う（毎回ちがう手になる）
  const z = zukanGet(); let best = null;
  for (let k = 0; k < 30; k++) {
    const d = KB.newDeck(), fi = H.target ? d.findIndex(c => c.v === H.target) : -1, field = fi >= 0 ? d.splice(fi, 1)[0] : d.pop(), hand = d.slice(-HUNT_HAND).sort((a, b) => a.v - b.v || a.s - b.s);
    // ゾロ目は、その標的の最後の1匹になるまで出さない（同じ数を3枚配らない）
    if (hand.filter(c => c.v === field.v).length >= 3 && huntLeftT(field.v, z, H).length > 1) continue;
    const n = huntNew(hand.map(c => c.v), field.v, H.used, z).length;
    if (!best || n > best.n) best = { field, hand, n };
    if (n > 0 && (k >= 1 || Math.random() < 0.5)) break;
  }
  // それでも獲物がいなければ、残っている未登録の式から1つ選んで、その札が入るように配る（制覇するまで「獲物なし」は出さない）
  if (!best || !best.n) {
    const left = huntLeft(H, z);
    if (left.length) {
      const nz = left.filter(e => !e.zoro || huntLeftT(e.t, z, H).length === 1), pool = nz.length ? nz : left;
      const e = pool[(Math.random() * pool.length) | 0], d = KB.newDeck(), take = v => { const i = d.findIndex(c => c.v === v); return i >= 0 ? d.splice(i, 1)[0] : null; };
      const field = take(e.t), mine = e.vals.map(take);
      if (field && mine.every(Boolean)) { for (let i = d.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [d[i], d[j]] = [d[j], d[i]]; } const hand = mine.concat(d.slice(0, HUNT_HAND - mine.length)).sort((a, b) => a.v - b.v || a.s - b.s); best = { field, hand, n: huntNew(hand.map(c => c.v), field.v, H.used, z).length }; }
    }
  }
  if (!best) { const d = KB.newDeck(); best = { field: d.pop(), hand: d.slice(-HUNT_HAND).sort((a, b) => a.v - b.v || a.s - b.s), n: 0 }; }
  H.hand = best.hand; H.field = best.field; H.fieldAt = Date.now(); H.fieldNo++; H.sel = []; H.msg = null; // 新しい標的では、前の式の表示を消す
  if (H.started) { KB.sfx('deal'); if (best.n) setTimeout(() => KB.sfx('lockon'), 650); }
}
function huntStart() {
  const H = S.hunt = { target: store.get('huntT', null) || null, hand: [], field: null, fieldAt: 0, fieldNo: 0, used: new Set(), score: 0, streak: 0, regs: [], autoRegs: [], auto: false, autoLeft: 0, made: [], missed: [], sel: [], msg: null, started: false, over: false };
  const again = S.view === 'hunt-result'; huntDeal(H); go('hunt'); if (!again) huntIntro(); // もう一度のときは導入を省く
}
function huntGo(aim) {
  const H = S.hunt; if (!H || H.started) return;
  if (aim) { const g = G_(); if ((g.aim || 0) > 0) { g.aim--; G_save(g); H.auto = true; H.usedAim = true; } }
  huntOverlay(H.auto ? '自動照準 起動' : '狩り開始', H.auto ? `${HUNT_SEC / 60}分間ずっと自動で捕獲（得点には入りません）` : `${HUNT_SEC / 60}分間、未登録の式を捕まえろ`, 1);
  if (H.auto) { clearTimeout(S.huntAutoT); S.huntAutoT = setTimeout(huntAutoStep, 1800); }
  H.started = true; H.end = Date.now() + HUNT_SEC * 1000 + 1600; H.fieldAt = Date.now() + 1600; render();
  clearInterval(S.huntTimer);
  S.huntTimer = setInterval(() => {
    const H2 = S.hunt; if (!H2 || H2.over) { clearInterval(S.huntTimer); return; }
    const left = H2.end - Date.now();
    document.querySelectorAll('.hunt-clock').forEach(el => { el.textContent = fmtClock(left); el.classList.toggle('hurry', left < 20000); });
    if (left <= 0) huntFinish();
  }, 250);
}
// ---------- ご褒美アイテム「自動照準」：「図鑑の場」銀バッジを持って大会の決勝に進むと1発もらえる（何発でもためられる） ----------
// 使うと、3分間ずっと（すべて制覇したら終わり）カードを自動で選んで撃つ。札の選び方以外は手で打つときと同じ。
// 自動で捕まえた式は図鑑に登録される（図鑑のバッジにも数える）が、得点・捕獲数・自己ベストには入れない

const aimCount = () => G_().aim || 0;
// 大会のご褒美：決勝進出で「まんべんなく」以下は1発、「強豪ぞろい」「全員達人」は2発。優勝でさらに2発（「図鑑の場」の銀バッジを持っているとき）
const AIM_RULE = '大会で決勝に進んだら1発（強豪ぞろい・全員達人なら2発）、優勝したらさらに2発';
function aimReward(T, kind) {
  const g = G_(); if (!g.ach['zukan_cat:3']) return 0;
  const n = kind === 'champion' ? 2 : (T.cfg && ['strong', 'master'].includes(T.cfg.mix) ? 2 : 1);
  g.aim = (g.aim || 0) + n; G_save(g); T.aimGot = (T.aimGot || 0) + n;
  return n;
}
// マサが自動照準を手渡す（受け取ってから次へ進む）
function aimHandover(n, kind, then) {
  const t = kind === 'champion' ? `優勝おめでとう！ご褒美に自動照準を${n}発、追加で渡しとくで！式ハンターで使ってや！` : `決勝進出のご褒美や！自動照準を${n}発渡しとくで！式ハンターで${HUNT_SEC / 60}分間ずっと自動で捕まえてくれるんや。優勝したら、さらに2発やで！`;
  modal(`<div class="stack aim-hand"><div class="ag-ret" aria-hidden="true">🎯</div><h2 style="margin:0;text-align:center">ご褒美：自動照準 ×${n}</h2>
    <div class="op-line masa"><div class="cm-av">${KB.casterSVG('masa', 'happy')}</div><div class="op-bubble"><span class="cm-name">実況・ナニワのマサ</span>${esc(t)}</div></div>
    <p class="small muted" style="margin:0;text-align:center">所持 ${aimCount()}発</p>
    <div class="row" style="justify-content:center"><button class="btn primary" id="aim-ok">${kind === 'champion' ? '受け取る' : '受け取って決勝へ'}</button></div></div>`);
  KB.sfx('lockon');
  $('#aim-ok').onclick = () => { closeModal(); if (then) then(); };
}
// 式ハンターの最初に、マサが自動照準のことを教える（条件の「図鑑の場」銀バッジを持っているときだけ）
function aimTalk() {
  const g = G_(); if (!g.ach['zukan_cat:3']) return '';
  const n = g.aim || 0;
  const t = n ? `自動照準が${n}発あるで！下のボタンで使えるわ。${AIM_RULE}もらえるで！` : `「図鑑の場」の銀バッジ持っとるやん！${AIM_RULE}、ご褒美に自動照準がもらえるで！${HUNT_SEC / 60}分間ずっと、自動で捕まえてくれるんや！`;
  return `<div class="op-line masa aim-talk"><div class="cm-av">${KB.casterSVG('masa', 'happy')}</div><div class="op-bubble"><span class="cm-name">実況・ナニワのマサ</span>${esc(t)}</div></div>`;
}
function huntAutoStep() {
  const H = S.hunt; if (!H || H.over || !H.auto) return;
  const again = ms => { clearTimeout(S.huntAutoT); S.huntAutoT = setTimeout(huntAutoStep, ms); };
  if (H.blocked || !H.field || H.pausedAt || Date.now() < H.fieldAt || S.view !== 'hunt') return again(250);
  const pats = huntPatterns(H.hand, H.field.v, H.used, zukanGet());
  if (!pats.length) { huntPass(); return again(600); }
  const pick = pats[(Math.random() * pats.length) | 0];
  H.sel = []; H.blocked = true; render();
  pick.forEach((id, i) => setTimeout(() => { if (S.hunt !== H || H.over) return; H.sel.push(id); KB.sfx('select'); render(); }, 300 + i * 260)); // タン、タン、タン
  setTimeout(() => { if (S.hunt !== H || H.over) return; H.blocked = false; huntPlay(); again(1300); }, 300 + 3 * 260 + 200); // バン
}
function huntPlay() {
  const H = S.hunt; if (!H || !H.started || H.over || H.blocked) return;
  if (H.sel.length !== 3) { H.msg = { bad: true, text: '3枚を選んでください' }; KB.sfx('foul'); render(); return; }
  const cards = H.sel.map(id => H.hand.find(c => c.id === id)), vals = cards.map(c => c.v).sort((a, b) => a - b), key = vals.join(','), t = H.field.v;
  const forms = (ZK.byCombo[key] || {})[t] || [];
  if (!forms.length) { H.msg = { bad: true, text: `${vals.map(KB.vname).join('・')} では ${t} を作れません` }; KB.sfx('foul'); render(); return; }
  const z = zukanGet();
  // 未登録の図鑑の式 → 未使用の図鑑の式 → 未使用のほかの式 の順で選ぶ
  const f = forms.find(x => x.id && !z[x.id] && !H.used.has(x.use)) || forms.find(x => x.id && !H.used.has(x.use)) || forms.find(x => !H.used.has(x.use));
  if (!f) { H.msg = { bad: true, text: 'その式はこのチャレンジで使用済みです' }; KB.sfx('foul'); render(); return; }
  H.used.add(f.use);
  const secs = (Date.now() - H.fieldAt) / 1000;
  let pts = 10 + (f.s.includes('−') ? 2 : 0) + (f.s.includes('×') ? 4 : 0) + (f.s.includes('÷') ? 6 : 0) + (f.s.includes('(') ? 4 : 0);
  const auto = H.auto;
  if (auto) pts = 0; // 自動照準の間は得点に入れない
  else { if (secs <= HUNT_QUICK) { H.streak++; pts += Math.min(10, 2 * H.streak); } else H.streak = 0; H.score += pts; }
  const isNew = f.id && !z[f.id];
  if (isNew) { z[f.id] = { at: Date.now() }; store.set('zukan', z); (auto ? H.autoRegs : H.regs).push({ s: f.s, t });  huntCapture(f.s, t, zukanCount(z)); zukanBadges(z); const lf = ZUKAN.filter(e => e.n === 3 && e.t === t && !z[e.id]).length; if (lf > 0 && (lf <= 10 || lf % 10 === 0)) huntLeftCall(t, lf); }
  else huntCapture(f.s, t, 0, f.id ? 'reg' : 'out');
  H.made.push({ s: f.s, t, pts, isNew: !!isNew, zk: !!f.id, auto });
  H.msg = { ok: true, text: `${f.s} = ${t}　${auto ? '自動照準' : `+${pts}点`}${isNew ? '　捕獲！' : ''}`, isNew };
  if (!isNew) KB.sfx('play3');
  // 撃った演出を見せてから、次の標的と手札を配る（その間は操作できない）
  H.sel = []; H.blocked = true; H.hand = H.hand.map(c => Object.assign({}, c, { gone: cards.includes(c) })); render();
  const zEnt = isNew && ZUKAN[ZUKAN_IDX.get(f.id)]; H.lastZoro = !!(zEnt && zEnt.zoro);
  const conq = isNew && !ZUKAN.some(e => e.n === 3 && e.t === t && !z[e.id]);
  if (conq) { setTimeout(() => { if (S.hunt === H && !H.over) huntConquer(t); }, 1150); return; }
  setTimeout(() => { if (S.hunt !== H || H.over) return; H.blocked = false; huntDeal(H); render(); }, 1050);
}
// 演出：残りが少ない（10以下）か、10の倍数になったら「あと○匹！」
function huntLeftCall(t, n) {
  const sc = document.querySelector('.hunt-scope'), r = sc ? sc.getBoundingClientRect() : { left: innerWidth / 2 - 75, top: 200, width: 150, height: 150 };
  const el = document.createElement('div'); el.className = 'hunt-left' + (n <= 3 ? ' hot' : n <= 10 ? ' warm' : '');
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top + r.height + 6) + 'px';
  el.innerHTML = `<small>標的 ${KB.vname(t)} は</small>あと<b>${n}</b>匹！${n === 1 ? '<small>制覇まであと1つ</small>' : ''}`;
  setTimeout(() => { document.body.appendChild(el); KB.sfx(n <= 3 ? 'lockon' : 'select'); }, 650);
  setTimeout(() => el.remove(), 2300);
}
// 演出：標的（場）の式をすべて登録した＝制覇。時計を止めて、派手な演出と結果報告
function huntConquer(t) {
  const H = S.hunt; if (!H || H.over) return;
  const z = zukanGet(), list = ZUKAN.filter(e => e.n === 3 && e.t === t), nPar = list.filter(e => e.expr.includes('(')).length, nDiv = list.filter(e => e.expr.includes('÷')).length;
  const mine = H.regs.concat(H.autoRegs || []).filter(r => r.t === t).length, doneT = [];
  for (let v = 1; v <= 13; v++) if (!ZUKAN.some(e => e.n === 3 && e.t === v && !z[e.id])) doneT.push(v);
  const allDone = doneT.length === 13, fixed = H.target === t;
  H.pausedAt = Date.now(); clearInterval(S.huntTimer);
  KB.sfx('horn', 2); setTimeout(() => KB.sfx('combo'), 350); setTimeout(() => KB.sfx('cutin'), 700);
  const el = document.createElement('div'); el.className = 'hunt-conq';
  const conf = Array.from({ length: 36 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 0.8).toFixed(2)}s;--r:${(Math.random() * 720 - 360) | 0}deg;--c:${['#f2b632', '#ffe066', '#ff6b6b', '#74c0fc', '#b197fc', '#fff'][i % 6]}"></i>`).join('');
  el.innerHTML = `<div class="hq-conf">${conf}</div><div class="hq-rays"></div>
    <div class="hq-panel">
      <div class="hq-crown">👑</div>
      <div class="hq-t">${allDone ? '図鑑 完全制覇！' : '制覇！'}</div>${H.lastZoro ? `<div class="hq-zoro">ゾロ目でフィナーレ！ <b>${KB.vname(t)}・${KB.vname(t)}・${KB.vname(t)}</b></div>` : ''}
      <div class="hq-card"><span class="tag">標的</span><b>${KB.vname(t)}</b></div>
      <div class="hq-rep">
        <div><small>標的 ${KB.vname(t)} の式</small><b>${list.length}<small>式すべて登録</small></b></div>
        <div><small>うちカッコ付き・÷</small><b>${nPar}<small>・</small>${nDiv}</b></div>
        <div><small>この狩りで捕獲</small><b>${mine}<small>式</small></b></div>
        <div><small>制覇した標的</small><b>${doneT.length}<small>/13</small></b></div>
      </div>
      <div class="hq-done">${doneT.map(v => `<span class="${v === t ? 'now' : ''}">${KB.vname(v)}</span>`).join('')}</div>
      <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap">${fixed || allDone ? `<button class="btn primary" data-hq="end">結果を見る</button>${allDone ? '' : '<button class="btn" data-hq="random">ランダムで続ける</button>'}` : '<button class="btn primary" data-hq="go">狩りを続ける</button>'}</div>
    </div>`;
  document.body.appendChild(el);
  if (H.auto && !allDone) setTimeout(() => { const b = el.querySelector('[data-hq="go"],[data-hq="random"]'); if (b && el.isConnected) b.click(); }, 2600); // 自動照準の間は、制覇の演出を見せてから自動で続ける
  el.querySelectorAll('[data-hq]').forEach(b => b.onclick = () => {
    const k = b.dataset.hq; el.classList.add('out'); setTimeout(() => el.remove(), 350);
    if (S.hunt !== H || H.over) return;
    if (k === 'end') { H.end = Date.now(); huntFinish(); return; }
    if (k === 'random') { H.target = null; store.set('huntT', null); }
    H.end += Date.now() - H.pausedAt; H.fieldAt = Date.now(); H.pausedAt = null; H.blocked = false; huntDeal(H); render();
    S.huntTimer = setInterval(() => { const H2 = S.hunt; if (!H2 || H2.over) { clearInterval(S.huntTimer); return; } const left = H2.end - Date.now(); document.querySelectorAll('.hunt-clock').forEach(e2 => { e2.textContent = fmtClock(left); e2.classList.toggle('hurry', left < 20000); }); if (left <= 0) huntFinish(); }, 250);
  });
}
// 見送り：時間の減点はなし。かわりに、手札に隠れていた式をしばらく見せる（その間は操作できない）
const HUNT_SHOW = 3800;
function huntPass(fail) {
  const H = S.hunt; if (!H || !H.started || H.over || H.blocked) return;
  if (fail) { const el = document.createElement('div'); el.className = 'hunt-fail'; el.innerHTML = `<b>失敗！</b><small>${esc(fail)}</small>`; document.body.appendChild(el); KB.sfx('foul'); setTimeout(() => el.remove(), 1300);
    H.blocked = true; H.msg = { bad: true, text: `失敗！ ${fail}` }; render(); setTimeout(() => { if (S.hunt !== H || H.over) return; H.blocked = false; huntPass(); const H2 = S.hunt; if (H2 === H && H.msg) { H.msg = { bad: true, text: '失敗！ ' + H.msg.text }; render(); } }, 1100); return; }
  const z = zukanGet(), t = H.field.v, forms = huntForms(H.hand.map(c => c.v), t, H.used);
  const miss = forms.filter(f => f.id && !z[f.id]), others = forms.filter(f => !(f.id && !z[f.id]));
  miss.slice(0, 3).forEach(f => { if (!H.missed.some(m => m.id === f.id)) H.missed.push({ id: f.id, s: f.s, t: f.t }); });
  H.streak = 0; H.sel = []; H.blocked = true;
  H.msg = { text: miss.length ? `獲物${miss.length}匹に逃げられた…` : forms.length ? '見送り' : '見送り（作れる式はありませんでした）' };
  huntFlee(miss, others, t);
  render();
  setTimeout(() => { const H2 = S.hunt; if (!H2 || H2 !== H || H.over) return; H.blocked = false; huntDeal(H); render(); }, HUNT_SHOW + 700);
}
function huntFinish(quit) {
  const H = S.hunt; if (!H || H.over) return;
  H.over = true; H.auto = false; clearTimeout(S.huntAutoT); clearInterval(S.huntTimer); document.querySelectorAll('.hunt-esc').forEach(e => e.remove());
  // 最後の場で作れた未登録の式も「見逃し」に入れる
  if (H.started && H.field) { const z = zukanGet(); huntNew(H.hand.map(c => c.v), H.field.v, H.used, z).slice(0, 3).forEach(f => { if (!H.missed.some(m => m.id === f.id)) H.missed.push({ id: f.id, s: f.s, t: f.t }); }); }
  const best = store.get('huntBest', null), rec = { regs: H.regs.length, score: H.score, made: H.made.length, at: Date.now() };
  H.isBest = !quit && H.started && (!best || rec.regs > best.regs || (rec.regs === best.regs && rec.score > best.score));
  H.prevBest = best;
  if (H.isBest) store.set('huntBest', rec);
  H.quit = !!quit;
  if (H.started) { huntOverlay(quit ? '狩りを中断' : '狩り終了', `${H.regs.length}式を捕獲`, 2); setTimeout(() => go('hunt-result'), 1700); } else go('hunt-result');
}
// 演出：開始・終了のオーバーレイ（照準が絞られる＋角笛）
function huntOverlay(title, sub, horn) {
  KB.sfx('horn', horn);
  const el = document.createElement('div'); el.className = 'hunt-ov';
  el.innerHTML = `<div class="hunt-ov-in">${huntReticle('ov')}<div class="hunt-ov-t">${esc(title)}</div><div class="hunt-ov-s">${esc(sub)}</div></div>`;
  document.body.appendChild(el); setTimeout(() => el.classList.add('out'), 1300); setTimeout(() => el.remove(), 1700);
}
// 演出：捕獲（場札に照準が閉じて「捕獲！」のスタンプ）
function huntCapture(expr, t, n, kind) {
  // 標的の位置に式が現れ、手札の方から弾が飛んで命中 → 「捕獲！」→ 捕獲の数へ吸い込まれる
  const sc = document.querySelector('.hunt-scope'), r = sc ? sc.getBoundingClientRect() : { left: innerWidth / 2 - 75, top: 200, width: 150, height: 150 };
  const from = (document.querySelector('[data-act="hunt-play"]') || sc).getBoundingClientRect();
  const to = (document.querySelectorAll('.hunt-stats span')[kind === 'reg' ? 1 : 0] || sc).getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2, fx = from.left + from.width / 2, fy = from.top;
  const ang = Math.atan2(cy - fy, cx - fx) * 180 / Math.PI, dist = Math.hypot(cx - fx, cy - fy);
  const el = document.createElement('div'); el.className = 'hunt-cap' + (kind ? ' hit ' + kind : '');
  el.style.left = cx + 'px'; el.style.top = cy + 'px';
  el.style.setProperty('--tx', (to.left + to.width / 2 - cx) + 'px'); el.style.setProperty('--ty', (to.top + to.height / 2 - cy) + 'px');
  el.innerHTML = `<div class="hc-ex">${esc(expr)} = ${t}</div>
    <div class="hc-bullet" style="--ang:${ang}deg;--dist:${dist}px;--bx:${fx - cx}px;--by:${fy - cy}px"></div>
    <div class="hc-hit"></div><div class="hc-ring"></div><div class="hc-stamp">${kind === 'out' ? '命中' : '捕獲！'}</div><div class="hc-n">${kind === 'reg' ? '登録済みの式' : kind === 'out' ? '図鑑外の式' : `図鑑 ${n}/${ZUKAN.length}`}</div>`;
  document.body.appendChild(el);
  KB.sfx('shot'); setTimeout(() => KB.sfx(kind === 'out' ? 'play' : 'capture'), 200);
  setTimeout(() => el.remove(), 1700);
}
// 演出：見送ったとき、手札に隠れていた式が姿を見せてから逃げていく（未登録＝獲物は大きく金色、ほかの式は小さく）
function huntFlee(miss, others, t) {
  // 未登録・登録済み・図鑑外、カッコありなしを混ぜて3つ選ぶ（未登録とカッコ付きほど選ばれやすく、大きく表示）
  const z = zukanGet(), all = miss.concat(others), w = f => (f.id && !z[f.id] ? 3 : 1) * (f.s.includes('(') ? 1.5 : 1);
  const pool = all.slice(), pick = [];
  if (miss.length) { const k = (Math.random() * miss.length) | 0; pick.push(miss[k]); pool.splice(pool.indexOf(miss[k]), 1); }
  if (others.length) { const k = (Math.random() * others.length) | 0; pick.push(others[k]); pool.splice(pool.indexOf(others[k]), 1); } // 未登録と、それ以外を必ず1つずつ混ぜる
  while (pick.length < 3 && pool.length) { const tw = pool.reduce((a, f) => a + w(f), 0); let x = Math.random() * tw, k = 0; for (; k < pool.length - 1; k++) { x -= w(pool[k]); if (x <= 0) break; } pick.push(pool.splice(k, 1)[0]); }
  KB.shuffle(pick);
  const kind = f => f.id && !z[f.id] ? ['new', '未登録'] : f.id ? ['reg', '登録済み'] : ['out', '図鑑外'];
  const rest = all.length - pick.length;
  const el = document.createElement('div'); el.className = 'hunt-esc';
  el.innerHTML = `<div class="he-panel">
    <div class="he-title">${all.length ? 'こんな式が隠れていた！' : 'この手札では作れる式がなかった'}</div>
    ${all.length ? `<div class="he-sub">獲物（未登録の式） <b>${miss.length}</b>匹・作れた式 ${all.length}</div>` : ''}
    <div class="he-list">${pick.map((f, i) => { const [c, l] = kind(f); return `<span class="he-c ${c} ${f.s.includes('(') ? 'par' : ''}" style="--i:${i};--dir:${i % 2 ? 1 : -1}"><small>${l}</small>${esc(f.s)} = ${t}</span>`; }).join('')}${rest > 0 ? `<span class="he-more" style="--i:${pick.length}">ほか${rest}</span>` : ''}</div>
  </div>`;
  document.body.appendChild(el);
  // 標的（場札）を前面に写して、その後ろから式が出てくる
  const fc = document.querySelector('.hunt-scope .fieldcard');
  if (fc) {
    const q = fc.getBoundingClientRect(), cl = fc.cloneNode(true); cl.classList.add('he-card');
    Object.assign(cl.style, { position: 'fixed', left: q.left + 'px', top: q.top + 'px', width: q.width + 'px', height: q.height + 'px', margin: 0 });
    el.appendChild(cl);
    // 文字が標的に隠れないよう、式の一覧は標的の下から並べる
    const pn = el.querySelector('.he-panel'); if (pn && q.bottom + 10 + pn.offsetHeight < innerHeight - 8) { el.style.alignItems = 'flex-start'; pn.style.marginTop = Math.max(0, q.bottom + 10 - 16) + 'px'; }
    const ccx = q.left + q.width / 2, ccy = q.top + q.height / 2;
    el.querySelectorAll('.he-c,.he-more').forEach(c => { const b = c.getBoundingClientRect(); c.style.setProperty('--fx', (ccx - (b.left + b.width / 2)) + 'px'); c.style.setProperty('--fy', (ccy - (b.top + b.height / 2)) + 'px'); });
    el.classList.add('emerge');
  }
  KB.sfx(miss.length ? 'lockon' : 'draw');
  setTimeout(() => { el.classList.add('run'); if (miss.length) KB.sfx('flee'); }, HUNT_SHOW);
  setTimeout(() => el.remove(), HUNT_SHOW + 750);
}
function huntReticle(cls) {
  return `<svg class="reticle ${cls || ''}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke-width="2"/><circle cx="50" cy="50" r="30" fill="none" stroke-width="1" stroke-dasharray="4 5"/><path d="M50 0v18M50 82v18M0 50h18M82 50h18" stroke-width="2.5"/><path d="M14 14l6 6M86 14l-6 6M14 86l6-6M86 86l-6-6" stroke-width="1.5"/></svg>`;
}
function huntHTML() {
  const H = S.hunt; if (!H) return '';
  setTimeout(() => { if (S.hunt === H) S.huntShownField = H.fieldNo; }, 0);
  const z = zukanGet(), t = H.field.v, preys = huntNew(H.hand.map(c => c.v), t, H.used, z), nNew = preys.length, nPar = preys.filter(f => f.s.includes('(')).length, nAll = zukanCount(z);
  const top = `<div class="topbar"><button class="btn ghost sm" data-act="hunt-quit">${H.started ? 'やめる' : '← ホーム'}</button><div class="where">式ハンター</div>${H.started ? `<span class="atk-clock hunt-clock">${fmtClock(H.end - Date.now())}</span>` : '<span></span>'}</div>`;
  if (!H.started) return top + `<div class="panel stack hunt-ready">
    <h2 style="margin:0">式ハンター</h2>${aimTalk()}
    <p class="small" style="margin:0">${HUNT_SEC / 60}分間、標的（場）の数を<b>手札の3枚</b>で作って、未登録の式＝獲物を捕獲しましょう。</p>
    <details class="small hunt-rules"><summary>くわしいルール</summary>
    <p class="small hunt-calm" style="margin:6px 0">🍵 得点や速さで取れるバッジはありません。バッジにつながるのは図鑑に登録した式の数（と場のコンプリート）だけなので、時間を気にせず<b>じっくり考えてOK</b>です。得点は自己ベストの記録用です。</p>
    <ul class="small" style="margin:0;padding-left:1.2em;line-height:1.7">
      <li>3枚を選んで「出す」。未登録の式（獲物）を作ると捕獲＝図鑑に登録。同じ札で作れる式が複数あるときは、未登録→この狩りで未使用の順に選ばれます。</li>
      <li>同じ式は1回の狩りで1度だけ。作れないときは「見送る」。そのとき手札に隠れていた式が少しのあいだ姿を見せます（その間は操作できません）。手札と標的（場）は毎回配り直し。</li>
      <li>得点：式10点、−＋2・×＋4・÷＋6・かっこ＋4。場がめくれて${HUNT_QUICK}秒以内に出し続けると連続ボーナス（最大＋10）。</li>
      <li><b>3枚目を選んだ時点で式が作れない組み合わせだと「失敗！」</b>。獲物に逃げられて次の手札へ。式が作れる組み合わせなら、札を戻して選び直せます。</li>
      <li>札を選ぶと、獲物（未登録の式）の筋があるか色でわかります。<b>金色</b>＝その札を含む獲物がいる、<b>青灰色</b>＝いない。1枚目から筋を探せます。</li>
      <li>図鑑に入る（獲物になる）のは、<b>÷ か「かっこ ×」を使う式</b>だけ。＋−だけの式などは「図鑑外」で、出しても登録されません。</li>
      <li>「獲物の気配」は、その手札で作れる未登録の式の数。配られる札は、獲物がいるものが少し出やすくなっています。</li>
      <li>🎯 ご褒美「自動照準」：バッジ「図鑑の場」の銀（場を3つ制覇）を持って大会の決勝に進むと1発もらえます。使うと${HUNT_SEC / 60}分間ずっと自動で捕獲（得点には入りません）。</li>
    </ul>
    </details>
    <p class="small muted" style="margin:0">図鑑 ${nAll}/${ZUKAN.length}</p>
    <div class="stack" style="gap:6px"><b class="small">標的（場の数）</b>
      <div class="hunt-tsel">${(() => { const left = {}; ZUKAN.forEach(e => { if (e.n === 3 && !z[e.id]) left[e.t] = (left[e.t] || 0) + 1; }); const all = Object.values(left).reduce((a, b) => a + b, 0);
        return [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(v => `<button class="hts ${H.target === v ? 'on' : ''} ${v && !left[v] ? 'done' : ''}" data-act="hunt-target" data-v="${v || ''}"><b>${v ? KB.vname(v) : 'ランダム'}</b><small>${v ? (left[v] ? `残り${left[v]}` : '👑制覇') : `残り${all}`}</small></button>`).join(''); })()}</div>
      <p class="small muted" style="margin:0">数字を選ぶと、標的がずっとその数になります（「図鑑の場」バッジを狙うときに）。残りは、手札3枚で作れる未登録の式の数。</p></div>
    <button class="btn primary" data-act="hunt-go">狩りを始める</button>
    ${aimCount() > 0 ? `<button class="btn aim-btn" data-act="hunt-go-aim">🎯 自動照準を使って始める<small>${HUNT_SEC / 60}分間ずっと自動で捕獲（得点には入りません）・残り${aimCount()}発</small></button>` : ''}</div>`;
  const pats = huntPatterns(H.hand, t, H.used, z), selOn = H.sel.length > 0 && pats.some(p => H.sel.every(id => p.includes(id)));
  const selHint = !H.sel.length ? '' : selOn ? (H.sel.length === 3 ? '◎ この3枚は獲物（未登録）を作れます' : `◎ 筋あり（この${H.sel.length}枚を含む獲物がいます）`) : (H.sel.length === 3 ? (() => { const fs = (ZK.byCombo[H.sel.map(i => H.hand.find(c => c.id === i).v).sort((x, y) => x - y).join(',')] || {})[t] || []; return !fs.length ? 'この3枚では作れません' : fs.some(f => f.id) ? 'この3枚の図鑑の式は登録ずみです' : '図鑑外の式です（図鑑に入るのは ÷ か「かっこ×」を使う式）'; })() : `この${H.sel.length}枚を含む獲物はいません`);
  return top + `${H.auto ? `<div class="aim-bar">🎯 自動照準 作動中　自動捕獲 <b>${H.autoRegs.length}</b>匹（得点には入りません）</div>` : ''}<div class="hunt-stats"><span>捕獲<b>${H.regs.length}</b></span><span>得点<b>${H.score}</b></span><span>連続<b>${H.streak}</b></span></div>
  <div class="panel hunt-board">
    <div class="hunt-field"><div class="hunt-scope ${nNew ? 'lock' : ''} ${S.huntShownField !== H.fieldNo ? 'fresh' : ''}">${huntReticle()}${S.huntShownField !== H.fieldNo && H.started && H.fieldNo > 1 ? '<span class="tgt-new">新しい標的！</span>' : ''}<div class="fieldcard top ${H.field.s === 1 || H.field.s === 2 ? 'red' : ''}" data-k="${H.fieldNo}"><span class="tag">標的</span><span class="big">${KB.vname(t)}</span><span class="val">${KB.SUITS[H.field.s]} ${t}</span></div></div>
      <div class="hunt-hint ${nNew ? 'on' : huntLeft(H, z).length ? '' : 'done'}">${nNew ? `<small>獲物の気配</small><b>${nNew}<small>匹</small></b><span class="hunt-par ${nPar ? '' : 'zero'}">うちカッコ付き <b>${nPar}</b></span><small>（未登録の式）</small>` : (huntLeft(H, z).length ? '<small>この手札に</small>獲物なし<small>見送りも手</small>' : `<small>${H.target ? `標的${KB.vname(H.target)}` : '図鑑'}は</small><span class="hd-crown">👑</span><b>制覇済み</b><small>${H.target ? '別の標的で狩ろう' : 'おめでとう！'}</small>`)}</div></div>
    <div class="hunt-msg ${H.msg && !(selHint && !H.blocked) ? (H.msg.bad ? 'bad' : H.msg.isNew ? 'new' : 'ok') : selHint ? (selOn ? 'trail' : 'cold') : ''}">${selHint && !H.blocked ? selHint : H.msg ? esc(H.msg.text) : '3枚を選んで「出す」　選んだ札が金色なら獲物の筋あり'}</div>
    <div class="hand hunt-hand ${S.huntShownField !== H.fieldNo ? 'fresh' : ''}">${H.hand.map((c, k) => cardHTML(c, { cls: (H.sel.includes(c.id) ? 'sel ' + (selOn ? 'trail ' : 'cold ') : '') + 'hk' + k + (c.gone ? ' gone' : ''), extra: `data-act="hunt-card" data-id="${c.id}" aria-pressed="${H.sel.includes(c.id)}"` })).join('')}</div>
    <div class="row hunt-act"><button class="btn primary" data-act="hunt-play" ${H.sel.length === 3 ? '' : 'disabled'}>出す</button><button class="btn" data-act="hunt-pass">見送る</button></div>
  </div>`;
}
function huntResultHTML() {
  const H = S.hunt; if (!H) return '';
  const z = zukanGet();
  const miss = H.missed.filter(m => !z[m.id]).slice(0, 12);
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← ホーム</button><div class="where">式ハンター 結果</div><div></div></div>
  <div class="panel stack" style="align-items:center;text-align:center">
    <div class="hunt-trophy">${huntReticle('res')}</div><div class="dq-title ok">${H.quit ? '狩りを中断' : '狩りの成果'}</div>
    <div class="atk-score"><b>${H.regs.length}</b><span>式を捕獲</span></div>
    <p style="margin:0">得点 ${H.score}・作った式 ${H.made.filter(m => !m.auto).length}</p>
    ${H.usedAim ? `<p class="small" style="margin:0">🎯 自動照準で捕獲：<b>${H.autoRegs.length}式</b>（図鑑には登録。得点・自己ベストには入りません）</p>` : ''}
    <p style="margin:0">${H.isBest ? '<b class="ok">自己ベスト更新！</b>' : H.prevBest ? `自己ベストは ${H.prevBest.regs}式・${H.prevBest.score}点` : ''}</p>
    <p class="small muted" style="margin:0">図鑑 ${zukanCount(z)}/${ZUKAN.length}</p>
  </div>
  ${H.regs.length ? `<div class="panel stack"><div class="lbl">捕獲した式（図鑑に登録）</div><div class="zk-grid">${H.regs.map(r => `<div class="zk-cell got"><span class="mono">${esc(r.s)}</span><i>= ${r.t}</i></div>`).join('')}</div></div>` : ''}
  ${miss.length ? `<div class="panel stack"><div class="lbl">逃した獲物</div><p class="small muted" style="margin:0">見送った標的や最後の標的で、手札から作れた未登録の式です。</p><div class="zk-grid">${miss.map(r => `<div class="zk-cell"><span class="mono">${esc(r.s)}</span><i>= ${r.t}</i></div>`).join('')}</div></div>` : ''}
  ${H.made.length ? `<div class="panel stack"><div class="lbl">作った式</div><div class="hunt-made">${H.made.map(m => `<span class="${m.isNew ? 'new' : ''}">${esc(m.s)} = ${m.t}<i>+${m.pts}</i></span>`).join('')}</div></div>` : ''}
  <div class="row" style="justify-content:center"><button class="btn primary" data-act="hunt-start">もう一度狩りに出る</button><button class="btn" data-go="zukan">図鑑を見る</button></div>`;
}
function huntCardHTML() {
  const b = store.get('huntBest', null), z = zukanGet();
  return `<div class="mode hunt-card"><div class="mode-head"><span class="mode-ic" aria-hidden="true">🎯</span><div><div class="lbl">EXPRESSION HUNTER</div><h2>式ハンター</h2></div></div>${modeBadgeRows(MB_HUNT, true)}
    <p class="small muted" style="margin:0">${HUNT_SEC / 60}分間の狩り。毎回配られる手札の3枚で標的（場）の数を作り、未登録の式＝獲物を捕獲して図鑑を埋めよう。</p>
    <div class="mode-rec">${b ? `<div>自己ベスト：<b class="atk-bp">${b.regs}式登録</b>（${b.score}点・${new Date(b.at).toLocaleDateString('ja-JP')}）</div>` : ''}
      <div class="row zk-mini" style="align-items:center;gap:8px"><span>図鑑 <b>${zukanCount(z)}</b>/${ZUKAN.length}</span><div class="zk-bar" style="flex:1"><i style="width:${(zukanCount(z) / ZUKAN.length * 100).toFixed(1)}%"></i></div><button class="btn sm" data-go="zukan">📖 式の図鑑</button></div>
      ${aimCount() ? `<div class="aim-fact">🎯 自動照準 ×${aimCount()}</div>` : ''}</div>
    <button class="btn primary" data-act="hunt-start">狩りに出る</button></div>`;
}
// ホーム：アウツチャレンジ（モードの1つ）
// ホーム：早見表を作成（ここで式を入れて作る。対局中は、完成した行を見るだけ）
function chartCardHTML() {
  const done = chartDone(), total = chartTotal(), full = chartFullRows().length;
  return `<div class="mode chart-card"><div class="mode-head"><span class="mode-ic" aria-hidden="true">📋</span><div><div class="lbl">QUICK CHART</div><h2>早見表を作成</h2></div></div>${modeBadgeRows(MB_CHART, true)}
    <p class="small muted" style="margin:0">多面待ちの2枚・3枚で、待ちになる数を自分の式で埋めていく表。完成した行は、対局中に見返せます。</p>
    <div class="mode-rec"><div>進み具合：<b>${done}</b>/${total}面・完成 <b>${full}</b>/${CHART_ROWS.length}行</div></div>
    <button class="btn primary" data-act="chart-open">早見表を作る</button></div>`;
}
function outsCardHTML() {
  const g = G_(), d = g.drill || null, c = g.cnt || {};
  return `<div class="mode outs-card"><div class="mode-head"><span class="mode-ic" aria-hidden="true">🔍</span><div><div class="lbl">OUTS CHALLENGE</div><h2>アウツチャレンジ</h2></div></div>${modeBadgeRows(MB_OUTS, true)}
    <p class="small muted" style="margin:0">見えている札から、次の番で上がれる札（アウツ）がいちばん多くなる出し方を選ぶ問題。5問連続で正解するとクリア、1問でも間違えると最初からやり直し。問題はだんだん難しくなります。</p>
    ${d && d.n ? `<div class="mode-rec"><div>これまで <b>${d.ok}</b>/${d.n}問正解・クリア <b>${c.outs5 || 0}</b>回</div></div>` : ''}
    <button class="btn primary" data-act="drill">アウツチャレンジに挑戦</button></div>`;
}
function growthCardHTML() {
  const g = G_(), r = ratingOf(g.games);
  return `<div class="panel growth-card">
    <div class="gc-head"><div class="lbl"><span class="mode-ic sm" aria-hidden="true">📈</span>あなたの成長</div></div>
    <div class="gc-body">
      <div class="gc-rate">${r.ok ? `<span class="gc-stars">${stars(r.r)}</span><b>${r.r.toFixed(1)}</b><small>${rateLabel(r.r)}相当</small>` : `<b class="gc-wait">測定中</b><small>あと${r.need}回の判断で推定実力を表示</small>`}</div>
      ${sparkSVG(ratingSeries(g.games).slice(-15), 160, 46)}
    </div>
    <div class="gc-foot"><span>連続最善 最長${g.cnt.streakMax || 0}（いま${g.cnt.streakNow || 0}）</span><span>バッジ ${ACH.reduce((n, a) => n + a[2].filter(t => g.ach[a[0] + ':' + t]).length, 0)}/${ACH_TOTAL}</span></div>
    <div class="gc-btns"><button class="btn primary gc-big" data-go="growth">成長記録を見る</button></div>
  </div>`;
}
// ---------- 成績をXでシェア：成績カード画像（スゲーだろ要素入り）＋ハッシュタグ・リンク付きの投稿 ----------
// 公開先：claude.ai の外（独自のサイト）で開かれているときは、そのサイトのURLをシェアに使う
// 公開版（デプロイナウ）の住所。アーティファクト版の中ではアーティファクトのURL、それ以外（公開版）では公開版のURLをシェアに使う
const PUBLIC_URL = 'https://keisan-bridge.lolipop-now.app/';
const ARTIFACT_URL = 'https://claude.ai/artifact/Mkh8TNciukTYjh41D9YyWD';
const IS_ARTIFACT = typeof location === 'undefined' || !/^https?:$/.test(location.protocol) || /claude\.(ai|site)|claudeusercontent/.test(location.hostname);
const APP_URL = IS_ARTIFACT ? ARTIFACT_URL : PUBLIC_URL;
// 引っ越しボタン（アーティファクト版 → 公開版）を出すか。考案者の了承が取れて公開版を出したら true にする
const MIGRATE_ON = true;
// ---------- クラウド保存とランキング（公開版だけ。window.KB_CLOUD_API にAPIのURLが入っているとき） ----------
// 記録の正本はクラウド。端末には控え（すぐ遊べるように）と、ログインの鍵だけを置く。引き継ぎコードで別の端末からも同じ記録に入れる
const CLOUD_API = (typeof window !== 'undefined' && window.KB_CLOUD_API) || '';
const CLOUD_ON = !IS_ARTIFACT && !!CLOUD_API;
const CLOUD_KEEP = { 'kb.cloud': 1, 'kb.cloudAt': 1, 'kb.migDone': 1 }; // 同期しない・消さないもの
const CLOUD = { busy: false, timer: null, status: '', err: '', dirty: false, dirtyP: new Set() };
// 記録はプレイヤーごとにクラウドへ保存する（引き継ぎコードもプレイヤーごと）。端末の鍵（kb.cloud）は、この端末で作ったプレイヤーの保存に使う。
// 引き継ぎコードで別の端末から入れたプレイヤーは、そのプレイヤーだけの鍵（kb.p.<pid>.link の token）で保存する
const PL_LOCAL = { link: 1, cloudAt: 1 }; // プレイヤーの鍵と、最後にクラウドとそろえた時刻（クラウドには送らない）
const plKey = (pid, k) => 'kb.p.' + pid + '.' + k;
const plOf = k => { const m = /^kb\.p\.([a-z0-9]+)\.(.+)$/i.exec(k || ''); return m ? { pid: m[1], k: m[2] } : null; };
function plLink(pid) {
  const l = raw.get(plKey(pid, 'link'), null) || {};
  if (l.token) return l; // 別の端末から入れたプレイヤー
  if (l.dead) return null; // 鍵が使えなくなった（作った端末で消された）
  const c = raw.get('kb.cloud', null); return c && c.token ? Object.assign({}, l, { uid: c.uid, token: c.token, own: 1 }) : null;
}
const plAt = pid => raw.get(plKey(pid, 'cloudAt'), null);
function plSetLocal(pid, k, v) { try { localStorage.setItem(plKey(pid, k), JSON.stringify(v)); } catch (e) { } } // 同期しない控え（cloudDirty を通さない）
function cloudDirty(k) {
  if (!CLOUD_ON || !k || CLOUD_KEEP[k] || k === 'kb.recentLines' || !k.startsWith('kb.')) return;
  const p = plOf(k);
  if (p) { if (PL_LOCAL[p.k]) return; CLOUD.dirtyP.add(p.pid); }
  else if (k === 'kb.profiles') { if (PID) CLOUD.dirtyP.add(PID); profiles().forEach(x => { if (plAt(x.id) == null) CLOUD.dirtyP.add(x.id); }); } // 名前の変更・新しいプレイヤー
  else return; // 端末の設定（効果音など）は端末ごと
  CLOUD.dirty = true; clearTimeout(CLOUD.timer); CLOUD.timer = setTimeout(cloudPush, 4000);
}
async function cloudReq(a, body, keep) {
  const r = await fetch(CLOUD_API + '?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), keepalive: !!keep });
  const j = await r.json().catch(() => ({ ok: false, error: '通信エラー' }));
  if (!j.ok) { const e = new Error(j.error || '通信エラー'); e.status = r.status; e.conflict = !!j.conflict; throw e; }
  return j;
}
function cloudData() { const d = migCollect(); for (const k in CLOUD_KEEP) delete d[k]; return d; }
// プレイヤー1人分の記録（kb.p.<pid>.* と名前）
function plData(pid) {
  const keys = {}, pre = 'kb.p.' + pid + '.';
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre) && !PL_LOCAL[k.slice(pre.length)]) keys[k.slice(pre.length)] = localStorage.getItem(k); } } catch (e) { }
  const pr = profiles().find(x => x.id === pid) || {};
  return { v: 1, name: pr.name || '', created: pr.at || 0, keys };
}
// クラウドの記録でプレイヤー1人分を置きかえる（いなければ、この端末に加える）
function plApply(pid, data, at) {
  try {
    const pre = 'kb.p.' + pid + '.', ks = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre) && !PL_LOCAL[k.slice(pre.length)]) ks.push(k); }
    ks.forEach(k => localStorage.removeItem(k));
    for (const k in (data.keys || {})) if (!PL_LOCAL[k]) localStorage.setItem(pre + k, data.keys[k]);
    const L = profiles(), pr = L.find(x => x.id === pid);
    if (pr) { if (data.name) pr.name = data.name; } else L.push({ id: pid, name: data.name || 'プレイヤー', at: data.created || Date.now() });
    localStorage.setItem('kb.profiles', JSON.stringify(L));
    if (pid === PID && data.name) { const st = raw.get(keyOf('settings'), {}) || {}; st.name = data.name; localStorage.setItem(keyOf('settings'), JSON.stringify(st)); }
    plSetLocal(pid, 'cloudAt', at);
  } catch (e) { return false; }
  return true;
}
// ランキング用の数字（プレイヤーごと）：推定実力・バッジ数とBP・バッジアタックの自己ベスト
function statsOf(p) {
  const g = raw.get('kb.p.' + p.id + '.growth', null) || { games: [], ach: {} }, r = g.games ? ratingOf(g.games) : { ok: false };
  const ach = g.ach || {}, badges = ACH.reduce((n, a) => n + a[2].filter(t => ach[a[0] + ':' + t]).length, 0);
  const ab = raw.get('kb.p.' + p.id + '.attackBest', null) || {}, atk = ab.bp != null ? ab.bp : (ab[15] || ab[45] || {}).bp || 0;
  const avr = raw.get('kb.p.' + p.id + '.avatar', null);
  return { pid: p.id, name: p.name, hide: !!raw.get('kb.p.' + p.id + '.rankHide', false), rating: r.ok ? Math.round(r.r * 100) / 100 : null, badges, bp: Math.round(bpTotal({ ach })), atk, streak: (g.cnt && g.cnt.streakMax) || 0, avatar: avr ? Object.assign({}, AVATAR_DEF, avr) : null, bio: raw.get('kb.p.' + p.id + '.bio', '') || '', card: cardBrief(cardDataOf(p.id, p.name)) };
}
function cloudStats() { return profiles().map(statsOf); }
// プレイヤー1人を保存する。ほかの端末のほうが新しければ、そちらを読み込む
async function plPush(pid, keep) {
  const l = plLink(pid), pr = profiles().find(x => x.id === pid); if (!l || !pr) return;
  const at = Date.now(), base = plAt(pid) || 0;
  try {
    const j = await cloudReq('p_save', { token: l.token, pid, data: plData(pid), at, base, stats: statsOf(pr) }, keep);
    plSetLocal(pid, 'cloudAt', at);
    if (j.code && l.code !== j.code) { const s0 = raw.get(plKey(pid, 'link'), null) || {}; s0.code = j.code; plSetLocal(pid, 'link', s0); }
    CLOUD.status = 'saved'; CLOUD.err = '';
  } catch (e) {
    if (e.conflict) { if (!keep) await plPull(pid); return; }
    CLOUD.dirtyP.add(pid); CLOUD.dirty = true; // 送れなかった変更は次に送る
    if (e.status === 401) { if (l.own) { try { localStorage.removeItem('kb.cloud'); } catch (x) { } } else { const s0 = raw.get(plKey(pid, 'link'), null) || {}; plSetLocal(pid, 'link', { dead: 1, code: s0.code }); CLOUD.dirtyP.delete(pid); } }
    CLOUD.status = 'error'; CLOUD.err = e.message;
  }
}
// 変更があったプレイヤーだけ送る（force はすべてのプレイヤー）
async function cloudPush(keep, force) {
  const c = raw.get('kb.cloud', null); if (!CLOUD_ON || CLOUD.busy) return;
  if (force) profiles().forEach(p => CLOUD.dirtyP.add(p.id));
  if (!CLOUD.dirtyP.size || (!c && !profiles().some(p => (raw.get(plKey(p.id, 'link'), null) || {}).token))) return;
  const ids = [...CLOUD.dirtyP]; CLOUD.dirtyP.clear(); CLOUD.dirty = false;
  CLOUD.busy = true;
  try { for (const pid of ids) await plPush(pid, keep); } finally { CLOUD.busy = false; }
}
// クラウドのほうが新しいプレイヤーを読み込む。対局中なら、ホームに戻ったときに読み込む
async function plPull(pid) {
  if (S.view === 'game' || S.view === 'hunt' || S.view === 'drill') { CLOUD.pendingPull = true; return; }
  const l = plLink(pid); if (!l) return;
  try { const j = await cloudReq('p_load', { token: l.token, pid }); if (j.data && j.at > (plAt(pid) || 0) && plApply(pid, j.data, j.at)) { toast('ほかの端末の新しい記録を読み込みました'); setTimeout(() => location.reload(), 800); } } catch (e) { }
}
async function cloudPull() { for (const p of profiles()) await plPull(p.id); }
async function cloudInit() {
  if (!CLOUD_ON) return;
  try {
    let c = raw.get('kb.cloud', null);
    if (!c || !c.token) { const j = await cloudReq('register'); c = { uid: j.uid, token: j.token, code: j.code }; try { localStorage.setItem('kb.cloud', JSON.stringify(c)); } catch (e) { } }
    // プレイヤーごとに、クラウドと端末の新しいほうにそろえる
    const oldAt = raw.get('kb.cloudAt', 0) || 0; let changed = false;
    for (const p of profiles()) {
      const l = plLink(p.id); if (!l) continue;
      try {
        const j = await cloudReq('p_load', { token: l.token, pid: p.id });
        let loc = plAt(p.id); if (loc == null) loc = l.own ? oldAt : 0; // 前の版（端末まるごと）から移るときは、端末の保存時刻
        if (j.code && l.code !== j.code) { const s0 = raw.get(plKey(p.id, 'link'), null) || {}; s0.code = j.code; plSetLocal(p.id, 'link', s0); }
        if (j.data && j.at > loc) { if (plApply(p.id, j.data, j.at)) changed = true; }
        else { if (plAt(p.id) == null) plSetLocal(p.id, 'cloudAt', j.at || 0); if (!j.data || loc > j.at) CLOUD.dirtyP.add(p.id); }
      } catch (e) { if (e.status === 401 && !l.own) { const s0 = raw.get(plKey(p.id, 'link'), null) || {}; plSetLocal(p.id, 'link', { dead: 1, code: s0.code }); } else throw e; }
    }
    if (changed) { // クラウドのほうが新しい：開き直す（1回だけ）
      let once = false; const sig = String(profiles().map(p => plAt(p.id)).join()); try { once = sessionStorage.getItem('kb.cloudReload') === sig; sessionStorage.setItem('kb.cloudReload', sig); } catch (e) { }
      if (!once) { location.reload(); return; }
    }
    if (CLOUD.dirtyP.size) { CLOUD.dirty = true; await cloudPush(); }
    CLOUD.status = CLOUD.status === 'error' ? 'error' : 'saved';
  } catch (e) { CLOUD.status = 'error'; CLOUD.err = e.message; if (e.status === 401) { try { localStorage.removeItem('kb.cloud'); } catch (x) { } } }
}
// プレイヤーの引き継ぎコードで、そのプレイヤーをこの端末に加える（この端末のほかのプレイヤーはそのまま）
async function cloudRestore(code) {
  try {
    const j = await cloudReq('p_restore', { code });
    const mine = raw.get('kb.cloud', null), own = mine && mine.uid === j.uid; // この端末で作ったプレイヤーなら端末の鍵のまま
    plSetLocal(j.pid, 'link', own ? { code: j.code } : { uid: j.uid, token: j.token, code: j.code });
    const data = j.data || { name: j.name || 'プレイヤー', keys: {} }; if (j.name) data.name = j.name;
    PID = j.pid; try { localStorage.setItem('kb.profile', JSON.stringify(j.pid)); } catch (e) { }
    plApply(j.pid, data, j.at || 0); // いまのプレイヤーにして、名前もそろえる
    toast(`「${data.name}」をこの端末に入れました`); setTimeout(() => location.reload(), 700);
    return true;
  } catch (e) { toast(e.message || '引き継げませんでした'); return false; }
}
if (CLOUD_ON && typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(CLOUD.timer); cloudPush(true); } });
function cloudPanelHTML() {
  if (!CLOUD_ON) return '';
  const l = PID ? plLink(PID) : null, code = l && l.code;
  return `<div class="lbl">引き継ぎコード（${esc(S.settings.name)}）</div>
    <p class="small" style="margin:0">記録はプレイヤーごとにクラウドに保存されます。別の端末で${esc(san(S.settings.name))}の記録を使うときは、その端末で<b>このコード</b>を入れてください。どちらの端末で遊んでも、同じ記録に保存されます（この端末のほかのプレイヤーは入りません）。名前やメールは送っていません。${CLOUD.status === 'error' ? `<br><span class="ng">いまは保存できていません（${esc(CLOUD.err)}）</span>` : ''}</p>
    ${code ? `<div class="row" style="align-items:center;gap:8px;flex-wrap:wrap"><span class="mono cl-code" id="cl-code" data-code="${esc(code)}">••••-••••-••••</span><button class="btn sm" data-act="cloud-show">表示</button><button class="btn sm" data-act="cloud-copy">コピー</button></div><p class="small muted" style="margin:0">コードは人に教えないでください。知っている人は、このプレイヤーの記録に入れます。</p>` : `<p class="small muted" style="margin:0">${l && !l.token && l.dead ? 'このプレイヤーは、作った端末で消されたため保存できません。' : 'はじめて保存したあとに、ここにコードが出ます。'}</p>`}
    <details class="small"><summary>別の端末のプレイヤーを、この端末に入れる</summary><div class="row" style="gap:6px;flex-wrap:wrap;margin-top:6px"><input id="cl-in" class="name-input" placeholder="XXXX-XXXX-XXXX" maxlength="16" style="max-width:200px"><button class="btn sm" data-act="cloud-restore">入れる</button></div><p class="small muted" style="margin:4px 0 0">そのプレイヤーが、この端末のプレイヤーに加わります。いまこの端末にいるプレイヤーの記録は、そのまま残ります。</p></details>`;
}
// ---------- ランキング ----------
// 4つのランキングを並べて全部見せる（各上位20人＋20位より下の自分）
const RANK_DEFS = [['total', '総合', '推定実力・BP・連続最善・バッジアタックの4つを、それぞれ1位の成績を満点とした割合で点数にして合わせたもの（100点満点。全部1位なら100点）。配分は推定実力35・BP30・連続最善20・バッジアタック15。'], ['rating', '推定実力', '直近の判断の質から出した推定実力（★）。判断が8回以上たまると載ります。'], ['badges', 'バッジ数', '獲得したバッジの数（同じ数ならBPの多い順）。'], ['bp', 'BP（バッジポイント）', 'バッジの段階（銅・銀・金）と取りにくさで決まるポイントの合計。'], ['streak', '連続最善', '最善手を続けて打った最長記録。'], ['attack', 'バッジアタック', 'バッジアタック（15分）の自己ベスト。']];
// 「あなた」は今プレイしているプレイヤーだけ（同じ端末・同じアカウントのほかのプレイヤーは名前だけ）
const rankMe = x => !!x.me && (x.pid == null || x.pid === PID);
function rankingHTML() {
  const R = S.rank && S.rank.rankings, hide = !!raw.get('kb.p.' + PID + '.rankHide', false);
  const val = (k, x) => k === 'total' ? `${(x.total || 0).toFixed(1)}点` : k === 'streak' ? `${x.streak}回` : k === 'rating' ? `★${x.rating.toFixed(1)}` : k === 'badges' ? `${x.badges}個<small>${x.bp}BP</small>` : k === 'bp' ? `${x.bp}BP<small>${x.badges}個</small>` : `${x.atk}BP`;
  const rowH = (k, x) => `<div class="rk-row ${rankMe(x) ? 'me' : ''}" data-act="rank-card" data-rid="${esc(x.rid || '')}" data-me="${rankMe(x) ? 1 : ''}" role="button" tabindex="0" aria-label="${esc(x.name)}のプロフィールを見る"><b class="rk-n">${x.rank}</b><span class="rk-av">${KB.avatarSVG(Object.assign({ name: x.name }, x.avatar || AVATAR_DEF), { mood: 'happy' })}</span><span class="rk-nm">${esc(x.name)}${x.ai ? '<em class="ai-chip" title="倶楽部のAI研究員">AI</em>' : ''}${x.rid && rivalsOf().some(r => r.rid === x.rid) ? '<em class="rv-chip" title="あなたのライバル">⚔</em>' : ''}${rankMe(x) ? '<small>あなた</small>' : ''}</span><span class="rk-v">${val(k, x)}</span></div>`;
  const sec = ([k, label, note]) => { const d = R && R[k]; return `<section class="panel stack rk-sec"><div class="rk-h"><h2>${label}</h2>${d ? `<small>全${d.total}人</small>` : ''}</div><p class="small muted" style="margin:0">${note}</p>
    <div class="rk-list">${!R ? '<p class="small muted">読み込み中…</p>' : !d ? '<p class="small muted">サーバーの更新後に表示されます。</p>' : (d.list.map(x => rowH(k, x)).join('') + (d.mine.filter(rankMe).length ? '<div class="rk-gap">…</div>' + d.mine.filter(rankMe).map(x => rowH(k, x)).join('') : '')) || '<p class="small muted">まだだれも載っていません。</p>'}</div></section>`; };
  const withAi = rankWithAi();
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← 戻る</button><div class="where">ランキング</div><div></div></div>
  <div class="rk-ai-bar"><button class="btn sm rk-ai-tg ${withAi ? 'on' : ''}" data-act="rank-ai" aria-pressed="${withAi}">🤖 AI研究員を含む：${withAi ? 'ON' : 'OFF'}</button><span class="small muted">「AI」の印は、ごちゃまぜ倶楽部のキャラ（AI）が毎日の対局で育てている記録です</span></div>
  <div class="rk-all">${RANK_DEFS.map(sec).join('')}</div>
  <div class="panel stack"><label class="small row" style="gap:6px;align-items:center"><input type="checkbox" id="rk-hide" ${hide ? 'checked' : ''}> ${esc(S.settings.name)}をランキングに載せない</label>
    <p class="small muted" style="margin:0">ランキングに出るのはプレイヤー名とアバター、上の数字だけです。ふさわしくない名前は「研究員○○」と表示されます。各ランキングは上位20人まで。20位より下のときは、自分の順位を下に出します。</p></div>`;
}
const rankWithAi = () => raw.get('kb.rankAI', true) !== false; // 見る人ごとの設定（はじめはON）
async function rankingLoad() {
  const c = (PID && plLink(PID)) || raw.get('kb.cloud', null);
  const bindHide = () => { const h = $('#rk-hide'); if (h) h.onchange = () => { raw.set('kb.p.' + PID + '.rankHide', h.checked); clearTimeout(CLOUD.timer); cloudPush().then(() => { S.rank = null; if (S.view === 'ranking') render(); }); }; };
  bindHide();
  if (S.rank && !S.rank.home && S.rank.ai === rankWithAi() && Date.now() - S.rank.at < 30000) return; // ホームで読んだ分は、保存の前のものなので読み直す
  try {
    await cloudPush();
    const u = encodeURIComponent((c && c.uid) || ''), j = await (await fetch(CLOUD_API + '?a=rankings&uid=' + u + (rankWithAi() ? '' : '&ai=0'))).json();
    let R = j.rankings;
    if (!R) { // サーバーが古いとき：これまでのランキングを1つずつ読む（BPは出せない）
      R = {}; for (const k of ['rating', 'badges', 'attack']) { const x = await (await fetch(CLOUD_API + '?a=ranking&type=' + k + '&uid=' + u)).json(); if (x.ok) R[k] = { list: x.list.slice(0, 20), mine: x.list.slice(20).filter(y => y.me), total: x.total }; }
    }
    S.rank = { rankings: R, at: Date.now(), ai: rankWithAi() };
  } catch (e) { S.rank = { rankings: {}, at: Date.now(), ai: rankWithAi() }; toast('ランキングを読み込めませんでした'); }
  if (S.view === 'ranking') { $('#app').innerHTML = rankingHTML(); bind(); bindHide(); }
}
// ランキングでアイコンを押すと、その人の成績カード（Xの共有画像と同じもの）と自己紹介を出す
// ランキング・タイトルのアイコンを押したときのプロフィール（スマホで見やすい独自の表示。X用の画像とは別）
// 上にアイコンと名前を大きく＋推定実力・総合の順位（AI込み・人だけ）、その下に成績のタイル・カテゴリーの紋章・バッジ・自己紹介
// 称号（自分で選んだオンライン大会の成績）：プロフィールの名前の上に出す
const placeJa = p => ['', '優勝', '準優勝', '3位'][p] || '';
function pvTitle(D) {
  let t = D.titleShow; if (!t && D.title && D.awards) { const a = D.awards.find(x => x.tid === D.title); if (a) t = { text: `${a.tname} ${placeJa(+a.place)}`, official: +a.official, place: +a.place }; }
  return t ? `<div class="pv-title ${t.official ? 'off' : ''} p${t.place}">${t.place === 1 ? '👑' : t.place === 2 ? '🥈' : '🥉'} ${t.official ? '<em>公式</em>' : ''}${esc(t.text)}</div>` : '';
}
// 大会のメダルの数（公式・オンラインで別々）
function podiumHTML(aw) {
  if (!aw || !aw.length) return '';
  const row = off => { const L = aw.filter(a => !!+a.official === off); if (!L.length) return ''; const c = [1, 2, 3].map(p => L.filter(a => +a.place === p).length);
    return `<div class="pv-pod ${off ? 'off' : ''}"><b>${off ? '公式大会' : 'オンライン大会'}</b>${c.map((n, i) => n ? `<span class="pv-md m${i + 1}" title="${placeJa(i + 1)}">${['🥇', '🥈', '🥉'][i]}<small>×${n}</small></span>` : '').join('')}</div>`; };
  return `<div class="pv-pods">${row(true)}${row(false)}</div>`;
}
// 称号を選ぶ（自分のプロフィールから。いまのプレイヤーが取ったオンライン大会の成績から1つ）
function titleModal() {
  const L = (ON.myAwards || []).filter(a => a.pid === PID).sort((a, b) => (+b.official) - (+a.official) || a.place - b.place), cur = store.get('title', '');
  modal(`<div class="stack"><h3 style="margin:0">👑 称号を選ぶ</h3><p class="small muted" style="margin:0">ランキングから開くプロフィールで、名前の上に出ます。</p>
    <div class="ttl-list"><button class="ttl ${!cur ? 'on' : ''}" data-act="title-set" data-id="">つけない</button>${L.map(a => `<button class="ttl ${cur === a.tid ? 'on' : ''} ${+a.official ? 'off' : ''}" data-act="title-set" data-id="${esc(a.tid)}">${['👑', '🥈', '🥉'][a.place - 1]} ${+a.official ? '<em>公式</em>' : ''}${esc(a.tname)} ${placeJa(+a.place)}</button>`).join('')}</div>
    ${L.length ? '' : '<p class="small muted" style="margin:0">オンライン大会（人が10人以上）で3位以内に入ると、称号が選べるようになります。</p>'}
    <div class="row" style="justify-content:flex-end"><button class="btn" data-act="close">閉じる</button></div></div>`);
}
function profHTML(D, o) {
  const g = { ach: D.ach || {} }, NAME = D.name || 'プレイヤー', r = D.rating;
  const stars = r != null ? [...Array(5)].map((_, i) => `<i class="${i < Math.floor(r + 1e-9) ? 'on' : (i === Math.floor(r) && r % 1 >= 0.5) ? 'half' : ''}">★</i>`).join('') : '';
  const tiles = [
    ['大会', D.champion ? `優勝${D.champion}回` : D.qualify ? `決勝${D.qualify}回` : '—', g.ach['champion_strong:2'] ? '全員達人で優勝' : g.ach['champion_strong:1'] ? '強豪ぞろいで優勝' : g.ach['qualify_strong:2'] ? '全員達人で決勝' : ''],
    ['バッジアタック', D.atk ? `${D.atk}BP` : '—', D.atk ? `バッジ${D.atkBadges || 0}個` : ''],
    ['式ハンター', D.hunt ? `${D.hunt}式` : '—', D.hunt ? '1回の最多捕獲' : ''],
    ['式の図鑑', `${D.zukan || 0}`, `/ ${ZUKAN.length}式`],
    ['連続最善', `${D.streak || 0}回`, '最長記録'],
    ['アウツチャレンジ', D.outs5 ? `${D.outs5}回` : '—', D.outs5 ? 'クリア' : '']];
  const all = []; ACH_GROUPS.forEach(([, ks]) => ks.forEach(k => { const a = ACH.find(z => z[0] === k); if (a) a[2].forEach((t, i) => all.push({ a, i, got: !!g.ach[a[0] + ':' + t] })); }));
  const got = all.filter(b => b.got);
  return `<div class="pv">
    <div class="pv-head"><div class="pv-av">${KB.avatarSVG(Object.assign({}, D.avatar || AVATAR_DEF, { name: NAME }), { mood: 'happy' })}</div>
      <div class="pv-tx">${pvTitle(D)}<div class="pv-nm"><b>${esc(NAME)}</b>${o.ai ? '<em class="ai-chip">AI研究員</em>' : ''}${o.me ? '<small class="pv-me">あなた</small>' : ''}</div>
        ${r != null ? `<div class="pv-rt"><span class="pv-st">${stars}</span><b>${r.toFixed(1)}</b><small>推定実力 ${rateLabel(r)}相当</small></div>` : '<div class="pv-rt"><small>推定実力はまだ出ていません</small></div>'}
        <div class="pv-rk" id="pv-rk"></div>${CLOUD_ON ? rvcHTML(D.rivals || [], D.rivalBy || [], NAME) : ''}</div></div>
    <div class="pv-tiles">${tiles.map(([l, v, sb]) => `<div class="pv-tile ${v === '—' ? 'none' : ''}"><small>${l}</small><b>${v}</b>${sb ? `<em>${sb}</em>` : ''}</div>`).join('')}</div>
    <div class="pv-bh"><b>バッジ</b><span><b>${got.length}</b>/${all.length}・${bpTotal(g)} BP</span></div>
    <div class="pv-emb">${ACH_GROUPS.map((_, gi) => { const cp = catProgress(g, gi); return `<span title="${esc(cp.name)}">${emblemSVG(gi, cp.done, 30)}<small>${cp.have}/${cp.all}</small></span>`; }).join('')}</div>
    <div class="pv-badges">${got.length ? got.map(b => badgeSVG(b.a, b.i, true, 26)).join('') : '<small class="muted">まだバッジはありません</small>'}</div>
    ${podiumHTML(D.awards)}
    ${(D.awards || []).length ? `<div class="pv-aw"><b>🏆 オンライン大会の実績</b>${D.awards.map(a => `<span>${['🥇', '🥈', '🥉'][a.place - 1] || ''} ${+a.official ? '<em class="on-off">公式</em> ' : ''}${esc(a.tname)}<small>${new Date(a.at * 1000).toLocaleDateString('ja-JP')}</small></span>`).join('')}</div>` : ''}
    ${D.bio ? `<div class="rk-bio"><small>${esc(NAME)}の${o.ai ? 'プロフィール（AI研究員）' : '自己紹介'}</small>${esc(D.bio).replace(/\n/g, '<br>')}</div>` : ''}
  </div>`;
}
async function rankCardOpen(rid, me, el) {
  const isAi = !!((el && el.closest('.rk-row') && el.closest('.rk-row').querySelector('.ai-chip')) || (el && /AI研究員/.test(el.title || '')));
  modal(`<div class="stack share-modal rk-card"><div class="pv-box"><span class="small muted">プロフィールを読み込んでいます…</span></div>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div></div>`);
  try {
    let d;
    if (me) d = Object.assign(cardDataOf(PID, S.settings.name), { rivals: rivalsOf(), rivalBy: rvByMine() }, { avatar: myAvatar(), ach: G_().ach, zukan: zukanCount(zukanGet()), bio: store.get('bio', ''), awards: (ON.myAwards || []).filter(a => a.pid === PID).sort((x, y) => x.place - y.place) });
    else {
      if (!rid) throw new Error('old');
      const j = await (await fetch(CLOUD_API + '?a=card&rid=' + encodeURIComponent(rid))).json(); if (!j.ok) throw new Error(j.error);
      d = Object.assign({}, j.card, { ach: Object.fromEntries((j.card.ach || []).map(k => [k, 1])) });
    }
    const ai = isAi || !!d.ai, b = $('#modal .pv-box'); if (!b) return;
    b.innerHTML = profHTML(d, { ai, me });
    // ライバル：ほかの人は「ライバルにする」、自分は「だれから指定されているか」
    if (CLOUD_ON && PID && !me && rid) { const cl = $('#modal .rk-card > .row'); if (cl) { cl.insertAdjacentHTML('afterbegin', rivalBtnHTML(rid, d.name || 'プレイヤー')); bindModalActs(); } }
    if (CLOUD_ON && PID && me) rvByFetch(true).then(() => { const bx = $('#modal .pv-rvc'); if (bx) { bx.outerHTML = rvcHTML(rivalsOf(), rvByMine(), S.settings.name); bindModalActs(); } });
    // 総合の順位（AI込み・人だけ。AI研究員は人だけの順位なし）
    try { if (!S.homeRank || !S.rankHuman || Date.now() - (S.homeRankAt || 0) > 300000) await homeRankFetch(); } catch (e) { }
    const a = totalRankOf(S.homeRank, rid, me), h = ai ? null : totalRankOf(S.rankHuman, rid, me), box = $('#modal #pv-rk');
    if (box && (a || h)) box.innerHTML = `🏆 総合${a ? `<span>AI込み<b>${a}位</b></span>` : ''}${h ? `<span>人だけ<b>${h}位</b></span>` : ''}`;
  } catch (e) { const b = $('#modal .pv-box'); if (b) b.innerHTML = '<span class="small">プロフィールを読み込めませんでした。</span>'; }
}
function bioEdit(from) {
  S.bioFrom = from || 'profiles';
  const v = store.get('bio', '') || '';
  modal(`<div class="stack"><h2 style="margin:0">自己紹介</h2><p class="small muted" style="margin:0">${CLOUD_ON ? 'ランキングでアイコンを押すと、成績カードといっしょに表示されます。' : ''}140文字まで。URL・連絡先・ふさわしくない言葉が入っていると、ほかの人には表示されません。</p>
    <textarea id="bio-text" rows="4" maxlength="140" placeholder="例）3枚出しの研究中。目標は全員達人の大会で優勝！">${esc(v)}</textarea><div class="small muted" id="bio-n" style="text-align:right">${[...v].length}/140</div>
    <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-act="${S.bioFrom === 'home' ? 'close' : 'profiles'}">戻る</button><button class="btn primary" data-act="bio-save">保存する</button></div></div>`);
  const t = $('#bio-text'); if (t) { t.oninput = () => { const n = $('#bio-n'); if (n) n.textContent = [...t.value].length + '/140'; }; setTimeout(() => t.focus(), 50); }
}
const SHARE_TAGS = ['計算ブリッジ', '作戦研究所'];
// 自慢ポイント：すごい順に並べる（点数が高いほど上）
function shareBoasts() {
  const g = G_(), c = g.cnt || {}, r = ratingOf(g.games), out = [];
  const add = (score, label, value, line) => out.push({ score, label, value, line });
  if (g.ach['champion_strong:2']) add(100, '全員達人の大会', '優勝', '全員達人の大会で優勝');
  else if (g.ach['champion_strong:1']) add(90, '強豪ぞろいの大会', '優勝', '強豪ぞろいの大会で優勝');
  if (c.champion) add(70 + c.champion, '大会優勝', `${c.champion}回`, `大会優勝${c.champion}回`);
  if (g.ach['qualify_strong:2'] && !g.ach['champion_strong:2']) add(75, '全員達人の大会', '決勝進出', '全員達人の大会で決勝進出');
  if (r.ok) add(r.r * 15, '推定実力', `★${r.r.toFixed(1)}`, `推定実力★${r.r.toFixed(1)}（${rateLabel(r.r)}相当）`);
  if (c.streakMax >= 5) add(30 + c.streakMax * 3, '連続最善', `${c.streakMax}回`, `連続最善${c.streakMax}回`);
  const nb = ACH.reduce((n, a) => n + a[2].filter(t => g.ach[a[0] + ':' + t]).length, 0);
  if (nb) add(20 + nb, 'バッジ', `${nb}/${ACH_TOTAL}`, `バッジ${nb}個・${bpTotal(g)}BP`);
  const cats = ACH_GROUPS.filter((_, gi) => catProgress(g, gi).done).length; if (cats) add(50 + cats * 8, 'コンプリート', `${cats}分野`, `${cats}分野のバッジをコンプリート`);
  const ab = attackBests()[15]; if (ab) add(25 + ab.bp / 30, 'バッジアタック', `${ab.bp}BP`, `バッジアタック${ab.bp}BP`);
  const hb = store.get('huntBest', null); if (hb && hb.regs) add(25 + hb.regs * 2, '式ハンター', `${hb.regs}式捕獲`, `式ハンターで${hb.regs}式捕獲`);
  const zn = zukanCount(zukanGet()); if (zn) add(15 + zn / 4, '式の図鑑', `${zn}式`, `式の図鑑${zn}/${ZUKAN.length}`);
  if (c.outs5) add(30 + c.outs5 * 3, 'アウツチャレンジ', `${c.outs5}回クリア`, `アウツチャレンジ${c.outs5}回クリア`);
  return out.sort((a, b) => b.score - a.score);
}
function shareText() {
  // 主要な結果だけをシンプルに：推定実力・バッジ・各モードの記録
  const g = G_(), c = g.cnt || {}, r = ratingOf(g.games), nb = ACH.reduce((n, a) => n + a[2].filter(t => g.ach[a[0] + ':' + t]).length, 0);
  const ab = attackBests()[15], hb = store.get('huntBest', null);
  const modes = [ab ? `バッジアタック${ab.bp}BP` : null].filter(Boolean);
  const parts = [r.ok ? `推定実力★${r.r.toFixed(1)}（${rateLabel(r.r)}相当）` : null, `バッジ${nb}/${ACH_TOTAL}・${bpTotal(g)}BP`, modes.length ? modes.join('／') : null].filter(Boolean);
  return `【計算ブリッジ】${S.settings.name}\n${parts.join('\n')}`;
}
function shareIntentURL() {
  return 'https://x.com/intent/post?' + new URLSearchParams({ text: shareText(), url: APP_URL, hashtags: SHARE_TAGS.join(',') }).toString();
}
const svgToImg = svg => new Promise(res => {
  if (!/xmlns=/.test(svg.slice(0, 200))) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null);
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});
// 成績カードの中身（自分のカードと、ランキングで見るほかの人のカードで共通）
function cardDataOf(pid, name) {
  const P = k => raw.get('kb.p.' + pid + '.' + k, null);
  const g = P('growth') || { games: [], ach: {} }, c = g.cnt || {}, r = g.games ? ratingOf(g.games) : { ok: false };
  const ab0 = P('attackBest') || {}, ab = ab0.bp != null ? ab0 : (ab0[15] || null), hb = P('huntBest'), avr = P('avatar');
  return { name, avatar: avr ? Object.assign({}, AVATAR_DEF, avr) : null, rating: r.ok ? Math.round(r.r * 100) / 100 : null, ach: Object.assign({}, g.ach || {}),
    champion: c.champion || 0, qualify: c.qualify || 0, atk: ab ? ab.bp : 0, atkBadges: ab ? ab.badges || 0 : 0, hunt: hb && hb.regs || 0,
    zukan: zukanCount(P('zukan') || {}), streak: c.streakMax || 0, outs5: c.outs5 || 0, bio: P('bio') || '', title: P('title') || '' };
}
// サーバーに送るカード：バッジは取ったものの名前だけ
function cardBrief(d) { return { ach: Object.keys(d.ach).filter(k => d.ach[k] && /^[a-z0-9_]+:\d+$/i.test(k)), champion: d.champion, qualify: d.qualify, atkBadges: d.atkBadges, hunt: d.hunt, zukan: d.zukan, streak: d.streak, outs5: d.outs5, title: d.title || '' }; }
async function shareCard(data, opt) {
  const W = 1200, H = 675, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  try { await Promise.all(['400 60px "Dela Gothic One"', '900 30px "Zen Kaku Gothic New"', '700 30px "Zen Kaku Gothic New"'].map(f => document.fonts.load(f))); } catch (e) { }
  const DISP = '"Dela Gothic One","Hiragino Sans",sans-serif', BODY = '"Zen Kaku Gothic New","Hiragino Sans",sans-serif';
  const D = data || Object.assign(cardDataOf(PID, S.settings.name), { avatar: myAvatar(), ach: G_().ach, zukan: zukanCount(zukanGet()) });
  const NAME = D.name || 'プレイヤー', g = { ach: D.ach || {} }, c = { champion: D.champion, qualify: D.qualify, streakMax: D.streak, outs5: D.outs5 }, r = D.rating != null ? { ok: true, r: D.rating } : { ok: false };
  const rr = (X, Y, w, h, rad) => { x.beginPath(); x.moveTo(X + rad, Y); x.arcTo(X + w, Y, X + w, Y + h, rad); x.arcTo(X + w, Y + h, X, Y + h, rad); x.arcTo(X, Y + h, X, Y, rad); x.arcTo(X, Y, X + w, Y, rad); x.closePath(); };
  // 背景
  let gr = x.createRadialGradient(W * 0.3, H * 0.25, 60, W * 0.5, H * 0.5, W * 0.8); gr.addColorStop(0, '#1d4a37'); gr.addColorStop(1, '#07140e');
  x.fillStyle = gr; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#f2b632'; x.lineWidth = 6; rr(14, 14, W - 28, H - 28, 26); x.stroke();
  x.strokeStyle = 'rgba(242,182,50,.35)'; x.lineWidth = 2; rr(26, 26, W - 52, H - 52, 20); x.stroke();
  // 上段：ロゴ・名前・推定実力・カテゴリーの紋章
  const AVS = 112, NX = 56 + AVS + 22;
  try { const av = await svgToImg(KB.avatarSVG(Object.assign({}, D.avatar || AVATAR_DEF, { name: NAME }), { mood: 'happy' }).replace('<svg', `<svg width="${AVS * 2}" height="${AVS * 2}"`)); if (av) { x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 14; x.drawImage(av, 54, 40, AVS, AVS); x.restore(); x.strokeStyle = '#f2b632'; x.lineWidth = 3; rr(54, 40, AVS, AVS, AVS * 0.2); x.stroke(); } } catch (e) { }
  x.fillStyle = '#f2b632'; x.font = `22px ${DISP}`; x.fillText('計算ブリッジ 作戦研究所', NX, 70);
  x.fillStyle = '#fbf3dc'; x.font = `54px ${DISP}`; x.fillText(NAME, NX, 138, 270);
  const nameW = Math.min(270, x.measureText(NAME).width);
  if (r.ok) {
    const full = Math.floor(r.r + 1e-9), half = r.r % 1 >= 0.5 && r.r < 5; let sx = NX + nameW + 26;
    x.font = `30px ${DISP}`;
    for (let i = 0; i < 5; i++) { x.fillStyle = i < full ? '#f2b632' : (i === full && half) ? 'rgba(242,182,50,.55)' : 'rgba(255,255,255,.15)'; x.fillText('★', sx, 112); sx += 32; }
    x.fillStyle = '#fbf3dc'; x.font = `34px ${DISP}`; x.fillText(r.r.toFixed(1), sx + 8, 114);
    x.fillStyle = '#f2b632'; x.font = `900 20px ${BODY}`; x.fillText(`推定実力 ${rateLabel(r.r)}相当`, NX + nameW + 26, 140);
  }
  for (let gi = 0; gi < ACH_GROUPS.length; gi++) { const done = catProgress(g, gi).done, im = await svgToImg(emblemSVG(gi, done, 60)); const X = W - 52 - (ACH_GROUPS.length - gi) * 54; if (im) { if (done) { x.save(); x.shadowColor = 'rgba(217,164,255,.8)'; x.shadowBlur = 16; } x.globalAlpha = done ? 1 : 0.35; x.drawImage(im, X, 44, 50, 50); x.globalAlpha = 1; if (done) x.restore(); } x.fillStyle = done ? '#e9c8ff' : 'rgba(255,255,255,.35)'; x.font = `700 11px ${BODY}`; x.textAlign = 'center'; x.fillText(ACH_GROUPS[gi][0], X + 25, 108, 52); x.textAlign = 'left'; }
  // 右上（紋章の下）：総合ランキングの順位（AI込み・人だけ）
  if (opt && opt.ranks && (opt.ranks.a || opt.ranks.h)) {
    const parts = [opt.ranks.a ? ['AI込み', opt.ranks.a] : null, opt.ranks.h ? ['人だけ', opt.ranks.h] : null].filter(Boolean);
    x.textAlign = 'right'; let rx = W - 56;
    for (let i = parts.length - 1; i >= 0; i--) {
      const [l, v] = parts[i]; x.fillStyle = '#f2b632'; x.font = `34px ${DISP}`; x.fillText(`${v}位`, rx, 156); rx -= x.measureText(`${v}位`).width + 8;
      x.fillStyle = '#c9c2ad'; x.font = `700 19px ${BODY}`; x.fillText(l, rx, 154); rx -= x.measureText(l).width + 22;
    }
    x.fillStyle = '#fbf3dc'; x.font = `900 20px ${BODY}`; x.fillText('🏆 総合ランキング', rx, 154); x.textAlign = 'left';
  }
  // 左：バッジをズラッと（全スロット。取ったものは輝き、まだのものは影）
  const all = []; ACH_GROUPS.forEach(([, ks]) => ks.forEach(k => { const a = ACH.find(z => z[0] === k); if (a) a[2].forEach((t, i) => all.push({ a, i, got: !!g.ach[a[0] + ':' + t] })); }));
  // バッジはいつも同じ位置（カテゴリー順）。取ったものだけが輝くので、埋まり具合が見える
  const nb = all.filter(b => b.got).length;
  x.fillStyle = '#fbf3dc'; x.font = `26px ${DISP}`; x.fillText('バッジ', 56, 196);
  x.fillStyle = '#f2b632'; x.font = `40px ${DISP}`; x.fillText(`${nb}`, 150, 198); const nw = x.measureText(`${nb}`).width;
  x.fillStyle = '#c9c2ad'; x.font = `700 20px ${BODY}`; x.fillText(`/ ${all.length}　${bpTotal(g)} BP`, 158 + nw, 196);
  const cols = 13, cell = 49, bx = 56, by = 214;
  for (let k = 0; k < all.length; k++) {
    const b = all[k], col = k % cols, row = Math.floor(k / cols), X = bx + col * cell, Y = by + row * 46;
    if (Y > 600) break;
    const im = await svgToImg(badgeSVG(b.a, b.i, b.got, 44));
    if (im) { x.globalAlpha = b.got ? 1 : 0.28; x.drawImage(im, X, Y, 44, 44); x.globalAlpha = 1; }
  }
  // 右：各モードの成績をバーンと
  const ab = D.atk ? { bp: D.atk, badges: D.atkBadges } : null, hb = D.hunt ? { regs: D.hunt } : null, zn = D.zukan || 0;
  const tiles = [
    ['大会', c.champion ? `優勝${c.champion}回` : c.qualify ? `決勝${c.qualify}回` : '—', g.ach['champion_strong:2'] ? '全員達人で優勝' : g.ach['champion_strong:1'] ? '強豪ぞろいで優勝' : g.ach['qualify_strong:2'] ? '全員達人で決勝' : ''],
    ['バッジアタック', ab ? `${ab.bp}BP` : '—', ab ? `バッジ${ab.badges}個` : ''],
    ['式ハンター', hb && hb.regs ? `${hb.regs}式` : '—', hb && hb.regs ? '1回の最多捕獲' : ''],
    ['式の図鑑', `${zn}`, `/ ${ZUKAN.length}式`],
    ['連続最善', `${c.streakMax || 0}回`, '最長記録'],
    ['アウツチャレンジ', c.outs5 ? `${c.outs5}回` : '—', c.outs5 ? 'クリア' : '']
  ];
  tiles.forEach(([lab, val, sub], i) => {
    const X = 724 + (i % 2) * 212, Y = 176 + Math.floor(i / 2) * 116;
    x.fillStyle = 'rgba(0,0,0,.38)'; rr(X, Y, 200, 104, 14); x.fill(); x.strokeStyle = 'rgba(242,182,50,.55)'; x.lineWidth = 2; rr(X, Y, 200, 104, 14); x.stroke();
    x.fillStyle = '#c9c2ad'; x.font = `700 17px ${BODY}`; x.fillText(lab, X + 14, Y + 27, 175);
    x.save(); x.shadowColor = 'rgba(255,200,80,.6)'; x.shadowBlur = val === '—' ? 0 : 14;
    const grd = x.createLinearGradient(0, Y + 40, 0, Y + 80); grd.addColorStop(0, '#fff6c0'); grd.addColorStop(1, '#f2a020');
    x.fillStyle = val === '—' ? 'rgba(255,255,255,.3)' : grd; x.font = `38px ${DISP}`; x.fillText(val, X + 14, Y + 74, 175); x.restore();
    if (sub) { x.fillStyle = '#c9c2ad'; x.font = `700 14px ${BODY}`; x.fillText(sub, X + 14, Y + 95, 175); }
  });
  // 博士とマサ（小さく）
  for (const [who, X] of [['root', 1010], ['masa', 1084]]) {
    const im = await svgToImg(KB.casterSVG(who, 'happy'));
    x.save(); x.beginPath(); x.arc(X + 34, 556, 34, 0, Math.PI * 2); x.fillStyle = '#0b1a14'; x.fill(); x.clip(); if (im) x.drawImage(im, X, 522, 68, 68); x.restore();
    x.strokeStyle = '#f2b632'; x.lineWidth = 3; x.beginPath(); x.arc(X + 34, 556, 34, 0, Math.PI * 2); x.stroke();
  }
  x.fillStyle = '#fbf7ee'; x.font = `900 16px ${BODY}`; x.textAlign = 'right'; x.fillText(r.ok && r.r >= 3.5 ? 'これはホンマもんや！' : 'ようやっとるで！', 1000, 560); x.textAlign = 'left';
  // 足もと
  x.fillStyle = 'rgba(255,255,255,.6)'; x.font = `700 17px ${BODY}`;
  x.fillText(SHARE_TAGS.map(t => '#' + t).join('  ') + '    ' + APP_URL.replace('https://', ''), 56, 646);
  return cv;
}
async function shareOpen() {
  modal(`<div class="stack share-modal"><h3 style="margin:0">成績をXでシェア</h3>
    <div class="share-prev"><span class="small muted">成績カードを作っています…</span></div>
    <p class="small muted" style="margin:0">① 画像を保存 → ② Xの投稿画面で画像を添付して投稿。文面・ハッシュタグ・アプリへのリンクは入った状態で開きます。</p>
    <div class="share-text small">${esc(shareText()).replace(/\n/g, '<br>')}<br><span class="muted">${SHARE_TAGS.map(t => '#' + t).join(' ')} ${esc(APP_URL)}</span></div>
    <div class="row" style="justify-content:flex-end;flex-wrap:wrap;gap:8px"><button class="btn" data-act="close">閉じる</button><button class="btn" data-act="share-save" disabled>① 画像を保存</button><a class="btn x-btn" href="${esc(shareIntentURL())}" target="_blank" rel="noopener"><b>𝕏</b> ② Xに投稿</a></div></div>`);
  try {
    let ranks = null; // 総合ランキングの順位（クラウド版だけ。読み込めなければ入れない）
    if (CLOUD_ON) { try { if (!S.homeRank || !S.rankHuman || Date.now() - (S.homeRankAt || 0) > 300000) await Promise.race([homeRankFetch(), new Promise(r => setTimeout(r, 3000))]); } catch (e) { } ranks = { a: totalRankOf(S.homeRank, null, true), h: totalRankOf(S.rankHuman, null, true) }; }
    const cv = await shareCard(null, { ranks }); S.shareCanvas = cv;
    const url = cv.toDataURL('image/png'), box = document.querySelector('.share-prev');
    if (box) box.innerHTML = `<img src="${url}" alt="成績カード" style="width:100%;border-radius:10px;display:block">`;
    const sb = document.querySelector('[data-act="share-save"]'); if (sb) sb.disabled = false;
  } catch (e) { const box = document.querySelector('.share-prev'); if (box) box.innerHTML = '<span class="small">画像を作れませんでした。</span>'; }
}
async function shareSave() {
  const cv = S.shareCanvas; if (!cv) return;
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const fn = `計算ブリッジ_成績_${S.settings.name}_${new Date().toISOString().slice(0, 10)}.png`;
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: fn, data: blob }); toast('画像を保存しました'); return; } } catch (e) { if (e && e.code === 'declined') return; }
  // 保存の機能が使えないとき：ふつうのダウンロードを試し、だめなら長押し（右クリック）で保存してもらう
  if (!(window.claude && window.claude.use)) { try { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = fn; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); toast('画像を保存しました'); return; } catch (e) { } }
  toast('画像を長押し（右クリック）して保存してください');
}
function growthHTML() {
  const g = G_(), r = ratingOf(g.games), cs = catStats(g.games), fouls = g.games.slice(-20).reduce((a, x) => a + (x.f || 0), 0);
  const series = ratingSeries(g.games);
  // 得意な（平均損失が小さい）場面から順に。押すと博士が解説
  const known = cs.filter(c => c.n >= 3).sort((a, b) => a.avg - b.avg);
  const maxAvg = Math.max(4, ...known.map(c => c.avg));
  const allAvg = (() => { let n = 0, sm = 0; g.games.slice(-40).forEach(x => x.ds.forEach(d => { if (!d.h) { n++; sm += d.l; } })); return n ? sm / n * 100 : 0; })();
  const unknown = cs.filter(c => c.n < 3);
  const catRows0 = known.map((c, i) => `<button class="cat-row" data-cat="${c.k}"><span class="cat-name">${esc(c.label)}${i === 0 && known.length > 2 ? '<em class="t-good">得意</em>' : ''}${i === known.length - 1 && known.length > 2 && c.avg > allAvg ? '<em class="t-weak">苦手</em>' : ''}</span><span class="cat-bar"><i style="width:${Math.min(100, c.avg / maxAvg * 100).toFixed(0)}%"></i></span><span class="cat-val">${c.avg.toFixed(1)}pt<small>（${c.n}回）</small></span></button>`).join('');
  // まだ3回たまっていない場面も「未計測」として並べる
  const catRows = catRows0 + unknown.map(c => `<button class="cat-row unmeasured" data-cat="${c.k}"><span class="cat-name">${esc(c.label)}</span><span class="cat-bar"></span><span class="cat-val">未計測<small>（${c.n}回）</small></span></button>`).join('');
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← 戻る</button><div class="where">成長記録</div><div></div></div>
  <div class="stack">
  <button class="share-banner" data-act="share-open"><span class="sb-ic">𝕏</span><span><b>成績カードを作ってXでシェア</b><small>バッジ一覧・各モードの成績・博士とマサ入り</small></span><span class="sb-go">›</span></button>
  <div class="panel stack">
    <div class="lbl">推定実力</div>
    ${r.ok ? `<div class="gr-rate"><span class="gc-stars">${stars(r.r)}</span><b>${r.r.toFixed(1)}</b><span>${rateLabel(r.r)}AI相当</span></div>
    <div class="gr-metrics"><span>判断の実力 <b>★${r.base.toFixed(1)}</b></span><span>お手つき <b>${r.fouls}回</b>${r.pen > 0.04 ? `（−${r.pen.toFixed(1)}）` : ''}</span><span>最善率 <b>${pct(r.best)}</b></span>${r.hinted ? `<span>AIを見た手 <b>${r.hinted}回</b></span>` : ''}<span>平均損失 <b>${r.avg.toFixed(1)}pt</b></span></div>
    ${sparkSVG(series, 320, 110)}` : `<p style="margin:0">測定中です。あと${r.need}回の判断で、推定実力を表示します。</p>`}
    <p class="small muted" style="margin:0">直近100回の判断（最善率と平均損失。AIの読みを見た手は、その場面の難しさに応じて★2くらいの手として数える）を、AIの★1〜5が同じ判定で打ったときの実測値と比べた「判断の実力」から、お手つきの割合に応じて差し引いています（判断10回につき1回のお手つきで−0.5）。</p>
  </div>
  <div class="panel stack">
    <div class="lbl">場面別の得意・苦手</div>
    ${catRows || '<p class="small muted" style="margin:0">もう少しプレイすると、場面ごとの傾向が見えてきます。</p>'}
    <p class="small muted" style="margin:0">直近40ゲームで、その場面での1判断あたりの平均損失（小さいほど得意）。全体の平均は${allAvg.toFixed(1)}pt。項目を押すと博士が解説します（AIの読みを見た手は除いています）。</p>
  </div>
  <div class="panel stack">
    <div class="lbl">バッジ（${ACH.reduce((n, a) => n + a[2].filter(t => g.ach[a[0] + ':' + t]).length, 0)}/${ACH_TOTAL}）・合計 <b class="atk-bp">${bpTotal(g)} BP</b></div>
    <p class="small muted" style="margin:0">BP（バッジポイント）は、バッジの段階（銅・銀・金）と取りにくさで決まります。カテゴリーの特別バッジは${BP_CAT}BP。${(() => { const b = attackBests(); return b[15] ? `バッジアタックの自己ベストは${b[15].bp}BP（ここの合計とは別集計）。` : ''; })()}</p>
    ${ACH_GROUPS.map(([gn, keys]) => { const list = keys.map(k => ACH.find(x => x[0] === k)).filter(Boolean); const have = list.reduce((n, a) => n + a[2].filter(t => g.ach[a[0] + ':' + t]).length, 0), all = list.reduce((n, a) => n + a[2].length, 0); const gi = ACH_GROUPS.findIndex(x => x[0] === gn), done = have >= all; if (done && !g.ach['cat:' + gi]) { g.ach['cat:' + gi] = Date.now(); G_save(g); } return `<div class="bdg-group ${done ? 'complete' : ''}"><div class="bdg-gh"><button class="emb-btn" data-emb="${gi}" aria-label="特別バッジ ${esc(CAT_SPECIAL[gn])}">${emblemSVG(gi, done, 44)}</button><span class="bdg-gt"><b>${esc(gn)}</b><small>特別バッジ「${esc(CAT_SPECIAL[gn])}」（${BP_CAT}BP・アバター${(CROWN_SETS[gn] || []).length}点セット）${done ? '' : '：すべて集めると獲得'}</small></span>${done ? '<span class="complete-tag">COMPLETE</span>' : `<small>${have}/${all}</small>`}</div><div class="bdg-grid">${list.flatMap(a => a[2].map((t, i) => { const got = !!g.ach[a[0] + ':' + t]; return `<button class="bdg-cell ${got ? 'got' : ''}" data-bdg="${a[0]}:${i}" aria-label="${esc(a[4][i])}：${esc(a[3](t))}">${badgeSVG(a, i, got, 40)}<b>${esc(a[4][i])}</b><small>${esc(a[3](t))}</small><i class="bp-s">${bpOf(a[0], i)}BP</i></button>`; })).join('')}</div></div>`; }).join('')}
  </div>
  <div class="panel stack">
    <div class="lbl">記録</div>
    <div class="rec-top"><div><small>連続最善の最長記録</small><b>${g.cnt.streakMax || 0}</b></div><div><small>いまの連続最善</small><b>${g.cnt.streakNow || 0}</b></div><div><small>推定実力の最高</small><b>${g.cnt.rating ? '★' + g.cnt.rating.toFixed(1) : '—'}</b></div></div>
    <div class="rec-list">${[
      ['ゲーム数', g.cnt.games], ['1セットの最少PP（5ゲーム以上・4人以上）', g.cnt.set_low ? 100 - g.cnt.set_low : '—'], ['上がり', g.cnt.win], ['パーフェクトゲーム（判断3回以上すべて最善）', g.cnt.perfect], ['全手好手セット（すべて好手以上）', g.cnt.perfect_set],
      ['3枚出し', g.cnt.three], ['かっこ付きの割り算', g.cnt.div_paren], ['ミラクルセット（A・2・6）', g.cnt.miracle], ['ベストペア（2・6）', g.cnt.bestpair],
      ['ミスがハマった上がり', g.cnt.miss_lucky], ['お手つきゼロのセット（判定後モード）', g.cnt.no_foul_set], ['練習セット完走', g.cnt.practice_set],
      ['大会完走', g.cnt.tour_done], ['決勝進出', g.cnt.qualify], ['優勝', g.cnt.champion], ['アウツチャレンジ（ヒントなしの成功／挑戦）', g.drill ? `${g.cnt.outs5 || 0}／${g.drill.sets || 0}` : 0], ['アウツチャレンジ（最高到達）', g.drill && g.drill.best ? (g.drill.best >= 5 ? '全問クリア' : `${g.drill.best}問目まで`) : 0], ['アウツチャレンジ（正解した問題／解いた問題）', g.drill ? `${g.drill.ok}／${g.drill.n}` : 0]
    ].map(([k, v]) => `<div class="rec-row"><span>${esc(k)}</span><b>${v || 0}</b></div>`).join('')}</div>
  </div>
  <div class="row" style="justify-content:flex-end"><button class="btn sm ghost" data-act="growth-reset">${S.resetArm ? 'もう一度押すとリセットします' : '成長記録をリセット'}</button></div>
  </div>`;
}

// ---------- ホーム ----------
// ---------- アウツチャレンジ：見えている札で、次の番に上がれる確率がどう変わるかを考える ----------
const catLabel = k => CATS[k] || (k === 'outs' ? 'アウツチャレンジ' : k);
// 問題づくり：難しさ（1〜5）に応じて、手札の枚数・選択肢の数・出た札の多さ・「全部見えている数字」のひっかけを変える
function genOutsProblem(level) {
  level = level || 3;
  const want = [null, { hand: [3, 4], minOpts: 2, maxOpts: 2, seen: [8, 12], twist: false }, { hand: [4, 4], minOpts: 3, maxOpts: 3, seen: [10, 15], twist: false },
    { hand: [4, 5], minOpts: 3, maxOpts: 3, seen: [12, 18], twist: true }, { hand: [5, 5], minOpts: 4, seen: [14, 20], twist: true }, { hand: [5, 5], minOpts: 5, seen: [18, 26], twist: true }][level];
  let fallback = null;
  for (let tries = 0; tries < 3000; tries++) {
    const deck = KB.newDeck();
    const nHand = want.hand[0] + ((Math.random() * (want.hand[1] - want.hand[0] + 1)) | 0);
    const handCards = deck.splice(0, nHand).sort((a, b) => a.v - b.v || a.s - b.s), fieldCard = deck.pop(), t = fieldCard.v, hand = handCards.map(c => c.v);
    const seenCards = deck.splice(0, want.seen[0] + ((Math.random() * (want.seen[1] - want.seen[0] + 1)) | 0));
    if (want.twist || Math.random() < 0.3) { const v = 1 + ((Math.random() * 13) | 0); for (let i = deck.length - 1; i >= 0; i--) if (deck[i].v === v) seenCards.push(deck.splice(i, 1)[0]); }
    KB.shuffle(seenCards);
    const unseen = new Array(14).fill(0); deck.forEach(c => unseen[c.v]++);
    const counts = KB.countsOf(hand);
    const moves = KB.findMoves(counts, t, 'all', 3);
    if (moves.some(m => m.n === nHand)) continue; // その場で上がれる問題は出さない
    const opts = {};
    for (const m of moves) {
      const rest = KB.sub(counts, m.vals), key = rest.join(','), left = nHand - m.n;
      if (opts[key]) continue;
      const ts = []; if (left <= 3) for (let f = 1; f <= 13; f++) if (KB.findMoves(rest, f, 'all', 3).some(x => x.n === left)) ts.push(f);
      opts[key] = { m, rest, left, ts, faces: ts.length, outs: ts.reduce((a, f) => a + unseen[f], 0), dead: ts.filter(f => unseen[f] === 0) };
    }
    const L = Object.values(opts).sort((a, b) => b.outs - a.outs || b.faces - a.faces);
    if (L.length < want.minOpts || (want.maxOpts && L.length > want.maxOpts) || !L[0].outs) continue;
    if (L[1] && L[0].outs - L[1].outs < (level <= 2 ? 3 : 1)) continue; // 正解は必ず一つ。★1・★2は2番目と3枚以上の差をつける
    // ★4・★5は、思いつきやすい出し方が正解にならない問題だけにする
    if (level >= 4) {
      // 思いつきにくさ：枚数が多いほど・掛け算や割り算やかっこを使うほど高い（×1・÷1 は思いつきやすい扱い）
      const hard = o => (o.m.n - 1) + [0, 0, 1, 1.5, 2][o.m.cls] - (/[×÷] 1(?!\d)|1 ×/.test(o.m.expr) ? 1 : 0);
      const easy = L.slice().sort((a, b) => hard(a) - hard(b) || a.m.expr.length - b.m.expr.length).slice(0, level >= 5 ? 2 : 1);
      if (easy.includes(L[0]) || hard(L[0]) <= hard(easy[easy.length - 1])) continue; // ★4は思いつきやすい1つ、★5は2つ（同じくらい簡単な式も含む）を正解にしない
      if (hard(L[0]) < 2) continue; // ★4以上の正解は、3枚使いか掛け算・割り算を含む式
      if (level >= 5 && hard(L[0]) < 3) continue; // ★5の正解は3枚使いか、かっこ・掛け算を含む式
    }
    const maxFaces = Math.max(...L.map(o => o.faces));
    const twist = L[0].faces < maxFaces || L.some(o => o.dead.length && o.faces >= L[0].faces);
    const np = 4 + ((Math.random() * 2) | 0), names = ['あなた', 'ユイ', 'ケンジ', 'ミサキ', 'ゲンゾウ'].slice(0, np);
    const piles = names.map(n => ({ n, cards: [] })), fields = [];
    seenCards.forEach((c, i) => { if (i % (np + 2) === np + 1) fields.push(c); else piles[(i * 7 + 3) % np].cards.push(c); });
    const p = { level, hand, handCards, fieldCard, seenCards, piles, fields, t, unseen, total: deck.length, opts: L, twist };
    if (!want.twist || twist) return p;
    if (!fallback) fallback = p;
  }
  return fallback || genOutsProblem(Math.max(1, level - 1));
}
function restCards(rest) { const a = []; for (let v = 1; v <= 13; v++) for (let k = 0; k < rest[v]; k++) a.push(KB.vname(v)); return a.join('・') || 'なし'; }
const DRILL_N = 5;
function newDrill() { return { i: 0, p: genOutsProblem(1), sel: [], ans: null, hint: false, results: [] }; }
function drillHTML() {
  const D = S.drill || (S.drill = newDrill());
  if (D.done) return drillDoneHTML(D);
  const p = D.p;
  const card = (c, cls, extra) => `<div class="card mini ${c.s === 1 || c.s === 2 ? 'red' : ''} ${cls || ''}" ${extra || ''}><span class="v">${KB.vname(c.v)}</span><span class="s">${KB.SUITS[c.s]}</span></div>`;
  const selVals = D.sel.map(i => p.handCards[i].v), m = selVals.length ? KB.evalSelection(selVals, p.t) : null;
  const handHTML = p.handCards.map((c, i) => `<button class="dq-card ${D.sel.includes(i) ? 'up' : ''}" data-dqc="${i}" ${D.ans ? 'disabled' : ''}>${card(c)}</button>`).join('');
  let body = '';
  if (!D.ans) {
    body = `<div class="dq-pick">${selVals.length ? (m ? `<span class="mono">${esc(m.expr)} = ${p.t}</span><span class="small muted">残り ${restCards(KB.sub(KB.countsOf(p.hand), m.vals))}</span>` : `<span class="ng">${selVals.map(KB.vname).join('・')} では ${p.t} を作れません</span>`) : '<span class="small muted">出す札を1〜3枚タップしてください</span>'}</div>
      <button class="btn primary" data-act="drill-submit" ${m ? '' : 'disabled'}>これで決定</button>`;
  } else {
    const mine = D.ans, best = p.opts[0].outs, ok = mine.outs === best;
    body = `<p style="margin:0">${ok ? '<b class="ok">正解！</b> アウツがいちばん多い出し方です。' : `<b class="ng">残念…</b> あなたの出し方はアウツ${mine.outs}枚。いちばん多いのは${best}枚でした。`}</p>
      <div class="lbl">出し方の一覧（アウツの多い順）</div>
      <div class="dq-list">${p.opts.map((o, k) => `<div class="dq-item ${o.outs === best ? 'best' : ''} ${o === mine ? 'mine' : ''}"><div class="dq-ih"><span class="mono">${esc(o.m.expr)} = ${p.t}</span>${o === mine ? '<em class="t-mine">あなた</em>' : ''}${o.outs === best ? '<em class="t-best">最多</em>' : ''}</div>
        <div class="small">残り <b>${restCards(o.rest)}</b>（${o.left}枚）${o.left > 3 ? '→ 次の番では上がれない' : `→ ${o.faces}面待ち`}</div>
        ${o.ts.length ? `<div class="dq-ts">${o.ts.map(f => `<span class="${p.unseen[f] ? '' : 'dead'}">${KB.vname(f)}<small>${p.unseen[f]}枚</small></span>`).join('')}</div>` : ''}
        <div class="small">アウツ <b>${o.outs}枚</b> ／ 見えていない札 ${p.total}枚 → 約<b>${Math.round(o.outs / p.total * 100)}%</b></div></div>`).join('')}</div>
      ${(() => { const top = p.opts[0], mf = p.opts.reduce((a, o) => o.faces > a.faces ? o : a, p.opts[0]); return mf !== top && mf.faces > top.faces ? `<p class="small" style="margin:0">面の数だけなら「${esc(mf.m.expr)}」の${mf.faces}面が最多ですが、${mf.dead.length ? `${mf.dead.map(KB.vname).join('・')}はもう全部見えていて来ません。` : '残り枚数の少ない数字が多く、実際に来る枚数では負けています。'}</p>` : ''; })()}
      <button class="btn primary" data-act="drill-next">${!ok ? 'チャレンジ失敗…結果を見る' : D.i + 1 < DRILL_N ? '次の問題へ' : 'クリア！結果を見る'}</button>`;
  }
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← ホーム</button><div class="where">アウツチャレンジ ${D.i + 1}/${DRILL_N}</div><div class="small muted">難しさ ${'★'.repeat(p.level)}</div></div>
  <div class="panel stack drill">
    <p style="margin:0"><b>次の番で上がれる札（アウツ）がいちばん多くなるように、出す札を選んでください。</b></p>
    <p class="small muted" style="margin:0">アウツ＝残った札をちょうど出し切れる場の数字の、まだ見えていない札の枚数。</p>
    <div class="dq-row"><span class="lbl">場</span><div class="dq-hand">${card(p.fieldCard, 'field')}</div></div>
    <div class="dq-row"><span class="lbl">これまでに出た札（${p.seenCards.length}枚）</span>
    <div class="dq-piles">${p.piles.map(pl => `<div class="dq-pile"><span class="dq-pn">${esc(pl.n)}</span><div class="dq-seen">${pl.cards.length ? pl.cards.map(c => card(c, 'tiny')).join('') : '<span class="small muted">なし</span>'}</div></div>`).join('')}${p.fields.length ? `<div class="dq-pile"><span class="dq-pn">前の場札</span><div class="dq-seen">${p.fields.map(c => card(c, 'tiny')).join('')}</div></div>` : ''}</div>
    <span class="small muted">見えていない札（山札と他の人の手札）は合計${p.total}枚。</span></div>
    ${D.hint || D.ans ? `<div class="dq-row"><span class="lbl">まだ見えていない札（残り枚数）</span><div class="unseen">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(v => `<div class="${p.unseen[v] ? '' : 'zero'}">${KB.vname(v)}<b>${p.unseen[v]}</b></div>`).join('')}</div></div>` : `<button class="btn sm ghost" data-act="drill-hint" style="align-self:flex-start">ヒント：残り枚数を見る</button>`}
    <div class="dq-row"><span class="lbl">あなたの手札</span><div class="dq-hand dq-sel">${handHTML}</div></div>
    ${body}
  </div>`;
}
function drillDoneHTML(D) {
  const ok = D.results.filter(r => r.ok).length, clear = ok === DRILL_N, clean = clear && D.results.every(r => !r.hint), g = G_();
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← ホーム</button><div class="where">アウツチャレンジ 結果</div><div></div></div>
  <div class="panel stack drill" style="align-items:center;text-align:center">
    <div class="dq-title ${clear ? 'ok' : 'ng'}">${clear ? 'チャレンジ成功！' : 'チャレンジ失敗…'}</div>
    <div class="dq-big">${clear ? '全5問クリア' : `${ok + 1}問目で失敗`}</div>
    <div class="dq-steps">${Array.from({ length: DRILL_N }, (_, k) => { const r = D.results[k]; return `<span class="${r ? (r.ok ? 'ok' : 'ng') : ''}"><b>${k + 1}</b><small>${'★'.repeat(k + 1)}</small><i>${r ? (r.ok ? (r.hint ? 'ヒント' : '正解') : '×') : '—'}</i></span>`; }).join('')}</div>
    <p style="margin:0">${clean ? 'ヒントなしで成功です！' : clear ? 'ヒントを使った問題がありました。次はヒントなしで成功を目指しましょう。' : '全部出てしまった数字に注意して、もう一度1問目から挑戦しましょう。'}</p>
    <p class="small muted" style="margin:0">これまでの最高：${g.drill && g.drill.best ? (g.drill.best >= DRILL_N ? '全問クリア' : `${g.drill.best}問目までクリア`) : '—'}・ヒントなしの成功 ${g.cnt.outs5 || 0}回</p>
    <div class="row"><button class="btn primary" data-act="drill">${clear ? 'もう一度挑戦' : 'リトライ'}</button></div>
  </div>`;
}
function drillSubmit() {
  const D = S.drill, p = D.p; if (!D || D.ans) return;
  const vals = D.sel.map(i => p.handCards[i].v), m = KB.evalSelection(vals, p.t); if (!m) return;
  const key = KB.sub(KB.countsOf(p.hand), m.vals).join(',');
  const o = p.opts.find(x => x.rest.join(',') === key) || p.opts[p.opts.length - 1];
  D.ans = o; const ok = o.outs === p.opts[0].outs;
  D.results.push({ ok, hint: D.hint, level: p.level });
  KB.sfx(ok ? 'best' : 'foul');
  const g = G_(); g.drill = g.drill || { n: 0, ok: 0 }; g.drill.n++; if (ok && !D.hint) g.drill.ok++; G_save(g);
  render();
}
// 1問でも間違えたらチャレンジ失敗（最初からやり直し）。5問続けて正解でクリア
function drillNext() {
  const D = S.drill; D.i++;
  const failed = D.results.some(r => !r.ok);
  if (D.i >= DRILL_N || failed) {
    D.done = true;
    const okN = D.results.filter(r => r.ok).length;
    const g = G_(); g.drill = g.drill || { n: 0, ok: 0 }; g.drill.sets = (g.drill.sets || 0) + 1; g.drill.best = Math.max(g.drill.best || 0, okN); G_save(g);
    let clean = 0; for (const r of D.results) { if (r.ok && !r.hint) clean++; else break; } // ヒントなしで続けて正解した問題数
    if (clean >= 3) bump('outs3'); if (clean >= 4) bump('outs4'); if (!failed && clean >= DRILL_N) bump('outs5');
    KB.sfx(!failed ? 'win' : 'foul');
    if (!failed) setTimeout(confetti, 200);
  } else { D.p = genOutsProblem(Math.min(5, D.i + 1)); D.sel = []; D.ans = null; D.hint = false; }
  render(); window.scrollTo(0, 0);
}

// ---------- 式の図鑑：割り算・かっこの掛け算の式を、実際に出すと1つずつオープンしていく ----------
// 同じ札で作れる別の式も、それぞれ1つの項目にする（＋−・×÷の入れかえや並べかえは同じ式）
// ---------- 式の列挙（同じ札で作れる別の式もすべて）。式の同一判定は、＋−・×÷の入れかえや並べかえを同じとみなす ----------
function zkAll(vals) {
  const SYM = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const atom = v => ({ v, s: String(v), p: 3, ck: String(v), k: 'a', pos: [String(v)], neg: [], num: [String(v)], den: [] });
  const grp = n => n.k === 'add' ? 'A(' + n.pos.slice().sort().join(',') + '|' + n.neg.slice().sort().join(',') + ')' : n.k === 'mul' ? 'M(' + n.num.slice().sort().join(',') + '|' + n.den.slice().sort().join(',') + ')' : n.ck;
  function comb(x, y, op) {
    let v;
    if (op === '+') v = x.v + y.v; else if (op === '-') v = x.v - y.v; else if (op === '*') v = x.v * y.v;
    else { if (y.v === 0 || x.v % y.v !== 0) return null; v = x.v / y.v; }
    const p = (op === '+' || op === '-') ? 1 : 2;
    const ls = x.p < p ? '(' + x.s + ')' : x.s, rs = (y.p < p || (y.p === p && (op === '-' || op === '/'))) ? '(' + y.s + ')' : y.s;
    const n = { v, s: ls + ' ' + SYM[op] + ' ' + rs, p };
    const at = z => z.k === 'add' ? { pos: z.pos, neg: z.neg } : { pos: [z.ck], neg: [] };
    const mt = z => z.k === 'mul' ? { num: z.num, den: z.den } : { num: [z.ck], den: [] };
    if (p === 1) { const a = at(x), b = at(y); n.k = 'add'; n.pos = op === '+' ? a.pos.concat(b.pos) : a.pos.concat(b.neg); n.neg = op === '+' ? a.neg.concat(b.neg) : a.neg.concat(b.pos); }
    else { const a = mt(x), b = mt(y); n.k = 'mul'; n.num = op === '*' ? a.num.concat(b.num) : a.num.concat(b.den); n.den = op === '*' ? a.den.concat(b.den) : a.den.concat(b.num); }
    n.ck = grp(n); return n;
  }
  function all(nodes) {
    if (nodes.length === 1) return [nodes[0]];
    const out = [];
    for (let i = 0; i < nodes.length; i++) for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue; const rest = nodes.filter((_, k) => k !== i && k !== j);
      for (const op of '+-*/') { if ((op === '+' || op === '*') && i > j) continue; const c = comb(nodes[i], nodes[j], op); if (!c) continue; for (const r of all([c, ...rest])) out.push(r); }
    }
    return out;
  }
  return all(vals.map(atom));
}
// 札の組み合わせ（2枚・3枚）ごとに、場の数→作れる式（同じ式はまとめる）を用意する
const ZK = (() => {
  const triv = e => /÷ 1(?!\d)/.test(e) || /(^|[^\d])(\d+) ÷ \2(?!\d)/.test(e) || /× 1(?!\d)|(^|[^\d])1 ×/.test(e);
  const byCombo = {}, strCk = new Map(), list = [];
  const combos = [];
  for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) { combos.push([a, b]); for (let c = b; c <= 13; c++) combos.push([a, b, c]); }
  for (const vals of combos) {
    const key = vals.join(','), m = {};
    for (const r of zkAll(vals)) {
      if (r.v < 1 || r.v > 13) continue;
      strCk.set(key + '@' + r.v + '|' + r.s, r.ck);
      const k = r.v + '#' + r.ck;
      if (!m[k] || r.s.length < m[k].s.length || (r.s.length === m[k].s.length && r.s < m[k].s)) m[k] = r;
    }
    const byT = {};
    const zkOk = s => vals.length === 3 && !triv(s) && (s.includes('÷') || (s.includes('(') && s.includes('×')));
    // ゾロ目（同じ数3枚でその数を作る式。例 9×9÷9）は、ふだんは「÷同じ数」で図鑑外だが、特別に1つだけ図鑑に入れる
    const same = vals.length === 3 && vals[0] === vals[2];
    let zoroDone = !same || Object.values(m).some(r => r.v === vals[0] && zkOk(r.s));
    for (const k in m) {
      const r = m[k]; let zoro = false;
      if (!zoroDone && r.v === vals[0] && r.s.includes('×') && r.s.includes('÷')) zoro = zoroDone = true;
      const zk = zkOk(r.s) || zoro;
      const f = { t: r.v, s: r.s, ck: r.ck, use: r.v + '#' + r.ck, id: zk ? key + '@' + r.v + '#' + r.ck : null, n: vals.length };
      (byT[r.v] = byT[r.v] || []).push(f);
      if (zk) list.push({ id: f.id, t: r.v, expr: r.s, n: vals.length, vals, zoro: same && r.v === vals[0] });
    }
    for (const t in byT) byT[t].sort((x, y) => x.s.length - y.s.length || (x.s < y.s ? -1 : 1));
    byCombo[key] = byT;
  }
  list.sort((a, b) => a.t - b.t || a.n - b.n || (a.expr.includes('÷') ? 0 : 1) - (b.expr.includes('÷') ? 0 : 1) || a.vals[a.vals.length - 1] - b.vals[b.vals.length - 1] || a.vals[1] - b.vals[1] || a.vals[0] - b.vals[0] || (a.expr < b.expr ? -1 : 1));
  return { byCombo, strCk, list };
})();
const ZUKAN = ZK.list;
const ZUKAN_IDX = new Map(ZUKAN.map((e, i) => [e.id, i]));
// アプリが出した式（札＋場＋式の文字）→ 図鑑の項目
const zkIdOf = (key, t, s) => { const ck = ZK.strCk.get(key + '@' + t + '|' + s); return ck ? key + '@' + t + '#' + ck : null; };
function zukanGet() {
  const z = store.get('zukan', null) || {};
  if (z.v3 && !z.v4) { z.v4 = 1; store.set('zukan', z); zukanBadges(z); } // 2枚の式を図鑑から外したので、場のコンプリートを数え直す
  // ゾロ目を図鑑に足す前に制覇していた場は、ゾロ目も取ったことにする
  if (z.v3 && !z.v5) { z.v5 = 1; for (let t = 1; t <= 13; t++) { const l = ZUKAN.filter(e => e.t === t); const zo = l.find(e => e.zoro); if (zo && !z[zo.id] && l.every(e => e.zoro || z[e.id])) z[zo.id] = { at: Date.now() }; } store.set('zukan', z); zukanBadges(z); }
  if (z.v3) return z;
  // 旧形式から引き継ぐ：v2（札＠場）・v1（名前つき項目）。そのとき出した式（アプリが選ぶ式）として登録する
  const nz = { v3: 1 };
  const put = (vals, t, at) => { const m = KB.evalSelection(vals, t); if (!m) return; const id = zkIdOf(m.key, t, m.expr); if (id && ZUKAN_IDX.has(id)) nz[id] = { at: at || Date.now() }; };
  Object.keys(z).forEach(k => { const r = z[k]; if (!r || typeof r !== 'object') return; if (z.v2 && /^[\d,]+@\d+$/.test(k)) { const [key, t] = k.split('@'); put(key.split(',').map(Number), +t, r.at); } else if (r.expr && r.t != null) put((r.expr.match(/\d+/g) || []).map(Number), r.t, r.at); });
  store.set('zukan', nz);
  const A = S.attack; S.attack = null; try { const g = G_(); delete g.cnt.zukan; delete g.cnt.zukan_cat; Object.keys(g.ach).forEach(k => { if (/^zukan/.test(k) || k === 'cat:' + ACH_GROUPS.findIndex(x => x[0] === '式の図鑑')) delete g.ach[k]; }); G_save(g); } finally { S.attack = A; }
  zukanBadges(nz); return nz;
}
const zukanCount = z => ZUKAN.reduce((n, e) => n + (z[e.id] ? 1 : 0), 0);
function zukanCheck(m, t, win, hinted) {
  if (!m || hinted) return; // AIの読みを見た手は登録しない
  const id = zkIdOf(m.key, t, m.expr); if (!id || !ZUKAN_IDX.has(id)) return;
  const z = zukanGet(); if (z[id]) return;
  z[id] = { at: Date.now() }; store.set('zukan', z);
  const n = zukanCount(z);
  setTimeout(() => zukanToast(m.expr, t, n), 900);
  zukanBadges(z);
}
function zukanToast(expr, t, n) {
  const d = document.createElement('div'); d.className = 'ach-toast zk-toast'; d.setAttribute('role', 'status');
  d.innerHTML = `<span class="zk-ic">式</span><span><small>図鑑に登録（${n}/${ZUKAN.length}）</small><b class="mono">${esc(expr)} = ${t}</b></span>`;
  document.body.appendChild(d); KB.sfx('best'); setTimeout(() => d.remove(), 2400);
}
// 図鑑のバッジは、バッジアタック中でもふだんの成長記録に入れる
function zukanBadges(z) {
  const A = S.attack; S.attack = null;
  try {
    const n = zukanCount(z); let cats = 0;
    for (let t = 1; t <= 13; t++) { const l = ZUKAN.filter(e => e.t === t); if (l.length && l.every(e => z[e.id])) cats++; }
    const g = G_(); g.cnt.zukan = n; g.cnt.zukan_cat = cats; checkAch(g, 'zukan'); checkAch(g, 'zukan_cat'); G_save(g);
  } finally { S.attack = A; }
}
function zukanHTML() {
  const z = zukanGet(), n = zukanCount(z), T = S.zkT || 1;
  const tabs = Array.from({ length: 13 }, (_, i) => { const t = i + 1, l = ZUKAN.filter(e => e.t === t), h = l.filter(e => z[e.id]).length; return `<button class="zk-tab ${t === T ? 'on' : ''} ${h === l.length ? 'done' : ''}" data-act="zk-t" data-t="${t}"><b>${KB.vname(t)}</b><small>${h}/${l.length}</small></button>`; }).join('');
  const list = ZUKAN.filter(e => e.t === T);
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← ホーム</button><div class="where">式の図鑑</div><div class="small muted">${n}/${ZUKAN.length}</div></div>
  <div class="panel stack"><p class="small muted" style="margin:0">割り算を使う式と、かっこを使った掛け算の式を集める図鑑です。同じ札でも式がちがえば別の項目です。対局や式ハンターで出すと1つずつオープンします（AIの読みを見た手は除く）。まだの式は形だけ見えています。</p>
  <div class="zk-bar"><i style="width:${(n / ZUKAN.length * 100).toFixed(1)}%"></i></div></div>
  <div class="panel stack"><div class="lbl">場の数</div><div class="zk-tabs">${tabs}</div></div>
  <div class="panel stack"><div class="lbl">場が ${KB.vname(T)}（${T}）の式　${list.filter(e => z[e.id]).length}/${list.length}</div>
  <div class="zk-grid">${list.map(e => z[e.id] ? `<div class="zk-cell got" title="${new Date(z[e.id].at).toLocaleDateString('ja-JP')}に登録"><span class="mono">${esc(e.expr)}</span><i>= ${T}</i></div>` : `<div class="zk-cell"><span class="mono">${esc(e.expr.replace(/\d+/g, '□'))}</span><i>= ${T}</i></div>`).join('')}</div></div>`;
}

// ---------- バッジポイント（BP） ----------
// 段階ごとの基本点（銅10・銀30・金100）に、系統ごとの難しさの重みを掛ける。カテゴリーの特別バッジは500BP
const BP_BASE = [10, 30, 100];
const BP_W = { games: 0.5, practice_set: 0.5, tour_done: 1, win: 1, set_win: 1.5, set_low: 2, all_sets: 3, qualify: 1.5, champion: 3, streak5: 1, streak10: 2, perfect: 1.5, perfect_set: 3, no_foul_set: 1.5, rating: 2, three: 0.5, div_paren: 1, bestpair: 2, miracle: 3, miss_lucky: 1.5, quick5: 0.5, quick3: 1, snap: 1.5, quickdraw: 2, blitz: 3, sutemi: 2.5, qualify_strong: 2, champion_strong: 3, toushi: 4, outs3: 1, outs4: 1.5, outs5: 2, atk_done: 1, atk_bp: 2, atk_badges: 1.5, zukan: 1.5, zukan_cat: 2, chart: 2 };
const BP_CAT = 500;
const bpOf = (key, i) => { const a = ACH.find(x => x[0] === key), tier = a && a[5] ? a[5][i] : Math.min(i, 2); return Math.round(BP_BASE[tier] * (BP_W[key] || 1)); };
function bpTotal(g) {
  let t = 0;
  ACH.forEach(a => a[2].forEach((tt, i) => { if (g.ach[a[0] + ':' + tt]) t += bpOf(a[0], i); }));
  ACH_GROUPS.forEach((_, gi) => { if (g.ach['cat:' + gi]) t += BP_CAT; });
  return t;
}
// ---------- バッジアタック：45分でどれだけバッジ（BP）を取れるか ----------
const ATTACK_MINS = [15];
let ATTACK_MIN = 15;
// 自己ベストは時間ごとに保存 { 15: rec, 30: rec, 45: rec }
function attackBests() { const b = store.get('attackBest', null) || {}; if (b.bp != null) return { 45: b }; return b; }
const ATTACK_CFG = { n: 4, games: 3, mix: 'even', points: [10, 5, 2, 0] };
// セット順位ボーナス：1位+30・2位+10（3位・4位は0、マイナスはなし）
const RANK_BONUS = [30, 10, 0, 0];
const atkBP = () => S.attack ? bpTotal(S.attack.g) + (S.attack.bonus || 0) : 0;
function attackSetBonus() {
  const A = S.attack, T = S.T, h = T.setHist[T.setHist.length - 1]; if (!A || !h) return 0;
  const mine = h.res.find(r => r.id === 0); const b = mine ? (RANK_BONUS[mine.rank - 1] || 0) : 0;
  A.bonus = (A.bonus || 0) + b; A.lastBonus = b; (A.ranks = A.ranks || []).push(mine ? mine.rank : 0);
  document.querySelectorAll('.atk-now').forEach(el => el.textContent = atkBP() + ' BP');
  return b;
}
function attackNewSession() {
  // 相手はまんべんなく。平均が★2.5未満になったら引き直す（バッジ条件を必ず満たす卓にする）
  let T;
  for (let k = 0; k < 30; k++) {
    T = newSession({ kind: 'practice', games: ATTACK_CFG.games, mix: ATTACK_CFG.mix, opps: [{ level: 'r', style: 'r' }, { level: 'r', style: 'r' }, { level: 'r', style: 'r' }], points: ATTACK_CFG.points, tie: 'janken' });
    const ais = T.players.filter(p => !p.human); if (ais.reduce((a, p) => a + p.level, 0) / ais.length >= 2.5) break;
  }
  T.attack = true;
  return T;
}
function attackStart(min) {
  ATTACK_MIN = 15;
  S.attack = { start: Date.now(), end: Date.now() + ATTACK_MIN * 60000, g: { v: 2, games: [], cnt: {}, ach: {} }, sets: 0, saved: { speed: S.settings.speed, judge: S.settings.judge, commentary: S.settings.commentary }, over: false, said: {} };
  S.settings.speed = 'fast'; S.settings.judge = 'after3'; S.settings.commentary = 'both'; S.showUnseen = false;
  document.body.classList.add('atk-on');
  S.T = attackNewSession();
  attackIntro(() => { S.attack.start = Date.now(); S.attack.end = S.attack.start + ATTACK_MIN * 60000; attackTick(); startSet(); });
}
function attackTick() {
  clearInterval(S.attackTimer);
  S.attackTimer = setInterval(() => {
    if (!S.attack || S.attack.over) { clearInterval(S.attackTimer); return; }
    const left = S.attack.end - Date.now();
    document.querySelectorAll('.atk-clock-txt').forEach(el => el.textContent = fmtClock(left)); document.querySelectorAll('.atk-clock').forEach(el => { el.textContent = fmtClock(left); el.classList.toggle('hurry', left < 60000); });
    if (left <= 0) { attackFinish(); return; }
    const A = S.attack, cue = left <= 60000 ? 'atk1' : left <= 300000 ? 'atk5' : left <= ATTACK_MIN * 30000 ? 'atkHalf' : null;
    if (cue && !A.said[cue] && S.view === 'game' && !S.winShow) { A.said.atk1 = A.said.atk1 || cue === 'atk1'; A.said.atk5 = A.said.atk5 || cue !== 'atkHalf'; A.said.atkHalf = true; say(cue, { bp: atkBP() }); renderGame(); }
  }, 500);
}
const fmtClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function attackNextSet() {
  const A = S.attack; if (!A || A.over) return;
  A.sets++;
  // 最低限のセット結果：順位・PP、このセットで取ったバッジ
  const T = S.T, h = T.setHist[T.setHist.length - 1], res = h ? h.res.slice().sort((a, b) => a.rank - b.rank) : [];
  const now = Object.keys(A.g.ach), got = now.filter(k => !(A.setAch || []).includes(k)); A.setAch = now;
  const gotHTML = got.filter(k => !k.startsWith('cat:')).map(id => { const [k, t] = id.split(':'); const a = ACH.find(x => x[0] === k); const i = a ? a[2].indexOf(+t) : -1; return i < 0 ? '' : `<span class="atk-sb">${badgeSVG(a, i, true, 20)}${esc(a[4][i])}<i>+${bpOf(k, i)}</i></span>`; }).join('');
  const mine = res.find(r => r.id === 0) || {};
  modal(`<div class="stack atk-setres"><div class="lbl">バッジアタック 第${A.sets}セット 結果</div>
    <div class="atk-sr-main"><b>${mine.rank || '-'}位</b><span>セットPP ${mine.pp != null ? mine.pp : '-'}</span><span class="atk-bonus ${A.lastBonus ? '' : 'zero'}">順位ボーナス +${A.lastBonus || 0}BP</span></div>
    <table class="atk-sr-t">${res.map(r => `<tr class="${r.id === 0 ? 'atk-me' : ''}"><td>${r.rank}位</td><td>${esc(r.id === 0 ? 'あなた' : nm(P(r.id)))}</td><td>PP ${r.pp}</td></tr>`).join('')}</table>
    <div class="small">このセットのバッジ：${gotHTML ? `<div class="atk-sbs">${gotHTML}</div>` : '<span class="muted">なし</span>'}</div>
    <div class="small muted">ここまで ${atkBP()} BP・残り <span class="atk-clock-txt">${fmtClock(A.end - Date.now())}</span>（時計は進んでいます）</div>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="attack-next">次のセットへ</button></div></div>`);
}
function attackNextSetGo() {
  closeModal(); if (!S.attack || S.attack.over) return;
  S.T = attackNewSession(); startSet();
  setTimeout(() => { if (S.attack && !S.attack.over) { say('atkSet', { s: S.attack.sets + 1, bp: atkBP() }); renderGame(); } }, 3200);
}
function attackFinish(quit) {
  const A = S.attack; if (!A || A.over) return;
  // セット最後のゲームが終わった直後に時間切れになっても、セットのバッジ判定はしておく
  if (S.T && !S.T.setHist.length && (S.T.setPP[0] || []).length >= S.T.cfg.games) { A.finishing = true; try { endSet(); } catch (e) { } }
  A.over = true; ACH_Q.length = 0; document.querySelectorAll('.ach-toast,.toast').forEach(e => e.remove()); clearInterval(S.attackTimer); clearTimeout(S.timer); (S.opTimers || []).forEach(clearTimeout);
  closeModal();
  const bp = atkBP(), badgeBp = bpTotal(A.g), bonus = A.bonus || 0, ranks = (A.ranks || []).slice(), nb = Object.keys(A.g.ach).filter(k => !k.startsWith('cat:')).length;
  const bests = attackBests(), best = bests[ATTACK_MIN] || null, isBest = !best || bp > best.bp;
  const rec = { bp, badges: nb, at: Date.now(), ach: Object.keys(A.g.ach), sets: A.sets, games: A.g.games.length, min: ATTACK_MIN, badgeBp, bonus, ranks };
  if (isBest) { bests[ATTACK_MIN] = rec; store.set('attackBest', bests); }
  S.settings.speed = A.saved.speed; S.settings.judge = A.saved.judge; S.settings.commentary = A.saved.commentary;
  S.attackResult = Object.assign({ isBest, prev: best }, rec);
  S.attack = null; S.game = null; S.T = null;
  // ふだんの成長記録に、アタックのバッジを記録（途中でやめたときは数えない）
  if (!quit) { const gr = G_(); gr.cnt.atk_done = (gr.cnt.atk_done || 0) + 1; gr.cnt.atk_bp = Math.max(gr.cnt.atk_bp || 0, bp); gr.cnt.atk_badges = Math.max(gr.cnt.atk_badges || 0, nb); ['atk_done', 'atk_bp', 'atk_badges'].forEach(k => checkAch(gr, k)); G_save(gr); }
  S.attackResult.quit = !!quit;
  whistle(quit ? 'アタック中止' : 'タイムアップ！', `${quit ? 'ここまでで' : ATTACK_MIN + '分で'} 獲得 ${bp} BP`, () => { document.body.classList.remove('atk-on'); go('attack-result'); }, { end: true, kind: quit ? (bp ? 'atkQuit' : 'atkQuit0') : !bp ? 'atkQuit0' : isBest ? 'atkEndBest' : 'atkEnd', d: { bp, m: ATTACK_MIN } });
}
// 開始の演出：博士とマサの前振り → スタートボタン → マサ「ほなキックオフや！」＋ホイッスルで試合開始
// 特訓モードの導入（バッジアタックと同じ形）：タイトル・ひと言・博士とマサ・やめる／スタート
function modeIntro(o) {
  const bub = (w, t, d) => `<div class="wh-say" style="animation-delay:${d}s"><span class="cm-av">${KB.casterSVG(w, 'happy')}</span><span><small>${w === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</small>${esc(t)}</span></div>`;
  const el = document.createElement('div'); el.className = 'whistle-ov';
  el.innerHTML = `<div class="wh-box"><div class="wh-title" ${o.title.length >= 7 ? 'style="font-size:clamp(26px,8.5vw,40px)"' : ''}>${esc(o.title)}</div><div class="wh-sub">${esc(o.sub)}</div>
    <div class="wh-cast">${bub('masa', o.masa, 0.3)}${o.masa2 ? bub('masa', o.masa2, 1.1) : ''}${o.root ? bub('root', o.root, 1.1) : ''}</div>
    <div class="row" style="justify-content:center;margin-top:14px;gap:8px;flex-wrap:wrap"><button class="btn" data-x="cancel">やめる</button>${(o.extra || []).map((x, i) => `<button class="btn ${x.primary ? 'primary' : ''}" data-x="e${i}">${esc(x.label)}</button>`).join('')}${o.noGo ? '' : `<button class="btn primary" data-x="go">${esc(o.goLabel || 'スタート')}</button>`}</div></div>`;
  document.body.appendChild(el);
  const close = then => { el.classList.add('out'); setTimeout(() => { el.remove(); if (then) then(); }, 300); };
  el.querySelector('[data-x="cancel"]').onclick = () => { KB.sfx('back'); close(o.onCancel); };
  (o.extra || []).forEach((x, i) => el.querySelector(`[data-x="e${i}"]`).onclick = () => close(x.on));
  if (!o.noGo) el.querySelector('[data-x="go"]').onclick = () => { KB.sfx('whistle', 1); el.querySelector('.wh-box').innerHTML = `<div class="wh-title">${esc(o.goTitle || 'スタート！')}</div><div class="wh-cast">${bub('masa', o.goLine || 'ほな、いこか！', 0)}</div>`; setTimeout(() => close(o.onGo), 1100); };
}
function huntIntro() {
  modeIntro({ title: '式ハンター', sub: `${HUNT_SEC / 60}分間、手札の3枚で場の数を作って、未登録の式を捕まえろ`,
    masa: '狩りの時間や！3枚で場の数を作ったら捕獲や。図鑑にまだない式ほど獲物やで！作れんときは「見送る」でええ！',
    root: '得点や速さで取れるバッジはありません。図鑑に登録した式の数がバッジにつながるので、じっくり考えて大丈夫ですよ。',
    noGo: true, // ここからすぐには始めない：次の画面（標的・ルール）で確かめてから始める（自動照準もそこで選ぶ）
    extra: [{ label: '次へ（標的を選ぶ・ルール）', primary: true, on: () => { } }], onCancel: () => go('home') });
}
function outsIntro() {
  modeIntro({ title: 'アウツチャレンジ', sub: '5問連続で正解したらクリア',
    masa: '次の番で上がれる札、いちばん多くなる出し方はどれや？5問連続で当てたらクリア！1問でも外したら最初からやで！',
    root: '「アウツ」とは、次にめくれたら上がれる札のこと。何を残すかで、その数が変わります。問題はだんだん難しくなり、ヒントはありません。',
    goTitle: 'チャレンジ開始！', goLine: '1問目や、よう見てな！', onGo: () => { }, onCancel: () => go('home') });
}
function attackIntro(then) {
  const pick = arr => (arr[(Math.random() * arr.length) | 0] || '').replace(/\{m\}/g, ATTACK_MIN);
  const bub = (w, t, d) => `<div class="wh-say" style="animation-delay:${d}s"><span class="cm-av">${KB.casterSVG(w, 'happy')}</span><span><small>${w === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</small>${esc(t)}</span></div>`;
  const el = document.createElement('div'); el.className = 'whistle-ov';
  el.innerHTML = `<div class="wh-box"><div class="wh-title">バッジアタック</div><div class="wh-sub">${ATTACK_MIN}分間で、どれだけバッジを取れるか</div>
    <div class="wh-cast">${bub('masa', pick(KB.LINES_MASA.atkStart), 0.3)}${bub('root', pick(KB.LINES_ROOT.atkStart), 1.1)}</div>
    <div class="row" style="justify-content:center;margin-top:14px;gap:8px"><button class="btn" data-x="cancel">やめる</button><button class="btn primary" data-x="go">スタート</button></div></div>`;
  document.body.appendChild(el);
  el.querySelector('[data-x="cancel"]').onclick = () => { KB.sfx('back'); el.remove(); const A = S.attack; if (A) { Object.assign(S.settings, A.saved); S.attack = null; S.T = null; document.body.classList.remove('atk-on'); } render(); };
  el.querySelector('[data-x="go"]').onclick = () => {
    KB.sfx('whistle', 1);
    el.querySelector('.wh-box').innerHTML = `<div class="wh-title">キックオフ！</div><div class="wh-cast">${bub('masa', 'ほなキックオフや！', 0)}</div>`;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); then(); }, 350); }, 1300);
  };
}
// 開始・終了の演出：ホイッスル＋博士とマサのひと言（画面を押すと先へ）
function whistle(title, sub, then, o) {
  o = o || {};
  KB.sfx('whistle', o.end ? 3 : 1);
  const line = who => { const arr = (who === 'root' ? KB.LINES_ROOT : KB.LINES_MASA)[o.kind] || []; const t = arr[(Math.random() * arr.length) | 0] || ''; return t.replace(/\{(\w+)\}/g, (_, k) => (o.d && o.d[k] != null ? o.d[k] : '')); };
  const order = o.end ? ['root', 'masa'] : ['masa', 'root'];
  const cast = o.kind ? `<div class="wh-cast">${order.map((w, i) => `<div class="wh-say" style="animation-delay:${0.7 + i * 0.9}s"><span class="cm-av">${KB.casterSVG(w, 'happy')}</span><span><small>${w === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</small>${esc(line(w))}</span></div>`).join('')}</div>` : '';
  const el = document.createElement('div'); el.className = 'whistle-ov';
  el.innerHTML = `<div class="wh-box"><div class="wh-title">${esc(title)}</div><div class="wh-sub">${esc(sub)}</div>${cast}${o.end ? `<div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" data-x="next">結果を見る</button></div>` : ''}</div>`;
  document.body.appendChild(el);
  let done = false;
  const fin = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => { el.remove(); then && then(); }, 350); };
  if (o.end) el.querySelector('[data-x="next"]').onclick = () => { KB.sfx('confirm'); fin(); };
  else setTimeout(fin, 2500);
}
function attackCardHTML() {
  const best = attackBests()[ATTACK_MIN];
  return `<div class="mode atk-card"><div class="mode-head"><span class="mode-ic" aria-hidden="true">⏱️</span><div><div class="lbl">BADGE ATTACK</div><h2>バッジアタック</h2></div></div>${modeBadgeRows(MB_ATK, true)}
    <p class="small muted" style="margin:0">15分間で、どれだけバッジ（BP）を取れるかの勝負。4人卓・相手まんべんなく・1セット3ゲームを、時間いっぱいくり返します。セット1位は+30BP・2位は+10BPの順位ボーナス。速さ・判定・解説（掛け合い）は固定。AIの読みとゲームごとの総括はありません。</p>
    ${best ? `<div class="mode-rec row" style="align-items:center;gap:8px"><p style="margin:0;flex:1">自己ベスト：<b class="atk-bp">${best.bp} BP</b>（バッジ${best.badges}個・${new Date(best.at).toLocaleDateString('ja-JP')}）</p><button class="btn sm" data-act="attack-best">ベスト記録を見る</button></div>` : ''}
    <button class="btn primary" data-act="attack-start">バッジアタック開始</button></div>`;
}
// ホーム：バッジアタックの最高記録をそのまま表示
function attackBadgeList(ach, size) {
  const cats = ach.filter(k => k.startsWith('cat:')).map(id => { const gi = +id.split(':')[1]; return `<div class="bdg-cell got">${emblemSVG(gi, true, size + 6)}<b>${esc(CAT_SPECIAL[ACH_GROUPS[gi][0]])}</b><small>${BP_CAT} BP</small></div>`; }).join('');
  // カテゴリー順・段階順に並べる
  const order = ACH_GROUPS.flatMap(([, ks]) => ks);
  const list = ach.filter(k => !k.startsWith('cat:')).map(id => { const [k, t] = id.split(':'); const a = ACH.find(x => x[0] === k); const i = a ? a[2].indexOf(+t) : -1; return { k, i, a }; }).filter(x => x.i >= 0)
    .sort((x, y) => order.indexOf(x.k) - order.indexOf(y.k) || x.i - y.i)
    .map(({ k, i, a }) => `<div class="bdg-cell got">${badgeSVG(a, i, true, size)}<b>${esc(a[4][i])}</b><small>${bpOf(k, i)} BP</small></div>`).join('');
  return cats + list;
}
// BPの内訳（バッジ＋順位ボーナス）と、セットごとの順位
function atkBreakdown(r) {
  if (r.bonus == null) return '';
  const rk = (r.ranks || []).map(x => `<i class="atk-rk r${x}">${x || '-'}</i>`).join('');
  return `<p class="small" style="margin:0;text-align:center">バッジ ${r.badgeBp}BP ＋ 順位ボーナス ${r.bonus}BP</p>${rk ? `<div class="atk-rks"><small>セット順位</small>${rk}</div>` : ''}`;
}
function attackBestModal() {
  const b = attackBests()[ATTACK_MIN]; if (!b) return;
  modal(`<div class="stack"><div class="lbl">バッジアタック 自己ベスト</div>
    <div class="atk-score" style="justify-content:center"><b>${b.bp}</b><span>BP</span></div>${atkBreakdown(b)}
    <p class="small" style="margin:0;text-align:center">バッジ ${b.badges}個・${b.sets || 0}セット・${b.games || 0}ゲーム<br>${new Date(b.at).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
    <div class="bdg-grid atk-best-grid">${attackBadgeList(b.ach || [], 30) || '<p class="small muted">バッジはありません</p>'}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-act="close">閉じる</button><button class="btn primary" data-act="attack-start">挑戦する</button></div></div>`);
}
function attackResultHTML() {
  const R = S.attackResult || { bp: 0, badges: 0, ach: [] };
  const list = R.ach.filter(k => !k.startsWith('cat:')).map(id => { const [k, t] = id.split(':'); const a = ACH.find(x => x[0] === k); if (!a) return ''; const i = a[2].indexOf(+t); return i < 0 ? '' : `<div class="bdg-cell got">${badgeSVG(a, i, true, 34)}<b>${esc(a[4][i])}</b><small>${bpOf(k, i)} BP</small></div>`; }).join('');
  const cats = R.ach.filter(k => k.startsWith('cat:')).map(id => { const gi = +id.split(':')[1]; return `<div class="bdg-cell got">${emblemSVG(gi, true, 40)}<b>${esc(CAT_SPECIAL[ACH_GROUPS[gi][0]])}</b><small>${BP_CAT} BP</small></div>`; }).join('');
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← ホーム</button><div class="where">バッジアタック 結果</div><div></div></div>
  <div class="panel stack" style="align-items:center;text-align:center">
    <div class="dq-title ok">${R.quit ? '途中で終了' : 'タイムアップ！'}</div>
    <div class="atk-score"><b>${R.bp}</b><span>BP</span></div>${atkBreakdown(R)}
    <p style="margin:0">バッジ ${R.badges}個・${R.sets || 0}セット・${R.games || 0}ゲーム</p>
    <p style="margin:0">${R.isBest ? '<b class="ok">自己ベスト更新！</b>' : `自己ベストは ${R.prev ? R.prev.bp : 0} BP`}</p>
  </div>
  <div class="panel stack"><div class="lbl">このアタックで取ったバッジ</div><div class="bdg-grid">${cats}${list || '<p class="small muted">バッジはありませんでした</p>'}</div></div>
  <div class="row" style="justify-content:center"><button class="btn primary" data-act="attack-start">もう一度挑戦</button></div>`;
}

// ---------- プレイヤー（名前ごとに記録を分ける）・書き出しと読み込み ----------
// 名前が使えるか：この端末のほかのプレイヤーと同じ名前、（公開版では）ほかの人がもう使っている名前は使えない
async function nameCheck(name, exceptPid) {
  if (!name) return '名前を入れてください';
  const norm = x => x.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}ー〜・]+/gu, '');
  if (profiles().some(p => p.id !== exceptPid && norm(p.name) === norm(name))) return 'この端末に、同じ名前のプレイヤーがもういます';
  if (!CLOUD_ON) return null;
  try {
    const c = (exceptPid && plLink(exceptPid)) || raw.get('kb.cloud', null), j = await (await fetch(CLOUD_API + '?a=name&n=' + encodeURIComponent(name) + '&uid=' + encodeURIComponent((c && c.uid) || '') + '&pid=' + encodeURIComponent(exceptPid || ''))).json();
    if (j.ok && !j.free) return j.why === 'ng' ? 'その名前は使えません。ほかの名前にしてください' : 'その名前は、ほかのプレイヤーがもう使っています';
  } catch (e) { } // つながらないときは止めない（サーバー側でも重複は「研究員○○」になる）
  return null;
}
function nameErr(msg) { const e = $('#name-err'); if (e) { e.textContent = msg || ''; e.hidden = !msg; } }
function askName(again) {
  modal(`<div class="upd-modal"><h2>${again ? '新しい名前で始める' : 'ようこそ！'}</h2>
    <p>${again ? '新しいプレイヤーの名前を入れてください。成長記録や続きからのデータは、名前ごとに分けて保存されます。' : 'あなたの名前を教えてください。成長記録や続きからのデータは、名前ごとに保存されます。'}</p>
    <input id="new-name" class="name-input" maxlength="10" placeholder="名前" value="${again ? '' : esc(S.settings.name !== 'あなた' ? S.settings.name : '')}">
    <p class="small name-err" id="name-err" hidden></p>
    <button class="btn primary upd-go" data-act="create-profile">はじめる</button>
    ${CLOUD_ON ? `<details class="an-code"><summary>${again ? '別の端末のプレイヤーを入れる（引き継ぎコード）' : '別の端末で遊んでいた人は（引き継ぎコード）'}</summary><p class="small" style="margin:4px 0">別の端末の「プレイヤー」に出ている引き継ぎコードを入れると、そのプレイヤーの記録でこの端末でも遊べます。</p><div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center"><input id="an-code" class="name-input" placeholder="XXXX-XXXX-XXXX" maxlength="16" style="max-width:200px" autocomplete="off"><button class="btn" data-act="code-restore">入る</button></div></details>` : ''}
    ${again ? '<button class="btn ghost sm" data-act="close">やめる</button>' : ''}</div>`);
  setTimeout(() => { const i = $('#new-name'); if (i) { i.focus(); i.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) act('create-profile'); }; } }, 50);
}
function switchProfile(id) {
  const pr = profiles().find(x => x.id === id); if (!pr) return;
  PID = id; raw.set('kb.profile', id);
  S.settings.name = pr.name; store.set('settings', S.settings);
  S.T = null; S.game = null; closeModal(); go('home');
}
// プレイヤーの削除：その人の成長記録・続きからも消す（プレイ中の人を消したら、残っている人に切り替える）
function deleteProfile(id) {
  const L = profiles(), pr = L.find(x => x.id === id); if (!pr || L.length < 2) return;
  // クラウド：この端末で作ったプレイヤーはランキング・引き継ぎコードも消す。別の端末から入れたプレイヤーは、この端末から外すだけ（記録はクラウドに残る）
  const l = CLOUD_ON ? plLink(id) : null, own = l && l.own;
  if (own) cloudReq('p_del', { token: l.token, pid: id }).catch(() => { });
  CLOUD.dirtyP.delete(id);
  try { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('kb.p.' + id + '.')) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); } catch (e) { }
  raw.set('kb.profiles', L.filter(x => x.id !== id));
  toast(l && !own ? `「${pr.name}」をこの端末から外しました（記録はクラウドに残っています）` : `「${pr.name}」を削除しました`);
  if (id === PID) switchProfile(profiles()[0].id); else { profileModal(); render(); setTimeout(profileModal, 0); }
}
function profileModal() {
  const L = profiles();
  modal(`<h2>プレイヤー</h2>
    <div class="pf-list">${L.map(p => `<div class="pf-row ${p.id === PID ? 'cur' : ''}"><b>${esc(p.name)}</b><span class="small muted">${(() => { const g = raw.get('kb.p.' + p.id + '.growth', null); const r = g ? ratingOf(g.games) : null; return r && r.ok ? `★${r.r.toFixed(1)}・${g.games.length}ゲーム` : g ? `${g.games.length}ゲーム` : '記録なし'; })()}</span>${p.id === PID ? '<span class="pf-cur">プレイ中</span>' : ''}<span class="pf-btns">${p.id === PID ? '<button class="btn sm ghost" data-act="rename-profile">名前を変更</button>' : `<button class="btn sm" data-pf="${p.id}">この人で遊ぶ</button>`}${L.length > 1 ? `<button class="btn sm ghost pf-del" data-pfdel="${p.id}">${S.delArm === p.id ? 'もう一度押すと削除' : '削除'}</button>` : ''}</span></div>`).join('')}</div>
    ${PID ? (() => { const b = store.get('bio', ''); return `<div class="pf-bio"><div class="lbl">${esc(S.settings.name)}の自己紹介</div><p class="small" style="margin:0;${b ? '' : 'color:var(--muted,#9a9)'}">${b ? esc(b).replace(/\n/g, '<br>') : 'まだ書いていません（140文字まで）'}</p><button class="btn sm" data-act="bio-edit">${b ? '自己紹介を編集' : '自己紹介を書く'}</button></div>`; })() : ''}
    <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="new-profile">新しい名前で始める</button></div>
    ${CLOUD_ON ? `<details class="save-note"><summary>記録の保存について</summary><ul><li>記録（成長記録・バッジ・図鑑・アバターなど）は<b>クラウド</b>に保存されます。ブラウザの履歴を消しても、引き継ぎコードがあれば戻せます。</li><li>端末には、すぐ遊べるように控えと、ログインの鍵だけを置いています。</li><li>同じ端末を使う人どうしは、プレイヤーを分ければ記録を別々に残せます。</li></ul></details>` : `
    <details class="save-note" open><summary>記録の保存について</summary><ul>
      <li>記録（成長記録・バッジ・続きから）は、<b>いま使っている端末のこのブラウザの中</b>に保存されます。成長記録やバッジはサーバーには送っていません（アプリの利用回数の集計だけは、名前や対局内容を含めずに記録しています）。</li>
      <li><b>別の端末や別のブラウザ</b>（スマホとパソコン、ChromeとSafariなど）では共有されません。</li>
      <li>ブラウザの<b>履歴・キャッシュ・サイトデータを消す</b>と、記録も消えます。<b>シークレット（プライベート）モード</b>で開くと、閉じたときに消えます。</li>
      <li>アプリのアップデートでは消えません。</li>
      <li>同じ端末・同じブラウザを使う人どうしは、プレイヤーを分ければ記録を別々に残せます。</li>
      <li>大事な記録は、ときどき下の「書き出す」で保存しておくと安心です。</li>
    </ul></details>
    `}
    ${cloudPanelHTML()}
    <div class="lbl">記録の書き出し・読み込み</div>
    <p class="small muted" style="margin:0">書き出したファイル（JSON）を別の端末で読み込むと、成長記録と続きからのデータを引き継げます。読み込んだ記録は新しいプレイヤーとして追加されます。</p>
    <div class="row" style="flex-wrap:wrap"><button class="btn" data-act="export-data">いまのプレイヤーの記録を書き出す</button><label class="btn file-btn">記録を読み込む<input type="file" id="imp-file" accept=".json,application/json" hidden></label></div>
    <details class="small"><summary>ファイルが使えないとき（テキストで貼り付け）</summary><textarea id="imp-text" rows="4" placeholder="書き出したテキストを貼り付け"></textarea><button class="btn sm" data-act="import-text">貼り付けた記録を読み込む</button></details>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div>`);
  document.querySelectorAll('#modal [data-pf]').forEach(b => b.onclick = () => switchProfile(b.dataset.pf));
  document.querySelectorAll('#modal [data-pfdel]').forEach(b => b.onclick = () => {
    const id = b.dataset.pfdel;
    if (S.delArm !== id) { S.delArm = id; profileModal(); setTimeout(() => { if (S.delArm === id) { S.delArm = null; if ($('#modal .pf-list')) profileModal(); } }, 4000); return; }
    S.delArm = null; deleteProfile(id);
  });
  const f = $('#imp-file'); if (f) f.onchange = async () => { const file = f.files && f.files[0]; if (!file) return; importData(await file.text()); };
}
function exportPayload() {
  return JSON.stringify({ app: 'keisan-bridge', v: 1, name: S.settings.name, exportedAt: new Date().toISOString(), growth: store.get('growth', null), session: store.get('session', null), zukan: store.get('zukan', null), attackBest: store.get('attackBest', null), huntBest: store.get('huntBest', null) });
}
async function exportData() {
  const data = exportPayload(), fn = `計算ブリッジ_${S.settings.name}_${new Date().toISOString().slice(0, 10)}.json`;
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: fn, data }); toast('書き出しました'); return; } } catch (e) { if (e && e.code === 'declined') return; }
  modal(`<h2>記録の書き出し</h2><p class="small" style="margin:0">ファイルを保存できない環境のため、テキストで表示しています。全部コピーして、別の端末の「貼り付け」から読み込んでください。</p><textarea id="exp-text" rows="8" readonly>${esc(data)}</textarea><div class="row" style="justify-content:flex-end"><button class="btn" data-act="copy-export">コピー</button><button class="btn primary" data-act="close">閉じる</button></div>`);
}
function importData(text) {
  let o; try { o = JSON.parse(text); } catch (e) { toast('読み込めませんでした（形式が違います）'); return; }
  if (!o || o.app !== 'keisan-bridge') { toast('計算ブリッジの記録ではないようです'); return; }
  let name = String(o.name || 'プレイヤー').slice(0, 10); const L = profiles();
  if (L.some(p => p.name === name)) name = (name + '（読込）').slice(0, 14);
  const id = createProfile(name);
  if (o.growth) raw.set('kb.p.' + id + '.growth', o.growth);
  if (o.session) raw.set('kb.p.' + id + '.session', o.session);
  if (o.zukan) raw.set('kb.p.' + id + '.zukan', o.zukan);
  if (o.attackBest) raw.set('kb.p.' + id + '.attackBest', o.attackBest);
  if (o.huntBest) raw.set('kb.p.' + id + '.huntBest', o.huntBest);
  toast(`「${name}」として読み込みました`); switchProfile(id);
}
// ---------- チュートリアル：博士とマサが会話でルールとコツを説明（例を触りながら・簡単な選択つき） ----------
function tutInvite(name) {
  const nmS = san(name || S.settings.name || 'あなた');
  const L = [['root', `ようこそ、${nmS}。私は解説のルート博士です。計算ブリッジのルールは、もうご存じですか？`], ['masa', 'ワイは実況のマサや！知らんかったら、3分でサクッと教えたるで！']];
  modal(`<div class="watch-invite"><div class="wi-title">はじめまして！</div>
    <div class="op-lines">${L.map(([who, txt], i) => `<div class="op-line ${who}" style="animation-delay:${0.2 + i * 1.1}s"><div class="cm-av">${KB.casterSVG(who, 'happy')}</div><div class="op-bubble"><span class="cm-name">${who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span>${esc(txt)}</div></div>`).join('')}</div>
    <div class="row wi-btns"><button class="btn" data-act="tut-skip">知ってるので大丈夫</button><button class="btn primary" data-act="tut-start">ルールを教えて！</button></div>
    <p class="small muted" style="margin:0;text-align:center">あとからでも「ルール」の画面から見られます。</p></div>`);
  KB.sfx('banner');
}
const TC = (v, s) => ({ v, s: s == null ? (v * 7) % 4 : s, id: 900 + v * 4 + (s || 0) });
// 各ステップ：casters（会話）、show（例の表示）、task（操作：pick=札を選んで場を作る / choice=選択）
const TUT = [
  { cast: [['root', 'ゴールはかんたん。手札の7枚を、だれよりも先に出し切ることです。'], ['masa', '出し切った人が「上がり」や！サッカーで言うたら先制ゴールやな！']], show: () => tutHand([1, 4, 6, 9, 11, 12, 13].map(v => TC(v))) + '<p class="tut-cap">はじめの手札は7枚</p>' },
  { cast: [['root', '毎巡、山札から1枚めくった札が「場」になります。この数を、手札で作るのです。A＝1、J＝11、Q＝12、K＝13 として数えます。'], ['masa', '場がJなら11を作る、ってことやな！']], show: () => tutField(TC(11, 1)) },
  { cast: [['root', '手札の1〜3枚を、＋ − × ÷ とかっこで組み合わせて、場の数を作れば出せます。やってみましょう。場は7。手札から札を選んでください。'], ['masa', 'タップで選ぶんや！選んだら「出す」！']], show: () => tutField(TC(7, 2)), task: { kind: 'pick', t: 7, hand: [11, 4, 1, 9, 2] } },
  { cast: [['root', '作れないときは、山札から1枚引きます。手札が増えるので、できれば出したいところ。では問題です。場はK（13）、手札は A・2・3。どうしますか？'], ['masa', 'よう考えてや〜']], show: () => tutField(TC(13, 0)) + tutHand([1, 2, 3].map(v => TC(v))), task: { kind: 'choice', opts: ['出す', '引く'], ok: 1, good: 'そのとおり。A・2・3 では、どう組み合わせても13は作れません。こういうときは引くしかありません。', bad: '実は、A・2・3 では13は作れないのです。3 ×（2 ＋ A）でも9まで。こういうときは引きます。' } },
  { cast: [['root', 'だれかが上がると、そのゲームは終わり。残った人は、手札の数字の合計が「PP（ペナルティポイント）」、つまり失点になります。PPは少ないほど良い点です。問題。残りが K と 2 なら、PPはいくつ？'], ['masa', 'Kは13やで！']], show: () => tutHand([13, 2].map(v => TC(v))), task: { kind: 'choice', opts: ['2', '13', '15'], ok: 2, good: '正解です。13 ＋ 2 で15。大きい札が残るほど、失点は大きくなります。', bad: 'K（13）＋2 で15です。大きい札が残るほど、失点は大きくなります。' } },
  { cast: [['root', '順番は「親」から時計回りに1人1回ずつ。全員が打ったら、次の場をめくります（これを「巡」と数えます）。親は、最初のゲームは抽選、2ゲーム目からは前のゲームでいちばんPPが多かった人。負けた人へのささやかな救済です。'], ['masa', 'ほんで大事なんは、だれかが上がったら、その場で試合終了ってことや！自分の番が回ってくる前に上がられることもある。せやから順番はけっこう大事なんやで！']], show: () => `<div class="tut-flow"><span>親</span><b>→</b><span>2番手</span><b>→</b><span>3番手</span><b>→</b><span>4番手</span><b>↻</b><span>次の場へ</span></div><p class="tut-cap">だれかが上がった瞬間にゲーム終了</p>` },
  { cast: [['root', 'ここでコツその1。出せる手が複数あるなら、大きい札から処分するのが基本です。場は9、手札は Q・3・7・2。どちらを出しますか？'], ['masa', 'ここが分かれ道や！どっちの札が手に残るかも考えてな！']], show: () => tutField(TC(9, 3)) + tutHand([12, 3, 7, 2].map(v => TC(v))), task: { kind: 'choice', opts: ['Q − 3', '7 + 2'], ok: 0, good: 'お見事。Q − 3 なら手札の合計が15減り、上がられたときの失点もぐっと小さくなります。しかも残るのは 7・2。小さい札は組み合わせやすく、次の場で出せる＝上がれることが多いのです。', bad: '7 + 2 でも出せますが、Q − 3 なら合計が15減ります。それに、残る札にも差が出ます。Q・3 よりも 7・2 のような小さい札のほうが組み合わせやすく、上がりやすいことが多いのです。' } },
  { cast: [['root', 'コツその2。式の作り方は自由です。3枚出しは一気に減らせますが、小さい札まで使い切ると、次の場で困ることもあります。出す枚数より、何を残すかで選びましょう。大きい札は、割り算で小さな数にすると処分しやすくなります。'], ['masa', 'でかい札を割って逃がす、ここが計算ブリッジの気持ちええとこや！']], show: () => `<div class="tut-exprs"><span class="mono">K − 8 ＋ 4 ＝ 9</span><small>3枚出し：一気に減るが、残る札しだい</small><span class="mono">Q ÷ 4 ＝ 3</span><small>割り算で大きい札を処分</small><span class="mono">J − 4 × A ＝ 7</span><small>かっこや×÷も自由に</small></div>` },
  { cast: [['root', 'コツその3。手札が2〜3枚になったら「待ち」を意識します。たとえば A・2・6 の3枚は、13個の数のうち12個で上がれる、すごい形です。'], ['masa', 'ポーカーで言うたら、どのカードが来てもええ最強の待ちや！']], show: () => tutHand([1, 2, 6].map(v => TC(v))) + '<p class="tut-cap">A・2・6 ＝ 12面待ち（2〜Kで上がれる）</p>' },
  { cast: [['root', '5ゲームで1セット。セットのPPの合計で順位が決まります。大会では、予選を何セットか戦って、上位が決勝に進みます。'], ['masa', '1ゲームの負けは取り返せる、長丁場の勝負や！']], show: () => `<div class="tut-flow"><span>1ゲーム</span><b>→</b><span>5ゲームで1セット</span><b>→</b><span>大会：予選 → 決勝</span></div>` },
  { cast: [['root', 'この研究所でできることを紹介しましょう。'], ['masa', 'ぜんぶ遊びながら強くなれるで！']], show: () => `<ul class="tut-menu"><li><b>1セット練習</b>：相手の強さを選んで打つ。手ごとにAIの読みと比べられます</li><li><b>大会</b>：予選から決勝まで。思わぬ強敵も…</li><li><b>特訓</b>：式ハンター（3分で式集め）・アウツチャレンジ（上がれる札を数える）・バッジアタック（15分の腕試し）</li><li><b>早見表</b>：多面待ちの札を、自分の式で埋めていく</li><li><b>バッジ・図鑑・アバター</b>：がんばりが形になって残ります</li><li><b>観戦</b>：達人の打ち方を見る</li></ul>` },
  { cast: [['root', '説明は以上です。とはいえ、こればかりは打ってみるのがいちばん。'], ['masa', 'せや、いっぺんやってみんと分からんかもな！設定はワイらにまかせとき。まずは弱めの相手3人と、短めの3ゲームや。横で実況したるで！']], show: () => `<div class="tut-flow"><span>相手3人（★1〜2）</span><span>3ゲーム</span><span>博士とマサの実況つき</span></div>`, end: true }
];
// おすすめ設定（弱め・短め3ゲーム）でそのまま1セット練習を始める
function tutPlay() {
  S.T = newSession({ kind: 'practice', games: 3, mix: 'random', opps: [{ level: '1', style: 'r' }, { level: '2', style: 'r' }, { level: '2', style: 'r' }], points: [10, 8, 5, 2, 0], tie: 'janken' });
  stat('pStart'); startSet();
}
// 説明を聞かないとき・練習をあとにするときも、ひと声かけて送り出す
function tutBye(kind) {
  const L = kind === 'skip' ? [['masa', 'ほな、楽しんでな！ 分からんことがあったら、ルールの画面からいつでも呼んでや！'], ['root', '良い一局を。達人の打ち方は、練習カードの「観戦」で見られますよ。']]
    : [['masa', '了解や！ ほな、気が向いたらいつでもキックオフしてな！'], ['root', 'ホームの「1セット練習」から、いつでも始められます。']];
  modal(`<div class="watch-invite tut-bye"><div class="op-lines">${L.map(([who, txt], i) => `<div class="op-line ${who}" style="animation-delay:${0.1 + i * 0.6}s"><div class="cm-av">${KB.casterSVG(who, 'happy')}</div><div class="op-bubble"><span class="cm-name">${who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span>${esc(txt)}</div></div>`).join('')}</div>
    <div class="row wi-btns" style="animation-delay:1.1s"><button class="btn primary" data-act="close">はじめる</button></div></div>`);
  KB.sfx('select');
}
function tutStart() { S.tut = { i: 0, sel: [], done: {} }; tutRender(); }
function tutGo(d) { const T = S.tut; if (!T) return; T.i = Math.max(0, Math.min(TUT.length - 1, T.i + d)); T.sel = []; T.msg = null; tutRender(); }
const tutHand = cs => `<div class="tut-hand">${cs.map(c => `<span class="card ${c.s === 1 || c.s === 2 ? 'red' : ''}"><span class="v">${KB.vname(c.v)}</span><span class="s">${KB.SUITS[c.s]}</span></span>`).join('')}</div>`;
const tutField = c => `<div class="tut-field"><div class="fieldcard top ${c.s === 1 || c.s === 2 ? 'red' : ''} deal"><span class="tag">場</span><span class="big">${KB.vname(c.v)}</span><span class="val">${KB.SUITS[c.s]} ${c.v}</span></div></div>`;
function tutRender() {
  const T = S.tut; if (!T) return;
  const st = TUT[T.i], tk = st.task, done = !tk || T.done[T.i];
  let task = '';
  if (tk && tk.kind === 'pick') {
    const cards = tk.hand.map((v, k) => ({ v, s: k % 4, id: k }));
    const vals = T.sel.map(k => tk.hand[k]), m = vals.length ? KB.evalSelection(vals, tk.t) : null;
    task = `<div class="tut-hand pick">${cards.map(c => `<button class="card ${c.s === 1 || c.s === 2 ? 'red' : ''} ${T.sel.includes(c.id) ? 'sel' : ''}" data-tutc="${c.id}" ${T.done[T.i] ? 'disabled' : ''}><span class="v">${KB.vname(c.v)}</span><span class="s">${KB.SUITS[c.s]}</span></button>`).join('')}</div>
      <div class="tut-msg ${T.msg ? T.msg.cls : ''}">${T.msg ? esc(T.msg.t) : vals.length ? (m ? `${esc(m.expr)} ＝ ${tk.t}　出せます！` : `${vals.map(KB.vname).join('・')} では ${tk.t} を作れません`) : '札を1〜3枚タップ'}</div>
      ${T.done[T.i] ? '' : `<button class="btn primary" data-tutplay="1" ${m ? '' : 'disabled'}>出す</button>`}`;
  } else if (tk && tk.kind === 'choice') {
    task = `<div class="tut-opts">${tk.opts.map((o, k) => `<button class="btn ${T.done[T.i] ? (k === tk.ok ? 'primary' : '') : ''}" data-tuto="${k}" ${T.done[T.i] ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>${T.msg ? `<div class="tut-msg ${T.msg.cls}">${esc(T.msg.t)}</div>` : ''}`;
  }
  const cast = st.cast.map(([who, txt], i) => `<div class="op-line ${who}" style="animation-delay:${0.1 + i * 0.7}s"><div class="cm-av">${KB.casterSVG(who, T.msg && T.msg.cls === 'bad' && who === 'masa' ? 'worried' : 'happy')}</div><div class="op-bubble"><span class="cm-name">${who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span>${esc(txt)}</div></div>`).join('');
  const again = T.shown === T.i; T.shown = T.i; // 同じステップの描き直しでは、会話の登場アニメーションをくり返さない
  const html = `<div class="tut ${again ? 'tut-static' : ''}"><div class="tut-top"><span class="small">ルールの説明　${T.i + 1}/${TUT.length}</span><button class="btn ghost sm" data-act="tut-close">とじる</button></div>
    <div class="tut-prog"><i style="width:${Math.round((T.i + 1) / TUT.length * 100)}%"></i></div>
    <div class="op-lines">${cast}</div><div class="tut-stage">${st.show()}${task}</div>
    <div class="row tut-nav">${T.i ? '<button class="btn ghost" data-act="tut-back">← もどる</button>' : '<span></span>'}${st.end ? '<span class="row" style="gap:8px"><button class="btn ghost" data-act="tut-later">あとで</button><button class="btn primary" data-act="tut-end">打ってみる！</button></span>' : `<button class="btn primary" data-act="tut-next" ${done ? '' : 'disabled'}>${done ? 'つぎへ →' : 'やってみよう'}</button>`}</div></div>`;
  const cur = $('#modal .tut'); if (cur) { cur.parentElement.innerHTML = html; bindModal($('#modal')); } else modal(html);
  const md = $('#modal'); if (!md) return;
  // 札のタップは本番と同じ動き：その札だけが持ち上がる（手札を作り直さないので、点滅しない）
  md.querySelectorAll('[data-tutc]').forEach(b => b.onclick = () => { const k = +b.dataset.tutc; T.msg = null; T.sel = T.sel.includes(k) ? T.sel.filter(x => x !== k) : T.sel.length < 3 ? T.sel.concat(k) : T.sel; KB.sfx('select');
    const old = b.closest('.tut-hand'); tutRender(); const nu = $('#modal .tut-hand.pick');
    if (old && nu && old !== nu) { old.querySelectorAll('[data-tutc]').forEach(x => x.classList.toggle('sel', T.sel.includes(+x.dataset.tutc))); nu.replaceWith(old); } });
  md.querySelectorAll('[data-tutplay]').forEach(b => b.onclick = () => { const vals = T.sel.map(k => tk.hand[k]), m = KB.evalSelection(vals, tk.t); if (!m) return; T.done[T.i] = true; T.msg = { cls: 'good', t: `${m.expr} ＝ ${tk.t}　ナイス！ ほかにも 9 − 2、J − 4 × A など、作り方はいろいろあります。` }; KB.sfx('play3'); tutRender(); });
  md.querySelectorAll('[data-tuto]').forEach(b => b.onclick = () => { const k = +b.dataset.tuto, ok = k === tk.ok; T.done[T.i] = true; T.msg = { cls: ok ? 'good' : 'bad', t: (ok ? '⭕ ' : '❌ ') + (ok ? tk.good : tk.bad) }; KB.sfx(ok ? 'capture' : 'foul'); tutRender(); });
}

// ---------- 観戦：★5の達人4人の1セットを、博士とマサの実況・ゲームごとの感想つきで見る（速さはいつも「ふつう」・いつでもやめられる） ----------
function watchInvite(name) {
  const nmS = san(name || S.settings.name || 'あなた');
  const L = [['root', `ようこそ、${nmS}。とりあえず、達人のゲームを見てみましょう。★5の天才ゼロさんと、★3・★2・★1の3人の卓です。強さによって打ち方がどう違うか、比べながら見ると面白いですよ。`], ['masa', `まずは観戦からや！達人ゼロの打ち筋と、ほかの3人の違い、しっかり見とこ！見飽きたら、いつでも抜けてええで！`]];
  modal(`<div class="watch-invite"><div class="wi-title">まずは、達人の一局を</div>
    <div class="op-lines">${L.map(([who, txt], i) => `<div class="op-line ${who}" style="animation-delay:${0.2 + i * 1.1}s"><div class="cm-av">${KB.casterSVG(who, 'happy')}</div><div class="op-bubble"><span class="cm-name">${who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span>${esc(txt)}</div></div>`).join('')}</div>
    <div class="row wi-btns"><button class="btn" data-act="close">自分で打ってみる</button><button class="btn primary" data-act="watch-first">観戦する</button></div>
    <p class="small muted" style="margin:0;text-align:center">観戦は「1セット練習」の画面からも、いつでも見られます。</p></div>`);
  KB.sfx('banner');
}
// 卓の顔ぶれ：達人（★5）は必ず1人。ほかは★1〜4からばらばらに（強さの違いが見えるように）。
// 初めての案内のときは、強さ（★5・3・2・1）も性格（4種）もそろった決まった顔ぶれにする
const WATCH_FIRST = ['zero', 'shota', 'tome', 'tama'];
function watchStart(first) {
  watchEnd(true);
  KB.resetNames(); const used = new Set();
  const fromChar = (id, i) => { const c = KB.charById(id); used.add(id); return { id: i, human: false, level: c.lv, style: c.st, ch: KB.charToCh(c), peek: !!c.peek }; };
  const lv = KB.shuffle([1, 2, 3, 4]).slice(0, 3).sort((a, b) => b - a);
  const ais = first ? WATCH_FIRST.map(fromChar) : [makeAI(0, 5, null, used)].concat(lv.map((l, k) => makeAI(k + 1, l, null, used)));
  // 本戦と同じ画面で見せる：手元（画面の下）は達人。達人の席は「人の席」を借りて、AIが打つ（spectator）
  const master = ais.find(p => p.level >= 5), others = ais.filter(p => p !== master);
  const T = newSession({ kind: 'practice', games: 5, mix: 'random', opps: [{ level: 'r', style: 'r' }, { level: 'r', style: 'r' }, { level: 'r', style: 'r' }], points: [10, 8, 5, 2, 0], tie: 'janken' });
  T.players = [Object.assign({}, master, { id: 0, human: true, spectator: true })].concat(others.map((p, k) => Object.assign({}, p, { id: k + 1 })));
  T.points = {}; T.totPP = {}; T.tb = {}; T.players.forEach(p => { T.points[p.id] = 0; T.totPP[p.id] = 0; T.tb[p.id] = 0; });
  T.watch = true;
  S.spectate = { first: !!first, saved: { speed: S.settings.speed, commentary: S.settings.commentary, spoiler: S.settings.spoiler }, diffs: [], from: S.view };
  S.settings.speed = 'normal'; S.settings.commentary = 'both'; S.settings.spoiler = false; // 速さはいつも「ふつう」
  document.body.classList.add('spectate');
  S.T = T; startSet();
}
// 観戦を終える（設定を元に戻す）。keepView のときは画面は動かさない
function watchEnd(keepView) {
  if (!S.spectate) return;
  const sv = S.spectate.saved; Object.assign(S.settings, sv); S.spectate = null;
  clearTimeout(S.timer); S.paused = 0; S.game = null; S.T = null; S.winShow = null;
  document.body.classList.remove('spectate');
}
function watchBanner(T) {
  const m = T.players[0];
  return T.game === 1 ? { title: '達人の観戦', sub: `手元は★5「${m.ch.title || '達人'}」${m.ch.name}。4人の打ち方の違いに注目`, say: 'start', sayData: { g: 1 } } : { title: `第${T.game}ゲーム`, sub: T.game === T.cfg.games ? '観戦もいよいよ最終ゲーム' : '達人の観戦', say: 'start', sayData: { g: T.game } };
}
// ★4以下の人が、達人の読みと違う手を選んだら、その差を解説する（最善手を言い続けるのではなく「違い」に注目）
function watchDiff(g, p, m) {
  const pl = g.players[p]; if (pl.level > 4) return null;
  try {
    const counts = g.counts(p), t = g.field.v, key = x => x ? x.vals.slice().sort((a, b) => a - b).join(',') : 'draw';
    const cands = KB.candidates(counts, t, 6).concat([null]); if (m && !cands.some(c => c && key(c) === key(m))) cands.push(m);
    if (cands.length < 2) return null;
    const ev = KB.evaluate(g.view(p), cands, 360), best = ev.slice().sort((a, b) => a.pp - b.pp)[0], mine = ev.find(e => key(e.m) === key(m));
    if (!best || !mine || key(best.m) === key(m) || mine.pp - best.pp < 1.5) return null;
    const n = san(nm(pl)), stars = '★'.repeat(pl.level), bs = best.m ? `「${best.m.expr}」` : '「あえて引く」', ms = m ? `「${m.expr}」` : '「引く」', d = mine.pp - best.pp;
    const big = best.m && best.m.vals.some(v => v >= 10), keep = !best.m;
    S.spectate.diffs.push({ p, round: g.round, best: bs, mine: ms, d });
    return { root: `${stars}の${n}は${ms}。達人の読みなら${bs}です。${keep ? '出せる札を使わずに手札の形を残す方が、次の場に強くなります。' : big ? '大きい札を処分できる場面でした。' : '残る手札の形に差が出ます。'}失点の見込みで${d.toFixed(1)}点ほどの差です。`,
      masa: `${n}、${ms}かぁ！達人やったら${bs}やで！${big ? 'でかい札を逃がすチャンスやったのに、パス回しで終わってもうたな！' : keep ? 'ここは攻めずにボールキープ、我慢の場面やったんや！' : 'ちょっとの差でも、積み重なったら試合が決まるで！'}` };
  } catch (e) { return null; }
}
// 1ゲームごとの感想（博士とマサ）→ 次のゲームへ
function watchGameSummary() {
  const g = S.game, T = S.T; if (!g || !S.spectate) return;
  const rv = watchReview(g, S.spectate.diffs.splice(0)), last = T.game >= T.cfg.games;
  const ppRow = g.players.map((p, i) => ({ p, i })).sort((a, b) => g.pp[a.i] - g.pp[b.i]).map(({ p, i }) => `<div class="ws-pp ${g.winner === i ? 'win' : ''}"><span class="av">${av(p, g.winner === i ? 'happy' : moodOf(g, i), true)}</span><div><b>${esc(nm(p))}</b><small>${'★'.repeat(p.level)}</small><span>${g.winner === i ? '上がり' : `PP <b class="tnum">${g.pp[i]}</b>`}</span></div></div>`).join('');
  const cm = who => `<div class="w-cm ${who}"><div class="cm-av">${KB.casterSVG(who, 'happy')}</div><div><span class="cm-name">${who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span>${esc(rv[who])}</div></div>`;
  modal(`<div class="stack watch-sum"><div class="gs-head"><span class="small">達人の観戦</span><b>第${T.game}ゲームの感想</b></div><div class="ws-pps">${ppRow}</div>${cm('root')}${cm('masa')}
    <div class="row" style="justify-content:flex-end;gap:8px;flex-wrap:wrap"><button class="btn ghost" data-act="watch-quit">観戦をやめる</button><button class="btn primary" data-act="watch-next">${last ? 'セットの結果へ' : `第${T.game + 1}ゲームへ`}</button></div></div>`);
}
function watchNext() {
  const T = S.T; if (!T || !S.spectate) return;
  closeModal();
  if (T.game < T.cfg.games) { T.game++; startGame(); return; }
  const tot = T.players.map(p => ({ p, t: T.setPP[p.id].reduce((a, b) => a + b, 0), w: T.setPP[p.id].filter(x => x === 0).length })).sort((a, b) => a.t - b.t), top = tot[0];
  const r = `セットの結果は、${tot.map((o, k) => `${k + 1}位 ${o.p.ch.name}（★${o.p.level}・PP${o.t}）`).join('、')}。${san(top.p.ch.name)}は上がり${top.w}回。${top.p.level < 5 ? '達人を抑えての首位です。1セットでは運も大きく働きます。' : '強さの差は、1ゲームより1セットの合計にはっきり出ます。'}`;
  const m = `1セット終了や！MVPは${san(top.p.ch.name)}、セットPP${top.t}！上がるだけやなくて、失点を抑えるディフェンスもワールドクラスやったで！ほな、次は自分の番や！`;
  confetti(); KB.sfx('win');
  modal(`<div class="stack watch-sum"><div class="gs-head"><span class="small">達人の観戦</span><b>セットの結果</b></div>
    <div class="ws-pps">${tot.map((o, k) => `<div class="ws-pp ${k === 0 ? 'win' : ''}"><span class="av">${av(o.p, k === 0 ? 'happy' : 'normal', true)}</span><div><b>${k + 1}位 ${esc(o.p.ch.name)}</b><small>${'★'.repeat(o.p.level)}</small><span>PP <b class="tnum">${o.t}</b></span></div></div>`).join('')}</div>
    <div class="w-cm root"><div class="cm-av">${KB.casterSVG('root', 'happy')}</div><div><span class="cm-name">解説・ルート博士</span>${esc(r)}</div></div><div class="w-cm masa"><div class="cm-av">${KB.casterSVG('masa', 'happy')}</div><div><span class="cm-name">実況・ナニワのマサ</span>${esc(m)}</div></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="btn ghost" data-act="watch-quit">ホームへ</button><button class="btn" data-act="watch-again">もう1セット観戦</button><button class="btn primary" data-act="watch-play">自分で打つ（1セット練習）</button></div></div>`);
}
function watchReview(g, ds) {
  const nm2 = i => san(g.players[i].ch.name), w = g.winner, plays = g.log.filter(x => x.type === 'play');
  const lastW = plays.filter(x => x.p === w).pop(), sumOf = v => v.reduce((a, b) => a + b, 0);
  const big = plays.filter(x => x.vals.length === 3 && x !== lastW).sort((a, b) => sumOf(b.vals) - sumOf(a.vals))[0]; // 決め手と同じ手は重ねて言わない
  const lvOf = i => g.players[i].level, trivDiv = e => /(\d+|[AJQK]) ÷ \1(?!\d)/.test(e);
  const divs = plays.filter(x => /÷/.test(x.expr) && !trivDiv(x.expr) && lvOf(x.p) >= 4 && x !== big && x !== lastW), div = divs.find(x => /\(/.test(x.expr)) || divs[0];
  const dwp = g.drawsWhilePlayable.map((k, i) => ({ k, i })).filter(x => x.k > 0).sort((a, b) => b.k - a.k)[0];
  const loser = g.pp.map((pp, i) => ({ pp, i })).sort((a, b) => b.pp - a.pp)[0];
  const rest = loser ? g.hands[loser.i].map(c => KB.vname(c.v)).join('・') : '';
  const R = [], M = [];
  if (w >= 0) { R.push(`第${g.round}巡、${nm2(w)}の上がりです。決め手は「${lastW ? lastW.expr : ''} = ${lastW ? lastW.t : ''}」。`); M.push(RVP([`第${g.round}巡、${nm2(w)}が上がりや！「${lastW ? lastW.expr : ''}」でフィニッシュ、ゴラッソやな！`, `${nm2(w)}、第${g.round}巡で上がり！最後の「${lastW ? lastW.expr : ''}」、ナッツで勝負決めたって感じや！`])); }
  else { R.push('山札が尽きて、上がりなしで終わりました。'); M.push('上がりなしのスコアレスドローや！守り合いの一戦やったな！'); }
  if (big) { R.push(`光ったのは第${big.round}巡、${nm2(big.p)}の「${big.expr} = ${big.t}」。3枚で手札の合計を${sumOf(big.vals)}減らしました。`); M.push(`第${big.round}巡の${nm2(big.p)}「${big.expr}」、3枚で${sumOf(big.vals)}点分ごっそりや！ハットトリック級やで！`); }
  if (div) { R.push(`${nm2(div.p)}の「${div.expr}」のように、割り算で大きい札を小さな数に変えるのは達人の定番です。`); M.push(`「${div.expr}」の割り算、うまいこと大きい札を逃がしとる！`); }
  if (dwp && lvOf(dwp.i) >= 4) { R.push(`出せるのにあえて引いた場面が${dwp.k}回（${nm2(dwp.i)}）。目先の1枚より、次の場で使える形を残す判断です。`); M.push(`${nm2(dwp.i)}は出せるのにあえて引いとったで。ポーカーで言うたら、ええ手を見送って次を待つ判断や！`); }
  else if (dwp) { R.push(`${nm2(dwp.i)}（★${lvOf(dwp.i)}）は、出せるのに引いた場面が${dwp.k}回ありました。★の低い人は、出せる組み合わせを見落としやすいのです。`); M.push(`${nm2(dwp.i)}、出せるのに引いてもうたのが${dwp.k}回や。シュートチャンスに気づかへんかったんやな！`); }
  if (loser && loser.pp > 0) { R.push(`いちばん失点したのは${nm2(loser.i)}（PP${loser.pp}）。最後に${rest}が残りました。大きい札を抱えたまま上がられると、失点が大きくなります。`); M.push(`${nm2(loser.i)}はPP${loser.pp}、${rest}が残ってもうた。でかい札は早めにベンチに下げとかんとな！`); }
  ds = ds || [];
  if (ds.length) {
    const top = ds.sort((a, b) => b.d - a.d)[0], byP = {}; ds.forEach(x => byP[x.p] = (byP[x.p] || 0) + 1);
    const most = Object.keys(byP).sort((a, b) => byP[b] - byP[a])[0];
    R.push(`達人の読みと違う手は${ds.length}回。いちばん差が大きかったのは第${top.round}巡、${nm2(top.p)}の${top.mine}（達人なら${top.best}）。${byP[most] >= 2 ? `${nm2(+most)}（★${g.players[+most].level}）は${byP[most]}回で、強さの差が手の選び方に出ています。` : ''}`);
    M.push(`達人と違う手が${ds.length}回あったで！一番もったいなかったんは${nm2(top.p)}の${top.mine}や。達人なら${top.best}、ここが★の差やな！`);
  } else R.push('このゲームは、全員が達人の読みと大きくは違わない手を選びました。');
  R.push(RVP(['1ゲームの結果には運が入ります。見るべきは、毎回の選び方です。', '自分ならこの場で何を出すか、一手ずつ考えながら見ると上達が早いですよ。', '上がった人より、失点を小さく抑えた人の打ち方にも学びがあります。']));
  if (!M.some(t => /ゴール|サッカー|ハットトリック|ゴラッソ|ポーカー|ナッツ|ベンチ|ドロー|オールイン/.test(t))) M.push('サッカーでも、上手い人の試合を見るのがいちばんの練習や！');
  return { root: R.join(''), masa: M.join('') };
}
// ---------- 早見表を作成：多面待ちの2枚・3枚を、自分で式を入れて埋めていく（ヒントなし） ----------
// 行：2枚は3面以上（A・○は法則の一行にまとめる）、3枚は9面以上。面数の多い順
const CHART_ROWS = [[1, 2, 6], [1, 2, 4], [1, 2, 5], [1, 2, 7], [1, 2, 9], [1, 2, 10], [2, 3, 7], [1, 2, 3], [1, 2, 8], [1, 2, 12], [1, 3, 3], [1, 3, 4], [1, 3, 9], [2, 2, 8], [2, 3, 3], [2, 3, 4], [2, 3, 5], [2, 3, 8], [2, 3, 9], [2, 3, 12], [2, 4, 5], [2, 4, 10], [3, 3, 12], [3, 4, 5], [3, 5, 6], [3, 6, 9],
  [2, 6], [2, 3], [2, 4], [2, 5], [2, 8], [2, 10], [3, 3], [3, 4], [3, 6], [3, 9], [4, 8]];
let CHART_MEN = null; // 行ごとの待ち（全部の札を使って作れる場）
function chartMen() {
  if (CHART_MEN) return CHART_MEN;
  CHART_MEN = CHART_ROWS.map(vals => { const c = KB.countsOf(vals), out = []; for (let t = 1; t <= 13; t++) if (KB.findMoves(c, t, 'all', 3).some(m => m.n === vals.length)) out.push(t); return out; });
  return CHART_MEN;
}
const chartGet = () => store.get('chart', null) || {};
const chartTotal = () => chartMen().reduce((a, m) => a + m.length, 0);
const chartFullRows = () => { const c = chartGet(), men = chartMen(); return CHART_ROWS.map((r, i) => i).filter(i => men[i].every(t => (c[CHART_ROWS[i].join(',')] || {})[t])); };
const chartDone = () => { const c = chartGet(); return CHART_ROWS.reduce((a, r) => a + Object.keys(c[r.join(',')] || {}).length, 0); };
// 式の計算：整数だけ。割り算は割り切れるときだけ（ゲームのルールと同じ）
function chartEval(tok) {
  let i = 0;
  const peek = () => tok[i], err = m => { throw new Error(m); };
  function atom() { const t = tok[i++]; if (!t) err('…'); if (t.k === 'c') return t.v; if (t.k === '(') { const v = expr(); if (!tok[i] || tok[i].k !== ')') err('…'); i++; return v; } err('式の形がちがいます'); }
  function term() { let v = atom(); while (peek() && (peek().k === '×' || peek().k === '÷')) { const o = tok[i++].k, w = atom(); if (o === '×') v *= w; else { if (w === 0 || v % w !== 0) err('割り切れない割り算は使えません'); v /= w; } } return v; }
  function expr() { let v = term(); while (peek() && (peek().k === '+' || peek().k === '−')) { const o = tok[i++].k, w = term(); v = o === '+' ? v + w : v - w; } return v; }
  const v = expr(); if (i < tok.length) err('式の形がちがいます'); return v;
}
const chartStr = tok => tok.map(t => t.k === 'c' ? KB.vname(t.v) : t.k).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
// 早見表の導入（ホームから開くとき）：マサが、作り方とゲーム中に見られることを話す。完成していれば完成と言う
function chartIntro() {
  const full = chartFullRows().length, all = CHART_ROWS.length, done = full >= all;
  modeIntro({ title: '早見表', sub: done ? `${all}行すべて完成！` : `完成 ${full}/${all}行`,
    masa: done ? `早見表、完成しとるやん！${all}行ぜんぶ埋まったで、見事なもんや！ゲーム中は「まだ見えていないカードを見る」の横のボタンから、いつでもこの表が見られるで！`
      : `早見表は、3枚・2枚の札でどの場の数が作れるかの一覧や。行を選んで、札と記号で式を作ったら○が付く。${full ? `いま${full}行完成、あと${all - full}行や！` : 'まずは1行、ぜんぶ埋めてみよか！'}`,
    masa2: done ? null : `完成した行は、ゲーム中に「まだ見えていないカードを見る」の横のボタンから見られるで。サッカーの作戦ボードみたいなもんや、試合中に見られたら心強いやろ！`,
    noGo: true, extra: [{ label: done ? '早見表を見る' : '早見表を作る', primary: true, on: () => chartOpen() }] });
}
function chartOpen(view) { S.chart = S.chart || { row: 0, tok: [], msg: null }; S.chart.view = !!view; S.chart.tok = []; S.chart.msg = null; S.chart.lock = false; S.chart.scroll = null; chartRender(); if (S.view === 'game') pauseGame(); } // 開いている間は対局を止める
// 早見表の共通部品：何面待ちごとの小見出し（●の数で待ちの多さを見せる）、○のチェック（長押しで付け外し。自分用の目印）
const chartMarks = () => store.get('chartMark', null) || {};
function chartGroups(idx, men, rowFn) {
  let last = -1, out = '';
  idx.forEach(i => { const n = men[i].length; if (n !== last) { last = n; out += `<tr class="ch-sub"><td colspan="14"><b>${n}面待ち</b><span class="ch-dots">${'●'.repeat(n)}</span></td></tr>`; } out += rowFn(i); });
  return out;
}
function chartCell(d, t, i, mk, hintOn, men) {
  if (d[t]) { const k = CHART_ROWS[i].join(',') + '@' + t, on = mk[k]; return `<td class="ok ${on ? 'mk' : ''}" data-cexp="${esc(d[t])} = ${KB.vname(t)}" data-cmk="${k}">○${on ? '<i>✓</i>' : ''}</td>`; }
  return hintOn && men[i].includes(t) ? '<td class="hint">？</td>' : '<td></td>';
}
// ○：タップで式を見る、長押しでチェックを付け外し
function chartBindCells(m) {
  m.querySelectorAll('[data-cexp]').forEach(td => {
    let tm = null, long = false;
    const start = () => { long = false; clearTimeout(tm); tm = setTimeout(() => { long = true; const mk = chartMarks(), k = td.dataset.cmk; if (mk[k]) delete mk[k]; else mk[k] = 1; store.set('chartMark', mk); KB.sfx('select'); td.classList.toggle('mk', !!mk[k]); td.innerHTML = '○' + (mk[k] ? '<i>✓</i>' : ''); toast(mk[k] ? 'チェックを付けました' : 'チェックを外しました'); }, 450); };
    const stop = () => clearTimeout(tm);
    td.addEventListener('pointerdown', start); ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => td.addEventListener(ev, stop));
    td.addEventListener('contextmenu', e => e.preventDefault());
    td.onclick = e => { e.stopPropagation(); if (long) { long = false; return; } toast(td.dataset.cexp); };
  });
}
function chartRender() {
  const C = S.chart, men = chartMen(), data = chartGet(), row = CHART_ROWS[C.row], key = row.join(','), mine = data[key] || {};
  if (C.view) return chartViewRender(men, data);
  const head = `<tr><th>札</th>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(v => `<th>${KB.vname(v)}</th>`).join('')}</tr>`;
  const mk = chartMarks();
  const sec = (title, from, to) => `<tr class="ch-sec"><td colspan="14">${title}</td></tr>` + chartGroups(CHART_ROWS.slice(from, to).map((_, k) => from + k), men, i => {
    const r = CHART_ROWS[i], d = data[r.join(',')] || {}, left = men[i].length - Object.keys(d).length;
    return `<tr class="${i === C.row ? 'on' : ''} ${left ? '' : 'full'}" data-crow="${i}"><td class="ch-cards">${r.map(v => `<span>${KB.vname(v)}</span>`).join('')}<small>${left ? `あと${left}面` : '👑'}</small></td>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(t => chartCell(d, t, i, mk, C.hint, men)).join('')}</tr>`;
  });
  const used = new Set(C.tok.filter(t => t.k === 'c').map(t => t.i)), al = chartAllowed(C), busy = !!C.lock;
  let preview = '';
  if (C.tok.length) { try { const v = chartEval(C.tok); preview = `= ${v}`; } catch (e) { preview = e.message === '…' ? '' : e.message; } }
  const done = chartDone(), total = chartTotal();
  const cur = $('#modal .chart-modal'), html = (`<div class="chart-modal"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">早見表を作成</h2><span class="small">${done}/${total}</span></div>
    <p class="small" style="margin:0">行を選び、札と記号で式を作ると答えの列に○。○をタップすると自分の式、<b>長押しでチェック</b>（気づきにくい待ちなどの目印）。</p>
    <p class="small ch-rule" style="margin:0">法則：<b>A＋○</b> の2枚は、○−1・○・○＋1 の3面待ち（例：A・7 → 6・7・8）</p>
    <div class="ch-wrap"><table class="ch-table">${head}${sec('3枚（9面以上）', 0, 26)}${sec('2枚（3面以上）', 26, CHART_ROWS.length)}</table></div>
    <div class="ch-input">
      <div class="ch-row-now">${row.map(v => `<span>${KB.vname(v)}</span>`).join('')}<small>${men[C.row].length - Object.keys(mine).length ? `あと${men[C.row].length - Object.keys(mine).length}面` : '👑 この行は完成'}</small><button class="btn sm ch-hintbtn ${C.hint ? 'on' : ''}" data-chint="1" aria-pressed="${C.hint ? 'true' : 'false'}">💡 残りの場 ${C.hint ? 'ON' : 'OFF'}</button></div>
      <div class="ch-expr ${C.msg ? (C.msg.ok ? 'good' : 'bad') : ''}"><span class="mono">${esc(chartStr(C.tok)) || '<span class="muted">札と記号をタップ</span>'}</span><b>${esc(C.msg ? C.msg.t : preview)}</b></div>
      <div class="ch-keys">${row.map((v, i) => `<button class="ch-k card-k" data-ckc="${i}" ${used.has(i) || !al.card || busy ? 'disabled' : ''}>${KB.vname(v)}</button>`).join('')}
        ${['+', '−', '×', '÷', '('].map(o => `<button class="ch-k" data-cko="${o}" ${(o === '(' ? !al.open : !al.op) || busy ? 'disabled' : ''}>${o}</button>`).join('')}<button class="ch-k" data-ckb="1" aria-label="1つ消す" ${!C.tok.length || busy ? 'disabled' : ''}>⌫</button><button class="ch-k ch-clr" data-ckclr="1" aria-label="式をクリア" ${!C.tok.length || busy ? 'disabled' : ''}>C</button></div>
      <div class="ch-foot"><span class="small muted">「(」のあと札を2枚入れると「)」は自動で閉じます</span></div>
      ${C.hint ? `<div class="ch-hintline">まだの場：<b>${men[C.row].filter(t => !mine[t]).map(KB.vname).join('・') || 'なし（完成！）'}</b></div>` : ''}
    </div>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div></div>`);
  if (cur) { const keep = cur.querySelector('.ch-wrap'), st = keep ? keep.scrollTop : 0; cur.parentElement.innerHTML = html; bindModal($('#modal')); const w = $('#modal .ch-wrap'); if (w) w.scrollTop = st; } else modal(html); // 打つたびに作り直しても、対局は止めたまま
  const m = $('#modal'); if (!m) return;
  m.querySelectorAll('[data-crow]').forEach(tr => tr.onclick = () => { C.row = +tr.dataset.crow; C.tok = []; C.msg = null; chartRender(); });
  chartBindCells(m);
  m.querySelectorAll('[data-ckclr]').forEach(b => b.onclick = () => { if (C.lock) return; C.tok = []; C.msg = null; chartRender(); });
  m.querySelectorAll('[data-ckc]').forEach(b => b.onclick = () => chartKey({ k: 'c', i: +b.dataset.ckc, v: row[+b.dataset.ckc] }));
  m.querySelectorAll('[data-cko]').forEach(b => b.onclick = () => chartKey({ k: b.dataset.cko }));
  m.querySelectorAll('[data-ckb]').forEach(b => b.onclick = () => chartKey(null));
  m.querySelectorAll('[data-chint]').forEach(b => b.onclick = () => { C.hint = !C.hint; chartRender(); }); // すべての行で一律にオン・オフ
  const on = m.querySelector('tr.on'); if (on && C.scroll !== C.row) { C.scroll = C.row; on.scrollIntoView({ block: 'nearest' }); }
}
// 対局中：完成した行だけを見る（入力はできない。作るのはホームから）
function chartViewRender(men, data) {
  const full = chartFullRows(), head = `<tr><th>札</th>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(v => `<th>${KB.vname(v)}</th>`).join('')}</tr>`;
  const mk = chartMarks(), rows = chartGroups(full, men, i => { const r = CHART_ROWS[i], d = data[r.join(',')] || {}; return `<tr class="full"><td class="ch-cards">${r.map(v => `<span>${KB.vname(v)}</span>`).join('')}<small>${men[i].length}面</small></td>${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(t => chartCell(d, t, i, mk, false, men)).join('')}</tr>`; });
  modal(`<div class="chart-modal"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">早見表</h2><span class="small">完成 ${full.length}/${CHART_ROWS.length}行</span></div>
    <p class="small ch-rule" style="margin:0">法則：<b>A＋○</b> の2枚は、○−1・○・○＋1 の3面待ち（例：A・7 → 6・7・8）</p>
    ${full.length ? `<div class="ch-wrap" style="max-height:52vh"><table class="ch-table">${head}${rows}</table></div><p class="small muted" style="margin:0">○をタップすると自分で作った式、長押しでチェック（✓）を付け外しできます。</p>` : '<p class="small" style="margin:0">まだ完成した行がありません。ホームの「早見表を作成」で、行のすべての待ちを自分の式で埋めると、ここに表示されます。</p>'}
    <p class="small muted" style="margin:0">対局中は見るだけです。表を作るのはホームから。</p>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div></div>`);
  const m = $('#modal'); if (m) chartBindCells(m);
}
// 式として続けられるキーだけを押せるようにする：札・「(」のあとは札か「(」、札・「)」のあとは記号だけ。
// 「(」は中に札を2枚入れる余裕があるときだけ（入れ子はなし）。札を使い切ったら記号は押せない
function chartAllowed(C) {
  const row = CHART_ROWS[C.row], last = C.tok[C.tok.length - 1], left = row.length - C.tok.filter(x => x.k === 'c').length;
  let depth = 0; C.tok.forEach(x => { if (x.k === '(') depth++; else if (x.k === ')') depth--; });
  const operand = !last || ['+', '−', '×', '÷', '('].includes(last.k);
  return { card: operand && left > 0, op: !operand && left > 0, open: operand && depth === 0 && left >= 2, close: !operand && depth > 0 };
}
const chartOk = (C, t) => { const a = chartAllowed(C); return !t || (t.k === 'c' ? a.card : t.k === '(' ? a.open : t.k === ')' ? a.close : a.op); };
function chartKey(t) {
  const C = S.chart; if (!C || C.lock || C.view) return;
  if (t && !chartOk(C, t)) return; // 式として続かないキーは受け付けない
  C.msg = null;
  if (!t) C.tok.pop(); else C.tok.push(t);
  // カッコの自動補助：「(」のあとに札を2枚入れたら「)」を閉じる
  if (t && t.k === 'c') { let depth = 0, open = -1; C.tok.forEach((x, k) => { if (x.k === '(') { depth++; open = k; } else if (x.k === ')') depth--; }); if (depth > 0 && C.tok.slice(open).filter(x => x.k === 'c').length >= 2) C.tok.push({ k: ')' }); }
  const row = CHART_ROWS[C.row], nC = C.tok.filter(x => x.k === 'c').length;
  if (nC === row.length) {
    let v = null, e = null; try { v = chartEval(C.tok); } catch (x) { e = x.message; }
    if (e && e !== '…') C.msg = { t: e };
    else if (v != null) {
      const key = row.join(','), data = chartGet(), mine = data[key] = data[key] || {};
      if (v < 1 || v > 13 || v !== Math.floor(v)) C.msg = { t: `= ${v}（待ちになりません）` };
      else if (mine[v]) { C.msg = { t: `${KB.vname(v)} はもう埋まっています` }; C.lock = true; setTimeout(() => { C.lock = false; C.tok = []; C.msg = null; if ($('#modal .chart-modal')) chartRender(); }, 900); }
      else { mine[v] = chartStr(C.tok); store.set('chart', data); setMax('chart', chartFullRows().length); C.msg = { ok: true, t: `= ${KB.vname(v)}　○` }; KB.sfx('capture'); C.lock = true; setTimeout(() => { C.lock = false; C.tok = []; C.msg = null; if ($('#modal .chart-modal')) chartRender(); }, 700); }
    }
  }
  chartRender();
}
// パソコンではキーボードでも入力できる
document.addEventListener('keydown', e => {
  if (!S.chart || S.chart.view || !$('#modal .chart-modal') || e.isComposing) return;
  const row = CHART_ROWS[S.chart.row], used = new Set(S.chart.tok.filter(t => t.k === 'c').map(t => t.i));
  const kv = { a: 1, j: 11, q: 12, k: 13, t: 10, '0': 10 }[e.key.toLowerCase()] || (/^[1-9]$/.test(e.key) ? +e.key : null);
  const op = { '+': '+', '-': '−', '*': '×', '/': '÷', '(': '(', ')': ')' }[e.key];
  if (kv) { const i = row.findIndex((v, k) => v === kv && !used.has(k)); if (i >= 0) { e.preventDefault(); chartKey({ k: 'c', i, v: kv }); } }
  else if (op) { e.preventDefault(); chartKey({ k: op }); }
  else if (e.key === 'Backspace') { e.preventDefault(); chartKey(null); }
});

// ---------- 引っ越し（アーティファクト版 → 公開版） ----------
// 全プレイヤーの記録（localStorage の kb.*）を圧縮して、公開版URLの「#kbmove=」以降に入れて開く
const MIG_SKIP = { 'kb.recentLines': 1, 'kb.migDone': 1, 'kb.testAskName': 1 };
const b64u = {
  enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(t) { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
};
async function zipText(txt, back) {
  const fmt = 'deflate-raw', src = back ? txt : new TextEncoder().encode(txt);
  const st = new Blob([src]).stream().pipeThrough(back ? new DecompressionStream(fmt) : new CompressionStream(fmt));
  const buf = new Uint8Array(await new Response(st).arrayBuffer());
  return back ? new TextDecoder().decode(buf) : buf;
}
function migCollect() {
  const data = {};
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('kb.') && !MIG_SKIP[k]) data[k] = localStorage.getItem(k); } } catch (e) { }
  return data;
}
// アーティファクト版は閉じる：遊べなくして、新しいサイトへ案内する（はじめての人は説明のあと、記録のある人は引っ越すかを確認して）
const ARTIFACT_CLOSED = IS_ARTIFACT && !(typeof window !== 'undefined' && window.KB_TEST && !localStorage.getItem('kb.testClosed'));
const closedHas = () => profiles().length > 0 || Object.keys(migCollect()).some(k => /^kb\.p\./.test(k));
function closedHTML() {
  const has = closedHas(), nm = has ? san(S.settings.name || 'プレイヤー') : '', host = esc(PUBLIC_URL.replace('https://', '').replace(/\/$/, ''));
  const say = (who, t) => `<div class="cl-say ${who}"><span class="cl-cast">${KB.casterSVG(who, 'happy')}</span><p><small>${who === 'root' ? 'ルート博士' : 'ナニワのマサ'}</small>${t}</p></div>`;
  const talk = has
    ? say('root', `${esc(nm)}、いつも研究所に来てくれてありがとうございます。研究所は<b>新しいサイト</b>に引っ越しました。こちらの研究所は、これからは更新しません。`) + say('masa', `記録はまるごと持っていけるで！成長記録もバッジも図鑑もアバターも、ぜーんぶや。向こうでは記録がクラウドに残るし、<b>ランキング</b>もあるで！`)
    : say('root', 'ようこそ、計算ブリッジ作戦研究所へ。カードゲーム「計算ブリッジ」を、AIと対局しながら練習・研究する場所です。') + say('masa', '練習・大会・特訓・早見表・バッジ・観戦……楽しみ方はいろいろや。ルールも、ワイと博士で3分でサクッと教えたるで！') + say('root', `研究所は<b>新しいサイト</b>に引っ越しました。こちらでは遊べないので、新しいサイトでお待ちしています。`);
  const go = has
    ? `<div class="cl-q"><b>記録を持って、新しいサイトへ移りますか？</b><span class="small muted">こちらの記録は消えません。新しいサイトにすでに記録があるときは、上書きするか確認が出ます。</span></div>
      <a class="btn primary cl-go" id="cl-go" href="${esc(PUBLIC_URL)}" target="_blank" rel="noopener" aria-disabled="true">記録を持って新しいサイトへ移る</a>
      <a class="btn ghost sm cl-go2" id="cl-go2" href="${esc(PUBLIC_URL)}" target="_blank" rel="noopener">記録を持たずに移る</a>`
    : `<a class="btn primary cl-go" id="cl-go" href="${esc(PUBLIC_URL)}" target="_blank" rel="noopener">新しいサイトを開く</a>`;
  return `<div class="closed"><div class="cl-hero"><div class="cl-title">計算ブリッジ<small>作戦研究所</small></div><div class="cl-move">引っ越しました</div><div class="cl-url">${host}</div></div>
    <div class="cl-talk">${talk}</div>
    <div class="panel stack cl-act">${go}<p class="small muted cl-after" id="cl-after" hidden>新しいサイトを開きました。開かないときは、もう一度ボタンを押してください。</p></div>
    <div class="panel about-box"><h3>このアプリについて</h3><p class="small">「計算ブリッジ作戦研究所」は、カードゲーム「計算ブリッジ」を練習・研究するための、<b>非公式のファン制作アプリ</b>です。考案者・公式とは関係なく、個人が作成しています。「計算ブリッジ」は、<b>上野晋太郎さん（すうがっくま）</b>が2016年に考案したゲームです。</p>
      <div class="about-links"><a class="btn sm" href="https://keisan-bridge.amebaownd.com/" target="_blank" rel="noopener">計算ブリッジ 公式サイト ↗</a><a class="btn sm" href="https://soogackuma.com/18/" target="_blank" rel="noopener">公式ルール ↗</a><a class="btn sm" href="https://soogackuma.com/keisan-bridge" target="_blank" rel="noopener">公式アプリ ↗</a></div></div></div>`;
}
async function closedBind() {
  const after = () => { const a = $('#cl-after'); if (a) a.hidden = false; };
  ['#cl-go', '#cl-go2'].forEach(q => { const a = $(q); if (a) a.addEventListener('click', e => { if (a.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; } after(); }); });
  if (!closedHas()) return;
  const a = $('#cl-go'); if (!a) return;
  try {
    const payload = JSON.stringify({ app: 'keisan-bridge', mv: 1, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), data: migCollect() });
    a.href = PUBLIC_URL + '#kbmove=' + b64u.enc(await zipText(payload));
    a.addEventListener('click', () => raw.set('kb.migSent', Date.now()));
  } catch (e) { a.textContent = '新しいサイトを開く'; const b = $('#cl-go2'); if (b) b.remove(); const q = $('.cl-q .small'); if (q) q.textContent = 'この端末では記録をまとめられませんでした。新しいサイトで最初から始めてください。'; }
  a.removeAttribute('aria-disabled');
}
async function migrateOut() {
  const data = migCollect(), n = profiles().length;
  if (!Object.keys(data).length) { toast('引っ越す記録がまだありません'); return; }
  let url;
  try {
    const payload = JSON.stringify({ app: 'keisan-bridge', mv: 1, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), at: new Date().toISOString(), data });
    url = PUBLIC_URL + '#kbmove=' + b64u.enc(await zipText(payload));
  } catch (e) { toast('この端末では引っ越しの準備ができませんでした。「プレイヤー」の書き出しを使ってください'); return; }
  raw.set('kb.migSent', Date.now());
  modal(`<h2>新しいサイトへ移る</h2>
    <p class="small" style="margin:0">${n ? `${n}人分の` : ''}記録（成長記録・図鑑・アバター・ベスト記録など）をまとめました。下のボタンで新しいサイトを開くと、記録がそのまま引き継がれます。</p>
    <p class="small muted" style="margin:0">新しいサイト：${esc(PUBLIC_URL)}<br>この画面の記録は消えません。うまく開けないときは、もう一度このボタンから試してください。</p>
    <div class="row" style="justify-content:flex-end;flex-wrap:wrap"><button class="btn" data-act="close">やめる</button><a class="btn primary" id="mig-go" href="${esc(url)}" target="_blank" rel="noopener">新しいサイトを開く</a></div>`);
  const a = $('#mig-go'); if (a) a.onclick = () => setTimeout(closeModal, 300);
}
// 公開版：開いたときに「#kbmove=」のデータを読み込む。URLからはすぐ消す。同じデータの二重取り込みはしない
const MIG_IN = (() => {
  if (IS_ARTIFACT) return null;
  const h = location.hash || ''; if (!h.startsWith('#kbmove=')) return null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { }
  return h.slice(8);
})();
function migApply(o) {
  const done = raw.get('kb.migDone', []);
  try { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('kb.') && k !== 'kb.migDone' && !CLOUD_KEEP[k]) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); } catch (e) { }
  try { for (const k in o.data) if (k.startsWith('kb.') && !MIG_SKIP[k]) localStorage.setItem(k, o.data[k]); } catch (e) { toast('保存できませんでした（容量の上限かもしれません）'); return; }
  done.push(o.id); raw.set('kb.migDone', done.slice(-20)); raw.set('kb.migAt', Date.now()); raw.set('kb.cloudAt', Date.now()); // 引っ越した記録をクラウドの正本にする
  location.reload();
}
async function migrateIn(t) {
  let o; try { o = JSON.parse(await zipText(b64u.dec(t), true)); } catch (e) { o = null; }
  if (!o || o.app !== 'keisan-bridge' || !o.data || !o.id) { toast('引っ越しデータを読み込めませんでした'); S.askedName = false; render(); return; }
  if (raw.get('kb.migDone', []).includes(o.id)) { toast('この記録は、もう引き継ぎ済みです'); S.askedName = false; render(); return; }
  const names = (() => { try { return JSON.parse(o.data['kb.profiles'] || '[]').map(p => p.name); } catch (e) { return []; } })();
  const have = profiles();
  if (!have.length) { migApply(o); return; }
  modal(`<h2>記録の引っ越し</h2>
    <p class="small" style="margin:0">前のサイトの記録（${names.length ? esc(names.join('・')) : '名前なし'}）を引き継ぎます。</p>
    <p class="small" style="margin:0"><b>このサイトにはすでに記録があります（${esc(have.map(p => p.name).join('・'))}）。</b>引き継ぐと、いまの記録は前のサイトの記録で上書きされます。</p>
    <div class="row" style="justify-content:flex-end;flex-wrap:wrap"><button class="btn" id="mig-no">引き継がない</button><button class="btn primary" id="mig-yes">上書きして引き継ぐ</button></div>`);
  $('#mig-yes').onclick = () => migApply(o);
  $('#mig-no').onclick = () => { done0(); closeModal(); toast('引き継ぎをやめました'); };
  function done0() { const d = raw.get('kb.migDone', []); d.push(o.id); raw.set('kb.migDone', d.slice(-20)); }
}

// タイトルの6人：BPランキングの上位でアバターを作った人がいれば、その人たちを先に並べる（押すと成績カード）。残りはAIのキャラ
// タイトルの6人：総合ランキング（AI研究員も入れる）の上位6人を順位どおりに。順位の数字は出さない
function castHTML() {
  const R = CLOUD_ON && S.homeRank && (S.homeRank.total || S.homeRank.bp), top = R ? R.list.filter(x => x.rid).slice(0, 6) : [];
  const ppl = top.map(x => `<button class="cast-p" data-act="rank-card" data-rid="${esc(x.rid)}" data-name="${esc(x.name)}" data-me="${rankMe(x) ? 1 : ''}" title="総合${x.rank}位　${esc(x.name)}${x.ai ? '（AI研究員）' : ''}" aria-label="${esc(x.name)}の成績カードを見る">${KB.avatarSVG(Object.assign({ name: x.name }, x.avatar || AVATAR_DEF), { mood: 'happy' })}</button>`);
  if (!S.castPool) S.castPool = KB.shuffle(KB.ROSTER.slice()).slice(0, 6);
  const ai = S.castPool.slice(0, 6 - ppl.length).sort((a, b) => a.lv - b.lv).map((c, i) => KB.avatarSVG(KB.charToCh(c), { mood: ['happy', 'normal', 'smug', 'worried', 'normal', 'happy'][i], level: c.lv, style: c.st }));
  return ppl.join('') + ai.join('');
}
// プロフィールの順位：総合ランキングで、AI研究員を含めたときと、人だけのとき
function pbRankHTML() {
  const pick = rk => { const r = totalRankOf(rk, null, true); return r ? { r } : null; };
  const a = pick(S.homeRank), h = pick(S.rankHuman);
  if (!a && !h) return '';
  return `<button class="pb-rank-b" data-go="ranking" aria-label="ランキングを見る"><span class="pbr-h">🏆 総合</span>${a ? `<span class="pbr"><small>AI込み</small><b>${a.r}位</b></span>` : ''}${h ? `<span class="pbr"><small>人だけ</small><b>${h.r}位</b></span>` : ''}</button>`;
}
// 総合の順位用に、AI込みと人だけのランキングを読む（ランキング画面のAIの切り替えとは別に持つ）
async function homeRankFetch() {
  const c = (PID && plLink(PID)) || raw.get('kb.cloud', null), u = encodeURIComponent((c && c.uid) || '');
  const [j, h] = await Promise.all([fetch(CLOUD_API + '?a=rankings&uid=' + u).then(r => r.json()), fetch(CLOUD_API + '?a=rankings&ai=0&uid=' + u).then(r => r.json()).catch(() => null)]);
  if (j.ok && j.rankings) { S.homeRank = j.rankings; S.homeRankAt = Date.now(); }
  if (h && h.ok && h.rankings) S.rankHuman = h.rankings;
  try { const mk = store.get('noteMark', {}) || {}, a = totalRankOf(S.homeRank, null, true), hu = totalRankOf(S.rankHuman, null, true); let ch = false;
    let told = false; // 上がったときだけ知らせる（人だけを優先。同時に上がったら1件）
    if (hu && hu !== mk.rankH) { if (mk.rankH != null && hu < mk.rankH) { noteAdd('rank', { lab: '人だけ', v: hu, from: mk.rankH }); told = true; } mk.rankH = hu; ch = true; }
    if (a && a !== mk.rankA) { if (mk.rankA != null && a < mk.rankA && !told) noteAdd('rank', { lab: 'AI込み', v: a, from: mk.rankA }); mk.rankA = a; ch = true; }
    if (ch) store.set('noteMark', mk); } catch (e) { }
}
// ある人の総合の順位（rid で探す。自分は rankMe）
function totalRankOf(rk, rid, me) { const t = rk && rk.total; if (!t) return null; const x = [...(t.list || []), ...(t.mine || [])].find(x => me ? rankMe(x) : x.rid === rid); return x ? x.rank : null; }
async function homeCastLoad() {
  if (!CLOUD_ON || (S.homeRank && Date.now() - S.homeRankAt < 300000) || S.castLoading) return;
  S.castLoading = true;
  try { await homeRankFetch(); } catch (e) { } finally { S.castLoading = false; }
  const el = S.view === 'home' && $('.title .cast'); if (el) { el.innerHTML = castHTML(); el.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b)); }
  const pr = S.view === 'home' && $('#pb-rank'); if (pr) { pr.innerHTML = pbRankHTML(); pr.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go)); }
}
// モードのカードのタグ：自分で決めた設定があるときだけ、その設定を出す（決まっている設定は出さない）
function pracFacts() {
  const c = store.get('cfgPractice', null); if (!c) return '';
  const opps = (c.opps || []).slice(0, Math.max(1, (c.n || 4) - 1)), lv = opps.map(o => o.level === 'r' ? null : +o.level);
  const lvTxt = lv.every(x => x == null) ? `相手：${(MIX[c.mix] || MIX.random).label}` : `相手：${lv.map(x => x == null ? 'おまかせ' : '★' + x).join('・')}`;
  return `<div class="facts my-facts"><span>${c.n || 4}人卓</span><span>${c.games || 5}ゲーム</span><span>${esc(lvTxt)}</span></div>`;
}
function tourFacts() {
  const c = store.get('cfgTour', null); if (!c) return '';
  return `<div class="facts my-facts"><span>${c.nPlayers}人・${KB.splitTables(c.nPlayers, 5).length}卓</span><span>${c.games}ゲーム×${c.sets}セット</span><span>上位${c.finalists}名が決勝</span><span>相手：${esc((MIX[c.mix] || MIX.random).label)}</span></div>`;
}
function homeHTML() {
  const saved = store.get('session', null);
  KB.resetNames();
  const sts = KB.getStrategy().styles;
  const fanCards = [{ v: 11, s: 1 }, { v: 4, s: 0 }, { v: 1, s: 2 }, { v: 7, s: 3 }];
  const fan = fanCards.map((c, i) => `<div class="card ${c.s === 1 || c.s === 2 ? 'red' : ''}" style="transform:translateX(-50%) rotate(${(i - 1.5) * 14}deg)"><span class="v">${KB.vname(c.v)}</span><span class="s">${KB.SUITS[c.s]}</span></div>`).join('');
  return `<section class="title">
  <div class="title-stage">
    <button class="host host-l host-btn" data-act="host-root" aria-label="ルート博士：公式ルールを見る"><span class="host-say">ようこそ。</span><span class="host-av">${KB.casterSVG('root', 'happy')}</span><span class="host-nm">解説<b>ルート博士</b></span><span class="host-tag">📖 ルール</span></button>
    <div class="fan" aria-hidden="true">${fan}</div>
    <button class="host host-r host-btn ${masaBeckon() ? 'beckon' : ''}" data-act="host-masa" aria-label="ナニワのマサ：次にやることのアドバイス"><span class="host-say">${masaBeckon() ? R0(['アドバイスするで〜！', '押してみ！教えたる！', '迷ったらおれや！']) : 'ほな、いこか！'}</span><span class="host-av">${KB.casterSVG('masa', 'happy')}</span><span class="host-nm">実況<b>ナニワのマサ</b></span><span class="host-tag">💡 アドバイス</span></button>
  </div>
  <div class="logo">計算ブリッジ<small>作戦研究所</small></div>
  <p>J − 4 × A ＝ 7。強さも性格もばらばらのAIたちと本番そっくりの卓を囲み、自分の手とAIの最善手を突き合わせて、予選を勝ち抜く打ち方を見つけよう。</p>
  <p class="unofficial">非公式のファン制作アプリです　<a href="#about" data-act="about-scroll">このアプリについて</a></p>
  ${MIGRATE_ON && IS_ARTIFACT ? `<div class="panel mig-panel"><b>新しいサイトができました</b><div class="small muted">記録をまるごと持って、${esc(PUBLIC_URL.replace('https://', '').replace(/\/$/, ''))} へ移れます。</div><button class="btn primary" data-act="migrate-out">新しいサイトへ移る</button></div>` : ''}
  <div class="cast">${castHTML()}</div>
</section>
${profiles().length ? (() => { const g = G_(), r = ratingOf(g.games); return `<div class="player-bar"><button class="pb-av pb-avatar" data-act="avatar-edit" aria-label="アバターを編集">${KB.avatarSVG(Object.assign(myAvatar(), { name: S.settings.name }), { mood: 'happy' })}<span class="pb-edit">編集</span></button><span class="pb-main"><small>プレイヤー</small><b>${esc(S.settings.name)}</b><span class="pb-sub">${r.ok ? `★${r.r.toFixed(1)}・` : ''}${g.games.length}ゲーム</span>${CLOUD_ON ? `<span class="pb-rank" id="pb-rank">${pbRankHTML()}</span><span class="pb-rv" id="pb-rv">${rvcHTML(rivalsOf(), rvByMine(), S.settings.name)}</span>` : ''}</span><span class="pb-btns"><button class="btn sm x-btn" data-act="share-open" aria-label="成績をXでシェア"><b>𝕏</b> シェア</button><button class="btn sm pb-prof" data-act="profiles">編集・プレイヤー切り替え</button><button class="btn sm pb-bell" data-act="notes-open" aria-label="通知を見る">🔔 通知<i class="nb" id="pb-nb" ${notesUnread() ? '' : 'hidden'}>${notesUnread()}</i></button></span>
    ${ON_ENABLED() && (ON.myAwards || []).some(a => a.pid === PID) ? (() => { const tid = store.get('title', ''), a = (ON.myAwards || []).find(x => x.tid === tid && x.pid === PID); return `<button class="pb-title" data-act="title-open">${a ? `${['👑', '🥈', '🥉'][a.place - 1]} ${+a.official ? '公式・' : ''}${esc(a.tname)} ${placeJa(+a.place)}` : '👑 称号を選ぶ'}</button>`; })() : ''}
    ${(() => { const b = store.get('bio', ''); return `<button class="pb-bio ${b ? '' : 'empty'}" data-act="bio-edit" data-from="home" aria-label="自己紹介を編集">${b ? esc(b).replace(/\n/g, '<br>') : '＋ 自己紹介を書く（140文字まで）'}</button>`; })()}
    <div class="pb-emb">${ACH_GROUPS.map((gr, gi) => { const cp = catProgress(g, gi); return `<button class="pb-em ${cp.done ? 'got' : ''}" data-go="growth" title="${esc(gr[0])}：${esc(cp.name)}">${emblemSVG(gi, cp.done, 40)}<small>${cp.done ? '達成' : `${cp.have}/${cp.all}`}</small></button>`; }).join('')}</div>
    <button class="pb-badges" data-go="growth" aria-label="獲得したバッジ ${ACH.reduce((n, a) => n + a[2].filter(t => g.ach[a[0] + ':' + t]).length, 0)}/${ACH_TOTAL}"><span class="pb-bl">${ACH_GROUPS.flatMap(([, ks]) => ks).map(k => ACH.find(x => x[0] === k)).filter(Boolean).flatMap(a => a[2].map((t, i) => g.ach[a[0] + ':' + t] ? badgeSVG(a, i, true, 18) : '')).join('') || '<span class="small muted">まだバッジはありません</span>'}</span><span class="pb-bc">バッジ <b>${ACH.reduce((n, a) => n + a[2].filter(t => g.ach[a[0] + ':' + t]).length, 0)}</b>/${ACH_TOTAL}・<b class="atk-bp">${bpTotal(g)}</b> BP</span></button></div>`; })() : ''}
${saved ? `<div class="panel row" style="justify-content:space-between;margin-top:8px"><div><b>続きから</b><div class="small muted">${esc(saved.cfg.kind === 'practice' ? '練習' : '大会')}・${saved.phase === 'final' ? '決勝' : '第' + saved.set + 'セット'} ${resumeLabel(saved)}から</div></div><div class="row"><button class="btn sm ghost" data-act="discard-save">破棄</button><button class="btn primary sm" data-act="resume">再開する</button></div></div>` : ''}
${CLOUD_ON ? '<button class="rank-banner" data-go="ranking"><span class="rb-ic">🏆</span><span><b>ランキング</b><small>総合・推定実力・バッジ数・BP・連続最善・バッジアタック</small></span><span class="rb-go">見る →</span></button>' : ''}
${onlineHomeHTML()}
<div class="mode-grid">
  <div class="mode"><div class="mode-head"><span class="mode-ic" aria-hidden="true">🃏</span><div><div class="lbl">PRACTICE</div><h2>1セット練習</h2></div></div>${modeBadgeRows(MB_PRAC, true)}
    <p class="small muted" style="margin:0">相手の人数・強さ・性格を選んで5ゲームを1セット。手ごとにAIの読みを確かめられます。</p>
    ${pracFacts()}
    <button class="btn sm watch-sm" data-act="watch-start">👀 達人のゲームを観戦</button>
    <button class="btn primary" data-go="setup-practice">練習をはじめる</button></div>
  <div class="mode"><div class="mode-head"><span class="mode-ic" aria-hidden="true">🏟️</span><div><div class="lbl">TOURNAMENT</div><h2>大会モード</h2></div></div>${modeBadgeRows(MB_TOUR, true)}
    <p class="small muted" style="margin:0">予選は毎セット席替え。他の卓も同時に進み、順位表を見ながら決勝進出をかけた作戦を試せます。</p>
    ${tourFacts()}
    <button class="btn primary" data-go="setup-tour">大会をはじめる</button></div>
  ${attackCardHTML()}
  ${huntCardHTML()}
  ${outsCardHTML()}
  ${chartCardHTML()}
</div>
${growthCardHTML()}
<div class="row" style="margin-top:14px">
  <button class="btn" data-go="strategy">AIたちの戦略図鑑</button>
  <button class="btn" data-go="rules">ルールと前提</button>
</div>
<div class="panel about-box" id="about">
  <h3>このアプリについて</h3>
  <p>「計算ブリッジ作戦研究所」は、カードゲーム「計算ブリッジ」を練習・研究するための、<b>非公式のファン制作アプリ</b>です。考案者・公式とは関係なく、個人が作成しています。</p>
  <p>「計算ブリッジ」は、<b>上野晋太郎さん（すうがっくま）</b>が2016年に考案したゲームです。正式なルールや大会の情報、公式アプリは、公式サイトをご覧ください。</p>
  <div class="about-links">
    <a class="btn sm" href="https://keisan-bridge.amebaownd.com/" target="_blank" rel="noopener">計算ブリッジ 公式サイト ↗</a>
    <a class="btn sm" href="https://soogackuma.com/18/" target="_blank" rel="noopener">公式ルール ↗</a>
    <a class="btn sm" href="https://soogackuma.com/keisan-bridge" target="_blank" rel="noopener">公式アプリ ↗</a>
  </div>
  <p class="small muted">このアプリに登場するキャラクター（ルート博士・ナニワのマサ・対戦相手など）は、すべてこのアプリのオリジナルです。公式キャラクターや公式の画像は使っていません。ルールの細かい部分は、公式と異なる場合があります。</p>
  <div class="about-tut"><span class="small">はじめての方へ：博士とマサが、例を使ってルールとコツを説明します。</span><button class="btn primary" data-act="tut-start">ルールの説明を受ける</button><button class="btn" data-go="story">このアプリができるまで</button><button class="btn" data-go="numbers">数字で見る計算ブリッジ</button></div>
</div>
${STAT.admin && STAT.db ? '<div class="stats-foot"><button class="linkish" data-act="show-stats">利用状況</button></div>' : ''}`;
}

// ---------- 設定画面：おすすめセット（土台を1つ選ぶ）→ゲーム数（大会は予選のセット数）→開始。細かいことは「カスタム設定」にたたむ ----------
const DEF_P = { n: 4, games: 5, mix: 'even', preset: 'usual', opps: [0, 1, 2, 3].map(() => ({ level: 'r', style: 'r' })), points: [10, 8, 5, 2, 0] };
const DEF_T = { nPlayers: 15, sets: 3, games: 5, points: [10, 8, 5, 2, 0], finalists: 5, tie: 'janken', mix: 'even', preset: 'usual' };
const SU_PRESETS = [
  { k: 'first', icon: '🐣', label: 'はじめて', sub: '相手は★1〜2', p: c => { c.mix = 'casual'; c.opps = [0, 1, 2, 3].map(() => ({ level: String(1 + ((Math.random() * 2) | 0)), style: 'r' })); }, t: c => Object.assign(c, { mix: 'casual', nPlayers: 9, games: 3, finalists: 3 }), tsub: '★1〜2・9人の小さな大会' },
  { k: 'usual', icon: '⚖️', label: 'いつもの', sub: 'まんべんなく', p: c => { c.mix = 'even'; c.opps = [0, 1, 2, 3].map(() => ({ level: 'r', style: 'r' })); }, t: c => Object.assign(c, { mix: 'even', nPlayers: 15, games: 5, finalists: 5 }), tsub: 'まんべんなく・15人' },
  { k: 'strong', icon: '🔥', label: '腕だめし', sub: '強豪ぞろい', p: c => { c.mix = 'strong'; c.opps = [0, 1, 2, 3].map(() => ({ level: 'r', style: 'r' })); }, t: c => Object.assign(c, { mix: 'strong', nPlayers: 15, games: 5, finalists: 5 }), tsub: '強豪ぞろい・15人' },
  { k: 'master', icon: '👑', label: '達人に挑む', sub: '全員★5', p: c => { c.mix = 'master'; c.opps = [0, 1, 2, 3].map(() => ({ level: '5', style: 'r' })); }, t: c => Object.assign(c, { mix: 'master', nPlayers: 15, games: 5, finalists: 5 }), tsub: '全員達人・15人' }
];
const MIX_PRESET = { casual: 'first', even: 'usual', random: 'usual', strong: 'strong', master: 'master' };
const suP = () => { if (!S.suP) { S.suP = JSON.parse(JSON.stringify(store.get('cfgPractice', DEF_P))); while (S.suP.opps.length < 4) S.suP.opps.push({ level: 'r', style: 'r' }); S.suP.preset = S.suP.preset || MIX_PRESET[S.suP.mix] || 'usual'; } return S.suP; };
const suT = () => { if (!S.suT) { S.suT = JSON.parse(JSON.stringify(store.get('cfgTour', DEF_T))); S.suT.preset = S.suT.preset || MIX_PRESET[S.suT.mix] || 'usual'; } return S.suT; };
// マサの合いの手（選んだ内容に反応）
function suMasa(kind) {
  const c = kind === 'tour' ? suT() : suP(), lv = kind === 'tour' ? [] : c.opps.slice(0, c.n - 1).map(o => o.level);
  if (c.preset === 'master') return kind === 'tour' ? '全員達人の大会か！ええ度胸や！謎のシード選手も出てくるかもしれへんで！' : '全員達人か！ええ度胸や！ワールドカップの決勝に乗り込むようなもんやで！';
  if (c.preset === 'strong') return kind === 'tour' ? '強豪ぞろいの大会やな！腕が鳴るで！' : '強豪ぞろいやな！腕だめしにはちょうどええ！';
  if (kind === 'practice' && c.n === 2) return 'サシの勝負や！ポーカーのヘッズアップみたいなもんやで！';
  if (c.preset === 'first') return '肩慣らしにちょうどええな！まずは楽しんでいこか！';
  if (kind === 'practice' && c.games >= 7) return `${c.games}ゲームの長丁場や！スタミナ勝負やで！`;
  return kind === 'tour' ? 'ほな、大会の準備や！どんな相手がおるか楽しみやな！' : 'ほな、卓をつくろか！今日はどの相手と打つ？';
}
const suChip = (su, v, label, on, extra) => `<button class="su-chip ${on ? 'on' : ''}" data-su="${su}" data-v="${esc(String(v))}" ${extra || ''}>${label}</button>`;
const suSeg = (su, opts, cur) => `<div class="su-seg">${opts.map(([v, l]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-su="${su}" data-v="${esc(String(v))}">${l}</button>`).join('')}</div>`;
const suSw = (key, on, label, note) => `<div class="su-row"><div class="su-rl"><b>${label}</b>${note ? `<small>${note}</small>` : ''}</div><button class="su-sw ${on ? 'on' : ''}" data-su="sw" data-v="${key}" role="switch" aria-checked="${on}" aria-label="${esc(label)}"><i></i></button></div>`;
function suPresetHTML(kind) {
  const c = kind === 'tour' ? suT() : suP();
  return `<div class="su-masa"><span class="cm-av">${KB.casterSVG('masa', 'happy')}</span><div class="op-bubble"><span class="cm-name">実況・ナニワのマサ</span>${esc(suMasa(kind))}</div></div>
  <section class="su-block"><div class="su-bh"><span class="su-step-no">1</span><b>相手を選ぶ</b><small>おすすめセットから1つ</small></div>
  <div class="su-presets">${SU_PRESETS.map(p => `<button class="su-preset ${c.preset === p.k ? 'on' : ''}" data-su="preset" data-v="${p.k}" aria-pressed="${c.preset === p.k}"><span class="sp-ic">${p.icon}</span><b>${p.label}</b><small>${kind === 'tour' ? p.tsub : p.sub}</small>${c.preset === p.k ? '<i class="sp-check">✓</i>' : ''}</button>`).join('')}</div></section>`;
}
// 開始ボタンとバッジの対象（🏅／⚠。押すと条件）
function suStartHTML(act, label) {
  return `<div class="su-go"><button class="btn primary su-start" data-act="${act}">${label}</button><details class="su-badge"><summary id="rule-sum">バッジの条件</summary><div class="badge-rule" id="rule-box"></div></details></div>`;
}
// カスタム設定：ゲームのメニュー風。グループごとに開け閉めできる
function suGroup(id, icon, title, now, body) {
  const open = !!(S.suOpen && S.suOpen[id]);
  return `<div class="su-g ${open ? 'open' : ''}"><button class="su-gh" data-su="grp" data-v="${id}" aria-expanded="${open}"><span class="su-gi">${icon}</span><span class="su-gt"><b>${title}</b><small>${now}</small></span><span class="su-ga">${open ? '▲' : '▼'}</span></button>${open ? `<div class="su-gb">${body}</div>` : ''}</div>`;
}
function suCustomHTML(kind, tableGroup) {
  const c = kind === 'tour' ? suT() : suP(), st = S.settings;
  const SPD = { slow: 'ゆっくり', normal: 'ふつう', fast: 'はやい', instant: '一瞬' }, JG = { before: '出す前に表示', after3: '出した後（お手つき3枚）', after2: '出した後（お手つき2枚）' }, CM = { both: '博士とマサ', root: '博士だけ', masa: 'マサだけ', off: 'なし' };
  const fast = st.speed === 'fast' || st.speed === 'instant';
  const groups = [tableGroup,
    suGroup('pace', '⏱️', '対局の進み方', `速さ：${SPD[st.speed] || 'ふつう'}・判定：${JG[st.judge || 'before']}`,
      `<div class="su-row col"><b>AIの手番の速さ</b>${suSeg('speed', Object.entries(SPD), st.speed)}</div>
       <div class="su-row col"><b>計算式の判定</b>${suSeg('judge', Object.entries(JG), st.judge || 'before')}</div>
       ${suSw('warnMiss', !!st.warnMiss, '「引く」の前に確認', '出せるのに引こうとしたら確認する（あえて引くのもOK）')}`),
    suGroup('talk', '🎙️', '実況・解説', `${CM[st.commentary] || '博士とマサ'}${st.spoiler ? '・ネタバレあり' : ''}`,
      `<div class="su-row col"><b>実況・解説</b>${suSeg('cm', Object.entries(CM), st.commentary)}</div>
       ${fast ? '<p class="small muted" style="margin:0">速さが「はやい」「一瞬」のときは、実況は自分の手だけです。</p>' : suSw('cmOthers', st.cmOthers !== false, 'ほかの人の手も実況')}
       ${suSw('spoiler', !!st.spoiler, 'ネタバレありのツッコミ', '実況がAIの手札を知っている前提でツッコむ（「あちゃー、出せたのに！」）')}`),
    suGroup('view', '👁️', '表示とAIの読み', `強さ${st.showLevel ? '表示' : 'かくす'}・性格${st.showStyle ? '表示' : 'かくす'}${st.autoHint ? '・読みを自動' : ''}`,
      `${suSw('showLevel', !!st.showLevel, '相手の強さを表示')}${suSw('showStyle', !!st.showStyle, '相手の性格を表示', 'かくすと、AIの読みも「相手は中級・平均的」と仮定して計算します')}
       ${suSw('autoHint', !!st.autoHint, '自分の番で自動的にAIの読み', 'オンにすると成績のバッジは対象外になります')}`),
    suGroup('snd', '🔊', '効果音', `音量：${(KB.SFX_LEVELS[st.sndLv] || KB.SFX_LEVELS.l)[0]}`, `<div class="su-row col">${suSeg('snd', Object.entries(KB.SFX_LEVELS).map(([k, v]) => [k, v[0]]), st.sndLv)}</div>`),
    suGroup('pts', '🏅', '得点のつけ方', `${c.points.join('・')}点${kind === 'tour' ? '・同点は' + (c.tie === 'sudden' ? 'サドンデス' : 'ジャンケン') : ''}`,
      `${suPointsHTML(kind, c)}
       ${kind === 'tour' ? `<div class="su-row col"><b>同点（得点・PPとも同じ）のとき</b>${suSeg('tie', [['janken', 'ジャンケン'], ['sudden', 'サドンデス']], c.tie)}</div><input type="hidden" id="t-tie" value="${c.tie}">` : ''}`)];
  return `<details class="su-custom" id="su-adv" ${S.suAdv ? 'open' : ''}><summary><span>⚙️ カスタム設定</span><small>ふだんは変えなくてOK</small></summary><div class="su-gs">${groups.join('')}</div></details>`;
}
function setupPracticeHTML() {
  const c = suP(), sts = KB.getStrategy().styles, k = c.n - 1, sel = S.suSeat != null && S.suSeat < k ? S.suSeat : null;
  const pos = i => { const a = Math.PI * (k === 1 ? 0.5 : 0.12 + 0.76 * (i / (k - 1))); return `left:${(50 - 42 * Math.cos(a)).toFixed(1)}%;top:${(52 - 40 * Math.sin(a)).toFixed(1)}%`; };
  const seat = i => { const o = c.opps[i], st = sts.find(x => x.id === o.style); return `<button class="su-seat ${sel === i ? 'on' : ''}" style="${pos(i)};${st ? `--sc:${st.color}` : ''}" data-su="seat" data-v="${i}" aria-label="相手${i + 1}の設定">
    <span class="ss-face">${o.level === 'r' ? '？' : '★' + o.level}</span><small>${o.level === 'r' ? 'おまかせ' : esc(KB.levelCfg(+o.level).label)}</small><small class="ss-st">${st ? esc(st.label) : '性格おまかせ'}</small></button>`; };
  const ed = sel == null ? `<p class="small muted su-hint">席を押すと、その相手の強さと性格を選べます（「おまかせ」はおすすめセットの強さ）</p>` : `<div class="su-seated"><div class="lbl">相手${sel + 1}</div>
    <div class="su-chips">${suChip('lv', 'r', 'おまかせ', c.opps[sel].level === 'r')}${[1, 2, 3, 4, 5].map(l => suChip('lv', l, `★${l} ${esc(KB.levelCfg(l).label)}`, String(c.opps[sel].level) === String(l))).join('')}</div>
    <div class="su-chips">${suChip('st', 'r', '性格おまかせ', c.opps[sel].style === 'r')}${sts.map(x => suChip('st', x.id, esc(x.label), c.opps[sel].style === x.id, `style="--sc:${esc(x.color)}"`)).join('')}</div></div>`;
  const fixed = c.opps.slice(0, k).filter(o => o.level !== 'r' || o.style !== 'r').length;
  const table = suGroup('table', '🪑', '相手をひとりずつ決める', `${c.n}人卓${fixed ? `・${fixed}席を指定` : '・相手はおまかせ'}`,
    `<div class="su-table"><div class="su-felt"></div>${Array.from({ length: k }, (_, i) => seat(i)).join('')}<div class="su-me"><span class="ss-av">${KB.avatarSVG(Object.assign(myAvatar(), { name: S.settings.name }), { mood: 'happy' })}</span><small>${esc(S.settings.name)}</small></div></div>${ed}`);
  const hidden = `<div hidden><input id="p-n" value="${c.n}"><input id="p-games" value="${c.games}"><input id="p-mix" value="${c.mix}">${c.opps.map((o, i) => `<div class="opp-row" data-i="${i}" ${i >= k ? 'hidden' : ''}><select class="o-lv"><option value="${o.level}" selected></option></select><select class="o-st"><option value="${o.style}" selected></option></select></div>`).join('')}</div>`;
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← 戻る</button><div class="where">1セット練習</div><div></div></div>
<div class="su">
${suPresetHTML('practice')}
<section class="su-block"><div class="su-bh"><span class="su-step-no">2</span><b>ゲーム数と人数</b></div>
  <div class="su-pair">
    <div class="su-pi"><small>1セットのゲーム数</small><div class="su-step big"><button class="su-pm" data-su="gstep" data-v="-1" ${c.games <= 1 ? 'disabled' : ''} aria-label="減らす">−</button><span class="su-val"><b>${c.games}</b><small>ゲーム</small></span><button class="su-pm" data-su="gstep" data-v="1" ${c.games >= 10 ? 'disabled' : ''} aria-label="増やす">＋</button></div></div>
    <div class="su-pi"><small>卓の人数（あなたを含む）</small><div class="su-step big"><button class="su-pm" data-su="n" data-v="-1" ${c.n <= 2 ? 'disabled' : ''} aria-label="ひとり減らす">−</button><span class="su-val"><b>${c.n}</b><small>人</small></span><button class="su-pm" data-su="n" data-v="1" ${c.n >= 5 ? 'disabled' : ''} aria-label="ひとり増やす">＋</button></div></div>
  </div></section>
${suStartHTML('start-practice', 'この卓ではじめる')}
${suCustomHTML('practice', table)}
${hidden}
</div>`;
}
function suTourRefresh() {
  const c = Object.assign(suT(), readTourCfg()), sizes = KB.splitTables(c.nPlayers, 5), tb = $('#t-tables');
  if (tb) tb.innerHTML = `${sizes.map(n => `<span class="su-tb"><i>${'●'.repeat(n)}</i><small>${n}人</small></span>`).join('')}<small class="muted">${sizes.length}卓・席順は毎セット抽選・決勝は1セットで順位を決めます</small>`;
  [['tn', c.nPlayers, 5, 40], ['tsets', c.sets, 1, 8], ['tgames', c.games, 1, 10], ['tfin', c.finalists, 2, 5]].forEach(([su, v, mn, mx]) => { const m = $(`[data-su="${su}"][data-v="-1"]`), p = $(`[data-su="${su}"][data-v="1"]`); if (m) m.disabled = v <= mn; if (p) p.disabled = v >= mx; });
  renderEst(); renderRuleBox();
}
// 設定画面のタップ
// 得点のつけ方：よく使う形から選ぶ＋順位ごとに −＋ で調整（値は隠しの入力欄にも入れて、開始のときに読む）
const PTS_PRE = [['std', '標準', [10, 8, 5, 2, 0]], ['top', '1位重視', [10, 5, 2, 0, 0]], ['flat', 'なだらか', [4, 3, 2, 1, 0]]];
function suPointsHTML(kind, c) {
  const n = kind === 'tour' ? 5 : c.n, pts = [...Array(n)].map((_, i) => c.points[i] || 0), cur = PTS_PRE.find(([, , a]) => a.slice(0, n).join() === pts.join());
  return `<div class="su-row col"><b>セット順位の得点</b><div class="su-ptspre">${suSeg('ptspre', PTS_PRE.map(([k, l, a]) => [k, `${l}<small>${a.slice(0, n).join('・')}</small>`]), cur ? cur[0] : '')}</div>
    <div class="su-pts">${pts.map((v, i) => `<div class="su-pt"><span class="su-pt-r">${i + 1}位</span><button class="su-pm sm" data-su="pt" data-v="${i}:-1" ${v <= 0 ? 'disabled' : ''} aria-label="${i + 1}位の得点を減らす">−</button><b class="tnum">${v}</b><button class="su-pm sm" data-su="pt" data-v="${i}:1" ${v >= 20 ? 'disabled' : ''} aria-label="${i + 1}位の得点を増やす">＋</button><small>点</small></div>`).join('')}</div>
    ${pts.some((v, i) => i && v > pts[i - 1]) ? '<small class="su-warn">⚠ 下の順位のほうが得点が高くなっています</small>' : ''}
    <input type="hidden" id="${kind === 'tour' ? 't' : 'p'}-points" value="${pts.join(',')}"></div>`;
}
function suTap(d) {
  const tour = S.view === 'setup-tour', c = tour ? suT() : suP(), v = d.v;
  if (!tour) { const pts = $('#p-points'); if (pts) c.points = readPoints(pts.value); } else Object.assign(c, readTourCfg());
  const st = S.settings, save = () => store.set('settings', st);
  switch (d.su) {
    case 'preset': { const p = SU_PRESETS.find(x => x.k === v); if (p) { (tour ? p.t : p.p)(c); c.preset = v; S.suSeat = null; } break; }
    case 'n': c.n = Math.max(2, Math.min(5, c.n + (+v))); break;
    case 'seat': S.suSeat = S.suSeat === +v ? null : +v; break;
    case 'lv': if (S.suSeat != null) c.opps[S.suSeat].level = String(v); break;
    case 'st': if (S.suSeat != null) c.opps[S.suSeat].style = v; break;
    case 'games': c.games = +v; break;
    case 'gstep': c.games = Math.max(1, Math.min(10, c.games + (+v))); break;
    case 'tn': c.nPlayers = Math.max(5, Math.min(40, c.nPlayers + (+v))); break;
    case 'tsets': c.sets = Math.max(1, Math.min(8, c.sets + (+v))); break;
    case 'tgames': c.games = Math.max(1, Math.min(10, c.games + (+v))); break;
    case 'tfin': c.finalists = Math.max(2, Math.min(5, c.finalists + (+v))); break;
    case 'tie': c.tie = v; break;
    case 'ptspre': { const p = PTS_PRE.find(x => x[0] === v); if (p) c.points = p[2].slice(); break; }
    case 'pt': { const [i, dv] = String(v).split(':').map(Number), a = [...Array(Math.max(5, c.points.length))].map((_, k) => c.points[k] || 0); a[i] = Math.max(0, Math.min(20, a[i] + dv)); c.points = a; break; }
    case 'grp': S.suOpen = S.suOpen || {}; S.suOpen[v] = !S.suOpen[v]; break;
    case 'speed': if (S.attack) break; st.speed = v; save(); break;
    case 'judge': st.judge = v; st.judgeSet = true; save(); break;
    case 'cm': st.commentary = v; save(); break;
    case 'snd': setSnd(v); break;
    case 'sw': if (v === 'cmOthers') st.cmOthers = st.cmOthers === false; else st[v] = !st[v]; save(); KB.sfx('click'); break;
  }
  const y = window.scrollY; render(); window.scrollTo(0, y);
}

// 計算式の判定タイミング：出す前に表示（いまの方式）／出した後に判定（不成立ならお手つき）
function judgeHTML() {
  const j = S.settings.judge || 'before';
  return `<div class="field"><label>計算式の判定</label><select class="set-judge">${[['before', '出す前に成立するか表示する'], ['after3', '出した後に判定（不成立はお手つき：3枚引く）'], ['after2', '出した後に判定（不成立はお手つき：2枚引く）']].map(([k, v]) => `<option value="${k}" ${j === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
}
// 効果音の音量：なし／小／中／大／最大
const SPD_ORDER = ['slow', 'normal', 'fast', 'instant'], SPD_JA = { slow: 'ゆっくり', normal: 'ふつう', fast: 'はやい', instant: '一瞬' };
const SPD_IC = { slow: '🐢', normal: '🚶', fast: '🏃', instant: '⚡' }, SND_IC = { off: '🔇', s: '🔈', m: '🔉', l: '🔊', xl: '📢' };
const spdLabel = () => SPD_IC[S.settings.speed] || '🚶'; // 対局画面の上はアイコンだけ（場所をとらない）
const sndIcon = () => SND_IC[S.settings.sndLv] || '🔊';
const sndLabel = () => '音：' + (KB.SFX_LEVELS[S.settings.sndLv] || KB.SFX_LEVELS.l)[0];
function setSnd(k) {
  S.settings.sndLv = k; S.settings.sound = k !== 'off'; store.set('settings', S.settings); KB.sfxLevel(k);
  KB.sfx('click');
  document.querySelectorAll('.snd-btn').forEach(b => { b.textContent = sndIcon(); b.title = b.ariaLabel = sndLabel(); });
  const sel = document.getElementById('set-snd'); if (sel && sel.value !== k) sel.value = k;
}
// ボタンを押したときの音（出す・引く・カードなど、専用の音があるものは除く）
if (typeof document !== 'undefined') document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button, summary, .btn'); if (!b || b.disabled) return;
  if (b.dataset.card != null) return;
  const a = b.dataset.act || '';
  if (/^(play|sound|draw)$/.test(a)) return;
  if (b.dataset.go === 'home' || /^(quit|close|draw-no|clear|back-summary)$/.test(a) || /戻る|閉じる|やめる/.test(b.textContent)) KB.sfx('back');
  else if (/^start|next|opening-start|win-ok|draw-yes|final|tb-/.test(a) || b.classList.contains('primary')) KB.sfx('confirm');
  else KB.sfx('click');
}, true);
const judgeAfter = () => (S.settings.judge || 'before') !== 'before';
const foulN = () => S.settings.judge === 'after2' ? 2 : 3;
function setupTourHTML() {
  const c = suT(), sizes = KB.splitTables(c.nPlayers, 5);
  const step = (su, id, val, min, max, label) => `<div class="su-row"><div class="su-rl"><b>${label}</b></div><div class="su-step"><button class="su-pm" data-su="${su}" data-v="-1" ${val <= min ? 'disabled' : ''} aria-label="減らす">−</button><input id="${id}" type="number" min="${min}" max="${max}" value="${val}" inputmode="numeric" aria-label="${esc(label)}"><button class="su-pm" data-su="${su}" data-v="1" ${val >= max ? 'disabled' : ''} aria-label="増やす">＋</button></div></div>`;
  const tables = `<div class="su-tables" id="t-tables" aria-label="卓分け">${sizes.map(n => `<span class="su-tb"><i>${'●'.repeat(n)}</i><small>${n}人</small></span>`).join('')}<small class="muted">${sizes.length}卓・席順は毎セット抽選・決勝は1セットで順位を決めます</small></div>`;
  const size = suGroup('size', '🏟️', '大会の規模', `${c.nPlayers}人・${sizes.length}卓・${c.games}ゲーム・決勝${c.finalists}人`,
    `${step('tn', 't-n', c.nPlayers, 5, 40, '参加人数（あなたを含む）')}${step('tgames', 't-games', c.games, 1, 10, '1セットのゲーム数')}${step('tfin', 't-fin', c.finalists, 2, 5, '決勝に進める人数')}${tables}`);
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← 戻る</button><div class="where">大会モード</div><div></div></div>
<div class="su">
${suPresetHTML('tour')}
<section class="su-block"><div class="su-bh"><span class="su-step-no">2</span><b>予選のセット数</b><small>決勝は1セット</small></div>
  <div class="su-step big"><button class="su-pm" data-su="tsets" data-v="-1" ${c.sets <= 1 ? 'disabled' : ''} aria-label="減らす">−</button><span class="su-val"><input id="t-sets" type="number" min="1" max="8" value="${c.sets}" inputmode="numeric" aria-label="予選のセット数"><small>セット</small></span><button class="su-pm" data-su="tsets" data-v="1" ${c.sets >= 8 ? 'disabled' : ''} aria-label="増やす">＋</button></div>
  <details class="est-box est-tg" id="t-est-wrap" ${S.estOpen ? 'open' : ''}><summary><b>決勝進出率の目安</b><span class="est-hint">押すと開く</span></summary><div id="t-est" aria-live="polite"></div></details></section>
${suStartHTML('start-tour', '大会を開始')}
${suCustomHTML('tour', size)}
<input type="hidden" id="t-mix" value="${c.mix}">
</div>`;
}

// ---------- ゲーム開始 ----------
function startSet() { S.T.setT0 = Date.now(); S.T.pbSnap = rvSnap(); seatSet(S.T); S.T.game = 1; S.T.setLog = []; S.T.setFouls = 0; S.T.setHinted = false; startGame(); setTimeout(introStars, 3600); }
// 自分の卓に★5（二つ名つき）がいたら、実況が紹介する
function introStars() {
  const T = S.T; if (!T || S.view !== 'game' || !S.settings.commentary || S.settings.commentary === 'off') return;
  const tb = (T.tables && T.tables[T.myTable]) || [];
  const stars = tb.map(id => T.players.find(p => p.id === id)).filter(p => p && !p.human && p.ch && p.ch.charId && p.level >= 5);
  if (!stars.length) return;
  const p = stars[(Math.random() * stars.length) | 0], t = p.ch.title || '達人', n = p.ch.name;
  const L = [
    { root: `この卓には「${t}」${san(n)}がいます。強い人ほど、セリフから手の内は読めません。`, masa: `出たで、「${t}」${n}や！ 何考えとるか、さっぱり分からんで！` },
    { root: `「${t}」の${san(n)}。ポーカーフェイスの相手には、見えている札から読むしかありません。`, masa: `うわっ、「${t}」${n}と同じ卓や！ 気ぃ引き締めていこか！` }
  ];
  sayInsight(L[(Math.random() * L.length) | 0], 'normal'); renderGame();
}
function startGame() {
  const T = S.T;
  S.gameT0 = Date.now(); S.pbSnap = rvSnap(); S.lastFacts = null;
  const ids = S.tiebreak ? S.tiebreak.ids : T.tables[T.myTable];
  const players = ids.map(id => P(id));
  const starter = S.tiebreak ? (Math.random() * ids.length) | 0 : starterFor(ids, T.game);
  S.game = new KB.Game(players, starter);
  KB.kanataRoll(S.game);
  S.gameHinted = false; S.undoSnap = S.undoCur = null; S.undoRetry = false;
  if (!S.tiebreak) T.live = null;
  S.gameNo = (S.gameNo || 0) + 1;
  S.sel = []; S.hint = null; S.decisions = []; S.bubbles = {}; S.thinking = null; S.justActed = null; S.winShow = null; S.holdTurn = null; S.roundHeld = false; S.showRound = false; S.confirmDraw = false; S.ask = null; S.lastField = null; S.fouls = [];
  S.qual = (!S.tiebreak && T.cfg.kind === 'tournament' && T.phase === 'prelim') ? qualifyTable(T) : null;
  S.cm = null; S.cmHoldUntil = 0; S.flowHoldUntil = 0;
  const bn = T.watch ? watchBanner(T) : bannerFor(T);
  S.bigBanner = bn ? Object.assign(bn, { shown: false }) : null;
  S.introUntil = bn && S.settings.speed !== 'instant' ? Date.now() + 2900 : 0;
  S.reshuffleSeen = 0; S.deckLowSaid = false;
  if (bn) say(bn.say, bn.sayData || {}); else startComment(T);
  if (!S.tiebreak) saveSession();
  go('game');
  loop();
}
// ---------- 暫定順位（予選）：確定した得点＋進行中セットの卓内順位ぶんの得点 ----------
function provisional(T) {
  const pts = {}, pp = {};
  T.players.forEach(p => { pts[p.id] = T.points[p.id]; pp[p.id] = T.totPP[p.id]; });
  if (T.phase === 'prelim') T.tables.forEach(t => {
    if (!(T.setPP[t[0]] || []).length) return;
    const rk = KB.rankByPP(t.map(id => setTotal(T, id)));
    t.forEach((id, i) => { pts[id] += T.cfg.points[rk[i]] || 0; });
  });
  const order = T.players.map(p => p.id).sort((a, b) => pts[b] - pts[a] || pp[a] - pp[b] || a - b);
  const rank = {}; order.forEach((id, i) => { rank[id] = i + 1; });
  const F = T.cfg.finalists; const lineId = order[F - 1];
  return { pts, pp, order, rank, line: pts[lineId], gap: Math.max(0, pts[lineId] - pts[0] + (pts[lineId] === pts[0] && rank[0] > F ? 1 : 0)) };
}
function isPrelimTour() { const T = S.T; return T && T.cfg.kind === 'tournament' && T.phase === 'prelim' && !S.tiebreak; }
function borderHTML() {
  if (!isPrelimTour()) return '';
  const T = S.T, pv = provisional(T), F = T.cfg.finalists, rk = pv.rank[0], inZone = rk <= F;
  const started = (T.setPP[0] || []).length > 0 || T.set > 1;
  return `<div class="borderbar ${inZone ? 'in' : 'out'}"><span>暫定 <b>${rk}位</b>（${pv.pts[0]}点）</span><span>決勝ライン${F}位 <b>${pv.line}点</b></span><span class="bb-st">${!started ? 'これから' : inZone ? '圏内' : `あと${pv.gap}点`}</span></div>`;
}
// 実況・解説
// ゲーム開始時の実況：ボーダー・セット内の位置・通常の開始から選ぶ
function startComment(T) {
  const g = S.game, me = g.players.findIndex(p => p.human);
  const mypp = g.hands[me].reduce((s, c) => s + c.v, 0), dk = g.deck.length;
  const opts = [['start', { g: T.game, dk, mypp }, 1]];
  if (isPrelimTour() && (T.set > 1 || T.game > 1)) {
    const pv = provisional(T), rk = pv.rank[0], dd = pv.gap;
    const kind = rk <= T.cfg.finalists ? 'borderIn' : dd <= 2 ? 'borderClose' : dd >= 10 ? 'borderFar' : 'border';
    opts.push([kind, { rk, d: dd }, 1.3]);
  }
  if (!S.tiebreak && T.game > 1) {
    const ids = T.tables[T.myTable], mine = setTotal(T, 0), others = ids.filter(id => id !== 0).map(id => setTotal(T, id));
    if (others.every(x => mine < x)) opts.push(['leadSet', {}, 1]);
    else if (others.every(x => mine > x)) opts.push(['trailSet', {}, 1]);
  }
  const tw = opts.reduce((s, o) => s + o[2], 0); let x = Math.random() * tw;
  for (const o of opts) { x -= o[2]; if (x <= 0) { say(o[0], o[1]); return; } }
}
// 新しい巡の実況：場の数の大きさ・特別な数・山札の状況
function tableKind(g, me) {
  const prev = g.log.filter(e => e.round === g.round - 1 && (e.type === 'play' || e.type === 'draw'));
  const sizes = g.hands.map(h => h.length);
  const lo = Math.min(...sizes), hi = Math.max(...sizes);
  const others = sizes.map((s, i) => ({ s, i })).sort((a, b) => a.s - b.s);
  if (others[0].s <= 2 && others[1].s >= others[0].s + 4) { const i = others[0].i; return ['tableRunaway', { n: i === me ? 'あなた' : san(nm(g.players[i])), h: others[0].s }]; }
  if (prev.length >= 3) {
    const draws = prev.filter(e => e.type === 'draw').length, plays = prev.filter(e => e.type === 'play');
    if (draws / prev.length >= 0.6) return ['tableStuck', {}];
    if (plays.length >= 3 && plays.filter(e => e.vals.length === 3).length / plays.length >= 0.6) return ['tableAggressive', {}];
    if (plays.length >= 2 && plays.reduce((s, e) => s + e.vals.length, 0) / plays.length <= 1.6) return ['tableDefensive', {}];
  }
  const avg = sizes.reduce((s, x) => s + x, 0) / sizes.length;
  if (avg >= 8) return ['tableHeavy', { avg: avg.toFixed(1) }];
  if (hi - lo <= 1 && hi <= 4 && g.round >= 2) return ['tableClose', { lo, hi }];
  return null;
}
function roundComment(g) {
  const me = g.players.findIndex(p => p.human), t = g.field.v;
  const rs = g.log.filter(e => e.type === 'reshuffle').length;
  if (rs > (S.reshuffleSeen || 0)) { S.reshuffleSeen = rs; S.deckLowSaid = false; KB.sfx('shuffle'); say('reshuffle', {}); return; }
  if (g.deck.length <= 5 && !S.deckLowSaid) { S.deckLowSaid = true; say('deckLow', { k: g.deck.length }); return; }
  // 卓全体を見渡したひと言（直前の巡の動き・手札の枚数）
  if (Math.random() < 0.4) { const tk = tableKind(g, me); if (tk) { say(tk[0], tk[1]); return; } }
  if (Math.random() > 0.5) { const q = Math.random(); if (q < 0.12) say('tip', {}); else if (q < 0.18 && S.settings.commentary !== 'masa') say('philo', {}); return; }
  let kind = t <= 3 ? 'roundSmall' : t >= 10 ? 'roundBig' : 'roundMid';
  if ((t === 1 || t === 13 || t === 7) && Math.random() < 0.4) kind = 'field' + t;
  say(kind, { r: g.round, t, c: g.unseenCounts(me)[t] });
}
// 実況：出来事の直後にすぐ表示し、ゲームの進行の方が「読む時間」だけ待つ
function readMs(c) {
  if (!c || S.settings.speed === 'instant') return 0;
  const f = S.settings.speed === 'fast' ? 0.7 : S.settings.speed === 'slow' ? 1.3 : 1;
  return Math.min(6500, Math.max(2200, 900 + c.text.length * 110)) * f;
}
// 次の手番に進む前に待つ時間（実況は次の人の「考え中」の間も表示され続けるので、読む時間の一部だけ待つ）
// 実況が自分の手だけ（速さ「はやい」「一瞬」、または他のプレイヤーへの実況「しない」）のときは、
// 読み終わるまで進行を止めない（実況は表示したまま、AIは続けて打つ）
const selfOnlyCm = () => S.settings.speed === 'fast' || S.settings.speed === 'instant' || S.settings.cmOthers === false;
// 進行を止めるまでの時刻：自分のみ実況のときは、お手つき・再開などの演出（flowHoldUntil）だけ待つ
const holdEnd = () => selfOnlyCm() ? (S.flowHoldUntil || 0) : Math.max(S.cmHoldUntil || 0, S.flowHoldUntil || 0);
function holdMs(c) {
  if (!c || S.settings.speed === 'instant') return 0;
  const f = (S.settings.speed === 'fast' ? 0.7 : S.settings.speed === 'slow' ? 1.3 : 1) * (S.spectate && c.kind !== 'insight' ? 0.8 : 1); // 観戦：ふつうの実況は少し短く、違いの解説はじっくり
  return Math.min(3800, Math.max(1200, 700 + c.text.length * 70)) * f;
}
// 速さが「はやい」「一瞬」のときは、自分に関する実況だけにする（他の人の実況は流れが速すぎて読めないため）
const SELF_KINDS = { atkStart: 1, atkHalf: 1, atk5: 1, atk1: 1, atkSet: 1, missLucky: 1, bigWait: 1, almostWinBig: 1, almostWin: 1, foul: 1, good: 1, ok: 1, bad: 1, drewGood: 1, streak: 1, myReach: 1, myHeavy: 1, myBigPP: 1, mySmallPP: 1, resultLucky: 1, resultUnlucky: 1, resultBoth: 1, resultBad: 1 };
// 計算した事実から作った解説を出す（掛け合いのときは博士が多め）
function sayInsight(x, mood) {
  if (!x) return;
  const mode = S.settings.commentary; if (!mode || mode === 'off') return;
  const who = mode === 'both' ? (Math.random() < 0.6 ? 'root' : 'masa') : mode === 'masa' || mode === 'tetsu' ? 'masa' : 'root';
  const c = { who, text: x[who], prio: 4, kind: 'insight', mood: mood || 'normal', at: Date.now() };
  S.cm = c; S.cmHoldUntil = Date.now() + holdMs(c);
}
function say(kind, d) {
  if (S.settings.cmOthers === false && d && d.n && d.n !== 'あなた') return; // 他のプレイヤーへの実況をしない設定
  if ((S.settings.speed === 'fast' || S.settings.speed === 'instant') && !SELF_KINDS[kind] && !(d && d.n === 'あなた')) return;
  const c = KB.commentLine(S.settings.commentary, kind, d || {});
  if (!c) return;
  const cur = S.cm, now = Date.now();
  // 自分のみ実況のときは、自分の手への解説を読み終わるまで、他の話題で上書きしない
  if (selfOnlyCm() && !SELF_KINDS[kind] && cur && (SELF_KINDS[cur.kind] || cur.kind === 'insight') && now < (S.cmHoldUntil || 0)) return;
  // 同じ出来事で複数の発言候補が出た場合は優先度の高い方（直前0.6秒以内）
  if (cur && now - cur.at < 600 && cur.prio > c.prio) return;
  c.at = now; S.cm = c;
  S.cmHoldUntil = now + holdMs(c);
}
function cmHTML() {
  if (!S.settings.commentary || S.settings.commentary === 'off') return null;
  const c = S.cm; const who = c ? c.who : (S.settings.commentary === 'masa' || S.settings.commentary === 'tetsu' ? 'masa' : 'root');
  const fresh = c && Date.now() - c.at < 500;
  return `<div class="commentary ${fresh ? 'fresh' : ''}" data-key="${c ? c.at + ':' + c.who : 'idle-' + who}"><div class="cm-av">${KB.casterSVG(who, c ? c.mood : 'normal')}</div><div class="cm-body"><span class="cm-name">${esc(KB.CASTERS[who].role)}・${esc(KB.CASTERS[who].name)}</span><span class="cm-text">${esc(c ? yo(c.text) : '実況席から見守ります。')}</span></div></div>`;
}
function bannerFor(T) {
  if (S.tiebreak || T.cfg.kind !== 'tournament') return null;
  const pvTxt = () => { const pv = provisional(T); const F = T.cfg.finalists; return pv.rank[0] <= F ? `あなたは暫定${pv.rank[0]}位・決勝圏内` : `あなたは暫定${pv.rank[0]}位・決勝ラインまであと${pv.gap}点`; };
  if (T.phase === 'prelim' && T.set === T.cfg.sets && T.game === 1 && T.cfg.sets > 1) return { title: '運命の最終セット', sub: `第${T.set}セット開始・第${T.myTable + 1}卓（${T.tables[T.myTable].length}人）／${pvTxt()}`, say: 'finalSet' };
  if (T.phase === 'prelim' && T.game === 1) return { title: `第${T.set}セット開始`, sub: T.set === 1 ? `席は抽選で決まりました。あなたは第${T.myTable + 1}卓（${T.tables[T.myTable].length}人）` : `席替えで第${T.myTable + 1}卓（${T.tables[T.myTable].length}人）へ／${pvTxt()}`, say: 'setStart', sayData: { s: T.set, tb: T.myTable + 1 } };
  if (T.phase === 'prelim' && T.set === T.cfg.sets && T.game === T.cfg.games && T.cfg.games > 1) return { title: '予選 最終ゲーム', sub: pvTxt(), say: 'lastGame' };
  if (T.phase === 'final' && T.game === 1) return { title: '決勝戦 開幕', sub: 'このセットのPPだけで優勝が決まる', say: 'final' };
  if (T.phase === 'final' && T.game === T.cfg.games && T.cfg.games > 1) { const r = T.finalists.slice().sort((a, b) => (T.finalPP[a] || 0) - (T.finalPP[b] || 0)).indexOf(0) + 1; return { title: '決勝 最終ゲーム', sub: `あなたは現在${r}位`, say: 'lastGame' }; }
  return null;
}
// 1ゲーム目はランダム、2ゲーム目以降は前のゲームでPPが一番多かった人から（同点はランダム）
function starterFor(ids, game) {
  const T = S.T;
  if (game <= 1) return (Math.random() * ids.length) | 0;
  const prev = ids.map(id => (T.setPP[id] || [])[game - 2]);
  if (prev.some(x => x == null)) return (Math.random() * ids.length) | 0;
  const mx = Math.max(...prev);
  const top = ids.map((_, i) => i).filter(i => prev[i] === mx);
  return top[(Math.random() * top.length) | 0];
}
// 保存されたセッションで、今のゲームがもう終わっているか（ゲーム終了の直後に中断した場合）
function gameFinished(T) { return ((T.setPP && T.setPP[0]) || []).length >= T.game; }
function resumeLabel(sv) { if (liveUsable(sv)) return `第${sv.game}ゲーム 第${sv.live.g.round}巡`; const done = gameFinished(sv); return done && sv.game >= sv.cfg.games ? 'セット結果' : `第${sv.game + (done ? 1 : 0)}ゲーム`; }
// ゲーム途中の盤面も保存しておき、中断（アップデートを含む）から途中で再開できるようにする
function saveLive() {
  if (S.attack) return;
  const g = S.game, T = S.T; if (!g || !T || S.tiebreak || g.over) return;
  if (S.liveKey === S.gameNo + ':' + g.log.length) return; // 変化がなければ書かない
  S.liveKey = S.gameNo + ':' + g.log.length;
  const o = {}; for (const k in g) if (k !== 'players') o[k] = g[k];
  o.playerIds = g.players.map(p => p.id);
  T.live = { set: T.set, game: T.game, phase: T.phase, g: o, gameHinted: !!S.gameHinted, decisions: S.decisions, fouls: S.fouls || [], bestStreak: S.bestStreak || 0, at: Date.now() };
  try { saveSession(); } catch (e) { }
}
function liveUsable(T) { const L = T && T.live; return !!(L && L.set === T.set && L.game === T.game && L.phase === T.phase && !gameFinished(T)); }
function restoreLive() {
  const T = S.T, L = T.live;
  const g = Object.assign(Object.create(KB.Game.prototype), L.g);
  g.players = L.g.playerIds.map(id => P(id)); delete g.playerIds;
  S.game = g; S.undoSnap = S.undoCur = null; S.undoRetry = false;
  S.gameNo = (S.gameNo || 0) + 1;
  S.sel = []; S.hint = null; S.decisions = L.decisions || []; S.bubbles = {}; S.thinking = null; S.justActed = null; S.winShow = null; S.holdTurn = null; S.roundHeld = false; S.showRound = false; S.confirmDraw = false; S.ask = null; S.lastField = g.field; S.fouls = L.fouls || []; S.bestStreak = L.bestStreak || 0; S.gameHinted = !!L.gameHinted;
  S.qual = (T.cfg.kind === 'tournament' && T.phase === 'prelim') ? qualifyTable(T) : null;
  S.cm = { who: 'masa', text: `第${g.round}巡の途中から再開や！続きいこか！`, prio: 5, kind: 'resume', mood: 'happy', at: Date.now() };
  if (S.settings.commentary === 'root') S.cm = { who: 'root', text: `第${g.round}巡の途中から再開します。`, prio: 5, kind: 'resume', mood: 'normal', at: Date.now() };
  if (!S.settings.commentary || S.settings.commentary === 'off') S.cm = null;
  S.cmHoldUntil = Date.now() + 1500; S.flowHoldUntil = S.cmHoldUntil;
  S.bigBanner = null; S.introUntil = 0; S.roundStart = 0; S.dealDur = 0;
  S.reshuffleSeen = g.log.filter(e => e.type === 'reshuffle').length; S.deckLowSaid = false;
  S.liveKey = S.gameNo + ':' + g.log.length;
  go('game');
  loop();
}
function saveSession() { if (S.attack || S.spectate) return; if (S.T && !S.T.done) store.set('session', S.T); }

// 巡の最後の人のアクションが落ち着いてから、ほんの少し間をおいて次の場札と「第N巡」を出す
// 一時停止できるタイマー：順位表を見ている間などは、時間が来ても進めずに保留する
function pt(fn, ms) { return setTimeout(() => { if (S.paused) { S.resumeFn = fn; return; } fn(); }, ms); }
function pauseGame() { if (S.view !== 'game' || S.paused) return; S.paused = Date.now(); S.resumeFn = null; }
function resumeGame() {
  if (!S.paused) return;
  const dt = Date.now() - S.paused; const t0 = S.paused; S.paused = 0;
  // 止まっていた時間ぶん、実況を読む時間や巡の表示時間を延ばす
  if (S.cmHoldUntil > t0) S.cmHoldUntil += dt;
  if (S.flowHoldUntil > t0) S.flowHoldUntil += dt;
  if (S.introUntil > t0) S.introUntil += dt;
  if (S.turnStart) S.turnStart += dt; if (S.stateTs) S.stateTs += dt; // 止まっていた時間は考える時間に入れない
  if (S.roundStart) S.roundStart += dt;
  const fn = S.resumeFn; S.resumeFn = null;
  if (fn && S.view === 'game') fn();
}
function afterAction(r0) {
  const g = S.game; if (!g) return;
  if (!S.showRound) { loop(); return; }
  const base = SPEED[S.settings.speed] || 1200;
  clearTimeout(S.timer);
  const roundDelay = base === 30 ? 30 : Math.max(550 + base * 0.25, holdEnd() - Date.now());
  S.timer = pt(() => { S.showRound = false; roundComment(g); renderGame(); loop(); }, roundDelay);
}
function loop() {
  clearTimeout(S.timer);
  if (S.paused) { S.resumeFn = loop; return; }
  const g = S.game; if (!g || S.view !== 'game') return;
  if (g.over) { S.timer = pt(onGameOver, 500); return; }
  saveLive();
  if (S.introUntil && Date.now() < S.introUntil) { S.timer = pt(loop, S.introUntil - Date.now()); return; }
  const p = g.current(); const pl = g.players[p];
  const base = SPEED[S.settings.speed] || 1200;
  // 「第N巡」の表示が終わるまでは黄色枠を前の巡の最後の人に残し、間をおいてから1番目へ
  if (g.pos === 0 && base > 30) {
    const wait = Math.max(1700, base * 1.2) + (S.dealDur || 0) * 0.85 - (Date.now() - (S.roundStart || 0));
    if (wait > 0) { S.timer = pt(loop, wait); return; }
  }
  // 実況を読む時間を確保してから、ターン終了（黄色枠を次の人へ）
  { const he = holdEnd(); if (he && Date.now() < he) { S.timer = pt(loop, he - Date.now()); return; } }
  if (S.holdTurn != null) { S.holdTurn = null; S.roundHeld = false; renderGame(); }
  if (pl.human && !S.spectate) {
    const tk = S.gameNo + ':' + g.round + ':' + g.pos; if (S.chimeKey !== tk) { S.chimeKey = tk; S.turnStart = Date.now(); KB.sfx('myturn'); }
    if (Math.random() < 0.08 && (!S.cm || Date.now() - S.cm.at > 5000)) { say('tip', {}); renderGame(); }
    if (S.settings.autoHint && !S.hint) S.timer = setTimeout(() => computeHint(), 50);
    return;
  }
  // 考え中の表示 → 性格・強さ・迷いどころに応じた時間をおいて打つ
  const lv = KB.levelCfg(pl.level);
  const nOpts = KB.findMoves(g.counts(p), g.field.v, lv.ops, lv.maxCards).length;
  const styleF = { gangan: 0.65, inochi: 1.1, iroiro: 0.55 + Math.random() * 0.9, keisan: 1.35 }[pl.style] || 1;
  const levelF = [1.35, 1.2, 1.0, 0.95, 1.1, 1.2][(pl.level || 3) - 1];
  const optF = nOpts === 0 ? 1.15 : 0.85 + Math.min(nOpts, 12) * 0.03;
  const think = base === 30 ? 30 : base * styleF * levelF * optF * (0.8 + Math.random() * 0.4);
  if (KB.kanataReady(g, p)) { // 奥義・絶対透視
    KB.kanataStart(g); if (S.T && S.T.phase === 'final') S.T.kanataClear = true;
    // 大きな演出はそのセットの最初の1回だけ。2回目からは軽く光るだけ
    const setKey = S.T ? (S.T.phase || '') + ':' + (S.T.set || 0) : 'p', first = S.toushiSet !== setKey; S.toushiSet = setKey;
    S.thinking = p; if (first) { toushiFx(g, p); say('kanataOn', { n: nm(pl) }); } else { toushiLite(g, p); say('kanataAgain', { n: nm(pl) }); }
    renderGame();
    S.timer = pt(loop, S.settings.speed === 'instant' ? 30 : first ? 3300 : 1100); return;
  }
  S.thinking = p; renderGame();
  S.timer = pt(() => {
    const r0 = g.round;
    const m = KB.aiMove(g, p, ctxFor(p));
    const wd = S.spectate ? watchDiff(g, p, m) : null; // 観戦：★4以下の人と達人の読みの違い
    const before = g.hands[p].length;
    const kind = m ? (before - m.vals.length === 0 ? 'win' : before - m.vals.length <= 2 ? 'reach' : m.n === 3 ? 'play3' : 'play') : 'draw';
    if (kind === 'win' || Math.random() < KB.charTalkRate(pl) * (kind === 'play' ? 0.6 : 1.2)) { const hl = g.hands[p].filter(c => !(m && m.vals.includes(c.v))); S.bubbles[pl.id] = { text: KB.charLine(pl, kind, { h: before - (m ? m.vals.length : -1), big: hl.filter(c => c.v >= 10).length }), at: Date.now() }; }
    const tAct = Date.now();
    const spoil = S.settings.spoiler ? spoilerCheck(g, p, m) : null;
    g.apply(m);
    if (wd && !g.over) { sayInsight(wd, 'worried'); if (S.cm) S.cm.prio = 8; } // 観戦：違いの解説を、ほかの実況より優先
    if (!g.over) {
      const nmS = san(nm(pl)), h = g.hands[p].length;
      const meI = g.players.findIndex(x => x.human);
      if (m) {
        const pv = m.vals, sm = pv.filter(v => v <= 3).length;
        const p3 = { n: nmS, e: m.expr, checks: true, bigOk: pv.some(v => v >= 10), smallOk: sm >= 2, countOk: true, winOk: h <= 3, flexOk: true };
        const dp = divPraise(m.expr, m.n);
        if (h <= 2) setTimeout(() => KB.sfx('reach'), 420);
        if (dp) say(dp, { n: nmS, e: m.expr });
        else if (h <= 2) say('reach', { n: nmS, h, mypp: g.hands[meI].reduce((s, c) => s + c.v, 0) });
        else if (m.n === 3) say('play3', p3);
        else if (m.expr.includes('×') && !trivialMul(m.expr) && Math.random() < 0.35) say('mul', { n: nmS });
        else if (m.n === 2 && Math.random() < 0.25) say('play2', { n: nmS, e: m.expr });
        else if (m.n === 1 && Math.random() < 0.2) say('play1', { n: nmS, t: g.field.v });
        // 性格・強さにちなんだひと言（表示している時だけ）
        if (S.settings.showStyle && Math.random() < 0.15) say('style' + pl.style.charAt(0).toUpperCase() + pl.style.slice(1), { n: nmS, checks: true, bigOk: m.vals.some(v => v >= 10), countOk: m.n === 3, smallOk: false, winOk: false, flexOk: true });
        if (S.settings.showLevel && pl.level >= 5 && Math.random() < 0.12) say('master', { n: nmS });
        if (spoil && spoil.kind && Math.random() < 0.45) say(spoil.kind, Object.assign({ n: nmS, ex: spoil.ex }, spoil.f || {}));
        else if (Math.random() < 0.1) say('vague', { n: nmS });
      } else {
        let k = 0; for (let j = g.log.length - 1; j >= 0; j--) { const e = g.log[j]; if (e.p !== p) continue; if (e.type === 'draw') k++; else break; }
        const lastDraw = [...g.log].reverse().find(e => e.type === 'draw' && e.p === p);
        if (spoil && spoil.kind === 'oppMissed' && Math.random() < 0.45) say('oppMissed', { n: nmS, ex: spoil.ex });
        else if (k >= 2) say('drawStreak', { n: nmS, k, couldPlay: lastDraw && lastDraw.missed });
        else if (h >= 10) say('heavy', { n: nmS, h });
        else if (Math.random() < 0.55) say('draw', { n: nmS, h, t: lastDraw ? lastDraw.t : null, couldPlay: lastDraw && lastDraw.missed });
      }
    }
    if (g.round !== r0 && !g.over) { S.holdTurn = p; S.showRound = true; S.roundHeld = true; }
    else if (!g.over && S.cm && S.cm.at >= tAct) S.holdTurn = p; // 実況が出たら読み終わるまで枠を残す
    S.thinking = null; S.justActed = p;
    renderGame();
    if (m) flyPlay(p, m.vals); else flyDraw(p);
    S.timer = pt(() => { S.justActed = null; afterAction(r0); }, base === 30 ? 30 : base * 0.45);
  }, think);
}

// ---------- ゲーム画面 ----------
function moodOf(g, i) {
  const p = g.players[i], n = g.hands[i].length, l = g.last[i];
  if (g.over) return g.winner === i ? (p.level >= 5 ? 'smug' : 'happy') : p.level >= 5 ? 'normal' : (g.pp[i] >= 25 ? 'shock' : 'worried');
  if (!p.human && p.level >= 4) return 'normal'; // ポーカーフェイス
  if (n <= 2) return 'smug';
  if (n >= 10) return 'worried';
  if (l && l.type === 'play' && l.cards.length === 3) return 'happy';
  if (l && l.type === 'draw') return n >= 8 ? 'worried' : 'normal';
  return 'normal';
}
function cardHTML(c, attrs) {
  const red = c.s === 1 || c.s === 2;
  return `<button class="card ${red ? 'red' : ''} ${attrs.cls || ''}" ${attrs.extra || ''}><span class="v">${KB.vname(c.v)}</span><span class="s">${KB.SUITS[c.s]}</span>${c.v >= 11 || c.v === 1 ? `<span class="n">${c.v}</span>` : ''}</button>`;
}
// いま何ゲーム目か：丸の列でひと目で分かるようにする
function progHTML(T, done) {
  if (!T || S.tiebreak) return '';
  const n = T.cfg.games, cur = T.game;
  const setTxt = T.attack && S.attack ? `バッジアタック 第${S.attack.sets + 1}セット` : T.cfg.kind === 'practice' ? '練習' : T.phase === 'final' ? '決勝' : `予選${T.set}/${T.cfg.sets}セット`;
  const pips = Array.from({ length: n }, (_, i) => `<i class="${i + 1 < cur || (done && i + 1 === cur) ? 'done' : i + 1 === cur ? 'cur' : ''}"></i>`).join('');
  return `<div class="game-prog"><span class="gp-set">${esc(setTxt)}</span><b class="gp-no">第${cur}ゲーム</b><span class="gp-pips">${pips}</span>${cur === n ? `<span class="gp-last">${done ? 'セット終了' : '最終ゲーム'}</span>` : ''}</div>`;
}
function progTopHTML(T) {
  const n = T.cfg.games, cur = T.game, setTxt = T.attack && S.attack ? `バッジアタック 第${S.attack.sets + 1}セット` : T.cfg.kind === 'practice' ? '練習' : T.phase === 'final' ? '決勝' : `予選 ${T.set}/${T.cfg.sets}セット・第${T.myTable + 1}卓`;
  return `<span class="gpt"><small>${T.attack && S.attack ? `バッジアタック<br>第${S.attack.sets + 1}セット` : esc(setTxt)}${T.cfg.kind === 'tournament' && T.tourHinted ? '<span class="no-badge" title="この大会でAIの読みを見たため、大会のバッジ（決勝進出・優勝・全セット優勝）は対象外です">バッジ外</span>' : ''}</small><span class="gpt-row"><b>第${cur}ゲーム</b><span class="gp-pips">${Array.from({ length: n }, (_, i) => `<i class="${i + 1 < cur ? 'done' : i + 1 === cur ? 'cur' : ''}"></i>`).join('')}</span></span></span>`;
}
function whereText() {
  const T = S.T;
  if (S.tiebreak) return `${esc(S.tiebreak.label)}<small>サドンデス 1ゲーム</small>`;
  if (T.cfg.kind === 'practice') return `練習<small>第${T.game}/${T.cfg.games}ゲーム</small>`;
  if (T.phase === 'final') return `決勝<small>第${T.game}/${T.cfg.games}ゲーム</small>`;
  return `予選 第${T.set}/${T.cfg.sets}セット<small>第${T.game}/${T.cfg.games}ゲーム・第${T.myTable + 1}卓</small>`;
}
function gameHTML() {
  return `<div class="topbar"><div class="where">${S.tiebreak ? whereText() : progTopHTML(S.T)}</div>${S.attack ? `<span class="atk-box"><span class="atk-clock" title="残り時間">${fmtClock(S.attack.end - Date.now())}</span><small class="atk-now">${atkBP()} BP</small></span>` : ''}
  <div class="row"><button class="btn sm ghost snd-btn ic-btn" data-act="sound" title="${esc(sndLabel())}（押すたびに切り替え）" aria-label="${esc(sndLabel())}">${sndIcon()}</button><button class="btn sm ghost spd-btn ic-btn" data-act="speed-cycle" ${S.attack ? 'disabled' : ''} title="${S.attack ? 'バッジアタック中は速さが固定です' : `AIの手番の速さ：${SPD_JA[S.settings.speed] || 'ふつう'}（押すたびに切り替え）`}" aria-label="AIの手番の速さ：${SPD_JA[S.settings.speed] || 'ふつう'}">${spdLabel()}</button><button class="btn sm" data-act="standings">順位表</button>${S.spectate ? '<button class="btn sm ghost" data-act="watch-quit">観戦をやめる</button>' : '<button class="btn sm ghost" data-act="quit">中断</button>'}</div></div>
  <div id="tablewrap"></div>
  <div class="under"><div class="panel" id="unseenpanel"></div><div class="stack under-main"><div class="panel" id="hintpanel"></div><div class="panel" id="prevpanel" hidden></div></div><div class="panel stack" id="sidepanel"></div></div>`;
}
// 実況欄が固定の高さに入りきらないときは、下にうすい影と「▼」を出してスクロールできることを示す
// 実況・解説の中の「あなた」は、名前を設定していれば「○○さん」と呼ぶ
function yo(t) {
  const nmv = (S.settings.name || '').trim(); if (!t || !nmv || nmv === 'あなた') return t;
  const call = san(nmv);
  return String(t).replace(/あなた(さん)?/g, call);
}
// ---------- 演出：連続最善のコンボ ----------
function comboFx(n, end) {
  const me = document.querySelector('.table .me'); if (!me || S.settings.speed === 'instant') return;
  document.querySelectorAll('.combo-fx').forEach(e => e.remove());
  const r = me.getBoundingClientRect(), el = document.createElement('div');
  const lv = end ? 'end' : n >= 10 ? 'l3' : n >= 5 ? 'l2' : 'l1';
  el.className = 'combo-fx ' + lv;
  el.innerHTML = end ? `<small>コンボ終了</small><b>${n}</b><small>COMBO</small>` : `<b>${n}</b><small>COMBO</small>${n >= 10 ? '<i>🔥</i>' : ''}`;
  el.style.top = Math.max(8, r.top - 18) + 'px'; el.style.right = Math.max(8, window.innerWidth - r.right + 6) + 'px';
  document.body.appendChild(el);
  KB.sfx(end ? 'comboEnd' : 'combo', n);
  setTimeout(() => el.classList.add('out'), end ? 1300 : 1500); setTimeout(() => el.remove(), end ? 1700 : 1900);
}
// ---------- 演出：決めゴールのカットイン（3枚の割り算・ミラクルセット・ベストペアで上がったとき） ----------
function cutInFx(label, expr, t) {
  if (S.settings.speed === 'instant') return;
  const el = document.createElement('div'); el.className = 'cutin-fx';
  el.innerHTML = `<div class="ci-band"><div class="ci-label">${esc(label)}</div><div class="ci-expr">${esc(expr)} = ${t}</div></div>`;
  document.body.appendChild(el); KB.sfx('cutin');
  setTimeout(() => el.classList.add('out'), 1700); setTimeout(() => el.remove(), 2100);
}
// 奥義「絶対透視」の演出：画面が暗くなり、カナタが目を開く。全員の手札と山札が一瞬透けて、また伏せられる
function toushiLite(g, p) {
  if (S.settings.speed === 'instant') return;
  const el = document.createElement('div'); el.className = 'toushi-lite';
  el.innerHTML = `<span class="tl-eye">${KB.avatarSVG(g.players[p].ch, { open: true, level: 6 })}</span><b>絶対透視</b>`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 1300);
}
function toushiFx(g, p) {
  if (S.settings.speed === 'instant') return;
  // 札の中身はカナタにしか見えない：ほかの人には、裏向きの札が光って透けていく様子だけを見せる
  const pl = g.players[p], back = (_, k) => `<span class="tx-c" style="animation-delay:${0.5 + k * 0.06}s"></span>`;
  const rows = g.players.map((q, i) => i === p ? '' : `<div class="tx-row"><b>${esc(nm(q))}</b>${g.hands[i].map(back).join('')}</div>`).join('');
  const deck = g.deck.slice(-12).map(back).join('');
  const el = document.createElement('div'); el.className = 'toushi-fx';
  el.innerHTML = `<div class="tx-eye">${KB.avatarSVG(pl.ch, { open: true, level: 6 })}</div><div class="tx-name">奥義・絶対透視</div><div class="tx-sub">${esc(nm(pl))}の目が開いた……${esc(nm(pl))}にだけ、全員の手札と山札の順番が視えている</div><div class="tx-see">${rows}<div class="tx-row"><b>山札</b>${deck}<i>…</i></div></div>`;
  document.body.appendChild(el); KB.sfx('cutin');
  setTimeout(() => el.classList.add('hide-cards'), 1900); setTimeout(() => el.classList.add('out'), 2700); setTimeout(() => el.remove(), 3200);
}
function markCmOverflow() {
  document.querySelectorAll('.table .cm-text').forEach(t => {
    const upd = () => t.parentElement.classList.toggle('cm-more', t.scrollHeight - t.clientHeight - t.scrollTop > 2);
    upd(); t.onscroll = upd;
  });
}
function renderGame() { renderGame0(); try { markCmOverflow(); } catch (e) { } }
function renderGame0() {
  if (S.view !== 'game') return;
  const g = S.game, T = S.T;
  { const tk = S.gameNo + ':' + g.round + ':' + g.pos; if (!g.over && g.players[g.current()] && g.players[g.current()].human && S.stateKey !== tk) { S.stateKey = tk; S.stateTs = Date.now(); } }
  const me = g.players.findIndex(p => p.human);
  const order = g.order;
  const cur = S.holdTurn != null && !g.over ? S.holdTurn : g.current();
  const held = S.showRound || (S.roundHeld && S.holdTurn != null && !g.over); // 巡の切り替わり待ちの間だけ、前の巡の様子を残す
  const LA = held ? g.prevLast : g.last;
  const pvr = isPrelimTour() ? provisional(T) : null;
  const banner = S.bigBanner && !S.bigBanner.shown ? S.bigBanner : null;
  if (banner) { banner.shown = true; KB.sfx('banner'); }
  const opp = [];
  // 自分の次の人から順に並べる（手番順）
  const myPos = order.indexOf(me);
  for (let k = 1; k < g.n; k++) {
    const i = order[(myPos + k) % g.n]; const p = g.players[i];
    const l = LA[i];
    const ordInRound = order.indexOf(i) + 1;
    let act = '';
    if (l && l.type === 'play') act = `<div class="act">${esc(l.expr)} = ${l.t}</div>`;
    else if (l && l.type === 'draw') act = `<div class="act draw">山札から1枚引いた</div>`;
    else act = `<div class="act draw idle">${order.indexOf(i) < g.pos || g.over ? '' : 'この巡はこれから'}</div>`;
    if (S.thinking === i) act = `<div class="act thinking">考え中<span class="dots"><i></i><i></i><i></i></span></div>`;
    const b = S.bubbles[p.id];
    const bubble = b && (S.winShow || Date.now() - b.at < 2600) ? `<div class="bubble ${Date.now() - b.at < 400 ? 'fresh' : ''}">${esc(b.text)}</div>` : '';
    const n = g.hands[i].length;
    const setpp = S.tiebreak ? 0 : setTotal(T, p.id);
    opp.push(`<div data-pi="${i}" data-k="${k - 1}" class="seat ${i === g.order[0] ? 'dealer' : ''} ${cur === i ? 'turn' : ''} ${S.thinking === i ? 'thinking' : ''} ${S.justActed === i ? 'acted' : ''} ${g.over && g.winner === i ? 'out winner' : g.over ? 'loser' : ''}">${i === g.order[0] ? dealerChip('dbtn seat-chip' + (S.chipSpun === S.gameNo ? '' : ' spin')) : ''}${S.winShow && g.winner === i ? confettiHTML() : ''}
      <div class="av" ${p.ch && p.ch.charId ? `data-char="${p.ch.charId}" role="button" aria-label="${esc(nm(p))}のプロフィール"` : ''}>${av(p, S.thinking === i ? 'normal' : moodOf(g, i))}${bubble}</div>
      <div class="nm"><span>${esc(nm(p))}</span><span class="ord">${ordInRound}番手</span>${pvr ? `<span class="prov"><span class="lv-full">暫定</span>${pvr.rank[p.id]}位</span>` : ''}</div>
      <div class="meta">${lvChip(p)}${p.ch.ageJa ? `<span class="chip tagchip" title="肩書き">${esc(p.ch.ageJa)}</span>` : ''}</div>
      <div class="stats"><span class="handcount"><span>手札</span><b class="tnum">${n}</b>${g.over || S.spectate ? '' : handBacks(n)}</span>
        <span>${g.over ? `PP <b class="tnum">${g.pp[i]}</b>` : `PP <b class="tnum">${setpp}</b>`}</span></div>
      ${S.spectate && !g.over && n ? `<div class="open-hand">${g.hands[i].map(c => `<i class="oh ${c.s === 1 || c.s === 2 ? 'red' : ''}">${KB.vname(c.v)}<small>${KB.SUITS[c.s]}</small></i>`).join('')}</div>` : ''}${act}${g.over && n ? `<div class="played"><span class="pl-l">残り手札</span><span class="pg">${g.hands[i].map(miniCard).join('')}</span></div>` : ''}${playedHTML(g, i)}</div>`);
  }
  const fieldsAll = g.log.filter(e => e.type === 'field');
  const dispRound = S.showRound ? g.round - 1 : g.round;
  const f = S.showRound ? fieldsAll[fieldsAll.length - 2] : g.field;
  const flipped = !S.showRound && S.lastField !== g.round; if (!S.showRound) S.lastField = g.round;
  if (flipped) S.roundStart = Date.now() + (banner ? 2600 : 0);
  const fields = S.showRound ? fieldsAll.slice(0, -1) : fieldsAll; const prevF = fields.length >= 2 ? fields[fields.length - 2] : null;
  const myTurn = !S.spectate && cur === me && S.holdTurn == null && !g.over;
  const hand = g.hands[me];
  const selVals = S.sel.map(id => hand.find(c => c.id === id)).filter(Boolean).map(c => c.v);
  let prev = '';
  if (myTurn) {
    if (!selVals.length) prev = `<span class="muted" style="color:var(--felt-muted)">カードを1〜3枚選ぶと式を自動で探します</span>`;
    else if (judgeAfter()) prev = `<span class="mono">${selVals.map(KB.vname).join('・')}</span><span class="small" style="color:var(--felt-muted)">で ${f.v} を作って出す（成り立つかは出してから判定）</span>`;
    else {
      const m = KB.evalSelection(selVals, f.v);
      prev = m ? `<span class="ok">${esc(m.expr)} = ${f.v}</span><span class="small" style="color:var(--felt-muted)">出せます</span>` : `<span class="ng">${selVals.map(KB.vname).join('・')} では ${f.v} を作れません</span>`;
    }
  }
  const valid = myTurn && selVals.length && (judgeAfter() || KB.evalSelection(selVals, f.v));
  const confirm = S.confirmDraw && myTurn ? `<div class="confirm">出せる組み合わせがあります。あえて引きますか？<button class="btn sm" data-act="draw-yes">引く</button><button class="btn sm primary" data-act="draw-no">やめる</button></div>` : '';
  const setppMe = S.tiebreak ? 0 : setTotal(T, 0);
  const mel = LA[me];
  const oldCm = document.querySelector('#tablewrap .commentary'); // 同じ実況なら作り直さず使い回す（点滅防止）
  $('#tablewrap').innerHTML = `<div class="table ${cmHTML() ? 'has-cm' : ''}">
    ${banner ? `<div class="big-banner" aria-live="polite"><div class="bb-title">${esc(banner.title)}</div><div class="bb-sub">${esc(banner.sub)}</div></div>` : ''}
    ${borderHTML()}
    <div class="opps ring${g.n - 1}" style="--n:${g.n - 1}">${opp.join('')}</div>
    <div class="center">
      <div class="side deckside"><div class="deck" aria-label="山札 ${g.deck.length}枚">${'<i></i>'.repeat(Math.min(5, Math.ceil(g.deck.length / 6)))}<b class="tnum">${g.deck.length}</b></div><span>山札</span><span>捨て札 ${g.discard.length}</span></div>
      <div class="pilecol"><div class="pile"><div class="fieldcard top ${f.s === 1 || f.s === 2 ? 'red' : ''} ${flipped ? 'deal' : ''}"><span class="tag">場 ・ 第${dispRound}巡</span><span class="big">${KB.vname(f.v)}</span><span class="val">${KB.SUITS[f.s]} ${f.v}</span></div>${flipped ? `<div class="round-pop" style="--rp-delay:${S.settings.speed === 'instant' ? 0 : (S.settings.speed === 'fast' ? 0.85 : S.settings.speed === 'slow' ? 1.5 : 1.15) + (banner ? 2.6 : 0)}s">第${dispRound}巡</div>` : ''}</div>${fieldMiniHTML(g, flipped)}</div>
      ${cmHTML() || `<div class="side r"><span>手番</span><b>${g.over ? '終了' : esc(nm(g.players[cur]))}</b><span>${g.over ? '' : S.thinking === cur ? '考え中…' : cur === me && !S.spectate ? 'あなたの番です' : ''}</span></div>`}
    </div>
    ${orderStripHTML(g, me)}
    ${S.winShow ? winStripHTML(g, me) : ''}
    <div data-pi="${me}" class="me ${cur === me && !g.over ? 'turn' : ''} ${g.over && g.winner === me ? 'winner' : ''}">
      <span class="me-arrow out" aria-hidden="true">▲</span>
      ${me === g.order[0] ? dealerChip('dbtn seat-chip' + (S.chipSpun === S.gameNo ? '' : ' spin')) : ''}${S.winShow && g.winner === me ? confettiHTML() : ''}
      <div class="head"><span class="me-id"><span class="av me-av">${av(g.players[me], g.over ? moodOf(g, me) : (hand.length <= 2 ? 'smug' : 'normal'))}${S.bubbles[0] && S.winShow ? `<div class="bubble">${esc(S.bubbles[0].text)}</div>` : ''}</span><b>${esc(nm(g.players[me]))}</b><span class="me-info">手札 <b class="tnum">${hand.length}</b>枚・合計 <b class="tnum">${hand.reduce((a, c) => a + c.v, 0)}</b><span class="hide-sm">（負けたときのPP）</span></span></span><span>セットPP <b class="tnum">${setppMe}</b>${mel && mel.type === 'play' ? ` ・ 前の手 ${esc(mel.expr)}` : ''}</span></div>
      ${g.played[me].length ? `<div class="mine-played"><span>出した札</span>${playedHTML(g, me, true)}</div>` : ''}
      <div class="hand">${hand.map(c => cardHTML(c, { cls: (S.sel.includes(c.id) ? 'sel ' : '') + (S.newCard === c.id || (S.newCards || []).includes(c.id) ? 'new' : '') + ((S.foulIds || []).includes(c.id) ? ' foulc' : ''), extra: `data-card="${c.id}" ${myTurn ? '' : 'disabled'} aria-pressed="${S.sel.includes(c.id)}" aria-label="${KB.vname(c.v)}"` })).join('')}</div>
      ${prev ? `<div class="preview">${prev}</div>` : ''}
      ${confirm}
      <div class="actions" ${g.over ? 'hidden' : ''}>
        <button class="btn primary" data-act="play" ${valid ? '' : 'disabled'}>出す</button>
        <button class="btn felt-btn" data-act="draw" ${myTurn ? '' : 'disabled'}>引く</button>
        ${S.attack ? '' : `<button class="btn felt-btn" data-act="hint" ${myTurn ? '' : 'disabled'}>AIの読み</button>`}
        ${undoOk() ? `<button class="btn felt-btn sm undo-btn" data-act="undo" title="直前の自分の手まで巻き戻す">⏪ 待った</button>` : ''}
      </div>
    </div></div>`;
  if (oldCm) { const nc = document.querySelector('#tablewrap .commentary'); if (nc && nc.dataset.key === oldCm.dataset.key) { oldCm.classList.remove('fresh'); nc.replaceWith(oldCm); } }
  S.chipSpun = S.gameNo; S.newCard = null; S.newCards = null; S.foulIds = null; // 一度だけ動かす演出は、次の描画では止める
  if (flipped) { if (banner) setTimeout(() => dealFieldAnim(f), 2600); else dealFieldAnim(f); }
  renderHint();
  renderSide();
  bindGame();
}

// 親の目印：ジョーカー風の円形チップ（道化の帽子＋「親」）
function dealerChip(cls) {
  let seg = '';
  for (let k = 0; k < 12; k++) { const a0 = k * 30 - 7, a1 = k * 30 + 7, r = 48, rr = 38, rad = d => d * Math.PI / 180;
    const p = (rd, d) => `${(50 + rd * Math.cos(rad(d))).toFixed(1)} ${(50 + rd * Math.sin(rad(d))).toFixed(1)}`;
    seg += `<path d="M${p(r, a0)}A${r} ${r} 0 0 1 ${p(r, a1)}L${p(rr, a1)}A${rr} ${rr} 0 0 0 ${p(rr, a0)}Z" fill="#fffaf0"/>`; }
  return `<span class="${cls}" title="親：最初の手番で場札をめくる人（大会ではジョーカーが目印）"><svg viewBox="0 0 100 100" aria-label="親">
<circle cx="50" cy="50" r="49" fill="#7b2cbf"/>${seg}
<circle cx="50" cy="50" r="36" fill="#1b1340" stroke="#f2b632" stroke-width="3"/>
<path d="M28 44 Q34 24 44 30 Q48 18 52 18 Q56 18 60 30 Q66 24 72 44 Z" fill="#e03131"/>
<path d="M44 30 Q48 18 52 18 Q50 30 50 44 L40 44Z" fill="#f2b632"/>
<path d="M60 30 Q66 24 72 44 L62 44Z" fill="#2f9e44"/>
<rect x="27" y="42" width="46" height="6" rx="3" fill="#f2b632"/>
<circle cx="27" cy="43" r="4" fill="#ffd43b"/><circle cx="52" cy="17" r="4" fill="#ffd43b"/><circle cx="73" cy="43" r="4" fill="#ffd43b"/>
<text x="50" y="76" text-anchor="middle" font-size="27" font-weight="900" fill="#fffaf0" font-family="Zen Kaku Gothic New, Hiragino Sans, sans-serif">親</text>
</svg></span>`;
}
// これまでの場札と、切り直しで山札に戻った札（アウツを数えるときの材料）
function boardHist(g) {
  let lastR = -1; g.log.forEach((e, i) => { if (e.type === 'reshuffle') lastR = i; });
  const fields = []; const ret = g.players.map(() => 0);
  g.log.forEach((e, i) => { if (e.type === 'field') fields.push({ v: e.v, s: e.s, round: e.round, ret: i < lastR }); if (e.type === 'play' && i < lastR) ret[e.p]++; });
  fields.pop(); // いまの場札は除く
  return { fields, ret, reshuffled: lastR >= 0 };
}
function fieldHistHTML(g) {
  const h = boardHist(g), live = h.fields.filter(f => !f.ret);
  if (!h.fields.length) return '';
  return `<div class="field-hist" aria-label="これまでの場札"><span class="fh-l">${h.reshuffled ? '切り直し後の場札' : 'これまでの場札'}</span><span class="fh-c">${live.length ? live.map(f => `<i class="mc ${f.s === 1 || f.s === 2 ? 'red' : ''}" title="第${f.round}巡">${KB.vname(f.v)}</i>`).join('') : '<span class="muted">まだありません</span>'}</span>${h.reshuffled ? '<span class="fh-n">それより前の札は山札に戻っています</span>' : ''}</div>`;
}
// 場札の下のすき間に、これまでの場札を小さく並べる（切り直し後の分だけ。新しい場札が出ると、前の場札が飛んでくる）
function fieldMiniHTML(g, flipped) {
  const h = boardHist(g); let live = h.fields.filter(f => !f.ret);
  if (S.showRound) live = live.slice(0, -1);
  if (!live.length) return h.reshuffled ? '<div class="fh-mini" title="切り直し後の場札"><span class="fh-rs">切直</span></div>' : '';
  return `<div class="fh-mini" aria-label="${h.reshuffled ? '切り直し後の' : 'これまでの'}場札 ${live.map(f => KB.vname(f.v)).join('、')}" title="${h.reshuffled ? '切り直し後の場札（それより前は山札に戻っています）' : 'これまでの場札'}">${h.reshuffled ? '<span class="fh-rs">切直</span>' : ''}${live.map((f, i) => `<i class="mc ${f.s === 1 || f.s === 2 ? 'red' : ''} ${flipped && i === live.length - 1 && S.settings.speed !== 'instant' ? 'fly' : ''}">${KB.vname(f.v)}</i>`).join('')}</div>`;
}
function miniCard(c) { return `<i class="mc ${c.s === 1 || c.s === 2 ? 'red' : ''}">${KB.vname(c.v)}</i>`; }
function playedHTML(g, i, bare) {
  const ps = g.played[i], rt = boardHist(g).ret[i] || 0;
  const inner = ps.length ? ps.map((pl, k) => `<span class="pg ${k < rt ? 'ret' : ''}" title="第${pl.round}巡 場${pl.t}：${esc(pl.expr)}${k < rt ? '（切り直しで山札に戻った札）' : ''}">${pl.cards.map(miniCard).join('')}</span>`).join('') : '<span class="none">まだ出していません</span>';
  return bare ? `<span class="played">${inner}</span>` : `<div class="played"><span class="pl-l">出した札</span>${inner}</div>`;
}
function orderStripHTML(g, me) {
  const cur = S.holdTurn != null && !g.over ? S.holdTurn : g.current();
  const held = S.showRound || (S.roundHeld && S.holdTurn != null && !g.over); // 巡の切り替わり待ちの間だけ、前の巡の様子を残す
  return `<div class="order-strip" aria-label="手番の順（時計回り）"><span class="cw">時計回り</span>${g.order.map((i, k) => {
    const p = g.players[i]; const l = (held ? g.prevLast : g.last)[i];
    const done = g.over || held || k < g.pos;
    const st = cur === i ? (S.thinking === i ? 'now thinking' : 'now') : done ? 'done' : '';
    const res = '';
    return `${k ? '<span class="arr">→</span>' : ''}<span class="os ${st} ${i === me ? 'meos' : ''}">${k === 0 ? dealerChip('dbtn inline') : ''}${esc(i === me && !S.spectate ? 'あなた' : nm(p))}${res}</span>`;
  }).join('')}</div>`;
}
function renderSide() {
  const g = S.game; const me = g.players.findIndex(p => p.human);
  const uc = g.unseenCounts(me);
  const lines = [];
  let lastRound = 0;
  for (const e of g.log.slice(-40)) {
    if (e.type === 'field') { lines.push(`<div class="f">第${e.round}巡　場 ${KB.vname(e.v)}（${e.v}）</div>`); }
    else if (e.type === 'play') lines.push(`<div>${esc(nm(g.players[e.p]))}：<span class="mono">${esc(e.expr)}</span>（残${e.left}）</div>`);
    else if (e.type === 'draw' && e.foul) lines.push(`<div class="foul-log">${esc(nm(g.players[e.p]))}：お手つき（${e.vals.map(KB.vname).join('・')}）→ ${e.n}枚引いた（残${e.left}）</div>`);
    else if (e.type === 'draw') lines.push(`<div class="muted">${esc(nm(g.players[e.p]))}：引いた（残${e.left}）</div>`);
    else if (e.type === 'reshuffle') lines.push(`<div class="muted">捨て札を切り直して山札に</div>`);
  }
  $('#unseenpanel').innerHTML = `<div><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm ghost" data-act="toggle-unseen" aria-expanded="${!!S.showUnseen}">${S.showUnseen ? '▾ まだ見えていないカードを隠す' : '▸ まだ見えていないカードを見る'}</button><button class="btn sm ghost" data-act="chart-view">📋 早見表（完成${chartFullRows().length}行）</button></div>
    ${S.showUnseen ? `<div class="unseen" style="margin-top:8px">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(v => `<div class="${uc[v] ? '' : 'zero'}">${KB.vname(v)}<b>${uc[v]}</b></div>`).join('')}</div><div class="small muted" style="margin-top:4px">あなたの手札・場札・捨て札（出た札）を除いた、各数字の残り枚数</div>` : ''}</div>`;
  renderPrev();
  $('#sidepanel').innerHTML = `<div><div class="lbl" style="margin-bottom:4px">記録</div><div class="log" id="log">${lines.join('')}</div></div>`;
  const lg = $('#log'); if (lg) lg.scrollTop = lg.scrollHeight;
  document.querySelectorAll('#sidepanel [data-act], #unseenpanel [data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b));
}
// 前回の判断：2巡目以降、AIの読みの下で、直前の自分の判断と考えられた手を復習できる
function renderPrev() {
  const el = $('#prevpanel'); if (!el) return;
  const g = S.game, d = S.decisions[S.decisions.length - 1];
  if (!d || g.over) { el.hidden = true; el.innerHTML = ''; S.prevKey = null; return; }
  const key = S.gameNo + ':' + S.decisions.length;
  if (S.prevKey === key) { el.hidden = false; return; } // 同じ内容なら作り直さない（開閉状態を保つ）
  S.prevKey = key;
  const [v, c] = verdict(d);
  el.hidden = false;
  el.innerHTML = `<details class="prev-dec" ${S.prevOpen ? 'open' : ''}><summary><span class="lbl" style="margin:0">前回の判断</span> <span class="dr-r">第${d.round}巡・場${d.t}</span> <span class="verdict ${c}">${v}</span> <span class="dr-loss">損失 ${(d.loss * 100).toFixed(1)}pt</span></summary>
    <div class="dr-moves" style="margin-top:6px">${d.mine === d.best ? `<span class="lab">あなた＝最善</span><span class="mono">${esc(d.mine)}</span>${d.near ? `<span class="lab">ほぼ互角</span><span class="mono">${esc(d.near)}</span>` : ''}` : `<span class="lab">あなた</span><span class="mono">${esc(d.mine)}</span><span class="lab">最善</span><span class="mono">${esc(d.best)}</span>`}</div>
    <div style="margin-top:6px">${whyHTML(d)}</div></details>`;
  const det = el.querySelector('details'); det.addEventListener('toggle', () => { S.prevOpen = det.open; });
}

// ---------- AIの読み ----------
function stateKey(g) { return g.round + ':' + g.pos + ':' + g.hands.map(h => h.length).join(','); }
function computeHint(force) {
  if (S.attack) return;
  const g = S.game; const me = g.current(); if (me < 0 || !g.players[me].human) return;
  const key = stateKey(g);
  if (S.hint && S.hint.key === key && !force) { renderHint(); return; }
  // AIの読みを見たら、このゲーム・セット・大会は結果のバッジの対象外
  S.gameHinted = true; if (S.T && !S.tiebreak) { S.T.setHinted = true; S.T.tourHinted = true; }
  S.hint = { key, busy: true }; renderHint();
  setTimeout(() => {
    const counts = g.counts(me), t = g.field.v;
    let cands = KB.candidates(counts, t, 10);
    if (cands.length) cands = cands.concat([null]); // あえて引く
    const ctx = ctxFor(me);
    const view = g.view(me, S.settings.showLevel && S.settings.showStyle);
    if (!S.settings.showLevel || !S.settings.showStyle) view.models = g.players.map(p => ({ level: S.settings.showLevel ? (p.level || 3) : 3, style: S.settings.showStyle ? (p.style || 'keisan') : 'keisan' }));
    const t0 = performance.now();
    const ev = cands.length ? KB.evaluate(view, cands, 3200, ctx) : KB.evaluate(view, [null], 600, ctx);
    rankEv(ev, ctx);
    S.hint = { key, busy: false, ev, ctx, view, ms: performance.now() - t0, unseen: g.unseenCounts(me), counts, t };
    renderHint();
  }, 30);
}
function evalRowHTML(e, i, H, mine) {
  const g = S.game;
  const best = H.ev[0];
  const canPlay = H.ev.some(x => x.m);
  const rs = e.m ? KB.reasons(H.counts, e.m, H.unseen) : canPlay ? [`あえて出さずに1枚引く（手札${KB.nCounts(H.counts) + 1}枚に）`, `いまの手札を温存：次の場で出せる確率 ${pct(KB.nextPlayableProb(H.counts, H.unseen))}`] : ['出せる組み合わせがないので1枚引きます'];
  if (e.danger > 0.08) rs.push(`あなたの次の番までに誰かが上がる確率 ${pct(e.danger)}`);
  const lbl = i === 0 ? '最善' : i === 1 ? '次善' : i === 2 ? '3番手' : (i + 1) + '位';
    const goalMax = Math.max(...(H.ctx.goalTable || [1])) || 1;
  return `<div class="cand ${i === 0 ? 'best' : ''} ${mine ? 'mine' : ''}">
    <div class="top"><span class="rk ${i === 0 ? 'r1' : ''}">${mine ? 'あなたの選択・' : ''}${lbl}</span><span class="expr">${e.m ? esc(e.m.expr) + ' = ' + H.t : (canPlay ? 'あえて引く' : '引く（出せる組み合わせなし）')}</span>${e.m ? `<span class="small muted">${e.m.vals.map(KB.vname).join(' ')} を出す</span>` : ''}${i > 0 ? `<span class="small muted">総合評価で最善と ${((best.score - e.score) * 100).toFixed(1)}pt 差</span>` : ''}</div>
    <div class="metrics">
      <div class="metric">${goalLabel()}<b>${fmtGoal(e.goal)}</b><div class="bar"><i style="width:${Math.max(2, Math.min(100, e.goal / goalMax * 100))}%"></i></div></div>
      <div class="metric">このゲームで上がる<b>${pct(e.win)}</b><div class="bar"><i style="width:${e.win * 100}%"></i></div></div>
      <div class="metric">期待PP<b>${fx1(e.pp)}</b><div class="bar"><i style="width:${Math.min(100, e.pp / 40 * 100)}%;background:var(--warn)"></i></div></div>
      <div class="metric">ゲーム内の期待順位<b>${fx1(e.rank)}位</b></div>
    </div>
    <ul class="reasons">${rs.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
}
function renderHint() {
  const el = $('#hintpanel'); if (!el) return;
  const g = S.game; const H = S.hint;
  const me = g.players.findIndex(p => p.human);
  const myTurn = g.current() === me && !g.over;
  let body = '';
  if (S.attack) { el.innerHTML = '<div class="stack"><div class="hint-head"><h3>AIの読み</h3></div><p class="small muted" style="margin:0">バッジアタック中は、AIの読みは使えません。自分の読みで勝負！</p></div>'; return; }
  if (!myTurn) body = `<p class="muted small" style="margin:0">あなたの番になったら「AIの読み」で、最善手・次善手とその理由を確認できます。予選中は「決勝進出率」、決勝では「優勝率」で手を比べます。</p>`;
  else if (!H || H.key !== stateKey(g)) body = `<p class="muted small" style="margin:0">まず自分で考えてから「AIの読み」を押すのがおすすめです。選んだカードの評価も一緒に表示します。</p><button class="btn sm" data-act="hint">AIの読みを見る</button>${S.T && !S.tiebreak && !badgeElig(S.T).game ? `<p class="small muted hint-note" style="margin:0">この卓はバッジの条件（${ELIG.table}人以上・相手の平均★${ELIG.oppAvg}以上）を満たしていないので、結果のバッジは数えません。</p>` : ''}<p class="small muted hint-note" style="margin:0">${S.gameHinted ? 'このゲームはAIの読みを見たので、判断の評価と結果のバッジの対象外です。' : '※見た手は判断の評価に入らず、そのゲーム・セット・大会は結果のバッジ（上がり・セット優勝など）の対象外になります。'}</p>`;
  else if (H.busy) body = `<p class="muted">シミュレーション中…（相手の手札を何千通りも想定して最後まで打ち切っています）</p>`;
  else {
    const hand = g.hands[me];
    const selVals = S.sel.map(id => hand.find(c => c.id === id)).filter(Boolean).map(c => c.v);
    const sm = selVals.length ? KB.evalSelection(selVals, H.t) : null;
    const top = H.ev.slice(0, 3);
    let mineHTML = '';
    if (sm) {
      const idx = H.ev.findIndex(e => e.m && e.m.key === sm.key);
      if (idx >= 3) mineHTML = evalRowHTML(H.ev[idx], idx, H, true);
      else if (idx < 0) mineHTML = `<p class="small muted">あなたの選択（${esc(sm.expr)}）は候補を絞った際に外れました。「この手も評価」で計算できます。<button class="btn sm" data-act="eval-mine">この手も評価</button></p>`;
    }
    const opps = g.players.map((p, i) => i === me ? null : `${nm(p)} ${g.hands[i].length}枚`).filter(Boolean).join('・');
    body = `${top.map((e, i) => evalRowHTML(e, i, H, sm && e.m && e.m.key === sm.key)).join('')}${mineHTML}
      <p class="small muted" style="margin:0">相手：${esc(opps)}。${H.ctx.goalTable && S.T.cfg.kind === 'tournament' && !S.tiebreak && S.T.phase === 'prelim' ? `このセットの順位ごとの決勝進出率（推定）：${H.ctx.goalTable.map((x, i) => (i + 1) + '位 ' + pct(x)).join(' / ')}。` : ''}候補 ${H.ev.length}手を約${Math.round(H.ev.reduce((a, e) => a + e.n, 0) / 100) * 100}回シミュレーション（${Math.round(H.ms)}ms）。並びは「総合評価」順：${goalLabel()}を主に、差が小さいときは上がり率と期待PPも加味します。数%の差は誤差の範囲です。</p>
      ${askHTML('hint')}`;
  }
  el.innerHTML = `<div class="stack"><div class="hint-head"><h3>AIの読み</h3>${H && !H.busy && myTurn && H.key === stateKey(g) ? '<button class="btn sm ghost" data-act="hint-more">もっと深く読む</button>' : ''}</div>${body}</div>`;
  bindHint();
}
function askHTML(where) {
  if (!S.sample) return '';
  const a = S.ask && S.ask.where === where ? S.ask : null;
  return `<div class="stack" style="gap:6px"><div class="lbl">Claudeに質問（あなたのClaude利用枠を使います）</div>
  <div class="ask"><input id="ask-${where}" placeholder="${where === 'hint' ? '例：なぜKを残すほうが良いの？' : '例：このゲームの反省点は？'}" value="${a ? esc(a.q) : ''}"><button class="btn sm primary" data-ask="${where}">${a && a.busy ? '停止' : '聞く'}</button></div>
  ${a ? `<div class="answer">${esc(a.text || (a.busy ? '考えています…' : ''))}</div>` : ''}</div>`;
}

// ---------- Claude への質問 ----------
const RULES_TXT = `計算ブリッジのルール：トランプ52枚（A=1,J=11,Q=12,K=13）。各自7枚。毎巡、山札から1枚めくって「場の数」にし、手番順に、手札1〜3枚を四則演算（かっこ自由・割り算は割り切れるときのみ）で場の数にして出す。作れなければ山札から1枚引く（作れても、あえて出さずに引くのはOK）。誰かの手札が0枚になった瞬間にゲーム終了、他の人は残り手札の合計がPP（ペナルティ）。5ゲームで1セット、セットのPP合計が少ない順に順位。`;
function situationText() {
  const g = S.game, T = S.T; const me = g.players.findIndex(p => p.human);
  const lines = [];
  lines.push(`状況：${whereText().replace(/<[^>]+>/g, ' ')}`);
  if (T.cfg.kind === 'tournament' && !S.tiebreak) lines.push(`大会設定：${T.cfg.nPlayers}人、予選${T.cfg.sets}セット、セット順位の得点 ${T.cfg.points.join('/')}、上位${T.cfg.finalists}名が決勝。現在の総合順位での自分：${myStanding()}`);
  lines.push(`場の数：${g.field.v}（第${g.round}巡）、山札${g.deck.length}枚`);
  lines.push(`自分の手札：${g.hands[me].map(c => c.v).join(',')}（セットPP ${S.tiebreak ? 0 : setTotal(T, 0)}）`);
  g.players.forEach((p, i) => {
    if (i === me) return;
    const l = g.last[i];
    lines.push(`${nm(p)}：手札${g.hands[i].length}枚、セットPP ${S.tiebreak ? 0 : setTotal(T, p.id)}${S.settings.showLevel ? `、強さ${p.level}/5` : ''}${S.settings.showStyle ? `、性格「${KB.style(p.style).label}」` : ''}${l ? (l.type === 'play' ? `、この巡で ${l.expr} を出した` : '、この巡で引いた') : ''}`);
  });
  const uc = g.unseenCounts(me);
  lines.push('見えていないカード枚数：' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(v => `${v}:${uc[v]}`).join(' '));
  return lines.join('\n');
}
function evalText(H) {
  if (!H || !H.ev) return '';
  return 'AIのシミュレーション結果（総合評価の高い順。総合評価＝目標指標を主に、上がり率と期待PPを少し加味）：\n' + H.ev.slice(0, 6).map((e, i) => `${i + 1}. ${e.m ? e.m.expr : (H.ev.some(x => x.m) ? 'あえて引く（出さない）' : '引く（出せる組み合わせなし）')}：${goalLabel()} ${fmtGoal(e.goal)}、上がり率 ${pct(e.win)}、期待PP ${fx1(e.pp)}、次の自分の番までに他者が上がる率 ${pct(e.danger)}`).join('\n');
}
async function ask(where) {
  if (S.ask && S.ask.busy) { S.ask.ctl && S.ask.ctl.abort(); return; }
  const inp = $('#ask-' + where); const q = (inp && inp.value.trim()) || (where === 'hint' ? 'この局面での最善手と考え方を教えて' : 'このゲームを総括して');
  let ctxText;
  if (where === 'hint') ctxText = `${RULES_TXT}\n\n${situationText()}\n\n${evalText(S.hint)}`;
  else ctxText = `${RULES_TXT}\n\n${summaryText()}`;
  const prompt = `あなたは計算ブリッジの戦略コーチです。以下のデータをもとに、日本語で簡潔に（250字〜400字程度、箇条書き可）答えてください。数値はシミュレーションの推定値です。確率の考え方（見えているカード、相手の残り枚数、セットや大会の順位状況）に触れてください。\n\n${ctxText}\n\n質問：${q}`;
  const ctl = new AbortController();
  S.ask = { where, q, text: '', busy: true, ctl };
  rerenderAsk(where);
  try {
    const res = await S.sample(prompt, { signal: ctl.signal, cache: false, onText: ({ text }) => { S.ask.text = text; rerenderAsk(where); } });
    S.ask.text = res.text;
  } catch (e) {
    S.ask.text = (e && e.text ? e.text + '\n\n' : '') + ({ not_granted: 'Claudeの利用が許可されませんでした。', rate_limited: '利用が混み合っています。少し待ってからもう一度どうぞ。', cancelled: '（停止しました）' }[e && e.code] || 'うまく答えを受け取れませんでした。もう一度お試しください。');
    if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled')) S.sample = null;
  }
  S.ask.busy = false; rerenderAsk(where);
}
function rerenderAsk(where) { if (where === 'hint') renderHint(); else { const el = $('#ask-wrap'); if (el) { el.innerHTML = askHTML(where); bindAsk(el); } } }

// ---------- 自分の手 ----------
const mlabel = e => e && e.m ? e.m.expr : 'あえて引く';
const sameMove = (e, move) => move ? (e.m && e.m.key === move.key) : e.m === null;
const BEST_LOOSE = { 1: { loss: 0.035 }, 2: { loss: 0.02 } }; // 1巡目3.5pt・2巡目2.0pt以内は最善扱い
function recordDecision(move) {
  if (undoAllowed()) try { S.undoCur = undoTake(); } catch (e) { S.undoCur = null; } // 待ったの戻り先：手を打つ直前の状態（番の合図より前に打っても控える）
  const g = S.game; const me = g.current();
  const counts = g.counts(me), t = g.field.v;
  const all = KB.findMoves(counts, t, 'all', 3);
  if (!all.length) return; // 選択肢なし
  const key = stateKey(g);
  let ev, ctx = ctxFor(me);
  const view = g.view(me, S.settings.showLevel && S.settings.showStyle);
  if (S.hint && S.hint.key === key && S.hint.ev) { ev = S.hint.ev.slice(); ctx = S.hint.ctx; }
  else ev = KB.evaluate(view, KB.candidates(counts, t, 8).concat([null]), 1600, ctx);
  if (!ev.find(e => sameMove(e, move))) {
    const top = ev.slice().sort((a, b) => b.goal - a.goal)[0];
    const extra = KB.evaluate(view, [move, top.m], 700, ctx);
    ev.push(Object.assign(extra[0], { goal: extra[0].goal - extra[1].goal + top.goal }));
  }
  rankEv(ev, ctx);
  // 捨て身（上がれるのに引く）が最善と出たときは、2つだけを多めに試して確かめる。差が小さければ上がりを最善に戻す
  let sutemi = null;
  { const outE = ev.find(isOutEv); if (outE && ev[0] !== outE) {
    const conf = KB.evaluate(view, [outE.m, ev[0].m], 1600, ctx), gm = Math.max(...(ctx.goalTable || [1])) || 1;
    if ((conf[1].goal - conf[0].goal) / gm < sutemiMargin(ctx)) { outE.score = ev[0].score + 0.001; ev.sort((a, b) => b.score - a.score); }
    else sutemi = { outGoal: conf[0].goal, bestGoal: conf[1].goal, opp: g.players.reduce((n, p, i) => n + (i === me ? 0 : g.hands[i].length), 0) };
  } }
  const best = ev[0];
  const mine = ev.find(e => sameMove(e, move));
  const goalMax = Math.max(...(ctx.goalTable || [1])) || 1;
  let loss = Math.max(0, best.score - mine.score);
  // 表示される数字（目的・上がる確率・期待PP）で最善手が上回っていなければ、端数の差は同じ扱い＝最善とする
  if (loss > 0 && visTie(best, mine)) loss = 0;
  // 序盤は読みのばらつきが手の差と同じくらい大きい（1巡目は2回読むと最善手が3割入れ替わる）ので、最善の幅を広げる。
  // 1巡目：差3.5pt以内／2巡目：差2.0pt以内。最善と同じ扱いにして、その手は「ほぼ互角」として残す
  let near = null;
  if (loss > 0 && !(sutemi && isOutEv(mine))) { const L = BEST_LOOSE[g.round]; if (L && (loss <= L.loss || (L.pp && mine.pp - best.pp <= L.pp && loss <= L.cap))) { near = mlabel(best); loss = 0; } }
  // 捨て身（あえて上がらない）が最善の場面で上がった：上がりは最善として扱う（疑問手にしない）。
  // ただし「攻めるなら捨て身もあった」ことは、あとで博士・マサがひと言そえる（sutemi.outOk）
  if (sutemi && isOutEv(mine)) { loss = 0; sutemi.outOk = true; }
  if (sutemi) sutemi.chose = mine === best;
  // 場面の難しさ：選べた手（候補）の損失の平均（実力の計算と同じく、最善扱いの幅は0・1手10ptで頭打ち）。AIの読みを見た手の損失に使う
  const hm = ev.reduce((a, e) => a + rateLoss({ r: g.round, l: Math.max(0, best.score - e.score) }), 0) / ev.length;
  const best0 = best; // 表示・記録の「最善」：上がったときは上がりを最善として残す
  S.decisions.push({ round: g.round, t, hand: g.hands[me].map(c => c.v), mine: mlabel(mine), drew: !move, best: near ? mlabel(mine) : mlabel(sutemi && sutemi.outOk ? mine : best0), near, bestStats: near || (sutemi && sutemi.outOk) ? mine : best0, // 「ほぼ互角」で最善扱いにした手も、統計（3枚・引いた回数など）では自分の手を最善として数える
     mineStats: mine, loss, ppLoss: near || (sutemi && sutemi.outOk) ? 0 : mine.pp - best0.pp, viewedHint: !!(S.undoRetry || (S.hint && S.hint.key === key && S.hint.ev)), hm, undo: S.undoRetry ? 1 : 0, evs: ev.map(e => ({ m: e.m, win: e.win, pp: e.pp, score: e.score, goal: e.goal })), sutemi, goalLbl: S.T ? goalLabel() : null, goalPct: S.T ? goalIsProb() : false, opps: g.players.map((p, i) => i === me ? null : { n: nm(p), h: g.hands[i].length }).filter(Boolean), counts, unseen: g.unseenCounts(me), top: ev.slice(0, 3), goalMax, danger: g.players.map((p, i) => i === me ? null : `${nm(p)} ${g.hands[i].length}枚`).filter(Boolean).join('・') });
  const wasRetry = S.undoRetry; S.undoRetry = false; if (!wasRetry && S.undoCur && S.undoCur.gameNo === S.gameNo) S.undoSnap = S.undoCur; // やり直した手は、もう戻せない // 「待った」で戻れるのは、選択肢のあった直前の自分の手
}
// ---------- 戦略的な解説（計算した事実から組み立てる。矛盾が起きないよう、数字で確かめた事だけを言う） ----------
function facesOf(c) { const m = KB.reachMask(c); let k = 0; for (let t = 1; t <= 13; t++) if (m & (1 << t)) k++; return k; }
function outInfo(c, unseen) { // 次の番で手札を全部出し切れる場の数（何面待ちか）と確率
  const n = KB.nCounts(c); if (!n || n > 3) return { k: 0, p: 0, ts: [] };
  let tot = 0, ok = 0; const ts = [];
  for (let t = 1; t <= 13; t++) { tot += unseen[t]; if (KB.findMoves(c, t, 'all', 3).some(m => m.n === n)) { ok += unseen[t]; ts.push(t); } }
  return { k: ts.length, p: tot ? ok / tot : 0, ts };
}
function insights(d) {
  const out = []; if (!d || !d.counts || !d.evs) return out;
  const C = d.counts, U = d.unseen, t = d.t, isBest = d.loss <= 0.015;
  const best = d.bestStats, mine = d.mineStats, bm = best && best.m, mm = mine && mine.m;
  const rest = m => m ? KB.sub(C, m.vals) : C;
  const nL = m => KB.nCounts(rest(m)), sL = m => KB.sumCounts(rest(m));
  const P = x => Math.round(x * 100) + '%';
  const add = (id, root, masa) => out.push({ id, root, masa });
  // A：3枚出しが最善とは限らない
  const e3 = d.evs.filter(e => e.m && e.m.n === 3).sort((a, b) => b.score - a.score)[0];
  if (bm && bm.n < 3 && e3 && nL(bm) > 0 && best.score - e3.score > 0.01) {
    const fb = facesOf(rest(bm)), f3 = facesOf(rest(e3.m));
    let why = null, whyM = null;
    if (fb - f3 >= 2) { why = `残り札で作れる場の数が${f3}通り→${fb}通りと、次の巡の対応力が違います。`; whyM = `残りで作れる数が${f3}通りと${fb}通りや、次の巡の対応力がまるで違う！`; }
    else if (best.win - e3.win >= 0.03) { why = `上がる確率は${P(e3.win)}→${P(best.win)}です。`; whyM = `上がる確率は${P(e3.win)}と${P(best.win)}や！`; }
    else if (e3.pp - best.pp >= 0.5) { why = `期待PPが${fx1(e3.pp)}→${fx1(best.pp)}と下がります。`; whyM = `期待PPが${fx1(e3.pp)}から${fx1(best.pp)}に下がるんや！`; }
    if (why) {
      if (mm && mm.key === e3.m.key) add('three-not-best', `3枚出しは気持ちいいのですが、ここは${bm.n}枚の「${bm.expr}」が上でした。${why}`, `3枚出しが正義とは限らんで！ここは${bm.n}枚の「${bm.expr}」や。${whyM}`);
      else if (isBest) add('three-skip', `3枚出し（${e3.m.expr}）もありましたが、あえて${bm.n}枚。${why}`, `3枚いけたのにあえて${bm.n}枚！わかっとるな〜、${whyM}`);
    }
  }
  // B：1枚残しの危うさ
  if (mm && nL(mm) === 1) {
    const v = rest(mm).findIndex((x, i) => i > 0 && x > 0), o1 = outInfo(rest(mm), U);
    if (!isBest && bm && nL(bm) >= 2 && nL(bm) <= 3) {
      const o2 = outInfo(rest(bm), U);
      if (o2.p - o1.p >= 0.05) add('one-left-risk', `1枚残しは場が${KB.vname(v)}のときしか上がれず、確率は約${P(o1.p)}。「${bm.expr}」なら残り${nL(bm)}枚の${o2.k}面待ちで、約${P(o2.p)}でした。`, `1枚残しは場が${KB.vname(v)}の時だけや、${P(o1.p)}しかあらへん！「${bm.expr}」なら${o2.k}面待ちで${P(o2.p)}やったで！`);
    } else if (isBest) add('one-left-ok', `1枚残し。上がれるのは場が${KB.vname(v)}のときだけ（約${P(o1.p)}）ですが、手札の合計は${sL(mm)}まで軽くなりました。`, `1枚残しや！上がれるのは${KB.vname(v)}が来た時だけやけど、残り${sL(mm)}点なら傷は浅いで！`);
  }
  // C：相手の残り枚数で優先順位が変わる
  const near = (d.opps || []).filter(o => o.h <= 2).sort((a, b) => a.h - b.h)[0];
  if (near && bm && mm && !isBest && sL(mm) - sL(bm) >= 4) add('opp-near', `${san(near.n)}が残り${near.h}枚。上がられる可能性が高い場面では、手札の合計を減らす「${bm.expr}」が優先でした（残り合計 ${sL(mm)}→${sL(bm)}）。`, `${san(near.n)}残り${near.h}枚やで！上がられる前提で「${bm.expr}」、重たい札から逃がさな！残り${sL(mm)}点と${sL(bm)}点の差は大きいで！`);
  else if (near && mm && isBest && KB.sumCounts(C) - sL(mm) >= 15) add('opp-near-ok', `${san(near.n)}が残り${near.h}枚の場面で、合計${KB.sumCounts(C) - sL(mm)}点分を処分。上がられても傷を浅くする、正しい優先順位です。`, `${san(near.n)}残り${near.h}枚、ここで${KB.sumCounts(C) - sL(mm)}点分捨てたんはデカい！保険かけとるな〜！`);
  // D：場の数（お題）の大きさ
  if (bm && !isBest && t <= 4 && bm.vals.some(v => v >= 10) && /[−÷]/.test(bm.expr) && !(mm && mm.vals.some(v => v >= 10))) add('small-field', `場が${t}と小さくても、「${bm.expr}」のように引き算や割り算を使えば大きい札を絡められます。`, `場が${t}でも「${bm.expr}」や！引き算・割り算ならでかい札も出せるんやで！`);
  if (mm && isBest && t >= 10 && mm.vals.filter(v => v >= 10).length === 0 && mm.n >= 2) { /* 大きな場で小さな札を使った最善手：言及なし */ }
  if (mm && isBest && t >= 9 && mm.n >= 2 && mm.vals.some(v => v >= 10)) add('big-field', `場が${t}と大きい巡は、大きい札をまとめて処分できる好機。「${mm.expr}」でしっかり活かしました。`, `場が${t}！でかい場はでかい札の捨て時や、「${mm.expr}」きっちり活かしたな！`);
  // E：残り2〜3枚の待ち
  if (mm && isBest && nL(mm) >= 2 && nL(mm) <= 3) { const o = outInfo(rest(mm), U); if (o.k >= 2) add('wait-' + o.k, `残り${nL(mm)}枚は${o.k}面待ち。次の番で上がれる確率は約${P(o.p)}です。`, `残り${nL(mm)}枚で${o.k}面待ちや！次の番で上がる確率は${P(o.p)}やで！`); }
  // F：上がる確率の差
  if (!isBest && mine && best && best.win - mine.win >= 0.05) add('win-gap', `上がる確率で比べると、あなたの手は${P(mine.win)}、「${bm ? bm.expr : 'あえて引く'}」なら${P(best.win)}でした。`, `上がる確率、あんたの手で${P(mine.win)}、「${bm ? bm.expr : 'あえて引く'}」なら${P(best.win)}や！`);
  // G：あえて引くのが最善
  if (d.drew && isBest) { const ep = d.evs.filter(e => e.m).sort((a, b) => b.score - a.score)[0]; if (ep) { const f0 = facesOf(C), f1 = facesOf(rest(ep.m)); if (f0 - f1 >= 2) add('draw-keep', `出すなら「${ep.m.expr}」でしたが、残り札で作れる場が${f0}通り→${f1}通りに減っていました。あえて引いて形を保つのが正解です。`, `出したら作れる数が${f0}通りから${f1}通りに減っとった！あえて引くんが正解や、渋いで！`); } }
  return out;
}
// ネタバレ実況：AIの手札が見えている前提で、見逃し・悪手・好手を判定する
function spoilerCheck(g, p, m) {
  const counts = g.counts(p), t = g.field.v;
  const ms = KB.findMoves(counts, t, 'all', 3);
  if (!ms.length) return null;
  const hide = e => e.replace(/\d+/g, '◯'); // 相手の手札は見せない（数字を◯に）
  if (!m) return { kind: 'oppMissed', ex: hide(ms[0].expr) };
  const total = KB.nCounts(counts); if (m.n === total) return null; // 上がりは対象外
  const st = KB.style('keisan');
  const score = x => KB.heurScore(counts, x, st, null, 0);
  const best = ms.slice().sort((x, y) => score(y) - score(x))[0];
  const sum = x => x.vals.reduce((s, v) => s + v, 0);
  const F = (o) => Object.assign({ checks: true, bigOk: false, smallOk: false, winOk: false, flexOk: false, countOk: false, ppOk: false }, o);
  if (best.key !== m.key && best.n === 3 && m.n === 1 && sum(best) - sum(m) >= 12) return { kind: 'oppBlunder', ex: hide(best.expr), f: F({ bigOk: true, countOk: true }) };
  if (best.key !== m.key && sum(best) - sum(m) >= 15) return { kind: 'oppBlunder', ex: hide(best.expr), f: F({ bigOk: true, countOk: best.n === 3 && m.n < 3 }) };
  const mx = Math.max(...g.hands[p].map(c => c.v));
  if (best.key === m.key && m.n === 3 && m.vals.some(v => v >= 11) && Math.random() < 0.3) return { kind: 'oppNice', ex: m.expr, f: F({ bigOk: m.vals.includes(mx), countOk: true, flexOk: true }) };
  return null;
}
// 判定コメントの内容チェック用：自分の手と最善手を実際に比べて、どの言い回しが当てはまるかを決める
function moveFlags(d) {
  const vs = m => (m && m.vals) || [];
  const sum = a => a.reduce((s, v) => s + v, 0), small = a => a.filter(v => v <= 3).length, big = a => a.some(v => v >= 10);
  const bm = d.bestStats && d.bestStats.m, mm = d.mineStats && d.mineStats.m;
  const counts = d.counts || KB.countsOf(d.hand), unseen = d.unseen;
  const rest = m => m ? KB.sub(counts, m.vals) : counts;
  const np = m => KB.nextPlayableProb(rest(m), unseen);
  const smallInHand = counts[1] + counts[2] + counts[3];
  return {
    bad: { checks: true, bigOk: sum(vs(bm)) - sum(vs(mm)) >= 5, smallOk: small(vs(mm)) > small(vs(bm)), winOk: d.bestStats.win - d.mineStats.win >= 0.03, flexOk: np(bm) - np(mm) >= 0.05, countOk: vs(bm).length === 3 && vs(mm).length < 3, ppOk: d.mineStats.pp - d.bestStats.pp >= 0.5 },
    good: { checks: true, bigOk: big(vs(mm)), smallOk: small(vs(mm)) === 0 && smallInHand > 0, winOk: d.mineStats.win >= 0.3, flexOk: np(mm) >= 0.75, countOk: vs(mm).length === 3, ppOk: (d.top || []).every(e => d.mineStats.pp <= e.pp + 0.3) }
  };
}
// 表示の丸めで比べる（端数は同数扱い）
const goalIsProb = () => !!(S.tiebreak || (S.T && (S.T.phase === 'final' || S.T.cfg.kind === 'tournament')));
const visGoal = x => goalIsProb() ? Math.round(x * 100) : Math.round(x * 10);
// 最善手が表示上どの数字でも上回っていない（目的・上がる確率・期待PPが同じか自分の手の方が良い）なら、差は端数だけ
const visTie = (b, m) => !(visGoal(b.goal) > visGoal(m.goal) || Math.round(b.win * 100) > Math.round(m.win * 100) || +fx1(b.pp) < +fx1(m.pp));
// 実況設定：速さが「ふつう」以下のときは、他のプレイヤーへの実況をするか選べる（はやい・一瞬では自分の手だけ）
function cmOthersHTML() {
  const sp = S.settings.speed;
  if (sp === 'fast' || sp === 'instant') return `<p class="small muted" style="margin:-4px 0 0">AIの手番の速さが「はやい」「一瞬」のときは、実況は自分の手だけです。</p>`;
  const on = S.settings.cmOthers !== false;
  return `<div class="field"><label>他のプレイヤーへの実況</label><select class="set-cmo">${[['1', 'する'], ['0', 'しない（自分の手だけ）']].map(([k, v]) => `<option value="${k}" ${(k === '1') === on ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
}
// 最善手でなかったとき：最善手なら何%→何%に上がっていたかを、差のある項目から重要なもの1つで必ず伝える
function gapFact(d) {
  const b = d.bestStats, m = d.mineStats; if (!b || !m || d.loss <= 0.015) return null;
  const bx = d.best === 'あえて引く' ? 'あえて引く手' : `最善手「${d.best}」`, bxM = d.best === 'あえて引く' ? 'あえて引いとけば' : `「${d.best}」なら`;
  const pc = x => Math.round(x * 100);
  const items = [];
  // 重み：序盤（第1〜2巡）は上がる確率・次に出せる確率を重め（イメージしやすく、まだ形を作る段階）、
  // 終盤ほど期待PPを重めに。毎回少しだけ揺らして、同じ言い方ばかりにならないようにする
  const early = d.round <= 2 ? 2.5 : d.round === 3 ? 1.5 : 1, late = d.round >= 4 ? 1.2 : 1;
  const jit = () => 0.8 + Math.random() * 0.4;
  // 目的そのもの（大会の決勝進出率・優勝率・勝ち抜け率／練習のセット期待点）
  if (b.goal != null && m.goal != null) {
    if (goalIsProb()) items.push({ k: goalLabel(), a: pc(m.goal), z: pc(b.goal), f: x => x + '%', up: true, w: 1.6 });
    else { const gm = Math.max(...((S.T && S.T.cfg.points) || [10])) || 10; items.push({ k: 'セット期待点', a: Math.round(m.goal * 10) / 10, z: Math.round(b.goal * 10) / 10, f: x => x.toFixed(1) + '点', up: true, w: 100 / gm }); }
  }
  items.push({ k: '上がる確率', a: pc(m.win), z: pc(b.win), f: x => x + '%', up: true, w: 1 * early * jit() });
  try {
    const C = d.counts || KB.countsOf(d.hand), rest = e => e && e.m ? KB.sub(C, e.m.vals) : C;
    if (d.unseen && KB.nCounts(rest(b)) > 0 && KB.nCounts(rest(m)) > 0) items.push({ k: '次の番で出せる確率', a: pc(KB.nextPlayableProb(rest(m), d.unseen)), z: pc(KB.nextPlayableProb(rest(b), d.unseen)), f: x => x + '%', up: true, w: 0.7 * Math.min(early, 1.5) * jit() });
  } catch (e) { }
  items.push({ k: '期待PP（失点の見込み）', a: +fx1(m.pp), z: +fx1(b.pp), f: x => x.toFixed(1), up: false, w: 6 * late * jit() });
  // 表示上で最善手の方が良い項目だけを候補にし、重み付きの差がいちばん大きいものを1つ選ぶ（端数の差は同数扱い）
  const gain = x => x.up ? x.z - x.a : x.a - x.z;
  const top = items.filter(x => gain(x) > 0).sort((x, y) => gain(y) * y.w - gain(x) * x.w)[0];
  // 最善手ならその場で上がれた（上がる確率100%）ときは、どの項目の差が大きくても「上がれた」と言う
  const wi = items.find(x => x.k === '上がる確率');
  if (wi && wi.z >= 100 && wi.a < 100) return { root: `${bx}なら、その場で上がれていました（上がる確率${wi.a}%→100%）。`, masa: `${bxM}その場で上がれとったで！上がる確率${wi.a}%→100%や！`, sh: `上がる確率${wi.a}%→100%`, up: true };
  if (!top) return null;
  if (top.k === '上がる確率' && top.z >= 100) return { root: `${bx}なら、その場で上がれていました（上がる確率${top.a}%→100%）。`, masa: `${bxM}上がれとったで！`, sh: `上がる確率${top.a}%→100%`, up: true };
  const verbR = top.up ? '上がっていました' : '下がっていました', verbM = top.up ? '上がっとったで！' : '減っとったで！';
  return { root: `${bx}なら、${top.k}が${top.f(top.a)}から${top.f(top.z)}に${verbR}。`, masa: `${bxM}${top.k}が${top.f(top.a)}から${top.f(top.z)}に${verbM}`, sh: `${top.k.replace('（失点の見込み）', '')}${top.f(top.a)}→${top.f(top.z)}` };
}
// 割り算のほめ方：かっこ付きの割り算（(11+13)÷6 など）はしっかりほめる、
// かっこなしで3枚使った割り算は軽くほめる、12÷4 のような2枚の割り算や 13÷13・÷1 はほめない
function divPraise(expr, n) {
  if (!expr.includes('÷')) return null;
  if (/\)\s*÷\s*([2-9]|1[0-3])(?!\d)/.test(expr) || /÷\s*\(/.test(expr)) return 'div';
  if (n < 3) return null;
  const re = /(\d+)\s*÷\s*(\d+)/g; let m;
  while ((m = re.exec(expr))) { const x = +m[1], y = +m[2]; if (y >= 2 && x !== y) return 'divMild'; }
  return null;
}
function trivialMul(expr) { return /×\s*1(?!\d)|(^|[^\d])1\s*×/.test(expr); }
// 捨て身の解説（上がれる手を見送るのが最善だった場面）
function sutemiIns(d) {
  const su = d.sutemi, gl = goalLabel(), a = fmtGoal(su.outGoal), b = fmtGoal(su.bestGoal);
  const nOpp = (d.opps || []).filter(Boolean).length || 3, few = su.opp / nOpp <= 3;
  const oppR = few ? `相手の手札は合計${su.opp}枚と少なく、今上がっても相手のPPが小さいまま終わり、逆転が届きにくい場面でした。` : `続ければ、相手が札を引いてPPを増やす可能性があります。`;
  const oppM = few ? '相手が小さい札しか持ってへん時は、捨て身もアリなんやで！' : '相手に札を引かせて、PPを積ませる作戦や！';
  return su.chose
    ? { id: 'sutemi', root: `見事な捨て身です。上がれる手を見送って、相手に札を抱えさせたまま続けました。上がると${gl}は${a}どまり、あえて引けば${b}。${oppR}`, masa: `上がれるのにあえて引いた！ 上がっても${gl}は${a}、引いて続けたら${b}や。逆転狙いの捨て身、しびれるで！` }
    : (() => { // 上がったのは最善扱い。ただ「攻めるなら捨て身もあった」とひと言そえる
      const g0 = G_(), badge = !((g0.cnt || {}).sutemi1 >= 1);
      return { id: 'sutemi', root: `上がりは最善の判断です。ただ、攻めるなら「あえて上がらずに続ける」捨て身もありました。上がると${gl}は${a}、続ければ${b}まで伸びる見込みでした。${oppR}${badge ? '選んでいれば、バッジ「溜めと捨て身」の金も取れていました。' : ''}`,
        masa: `上がったんは正解や、文句なし！ せやけど、今あがらんで攻めてたら${gl}は${a}から${b}まで伸びとったかもな！${badge ? '「溜めと捨て身」の金バッジももらえたのになー！' : oppM}` };
    })();
}
function feedback(nd, g, me, drew) {
  if (g.over) { // 上がったあとでも、捨て身が最善だった場面はあとから解説する
    const d = S.decisions.length > nd ? S.decisions[S.decisions.length - 1] : null;
    if (d && d.sutemi && !d.sutemi.chose) { const x = sutemiIns(d); setTimeout(() => { if (S.view === 'game') { sayInsight(x, 'normal'); S.cmHoldUntil = Date.now() + 9000; renderGame(); } }, 2600); }
    return;
  }
  const d = S.decisions.length > nd ? S.decisions[S.decisions.length - 1] : null;
  const h = g.hands[me].length;
  if (d) {
    { const gc = G_().cnt, prev = gc.streakNow || 0; S.bestStreak = d.viewedHint ? prev : d.loss <= 0.015 ? prev + 1 : 0;
      if (!d.viewedHint) { if (S.bestStreak >= 2) setTimeout(() => comboFx(S.bestStreak), 250); else if (prev >= 3) setTimeout(() => comboFx(prev, true), 250); } }
    const ins = insights(d); d.facts = ins.map(x => x.root);
    try { growthOnDecision(d); } catch (e) { }
    // 捨て身（上がれるのにあえて引くのが最善）の場面は、必ずその理由を説明する
    if (d.sutemi) ins.unshift(sutemiIns(d));
    const useIns = ins.length && (d.sutemi || Math.random() < (d.loss <= 0.015 ? 0.5 : 0.65));
    if (!d.sutemi && S.bestStreak >= 3 && S.bestStreak % 2 === 1) say('streak', { k: S.bestStreak });
    else if (useIns) { const pk = d.sutemi ? ins[0] : KB.pickFresh('ins', ins); d.insId = pk && pk.id; sayInsight(pk, d.loss <= 0.015 ? 'happy' : 'worried'); }
    else if (d.loss <= 0.015) say(d.drew ? 'drewGood' : 'good', d.drew ? {} : moveFlags(d).good);
    else if (d.loss <= 0.05) say('ok', moveFlags(d).good);
    else say('bad', Object.assign({ best: d.best }, moveFlags(d).bad));
    // 最善手でなかったときは、最善手との差（何%→何%）を必ず添える
    if (d.loss > 0.015) { const gf = gapFact(d); if (gf && !['win-gap', 'one-left-risk', 'sutemi'].includes(d.insId)) { const c = S.cm; if (c && Date.now() - (c.at || 0) < 800 && /^(bad|ok|insight)$/.test(c.kind)) { c.text += ' ' + (c.who === 'root' ? gf.root : gf.masa); S.cmHoldUntil = Date.now() + holdMs(c); } else sayInsight(gf, 'worried'); } d.gap = gf && gf.root; }
    if (d.loss <= 0.015) setTimeout(() => KB.sfx('best'), 380);
    if (!drew && h <= 2 && d.loss <= 0.015 && Math.random() < 0.5) say('myReach', { h }); // 最善でないときは差の説明を上書きしない
  } else if (drew) {
    if (h >= 10) say('myHeavy', { h }); else say('draw', { n: 'あなた', h });
  } else if (h <= 2) say('myReach', { h });
}
// 名前つきの待ち（ミラクルセット・ベストペア）になったら、大げさに盛り上げる。出した後・引いた後・お手つきの後のどれでも判定する
function checkNamedWait(g, me) {
  try {
    if (g.over) return;
    const w = waitInfo(g.counts(me)); if (!w || !w.name) return;
    say('bigWait', { name: w.name, men: w.men, cards: w.cards }); if (S.cm) S.cm.prio = 6; setTimeout(() => KB.sfx('play3'), 300);
  } catch (e) { }
}
// 待ちの形：残り1〜3枚を一度に出し切れる場の数（何面待ちか）と、その名前
// ミラクルセット＝1・2・6（3枚で唯一の12面待ち）／ベストペア＝2・6（2枚で唯一の4面待ち）／多面待ち＝3枚で10面以上
const WAIT_NAMES = { '1,2,6': 'ミラクルセット', '2,6': 'ベストペア' };
function waitInfo(counts) {
  const n = KB.nCounts(counts); if (!n || n > 3) return null;
  const ts = []; for (let t = 1; t <= 13; t++) if (KB.findMoves(counts, t, 'all', 3).some(m => m.n === n)) ts.push(t);
  const vals = []; for (let v = 1; v <= 13; v++) for (let k = 0; k < counts[v]; k++) vals.push(v);
  const key = vals.join(',');
  const name = WAIT_NAMES[key] || (n === 3 && ts.length >= 10 ? '多面待ち' : null);
  return { n, men: ts.length, ts, key, name, cards: vals.map(KB.vname).join('・') };
}
function humanPlay() {
  const g = S.game; const me = g.current(); const hand = g.hands[me];
  const vals = S.sel.map(id => hand.find(c => c.id === id)).filter(Boolean).map(c => c.v);
  const m = KB.evalSelection(vals, g.field.v);
  if (!m) { if (judgeAfter() && vals.length) humanFoul(vals); return; }
  const nd = S.decisions.length; // 判定を記録する前の件数
  // 自分の番になってから出すまでの秒数（番の合図より前に出したときは、手番が回ってきた時点から数える）
  const tkNow = S.gameNo + ':' + g.round + ':' + g.pos;
  const t0 = S.chimeKey === tkNow && S.turnStart ? S.turnStart : (S.stateKey === tkNow ? S.stateTs : null);
  const secs = t0 ? (Date.now() - t0) / 1000 : null;
  recordDecision(m);
  if (S.decisions.length > nd && secs != null) S.decisions[S.decisions.length - 1].secs = secs;
  const r0 = g.round, tF = g.field.v;
  g.apply(m);
  try { const dl = S.decisions.length > nd ? S.decisions[S.decisions.length - 1] : null; zukanCheck(m, tF, g.over && g.winner === me, (dl && dl.viewedHint) || (S.hint && S.hint.ev)); } catch (e) { }
  const tAct = Date.now() - 5;
  try { feedback(nd, g, me, false); } catch (e) { }
  checkNamedWait(g, me);
  if (g.round !== r0 && !g.over) { S.holdTurn = me; S.showRound = true; S.roundHeld = true; }
  else if (!g.over && S.cm && S.cm.at >= tAct) S.holdTurn = me;
  if (!g.over) S.bubbles[0] = null;
  S.sel = []; S.hint = null; S.confirmDraw = false;
  renderGame(); flyPlay(me, m.vals); afterAction(r0);
}
// お手つき：出した札が場の数にならない → 札は手札に戻し、ペナルティで数枚引いて手番終了
function humanFoul(vals) {
  const g = S.game; const me = g.current(); const N = foulN();
  const ids = S.sel.slice();
  const t = g.field.v, r0 = g.round;
  const cs = g.counts(me), alts = KB.findMoves(cs, t, 'all', 3).map(m => ({ m, s: KB.heurScore(cs, m, KB.style('keisan'), g.unseenCounts(me), 1) })).sort((x, y) => y.s - x.s); const alt = alts.length ? '例）' + alts[0].m.expr + ' = ' + t : '引く（出せる組み合わせなし）';
  { const wasRetry = S.undoRetry; S.undoRetry = false; if (!wasRetry && undoAllowed()) try { S.undoSnap = undoTake(); } catch (e) { } } // お手つきも「待った」で取り消せる（やり直した手のお手つきは除く）
  const got = g.foul(N, vals);
  (S.fouls = S.fouls || []).push({ round: r0, t, vals: vals.slice(), n: got.length, alt });
  S.foulCount = (S.foulCount || 0) + 1;
  { const pv = G_().cnt.streakNow || 0; if (pv >= 3) setTimeout(() => comboFx(pv, true), 600); }
  S.bestStreak = 0; S.recordRun = false; { const g = G_(); g.cnt.streakNow = 0; G_save(g); } // お手つきで連続最善は途切れる
  S.T.setFouls = (S.T.setFouls || 0) + 1;
  say('foul', { n: 'あなた', k: got.length, cards: vals.map(KB.vname).join('・'), t });
  setTimeout(() => checkNamedWait(g, me), 2500);
  const slow = S.settings.speed !== 'instant';
  if (slow) { S.cmHoldUntil = Math.max(S.cmHoldUntil || 0, Date.now() + 2400 + got.length * 260); S.flowHoldUntil = S.cmHoldUntil; }
  if (g.round !== r0 && !g.over) { S.holdTurn = me; S.showRound = true; S.roundHeld = true; }
  else if (!g.over) S.holdTurn = me;
  S.bubbles[0] = null;
  S.newCards = got.map(c => c.id); S.foulIds = ids;
  S.sel = []; S.hint = null; S.confirmDraw = false;
  KB.sfx('foul'); renderGame(); foulFx(me, vals, got.length); afterAction(r0);
}
function foulFx(pi, vals, n) {
  if (S.settings.speed === 'instant') return;
  const tbl = document.querySelector('#tablewrap .table'); if (!tbl) return;
  const r = tbl.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'foul-stamp'; el.setAttribute('role', 'alert');
  el.innerHTML = `<div class="fs-main">お手つき！</div><div class="fs-cards">${vals.map(v => `<span>${KB.vname(v)}</span>`).join('')}<em>では作れません</em></div><div class="fs-sub">ペナルティ：山札から${n}枚</div>`;
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top + Math.min(r.height * 0.42, 260)) + 'px';
  document.body.appendChild(el);
  tbl.classList.add('foul-flash');
  setTimeout(() => tbl.classList.remove('foul-flash'), 900);
  setTimeout(() => el.classList.add('out'), 1900);
  setTimeout(() => el.remove(), 2400);
  for (let i = 0; i < n; i++) setTimeout(() => KB.sfx('draw') || flyCard(document.querySelector('.deck'), document.querySelector(`[data-pi="${pi}"]`), null, 0, 620), 900 + i * 300);
}
function humanDraw(force) {
  const g = S.game; const me = g.current();
  const playable = KB.findMoves(g.counts(me), g.field.v, 'all', 3).length > 0;
  if (playable && S.settings.warnMiss && !force) { S.confirmDraw = true; renderGame(); return; }
  const nd = S.decisions.length; // 判定を記録する前の件数
  if (playable) recordDecision(null); else S.undoRetry = false; // 出せずに引いただけの手でも、やり直しは終わり
  const before = new Set(g.hands[me].map(c => c.id));
  const r0 = g.round;
  g.apply(null);
  const tAct = Date.now() - 5;
  try { feedback(nd, g, me, true); } catch (e) { }
  checkNamedWait(g, me);
  if (g.round !== r0 && !g.over) { S.holdTurn = me; S.showRound = true; S.roundHeld = true; }
  else if (!g.over && S.cm && S.cm.at >= tAct) S.holdTurn = me;
  const nc = g.hands[me].find(c => !before.has(c.id)); S.newCard = nc ? nc.id : null;
  S.sel = []; S.hint = null; S.confirmDraw = false;
  renderGame(); flyDraw(me); afterAction(r0);
}

// ---------- ゲーム終了 ----------
function verdict(d) {
  if (d.loss <= 0.015) return ['最善', 'v-best'];
  if (d.loss <= 0.05) return ['好手', 'v-ok'];
  if (d.loss <= 0.12) return ['疑問手', 'v-meh'];
  return ['悪手', 'v-bad'];
}
function summaryText() {
  const g = S.game; const me = g.players.findIndex(p => p.human);
  const lines = [`ゲーム結果：${g.winner >= 0 ? nm(g.players[g.winner]) + 'が上がり' : '規定巡で終了'}。PP：` + g.players.map((p, i) => `${nm(p)} ${g.pp[i]}`).join('、')];
  lines.push('最後に残った手札（これがPPになる）：' + g.players.map((p, i) => `${i === me ? 'あなた' : nm(p)} [${g.hands[i].map(c => c.v).join(',') || 'なし'}]`).join('、'));
  lines.push('あなたが出した札（巡ごと）：' + (g.played[me].map(x => `第${x.round}巡 場${x.t}「${x.expr}」`).join('、') || 'なし'));
  { const mh = missHit(g, me); if (mh) lines.push(`ミスが結果的にハマった（プレイヤー目線の材料）：第${mh.d.round}巡（場${mh.d.t}）のあなたの手「${mh.d.mine}」は最善「${mh.d.best}」ではなかったが、最善手なら使っていた${mh.card}が手元に残り、それで第${mh.win.round}巡に「${mh.win.expr}」で上がれた。最善手を選んでいたら、この上がりはなかった。`); }
  { const nw = nearWin(g, me); if (nw) lines.push(`惜しかった点（プレイヤー目線の材料）：ゲーム終了時あなたの手札は残り${nw.n}枚（${nw.men}面待ち${nw.name ? `、名前つきの待ち「${nw.name}」` : ''}）。${nw.ts.length ? `次の場が ${nw.ts.join('・')} なら次の番でちょうど上がれた（確率およそ${Math.round(nw.p * 100)}%）` : '次の番で上がれる場はなかった'}。${nw.justBefore ? 'あなたの番の直前で上がられた。' : ''}`); }
  lines.push(`あなたが引いた回数：${g.log.filter(e => e.type === 'draw' && !e.foul && e.p === me).length}回`);
  const fl = g.log.filter(e => e.type === 'draw' && e.foul && e.p === me);
  if (fl.length) lines.push(`お手つき（出した札が場の数にならず、ペナルティで引いた）：${fl.map(e => `第${e.round}巡 場${e.t} [${e.vals.join(',')}]→${e.n}枚`).join('、')}`);
  lines.push(`あなたの判断（場の数／その時の手札／あなたの手／AIの最善手／${goalLabel()}の損失）：`);
  for (const d of S.decisions) lines.push(`第${d.round}巡 場${d.t} 手札[${d.hand.join(',')}]：${d.mine}／最善 ${d.best}／損失 ${(d.loss * 100).toFixed(1)}pt、期待PP差 ${fx1(d.ppLoss)}${(d.facts || insights(d).map(x => x.root)).length ? `\n  計算メモ：${(d.facts || insights(d).map(x => x.root)).join(' ')}` : ''}`);
  const lk = luckInfo(g, me);
  if (lk) lines.push(`判断と結果：判断は${{ best: 'すべて最善', ok: 'ほぼ最善（わずかに次善あり）', bad: '最善との差が目立つ' }[lk.judge]}。最後の判断時点の期待PPは${lk.exp}、実際のPPは${lk.pp}（${lk.won ? '上がり' : lk.diff <= -3 ? '期待より良い結果＝運が味方' : lk.diff >= 5 ? '期待より悪い結果＝運が悪い' : 'ほぼ期待どおり'}）。`);
  if (!S.tiebreak && S.T) lines.push('セット累計PP：' + g.players.map(p => `${nm(p)} ${setTotal(S.T, p.id)}`).join('、'));
  return lines.join('\n');
}
// ---------- 待った（練習と大会。バッジアタック・観戦・サドンデスでは使えない）：直前の自分の手（選択肢のあった手）まで巻き戻す ----------
// 選択肢のある手を打つ直前に、対局・セット・成長記録をまるごと控えておき、戻すときはそれに差し替える。
// 上がられたあと（「結果を見る」の前）でも戻れる。戻したゲーム・セットは結果のバッジの対象外、やり直した手は推定実力に入れない
const undoAllowed = () => !!(S.T && ['practice', 'tournament'].includes(S.T.cfg.kind) && !S.attack && !S.spectate && !S.tiebreak);
const undoOk = () => { const g = S.game; return undoAllowed() && !!S.undoSnap && S.undoSnap.gameNo === S.gameNo && !!g && (!g.over || !!S.winShow) && !(g.over && g.winner >= 0 && g.players[g.winner] && g.players[g.winner].human); }; // 自分が上がったときは出さない
function undoTake() {
  const g = S.game, o = {}; for (const k in g) if (k !== 'players') o[k] = g[k];
  return { gameNo: S.gameNo, round: g.round, g: JSON.stringify(o), ids: g.players.map(p => p.id), T: JSON.stringify(S.T), growth: JSON.stringify(store.get('growth', null)), dec: JSON.stringify(S.decisions || []), fouls: JSON.stringify(S.fouls || []), bestStreak: S.bestStreak || 0, foulCount: S.foulCount || 0 };
}
function undoAsk() {
  if (!undoOk()) return;
  const u = S.undoSnap, g = S.game, n = rvName(), free = S.gameHinted || !badgeElig(S.T).game;
  const head = (g.over ? `上がられてもうたけど、一手前（第${u.round}巡）の${n}の番まで巻き戻せるで。` : `一手前（第${u.round}巡）の${n}の番まで巻き戻すで。`) + 'やり直した手は、もういっぺん戻すことはできへんで。';
  const tour = S.T.cfg.kind === 'tournament' && !S.T.tourHinted && badgeElig(S.T).tour;
  const warn = free && !tour ? 'このゲームはもともとバッジの対象外やから、遠慮なくいこか。やり直した手は推定実力には入れへんで。' : `戻ったら、このゲームとこのセット${tour ? '、それにこの大会' : ''}の結果のバッジ（上がり・セット1位・ノーミス${tour ? '・決勝進出・優勝' : ''}など）はもらえんようになるし、やり直した手は推定実力にも入れへん。それでもええか？`;
  modal(`<div class="op-lines"><div class="op-line masa"><div class="cm-av">${KB.casterSVG('masa', 'normal')}</div><div class="op-bubble"><span class="cm-name">実況・ナニワのマサ</span>${esc(head + warn)}</div></div></div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px"><button class="btn" data-act="undo-no">やめとく</button><button class="btn primary" data-act="undo-go">⏪ 巻き戻す</button></div>`);
  pauseGame(); // modal() は前のモーダルを閉じて再開させるので、開いたあとで止める
}
function undoGo() {
  const u = S.undoSnap; if (!u || !undoOk()) { closeModal(); return; }
  S.resumeFn = null; closeModal(); // 止めていた続き（AIの手など）は動かさない
  clearTimeout(S.timer); S.paused = 0; S.resumeFn = null; S.undoSnap = S.undoCur = null;
  document.querySelectorAll('.confetti,.cutin,.whistle-ov').forEach(e => e.remove());
  const L0 = JSON.parse(u.g).log.length, steps = S.game.log.map((e, i) => ({ e, i })).slice(L0).reverse();
  rewindFx(() => {
    S.T = JSON.parse(u.T);
    if (u.growth !== 'null') store.set('growth', JSON.parse(u.growth));
    const g = Object.assign(Object.create(KB.Game.prototype), JSON.parse(u.g)); g.players = u.ids.map(id => P(id));
    S.game = g; S.gameNo = (S.gameNo || 0) + 1; // 古いタイマー（セリフ・演出）は gameNo で止まる
    S.decisions = JSON.parse(u.dec); S.fouls = JSON.parse(u.fouls); S.bestStreak = u.bestStreak; S.foulCount = u.foulCount;
    S.gameHinted = true; S.T.setHinted = true; S.T.tourHinted = true; S.undoRetry = true;
    S.qual = (S.T.cfg.kind === 'tournament' && S.T.phase === 'prelim') ? qualifyTable(S.T) : null;
    S.sel = []; S.hint = null; S.bubbles = {}; S.thinking = null; S.justActed = null; S.winShow = null; S.holdTurn = null; S.roundHeld = false; S.showRound = false; S.confirmDraw = false; S.ask = null; S.lastField = g.field;
    S.bigBanner = null; S.introUntil = 0; S.roundStart = 0; S.dealDur = 0; S.chimeKey = null; S.liveKey = null; S.newCard = null; S.newCards = null;
    S.reshuffleSeen = g.log.filter(e => e.type === 'reshuffle').length;
    const n = rvName();
    S.cm = { who: 'masa', text: `一手前、第${g.round}巡の${n}の番まで戻したで！さっきとちゃう手、試してみ！`, prio: 5, kind: 'undo', mood: 'happy', at: Date.now() };
    if (S.settings.commentary === 'root') S.cm = { who: 'root', text: `一手前、第${g.round}巡の${n}の番に戻しました。別の手を試してみましょう。`, prio: 5, kind: 'undo', mood: 'normal', at: Date.now() };
    if (!S.settings.commentary || S.settings.commentary === 'off') S.cm = null;
    S.cmHoldUntil = Date.now() + 1200; S.flowHoldUntil = S.cmHoldUntil;
    saveSession(); renderGame(); loop();
  }, steps);
}
// 巻き戻しの演出：画面が青く揺らぎ、時計の針が逆回り。そのあいだに、戻す手を新しい順に1手ずつさかのぼって見せる
// （出した札は出した人の手元へ、引いた札は裏向きで山札へ飛んで戻り、手札の枚数と場札も前の状態に変わる）
function rewindFx(then, steps) {
  // 速さが「一瞬」でも巻き戻しは見せる（動きを減らす設定のときだけ省く）
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { then(); return; }
  steps = (steps || []).filter(x => ['play', 'draw', 'field'].includes(x.e.type));
  const g = S.game, me = me0(), nPlay = steps.filter(x => x.e.type !== 'field').length;
  // 1手の間隔：はじめはゆっくり、だんだん速く。全部で2秒以内
  const iv = k => { const base = Math.min(320, 1800 / Math.max(1, nPlay)); return Math.max(60, base * (1.25 - 0.6 * k / Math.max(1, steps.length))); };
  KB.sfx('rewind');
  document.querySelectorAll('.win-strip').forEach(e => e.remove());
  const el = document.createElement('div'); el.className = 'rewind-fx';
  el.innerHTML = `<div class="rw-scan"></div><div class="rw-rew">◀◀ REW</div><div class="rw-top"><div class="rw-clock"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/>${[...Array(12)].map((_, i) => `<line x1="50" y1="9" x2="50" y2="16" transform="rotate(${i * 30} 50 50)"/>`).join('')}<line class="rw-h" x1="50" y1="50" x2="50" y2="28"/><line class="rw-m" x1="50" y1="50" x2="50" y2="15"/><circle cx="50" cy="50" r="3" class="rw-c"/></svg></div><div class="rw-t">巻き戻し中…</div></div>`;
  document.body.appendChild(el); document.body.classList.add('rewinding');
  const seat = p => document.querySelector(`[data-pi="${p}"]`);
  const cnt = p => { const s = seat(p); return s && (p === me ? s.querySelector('.me-info b') : s.querySelector('.handcount b')); };
  const bump = (p, d) => { const c = cnt(p); if (c) { c.textContent = Math.max(0, (+c.textContent || 0) + d); c.classList.remove('rw-pop'); void c.offsetWidth; c.classList.add('rw-pop'); } };
  const bubble = (p, txt) => { const s = seat(p); if (!s) return; const a = (s.querySelector('.av') || s).getBoundingClientRect(); const b = document.createElement('div'); b.className = 'rw-bubble'; b.textContent = txt; b.style.left = Math.max(6, Math.min(innerWidth - 150, a.left + a.width / 2 - 40)) + 'px'; b.style.top = Math.max(6, a.top - 26) + 'px'; document.body.appendChild(b); setTimeout(() => b.remove(), 650); };
  const used = {}; // 席ごとに、戻した「出した札」のまとまりの数
  let t = 250;
  steps.forEach(({ e, i }, k) => {
    setTimeout(() => {
      if (!el.isConnected) return;
      if (e.type === 'play') {
        const s = seat(e.p); if (!s) return; const gs = [...s.querySelectorAll('.pg:not(.ret)')]; used[e.p] = (used[e.p] || 0) + 1; const grp = gs[gs.length - used[e.p]];
        const to = s.querySelector('.av') || s;
        if (grp) { e.vals.forEach((v, n) => flyCard(grp, to, `<span>${KB.vname(v)}</span>`, n * 40, 340, true)); setTimeout(() => { grp.style.visibility = 'hidden'; }, 60); }
        bump(e.p, e.vals.length); bubble(e.p, '↩ ' + e.expr); KB.sfx('unselect');
      } else if (e.type === 'draw') {
        const n = e.foul ? (e.n || 1) : 1; for (let q = 0; q < n; q++) flyCard(seat(e.p), document.querySelector('.deck'), null, q * 40, 340, true);
        bump(e.p, -n); KB.sfx('select');
      } else if (e.type === 'field') { // 場札を1つ前に戻す
        const prev = g.log.slice(0, i).reverse().find(x => x.type === 'field'), fc = document.querySelector('.fieldcard.top');
        if (prev && fc) { const big = fc.querySelector('.big'), val = fc.querySelector('.val'), tag = fc.querySelector('.tag'); if (big) big.textContent = KB.vname(prev.v); if (val) val.textContent = `${KB.SUITS[prev.s]} ${prev.v}`; if (tag) tag.textContent = `場 ・ 第${prev.round}巡`; fc.classList.toggle('red', prev.s === 1 || prev.s === 2); fc.classList.remove('rw-flip'); void fc.offsetWidth; fc.classList.add('rw-flip'); }
      }
    }, t);
    t += e.type === 'field' ? 80 : iv(k);
  });
  const end = Math.max(1700, t + 350);
  setTimeout(() => { then(); }, end);
  setTimeout(() => { el.classList.add('out'); document.body.classList.remove('rewinding'); }, end + 120);
  setTimeout(() => el.remove(), end + 520);
}
function onGameOver() {
  const g = S.game, T = S.T;
  if (S.tiebreak) { finishTiebreakGame(); return; }
  T.live = null;
  g.players.forEach((p, i) => { T.setPP[p.id].push(g.pp[i]); T.totPP[p.id] += (T.phase === 'final' ? 0 : g.pp[i]); });
  if (T.phase === 'final') g.players.forEach((p, i) => { T.finalPP[p.id] = (T.finalPP[p.id] || 0) + g.pp[i]; });
  // 他の卓も同じゲーム数だけ進める
  if (T.phase === 'prelim') T.tables.forEach((t, ti) => {
    if (ti === T.myTable) return;
    const pls = t.map(id => P(id));
    const gm = KB.autoGame(pls, starterFor(t, T.game));
    pls.forEach((p, i) => { T.setPP[p.id].push(gm.pp[i]); T.totPP[p.id] += gm.pp[i]; });
  });
  if (S.spectate) { winOverlay(watchGameSummary); if (S.settings.speed !== 'instant') { const gn = S.gameNo; setTimeout(() => { if (S.spectate && S.winShow && S.gameNo === gn) act('win-ok'); }, 4200); } return; } // 観戦：記録は残さず、感想へ
  // セットの総括用に、このゲームの要点を残す
  {
    const ds = S.decisions, lk = luckInfo(g, me0());
    const worst = ds.slice().sort((x, y) => y.loss - x.loss)[0];
    (S.T.setLog = S.T.setLog || []).push({ game: T.game, pp: g.pp[me0()], won: g.winner === me0(), fouls: (S.fouls || []).map(f => `第${f.round}巡 場${f.t} [${f.vals.join(',')}]→${f.n}枚`), rank: g.pp.filter(x => x < g.pp[me0()]).length + 1, n: g.n,
      nDec: ds.filter(d => !d.viewedHint).length, nBest: ds.filter(d => d.loss <= 0.015 && !d.viewedHint).length, nGood: ds.filter(d => d.loss <= 0.05 && !d.viewedHint).length, nHint: ds.filter(d => d.viewedHint).length, avgLoss: ds.length ? ds.reduce((s2, d) => s2 + d.loss, 0) / ds.length : 0,
      worst: worst && worst.loss > 0.03 ? { round: worst.round, t: worst.t, mine: worst.mine, best: worst.best, loss: worst.loss } : null, luck: lk && lk.kind, exp: lk && lk.exp,
      decs: ds.map(d => ({ r: d.round, t: d.t, hand: d.hand.join(','), mine: d.mine, best: d.best, loss: Math.round(d.loss * 1000) / 10 })),
      rv: (() => { try { return (S.lastFacts = rvGameFacts()); } catch (e) { return null; } })(), finalHand: g.hands[me0()].map(c => c.v).join(','), winner: g.winner >= 0 ? (g.winner === me0() ? 'あなた' : nm(g.players[g.winner])) : 'なし' });
    saveSession();
  }
  try { growthOnGame(g); } catch (e) { }
  winOverlay(S.attack ? nextGame : showGameSummary);
  if (S.attack) { const gn = S.gameNo; setTimeout(() => { if (S.attack && !S.attack.over && S.winShow && S.gameNo === gn) act('win-ok'); }, 2600); }
}
function me0() { return S.game.players.findIndex(p => p.human); }
// 上がりの演出（盤は隠さない）→ ボタン1クリックで結果へ
function winOverlay(then) {
  const g = S.game; const me = g.players.findIndex(p => p.human);
  const w = g.winner;
  if (w === me) confetti();
  setTimeout(() => KB.sfx(w === me ? 'win' : w >= 0 ? 'otherWin' : 'round'), 250);
  if (w === me && S.settings.speed !== 'instant') { const mh = missHit(g, me); if (mh) { const gameNo = S.gameNo; setTimeout(() => { if (!S.winShow || S.gameNo !== gameNo) return; say('missLucky', { r: mh.d.round, mine: mh.d.mine, best: mh.d.best, e: mh.win.expr, card: mh.card }); if (S.cm) S.cm.prio = 7; renderGame(); }, 2600); } }
  S.bubbles = {};
  g.players.forEach((p, i) => {
    if (p.human) { if (i === w) S.bubbles[p.id] = { text: 'やった！', at: Date.now() }; return; }
    if (i === w) S.bubbles[p.id] = { text: KB.charLine(p, 'win'), at: Date.now() };
    else if (Math.random() < 0.4 + KB.charTalkRate(p) * 0.5) S.bubbles[p.id] = { text: rivalLose(g, p, w) || (g.pp[i] >= 25 && p.level <= 3 ? (['うわぁ…', 'しまった！', 'まいった…'][(Math.random() * 3) | 0]) : KB.charLine(p, 'lose')), at: Date.now() };
  });
  S.winShow = { then };
  S.thinking = null;
  if (w >= 0) { const lp = g.played[w][g.played[w].length - 1]; S.cm = null; { const lpw = w === me && lp ? lp.cards.map(c => c.v).sort((a, b) => a - b).join(',') : ''; if (lpw === '1,2,6' || lpw === '2,6') { say('namedWin', { name: lpw === '2,6' ? 'ベストペア' : 'ミラクルセット', e: lp.expr }); }
    if (w === me && lp) { const lbl = lpw === '1,2,6' ? 'ミラクルセット！' : lpw === '2,6' ? 'ベストペア！' : lp.cards.length === 3 && lp.expr.includes('÷') ? '割り算フィニッシュ！' : null; if (lbl) setTimeout(() => cutInFx(lbl, lp.expr, lp.t), 350); }
    else say('win', { n: w === me ? 'あなた' : san(nm(g.players[w])), e: lp ? lp.expr : '', checks: true, bigOk: g.played[w].some(x => x.cards.some(c => c.v >= 10)), flexOk: true, countOk: !!lp && lp.cards.length === 3, smallOk: false, winOk: true }); } }
  if (w !== me && S.settings.speed !== 'instant') {
    const pp = g.pp[me], gameNo = S.gameNo;
    setTimeout(() => { if (!S.winShow || S.gameNo !== gameNo) return; const lk = luckInfo(g, me), nw = nearWin(g, me); if (nw && nw.name) say('almostWinBig', { name: nw.name, men: nw.men, cards: nw.cards, pct: Math.round(nw.p * 100) }); else if (nw && (nw.p >= 0.25 || (nw.justBefore && nw.p >= 0.15)) && Math.random() < 0.8) say('almostWin', { pct: Math.round(nw.p * 100), h: nw.n, justBefore: nw.justBefore ? 1 : null }); else if (lk && lk.kind && Math.random() < 0.75) say(lk.kind, { pp, exp: lk.exp }); else if (pp >= 25) say('myBigPP', { pp, checks: true, bigOk: g.hands[me].some(c => c.v >= 10) }); else if (pp <= 6) say('mySmallPP', { pp, checks: true, bigOk: g.played[me].some(x => x.cards.some(c => c.v >= 10)) }); else return; if (S.cm) S.cm.prio = 7; renderGame(); }, 2600);
  }
  renderGame();
  const ws = document.querySelector('.win-strip'); if (ws && ws.scrollIntoView) ws.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function winStripHTML(g, me) {
  const w = g.winner; const wp = w >= 0 ? g.players[w] : null;
  const lp = w >= 0 ? g.played[w][g.played[w].length - 1] : null;
  return `<div class="win-strip" role="status">
    <div class="ws-main"><div class="ws-title">${wp ? esc(w === me ? 'あなた' : nm(wp)) + 'が上がりました！' : '規定の巡数で終了しました'}</div>
    ${lp ? `<div class="ws-play"><span class="pg big">${lp.cards.map(miniCard).join('')}</span><span class="mono">${esc(lp.expr)} = ${lp.t}</span></div>` : ''}</div>
    <div class="ws-btns"><button class="btn primary" data-act="win-ok">${S.attack ? '次のゲームへ' : '結果を見る'}</button>${undoOk() ? '<button class="btn undo-btn" data-act="undo">⏪ 待った</button>' : ''}</div></div>`;
}
// カードが飛ぶ演出（山札→人、人→場）
function flyCard(fromEl, toEl, html, delay, dur, force) {
  if (!fromEl || !toEl || (S.settings.speed === 'instant' && !force)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'flycard'; el.innerHTML = html || '';
  if (!html) el.classList.add('back');
  document.body.appendChild(el);
  const w = 34, h = 48;
  const x0 = a.left + a.width / 2 - w / 2, y0 = a.top + a.height / 2 - h / 2;
  const x1 = b.left + Math.min(b.width / 2, 70) - w / 2, y1 = b.top + Math.min(b.height / 2, 60) - h / 2 + (b.height < 30 ? -12 : 0);
  el.style.left = x0 + 'px'; el.style.top = y0 + 'px';
  const dx = x1 - x0, dy = y1 - y0;
  const anim = el.animate([
    { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 50}px) rotate(200deg) scale(1.15)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px,${dy}px) rotate(360deg) scale(.85)`, opacity: 0.9 }
  ], { duration: dur || 520, delay: delay || 0, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' });
  anim.onfinish = () => { el.remove(); toEl.classList.remove('catch'); void toEl.offsetWidth; toEl.classList.add('catch'); };
}
function flyDraw(pi) { KB.sfx('draw'); flyCard(document.querySelector('.deck'), document.querySelector(`[data-pi="${pi}"]`), null); }
// 出した札は、その人の「出した札」の列へ飛んでいく
function flyPlay(pi, vals) {
  KB.sfx(vals.length === 3 ? 'play3' : 'play', vals.length);
  const seat = document.querySelector(`[data-pi="${pi}"]`); if (!seat) return;
  const groups = seat.querySelectorAll('.played .pg');
  const to = groups[groups.length - 1];
  const from = seat.querySelector('.av') || seat;
  if (!to || S.settings.speed === 'instant') return;
  to.style.visibility = 'hidden';
  vals.forEach((v, k) => flyCard(from, to, `<span>${KB.vname(v)}</span>`, k * 90, 480));
  setTimeout(() => { to.style.visibility = ''; to.classList.add('landed'); }, 480 + (vals.length - 1) * 90);
}
// 上がった人の席に降る紙吹雪
function confettiHTML() {
  const cols = ['#f2b632', '#e64980', '#5ab4ff', '#5bd17a', '#ffd43b', '#9b5de5', '#fffaf0'];
  let s = '';
  for (let k = 0; k < 36; k++) s += `<i style="left:${(Math.random() * 100).toFixed(1)}%;background:${cols[k % cols.length]};animation-delay:${(Math.random() * 2.2).toFixed(2)}s;animation-duration:${(1.6 + Math.random() * 1.2).toFixed(2)}s;width:${5 + (k % 3) * 2}px;height:${8 + (k % 4) * 2}px"></i>`;
  return `<div class="seat-confetti" aria-hidden="true">${s}</div>`;
}
// 新しい場札：山札から大きく飛び出し、卓の中央でめくれてから場に収まる
function dealFieldAnim(f) {
  if (S.settings.speed === 'instant') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const top = document.querySelector('.fieldcard.top'), deck = document.querySelector('.deck'), table = document.querySelector('.table');
  if (!top || !deck || !table) return;
  const t = top.getBoundingClientRect(), d = deck.getBoundingClientRect(), tb = table.getBoundingClientRect();
  const vh = window.innerHeight;
  const cx = tb.left + tb.width / 2, cy = Math.min(Math.max(tb.top + tb.height * 0.42, 140), vh - 140);
  const red = f.s === 1 || f.s === 2;
  const el = document.createElement('div'); el.className = 'dealfly';
  el.style.left = t.left + 'px'; el.style.top = t.top + 'px'; el.style.width = t.width + 'px'; el.style.height = t.height + 'px';
  el.innerHTML = `<div class="df-inner"><div class="df-face df-back"></div><div class="df-face df-front ${red ? 'red' : ''}"><span class="big">${KB.vname(f.v)}</span><span class="val">${KB.SUITS[f.s]} ${f.v}</span></div></div>`;
  document.body.appendChild(el);
  top.style.visibility = 'hidden';
  const dx0 = d.left + d.width / 2 - (t.left + t.width / 2), dy0 = d.top + d.height / 2 - (t.top + t.height / 2);
  const dxc = cx - (t.left + t.width / 2), dyc = cy - (t.top + t.height / 2);
  const sc = Math.min(2.6, (vh * 0.42) / t.height);
  const inner = el.firstChild;
  const dur = S.settings.speed === 'fast' ? 1000 : S.settings.speed === 'slow' ? 1800 : 1400;
  el.animate([
    { transform: `translate(${dx0}px,${dy0}px) scale(.45) rotate(-20deg)` },
    { transform: `translate(${dxc}px,${dyc}px) scale(${sc}) rotate(4deg)`, offset: 0.32 },
    { transform: `translate(${dxc}px,${dyc}px) scale(${sc * 1.05}) rotate(0deg)`, offset: 0.68 },
    { transform: 'translate(0,0) scale(1.12) rotate(0deg)', offset: 0.9 },
    { transform: 'translate(0,0) scale(1) rotate(0deg)' }
  ], { duration: dur, easing: 'cubic-bezier(.3,.8,.3,1)', fill: 'both' });
  inner.animate([
    { transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)', offset: 0.34 },
    { transform: 'rotateY(0deg)', offset: 0.56 }, { transform: 'rotateY(0deg)' }
  ], { duration: dur, easing: 'ease-in-out', fill: 'both' });
  KB.sfx('deal');
  { const rp = S.settings.speed === 'fast' ? 0.85 : S.settings.speed === 'slow' ? 1.5 : 1.15; setTimeout(() => KB.sfx('round'), rp * 1000); }
  const shade = document.createElement('div'); shade.className = 'dealshade'; document.body.appendChild(shade);
  shade.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: dur, fill: 'both' });
  setTimeout(() => { el.remove(); shade.remove(); top.style.visibility = ''; top.classList.add('landed-field'); }, dur);
  S.dealDur = dur;
}
function handBacks(n) {
  const k = Math.min(n, 12);
  return `<span class="backs" aria-hidden="true">${'<i></i>'.repeat(k)}${n > 12 ? `<em>+${n - 12}</em>` : ''}</span>`;
}
function showGameSummary(keep) {
  if (!keep) { if (S.review && S.review.ctl) S.review.ctl.abort(); S.review = null; }
  S.inSummary = true;
  const g = S.game, T = S.T; const me = g.players.findIndex(p => p.human);
  const dsAll = S.decisions, ds = dsAll.filter(d => !d.viewedHint); // AIの読みを見た手は評価に入れない（表には出す）
  const nBest = ds.filter(d => d.loss <= 0.015).length;
  const avgLoss = ds.length ? ds.reduce((a, d) => a + d.loss, 0) / ds.length : 0;
  // 判定の対象外（引くしかない・お手つき）も、表には行として出す
  const fouls = S.fouls || [];
  let di = 0, fi = 0;
  const extraRow = (r, t, mine, best, v, c) => `<div class="dec-row info"><div class="dr-head"><span class="dr-r">第${r}巡・場${t}</span><span class="verdict ${c}">${v}</span></div><div class="dr-moves">${best === '引く' ? `<span class="lab">あなた</span><span class="mono">${esc(mine)}</span>` : `<span class="lab">あなた</span><span class="mono">${esc(mine)}</span><span class="lab">AI</span><span class="mono">${esc(best)}</span>`}</div></div>`;
  const rows = g.log.filter(e => e.p === me && (e.type === 'play' || e.type === 'draw')).map(e => {
    if (e.type === 'draw' && e.foul) { const f = fouls[fi++] || {}; return extraRow(e.round, e.t, `お手つき（${e.vals.map(KB.vname).join('・')}）→${e.n}枚引く`, f.alt || '—', 'お手つき', 'v-bad'); }
    if (e.type === 'draw' && !e.missed) return extraRow(e.round, e.t, '引く（出せる組み合わせなし）', '引く', '—', 'v-none');
    const k = di++; const d = dsAll[k]; if (!d) return '';
    const [v, c] = d.viewedHint ? ['評価外', 'v-none'] : verdict(d);
    return `<div class="dec-row"><div class="dr-head"><span class="dr-r">第${d.round}巡・場${d.t}</span><span class="verdict ${c}">${v}</span>${d.viewedHint ? '<span class="hint-tag">読みあり</span>' : ''}<span class="dr-loss">損失 ${(d.loss * 100).toFixed(1)}pt</span><button class="btn sm why" data-why="${k}" aria-expanded="false">${d.loss > 0.015 ? '理由と候補' : '候補を見る'}</button></div>
    <div class="dr-moves">${d.mine === d.best ? `<span class="lab">あなた＝最善</span><span class="mono">${esc(d.mine)}</span>${d.near ? `<span class="lab">ほぼ互角</span><span class="mono">${esc(d.near)}</span>` : ''}` : `<span class="lab">あなた</span><span class="mono">${esc(d.mine)}</span><span class="lab">最善</span><span class="mono">${esc(d.best)}</span>`}</div>
    <div class="why-row" id="why-${k}" hidden>${whyHTML(d)}</div></div>`;
  }).join('');
  const sorted = g.players.map((p, i) => ({ p, i, pp: g.pp[i] })).sort((a, b) => a.pp - b.pp);
  let comment;
  // 結果が良かったか：上がり、または最後の判断時点の期待PP以下で済んだ
  const lastD = ds[ds.length - 1];
  const resultGood = g.winner === me || (lastD && lastD.mineStats ? g.pp[me] <= lastD.mineStats.pp : g.pp[me] <= 8);
  if (!ds.length && dsAll.length) comment = '判断した手はすべてAIの読みを見たため、このゲームは評価していません。';
  else if (!ds.length) comment = fouls.length ? 'このゲームは判定できる場面がありませんでした（「引く」しかない局面とお手つきのみ）。' : 'このゲームは選択肢のある場面がありませんでした（すべて「引く」しかない局面）。';
  else if (avgLoss < 0.02) comment = resultGood ? `判断はほぼAIの最善手どおりで、結果もついてきました（${ds.length}回中${nBest}回が最善）。` : `判断はほぼAIの最善手どおりでした（${ds.length}回中${nBest}回が最善）。結果は振るいませんでしたが、確率的には正しい打ち方です。`;
  else if (avgLoss < 0.06) comment = `おおむね良い判断です（${ds.length}回中${nBest}回が最善）。差がついた場面を表で確認しましょう。`;
  else comment = `改善の余地があります（${ds.length}回中${nBest}回が最善）。「損失」が大きい巡を見直すのがおすすめです。`;
  { const nh = dsAll.filter(d => d.viewedHint).length; if (nh) comment += ` AIの読みを見た手・待ったでやり直した手（${nh}回）は評価に入れていません。このゲームは結果のバッジの対象外です。`; else if (S.gameHinted) comment += ' AIの読みを見たので、このゲームは結果のバッジの対象外です。'; }
  if (fouls.length) comment += ` お手つきが${fouls.length}回ありました（ペナルティで計${fouls.reduce((a, f) => a + (f.n || 0), 0)}枚）。`;
  const drew = ds.filter(d => d.drew);
  if (drew.length) comment += ` 出せる場面で${drew.length}回あえて引きました（うち最善判定 ${drew.filter(d => d.loss <= 0.015).length}回）。`;
  const last = ds[ds.length - 1];
  const lk0 = luckInfo(g, me);
  if (last && g.winner !== me) comment += ` 最後の判断時点の期待PPは${fx1(last.mineStats.pp)}、実際は${g.pp[me]}でした。`;
  if (lk0 && lk0.kind === 'resultLucky') comment += ' 判断は次善もありましたが、結果は期待より良く「結果オーライ」です。';
  else if (lk0 && lk0.kind === 'resultUnlucky') comment += ' 判断は最善なので、PPが大きかったのは運の巡り合わせです。';
  const head = S.tiebreak ? '' : (T.phase === 'final' ? '決勝' : (T.cfg.kind === 'practice' ? '練習' : `予選 第${T.set}セット`)) + ` 第${T.game}ゲーム`;
  const next = T.game < T.cfg.games ? '次のゲームへ' : 'セット結果へ';
  modal(`${progHTML(T, true) || `<div class="lbl">${esc(head)} 終了</div>`}
  <div class="banner">${g.winner === me ? `${esc(rvName())}の上がり！` : `${esc(rvName())}はこのゲーム${g.pp.filter(x => x < g.pp[me]).length + 1}位`}</div>
  <div class="result-cast">${sorted.map(o => `<div class="pc ${o.i === me ? 'me-pc' : ''}">${av(o.p, moodOf(g, o.i))}<span class="pc-name">${esc(o.i === me ? 'あなた' : nm(o.p))}</span><span class="pc-lab">今回のPP</span><b>${o.pp}</b>${S.tiebreak ? '' : `<span class="pc-set">セット計 <b>${setTotal(T, o.p.id)}</b></span>`}</div>`).join('')}</div>
  <div class="stack" style="gap:6px"><div class="lbl">AIの総括</div><p style="margin:0">${esc(comment)}</p>
  ${rows ? `<div class="dec-list">${rows}</div>
  <p class="small muted" style="margin:0">損失pt＝最善手との総合評価の差（${goalLabel()}を100点満点とし、上がり率と期待PPを少し加味）。1.5pt以内は誤差として最善扱い。</p>` : ''}</div>
  <div id="review-wrap" data-scope="game">${reviewHTML('game')}</div>
  <div class="row" style="justify-content:flex-end"><button class="btn" data-act="peek-board">盤面を見る</button>${S.tiebreak ? '' : '<button class="btn" data-act="standings">順位表</button>'}<button class="btn primary" data-act="next-game">${S.tiebreak ? '続ける' : next}</button></div>`);
}
// 判定が最善以外のとき：AIの最善手とあなたの手を、数字と理由で比べる
function whyHTML(d) {
  const row = (e, label, cls) => {
    const rs = e.m ? KB.reasons(d.counts, e.m, d.unseen) : [`あえて出さずに1枚引く（手札${KB.nCounts(d.counts) + 1}枚に）`, `次の場で出せる確率 ${pct(KB.nextPlayableProb(d.counts, d.unseen))}`];
    if (e.danger > 0.08) rs.push(`次の自分の番までに誰かが上がる確率 ${pct(e.danger)}`);
    return `<div class="cand ${cls}"><div class="top"><span class="rk ${cls === 'best' ? 'r1' : ''}">${label}</span><span class="expr">${e.m ? esc(e.m.expr) + ' = ' + d.t : 'あえて引く'}</span></div>
    <div class="metrics"><div class="metric">${d.goalLbl || goalLabel()}<b>${d.goalLbl ? (d.goalPct ? pct(e.goal) : fx1(e.goal) + '点') : fmtGoal(e.goal)}</b></div><div class="metric">上がる確率<b>${pct(e.win)}</b></div><div class="metric">期待PP<b>${fx1(e.pp)}</b></div><div class="metric">期待順位<b>${fx1(e.rank)}位</b></div></div>
    <ul class="reasons">${rs.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
  };
  const best = d.bestStats, mine = d.mineStats;
  // AIが考えた手（総合評価の順）：最善かどうかに関係なく一覧で見せる
  const allEv = (d.evs || d.top || []).filter(e => e && e.score != null).slice().sort((a, b) => b.score - a.score), evs = allEv.slice(0, 6);
  const isMine = e => (e.m && mine.m) ? e.m.key === mine.m.key : (!e.m && !mine.m);
  // 大会の決勝進出率・優勝率、練習のセット期待点など、目的の値も並べる（そのときの目的で記録しておいた名前を使う）
  // 総合評価の式（totalScore と同じ）：目的の値は「この卓で1位のときの値」を100とする
  const gm = d.goalMax || 1, gm100 = Math.round(gm * 100);
  const gPart = !d.goalLbl ? '' : d.goalPct ? (gm100 >= 100 ? `${d.goalLbl}（%）` : `${d.goalLbl}（%）÷${gm100}×100`) : `${d.goalLbl}×${Math.round(100 / gm * 10) / 10}`;
  const gNote = d.goalLbl && d.goalPct && gm100 < 100 ? `（${gm100}%はこのセットを1位で終えたときの${d.goalLbl}）` : '';
  // 手ごとの判定タグ：1位は最善、差が誤差の範囲（1.5pt。序盤は BEST_LOOSE）なら「最善扱い」、あとは好手・疑問手・悪手
  const tagOf = (e, i) => {
    if (i === 0) return '<em class="t-best">最善</em>';
    const l = evs[0].score - e.score, L = BEST_LOOSE[d.round];
    if (l <= 0.015 || (d.sutemi && d.sutemi.outOk && isOutEv(e)) || (L && (l <= L.loss || (L.pp && e.pp - evs[0].pp <= L.pp && l <= L.cap)))) return '<em class="t-near">最善扱い</em>';
    const [v, c] = verdict({ loss: l }); return `<em class="t-${c}">${v}</em>`;
  };
  // 数字は「見出し／値」の2段で並べる（総合・目的・上がり・期待PP・差）
  const mx = (e, i) => [['総合', (e.score * 100).toFixed(1)], gL && e.goal != null ? [({ 'セット期待点': '期待点', '決勝進出率': '決勝進出', '優勝率': '優勝', '勝ち抜け率': '勝ち抜け' })[gL] || gL, d.goalPct ? pct(e.goal) : fx1(e.goal) + '点'] : null, ['上がり', pct(e.win)], ['期待PP', fx1(e.pp)], ['差', i ? ((evs[0].score - e.score) * 100).toFixed(1) + 'pt' : '—']].filter(Boolean).map(([k, v]) => `<span class="mx"><small>${k}</small><b>${v}</b></span>`).join('');
  const gL = d.goalLbl || null, gTxt = e => gL && e.goal != null ? `${gL} ${d.goalPct ? pct(e.goal) : fx1(e.goal) + '点'}・` : '';
  // 自分の手が6位より下でも、その順位で最後に足して見せる（枠の強調は自分の手）
  const rows = evs.map((e, i) => [e, i]); if (!evs.some(isMine)) { const k = allEv.findIndex(isMine); if (k >= 6) rows.push([allEv[k], k]); }
  const cands = evs.length ? `<div class="cand-list"><div class="lbl">AIが考えた手（総合評価の高い順）</div><div class="small muted" style="margin:-2px 0 4px">総合＝${gPart ? gPart + ' ＋ ' : ''}上がり（%）×0.06 − 期待PP×0.2${gNote}。「最善扱い」＝最善との差が誤差の範囲（${d.round === 1 ? '1巡目は3.5pt以内' : d.round === 2 ? '2巡目は2.0pt以内' : '1.5pt以内'}）</div>${rows.map(([e, i]) => `${i >= 6 ? '<div class="cl-gap">⋮</div>' : ''}<div class="cl-row ${isMine(e) ? 'mine' : ''}"><span class="cl-rk">${i + 1}</span><span class="cl-ex mono">${e.m ? esc(e.m.expr) : 'あえて引く'}</span><span class="cl-tags">${tagOf(e, i)}${isMine(e) ? '<em class="t-mine">あなた</em>' : ''}</span><span class="cl-st cl-mx">${mx(e, i)}</span></div>`).join('')}</div>` : '';
  if (d.loss <= 0.015) return `<div class="why"><p class="small" style="margin:0">手札 [${d.hand.map(KB.vname).join(' ')}]・場 ${d.t}・相手 ${esc(d.danger || '')}</p>${(d.facts || insights(d).map(x => x.root)).map(f => `<p class="small" style="margin:0">・${esc(f)}</p>`).join('')}${cands}</div>`;
  const diffs = [];
  if (best.goal != null && mine.goal != null && best.goal - mine.goal > 0.004) diffs.push(`${goalLabel()}が ${fmtGoal(best.goal - mine.goal)} 高い`);
  if (best.win - mine.win > 0.03) diffs.push(`上がる確率が ${pct(best.win - mine.win)} 高い`);
  if (mine.pp - best.pp > 0.5) diffs.push(`期待PPが ${fx1(mine.pp - best.pp)} 小さい`);
  if (mine.danger - best.danger > 0.03) diffs.push(`相手に先に上がられる危険が小さい`);
  const bestRest = best.m ? KB.sub(d.counts, best.m.vals) : d.counts, mineRest = mine.m ? KB.sub(d.counts, mine.m.vals) : d.counts;
  const pb = KB.nextPlayableProb(bestRest, d.unseen), pm = KB.nextPlayableProb(mineRest, d.unseen);
  if (pb - pm > 0.05) diffs.push(`残る手札で次の場に出せる確率が ${pct(pb)}（あなたの手だと ${pct(pm)}）`);
  return `<div class="why">
    <p class="small" style="margin:0">手札 [${d.hand.map(KB.vname).join(' ')}]・場 ${d.t}・相手 ${esc(d.danger)}</p>
    <p style="margin:0"><b>最善手の方が良い点：</b>${diffs.length ? esc(diffs.join('、')) : '数字の差は小さく、細かな有利の積み重ねです'}。${mine.win - best.win > 0.03 ? `<br><span class="small">（上がる確率だけなら、あなたの手が ${pct(mine.win - best.win)} 上。総合では最善手が上回ります）</span>` : ''}</p>
    <div class="why-grid">${row(best, 'AIの最善', 'best')}${row(mine, 'あなたの手', 'mine')}</div>${cands}</div>`;
}
// 判断の質と結果（運）を分けて判定する
// 惜しかった度合い（プレイヤー目線のひと言用）：ゲーム終了時の手札で、次の番に上がれた可能性
function nearWin(g, me) {
  if (g.winner === me || g.winner < 0) return null;
  const hand = g.hands[me], n = hand.length; if (!n || n > 3) return null;
  const counts = g.counts(me), unseen = g.unseenCounts(me);
  let tot = 0, ok = 0; const ts = [];
  for (let t = 1; t <= 13; t++) { tot += unseen[t]; if (KB.findMoves(counts, t, 'all', 3).some(m => m.n === n)) { ok += unseen[t]; ts.push(t); } }
  const oi = g.order.indexOf(me), wi = g.order.indexOf(g.winner);
  const justBefore = (wi + 1) % g.n === oi; // あなたの番の直前で上がられた
  const w = waitInfo(counts);
  return { n, p: tot ? ok / tot : 0, ts, justBefore, men: ts.length, name: w && w.name, cards: w && w.cards };
}
// ミスが結果的にハマった：最善でない手で残した札が、上がりの式に使われた（最善手なら上がれなかった）
function missHit(g, me) {
  if (g.winner !== me) return null;
  const lp = g.played[me][g.played[me].length - 1]; if (!lp) return null;
  const need = new Array(14).fill(0); lp.cards.forEach(c => need[c.v]++);
  const ds = S.decisions.filter(d => d.round < lp.round && d.loss > 0.015 && d.bestStats && d.bestStats.m);
  for (let k = ds.length - 1; k >= 0; k--) {
    const d = ds[k], counts = d.counts || KB.countsOf(d.hand), rem = KB.sub(counts, d.bestStats.m.vals);
    for (let v = 1; v <= 13; v++) if (Math.min(need[v], counts[v]) > rem[v]) return { d, win: lp, card: KB.vname(v) };
  }
  return null;
}
function luckInfo(g, me) {
  const ds = S.decisions; if (!ds.length) return null;
  const last = ds[ds.length - 1];
  const exp = Math.round(last.mineStats.pp * 10) / 10, pp = g.pp[me];
  const avg = ds.reduce((s, d) => s + d.loss, 0) / ds.length;
  const judge = ds.every(d => d.loss <= 0.015) ? 'best' : avg <= 0.05 ? 'ok' : 'bad';
  const diff = pp - exp, won = g.winner === me;
  let kind = null;
  if (judge !== 'best' && (won || diff <= -3)) kind = 'resultLucky';
  else if (judge === 'best' && diff >= 5) kind = 'resultUnlucky';
  else if (judge === 'best' && (won || diff <= 0)) kind = 'resultBoth';
  else if (judge === 'bad' && diff >= 5) kind = 'resultBad';
  return { exp, pp, judge, diff, won, kind };
}
// ---------- ゲーム後の総括：博士とマサが語る ----------
function reviewHTML(scope) {
  if (S.attack) return ''; // バッジアタック中はAI総括を出さない
  scope = scope || (S.review && S.review.scope) || 'game';
  const r = S.review && S.review.scope === scope ? S.review : null;
  const btn = (who, label) => `<button class="btn ${r && r.who === who ? 'primary' : ''}" data-review="${who}" data-scope="${scope}"><span class="rv-av">${KB.casterSVG(who, 'happy')}</span>${label}</button>`;
  return `<div class="stack" style="gap:8px"><div class="lbl">${scope === 'set' ? (S.T && S.T.phase === 'final' ? '決勝戦の総括を読む' : 'このセットの総括を読む') : 'AI総評を読む'}</div>
  <div class="row">${btn('root', 'ルート博士の総評')}${btn('masa', 'ナニワのマサの総評')}</div>
  ${r ? `<div class="commentary review"><div class="cm-av">${KB.casterSVG(r.who, r.busy ? 'normal' : 'happy')}</div><div class="cm-body"><span class="cm-name">${r.who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span><span class="cm-text">${r.busy ? `<span class="cm-wait">${r.stage === 'check' ? '内容を確認しています' : '考えています'}<span class="dots"><i></i><i></i><i></i></span></span>` : esc(yo(r.text))}</span>${r.simple && !r.busy ? `<span class="rv-simple">${r.simple === 'login' ? '簡易版：ログインしてClaudeの利用を許可すると、Claudeがゲームの内容に合わせて詳しく総括します' : '簡易版：Claudeにつながらなかったため、アプリ内の定型文で表示しています'}</span>` : ''}</div></div>` : ''}</div>`;
}
function rerenderReview() { const el = $('#review-wrap'); if (el) { el.innerHTML = reviewHTML(el.dataset.scope); bindReview(el); } }
function bindReview(root) { root.querySelectorAll('[data-review]').forEach(b => b.onclick = () => readReview(b.dataset.review, b.dataset.scope)); }
// Claudeが使えないときの総括（判定データから組み立てる）
function localReview(who) {
  const g = S.game, me = g.players.findIndex(p => p.human), ds = S.decisions;
  const myPP = g.pp[me], won = g.winner === me;
  const nBest = ds.filter(d => d.loss <= 0.015 && !d.viewedHint).length; // AIの読みを見た手は最善に数えない
  const worst = ds.slice().sort((a, b) => b.loss - a.loss)[0];
  const drew = ds.filter(d => d.drew).length;
  const R = arr => arr[(Math.random() * arr.length) | 0];
  if (who === 'root') {
    let s = won ? `上がりでPP0、見事なゲームでした。` : `このゲームのPPは${myPP}。`;
    s += ds.length ? `選択肢のあった${ds.length}回のうち、最善手は${nBest}回。` : '今回は選択の余地がない局面が続きました。';
    if (worst && worst.loss > 0.03) s += `一番差がついたのは第${worst.round}巡、場${worst.t}の場面です。あなたは「${worst.mine}」、最善は「${worst.best}」。残る札の柔軟さと、手札の合計の減り方が違いました。`;
    else if (ds.length) s += '大きく外した手はなく、判断は安定していました。';
    if (drew) s += `あえて引いた場面が${drew}回ありましたね。`;
    { const mh = missHit(g, me); if (mh) { const c = KB.commentLine('root', 'missLucky', { r: mh.d.round, mine: mh.d.mine, best: mh.d.best, e: mh.win.expr, card: mh.card }); if (c) s += c.text; } }
    { const nw = nearWin(g, me); if (nw && nw.name) s += `${nw.cards}の「${nw.name}」、${nw.men}面待ちでした。これで上がれなかったのは、さすがに不運と言うほかありません。`; else if (nw && nw.p >= 0.2) s += `惜しかったですね。残り${nw.n}枚で、次の番が来ればおよそ${Math.round(nw.p * 100)}%の確率で上がれていました。`; else if (nw && nw.justBefore) s += 'あなたの番の直前で上がられたのは、悔しいところです。'; }
    const lk = luckInfo(g, me);
    if (lk && lk.kind && !missHit(g, me)) s += KB.commentLine('root', lk.kind, { pp: lk.pp, exp: lk.exp }).text.replace(/^(ふむ。|なるほど。|さて、|興味深い。|ここは注目です。|冷静に見ると、|数字で考えると、|ほう。)/, '');
    if (Math.random() < 0.3) s += R(KB.PHILO);
    s += R(['次のゲームでは、大きな場で重い札を処分できているか意識してみましょう。', '次は、出す札より「残す札」で選ぶ意識を持つと、さらに精度が上がります。', '結果に一喜一憂せず、判断の質を積み重ねることが、セットの順位につながります。']);
    return s;
  }
  let s = won ? R(['ゴール決めたな！PP0、文句なしや！', '上がり！ナッツでショーダウンや、最高やな！']) : (myPP >= 25 ? `PP${myPP}か〜、大量失点や！` : `PP${myPP}、まあまあの失点やな！`);
  s += ds.length ? `最善手は${ds.length}回中${nBest}回や！` : '';
  if (worst && worst.loss > 0.03) s += `せやけど第${worst.round}巡、場${worst.t}で「${worst.mine}」はなんでやねん！そこは「${worst.best}」やろ！ハリセンもんやで！`;
  else if (ds.length) s += '大きなミスはなしや、ええディフェンスやったで！';
  { const mh = missHit(g, me); if (mh) { const c = KB.commentLine('masa', 'missLucky', { r: mh.d.round, mine: mh.d.mine, best: mh.d.best, e: mh.win.expr, card: mh.card }); if (c) s += c.text; } }
  { const nw = nearWin(g, me); if (nw && nw.name) s += `なんでやねん！${nw.cards}の${nw.name}、${nw.men}面待ちやで！？それで上がれへんて、神様どないなっとんねん！`; else if (nw && nw.p >= 0.2) s += `いや〜惜しかったな！残り${nw.n}枚、番が来たら${Math.round(nw.p * 100)}%で上がれたのに！`; else if (nw && nw.justBefore) s += '自分の番の直前で上がられるんは、ほんま悔しいな〜！'; }
  const lk = luckInfo(g, me);
  if (lk && lk.kind && !missHit(g, me)) s += KB.commentLine('masa', lk.kind, { pp: lk.pp, exp: lk.exp }).text.replace(/^(おおっと！|よっしゃ！|うわー！|いやー、|ちょっと聞いて！|さあさあ！|えらいこっちゃ！|ほんでな、|おいおい！|きたきた！|まじか！|たまらんな！)/, '');
  s += R(['次はでかい札、早めにベンチに下げていこか！', 'ポーカーと一緒で、読みと我慢が大事や！次いくで！', '前半の失点は後半で取り返せる！切り替えていこ！']);
  return s;
}
async function readReview(who, scope) {
  scope = scope || 'game';
  if (S.review && S.review.busy && S.review.ctl) S.review.ctl.abort();
  // 総評はアプリの判定データから組み立てる（Claudeは使わない）
  { let text = ''; try { text = scope === 'set' ? rvSetSolo(who) : rvGameSolo(who); } catch (e) { text = scope === 'set' ? setLocalReview(who) : localReview(who); } S.review = { who, scope, text, busy: false }; rerenderReview(); return; }
  S.review = { who, scope, text: '', busy: true };
  rerenderReview();
  const local = () => scope === 'set' ? setLocalReview(who) : localReview(who);
  if (!S.sample) { S.review.text = local(); S.review.simple = 'login'; S.review.busy = false; rerenderReview(); return; }
  const persona = who === 'root'
    ? 'あなたは「ルート博士」。フクロウの数学者で、計算ブリッジの理知的で丁寧な解説者です。です・ます調。戦略的な視点で要点を突きます。ごくたまに、数学と心（情緒・直観・美しさ）にまつわる短い哲学的な一言を交えることがあります（入れても1文だけ。実在の人物の言葉の引用はしない）。'
    : 'あなたは「ナニワのマサ」。青いキャップをかぶった大阪弁のツッコミ役で、サッカーとテキサスホールデム・ポーカーが大好きな戦略家です。大阪弁で、鋭いツッコミを交え、サッカーかポーカーのたとえを1つ入れてください。';
  const prompt = scope === 'set' ? `${persona}\n以下のセット結果とプレイヤー（データ上は「あなた」。名前は「${(S.settings.name || 'あなた')}」なので、呼びかけは「${(S.settings.name && S.settings.name !== 'あなた') ? S.settings.name + 'さん' : 'あなた'}」）の各ゲームの判断データをもとに、${S.T.phase === 'final' ? '決勝戦（1セット）' : 'このセット'}の総括を300〜400字で書いてください。セット全体の流れ、良かった点、一番の改善点（具体的なゲーム・巡・手）、そして大会の状況を踏まえた次への指針を入れてください。${S.T.phase === 'final' ? '決勝戦の最終結果（順位）に必ず触れ、大会全体を締めくくる言葉で終えてください。' : (S.T.cfg.kind === 'tournament' && S.T.set === S.T.cfg.sets ? '予選最終セットなので、決勝進出の可否（または同点決定戦の可能性）と、そこに至った要因に必ず触れてください。' : '')}判断の質と結果（運）は分けて評価してください。数値はシミュレーションの推定値です。「PP」（実際にゲーム終了時の手札の合計として付いた点）と「期待PP」（その時点での見込み）は意味が違うので混同せず、見込みの話には必ず「期待PP」「見込み」と書いてください。札を出して減ったのは「手札の合計」です。データに書かれていない事実（手札の中身、札の枚数、順位、出来事など）は推測で書かないでください。見出しや箇条書きは使わず、話し言葉の文章で。\n\n${RULES_TXT}\n\n${setSummaryText()}` : `${persona}\n以下のゲーム結果とプレイヤー（データ上は「あなた」。名前は「${(S.settings.name || 'あなた')}」なので、呼びかけは「${(S.settings.name && S.settings.name !== 'あなた') ? S.settings.name + 'さん' : 'あなた'}」）の判断データをもとに、このゲームの総括を200〜300字で書いてください。良かった点を1つ、改善点を1〜2つ（具体的な巡・場の数・手を挙げて）、次のゲームへの指針を1つ。判断の質（確率的に正しかったか）と結果（運）を分けて評価し、「計算メモ」は検算済みの事実なので戦略的な考察（3枚出しの是非、場の数、残り枚数と待ち、相手の残り枚数など）に活用し、データに「惜しかった点」があれば惜しさに（名前つきの待ちなら特に大げさに）、「ミスが結果的にハマった」があれば判断の評価とは分けて運の良さに、プレイヤーの気持ちに寄り添う目線で1文ほど触れてください。言い回しは場面と口調に合わせて自由に考え、決まり文句の繰り返しは避けてください（データにない出来事は作らないこと）。たとえば判断は次善でも結果が良ければ「結果オーライ」、判断が最善なのに結果が悪ければ「運が悪かっただけ」と触れてください。数値はシミュレーションの推定値です。「PP」（実際にゲーム終了時の手札の合計として付いた点）と「期待PP」（その時点での見込み）は意味が違うので混同せず、見込みの話には必ず「期待PP」「見込み」と書いてください。札を出して減ったのは「手札の合計」です。データに書かれていない事実（手札の中身、札の枚数、順位、出来事など）は推測で書かないでください。見出しや箇条書きは使わず、話し言葉の文章で。\n\n${RULES_TXT}\n\n${summaryText()}`;
  const ctl = new AbortController(); S.review.ctl = ctl;
  const data = scope === 'set' ? setSummaryText() : summaryText();
  try {
    S.review.stage = 'draft';
    // 下書きは表示しない（内容チェックが終わってから表示する）
    const res = await S.sample(prompt, { signal: ctl.signal, cache: false });
    if (S.review && S.review.ctl === ctl) {
      S.review.draft = res.text; S.review.text = res.text; S.review.stage = 'check'; rerenderReview();
      // 矛盾チェック：データと照合し、食い違いがあれば修正版に差し替える
      try {
        const v = await S.sample.json(`次の「データ」と「総括文」を照合してください。総括文の中で、データと矛盾する記述や、データに無いのに断定している具体的な事実（札の数字や枚数、手札の中身、巡の番号、場の数、順位、PP、回数など）を探してください。キャラクターの口調・比喩・感想・一般的な助言は問題にしません。\n返答はJSONのみ：{"issues":["矛盾の説明",...],"fixed":"矛盾を取り除いた総括文（口調と長さはそのまま。矛盾が無ければ元の文のまま）"}\n\nデータ：\n${data}\n\n総括文：\n${res.text}`, { signal: ctl.signal, cache: false });
        if (S.review && S.review.ctl === ctl && v && typeof v.fixed === 'string' && v.fixed.trim()) {
          const n = Array.isArray(v.issues) ? v.issues.length : 0;
          S.review.text = n ? v.fixed : res.text;
          S.review.checked = n ? `内容チェック済み（データと食い違う${n}か所を修正）` : '内容チェック済み（データとの食い違いなし）';
        }
      } catch (e2) { if (S.review && S.review.ctl === ctl) { if (e2 && e2.code === 'cancelled') return; S.review.text = res.text; } }
    }
  } catch (e) {
    if (S.review && S.review.ctl === ctl) {
      if (e && e.code === 'cancelled') return;
      if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled')) S.sample = null;
      S.review.text = local(); S.review.simple = S.sample ? 'error' : 'login';
    }
  }
  if (S.review && S.review.ctl === ctl) { S.review.busy = false; rerenderReview(); }
}
// ---------- セットの総括 ----------
function setContext() {
  const T = S.T, h = T.setHist[T.setHist.length - 1], mine = h.res.find(r => r.id === 0);
  const tableSize = h.res.filter(r => r.table === T.myTable).length;
  const ctx = { phase: T.phase, kind: T.cfg.kind, set: T.set, sets: T.cfg.sets, rank: mine.rank, size: tableSize, pp: mine.pp, pts: mine.pts };
  if (T.cfg.kind === 'tournament' && T.phase === 'prelim') {
    const s = standingsSorted(T), F = T.cfg.finalists, i = s.findIndex(p => p.id === 0);
    ctx.total = T.points[0]; ctx.overall = i + 1; ctx.F = F; ctx.line = T.points[s[F - 1].id];
    ctx.last = T.set === T.cfg.sets;
    const tieAtLine = s[F] && T.points[s[F - 1].id] === T.points[s[F].id] && T.totPP[s[F - 1].id] === T.totPP[s[F].id];
    ctx.qualified = i < F; ctx.tieRisk = !!tieAtLine && (T.points[0] === T.points[s[F - 1].id] && T.totPP[0] === T.totPP[s[F - 1].id]);
    ctx.gap = Math.max(0, ctx.line - ctx.total);
  }
  if (T.phase === 'final') {
    const ids = T.finalists.slice().sort((a, b) => (T.finalPP[a] || 0) - (T.finalPP[b] || 0));
    ctx.finalRank = ids.indexOf(0) + 1; ctx.finalists = ids.length; ctx.finalPP = T.finalPP[0];
    ctx.winnerName = ids[0] === 0 ? 'あなた' : nm(P(ids[0]));
  }
  return ctx;
}
function setSummaryText() {
  const c = setContext(), L = S.T.setLog || [];
  const lines = [];
  lines.push(c.kind === 'practice' ? '練習モード（1セット）' : c.phase === 'final' ? '大会の決勝戦（このセットのPPだけで順位が決まる）' : `大会の予選 第${c.set}/${c.sets}セット${c.last ? '（予選最終セット）' : ''}`);
  lines.push(`あなたのセット結果：卓内${c.rank}位/${c.size}人、セットPP ${c.pp}${c.phase === 'prelim' && c.kind === 'tournament' ? `、獲得 ${c.pts}点` : ''}`);
  const myPPs = (S.T.setPP[0] || []);
  for (let gi = 1; gi <= myPPs.length; gi++) { if (!L.find(x => x.game === gi)) lines.push(`第${gi}ゲーム：PP ${myPPs[gi - 1]}（このゲームの判断データは残っていません）`); }
  for (const x of L) lines.push(`第${x.game}ゲーム：PP ${x.pp}${x.won ? '（上がり）' : ''}${x.finalHand != null ? `、上がった人：${x.winner}、あなたの最後の手札[${x.finalHand || 'なし'}]` : ''}、ゲーム内${x.rank}位、判断 ${x.nDec}回中最善${x.nBest}回${x.luck ? '、' + { resultLucky: '結果オーライ（次善だが結果良好）', resultUnlucky: '判断は最善だが不運', resultBoth: '判断・結果とも良好', resultBad: '判断の差が結果にも出た' }[x.luck] : ''}${x.worst ? `、最大の差：第${x.worst.round}巡 場${x.worst.t} あなた「${x.worst.mine}」/最善「${x.worst.best}」` : ''}${(x.fouls || []).length ? `、お手つき${x.fouls.length}回（${x.fouls.join('／')}）` : ''}${(x.decs || []).length ? '\n  判断の内訳：' + x.decs.map(d => `第${d.r}巡 場${d.t} 手札[${d.hand}] あなた「${d.mine}」 最善「${d.best}」 損失${d.loss}pt`).join('／') : ''}`);
  if (c.kind === 'tournament' && c.phase === 'prelim') {
    lines.push(`予選の総合：${c.total}点で${c.overall}位、決勝ライン（${c.F}位）は${c.line}点。`);
    if (c.last) lines.push(c.qualified ? (c.tieRisk ? '決勝ライン上で同点のため、決定戦の可能性あり。' : '決勝進出が決定。') : `決勝進出ならず（ラインまで${c.gap}点）。`);
  }
  if (c.phase === 'final') lines.push(`決勝の最終結果：あなたは${c.finalists}人中${c.finalRank}位（決勝PP ${c.finalPP}）。優勝は${c.winnerName}。`);
  return lines.join('\n');
}
function setLocalReview(who) {
  const c = setContext(), L = S.T.setLog || [];
  const nDec = L.reduce((s, x) => s + x.nDec, 0), nBest = L.reduce((s, x) => s + x.nBest, 0);
  const wins = L.filter(x => x.won).length;
  const worstG = L.filter(x => x.worst).sort((a, b) => b.worst.loss - a.worst.loss)[0];
  const lucky = L.filter(x => x.luck === 'resultLucky').length, unlucky = L.filter(x => x.luck === 'resultUnlucky').length;
  const best = L.slice().sort((a, b) => a.pp - b.pp)[0], worstPP = L.slice().sort((a, b) => b.pp - a.pp)[0];
  const R = arr => arr[(Math.random() * arr.length) | 0];
  if (who === 'root') {
    let s = c.phase === 'final' ? `決勝戦、お疲れさまでした。あなたは${c.finalists}人中${c.finalRank}位、決勝PPは${c.finalPP}でした。` : `このセットは卓内${c.rank}位、セットPPは${c.pp}でした。`;
    s += `上がりは${wins}回、判断は${nDec}回中${nBest}回が最善です。`;
    if (best && worstPP && L.length > 1 && best.game !== worstPP.game) s += `一番良かったのは第${best.game}ゲーム（PP ${best.pp}）、苦しかったのは第${worstPP.game}ゲーム（PP ${worstPP.pp}）。`;
    if (worstG) s += `最も差がついたのは第${worstG.game}ゲーム第${worstG.worst.round}巡、場${worstG.worst.t}で「${worstG.worst.mine}」を選んだ場面です。最善は「${worstG.worst.best}」でした。`;
    if (unlucky) s += `判断は最善なのに不運だったゲームが${unlucky}回ありました。結果ほど内容は悪くありません。`;
    if (lucky) s += `逆に、結果オーライのゲームも${lucky}回。運に助けられた分は割り引いて考えましょう。`;
    if (c.kind === 'tournament' && c.phase === 'prelim') s += c.last ? (c.qualified ? (c.tieRisk ? '決勝ライン上で同点です。決定戦に備えましょう。' : `予選${c.overall}位で決勝進出です。おめでとうございます。決勝では予選の得点がリセットされます。安定してPPを抑えることを意識しましょう。`) : `予選は${c.overall}位、決勝ラインまで${c.gap}点及びませんでした。PPを1ゲームあたり2〜3点下げられれば、届く差です。`) : `予選の総合は${c.overall}位（${c.total}点）。決勝ラインは${c.line}点です。${c.overall <= c.F ? '圏内を守る打ち方を続けましょう。' : '次のセットは卓内上位を狙って、攻めの比重を少し増やしましょう。'}`;
    if (c.phase === 'final') s += c.finalRank === 1 ? '見事な優勝です。予選から通して、判断の質が結果に結びつきました。' : `優勝は${c.winnerName}。この経験を、次の大会の糧にしましょう。`;
    if (Math.random() < 0.5) s += R(KB.PHILO);
    if (c.kind === 'practice') s += R(['次のセットでも、大きい札の早めの処分を意識しましょう。', '判断の質を積み重ねれば、セットの順位は自然と上がっていきます。']);
    return s;
  }
  let s = c.phase === 'final' ? `決勝お疲れさん！${c.finalists}人中${c.finalRank}位、決勝PP${c.finalPP}や！` : `このセット、卓内${c.rank}位でセットPP${c.pp}や！`;
  s += `上がり${wins}回、最善手は${nDec}回中${nBest}回やで！`;
  if (worstG) s += `せやけど第${worstG.game}ゲームの第${worstG.worst.round}巡、場${worstG.worst.t}で「${worstG.worst.mine}」はなんでやねん！「${worstG.worst.best}」やろ！`;
  if (unlucky) s += `内容最善やのに不運やったゲームが${unlucky}回、バッドビートや、気にせんでええ！`;
  if (lucky) s += `結果オーライが${lucky}回、ツキもあったな〜！`;
  if (c.kind === 'tournament' && c.phase === 'prelim') s += c.last ? (c.qualified ? (c.tieRisk ? 'ライン上で同点や！決定戦、気合い入れていこか！' : `予選${c.overall}位で決勝進出や！ファイナルテーブルやで、おめでとさん！決勝は得点リセットや、ここからが本番やで！`) : `予選${c.overall}位、ラインまで${c.gap}点…惜しかったな〜！1ゲーム2、3点PP減らしたら届く差や、次は絶対いけるで！`) : `総合は${c.overall}位（${c.total}点）、ラインは${c.line}点や！${c.overall <= c.F ? '圏内キープ、このまま逃げ切りや！' : '次のセットで巻き返しや、攻めていこか！'}`;
  if (c.phase === 'final') s += c.finalRank === 1 ? '優勝や〜！ワールドカップ掲げたれ！最高や！' : `優勝は${c.winnerName}や。悔しいけど、ここまで来たんは立派やで！次はてっぺん取ろな！`;
  if (c.kind === 'practice') s += R(['次のセットもいこか！でかい札は早めにベンチや！', 'ええ練習やったで！判断の積み重ねが本番で生きるんや！']);
  return s;
}
// ---------- AI総評（博士とマサの掛け合い）：判定データだけで組み立てる ----------
// 事実はすべてアプリの判定から取る（データにないことは言わない）
const RVP = a => a[(Math.random() * a.length) | 0];
const rvName = () => { const n = S.settings.name; return n && n !== 'あなた' ? san(n) : 'あなた'; };
const rvTier = (a, i) => a[5] ? a[5][i] : a[2].length === 1 ? 2 : Math.min(i, 2);
const RV_CAT_KEYS = ['oppNear', 'oppThree', 'endgame', 'heavy', 'bigField', 'smallField', 'bestThree', 'bestOne', 'leaveOne', 'drawChoice', 'hardExpr', 'opening'];
// 苦手の傾向 → 勧める練習
const RV_PRACTICE = {
  hardExpr: ['hunt', '式ハンター', '割り算やかっこの式は、式ハンターで手になじませるのがいちばんの近道です。'],
  bestThree: ['hunt', '式ハンター', '3枚で作れる式をすばやく見つける力は、式ハンターで鍛えられます。'],
  endgame: ['outs', 'アウツチャレンジ', '終盤は「次の番で上がれる札（アウツ）」の数で残す札を選びます。アウツチャレンジで数える練習をしておきましょう。'],
  leaveOne: ['outs', 'アウツチャレンジ', '何を残すと待ちが広いかは、アウツチャレンジで確かめるのが効果的です。'],
  oppNear: ['practice', '1セット練習', '相手が残り少ない場面は、1セット練習で「AIの読み」の期待PPを見比べて、失点を抑える感覚をつかみましょう。'],
  oppThree: ['practice', '1セット練習', '相手が残り3枚のころの判断は、1セット練習でAIの読みと見比べるのが近道です。'],
  heavy: ['practice', '1セット練習', '手札が重いときの処分の仕方は、1セット練習でAIの読みの3枚出し候補を確かめてみましょう。'],
  bigField: ['practice', '1セット練習', '大きい場で何をまとめて出すか、1セット練習でAIの読みと見比べてみましょう。'],
  smallField: ['hunt', '式ハンター', '小さい場で大きい札を絡める引き算・割り算は、式ハンターで覚えると強いです。'],
  bestOne: ['practice', '1セット練習', 'あえて1枚だけ出す判断は、1セット練習でAIの読みの「残る形」を見るとつかめます。'],
  drawChoice: ['practice', '1セット練習', '出すか引くかの見極めは、1セット練習でAIの読みの「あえて引く」の評価を見てみましょう。'],
  opening: ['practice', '1セット練習', '序盤の形づくりは、1セット練習でAIの読みの候補を見比べると身につきます。']
};
// この間に取ったバッジ・冠と、それでもらえたアバターアイテム
function rvEarned(t0) {
  const g = G_(), out = [], items = [];
  Object.keys(g.ach).forEach(id => {
    const at = g.ach[id]; if (typeof at !== 'number' || at < t0) return;
    if (id.startsWith('cat:')) { const gi = +id.split(':')[1], cat = ACH_GROUPS[gi][0]; out.push({ cat: true, name: CAT_SPECIAL[cat], group: cat }); (CROWN_SETS[cat] || []).forEach(k => items.push(avItemName(k))); return; }
    const [k, t] = id.split(':'), a = ACH.find(x => x[0] === k); if (!a) return; const i = a[2].map(String).indexOf(t); if (i < 0) return;
    out.push({ name: a[4][i], series: a[1], tier: ['銅', '銀', '金'][rvTier(a, i)] });
    if (i === a[2].length - 1) Object.keys(AV_LOCK).forEach(lk => { if (AV_LOCK[lk].badge === k) items.push(avItemName(lk)); });
  });
  return { badges: out, items };
}
// あと少しで取れるバッジ
function rvNear(snap) {
  const g = G_(), out = [], skip = ['set_low', 'rating', 'atk_done', 'atk_bp', 'atk_badges', 'zukan', 'zukan_cat', 'outs3', 'outs4', 'outs5'];
  const practice = !S.T || S.T.cfg.kind !== 'tournament'; // 練習では大会のバッジに触れない
  ACH.forEach(a => {
    const k = a[0]; if (skip.includes(k)) return; if (practice && MB_TOUR.includes(k)) return;
    const c = k === 'sutemi' ? Math.min(g.cnt.aete || 0, 10) : (g.cnt[k] || 0);
    // このゲーム（セット）で回数が進んだ系統だけ（同じ話の繰り返しを避ける）
    const c0 = snap && snap.cnt ? (k === 'sutemi' ? Math.min(snap.cnt.aete || 0, 10) : (snap.cnt[k] || 0)) : null; if (c0 == null || c <= c0) return;
    for (let i = 0; i < a[2].length; i++) {
      const t = a[2][i]; if (g.ach[k + ':' + t]) continue; if (k === 'sutemi' && t > 10) break;
      const left = t - c; if (c > 0 && left > 0 && (left <= 2 || left / t <= 0.2)) out.push({ name: a[4][i], series: a[1], tier: ['銅', '銀', '金'][rvTier(a, i)], left });
      break;
    }
  });
  return out.sort((x, y) => x.left - y.left).slice(0, 2);
}
// 自己ベストの比べ元
function rvSnap() { const g = G_(), c = g.cnt || {}; let r = null; try { const x = ratingOf(g.games); r = x.ok ? x.r : null; } catch (e) { } return { streakMax: c.streakMax || 0, setLow: c.set_low || 0, rating: r, games: (g.games || []).length, cnt: Object.assign({}, c) }; }
function rvPB(snap) {
  if (!snap) return [];
  const g = G_(), c = g.cnt || {}, out = [];
  if ((c.streakMax || 0) > snap.streakMax && c.streakMax >= 3) out.push({ k: 'streak', v: c.streakMax });
  if ((c.set_low || 0) > snap.setLow && snap.setLow > 0) out.push({ k: 'setLow', v: 100 - c.set_low });
  try { const x = ratingOf(g.games); if (x.ok && snap.rating != null && x.r - snap.rating >= 0.1) out.push({ k: 'rating', v: x.r, from: snap.rating }); } catch (e) { }
  return out;
}
const rvTopCat = (mc, min) => { const e = Object.entries(mc || {}).sort((a, b) => b[1] - a[1])[0]; return e && e[1] >= min ? { k: e[0], n: e[1] } : null; };
const rvBadgeList = b => b.map(x => x.cat ? `冠「${x.name}」` : `「${x.name}」（${x.series}・${x.tier}）`).join('、');

// 判断の要点（ゲーム終わりに作って、セットの総評でも使う）
// 残った手札の形：枚数・合計・（3枚以下なら）次に上がれる場
function rvShape(C, m) {
  const rem = m ? KB.sub(C, m.vals) : C.slice(), n = KB.nCounts(rem), sum = KB.sumCounts(rem), vals = [];
  for (let v = 1; v <= 13; v++) for (let k = 0; k < rem[v]; k++) vals.push(v);
  let outs = null;
  if (n >= 1 && n <= 3) { outs = []; for (let t = 1; t <= 13; t++) if (KB.findMoves(rem, t, 'all', 3).some(x => x.n === n)) outs.push(t); }
  return { n, sum, outs, vals: vals.map(KB.vname).join('・'), drew: !m };
}
const rvOutsTxt = o => o.length ? `${o.length}通り（${o.map(KB.vname).join('・')}）` : 'なし';
function rvGameFacts() {
  const g = S.game, me = g.players.findIndex(p => p.human), all = S.decisions || [], ds = all.filter(d => !d.viewedHint);
  const f = { pp: g.pp[me], won: g.winner === me, n: g.n, rank: g.pp.filter(x => x < g.pp[me]).length + 1, nDec: ds.length, nBest: ds.filter(d => d.loss <= 0.015).length, nGood: ds.filter(d => d.loss <= 0.05).length, nHint: all.length - ds.length, round: g.round, kind: S.T && S.T.cfg.kind };
  let run = 0, best = 0; ds.forEach(d => { if (d.loss <= 0.015) { run++; best = Math.max(best, run); } else run = 0; }); f.run = best;
  if (g.kanataOn) { const k = g.kanataIdx; f.kanata = { round: g.kanataAt, won: g.winner === k, beat: g.pp[me] < g.pp[k] || f.won }; }
  // 分かれ道を損の大きい順に3つまで。最善手と自分の手で、残る形も比べる
  f.misses = ds.filter(d => d.loss > 0.03).sort((a, b) => b.loss - a.loss).slice(0, 3).map(d => {
    let gf = null; try { gf = gapFact(d); } catch (e) { }
    const C = d.counts || KB.countsOf(d.hand); let sm = null, sb = null;
    try { sm = rvShape(C, d.mineStats && d.mineStats.m); sb = rvShape(C, d.bestStats && d.bestStats.m); } catch (e) { }
    return { round: d.round, t: d.t, mine: d.mine, best: d.best, loss: d.loss, gf, sm, sb, cats: (d.cats || catsOf(d)).filter(c => RV_CAT_KEYS.includes(c)) };
  });
  f.worst = f.misses[0] || null;
  // 名場面（良かった手）を2つまで
  const hl = [];
  ds.forEach(d => {
    if (d.loss > 0.015) return;
    if (d.sutemi && d.sutemi.chose) hl.push({ k: 'sutemi', p: 5, d });
    else if (d.drew && d.best === 'あえて引く') hl.push({ k: 'aete', p: 3, d });
    else if (/÷/.test(d.mine) && /\(/.test(d.mine)) hl.push({ k: 'divParen', p: 4, d });
    else if (/÷/.test(d.mine) && divPraise(d.mine, (d.mine.match(/\d+/g) || []).length)) hl.push({ k: 'div', p: 3, d }); // 7÷7・÷1・2枚の割り算はほめない
    else if (d.mineStats && d.mineStats.m && d.mineStats.m.n === 3 && d.mineStats.m.vals.some(v => v >= 11)) hl.push({ k: 'three', p: 2, d });
    else if ((d.cats || []).includes('bestOne')) hl.push({ k: 'one', p: 3, d });
    else if ((d.cats || []).includes('oppNear')) hl.push({ k: 'defend', p: 2, d });
  });
  if (f.nDec >= 3 && f.nBest === f.nDec) hl.push({ k: 'perfect', p: 6 });
  else if (f.run >= 4) hl.push({ k: 'run', p: 4 });
  if (f.won && g.round <= 3) hl.push({ k: 'fast', p: 4 });
  hl.sort((a, b) => b.p - a.p);
  const seen = new Set(); f.hl = hl.filter(h => { const key = h.k + (h.d ? h.d.round : ''); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 2).map(h => ({ k: h.k, round: h.d && h.d.round, t: h.d && h.d.t, mine: h.d && h.d.mine }));
  f.nSutemi = ds.filter(d => d.sutemi && d.sutemi.chose && d.loss <= 0.015).length; f.nAete = ds.filter(d => d.drew && d.best === 'あえて引く' && d.loss <= 0.015).length;
  // 外した手の傾向
  const miss = ds.filter(d => d.loss > 0.03); f.nMiss = miss.length; f.missCats = {};
  miss.forEach(d => (d.cats || catsOf(d)).forEach(c => { if (RV_CAT_KEYS.includes(c)) f.missCats[c] = (f.missCats[c] || 0) + 1; }));
  // 巡ごとの流れ（序盤・中盤・終盤）
  const ph = { early: [], mid: [], late: [] };
  ds.forEach(d => { const n = d.hand.length; (d.round <= 2 ? ph.early : n <= 4 ? ph.late : ph.mid).push(d); });
  f.flow = Object.entries(ph).filter(([, a]) => a.length).map(([k, a]) => ({ k, n: a.length, best: a.filter(d => d.loss <= 0.015).length, r0: a[0].round, r1: a[a.length - 1].round, s0: a[0].hand.reduce((x, y) => x + y, 0), c0: a[0].hand.length, c1: a[a.length - 1].hand.length, s1: a[a.length - 1].hand.reduce((x, y) => x + y, 0) }));
  // 相手の動き：誰かが残り2枚以下になってからの判断
  const dn = all.find(d => (d.opps || []).some(o => o.h <= 2));
  if (dn) { const o = dn.opps.filter(x => x.h <= 2).sort((a, b) => a.h - b.h)[0], after = ds.filter(d => d.round >= dn.round); f.danger = { round: dn.round, who: san(o.n), h: o.h, n: after.length, best: after.filter(d => d.loss <= 0.015).length, sum: dn.hand.reduce((x, y) => x + y, 0) }; }
  // 打ち方のクセ（AIの最善と比べる）
  const st = { m3: 0, b3: 0, m1: 0, b1: 0, mDraw: 0, bDraw: 0 };
  ds.forEach(d => { const mm = d.mineStats && d.mineStats.m, bm = d.bestStats && d.bestStats.m; if (!mm) st.mDraw++; else if (mm.n === 3) st.m3++; else if (mm.n === 1) st.m1++; if (!bm) st.bDraw++; else if (bm.n === 3) st.b3++; else if (bm.n === 1) st.b1++; });
  f.style = st;
  f.secs = ds.filter(d => d.secs != null).map(d => d.secs); f.avgSecs = f.secs.length ? f.secs.reduce((a, b) => a + b, 0) / f.secs.length : null;
  try { const lk = luckInfo(g, me); f.luck = lk && lk.kind; f.exp = lk && lk.exp; } catch (e) { }
  try { const mh = missHit(g, me); if (mh) f.missHit = { round: mh.d.round, mine: mh.d.mine, best: mh.d.best, e: mh.win.expr, card: mh.card }; } catch (e) { }
  try { const nw = nearWin(g, me); if (nw) f.near = { n: nw.n, p: nw.p, name: nw.name, cards: nw.cards, men: nw.men }; } catch (e) { }
  f.winner = g.winner >= 0 && g.winner !== me ? san(nm(g.players[g.winner])) : null;
  f.winnerRound = g.winner >= 0 ? g.round : null;
  f.beatStar = !!(f.won && g.players.some(p => !p.human && p.level >= 5));
  f.finalHand = g.hands[me].map(c => KB.vname(c.v)).join('・');
  return f;
}
// 最近の自分との比較（今回の分を除いた直近20ゲーム）
function rvRecent(skip) {
  const gs = (G_().games || []).slice(0, Math.max(0, (G_().games || []).length - skip)).slice(-20);
  let n = 0, b = 0; gs.forEach(x => x.ds.forEach(d => { if (d.h) return; n++; if (d.l <= 0.015) b++; }));
  const cs = catStats(gs).filter(c => c.n >= 5 && RV_CAT_KEYS.includes(c.k)).sort((a, c) => c.bad - a.bad)[0];
  return { games: gs.length, n, rate: n ? b / n : null, weak: cs && cs.bad >= 0.3 ? cs : null };
}

// ---------- 語り口の部品（毎回ちがう言い方になるよう、たくさん用意する） ----------
// マサ：サッカーとポーカーのたとえ（総評に毎回いちど以上入れる）
const MASA_NETA = {
  win: ['ゴール決めたらスタジアム総立ちや！', 'リバーでナッツ完成、ショーダウンで全部持っていったな！', 'ラストパスからの一撃、ゴラッソや！', 'オールインが通った瞬間の気持ちよさやな！'],
  lose: ['試合には負けたけど、内容で負けたとは限らんで。', 'ポーカーでも負けたハンドから学ぶのが本物のプロや。', 'アウェーの洗礼やな。次はホームで取り返そ！', 'チップは減っても、席に座っとる限りチャンスはあるで！'],
  good: ['今のは完全にファンタジスタのプレーや！', 'ブラフ見抜いてコールしたみたいな、ええ読みや！', 'ノールックパスや、相手もびっくりしとるで！', 'ワンタッチで裏抜けたみたいな、ええ判断や！'],
  // 速く・まとめて減らした場面（速攻・3枚出し・最善の連続）。「待つ」たとえ（スロープレイ・コール）は使わない
  goodFast: ['ワンタッチで裏抜けて、そのままゴールや！', 'カウンター一発、相手の守備が戻る前に決めたな！', 'ナッツでいきなりオールイン、相手は降りるしかないで！', 'キックオフから一気に攻め込んだ、電光石火のゴールや！'],
  // 待つ・こらえる場面（あえて引く・あえて1枚・捨て身）
  goodWait: ['ナッツ持ってじっくり待った、ええスロープレイや！', 'ポットオッズ計算して正しくコールしたプロの判断や！', 'ボール回して相手を動かしてから仕掛ける、大人のサッカーや！', 'あわてて打たんと、ええタイミングまで溜めたな！'],
  bad: ['キーパーと1対1で外したようなもんや！', 'ポケットエース持ってフォールドしたようなもんやで！', 'オフサイドトラップに見事にかかったな〜！', 'リバーで余計なコールしてもうたパターンや！', '自陣でのバックパス、危なっかしいで〜！', 'ティルトしとらんか？深呼吸や！'],
  // 外し方の種類に合うたとえ：出せたのに引いた（＝降りた）／引くべきところで出した（＝余計に勝負した）／出す手の選び違い
  badDraw: ['ポケットエース持ってフォールドしたようなもんやで！', 'シュートチャンスでバックパスや、もったいない！', 'ええ手で降りてもうたな、ポーカーやったら泣くとこや！'],
  badPlay: ['リバーで余計なコールしてもうたパターンや！', '慌ててシュート打って、カウンター食らうパターンや！', '待つとこで勝負に行ってもうたな、ここは我慢やったで！'],
  badPick: ['キーパーと1対1で外したようなもんや！', 'オフサイドトラップに見事にかかったな〜！', 'パスの出し先、ちょっとズレとったな！', 'もっと強い役が見えとったのに、見落としたな！'],
  // 判断は良かったのに結果が出なかったとき（結果より判断をたたえ、気持ちを前に向ける）
  // 判断にも課題が残った負け（「内容で負けたとは限らん」は使わない）
  losePoor: ['ポーカーでも負けたハンドから学ぶのが本物のプロや。', 'アウェーの洗礼やな。次はホームで取り返そ！', 'チップは減っても、席に座っとる限りチャンスはあるで！'],
  goodLose: ['確率どおりに打てとるなら、結果は気にせんでええで！ポーカーのプロはそこしか見とらん！', '気を取り直して前に進むのみや！ええシュート打ち続けとったら、ゴールは必ず来る！', '正しいコールで負けるのもポーカーや。判断は胸張ってええで！', '内容で押しとった試合や。スコアは気にせんと、次のキックオフや！'],
  luckBad: ['バッドビートや！ポーカーやったら卓叩いてもええレベルや！', 'ポストに3回当たる日もあるんや、気にせんとこ！', 'リバーで逆転されるのもポーカーや。内容は勝っとったで！', '審判が見とらんかっただけや、内容は勝ちや！'],
  luckGood: ['ラッキーゴールもゴールはゴールや！でも次も入るとは限らんで！', 'ガットショットが刺さったな！せやけど毎回は来えへんで！', 'オウンゴールでもらった1点みたいなもんやな！', 'ランナーランナーで完成したみたいなもんや、反省会は必要やで！'],
  tend: ['ポーカーでもリーク（弱点）は同じとこに出るんや。そこ塞いだら一気に勝てるで！', '同じサイドばっかり破られとる。守備の穴はそこや！', 'テルが出とるで！相手に読まれる前に直しとこ！', 'セットプレーの守備みたいに、型を決めといたら崩れへん！'],
  practice: ['居残り練習や！どんな名ストライカーも最初はリフティングからやで！', 'プロのポーカーは家でハンド検討しとるんや。練習あるのみや！', '練習は裏切らん！次の試合で結果出そ！', 'シュート練習100本や！…まあ1セットでええけど！'],
  flow: ['前半と後半で別のチームみたいやな！', 'ハーフタイムで修正できるかが勝負の分かれ目や！', 'スタックが減ってから慌てるのが一番あかんのや。'],
  style: ['監督目線で言うたら、戦術の傾向がはっきり出とるで！', 'プレースタイルってのはクセでもあり武器でもあるんや！'],
  defend: ['ゴール前を固める判断、ディフェンスの基本や！', 'チップを守る降り方も、立派な技術や！']
};
// 博士：数学と心のたとえ
const ROOT_NETA = {
  good: ['数学で言えば、補助線を一本引いたら全体が見えたような一手です。', '等式の両辺がぴたりと釣り合ったときのような、気持ちの良い判断でした。', '場合の数を丁寧に数えた人だけが選べる手です。', 'エレガントな証明は短い。この手にも無駄がありませんでした。'],
  bad: ['期待値は、一回ごとの結果よりも、同じ判断を繰り返したときの平均で考えます。', '数学でも、最初の一行の置き方で証明の長さが変わります。', '小さな差も、積み重なれば大きな差になります。等比数列の怖さです。'],
  luck: ['確率は一回の結果を約束しません。それでも、判断の正しさは確率の側にあります。', 'サイコロに記憶はありません。次のゲームはまた新しい試行です。'],
  tend: ['誤りにも規則性があります。規則性が見えれば、直し方も見えてきます。', 'つまずく場所が分かったのは収穫です。問題が分かれば、半分は解けたも同然です。'],
  flow: ['数列の増減を見るように、判断の質の推移を眺めてみましょう。']
};
function rvNeta(who, k) { const T = who === 'root' ? ROOT_NETA : MASA_NETA, a = T[k] || (/^good/.test(k) ? T.good : /^bad/.test(k) ? T.bad : null); return a ? RVP(a) : ''; }
// 名場面の種類に合うたとえの棚（速攻にスロープレイ、のような食い違いを防ぐ）
const rvBadNeta = w => w.mine === 'あえて引く' ? 'badDraw' : w.best === 'あえて引く' ? 'badPlay' : 'badPick';
const rvGoodNeta = k => k === 'defend' ? 'defend' : ['fast', 'three', 'run'].includes(k) ? 'goodFast' : ['aete', 'one', 'sutemi'].includes(k) ? 'goodWait' : 'good';
// 判断の質（結果とは別に見る）：good=確率どおりに打てた / poor=最善が半分未満 / mid / none=選ぶ場面なし
const rvQual = (n, b, g) => !n ? 'none' : (b / n >= 0.75 || (g / n >= 0.85 && b / n >= 0.5)) ? 'good' : b / n < 0.5 ? 'poor' : 'mid';
const RV_PHASE = { early: '序盤', mid: '中盤', late: '終盤' };

// 1ゲームの総評（博士・マサそれぞれの語り口で）
function rvGameSolo(who) {
  const f = S.lastFacts || rvGameFacts(), L = [], rt = who === 'root', nmY = rvName();
  let sec = 'result'; const B = (r, m) => { const t = rt ? r : m; if (t) L.push({ sec, t }); }, N = k => { const t = rvNeta(who, k); if (t) L.push({ sec, t, neta: !rt }); };
  // 1. 結果
  // 結果と判断は分けて評価する（大事なのは確率に基づいて選べたか）
  const q = rvQual(f.nDec, f.nBest, f.nGood);
  if (f.won && (q === 'good' || q === 'none')) B(RVP([`上がりでPP0。${nmY}、見事なゲームでした。`, `${nmY}の上がりです。PP0、完璧な締めくくりでした。`, `第${f.round}巡で上がり切りました。PP0です。`]) + (q === 'good' ? '結果だけでなく、判断も確率に沿っていました。' : ''), RVP([`${nmY}、上がりや！PP0、ゴール決めたで！`, `よっしゃ、${nmY}の上がりや！文句なしや！`, `PP0や！${nmY}、今日の主役はあんたや！`]) + (q === 'good' ? '中身もちゃんと伴っとる、これがほんまの勝ちや！' : ''));
  else if (f.won && q === 'poor') B(RVP([`上がりでPP0。結果は満点です。ただ、最善を外した手が多く、上がれたのには運の後押しもありました。`, `${nmY}の上がりです。結果は良かったのですが、判断には課題が残りました。結果と判断は分けて振り返りましょう。`]), RVP([`${nmY}、上がりや！PP0！…せやけど最善外した手も多いで。ラッキーやった分もあるな！`, `上がりや！運も実力のうちやからな！ただ中身はまだ伸ばせるで！`]));
  else if (f.won) B(`${nmY}の上がりです。PP0。最善を外した手もいくつかあったので、そこは結果と切り離して振り返りましょう。`, `${nmY}、上がりや！PP0！外した手もちょっとあったから、そこは振り返っとこな！`);
  else if (q === 'good') B(RVP([`このゲームのPPは${f.pp}、${f.n}人中${f.rank}位でした。`, `PPは${f.pp}で、${f.n}人中${f.rank}位という結果です。`]) + (f.winner ? `上がったのは${f.winner}で、第${f.winnerRound}巡でした。` : '') + (f.luck === 'resultUnlucky' ? '' : '結果は伴いませんでしたが、判断は確率に沿っていました。大事なのはそちらです。'), RVP([`${nmY}、PP${f.pp}の${f.rank}位や。せやけど判断はしっかりしとった、結果は気にせんでええで！`, `PP${f.pp}で${f.n}人中${f.rank}位か。点は取られたけど、打ち方は間違うてへん。気を取り直して前に進むのみや！`]) + (f.winner ? `${f.winner}に第${f.winnerRound}巡で上がられたんは、巡り合わせや。` : ''));
  else B(RVP([`このゲームのPPは${f.pp}、${f.n}人中${f.rank}位でした。`, `PPは${f.pp}で、${f.n}人中${f.rank}位という結果です。`]) + (f.winner ? `上がったのは${f.winner}で、第${f.winnerRound}巡でした。` : ''), (f.pp >= 25 ? RVP([`PP${f.pp}か〜、${nmY}、今回は大量失点やな…`, `うわ〜PP${f.pp}、ゴール前でボコボコにされたな${nmY}！`]) : RVP([`PP${f.pp}で${f.n}人中${f.rank}位やな。`, `${nmY}、PP${f.pp}の${f.rank}位や。`])) + (f.winner ? `${f.winner}に第${f.winnerRound}巡で上がられてもうた。` : ''));
  if (!rt) { N(f.won ? (q === 'poor' ? 'luckGood' : 'win') : (q === 'good' ? 'goodLose' : q === 'poor' ? 'losePoor' : 'lose')); }
  if (f.beatStar) B('★5の達人がいる卓での上がりです。価値ある一勝ですね。', 'しかも★5の達人がおる卓で上がったんやで！ジャイアントキリングや！');
  if (f.nDec) B(`選択肢のあった${f.nDec}回のうち、最善手は${f.nBest}回${f.nGood > f.nBest ? `、好手まで含めると${f.nGood}回` : ''}でした。${f.nHint ? `（AIの読みを見た${f.nHint}回は数えていません）` : ''}`, `最善手は${f.nDec}回中${f.nBest}回${f.nGood > f.nBest ? `、好手入れたら${f.nGood}回` : ''}や！${f.nBest === f.nDec && f.nDec >= 2 ? (f.nDec >= 4 ? 'ハットトリックどころの騒ぎやないで！' : f.nDec === 3 ? '3本とも決めた、ハットトリックや！' : '2本とも枠に飛ばしたで！') : ''}`);
  else if (f.nHint) B(`選択肢のあった${f.nHint}回は、すべてAIの読みを見てから打ったので、採点には入れていません。次は自分の読みで打って、答え合わせに使いましょう。`, `選べる場面は${f.nHint}回とも、AIの読みを見てから打ったな！練習試合はそれでええ、次は自分の読みで勝負や！`);
  else B('今回は選択の余地がない局面が続きました。', '今回は選ぶとこがほとんどなかったな！配られたカードで勝負するしかない日もあるんや。');
  sec = 'flow'; // 2. 流れ（序盤・中盤・終盤）
  if (f.flow && f.flow.length >= 2) {
    const parts = f.flow.map(p => `${RV_PHASE[p.k]}（第${p.r0}${p.r1 !== p.r0 ? `〜${p.r1}` : ''}巡）は${p.n}回中${p.best}回が最善`);
    B(`流れを見ると、${parts.join('、')}でした。` + (f.flow[0].s0 ? `手札の合計は、最初の判断のとき${f.flow[0].s0}（${f.flow[0].c0}枚）でした。` : ''), `流れで言うたら、${parts.join('、')}や。`);
    const fl = f.flow, a = fl[0], z = fl[fl.length - 1];
    if (a.n >= 2 && z.n >= 2 && a.n + z.n >= 5 && Math.abs(a.best / a.n - z.best / z.n) >= 0.5) { /* 数回だけで「尻上がり」などと言わない */ B(a.best / a.n > z.best / z.n ? '序盤は良かったのに、後半で判断が揺れました。終盤ほど一手の重みが増します。' : '序盤は手探りでしたが、後半にかけて判断が冴えていきました。', a.best / a.n > z.best / z.n ? '前半は良かったのに後半バテたな！' : '尻上がりや！後半はキレッキレやったで！'); N('flow'); }
  }
  sec = 'hl'; // 3. 名場面（良かった手を2つまで）
  (f.hl || []).forEach((h, i) => {
    sec = i ? 'hlMore' : 'hl';
    const pre = i ? RVP(['もう一つ、', 'それから、', 'ほかにも、']) : RVP(['光ったのは', '見事だったのは', '特筆したいのは']);
    const preM = i ? RVP(['あと、', 'それに、', 'ほんで、']) : RVP(['まず褒めさせて！', 'ここはほめとくで！', 'ええとこから言うで！']);
    const R = {
      sutemi: `${pre}第${h.round}巡、場${h.t}で上がりを見送った判断です。上がると相手に有利な形で終わる場面では、あえて続けて相手に札を抱えさせる方が得になります。`,
      aete: `${pre}第${h.round}巡、出せるのにあえて引いた判断です。目先の1枚より、次の場に対応できる形を残しました。`,
      divParen: `${pre}第${h.round}巡、場${h.t}を「${h.mine}」で作った手です。思いつきにくい式ほど、大きい札をまとめて処分できます。`,
      div: `${pre}第${h.round}巡の「${h.mine}」。割り算を使うと、大きい札を場に合わせて処分できます。`,
      three: `${pre}第${h.round}巡の「${h.mine}」。大きい札を含む3枚出しで、一気に手札を軽くしました。`,
      one: `${pre}第${h.round}巡、あえて1枚だけ出した「${h.mine}」。札を残して次の場に備える、気づきにくい好手です。`,
      defend: `${pre}第${h.round}巡、相手が残り少ない場面での「${h.mine}」。失点を抑える最善手でした。`,
      perfect: `${pre}、${f.nDec}回の判断がすべて最善だったことです。結果に関係なく、内容は満点です。`,
      run: `${pre}、最善手が${f.run}回続いたことです。判断が安定している証拠です。`,
      fast: `${pre}、第${f.round}巡という早い上がりです。序盤から無駄なく札を減らせていました。`
    }[h.k];
    const M = {
      sutemi: `${preM}第${h.round}巡、上がれるのに上がらんかったやろ！捨て身や！`, aete: `${preM}第${h.round}巡、出せるのにあえて引いた我慢、しびれたで！`, divParen: `${preM}第${h.round}巡の「${h.mine}」、かっこ付きの割り算や！`, div: `${preM}第${h.round}巡の「${h.mine}」、割り算きれいに決めたな！`, three: `${preM}第${h.round}巡の「${h.mine}」、重い札まとめて3枚や！`, one: `${preM}第${h.round}巡、あえて1枚だけの「${h.mine}」！渋い！`, defend: `${preM}第${h.round}巡、相手リーチの場面で「${h.mine}」、失点を抑える最善手や！ナイスディフェンス！`, perfect: `${preM}判断ぜんぶ最善やて！？パーフェクトゲームや！`, run: `${preM}最善手${f.run}連続や！流れ掴んどったで！`, fast: `${preM}第${f.round}巡で上がりや！速攻カウンターやな！`
    }[h.k];
    B(R, M); if (i === 0) N(rvGoodNeta(h.k));
  });
  sec = 'miss'; // 4. 分かれ道（損の大きい順に3つまで。最善手と「○%→○%」、残る形の違い）
  f.misses.forEach((w, i) => {
    sec = i ? 'missMore' : 'miss';
    const gf = w.gf, why = rvWhy(w, who);
    const rHead = i === 0 ? RVP([`一番差がついたのは第${w.round}巡、場${w.t}で「${w.mine}」を選んだ場面です。`, `最大の分かれ道は第${w.round}巡、場${w.t}です。選んだのは「${w.mine}」でした。`]) : RVP([`次に差がついたのは第${w.round}巡、場${w.t}の「${w.mine}」です。`, `第${w.round}巡、場${w.t}の「${w.mine}」も惜しい判断でした。`]);
    const mHead = i === 0 ? RVP([`せやけど第${w.round}巡、場${w.t}で「${w.mine}」はなんでやねん！`, `一番言いたいのはここや。第${w.round}巡の場${w.t}、「${w.mine}」はちゃうやろ〜！`]) : RVP([`ほんで第${w.round}巡の「${w.mine}」もな！`, `第${w.round}巡、場${w.t}の「${w.mine}」もツッコませて！`]);
    // 3つ目からは短く：同じ型の説明をくり返さず、最善手だけを添える（前と同じ選び方なら「また」とまとめる）
    if (i >= 2) { const same = f.misses.slice(0, i).some(x => x.mine === w.mine);
      const sh = gf && gf.sh ? `（${gf.sh}）` : '';
      B(`第${w.round}巡（場${w.t}）の「${w.mine}」も、最善は「${w.best}」でした${sh}。`, same ? `第${w.round}巡でもまた「${w.mine}」や。同じ形の取りこぼしやで、そこは「${w.best}」${sh}！` : `第${w.round}巡の「${w.mine}」も、ほんまは「${w.best}」やったで${sh}！`); return; }
    const mHead2 = i === 1 && f.misses[0].mine === w.mine ? `しかも第${w.round}巡でもまた「${w.mine}」や！` : mHead;
    B(rHead + (gf ? gf.root : `最善は「${w.best}」でした。`) + why, mHead2 + (gf ? gf.masa : `そこは「${w.best}」やろ！`) + why);
    if (i === 0) N(rvBadNeta(w));
  });
  if (!f.misses.length && f.nDec >= 2) B('大きく外した手はなく、判断は安定していました。', '大きなミスはなしや。ええディフェンスやったで！');
  sec = 'danger'; // 5. 相手の動き
  if (f.danger && !f.won) B(`第${f.danger.round}巡には${f.danger.who}が残り${f.danger.h}枚になりました。そのとき${nmY === 'あなた' ? 'あなた' : nmY}の手札の合計は${f.danger.sum}。${f.danger.n ? `そこからの判断${f.danger.n}回のうち、最善は${f.danger.best}回です。` : 'そこからは選ぶ余地のない手番が続きました。'}相手が残り少ないときは、上がりより失点を減らす手が優先になりやすい局面です。`, `第${f.danger.round}巡で${f.danger.who}が残り${f.danger.h}枚、リーチや！そのとき手札の合計${f.danger.sum}やったからな。${f.danger.n ? `そこからの${f.danger.n}回で最善は${f.danger.best}回や。` : 'そこからは選べる手がなかったな。'}相手がゴール前におるときは、まず失点を防ぐんやで！`);
  else if (f.danger && f.won) B(`第${f.danger.round}巡には${f.danger.who}が残り${f.danger.h}枚でしたが、競り勝ちました。`, `${f.danger.who}が残り${f.danger.h}枚まで迫っとったのに、競り勝ったな！`);
  sec = 'style'; // 6. 打ち方のクセ
  const st = f.style;
  if (f.nDec >= 3) {
    const notes = [], notesM = [];
    if (st.b3 - st.m3 >= 2) { notes.push(`3枚出しはAIの最善で${st.b3}回だったのに対し、選んだのは${st.m3}回。もっと3枚でまとめてよい場面がありました`); notesM.push(`3枚出しがAIの${st.b3}回に対して${st.m3}回や。もっと強気にまとめてええで`); }
    else if (st.m3 - st.b3 >= 2) { notes.push(`3枚出しを${st.m3}回選びましたが、AIの最善では${st.b3}回。3枚にこだわって形を崩した場面がありました`); notesM.push(`3枚出し${st.m3}回、AIは${st.b3}回や。なんでもかんでもシュート打ったらあかんで`); }
    if (st.mDraw - st.bDraw >= 2) { notes.push(`引いたのは${st.mDraw}回で、AIの最善では${st.bDraw}回。出せる場面で引きすぎています`); notesM.push(`引いたん${st.mDraw}回、AIは${st.bDraw}回や。チェックばっかりやと主導権取られるで`); }
    else if (st.bDraw - st.mDraw >= 1 && st.bDraw >= 2) { notes.push(`AIは${st.bDraw}回「あえて引く」を選びましたが、引いたのは${st.mDraw}回。出さずに待つ選択肢も意識しましょう`); notesM.push(`AIは${st.bDraw}回あえて引いとるのに、${st.mDraw}回や。待つのも技術やで`); }
    if (notes.length) { B(`打ち方の傾向も見てみます。${notes.join('。')}。`, `プレースタイルの話もしとこか。${notesM.join('。')}！`); if (!rt) N('style'); }
    sec = 'secs'; if (f.avgSecs != null && f.secs.length >= 3) B(`1手あたりの考える時間は平均${f.avgSecs.toFixed(1)}秒でした。${f.avgSecs <= 6 ? '速さと正確さが両立できています。' : f.avgSecs >= 20 ? 'じっくり考えた分、判断の質で取り返しましょう。' : ''}`, `1手平均${f.avgSecs.toFixed(1)}秒や。${f.avgSecs <= 6 ? '速い！カウンターのスピードやな！' : f.avgSecs >= 20 ? 'じっくり派やな、長考もポーカーでは武器やで！' : 'ええテンポや！'}`);
  }
  sec = 'tend'; // 7. 傾向（外した手の偏り）と、最近の自分との比較
  const tc = rvTopCat(f.missCats, 2);
  if (tc) { B(`外した手を見ると、「${CATS[tc.k]}」の場面が${tc.n}回ありました。${CAT_INFO[tc.k] ? CAT_INFO[tc.k][1] : ''}`, `外したんは「${CATS[tc.k]}」の場面ばっかり${tc.n}回や。`); N('tend'); }
  sec = 'recent'; const rc = rvRecent(1);
  if (rc.rate != null && rc.n >= 10 && f.nDec >= 3) {
    const now = f.nBest / f.nDec, d = now - rc.rate;
    if (Math.abs(d) >= 0.15) B(`直近${rc.games}ゲームの最善率${Math.round(rc.rate * 100)}%と比べると、今回は${Math.round(now * 100)}%。${d > 0 ? 'いつもより冴えていました。' : '今回は少し崩れました。'}`, `いつもの最善率${Math.round(rc.rate * 100)}%に対して今回${Math.round(now * 100)}%や。${d > 0 ? '絶好調やな！' : '今日はちょっと調子悪かったな。'}`);
    if (rc.weak && f.missCats[rc.weak.k]) B(`「${rc.weak.label}」は、最近の苦手な場面でもあります（外す割合${Math.round(rc.weak.bad * 100)}%）。今回も同じところで外しています。`, `「${rc.weak.label}」は最近ずっと苦手やねん（外す割合${Math.round(rc.weak.bad * 100)}%）。今回もそこや！`);
    else if (rc.weak && !f.missCats[rc.weak.k] && f.nDec >= 4) B(`最近の苦手だった「${rc.weak.label}」では、今回は外していません。克服が進んでいます。`, `最近苦手やった「${rc.weak.label}」、今回はノーミスや！克服してきとるで！`);
  }
  sec = 'kanata'; // 奥義「絶対透視」が発動したゲーム：上がりより、被害をどこまで抑えたか
  if (f.kanata) {
    const K = f.kanata;
    if (f.won) B(`第${K.round}巡にカナタの「絶対透視」が発動したゲームで、上がり切りました。すべてを見通す相手より先に上がるのは、確率の上では大きな番狂わせです。`, `カナタの絶対透視が出たゲームで上がったやて！？ 全部見えとる相手からゴール奪うて、ジャイアントキリングや！`);
    else B(`第${K.round}巡にカナタの「絶対透視」が発動しました。上がりの可能性は残っていますが、カナタが先に上がる確率は大きく上がります。上がりを狙いつつ、上がられたときに備えて大きい札から処分しておくのが有力です。PP${f.pp}${f.pp <= 15 ? 'は、よく抑えました' : 'でした。大きい札から先に処分しておくと、上がられたときの被害を小さくできます'}。`, `第${K.round}巡でカナタの絶対透視や！ まだゴールは狙えるけど、カナタに先に決められる確率はグンと上がるんや。守備も固めながらやで。PP${f.pp}${f.pp <= 15 ? '、ようしのいだで！' : '、でかい札から先に逃がしとこな！'}`);
  }
  sec = 'luck'; // 8. 運と実力
  if (f.missHit) { B(`第${f.missHit.round}巡で最善を外して残した${f.missHit.card}が、最後の「${f.missHit.e}」に使われました。結果には助けられましたが、その手自体は最善ではありません。`, `第${f.missHit.round}巡で残した${f.missHit.card}が、最後の「${f.missHit.e}」にハマったんや！ミスが結果オーライやな〜。`); N(rt ? 'luck' : 'luckGood'); }
  else if (f.near && f.near.name) { B(`最後の手札は${f.near.cards}の「${f.near.name}」、${f.near.men}面待ちでした。これで上がれなかったのは、不運と言うほかありません。`, `${f.near.cards}の「${f.near.name}」、${f.near.men}面待ちやったのに上がれへんて、神様どないなっとんねん！`); N(rt ? 'luck' : 'luckBad'); }
  else if (f.near && f.near.p >= 0.2) B(`残り${f.near.n}枚、次の番が来ればおよそ${Math.round(f.near.p * 100)}%で上がれる形でした。惜しいところで相手に先を越されました。`, `残り${f.near.n}枚で${Math.round(f.near.p * 100)}%の確率で上がれる形やったのに、先越されたな〜！`);
  else if (f.luck === 'resultUnlucky') { B(`判断はすべて最善だったのに、PPは見込み（${f.exp}）より多くなりました。札運が悪かっただけで、内容は良好です。`, `内容は最善やのに、見込み${f.exp}より失点しとる。札運だけや、気にせんでええで！`); N(rt ? 'luck' : 'luckBad'); }
  else if (f.luck === 'resultLucky') { B('最善を外した手もありましたが、結果はうまくまとまりました。結果オーライの分は割り引いて考えましょう。', '結果オーライやな！ラッキーやっただけや、次は判断で取りにいこ！'); N(rt ? 'luck' : 'luckGood'); }
  sec = 'final'; if (!f.won && f.finalHand) B(`最後に残った手札は${f.finalHand}でした。`, '');
  sec = 'badges'; // 9. バッジ・アイテム・自己ベスト
  const ea = rvEarned(S.gameT0 || Date.now());
  if (ea.badges.length) B(`このゲームで${rvBadgeList(ea.badges)}を獲得しました。${ea.items.length ? `アバターの${ea.items.slice(0, 6).join('・')}も使えるようになっています。` : ''}`, `それと、このゲームで${rvBadgeList(ea.badges)}を取ったで！${ea.items.length ? `アバターの${ea.items.slice(0, 6).join('・')}も使えるようになったな！` : ''}`);
  sec = 'pb'; rvPB(S.pbSnap).forEach(p => { if (p.k === 'streak') B(`連続最善の自己ベストを${p.v}回に更新しました。`, `連続最善の自己ベスト、${p.v}回に更新や！記録更新、ゴールパフォーマンスしてええで！`); });
  sec = 'near'; const nb = rvNear(S.pbSnap);
  if (nb.length) B(`あと${nb[0].left}回で「${nb[0].name}」（${nb[0].series}・${nb[0].tier}）に届きます。${nb[1] ? `「${nb[1].name}」（${nb[1].series}）もあと${nb[1].left}回です。` : ''}`, `あと${nb[0].left}回で「${nb[0].name}」（${nb[0].series}・${nb[0].tier}）や！${nb[1] ? `「${nb[1].name}」もあと${nb[1].left}回やで！` : 'もうひと押しや！'}`);
  sec = 'next'; // 10. 次の課題
  const pr = tc && RV_PRACTICE[tc.k];
  if (pr) { B(pr[2], `${pr[1]}で鍛えてみよか！`); N('practice'); }
  else B(RVP(['次のゲームでも、残す札の形と手札の合計を意識していきましょう。', '結果に一喜一憂せず、判断の質を積み重ねることが、セットの順位につながります。', '次は、出す札より「残す札」で選ぶ意識を持つと、さらに精度が上がります。']), RVP(['次はでかい札、早めにベンチに下げていこか！', '読みと我慢や！次いくで！', '切り替えていこ！次のキックオフや！']));
  return rvAssemble(L, who, RV_W_GAME, ['result', 'miss', 'badges', 'next']);
}
// なぜ最善手が良いのか：残る札の形で比べる
function rvWhy(w, who) {
  const a = w.sm, b = w.sb; if (!a || !b) return '';
  const rt = who === 'root';
  if (b.n === 0) return '';
  // 最善が「あえて引く」：札は増えるが、形を保つ
  if (b.drew) return rt ? RVP(['ここは出すより、引いて手札の形を保つ方が得でした。', '出せる札があっても、出すと次の場に合わせにくい形が残る場面でした。']) : RVP(['出したらええってもんちゃう、我慢の場面やったんや！', 'ここはチェックで様子見が正解やったんや！']);
  // 最善の方が待ちが広い
  if (a.outs && b.outs && b.outs.length > a.outs.length) return rt ? `最善手なら残りは${b.vals}で、次に上がれる場が${rvOutsTxt(b.outs)}。選んだ手だと残りは${a.vals}で${rvOutsTxt(a.outs)}でした。` : `最善やったら残り${b.vals}で上がれる場が${b.outs.length}通り、選んだ手やと${a.vals}で${a.outs.length}通りや。待ちの広さが全然ちゃうで！`;
  if (a.drew) return rt ? `引くと手札は${a.n + 1}枚に増え、合計${a.sum}点分も手元に残ります。最善手なら残り${b.n}枚・合計${b.sum}でした。` : `引いたら${a.n + 1}枚に増えて合計${a.sum}も抱えたままや。最善やったら残り${b.n}枚・合計${b.sum}やで！`;
  // 最善の方が軽い
  if (b.sum <= a.sum - 5 || (b.n < a.n && b.sum <= a.sum)) return rt ? `残る手札で比べると、最善手は${b.n}枚・合計${b.sum}、選んだ手は${a.n}枚・合計${a.sum}です。重い札を残すほど、上がられたときの失点が大きくなります。` : `残りで言うたら、最善は${b.n}枚で合計${b.sum}、選んだ手は${a.n}枚で合計${a.sum}や。重い荷物抱えたままやと走られへんで！`;
  // 最善の方が札は残るが、形が良い
  if (b.n > a.n) return rt ? `最善手は札を多めに残しますが、残る${b.vals}の方が次の場に合わせやすい形でした。` : `最善は札を多めに残すけど、${b.vals}の方が次の場で使いやすいんや。`;
  return '';
}
// セットの総評（博士・マサそれぞれの語り口で）
function rvSetSolo(who) {
  const c = setContext(), Lg = S.T.setLog || [], L = [], rt = who === 'root', nmY = rvName();
  let sec = 'result'; const B = (r, m) => { const t = rt ? r : m; if (t) L.push({ sec, t }); }, N = k => { const t = rvNeta(who, k); if (t) L.push({ sec, t, neta: !rt }); };
  const F = Lg.map(x => x.rv);
  const nHintS = Lg.reduce((s, x) => s + (x.nHint || 0), 0), nDec = Lg.reduce((s, x) => s + (x.nDec || 0), 0), nBest = Lg.reduce((s, x) => s + (x.nBest || 0), 0), nGood = Lg.reduce((s, x) => s + (x.nGood || 0), 0), wins = Lg.filter(x => x.won).length;
  // 1. 結果
  if (c.phase === 'final') B(`決勝戦、お疲れさまでした。${c.finalists}人中${c.finalRank}位、決勝PPは${c.finalPP}でした。`, c.finalRank === 1 ? `優勝や〜！${nmY}、ワールドカップ掲げたれ！` : `決勝お疲れさん！${c.finalists}人中${c.finalRank}位、決勝PP${c.finalPP}や！`);
  else B(RVP([`このセットは卓内${c.rank}位、セットPPは${c.pp}でした。`, `セットの結果は卓内${c.rank}位、PP${c.pp}です。`]), c.rank === 1 ? `${nmY}、このセット卓内1位や！セットPP${c.pp}、ええ仕事したな！` : `このセット、卓内${c.rank}位でセットPP${c.pp}やな。`);
  const sq = rvQual(nDec, nBest, nGood), top1 = c.rank === 1 || c.finalRank === 1;
  if (top1 && sq === 'poor') B('ただ、最善を外した手も多く、順位には運の後押しもありました。結果と判断は分けて振り返りましょう。', `…せやけど最善外した手も多いで。運も実力のうちやからな！中身はここから伸ばそ！`);
  else if (!top1 && sq === 'good') B('順位は伸びませんでしたが、判断は確率に沿っていました。結果はばらつきます。大事なのは、選び方が正しかったかどうかです。', `せやけど判断はしっかり確率どおりや。結果は気にせんでええで！`);
  if (!rt) N(top1 ? (sq === 'poor' ? 'luckGood' : 'win') : (sq === 'good' ? 'goodLose' : sq === 'poor' ? 'losePoor' : 'lose'));
  if (!nDec && nHintS) B(`上がりは${wins}回。選択肢のあった${nHintS}回は、すべてAIの読みを見てから打ったので採点していません。`, `上がり${wins}回や！選べる場面は全部AIの読みを見とったから、採点はなしや。次は自分の読みでいこか！`); else if (!nDec) B(`上がりは${wins}回。採点の対象になる判断はありませんでした。`, `上がり${wins}回や！採点する場面はなかったけど、結果は結果や！`); else B(`上がりは${wins}回、判断は${nDec}回中${nBest}回が最善${nGood > nBest ? `、好手まで含めると${nGood}回` : ''}です${nDec ? `（最善率${Math.round(nBest / nDec * 100)}%）` : ''}。`, `上がり${wins}回、最善手は${nDec}回中${nBest}回やで！`);
  sec = 'games'; // 2. ゲームごとの一言
  if (Lg.length) {
    const one = (x, f) => {
      const res = x.won ? '上がり' : `PP${x.pp}（${x.rank}位）`;
      let note = '';
      if (f && f.hl && f.hl[0]) { const h = f.hl[0]; note = { sutemi: '捨て身が光った', aete: 'あえて引くが光った', divParen: `「${h.mine}」が光った`, div: `「${h.mine}」が光った`, three: '3枚出しで一気に軽くした', one: 'あえて1枚が渋かった', defend: '相手リーチをしのいだ', perfect: '全手最善', run: `最善${f.run}連続`, fast: '速攻の上がり' }[h.k] || ''; }
      if (f && f.worst && (!note || f.worst.loss > 0.1)) note = x.won ? `ただ第${f.worst.round}巡の「${f.worst.mine}」は改善の余地` : `第${f.worst.round}巡の「${f.worst.mine}」が痛手`;
      if (!note && x.luck === 'resultUnlucky') note = '内容最善も不運';
      return `第${x.game}ゲームは${res}${note ? '、' + note : ''}`;
    };
    const lines = Lg.map((x, i) => one(x, F[i]));
    // マサは博士と同じ一覧を繰り返さず、スコアボード＋いちばん良かった／苦しかったゲームだけを語る
    let mz = null;
    if (!rt) {
      const board = Lg.map(x => x.won ? '上がり' : 'PP' + x.pp).join('→');
      const sc = x => x.won ? -1 : x.pp, srt = Lg.slice().sort((a, b) => sc(a) - sc(b)), bestG = srt[0], worstG = srt[srt.length - 1];
      mz = `スコアボードは${board}や。`;
      if (Lg.length > 1 && bestG !== worstG) {
        const bi = Lg.indexOf(bestG), wi2 = Lg.indexOf(worstG), fw = F[wi2];
        mz += bestG.won ? `ベストゲームは上がった第${bestG.game}ゲームや！` : `いちばん粘れたんは第${bestG.game}ゲーム、PP${bestG.pp}で${bestG.rank}位や。`;
        mz += `逆に苦しかったんは第${worstG.game}ゲーム、PP${worstG.pp}や。` + (fw && fw.worst ? `第${fw.worst.round}巡の「${fw.worst.mine}」が分かれ目やったで（最善は「${fw.worst.best}」${fw.worst.gf && fw.worst.gf.sh ? `、${fw.worst.gf.sh}` : ''}）。` : fw && fw.nDec ? '大きな判断ミスはなかった、巡り合わせのゲームや。' : worstG.nHint ? 'AIの読みを見ながら打ったゲームやな。' : '選ぶ場面がほとんどなかったゲームや。');
      }
    }
    B(`ゲームごとに振り返ると、${lines.join('。')}。`, mz);
  }
  sec = 'flow'; // 3. 流れ（前半と後半）
  if (Lg.length > 1) {
    const half = Math.floor(Lg.length / 2), rate = a => { const d = a.reduce((s, x) => s + (x.nDec || 0), 0); return d ? a.reduce((s, x) => s + (x.nBest || 0), 0) / d : null; };
    const r1 = rate(Lg.slice(0, half)), r2 = rate(Lg.slice(half));
    if (r1 != null && r2 != null && Math.abs(r2 - r1) >= 0.2) { B(r2 > r1 ? `後半は最善率が${Math.round(r1 * 100)}%から${Math.round(r2 * 100)}%に上がりました。尻上がりの内容です。` : `後半は最善率が${Math.round(r1 * 100)}%から${Math.round(r2 * 100)}%に下がりました。集中を保つことも実力のうちです。`, r2 > r1 ? `後半は最善率${Math.round(r1 * 100)}%→${Math.round(r2 * 100)}%や！尻上がりやったな！` : `後半ちょっと息切れやな。最善率${Math.round(r1 * 100)}%→${Math.round(r2 * 100)}%や。`); N('flow'); }
  }
  sec = 'hl'; // 4. 名場面
  const allHl = []; F.forEach((f, i) => f && (f.hl || []).forEach(h => allHl.push(Object.assign({ game: Lg[i].game }, h))));
  const order = ['perfect', 'sutemi', 'divParen', 'run', 'fast', 'aete', 'one', 'div', 'defend', 'three'], top = allHl.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k))[0];
  const nSut = F.reduce((s, f) => s + ((f && f.nSutemi) || 0), 0), nAete = F.reduce((s, f) => s + ((f && f.nAete) || 0), 0);
  if (top) {
    const where = top.round ? `第${top.game}ゲーム第${top.round}巡の` : `第${top.game}ゲームの`;
    const rTxt = { perfect: `${where}全手最善は見事でした。`, sutemi: `${where}上がりを見送った捨て身は、このセットの白眉です。`, divParen: `${where}「${top.mine}」、かっこ付きの割り算は見事でした。`, run: `${where}最善手の連続は、判断の安定を示しています。`, fast: `${where}速い上がりは、序盤の札の減らし方が良かった証拠です。`, aete: `${where}あえて引いた判断は、目先にとらわれない好判断でした。`, one: `${where}あえて1枚だけ出した判断は、気づきにくい好手です。`, div: `${where}「${top.mine}」の割り算は最善でした。`, defend: `${where}相手が残り少ない場面での「${top.mine}」は、失点を抑える最善手でした。`, three: `${where}「${top.mine}」で重い札をまとめて処分できました。` }[top.k];
    const mTxt = { perfect: `${where}判断ぜんぶ最善、パーフェクトゲームや！`, sutemi: `${where}捨て身、上がれるのに見送ったやつ！しびれたで！`, divParen: `${where}「${top.mine}」、かっこ割り算や！`, run: `${where}最善の連続、流れ掴んどったな！`, fast: `${where}速攻の上がり、カウンター決まったな！`, aete: `${where}あえて引いた我慢、ええ判断やったで！`, one: `${where}あえて1枚、渋すぎるで！`, div: `${where}「${top.mine}」、割り算きれいに決めたな！`, defend: `${where}相手リーチの場面で「${top.mine}」、失点を抑えるナイスディフェンスや！`, three: `${where}「${top.mine}」で重い札まとめて処分、ナイスや！` }[top.k];
    B(rTxt, mTxt); N(rvGoodNeta(top.k));
    sec = 'hlMore'; if (nSut || nAete) B(`このセットでは、${nSut ? `上がりを見送る捨て身の最善が${nSut}回` : ''}${nSut && nAete ? '、' : ''}${nAete ? `出せるのにあえて引く最善が${nAete}回` : ''}ありました。目先の1枚にとらわれない判断ができています。`, `${nSut ? `捨て身${nSut}回` : ''}${nSut && nAete ? '、' : ''}${nAete ? `あえて引く${nAete}回` : ''}、我慢のできる打ち手になってきたな！`);
  }
  sec = 'miss'; // 5. 分かれ道（セット全体で損の大きい順に2つ）
  const ws = []; F.forEach((f, i) => f && (f.misses || []).forEach(w => ws.push(Object.assign({ game: Lg[i].game }, w))));
  ws.sort((a, b) => b.loss - a.loss).slice(0, 2).forEach((w, i) => {
    sec = i ? 'missMore' : 'miss';
    const why = rvWhy(w, who);
    B((i ? `次に大きかったのは第${w.game}ゲーム第${w.round}巡、場${w.t}の「${w.mine}」です。` : `最も差がついたのは第${w.game}ゲーム第${w.round}巡、場${w.t}で「${w.mine}」を選んだ場面です。`) + (w.gf ? w.gf.root : `最善は「${w.best}」でした。`) + why,
      (i ? `ほんで第${w.game}ゲーム第${w.round}巡の「${w.mine}」もな！` : `せやけど第${w.game}ゲーム第${w.round}巡、場${w.t}の「${w.mine}」はなんでやねん！`) + (w.gf ? w.gf.masa : `「${w.best}」やろ！`) + why);
    if (i === 0) N(rvBadNeta(w));
  });
  sec = 'tend'; // 6. 傾向とクセ（セット全体）、最近の自分との比較
  const mc = {}; F.forEach(f => f && Object.entries(f.missCats || {}).forEach(([k, n]) => mc[k] = (mc[k] || 0) + n));
  const tc = rvTopCat(mc, 2);
  if (tc) { B(`セット全体で見ると、外した手は「${CATS[tc.k]}」の場面に${tc.n}回かたまっていました。${CAT_INFO[tc.k] ? CAT_INFO[tc.k][1] : ''}`, `外したんは「${CATS[tc.k]}」の場面に${tc.n}回や。`); N('tend'); }
  sec = 'style'; const st = { m3: 0, b3: 0, mDraw: 0, bDraw: 0 }; F.forEach(f => f && f.style && Object.keys(st).forEach(k => st[k] += f.style[k] || 0));
  if (nDec >= 8) {
    if (st.b3 - st.m3 >= 3) B(`セットを通して、3枚出しはAIの最善で${st.b3}回、選んだのは${st.m3}回。まとめて出せる場面を逃しがちです。`, `3枚出し、AIは${st.b3}回やのに${st.m3}回や。シュートチャンスで打たへんのはもったいないで！`);
    else if (st.m3 - st.b3 >= 3) B(`3枚出しを${st.m3}回選びましたが、AIの最善では${st.b3}回。枚数を減らすことにこだわりすぎる傾向があります。`, `3枚出し${st.m3}回、AIは${st.b3}回や。なんでも打てばええってもんちゃうで！`);
    if (st.mDraw - st.bDraw >= 3) B(`引いたのは${st.mDraw}回、AIの最善では${st.bDraw}回。出せる場面での引きすぎに注意です。`, `引いたん${st.mDraw}回、AIは${st.bDraw}回や。チェックばっかりやと主導権取られるで！`);
  }
  sec = 'recent'; const rc = rvRecent(Lg.length);
  if (rc.rate != null && rc.n >= 15 && nDec >= 5) {
    const now = nBest / nDec, d = now - rc.rate;
    B(`直近${rc.games}ゲームの最善率は${Math.round(rc.rate * 100)}%。このセットは${Math.round(now * 100)}%なので、${Math.abs(d) < 0.08 ? 'いつも通りの実力を出せています。' : d > 0 ? 'いつもより判断が冴えていました。' : 'いつもより少し崩れました。'}`, `いつもの最善率${Math.round(rc.rate * 100)}%に対して、このセットは${Math.round(now * 100)}%や。${Math.abs(d) < 0.08 ? '安定しとるな！' : d > 0 ? '絶好調や！' : '今日はちょっと調子悪かったな。'}`);
    if (rc.weak) B(mc[rc.weak.k] ? `「${rc.weak.label}」は最近の苦手な場面で、このセットでも${mc[rc.weak.k]}回外しています。重点的に見直しましょう。` : `最近の苦手だった「${rc.weak.label}」では、このセットは外していません。克服が進んでいます。`, mc[rc.weak.k] ? `「${rc.weak.label}」は最近ずっと苦手で、このセットでも${mc[rc.weak.k]}回や。ここが課題やな！` : `苦手やった「${rc.weak.label}」、このセットはノーミスや！成長しとるで！`);
  }
  sec = 'luck'; // 7. 運と実力
  const unlucky = Lg.filter(x => x.luck === 'resultUnlucky').length, lucky = Lg.filter(x => x.luck === 'resultLucky').length;
  if (unlucky) { B(`判断は最善なのに札運で失点したゲームが${unlucky}回ありました。順位ほど内容は悪くありません。`, `内容最善やのに不運やったゲームが${unlucky}回や。そこは気にせんでええ！`); N(rt ? 'luck' : 'luckBad'); }
  if (lucky) { B(`逆に、結果オーライのゲームも${lucky}回。運に助けられた分は割り引いて考えましょう。`, `結果オーライが${lucky}回、ラッキーやっただけやで！判断で取れるようにしよ！`); if (!rt) N('luckGood'); }
  sec = 'tour'; // 8. 大会の行方
  if (c.kind === 'tournament' && c.phase === 'prelim') {
    let line = '';
    try { const s = standingsSorted(S.T), F2 = c.F, lp = s[F2 - 1], i = s.findIndex(p => p.id === 0), nb2 = i > 0 ? s[i - 1] : null; const a1 = lp && lp.id !== 0 ? `決勝ラインの${F2}位は${san(nm(P(lp.id)))}（${S.T.points[lp.id]}点）` : '', a2 = nb2 && nb2.id !== 0 && (!lp || nb2.id !== lp.id) ? `すぐ上の${i}位は${san(nm(P(nb2.id)))}（${S.T.points[nb2.id]}点）` : '';
      line = rt ? (a1 ? a1 + '。' : '') + (a2 ? a2 + 'です。' : '') : (a1 || a2 ? [a1, a2].filter(Boolean).join('、') + 'や。まずはそこを抜いたろ！' : ''); } catch (e) { }
    if (c.last) { if (c.qualified) B(c.tieRisk ? '決勝ライン上で同点です。決定戦に備えましょう。' : `予選${c.overall}位で決勝進出です。おめでとうございます。決勝でも同じ判断を続けましょう。`, c.tieRisk ? 'ライン上で同点や！PK戦やで、気合い入れていこか！' : `予選${c.overall}位で決勝進出や！ファイナルテーブルやで、おめでとう！`); else B(`予選${c.overall}位、決勝ラインまで${c.gap}点でした。${line}次の大会では、今回の課題を一つ潰して臨みましょう。`, `予選${c.overall}位、決勝まであと${c.gap}点やったな…${line}次こそファイナルテーブルや！`); }
    else B(`ここまでの総合は${c.overall}位${c.qualified ? '（決勝圏内）' : `（決勝ラインまで${c.gap}点）`}です。${line}`, (c.qualified ? `総合${c.overall}位、決勝圏内や！このまま逃げ切るで！` : `総合${c.overall}位、ラインまで${c.gap}点や。まだ巻き返せる！`) + line);
  }
  if (c.phase === 'final' && c.finalRank !== 1) B(`優勝は${c.winnerName === 'あなた' ? nmY : san(c.winnerName)}。ここまで勝ち上がった内容は確かです。`, `優勝は${c.winnerName === 'あなた' ? nmY : san(c.winnerName)}や。悔しいけど、ここまで来たんは立派やで！`);
  if (c.phase === 'final' && c.finalRank === 1) B('見事な優勝です。予選から通して、判断の質が結果に結びつきました。', 'てっぺんや！ビッグイヤー掲げたれ！');
  sec = 'badges'; // 9. バッジ・アイテム・自己ベスト・成長
  const ea = rvEarned(S.T.setT0 || Date.now()), bl = rvBadgeList(ea.badges.slice(0, 5)) + (ea.badges.length > 5 ? `ほか${ea.badges.length - 5}個` : '');
  if (ea.badges.length) B(`このセットで${bl}を獲得しました。${ea.items.length ? `アバターの${ea.items.slice(0, 6).join('・')}も使えるようになっています。` : ''}`, `このセットで${bl}を取ったで！${ea.items.length ? `アバターの${ea.items.slice(0, 6).join('・')}も解放や！` : ''}`);
  sec = 'pb'; rvPB(S.T.pbSnap).forEach(p => {
    if (p.k === 'streak') B(`連続最善の自己ベストを${p.v}回に更新しました。`, `連続最善の自己ベスト、${p.v}回に更新や！`);
    if (p.k === 'setLow') B(`1セットの最少PPも、自己ベストの${p.v}になりました。`, `セットの最少PP、自己ベスト${p.v}や！クリーンシート級やな！`);
    if (p.k === 'rating') B(`推定実力は★${p.from.toFixed(1)}から★${p.v.toFixed(1)}に上がりました。判断の質が着実に伸びています。`, `推定実力が★${p.from.toFixed(1)}→★${p.v.toFixed(1)}や！確実に強なっとるで！`);
  });
  sec = 'near'; const nb = rvNear(S.T.pbSnap);
  if (nb.length) B(`あと${nb[0].left}回で「${nb[0].name}」（${nb[0].series}・${nb[0].tier}）です。${nb[1] ? `「${nb[1].name}」（${nb[1].series}）もあと${nb[1].left}回。` : ''}`, `あと${nb[0].left}回で「${nb[0].name}」（${nb[0].series}・${nb[0].tier}）や！${nb[1] ? `「${nb[1].name}」もあと${nb[1].left}回やで！` : ''}`);
  sec = 'next'; // 10. 次の課題
  const pr = tc && RV_PRACTICE[tc.k];
  if (pr) { B(pr[2], `${pr[1]}で鍛えたら、次のセットはもっと行けるで！`); N('practice'); }
  else B(RVP(['判断の質を積み重ねれば、セットの順位は自然と上がっていきます。', '次のセットでも、大きい札の早めの処分を意識しましょう。']), RVP(['次のセットもいこか！判断の積み重ねが本番で生きるんや！', 'ええセットやった！この調子で次いこ！']));
  return rvAssemble(L, who, RV_W_SET, ['result', 'miss', 'tour', 'badges', 'next']);
}

// どの話題に触れるか：毎回すべてではなく、重みつきでランダムに選ぶ（大事なものは必ず）
const RV_W_GAME = { hl: 0.9, hlMore: 0.3, flow: 0.4, missMore: 0.5, danger: 0.5, style: 0.45, secs: 0.25, tend: 0.7, recent: 0.45, luck: 0.85, final: 0.3, pb: 0.95, near: 0.5 };
const RV_W_SET = { games: 0.75, flow: 0.5, hl: 0.85, hlMore: 0.4, missMore: 0.45, tend: 0.75, style: 0.45, recent: 0.55, luck: 0.7, pb: 0.95, near: 0.5 };
function rvAssemble(L, who, W, must) {
  const secs = [...new Set(L.map(x => x.sec))], opt = secs.filter(k => !must.includes(k) && W[k] != null);
  let keep = opt.filter(k => Math.random() < W[k]);
  const max = 4 + ((Math.random() * 3) | 0); // 4〜6個
  if (keep.length > max) keep = keep.sort((a, b) => W[b] * (0.6 + Math.random() * 0.8) - W[a] * (0.6 + Math.random() * 0.8)).slice(0, max);
  if (keep.length < 2) keep = keep.concat(opt.filter(k => !keep.includes(k)).sort((a, b) => W[b] - W[a]).slice(0, 2 - keep.length));
  const out = L.filter(x => must.includes(x.sec) || keep.includes(x.sec) || W[x.sec] == null);
  // マサは、サッカーかポーカーのたとえを毎回いちど以上
  if (who === 'masa' && !out.some(x => x.neta)) out.push({ t: RVP(MASA_NETA.good.concat(MASA_NETA.lose, MASA_NETA.practice)) });
  if (who === 'root' && Math.random() < 0.35 && KB.PHILO) out.push({ t: RVP(KB.PHILO) });
  return out.map(x => x.t).join('');
}
function nextGame() {
  S.inSummary = false;
  closeModal();
  const T = S.T;
  if (T.game < T.cfg.games) { T.game++; startGame(); return; }
  endSet();
}
function endSet() {
  if (S.review && S.review.ctl) S.review.ctl.abort();
  S.review = null;
  const T = S.T;
  const res = [];
  T.tables.forEach((t, ti) => {
    const pps = t.map(id => setTotal(T, id));
    const rk = KB.rankByPP(pps);
    t.forEach((id, k) => {
      const pts = T.phase === 'prelim' ? (T.cfg.points[rk[k]] || 0) : 0;
      if (T.phase === 'prelim') T.points[id] += pts;
      res.push({ id, table: ti, pp: pps[k], rank: rk[k] + 1, pts, games: T.setPP[id].slice() });
    });
  });
  T.setHist.push({ set: T.set, phase: T.phase, res });
  if (T.cfg.kind === 'practice' && !T.statDone) { T.statDone = true; stat('pDone'); }
  if (!S.tiebreak) { const mineR = res.find(r => r.id === 0); if (mineR && mineR.rank === 1 && (T.tables[mineR.table] || []).length >= 4 && !T.setHinted && badgeElig(T).set) bump('set_win'); } /* 4人以上の卓のみ */
  if (!S.tiebreak) { const mineR = res.find(r => r.id === 0); if (mineR && (T.cfg.games >= 5 || T.attack) && (T.tables[mineR.table] || []).length >= 4 && mineR.pp <= 20 && !T.setHinted && badgeElig(T).set) setMax('set_low', 100 - mineR.pp); } /* 低PPセット：PP20以下・10以下・0 */
  if (!S.tiebreak && !T.tourHinted && badgeElig(T).tour && T.cfg.kind === 'tournament' && T.phase === 'prelim' && T.set === T.cfg.sets) { const pre = T.setHist.filter(h => h.phase === 'prelim'); if (pre.length >= T.cfg.sets && pre.every(h => { const r = h.res.find(x => x.id === 0); return r && r.rank === 1; })) bump('all_sets'); } /* 予選の全セット優勝 */
  if (!S.tiebreak && badgeElig(T).set) { const L = T.setLog || [], nD = L.reduce((a, x) => a + (x.nDec || 0), 0); if (nD >= 5 && L.every(x => (x.nGood != null ? x.nGood : x.nBest) === x.nDec && !(x.fouls || []).length) && L.length >= T.cfg.games && !T.setHinted) bump('perfect_set'); if (T.cfg.kind === 'practice') bump('practice_set'); if (judgeAfter() && !(T.setFouls || 0) && (T.setPP[0] || []).length && !T.setHinted) bump('no_foul_set'); }
  T.setFouls = 0;
  if (S.attack) { attackSetBonus(); if (!S.attack.finishing) attackNextSet(); return; }
  saveSession();
  go('set-end');
}
function standingsSorted(T) {
  return T.players.filter(p => !p.seed).sort((a, b) => T.points[b.id] - T.points[a.id] || T.totPP[a.id] - T.totPP[b.id] || T.tb[a.id] - T.tb[b.id] || a.id - b.id);
}
function myStanding() {
  const T = S.T; const s = standingsSorted(T); const i = s.findIndex(p => p.id === 0);
  return `${i + 1}位（${T.points[0]}点、累計PP ${T.totPP[0]}）。決勝ライン${T.cfg.finalists}位の人：${s[T.cfg.finalists - 1] ? T.points[s[T.cfg.finalists - 1].id] + '点' : '-'}`;
}

function setEndHTML() {
  const T = S.T; const h = T.setHist[T.setHist.length - 1];
  const tablesHTML = T.tables.map((t, ti) => {
    const rows = h.res.filter(r => r.table === ti).sort((a, b) => a.rank - b.rank);
    return `<div class="panel stack" style="gap:6px"><div class="lbl">${T.tables.length > 1 ? `第${ti + 1}卓` : 'この卓'}${ti === T.myTable ? '（あなた）' : ''}</div><div class="scroll"><table class="st"><thead><tr><th>順位</th><th>名前</th>${rows[0].games.map((_, k) => `<th class="num">G${k + 1}</th>`).join('')}<th class="num">PP計</th>${T.phase === 'prelim' ? '<th class="num">得点</th>' : ''}</tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.id === 0 ? 'meRow' : ''}"><td>${r.rank}</td><td><span class="who">${av(P(r.id), r.rank === 1 ? 'happy' : 'normal')}${esc(nm(P(r.id)))}</span></td>${r.games.map(x => `<td class="num">${x}</td>`).join('')}<td class="num"><b>${r.pp}</b></td>${T.phase === 'prelim' ? `<td class="num">${r.pts}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>`;
  });
  const mine = h.res.find(r => r.id === 0) || null;
  let title, btn;
  if (T.cfg.kind === 'practice') { title = `セット ${mine.rank}位（${mine.pts}点）`; btn = '<button class="btn primary" data-act="practice-again">同じ設定でもう1セット</button>'; T.done = true; store.del('session'); }
  else if (T.phase === 'final') { title = '決勝 終了'; btn = '<button class="btn primary" data-act="final-result">最終結果へ</button>'; }
  else { title = `第${T.set}セット ${mine.rank}位（+${mine.pts}点）`; btn = T.set < T.cfg.sets ? '<button class="btn primary" data-act="next-set">次のセットへ（席替え）</button>' : '<button class="btn primary" data-act="to-final">予選結果と決勝進出者へ</button>'; }
  return `<div class="topbar"><div class="where">${esc(title)}</div><div></div></div>
  <div class="stack">${mine && (S.T.setLog || []).length ? `<div class="panel" id="review-wrap" data-scope="set">${reviewHTML('set')}</div>` : ''}${T.cfg.kind === 'tournament' && T.phase === 'prelim' ? standingsHTML(T) : ''}${tablesHTML.join('')}<div class="row" style="justify-content:flex-end">${btn}</div></div>`;
}
function standingsHTML(T) {
  const s = standingsSorted(T); const F = T.cfg.finalists;
  const done = T.setHist.filter(h => h.phase === 'prelim');
  const live = S.view === 'game' && T.phase === 'prelim' && !S.tiebreak;
  return `<div class="panel stack" style="gap:6px"><div class="hint-head"><div class="lbl">予選 総合順位（${done.length}セット終了時点${live ? '・進行中セットは別欄' : ''}）</div><span class="small muted">得点→累計PPの順。点線より上が決勝圏</span></div>
  <div class="scroll"><table class="st"><thead><tr><th>順位</th><th>名前</th>${done.map(h => `<th class="num">S${h.set}</th>`).join('')}<th class="num">得点</th><th class="num">累計PP</th>${live ? '<th class="num">今セットPP</th>' : ''}</tr></thead><tbody>
  ${s.map((p, i) => `<tr class="${p.id === 0 ? 'meRow' : ''} ${i === F - 1 ? 'cut' : ''}"><td>${i + 1}</td><td><span class="who">${av(p)}${esc(nm(p))}${S.settings.showLevel && !p.human ? `<span class="muted small">★${p.level}</span>` : ''}</span></td>${done.map(h => { const r = h.res.find(x => x.id === p.id); return `<td class="num">${r.pts}<span class="muted small">/${r.pp}</span></td>`; }).join('')}<td class="num"><b>${T.points[p.id]}</b></td><td class="num">${T.totPP[p.id]}</td>${live ? `<td class="num">${setTotal(T, p.id)}</td>` : ''}</tr>`).join('')}
  </tbody></table></div><p class="small muted" style="margin:0">各セット欄は「得点/PP」。累計PPは進行中セットのゲームも含みます。</p></div>`;
}
function showStandings() {
  const T = S.T;
  let html = '';
  if (T.cfg.kind === 'tournament' && T.phase === 'prelim') html += standingsHTML(T);
  if (T.phase === 'final') html += finalTableHTML(T);
  // 今のセットの卓ごと
  html += T.tables.map((t, ti) => `<div class="panel stack" style="gap:6px"><div class="lbl">${T.tables.length > 1 ? `第${ti + 1}卓` : 'この卓'}${ti === T.myTable ? '（あなた）' : ''}・今セット</div><div class="scroll"><table class="st"><thead><tr><th>名前</th><th class="num">ゲーム別PP</th><th class="num">計</th></tr></thead><tbody>${t.slice().sort((a, b) => setTotal(T, a) - setTotal(T, b)).map(id => `<tr class="${id === 0 ? 'meRow' : ''}"><td><span class="who">${av(P(id))}${esc(nm(P(id)))}</span></td><td class="num">${T.setPP[id].join(' / ') || '-'}</td><td class="num"><b>${setTotal(T, id)}</b></td></tr>`).join('')}</tbody></table></div></div>`).join('');
  const live = S.view === 'game' && S.game && !S.game.over;
  modal(`<h2>順位表</h2>${live ? '<p class="small muted pause-note" style="margin:0">順位表を見ている間、ゲームは一時停止しています</p>' : ''}${html}<div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div>`);
  if (live) pauseGame();
}
function finalTableHTML(T) {
  const ids = T.finalists.slice().sort((a, b) => (T.finalPP[a] || 0) - (T.finalPP[b] || 0));
  return `<div class="panel stack" style="gap:6px"><div class="lbl">決勝（このセットのPPだけで順位）</div><table class="st"><tbody>${ids.map((id, i) => `<tr class="${id === 0 ? 'meRow' : ''}"><td>${i + 1}</td><td><span class="who">${av(P(id))}${esc(nm(P(id)))}</span></td><td class="num">${T.finalPP[id] || 0}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- 予選→決勝、同点処理 ----------
function toFinal() {
  const T = S.T; const F = T.cfg.finalists;
  const s = standingsSorted(T);
  // 決勝ラインをまたぐ同点グループ
  const cutP = s[F - 1], nextP = s[F];
  if (nextP && T.points[cutP.id] === T.points[nextP.id] && T.totPP[cutP.id] === T.totPP[nextP.id]) {
    const group = s.filter(p => T.points[p.id] === T.points[cutP.id] && T.totPP[p.id] === T.totPP[cutP.id]).map(p => p.id);
    const above = s.findIndex(p => p.id === group[0]);
    const slots = F - above;
    resolveTie(group, `決勝進出決定戦（${group.length}人で残り${slots}枠）`, slots, order => {
      order.forEach((id, i) => { T.tb[id] = i; });
      enterFinal();
    });
    return;
  }
  enterFinal();
}
// 大会開始の演出：博士が大会の構造を説明し、マサが合いの手を入れる
function openingHTML() {
  const T = S.T, c = T.cfg, sizes = KB.splitTables(c.nPlayers, 5);
  const pts = c.points.filter((x, i) => i < 5);
  const ptsTxt = pts.map((x, i) => `${i + 1}位${x}点`).join('、');
  const tie = c.tie === 'sudden' ? 'サドンデスの1ゲーム勝負' : 'ジャンケン';
  const lines = [
    ['root', `計算ブリッジ大会へようこそ。今日は${c.nPlayers}名が集まりました。予選${c.sets}セットを戦い抜いて、決勝へ進めるのは上位${c.finalists}名だけです。`],
    ['masa', `${c.nPlayers}人で${c.finalists}枠の取り合いや！席替えしながらの長丁場、最後まで目ぇ離されへんで！ほな、キックオフや！`]
  ];
  if (S.T && S.T.kanata) lines.push(['root', `それから、今日はシード選手が1名います。予選には出ず、決勝から登場する選手です。${S.T.kanataCut ? `決勝の席が1つ埋まるので、予選から進めるのは上位${c.finalists}名になります。` : `決勝は、予選の上位${c.finalists}名にシード選手を加えた${c.finalists + 1}名で戦います。`}`], ['masa', 'シードやて…誰が来るんや？ 正体は決勝までのお楽しみや！']);
  const step = 2.2;
  return `<div class="stage opening"><div class="spot"></div>
  <div class="stage-title">計算ブリッジ大会</div>
  <div class="stage-sub">${c.nPlayers}名・${sizes.length}卓・予選${c.sets}セット（各${c.games}ゲーム）・上位${c.finalists}名が決勝${S.T && S.T.kanata ? '＋シード1名' : ''}</div>
  <div class="op-lines">${lines.map(([who, txt], i) => `<div class="op-line ${who}" style="animation-delay:${0.4 + i * step}s"><div class="cm-av">${KB.casterSVG(who, who === 'masa' ? 'happy' : 'normal')}</div><div class="op-bubble"><span class="cm-name">${who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span>${esc(txt)}</div></div>`).join('')}</div>
  <div class="row" style="justify-content:center;gap:10px;margin-top:16px;position:relative">
    <button class="btn ghost" data-act="opening-skip">説明をすぐ表示</button>
    <button class="btn primary" id="op-start" data-act="opening-start" style="min-width:200px;animation-delay:${0.4 + lines.length * step}s">大会を開始する</button>
  </div></div>`;
}
// 決勝の入場シーン：進出者が一人ずつスポットライトの中に入ってくる
function enterFinal() {
  const T = S.T; const s = standingsSorted(T);
  T.finalists = s.slice(0, T.cfg.finalists).map(p => p.id);
  if (T.kanata) {
    let k = T.players.find(p => p.seed);
    if (!k) { const id = T.players.length; k = { id, human: false, level: 6, style: 'keisan', ch: KB.charToCh(KB.KANATA), clairvoyant: true, seed: true }; T.players.push(k); T.points[id] = 0; T.totPP[id] = 0; T.tb[id] = 0; }
    T.finalists.push(k.id);
  }
  saveSession();
  go('entrance');
  if (T.finalists.includes(0)) setTimeout(confetti, T.finalists.length * 550 + 300);
}
// シードの入場に合わせて、画面をそこまで動かす（スマホで見切れないように）。話し終わるころに開始ボタンまで
function entranceScroll() {
  const el = $('.seed-ent'); if (!el) return; const d = parseFloat(el.style.animationDelay) || 0, key = S.gameNo + ':' + (S.T && S.T.set);
  if (S.entScrolled === key) return; S.entScrolled = key;
  setTimeout(() => { const e = $('.seed-ent'); if (e && S.view === 'entrance') e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, (d - 0.1) * 1000);
  setTimeout(() => { const b = $('[data-act="start-final"]'); if (b && S.view === 'entrance') b.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, (d + 1.2 + 3 * 1.6 + 1) * 1000);
}
function entranceHTML() {
  const T = S.T; const s = standingsSorted(T);
  const inF = T.finalists.includes(0);
  const myPre = s.findIndex(p => p.id === 0) + 1;
  const card = (id, delay) => { const p = P(id); const st = p.human ? null : KB.style(p.style);
    return `<div class="ent ${id === 0 ? 'me' : ''}" style="animation-delay:${delay}s"><div class="ent-rank">${p.seed ? 'シード' : `予選${T.finalists.filter(x => !P(x).seed).indexOf(id) + 1}位`}</div><div class="ent-av">${av(p, id === 0 ? 'happy' : (p.level >= 4 ? 'normal' : 'smug'))}</div><div class="ent-name">${esc(nm(p))}</div><div class="ent-meta">${p.seed ? '★6・予選免除' : `${T.points[id]}点・PP ${T.totPP[id]}`}</div>${st && S.settings.showStyle ? `<span class="chip stchip" style="background:${esc(st.color)}">${esc(st.label)}</span>` : ''}${p.human ? '<span class="chip lvchip">あなた</span>' : ''}</div>`; };
  // 予選からの進出者が先に入場し、そのあとシード（カナタ）が別の舞台で入場する。スマホでは入場に合わせてそこまで動かす
  const reg = T.finalists.filter(id => !P(id).seed), seed = T.finalists.find(id => P(id).seed), sd = 0.8 + reg.length * 0.55;
  const cards = reg.map((id, i) => card(id, 0.4 + i * 0.55)).join('');
  return `<div class="stage"><div class="spot"></div>
  <div class="stage-title">${inF ? '決勝進出者、入場！' : '決勝進出者'}</div>
  <div class="stage-sub">${inF ? `あなたは予選${myPre}位で決勝へ。決勝は1セット（${T.cfg.games}ゲーム）のPPだけで順位が決まります。` : `あなたは予選${myPre}位で惜しくも敗退。決勝の行方を見届けましょう。`}</div>
  <div class="ent-row">${cards}</div>
  ${T.kanata && seed != null ? `<div class="seed-ent" style="animation-delay:${sd}s"><div class="seed-head">シード選手、入場！</div><div class="ent-row">${card(seed, sd + 0.3)}</div><div class="op-lines kanata-ent">${[['root', 'そして最後に、シード選手の入場です。計算ブリッジ倶楽部の初代チャンピオン、★6「卓の彼方を視る者」カナタさん。予選を免除されて、決勝から登場します。'], ['masa', '出たで、伝説のカナタや！奥義「絶対透視」は、カナタの番が来るたびに五分五分で出るんや。出たらそのゲームはずっと、全員の手札も山札の底まで見通しとる。出たら先に上がられる確率がグンと上がるで！'], ['root', '絶対透視が出ても、こちらが上がれないわけではありません。上がりを狙いつつ、上がられたときの失点に備えて、大きい札から処分していきましょう。']].map(([who, txt], i) => `<div class="op-line ${who}" style="animation-delay:${sd + 1.2 + i * 1.6}s"><div class="cm-av">${KB.casterSVG(who, who === 'masa' ? 'happy' : 'normal')}</div><div class="op-bubble"><span class="cm-name">${who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span>${esc(txt)}</div></div>`).join('')}</div></div>` : ''}
  <div class="row" style="justify-content:center;margin-top:18px"><button class="btn primary" data-act="start-final" style="min-width:220px">${inF ? '決勝戦をはじめる' : '決勝の結果を見る'}</button></div></div>
  <details class="panel" style="margin-top:14px"><summary class="lbl" style="cursor:pointer">予選の最終順位を見る</summary>${standingsHTML(T)}</details>`;
}
// 大会のバッジが付かない理由（付かないときは黙らず、理由を知らせる）
function tourNoBadge(T) {
  if (T.tourHinted) return 'この大会でAIの読みを見たか、待ったを使ったため';
  const e = badgeElig(T); if (e.tour) return null;
  const r = [];
  if (T.cfg.nPlayers < ELIG.tourPlayers) r.push(`参加${ELIG.tourPlayers}人以上`);
  if (T.cfg.sets < ELIG.tourSets) r.push(`予選${ELIG.tourSets}セット以上`);
  if (T.cfg.games < ELIG.games) r.push(`1セット${ELIG.games}ゲーム以上`);
  if (e.aiAvg < ELIG.oppAvg) r.push(`参加AIの平均★${ELIG.oppAvg}以上（この大会は★${e.aiAvg.toFixed(1)}）`);
  return r.length ? '条件（' + r.join('・') + '）を満たしていないため' : '条件を満たしていないため';
}
function startFinal() {
  closeModal();
  const T = S.T; T.phase = 'final'; T.set = 1; T.game = 1; T.finalPP = {}; S.T.setLog = []; T.setT0 = Date.now(); T.pbSnap = rvSnap();
  T.finalists.forEach(id => T.finalPP[id] = 0);
  seatSet(T);
  if (T.finalists.includes(0)) { const why = tourNoBadge(T); if (!why) { bump('qualify'); T.aimNow = aimReward(T, 'final'); if (['strong', 'master'].includes(T.cfg.mix)) setMax('qualify_strong', T.cfg.mix === 'master' ? 2 : 1); } else setTimeout(() => toast(`決勝進出！ ただし${why}、大会のバッジは対象外です`), 1200); T.setFouls = 0; T.setHinted = false; if (T.aimNow) { const n = T.aimNow; T.aimNow = 0; aimHandover(n, 'final', startGame); } else startGame(); return; }
  // 観戦：全ゲーム自動
  const pls = T.tables[0].map(id => P(id));
  for (let gI = 0; gI < T.cfg.games; gI++) { const gm = KB.autoGame(pls, starterFor(T.tables[0], gI + 1)); pls.forEach((p, i) => { T.setPP[p.id].push(gm.pp[i]); T.finalPP[p.id] += gm.pp[i]; }); }
  T.game = T.cfg.games;
  endSet();
}
function finalResult() {
  const T = S.T;
  const ids = T.finalists.slice().sort((a, b) => T.finalPP[a] - T.finalPP[b]);
  // 同点グループごとに順位決定
  const groups = []; let i = 0;
  while (i < ids.length) { let j = i; while (j + 1 < ids.length && T.finalPP[ids[j + 1]] === T.finalPP[ids[i]]) j++; groups.push(ids.slice(i, j + 1)); i = j + 1; }
  const order = [];
  const nextGroup = k => {
    if (k >= groups.length) { T.finalOrder = order; T.done = true; store.del('session'); if (!T.statDone) { T.statDone = true; stat('tDone'); } if (badgeElig(T).tour) bump('tour_done'); if (order[0] === 0) { const why = tourNoBadge(T); if (!why) { bump('champion'); { const n = aimReward(T, 'champion'); if (n) setTimeout(() => aimHandover(n, 'champion'), 1800); } if (T.kanataClear) bump('toushi'); if (['strong', 'master'].includes(T.cfg.mix)) setMax('champion_strong', T.cfg.mix === 'master' ? 2 : 1); } else setTimeout(() => toast(`優勝！ ただし${why}、大会のバッジは対象外です`), 1500); } /* 参加15人以上の大会のみ */ go('result'); return; }
    const g = groups[k];
    if (g.length === 1) { order.push(g[0]); nextGroup(k + 1); return; }
    resolveTie(g, `決勝 ${order.length + 1}位決定戦`, 1, o => { order.push(...o); nextGroup(k + 1); });
  };
  nextGroup(0);
}
// 同点を解消して順序を返す
function resolveTie(ids, label, slots, done) {
  const T = S.T;
  const rule = T.cfg.tie;
  if (rule === 'sudden') {
    if (ids.includes(0)) {
      S.tiebreak = { ids: KB.shuffle(ids.slice()), label, goalTable: ids.map((_, i) => i < slots ? 1 : 0), done };
      closeModal();
      startGame();
      return;
    }
    const gm = KB.autoGame(ids.map(id => P(id)), 0);
    const o = ids.map((id, i) => ({ id, pp: gm.pp[i], r: Math.random() })).sort((a, b) => a.pp - b.pp || a.r - b.r).map(x => x.id);
    modal(`<div class="lbl">${esc(label)}</div><div class="banner">サドンデス</div><p>${o.map((id, i) => `${i + 1}. ${esc(nm(P(id)))}（PP ${gm.pp[ids.indexOf(id)]}）`).join('<br>')}</p><div class="row" style="justify-content:flex-end"><button class="btn primary" id="tb-ok">続ける</button></div>`);
    $('#tb-ok').onclick = () => { closeModal(); done(o); };
    return;
  }
  // ジャンケン
  const hands = ['グー', 'チョキ', 'パー'];
  const o = KB.shuffle(ids.slice());
  modal(`<div class="lbl">${esc(label)}</div><div class="banner">ジャンケン！</div>
  <div class="result-cast">${o.map((id, i) => `<div class="pc">${av(P(id), i === 0 ? 'happy' : 'worried')}<span>${esc(nm(P(id)))}</span><b>${i + 1}位</b><span class="muted">${hands[(Math.random() * 3) | 0]}</span></div>`).join('')}</div>
  <p class="small muted" style="margin:0">同点（得点・PPとも同じ）のため、ジャンケンで順位を決めました。</p>
  <div class="row" style="justify-content:flex-end"><button class="btn primary" id="tb-ok">続ける</button></div>`);
  $('#tb-ok').onclick = () => { closeModal(); done(o); };
}
function finishTiebreakGame() {
  const g = S.game; const tb = S.tiebreak;
  const o = g.players.map((p, i) => ({ id: p.id, pp: g.pp[i], r: Math.random() })).sort((a, b) => a.pp - b.pp || a.r - b.r).map(x => x.id);
  winOverlay(() => afterTB(o, tb));
}
function afterTB(o, tb) {
  S.tbAfter = { o, tb };
  showGameSummary();
}
// サドンデス後の「続ける」ボタン
function bindTBNext() {
  if (!S.tbAfter) return;
  const btn = document.querySelector('#modal [data-act="next-game"]');
  if (btn) btn.onclick = () => { const { o, tb } = S.tbAfter; S.tbAfter = null; S.inSummary = false; closeModal(); S.tiebreak = null; S.game = null; S.view = 'set-end'; render(); tb.done(o); };
}

// 表彰式：表彰台（2位・1位・3位）とメダル
function resultHTML() {
  const T = S.T; const o = T.finalOrder || [];
  const myRank = o.indexOf(0) + 1;
  const s = standingsSorted(T);
  const myPre = s.findIndex(p => p.id === 0) + 1;
  const titleTxt = myRank === 1 ? 'あなたが優勝！' : myRank ? `あなたは決勝${myRank}位` : `あなたは予選${myPre}位`;
  setTimeout(confetti, 600); if (myRank === 1) setTimeout(confetti, 1800);
  const medal = ['金', '銀', '銅'];
  const slot = (i, cls) => { const id = o[i]; if (id == null) return ''; const p = P(id);
    return `<div class="pod ${cls} ${id === 0 ? 'me' : ''}" style="animation-delay:${[1.4, 0.8, 0.3][i]}s"><div class="pod-av">${av(p, i === 0 ? 'happy' : 'smug')}</div><div class="medal m${i + 1}">${medal[i]}</div><div class="pod-name">${esc(nm(p))}</div><div class="pod-pp">PP ${T.finalPP[id]}</div><div class="pod-block"><span>${i + 1}</span></div></div>`; };
  const rest = o.slice(3).map((id, k) => `<div class="pc">${av(P(id))}<span>${esc(nm(P(id)))}</span><b>${k + 4}位</b><span class="muted">PP ${T.finalPP[id]}</span></div>`).join('');
  const winner = o[0] != null ? P(o[0]) : null;
  const cm = S.settings.commentary && S.settings.commentary !== 'off' && winner ? `<div class="commentary ceremony"><div class="cm-av">${KB.casterSVG(S.settings.commentary === 'root' ? 'root' : 'masa', 'happy')}</div><div class="cm-body"><span class="cm-name">${S.settings.commentary === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span><span class="cm-text">${S.settings.commentary === 'root' ? `優勝は${esc(winner.human ? yo('あなた') : san(nm(winner)))}。決勝${T.cfg.games}ゲームでPP ${T.finalPP[o[0]]}、見事な安定感でした。` : `優勝は${esc(winner.human ? yo('あなた') : nm(winner))}や〜！おめでとさん！みんなよう頑張った！`}</span></div></div>` : '';
  return `<div class="topbar"><div class="where">表彰式</div><div></div></div>
  <div class="stack"><div class="ceremony-stage"><div class="banner">${titleTxt}</div>
  <div class="podium">${slot(1, 'p2')}${slot(0, 'p1')}${slot(2, 'p3')}</div>
  ${rest ? `<div class="result-cast" style="margin-top:12px">${rest}</div>` : ''}${cm}</div>
  ${standingsHTML(T)}
  <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="tour-again">同じ設定でもう一度</button></div></div>`;
}

// ---------- 戦略データ ----------
// 戦略図鑑（閲覧のみ）：性格と強さをカードで紹介
function strategyHTML() {
  const s = KB.getStrategy();
  const traits = [['cards', '枚数を減らす'], ['high', '大きい札を処分'], ['value', '数字の合計を減らす'], ['flex', '次も出せる柔軟さ'], ['small', '小さい札を温存']];
  const mx = {}; traits.forEach(([k]) => { mx[k] = Math.max(...s.styles.map(st => Math.abs(st.w[k] || 0)), 0.01); });
  const sample = s.styles.map(st => { const l = KB.ROSTER.filter(c => c.st === st.id && c.lv <= 3); return KB.charToCh(l[(Math.random() * l.length) | 0] || KB.ROSTER[0]); });
  const styleCards = s.styles.map((st, i) => `<article class="zukan">
    <div class="zk-head"><div class="zk-av">${KB.avatarSVG(sample[i], { mood: 'normal', level: 0, style: st.id })}</div>
      <div><span class="chip stchip" style="background:${esc(st.color)}">${esc(st.label)}</span><p class="small" style="margin:6px 0 0">${esc(st.desc || '')}</p></div></div>
    <div class="zk-traits">${traits.map(([k, l]) => `<div class="zk-t"><span>${l}</span><span class="zk-bar"><i style="width:${Math.round(Math.max(0, st.w[k] || 0) / mx[k] * 100)}%;background:${esc(st.color)}"></i></span></div>`).join('')}
      <div class="zk-t"><span>気まぐれ度</span><span class="zk-bar"><i style="width:${Math.min(100, Math.round(st.noise / 3 * 100))}%;background:${esc(st.color)}"></i></span></div></div>
    <p class="small muted" style="margin:0">達人になると：${st.mc.win >= 0.3 ? '上がり率を重視して一気に攻める' : st.mc.pp >= 0.3 ? '負けたときのPPを小さく抑える' : '順位・決勝進出率を最優先に考える'}。</p>
  </article>`).join('');
  const opsJa = { pm: '＋−だけ', pmx: '＋−×', all: '＋−×÷（かっこ自由）' };
  const modeJa = { random: '見つけた組み合わせから適当に選ぶ', top3: '良さそうな手を3つほど思い浮かべて選ぶ', heuristic: '枚数・数字・柔軟さを性格どおりに比べて選ぶ', mc: '相手の手札を何百通りも想定してシミュレーションで選ぶ' };
  const lvCards = s.levels.slice().sort((a, b) => a.level - b.level).map(l => `<article class="zukan lv">
    <div class="zk-lvh"><span class="zk-ring" style="border-color:${KB.LEVEL_RING[l.level - 1]}">${l.level}</span><b>${'★'.repeat(l.level)}${'☆'.repeat(5 - l.level)} ${esc(l.label)}</b></div>
    <ul class="small" style="margin:0;padding-left:18px">
      <li>使える計算：${opsJa[l.ops] || l.ops}${l.maxCards < 3 ? `（${l.maxCards}枚まで）` : ''}</li>
      ${l.see ? `<li>思いつく割合：3枚の足し引き${Math.round(l.see[1] * 100)}%・掛け算${Math.round(l.see[2] * 100)}%・割り算${Math.round(l.see[3] * 100)}%・かっこ付き${Math.round(l.see[4] * 100)}%</li>` : ''}
      <li>出せるのに見逃す：${l.miss ? Math.round(l.miss * 100) + '%' : 'なし'}</li>
      <li>考え方：${modeJa[l.mode] || l.mode}</li>
      <li>表情とセリフ：${l.level >= 5 ? 'ほぼ無言のポーカーフェイス' : l.level === 4 ? '表情を変えず、状況を悟らせない' : l.level === 3 ? '性格どおりにしゃべる' : 'よくしゃべり、顔に出る'}</li>
    </ul></article>`).join('');
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← 戻る</button><div class="where">AIたちの戦略図鑑</div><div></div></div>
  <div class="stack">
  <p class="muted" style="margin:0;max-width:70ch">卓にいるAIは「性格」と「強さ」の組み合わせで打ち方が決まります。性格は小物（はちまき・ヘルメット・星・えんぴつ）、強さは顔のまわりの枠の色で見分けられます。</p>
  <div class="lbl">性格（${s.styles.length}種類）</div>
  <div class="zukan-grid">${styleCards}</div>
  <div class="lbl">強さ（5段階）</div>
  <div class="zukan-grid lvg">${lvCards}</div>
  <div class="lbl">ごちゃまぜ倶楽部の注目メンバー</div>
  <p class="small muted" style="margin:0">倶楽部には子どもから伝説の達人まで、${KB.ROSTER.length}人のメンバーがいます。ほかのメンバーには卓で出会えます（卓で顔を押すとプロフィール）。強い人ほど何を考えているか読ませず、★1〜2のメンバーは本音がセリフに出ます。</p>
  <div class="club-grid">${['zero', 'soroban', 'roshi', 'kon', 'kakeru', 'shota'].map(id => KB.charById(id)).filter(Boolean).map(c => { const stl = s.styles.find(x => x.id === c.st) || {}; return `<button class="club-card" data-char="${c.id}"><span class="club-av">${KB.avatarSVG(KB.charToCh(c), { mood: 'normal', level: c.lv, style: c.st })}</span><span class="club-tx">${c.title ? `<small class="club-title">${esc(c.title)}</small>` : ''}<b>${esc(c.name)}</b><small>${'★'.repeat(c.lv)}・<span style="color:${esc(stl.color || '#aaa')}">${esc(stl.label || '')}</span></small></span></button>`; }).join('')}</div>
  </div>`;
}
// キャラのプロフィール
function charProfile(id) {
  const c = KB.charById(id); if (!c) return;
  const inGame = S.view === 'game', showLv = !inGame || S.settings.showLevel || (S.T && S.T.revealAll), showSt = !inGame || S.settings.showStyle || (S.T && S.T.revealAll);
  const stl = KB.getStrategy().styles.find(x => x.id === c.st) || {};
  const say = c.lv >= 4 ? (c.idle || []).slice(0, 3) : c.idle ? c.idle.slice(0, 2) : [];
  modal(`<div class="stack club-prof"><div class="row" style="gap:12px;align-items:center"><span class="club-av big">${KB.avatarSVG(KB.charToCh(c), { mood: 'happy', level: showLv ? c.lv : 0, style: showSt ? c.st : null })}</span><div>${c.title && showLv ? `<small class="club-title">${esc(c.title)}</small>` : ''}<h3 style="margin:0">${esc(c.name)}</h3><div class="small">${showLv ? '★'.repeat(c.lv) + '☆'.repeat(Math.max(0, 5 - c.lv)) + '　' : ''}${esc(c.tag || '')}</div>${showSt ? `<span class="chip stchip" style="background:${esc(stl.color || '#888')}">${esc(stl.label || '')}</span>` : ''}</div></div>
    <p style="margin:0">${esc(c.prof || '')}</p>
    ${say.length ? `<div class="small muted">口ぐせ：${say.map(x => '「' + esc(x) + '」').join(' ')}</div>` : ''}
    <div class="small muted">${!showLv ? '強さは対局が終わるまでのお楽しみ。' : c.lv >= 5 ? 'セリフから手の内はまったく読めない。' : c.lv === 4 ? 'セリフから手の内はほとんど読めない。' : c.lv === 3 ? 'ときどき本音が漏れる。' : '本音がセリフにそのまま出る。よく聞こう。'}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div></div>`);
}
// ---------- このアプリができるまで（応募用の物語。事実だけを書く） ----------
// 段取りより衝動を伝える。短く、事実だけ
const STORY = [
  '2026年10月25日、第4回計算ブリッジ・日本一決定戦。息子と初めて出て、ふたりとも決勝に行けずに惨敗しました。正直、なめてました。',
  '悔しかったので、特訓用のアプリを作りはじめました。AI（Claude）に「こういう特訓用アプリを作ってくれ」と言っては試し、また言っては試し。息子が飽きないように、遊びも入れて。',
  '特訓のつもりが、思いのほか遊べるものになったので、みなさんにも遊んでもらうことにしました。'
];
// ---------- 数字で見る計算ブリッジ（数字になったものの意味を見せる：期待PP・平均PP・順番の有利・決勝や優勝の確率） ----------
let NUMS = null;
// 大会の決勝進出と優勝の確率（estimateQualify と同じ考え方で、決勝の1セットまで続ける）
function estimateTour(cfg, myMu, N) {
  const n = cfg.nPlayers, sizes = KB.splitTables(n, 5), W = MIX[cfg.mix].w, tw = W.reduce((a, b) => a + b, 0);
  const pick = () => { let x = KB.rand() * tw; for (let i = 0; i < 5; i++) { x -= W[i]; if (x <= 0) return i + 1; } return 5; };
  const draw = m => Math.max(0, m[0] * cfg.games + KB.gauss() * m[1] * Math.sqrt(cfg.games));
  let q = 0, w = 0;
  for (let it = 0; it < N; it++) {
    const mus = [[myMu, 9.0]]; for (let i = 1; i < n; i++) mus.push(LV_PP[pick()]);
    const pts = new Array(n).fill(0), pp = new Array(n).fill(0);
    for (let s = 0; s < cfg.sets; s++) { const ids = KB.shuffle([...Array(n).keys()]); let k = 0; for (const z of sizes) { const v = ids.slice(k, k + z).map(id => { const x = draw(mus[id]); pp[id] += x; return { id, x }; }).sort((a, b) => a.x - b.x); k += z; v.forEach((o, i) => { pts[o.id] += cfg.points[i] || 0; }); } }
    const order = [...Array(n).keys()].sort((a, b) => pts[b] - pts[a] || pp[a] - pp[b]), fin = order.slice(0, cfg.finalists);
    if (!fin.includes(0)) continue;
    q++;
    const fx = fin.map(id => ({ id, x: draw(mus[id]) })).sort((a, b) => a.x - b.x);
    if (fx[0].id === 0) w++;
  }
  return { q: q / N, w: w / N };
}
// 練習の1セット（4人卓）のセット期待点と1位の確率：相手は「まんべんなく」の強さから選ぶ
function estimateSet(cfg, myMu, N) {
  const W = MIX[cfg.mix].w, tw = W.reduce((a, b) => a + b, 0);
  const pick = () => { let x = KB.rand() * tw; for (let i = 0; i < 5; i++) { x -= W[i]; if (x <= 0) return i + 1; } return 5; };
  const draw = m => Math.max(0, m[0] * cfg.games + KB.gauss() * m[1] * Math.sqrt(cfg.games));
  let pts = 0, top = 0;
  for (let it = 0; it < N; it++) {
    const v = [{ id: 0, x: draw([myMu, 9.0]) }]; for (let i = 1; i < cfg.n; i++) v.push({ id: i, x: draw(LV_PP[pick()]) });
    v.sort((a, b) => a.x - b.x); const r = v.findIndex(o => o.id === 0);
    pts += cfg.points[r] || 0; if (r === 0) top++;
  }
  return { pts: pts / N, top: top / N };
}
function numbersData() {
  if (NUMS) return NUMS;
  // 順番の有利不利と、1ゲームの長さ：★3どうしの4人卓をAIだけで打たせて数える
  const G = 3000, pos = [0, 0, 0, 0]; let rounds = 0, none = 0, losePP = 0, loseN = 0;
  for (let i = 0; i < G; i++) {
    const g = KB.autoGame([1, 2, 3, 4].map(id => ({ id, human: false, level: 3, style: 'keisan' })), i % 4);
    if (g.winner >= 0) { pos[g.order.indexOf(g.winner)]++; rounds += g.round; } else none++;
    g.pp.forEach((x, k) => { if (k !== g.winner) { losePP += x; loseN++; } });
  }
  const won = G - none;
  // 3枚の待ち
  const men = vals => { const c = KB.countsOf(vals); let n = 0; for (let t = 1; t <= 13; t++) if (KB.findMoves(c, t, 'all', 3).some(m => m.n === vals.length)) n++; return n; };
  const tri = []; for (let a = 1; a <= 13; a++) for (let b = a; b <= 13; b++) for (let c = b; c <= 13; c++) tri.push({ v: [a, b, c], n: men([a, b, c]) });
  const hist = {}; tri.forEach(x => hist[x.n] = (hist[x.n] || 0) + 1); tri.sort((x, y) => y.n - x.n);
  // 大会（初期設定）の決勝進出・優勝の確率
  const cfg = { nPlayers: DEF_T.nPlayers, sets: DEF_T.sets, games: DEF_T.games, points: DEF_T.points, finalists: DEF_T.finalists, mix: DEF_T.mix };
  const tour = PLAY_STYLES.map(p => Object.assign({ label: p.label, mu: p.mu }, estimateTour(cfg, p.mu, 3000)));
  // 練習（初期設定：4人卓・5ゲーム・まんべんなく）のセット期待点
  const pcfg = { n: DEF_P.n, games: DEF_P.games, points: DEF_P.points, mix: DEF_P.mix };
  const set = PLAY_STYLES.map(p => Object.assign({ label: p.label, mu: p.mu }, estimateSet(pcfg, p.mu, 6000)));
  NUMS = { set, pcfg, G, pos: pos.map(x => x / won), rounds: rounds / won, none: none / G, losePP: losePP / loseN, tri, hist, avgMen: tri.reduce((a, x) => a + x.n, 0) / tri.length, tour, cfg };
  return NUMS;
}
function numbersHTML() {
  const N = numbersData(), pc = x => Math.round(x * 100) + '%', f1 = x => (Math.round(x * 10) / 10).toFixed(1);
  const bar = (label, v, max, txt, hi) => `<div class="nb-row wide ${hi ? 'hi' : ''}"><span>${label}</span><i style="width:${Math.max(3, Math.round(v / max * 100))}%"></i><b>${txt}</b></div>`;
  const maxH = Math.max(...Object.values(N.hist));
  // 根拠：どうやって出した数字か（タイトルの書き出しで引く）
  const SRC = [
    ['「このまま', 'AIの読みと同じ計算です。候補手ごとに、まだ見えていないカードを相手の手札と山札に何千通りも割り振り、最後まで打ち切ってみて失点を平均します（モンテカルロ法）。'],
    ['1ゲームの平均', '最善手どおりの7.4は、人の席をAIの最善手で打たせた大会160回のシミュレーションで測った値。★4・★3相当の値は、大会の設定画面の決勝進出率の目安と同じものです。'],
    ['「セット期待点」', `相手${N.pcfg.n - 1}人の強さを「まんべんなく」の割合（★1〜★5を1：1.5：2：1.5：1）で選び、★ごとの1ゲームのPP（平均とばらつき。AIだけの大会600回で測定）から${N.pcfg.games}ゲームの合計を作って順位を決めます。これを6,000セットくり返した平均です。`],
    ['「決勝進出率」', `参加者の強さを「まんべんなく」の割合で選び、セットごとに卓を作り直して予選${N.cfg.sets}セットを行い、総合順位（得点→累計PP）を決めます。3,000大会のうち上位${N.cfg.finalists}人に入った割合です。自分の1ゲームのPPは打ち方別の平均（ばらつき9.0）を使います。`],
    ['親（1番手）', `★3どうしの4人卓を、AIだけで実際に${N.G.toLocaleString('ja-JP')}ゲーム打たせ、上がった人の順番を数えました。`],
    ['上がりまで', `上と同じ${N.G.toLocaleString('ja-JP')}ゲームで、上がった巡と、上がれなかった人の失点を平均しました。`],
    ['3枚の手札', '3枚の組455通りすべてについて、場1〜13のどれで3枚とも出し切れるかを調べ上げた数です（見込みではなく、計算で確定した値）。'],
    ['大会で優勝', `決勝進出率と同じ3,000大会で、決勝（進出した${N.cfg.finalists}人で1セット。PPの合計が最少の人が優勝）まで続けた割合です。`]
  ];
  const srcOf = t => { const x = SRC.find(([k]) => t.startsWith(k)); return x ? `<details class="nc-src"><summary>根拠</summary><p>${x[1]}</p></details>` : ''; };
  const card = (num, unit, title, text, extra) => `<div class="num-card"><div class="nc-n"><b>${num}</b><small>${unit}</small></div><div class="nc-t">${title}</div><p>${text}</p>${extra || ''}${srcOf(title)}</div>`;
  const ps = PLAY_STYLES;
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← 戻る</button><div class="where">数字で見る計算ブリッジ</div><div></div></div>
  <div class="story"><div class="story-hero"><div class="sh-t">数字で見る<br>計算ブリッジ</div><p class="small">勘を、数字にしてみました</p></div>
  <div class="num-grid">
    ${card('期待PP', '', '「このまま進んだら何点失うか」の見込み', 'たとえば期待PP 6.0 の手は、同じ場面を何度もくり返したら、平均で6点くらい失うという意味です。上がれた回は0点、上がられた回は残った札の合計。それを全部ならした数字です。「AIの読み」は、出せる手ごとにこの期待PPと上がれる確率を出して比べています。')}
    ${card(f1(ps[0].mu), 'PP', '1ゲームの平均の失点（打ち方別）', `AIの最善手どおりに打つと、1ゲームの失点は平均${f1(ps[0].mu)}。★3相当の打ち方なら${f1(ps[2].mu)}。差は1ゲームでは${f1(ps[2].mu - ps[0].mu)}点でも、5ゲームの1セットなら約${Math.round((ps[2].mu - ps[0].mu) * 5)}点。順位がひっくり返る差です。`, `<div class="num-bars">${ps.map((p, i) => bar(p.label.replace('の打ち方', '').replace('AIの最善手を打ち続けた場合', '最善手どおり'), p.mu, ps[2].mu, f1(p.mu), i === 0)).join('')}</div>`)}
    ${card(f1(N.set[0].pts), '点', '「セット期待点」＝1セットで取れる得点の見込み', `セットはPPの合計が少ない順に${N.pcfg.points.slice(0, N.pcfg.n).map((x, i) => `${i + 1}位${x}点`).join('・')}。セット期待点は、同じセットを何度もくり返したときの得点の平均です。練習のAIの読みは、失点の少なさ（期待PP）だけでなく、この点数で手を比べます。大きくリードしていれば無理をしない手、離されていれば上がりを狙う手が上に来るのはそのためです。${N.pcfg.n}人卓・${N.pcfg.games}ゲーム（相手はまんべんなく）なら、最善手どおりで平均${f1(N.set[0].pts)}点・1位${pc(N.set[0].top)}、★3相当で${f1(N.set[2].pts)}点です。`, `<div class="num-bars">${N.set.map((t, i) => bar(t.label.replace('の打ち方', '').replace('AIの最善手を打ち続けた場合', '最善手どおり'), t.pts, N.set[0].pts, `${f1(t.pts)}点（1位 ${pc(t.top)}）`, i === 0)).join('')}</div>`)}
    ${card(pc(N.tour[0].q), '', '「決勝進出率」＝予選を勝ち抜く確率', `大会の予選では、AIの読みは「この手で決勝に進める確率」で手を比べます。今のセットの残りのゲーム、ほかの卓の進み具合、残りのセットの席替えまで何千回も試して、総合順位（得点→累計PP）が決勝ラインの内側に入った割合を出します。ラインより十分上なら安全な手、ぎりぎりや下なら、PPが少し増えても順位を上げる手が上に来ます。参加${N.cfg.nPlayers}人・予選${N.cfg.sets}セット・上位${N.cfg.finalists}人が決勝なら、最善手どおりで${pc(N.tour[0].q)}、★3相当で${pc(N.tour[2].q)}です。`, `<div class="num-bars">${N.tour.map((t, i) => bar(t.label.replace('の打ち方', '').replace('AIの最善手を打ち続けた場合', '最善手どおり'), t.q, N.tour[0].q, pc(t.q), i === 0)).join('')}</div><p class="small muted" style="margin:4px 0 0">参加者の平均は${pc(N.cfg.finalists / N.cfg.nPlayers)}</p>`)}
    ${card(pc(N.pos[0]), '', '親（1番手）の上がり率', `だれかが上がったら、その場で終わり。だから順番が大事です。★3どうしの4人卓を${N.G.toLocaleString('ja-JP')}ゲーム打たせると、上がった人のうち親が${pc(N.pos[0])}、4番手は${pc(N.pos[3])}。前のゲームで負けた人が親になるのは、ささやかな救済です。`, `<div class="num-bars">${['親（1番手）', '2番手', '3番手', '4番手'].map((l, i) => bar(l, N.pos[i], N.pos[0], pc(N.pos[i]), i === 0)).join('')}</div>`)}
    ${card(f1(N.rounds), '巡', '上がりまでの平均', `ゲームは平均で第${f1(N.rounds)}巡に終わります。7枚の手札を4〜5回の手番で出し切る計算。1回の手番でおよそ2枚ずつ減らしていく速さが目安です。上がれずにいる人の失点は、平均${f1(N.losePP)}点でした。`)}
    ${card(f1(N.avgMen), '面', '3枚の手札の、平均の待ち', `残り3枚になったとき、13種類の場のうち平均${f1(N.avgMen)}種類で上がれます。最強は <b>${N.tri[0].v.map(KB.vname).join('・')}</b> の${N.tri[0].n}面。弱い組は2面しかありません。残す札で、上がりやすさは何倍も変わります。`, `<div class="num-bars">${Object.keys(N.hist).map(Number).sort((a, b) => b - a).map(k => `<div class="nb-row"><span>${k}面</span><i style="width:${Math.max(2, Math.round(N.hist[k] / maxH * 100))}%"></i><b>${N.hist[k]}</b></div>`).join('')}</div><p class="small muted" style="margin:4px 0 0">面数ごとの組の数（全455通り）</p>`)}
    ${card(pc(N.tour[0].w), '', '大会で優勝する確率（最善手どおりの場合）', `上と同じ大会で、決勝まで含めて最善手どおりに打ち続けた場合の見込みです。決勝はその1セットのPPだけで決まり、価値があるのは1位だけ。だから決勝のAIの読みは「優勝率」で手を比べ、2位を守るより1位を狙う手を選びます（上がれるのにあえて上がらない「捨て身」が最善になることも）。打ち方の差は、大会の結果にここまで響きます。`, `<div class="num-bars">${N.tour.map((t, i) => bar(t.label.replace('の打ち方', '').replace('AIの最善手を打ち続けた場合', '最善手どおり'), t.w, N.tour[0].w, `${pc(t.w)}（決勝 ${pc(t.q)}）`, i === 0)).join('')}</div><p class="small muted" style="margin:4px 0 0">参加者の平均は優勝${pc(1 / N.cfg.nPlayers)}・決勝${pc(N.cfg.finalists / N.cfg.nPlayers)}</p>`)}
  </div>
  <p class="small muted" style="margin:0;padding:0 6px">※ 平均や確率は、このアプリのAIどうしの対戦と、その結果から作ったモデルで計算した見込みです。実際の大会の結果ではありません。</p>
  <div class="op-lines story-cast">${[['root', '勘で打っていたところに、数字の裏づけがあると、迷いが減ります。'], ['masa', '数字は裏切らへん！でも1ゲームは運も大きいで。そこがおもろいんや！']].map(([who, txt]) => `<div class="op-line ${who}"><div class="cm-av">${KB.casterSVG(who, 'happy')}</div><div class="op-bubble"><span class="cm-name">${who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span>${esc(txt)}</div></div>`).join('')}</div>
  <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn" data-go="story">このアプリができるまで</button></div></div>`;
}
function storyHTML() {
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← 戻る</button><div class="where">このアプリができるまで</div><div></div></div>
  <div class="story"><div class="story-hero"><div class="sh-t">悔しかったので、<br>作りました。</div><p class="small">計算ブリッジ作戦研究所（非公式ファン制作）</p></div>
  <div class="story-text">${STORY.map((t, i) => `<p style="animation-delay:${0.15 + i * 0.25}s">${esc(t)}</p>`).join('')}</div>
  <p class="small muted story-note">「計算ブリッジ」は上野晋太郎さん（すうがっくま）が考案したゲームです。このアプリは非公式のファン制作で、キャラクターはすべてオリジナルです。</p>
  <div class="op-lines story-cast">${[['masa', '要するに、負けず嫌いが止まらんかったっちゅうことや！'], ['root', 'くやしさは、いちばん強い学びの入り口です。']].map(([who, txt]) => `<div class="op-line ${who}"><div class="cm-av">${KB.casterSVG(who, 'happy')}</div><div class="op-bubble"><span class="cm-name">${who === 'root' ? '解説・ルート博士' : '実況・ナニワのマサ'}</span>${esc(txt)}</div></div>`).join('')}</div>
  <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="tut-start">ルールの説明を受ける</button><button class="btn" data-go="numbers">数字で見る計算ブリッジ</button></div></div>`;
}
function rulesHTML() {
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← 戻る</button><div class="where">ルールと前提</div><div></div></div>
  <div class="panel row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;max-width:70ch"><span class="small">博士とマサが、例を使って3分でルールとコツを説明します。</span><button class="btn primary sm" data-act="tut-start">チュートリアルで学ぶ</button></div>
  <div class="panel stack" style="max-width:70ch">
  <p style="margin:0">${esc(RULES_TXT)}</p>
  <div><b>このアプリでの前提</b><ul class="small">
  <li>ジョーカーなし52枚。山札が尽きたら捨て札を切り直して使います。</li>
  <li>手番は時計回り。1ゲーム目の親（最初の手番・場札をめくる人）は抽選、2ゲーム目からは前のゲームでPPが一番多かった人が親です（同点は抽選）。</li>
  <li>セット内でPP合計が同じ人は、上の順位を分け合います（得点も同じ）。</li>
  <li>大会の総合順位は「得点 → 累計PP の少ない順」。それでも同じで決勝ラインをまたぐときはジャンケン（またはサドンデス1ゲーム）。</li>
  <li>決勝はその1セットのPPだけで順位を決め、同点はジャンケン／サドンデスで決めます。</li>
  <li>他の卓はあなたのゲームと同時に1ゲームずつ進みます（達人も速さ優先の簡易思考で打ちます）。</li>
  </ul></div>
  <div><b>名前つきの待ち（このアプリでの呼び名）</b><ul class="small">
  <li>ミラクルセット：A・2・6。3枚で出し切れる場が2〜K（A以外）の12通りある、3枚で唯一の12面待ち。</li>
  <li>ベストペア：2・6。3・4・8・Qの4通りで出し切れる、2枚で唯一の4面待ち。</li>
  <li>多面待ち：3枚で10面以上の待ち（A・2・4、A・2・5 の11面など）。</li>
  </ul></div>
  <div><b>AIの読みのしくみ</b><ul class="small">
  <li>候補手ごとに、見えていないカードから相手の手札と山札を何千通りも割り振り、最後まで打ち切ってみて結果を集計します（モンテカルロ法）。</li>
  <li>相手が今の場で「引いた」なら、その数を作れない手札だったと推理して割り振ります。</li>
  <li>相手は表示中の強さ・性格どおりに打つと仮定します。非表示なら「中級の平均的な打ち手」と仮定します。</li>
  <li>比べる物差しは状況で変わります：練習＝セット期待点、予選＝決勝進出率（他卓の進み具合と残りセットも推定）、決勝＝優勝率。</li>
  </ul></div></div>`;
}

// ---------- モーダル・演出 ----------
// 設定のモーダルを描き直すとき、スクロールの位置をそのままにする（＋−を押すたびに一番上へ戻らないように）
function modalKeep(fn) {
  const bg = $('#modal'), box = bg && bg.querySelector('.modal'), a = bg ? bg.scrollTop : 0, b = box ? box.scrollTop : 0;
  fn();
  const bg2 = $('#modal'), box2 = bg2 && bg2.querySelector('.modal');
  if (bg2) { bg2.classList.add('still'); bg2.scrollTop = a; } if (box2) box2.scrollTop = b;
}
function modal(html) {
  closeModal();
  const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.id = 'modal';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(bg);
  bindModal(bg);
  bindTBNext();
}
function closeModal() { const m = $('#modal'), ch = m && m.querySelector('.chart-modal'); if (m) m.remove(); resumeGame(); if (ch && S.view === 'game') renderGame(); else if (ch && S.view === 'home') render(); } // 早見表を閉じたら、ボタンの進み具合を更新
// お知らせは下から積み上げる（バッジ・冠・アイテムのお知らせが重ならないように）
function toastStack() { let st = document.getElementById('toast-stack'); if (!st) { st = document.createElement('div'); st.id = 'toast-stack'; document.body.appendChild(st); } return st; }
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; toastStack().appendChild(d); setTimeout(() => d.remove(), 2600); }
function confetti() {
  const c = document.createElement('div'); c.className = 'confetti';
  const cols = ['#f0a020', '#e64980', '#4dabf7', '#51cf66', '#ffd43b', '#9b5de5'];
  for (let i = 0; i < 60; i++) { const e = document.createElement('i'); e.style.left = Math.random() * 100 + '%'; e.style.background = cols[i % cols.length]; e.style.animationDelay = Math.random() * 0.6 + 's'; c.appendChild(e); }
  document.body.appendChild(c); setTimeout(() => c.remove(), 2800);
}

// ---------- イベント ----------
function bind() {
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  const on = (sel, ev, fn) => { const e = $(sel); if (e) e[ev] = fn; };
  on('#set-name', 'onchange', e => { S.settings.name = e.target.value.trim() || 'あなた'; store.set('settings', S.settings); const L = profiles(), pr = L.find(x => x.id === PID); if (pr) { pr.name = S.settings.name; raw.set('kb.profiles', L); } });
  on('#set-speed', 'onchange', e => { S.settings.speed = e.target.value; store.set('settings', S.settings); });
  on('#set-lv', 'onchange', e => { S.settings.showLevel = e.target.checked; store.set('settings', S.settings); render(); });
  on('#set-st', 'onchange', e => { S.settings.showStyle = e.target.checked; store.set('settings', S.settings); render(); });
  document.querySelectorAll('.set-spoil').forEach(el => el.onchange = e => { S.settings.spoiler = e.target.checked; store.set('settings', S.settings); });
  document.querySelectorAll('.set-cm').forEach(el => el.onchange = e => { S.settings.commentary = e.target.value; store.set('settings', S.settings); });
  document.querySelectorAll('.set-cmo').forEach(el => el.onchange = e => { S.settings.cmOthers = e.target.value === '1'; store.set('settings', S.settings); });
  document.querySelectorAll('.set-judge').forEach(el => el.onchange = e => { S.settings.judge = e.target.value; S.settings.judgeSet = true; store.set('settings', S.settings); });
  document.querySelectorAll('.set-warn').forEach(el => el.onchange = e => { S.settings.warnMiss = e.target.checked; store.set('settings', S.settings); });
  on('#set-snd', 'onchange', e => { setSnd(e.target.value); });
  on('#set-auto', 'onchange', e => { S.settings.autoHint = e.target.checked; store.set('settings', S.settings); });
  document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b));
  document.querySelectorAll('[data-dqc]').forEach(b => b.onclick = () => { const D = S.drill, i = +b.dataset.dqc, k = D.sel.indexOf(i); if (k >= 0) D.sel.splice(k, 1); else { if (D.sel.length >= 3) D.sel.shift(); D.sel.push(i); } KB.sfx(k >= 0 ? 'unselect' : 'select'); render(); });
  document.querySelectorAll('[data-bdg]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.bdg.split(':'); S.advBack = null; badgeTalk(k, +i); });
  document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => catTalk(b.dataset.cat));
  document.querySelectorAll('[data-emb]').forEach(b => b.onclick = () => { const gi = +b.dataset.emb, g = G_(), cp = catProgress(g, gi), got = g.ach['cat:' + gi];
    const text = cp.done ? `「${cp.gn}」コンプリートや！特別バッジ「${cp.name}」、${got ? new Date(got).toLocaleDateString('ja-JP') + 'にゲット、' : ''}これは誇ってええで！` : `これは「${cp.gn}」の特別バッジ「${cp.name}」や！このカテゴリーのバッジを全部集めたらもらえるで。いま${cp.have}/${cp.all}、あと${cp.all - cp.have}個や！`;
    modal(`<div class="bdg-talk"><div class="bdg-big">${emblemSVG(gi, cp.done, 84)}<b>${esc(cp.name)}</b><small>${esc(cp.gn)}・特別バッジ</small></div><div class="commentary"><div class="cm-av">${KB.casterSVG('masa', cp.done ? 'happy' : 'normal')}</div><div class="cm-body"><span class="cm-name">実況・ナニワのマサ</span><span class="cm-text">${esc(text)}</span></div></div><div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="close">閉じる</button></div></div>`); });
  if (S.view === 'set-end') { const rw = $('#review-wrap'); if (rw) bindReview(rw); }
  if (S.view === 'opening') { // 新しいセリフが出るたびに、そこまで自動でスクロール
    (S.opTimers || []).forEach(clearTimeout); S.opTimers = [];
    document.querySelectorAll('.op-line, #op-start').forEach(el => { const dl = parseFloat(el.style.animationDelay) || 0; S.opTimers.push(setTimeout(() => { if (S.view === 'opening' && el.isConnected) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, dl * 1000 + 250)); });
  }
  if (S.view === 'setup-practice' || S.view === 'setup-tour') { // 設定画面：チップ・席・＋−、こだわり設定の開け閉め、数字を打ち込んだとき
    document.querySelectorAll('[data-su]').forEach(b => b.onclick = () => suTap(b.dataset));
    const adv = $('#su-adv'); if (adv) adv.addEventListener('toggle', () => { S.suAdv = adv.open; });
    // 数字を打ち込んだとき：画面ごと作り直すと、そのまま押した「大会を開始」が効かなくなるので、関係するところだけ直す
    ['#t-n', '#t-sets', '#t-games', '#t-fin'].forEach(q => { const e = $(q); if (e) e.addEventListener('change', suTourRefresh); });
    ['#p-points', '#t-points', '#t-tie'].forEach(q => { const e = $(q); if (e) e.addEventListener('change', () => { if (S.view === 'setup-tour') Object.assign(suT(), readTourCfg()); else suP().points = readPoints(e.value); }); });
  }
  if (S.view === 'setup-practice' || S.view === 'setup-tour') { renderRuleBox(); document.querySelectorAll('#app select, #app input').forEach(e => { e.addEventListener('change', () => setTimeout(renderRuleBox, 0)); e.addEventListener('input', () => setTimeout(renderRuleBox, 0)); }); }
  if (S.view === 'setup-tour') {
    let tm; const upd = () => { clearTimeout(tm); tm = setTimeout(renderEst, 150); };
    ['#t-n', '#t-sets', '#t-games', '#t-points', '#t-fin', '#t-mix'].forEach(sel => { const e = $(sel); if (e) { e.addEventListener('input', upd); e.addEventListener('change', upd); } });
    const w = $('#t-est-wrap'); if (w) w.addEventListener('toggle', () => { S.estOpen = w.open; if (w.open) renderEst(); });
    renderEst();
  }
  if (S.view === 'game') renderGame();
  if (S.view === 'home' && !profiles().length && !S.askedName && !(window.KB_TEST && !localStorage.getItem('kb.testAskName'))) { S.askedName = true; askName(); }
  else if (S.view === 'home' && S.updatedNotice && !S.updShown) { S.updShown = true; showUpdateNotice(); }
}
// アプリ更新で中断したとき：見落とさないよう、画面中央に大きく出す
function showUpdateNotice() {
  const saved = store.get('session', null); if (!saved) return;
  modal(`<div class="upd-modal"><div class="upd-icon" aria-hidden="true">!</div>
    <h2><span class="nw">アプリをアップデートしたため、</span><br><span class="nw">中断しました</span></h2>
    <p>${esc(saved.cfg.kind === 'practice' ? '練習' : '大会')}の<b>${saved.phase === 'final' ? '決勝' : '第' + saved.set + 'セット'} ${resumeLabel(saved)}</b>${gameFinished(saved) || liveUsable(saved) ? '' : 'の最初'}から再開できます。</p>
    <button class="btn primary upd-go" data-act="resume">途中から再開する</button>
    <button class="btn ghost sm" data-act="dismiss-update">あとで（ホームに戻る）</button></div>`);
  KB.sfx('banner');
}
function bindGame() {
  document.querySelectorAll('#tablewrap [data-card]').forEach(b => b.onclick = () => {
    const id = +b.dataset.card; const i = S.sel.indexOf(id);
    if (i >= 0) { S.sel.splice(i, 1); KB.sfx('unselect'); } else { if (S.sel.length >= 3) S.sel.shift(); S.sel.push(id); KB.sfx('select'); }
    S.newCard = null; S.confirmDraw = false; renderGame();
  });
  document.querySelectorAll('#tablewrap [data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b));
  document.querySelectorAll('.topbar [data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b));
}
function bindHint() {
  document.querySelectorAll('#hintpanel [data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b));
  bindAsk($('#hintpanel'));
}
function bindAsk(root) {
  if (!root) return;
  root.querySelectorAll('[data-ask]').forEach(b => b.onclick = () => ask(b.dataset.ask));
  root.querySelectorAll('.ask input').forEach(inp => inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { const b = inp.parentElement.querySelector('[data-ask]'); b && b.click(); } });
}
function bindModal(root) {
  bindReview(root);
  root.querySelectorAll('[data-why]').forEach(b => b.onclick = () => { const r = root.querySelector('#why-' + b.dataset.why); r.hidden = !r.hidden; b.setAttribute('aria-expanded', String(!r.hidden)); b.textContent = r.hidden ? '理由' : '閉じる'; });
  root.querySelectorAll('[data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b));
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { closeModal(); go(b.dataset.go); });
  bindAsk(root);
}
function readPoints(v) { const a = String(v).split(/[,、\s]+/).map(x => parseInt(x, 10)).filter(x => !isNaN(x)); return a.length ? a : [10, 8, 5, 2, 0]; }
function act(a, el) {
  switch (a) {
    case 'start-practice': {
      const n = +$('#p-n').value;
      const opps = []; document.querySelectorAll('.opp-row').forEach(r => opps.push({ level: r.querySelector('.o-lv').value, style: r.querySelector('.o-st').value }));
      const c = { n, games: +$('#p-games').value, mix: $('#p-mix').value, opps, points: readPoints($('#p-points') ? $('#p-points').value : suP().points.join(',')), preset: suP().preset };
      store.set('cfgPractice', c);
      S.T = newSession({ kind: 'practice', games: c.games, mix: c.mix, opps: opps.slice(0, n - 1), points: c.points, tie: 'janken' });
      stat('pStart'); startSet(); break;
    }
    case 'practice-again': { const cfg = S.T.cfg; S.T = newSession(Object.assign({}, cfg)); stat('pStart'); startSet(); break; }
    case 'start-tour': {
      const c = readTourCfg();
      store.set('cfgTour', c);
      S.T = newSession(Object.assign({ kind: 'tournament' }, c));
      go('opening'); break;
    }
    case 'tour-again': { const cfg = S.T.cfg; S.T = newSession(Object.assign({}, cfg)); go('opening'); break; }
    case 'opening-start': (S.opTimers || []).forEach(clearTimeout); if (S.T && S.T.set === 1 && !S.T.statStarted) { S.T.statStarted = true; stat('tStart'); } startSet(); break;
    case 'opening-skip': (S.opTimers || []).forEach(clearTimeout); document.querySelectorAll('.op-line').forEach(el => { el.style.animation = 'none'; el.style.opacity = 1; }); const ob = $('#op-start'); if (ob) { ob.style.animation = 'none'; ob.style.opacity = 1; } break;
    case 'resume': {
      if (S.updatedNotice) closeModal();
      S.updatedNotice = false;
      S.T = store.get('session', null); if (!S.T) break;
      const h = S.T.setHist[S.T.setHist.length - 1];
      const setDone = h && h.set === S.T.set && h.phase === S.T.phase;
      if (setDone && S.T.phase === 'prelim' && S.T.finalists && S.T.finalists.length && S.T.set === S.T.cfg.sets) go('entrance');
      else if (setDone) go('set-end');
      else if (liveUsable(S.T)) restoreLive();
      else if (gameFinished(S.T)) { if (S.T.game < S.T.cfg.games) { S.T.game++; startGame(); } else endSet(); } // ゲーム終了後に中断していたら、次のゲームから
      else startGame();
      break;
    }
    case 'discard-save': store.del('session'); render(); break;
    case 'show-stats': showStats(); break;
    case 'profiles': profileModal(); break;
    case 'drill': { const again = S.view === 'drill'; S.drill = newDrill(); go('drill'); if (!again) outsIntro(); break; }
    case 'drill-next': drillNext(); break;
    case 'drill-submit': drillSubmit(); break;
    case 'drill-hint': S.drill.hint = true; render(); break;
    case 'new-profile': askName(true); break;
    case 'rename-profile': modal(`<div class="upd-modal"><h2>名前を変更</h2><input id="ren-name" class="name-input" maxlength="10" value="${esc(S.settings.name)}"><p class="small name-err" id="name-err" hidden></p><button class="btn primary upd-go" data-act="rename-save">変更する</button><button class="btn ghost sm" data-act="profiles">戻る</button></div>`); setTimeout(() => { const i = $('#ren-name'); if (i) i.focus(); }, 50); break;
    case 'rename-save': { const i = $('#ren-name'); const name = ((i && i.value) || '').trim().slice(0, 10); if (name === S.settings.name) { profileModal(); break; } if (S.nameBusy) break; S.nameBusy = true; nameCheck(name, PID).then(err => { S.nameBusy = false; if (err) { nameErr(err); return; } act('rename-ok'); }); break; }
    case 'rename-ok': { const i = $('#ren-name'); const name = ((i && i.value) || '').trim().slice(0, 10); if (name) { S.settings.name = name; store.set('settings', S.settings); const L = profiles(), pr = L.find(x => x.id === PID); if (pr) { pr.name = name; raw.set('kb.profiles', L); } } profileModal(); render(); setTimeout(profileModal, 0); break; }
    case 'create-profile': { const i = $('#new-name'); const name = ((i && i.value) || '').trim().slice(0, 10); if (S.nameBusy) break; S.nameBusy = true; nameCheck(name, null).then(err => { S.nameBusy = false; if (err) { nameErr(err); return; } act('create-ok'); }); break; }
    case 'create-ok': { const i = $('#new-name'); const name = ((i && i.value) || '').trim().slice(0, 10) || 'あなた'; const id = createProfile(name); switchProfile(id); toast(`${name}さん、ようこそ！`); setTimeout(() => { if (!$('#modal') && S.view === 'home') tutInvite(name); }, 700); if (S.updatedNotice && !S.updShown) { S.updShown = true; setTimeout(showUpdateNotice, 300); } break; }
    case 'export-data': exportData(); break;
    case 'copy-export': { const t = $('#exp-text'); if (t) { t.select(); try { navigator.clipboard.writeText(t.value).then(() => toast('コピーしました'), () => { document.execCommand('copy'); toast('コピーしました'); }); } catch (e) { document.execCommand('copy'); toast('コピーしました'); } } break; }
    case 'import-text': { const t = $('#imp-text'); if (t && t.value.trim()) importData(t.value.trim()); break; }
    case 'growth-reset': if (!S.resetArm) { S.resetArm = true; render(); setTimeout(() => { S.resetArm = false; if (S.view === 'growth') render(); }, 4000); } else { S.resetArm = false; store.del('growth'); store.del('zukan'); toast('成長記録をリセットしました'); render(); } break;
    case 'dismiss-update': S.updatedNotice = false; closeModal(); render(); break;
    case 'play': humanPlay(); break;
    case 'draw': humanDraw(false); break;
    case 'draw-yes': humanDraw(true); break;
    case 'draw-no': S.confirmDraw = false; renderGame(); break;
    case 'clear': S.sel = []; renderGame(); break;
    case 'speed-cycle': if (S.attack) { toast('バッジアタック中は速さが固定です'); break; } { const k = SPD_ORDER[(SPD_ORDER.indexOf(S.settings.speed) + 1) % SPD_ORDER.length]; S.settings.speed = k; store.set('settings', S.settings); document.querySelectorAll('.spd-btn').forEach(b => { b.textContent = spdLabel(); b.title = b.ariaLabel = 'AIの手番の速さ：' + SPD_JA[k]; }); toast('AIの手番の速さ：' + SPD_JA[k]); break; }
    case 'sound': { const ks = Object.keys(KB.SFX_LEVELS); setSnd(ks[(ks.indexOf(S.settings.sndLv) + 1) % ks.length]); break; }
    case 'toggle-unseen': S.showUnseen = !S.showUnseen; renderSide(); break;
    case 'hint': computeHint(); break;
    case 'hint-more': deepHint(); break;
    case 'eval-mine': evalMine(); break;
    case 'standings': S.standingsReturn = !!S.inSummary; showStandings(); break;
    case 'close': closeModal(); if (S.standingsReturn) { S.standingsReturn = false; const pr = $('#peek-return'); if (pr) pr.remove(); showGameSummary(true); } break;
    case 'peek-board': {
      closeModal();
      const r = document.createElement('div'); r.className = 'peek-return'; r.id = 'peek-return';
      r.innerHTML = '<span>盤面を確認中</span><button class="btn primary" data-act="back-summary">結果に戻る</button>';
      document.body.appendChild(r); r.querySelector('button').onclick = () => act('back-summary');
      break;
    }
    case 'back-summary': { const r = $('#peek-return'); if (r) r.remove(); showGameSummary(true); break; }
    case 'quit': if (S.attack) { modal(`<div class="stack"><h3 style="margin:0">アタックを中止しますか？</h3><p class="small muted" style="margin:0">中止すると、ここまでのBPで終了します。完走のバッジ（バッジアタックの系統）は数えません。</p><div class="row" style="justify-content:flex-end"><button class="btn" data-act="close">続ける</button><button class="btn primary" data-act="attack-abort">中止する</button></div></div>`); break; } clearTimeout(S.timer); S.game = null; S.tiebreak = null; go('home'); break;
    case 'hunt-start': huntStart(); break;
    case 'migrate-out': migrateOut(); break;
    case 'chart-open': chartIntro(); break;
    case 'cloud-show': { const e = $('#cl-code'); if (e) e.textContent = e.dataset.code; break; }
    case 'cloud-copy': { const e = $('#cl-code'); if (e) { try { navigator.clipboard.writeText(e.dataset.code).then(() => toast('コピーしました'), () => toast(e.dataset.code)); } catch (x) { toast(e.dataset.code); } } break; }
    case 'cloud-restore': case 'code-restore': { const v = (($(a === 'code-restore' ? '#an-code' : '#cl-in') || {}).value || '').trim(); if (v.replace(/[^0-9a-z]/gi, '').length !== 12) { toast('12文字のコードを入れてください'); break; } if (S.restBusy) break; S.restBusy = true; cloudRestore(v).finally(() => { S.restBusy = false; }); break; }
    case 'watch-start': { closeModal(); const first = !store.get('watched', false); store.set('watched', true); watchStart(first); break; } // 初めての観戦は、強さも性格もそろった決まった顔ぶれ
    case 'watch-first': closeModal(); watchStart(true); break;
    case 'tut-start': tutStart(); break;
    case 'tut-next': tutGo(1); break;
    case 'tut-back': tutGo(-1); break;
    case 'tut-end': closeModal(); S.tut = null; tutPlay(); break;
    case 'tut-skip': tutBye('skip'); break;
    case 'tut-later': S.tut = null; tutBye('later'); break;
    case 'tut-close': closeModal(); S.tut = null; break;
    case 'watch-next': watchNext(); break;
    case 'watch-quit': closeModal(); watchEnd(); go('home'); break;
    case 'watch-again': closeModal(); watchStart(); break;
    case 'watch-play': closeModal(); watchEnd(); go('setup-practice'); break;
    case 'chart-view': chartOpen(true); break;
    case 'about-scroll': { const a = document.getElementById('about'); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'start' }); break; }
    case 'hunt-target': { const H = S.hunt; if (!H || H.started) break; const v = +el.dataset.v || null; H.target = v; store.set('huntT', v); huntDeal(H); KB.sfx('select'); render(); break; }
    case 'hunt-go': huntGo(); break;
    case 'hunt-go-aim': huntGo(true); break;
    case 'hunt-card': { const H = S.hunt; if (!H || !H.started || H.over || H.blocked || H.auto) break; const id = +el.dataset.id; if (H.sel.includes(id)) H.sel = H.sel.filter(x => x !== id); else if (H.sel.length < 3) H.sel.push(id); else break;
      if (H.sel.length === 3) { const vals = H.sel.map(i => H.hand.find(c => c.id === i).v).sort((a, b) => a - b); if (!((ZK.byCombo[vals.join(',')] || {})[H.field.v] || []).length) { H.sel = H.sel.slice(); render(); huntPass(`${vals.map(KB.vname).join('・')} では ${KB.vname(H.field.v)} を作れない`); break; } }
      KB.sfx('select'); render(); break; }
    case 'hunt-play': if (!(S.hunt && S.hunt.auto)) huntPlay(); break;
    case 'hunt-pass': if (!(S.hunt && S.hunt.auto)) huntPass(); break;
    case 'hunt-quit': if (S.hunt && S.hunt.started && !S.hunt.over) huntFinish(true); else { clearInterval(S.huntTimer); S.hunt = null; go('home'); } break;
    case 'avatar-edit': S.avDraft = myAvatar(); avatarEditor(); break;
    case 'av-locked': { const key = el.dataset.k + ':' + el.dataset.v; KB.sfx('back'); toast(`🔒 ${avItemName(key)}：${avLockText(key)}で使えます`); break; }
    case 'av-set': { const d = S.avDraft || (S.avDraft = myAvatar()); let v = el.dataset.v; const k = el.dataset.k; if (v !== '' && AV_LOCK[k + ':' + v] && String(k === 'base' ? d.base : d[k]) === v) { KB.sfx('select'); toast(`🏅 ${avItemName(k + ':' + v)}：${avGotText(k + ':' + v)}`); break; } if (k === 'glasses') v = v === 'true'; else if (['acc', 'outfit', 'face', 'gl', 'hold', 'pet', 'bgpat'].includes(k) && v === '') v = null; if (k === 'bgpat') { d.bgpat = v; } else if (k === 'base') { if (AV_OPTS.age.some(x => x[0] === v)) { d.age = v; d.base = null; } else d.base = v; } else d[k] = v; if (k === 'hs') d.gender = ['bob', 'long', 'pony', 'bun', 'twin'].includes(v) ? 'f' : 'm'; KB.sfx('select'); avatarEditor(); break; }
    case 'av-random': { const g0 = G_(), pk = (k, a) => { const ok = a.filter(x => avUnlocked(k + ':' + (Array.isArray(x) ? x[0] : x), g0)); return ok[(Math.random() * ok.length) | 0]; }; const d = S.avDraft = Object.assign({}, AVATAR_DEF, { age: pk('age', AV_OPTS.age)[0], hs: pk('hs', AV_OPTS.hs)[0], hair: pk('hair', AV_OPTS.hair), skin: pk('skin', AV_OPTS.skin), shirt: pk('shirt', AV_OPTS.shirt), glasses: false, gl: Math.random() < 0.3 ? pk('gl', AV_OPTS.gl)[0] : null, acc: Math.random() < 0.6 ? pk('acc', AV_OPTS.acc)[0] : null, outfit: Math.random() < 0.5 ? pk('outfit', AV_OPTS.outfit)[0] : null, face: Math.random() < 0.4 ? pk('face', AV_OPTS.face)[0] : null, hold: Math.random() < 0.35 ? pk('hold', AV_OPTS.hold)[0] : null, pet: Math.random() < 0.3 ? pk('pet', AV_OPTS.pet)[0] : null, bg: pk('bg', AV_OPTS.bg), bgpat: Math.random() < 0.2 ? pk('bgpat', AV_OPTS.bgpat)[0] : null }); d.gender = ['bob', 'long', 'pony', 'bun', 'twin'].includes(d.hs) ? 'f' : 'm'; if (Math.random() < 0.3) { const b = pk('base', AV_OPTS.base.slice(4)); if (b) d.base = b[0]; } avatarEditor(); break; }
    case 'av-save': { store.set('avatar', S.avDraft); if (S.T) { const h = S.T.players.find(p => p.human); if (h) Object.assign(h.ch, S.avDraft); } S.avDraft = null; closeModal(); toast('アバターを保存しました'); render(); break; }
    case 'zk-t': S.zkT = +el.dataset.t; render(); break;
    case 'share-open': shareOpen(); break;
    case 'rank-ai': { raw.set('kb.rankAI', !rankWithAi()); S.rank = null; render(); break; }
    case 'rank-card': rankCardOpen(el.dataset.rid, !!el.dataset.me, el); break;
    case 'host-root': hostRules(); break;
    case 'host-masa': try { localStorage.setItem('kb.masaUsed', '1'); } catch (e) { } S.masaBeckoned = true; masaAdvice(); break;
    case 'masa-more': masaAdvice(true); break;
    case 'adv-back': { const f = S.advBack; S.advBack = null; if (f) f(); else closeModal(); break; }
    case 'masa-rival': rivalPick(); break;
    case 'adv-go': { const g = el.dataset.go, a2 = el.dataset.a; closeModal(); if (g) go(g); else if (a2) act(a2); break; }
    case 'rival-cmp': rivalCompare(el.dataset.rid, el.dataset.name); break;
    case 'rival-toggle': rivalToggle(el.dataset.rid, el.dataset.name); break;
    case 'rv-list': rvListModal(el.dataset.k); break;
    case 'notes-open': notesOpen(); break;
    case 'notes-more': S.notesN = (S.notesN || 40) + 40; notesOpen(true); break;
    case 'note-go': noteGo(+el.dataset.i); break;
    case 'bio-edit': bioEdit(el.dataset.from); break;
    case 'bio-save': { const t = $('#bio-text'); store.set('bio', t ? [...t.value.replace(/\r/g, '')].slice(0, 140).join('').trim() : ''); toast('自己紹介を保存しました'); if (S.bioFrom === 'home') { closeModal(); render(); } else profileModal(); break; }
    case 'share-save': shareSave(); break;
    case 'attack-best': attackBestModal(); break;
    case 'attack-next': attackNextSetGo(); break;
    case 'attack-abort': attackFinish(true); break;
    case 'attack-start': closeModal(); attackStart(el && el.dataset.min); break;
    case 'next-game': nextGame(); break;
    case 'fab-home': fabHome(); break;
    case 'on-new': onNewModal(); break;
    case 'on-tour-new': S.onTourEdit = null; S.onTour = null; S.inv = null; onTourNewModal(); break;
    case 'on-tour-edit': { const t = ON.t, d = new Date(t.startAt * 1000), loc = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); const pk = (PTS_PRE.find(x => x[2].join() === (t.points || []).join()) || PTS_PRE[0])[0];
      S.inv = null; S.onTour = { name: t.name, desc: t.desc || '', start: loc, limit: t.limit, judge: t.judge || 'after3', min: t.min, max: t.max, aiFill: t.aiFill, aiLv: t.aiLv, aiMix: t.aiMix || 'even', entry: t.entry, invites: (t.invites || []).join('\n'), official: t.official, sets: t.sets, games: t.games, finalists: t.finalists, pts: pk };
      S.onTourEdit = t.id; onTourNewModal(); break; }
    case 'on-arch': onArchiveOpen(); break;
    case 'title-open': titleModal(); break;
    case 'on-tour-remove': modal(`<div class="stack"><h3 style="margin:0">大会を削除しますか？</h3><p class="small muted" style="margin:0">「${esc(ON.t.name)}」を過去の大会から消します。元には戻せません（取ったバッジと称号は残ります）。</p><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-act="close">やめる</button><button class="btn primary" data-act="on-tour-remove-go">削除する</button></div></div>`); break;
    case 'on-tour-remove-go': onReq('on_tour_act', { id: ON.t.id, act: 'remove' }).then(() => { closeModal(); clearInterval(ON.ttimer); ON.t = null; toast('削除しました'); onArchiveOpen(); }).catch(e => toast(e.message)); break;
    case 'title-set': store.set('title', el.dataset.id); closeModal(); try { cloudDirty('kb.p.' + PID + '.title'); } catch (e) { } toast(el.dataset.id ? '称号をつけました' : '称号を外しました'); render(); break;
    case 'on-tour-create': onTourCreate(); break;
    case 'on-tour-open': ON.ttab = null; onReq('on_tour', { id: el.dataset.id }).then(j => onTourShow(j.tour)).catch(e => toast(e.message)); break;
    case 'on-tour-home': clearInterval(ON.ttimer); ON.t = null; ON.toursAt = 0; go('home'); break;
    case 'on-tour-entry': case 'on-tour-cancel': case 'on-tour-startnow': case 'on-tour-delete': case 'on-tour-ready': onReq('on_tour_act', Object.assign(onMe(), { id: ON.t.id, act: a.slice(8) })).then(j => { ON.t = j.tour; if (j.tour.myRoom) { S.onAutoRoom = j.tour.myRoom; onRoomOpen(j.tour.myRoom); } else render(); }).catch(e => toast(e.message)); break;
    case 'on-room-open': S.onAutoRoom = el.dataset.id; onRoomOpen(el.dataset.id); break;
    case 'on-watch': ON.pov = 0; onRoomOpen(el.dataset.id); break;
    case 'on-to-tour': onStop(); onReq('on_tour', { id: ON.v.tour }).then(j => onTourShow(j.tour)).catch(e => toast(e.message)); break;
    case 'on-create': onEnter('on_create', S.onCfg); break;
    case 'on-join': { const c = ($('#on-code') || {}).value || ''; if (c.trim().length < 6) { toast('6文字のコードを入れてください'); break; } onEnter('on_join', { id: c.trim() }); break; }
    case 'on-quit': onStop(); if (ON.v && ON.v.phase === 'lobby') onReq('on_act', { id: ON.v.id, act: 'leave' }).catch(() => { }); ON.v = null; go('home'); break;
    case 'on-addai': onAct('addai'); break;
    case 'on-kick': onAct('kick', { seat: +el.dataset.seat }); break;
    case 'on-begin': onAct('start'); break;
    case 'on-back': onAct('back'); break;
    case 'on-chat': onChatModal(); break;
    case 'on-chat-send': onChatSend(($('#on-chat-in') || {}).value); break;
    case 'on-auto': { const r = ratingOf(G_().games), lv = r.ok ? Math.max(2, Math.min(4, Math.floor(r.r - 1))) : 2; onAct('auto', { lv }); toast(`AI★${lv}に任せました（「自分で打つ」でいつでも戻れます）`); break; }
    case 'on-draw': onAct('draw'); break;
    case 'on-play': { const vals = onSelVals(); if (vals.length) onAct('play', { vals }); break; }
    case 'on-copy': try { navigator.clipboard.writeText(ON.v.id); toast('コピーしました'); } catch (e) { } break;
    case 'fab-home-go': S.resumeFn = null; closeModal(); act('quit'); break;
    case 'undo': undoAsk(); break;
    case 'undo-go': undoGo(); break;
    case 'undo-no': closeModal(); break;
    case 'win-ok': { const w = S.winShow; S.winShow = null; S.bubbles = {}; renderGame(); if (w) w.then(); break; }
    case 'next-set': S.T.set++; startSet(); break;
    case 'to-final': toFinal(); break;
    case 'start-final': startFinal(); break;
    case 'final-result': finalResult(); break;
    case 'strat-save': {
      try { const s = KB.validateStrategy(JSON.parse($('#strat-json').value)); KB.setStrategy(s); store.set('strategy', s); toast('保存しました'); render(); }
      catch (e) { $('#strat-msg').textContent = '読み込めませんでした：' + e.message; $('#strat-msg').style.color = 'var(--bad)'; }
      break;
    }
    case 'strat-copy': { const t = $('#strat-json'); navigator.clipboard && navigator.clipboard.writeText(t.value).then(() => toast('コピーしました'), () => { t.select(); }); break; }
    case 'strat-reset': KB.setStrategy(JSON.parse(JSON.stringify(KB.DEFAULT_STRATEGY))); store.del('strategy'); render(); toast('初期値に戻しました'); break;
    case 'gen-style': genStyle(); break;
  }
}
function deepHint() {
  const g = S.game; const me = g.current(); const H = S.hint; if (!H || !H.ev) return;
  H.busy = true; renderHint();
  setTimeout(() => {
    const cands = H.ev.slice(0, 5).map(e => e.m).filter(Boolean);
    const ev = KB.evaluate(H.view, cands.length ? cands : [null], 12000, H.ctx);
    rankEv(ev, H.ctx);
    const rest = H.ev.slice(5);
    H.ev = ev.concat(rest); H.busy = false; renderHint();
  }, 30);
}
function evalMine() {
  const g = S.game; const me = g.current(); const H = S.hint; if (!H || !H.ev) return;
  const hand = g.hands[me];
  const vals = S.sel.map(id => hand.find(c => c.id === id)).filter(Boolean).map(c => c.v);
  const m = KB.evalSelection(vals, H.t); if (!m) return;
  H.busy = true; renderHint();
  setTimeout(() => {
    const ev = KB.evaluate(H.view, [H.ev[0].m, m], 1600, H.ctx);
    const adj = ev[1]; adj.goal = adj.goal - ev[0].goal + H.ev[0].goal;
    H.ev.push(adj); rankEv(H.ev, H.ctx); H.busy = false; renderHint();
  }, 30);
}

// 吹き出しを時間で消す
setInterval(() => {
  if (S.view !== 'game' || S.winShow) return;
  let changed = false;
  for (const k in S.bubbles) if (S.bubbles[k] && Date.now() - S.bubbles[k].at > 2600) { S.bubbles[k] = null; changed = true; }
  if (changed) document.querySelectorAll('.bubble').forEach(b => b.remove());
}, 700);

// Claude（sample）
(async () => {
  try {
    if (window.claude && window.claude.use) {
      const s = await window.claude.use('sample');
      if (s) { S.sample = s; if (S.view === 'strategy') render(); else if (S.view === 'game') renderHint(); rerenderReview(); }
    }
  } catch (e) { }
})();

document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-char]'); if (t) { e.preventDefault(); charProfile(t.dataset.char); } });
if (MIG_IN) { S.askedName = true; setTimeout(() => migrateIn(MIG_IN), 50); }
else if (CLOUD_ON) setTimeout(cloudInit, 100);
// AI研究員（毎朝の自動対局。ai/daily.js）用：ミニゲームを強さ lv に合った結果で「遊んだことにする」。記録とバッジは本物と同じ処理を通す
// AI研究員：前の版で付いた半端なバッジアタックの記録を5の倍数に直す
function aiFixAttack() {
  const b = attackBests(), r = b[ATTACK_MIN]; if (!r || r.bp % 5 === 0) return false;
  r.bp = Math.round(r.bp / 5) * 5; store.set('attackBest', b); const g = G_(); if (g.cnt.atk_bp) { g.cnt.atk_bp = Math.round(g.cnt.atk_bp / 5) * 5; G_save(g); } return true;
}
function aiMini(kind, lv, formAdj) {
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), L = Math.max(1, Math.min(5, lv | 0)) - 1;
  if (kind === 'hunt') { // 式ハンター：まだの式をいくつか捕獲
    const z = zukanGet(), want = R([3, 5, 8, 11, 14][L], [6, 9, 13, 17, 22][L]), free = KB.shuffle(ZUKAN.filter(e => !z[e.id])).slice(0, want);
    free.forEach(e => z[e.id] = { at: Date.now() }); store.set('zukan', z); zukanBadges(z);
    const best = store.get('huntBest', null), rec = { regs: free.length, score: free.length * R(15, 25), at: Date.now() };
    if (!best || rec.regs > best.regs) store.set('huntBest', rec);
    return { kind, regs: free.length };
  }
  if (kind === 'outs') { // アウツチャレンジ：1問ごとに強さに応じた確率で正解。外したらそこまで
    const p = [0.55, 0.65, 0.75, 0.85, 0.93][L]; let clean = 0; while (clean < DRILL_N && Math.random() < p) clean++;
    const failed = clean < DRILL_N, g = G_(); g.drill = g.drill || { n: 0, ok: 0 }; g.drill.n += clean + (failed ? 1 : 0); g.drill.ok += clean; g.drill.sets = (g.drill.sets || 0) + 1; g.drill.best = Math.max(g.drill.best || 0, clean); G_save(g);
    if (clean >= 3) bump('outs3'); if (clean >= 4) bump('outs4'); if (!failed) bump('outs5');
    return { kind, clean };
  }
  if (kind === 'chart') { // 早見表：まだの行をいくつか完成させる（式は札で作れるものを自分で探す）
    const data = chartGet(), men = chartMen(), full = new Set(chartFullRows()), todo = KB.shuffle(CHART_ROWS.map((r, i) => i).filter(i => !full.has(i))).slice(0, R([1, 1, 1, 2, 2][L], [1, 2, 2, 3, 4][L]));
    todo.forEach(i => { const r = CHART_ROWS[i], key = r.join(','), d = data[key] = data[key] || {}; men[i].forEach(t => { if (d[t]) return; const m = KB.findMoves(KB.countsOf(r), t, 'all', 3).find(x => x.n === r.length); if (m) d[t] = m.expr.replace(/\d+/g, n => KB.vname(+n)); }); });
    store.set('chart', data); setMax('chart', chartFullRows().length);
    return { kind, rows: chartFullRows().length };
  }
  if (kind === 'tour') { // 大会：15〜17人・予選3〜4セット・5ゲーム（大会のバッジの対象）に出たことにする。決勝進出・優勝の確率は今の推定実力と調子で決まる。冠（優勝）は大きいので控えめ
    const r = ratingOf(G_().games), e = Math.max(0.5, Math.min(5.5, (r.ok ? r.r : lv) + (formAdj || 0)));
    const lerp = (tbl) => { if (e <= 1) return tbl[0]; if (e >= 5) return tbl[4]; const i = Math.floor(e) - 1; return tbl[i] + (tbl[i + 1] - tbl[i]) * (e - Math.floor(e)); };
    const x = Math.random(), mix = e >= 4.5 && x < 0.2 ? 'master' : e >= 3.5 && x < 0.45 ? 'strong' : 'even', sets = R(3, 4);
    const pq = lerp([0.08, 0.18, 0.32, 0.5, 0.65]) * { even: 1, strong: 0.7, master: 0.5 }[mix], pc = lerp([0.1, 0.15, 0.22, 0.3, 0.38]) * { even: 1, strong: 0.8, master: 0.65 }[mix];
    const allSets = Math.random() < Math.pow(lerp([0.12, 0.18, 0.25, 0.33, 0.42]), sets), qual = allSets || Math.random() < pq, champ = qual && Math.random() < pc;
    bump('tour_done'); if (allSets) bump('all_sets');
    if (qual) { bump('qualify'); if (mix !== 'even') setMax('qualify_strong', mix === 'master' ? 2 : 1); }
    if (champ) { bump('champion'); if (mix !== 'even') setMax('champion_strong', mix === 'master' ? 2 : 1); }
    return { kind, mix, sets, allSets, qual, champ, e: +e.toFixed(2) };
  }
  if (kind === 'attack') { // バッジアタック：今の推定実力（まだなければ★）と、その日の調子でBPが決まる。自己ベストは上回ったときだけ更新
    const r = ratingOf(G_().games), base = Math.max(0.5, (r.ok ? r.r : lv) + (formAdj || 0));
    const bp = Math.max(60, Math.round((100 + base * 130) * (0.82 + Math.random() * 0.36) / 5) * 5), nb = Math.round(bp / R(18, 26)); // 本物と同じく5の倍数（バッジのBPと順位ボーナスの合計なので）
    const bests = attackBests(); if (!bests[ATTACK_MIN] || bp > bests[ATTACK_MIN].bp) { bests[ATTACK_MIN] = { bp, badges: nb, at: Date.now(), ach: [] }; store.set('attackBest', bests); }
    const gr = G_(); gr.cnt.atk_done = (gr.cnt.atk_done || 0) + 1; gr.cnt.atk_bp = Math.max(gr.cnt.atk_bp || 0, bp); gr.cnt.atk_badges = Math.max(gr.cnt.atk_badges || 0, nb); ['atk_done', 'atk_bp', 'atk_badges'].forEach(k => checkAch(gr, k)); G_save(gr);
    return { kind, bp, best: attackBests()[ATTACK_MIN].bp, rating: r.ok ? +r.r.toFixed(2) : null };
  }
  return null;
}

// ================= オンライン対局（テスト版で試し中。段階1：1卓2〜5人） =================
// 山札と手札はサーバー（api.php の on_*）が持つ。画面は1.5秒ごとに様子を読み、自分の手札だけを受け取る。
// 時間切れは自動で「引く」。3回続くとAI★2が代わりに打つ（「自分で打つ」で戻れる）
const ON_ENABLED = () => CLOUD_ON; // オンライン大会：クラウド版（本番・テスト版）で使える
const ON = { v: null, ver: 0, timer: null, tick: null, sel: [], busy: false, lastCur: null, lastLog: 0, err: '', opened: {}, bub: {}, cer: {} };
function onlineHomeHTML() {
  if (!ON_ENABLED()) return '';
  const last = store.get('onRoom', null), L = ON.tours;
  const fmt = t => { const d = new Date(t * 1000); return `${d.getMonth() + 1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const stat = v => v.phase === 'entry' ? (v.now >= v.entryAt ? '<em class="on-st open">受付中</em>' : '<em class="on-st">受付前</em>') : v.phase === 'prelim' || v.phase === 'final' ? '<em class="on-st live">開催中</em>' : v.phase === 'done' ? '<em class="on-st">終了</em>' : '<em class="on-st">中止</em>';
  // 状態ごとに色の帯とアイコン（受付中は緑・開催中は赤・受付前は金）。押せることが分かるように右に ›
  const kind = v => v.phase === 'entry' ? (v.now >= v.entryAt ? 'open' : 'soon') : v.phase === 'prelim' || v.phase === 'final' ? 'live' : 'end';
  const icon = v => ({ open: '🏆', live: '🔥', soon: '⏳', end: '🏁' })[kind(v)];
  const rows = L ? (L.length ? L.map(v => `<button class="on-trow k-${kind(v)} ${v.official ? 'off' : ''} ${v.entered || v.invited ? 'mine' : ''}" data-act="on-tour-open" data-id="${v.id}"><span class="on-ti" aria-hidden="true">${icon(v)}</span><span class="on-tb"><span class="on-tn">${v.official ? '<em class="on-off">公式</em>' : ''}<b>${esc(v.name)}</b>${stat(v)}</span><span class="small muted">${fmt(v.startAt)}・主催 ${esc(v.hostName)}・${v.entry === 'invite' ? (v.invited ? '<b class="on-in">招待されています</b>' : '招待のみ') : '誰でも'}・${v.min}〜${v.max}人・予選${v.sets}セット${v.entered ? '・<b class="on-in">エントリー済み</b>' : ''}</span></span><span class="on-tgo" aria-hidden="true">›</span></button>`).join('') : '<p class="small muted" style="margin:0">いまひらかれている大会はありません</p>') : '<p class="small muted" style="margin:0">読み込み中…</p>';
  return `<div class="mode on-card"><div class="mode-head"><span class="mode-ic" aria-hidden="true">🌐</span><div><div class="lbl">ONLINE</div><h2>オンライン大会</h2></div></div>
    <div class="on-tlist">${rows}</div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="on-tour-new">大会をひらく</button><button class="btn sm" data-act="on-arch">🗂 過去の大会</button></div>
    <details class="on-free"><summary>大会ではなく、卓だけで対局する</summary>
      <div class="on-join"><input id="on-code" class="su-in" maxlength="6" placeholder="卓のコード（6文字）" autocomplete="off" value="${esc(last || '')}"><button class="btn" data-act="on-join">入る</button></div>
      <button class="btn sm" data-act="on-new">卓をつくる</button></details></div>`;
}
// 自分の上位3位をサーバーから読み、いまのプレイヤーのバッジに反映（公式と非公式は別のバッジ）
async function onAwardsSync() {
  try { const j = await onReq('on_awards'); ON.myAwards = j.awards || [];
    const mine = ON.myAwards.filter(a => a.pid === PID), best = off => Math.max(0, ...mine.filter(a => !!+a.official === off).map(a => 4 - a.place));
    const b1 = best(false), b2 = best(true); if (b1) setMax('on_podium', b1); if (b2) setMax('off_podium', b2);
  } catch (e) { }
}
async function onArchiveOpen() { go('oarch'); try { const j = await onReq('on_tours_archive'); ON.arch = j.tours; } catch (e) { ON.arch = []; toast('読み込めませんでした'); } if (S.view === 'oarch') render(); }
function oarchHTML() {
  const L = ON.arch, fmt = t => { const d = new Date(t * 1000); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; };
  return `<div class="topbar"><button class="btn ghost sm" data-go="home">← ホーム</button><div class="where">🗂 過去のオンライン大会</div><div></div></div>
    <div class="panel stack">${!L ? '<p class="small muted" style="margin:0">読み込み中…</p>' : L.length ? L.map(v => `<button class="on-trow" data-act="on-tour-open" data-id="${v.id}"><span class="on-tn">${v.official ? '<em class="on-off">公式</em>' : ''}<b>${esc(v.name)}</b><em class="on-st">${v.phase === 'done' ? '終了' : '中止'}</em></span><span class="small muted">${fmt(v.startAt)}・主催 ${esc(v.hostName)}・${v.n}人${v.awards && v.awards.length ? '・🥇 ' + esc(v.awards[0].name) : ''}${v.entered ? '・<b class="on-in">出場</b>' : ''}</span></button>`).join('') : '<p class="small muted" style="margin:0">まだ終わった大会はありません</p>'}</div>`;
}
async function onToursLoad() {
  if (!ON_ENABLED() || ON.toursLoading) return; ON.toursLoading = true;
  try { const j = await onReq('on_tours'); ON.tours = j.tours; ON.canOfficial = j.canOfficial; ON.uid = j.uid; onAwardsSync(); } catch (e) { ON.tours = ON.tours || []; } finally { ON.toursLoading = false; }
  try { const mk = store.get('noteMark', {}) || {}, soon = mk.soon || {}, now = Date.now() / 1000; let ch = false; (ON.tours || []).forEach(t => { if (t.entered && t.phase === 'entry' && t.startAt - now < 1800 && t.startAt > now && !soon[t.id]) { soon[t.id] = 1; ch = true; noteAdd('soon', { tid: t.id, tname: t.name, at: t.startAt }); } }); if (ch) { mk.soon = soon; store.set('noteMark', mk); } } catch (e) { }
  const el = S.view === 'home' && $('.on-card'); if (el) { el.outerHTML = onlineHomeHTML(); document.querySelectorAll('.on-card [data-act]').forEach(b => b.onclick = () => act(b.dataset.act, b)); }
}
// ---- 大会をひらく ----
function onTourNewModal() {
  const d0 = new Date(Date.now() + 20 * 60000); d0.setMinutes(Math.ceil(d0.getMinutes() / 5) * 5, 0, 0);
  const loc = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const c = S.onTour = S.onTour || { name: `${S.settings.name || ''}杯`, desc: '', start: loc(d0), limit: 30, judge: 'after3', min: 4, max: 15, aiFill: true, aiLv: 2, aiMix: 'even', entry: 'open', invites: '', official: false, sets: 3, games: 5, finalists: 5, pts: 'std' };
  const seg = (k, opts) => `<div class="su-seg">${opts.map(([v, l]) => `<button class="${String(c[k]) === String(v) ? 'on' : ''}" data-ot="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const num = (k, mn, mx) => `<div class="su-step"><button class="su-pm" data-otn="${k}" data-v="-1" ${c[k] <= mn ? 'disabled' : ''}>−</button><b class="tnum">${c[k]}</b><button class="su-pm" data-otn="${k}" data-v="1" ${c[k] >= mx ? 'disabled' : ''}>＋</button></div>`;
  modal(`<div class="stack on-new"><h3 style="margin:0">🌐 ${S.onTourEdit ? '大会を編集' : '大会をひらく'}</h3>
    <label class="su-row col"><b>大会の名前</b><input id="ot-name" class="su-in" maxlength="30" value="${esc(c.name)}"></label>
    <label class="su-row col"><b>大会の説明</b><textarea id="ot-desc" rows="2" maxlength="300" placeholder="例）初心者歓迎！ 3セットの予選のあと、上位5人で決勝">${esc(c.desc)}</textarea></label>
    <label class="su-row col"><b>開始日時</b><input id="ot-start" type="datetime-local" class="su-in" value="${esc(c.start)}"><small class="muted">開始の15分前からエントリーできます</small></label>
    <div class="su-row col"><b>1手の制限時間</b>${seg('limit', [[60, '1分'], [30, '30秒'], [15, '15秒'], [10, '10秒']])}</div>
    <div class="su-row col"><b>式の判定</b>${seg('judge', [['before', '式を先に確認'], ['after3', 'お手つき3枚'], ['after2', 'お手つき2枚']])}<small class="muted">お手つき：出したあとに判定し、場の数にならなければ札を戻してペナルティで引く</small></div>
    <div class="su-row"><b>最少人数</b>${num('min', 2, 40)}</div><div class="su-row"><b>最大人数</b>${num('max', 2, 40)}</div>
    <div class="su-row col"><b>最少人数に足りないとき</b>${seg('aiFill', [['true', 'AIを入れて開催'], ['false', '中止']])}</div>
    ${c.aiFill ? `<div class="su-row col"><b>入れるAIの強さ</b>${seg('aiMix', Object.entries(MIX).map(([k, m]) => [k, m.label]))}<small class="muted">ふつうの大会の「相手の強さ」と同じ割合で★1〜5のAIが入ります</small></div>` : ''}
    <div class="su-row col"><b>エントリーできる人</b>${seg('entry', [['open', '誰でも'], ['invite', '招待した人だけ']])}</div>
    ${c.entry === 'invite' ? `<div class="su-row col inv-box"><b>招待する人 <small class="muted" id="ot-inv-n"></small></b><div class="inv-chips" id="ot-inv-chips"></div><input id="ot-inv-q" class="su-in" placeholder="🔍 名前でさがす（ランキングの名前）" autocomplete="off" maxlength="10"><div class="inv-res" id="ot-inv-res"></div></div>` : ''}
    <div class="su-row"><b>予選のセット数</b>${num('sets', 1, 6)}</div><div class="su-row"><b>1セットのゲーム数</b>${num('games', 1, 10)}</div>
    <div class="su-row col"><b>決勝</b>${seg('finalists', [[0, 'なし'], [3, '上位3人'], [4, '上位4人'], [5, '上位5人']])}</div>
    <div class="su-row col"><b>セット順位の得点</b>${seg('pts', PTS_PRE.map(([k, l, a]) => [k, `${l}<small>${a.join('・')}</small>`]))}</div>
    ${ON.canOfficial ? `<div class="su-row col"><b>公式大会</b>${seg('official', [['false', 'ふつうの大会'], ['true', '公式大会']])}</div>` : ''}
    <p class="small muted" style="margin:0">🏅 バッジと称号（上位3位）は、人が10人以上参加した大会だけです（AIは数えません）。</p>
    <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-act="close">やめる</button><button class="btn primary" data-act="on-tour-create">${S.onTourEdit ? '変更を保存' : 'ひらく'}</button></div></div>`);
  const keep = () => { c.name = $('#ot-name').value; c.desc = $('#ot-desc').value; c.start = $('#ot-start').value; };
  if (c.entry === 'invite') invInit(c);
  document.querySelectorAll('#modal [data-ot]').forEach(b => b.onclick = () => { keep(); const k = b.dataset.ot, v = b.dataset.v; c[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; modalKeep(onTourNewModal); });
  document.querySelectorAll('#modal [data-otn]').forEach(b => b.onclick = () => { keep(); const k = b.dataset.otn; c[k] += +b.dataset.v; if (k === 'min' && c.max < c.min) c.max = c.min; if (k === 'max' && c.min > c.max) c.min = c.max; modalKeep(onTourNewModal); });
}
// 招待する人を選ぶ：選んだ人はチップ（×で外す）。名前でさがす／最近の大会でいっしょだった人・前に招待した人から押して加える
const invNorm = x => String(x).normalize('NFKC').toLowerCase().replace(/[\s・._\-ー]/g, '');
const invList = c => String(c.invites || '').split(/[\n、,]+/).map(x => x.trim()).filter(Boolean);
function invToggle(c, name) { const L = invList(c), i = L.findIndex(x => invNorm(x) === invNorm(name)); if (i >= 0) L.splice(i, 1); else if (L.length < 40) L.push(name); else { toast('招待できるのは40人までです'); return; } c.invites = L.join('\n'); KB.sfx('select'); invPaint(c); }
function invRow(c, p, sel) { return `<button class="inv-p ${sel ? 'on' : ''}" data-inv="${esc(p.name)}"><span class="inv-av">${KB.avatarSVG(Object.assign({ name: p.name }, p.avatar || AVATAR_DEF), { mood: 'happy' })}</span><span class="inv-nm">${esc(p.name)}${p.why ? `<small>${p.why === 'played' ? '大会でいっしょ' : '前に招待'}</small>` : ''}</span><span class="inv-add">${sel ? '✓ 招待' : '＋'}</span></button>`; }
function invPaint(c) {
  const L = invList(c), has = n => L.some(x => invNorm(x) === invNorm(n));
  const ch = $('#ot-inv-chips'); if (!ch) return;
  ch.innerHTML = L.length ? L.map(n => `<span class="inv-chip">${esc(n)}<button data-inv="${esc(n)}" aria-label="${esc(n)}を外す">×</button></span>`).join('') : '<small class="muted">まだだれも選んでいません。下から押して加えてください</small>';
  const nn = $('#ot-inv-n'); if (nn) nn.textContent = L.length ? `（${L.length}人）` : '';
  const q = (($('#ot-inv-q') || {}).value || '').trim(), R = $('#ot-inv-res'), I = S.inv || {};
  let html;
  if (q) {
    const list = I.q === q ? I.found : null;
    html = !list ? '<small class="muted">さがしています…</small>' : (list.length ? list.map(p => invRow(c, p, has(p.name))).join('') : '<small class="muted">ランキングに見つかりませんでした。</small>')
      + (list && !list.some(p => invNorm(p.name) === invNorm(q)) ? `<button class="inv-p raw ${has(q) ? 'on' : ''}" data-inv="${esc(q)}"><span class="inv-nm">「${esc(q)}」をそのまま招待<small>ランキングに載せていない人も、名前がそのとおりなら招待できます</small></span><span class="inv-add">${has(q) ? '✓ 招待' : '＋'}</span></button>` : '');
  } else html = I.recent ? (I.recent.length ? `<small class="muted">最近の大会でいっしょだった人・前に招待した人</small>${I.recent.map(p => invRow(c, p, has(p.name))).join('')}` : '<small class="muted">名前を入れると、ランキングの人からさがせます。</small>') : '<small class="muted">読み込み中…</small>';
  R.innerHTML = html;
  document.querySelectorAll('#modal [data-inv]').forEach(b => b.onclick = e => { e.preventDefault(); invToggle(c, b.dataset.inv); });
}
function invInit(c) {
  S.inv = S.inv || {}; invPaint(c);
  if (!S.inv.recent) onReq('on_people', {}).then(j => { S.inv.recent = j.list || []; invPaint(c); }).catch(() => { S.inv.recent = []; invPaint(c); });
  const qi = $('#ot-inv-q'); if (!qi) return; if (S.inv.qv) qi.value = S.inv.qv;
  qi.oninput = () => { S.inv.qv = qi.value; clearTimeout(S.inv.timer); const q = qi.value.trim(); invPaint(c); if (!q) return;
    S.inv.timer = setTimeout(() => onReq('on_people', { q }).then(j => { S.inv.q = q; S.inv.found = j.list || []; if ((($('#ot-inv-q') || {}).value || '').trim() === q) invPaint(c); }).catch(() => { S.inv.q = q; S.inv.found = []; invPaint(c); }), 300); };
  qi.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); const q = qi.value.trim(); if (q && !invList(c).some(x => invNorm(x) === invNorm(q))) invToggle(c, q); qi.value = ''; S.inv.qv = ''; invPaint(c); } };
}
async function onTourCreate() {
  const c = S.onTour; c.name = $('#ot-name').value; c.desc = $('#ot-desc').value; c.start = $('#ot-start').value;
  if (c.entry === 'invite' && !invList(c).length) { toast('招待する人を選んでください'); return; }
  const startAt = Math.round(new Date(c.start).getTime() / 1000);
  if (!c.name.trim()) { toast('大会の名前を入れてください'); return; }
  if (!startAt || startAt < Date.now() / 1000 - 60) { toast('開始日時を確かめてください'); return; }
  try {
    const j = await onReq(S.onTourEdit ? 'on_tour_act' : 'on_tour_new', Object.assign(onMe(), S.onTourEdit ? { id: S.onTourEdit, act: 'edit' } : {}, { tname: c.name, desc: c.desc, startAt, limit: c.limit, judge: c.judge, min: c.min, max: c.max, aiFill: c.aiFill, aiLv: c.aiLv, aiMix: c.aiMix, entry: c.entry, invites: c.invites.split(/[\n、,]+/).map(x => x.trim()).filter(Boolean), official: c.official, sets: c.sets, games: c.games, finalists: c.finalists, points: (PTS_PRE.find(x => x[0] === c.pts) || PTS_PRE[0])[2] }));
    closeModal(); S.onTour = null; if (S.onTourEdit) toast('変更しました'); S.onTourEdit = null; onTourShow(j.tour);
  } catch (e) { toast(e.message || 'ひらけませんでした'); }
}
// ---- 大会の画面（詳細・エントリー・進み具合・順位）----
function onTourShow(t) { ON.t = t; go('otour'); onTourPollStart(); }
function onTourPollStart() { clearInterval(ON.ttimer); ON.ttimer = setInterval(onTourPoll, 3000); }
async function onTourPoll() {
  if (S.view !== 'otour' || !ON.t) { clearInterval(ON.ttimer); return; }
  try { const j = await onReq('on_tour', { id: ON.t.id }); const prev = ON.t; ON.t = j.tour;
    if (j.tour.myRoom && (!prev || prev.myRoom !== j.tour.myRoom || S.onAutoRoom !== j.tour.myRoom)) { S.onAutoRoom = j.tour.myRoom; onRoomOpen(j.tour.myRoom); return; }
    if (j.tour.wait && j.tour.wait.need && !j.tour.wait.ready && !(prev && prev.wait)) KB.sfx('myturn');
    if (j.tour.phase === 'done' && prev && prev.phase !== 'done') onAwardsSync();
    if (!prev || prev.ver !== j.tour.ver) render(); else onTourClock();
  } catch (e) { }
}
async function onRoomOpen(id) { try { const v = await onReq('on_state', { id }); clearInterval(ON.ttimer); onStart(v); } catch (e) { toast(e.message || '卓を開けませんでした'); } }
function onTourClock() {
  const wt = $('#ot-wait'); if (wt) { const l = Math.max(0, Math.round(+wt.dataset.until - Date.now() / 1000)); wt.textContent = `あと${Math.floor(l / 60)}分${l % 60}秒で、そろっていなくても始まります（来ていない人の席はAIが打ちます）`; } const el = $('#ot-clock'), t = ON.t; if (!el || !t) return; const left = Math.max(0, Math.round(t.startAt - Date.now() / 1000)); el.textContent = t.phase === 'entry' ? (left > 0 ? `開始まで ${left >= 3600 ? Math.floor(left / 3600) + '時間' : ''}${Math.floor(left % 3600 / 60)}分${left < 600 ? (left % 60) + '秒' : ''}` : 'まもなく開始') : ''; }
// 大会の表彰（終わった大会を最初に開いたときだけ。上位3人が表彰台に上がる。数秒で閉じる）
function onCeremony(t) {
  if (!t || t.phase !== 'done' || !t.stand || ON.cer[t.id]) return; ON.cer[t.id] = 1;
  if (Date.now() / 1000 - t.now > 120 && !t.entered) return;
  const top = t.stand.slice(0, 3), avOf = r => r.ai ? onAv(r, 'happy') : KB.avatarSVG(Object.assign({}, r.avatar || AVATAR_DEF, { name: r.name }), { mood: 'happy' });
  const me = t.stand.findIndex(r => r.me);
  const el = document.createElement('div'); el.className = 'whistle-ov on-cer';
  const pod = [1, 0, 2].map(i => top[i] ? `<div class="pd p${i + 1}"><span class="on-av">${avOf(top[i])}</span><b>${esc(top[i].ai ? onName(top[i]) : top[i].name)}</b><div class="pd-step">${['🥇', '🥈', '🥉'][i]}<small>${i + 1}位</small></div></div>` : '').join('');
  const award = t.awardOk ? (t.awards.some(a => a.place - 1 === me) ? `🏅 ${['優勝', '準優勝', '3位'][me]}のバッジと称号を獲得！` : '') : '';
  el.innerHTML = `<div class="wh-box"><div class="wh-title">${t.official ? '公式 ' : ''}表彰式</div><div class="wh-sub">${esc(t.name)}</div><div class="on-pod">${pod}</div>${award ? `<div class="on-aw">${award}</div>` : ''}
    <div class="wh-say"><span class="cm-av">${KB.casterSVG('masa', 'happy')}</span><span><small>実況・ナニワのマサ</small>${esc(me === 0 ? 'おめでとう！ 優勝や！ 今日の主役はあんたや！' : me > 0 && me < 3 ? '表彰台や！ ようやったで！' : `${top[0] ? (top[0].ai ? onName(top[0]) : top[0].name) : ''}が優勝や！ ナイスゲームやったで！`)}</span></div>
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn primary" data-x="ok">順位を見る</button></div></div>`;
  document.body.appendChild(el); KB.sfx('horn', 2); setTimeout(confetti, 300); if (me >= 0 && me < 3) setTimeout(() => KB.sfx('win'), 600);
  const close = () => { if (!el.isConnected) return; el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  el.querySelector('[data-x="ok"]').onclick = close; setTimeout(close, 9000);
}
// 順位の表：決勝があるときは、上に決勝（決勝PPの少ない順）、下に予選（得点→累計PP）
function onStandHTML(t) {
  const isDone = t.phase === 'done', hasFin = !!t.finalists && (t.phase === 'final' || isDone) && t.stand.some(r => r.fin);
  const nm = r => esc(r.ai ? onName(r) : r.name);
  const medal = (k, on) => on && k < 3 ? ['🥇', '🥈', '🥉'][k] : k + 1;
  let fin = '';
  if (hasFin) {
    const F = t.stand.filter(r => r.fin); if (!isDone) F.sort((a, b) => b.pts - a.pts || a.pp - b.pp);
    fin = `<h3 class="on-sth">🏆 決勝${isDone ? '' : '（対局中）'}</h3><div class="on-stand tf"><div class="on-sh"><span>順位</span><span>名前</span><span>決勝PP</span></div>${F.map((r, k) => `<div class="on-sr ${r.me ? 'me' : ''}"><b>${isDone ? medal(k, true) : '—'}</b><span>${nm(r)}</span><span>${r.fpp != null ? r.fpp + 'PP' : '対局中'}</span></div>`).join('')}</div>`;
  }
  const P = t.stand.slice().sort((a, b) => b.pts - a.pts || a.pp - b.pp);
  const pre = `${hasFin ? '<h3 class="on-sth">予選</h3>' : ''}<div class="on-stand"><div class="on-sh"><span>順位</span><span>名前</span><span>得点</span><span>累計PP</span></div>${P.map((r, k) => `<div class="on-sr ${r.me ? 'me' : ''}"><b>${medal(k, isDone && !hasFin)}</b><span>${nm(r)}${r.fin ? '<em>決勝進出</em>' : ''}</span><span>${r.pts}点</span><span>${r.pp}</span></div>`).join('')}</div>`;
  return fin + pre;
}
function otourHTML() {
  const t = ON.t; if (!t) return '';
  const d = new Date(t.startAt * 1000), when = `${d.getMonth() + 1}月${d.getDate()}日（${'日月火水木金土'[d.getDay()]}）${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const now = Date.now() / 1000, open = t.phase === 'entry' && now >= t.entryAt;
  const ph = { entry: open ? '受付中' : '受付前', prelim: `予選 第${t.set}/${t.sets}セット`, final: '決勝', done: '終了', cancel: '中止' }[t.phase];
  const av = e => KB.avatarSVG(Object.assign({}, e.avatar || AVATAR_DEF, { name: e.name }), { mood: 'happy' });
  let body = '';
  if (t.phase === 'entry') {
    body = `<div class="on-ent">${t.entrants.map(e => `<span class="on-e"><span class="on-av">${av(e)}</span>${esc(e.name)}</span>`).join('') || '<span class="small muted">まだエントリーした人はいません</span>'}</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${open ? (t.entered ? '<button class="btn" data-act="on-tour-cancel">エントリーを取り消す</button>' : t.invited ? `<button class="btn primary" data-act="on-tour-entry" ${t.n >= t.max ? 'disabled' : ''}>エントリーする</button>` : '<span class="small">招待された人だけが出られます</span>') : `<span class="small muted">エントリーは ${new Date(t.entryAt * 1000).getHours()}:${String(new Date(t.entryAt * 1000).getMinutes()).padStart(2, '0')} から（開始の15分前）</span>`}
      ${t.mine && open ? '<button class="btn" data-act="on-tour-startnow">今すぐ始める（主催者）</button>' : ''}${t.mine && !open ? '<button class="btn sm" data-act="on-tour-edit">✏️ 編集</button><button class="btn ghost sm" data-act="on-tour-delete">🗑 削除</button>' : t.mine ? '<button class="btn ghost sm" data-act="on-tour-delete">中止する</button>' : ''}</div>`;
  } else if (t.stand) {
    const isDone = t.phase === 'done';
    const W = t.wait, wLeft = W ? Math.max(0, Math.round(W.until - Date.now() / 1000)) : 0;
    body = `${W ? `<div class="on-ready"><b>次は ${esc(W.label)}</b><span class="small">${W.need ? (W.ready ? `準備OK！ ほかの人を待っています（${W.nReady}/${W.n}人）` : 'そろったら始まります。準備ができたら押してください') : `出場する人の準備を待っています（${W.nReady}/${W.n}人）`}</span>${W.need && !W.ready ? '<button class="btn primary on-ready-btn" data-act="on-tour-ready">✋ 準備OK</button>' : ''}<span class="small muted" id="ot-wait" data-until="${W.until}">あと${Math.floor(wLeft / 60)}分${wLeft % 60}秒で、そろっていなくても始まります（来ていない人の席はAIが打ちます）</span></div>` : ''}${t.myRoom ? `<button class="btn primary" data-act="on-room-open" data-id="${t.myRoom}">▶ 自分の卓へ</button>` : t.entered && !W && (t.phase === 'prelim' || t.phase === 'final') ? '<p class="small muted" style="margin:0">ほかの卓が終わるのを待っています…</p>' : ''}
      ${onStandHTML(t)}
      ${(t.phase === 'prelim' || t.phase === 'final') && !t.wait && (t.rooms || []).length ? `<div class="on-rooms"><b class="small">👀 観戦する卓を選ぶ</b>${t.rooms.map(r => `<button class="on-room" data-act="on-watch" data-id="${r.id}" ${r.id === t.myRoom ? 'disabled' : ''}><b>${esc(r.label)}</b><span class="small muted">${r.phase === 'done' ? '終了' : '第' + r.gameNo + 'ゲーム'}・${(r.seats || r.names.map(x => ({ name: x }))).map(x => esc(onName(x))).join('・')}</span></button>`).join('')}</div>` : ''}`;
  } else if (t.phase === 'cancel') body = `<p style="margin:0">${esc(t.note || '中止になりました')}</p>`;
  if ((t.phase === 'done' || t.phase === 'cancel') && t.mine) body += '<div class="row" style="justify-content:flex-end"><button class="btn ghost sm" data-act="on-tour-remove">🗑 アーカイブから削除（主催者）</button></div>';
  return `<div class="topbar"><button class="btn ghost sm" data-act="on-tour-home">← ホーム</button><div class="where">🌐 オンライン大会</div><div></div></div>
    <div class="panel stack on-tour"><div class="on-th">${t.official ? '<em class="on-off">公式</em>' : ''}<h2 style="margin:0">${esc(t.name)}</h2><em class="on-st ${t.phase === 'prelim' || t.phase === 'final' ? 'live' : open ? 'open' : ''}">${ph}</em></div>
      <div class="small">${when} 開始・主催 ${esc(t.hostName)} <span class="muted" id="ot-clock"></span></div>
      ${t.desc ? `<p style="margin:0;white-space:pre-wrap">${esc(t.desc)}</p>` : ''}
      <div class="on-facts small muted">${t.awardOk === true ? `🏅 人が${t.awardMin}人以上の大会なので、上位3位にバッジと称号（${t.official ? '公式大会のバッジ' : 'オンライン大会のバッジ'}）・` : t.awardOk === false ? `人が${t.awardMin}人未満だったので、バッジはなし・` : `🏅 人が${t.awardMin}人以上集まれば、上位3位にバッジと称号・`}${t.entry === 'invite' ? '招待した人だけ' : '誰でもエントリー'}・${t.min}〜${t.max}人（いま${t.n}人）・予選${t.sets}セット×${t.games}ゲーム・${t.finalists ? `上位${t.finalists}人で決勝` : '決勝なし'}・1手${t.limit >= 60 ? '1分' : t.limit + '秒'}・${{ before: '式を先に確認', after3: 'お手つき3枚', after2: 'お手つき2枚' }[t.judge] || 'お手つき3枚'}・${t.aiFill ? `足りなければAI（${t.aiMix && MIX[t.aiMix] ? MIX[t.aiMix].label : '★' + t.aiLv}）で補充` : '足りなければ中止'}・得点 ${t.points.join('/')}</div>
      ${body}</div>`;
}
function onMe() { return { name: S.settings.name || 'プレイヤー', avatar: myAvatar(), pid: PID }; }
async function onReq(a, extra) { const c = PID ? plLink(PID) : null; if (!c || !c.token) throw new Error('クラウドに接続できていません'); return cloudReq(a, Object.assign({ token: c.token }, extra || {})); }
function onNewModal() {
  S.onCfg = S.onCfg || { n: 4, games: 3, limit: 30, judge: 'after3' };
  const c = S.onCfg;
  modal(`<div class="stack on-new"><h3 style="margin:0">🌐 卓をつくる</h3>
    <div class="su-row col"><b>人数（自分を入れて）</b>${suSeg('on-n', [[2, '2人'], [3, '3人'], [4, '4人'], [5, '5人']], c.n)}</div>
    <div class="su-row col"><b>ゲーム数</b>${suSeg('on-games', [[1, '1'], [3, '3'], [5, '5']], c.games)}</div>
    <div class="su-row col"><b>1手の制限時間</b>${suSeg('on-limit', [[60, '1分'], [30, '30秒'], [15, '15秒'], [10, '10秒']], c.limit)}<small class="muted">時間切れは自動で「引く」。3回続くと、AI★2が代わりに打ちます</small></div>
    <div class="su-row col"><b>式の判定</b>${suSeg('on-judge', [['before', '式を先に確認'], ['after3', 'お手つき3枚'], ['after2', 'お手つき2枚']], c.judge)}</div>
    <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" data-act="close">やめる</button><button class="btn primary" data-act="on-create">卓をつくる</button></div></div>`);
  document.querySelectorAll('#modal [data-su]').forEach(b => b.onclick = () => { const k = b.dataset.su.slice(3), v = b.dataset.v; S.onCfg[k] = isNaN(+v) ? v : +v; modalKeep(onNewModal); });
}
async function onEnter(a, extra) {
  try { const v = await onReq(a, Object.assign(onMe(), extra)); closeModal(); store.set('onRoom', v.id); onStart(v); }
  catch (e) { toast(e.message || '入れませんでした'); }
}
function onStart(v) { ON.v = v; ON.ver = v.ver; ON.sel = []; ON.lastCur = null; ON.lastLog = 0; go('online'); onPollStart(); }
function onPollStart() {
  clearInterval(ON.timer); clearInterval(ON.tick);
  ON.timer = setInterval(onPoll, 1500); ON.tick = setInterval(onClock, 250);
}
function onStop() { clearInterval(ON.timer); clearInterval(ON.tick); ON.timer = ON.tick = null; }
async function onPoll() {
  if (S.view !== 'online' || !ON.v) { onStop(); return; }
  if (ON.busy) return; ON.busy = true;
  try { const v = await onReq('on_state', { id: ON.v.id, ver: ON.ver }); ON.skew = Date.now() / 1000 - v.now; if (!v.same) onApply(v); ON.err = ''; }
  catch (e) { ON.err = e.message || '通信エラー'; const el = $('#on-err'); if (el) el.textContent = '⚠ ' + ON.err; }
  finally { ON.busy = false; }
}
function onApply(v) {
  const prev = ON.v; ON.v = v; ON.ver = v.ver;
  onChatIn(v, prev);
  const g = v.game;
  let fresh = [];
  if (g) {
    const same = prev && prev.id === v.id && prev.game && prev.gameNo === v.gameNo;
    fresh = same ? (g.log || []).filter(e => e.i > (prev.game.seq || 0)) : [];
    const mine = g.cur === v.me && v.phase === 'play' && !(v.seats[v.me] || {}).sub;
    if (mine && ON.lastCur !== `${v.id}:${v.gameNo}:${g.round}:${g.pos}`) { ON.lastCur = `${v.id}:${v.gameNo}:${g.round}:${g.pos}`; setTimeout(() => KB.sfx('myturn'), fresh.length ? 500 : 0); }
    if (!mine) ON.sel = [];
    // 新しく引いた札を光らせる
    if (same && prev.game.hand && g.hand && g.hand.length > prev.game.hand.length) { const old = prev.game.hand.map(c => c.join(',')); ON.newIds = g.hand.map((c, k) => old.includes(c.join(',')) ? -1 : k).filter(k => k >= 0); } else ON.newIds = [];
    // 開始・ゲームの区切りの演出
    if (v.phase === 'play' && (!prev || prev.id !== v.id || prev.phase === 'lobby') && v.gameNo === 1 && g.round <= 1 && !ON.opened[v.id]) { ON.opened[v.id] = 1; onOpening(v); }
    else if (prev && prev.id === v.id && prev.gameNo !== v.gameNo && v.phase === 'play') onGameBanner(v);
    onComment(v, prev, fresh);
    if (prev && prev.id === v.id && prev.phase === 'play' && v.phase !== 'play' && g.over) { KB.sfx(g.winner === v.me ? 'win' : g.winner >= 0 ? 'otherWin' : 'round'); if (g.winner === v.me) confetti(); }
    if (prev && prev.id === v.id && prev.phase !== 'done' && v.phase === 'done') setTimeout(() => KB.sfx('banner'), 900);
    if (v.tour && v.phase === 'done' && prev && prev.phase !== 'done') setTimeout(() => { if (S.view === 'online' && ON.v && ON.v.id === v.id) act('on-to-tour'); }, 6000); // 大会の卓が終わったら、大会の画面へ
  }
  render();
  if (fresh.length) setTimeout(() => onAnimate(v, fresh), 0);
}
// ひとこと：新しく届いたものを、その人の席のふきだしに少し長めに出す（はじめて開いたときの古いものは出さない）
const ON_STAMP_GROUPS = [
  ['あいさつ', ['よろしく！', 'よろしくお願いします', 'おつかれさま！', 'ありがとう', 'またね！', 'GG！']],
  ['反応', ['ナイス！', 'うまい！', 'すごい！', 'おしい！', 'なるほど〜', 'やられた〜', 'あちゃ〜', 'さすが！']],
  ['対局中', ['いい勝負！', '考え中…', 'ドキドキ…', 'あと少し！', 'お先に失礼！', '次は負けへんで！']],
  ['絵文字', ['👍', '👏', '😂', '😱', '🙏', '🔥']]
];
const ON_STAMPS = ON_STAMP_GROUPS.flatMap(g => g[1]);
function onChatIn(v, prev) {
  const L = v.chat || [], last = L.length ? L[L.length - 1].id : 0;
  if (!prev || prev.id !== v.id) { ON.chatSeen = last; return; }
  const nw = L.filter(c => c.id > (ON.chatSeen || 0)); ON.chatSeen = Math.max(ON.chatSeen || 0, last);
  ON.bub = ON.bub || {}; nw.forEach(c => { ON.bub[c.p] = { text: c.t, at: Date.now(), dur: 5000, chat: 1 }; });
  if (nw.some(c => c.p !== v.me)) { KB.sfx('select'); setTimeout(() => { if (S.view === 'online') render(); }, 5100); }
}
function onChatModal() {
  const v = ON.v; if (!v || v.me < 0) return;
  const L = (v.chat || []).slice(-8);
  modal(`<div class="stack on-chat-m"><h3 style="margin:0">💬 ひとこと</h3>
    ${ON_STAMP_GROUPS.map(([gl, L]) => `<div class="on-sgrp"><small class="muted">${gl}</small><div class="on-stamps">${L.map(t => `<button class="btn sm ${/^\p{Extended_Pictographic}$/u.test(t) ? 'emo' : ''}" data-onstamp="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`).join('')}
    <div class="row" style="gap:6px"><input id="on-chat-in" class="su-in" maxlength="30" placeholder="30文字まで" autocomplete="off" style="flex:1"><button class="btn primary" data-act="on-chat-send">送る</button></div>
    <p class="small muted" style="margin:0">卓のみんなの席に、ふきだしで出ます。ふさわしくない言葉や連絡先は送れません。</p>
    ${L.length ? `<div class="on-chat-log">${L.map(c => `<div><b>${esc(c.p === v.me ? 'あなた' : onName(v.seats[c.p] || {}))}</b>${esc(c.t)}</div>`).join('')}</div>` : ''}
    <div class="row" style="justify-content:flex-end"><button class="btn ghost sm" data-act="close">閉じる</button></div></div>`);
  document.querySelectorAll('#modal [data-onstamp]').forEach(b => b.onclick = () => onChatSend(b.dataset.onstamp));
  const i = $('#on-chat-in'); if (i) i.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); act('on-chat-send'); } };
}
async function onChatSend(text) {
  text = String(text || '').trim(); if (!text || !ON.v) return;
  if (ON.chatBusy) return; ON.chatBusy = true;
  try { const v = await onReq('on_act', { id: ON.v.id, act: 'chat', text }); closeModal(); onApply(v); KB.sfx('select'); }
  catch (e) { toast(e.message || '送れませんでした'); }
  ON.chatBusy = false;
}
// 新しい手の動き：起きた順に1つずつ再生する。出した札は場へ飛んで、場札の上に式といっしょに少し残る。引いた札は山札から席へ。
// 巡が変わったら、前の巡の手を見せ終わってから「第N巡」と新しい場札を大きく出す
function onAnimate(v, fresh) {
  const L = fresh.filter(e => e.type === 'play' || e.type === 'draw' || e.type === 'field').slice(-8);
  let t = Math.max(0, (ON.animUntil || 0) - Date.now()); // 前の再生が終わってから続ける
  L.forEach(e => {
    const at = t;
    if (e.type === 'field') { setTimeout(() => onRoundBanner(e), at); t += 1300; return; }
    setTimeout(() => {
      const seat = document.querySelector(`[data-pi="${e.p}"]`), pile = document.querySelector('.on-tbl .pile'), deck = document.querySelector('.on-tbl .deck');
      if (!seat || !pile) return; const from = seat.querySelector('.av') || seat;
      if (e.type === 'play') {
        if (e.p !== v.me) KB.sfx(e.vals.length === 3 ? 'play3' : 'play', e.vals.length);
        e.vals.forEach((x, n) => flyCard(from, pile, `<span>${KB.vname(x)}</span>`, n * 90, 460, true));
        seat.classList.add('acted'); setTimeout(() => seat.classList.remove('acted'), 900);
        setTimeout(() => onLand(e, v), 420 + e.vals.length * 90);
      } else { if (e.p !== v.me && !e.foul) KB.sfx('draw'); for (let q = 0; q < (e.foul ? e.n || 1 : 1); q++) flyCard(deck, seat, null, q * 160, 520, true); }
    }, at);
    t += e.type === 'play' ? 900 : 450;
  });
  ON.animUntil = Date.now() + t;
}
// 場札の上に、出した札と式を少しのあいだ重ねて見せる
function onLand(e, v) {
  const pile = document.querySelector('.on-tbl .pile'); if (!pile) return; // 画面が描き直されていても、いまの場札の位置に出す
  const r = pile.getBoundingClientRect(), el = document.createElement('div'); el.className = 'on-land';
  const who = e.p === v.me ? 'あなた' : onName(v.seats[e.p] || {});
  el.innerHTML = `<span class="ol-cards">${e.vals.map(x => `<i class="mc">${KB.vname(x)}</i>`).join('')}</span><b>${esc(e.expr)} = ${e.t}</b><small>${esc(who)}</small>`;
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(el); setTimeout(() => el.classList.add('out'), 900); setTimeout(() => el.remove(), 1250);
}
// 巡の切り替わり：「第N巡」と新しい場札を大きく
function onRoundBanner(e) {
  const el = document.createElement('div'); el.className = 'on-round';
  el.innerHTML = `<b>第${e.round}巡</b><span class="fieldcard top ${e.s === 1 || e.s === 2 ? 'red' : ''}"><span class="tag">新しい場</span><span class="big">${KB.vname(e.v)}</span><span class="val">${KB.SUITS[e.s]} ${e.v}</span></span>`;
  document.body.appendChild(el); KB.sfx('round'); setTimeout(() => el.classList.add('out'), 1050); setTimeout(() => el.remove(), 1400);
}
// 実況・解説（だれにでも見えることだけを話す：出した式・引いた・残りの枚数・上がり。手札の中身には触れない）
const ON_LINES = { // [話す人, セリフ, 重み]（重みが小さいものは、ときどきだけ出る特別なセリフ）
  three: [['masa', n => `${n}、3枚出し！一気に軽くしたで！`], ['masa', n => `${n}の3枚出しや！ハットトリック級やな！`], ['masa', n => `出た、3枚！${n}、ごっそり減らしたで！`], ['masa', n => `${n}、3枚まとめてシュートや！`],
    ['root', (n, e) => `${n}、3枚で「${e}」。手札を大きく減らしました。`], ['root', (n, e) => `「${e}」。3枚を一度に使える組み合わせを見つけました。`], ['root', n => `${n}は3枚出し。上がりに一歩近づきます。`],
    ['masa', n => `うわっ、${n}の3枚出し！思わず声出てもうた！`, 0.25], ['root', n => `3枚を一度に。${n}の計算力が光りましたね。`, 0.3]],
  divp: [['root', (n, e) => `${n}の「${e}」。かっこ付きの割り算、見事な計算です。`], ['masa', (n, e) => `「${e}」や！ノールックパスみたいな計算やな！`], ['root', (n, e) => `かっこと割り算を組み合わせた「${e}」。なかなか思いつけない形です。`],
    ['masa', n => `かっこ付きの割り算！${n}、職人技や！`], ['root', n => `数学的にも美しい一手です、${n}。`, 0.3]],
  div: [['root', (n, e) => `割り算の「${e}」。大きい数を上手に使いました。`], ['root', (n, e) => `「${e}」。割り算で大きい札を小さな数に変えています。`], ['masa', n => `${n}、割り算できれいに合わせたで！`]],
  big: [['root', (n, e, b) => `${n}、${b}を処分。上がられたときの失点を減らす手です。`], ['masa', (n, e, b) => `${n}、${b}をベンチに下げたで！守りも大事や！`], ['root', (n, e, b) => `大きい${b}を手放しました。PPの見込みが軽くなります。`],
    ['masa', (n, e, b) => `${b}を出した！重たい荷物、おろせたな！`], ['masa', n => `${n}、ディフェンスもしっかりしとる！`]],
  play: [['masa', (n, e) => `${n}、「${e}」でつないだ！`], ['masa', n => `ええパス回しや、${n}！`], ['root', (n, e) => `${n}は「${e}」。`], ['masa', (n, e) => `「${e}」！テンポよう打っとるで！`], ['root', (n, e) => `「${e}」で場をつくりました。`],
    ['masa', n => `${n}、落ち着いとるなぁ。`], ['root', n => `${n}、手堅い一手です。`], ['masa', n => `よし、${n}も一枚減らした！`]],
  left1: [['masa', n => `${n}、残り1枚！リーチや！ゴール前やで！`], ['masa', n => `${n}が残り1枚！ポーカーで言うたらオールインの構えや！`], ['root', n => `${n}が残り1枚。次の場の数がその札なら上がりです。`],
    ['masa', n => `来た来た、${n}がリーチや！みんな気ぃつけや！`], ['root', n => `${n}は残り1枚。ほかの人は失点に備える場面です。`], ['masa', n => `……あかん、黙っとられへん！${n}、残り1枚や！`, 0.3]],
  left2: [['masa', n => `${n}、残り2枚！詰めてきとるで！`], ['root', n => `${n}が残り2枚。次の場で上がる可能性があります。`], ['masa', n => `${n}、あと2枚！ゴール前まで来とる！`], ['root', n => `残り2枚の${n}。2枚の組み合わせで作れる数が勝負です。`]],
  draw: [['masa', n => `${n}はここで1枚引いた。`], ['masa', n => `${n}、ここは我慢のドローや。`], ['root', n => `${n}は山札から1枚。`], ['masa', n => `${n}、山札に手ぇ伸ばした！`], ['root', n => `${n}は引きました。次の場に期待です。`], ['masa', n => `${n}、ここはパスや。次や次！`]],
  timeout: [['masa', n => `時間切れや！${n}は自動で1枚引くで。`], ['root', n => `${n}は時間切れ。自動で1枚引きます。`], ['masa', n => `あちゃ、${n}の時計が止まってもうた！`]],
  foul: [['masa', (n, e, b) => `お手つきや〜！${n}は${b}枚引くで！`], ['root', (n, e, b) => `お手つきです。${n}は札を戻して、${b}枚引きます。`], ['masa', (n, e, b) => `イエローカードや！${n}、${b}枚追加や！`], ['masa', n => `うわー、お手つき！${n}、ドンマイや！`, 0.4]],
  sub: [['root', n => `${n}は時間切れが3回続いたので、AIが代わりに打ちます。`], ['masa', n => `${n}、席を外しとるみたいやな。AIが代わりに入るで！`]],
  auto: [['root', (n, e, lv) => `${n}は、ここからAI★${lv}に任せるようです。`], ['masa', n => `${n}、AIに任せたで！ベンチから見守る作戦や！`]],
  back: [['masa', n => `${n}、戻ってきたで！ここから自分で打つで！`], ['root', n => `${n}が自分の手番に戻りました。`]],
  reshuffle: [['root', () => '山札がなくなったので、捨て札を切り直しました。'], ['masa', () => '山札を切り直しや！ここからが本番やで！'], ['root', () => '切り直しです。出た札の数え直しが大事になります。']],
  win: [['masa', n => `${n}が上がりや！ゴラッソ！`], ['masa', n => `${n}、上がった！ゴール決まったで！`], ['root', (n, e, b, r) => `${n}が第${r}巡で上がりました。`], ['masa', n => `${n}、上がりや！ナイスゴール！`],
    ['root', (n, e) => `${n}が「${e}」で上がりました。`], ['masa', n => `決まったー！${n}の上がりや！`], ['masa', n => `${n}、ポーカーで言うたらロイヤルストレートフラッシュや！`, 0.3], ['root', n => `${n}、お見事。最後の札まで計算どおりです。`, 0.4]],
  none: [['root', () => '規定の巡数で終了です。'], ['masa', () => 'ここで時間切れ！引き分けみたいなもんやな！']],
  start: [['masa', (n, e, b, r, k) => `第${k}ゲーム、キックオフや！親は${n}！`], ['root', (n, e, b, r, k) => `第${k}ゲームです。親は${n}。`], ['masa', (n, e, b, r, k) => `さぁ第${k}ゲーム！${n}の親で始まるで！`],
    ['root', (n, e, b, r, k) => `第${k}ゲーム。手札は7枚ずつ、親は${n}です。`], ['masa', (n, e, b, r, k) => `第${k}ゲームや！……大会やから静かにしとこ。（できるかいな！）`, 0.3]]
};
function onSay(kind, args, prio) {
  const cmSet = S.settings.commentary; if (!cmSet || cmSet === 'off') return;
  let L = ON_LINES[kind] || []; const only = cmSet === 'root' ? 'root' : cmSet === 'masa' || cmSet === 'tetsu' ? 'masa' : null;
  if (only) { const f = L.filter(x => x[0] === only); if (f.length) L = f; else return; }
  if (!L.length) return;
  if (S.cm && S.cm.online && Date.now() - S.cm.at < 1800 && (S.cm.prio || 0) > prio) return; // 読んでいる途中の大事な実況は残す
  if (ON.v && ON.v.tour && prio < 3 && Math.random() < 0.85) return; // 大会では口数をひかえめに（ときどき我慢できずにしゃべる）
  const tw = L.reduce((x, l) => x + (l[2] == null ? 1 : l[2]), 0); let rr = Math.random() * tw, pick = L[0]; for (const l of L) { rr -= l[2] == null ? 1 : l[2]; if (rr <= 0) { pick = l; break; } }
  const [who, fn] = pick;
  S.cm = { who, text: fn(...args), prio, mood: kind === 'win' || kind === 'three' ? 'happy' : kind === 'timeout' ? 'worried' : 'normal', at: Date.now(), online: true };
}
function onComment(v, prev, fresh) {
  const g = v.game, nm = i => i === v.me ? 'あなた' : san(onName(v.seats[i]));
  if (prev && prev.id === v.id && prev.gameNo !== v.gameNo && v.phase === 'play') { onSay('start', [nm(g.order[0]), '', '', g.round, v.gameNo], 4); return; }
  if (prev && prev.id === v.id) v.seats.forEach((s, i) => { const p0 = prev.seats[i] || {}; if (s.sub && !p0.sub) onSay(s.auto ? 'auto' : 'sub', [nm(i), '', s.subLv], 5); if (!s.sub && p0.sub) onSay('back', [nm(i)], 5); });
  let best = null;
  for (const e of fresh) {
    let k = null, pr = 0, extra = [];
    if (e.type === 'play') {
      const big = e.vals.filter(x => x >= 11);
      if (e.left === 1) { k = 'left1'; pr = 6; } else if (e.left === 2) { k = 'left2'; pr = 5; }
      else if (/÷/.test(e.expr) && /\(/.test(e.expr)) { k = 'divp'; pr = 4; } else if (e.vals.length === 3) { k = 'three'; pr = 3; }
      else if (big.length) { k = 'big'; pr = 2; extra = [big.map(KB.vname).join('・')]; } else if (/÷/.test(e.expr)) { k = 'div'; pr = 2; } else { k = 'play'; pr = 1; }
      if (Math.random() < 0.35 && v.seats[e.p] && (v.seats[e.p].ai || v.seats[e.p].sub)) ON.bub[e.p] = { text: ['よし！', 'これでどうや', '計算どおり', 'ふふん', 'いけっ'][(Math.random() * 5) | 0], at: Date.now() };
    } else if (e.type === 'draw' && e.foul) { k = 'foul'; pr = 5; extra = [e.n]; if (e.p !== v.me) KB.sfx('foul'); }
    else if (e.type === 'draw') { if (e.by === 'timeout') { k = 'timeout'; pr = 4; ON.bub[e.p] = { text: '⏰', at: Date.now() }; } else { k = 'draw'; pr = 0.5; if (Math.random() < 0.3 && v.seats[e.p] && v.seats[e.p].ai) ON.bub[e.p] = { text: ['うーん…', 'ここは引く', 'しまった'][(Math.random() * 3) | 0], at: Date.now() }; } }
    else if (e.type === 'reshuffle') { k = 'reshuffle'; pr = 3; }
    else if (e.type === 'end') { k = e.winner >= 0 ? 'win' : 'none'; pr = 9; if (e.winner >= 0) ON.bub[e.winner] = { text: 'やった！', at: Date.now() }; }
    if (k && (!best || pr >= best.pr)) best = { k, pr, args: [e.p != null ? nm(e.p) : (e.winner >= 0 ? nm(e.winner) : ''), e.expr || '', extra[0] || '', e.round || g.round, v.gameNo] };
  }
  if (best) onSay(best.k, best.args, best.pr);
}
// 開始の演出：卓の名前と顔ぶれ、ホイッスル（2秒ちょっとで自動で消える。押しても消える）
function onOpening(v) {
  const el = document.createElement('div'); el.className = 'whistle-ov on-open';
  const label = v.tour ? (v.label || '大会') : 'オンライン対局';
  el.innerHTML = `<div class="wh-box"><div class="wh-title">${esc(label)}</div><div class="wh-sub">対局開始！ ${v.cfg.games}ゲーム・1手${v.cfg.limit >= 60 ? '1分' : v.cfg.limit + '秒'}</div>
    <div class="on-cast">${v.seats.map((s, i) => `<span class="on-cp" style="animation-delay:${0.15 + i * 0.12}s"><span class="on-av">${onAv(s, 'happy')}</span><small>${esc(i === v.me ? 'あなた' : onName(s))}</small></span>`).join('<b class="on-vs">vs</b>')}</div>
    ${v.tour ? `<div class="wh-say"><span class="cm-av">${KB.casterSVG('root', 'normal')}</span><span><small>解説・ルート博士</small>公平のため、実況と解説はだれにでも見えることだけにします。</span></div>` : ''}
    <div class="wh-say"><span class="cm-av">${KB.casterSVG('masa', 'happy')}</span><span><small>実況・ナニワのマサ</small>${esc(v.tour ? (/決勝/.test(v.label || '') ? '決勝や！泣いても笑ってもこの1セット！ 大会やから、あんま口出しせぇへんで！（できるかいな…）' : '大会やから、あんま口出しせぇへんで！（できるかいな…）') : 'ほな、キックオフや！ええ勝負見せてや！')}</span></div></div>`;
  document.body.appendChild(el); KB.sfx('whistle', 1);
  const close = () => { if (!el.isConnected) return; el.classList.add('out'); setTimeout(() => el.remove(), 300); };
  el.onclick = close; setTimeout(close, 2600);
  onSay('start', [v.game.order[0] === v.me ? 'あなた' : san(onName(v.seats[v.game.order[0]])), '', '', 1, 1], 4);
}
function onGameBanner(v) {
  const el = document.createElement('div'); el.className = 'on-banner';
  const d = v.game.order[0];
  el.innerHTML = `<b>第${v.gameNo}ゲーム</b><small>親：${esc(d === v.me ? 'あなた' : onName(v.seats[d]))}</small>`;
  document.body.appendChild(el); KB.sfx('banner'); setTimeout(() => el.classList.add('out'), 1300); setTimeout(() => el.remove(), 1700);
}
function onClock() {
  const v = ON.v, el = $('#on-clock'); if (!v || !el) return;
  const now = Date.now() / 1000 - (ON.skew || 0);
  const cs = v.game && v.seats[v.game.cur];
  if (v.phase === 'play' && cs && (cs.ai || cs.sub)) { el.innerHTML = `<b>🤖 ${esc(onName(cs))}の番（AIが打っています）</b>`; el.classList.remove('low'); }
  else if (v.phase === 'play' && v.game && v.game.deadline) {
    const left = Math.max(0, v.game.deadline - now), lim = v.cfg.limit;
    const mineT = v.game.cur === v.me; el.innerHTML = `<i style="width:${Math.min(100, left / lim * 100)}%"></i><b>${mineT ? 'あなたの番・' : esc(onName(cs)) + 'の番・'}残り${Math.ceil(left)}秒</b>`; el.classList.toggle('low', left <= 5); el.classList.toggle('mine', mineT);
    const sec = Math.ceil(left); if (mineT && sec <= 5 && sec > 0 && ON.tickSec !== sec) { ON.tickSec = sec; KB.sfx('click'); }
    const nx = $('#on-next'); if (nx) nx.textContent = '';
  } else if (v.phase === 'between' && v.game && v.game.nextAt) { const t = Math.max(0, Math.ceil(v.game.nextAt - now)); el.innerHTML = `<b>次のゲームまで ${t}秒</b>`; el.classList.remove('low'); const nx = $('#on-next'); if (nx) nx.textContent = `次のゲームまで ${t}秒`; }
  else el.innerHTML = '';
}
const onCards = h => (h || []).map((c, i) => ({ v: c[0], s: c[1], id: i }));
function onSelVals() { const v = ON.v, h = onCards(v.game && v.game.hand); return ON.sel.map(i => h[i] && h[i].v).filter(x => x != null); }
function onlineHTML() {
  const v = ON.v; if (!v) return '<div class="panel">読み込み中…</div>';
  const top = `<div class="topbar">${v.tour ? '<button class="btn ghost sm" data-act="on-to-tour">← 大会</button>' : '<button class="btn ghost sm" data-act="on-quit">← ホーム</button>'}<div class="where">🌐 ${v.tour ? esc(v.label || '大会') : `卓 <b class="mono">${esc(v.id)}</b>`}</div><div class="small muted">${v.phase === 'lobby' ? '受付中' : v.phase === 'done' ? '終了' : `第${v.gameNo}/${v.cfg.games}ゲーム`}</div></div>`;
  const tot = i => (v.setPP[i] || []).reduce((a, b) => a + b, 0);
  const avatar = (s, mood) => KB.avatarSVG(Object.assign({}, s.avatar || AVATAR_DEF, { name: s.name }), { mood: mood || 'normal' });
  if (v.phase === 'lobby') {
    return top + `<div class="panel stack on-lobby"><div class="on-code-big">卓のコード <b class="mono">${esc(v.id)}</b><button class="btn sm" data-act="on-copy">コピー</button></div>
      <p class="small muted" style="margin:0">このコードを知らせると、ほかの人が「オンライン大会」の「入る」から参加できます。${v.cfg.n}人まで・${v.cfg.games}ゲーム・1手${v.cfg.limit >= 60 ? '1分' : v.cfg.limit + '秒'}・${{ before: '式を先に確認', after3: 'お手つき3枚', after2: 'お手つき2枚' }[v.cfg.judge] || '式を先に確認'}</p>
      <div class="on-seats">${v.seats.map((s, i) => `<div class="on-seat"><span class="on-av">${avatar(s, 'happy')}</span><b>${esc(s.name)}</b>${i === 0 ? '<em>ホスト</em>' : ''}${i === v.me ? '<em class="me">あなた</em>' : ''}${v.host && i > 0 ? `<button class="btn sm ghost" data-act="on-kick" data-seat="${i}">外す</button>` : ''}</div>`).join('')}
        ${[...Array(Math.max(0, v.cfg.n - v.seats.length))].map(() => '<div class="on-seat empty">空席</div>').join('')}</div>
      ${v.host ? `<div class="row" style="gap:8px;flex-wrap:wrap">${v.seats.length < v.cfg.n ? '<button class="btn" data-act="on-addai">＋ AI★2を入れる</button>' : ''}<button class="btn primary" data-act="on-begin" ${v.seats.length < 2 ? 'disabled' : ''}>対局をはじめる</button></div>` : '<p class="small" style="margin:0">ホストが始めるのを待っています…</p>'}
      <p class="small muted" id="on-err" style="margin:0"></p></div>`;
  }
  return onTableHTML(v);
}
// ---------- オンライン対局の画面（ふつうの対局画面と同じ作り：席・場札・山札・実況・手札）----------
// AIの席は、倶楽部のキャラの顔を借りる（名前に「AI★n」が付いている席。同じ名前なら同じキャラ）
const ON_AI_BASE = ['ロボ太', 'ピコ', 'メカ子', 'ボルト', 'ギア', 'ネジ丸', 'コイル', 'ドット', 'ビット', 'チップ'];
function onAiChar(s) { // AIの席：サーバーが同じ強さのAIに付けた番号（slot）で、重ならないようにキャラを割り当てる
  if (typeof s === 'string') s = { name: s };
  const name = String(s.name || ''), lv = +(s.lv || (name.match(/AI★(\d)/) || [])[1] || 2), pool = KB.ROSTER.filter(c => c.lv === lv && c.id !== 'zero');
  let idx;
  if (s.slot != null) idx = +s.slot;
  else { const base = name.replace(/（AI★\d）$/, ''), m = base.match(/^(.*?)(\d*)$/), bi = ON_AI_BASE.indexOf(m[1]); if (bi >= 0) idx = bi + (m[2] ? +m[2] : 0); else { idx = 0; for (const ch of base) idx = (idx * 31 + ch.charCodeAt(0)) >>> 0; } }
  const c = pool[idx % pool.length] || KB.ROSTER[0], k = Math.floor(idx / Math.max(1, pool.length));
  return k ? Object.assign({}, c, { name: c.name + (k + 1) }) : c; // キャラの人数より多いときは「ゼロ2」のように番号をつける
}
function onName(s) { if (!s) return ''; if (!s.ai && !/（AI★\d）$/.test(s.name || '')) return s.name; return onAiChar(s).name; }
function onAv(s, mood) { if (s.ai || /（AI★\d）$/.test(s.name || '')) { const c = onAiChar(s); return KB.avatarSVG(KB.charToCh(c), { mood: mood || 'normal', level: c.lv }); } return KB.avatarSVG(Object.assign({}, s.avatar || AVATAR_DEF, { name: s.name }), { mood: mood || 'normal' }); }
// 出した札（だれにでも見える。切り直しで山札に戻った札はうすく）と、これまでの場札
function onPlayedHTML(g, i, bare) {
  const ps = g.played[i] || [];
  const inner = ps.length ? ps.map(pl => `<span class="pg ${pl.ret ? 'ret' : ''}" title="第${pl.round}巡 場${pl.t}：${esc(pl.expr)}${pl.ret ? '（切り直しで山札に戻った札）' : ''}">${pl.cards.map(c => miniCard({ v: c[0], s: c[1] })).join('')}</span>`).join('') : '<span class="none">まだ出していません</span>';
  return bare ? `<span class="played">${inner}</span>` : `<div class="played"><span class="pl-l">出した札</span>${inner}</div>`;
}
function onFieldsHTML(g, flipped) {
  const L = (g.fields || []).map(f => ({ v: f[0], s: f[1] })); if (!L.length) return '';
  return `<div class="fh-mini" title="${g.reshuffled ? '切り直し後の場札（それより前は山札に戻っています）' : 'これまでの場札'}">${g.reshuffled ? '<span class="fh-rs">切直</span>' : ''}${L.map((f, k) => `<i class="mc ${f.s === 1 || f.s === 2 ? 'red' : ''} ${flipped && k === L.length - 1 ? 'fly' : ''}">${KB.vname(f.v)}</i>`).join('')}</div>`;
}
function onTableHTML(v) {
  const g = v.game, me = v.me, n = v.seats.length, spec = me < 0, pov = spec ? (ON.pov || 0) % n : me;
  const tot = i => (v.setPP[i] || []).reduce((a, b) => a + b, 0);
  const now = Date.now() / 1000 - (ON.skew || 0);
  const label = v.tour ? (v.label || '大会') : '卓 ' + v.id;
  const pips = [...Array(v.cfg.games)].map((_, i) => `<i class="${i + 1 < v.gameNo || (v.phase !== 'play' && i + 1 === v.gameNo) ? 'done' : i + 1 === v.gameNo ? 'cur' : ''}"></i>`).join('');
  const top = `<div class="topbar on-top">${v.tour ? '<button class="btn ghost sm" data-act="on-to-tour">← 大会</button>' : '<button class="btn ghost sm" data-act="on-quit">← ホーム</button>'}
    <div class="where"><div class="game-prog"><span class="gp-set">🌐 ${esc(label)}</span><b class="gp-no">第${v.gameNo}ゲーム</b><span class="gp-pips">${pips}</span></div></div>
    <div class="row"><button class="btn sm ghost snd-btn ic-btn" data-act="sound" title="${esc(sndLabel())}" aria-label="${esc(sndLabel())}">${sndIcon()}</button></div></div>`;
  const order = g.order, myPos = order.indexOf(pov), cur = g.cur, ordIn = i => order.indexOf(i) + 1;
  const bub = ON.bub || {};
  const seat = i => {
    const s = v.seats[i], l = g.last[i], n2 = g.handN[i], b = bub[i] && Date.now() - bub[i].at < (bub[i].dur || 2600) ? bub[i] : null;
    let act;
    if (cur === i && v.phase === 'play') act = `<div class="act thinking">${s.ai || s.sub ? 'AIが考え中' : '考え中'}<span class="dots"><i></i><i></i><i></i></span></div>`;
    else if (l && l.type === 'play') act = `<div class="act">${esc(l.expr)} = ${g.played[i].length ? g.played[i][g.played[i].length - 1].t : ''}</div>`;
    else if (l && l.type === 'draw') act = `<div class="act draw">${l.foul ? `❌ お手つきで${l.n}枚引いた` : l.by === 'timeout' ? '⏰ 時間切れで1枚引いた' : '山札から1枚引いた'}</div>`;
    else act = `<div class="act draw idle">${order.indexOf(i) < g.pos || g.over ? '' : 'この巡はこれから'}</div>`;
    const mood = g.over ? (g.winner === i ? 'happy' : (g.pp && g.pp[i] >= 25 ? 'worried' : 'normal')) : n2 <= 2 ? 'smug' : 'normal';
    return `<div data-pi="${i}" ${spec ? `data-onpov="${i}" role="button" title="${esc(onName(s))}の席から見る"` : ''} class="seat ${i === order[0] ? 'dealer' : ''} ${cur === i && v.phase === 'play' ? 'turn' : ''} ${ON.acted === i ? 'acted' : ''} ${g.over ? (g.winner === i ? 'out winner' : 'loser') : ''}">${i === order[0] ? dealerChip('dbtn seat-chip') : ''}
      <div class="av">${onAv(s, mood)}${b ? `<div class="bubble ${Date.now() - b.at < 400 ? 'fresh' : ''}">${esc(b.text)}</div>` : ''}${g.over && g.winner === i ? confettiHTML() : ''}</div>
      <div class="nm"><span>${esc(onName(s))}</span><span class="ord">${ordIn(i)}番手</span></div>
      <div class="meta">${s.ai ? `<span class="chip lvchip">AI★${s.lv || 2}</span>` : s.sub ? `<span class="chip on-subchip">🤖 ${s.auto ? `AI★${s.subLv}に任せ中` : 'AIが代打ち'}</span>` : '<span class="chip on-humanchip">オンライン</span>'}</div>
      <div class="stats"><span class="handcount"><span>手札</span><b class="tnum">${n2}</b>${g.over ? '' : handBacks(n2)}</span><span>${g.over && g.pp ? `PP <b class="tnum">${g.pp[i]}</b>` : `PP <b class="tnum">${tot(i)}</b>`}</span></div>
      ${act}${g.over && g.hands && g.hands[i].length ? `<div class="played"><span class="pl-l">残り手札</span><span class="pg">${onCards(g.hands[i]).map(miniCard).join('')}</span></div>` : ''}${onPlayedHTML(g, i)}</div>`;
  };
  const opp = []; for (let k = 1; k < n; k++) opp.push(seat(order[(myPos + k) % n]));
  const f = g.field ? { v: g.field[0], s: g.field[1] } : null;
  const flipped = ON.lastRound !== `${v.gameNo}:${g.round}`; ON.lastRound = `${v.gameNo}:${g.round}`;
  const strip = `<div class="order-strip" aria-label="手番の順"><span class="cw">時計回り</span>${order.map((i, k) => `${k ? '<span class="arr">→</span>' : ''}<span class="os ${cur === i && v.phase === 'play' ? 'now' : g.over || k < g.pos ? 'done' : ''} ${i === me ? 'meos' : ''}">${k === 0 ? dealerChip('dbtn inline') : ''}${esc(i === me ? 'あなた' : onName(v.seats[i]))}</span>`).join('')}</div>`;
  let win = '';
  if (g.over) {
    const w = g.winner, lp = w >= 0 && g.played[w].length ? g.played[w][g.played[w].length - 1] : null;
    const left = v.phase === 'between' && v.game.nextAt ? Math.max(0, Math.ceil(v.game.nextAt - now)) : null;
    win = `<div class="win-strip" role="status"><div class="ws-main"><div class="ws-title">${w >= 0 ? esc(w === me ? 'あなた' : onName(v.seats[w])) + 'が上がりました！' : '規定の巡数で終了しました'}</div>${lp ? `<div class="ws-play"><span class="pg big">${lp.cards.map(c => miniCard({ v: c[0], s: c[1] })).join('')}</span><span class="mono">${esc(lp.expr)} = ${lp.t}</span></div>` : ''}</div>
      <div class="ws-btns">${v.phase === 'done' ? (v.tour ? '<button class="btn primary" data-act="on-to-tour">大会の順位へ</button>' : '<button class="btn primary" data-act="on-quit">ホームへ</button>') : `<span class="small" id="on-next">次のゲームまで ${left != null ? left : ''}秒</span>`}</div></div>`;
  }
  // 手元（自分。観戦なら選んだ席の人。手札は見えない）
  const ps = v.seats[pov] || {}, hand = spec ? [] : onCards(g.hand), mySub = !spec && ps.sub, myTurn = !spec && v.phase === 'play' && cur === me && !mySub;
  const after = (v.cfg.judge || 'before') !== 'before', vals = onSelVals(), ok = myTurn && vals.length && (after ? { expr: '' } : KB.evalSelection(vals, f.v));
  let prev = '';
  if (myTurn && after && vals.length) prev = `<span class="mono">${vals.map(KB.vname).join('・')}</span><span class="small" style="color:var(--felt-muted)">で ${f.v} を作って出す（成り立つかは出してから判定・お手つきは${v.cfg.judge === 'after2' ? 2 : 3}枚）</span>`;
  else if (myTurn) prev = !vals.length ? '<span class="muted" style="color:var(--felt-muted)">カードを1〜3枚選ぶと式を自動で探します</span>' : ok ? `<span class="ok">${esc(ok.expr)} = ${f.v}</span><span class="small" style="color:var(--felt-muted)">出せます</span>` : `<span class="ng">${vals.map(KB.vname).join('・')} では ${f.v} を作れません</span>`;
  const myPlayed = g.played[pov] || [];
  const handHTML = spec ? (g.over && g.hands ? onCards(g.hands[pov]).map(c => cardHTML(c, { extra: 'disabled' })).join('') : [...Array(g.handN[pov])].map(() => '<span class="card back"></span>').join(''))
    : hand.map(c => cardHTML(c, { cls: (ON.sel.includes(c.id) ? 'sel ' : '') + ((ON.newIds || []).includes(c.id) ? 'new' : ''), extra: `data-oncard="${c.id}" ${myTurn ? '' : 'disabled'} aria-pressed="${ON.sel.includes(c.id)}"` })).join('');
  const meBox = `<div data-pi="${pov}" class="me ${cur === pov && v.phase === 'play' ? 'turn' : ''} ${g.over && g.winner === pov ? 'winner' : ''}">
      ${pov === order[0] ? dealerChip('dbtn seat-chip') : ''}${g.over && g.winner === pov ? confettiHTML() : ''}
      <div class="head"><span class="me-id"><span class="av me-av">${onAv(ps, g.over ? (g.winner === pov ? 'happy' : 'normal') : (g.handN[pov] <= 2 ? 'smug' : 'normal'))}${(() => { const b = bub[pov]; return b && Date.now() - b.at < (b.dur || 2600) ? `<div class="bubble me-bub ${Date.now() - b.at < 400 ? 'fresh' : ''}">${esc(b.text)}</div>` : ''; })()}</span><b>${esc(spec ? onName(ps) : ps.name)}</b><span class="me-info">手札 <b class="tnum">${g.handN[pov]}</b>枚${spec ? '' : `・合計 <b class="tnum">${hand.reduce((a, c) => a + c.v, 0)}</b>`}</span></span><span class="me-pp">${spec ? '' : '<button class="btn sm felt-btn on-chat-btn" data-act="on-chat" aria-label="ひとことを送る">💬</button>'}セットPP <b class="tnum">${tot(pov)}</b></span></div>
      ${spec ? '<div class="on-watch">👀 観戦中（手札は見えません）・ほかの席を押すと、その人の席から見られます</div>' : ''}
      ${mySub ? `<div class="on-sub">🤖 ${ps.auto ? `AI★${ps.subLv}に任せています（推定実力−1）` : '時間切れが3回続いたので、AI★2が代わりに打っています'} <button class="btn sm primary" data-act="on-back">自分で打つ</button></div>` : ''}
      ${myPlayed.length ? `<div class="mine-played"><span>出した札</span>${onPlayedHTML(g, pov, true)}</div>` : ''}
      <div class="hand ${spec ? 'on-backs' : ''}">${handHTML}</div>
      ${prev ? `<div class="preview">${prev}</div>` : ''}
      ${!spec && v.phase === 'play' ? `<div class="actions"><button class="btn primary" data-act="on-play" ${ok ? '' : 'disabled'}>出す</button><button class="btn felt-btn" data-act="on-draw" ${myTurn ? '' : 'disabled'}>引く</button>${mySub ? '' : `<button class="btn felt-btn sm" data-act="on-auto" title="いまの推定実力−1の強さ（最低★2）のAIが代わりに打ちます">🤖 AIに任せる</button>`}</div>` : ''}
    </div>`;
  const res = v.phase === 'done' ? (() => { const rows = [...Array(n).keys()].map(i => ({ i, t: tot(i) })).sort((a, b) => a.t - b.t); return `<div class="panel on-res"><h3 style="margin:0">🏁 セット終了</h3>${rows.map((r, k) => `<div class="on-rrow ${r.i === me ? 'me' : ''}"><b>${['🥇', '🥈', '🥉'][k] || k + 1}</b><span>${esc(onName(v.seats[r.i]))}</span><span>合計 ${r.t}PP</span></div>`).join('')}</div>`; })() : '';
  return top + `<div class="on-clock" id="on-clock"></div><div id="tablewrap"><div class="table ${cmHTML() ? 'has-cm' : ''} on-tbl">
    <div class="opps ring${n - 1}" style="--n:${n - 1}">${opp.join('')}</div>
    <div class="center">
      <div class="side deckside"><div class="deck" aria-label="山札 ${g.deckN}枚">${'<i></i>'.repeat(Math.min(5, Math.ceil(g.deckN / 6)))}<b class="tnum">${g.deckN}</b></div><span>山札</span><span>捨て札 ${g.discardN}</span></div>
      <div class="pilecol"><div class="pile">${f ? `<div class="fieldcard top ${f.s === 1 || f.s === 2 ? 'red' : ''} ${flipped ? 'deal' : ''}"><span class="tag">場 ・ 第${g.round}巡</span><span class="big">${KB.vname(f.v)}</span><span class="val">${KB.SUITS[f.s]} ${f.v}</span></div>` : ''}</div>${onFieldsHTML(g, flipped)}</div>
      ${cmHTML() || `<div class="side r"><span>手番</span><b>${g.over ? '終了' : esc(onName(v.seats[cur]))}</b></div>`}
    </div>
    ${strip}${win}${meBox}</div></div>${res}
    <p class="small muted" id="on-err" style="margin:0">${ON.err ? '⚠ ' + esc(ON.err) : ''}</p>`;
}

function onBind() {
  document.querySelectorAll('[data-onpov]').forEach(b => b.onclick = () => { ON.pov = +b.dataset.onpov; KB.sfx('select'); render(); });
  document.querySelectorAll('[data-oncard]').forEach(b => b.onclick = () => { const id = +b.dataset.oncard; ON.sel = ON.sel.includes(id) ? ON.sel.filter(x => x !== id) : ON.sel.length < 3 ? [...ON.sel, id] : ON.sel; KB.sfx('select'); render(); });
  onClock();
}
async function onAct(act, extra) {
  if (!ON.v) return;
  try { const v = await onReq('on_act', Object.assign({ id: ON.v.id, act }, extra || {})); const lg = v.game && v.game.log || [], lastMine = [...lg].reverse().find(e => e.p === v.me && (e.type === 'play' || e.type === 'draw')); if (act === 'play' && lastMine && lastMine.foul) { KB.sfx('foul'); toast(`お手つき！ ${lastMine.n}枚引きました`); } else if (act === 'play') KB.sfx(extra.vals.length === 3 ? 'play3' : 'play', extra.vals.length); else if (act === 'draw') KB.sfx('draw'); ON.sel = []; onApply(v); }
  catch (e) { toast(e.message || 'できませんでした'); }
}

window.KBAPP = { S, act, ON, onName: s => onName(s), onOpeningTest: v => onOpening(v), onAwardsSync: () => onAwardsSync(), G: () => G_(), aiMini: (k, lv, f) => aiMini(k, lv, f), aiFixAttack: () => aiFixAttack(), cloud: () => ({ CLOUD_ON, CLOUD, c: raw.get('kb.cloud', null), l: PID ? plLink(PID) : null }), plLink: id => plLink(id), cloudPush: () => cloudPush(), cloudStats: () => cloudStats(), tutStart: () => tutStart(), TUT_N: () => TUT.length, watchStart: () => watchStart(), watchInvite: n => watchInvite(n), chartOpen: () => chartOpen(), chartKey: t => chartKey(t), chartMen: () => chartMen(), CHART_ROWS, aimReward: (T, k) => aimReward(T, k), aimHandover: (n, k, t) => aimHandover(n, k, t), aimCount: () => aimCount(), migrateOut, migCollect, MIGRATE_ON, zukanList: () => ZUKAN, testAch: (k, n) => { const g = G_(); g.cnt[k] = n; checkAch(g, k); G_save(g); }, badgeElig: T => badgeElig(T), cutInFx: (a, b, c) => cutInFx(a, b, c), comboFx: (n, e) => comboFx(n, e), renderGame: () => renderGame(), go: v => go(v), setSummaryText: () => setSummaryText(), showSummary: () => showGameSummary(), summaryText: () => summaryText(), insights: d => insights(d), localReview: w => localReview(w) };
render();
})();
