// Xへの投稿の文（サーバー）：大会の案内・結果（公式は目立つ・結果ページへのリンク）・毎朝のデイリーのまとめ・シーズン・ランキングの1位交代・文字数・1日の上限
// 使い方：cd test && node xpost.js（php が必要。api.php の関数だけを読み込んで直接呼ぶ）
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const root = path.join(__dirname, '..'); let fail = 0; const ok = (c, m) => { console.log((c ? 'OK  ' : 'NG  ') + m); if (!c) fail++; };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'kbx-'));
const src = fs.readFileSync(path.join(root, 'server/api.php'), 'utf8');
fs.writeFileSync(path.join(work, 'lib.php'), src.slice(0, src.indexOf("$a = $_GET['a'] ?? '';")).replace(/^header\(.*$/mg, '').replace("if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }", ''));
fs.writeFileSync(path.join(work, 'config.php'), "<?php return ['db' => __DIR__ . '/kb.sqlite', 'origins' => [], 'test' => true];");
const php = code => execFileSync('php', ['-r', `require '${work}/lib.php'; ${code}`], { encoding: 'utf8' });
const q = () => JSON.parse(php("echo json_encode(db()->query('SELECT tag, kind, pri, text FROM xq ORDER BY id')->fetchAll(), JSON_UNESCAPED_UNICODE);"));
const now = Math.floor(Date.now() / 1000);
// 1. 大会をひらいた：誰でもの大会は案内、招待だけ・テストは出さない。公式は目立つ見出しと高い優先度
php(`xTourNew(['id' => 'ABCD1234', 'cfg' => ['name' => '研究所カップ', 'startAt' => ${now + 86400}, 'entry' => 'open', 'sets' => 3, 'games' => 5, 'finalists' => 5, 'official' => false]]);
xTourNew(['id' => 'OFFI0001', 'cfg' => ['name' => '第1回 公式大会', 'startAt' => ${now + 3600 * 30}, 'entry' => 'open', 'sets' => 3, 'games' => 5, 'finalists' => 5, 'official' => true]]);
xTourNew(['id' => 'INVT0001', 'cfg' => ['name' => '家族大会', 'startAt' => ${now + 3600}, 'entry' => 'invite', 'sets' => 2, 'games' => 3, 'official' => false]]);`);
let L = q();
const n1 = L.find(x => x.tag === 'new:ABCD1234'), o1 = L.find(x => x.tag === 'new:OFFI0001');
ok(n1 && /オンライン大会のお知らせ/.test(n1.text) && /#t=ABCD1234/.test(n1.text) && /#計算ブリッジ/.test(n1.text), '大会の案内（リンク #t=大会のID・タグ）\n' + (n1 && n1.text));
ok(o1 && /公式大会 開催決定/.test(o1.text) && o1.pri > n1.pri, '公式大会は目立つ見出し・先に投稿\n' + (o1 && o1.text));
ok(!L.some(x => x.tag === 'new:INVT0001'), '招待だけの大会は投稿しない');
// 2. 大会の結果：上位3人（ランキングに出していない人は「研究員さん」・AI研究員の印）と結果ページへのリンク
php(`db()->prepare("INSERT INTO ranks (uid, pid, name, shown, updated) VALUES ('u1', 'p1', 'ケン', 1, 1), ('u2', 'p2', 'ヒミツ', 0, 1)")->execute();
$t = ['id' => 'OFFI0001', 'cfg' => ['name' => '第1回 公式大会', 'entry' => 'open', 'official' => true], 'entrants' => [['uid' => 'u1', 'pid' => 'p1', 'name' => 'ケン'], ['uid' => 'u2', 'pid' => 'p2', 'name' => 'ヒミツ']],
 'players' => [['key' => 'u:u1', 'uid' => 'u1', 'pid' => 'p1', 'name' => 'ケン'], ['key' => 'u:u2', 'uid' => 'u2', 'pid' => 'p2', 'name' => 'ヒミツ'], ['key' => 'ai:0', 'ai' => true, 'name' => 'ロボ太（AI★3）'], ['key' => 'r:zero', 'char' => 'zero', 'name' => 'ゼロ']],
 'result' => ['r:zero', 'u:u1', 'u:u2', 'ai:0']]; xTourDone($t);
$t2 = ['id' => 'SOLO0001', 'cfg' => ['name' => 'ひとり大会', 'entry' => 'open'], 'entrants' => [['uid' => 'u1', 'pid' => 'p1', 'name' => 'ケン']], 'players' => [], 'result' => []]; xTourDone($t2);`);
L = q(); const d1 = L.find(x => x.tag === 'done:OFFI0001');
ok(d1 && /公式大会 結果/.test(d1.text) && /🥇 ゼロ（AI研究員）/.test(d1.text) && /🥈 ケン/.test(d1.text) && /🥉 研究員さん/.test(d1.text) && /#t=OFFI0001/.test(d1.text), '大会の結果（上位3人・ランキングに出さない人は伏せる・結果ページへのリンク）\n' + (d1 && d1.text));
ok(!L.some(x => x.tag === 'done:SOLO0001'), '人が1人だけのふつうの大会は投稿しない');
// 3. 毎朝のまとめ：きのうのデイリーの各部の優勝者（時刻の順）
const y = new Date(Date.now() + 9 * 3600e3 - 86400e3), ymd = y.toISOString().slice(2, 10).replace(/-/g, '');
php(`foreach ([5 => 'u:u1', 1 => 'r:zero', 3 => 'ai:0'] as $pt => $w) { $t = ['id' => 'D${ymd}' . $pt, 'phase' => 'done', 'cfg' => ['daily' => 1, 'part' => $pt], 'players' => [['key' => 'u:u1', 'uid' => 'u1', 'pid' => 'p1', 'name' => 'ケン'], ['key' => 'r:zero', 'char' => 'zero', 'name' => 'ゼロ'], ['key' => 'ai:0', 'ai' => true, 'name' => 'ロボ太']], 'result' => [$w]];
 db()->prepare('INSERT INTO tours (id, host, st, ver, start_at, updated, created) VALUES (?, ?, ?, 1, 0, 0, 0)')->execute([$t['id'], 'system', json_encode($t, JSON_UNESCAPED_UNICODE)]); }
$h = (int)(new DateTime('now', jstTz()))->format('G'); if ($h >= DAILY_HOUR) xDailyReport(); else echo 'early';`);
L = q(); const dr = L.find(x => x.kind === 'daily');
if (dr) ok(/デイリー優勝者/.test(dr.text) && dr.text.indexOf('6:30 ケン') >= 0 && dr.text.indexOf('6:30') < dr.text.indexOf('17:30 ゼロ') && /19:30 AI/.test(dr.text), '毎朝のまとめ（各部の優勝者・時刻の順・朝晩の案内）\n' + dr.text);
else console.log('--  毎朝のまとめは日本時間6時より前なので確かめない');
// 4. ランキングの1位交代：はじめは控えるだけ、入れ替わったら1回
php(`db()->prepare("UPDATE ranks SET rating = 3.5, bp = 500 WHERE uid = 'u1'")->execute(); xRankTops();
db()->prepare("INSERT INTO ranks (uid, pid, name, shown, rating, bp, updated, ai) VALUES ('ai', 'zero', 'ゼロ', 1, 4.2, 900, 2, 1)")->execute(); xRankTops(); xRankTops();`);
L = q(); const rk = L.filter(x => x.kind === 'rank');
ok(rk.length >= 1 && rk.length === 1 && /1位交代/.test(rk[0].text) && /推定実力：ゼロ（AI研究員） が ケン を抜いた（★4.2）/.test(rk[0].text), 'ランキングの1位交代（同時に変わった部門は1つの投稿・1日1回まで）\n' + rk.map(x => x.text).join('\n---\n'));
// 5. シーズン
php(`xSeason('2026-11a', [['name' => 'ケン', 'pts' => 120, 'ai' => false], ['name' => 'ゼロ', 'pts' => 100, 'ai' => true]], 9);`);
L = q(); const se = L.find(x => x.kind === 'season');
ok(se && /11月前半シーズン 最終結果/.test(se.text) && /🥇 ケン 120pt/.test(se.text), 'シーズンの結果\n' + (se && se.text));
// 6. 文字数（Xは日本語2・URL23で280まで）と1日の上限
const lens = JSON.parse(php("echo json_encode(array_map(fn($r) => xLen($r['text']), db()->query('SELECT text FROM xq')->fetchAll()));"));
ok(lens.every(n => n <= 280), '文字数はどれも280以内（' + lens.join('・') + '）');
const long = php(`xPush('long', 'test', array_merge(['見出し'], array_fill(0, 30, 'とても長い行がここに入ります')), 0); echo xLen(db()->query("SELECT text FROM xq WHERE tag = 'long'")->fetchColumn());`);
ok(+long <= 280, '長すぎる文は行を削って280以内（' + long + '）');
fs.rmSync(work, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
