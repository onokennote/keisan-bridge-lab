<?php
// 計算ブリッジ作戦研究所（非公式ファン制作）クラウド保存・ランキングAPI
// さくらのレンタルサーバーなど、PHP 8 ＋ SQLite が使える場所に置く。設定は同じフォルダの config.php（config.sample.php を参照）
declare(strict_types=1);
$CFG = ['db' => __DIR__ . '/../kb_data/kb.sqlite', 'origins' => ['https://keisan-bridge.lolipop-now.app'], 'max_data' => 3 * 1024 * 1024];
if (is_file(__DIR__ . '/config.php')) $CFG = array_merge($CFG, require __DIR__ . '/config.php');

// ---- CORS（公開版のサイトからだけ使えるようにする）----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $CFG['origins'], true)) {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Vary: Origin');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');
  header('Access-Control-Max-Age: 86400');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out($x, int $code = 200): void { http_response_code($code); echo json_encode($x, JSON_UNESCAPED_UNICODE); exit; }
function fail(string $msg, int $code = 400): void { out(['ok' => false, 'error' => $msg], $code); }

// ---- DB（SQLite。初回に表を作る）----
function db(): PDO {
  static $pdo = null; global $CFG;
  if ($pdo) return $pdo;
  $dir = dirname($CFG['db']); if (!is_dir($dir)) @mkdir($dir, 0700, true);
  $pdo = new PDO('sqlite:' . $CFG['db'], null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
  $pdo->exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=4000;');
  $pdo->exec('CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, token_hash TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE, created INTEGER NOT NULL, data TEXT, data_at INTEGER DEFAULT 0, seen INTEGER DEFAULT 0)');
  $pdo->exec('CREATE TABLE IF NOT EXISTS ranks (uid TEXT NOT NULL, pid TEXT NOT NULL, name TEXT NOT NULL, shown INTEGER NOT NULL DEFAULT 1, rating REAL, badges INTEGER DEFAULT 0, bp INTEGER DEFAULT 0, atk INTEGER DEFAULT 0, avatar TEXT, updated INTEGER NOT NULL, PRIMARY KEY (uid, pid))');
  $pdo->exec('CREATE TABLE IF NOT EXISTS tokens (token_hash TEXT PRIMARY KEY, uid TEXT NOT NULL, created INTEGER NOT NULL)'); // 端末ごとの鍵（複数の端末で同時に使える）
  $pdo->exec('CREATE TABLE IF NOT EXISTS hits (ip TEXT NOT NULL, at INTEGER NOT NULL)');
  // あとから足した列（自己紹介・成績カード）
  $cols = array_column($pdo->query('PRAGMA table_info(ranks)')->fetchAll(), 'name');
  if (!in_array('bio', $cols, true)) $pdo->exec('ALTER TABLE ranks ADD COLUMN bio TEXT');
  if (!in_array('card', $cols, true)) $pdo->exec('ALTER TABLE ranks ADD COLUMN card TEXT');
  if (!in_array('streak', $cols, true)) $pdo->exec('ALTER TABLE ranks ADD COLUMN streak INTEGER DEFAULT 0');
  if (!in_array('ai', $cols, true)) $pdo->exec('ALTER TABLE ranks ADD COLUMN ai INTEGER DEFAULT 0'); // AI研究員（倶楽部のキャラ）
  // プレイヤーごとの記録と引き継ぎコード（端末まるごとではなく、プレイヤー単位で別の端末に入れる）
  $pdo->exec('CREATE TABLE IF NOT EXISTS players (uid TEXT NOT NULL, pid TEXT NOT NULL, code_hash TEXT NOT NULL UNIQUE, code TEXT NOT NULL, data TEXT, data_at INTEGER DEFAULT 0, PRIMARY KEY (uid, pid))');
  // プレイヤーの鍵：pid の入った鍵は、そのプレイヤーの記録だけを読み書きできる（引き継ぎコードで別の端末に入れたプレイヤー用）
  $tc = array_column($pdo->query('PRAGMA table_info(tokens)')->fetchAll(), 'name');
  if (!in_array('pid', $tc, true)) $pdo->exec('ALTER TABLE tokens ADD COLUMN pid TEXT');
  $pdo->exec('CREATE TABLE IF NOT EXISTS ai_data (cid TEXT PRIMARY KEY, data TEXT, updated INTEGER NOT NULL)'); // AI研究員の記録（毎日の自動対局で育てる）
  $pdo->exec('CREATE TABLE IF NOT EXISTS tours (id TEXT PRIMARY KEY, host TEXT NOT NULL, st TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 1, start_at INTEGER NOT NULL, updated INTEGER NOT NULL, created INTEGER NOT NULL)'); // オンライン大会
  $pdo->exec('CREATE TABLE IF NOT EXISTS awards (uid TEXT NOT NULL, pid TEXT NOT NULL, tid TEXT NOT NULL, tname TEXT NOT NULL, place INTEGER NOT NULL, official INTEGER NOT NULL DEFAULT 0, at INTEGER NOT NULL, PRIMARY KEY (uid, pid, tid))'); // オンライン大会の上位3位（人が10人以上の大会だけ）
  $pdo->exec('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, host TEXT NOT NULL, st TEXT NOT NULL, ver INTEGER NOT NULL DEFAULT 1, updated INTEGER NOT NULL, created INTEGER NOT NULL)'); // オンライン対局の卓（山札・手札はサーバーだけが持つ）
  return $pdo;
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 見まちがえやすい I・O・0・1 は使わない
function newCode(): string { $s = ''; for ($i = 0; $i < 12; $i++) $s .= CODE_CHARS[random_int(0, strlen(CODE_CHARS) - 1)]; return implode('-', str_split($s, 4)); }
function normCode(string $c): string { $c = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', mb_convert_kana($c, 'a'))); return implode('-', str_split($c, 4)); }
function h(string $s): string { return hash('sha256', $s); }
function body(): array { global $CFG; $raw = file_get_contents('php://input', false, null, 0, $CFG['max_data'] + 4096); $j = json_decode($raw ?: '{}', true); return is_array($j) ? $j : []; }
function authUser(array $b): array {
  $t = (string)($b['token'] ?? ''); if (strlen($t) < 32) fail('ログインが必要です', 401);
  $st = db()->prepare('SELECT u.*, t.pid AS tpid FROM tokens t JOIN users u ON u.uid = t.uid WHERE t.token_hash = ?'); $st->execute([h($t)]); $u = $st->fetch();
  if (!$u) fail('ログインが切れました', 401);
  $GLOBALS['tokenPid'] = (string)($u['tpid'] ?? ''); // プレイヤーの鍵なら、そのプレイヤーとしてだけ動く
  return $u;
}
function cleanPid($p): string { return substr(preg_replace('/[^a-z0-9]/i', '', (string)$p), 0, 24); }
// 記録を読み書きするプレイヤー：プレイヤーの鍵ならそのプレイヤーだけ、端末の鍵ならその端末で作ったプレイヤー
function playerPid(array $u, array $b): string {
  $p = cleanPid($b['pid'] ?? ''); $tp = (string)($u['tpid'] ?? '');
  if ($tp !== '') { if ($p !== '' && $p !== $tp) fail('このプレイヤーの鍵ではありません', 403); return $tp; }
  if ($p === '') fail('プレイヤーがありません');
  return $p;
}
// ランキングの行を書く（プレイヤー1人分）。ズルを厳密には防がないが、ありえない値ははじく
function rankUpsert(PDO $d, string $uid, string $pid, array $s): void {
  $rating = isset($s['rating']) && is_numeric($s['rating']) ? max(0, min(6, (float)$s['rating'])) : null;
  $badges = max(0, min(500, (int)($s['badges'] ?? 0))); $bp = max(0, min(20000, (int)($s['bp'] ?? 0))); $atk = max(0, min(5000, (int)($s['atk'] ?? 0))); $streak = max(0, min(2000, (int)($s['streak'] ?? 0)));
  $av = isset($s['avatar']) ? substr(json_encode($s['avatar'], JSON_UNESCAPED_UNICODE), 0, 1500) : null;
  // 名前を新しく付ける・変えるときに、ほかの人がもう使っていれば「研究員○○」にする（前から同じ名前なら、そのまま）
  $want = safeName((string)($s['name'] ?? ''), $uid, $pid);
  $cs = $d->prepare('SELECT name FROM ranks WHERE uid = ? AND pid = ?'); $cs->execute([$uid, $pid]); $cur = $cs->fetch();
  if ((!$cur || $cur['name'] !== $want) && strpos($want, '研究員') !== 0 && nameTaken($want, $uid, $pid)) $want = '研究員' . strtoupper(substr(h($uid . $pid), 0, 3));
  $d->prepare('INSERT INTO ranks (uid, pid, name, shown, rating, badges, bp, atk, avatar, bio, card, streak, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid, pid) DO UPDATE SET name=excluded.name, shown=excluded.shown, rating=excluded.rating, badges=excluded.badges, bp=excluded.bp, atk=excluded.atk, avatar=excluded.avatar, bio=excluded.bio, card=excluded.card, streak=excluded.streak, updated=excluded.updated')
    ->execute([$uid, $pid, $want, empty($s['hide']) ? 1 : 0, $rating, $badges, $bp, $atk, $av, safeBio((string)($s['bio'] ?? '')), safeCard($s['card'] ?? null), $streak, time()]);
}
// 同じ場所からの新規作成が多すぎるときは止める（1時間に30件まで）
function rateLimit(string $what, int $max): void {
  $ip = $_SERVER['REMOTE_ADDR'] ?? '?'; $now = time(); $d = db();
  $d->prepare('DELETE FROM hits WHERE at < ?')->execute([$now - 3600]);
  $st = $d->prepare('SELECT COUNT(*) c FROM hits WHERE ip = ?'); $st->execute([$what . ':' . $ip]);
  if ((int)$st->fetch()['c'] >= $max) fail('しばらく待ってからもう一度どうぞ', 429);
  $d->prepare('INSERT INTO hits (ip, at) VALUES (?, ?)')->execute([$what . ':' . $ip, $now]);
}

// ---- 名前のチェック（NGワード）。引っかかった名前はランキングでは「研究員○○」と表示する ----
const NG = ['死ね','しね','ころす','殺す','殺','きもい','キモい','うざい','ばか','バカ','馬鹿','あほ','アホ','くそ','クソ','糞','ちんこ','ちんちん','まんこ','おっぱい','セックス','せっくす','エロ','えろ','sex','fuck','shit','bitch','dick','pussy','nigger','penis','porn','ちくび','うんこ','うんち','しっこ','ブス','ぶす','デブ','でぶ','ガイジ','がいじ','池沼','かたわ','めくら','つんぼ','きちがい','キチガイ','基地外','レイプ','れいぷ','自殺','じさつ','覚醒剤','麻薬','ヒトラー','ナチス','やくざ','ヤクザ','暴力団'];
function normName(string $s): string {
  $s = mb_convert_kana($s, 'asKVC'); // 全角英数→半角、半角カナ→全角、ひらがな→カタカナ
  $s = mb_strtolower($s);
  return preg_replace('/[\s\p{P}\p{S}ー〜・]+/u', '', $s);
}
function nameOk(string $s): bool {
  if (preg_match('/(https?:|www\.|\.com|\.jp|@|\d{4,})/i', $s)) return false; // URL・連絡先・電話番号らしいもの
  $n = normName($s);
  foreach (NG as $w) { $x = normName($w); if ($x !== '' && mb_strpos($n, $x) !== false) return false; }
  return true;
}
// 自己紹介（140文字まで）。URL・連絡先・NGワードが入っていたら載せない
function safeBio(string $s): string {
  $s = trim(mb_substr(preg_replace('/[\x00-\x09\x0B-\x1F\x7F<>]/u', '', $s), 0, 140));
  return ($s !== '' && nameOk($s)) ? $s : '';
}
// 成績カード（ランキングでアイコンを押すと見られる）。決まった項目だけを、ありえない値ははじいて残す
function safeCard($c): ?string {
  if (!is_array($c)) return null;
  $ach = array_values(array_slice(array_filter((array)($c['ach'] ?? []), fn($k) => is_string($k) && preg_match('/^[a-z0-9_]{1,40}:\d{1,3}$/i', $k)), 0, 400));
  $n = fn($k, $max) => max(0, min($max, (int)($c[$k] ?? 0)));
  $title = preg_replace('/[^0-9A-Z]/', '', (string)($c['title'] ?? ''));
  return json_encode(['title' => substr($title, 0, 12), 'ach' => $ach, 'champion' => $n('champion', 100000), 'qualify' => $n('qualify', 100000), 'atkBadges' => $n('atkBadges', 500), 'hunt' => $n('hunt', 5000), 'zukan' => $n('zukan', 5000), 'streak' => $n('streak', 100000), 'outs5' => $n('outs5', 100000)], JSON_UNESCAPED_UNICODE);
}
// 名前の重複：ほかのプレイヤー（別の端末・別の人）がもう使っている名前か（全角半角・大文字小文字・記号の違いは同じとみなす）
function nameTaken(string $name, string $uid, string $pid): bool {
  $n = normName($name); if ($n === '') return false;
  $st = db()->prepare('SELECT uid, pid, name FROM ranks'); $st->execute();
  foreach ($st->fetchAll() as $r) { if ($r['uid'] === $uid && $r['pid'] === $pid) continue; if (normName((string)$r['name']) === $n) return true; }
  return false;
}
// AI研究員を動かすための鍵（GitHub Actions だけが持つ）。データベースと同じ、公開フォルダの外の admin_key.txt に置く
function adminOk(array $b): void {
  global $CFG; $f = dirname($CFG['db']) . '/admin_key.txt'; $k = $CFG['admin_key'] ?? (is_file($f) ? trim((string)file_get_contents($f)) : '');
  if (strlen($k) < 16 || !hash_equals($k, (string)($b['key'] ?? ''))) fail('権限がありません', 403);
}
function rid(string $uid, string $pid): string { return substr(h('rid:' . $uid . ':' . $pid), 0, 16); } // ランキングで人を指す公開用の番号
function safeName(string $s, string $uid, string $pid): string {
  $s = trim(mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u', '', $s), 0, 10));
  return ($s !== '' && nameOk($s)) ? $s : '研究員' . strtoupper(substr(h($uid . $pid), 0, 3));
}


// ================= オンライン対局（サーバーがカードを管理する。各自には自分の手札だけを送る） =================
// 式の判定：1〜3枚を四則（＋かっこ）で組み合わせ、場の数（1〜13）にできるか。割り算は割り切れるときだけ。アプリの engine.js と同じ決まり
function obComb(array $x, array $y, string $op): ?array {
  if ($op === '+') $v = $x[0] + $y[0]; elseif ($op === '-') $v = $x[0] - $y[0]; elseif ($op === '*') $v = $x[0] * $y[0];
  else { if ($y[0] === 0 || $x[0] % $y[0] !== 0) return null; $v = intdiv($x[0], $y[0]); }
  $p = ($op === '+' || $op === '-') ? 1 : 2;
  $ls = $x[2] < $p ? '(' . $x[1] . ')' : $x[1];
  $rs = ($y[2] < $p || ($y[2] === $p && ($op === '-' || $op === '/'))) ? '(' . $y[1] . ')' : $y[1];
  $sym = ['+' => '+', '-' => '−', '*' => '×', '/' => '÷'][$op];
  return [$v, $ls . ' ' . $sym . ' ' . $rs, $p];
}
function obAll(array $nodes): array {
  if (count($nodes) === 1) return [$nodes[0]];
  $out = []; $n = count($nodes);
  for ($i = 0; $i < $n; $i++) for ($j = 0; $j < $n; $j++) {
    if ($i === $j) continue;
    $rest = []; for ($k = 0; $k < $n; $k++) if ($k !== $i && $k !== $j) $rest[] = $nodes[$k];
    foreach (['+', '-', '*', '/'] as $op) {
      if (($op === '+' || $op === '*') && $i > $j) continue;
      $c = obComb($nodes[$i], $nodes[$j], $op); if (!$c) continue;
      foreach (obAll(array_merge([$c], $rest)) as $r) $out[] = $r;
    }
  }
  return $out;
}
// vals（札の数の並び）で作れる場の数ごとの、いちばん短い式
function obExprs(array $vals): array {
  static $memo = []; sort($vals); $key = implode(',', $vals);
  if (isset($memo[$key])) return $memo[$key];
  $best = [];
  foreach (obAll(array_map(fn($v) => [$v, (string)$v, 3], $vals)) as $r) { if ($r[0] < 1 || $r[0] > 13) continue; if (!isset($best[$r[0]]) || strlen($r[1]) < strlen($best[$r[0]])) $best[$r[0]] = $r[1]; }
  return $memo[$key] = $best;
}
// 手札から場 t を作れる手の一覧（同じ数の組は1つにまとめる）
function obMoves(array $handVals, int $t): array {
  $n = count($handVals); $seen = []; $out = [];
  $try = function (array $vals) use (&$seen, &$out, $t) {
    sort($vals); $k = implode(',', $vals); if (isset($seen[$k])) return; $seen[$k] = 1;
    $e = obExprs($vals); if (!isset($e[$t])) return;
    $x = $e[$t]; $cls = preg_match('/[()]/', $x) ? 4 : (str_contains($x, '÷') ? 3 : (str_contains($x, '×') ? 2 : (count($vals) === 3 ? 1 : 0)));
    $out[] = ['vals' => $vals, 'expr' => $x, 'n' => count($vals), 'sum' => array_sum($vals), 'cls' => $cls];
  };
  for ($i = 0; $i < $n; $i++) { $try([$handVals[$i]]); for ($j = $i + 1; $j < $n; $j++) { $try([$handVals[$i], $handVals[$j]]); for ($k = $j + 1; $k < $n; $k++) $try([$handVals[$i], $handVals[$j], $handVals[$k]]); } }
  return $out;
}
function obGauss(): float { $u = 0; $v = 0; while (!$u) $u = mt_rand() / mt_getrandmax(); while (!$v) $v = mt_rand() / mt_getrandmax(); return sqrt(-2 * log($u)) * cos(2 * M_PI * $v); }
// AIの手（アプリの★1〜3と同じ考え方）。★1は気づく組み合わせが少なく適当に選ぶ、★2は点の高い3手から選ぶ、★3は一番点の高い手
function obAi(array $handVals, int $t, int $lv = 2): ?array {
  $lv = max(1, min(5, $lv)); $L = [1 => ['see' => [1, 0.55, 0.4, 0.25, 0.2], 'miss' => 0.08], 2 => ['see' => [1, 0.85, 0.7, 0.5, 0.45], 'miss' => 0.04], 3 => ['see' => [1, 1, 1, 1, 1], 'miss' => 0.03], 4 => ['see' => [1, 1, 1, 1, 1], 'miss' => 0], 5 => ['see' => [1, 1, 1, 1, 1], 'miss' => 0]][$lv];
  $see = $L['see']; $r = fn() => mt_rand() / mt_getrandmax();
  $ms = array_values(array_filter(obMoves($handVals, $t), fn($m) => $r() < $see[$m['cls']]));
  if (!$ms || $r() < $L['miss']) return null;
  if ($lv <= 1) { foreach ($ms as $m) if ($m['n'] === count($handVals)) return $m; return $ms[mt_rand(0, count($ms) - 1)]; }
  foreach ($ms as $m) if ($m['n'] === count($handVals)) return $m;
  $sc = [];
  foreach ($ms as $m) {
    $rest = $handVals; foreach ($m['vals'] as $v) { $i = array_search($v, $rest, true); array_splice($rest, $i, 1); }
    $small = count(array_filter($rest, fn($v) => $v <= 3)); $high = count(array_filter($m['vals'], fn($v) => $v >= 11));
    $flex = 0; if ($lv >= 4 && $rest) { $reach = []; $nr = count($rest); for ($a = 0; $a < $nr; $a++) { $reach += obExprs([$rest[$a]]); for ($b2 = $a + 1; $b2 < $nr; $b2++) { $reach += obExprs([$rest[$a], $rest[$b2]]); for ($c2 = $b2 + 1; $c2 < $nr; $c2++) $reach += obExprs([$rest[$a], $rest[$b2], $rest[$c2]]); } } $flex = count($reach) / 13 * ($lv >= 5 ? 14 : 9); } // ★4：次の場で出せる形を残す
    $sc[] = [$m, 14 * $m['n'] + 1.2 * $m['sum'] + 1.6 * min($small, 3) + 0.6 * $high + $flex + ($lv >= 5 ? 0 : obGauss() * 0.3 * ($lv === 2 ? 3 : 1))];
  }
  usort($sc, fn($a, $b) => $b[1] <=> $a[1]);
  return $lv === 2 ? $sc[mt_rand(0, min(3, count($sc)) - 1)][0] : $sc[0][0];
}
function obAi2(array $handVals, int $t): ?array { return obAi($handVals, $t, 2); }
const OB_LIMITS = [60, 30, 15, 10];
const OB_AI_NAMES = ['ロボ太', 'ピコ', 'メカ子', 'ボルト'];
function obDeck(): array { $d = []; for ($s = 0; $s < 4; $s++) for ($v = 1; $v <= 13; $v++) $d[] = [$v, $s]; shuffle($d); return $d; }
function obSortHand(array &$h): void { usort($h, fn($a, $b) => $a[0] <=> $b[0] ?: $a[1] <=> $b[1]); }
function obDraw(array &$g): ?array {
  if (!$g['deck']) { if (!$g['discard']) return null; $g['deck'] = $g['discard']; shuffle($g['deck']); $g['discard'] = [];
    foreach ($g['played'] as &$pl) foreach ($pl as &$x) $x['ret'] = true; unset($pl, $x); // 切り直しで山札に戻った札
    $g['fields'] = $g['field'] ? [$g['field']] : []; $g['reshuffled'] = true; $g['log'][] = ['i' => $g['seq'] = ($g['seq'] ?? 0) + 1] + ['type' => 'reshuffle', 'round' => $g['round']]; }
  return array_pop($g['deck']);
}
function obNextRound(array &$g): void {
  if ($g['field']) $g['discard'][] = $g['field'];
  $g['round']++;
  if ($g['round'] > 80) { obFinish($g, -1); return; }
  $f = obDraw($g); if (!$f) { obFinish($g, -1); return; }
  $g['field'] = $f; $g['pos'] = 0; $g['fields'][] = $f; // これまでの場札（切り直しまで）
  $g['log'][] = ['i' => $g['seq'] = ($g['seq'] ?? 0) + 1] + ['type' => 'field', 'round' => $g['round'], 'v' => $f[0], 's' => $f[1]];
}
function obFinish(array &$g, int $w): void {
  $g['over'] = true; $g['winner'] = $w;
  $g['pp'] = array_map(fn($h, $i) => $i === $w ? 0 : array_sum(array_column($h, 0)), $g['hands'], array_keys($g['hands']));
  $g['log'][] = ['i' => $g['seq'] = ($g['seq'] ?? 0) + 1] + ['type' => 'end', 'winner' => $w, 'pp' => $g['pp']];
}
function obNewGame(int $n, int $starter): array {
  $g = ['deck' => obDeck(), 'discard' => [], 'hands' => array_fill(0, $n, []), 'field' => null, 'round' => 0, 'pos' => 0, 'over' => false, 'winner' => -1, 'pp' => null, 'played' => array_fill(0, $n, []), 'last' => array_fill(0, $n, null), 'log' => []];
  for ($k = 0; $k < 7; $k++) for ($p = 0; $p < $n; $p++) $g['hands'][$p][] = array_pop($g['deck']);
  foreach ($g['hands'] as &$h) obSortHand($h); unset($h);
  $g['order'] = []; for ($i = 0; $i < $n; $i++) $g['order'][] = ($starter + $i) % $n;
  obNextRound($g);
  return $g;
}
function obCur(array $g): int { return $g['over'] ? -1 : $g['order'][$g['pos']]; }
// 手を進める：$vals が null なら引く。正しくない手は false
function obApply(array &$g, ?array $vals, string $by = ''): bool {
  $p = obCur($g); if ($p < 0) return false;
  $h = &$g['hands'][$p];
  if ($vals !== null) {
    $vals = array_map('intval', $vals); if (!$vals || count($vals) > 3) return false;
    $e = obExprs($vals); if (!isset($e[$g['field'][0]])) return false;
    $tmp = $h; $cards = [];
    foreach ($vals as $v) { $i = -1; foreach ($tmp as $k => $c) if ($c[0] === $v) { $i = $k; break; } if ($i < 0) return false; $cards[] = $tmp[$i]; array_splice($tmp, $i, 1); }
    $h = $tmp; foreach ($cards as $c) $g['discard'][] = $c;
    $x = $e[$g['field'][0]];
    $g['played'][$p][] = ['cards' => $cards, 'expr' => $x, 't' => $g['field'][0], 'round' => $g['round']];
    $g['last'][$p] = ['type' => 'play', 'cards' => $cards, 'expr' => $x, 'by' => $by];
    $g['log'][] = ['i' => $g['seq'] = ($g['seq'] ?? 0) + 1] + ['type' => 'play', 'round' => $g['round'], 'p' => $p, 'vals' => $vals, 'expr' => $x, 't' => $g['field'][0], 'left' => count($h), 'by' => $by];
    if (!$h) { obFinish($g, $p); return true; }
  } else {
    $c = obDraw($g); if ($c) { $h[] = $c; obSortHand($h); }
    $g['last'][$p] = ['type' => 'draw', 'by' => $by];
    $g['log'][] = ['i' => $g['seq'] = ($g['seq'] ?? 0) + 1] + ['type' => 'draw', 'round' => $g['round'], 'p' => $p, 't' => $g['field'][0], 'left' => count($h), 'by' => $by];
  }
  unset($h);
  $g['pos']++; if ($g['pos'] >= count($g['hands'])) obNextRound($g);
  if (count($g['log']) > 60) $g['log'] = array_slice($g['log'], -60);
  return true;
}
// お手つき（出したあとに判定する大会）：出した札は手札に戻し、ペナルティで k 枚引いて番を終える
function obHas(array $hand, array $vals): bool { $tmp = array_column($hand, 0); foreach ($vals as $v) { $i = array_search((int)$v, $tmp, true); if ($i === false) return false; array_splice($tmp, $i, 1); } return true; }
function obFoul(array &$g, array $vals, int $k): void {
  $p = obCur($g); if ($p < 0) return; $h = &$g['hands'][$p]; $got = 0;
  for ($i = 0; $i < $k; $i++) { $c = obDraw($g); if (!$c) break; $h[] = $c; $got++; }
  obSortHand($h); unset($h);
  $g['last'][$p] = ['type' => 'draw', 'foul' => true, 'n' => $got, 'by' => 'me'];
  $g['log'][] = ['i' => $g['seq'] = ($g['seq'] ?? 0) + 1] + ['type' => 'draw', 'foul' => true, 'round' => $g['round'], 'p' => $p, 't' => $g['field'][0], 'vals' => array_map('intval', $vals), 'n' => $got, 'left' => count($g['hands'][$p]), 'by' => 'me'];
  $g['pos']++; if ($g['pos'] >= count($g['hands'])) obNextRound($g);
}
const OB_JUDGE = ['before', 'after3', 'after2'];
// 時間を進める：時間切れは自動で引く（3回続くとAI★2が代わりに打つ）。AIの席は少し間をおいて打つ。ゲームの合間は8秒で次へ
function obTick(array &$st, float $now): bool {
  $ch = false; $guard = 0;
  while ($guard++ < 200) {
    if ($st['phase'] === 'between') {
      if ($now < $st['nextAt']) break;
      if ($st['gameNo'] >= $st['cfg']['games']) { $st['phase'] = 'done'; $ch = true; break; }
      $pp = $st['game']['pp']; $mx = max($pp); $cand = array_keys($pp, $mx); $starter = $cand[array_rand($cand)]; // 前のゲームでPPが一番多かった人が親
      $st['game'] = obNewGame(count($st['seats']), $starter); $st['gameNo']++; $st['phase'] = 'play';
      $st['turnAt'] = $st['nextAt']; $st['deadline'] = $st['turnAt'] + $st['cfg']['limit'] + 3; $ch = true; continue;
    }
    if ($st['phase'] !== 'play') break;
    $g = &$st['game']; $p = obCur($g);
    if ($p < 0) { unset($g); break; }
    $seat = &$st['seats'][$p];
    $auto = !empty($seat['ai']) || ($seat['miss'] ?? 0) >= 3 || !empty($seat['auto']);
    if ($auto) {
      if ($now < $st['turnAt'] + 1.3) { unset($g, $seat); break; }
      $hv = array_column($g['hands'][$p], 0); $m = obAi($hv, $g['field'][0], !empty($seat['ai']) ? (int)($seat['lv'] ?? 2) : (($seat['miss'] ?? 0) < 3 && !empty($seat['auto']) ? (int)($seat['subLv'] ?? 2) : 2)); // 時間切れの代打ちは★2、自分で任せたときは推定実力−1（最低★2）
      obApply($g, $m ? $m['vals'] : null, !empty($seat['ai']) ? 'ai' : 'sub');
      $st['turnAt'] += 1.3;
    } else {
      if ($now < $st['deadline']) { unset($g, $seat); break; }
      obApply($g, null, 'timeout'); $seat['miss'] = ($seat['miss'] ?? 0) + 1;
      $st['turnAt'] = $st['deadline'];
    }
    unset($seat);
    $st['deadline'] = $st['turnAt'] + $st['cfg']['limit'] + ($g['pos'] === 0 ? 3 : 0); // 新しい巡は場をめくる時間を少し足す
    if ($g['over']) { foreach ($g['pp'] as $i => $v) $st['setPP'][$i][] = $v; $st['phase'] = 'between'; $st['nextAt'] = $st['turnAt'] + 8; }
    unset($g); $ch = true;
  }
  return $ch;
}
// 各自に送る形（自分の手札だけ。ほかの人は枚数だけ）
function obView(array $st, string $uid, string $id, int $ver): array {
  $me = -1; foreach ($st['seats'] as $i => $s) if (($s['uid'] ?? '') === $uid) $me = $i;
  $seats = array_map(fn($s) => ['name' => $s['name'], 'avatar' => $s['avatar'] ?? null, 'ai' => !empty($s['ai']), 'lv' => (int)($s['lv'] ?? 2), 'slot' => $s['slot'] ?? null, 'sub' => empty($s['ai']) && (($s['miss'] ?? 0) >= 3 || !empty($s['auto'])), 'subLv' => ($s['miss'] ?? 0) < 3 && !empty($s['auto']) ? (int)($s['subLv'] ?? 2) : 2, 'auto' => !empty($s['auto']), 'miss' => $s['miss'] ?? 0], $st['seats']);
  $v = ['ok' => true, 'id' => $id, 'ver' => $ver, 'phase' => $st['phase'], 'cfg' => $st['cfg'], 'seats' => $seats, 'me' => $me, 'host' => empty($st['tour']) && ($st['seats'][0]['uid'] ?? '') === $uid, 'tour' => $st['tour'] ?? null, 'label' => $st['label'] ?? null, 'chat' => array_slice($st['chat'] ?? [], -12), 'gameNo' => $st['gameNo'], 'setPP' => $st['setPP'], 'now' => microtime(true)];
  if (isset($st['game'])) {
    $g = $st['game'];
    $v['game'] = ['field' => $g['field'], 'round' => $g['round'], 'pos' => $g['pos'], 'order' => $g['order'], 'cur' => obCur($g), 'over' => $g['over'], 'winner' => $g['winner'], 'pp' => $g['pp'],
      'fields' => $g['fields'] ?? [], 'reshuffled' => !empty($g['reshuffled']), 'handN' => array_map('count', $g['hands']), 'deckN' => count($g['deck']), 'discardN' => count($g['discard']), 'played' => $g['played'], 'last' => $g['last'], 'log' => array_slice($g['log'], -20), 'seq' => $g['seq'] ?? 0,
      'hand' => $me >= 0 ? $g['hands'][$me] : null, 'hands' => $g['over'] ? $g['hands'] : null, 'deadline' => $st['deadline'] ?? null, 'nextAt' => $st['nextAt'] ?? null];
  }
  return $v;
}

// ---------- オンライン大会：予選（何セットか・毎セット席替え）→ 決勝（上位の人で1セット）----------
function obTableSizes(int $n, int $max = 5): array { $t = (int)ceil($n / $max); $base = intdiv($n, $t); $extra = $n % $t; $s = []; for ($i = 0; $i < $t; $i++) $s[] = $base + ($i < $extra ? 1 : 0); return $s; }
function obNewRoom(array $seats, array $cfg, string $tid, string $label, float $now): string {
  $d = db(); for ($i = 0; $i < 30; $i++) { $id = ''; for ($k = 0; $k < 6; $k++) $id .= CODE_CHARS[random_int(0, strlen(CODE_CHARS) - 1)]; $q = $d->prepare('SELECT 1 FROM rooms WHERE id = ?'); $q->execute([$id]); if (!$q->fetch()) break; }
  $n = count($seats);
  $st = ['phase' => 'play', 'cfg' => $cfg, 'seats' => $seats, 'gameNo' => 1, 'setPP' => array_fill(0, $n, []), 'tour' => $tid, 'label' => $label, 'game' => obNewGame($n, random_int(0, $n - 1)), 'turnAt' => $now + 4, 'deadline' => $now + 4 + $cfg['limit'] + 3];
  $d->prepare('INSERT INTO rooms (id, host, st, ver, updated, created) VALUES (?, ?, ?, 1, ?, ?)')->execute([$id, 'tour:' . $tid, json_encode($st, JSON_UNESCAPED_UNICODE), time(), time()]);
  return $id;
}
function obPlayerSeat(array $p): array { return !empty($p['ai']) ? ['name' => $p['name'], 'ai' => true, 'lv' => $p['lv'], 'slot' => $p['slot'] ?? null, 'key' => $p['key'], 'miss' => 0] : ['name' => $p['name'], 'avatar' => $p['avatar'] ?? null, 'uid' => $p['uid'], 'key' => $p['key'], 'miss' => 0]; }
// 卓を作って対局を始める（keys の人を席替えして卓に分ける）
function obTourDeal(array &$t, array $keys, string $label, float $now, array $absent = []): void {
  shuffle($keys); $byKey = []; foreach ($t['players'] as $p) $byKey[$p['key']] = $p;
  $t['rooms'] = []; $k = 0; $cfg = ['n' => 5, 'games' => $t['cfg']['games'], 'limit' => $t['cfg']['limit'], 'judge' => $t['cfg']['judge'] ?? 'after3'];
  foreach (obTableSizes(count($keys)) as $ti => $sz) { $seats = []; for ($i = 0; $i < $sz; $i++) { $st0 = obPlayerSeat($byKey[$keys[$k]]); if (in_array($keys[$k], $absent, true)) $st0['miss'] = 3; $seats[] = $st0; $k++; } $t['rooms'][] = obNewRoom($seats, $cfg, $t['id'], $label . (count($keys) > 5 ? '・' . chr(65 + $ti) . '卓' : ''), $now); }
}
function obTourStart(array &$t, float $now): void {
  $c = $t['cfg']; $ent = $t['entrants'];
  if (count($ent) < $c['min'] && empty($c['aiFill'])) { $t['phase'] = 'cancel'; $t['note'] = '参加者が最少人数に届かなかったため中止'; return; }
  $players = array_map(fn($e) => ['key' => 'u:' . $e['uid'], 'uid' => $e['uid'], 'name' => $e['name'], 'avatar' => $e['avatar'] ?? null], $ent);
  $names = ['ロボ太', 'ピコ', 'メカ子', 'ボルト', 'ギア', 'ネジ丸', 'コイル', 'ドット', 'ビット', 'チップ'];
  $slots = []; // 同じ強さのAIに、重ならない番号（画面はこの番号でキャラを割り当てる）
  $cap = OB_AI_CAP; $total = array_sum($cap);
  for ($i = 0; count($players) < max(2, $c['min']); $i++) { $lv = isset($c['aiMix']) ? obMixLv($c['aiMix']) : (int)$c['aiLv'];
    if ($i < $total && ($slots[$lv] ?? -1) + 1 >= $cap[$lv]) foreach ([-1, 1, -2, 2, -3, 3, -4, 4] as $d) { $l2 = $lv + $d; if (isset($cap[$l2]) && ($slots[$l2] ?? -1) + 1 < $cap[$l2]) { $lv = $l2; break; } } // その強さのキャラが足りなければ、近い強さのキャラを混ぜる
    $slot = $slots[$lv] = ($slots[$lv] ?? -1) + 1; $players[] = ['key' => 'ai:' . $i, 'ai' => true, 'lv' => $lv, 'slot' => $slot, 'name' => $names[$i % 10] . ($i >= 10 ? $i : '') . '（AI★' . $lv . '）']; }
  $t['players'] = $players; $t['phase'] = 'prelim'; $t['set'] = 1; $t['stand'] = []; foreach ($players as $p) $t['stand'][$p['key']] = ['pts' => 0, 'pp' => 0];
  obTourDeal($t, array_column($players, 'key'), '予選 第1セット', $now);
}
// 進める：受付の締め切りで開始、卓がぜんぶ終わったら次のセット・決勝・結果へ
function obTourTick(array &$t, float $now): bool {
  $ch = false;
  if ($t['phase'] === 'entry' && $now >= $t['cfg']['startAt']) { obTourStart($t, $now); return true; }
  if (!in_array($t['phase'], ['prelim', 'final'], true)) return false;
  if (!empty($t['wait'])) { // 次のセットの前：出る人が全員「準備OK」を押すか、15分たったら始める（来ていない人はAIが代わりに打つ）
    $w = $t['wait']; $humans = array_values(array_filter($w['keys'], fn($k) => str_starts_with($k, 'u:')));
    $allReady = !array_diff($humans, array_keys($t['ready'] ?? []));
    if (!$allReady && $now < $w['until']) return false;
    $absent = array_values(array_diff($humans, array_keys($t['ready'] ?? [])));
    unset($t['wait']); $t['ready'] = [];
    obTourDeal($t, $w['keys'], $w['label'], $now + 3, $absent); return true;
  }
  $all = true; $res = [];
  foreach ($t['rooms'] as $rid) {
    [$st, $ver] = obLoadRaw($rid); if (!$st) continue;
    if (obTick($st, $now)) { $ver++; obSave($rid, $st, $ver); }
    if ($st['phase'] !== 'done') { $all = false; continue; }
    $res[] = $st;
  }
  if (!$all) return $ch;
  $pts = $t['cfg']['points'];
  if ($t['phase'] === 'prelim') {
    foreach ($res as $st) {
      $tot = array_map(fn($a) => array_sum($a), $st['setPP']);
      foreach ($st['seats'] as $i => $s) { $rank = 1 + count(array_filter($tot, fn($x) => $x < $tot[$i])); $t['stand'][$s['key']]['pts'] += $pts[$rank - 1] ?? 0; $t['stand'][$s['key']]['pp'] += $tot[$i]; }
    }
    $t['hist'][] = ['set' => $t['set'], 'rooms' => $t['rooms']];
    if ($t['set'] < $t['cfg']['sets']) { $t['set']++; obTourWait($t, array_keys($t['stand']), '予選 第' . $t['set'] . 'セット', $now); return true; }
    $order = obTourOrder($t);
    $f = (int)$t['cfg']['finalists'];
    if ($f >= 2 && count($order) > $f) { $t['phase'] = 'final'; $t['finalists'] = array_slice($order, 0, $f); obTourWait($t, $t['finalists'], '決勝', $now); return true; }
    $t['phase'] = 'done'; $t['result'] = $order; obTourAward($t); return true;
  }
  // 決勝：その1セットのPPだけで順位
  $st = $res[0]; $tot = array_map(fn($a) => array_sum($a), $st['setPP']); $keys = array_column($st['seats'], 'key');
  array_multisort($tot, SORT_ASC, $keys); $t['finalPP'] = array_combine($keys, $tot);
  $rest = array_values(array_diff(obTourOrder($t), $keys));
  $t['phase'] = 'done'; $t['result'] = array_merge($keys, $rest); obTourAward($t); return true;
}
const OB_AWARD_MIN = 10; // バッジ・称号は、人が10人以上参加した大会だけ
function obTourAward(array &$t): void {
  if (!empty($t['awarded'])) return; $t['awarded'] = true;
  $t['awardOk'] = count($t['entrants']) >= OB_AWARD_MIN; $t['awards'] = [];
  if (!$t['awardOk']) return;
  $ent = []; foreach ($t['entrants'] as $e) $ent['u:' . $e['uid']] = $e;
  foreach (array_slice($t['result'], 0, 3) as $i => $k) {
    if (!isset($ent[$k])) continue; // AIの順位にはバッジなし
    $e = $ent[$k]; db()->prepare('INSERT OR REPLACE INTO awards (uid, pid, tid, tname, place, official, at) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$e['uid'], $e['pid'] ?? '', $t['id'], $t['cfg']['name'], $i + 1, !empty($t['cfg']['official']) ? 1 : 0, time()]);
    $t['awards'][] = ['place' => $i + 1, 'name' => $e['name']];
  }
}
// 大会の設定を読む（ひらくときと、編集のときに使う）
function obTourCfg(array $b, array $u): array {
  global $CFG;
  $name = trim(mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string)($b['tname'] ?? '')), 0, 30)); if ($name === '' || !nameOk($name)) fail('大会の名前を確かめてください');
  $desc = trim(mb_substr(preg_replace('/[\x00-\x08\x0B-\x1F\x7F<>]/u', '', (string)($b['desc'] ?? '')), 0, 300)); if ($desc !== '' && !nameOk($desc)) fail('説明にふさわしくない言葉が入っています');
  $startAt = (int)($b['startAt'] ?? 0); if ($startAt < time() - 60 || $startAt > time() + 86400 * 60) fail('開始日時を確かめてください');
  $lim = (int)($b['limit'] ?? 30); if (!in_array($lim, OB_LIMITS, true) && !($lim === 3 && !empty($CFG['test']))) $lim = 30;
  $min = max(2, min(40, (int)($b['min'] ?? 4))); $max = max($min, min(40, (int)($b['max'] ?? 15)));
  $pts = array_values(array_map(fn($x) => max(0, min(20, (int)$x)), array_slice((array)($b['points'] ?? [10, 8, 5, 2, 0]), 0, 5)));
  $cfg = ['name' => $name, 'desc' => $desc, 'startAt' => $startAt, 'limit' => $lim, 'judge' => in_array($b['judge'] ?? '', OB_JUDGE, true) ? $b['judge'] : 'after3', 'min' => $min, 'max' => $max, 'aiFill' => !empty($b['aiFill']), 'aiLv' => max(1, min(3, (int)($b['aiLv'] ?? 2))), 'aiMix' => in_array($b['aiMix'] ?? '', array_keys(OB_MIX), true) ? $b['aiMix'] : 'even',
  'entry' => ($b['entry'] ?? 'open') === 'invite' ? 'invite' : 'open', 'invites' => array_slice(array_values(array_filter(array_map(fn($x) => trim(mb_substr((string)$x, 0, 10)), (array)($b['invites'] ?? [])))), 0, 40),
  'official' => !empty($b['official']) && obCanOfficial($u['uid']), 'sets' => max(1, min(6, (int)($b['sets'] ?? 3))), 'games' => max(1, min(10, (int)($b['games'] ?? 5))), 'finalists' => max(0, min(5, (int)($b['finalists'] ?? 5))), 'points' => $pts ?: [10, 8, 5, 2, 0]];
  return $cfg;
}
const OB_MIX = ['random' => [1, 1, 1, 1, 1], 'casual' => [3, 3, 2, 1, 0.3], 'even' => [1, 1.5, 2, 1.5, 1], 'strong' => [0.2, 0.5, 1.5, 3, 3], 'master' => [0, 0, 0, 0, 1]]; // ふつうの大会の「相手の強さ」と同じ割合（★1〜5）
function obMixLv(string $mix): int { $w = OB_MIX[$mix] ?? OB_MIX['even']; $x = mt_rand() / mt_getrandmax() * array_sum($w); foreach ($w as $i => $v) { $x -= $v; if ($x <= 0) return $i + 1; } return 5; }
const OB_AI_CAP = [1 => 10, 2 => 11, 3 => 12, 4 => 11, 5 => 15]; // 倶楽部のキャラの人数（★ごと。chars.js と同じ。★5はゼロを除く）
const OB_WAIT = 900; // 次のセットまで最大15分待つ
function obTourWait(array &$t, array $keys, string $label, float $now): void {
  $t['wait'] = ['keys' => $keys, 'label' => $label, 'until' => $now + OB_WAIT]; $t['ready'] = [];
  foreach ($t['players'] as $p) if (!empty($p['ai'])) $t['ready'][$p['key']] = 1; // AIはいつでも準備OK
}
function obTourOrder(array $t): array { $k = array_keys($t['stand']); usort($k, fn($a, $b) => $t['stand'][$b]['pts'] <=> $t['stand'][$a]['pts'] ?: $t['stand'][$a]['pp'] <=> $t['stand'][$b]['pp']); return $k; }
function obLoadRaw(string $id): array { $q = db()->prepare('SELECT st, ver FROM rooms WHERE id = ?'); $q->execute([$id]); $r = $q->fetch(); return $r ? [json_decode($r['st'], true), (int)$r['ver']] : [null, 0]; }
function obTourLoad(string $id, bool $lock = false): array {
  $d = db(); if ($lock) $d->exec('BEGIN IMMEDIATE');
  $q = $d->prepare('SELECT * FROM tours WHERE id = ?'); $q->execute([$id]); $r = $q->fetch();
  if (!$r) { if ($lock) $d->exec('ROLLBACK'); fail('その大会は見つかりません', 404); }
  return [json_decode($r['st'], true), (int)$r['ver']];
}
function obTourSave(string $id, array $t, int $ver): void { db()->prepare('UPDATE tours SET st = ?, ver = ?, updated = ? WHERE id = ?')->execute([json_encode($t, JSON_UNESCAPED_UNICODE), $ver, time(), $id]); }
function obNorm(string $s): string { return mb_strtolower(preg_replace('/[\s　・._\-ー]/u', '', mb_convert_kana($s, 'asKV'))); }
function obInvited(array $t, string $uid): bool {
  if (($t['cfg']['entry'] ?? 'open') === 'open' || $t['host'] === $uid) return true;
  $q = db()->prepare('SELECT name FROM ranks WHERE uid = ?'); $q->execute([$uid]); $inv = array_map('obNorm', $t['cfg']['invites'] ?? []);
  foreach ($q->fetchAll() as $r) if (in_array(obNorm($r['name']), $inv, true)) return true;
  return false;
}
function obCanOfficial(string $uid): bool { global $CFG; return in_array($uid, $CFG['official'] ?? [], true); }
// 一覧・詳細に出す形（招待されているか・自分が出ているか・自分の卓）
function obTourView(array $t, string $uid, int $ver, bool $full): array {
  $c = $t['cfg']; $me = 'u:' . $uid; $now = microtime(true);
  $v = ['id' => $t['id'], 'ver' => $ver, 'name' => $c['name'], 'desc' => $c['desc'], 'hostName' => $t['hostName'], 'mine' => $t['host'] === $uid, 'official' => !empty($c['official']),
    'startAt' => $c['startAt'], 'entryAt' => $c['startAt'] - 900, 'phase' => $t['phase'], 'entry' => $c['entry'], 'invited' => obInvited($t, $uid), 'entered' => in_array($uid, array_column($t['entrants'], 'uid'), true),
    'n' => count($t['entrants']), 'invites' => $t['host'] === $uid ? ($c['invites'] ?? []) : [], 'min' => $c['min'], 'max' => $c['max'], 'sets' => $c['sets'], 'games' => $c['games'], 'finalists' => $c['finalists'], 'limit' => $c['limit'], 'judge' => $c['judge'] ?? 'after3', 'aiFill' => !empty($c['aiFill']), 'aiLv' => $c['aiLv'], 'aiMix' => $c['aiMix'] ?? null, 'now' => $now, 'note' => $t['note'] ?? null, 'wait' => isset($t['wait']) ? ['label' => $t['wait']['label'], 'until' => $t['wait']['until'], 'need' => in_array($me, $t['wait']['keys'], true), 'ready' => isset(($t['ready'] ?? [])[$me]), 'nReady' => count(array_intersect($t['wait']['keys'], array_keys($t['ready'] ?? []))), 'n' => count($t['wait']['keys'])] : null, 'awardMin' => OB_AWARD_MIN, 'awardOk' => $t['awardOk'] ?? null, 'awards' => $t['awards'] ?? []];
  if ($full) {
    $v['entrants'] = array_map(fn($e) => ['name' => $e['name'], 'avatar' => $e['avatar'] ?? null], $t['entrants']); $v['points'] = $c['points']; $v['set'] = $t['set'] ?? 0;
    if (!empty($t['players'])) {
      $byKey = []; foreach ($t['players'] as $p) $byKey[$p['key']] = $p;
      $v['stand'] = array_map(fn($k) => ['name' => $byKey[$k]['name'], 'avatar' => $byKey[$k]['avatar'] ?? null, 'ai' => !empty($byKey[$k]['ai']), 'lv' => $byKey[$k]['lv'] ?? null, 'slot' => $byKey[$k]['slot'] ?? null, 'me' => $k === $me, 'pts' => $t['stand'][$k]['pts'], 'pp' => $t['stand'][$k]['pp'], 'fin' => in_array($k, $t['finalists'] ?? [], true), 'fpp' => $t['finalPP'][$k] ?? null], $t['phase'] === 'done' ? $t['result'] : obTourOrder($t));
      $v['myRoom'] = null; $v['rooms'] = [];
      foreach ($t['rooms'] ?? [] as $rid) { [$st] = obLoadRaw($rid); if (!$st) continue; $v['rooms'][] = ['id' => $rid, 'label' => $st['label'] ?? '', 'phase' => $st['phase'], 'gameNo' => $st['gameNo'], 'names' => array_column($st['seats'], 'name'), 'seats' => array_map(fn($x) => ['name' => $x['name'], 'ai' => !empty($x['ai']), 'lv' => $x['lv'] ?? null, 'slot' => $x['slot'] ?? null], $st['seats'])]; foreach ($st['seats'] as $s) if (($s['key'] ?? '') === $me && in_array($t['phase'], ['prelim', 'final'], true) && $st['phase'] !== 'done') $v['myRoom'] = $rid; }
    }
  }
  return $v;
}

function obLoad(string $id, bool $lock = false): array {
  $d = db(); if ($lock) $d->exec('BEGIN IMMEDIATE');
  $q = $d->prepare('SELECT * FROM rooms WHERE id = ?'); $q->execute([$id]); $r = $q->fetch();
  if (!$r) { if ($lock) $d->exec('ROLLBACK'); fail('その卓は見つかりません', 404); }
  return [json_decode($r['st'], true), (int)$r['ver']];
}
function obSave(string $id, array $st, int $ver): void { db()->prepare('UPDATE rooms SET st = ?, ver = ?, updated = ? WHERE id = ?')->execute([json_encode($st, JSON_UNESCAPED_UNICODE), $ver, time(), $id]); }
function obSeatInfo(array $b): array { $tp = (string)($GLOBALS['tokenPid'] ?? ''); return ['pid' => $tp !== '' ? $tp : substr(preg_replace('/[^A-Za-z0-9_-]/', '', (string)($b['pid'] ?? '')), 0, 40), 'name' => trim(mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string)($b['name'] ?? '')), 0, 10)) ?: 'プレイヤー', 'avatar' => is_array($b['avatar'] ?? null) ? array_slice($b['avatar'], 0, 20) : null]; }

