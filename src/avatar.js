// ===== キャラクター生成と似顔絵 =====
(function (G) {
'use strict';
const KB = G.KB;
const NAMES = {
  m: { child: ['ソウタ', 'ハルト', 'ユウマ', 'リク', 'コタロウ'], young: ['レン', 'カイト', 'ショウ', 'タクミ', 'ダイキ'], adult: ['ケンジ', 'マサト', 'ヒロシ', 'トオル', 'ノブオ'], senior: ['ゲンゾウ', 'シゲル', 'イサム', 'トクジ', 'マツオ'] },
  f: { child: ['ヒナ', 'ミオ', 'ユイ', 'コハル', 'メイ'], young: ['アオイ', 'サクラ', 'リナ', 'カエデ', 'ミサキ'], adult: ['ユミコ', 'マユミ', 'ナオミ', 'アキコ', 'レイコ'], senior: ['ハナエ', 'トメ', 'キヨ', 'フミ', 'チヨ'] }
};
const AGE_JA = { child: '小学生', young: '学生', adult: '大人', senior: 'シニア' };
const SKIN = ['#f6d7bf', '#efc4a2', '#e2ab84', '#c98d65', '#9b6646'];
const HAIR = ['#2b2522', '#3c2b20', '#5a3a24', '#7a4b2a', '#a8763e', '#d9b46a', '#b0443a', '#3d5a9e'];
const GRAY = ['#c9c9c9', '#e8e8e8', '#a5a5a5'];
const SHIRT = ['#4263eb', '#e64980', '#20c997', '#fab005', '#7950f2', '#fd7e14', '#868e96', '#15aabf'];
const HSTYLE = { m: ['short', 'spiky', 'side', 'buzz'], f: ['bob', 'long', 'pony', 'bun'] };
const LEVEL_RING = ['#adb5bd', '#b5763a', '#b8c2cc', '#e0b43a', '#9b5de5'];

let used = new Set();
KB.resetNames = () => { used = new Set(); };
KB.genChar = function (r) {
  r = r || Math.random;
  const pick = a => a[(r() * a.length) | 0];
  const gender = r() < 0.5 ? 'm' : 'f';
  const x = r(); const age = x < 0.16 ? 'child' : x < 0.48 ? 'young' : x < 0.84 ? 'adult' : 'senior';
  let name, tries = 0;
  do { name = pick(NAMES[gender][age]); tries++; } while (used.has(name) && tries < 20);
  if (used.has(name)) name = name + (used.size % 9 + 2);
  used.add(name);
  const hair = age === 'senior' ? pick(GRAY) : (age === 'young' && r() < 0.3 ? pick(HAIR.slice(4)) : pick(HAIR.slice(0, 5)));
  let hs = pick(HSTYLE[gender]);
  if (age === 'senior' && gender === 'm' && r() < 0.5) hs = 'bald';
  return { gender, age, name, skin: pick(SKIN), hair, hs, shirt: pick(SHIRT), glasses: r() < 0.22, ageJa: AGE_JA[age] };
};

// mood: normal happy worried smug shock sleepy
const FRAME = (id, ring, bg) => `<defs><clipPath id="${id}"><rect x="4" y="4" width="92" height="92" rx="17"/></clipPath></defs><rect x="1" y="1" width="98" height="98" rx="20" fill="${ring}"/><rect x="4" y="4" width="92" height="92" rx="17" fill="${bg}" opacity=".9"/>`;
const LV5 = '<rect x="1.5" y="1.5" width="97" height="97" rx="19.5" fill="none" stroke="#e5dbff" stroke-width="1" stroke-dasharray="3 4"/>';
KB.avatarSVG = function (ch, opts) {
  opts = opts || {};
  // ch.cool：いつも無表情（クールで謎めいたキャラ。気分で表情を変えない）
  const mood = ch.cool ? 'cool' : (opts.mood || 'normal');
  const st = opts.style ? KB.style(opts.style) : null;
  const lv = opts.level || 0;
  // 人間以外のキャラ（動物・ロボ・妖怪など）
  if (ch.base && ch.base !== 'human' && KB.creatureSVG) {
    const idb = 'c' + Math.random().toString(36).slice(2, 8), ringb = lv ? LEVEL_RING[lv - 1] : 'transparent', bgb = st ? st.color : (ch.bg || '#8a9a93');
    const fy = 52, rx = 24, top = 29;
    const ca = ch.acc && KB.accSVG ? KB.accSVG(ch.acc, fy, rx, top) : { back: '', front: '' };
    const co = ch.outfit && KB.accSVG ? KB.accSVG(ch.outfit, fy, rx, top) : { back: '', front: '' };
    const gl = ch.gl && KB.glSVG && !['robot', 'skeleton', 'ghost', 'alien'].includes(ch.base) ? KB.glSVG(ch.gl, 50, 9) : '';
    return `<svg viewBox="0 0 100 100" role="img" aria-label="${ch.name}" xmlns="http://www.w3.org/2000/svg">${FRAME(idb, ringb, bgb)}<g clip-path="url(#${idb})">${ch.bgpat && KB.bgPatSVG ? KB.bgPatSVG(String(ch.bgpat).replace('pat:', '')) : ''}${co.back}${ca.back}${KB.creatureSVG({ kind: ch.base }, mood)}${co.front}${gl}${ca.front}${ch.hold && KB.holdSVG ? KB.holdSVG(ch.hold) : ''}${ch.pet && KB.petSVG ? KB.petSVG(ch.pet) : ''}</g>${lv >= 5 ? LV5 : ''}</svg>`;
  }
  if (ch.kind && ch.kind !== 'human' && KB.creatureSVG) {
    const id0 = 'c' + Math.random().toString(36).slice(2, 8), ring0 = lv ? LEVEL_RING[lv - 1] : 'transparent', bg0 = st ? st.color : '#8a9a93';
    return `<svg viewBox="0 0 100 100" role="img" aria-label="${ch.name}" xmlns="http://www.w3.org/2000/svg">${FRAME(id0, ring0, bg0)}<g clip-path="url(#${id0})">${KB.creatureSVG(ch, mood)}</g>${lv >= 5 ? LV5 : ''}</svg>`;
  }
  const child = ch.age === 'child', senior = ch.age === 'senior';
  const fy = child ? 56 : 52, rx = child ? 24 : 23, ry = child ? 23 : 26;
  const ring = lv ? LEVEL_RING[lv - 1] : 'transparent';
  const bg = st ? st.color : (ch.bg && !String(ch.bg).startsWith('pat:') ? ch.bg : '#8a9a93');
  const H = ch.hair, S = ch.skin;
  let back = '', front = '', over = '';
  const top = fy - ry;
  switch (ch.hs) {
    case 'short': front = `<path d="M${50 - rx - 2} ${fy - 2} Q${50 - rx - 3} ${top - 6} 50 ${top - 6} Q${50 + rx + 3} ${top - 6} ${50 + rx + 2} ${fy - 2} Q${50 + rx - 2} ${top + 10} 56 ${top + 9} Q44 ${top + 14} ${50 - rx + 2} ${fy - 4}Z" fill="${H}"/>`; break;
    case 'spiky': front = `<path d="M${50 - rx - 2} ${fy}L${50 - rx - 6} ${top + 2}L${50 - rx + 6} ${top + 4}L${44} ${top - 10}L${52} ${top + 2}L${60} ${top - 9}L${62} ${top + 4}L${50 + rx + 6} ${top - 1}L${50 + rx + 2} ${fy}Q${50 + rx - 4} ${top + 12} 50 ${top + 10}Q${50 - rx + 4} ${top + 12} ${50 - rx - 2} ${fy}Z" fill="${H}"/>`; break;
    case 'side': front = `<path d="M${50 - rx - 2} ${fy}Q${50 - rx - 4} ${top - 6} 52 ${top - 6}Q${50 + rx + 4} ${top - 4} ${50 + rx + 2} ${fy - 4}Q${50 + rx} ${top + 8} ${40} ${top + 14}Q${36} ${top + 6} ${50 - rx + 2} ${fy}Z" fill="${H}"/>`; break;
    case 'buzz': front = `<path d="M${50 - rx} ${fy - 6}Q${50 - rx} ${top - 3} 50 ${top - 3}Q${50 + rx} ${top - 3} ${50 + rx} ${fy - 6}Q${50 + rx - 3} ${top + 6} 50 ${top + 5}Q${50 - rx + 3} ${top + 6} ${50 - rx} ${fy - 6}Z" fill="${H}"/>`; break;
    case 'veil': // 短めの髪＋片目を隠す長い前髪（謎めいた雰囲気）。前髪は目より手前に描く（下の over）
      front = `<path d="M${50 - rx - 2} ${fy - 2}Q${50 - rx - 3} ${top - 6} 50 ${top - 7}Q${50 + rx + 3} ${top - 6} ${50 + rx + 2} ${fy - 2}Q${50 + rx - 2} ${top + 8} 58 ${top + 8}Q46 ${top + 10} ${50 - rx + 3} ${fy - 6}Z" fill="${H}"/>`;
      over = `<path d="M43 ${top + 2}Q64 ${top - 1} ${50 + rx + 2} ${fy - 6}L${50 + rx} ${fy + 10}Q61 ${fy + 9} 53 ${fy - 5}Q49 ${top + 12} 43 ${top + 2}Z" fill="${H}"/>`; break;
    case 'bald': front = `<path d="M${50 - rx - 1} ${fy + 2}Q${50 - rx - 2} ${fy - 12} ${50 - rx + 5} ${fy - 14}L${50 - rx + 6} ${fy - 2}Z M${50 + rx + 1} ${fy + 2}Q${50 + rx + 2} ${fy - 12} ${50 + rx - 5} ${fy - 14}L${50 + rx - 6} ${fy - 2}Z" fill="${H}"/>`; break;
    case 'bob': back = `<path d="M${50 - rx - 5} ${fy + 14}Q${50 - rx - 7} ${top - 6} 50 ${top - 7}Q${50 + rx + 7} ${top - 6} ${50 + rx + 5} ${fy + 14}Z" fill="${H}"/>`;
      front = `<path d="M${50 - rx - 1} ${fy - 2}Q${50 - rx} ${top - 4} 50 ${top - 4}Q${50 + rx} ${top - 4} ${50 + rx + 1} ${fy - 2}Q${50 + rx - 6} ${top + 13} 50 ${top + 12}Q${50 - rx + 6} ${top + 13} ${50 - rx - 1} ${fy - 2}Z" fill="${H}"/>`; break;
    case 'long': back = `<path d="M${50 - rx - 5} ${fy + 34}Q${50 - rx - 9} ${top - 6} 50 ${top - 7}Q${50 + rx + 9} ${top - 6} ${50 + rx + 5} ${fy + 34}Z" fill="${H}"/>`;
      front = `<path d="M${50 - rx - 1} ${fy + 4}Q${50 - rx} ${top - 4} 50 ${top - 4}Q${50 + rx} ${top - 4} ${50 + rx + 1} ${fy + 4}Q${50 + rx - 5} ${top + 10} ${54} ${top + 12}Q${48} ${top + 6} ${50 - rx + 4} ${fy - 4}Z" fill="${H}"/>`; break;
    case 'pony': back = `<ellipse cx="${50 + rx + 6}" cy="${fy - 4}" rx="6" ry="13" fill="${H}" transform="rotate(-18 ${50 + rx + 6} ${fy - 4})"/>`;
      front = `<path d="M${50 - rx - 1} ${fy - 2}Q${50 - rx} ${top - 4} 50 ${top - 4}Q${50 + rx} ${top - 4} ${50 + rx + 1} ${fy - 2}Q${50 + rx - 5} ${top + 10} 50 ${top + 9}Q${50 - rx + 5} ${top + 10} ${50 - rx - 1} ${fy - 2}Z" fill="${H}"/>`; break;
    case 'twin': back = `<ellipse cx="${50 - rx - 7}" cy="${fy + 6}" rx="6" ry="15" fill="${H}" transform="rotate(14 ${50 - rx - 7} ${fy + 6})"/><ellipse cx="${50 + rx + 7}" cy="${fy + 6}" rx="6" ry="15" fill="${H}" transform="rotate(-14 ${50 + rx + 7} ${fy + 6})"/>`;
      front = `<path d="M${50 - rx - 1} ${fy - 2}Q${50 - rx} ${top - 4} 50 ${top - 4}Q${50 + rx} ${top - 4} ${50 + rx + 1} ${fy - 2}Q${50 + rx - 6} ${top + 10} 50 ${top + 9}Q${50 - rx + 6} ${top + 10} ${50 - rx - 1} ${fy - 2}Z" fill="${H}"/>`; break;
    case 'afro': back = `<circle cx="50" cy="${fy - 8}" r="${rx + 12}" fill="${H}"/>`;
      front = `<path d="M${50 - rx} ${fy - 6}Q${50 - rx} ${top + 2} 50 ${top + 2}Q${50 + rx} ${top + 2} ${50 + rx} ${fy - 6}Q${50 + rx - 4} ${top + 10} 50 ${top + 9}Q${50 - rx + 4} ${top + 10} ${50 - rx} ${fy - 6}Z" fill="${H}"/>`; break;
    case 'mohawk': front = `<path d="M43 ${top + 8}L41 ${top - 8}L46 ${top - 4}L48 ${top - 14}L52 ${top - 6}L56 ${top - 14}L57 ${top - 2}L60 ${top - 6}L57 ${top + 8}Z" fill="${H}"/>`; break;
    case 'curly': front = `<g fill="${H}">${[-18, -10, -2, 6, 14].map((x, i) => `<circle cx="${50 + x + 2}" cy="${top + (i % 2 ? 0 : 3)}" r="7"/>`).join('')}<circle cx="${50 - rx + 1}" cy="${fy - 8}" r="6"/><circle cx="${50 + rx - 1}" cy="${fy - 8}" r="6"/></g>`; break;
    case 'bun': back = `<circle cx="50" cy="${top - 5}" r="9" fill="${H}"/>`;
      front = `<path d="M${50 - rx - 1} ${fy - 2}Q${50 - rx} ${top - 4} 50 ${top - 4}Q${50 + rx} ${top - 4} ${50 + rx + 1} ${fy - 2}Q${50 + rx - 6} ${top + 9} 50 ${top + 8}Q${50 - rx + 6} ${top + 9} ${50 - rx - 1} ${fy - 2}Z" fill="${H}"/>`; break;
  }
  const ex = 9, eyY = fy + 1, ink = '#2a211c';
  let eyes, brows, mouth, extra = '';
  const bA = { normal: 0, happy: -2, worried: 6, smug: -3, shock: 4, sleepy: 0 }[mood] || 0;
  const angry = st && st.id === 'gangan' && (mood === 'normal' || mood === 'smug');
  const bt = angry ? -5 : bA;
  brows = `<path d="M${50 - ex - 5} ${eyY - 7 - (bt > 0 ? 0 : 0)}L${50 - ex + 4} ${eyY - 7 + bt * 0.6}" stroke="${senior ? '#888' : ink}" stroke-width="2.2" stroke-linecap="round" transform="rotate(${-bt} ${50 - ex} ${eyY - 7})"/><path d="M${50 + ex + 5} ${eyY - 7}L${50 + ex - 4} ${eyY - 7 + bt * 0.6}" stroke="${senior ? '#888' : ink}" stroke-width="2.2" stroke-linecap="round" transform="rotate(${bt} ${50 + ex} ${eyY - 7})"/>`;
  const er = child ? 3.4 : 2.8;
  if (mood === 'happy') eyes = `<path d="M${50 - ex - 4} ${eyY + 1}Q${50 - ex} ${eyY - 4} ${50 - ex + 4} ${eyY + 1}M${50 + ex - 4} ${eyY + 1}Q${50 + ex} ${eyY - 4} ${50 + ex + 4} ${eyY + 1}" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  else if (mood === 'smug' || mood === 'sleepy') eyes = `<path d="M${50 - ex - 4} ${eyY}L${50 - ex + 4} ${eyY}M${50 + ex - 4} ${eyY}L${50 + ex + 4} ${eyY}" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  else if (mood === 'shock') eyes = `<circle cx="${50 - ex}" cy="${eyY}" r="${er + 1.4}" fill="#fff" stroke="${ink}" stroke-width="1.5"/><circle cx="${50 + ex}" cy="${eyY}" r="${er + 1.4}" fill="#fff" stroke="${ink}" stroke-width="1.5"/><circle cx="${50 - ex}" cy="${eyY}" r="1.5" fill="${ink}"/><circle cx="${50 + ex}" cy="${eyY}" r="1.5" fill="${ink}"/>`;
  else if (mood === 'cool') eyes = `<path d="M${50 - ex - 4.5} ${eyY - 1}L${50 - ex + 4.5} ${eyY - 1.6}M${50 + ex - 4.5} ${eyY - 1.6}L${50 + ex + 4.5} ${eyY - 1}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="${50 - ex + 0.6}" cy="${eyY + 0.8}" rx="2.2" ry="1.8" fill="#3b3f8c"/><ellipse cx="${50 + ex + 0.6}" cy="${eyY + 0.8}" rx="2.2" ry="1.8" fill="#3b3f8c"/><circle cx="${50 - ex + 1.4}" cy="${eyY + 0.2}" r="0.6" fill="#cfd8ff"/><circle cx="${50 + ex + 1.4}" cy="${eyY + 0.2}" r="0.6" fill="#cfd8ff"/>`;
  else eyes = `<circle cx="${50 - ex}" cy="${eyY}" r="${er}" fill="${ink}"/><circle cx="${50 + ex}" cy="${eyY}" r="${er}" fill="${ink}"/><circle cx="${50 - ex + 1}" cy="${eyY - 1}" r="0.9" fill="#fff"/><circle cx="${50 + ex + 1}" cy="${eyY - 1}" r="0.9" fill="#fff"/>`;
  const my = fy + 13;
  if (mood === 'happy') mouth = `<path d="M43 ${my - 1}Q50 ${my + 8} 57 ${my - 1}Z" fill="#8c2f2f"/>`;
  else if (mood === 'worried') mouth = `<path d="M44 ${my + 3}Q50 ${my - 2} 56 ${my + 3}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  else if (mood === 'shock') mouth = `<ellipse cx="50" cy="${my + 1}" rx="3.5" ry="4.5" fill="#8c2f2f"/>`;
  else if (mood === 'smug') mouth = `<path d="M44 ${my}Q52 ${my + 4} 57 ${my - 2}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  else if (mood === 'cool') mouth = `<path d="M47 ${my + 1}L53 ${my + 1}" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/>`;
  else mouth = `<path d="M45 ${my}Q50 ${my + 3} 55 ${my}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  if ((child || ch.gender === 'f') && mood !== 'cool') extra += `<ellipse cx="${50 - ex - 4}" cy="${eyY + 7}" rx="3.5" ry="2" fill="#f08c8c" opacity=".45"/><ellipse cx="${50 + ex + 4}" cy="${eyY + 7}" rx="3.5" ry="2" fill="#f08c8c" opacity=".45"/>`;
  if (senior) extra += `<path d="M${50 - ex - 6} ${eyY + 4}l3 1.5M${50 + ex + 6} ${eyY + 4}l-3 1.5M44 ${fy - ry + 12}q6 -2 12 0" stroke="#9a7a66" stroke-width="1" fill="none" opacity=".7"/>`;
  { const gl = ch.gl || ((ch.glasses || (st && st.id === 'keisan' && !ch.charId)) ? 'round' : null); if (gl && KB.glSVG) extra += KB.glSVG(gl, eyY, ex); }
  if (mood === 'worried') extra += `<path d="M${50 + rx - 2} ${fy - 12}q4 6 0 9q-4 -3 0 -9Z" fill="#74c0fc"/>`;
  // キャラの小物（固定キャラ・自分のアバター）。固定キャラには性格の小物は付けない
  const ca = ch.acc && KB.accSVG ? KB.accSVG(ch.acc, fy, rx, top) : { back: '', front: '' };
  const co = ch.outfit && KB.accSVG ? KB.accSVG(ch.outfit, fy, rx, top) : { back: '', front: '' };
  back = co.back + ca.back + back;
  // 性格の小物
  let acc = '';
  if (st && !ch.charId) {
    if (st.id === 'gangan') acc = `<path d="M${50 - rx - 2} ${top + 9}Q50 ${top + 3} ${50 + rx + 2} ${top + 9}L${50 + rx + 2} ${top + 15}Q50 ${top + 9} ${50 - rx - 2} ${top + 15}Z" fill="#e03131"/><path d="M${50 + rx} ${top + 11}l9 -4l-2 8Z" fill="#e03131"/>`;
    else if (st.id === 'inochi') acc = `<path d="M${50 - rx - 4} ${top + 10}Q${50 - rx - 3} ${top - 10} 50 ${top - 10}Q${50 + rx + 3} ${top - 10} ${50 + rx + 4} ${top + 10}Z" fill="#fcc419" stroke="#e67700" stroke-width="1.2"/><rect x="${50 - rx - 7}" y="${top + 8}" width="${2 * rx + 14}" height="4" rx="2" fill="#f59f00"/><path d="M47 ${top - 4}h6M50 ${top - 7}v6" stroke="#2b8a3e" stroke-width="2.2"/>`;
    else if (st.id === 'iroiro') acc = `<path d="M${50 + rx - 8} ${top + 2}l2.4 5 5.4 .6 -4 3.7 1.1 5.3 -4.9 -2.7 -4.9 2.7 1.1 -5.3 -4 -3.7 5.4 -.6Z" fill="#ffd43b" stroke="#f08c00" stroke-width=".8"/>`;
    else if (st.id === 'keisan') acc = `<path d="M${50 + rx - 2} ${fy - 16}l12 -10" stroke="#f59f00" stroke-width="3.2" stroke-linecap="round"/><path d="M${50 + rx + 10} ${fy - 26}l2 -2" stroke="#495057" stroke-width="3.2" stroke-linecap="round"/>`;
    else acc = `<circle cx="${50 + rx - 4}" cy="${top + 4}" r="4" fill="${st.color}" stroke="#fff" stroke-width="1"/>`;
  }
  const id = 'c' + Math.random().toString(36).slice(2, 8);
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${ch.name}" xmlns="http://www.w3.org/2000/svg">
${FRAME(id, ring, bg)}
<g clip-path="url(#${id})">${ch.bgpat && KB.bgPatSVG ? KB.bgPatSVG(String(ch.bgpat).replace('pat:', '')) : ''}${back}
<path d="M18 104Q20 ${fy + ry + 6} 50 ${fy + ry + 4}Q80 ${fy + ry + 6} 82 104Z" fill="${ch.shirt}"/>
<rect x="44" y="${fy + ry - 6}" width="12" height="10" fill="${S}"/>
<ellipse cx="${50 - rx}" cy="${fy + 2}" rx="3.5" ry="5" fill="${S}"/><ellipse cx="${50 + rx}" cy="${fy + 2}" rx="3.5" ry="5" fill="${S}"/>
<ellipse cx="50" cy="${fy}" rx="${rx}" ry="${ry}" fill="${S}"/>
${co.front}${front}${brows}${eyes}${mouth}${extra}${over}${ch.face && KB.faceSVG ? KB.faceSVG(ch.face, fy, eyY, ex) : ''}${acc}${ca.front}${ch.hold && KB.holdSVG ? KB.holdSVG(ch.hold) : ''}${ch.pet && KB.petSVG ? KB.petSVG(ch.pet) : ''}</g>
${lv >= 5 ? LV5 : ''}
</svg>`;
};

// セリフ
const LINES = {
  gangan: { play3: ['まとめて行くぜ！', '一気に3枚！', 'どんどん出す！'], play: ['いくぜ！', 'よし！'], draw: ['くっ…', '次こそ！'], reach: ['あと少し！', 'もらった！'], win: ['よっしゃあ！'], lose: ['次は勝つ！'] },
  inochi: { play3: ['大きい札から片付け', 'ここは処分'], play: ['安全第一', '慎重に…'], draw: ['想定内です', '焦らない焦らない'], reach: ['油断は禁物'], win: ['ほっとした〜'], lose: ['被害は小さく済んだかな'] },
  iroiro: { play3: ['今日はこれ！', 'ふふん♪'], play: ['なんとなく！', 'これでいいや'], draw: ['あらら', 'まあいっか'], reach: ['いけるかも？'], win: ['やったー！'], lose: ['楽しかった！'] },
  keisan: { play3: ['計算通り', '確率的にはこう'], play: ['ここは温存', 'ふむ'], draw: ['仕方ない', '期待値は悪くない'], reach: ['読み切った'], win: ['計算通りです'], lose: ['分散ですね'] }
};
// 上級者ほどポーカーフェイス：セリフは単調で、状況（出せない・あと少し）を悟らせない
const FLAT = ['…', 'ふむ', 'どうぞ', 'はい'];
const NOVICE = { draw: ['うわ、出せない…', 'えー、ないよ〜', 'どうしよう…'], reach: ['あと少しで上がり！', 'もうすぐ上がれそう！'], play3: ['3枚も出せた！', 'やった、まとめて出せた！'] };
KB.line = function (styleId, kind, r, level) {
  r = r || Math.random; level = level || 3;
  const pick = a => a[(r() * a.length) | 0];
  if (level >= 5) return kind === 'win' ? 'ありがとうございました' : kind === 'lose' ? 'お疲れさまでした' : pick(FLAT);
  if (level === 4 && (kind === 'draw' || kind === 'reach' || r() < 0.5)) return kind === 'win' ? '計算通りです' : kind === 'lose' ? 'ふむ' : pick(FLAT);
  if (level <= 2 && NOVICE[kind] && r() < 0.6) return pick(NOVICE[kind]);
  const L = LINES[styleId] || LINES.keisan; const a = L[kind] || L.play;
  return pick(a);
};
KB.talkRate = level => [0.85, 0.65, 0.4, 0.22, 0.1][(level || 3) - 1];
KB.LEVEL_RING = LEVEL_RING;
})(typeof window !== 'undefined' ? window : globalThis);
