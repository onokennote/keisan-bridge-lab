// ===== 効果音：Web Audio でその場で合成（音声ファイルなし） =====
(function (G) {
'use strict';
const KB = G.KB;
let ctx = null, master = null, noiseBuf = null;
const st = { on: true, vol: 1.6 };
function ac() {
  if (!st.on) return null;
  const AC = G.AudioContext || G.webkitAudioContext; if (!AC) return null;
  if (!ctx) {
    try { ctx = new AC(); } catch (e) { return null; }
    master = ctx.createGain(); master.gain.value = st.vol;
    // 音量を上げても割れないよう、最後にコンプレッサーを通す
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// 音色の部品
function tone(f, t0, dur, o) {
  o = o || {}; const c = ctx;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  const v = o.vol == null ? 0.3 : o.vol, a = o.a || 0.005;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(o.dest || master); osc.start(t0); osc.stop(t0 + dur + 0.05);
}
function noise(t0, dur, o) {
  o = o || {}; const c = ctx;
  const src = c.createBufferSource(); src.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.setValueAtTime(o.f || 2000, t0);
  if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t0 + dur);
  f.Q.value = o.q || 1;
  const g = c.createGain(); const v = o.vol == null ? 0.3 : o.vol;
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + (o.a || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t0, Math.random() * 0.3); src.stop(t0 + dur + 0.05);
}
const SFX = {
  // カードを選ぶ・外す
  select: t => { tone(1400, t, 0.05, { type: 'triangle', vol: 0.12 }); noise(t, 0.03, { f: 5000, vol: 0.06 }); },
  unselect: t => { tone(900, t, 0.05, { type: 'triangle', vol: 0.1 }); },
  // 札を出す：パシッ
  play: (t, n) => {
    for (let k = 0; k < (n || 1); k++) { const u = t + k * 0.09; noise(u, 0.09, { f: 1800, q: 0.8, vol: 0.4 }); tone(180, u, 0.08, { type: 'sine', vol: 0.25, to: 90 }); }
  },
  // 3枚出し：パシッ×3＋上がる音
  play3: t => { SFX.play(t, 3); [660, 880, 1320].forEach((f, i) => tone(f, t + 0.3 + i * 0.07, 0.25, { type: 'triangle', vol: 0.13 })); },
  // 山札から引く：シュッ
  draw: t => { noise(t, 0.22, { f: 900, fto: 4000, q: 1.2, vol: 0.22, a: 0.06 }); tone(500, t + 0.18, 0.06, { type: 'triangle', vol: 0.08 }); },
  // 場札が飛び出して、めくれる
  deal: t => { noise(t, 0.4, { f: 600, fto: 3500, q: 0.9, vol: 0.25, a: 0.1 }); noise(t + 0.45, 0.08, { f: 3000, vol: 0.25 }); tone(520, t + 0.48, 0.35, { type: 'triangle', vol: 0.16 }); tone(780, t + 0.52, 0.4, { type: 'sine', vol: 0.1 }); },
  // 第N巡：ポン
  round: t => { tone(392, t, 0.35, { type: 'triangle', vol: 0.18 }); tone(587, t + 0.08, 0.45, { type: 'triangle', vol: 0.16 }); },
  // 自分の番：チャイム
  myturn: t => { tone(988, t, 0.3, { type: 'sine', vol: 0.16 }); tone(1319, t + 0.11, 0.45, { type: 'sine', vol: 0.14 }); },
  // 誰かが残り2枚以下：緊張感
  reach: t => { [0, 0.16].forEach(d => tone(220, t + d, 0.14, { type: 'square', vol: 0.06 })); tone(330, t + 0.32, 0.3, { type: 'square', vol: 0.06 }); },
  // お手つき：ブブー
  foul: t => { tone(150, t, 0.32, { type: 'sawtooth', vol: 0.22 }); tone(155, t, 0.32, { type: 'square', vol: 0.12 }); tone(140, t + 0.38, 0.5, { type: 'sawtooth', vol: 0.22 }); tone(146, t + 0.38, 0.5, { type: 'square', vol: 0.12 }); },
  // 切り直し：パラパラ
  shuffle: t => { for (let k = 0; k < 12; k++) noise(t + k * 0.035, 0.03, { f: 2500 + Math.random() * 1500, vol: 0.14 }); },
  // 最善手：キラッ
  best: t => { [1568, 2093].forEach((f, i) => tone(f, t + i * 0.06, 0.25, { type: 'sine', vol: 0.07 })); },
  // 自分が上がり：ファンファーレ
  win: t => {
    const n = [523, 659, 784, 1047]; n.forEach((f, i) => tone(f, t + i * 0.11, 0.3, { type: 'triangle', vol: 0.18 }));
    [523, 659, 784, 1047].forEach(f => tone(f, t + 0.5, 0.9, { type: 'triangle', vol: 0.1 }));
    noise(t + 0.5, 0.6, { f: 6000, ft: 'highpass', vol: 0.08, a: 0.02 });
  },
  // 他の人が上がり
  otherWin: t => { tone(659, t, 0.2, { type: 'triangle', vol: 0.14 }); tone(523, t + 0.16, 0.2, { type: 'triangle', vol: 0.14 }); tone(392, t + 0.32, 0.5, { type: 'triangle', vol: 0.14 }); },
  // セット開始・決勝などのバナー
  banner: t => { [392, 523, 659].forEach((f, i) => { tone(f, t + i * 0.1, 0.6, { type: 'sawtooth', vol: 0.06 }); tone(f, t + i * 0.1, 0.6, { type: 'triangle', vol: 0.1 }); }); tone(784, t + 0.32, 0.9, { type: 'triangle', vol: 0.14 }); },
  // ホイッスル：ピーッ（n回。最後を長く）
  whistle: (t, n) => {
    n = n || 1; let u = t;
    for (let k = 0; k < n; k++) {
      const long = k === n - 1, d = long ? 0.9 : 0.22;
      const osc = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(2600, u); lfo.frequency.value = 38; lg.gain.value = 120;
      lfo.connect(lg); lg.connect(osc.frequency);
      g.gain.setValueAtTime(0.0001, u); g.gain.exponentialRampToValueAtTime(0.22, u + 0.02); g.gain.setValueAtTime(0.22, u + d - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, u + d);
      osc.connect(g); g.connect(master); osc.start(u); lfo.start(u); osc.stop(u + d + 0.05); lfo.stop(u + d + 0.05);
      noise(u, d, { f: 2600, q: 6, vol: 0.06 });
      u += d + 0.12;
    }
  },
  // コンボ：段が上がるほど高く・派手に（n=コンボ数）
  combo: (t, n) => {
    n = n || 2; const st = Math.min(12, (n - 2) * 1.5), f0 = 784 * Math.pow(2, st / 12);
    [0, 4, 7].forEach((s, i) => tone(f0 * Math.pow(2, s / 12), t + i * 0.05, 0.22, { type: 'triangle', vol: 0.12 }));
    if (n >= 5) noise(t + 0.1, 0.25, { f: 7000, ft: 'highpass', vol: 0.06 });
    if (n >= 10) tone(f0 * 2, t + 0.18, 0.4, { type: 'sine', vol: 0.1 });
  },
  comboEnd: t => { tone(523, t, 0.12, { type: 'triangle', vol: 0.1 }); tone(392, t + 0.1, 0.22, { type: 'triangle', vol: 0.09 }); },
  // 決めゴールのカットイン：シュバッ＋ジャーン
  cutin: t => { noise(t, 0.3, { f: 800, fto: 6000, q: 0.8, vol: 0.3, a: 0.05 }); [523, 659, 784, 1047].forEach(f => tone(f, t + 0.28, 0.9, { type: 'sawtooth', vol: 0.05 })); [523, 659, 784, 1047].forEach(f => tone(f, t + 0.28, 0.9, { type: 'triangle', vol: 0.1 })); },
  // 式ハンター：狩りの角笛（開始・終了）
  horn: (t, n) => {
    const seq = n === 2 ? [[392, 0, 0.3], [330, 0.32, 0.3], [262, 0.64, 0.8]] : [[262, 0, 0.25], [330, 0.27, 0.25], [392, 0.54, 0.7]];
    seq.forEach(([f, d, l]) => { tone(f, t + d, l, { type: 'sawtooth', vol: 0.07, a: 0.04 }); tone(f, t + d, l, { type: 'triangle', vol: 0.14, a: 0.04 }); tone(f * 1.5, t + d, l, { type: 'sine', vol: 0.04, a: 0.05 }); });
  },
  // 照準が合う：ピピッ
  lockon: t => { tone(1760, t, 0.06, { type: 'square', vol: 0.05 }); tone(2349, t + 0.08, 0.1, { type: 'square', vol: 0.05 }); },
  // 捕獲：バシュッ＋キラン
  capture: t => { noise(t, 0.18, { f: 1200, fto: 300, q: 0.7, vol: 0.35, a: 0.005 }); tone(140, t, 0.18, { type: 'sine', vol: 0.3, to: 70 }); [1319, 1760, 2637].forEach((f, i) => tone(f, t + 0.16 + i * 0.07, 0.3, { type: 'sine', vol: 0.09 })); },
  // 獲物が逃げる：ササッ（足音）＋ひゅーん
  flee: t => { for (let k = 0; k < 4; k++) noise(t + k * 0.07, 0.05, { f: 2500 + k * 300, vol: 0.12 }); tone(900, t + 0.2, 0.4, { type: 'sine', vol: 0.08, to: 300 }); },
  // 銃声：パァン
  shot: t => { noise(t, 0.12, { f: 3000, ft: 'highpass', vol: 0.45, a: 0.002 }); noise(t, 0.35, { f: 400, fto: 120, q: 0.6, vol: 0.4, a: 0.002 }); tone(90, t, 0.25, { type: 'sine', vol: 0.35, to: 40 }); },
  // ボタン
  click: t => { tone(880, t, 0.05, { type: 'triangle', vol: 0.22 }); tone(1320, t + 0.025, 0.05, { type: 'sine', vol: 0.1 }); noise(t, 0.02, { f: 4000, vol: 0.08 }); },
  // 決定系のボタン（開始・次へなど）
  confirm: t => { tone(660, t, 0.08, { type: 'triangle', vol: 0.2 }); tone(990, t + 0.07, 0.14, { type: 'triangle', vol: 0.2 }); },
  // 戻る・閉じる・中断
  back: t => { tone(700, t, 0.06, { type: 'triangle', vol: 0.18 }); tone(470, t + 0.06, 0.1, { type: 'triangle', vol: 0.16 }); }
};
KB.sfx = function (name, arg) {
  try {
    const c = ac(); if (!c || !SFX[name]) return;
    SFX[name](c.currentTime + 0.01, arg); return true;
  } catch (e) { return e.message; }
};
KB.SFX_LEVELS = { off: ['なし', 0], s: ['小', 0.5], m: ['中', 1], l: ['大', 1.6], xl: ['最大', 2.6] };
KB.sfxLevel = function (k) { const L = KB.SFX_LEVELS[k] || KB.SFX_LEVELS.l; KB.sfxSet(L[1] > 0, L[1] || st.vol); };
KB.sfxSet = function (on, vol) {
  st.on = !!on; if (vol != null) st.vol = vol;
  if (master) master.gain.value = st.vol;
  if (!st.on && ctx && ctx.state === 'running') ctx.suspend();
};
// 最初の操作で音声を有効にする（ブラウザの自動再生制限への対応）
if (typeof document !== 'undefined') {
  const unlock = () => { if (st.on) ac(); document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true); };
  document.addEventListener('pointerdown', unlock, true); document.addEventListener('keydown', unlock, true);
}
})(typeof window !== 'undefined' ? window : globalThis);
