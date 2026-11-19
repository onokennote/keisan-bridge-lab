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
    if (!(deckActive() && deckActive().cls === 'dk-gj') && n.parentElement.closest('.card, .fieldcard, .mc, .flycard, .df-front, .tut-hand')) return; // ガンジファをオフ（ノーマル）にしたら、札はふつうのトランプ（A・J・Q・K と算用数字）
    let v = n.nodeValue, t = v;
    if (isFace(n.parentElement)) t = t.replace(/^\s*(A|J|Q|K)\s*$/, (m, c) => m.replace(c, FACE[c]));
    t = t.replace(/[0-9]/g, d => DEVA[+d]);
    if (t !== v) n.nodeValue = t;
  }
  // 言語ごとの札（デッキ）：中国語＝麻雀牌・英語＝数のことばカード・日本語＝花札・ヒンディー語＝ガンジファ。
  // 端末ごと・言語ごとにオン／オフ（kb.deck.<lang>。中国語は前からの kb.mj）。はじめは日本語だけオフ（ノーマルのトランプ）
  const SU = '♠♥♦♣', MJN = '一二三四五六七八九', MJF = '東南西北';
  const EW = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN'];
  const HM = ['', '松', '梅', '桜', '藤', '菖蒲', '牡丹', '萩', '芒', '菊', '紅葉', '柳', '桐', '猪鹿蝶'];
  const HM13 = ['月見', '猪', '鹿', '蝶']; // 13（K）は役の札：♠＝月見（芒に月と菊の盃）、♥＝猪・♦＝鹿・♣＝蝶
  const hmOf = (v, s) => v === 13 ? HM13[s] || HM13[0] : HM[v];
  // 花札の絵（viewBox 60×80。黒い輪郭・光札は赤い空と光の絵柄（1 鶴と日・3 幕・8 満月・9 盃・11 燕・12 鳳凰など））。s：0＝光（赤い空と光の絵柄）・1＝赤短・2＝青短・3＝カス
  const O = 'stroke="#1a1a1a" stroke-width=".7" stroke-linejoin="round"';
  const R = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');
  const flower5 = (x, y, r, fill, mid, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot})">${R(5, i => `<ellipse cx="0" cy="${-r * .62}" rx="${r * .5}" ry="${r * .62}" transform="rotate(${i * 72})" fill="${fill}" ${O}/>`)}<circle r="${r * .28}" fill="${mid}"/></g>`;
  const leaf = (x, y, l, a, c = '#2f7a3a') => `<path transform="translate(${x} ${y}) rotate(${a})" d="M0 0Q${l * .35} ${-l * .32} ${l} 0Q${l * .35} ${l * .32} 0 0Z" fill="${c}" ${O}/><path transform="translate(${x} ${y}) rotate(${a})" d="M1 0H${l * .9}" stroke="#1a1a1a" stroke-width=".4"/>`;
  const sky = (h = 34) => `<defs><linearGradient id="hsk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9261c"/><stop offset="1" stop-color="#f0743a"/></linearGradient></defs><rect width="60" height="${h}" fill="url(#hsk)"/>`;
  const crane = `<g transform="translate(36 30)"><path d="M-8 6Q-2 -2 8 2Q12 8 4 12Q-4 13 -8 6Z" fill="#fff" ${O}/><path d="M6 3Q10 -10 4 -16" fill="none" stroke="#1a1a1a" stroke-width="2"/><circle cx="4" cy="-17" r="2.4" fill="#fff" ${O}/><circle cx="4.3" cy="-18.6" r="1.1" fill="#d9261c"/><path d="M2 -17l-4 1" stroke="#1a1a1a" stroke-width="1"/><path d="M-8 6l-6 -2l5 5z" fill="#1a1a1a"/><path d="M0 12l-2 8M3 12l1 8" stroke="#1a1a1a" stroke-width="1"/></g>`;
  const sun = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffd34d" ${O}/>`;
  const moon = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff8de" stroke="#e8d9a8" stroke-width="1"/>`;
  const curtain = `<g><rect x="2" y="44" width="56" height="26" rx="2" fill="#fff" ${O}/>${R(5, i => `<rect x="${2 + i * 11.2}" y="44" width="5.6" height="26" fill="#d9261c"/>`)}<rect x="2" y="44" width="56" height="26" rx="2" fill="none" ${O}/><path d="M2 44H58" stroke="#1a1a1a" stroke-width="2.4"/><circle cx="30" cy="57" r="6" fill="#fff" ${O}/>${flower5(30, 57, 4.4, '#f6b8c8', '#d9261c')}</g>`;
  const phoenix = `<g transform="translate(30 30)"><path d="M-14 6Q-4 -6 8 -4Q14 0 10 6Q2 12 -14 6Z" fill="#2d8a4a" ${O}/><path d="M8 -4Q14 -14 10 -20" fill="none" stroke="#1a1a1a" stroke-width="2"/><circle cx="10" cy="-21" r="2.6" fill="#f2c230" ${O}/><path d="M12 -22l4 1l-4 1" fill="#f2c230" ${O}/>${R(5, i => `<path d="M-12 6Q${-24 - i * 2} ${-4 + i * 6} ${-26 - i} ${10 + i * 5}" fill="none" stroke="${['#d9261c', '#f2c230', '#2a5fb0', '#d9261c', '#8a5bc0'][i]}" stroke-width="2.2"/>`)}<path d="M-6 0Q0 -8 6 -2" fill="none" stroke="#f2c230" stroke-width="1.6"/></g>`;
  const swallow = `<g transform="translate(40 26)"><path d="M0 0L-12 -4L-6 1L-14 6L0 3L6 4L2 0Z" fill="#1a1a1a"/><circle cx="4" cy="1.5" r="1.4" fill="#d9261c"/></g>`;
  const cup = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="0" rx="12" ry="3.6" fill="#a8140f" ${O}/><path d="M-12 0Q0 16 12 0Z" fill="#d9261c" ${O}/><path d="M-5 9h10l-1 3h-8z" fill="#a8140f" ${O}/><text x="0" y="7" font-size="6" text-anchor="middle" fill="#f5d77a" font-weight="900" font-family="serif">寿</text></g>`;
  const butterfly = (x, y, k = 1, c = '#e0a01e', r = -22) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${k})"><path d="M0 0C-9 -11 -14 -2 -7 1C-12 6 -5 11 0 3C5 11 12 6 7 1C14 -2 9 -11 0 0Z" fill="${c}" ${O}/><circle cx="-6" cy="-4" r="1.6" fill="#d9261c"/><circle cx="6" cy="-4" r="1.6" fill="#d9261c"/><circle cx="-5" cy="5" r="1" fill="#2a5fb0"/><circle cx="5" cy="5" r="1" fill="#2a5fb0"/><path d="M0 -4v9M0 -4l-2 -4M0 -4l2 -4" stroke="#1a1a1a" stroke-width="1"/></g>`;
  const boar = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M14 -1q4 -1 4 3" fill="none" stroke="#2a1a0e" stroke-width="1.2"/><path d="M-9 -2Q-6 -10 2 -11Q10 -11 14 -4Q16 3 11 7H-4Q-9 6 -10 3Z" fill="#4a2e18" ${O}/>${R(8, i => `<path d="M${-6 + i * 2.6} ${-9.5 + Math.abs(i - 3) * .45}l-1 -3.4l2.6 3" fill="#2a1a0e"/>`)}<path d="M-2 -6Q5 -8 11 -3" fill="none" stroke="#6b4422" stroke-width="1"/><path d="M-1 0Q5 -2 10 2" fill="none" stroke="#6b4422" stroke-width=".8"/><path d="M-9 -3Q-13 -3 -17 0L-19 1Q-19 5 -15 5L-9 4Z" fill="#4a2e18" ${O}/><ellipse cx="-19" cy="3" rx="1.6" ry="2.2" fill="#c08a6a" ${O}/><circle cx="-19.4" cy="2.4" r=".4" fill="#1a1a1a"/><circle cx="-19.4" cy="3.8" r=".4" fill="#1a1a1a"/><path d="M-16 4.6Q-15 7.6 -12.6 6.4" fill="none" stroke="#fff6e8" stroke-width="1.4" stroke-linecap="round"/><circle cx="-12.4" cy="-1.4" r="1" fill="#f2c230"/><circle cx="-12.4" cy="-1.4" r=".5" fill="#1a1a1a"/><path d="M-9.6 -3.6l-1.4 -4l3 2.4z" fill="#4a2e18" ${O}/>${[[-6, 1], [-2, -1], [6, 1], [10, -1]].map(([lx, dx]) => `<path d="M${lx} 6l${dx} 6" stroke="#2a1a0e" stroke-width="2.2" stroke-linecap="round"/><path d="M${lx + dx - 1} 12h2.4" stroke="#1a1a1a" stroke-width="1.4"/>`).join('')}</g>`;
  const deer = (x, y, k = 1) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-10 0Q-8 -7 2 -6Q11 -6 11 1Q10 6 2 6H-6Q-11 5 -10 0Z" fill="#c0702a" ${O}/>${[[-4, -2], [1, 0], [5, -3], [-1, 3], [6, 2]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="1.1" fill="#fff6d8"/>`).join('')}<path d="M-8 -3l-4 -9l4 1z" fill="#c0702a" ${O}/><ellipse cx="-13" cy="-11" rx="3.4" ry="2.4" fill="#c0702a" ${O}/><circle cx="-14" cy="-11.5" r=".8" fill="#1a1a1a"/><path d="M-12 -13l-2 -8M-13.4 -18l-4 -2M-11 -13l3 -7M-9.4 -17l3 -1" stroke="#3a2516" stroke-width="1.2" fill="none"/>${R(4, i => `<path d="M${-7 + i * 4.5} 6l${i % 2 ? 1 : -1} 9" stroke="#3a2516" stroke-width="1.6"/>`)}</g>`;
  const ribbon = (c, x = 22, y = 22, a = -8) => `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="0" y="0" width="13" height="40" rx="1.5" fill="${c}" ${O}/><rect x="1.8" y="1.8" width="9.4" height="36.4" fill="none" stroke="${c === '#2a4fa8' ? '#9cc0ff' : '#f5c4c0'}" stroke-width=".6"/>${c !== '#2a4fa8' ? `<text x="6.5" y="9" font-size="4.6" fill="#1a1a1a" font-weight="900" font-family="serif" writing-mode="tb" letter-spacing=".5">あかよろし</text>` : ''}</g>`;
  const branch = d => `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="4" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#5b3a1e" stroke-width="2.4" stroke-linecap="round"/>`;
  const HP2 = {
    1: s => (s === 0 ? sky(36) + sun(16, 14, 9) : '') + `<path d="M0 80V62Q30 50 60 62V80Z" fill="#3d6b2a" ${O}/>` + branch('M30 78Q26 60 34 44Q38 36 32 26') + [[30, 24, 18, 6], [16, 40, 14, 5], [44, 38, 15, 5], [24, 52, 13, 4.5], [42, 54, 12, 4.5]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#1f5e2e" ${O}/><path d="M${x - rx + 3} ${y}Q${x} ${y - ry - 1} ${x + rx - 3} ${y}" fill="none" stroke="#4e9a52" stroke-width="1"/>`).join('') + (s === 0 ? crane : ''),
    2: s => (s === 0 ? sky(30) : '') + branch('M4 78Q14 60 24 50Q36 38 40 20Q42 12 52 6') + branch('M24 50Q34 54 48 50') + [[12, 64], [20, 52], [30, 42], [38, 28], [46, 12], [44, 50], [52, 6], [34, 54]].map(([x, y], i) => flower5(x, y, 4.6, '#d9263c', '#ffd34d', i * 17)).join(''),
    3: s => (s === 0 ? sky(40) : '') + [[14, 14], [30, 8], [46, 16], [22, 26], [38, 28], [10, 36], [52, 34], [28, 40]].map(([x, y], i) => flower5(x, y, 5.6, i % 2 ? '#fbd2dc' : '#f6aac0', '#d9263c', i * 23)).join('') + R(6, i => leaf(8 + i * 9, 46 + (i % 2) * 4, 7, -30 + i * 12, '#5aa04a')) + (s === 0 ? curtain : ''),
    4: s => (s === 0 ? sky(30) + `<path d="M44 6a9 9 0 1 0 8 13a7 7 0 1 1 -8 -13z" fill="#fff6d8"/>` : '') + branch('M0 6Q30 0 60 8') + [10, 22, 34, 46].map((x, k) => R(9, i => `<circle cx="${x + Math.sin(i * 1.3) * 2.4}" cy="${11 + i * 6 + k * 2}" r="${3.6 - i * .3}" fill="${i % 2 ? '#8e62c6' : '#6a3fa6'}" ${O}/>`)).join('') + leaf(16, 9, 9, 20, '#3f8a3a') + leaf(40, 10, 9, 150, '#3f8a3a'),
    5: s => (s === 0 ? sky(28) : '') + (s === 0 ? `<path d="M0 66L60 58M0 74L60 66" stroke="#5b3a1e" stroke-width="4"/><path d="M0 66L60 58M0 74L60 66" stroke="#1a1a1a" stroke-width=".6" fill="none"/>` : '') + R(6, i => `<path d="M${8 + i * 9} 80Q${6 + i * 9} 50 ${12 + i * 8} ${26 + (i % 3) * 6}" fill="none" stroke="#2f7a3a" stroke-width="3"/>`) + [[16, 26], [32, 18], [46, 30]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M0 -10Q6 -4 0 2Q-6 -4 0 -10Z" fill="#6a3fa6" ${O}/><path d="M0 0Q-10 0 -9 8Q-3 6 0 0Z" fill="#5b3fa8" ${O}/><path d="M0 0Q10 0 9 8Q3 6 0 0Z" fill="#5b3fa8" ${O}/><path d="M0 -2l0 4" stroke="#ffd34d" stroke-width="1.6"/></g>`).join(''),
    6: s => (s === 0 ? sky(30) + butterfly(16, 14, 1, '#f2c230') + butterfly(44, 10, .85, '#f2a0c0') : '') + leaf(10, 62, 16, -40, '#2a6e34') + leaf(50, 62, 16, -140, '#2a6e34') + leaf(30, 70, 14, -90, '#2a6e34') + `<g transform="translate(30 46)">${R(8, i => `<ellipse cx="0" cy="-11" rx="7" ry="10" transform="rotate(${i * 45})" fill="#c8213a" ${O}/>`)}${R(6, i => `<ellipse cx="0" cy="-6" rx="5" ry="7" transform="rotate(${i * 60 + 30})" fill="#e04a64" ${O}/>`)}<circle r="4" fill="#ffd34d" ${O}/></g>`,
    7: s => (s === 0 ? sky(34) + moon(44, 14, 9) : '') + [['M4 80Q10 40 52 14', 0], ['M14 80Q24 50 58 38', 1], ['M2 60Q20 40 40 34', 2]].map(([d]) => `<path d="${d}" fill="none" stroke="#1a1a1a" stroke-width="1.6"/>`).join('') + [[10, 56], [16, 44], [24, 34], [33, 26], [42, 20], [50, 15], [22, 62], [30, 54], [40, 46], [50, 41], [12, 52], [26, 40], [36, 36]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="2" fill="${i % 3 ? '#c8213a' : '#e8608a'}" ${O}/>`).join('') + R(8, i => leaf(8 + i * 6, 70 - i * 6, 5, -60, '#4e8a3a')),
    8: s => (s === 0 ? sky(46) + moon(30, 22, 15) : '') + `<path d="M0 80V48Q30 30 60 48V80Z" fill="#1a1a1a"/>` + R(9, i => `<path d="M${4 + i * 6.5} ${50 - Math.sin(i / 2.5) * 10}Q${6 + i * 6.5} ${36 - Math.sin(i / 2.5) * 8} ${9 + i * 6.5} ${44 - Math.sin(i / 2.5) * 8}" fill="none" stroke="#f3ecd8" stroke-width="1.3"/>`),
    9: s => (s === 0 ? sky(30) + cup(42, 18, .9) : '') + leaf(12, 64, 14, -50, '#2a6e34') + leaf(46, 66, 14, -130, '#2a6e34') + `<path d="M30 80V54" stroke="#2a6e34" stroke-width="2.4"/>` + `<g transform="translate(${s === 0 ? 24 : 30} ${s === 0 ? 46 : 38})">${R(16, i => `<ellipse cx="0" cy="-11" rx="2.4" ry="8" transform="rotate(${i * 22.5})" fill="#f2c230" ${O}/>`)}${R(12, i => `<ellipse cx="0" cy="-6" rx="1.8" ry="5" transform="rotate(${i * 30 + 15})" fill="#f7d35a" ${O}/>`)}<circle r="3" fill="#c88a10" ${O}/></g>`,
    10: s => (s === 0 ? sky(40) : '') + branch('M6 4Q24 20 30 40Q34 56 52 76') + [[14, 16, 0, 1], [32, 12, 20, .9], [26, 34, -15, 1.1], [44, 30, 25, 1], [12, 46, 10, .9], [40, 54, -25, 1.1], [24, 64, 15, .9], [50, 70, 0, .8]].map(([x, y, r, k], i) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${k})" d="M0 -9L2 -4L7 -6L5 -1L10 0L5 2L7 7L2 4L0 9L-2 4L-7 7L-5 2L-10 0L-5 -1L-7 -6L-2 -4Z" fill="${i % 2 ? '#e0501e' : '#c8213a'}" ${O}/>`).join(''),
    11: s => (s === 0 ? sky(30) + swallow : '') + R(7, i => `<path d="M${4 + i * 8} 0Q${2 + i * 8} 30 ${6 + i * 8} 70" fill="none" stroke="#4e8a3a" stroke-width="2"/>` + R(5, j => leaf(4 + i * 8 + (j % 2 ? 1 : -1), 8 + j * 13, 6, j % 2 ? 70 : 110, '#6aa84f'))) + R(12, i => `<path d="M${(i * 17) % 58 + 2} ${(i * 23) % 70 + 4}l-3 7" stroke="#1a1a1a" stroke-width="1.2"/>`),
    12: s => (s === 0 ? sky(40) + phoenix : '') + `<g transform="translate(30 ${s === 0 ? 66 : 58})">${[-50, -90, -130].map((a, i) => `<path transform="rotate(${a})" d="M0 0Q14 -12 26 0Q14 12 0 0Z" fill="${i === 1 ? '#1f5e2e' : '#2a6e34'}" ${O}/>`).join('')}</g>` + (s === 0 ? '' : R(9, i => `<circle cx="${20 + (i % 3) * 10}" cy="${12 + Math.floor(i / 3) * 8}" r="4.4" fill="${i % 2 ? '#8a5bc0' : '#6a3fa6'}" ${O}/>`) + `<path d="M30 36V48" stroke="#1a1a1a" stroke-width="1.4"/>`),
    // 13（K）は役の札：札の地の色ごと変える（.hk0〜3）。♠＝月見（夜の藍）・♥＝萩に猪（秋の山吹〜赤茶）・♦＝紅葉に鹿（深い紅）・♣＝牡丹に蝶（淡い桃）
    13: s => s === 0 ? `<circle cx="30" cy="24" r="15" fill="#f6d86a"/><path d="M0 80V50Q30 34 60 50V80Z" fill="#4a4a4e"/>` + R(5, i => `<path d="M${8 + i * 11} ${48 - Math.sin(i / 1.3) * 6}q2 -9 4 -1" fill="none" stroke="#f3ecd8" stroke-width="1.2"/>`) + cup(40, 64, 1.05)
      : s === 1 ? R(3, k => `<path d="M${-4 + k * 20} 80Q${6 + k * 22} 30 ${54 - k * 8} ${6 + k * 4}" fill="none" stroke="#3a2516" stroke-width="1.3"/>`) + [[8, 60], [14, 46], [22, 32], [32, 22], [44, 14], [52, 10], [26, 60], [34, 46], [44, 34], [54, 26], [40, 64], [50, 52], [18, 18], [10, 30]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="1.8" fill="${i % 3 ? '#c8213a' : '#f07aa0'}" stroke="#1a1a1a" stroke-width=".5"/>`).join('') + R(9, i => leaf(6 + i * 6, 58 - i * 5, 4.6, -50 - i * 6, '#5a8a32')) + `<path d="M0 80V68Q30 60 60 68V80Z" fill="#7a4a1c" ${O}/>` + R(7, i => `<path d="M${4 + i * 8} 70l-2 -6M${6 + i * 8} 70l1 -7" stroke="#3d6b2a" stroke-width="1.2"/>`) + boar(32, 54, 1.45)
      : s === 2 ? R(11, i => `<path transform="translate(${(i * 23) % 56 + 4} ${(i * 31) % 40 + 6}) rotate(${i * 37}) scale(${.7 + (i % 3) * .2})" d="M0 -6L1.6 -2L5 -3L3.4 0.6L6 2.6L1.6 2.6L0 6.6L-1.6 2.6L-6 2.6L-3.4 0.6L-5 -3L-1.6 -2Z" fill="${['#f2a03a', '#f7d35a', '#e0501e'][i % 3]}" ${O}/>`) + `<path d="M0 80V66Q30 58 60 66V80Z" fill="#4a1410" ${O}/>` + R(6, i => `<path transform="translate(${6 + i * 10} 70) rotate(${i * 50})" d="M0 -3L1 -1L3 -1.6L2 .4L3 1.6L1 1.6L0 3.6L-1 1.6L-3 1.6L-2 .4L-3 -1.6L-1 -1Z" fill="#f2a03a"/>`) + deer(32, 52, 1.5)
      : leaf(4, 72, 16, -35, '#2a6e34') + leaf(56, 72, 16, -145, '#2a6e34') + leaf(18, 78, 12, -70, '#3f8a3a') + leaf(42, 78, 12, -110, '#3f8a3a') + `<g transform="translate(30 64)">${R(8, i => `<ellipse cx="0" cy="-9" rx="6" ry="8.5" transform="rotate(${i * 45})" fill="#c8213a" ${O}/>`)}${R(6, i => `<ellipse cx="0" cy="-5" rx="4.4" ry="6" transform="rotate(${i * 60 + 30})" fill="#e04a64" ${O}/>`)}<circle r="3.4" fill="#ffd34d" ${O}/></g>` + butterfly(32, 26, 1.9, '#f2c230') + butterfly(12, 10, .9, '#f7f0e0', 18)
  };

  const hanaSvg = (v, s) => `<svg viewBox="0 0 60 80" preserveAspectRatio="xMidYMid meet">${HP2[v] ? HP2[v](s) : ''}${(s === 1 || s === 2) && v !== 13 ? ribbon(s === 1 ? '#c8213a' : '#2a4fa8') : ''}</svg>`;
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
      face: (v, s, k) => k === 'mc' || k === 'fly' ? `<span class="hnc">${hmOf(v, s)[0]}</span>${k === 'mc' ? `<sub>${v}</sub>` : ''}` : `<span class="hnf">${hanaSvg(v, s)}<i>${hmOf(v, s)}</i></span>`, val: v => v <= 12 ? `${v}月` : '役札・13' },
    hi: { cls: 'dk-gj', key: 'kb.deck.hi', def: true, label: on => `🪷 गंजीफ़ा: ${on ? 'चालू' : 'बंद'}`,
      face: (v, s, k) => `<span class="gjf s${s}">${v >= 11 ? '<svg class="gjc" viewBox="0 0 20 10"><path d="M2 9L1 2L6 6L10 0L14 6L19 2L18 9Z" fill="#f5d77a"/></svg>' : ''}<b>${v}</b></span>`, val: null }
  };
  const deckOn = l => { const d = DECKS[l || lang]; if (!d) return false; try { const x = localStorage.getItem(d.key); return x == null ? d.def : x !== '0'; } catch (e) { return d.def; } };
  // 大会をひらく人が札の形式を決めた大会の卓では、言語にかかわらずその札（forced：'normal'＝トランプ・hana・mj・en・gj。null＝各自の設定）
  const DECK_BY = { hana: 'ja', mj: 'zh', en: 'en', gj: 'hi' }; let forced = null;
  const deckActive = () => forced ? (forced === 'normal' ? null : DECKS[DECK_BY[forced]] || null) : deckOn(lang) ? DECKS[lang] : null;
  const mjActive = () => { const d = deckActive(); return !!(d && d.cls === 'mj'); };
  function forceDeck(k) {
    k = k && k !== 'own' && (k === 'normal' || DECK_BY[k]) ? k : null; if (k === forced) return;
    forced = k; const html = document.documentElement; Object.values(DECKS).forEach(d => html.classList.remove(d.cls)); const d = deckActive(); if (d) html.classList.add(d.cls);
    if (!obs) start(); // 日本語でトランプのときは見張っていないので、ここで始める
  }
  const deckVal = t => { t = (t || '').trim().replace(/[०-९]/g, d => '०१२३४५६७८९'.indexOf(d)); return { A: 1, J: 11, Q: 12, K: 13, 'इ': 1, 'गु': 11, 'बे': 12, 'बा': 13 }[t] || (/^\d+$/.test(t) ? +t : 0); };
  function mjEl(el) {
    const d = deckActive(); if (!d || el.dataset.mj || el.closest('[data-noi18n]')) return;
    if (el.matches('.card:not(.back)')) {
      const ve = el.querySelector(':scope > .v'), v = ve && deckVal(ve.textContent); if (!v) return;
      const se = el.querySelector(':scope > .s'), s = se ? Math.max(0, SU.indexOf(se.textContent.trim())) : 0;
      el.dataset.mj = '1'; el.classList.add(d.cls); ve.innerHTML = d.face(v, s, 'card'); if (d.cls === 'dk-hana' && v === 13) el.classList.add('hk', 'hk' + s);
      const cn = el.querySelector(':scope > .cn'); if (cn) cn.textContent = v; else el.insertAdjacentHTML('beforeend', `<span class="mjn">${v}</span>`);
    } else if (el.matches('.fieldcard')) {
      const be = el.querySelector(':scope > .big'), v = be && deckVal(be.textContent); if (!v) return;
      const va = el.querySelector(':scope > .val'), m = va && va.textContent.match(/[♠♥♦♣]/), s = m ? SU.indexOf(m[0]) : 0;
      el.dataset.mj = '1'; el.classList.add(d.cls); be.innerHTML = d.face(v, s, 'field'); if (d.cls === 'dk-hana' && v === 13) el.classList.add('hk', 'hk' + s); if (va && d.val) va.textContent = d.val(v);
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
    get deckOn() { return deckOn(lang); }, get deck() { return deckActive(); }, forceDeck, deckLabel: () => DECKS[lang] ? DECKS[lang].label(deckOn(lang)) : '', deckFace: (v, s, k) => { const d = deckActive(); return d ? d.face(v, s || 0, k) : String(v); }, mjFace: v => DECKS.zh.face(v, 0) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(typeof window !== 'undefined' ? window : globalThis);
