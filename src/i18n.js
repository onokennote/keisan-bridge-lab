// ---------- 多言語（英語・中国語 簡体字）：画面に出た日本語を、表示するときに辞書で差し替える ----------
// 辞書は I18N_ROWS（i18n_dict.js）。数字は # 、キャラの名前は @ に置きかえて引く（「ゴウのプロフィール」→「@のプロフィール」）。
// 見つからない文はそのまま日本語で出す（第1段は画面の文字。実況・総評などは順に足す）。
(function (G) {
  const LANGS = { ja: '日本語', en: 'English', zh: '中文' };
  let lang = 'ja';
  try { lang = localStorage.getItem('kb.lang') || 'ja'; } catch (e) { }
  if (!LANGS[lang]) lang = 'ja';
  const D = new Map(), NAMES = [];
  let ready = false;
  function build() {
    if (ready) return; ready = true;
    (G.I18N_ROWS || []).forEach(r => { if (r && r[0] && !D.has(r[0])) D.set(r[0], { en: r[1], zh: r[2] }); });
    (G.I18N_NAMES || []).forEach(r => { NAMES.push(r); if (!D.has(r[0])) D.set(r[0], { en: r[1], zh: r[2] }); });
    NAMES.sort((a, b) => b[0].length - a[0].length);
  }
  const JA = /[぀-ヿ一-鿿]/;
  // # は順に、#2 のように番号つきならその数（訳で数字を省くとき用）。@ は名前を順に
  function fill(tpl, nums, names) { let i = 0, j = 0; return tpl.replace(/#([1-9])?|@/g, (c, k) => c === '@' ? (names[j++] ?? c) : k ? (nums[+k - 1] ?? c) : (nums[i++] ?? c)); }
  function look(key, nums, names) { const h = D.get(key); return h && h[lang] ? fill(h[lang], nums, names) : null; }
  function tr(s) {
    if (lang === 'ja' || !s || !JA.test(s)) return s;
    build();
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/), core = m[2];
    const out = core && trCore(core, 0);
    return out == null ? s : m[1] + out + m[3];
  }
  function trCore(core, depth) {
    const nums = [], dig = t => t.replace(/\d+(?:\.\d+)?/g, x => { nums.push(x); return '#'; });
    let r = look(dig(core), nums, []); if (r != null) return r;
    // キャラの名前を @ にして引く（名前に数字が入っていても先に名前を取る）
    const pos = [];
    for (const [ja, en, zh] of NAMES) { let p = core.indexOf(ja); while (p >= 0) { if (!pos.some(([q, l]) => p < q + l && q < p + ja.length)) pos.push([p, ja.length, lang === 'en' ? en : zh]); p = core.indexOf(ja, p + ja.length); } }
    if (pos.length) {
      pos.sort((a, b) => a[0] - b[0]); let k3 = '', at = 0; const nm = [];
      pos.forEach(([p, l, v]) => { k3 += core.slice(at, p) + '@'; at = p + l; nm.push(v); }); k3 += core.slice(at);
      nums.length = 0; r = look(dig(k3), nums, nm); if (r != null) return r;
    }
    // 「…」の中を先に訳して @ にする（「皆勤賞」→ "Perfect Attendance"）
    if (/「[^「」]+」/.test(core)) {
      const nm = []; let ok = true; const k4 = core.replace(/「([^「」]+)」/g, (m, x) => { const t = trCore(x, 9); if (t == null) { ok = false; return m; } nm.push(t); return '「@」'; });
      if (ok) { nums.length = 0; r = look(dig(k4), nums, nm); if (r != null) return r; }
    }
    // 「名前：説明」は左右を別々に
    if (depth < 4) for (const sep of ['：', '・', '　', ' ']) {
      const i = core.indexOf(sep); if (i > 0 && i < core.length - 1) {
        const a = trCore(core.slice(0, i), depth + 1), b = trCore(core.slice(i + 1), depth + 1);
        if (a != null && b != null) return a + (sep === '：' ? (lang === 'en' ? ': ' : '：') : sep === '・' ? (lang === 'en' ? ' · ' : '·') : sep) + b;
      }
    }
    return null;
  }
  // DOM：描き直しのたびに、新しく出た文字と属性を訳す
  const ATTR = ['placeholder', 'aria-label', 'title'];
  function walk(root) {
    if (lang === 'ja' || !root) return;
    if (root.nodeType === 3) { const v = root.nodeValue, t = tr(v); if (t !== v) root.nodeValue = t; return; }
    if (root.nodeType !== 1 || root.closest && root.closest('script,style,[data-noi18n]')) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = root;
    do {
      if (n.nodeType === 3) { if (n.parentElement && n.parentElement.closest('script,style,[data-noi18n]')) continue; const v = n.nodeValue; if (JA.test(v)) { const t = tr(v); if (t !== v) n.nodeValue = t; } }
      else if (n.nodeType === 1) ATTR.forEach(a => { const v = n.getAttribute && n.getAttribute(a); if (v && JA.test(v)) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } });
    } while ((n = w.nextNode()));
  }
  let obs = null;
  function start() {
    if (lang === 'ja' || obs || typeof MutationObserver === 'undefined' || !document.body) return;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    walk(document.body);
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
  // 切り替えはできあがるまでテスト版だけ（kb.i18nTry=1 でも出す）
  const on = () => { try { return !!(G.KB_STAGING || localStorage.getItem('kb.i18nTry') === '1' || lang !== 'ja'); } catch (e) { return !!G.KB_STAGING; } };
  G.I18N = { tr, start, set, on, LANGS, get lang() { return lang; }, walk };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else setTimeout(start, 0);
})(typeof window !== 'undefined' ? window : globalThis);
