// シェア用画像（OGP 1200×630）を作る：node tools/og.js → dist/og.png（先に ./build.sh）
const { chromium } = require('playwright');
const path = require('path');
const useFonts = require('./fonts');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await useFonts(pg);
  await pg.goto('file://' + path.join(__dirname, '../test/page.html'));
  await pg.waitForTimeout(600);
  await pg.evaluate(() => {
    const K = window.KB;
    const card = (v, s, rot, x, y) => `<div class="c ${s === '♥' || s === '♦' ? 'r' : ''}" style="left:${x}px;top:${y}px;transform:rotate(${rot}deg)"><b>${K.vname(v)}</b><i>${s}</i></div>`;
    const cast = K.shuffle(K.ROSTER.slice()).slice(0, 5).sort((a, c) => a.lv - c.lv).map(c => `<div class="av">${K.avatarSVG(K.charToCh(c), { mood: 'happy', level: c.lv, style: c.st })}</div>`).join('');
    document.getElementById('app').remove(); document.querySelectorAll('#modal,#toast-stack').forEach(e => e.remove()); document.body.insertAdjacentHTML('beforeend', `<style>
      body{margin:0;background:#0b1a14}#og{width:1200px;height:630px;position:relative;overflow:hidden;background:radial-gradient(ellipse at 30% 40%,#17533c 0,#0e3426 45%,#0b1a14 100%);font-family:'Zen Kaku Gothic New',sans-serif;color:#fbf7ee}
      #og:before{content:'';position:absolute;inset:18px;border:3px solid rgba(242,182,50,.55);border-radius:26px}
      .c{position:absolute;width:118px;height:168px;border-radius:14px;background:#fbf3dc;color:#1b1b1b;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(0,0,0,.45);border:2px solid #e6d8b0}
      .c b{font-family:'Dela Gothic One',sans-serif;font-weight:400;font-size:60px;line-height:1}.c i{font-style:normal;font-size:30px}.c.r{color:#d6336c}
      .eq{position:absolute;left:70px;top:258px;font-family:'Dela Gothic One',sans-serif;font-size:36px;color:#f2b632;letter-spacing:2px}
      .t1{position:absolute;left:560px;top:70px;font-family:'Dela Gothic One',sans-serif;font-size:92px;line-height:1;text-shadow:0 4px 0 #0b1a14}
      .t2{position:absolute;left:566px;top:178px;font-family:'Dela Gothic One',sans-serif;font-size:50px;color:#f2b632}
      .lead{position:absolute;left:566px;top:262px;width:580px;font-size:29px;font-weight:900;line-height:1.5}
      .row{position:absolute;left:566px;top:400px;display:flex;gap:10px}.av{width:78px;height:78px}.av svg{width:100%;height:100%}
      .hosts{position:absolute;left:56px;top:330px;display:flex;gap:10px;align-items:flex-start}.h{width:190px;text-align:center;font-weight:900;font-size:20px}.h svg{display:block;margin:0 auto 8px;width:150px;height:150px;border-radius:50%;border:4px solid #f2b632;background:#0b1a14}
      .foot{position:absolute;left:566px;top:520px;font-size:21px;font-weight:700;color:rgba(255,255,255,.75)}
    </style><div id="og">
      ${card(11, '♥', -16, 60, 70)}${card(4, '♠', -5, 160, 52)}${card(1, '♦', 6, 262, 58)}${card(7, '♣', 16, 362, 84)}
      <div class="eq">J − 4 × A ＝ 7</div>
      <div class="hosts"><div class="h">${K.casterSVG('root', 'happy')}<div>解説 ルート博士</div></div><div class="h">${K.casterSVG('masa', 'happy')}<div>実況 ナニワのマサ</div></div></div>
      <div class="t1">計算ブリッジ</div><div class="t2">作戦研究所</div>
      <div class="lead">強さも性格もちがうAIと対戦して、<br>自分の手とAIの最善手をくらべよう。</div>
      <div class="row">${cast}</div>
      <div class="foot">非公式ファン制作　keisan-bridge.lolipop-now.app</div>
    </div>`);
  });
  await pg.evaluate(async () => { await Promise.all([document.fonts.load('92px "Dela Gothic One"', '計算ブリッジ作戦研究所J4A7−×＝♥'), document.fonts.load('900 29px "Zen Kaku Gothic New"', 'あ強'), document.fonts.load('700 21px "Zen Kaku Gothic New"', 'あ')]); await document.fonts.ready; }); await pg.waitForTimeout(800);
  await (await pg.$('#og')).screenshot({ path: path.join(__dirname, '../dist/og.png') });
  await b.close(); console.log('dist/og.png');
})();
