// 多言語（英語・中国語 簡体字）：辞書の形・数字の数、主な画面を英語・中国語で開いてエラー・はみ出し・訳し残しを確かめる。使い方：cd test && node i18n.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const src = path.join(__dirname, '..', 'src');
global.window = {}; eval(fs.readFileSync(path.join(src, 'i18n_lines.js'), 'utf8')); const LN = window.I18N_LINES; ok(Object.values(LN).every(v => v.length === 2 && v[0] && v[1]), `実況の型 ${Object.keys(LN).length}個に英語・中文がある`); ['i18n_names', 'i18n_dict', 'i18n_dict2', 'i18n_dict3', 'i18n_dict4', 'i18n_dict5', 'i18n_dict6', 'i18n_dict7', 'i18n_dict8', 'i18n_dict9', 'i18n_dict10', 'i18n_dict11', 'i18n_dict12', 'i18n_dict13', 'i18n_dict14', 'i18n_dict15', 'i18n_dict16'].forEach(f => eval(fs.readFileSync(path.join(src, f + '.js'), 'utf8')));
const R = window.I18N_ROWS;
ok(R.every(r => r.length === 3 && r[1] && r[2]), `辞書の行はどれも「日本語・英語・中文」の3つ（${R.length}行・名前${window.I18N_NAMES.length}）`);
const cnt = (s, re) => (s.match(re) || []).length, refs = s => { const m = s.match(/#([1-9])?/g) || []; return Math.max(m.length ? Math.max(...m.map(x => x.length > 1 ? +x[1] : 0)) : 0, cnt(s.replace(/#[1-9]/g, ''), /#/g)); };
const bad = R.filter(r => [1, 2].some(i => refs(r[i]) > cnt(r[0], /#/g) || cnt(r[i], /@/g) !== cnt(r[0], /@/g)));
ok(!bad.length, '訳の # と @ が元の文より多くない ' + bad.map(r => r[0]).join(' / '));
const JA = /[぀-ゟ゠-ヺヽ-ヿ]/; // かな（中国語の訳に日本語のかなが残っていないか）
ok(!R.some(r => JA.test(r[2]) && !/上野晋太郎|すうがっくま/.test(r[2])), '中国語の訳にかなが残っていない ' + R.filter(r => JA.test(r[2]) && !/上野晋太郎|すうがっくま/.test(r[2])).map(r => r[2]).join(' / '));
(async () => {
  const b = await chromium.launch();
  for (const lang of ['en', 'zh']) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(l => { localStorage.setItem('kb.lang', l); }, lang);
    await p.goto('file://' + path.join(__dirname, 'page.html')); await p.waitForTimeout(1500);
    const kana = () => p.evaluate(() => { const re = /[぀-ゟ゠-ヺヽ-ヿ]/, out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.nodeValue.trim(); if (t && t.length > 1 && re.test(t) && !n.parentElement.closest('script,style,.lc,.cm-line,.op-bubble,.comment,.bubble') && !/上野晋太郎|すうがっくま/.test(t)) out.push(t); } return out; });
    const over = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const res = {};
    for (const [tag, fn] of [['home', () => KBAPP.go('home')], ['setup', () => KBAPP.go('setup-practice')], ['setupT', () => KBAPP.go('setup-tour')], ['growth', () => KBAPP.go('growth')], ['road', () => KBAPP.go('road')], ['ranking', () => KBAPP.go('ranking')]]) {
      await p.evaluate(fn); await p.waitForTimeout(700); const k = await kana(); res[tag] = k.length; const o = await over();
      ok(o <= 1, `${lang} ${tag}：横にはみ出さない（${o}px）`);
      if (k.length) { console.log(`   ${lang} ${tag} 訳し残し ${k.length}: ${k.slice(0, 8).join(' | ')}`); fs.appendFileSync(path.join(__dirname, 'out', 'i18n_left.txt'), k.map(x => lang + '\t' + tag + '\t' + x).join('\n') + '\n'); }
      await p.screenshot({ path: path.join(__dirname, 'out', `i18n_${lang}_${tag}.png`) });
    }
    await p.evaluate(() => KBAPP.go('setup-practice')); await p.evaluate(() => KBAPP.act('start-practice')); await p.waitForTimeout(4000);
    await p.screenshot({ path: path.join(__dirname, 'out', `i18n_${lang}_game.png`) });
    ok(await p.evaluate(() => /Hand|手牌/.test(document.body.innerText)), `${lang} 対局画面が訳される`);
    const cm = await p.evaluate(() => ['start', 'play3', 'draw', 'good', 'bad', 'win', 'roundBig'].map(k => { const c = KB.commentLine('both', k, { g: 1, n: 'ゴウ', e: '5 + 6 + 1', t: 12, h: 3, best: '5 + 7', r: 2 }); return c ? c.text : ''; }));
    ok(cm.every(t => t && !/[\u3040-\u309f\u30a0-\u30fa]/.test(t)), `${lang} 実況が訳される：${cm[2]}`);
    ok(!errs.length, `${lang} エラーなし ` + errs.join(' / '));
    await p.close();
  }
  // 日本語のときは何も変えない
  const p = await b.newPage(); await p.goto('file://' + path.join(__dirname, 'page.html')); await p.waitForTimeout(1000);
  ok(await p.evaluate(() => /計算ブリッジ/.test(document.body.innerText) && I18N.lang === 'ja'), '日本語のときはそのまま');
  await b.close();
})();
