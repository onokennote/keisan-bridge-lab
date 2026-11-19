// ---------- 多言語（英語・中国語 簡体字）：画面に出た日本語を、表示するときに辞書で差し替える ----------
// 辞書は I18N_ROWS（i18n_dict.js）。数字は # 、キャラの名前は @ に置きかえて引く（「ゴウのプロフィール」→「@のプロフィール」）。
// 見つからない文はそのまま日本語で出す（第1段は画面の文字。実況・総評などは順に足す）。
(function (G) {
  const LANGS = { ja: '日本語', en: 'English', zh: '中文', hi: 'हिन्दी' };
  let lang = 'ja';
  try { lang = localStorage.getItem('kb.lang') || 'ja'; } catch (e) { }
  if (!LANGS[lang]) lang = 'ja';
  const D = new Map(), NAMES = [];
  let ready = false;
  function build() {
    if (ready) return; ready = true;
    (G.I18N_ROWS || []).forEach(r => { if (r && r[0] && !D.has(r[0])) D.set(r[0], { en: r[1], zh: r[2] }); });
    // 実況の型も辞書に（数字の {m} などは #、名前の {n} は @。それ以外の入れ物がある型は入れない）
    const NUMK = /^(m|bp|k|h|g|r|t|d|rk|pp|exp|pct|men|lo|hi|avg|s|tb|mypp)$/;
    Object.entries(G.I18N_LINES || {}).forEach(([ja, tr2]) => { const ks = [...ja.matchAll(/\{(\w+)\}/g)].map(m => m[1]); if (!ks.every(k => NUMK.test(k) || k === 'n')) return; const nk = ks.filter(k => k !== 'n'); if (nk.length > 9 || new Set(nk).size !== nk.length) return; const key = ja.replace(/\{(\w+)\}/g, (m, k) => k === 'n' ? '@' : '#'); const cv = x => x.replace(/#/g, '\u0002').replace(/\{(\w+)\}/g, (m, k) => k === 'n' ? '@' : '#' + (nk.indexOf(k) + 1)); if (!D.has(key)) D.set(key, { en: cv(tr2[0]), zh: cv(tr2[1]) }); });
    (G.I18N_NAMES || []).forEach(r => { NAMES.push(r); if (!D.has(r[0])) D.set(r[0], { en: r[1], zh: r[2] }); });
    // ヒンディー語：訳があるものだけ（ないものは英語で出す）
    Object.entries(Object.assign({}, G.I18N_HI_NAMES || {}, G.I18N_HI || {})).forEach(([ja, hi]) => { const h = D.get(ja); if (h) h.hi = hi; else D.set(ja, { hi }); });
    NAMES.sort((a, b) => b[0].length - a[0].length);
  }
  const nmOf = (ja, en, zh) => lang === 'zh' ? zh : lang === 'hi' ? ((G.I18N_HI_NAMES || {})[ja] || en) : en;
  const JA = /[぀-ヿ一-鿿]/;
  // # は順に、#2 のように番号つきならその数（訳で数字を省くとき用）。@ は名前を順に
  // § は式・手札などのかたまり（そのまま入れる）
  let TOK = [];
  function fill(tpl, nums, names) { let i = 0, j = 0, t = 0; return tpl.replace(/#([1-9])?|@|§/g, (c, k) => c === '@' ? (names[j++] ?? c) : c === '§' ? (TOK[t++] ?? c) : k ? (nums[+k - 1] ?? c) : (nums[i++] ?? c)).replace(/\u0002/g, '#'); }
  const CARD = '(?:[AJQK]|1[0-3]|[2-9])';
  const TOK_RE = new RegExp(`\\[[^\\]]*\\]|\\(${CARD}(?:,${CARD})*\\)|${CARD}(?:・${CARD})+|${CARD}(?: ${CARD})*(?= を出す)|${CARD}(?= の\\d+つ)|[A-Z](?=卓)|[AJQK](?=のとき)|[(\\d][\\d\\s+\\-−×÷()]*[+\\-−×÷][\\d\\s+\\-−×÷()]*[\\d)]`, 'g');
  function tokens(core) { const L = []; const k = core.replace(TOK_RE, m => { L.push(m); return '§'; }); return { k, L }; }
  function look(key, nums, names) { const h = D.get(key), t = h && (h[lang] || (lang === 'hi' ? h.en : null)); return t ? fill(t, nums, names) : null; }
  function tr(s) {
    if (lang === 'ja' || !s || !JA.test(s)) return s;
    build();
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2];
    const out = core && trCore(core, 0);
    return out == null ? s : m[1] + out + m[3];
  }
  function trCore(core, depth) {
    const nums = [], dig = t => t.replace(/\d+(?:\.\d+)?/g, x => { nums.push(x); return '#'; });
    TOK = []; let r = look(dig(core), nums, []); if (r != null) return r;
    { const tk = tokens(core); if (tk.L.length) { nums.length = 0; TOK = tk.L; r = look(dig(tk.k), nums, []); if (r != null) return r; } TOK = []; }
    // キャラの名前を @ にして引く（名前に数字が入っていても先に名前を取る）
    const pos = [];
    for (const [ja, en, zh] of NAMES) { let p = core.indexOf(ja); while (p >= 0) { let l = ja.length; if (core.startsWith('さん', p + l) && !/(さん|くん|ちゃん|先生|課長|教授|大将|じいさん)$/.test(ja)) l += 2; if (!pos.some(([q, ql]) => p < q + ql && q < p + l)) pos.push([p, l, nmOf(ja, en, zh)]); p = core.indexOf(ja, p + l); } } // 名前のあとの「さん」も名前に含める
    if (pos.length) {
      pos.sort((a, b) => a[0] - b[0]); let k3 = '', at = 0; const nm = [];
      pos.forEach(([p, l, v]) => { k3 += core.slice(at, p) + '@'; at = p + l; nm.push(v); }); k3 += core.slice(at);
      nums.length = 0; r = look(dig(k3), nums, nm); if (r != null) return r;
      const tk = tokens(k3); if (tk.L.length) { nums.length = 0; TOK = tk.L; r = look(dig(tk.k), nums, nm); if (r != null) return r; TOK = []; }
    }
    // 末尾の「。」はなくても引く
    if (/[。！]$/.test(core) && core.length > 1) { const ex = core.endsWith('！'); const a = trCore(core.slice(0, -1), depth + 1); if (a != null) return a + (lang !== 'zh' ? (/[.!?]$/.test(a) ? '' : ex ? '!' : '.') : (/[。！？]$/.test(a) ? '' : ex ? '！' : '。')); }
    // 文がつながっているとき：「。」で前後に分けて、両方訳せたらつなぐ（説明文のうしろに残り時間が付く など）
    if (depth < 3) { const parts = core.split(/(?<=[。！？])/); for (let i = parts.length - 1; i >= 1; i--) { const a = trCore(parts.slice(0, i).join(''), depth + 1); if (a == null) continue; const b = trCore(parts.slice(i).join('').trim(), depth + 1); if (b != null) return a + (lang !== 'zh' ? ' ' : '') + b; } }
    // 「…」が入れ子になっているとき（条件の中に「強豪ぞろい」など）：いちばん外の「」ごとに訳す
    if (/「[^」]*「/.test(core)) {
      const segs = []; let dep = 0, st = -1;
      for (let i = 0; i < core.length; i++) { if (core[i] === '「') { if (!dep) st = i; dep++; } else if (core[i] === '」' && dep) { dep--; if (!dep) segs.push([st, i + 1]); } }
      const nm = []; let k6 = '', at = 0, ok = true;
      for (const [a, b] of segs) { const t = trCore(core.slice(a + 1, b - 1), 9); if (t == null) { ok = false; break; } k6 += core.slice(at, a) + '「@」'; at = b; nm.push(t); }
      if (ok && segs.length) { k6 += core.slice(at); nums.length = 0; TOK = []; r = look(dig(k6), nums, nm); if (r != null) return r; }
    }
    // 名前と「…」が両方あるとき：出てきた順に @ にして引く
    if (pos.length && /「[^「」]+」/.test(core)) {
      const sp = pos.map(([p, l, v]) => [p, l, v, 0]); const re = /「([^「」]+)」/g; let m;
      while ((m = re.exec(core))) { const t = trCore(m[1], 9); if (t != null && !sp.some(([q, l]) => m.index < q + l && q < m.index + m[0].length)) sp.push([m.index, m[0].length, t, 1]); }
      sp.sort((a, b) => a[0] - b[0]); let k5 = '', at = 0; const nm = [];
      sp.forEach(([p, l, v, q]) => { if (p < at) return; k5 += core.slice(at, p) + (q ? '「@」' : '@'); at = p + l; nm.push(v); }); k5 += core.slice(at);
      nums.length = 0; TOK = []; r = look(dig(k5), nums, nm); if (r != null) return r;
    }
    // 「〜（まだ）」は中を訳して（not yet）を付ける
    if (core.endsWith('（まだ）') && core.length > 4) { const a = trCore(core.slice(0, -4), depth + 1); if (a != null) return a + (lang === 'zh' ? '（未获得）' : lang === 'hi' ? ' (अभी नहीं)' : ' (not yet)'); }
    if (core.endsWith('（未獲得）') && core.length > 5) { const a = trCore(core.slice(0, -5), depth + 1); if (a != null) return a + (lang === 'zh' ? '（未获得）' : lang === 'hi' ? ' (अभी नहीं)' : ' (not earned)'); }
    if (core.endsWith('（獲得済み）') && core.length > 6) { const a = trCore(core.slice(0, -6), depth + 1); if (a != null) return a + (lang === 'zh' ? '（已获得）' : lang === 'hi' ? ' (मिल गया)' : ' (earned)'); }
    // 「…」の中を先に訳して @ にする（「皆勤賞」→ "Perfect Attendance"）
    if (/「[^「」]+」/.test(core)) {
      const nm = []; let ok = true; const k4 = core.replace(/「([^「」]+)」/g, (m, x) => { const t = trCore(x, 9); if (t == null) { ok = false; return m; } nm.push(t); return '「@」'; });
      if (ok) { nums.length = 0; r = look(dig(k4), nums, nm); if (r != null) return r; }
    }
    // 「名前：説明」は左右を別々に
    if (depth < 8) for (const sep of ['／', '：', '・', '　', ' ']) {
      const inName = i => NAMES.some(([ja]) => { if (!ja.includes(sep)) return false; let p = core.indexOf(ja); while (p >= 0) { if (i > p && i < p + ja.length) return true; p = core.indexOf(ja, p + 1); } return false; });
      let i = core.indexOf(sep); while (i > 0 && inName(i)) i = core.indexOf(sep, i + 1);
      if (i > 0 && i < core.length - 1) {
        const a = trCore(core.slice(0, i).trim(), depth + 1), b = trCore(core.slice(i + 1).trim(), depth + 1);
        if (a != null && b != null) return a + (sep === '：' ? (lang !== 'zh' ? ': ' : '：') : sep === '・' ? (lang !== 'zh' ? ' · ' : '·') : sep === '／' ? ' / ' : sep) + b;
      }
    }
    return null;
  }
  // ヒンディー語：数字をデーヴァナーガリー数字に、札の表の A・J・Q・K を頭文字に（コードなど書き写す文字はそのまま）
  const DEVA = '०१२३४५६७८९', FACE = { A: 'इ', J: 'गु', Q: 'बे', K: 'बा' };
  const NODEV = 'script,style,input,textarea,[data-noi18n],.mono,.pm-code,.cl-code,.on-code-big';
  const isFace = el => el && el.matches && el.matches('.card .v, .big, .cn, .mc, .tut-hand .v');
  function hiNode(n) {
    if (lang !== 'hi' || !n.parentElement || n.parentElement.closest(NODEV)) return;
    if (!deckOn('hi') && n.parentElement.closest('.card, .fieldcard, .mc, .flycard, .df-front, .tut-hand')) return; // ガンジファをオフ（ノーマル）にしたら、札はふつうのトランプ（A・J・Q・K と算用数字）
    let v = n.nodeValue, t = v;
    if (isFace(n.parentElement)) t = t.replace(/^\s*(A|J|Q|K)\s*$/, (m, c) => m.replace(c, FACE[c]));
    t = t.replace(/[0-9]/g, d => DEVA[+d]);
    if (t !== v) n.nodeValue = t;
  }
  // 言語ごとの札（デッキ）：中国語＝麻雀牌・英語＝数のことばカード・日本語＝花札・ヒンディー語＝ガンジファ。
  // 端末ごと・言語ごとにオン／オフ（kb.deck.<lang>。中国語は前からの kb.mj）。はじめは日本語だけオフ（ノーマルのトランプ）
  const SU = '♠♥♦♣', MJN = '一二三四五六七八九', MJF = '東南西北';
  const EW = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN'];
  const HM = ['', '松', '梅', '桜', '藤', '菖蒲', '牡丹', '萩', '芒', '菊', '紅葉', '柳', '桐', '鬼'];
  // 花札の絵（月ごとの草花。光＝♠は赤い空、短冊＝♥は赤い短冊、タネ＝♦は青い短冊、カス＝♣は草花だけ）
  const HP = {
    1: '<path d="M20 50V30" stroke="#5b3a1e" stroke-width="3"/><ellipse cx="20" cy="22" rx="15" ry="6" fill="#1f5e2e"/><ellipse cx="12" cy="31" rx="10" ry="4.5" fill="#2c7a3d"/><ellipse cx="28" cy="34" rx="10" ry="4.5" fill="#2c7a3d"/>',
    2: '<path d="M4 44Q16 30 22 18T36 6" stroke="#3a2516" stroke-width="2.5" fill="none"/>' + [[12, 34], [20, 22], [28, 12], [8, 40], [31, 22]].map(([x, y]) => `<g fill="#d0213a">${[0, 72, 144, 216, 288].map(a => `<circle cx="${x + 2.6 * Math.cos(a * Math.PI / 180)}" cy="${y + 2.6 * Math.sin(a * Math.PI / 180)}" r="2"/>`).join('')}<circle cx="${x}" cy="${y}" r="1" fill="#f5d77a"/></g>`).join(''),
    3: [[10, 14], [22, 10], [32, 18], [16, 26], [28, 30], [8, 36], [22, 40]].map(([x, y]) => `<g fill="#f4a6bd">${[0, 72, 144, 216, 288].map(a => `<circle cx="${x + 2.8 * Math.cos(a * Math.PI / 180)}" cy="${y + 2.8 * Math.sin(a * Math.PI / 180)}" r="2.2"/>`).join('')}<circle cx="${x}" cy="${y}" r="1" fill="#d0213a"/></g>`).join(''),
    4: '<path d="M2 6Q20 2 38 8" stroke="#3a2516" stroke-width="2.5" fill="none"/>' + [8, 16, 24, 32].map((x, k) => Array.from({ length: 6 }, (_, i) => `<circle cx="${x + (i % 2 ? 1.5 : -1.5)}" cy="${10 + i * 5 + k * 2}" r="${2.6 - i * 0.25}" fill="#7a4fb0"/>`).join('')).join(''),
    5: '<path d="M10 50L14 20M20 50L20 14M30 50L26 22" stroke="#2c7a3d" stroke-width="2.5"/>' + [[14, 18], [20, 12], [26, 20]].map(([x, y]) => `<path d="M${x} ${y - 7}L${x + 5} ${y}L${x} ${y + 3}L${x - 5} ${y}Z" fill="#5b3fa8"/><circle cx="${x}" cy="${y}" r="1.4" fill="#f5d77a"/>`).join(''),
    6: '<ellipse cx="11" cy="36" rx="8" ry="4" fill="#2c7a3d" transform="rotate(-30 11 36)"/><ellipse cx="29" cy="36" rx="8" ry="4" fill="#2c7a3d" transform="rotate(30 29 36)"/><circle cx="20" cy="24" r="11" fill="#c8213a"/><circle cx="20" cy="24" r="7" fill="#e0405a"/><circle cx="20" cy="24" r="3.5" fill="#f5d77a"/>',
    7: '<path d="M4 46Q14 10 38 6M8 48Q22 24 36 22" stroke="#3a2516" stroke-width="1.6" fill="none"/>' + [[10, 30], [14, 20], [20, 13], [27, 9], [33, 7], [14, 40], [20, 32], [26, 26], [32, 23]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#c8213a"/>`).join(''),
    8: '<path d="M0 50V32Q20 18 40 32V50Z" fill="#222"/><path d="M6 32Q8 22 10 30M16 26Q18 14 20 26M28 26Q30 16 32 30" stroke="#f3ecd8" stroke-width="1.2" fill="none"/>',
    9: '<circle cx="20" cy="22" r="11" fill="#f2c230"/><circle cx="20" cy="22" r="11" fill="none" stroke="#c88a10" stroke-width="2" stroke-dasharray="3 2"/><circle cx="20" cy="22" r="4" fill="#c88a10"/><path d="M20 33V50M20 42L12 38M20 44L28 40" stroke="#2c7a3d" stroke-width="2"/>',
    10: [[12, 16, 0], [27, 14, 20], [20, 30, -15], [9, 38, 10], [31, 36, -25]].map(([x, y, r]) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M0 -7L2 -2L7 -3L3 1L5 6L0 3L-5 6L-3 1L-7 -3L-2 -2Z" fill="#d23a1e"/>`).join(''),
    11: '<path d="M6 0Q4 20 8 46M14 0Q12 22 16 44M24 0Q22 20 25 42M32 0Q31 18 33 40" stroke="#4e8a3a" stroke-width="1.6" fill="none"/>' + [[10, 10], [20, 22], [30, 14], [12, 32], [28, 34]].map(([x, y]) => `<path d="M${x} ${y}l-3 6" stroke="#222" stroke-width="1.2"/>`).join(''),
    12: '<ellipse cx="20" cy="38" rx="15" ry="9" fill="#2c7a3d"/><path d="M20 30V46" stroke="#1f5e2e" stroke-width="1.2"/>' + [[14, 12], [20, 8], [26, 12], [17, 18], [23, 18], [20, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#8a5bc0"/>`).join(''),
    13: '<path d="M10 14L6 2L15 10M30 14L34 2L25 10" fill="#f2c230" stroke="#222" stroke-width="1"/><circle cx="20" cy="26" r="15" fill="#c8213a" stroke="#222" stroke-width="1.5"/><circle cx="14" cy="23" r="3" fill="#fff"/><circle cx="26" cy="23" r="3" fill="#fff"/><circle cx="14" cy="23" r="1.4" fill="#222"/><circle cx="26" cy="23" r="1.4" fill="#222"/><path d="M12 33Q20 39 28 33" stroke="#222" stroke-width="1.6" fill="#fff"/><path d="M16 34l1 3M24 34l-1 3" stroke="#222"/>'
  };
  const hanaSvg = (v, s) => `<svg viewBox="0 0 40 50" preserveAspectRatio="xMidYMid meet">${s === 0 && v !== 13 ? '<rect x="0" y="0" width="40" height="18" fill="#d0402a"/>' + (v === 8 ? '<circle cx="20" cy="13" r="8" fill="#fff6d8"/>' : v === 1 ? '<circle cx="31" cy="9" r="6" fill="#ffd14a"/>' : '') : ''}${HP[v] || ''}${(s === 1 || s === 2) && v !== 13 ? `<rect x="15" y="14" width="10" height="26" rx="1" fill="${s === 1 ? '#c8213a' : '#2a4fa8'}" stroke="#222" stroke-width=".8"/>` : ''}</svg>`;
  const DECKS = {
    zh: { cls: 'mj', key: 'kb.mj', def: true, label: on => `🀄 麻将牌：${on ? '开' : '关'}`,
      face(v, s, k) {
        if (k === 'mc') return this.face(v, s).replace('<i>萬</i>', '') + (v >= 10 ? `<sub>${v}</sub>` : ''); // 捨て札は漢数字だけ
        if (v >= 1 && v <= 9) return `<span class="mjf"><b>${MJN[v - 1]}</b><i>萬</i></span>`;
        if (v === 10) return `<span class="mjf hz fl"><b>${MJF[s] || '東'}</b></span>`;
        if (v === 11) return '<span class="mjf hz bai"><b></b></span>';
        if (v === 12) return '<span class="mjf hz fa"><b>發</b></span>';
        return '<span class="mjf hz zh"><b>中</b></span>';
      }, val: v => v },
    en: { cls: 'dk-en', key: 'kb.deck.en', def: true, label: on => `🔤 Number words: ${on ? 'ON' : 'OFF'}`,
      face: (v, s, k) => k === 'mc' || k === 'fly' ? String(v) : `<span class="ewf"><b>${v}</b><i>${EW[v]}</i></span>`, val: null },
    ja: { cls: 'dk-hana', key: 'kb.deck.ja', def: false, label: on => `🎴 花札：${on ? 'オン' : 'オフ'}`,
      face: (v, s, k) => k === 'mc' || k === 'fly' ? `<span class="hnc">${HM[v][0]}</span>${k === 'mc' ? `<sub>${v}</sub>` : ''}` : `<span class="hnf">${hanaSvg(v, s)}<i>${HM[v]}${v === 13 ? '札' : ''}</i></span>`, val: v => v <= 12 ? `${v}月` : '鬼札・13' },
    hi: { cls: 'dk-gj', key: 'kb.deck.hi', def: true, label: on => `🪷 गंजीफ़ा: ${on ? 'चालू' : 'बंद'}`,
      face: (v, s, k) => `<span class="gjf s${s}">${v >= 11 ? '<svg class="gjc" viewBox="0 0 20 10"><path d="M2 9L1 2L6 6L10 0L14 6L19 2L18 9Z" fill="#f5d77a"/></svg>' : ''}<b>${v}</b></span>`, val: null }
  };
  const deckOn = l => { const d = DECKS[l || lang]; if (!d) return false; try { const x = localStorage.getItem(d.key); return x == null ? d.def : x !== '0'; } catch (e) { return d.def; } };
  const deckActive = () => deckOn(lang) ? DECKS[lang] : null;
  const mjActive = () => lang === 'zh' && deckOn('zh');
  const deckVal = t => { t = (t || '').trim().replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d)); return { A: 1, J: 11, Q: 12, K: 13, 'इ': 1, 'गु': 11, 'बे': 12, 'बा': 13 }[t] || (/^\d+$/.test(t) ? +t : 0); };
  function mjEl(el) {
    const d = deckActive(); if (!d || el.dataset.mj || el.closest('[data-noi18n]')) return;
    if (el.matches('.card:not(.back)')) {
      const ve = el.querySelector(':scope > .v'), v = ve && deckVal(ve.textContent); if (!v) return;
      const se = el.querySelector(':scope > .s'), s = se ? Math.max(0, SU.indexOf(se.textContent.trim())) : 0;
      el.dataset.mj = '1'; el.classList.add(d.cls); ve.innerHTML = d.face(v, s, 'card');
      const cn = el.querySelector(':scope > .cn'); if (cn) cn.textContent = v; else el.insertAdjacentHTML('beforeend', `<span class="mjn">${v}</span>`);
    } else if (el.matches('.fieldcard')) {
      const be = el.querySelector(':scope > .big'), v = be && deckVal(be.textContent); if (!v) return;
      const va = el.querySelector(':scope > .val'), m = va && va.textContent.match(/[♠♥♦♣]/), s = m ? SU.indexOf(m[0]) : 0;
      el.dataset.mj = '1'; el.classList.add(d.cls); be.innerHTML = d.face(v, s, 'field'); if (va && d.val) va.textContent = d.val(v);
    } else if (el.matches('.mc')) {
      const v = deckVal(el.textContent); if (!v) return;
      el.dataset.mj = '1'; el.classList.add(d.cls); el.innerHTML = d.face(v, +el.dataset.s || 0, 'mc');
    }
  }
  const MJ_SEL = '.card:not(.back), .fieldcard, .mc';
  // タイトルの式（J − 4 × A = 7）は札の文字を数字に。中国語の麻雀牌は🃏→🀄・フッターの♠♥♦♣→東南西北
  function mjText(n) {
    if (!deckActive() || !n.parentElement || n.parentElement.closest(NODEV)) return; const pe = n.parentElement, v = n.nodeValue; let t = v;
    if (pe.closest('.title-expr')) t = t.replace(/\b([AJQK])\b/g, c => ({ A: 1, J: 11, Q: 12, K: 13 })[c]);
    if (mjActive()) { t = t.replace(/🃏/g, '🀄'); if (pe.closest('.hf-suits')) t = t.replace(/[♠♥♦♣]/g, c => MJF[SU.indexOf(c)]); }
    if (t !== v) n.nodeValue = t;
  }
  // DOM：描き直しのたびに、新しく出た文字と属性を訳す
  const ATTR = ['placeholder', 'aria-label', 'title'];
  function walk(root) {
    if (!root || (lang === 'ja' && !deckActive())) return; const tx = lang !== 'ja';
    if (root.nodeType === 3) { if (tx) { const v = root.nodeValue, t = tr(v); if (t !== v) root.nodeValue = t; hiNode(root); } mjText(root); return; }
    if (root.nodeType !== 1 || root.closest && root.closest('script,style,[data-noi18n]')) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = root;
    do {
      if (n.nodeType === 3) { if (n.parentElement && n.parentElement.closest('script,style,[data-noi18n]')) continue; if (tx) { const v = n.nodeValue; if (JA.test(v)) { const t = tr(v); if (t !== v) n.nodeValue = t; } hiNode(n); } mjText(n); }
      else if (n.nodeType === 1) { if (n.matches && n.matches(MJ_SEL)) mjEl(n); } if (tx && n.nodeType === 1) ATTR.forEach(a => { const v = n.getAttribute && n.getAttribute(a); if (v && JA.test(v)) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } });
    } while ((n = w.nextNode()));
  }
  let obs = null;
  function start() {
    if ((lang === 'ja' && !deckActive()) || obs || typeof MutationObserver === 'undefined' || !document.body) return;
    if (lang !== 'ja') document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'hi' ? 'hi' : 'en';
    const dk = deckActive(); if (dk) document.documentElement.classList.add(dk.cls);
    walk(document.body);
    if (lang === 'ja') { obs = new MutationObserver(ms => { for (const m of ms) if (m.type === 'childList') m.addedNodes.forEach(walk); else if (m.type === 'characterData') walk(m.target); }); obs.observe(document.body, { childList: true, subtree: true, characterData: true }); return; } // 日本語は花札の置きかえだけ
    if (document.title) document.title = tr(document.title);
    obs = new MutationObserver(ms => { for (const m of ms) { if (m.type === 'childList') m.addedNodes.forEach(walk); else if (m.type === 'characterData') walk(m.target); else if (m.type === 'attributes') walk(m.target); } });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
    // 確認・お知らせのダイアログも
    const c0 = G.confirm, a0 = G.alert; G.confirm = m => c0.call(G, tr(String(m))); G.alert = m => a0.call(G, tr(String(m)));
  }
  function set(l) {
    if (!LANGS[l]) return; try { localStorage.setItem('kb.lang', l); } catch (e) { }
    location.reload();
  }
  const on = () => true; // 2026-11-19 本番にも切り替えを出した
  // いまのプレイヤーの名前（文の中の名前を @ として引けるように）
  function setMe(name) { build(); if (!name || name === 'あなた' || NAMES.some(r => r[0] === name)) return; NAMES.push([name, name, name]); NAMES.sort((a, b) => b[0].length - a[0].length); }
  function setDeck(on) { const d = DECKS[lang]; if (!d) return; try { localStorage.setItem(d.key, on ? '1' : '0'); } catch (e) {} location.reload(); }
  G.I18N = { tr, start, set, on, setMe, LANGS, get lang() { return lang; }, walk, setDeck, setMj: setDeck, get mj() { return deckOn('zh'); }, get mjOn() { return mjActive(); },
    get deckOn() { return deckOn(lang); }, get deck() { return deckActive(); }, deckLabel: () => DECKS[lang] ? DECKS[lang].label(deckOn(lang)) : '', deckFace: (v, s, k) => { const d = deckActive(); return d ? d.face(v, s || 0, k) : String(v); }, mjFace: v => DECKS.zh.face(v, 0) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(typeof window !== 'undefined' ? window : globalThis);