$a = $_GET['a'] ?? '';
try {
  switch ($a) {
    case 'register': { // 何も入力せずに始められる匿名アカウント。引き継ぎコードを返す
      rateLimit('reg', 30);
      $uid = bin2hex(random_bytes(8)); $token = bin2hex(random_bytes(24)); $code = newCode();
      db()->prepare('INSERT INTO users (uid, token_hash, code_hash, created, seen) VALUES (?, ?, ?, ?, ?)')->execute([$uid, '', h($code), time(), time()]);
      db()->prepare('INSERT INTO tokens (token_hash, uid, created) VALUES (?, ?, ?)')->execute([h($token), $uid, time()]);
      out(['ok' => true, 'uid' => $uid, 'token' => $token, 'code' => $code]);
    }
    case 'restore': { // 引き継ぎコードで、別の端末から同じアカウントに入る（その端末用の新しい鍵を出す）
      rateLimit('restore', 20);
      $b = body(); $code = normCode((string)($b['code'] ?? ''));
      $st = db()->prepare('SELECT uid FROM users WHERE code_hash = ?'); $st->execute([h($code)]); $u = $st->fetch();
      if (!$u) fail('引き継ぎコードが見つかりません', 404);
      $token = bin2hex(random_bytes(24));
      db()->prepare('INSERT INTO tokens (token_hash, uid, created) VALUES (?, ?, ?)')->execute([h($token), $u['uid'], time()]);
      db()->prepare('UPDATE users SET seen = ? WHERE uid = ?')->execute([time(), $u['uid']]);
      out(['ok' => true, 'uid' => $u['uid'], 'token' => $token, 'code' => $code]);
    }
    case 'load': {
      $u = authUser(body());
      out(['ok' => true, 'data' => $u['data'] ? json_decode($u['data'], true) : null, 'at' => (int)$u['data_at']]);
    }
    case 'save': { // （前の版）端末の記録をまるごと保存。いまの画面はプレイヤーごとの p_save を使う。古い画面のために残す
      $b = body(); $u = authUser($b);
      if ((string)($u['tpid'] ?? '') !== '') fail('プレイヤーの鍵では、端末の記録は保存できません', 403);
      $data = $b['data'] ?? null; if (!is_array($data)) fail('データがありません');
      $json = json_encode($data, JSON_UNESCAPED_UNICODE); if (strlen($json) > $CFG['max_data']) fail('データが大きすぎます', 413);
      $at = (int)($b['at'] ?? time() * 1000);
      // ほかの端末がもっと新しい記録を保存していたら、上書きしない（古い端末の控えで消さないため）
      $base = (int)($b['base'] ?? 0);
      if ((int)$u['data_at'] > $base && empty($b['force'])) out(['ok' => false, 'conflict' => true, 'at' => (int)$u['data_at'], 'error' => 'ほかの端末の記録のほうが新しいです'], 409);
      $d = db(); $d->beginTransaction();
      $d->prepare('UPDATE users SET data = ?, data_at = ?, seen = ? WHERE uid = ?')->execute([$json, $at, time(), $u['uid']]);
      foreach (array_slice((array)($b['stats'] ?? []), 0, 12) as $s) { $pid = cleanPid($s['pid'] ?? ''); if ($pid !== '') rankUpsert($d, $u['uid'], $pid, (array)$s); }
      $d->commit();
      out(['ok' => true, 'at' => $at]);
    }
    case 'p_save': { // プレイヤー1人の記録を保存し、ランキングの行も更新する。はじめて保存したときに、そのプレイヤーの引き継ぎコードを作る
      $b = body(); $u = authUser($b); $pid = playerPid($u, $b);
      $data = $b['data'] ?? null; if (!is_array($data)) fail('データがありません');
      $json = json_encode($data, JSON_UNESCAPED_UNICODE); if (strlen($json) > $CFG['max_data']) fail('データが大きすぎます', 413);
      $at = (int)($b['at'] ?? time() * 1000); $base = (int)($b['base'] ?? 0);
      $d = db(); $d->beginTransaction();
      $st = $d->prepare('SELECT data_at, code FROM players WHERE uid = ? AND pid = ?'); $st->execute([$u['uid'], $pid]); $row = $st->fetch();
      // ほかの端末がこのプレイヤーのもっと新しい記録を保存していたら、上書きしない
      if ($row && (int)$row['data_at'] > $base && empty($b['force'])) { $d->rollBack(); out(['ok' => false, 'conflict' => true, 'at' => (int)$row['data_at'], 'error' => 'ほかの端末の記録のほうが新しいです'], 409); }
      if ($row) { $code = $row['code']; $d->prepare('UPDATE players SET data = ?, data_at = ? WHERE uid = ? AND pid = ?')->execute([$json, $at, $u['uid'], $pid]); }
      else { $code = newCode(); $d->prepare('INSERT INTO players (uid, pid, code_hash, code, data, data_at) VALUES (?, ?, ?, ?, ?, ?)')->execute([$u['uid'], $pid, h($code), $code, $json, $at]); }
      if (is_array($b['stats'] ?? null)) rankUpsert($d, $u['uid'], $pid, $b['stats']);
      $d->prepare('UPDATE users SET seen = ? WHERE uid = ?')->execute([time(), $u['uid']]);
      $d->commit();
      out(['ok' => true, 'at' => $at, 'code' => $code]);
    }
    case 'p_load': { // プレイヤー1人の記録（まだなければ data は null）
      $b = body(); $u = authUser($b); $pid = playerPid($u, $b);
      $st = db()->prepare('SELECT data, data_at, code FROM players WHERE uid = ? AND pid = ?'); $st->execute([$u['uid'], $pid]); $r = $st->fetch();
      out(['ok' => true, 'data' => $r && $r['data'] ? json_decode($r['data'], true) : null, 'at' => $r ? (int)$r['data_at'] : 0, 'code' => $r ? $r['code'] : null]);
    }
    case 'p_restore': { // プレイヤーの引き継ぎコードで、そのプレイヤーを別の端末に入れる（その端末用の、そのプレイヤーだけの鍵を出す）
      rateLimit('restore', 20);
      $b = body(); $code = normCode((string)($b['code'] ?? ''));
      $st = db()->prepare('SELECT uid, pid, code, data, data_at FROM players WHERE code_hash = ?'); $st->execute([h($code)]); $r = $st->fetch();
      if (!$r) { // 前の版の「端末まるごと」のコード：プレイヤーが1人だけなら、その人を入れる
        $q = db()->prepare('SELECT uid FROM users WHERE code_hash = ?'); $q->execute([h($code)]); $old = $q->fetch();
        if (!$old) fail('引き継ぎコードが見つかりません', 404);
        $ps = db()->prepare('SELECT uid, pid, code, data, data_at FROM players WHERE uid = ?'); $ps->execute([$old['uid']]); $all = $ps->fetchAll();
        if (count($all) !== 1) fail(count($all) ? 'このコードは前の版の「端末まるごと」のコードです。プレイヤーごとのコード（元の端末の「プレイヤー」に出ます）を入れてください' : 'このコードは前の版のコードです。元の端末でアプリを開くと、プレイヤーごとのコードが「プレイヤー」に出ます', 404);
        $r = $all[0];
      }
      $token = bin2hex(random_bytes(24));
      db()->prepare('INSERT INTO tokens (token_hash, uid, created, pid) VALUES (?, ?, ?, ?)')->execute([h($token), $r['uid'], time(), $r['pid']]);
      $nm = db()->prepare('SELECT name FROM ranks WHERE uid = ? AND pid = ?'); $nm->execute([$r['uid'], $r['pid']]); $n = $nm->fetch();
      out(['ok' => true, 'uid' => $r['uid'], 'pid' => $r['pid'], 'token' => $token, 'code' => $r['code'], 'name' => $n ? $n['name'] : null, 'data' => $r['data'] ? json_decode($r['data'], true) : null, 'at' => (int)$r['data_at']]);
    }
    case 'p_del': { // この端末で作ったプレイヤーを消す：ランキング・引き継ぎコード・ほかの端末に入れた鍵も消す（オンライン大会の実績は残す）
      $b = body(); $u = authUser($b);
      if ((string)($u['tpid'] ?? '') !== '') fail('このプレイヤーは、作った端末でだけ消せます', 403);
      $pid = cleanPid($b['pid'] ?? ''); if ($pid === '') fail('プレイヤーがありません');
      $d = db(); $d->beginTransaction();
      $d->prepare('DELETE FROM ranks WHERE uid = ? AND pid = ?')->execute([$u['uid'], $pid]);
      $d->prepare('DELETE FROM players WHERE uid = ? AND pid = ?')->execute([$u['uid'], $pid]);
      $d->prepare('DELETE FROM tokens WHERE uid = ? AND pid = ?')->execute([$u['uid'], $pid]);
      $d->commit();
      out(['ok' => true]);
    }
    case 'ranking': { // type = rating（推定実力）/ badges（バッジ数・BP）/ attack（バッジアタック自己ベスト）
      $type = $_GET['type'] ?? 'rating'; $uid = preg_replace('/[^a-f0-9]/', '', (string)($_GET['uid'] ?? ''));
      [$col, $order, $where] = match ($type) { 'badges' => ['badges', 'badges DESC, bp DESC', 'badges > 0'], 'attack' => ['atk', 'atk DESC', 'atk > 0'], default => ['rating', 'rating DESC', 'rating IS NOT NULL'] };
      $rows = db()->query("SELECT uid, pid, name, rating, badges, bp, atk, avatar FROM ranks WHERE shown = 1 AND $where ORDER BY $order, updated ASC LIMIT 100")->fetchAll();
      $list = []; $rank = 0; $prev = null;
      foreach ($rows as $i => $r) {
        $key = $type === 'badges' ? $r['badges'] . ':' . $r['bp'] : (string)$r[$col];
        if ($key !== $prev) { $rank = $i + 1; $prev = $key; }
        $list[] = ['rank' => $rank, 'name' => $r['name'], 'rating' => $r['rating'] !== null ? round((float)$r['rating'], 1) : null, 'badges' => (int)$r['badges'], 'bp' => (int)$r['bp'], 'atk' => (int)$r['atk'], 'avatar' => $r['avatar'] ? json_decode($r['avatar'], true) : null, 'me' => $uid !== '' && $r['uid'] === $uid];
      }
      $total = (int)db()->query("SELECT COUNT(*) c FROM ranks WHERE shown = 1 AND $where")->fetch()['c'];
      out(['ok' => true, 'type' => $type, 'list' => $list, 'total' => $total]);
    }
    case 'rankings': { // 6つのランキングをまとめて返す（各上位20人＋20位より下の自分の行）
      $uid = preg_replace('/[^a-f0-9]/', '', (string)($_GET['uid'] ?? '')); $lim = 20; $res = [];
      $withAi = ($_GET['ai'] ?? '1') !== '0'; // ai=0 でAI研究員を外す
      $all = db()->query('SELECT uid, pid, name, rating, badges, bp, atk, avatar, streak, card, updated, ai FROM ranks WHERE shown = 1' . ($withAi ? '' : ' AND (ai IS NULL OR ai = 0)'))->fetchAll();
      foreach ($all as &$r) {
        $r['rating'] = $r['rating'] !== null ? (float)$r['rating'] : null; foreach (['badges', 'bp', 'atk', 'streak'] as $k) $r[$k] = (int)$r[$k]; $r['total'] = 0.0;
        // 連続最善の列ができる前に保存した人は、成績カードに入っている記録を使う
        if ($r['card']) { $c = json_decode($r['card'], true); $r['streak'] = max($r['streak'], max(0, min(2000, (int)($c['streak'] ?? 0)))); }
        unset($r['card']);
      } unset($r);
      $defs = [
        'rating' => [fn($r) => $r['rating'] !== null, fn($a, $b) => $b['rating'] <=> $a['rating']],
        'badges' => [fn($r) => $r['badges'] > 0, fn($a, $b) => [$b['badges'], $b['bp']] <=> [$a['badges'], $a['bp']]],
        'bp' => [fn($r) => $r['bp'] > 0, fn($a, $b) => $b['bp'] <=> $a['bp']],
        'streak' => [fn($r) => $r['streak'] > 0, fn($a, $b) => $b['streak'] <=> $a['streak']],
        'attack' => [fn($r) => $r['atk'] > 0, fn($a, $b) => $b['atk'] <=> $a['atk']]];
      // 総合：推定実力・BP・連続最善・バッジアタックそれぞれ「1位の成績を1とした比率」に重み（35・30・20・15）をかけて合計。全部1位なら100点
      $W = ['rating' => 35, 'bp' => 30, 'streak' => 20, 'attack' => 15]; $COL = ['rating' => 'rating', 'bp' => 'bp', 'streak' => 'streak', 'attack' => 'atk']; $sorted = [];
      foreach ($defs as $type => [$in, $cmp]) {
        $l = array_values(array_filter($all, $in)); usort($l, fn($a, $b) => $cmp($a, $b) ?: $a['updated'] <=> $b['updated']);
        $rk = []; foreach ($l as $i => $r) $rk[$i] = ($i > 0 && $cmp($l[$i - 1], $r) === 0) ? $rk[$i - 1] : $i + 1; // 同じ値は同じ順位
        $sorted[$type] = [$l, $rk];
        if (isset($W[$type]) && $l) { $c = $COL[$type]; $top = (float)$l[0][$c]; if ($top > 0) foreach ($all as &$x) { $v = (float)($x[$c] ?? 0); if ($v > 0) $x['total'] += $W[$type] * min(1, $v / $top); } unset($x); }
      }
      foreach ($all as &$r) $r['total'] = round($r['total'], 1); unset($r);
      $l = array_values(array_filter($all, fn($r) => $r['total'] > 0)); $cmpT = fn($a, $b) => $b['total'] <=> $a['total'];
      usort($l, fn($a, $b) => $cmpT($a, $b) ?: $a['updated'] <=> $b['updated']);
      $rk = []; foreach ($l as $i => $r) $rk[$i] = ($i > 0 && $cmpT($l[$i - 1], $r) === 0) ? $rk[$i - 1] : $i + 1;
      $sorted = ['total' => [$l, $rk]] + $sorted;
      $tot = []; foreach ($all as $r) $tot[$r['uid'] . ':' . $r['pid']] = $r['total'];
      $row = fn($r, $rank) => ['rank' => $rank, 'name' => $r['name'], 'rating' => $r['rating'] !== null ? round($r['rating'], 1) : null, 'badges' => $r['badges'], 'bp' => $r['bp'], 'atk' => $r['atk'], 'streak' => $r['streak'], 'total' => $tot[$r['uid'] . ':' . $r['pid']] ?? 0, 'avatar' => $r['avatar'] ? json_decode($r['avatar'], true) : null, 'rid' => rid($r['uid'], $r['pid']), 'me' => $uid !== '' && $r['uid'] === $uid, 'pid' => ($uid !== '' && $r['uid'] === $uid) ? $r['pid'] : null, 'ai' => !empty($r['ai'])]; // pid は自分の行だけ（今のプレイヤーを見分けるため）
      foreach ($sorted as $type => [$l, $rk]) {
        $list = []; $mine = [];
        foreach ($l as $i => $r) { if ($i < $lim) $list[] = $row($r, $rk[$i]); elseif ($uid !== '' && $r['uid'] === $uid) $mine[] = $row($r, $rk[$i]); }
        $res[$type] = ['list' => $list, 'mine' => $mine, 'total' => count($l)];
      }
      out(['ok' => true, 'rankings' => $res]);
    }
    case 'name': { // 名前が使えるか（登録・名前の変更の前に確かめる）
      $n = trim(mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string)($_GET['n'] ?? '')), 0, 10));
      $uid = preg_replace('/[^a-f0-9]/', '', (string)($_GET['uid'] ?? '')); $pid = substr(preg_replace('/[^a-z0-9]/i', '', (string)($_GET['pid'] ?? '')), 0, 24);
      if ($n === '') out(['ok' => true, 'free' => false, 'why' => 'empty']);
      if (!nameOk($n)) out(['ok' => true, 'free' => false, 'why' => 'ng']);
      out(['ok' => true, 'free' => !nameTaken($n, $uid, $pid), 'why' => 'taken']);
    }
    case 'ai_list': { // AI研究員の一覧と記録（GitHub Actions の毎日の自動対局から）
      $b = body(); adminOk($b);
      out(['ok' => true, 'list' => array_map(fn($r) => ['cid' => $r['cid'], 'data' => json_decode((string)$r['data'], true), 'updated' => (int)$r['updated'], 'rating' => $r['rating'] !== null ? (float)$r['rating'] : null, 'bp' => (int)($r['bp'] ?? 0)],
        db()->query("SELECT a.cid, a.data, a.updated, r.rating, r.bp FROM ai_data a LEFT JOIN ranks r ON r.uid = 'ai' AND r.pid = a.cid ORDER BY a.updated")->fetchAll())]); // 今の推定実力とBPも返す（追いつきの目標に使う）
    }
    case 'ai_save': { // AI研究員の記録とランキングの数字を保存（uid は「ai」、pid はキャラのid）
      $b = body(); adminOk($b);
      $cid = substr(preg_replace('/[^a-z0-9]/i', '', (string)($b['cid'] ?? '')), 0, 24); if ($cid === '') fail('cid がありません');
      $data = $b['data'] ?? null; $s = $b['stats'] ?? null; if (!is_array($data) || !is_array($s)) fail('データがありません');
      $d = db(); $d->beginTransaction();
      $d->prepare('INSERT INTO ai_data (cid, data, updated) VALUES (?,?,?) ON CONFLICT(cid) DO UPDATE SET data=excluded.data, updated=excluded.updated')->execute([$cid, json_encode($data, JSON_UNESCAPED_UNICODE), time()]);
      $rating = isset($s['rating']) && is_numeric($s['rating']) ? max(0, min(6, (float)$s['rating'])) : null;
      $name = trim(mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string)($s['name'] ?? '')), 0, 12));
      $av = isset($s['avatar']) ? substr(json_encode($s['avatar'], JSON_UNESCAPED_UNICODE), 0, 1500) : null;
      $d->prepare('INSERT INTO ranks (uid, pid, name, shown, rating, badges, bp, atk, avatar, bio, card, streak, ai, updated) VALUES (?,?,?,1,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(uid, pid) DO UPDATE SET name=excluded.name, rating=excluded.rating, badges=excluded.badges, bp=excluded.bp, atk=excluded.atk, avatar=excluded.avatar, bio=excluded.bio, card=excluded.card, streak=excluded.streak, ai=1, updated=excluded.updated')
        ->execute(['ai', $cid, $name, $rating, max(0, min(500, (int)($s['badges'] ?? 0))), max(0, min(20000, (int)($s['bp'] ?? 0))), max(0, min(5000, (int)($s['atk'] ?? 0))), $av, trim(mb_substr((string)($s['bio'] ?? ''), 0, 140)), safeCard($s['card'] ?? null), max(0, min(2000, (int)($s['streak'] ?? 0))), time()]);
      $d->commit(); out(['ok' => true]);
    }
    case 'ai_del': { // AI研究員を引退させる（ランキングからも消す）
      $b = body(); adminOk($b); $cid = substr(preg_replace('/[^a-z0-9]/i', '', (string)($b['cid'] ?? '')), 0, 24);
      db()->prepare('DELETE FROM ai_data WHERE cid = ?')->execute([$cid]); db()->prepare("DELETE FROM ranks WHERE uid = 'ai' AND pid = ?")->execute([$cid]);
      out(['ok' => true]);
    }
    case 'card': { // ランキングの人の成績カード（自己紹介つき）。rid で指す
      $rid = preg_replace('/[^a-f0-9]/', '', (string)($_GET['rid'] ?? ''));
      foreach (db()->query('SELECT uid, pid, name, rating, badges, bp, atk, avatar, bio, card, ai FROM ranks WHERE shown = 1')->fetchAll() as $r) {
        if (rid($r['uid'], $r['pid']) !== $rid) continue;
        $aq = db()->prepare('SELECT tid, tname, place, official, at FROM awards WHERE uid = ? AND pid = ? ORDER BY place, at DESC LIMIT 30'); $aq->execute([$r['uid'], $r['pid']]); $GLOBALS['cardAwards'] = $aq->fetchAll(); $ct = $r['card'] ? (json_decode($r['card'], true)['title'] ?? '') : ''; $GLOBALS['cardTitle'] = null; foreach ($GLOBALS['cardAwards'] as $aw) if ($ct !== '' && ($aw['tid'] ?? '') === $ct) $GLOBALS['cardTitle'] = ['text' => $aw['tname'] . ' ' . ['', '優勝', '準優勝', '3位'][(int)$aw['place']], 'official' => (int)$aw['official'], 'place' => (int)$aw['place']];
        out(['ok' => true, 'card' => array_merge($r['card'] ? json_decode($r['card'], true) : ['ach' => []], ['awards' => $GLOBALS['cardAwards'] ?? [], 'titleShow' => $GLOBALS['cardTitle'] ?? null], ['name' => $r['name'], 'rating' => $r['rating'] !== null ? round((float)$r['rating'], 2) : null, 'atk' => (int)$r['atk'], 'avatar' => $r['avatar'] ? json_decode($r['avatar'], true) : null, 'bio' => (string)($r['bio'] ?? ''), 'ai' => !empty($r['ai'])])]);
      }
      fail('見つかりません', 404);
    }


    case 'on_tours': { // 大会の一覧（受付前・受付中・開催中と、終わって1日以内）
      $b = body(); $u = authUser($b); $now = microtime(true); $out = [];
      foreach (db()->query("SELECT id, st, ver FROM tours WHERE st NOT LIKE '%\"phase\":\"done\"%' AND st NOT LIKE '%\"phase\":\"cancel\"%' ORDER BY start_at")->fetchAll() as $r) {
        $t = json_decode($r['st'], true); $ver = (int)$r['ver'];
        if (in_array($t['phase'], ['entry', 'prelim', 'final'], true)) { db()->exec('BEGIN IMMEDIATE'); [$t, $ver] = obTourLoad($r['id']); if (obTourTick($t, $now)) { $ver++; obTourSave($r['id'], $t, $ver); } db()->exec('COMMIT'); }
        if (in_array($t['phase'], ['done', 'cancel'], true)) continue; // 終わった大会はアーカイブ（on_tours_archive）へ
        $vw = obTourView($t, $u['uid'], $ver, false); if ($t['cfg']['entry'] === 'invite' && !$vw['invited'] && !$vw['entered']) continue; // 招待だけの大会は、招待された人にだけ見える
        $out[] = $vw;
      }
      out(['ok' => true, 'tours' => $out, 'canOfficial' => obCanOfficial($u['uid']), 'uid' => $u['uid']]);
    }
    case 'on_people': { // 招待する人の候補：q があれば名前でさがす（ランキングに載っている人。AIと自分は出さない）、なければ最近の大会でいっしょだった人・前に招待した人
      $b = body(); $u = authUser($b); $kn = fn($x) => obNorm(mb_convert_kana((string)$x, 'C')); $q = $kn(mb_substr((string)($b['q'] ?? ''), 0, 10)); // さがすときは、ひらがなとカタカナを同じとみなす
      $av = fn($a) => $a ? json_decode($a, true) : null;
      if ($q !== '') {
        $out = [];
        foreach (db()->query("SELECT uid, name, avatar FROM ranks WHERE shown = 1 AND ai = 0 AND name NOT LIKE '研究員%' ORDER BY updated DESC LIMIT 3000")->fetchAll() as $r) {
          if ($r['uid'] === $u['uid']) continue; $n = $kn($r['name']);
          if ($n !== '' && mb_strpos($n, $q) !== false) $out[] = ['name' => $r['name'], 'avatar' => $av($r['avatar']), 'exact' => $n === $q, 'pre' => mb_strpos($n, $q) === 0];
        }
        usort($out, fn($a, $c) => [$c['exact'], $c['pre']] <=> [$a['exact'], $a['pre']]);
        out(['ok' => true, 'list' => array_slice($out, 0, 12)]);
      }
      $keys = []; $names = [];
      foreach (db()->query('SELECT st FROM tours ORDER BY start_at DESC LIMIT 200')->fetchAll() as $r) {
        $t = json_decode($r['st'], true); $ents = $t['entrants'] ?? [];
        $mine = ($t['host'] ?? '') === $u['uid'];
        if (!$mine && !in_array($u['uid'], array_column($ents, 'uid'), true)) continue;
        foreach ($ents as $e) { if (empty($e['uid']) || $e['uid'] === $u['uid']) continue; $keys[$e['uid'] . ':' . ($e['pid'] ?? '')] = 1; }
        if ($mine) foreach ($t['cfg']['invites'] ?? [] as $nm) $names[obNorm((string)$nm)] = (string)$nm;
        if (count($keys) >= 30) break;
      }
      $out = []; $seen = [];
      $st = db()->prepare('SELECT name, avatar, shown FROM ranks WHERE uid = ? AND pid = ?');
      foreach (array_keys($keys) as $k) { [$uu, $pp] = explode(':', $k, 2); $st->execute([$uu, $pp]); $r = $st->fetch(); if (!$r || strpos((string)$r['name'], '研究員') === 0) continue; $n = obNorm((string)$r['name']); if (isset($seen[$n])) continue; $seen[$n] = 1; $out[] = ['name' => $r['name'], 'avatar' => $r['shown'] ? $av($r['avatar']) : null, 'why' => 'played']; }
      foreach ($names as $n => $nm) { if ($n === '' || isset($seen[$n])) continue; $seen[$n] = 1; $out[] = ['name' => $nm, 'avatar' => null, 'why' => 'invited']; }
      out(['ok' => true, 'list' => array_slice($out, 0, 16)]);
    }
    case 'on_tours_archive': { // 終わった大会（新しい順に50件）
      $b = body(); $u = authUser($b); $out = [];
      foreach (db()->query("SELECT id, st, ver FROM tours WHERE st LIKE '%\"phase\":\"done\"%' OR st LIKE '%\"phase\":\"cancel\"%' ORDER BY start_at DESC LIMIT 200")->fetchAll() as $r) {
        $t = json_decode($r['st'], true); $vw = obTourView($t, $u['uid'], (int)$r['ver'], false);
        if ($t['cfg']['entry'] === 'invite' && !$vw['invited'] && !$vw['entered']) continue;
        $out[] = $vw; if (count($out) >= 50) break;
      }
      out(['ok' => true, 'tours' => $out]);
    }
    case 'on_awards': { // 自分（このアカウント）のオンライン大会の上位3位
      $b = body(); $u = authUser($b); $tp = (string)($u['tpid'] ?? ''); $q = db()->prepare('SELECT pid, tid, tname, place, official, at FROM awards WHERE uid = ?' . ($tp !== '' ? ' AND pid = ?' : '') . ' ORDER BY at DESC'); $q->execute($tp !== '' ? [$u['uid'], $tp] : [$u['uid']]);
      out(['ok' => true, 'awards' => $q->fetchAll()]);
    }
    case 'on_test_seed': { // テスト版だけ：称号とバッジを持った仮のユーザーを入れる（何度呼んでも同じ）
      if (empty($CFG['stg']) && empty($CFG['test'])) fail('使えません', 403);
      $fake = [['tester1', 'テスト王', [['TESTOFF1', 'オノケン杯（テスト）', 1, 1], ['TESTON01', '秋の研究所杯（テスト）', 1, 0], ['TESTON02', '週末オープン（テスト）', 2, 0]], 'TESTOFF1'],
        ['tester2', 'テスト姫', [['TESTOFF1', 'オノケン杯（テスト）', 2, 1], ['TESTON01', '秋の研究所杯（テスト）', 3, 0]], 'TESTON01'], ['tester3', 'テスト丸', [['TESTOFF1', 'オノケン杯（テスト）', 3, 1]], '']];
      $ach = []; foreach (['games:10', 'win:1', 'win:10', 'three:10', 'quick5:1'] as $k) $ach[] = $k;
      foreach ($fake as $i => [$uid, $name, $aws, $title]) {
        foreach ($aws as [$tid, $tname, $place, $off]) { db()->prepare('INSERT OR REPLACE INTO awards (uid, pid, tid, tname, place, official, at) VALUES (?, ?, ?, ?, ?, ?, ?)')->execute([$uid, 'p1', $tid, $tname, $place, $off, time() - 86400 * ($i + 1)]); $ach[] = ($off ? 'off_podium:' : 'on_podium:') . (4 - $place); }
        $card = safeCard(['ach' => $ach, 'title' => $title, 'streak' => 12 + $i]);
        db()->prepare('INSERT OR REPLACE INTO ranks (uid, pid, name, shown, rating, badges, bp, atk, avatar, updated, bio, card, streak, ai) VALUES (?, ?, ?, 1, ?, ?, ?, 0, NULL, ?, ?, ?, ?, 0)')->execute([$uid, 'p1', $name, 3.5 - $i * 0.4, 12 - $i, 300 - $i * 50, time(), 'テスト用の仮のユーザーです（称号とバッジの表示を確かめるため）', $card, 12 + $i]);
      }
      out(['ok' => true, 'n' => count($fake)]);
    }
    case 'on_tour_new': { // 大会をひらく
      $b = body(); $u = authUser($b); rateLimit('tour', 10);
      $mine = db()->prepare("SELECT COUNT(*) c FROM tours WHERE host = ? AND st NOT LIKE '%\"phase\":\"done\"%' AND st NOT LIKE '%\"phase\":\"cancel\"%'"); $mine->execute([$u['uid']]);
      if ((int)$mine->fetch()['c'] >= 3) fail('同時にひらける大会は3つまでです');
      $cfg = obTourCfg($b, $u);
      $id = ''; for ($k = 0; $k < 8; $k++) $id .= CODE_CHARS[random_int(0, strlen(CODE_CHARS) - 1)];
      $hostName = obSeatInfo($b)['name'];
      $t = ['id' => $id, 'host' => $u['uid'], 'hostName' => $hostName, 'cfg' => $cfg, 'phase' => 'entry', 'entrants' => [], 'set' => 0];
      db()->prepare('INSERT INTO tours (id, host, st, ver, start_at, updated, created) VALUES (?, ?, ?, 1, ?, ?, ?)')->execute([$id, $u['uid'], json_encode($t, JSON_UNESCAPED_UNICODE), $cfg['startAt'], time(), time()]);
      out(['ok' => true, 'tour' => obTourView($t, $u['uid'], 1, true)]);
    }
    case 'on_tour': { // 大会の詳細（ここでも進める）
      $b = body(); $u = authUser($b); $id = preg_replace('/[^0-9A-Z]/', '', (string)($b['id'] ?? ''));
      [$t, $ver] = obTourLoad($id, true); if (obTourTick($t, microtime(true))) { $ver++; obTourSave($id, $t, $ver); } db()->exec('COMMIT');
      if (!obInvited($t, $u['uid']) && !in_array($u['uid'], array_column($t['entrants'], 'uid'), true)) fail('招待された人だけが見られる大会です', 403);
      out(['ok' => true, 'tour' => obTourView($t, $u['uid'], $ver, true)]);
    }
    case 'on_tour_act': { // entry（エントリー）/ cancel（取り消し）/ startnow（主催者：受付中なら今すぐ開始）/ delete（主催者：始まる前なら中止）
      $b = body(); $u = authUser($b); $id = preg_replace('/[^0-9A-Z]/', '', (string)($b['id'] ?? '')); $act = (string)($b['act'] ?? ''); $now = microtime(true);
      [$t, $ver] = obTourLoad($id, true); obTourTick($t, $now); $err = null; $c = $t['cfg'];
      $open = $t['phase'] === 'entry' && $now >= $c['startAt'] - 900;
      if ($act === 'entry') {
        if (!$open) $err = 'エントリーは開始の15分前からです';
        elseif (!obInvited($t, $u['uid'])) $err = '招待された人だけが出られる大会です';
        elseif (count($t['entrants']) >= $c['max']) $err = '満員です';
        elseif (!in_array($u['uid'], array_column($t['entrants'], 'uid'), true)) $t['entrants'][] = array_merge(obSeatInfo($b), ['uid' => $u['uid']]);
      } elseif ($act === 'cancel') {
        if ($t['phase'] !== 'entry') $err = 'もう始まっています'; else $t['entrants'] = array_values(array_filter($t['entrants'], fn($e) => $e['uid'] !== $u['uid']));
      } elseif ($act === 'startnow') {
        if ($t['host'] !== $u['uid']) $err = '主催者だけができます'; elseif (!$open) $err = '受付中だけできます';
        elseif (count($t['entrants']) < $c['min'] && empty($c['aiFill'])) $err = '最少人数に届いていません';
        else obTourStart($t, $now);
      } elseif ($act === 'ready') {
        if (empty($t['wait']) || !in_array('u:' . $u['uid'], $t['wait']['keys'], true)) $err = 'いまは準備の時間ではありません'; else { $t['ready']['u:' . $u['uid']] = 1; obTourTick($t, $now); }
      } elseif ($act === 'edit') { // 受付が始まる前なら、主催者は設定を変えられる
        if ($t['host'] !== $u['uid'] || $t['phase'] !== 'entry' || $now >= $c['startAt'] - 900) $err = '受付が始まる前の自分の大会だけ編集できます';
        else { $t['cfg'] = obTourCfg($b, $u); db()->prepare('UPDATE tours SET start_at = ? WHERE id = ?')->execute([$t['cfg']['startAt'], $id]); }
      } elseif ($act === 'remove') { // 終わった大会をアーカイブから消す（主催者だけ。取ったバッジ・称号は残る）
        if ($t['host'] !== $u['uid'] || !in_array($t['phase'], ['done', 'cancel'], true)) $err = '終わった自分の大会だけ削除できます';
        else { db()->prepare('DELETE FROM tours WHERE id = ?')->execute([$id]); db()->exec('COMMIT'); out(['ok' => true, 'removed' => true]); }
      } elseif ($act === 'delete') {
        if ($t['host'] !== $u['uid'] || $t['phase'] !== 'entry') $err = '始まる前の自分の大会だけ中止できます'; else { $t['phase'] = 'cancel'; $t['note'] = '主催者が中止しました'; }
      } else $err = '知らない操作です';
      if ($err) { db()->exec('ROLLBACK'); fail($err); }
      $ver++; obTourSave($id, $t, $ver); db()->exec('COMMIT');
      out(['ok' => true, 'tour' => obTourView($t, $u['uid'], $ver, true)]);
    }
    // ---- オンライン対局 ----
    case 'on_create': { // 卓を作る（作った人が席0・ホスト）
      $b = body(); $u = authUser($b); rateLimit('room', 30);
      $lim = (int)($b['limit'] ?? 30); if (!in_array($lim, OB_LIMITS, true) && !($lim === 3 && !empty($CFG['test']))) $lim = 30;
      $cfg = ['n' => max(2, min(5, (int)($b['n'] ?? 4))), 'games' => max(1, min(10, (int)($b['games'] ?? 3))), 'limit' => $lim, 'judge' => in_array($b['judge'] ?? '', OB_JUDGE, true) ? $b['judge'] : 'after3'];
      $st = ['phase' => 'lobby', 'cfg' => $cfg, 'seats' => [array_merge(obSeatInfo($b), ['uid' => $u['uid'], 'miss' => 0])], 'gameNo' => 0, 'setPP' => []];
      $d = db(); db()->prepare('DELETE FROM rooms WHERE updated < ?')->execute([time() - 86400]); // 1日たった卓は片づける
      for ($i = 0; $i < 20; $i++) { $id = ''; for ($k = 0; $k < 6; $k++) $id .= CODE_CHARS[random_int(0, strlen(CODE_CHARS) - 1)]; $q = $d->prepare('SELECT 1 FROM rooms WHERE id = ?'); $q->execute([$id]); if (!$q->fetch()) break; }
      $d->prepare('INSERT INTO rooms (id, host, st, ver, updated, created) VALUES (?, ?, ?, 1, ?, ?)')->execute([$id, $u['uid'], json_encode($st, JSON_UNESCAPED_UNICODE), time(), time()]);
      out(obView($st, $u['uid'], $id, 1));
    }
    case 'on_join': { // 卓に入る（はじまる前だけ。すでに入っていれば、そのまま）
      $b = body(); $u = authUser($b); $id = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', (string)($b['id'] ?? '')));
      [$st, $ver] = obLoad($id, true);
      $in = false; foreach ($st['seats'] as $s) if (($s['uid'] ?? '') === $u['uid']) $in = true;
      if (!$in) {
        if ($st['phase'] !== 'lobby') { db()->exec('ROLLBACK'); fail('この卓はもう始まっています'); }
        if (count($st['seats']) >= $st['cfg']['n']) { db()->exec('ROLLBACK'); fail('この卓は満員です'); }
        $st['seats'][] = array_merge(obSeatInfo($b), ['uid' => $u['uid'], 'miss' => 0]); $ver++; obSave($id, $st, $ver);
      }
      db()->exec('COMMIT'); out(obView($st, $u['uid'], $id, $ver));
    }
    case 'on_state': { // いまの様子（1〜2秒ごとに読む）。時間切れ・AIの手はここで進める
      $b = body(); $u = authUser($b); $id = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', (string)($b['id'] ?? '')));
      [$st, $ver] = obLoad($id, true);
      if (obTick($st, microtime(true))) { $ver++; obSave($id, $st, $ver); }
      db()->exec('COMMIT');
      if ((int)($b['ver'] ?? 0) === $ver) out(['ok' => true, 'same' => true, 'ver' => $ver, 'now' => microtime(true)]);
      out(obView($st, $u['uid'], $id, $ver));
    }
    case 'on_act': { // 自分の手：play（vals）/ draw / back（AIの代打ちから戻る）/ chat（ひとこと）/ addai・kick・start（ホスト）/ leave
      $b = body(); $u = authUser($b); $id = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', (string)($b['id'] ?? ''))); $act = (string)($b['act'] ?? '');
      [$st, $ver] = obLoad($id, true); $now = microtime(true); obTick($st, $now);
      $me = -1; foreach ($st['seats'] as $i => $s) if (($s['uid'] ?? '') === $u['uid']) $me = $i;
      $host = $me === 0; $err = null;
      if ($act === 'addai') {
        if (!$host || $st['phase'] !== 'lobby') $err = 'ホストだけが、始まる前に追加できます';
        elseif (count($st['seats']) >= $st['cfg']['n']) $err = '満員です';
        else { $k = count(array_filter($st['seats'], fn($s) => !empty($s['ai']))); $st['seats'][] = ['name' => OB_AI_NAMES[$k % 4] . '（AI★2）', 'ai' => true, 'lv' => 2, 'slot' => $k, 'miss' => 0]; }
      } elseif ($act === 'kick') {
        $i = (int)($b['seat'] ?? -1);
        if (!$host || $st['phase'] !== 'lobby' || $i <= 0 || $i >= count($st['seats'])) $err = 'できません'; else array_splice($st['seats'], $i, 1);
      } elseif ($act === 'leave') {
        if ($st['phase'] === 'lobby' && $me > 0) array_splice($st['seats'], $me, 1);
        elseif ($me >= 0 && $st['phase'] === 'play') $st['seats'][$me]['miss'] = 3; // 対局中に抜けたら、AIが代わりに打つ
      } elseif ($act === 'start') {
        if (!$host || $st['phase'] !== 'lobby') $err = 'ホストだけが始められます';
        elseif (count($st['seats']) < 2) $err = '2人以上で始められます';
        else { $n = count($st['seats']); $st['setPP'] = array_fill(0, $n, []); $st['game'] = obNewGame($n, random_int(0, $n - 1)); $st['gameNo'] = 1; $st['phase'] = 'play'; $st['turnAt'] = $now; $st['deadline'] = $now + $st['cfg']['limit'] + 5; }
      } elseif ($act === 'auto') { // 自分の席をAIに任せる（推定実力−1。最低★2・最高★4）
        if ($me < 0 || $st['phase'] === 'lobby') $err = '対局中だけ任せられます'; else { $st['seats'][$me]['auto'] = true; $st['seats'][$me]['subLv'] = max(2, min(4, (int)($b['lv'] ?? 2))); if (obCur($st['game'] ?? ['over' => true]) === $me) $st['turnAt'] = $now - 0.5; }
      } elseif ($act === 'back') {
        if ($me >= 0) { $st['seats'][$me]['miss'] = 0; unset($st['seats'][$me]['auto']); }
      } elseif ($act === 'chat') { // 短いひとこと（30文字まで。ふさわしくない言葉・URL・連絡先ははじく。席の人だけ・2.5秒に1回）
        $t = trim(mb_substr(preg_replace('/[\x00-\x1F\x7F<>]/u', '', (string)($b['text'] ?? '')), 0, 30));
        if ($me < 0) $err = '席についている人だけが送れます';
        elseif ($t === '') $err = 'ひとことを入れてください';
        elseif (!nameOk($t)) $err = 'その言葉は使えません。ほかの言い方にしてください';
        elseif ($now - (float)($st['seats'][$me]['chatAt'] ?? 0) < 2.5) $err = '少し待ってから送ってください';
        else { $st['seats'][$me]['chatAt'] = $now; $cid = (int)($st['chatN'] ?? 0) + 1; $st['chatN'] = $cid; $st['chat'][] = ['id' => $cid, 'p' => $me, 't' => $t, 'at' => (int)$now]; $st['chat'] = array_slice($st['chat'], -20); }
      } elseif ($act === 'play' || $act === 'draw') {
        if ($st['phase'] !== 'play' || $me < 0 || obCur($st['game']) !== $me) $err = 'あなたの番ではありません';
        elseif (($st['seats'][$me]['miss'] ?? 0) >= 3 || !empty($st['seats'][$me]['auto'])) $err = 'AIが代わりに打っています（「自分で打つ」で戻れます）';
        else {
          $vals = $act === 'play' ? array_map('intval', array_slice((array)($b['vals'] ?? []), 0, 3)) : null; $judge = $st['cfg']['judge'] ?? 'before';
          $ok = obApply($st['game'], $vals, 'me');
          if (!$ok && $act === 'play' && $judge !== 'before' && $vals && obHas($st['game']['hands'][$me], $vals)) { obFoul($st['game'], $vals, $judge === 'after2' ? 2 : 3); $ok = true; } // お手つき
          if (!$ok) $err = 'その札では場の数になりません';
          else {
            $st['seats'][$me]['miss'] = 0; $st['turnAt'] = $now; $st['deadline'] = $now + $st['cfg']['limit'] + ($st['game']['pos'] === 0 ? 3 : 0);
            if ($st['game']['over']) { foreach ($st['game']['pp'] as $i => $v) $st['setPP'][$i][] = $v; $st['phase'] = 'between'; $st['nextAt'] = $now + 8; }
            obTick($st, $now);
          }
        }
      } else $err = '知らない操作です';
      if ($err) { db()->exec('ROLLBACK'); fail($err); }
      $ver++; obSave($id, $st, $ver); db()->exec('COMMIT');
      out(obView($st, $u['uid'], $id, $ver));
    }
    default: out(['ok' => true, 'app' => 'keisan-bridge', 'api' => 11]);
  }
} catch (Throwable $e) {
  if (db()->inTransaction()) db()->rollBack();
  error_log('[keisan-bridge] ' . $e->getMessage());
  fail('サーバーでエラーが起きました', 500);
}
