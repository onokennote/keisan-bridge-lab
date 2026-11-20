// バッジ・冠の称号：取ると選べる・プロフィールに出る・マサのアドバイスで触れる
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(__dirname, 'page.html')); await pg.waitForTimeout(800);
  await pg.evaluate(() => { localStorage.setItem('kb.testAskName', '1'); }); await pg.reload(); await pg.waitForTimeout(800); await pg.fill('#new-name', 'テスト'); await pg.click('[data-act="create-profile"]'); await pg.waitForTimeout(800);
  await pg.evaluate(() => { document.querySelectorAll('#modal').forEach(e => e.remove()); KBAPP.go('home'); }); await pg.waitForTimeout(300);
  const r = await pg.evaluate(async () => {
    const K = KBAPP; const out = {};
    K.testAch('champion', 9); K.testAch('quick3', 19); K.testAch('chart', 37); K.testAch('outs3', 10); K.testAch('outs4', 10); K.testAch('outs5', 6);
    await new Promise(r => setTimeout(r, 300));
    const g = K.G(); out.cat = Object.keys(g.ach).filter(k => k.startsWith('cat:'));
    K.act('title-open'); await new Promise(r => setTimeout(r, 300));
    const m = document.querySelector('#modal'); out.list = [...m.querySelectorAll('.ttl.bt')].map(x => x.textContent.trim());
    const bt = m.querySelector('.ttl.bt'); if (bt) bt.click(); await new Promise(r => setTimeout(r, 300));
    out.home = (document.querySelector(".pb-title") || {}).textContent; out.bar = !!document.querySelector(".player-bar"); out.view = K.S.view; out.t = localStorage.getItem("kb.p." + Object.keys(localStorage).find(k=>k.endsWith(".title")));out.keys=Object.keys(localStorage).filter(k=>/title/.test(k));
    const adv = []; for (let k = 0; k < 8; k++) { K.act('host-masa'); await new Promise(r => setTimeout(r, 200)); adv.push(...[...document.querySelectorAll('#modal .adv p')].map(e => e.textContent).filter(t => /称号/.test(t))); }
    out.adv = [...new Set(adv)].slice(0, 3); document.querySelectorAll('#modal').forEach(e => e.remove());
    return out;
  });
  console.log(JSON.stringify(r));
  await pg.evaluate(() => KBAPP.act('title-open')); await pg.waitForTimeout(300);
  await pg.evaluate(() => { const d = document.querySelector('.bt-more'); if (d) d.open = true; });
  await pg.screenshot({ path: path.join(__dirname, 'out', 'btitle.png') });
  const ok = r.list.length >= 3 && /🏅/.test(r.home || '') && r.adv.length > 0;
  console.log(ok && !errs.length ? 'OK' : 'NG', errs); await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
