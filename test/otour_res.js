// ふつうのオンライン大会に呼ぶAI研究員（強さの範囲・招待だけはOFF・シャドーは卓の最強の★）と、表彰台にAIを含むかの設定
// 使い方：cd test && node otour_res.js（php が必要。2〜4分かかる）
const fs = require('fs'), path = require('path'), { spawn, execSync } = require('child_process'), os = require('os');
const root = path.join(__dirname, '..'), ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) process.exitCode = 1; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbres-')), KEY = 'test-admin-key-0123456789';
fs.copyFileSync(path.join(root, 'server/api.php'), path.join(work, 'api.php'));
fs.writeFileSync(path.join(work, 'config.php'), `<?php return ['db' => __DIR__ . '/data/kb.sqlite', 'origins' => ['*'], 'test' => true, 'admin_key' => '${KEY}'];`);
fs.mkdirSync(path.join(work, 'data'), { recursive: true });
try { execSync('pkill -f "php -S localhost:8098"'); } catch (e) { }
const php = spawn('php', ['-S', 'localhost:8098', '-t', work], { stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms)), API = 'http://localhost:8098/api.php';
const call = async (a, body) => (await fetch(API + '?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })).json();
(async () => {
  await wait(800);
  // AI研究員：★1〜5とシャドー（推定実力は4.6でも★1として数える）
  const R = [['pochi', 'ポチ', 1.2], ['tome', 'トメさん', 2.1], ['kakeru', 'カケル', 3.0], ['rin', 'リン', 4.2], ['zero', 'ゼロ', 4.9], ['shadow', 'シャドー', 4.6]];
  for (const [cid, name, rating] of R) { const r = await call('ai_save', { key: KEY, cid, data: { x: '1' }, stats: { name, rating, bp: 100 } }); if (!r.ok) console.log(r); }
  const host = await call('register'), now = () => Math.round(Date.now() / 1000);
  const mk = async (o) => (await call('on_tour_new', Object.assign({ token: host.token, name: 'ホスト', startAt: now() + 600, limit: 3, max: 20, aiFill: true, sets: 1, games: 1, finalists: 0 }, o))).tour;
  const start = async (t) => { await call('on_tour_act', { token: host.token, id: t.id, act: 'entry', name: 'ホスト', pid: 'p0' }); await call('on_tour_act', { token: host.token, id: t.id, act: 'startnow' }); return (await call('on_tour', { token: host.token, id: t.id })).tour; };
  const resIn = t => (t.stand || []).filter(r => r.ai && r.char).map(r => r.char);
  // 1) 初心者多め：★1〜3の研究員とシャドーだけ
  const t1 = await start(await mk({ tname: '初心者杯', min: 9, aiMix: 'casual' }));
  const c1 = resIn(t1);
  ok(t1.aiRes === true && c1.length === 4 && ['pochi', 'tome', 'kakeru', 'shadow'].every(x => c1.includes(x)), '誰でもの大会は研究員を呼ぶ（初心者多め＝★1〜3とシャドー）：' + c1.join(','));
  ok(t1.podAi === true, '表彰台はAIを含む（はじめ）');
  // 2) 招待だけの大会：はじめは呼ばない
  const t2 = await start(await mk({ tname: '身内杯', min: 6, aiMix: 'even', entry: 'invite', invites: ['ホスト'] }));
  ok(t2.aiRes === false && resIn(t2).length === 0, '招待だけの大会は、はじめは研究員を呼ばない');
  // 3) 打っている研究員は、ほかの大会に来ない
  const t3 = await start(await mk({ tname: '強豪杯', min: 6, aiMix: 'strong' }));
  const c3 = resIn(t3);
  ok(!c3.some(x => c1.includes(x)) && c3.every(x => ['rin', 'zero'].includes(x)), '別の大会で打っている研究員は来ない・強豪ぞろい＝★3〜5：' + c3.join(','));
  // 4) シャドーの席は卓の最強の★
  const rooms = JSON.parse(execSync(`php -r '$d=new PDO("sqlite:${work}/data/kb.sqlite"); echo json_encode($d->query("SELECT st FROM rooms WHERE host=\\"tour:${t1.id}\\"")->fetchAll(PDO::FETCH_COLUMN));'`).toString()).map(x => JSON.parse(x));
  const sh = []; rooms.forEach(r => { const ss = r.seats || []; ss.forEach(s => { if (s.char === 'shadow') sh.push({ lv: s.lv, mx: Math.max(1, ...ss.filter(o => o.ai && o.char !== 'shadow').map(o => +o.lv)) }); }); });
  ok(sh.length === 1 && sh[0].lv === sh[0].mx, 'シャドーの席は、その卓でいちばん強いAIの★で打つ：' + JSON.stringify(sh));
  // 5) 表彰台：人10人＋全員達人のAI。含む／人だけ を比べる
  const both = [];
  for (const podAi of [true, false]) {
    const h2 = await call('register'); const t = (await call('on_tour_new', { token: h2.token, name: 'ホスト' + podAi, startAt: now() + 600, limit: 3, max: 20, aiFill: true, sets: 1, games: 1, finalists: 0, tname: podAi ? '含む杯' : '人だけ杯', min: 14, aiMix: 'master', aiRes: false, podAi })).tour;
    await call('on_tour_act', { token: h2.token, id: t.id, act: 'entry', name: 'ホスト' + (podAi ? 'A' : 'B'), pid: 'p0' });
    for (let i = 0; i < 9; i++) { const r = await call('register'); await call('on_tour_act', { token: r.token, id: t.id, act: 'entry', name: (podAi ? 'A' : 'B') + i, pid: 'p' + i }); }
    await call('on_tour_act', { token: h2.token, id: t.id, act: 'startnow' }); both.push(t.id);
  }
  const t0 = Date.now(); let fin = [];
  while (Date.now() - t0 < 300000) { fin = await Promise.all(both.map(async id => (await call('on_tour', { token: host.token, id })).tour)); if (fin.every(t => t.phase === 'done')) break; await wait(1500); }
  ok(fin.every(t => t.phase === 'done'), '2つの大会が最後まで進む');
  const [ta, tb] = fin, humanTop = t => t.stand.filter(r => !r.ai).slice(0, 3).map(r => r.name), placeOf = (t, n) => t.stand.findIndex(r => r.name === n) + 1;
  ok(ta.awards.every(a => placeOf(ta, a.name) === a.place) && ta.awards.length <= 3, 'AIを含む：人の順位はAIも数えた順位のまま：' + ta.awards.map(a => a.place + '位' + a.name).join('、') + '（AIが上位に' + ta.stand.slice(0, 3).filter(r => r.ai).length + '人）');
  ok(tb.awards.length === 3 && tb.awards.map(a => a.place).join() === '1,2,3' && tb.awards.map(a => a.name).join() === humanTop(tb).join(), '人だけ：AIを飛ばして人の1〜3位：' + tb.awards.map(a => a.place + '位' + a.name).join('、'));
  php.kill();
})();
