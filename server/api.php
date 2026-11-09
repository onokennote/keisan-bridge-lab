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
  $pdo->exec('CREATE TABLE IF NOT EXISTS ai_data (cid TEXT PRIMARY KEY, data TEXT, updated INTEGER NOT NULL)'); // AI研究員の記録（毎日の自動対局で育てる）
  return $pdo;
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 見まちがえやすい I・O・0・1 は使わない
function newCode(): string { $s = ''; for ($i = 0; $i < 12; $i++) $s .= CODE_CHARS[random_int(0, strlen(CODE_CHARS) - 1)]; return implode('-', str_split($s, 4)); }
function normCode(string $c): string { $c = strtoupper(preg_replace('/[^0-9A-Za-z]/', '', mb_convert_kana($c, 'a'))); return implode('-', str_split($c, 4)); }
function h(string $s): string { return hash('sha256', $s); }
function body(): array { global $CFG; $raw = file_get_contents('php://input', false, null, 0, $CFG['max_data'] + 4096); $j = json_decode($raw ?: '{}', true); return is_array($j) ? $j : []; }
function authUser(array $b): array {
  $t = (string)($b['token'] ?? ''); if (strlen($t) < 32) fail('ログインが必要です', 401);
  $st = db()->prepare('SELECT u.* FROM tokens t JOIN users u ON u.uid = t.uid WHERE t.token_hash = ?'); $st->execute([h($t)]); $u = $st->fetch();
  if (!$u) fail('ログインが切れました', 401);
  return $u;
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
  return json_encode(['ach' => $ach, 'champion' => $n('champion', 100000), 'qualify' => $n('qualify', 100000), 'atkBadges' => $n('atkBadges', 500), 'hunt' => $n('hunt', 5000), 'zukan' => $n('zukan', 5000), 'streak' => $n('streak', 100000), 'outs5' => $n('outs5', 100000)], JSON_UNESCAPED_UNICODE);
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
    case 'save': { // 記録をまるごと保存し、ランキング用の数字（プレイヤーごと）も更新する
      $b = body(); $u = authUser($b);
      $data = $b['data'] ?? null; if (!is_array($data)) fail('データがありません');
      $json = json_encode($data, JSON_UNESCAPED_UNICODE); if (strlen($json) > $CFG['max_data']) fail('データが大きすぎます', 413);
      $at = (int)($b['at'] ?? time() * 1000);
      // ほかの端末がもっと新しい記録を保存していたら、上書きしない（古い端末の控えで消さないため）
      $base = (int)($b['base'] ?? 0);
      if ((int)$u['data_at'] > $base && empty($b['force'])) out(['ok' => false, 'conflict' => true, 'at' => (int)$u['data_at'], 'error' => 'ほかの端末の記録のほうが新しいです'], 409);
      $d = db(); $d->beginTransaction();
      $d->prepare('UPDATE users SET data = ?, data_at = ?, seen = ? WHERE uid = ?')->execute([$json, $at, time(), $u['uid']]);
      $pids = [];
      foreach (array_slice((array)($b['stats'] ?? []), 0, 12) as $s) {
        $pid = substr(preg_replace('/[^a-z0-9]/i', '', (string)($s['pid'] ?? '')), 0, 24); if ($pid === '') continue; $pids[] = $pid;
        // ズルを厳密には防がないが、ありえない値ははじく
        $rating = isset($s['rating']) && is_numeric($s['rating']) ? max(0, min(6, (float)$s['rating'])) : null;
        $badges = max(0, min(500, (int)($s['badges'] ?? 0))); $bp = max(0, min(20000, (int)($s['bp'] ?? 0))); $atk = max(0, min(5000, (int)($s['atk'] ?? 0))); $streak = max(0, min(2000, (int)($s['streak'] ?? 0)));
        $av = isset($s['avatar']) ? substr(json_encode($s['avatar'], JSON_UNESCAPED_UNICODE), 0, 1500) : null;
        // 名前を新しく付ける・変えるときに、ほかの人がもう使っていれば「研究員○○」にする（前から同じ名前なら、そのまま）
        $want = safeName((string)($s['name'] ?? ''), $u['uid'], $pid);
        $cs = $d->prepare('SELECT name FROM ranks WHERE uid = ? AND pid = ?'); $cs->execute([$u['uid'], $pid]); $cur = $cs->fetch();
        if ((!$cur || $cur['name'] !== $want) && strpos($want, '研究員') !== 0 && nameTaken($want, $u['uid'], $pid)) $want = '研究員' . strtoupper(substr(h($u['uid'] . $pid), 0, 3));
        $d->prepare('INSERT INTO ranks (uid, pid, name, shown, rating, badges, bp, atk, avatar, bio, card, streak, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid, pid) DO UPDATE SET name=excluded.name, shown=excluded.shown, rating=excluded.rating, badges=excluded.badges, bp=excluded.bp, atk=excluded.atk, avatar=excluded.avatar, bio=excluded.bio, card=excluded.card, streak=excluded.streak, updated=excluded.updated')
          ->execute([$u['uid'], $pid, $want, empty($s['hide']) ? 1 : 0, $rating, $badges, $bp, $atk, $av, safeBio((string)($s['bio'] ?? '')), safeCard($s['card'] ?? null), $streak, time()]);
      }
      // 消したプレイヤーはランキングからも消す
      if ($pids) { $q = implode(',', array_fill(0, count($pids), '?')); $d->prepare("DELETE FROM ranks WHERE uid = ? AND pid NOT IN ($q)")->execute(array_merge([$u['uid']], $pids)); }
      $d->commit();
      out(['ok' => true, 'at' => $at]);
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
      out(['ok' => true, 'list' => array_map(fn($r) => ['cid' => $r['cid'], 'data' => json_decode((string)$r['data'], true), 'updated' => (int)$r['updated']], db()->query('SELECT cid, data, updated FROM ai_data ORDER BY updated')->fetchAll())]);
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
        out(['ok' => true, 'card' => array_merge($r['card'] ? json_decode($r['card'], true) : ['ach' => []], ['name' => $r['name'], 'rating' => $r['rating'] !== null ? round((float)$r['rating'], 2) : null, 'atk' => (int)$r['atk'], 'avatar' => $r['avatar'] ? json_decode($r['avatar'], true) : null, 'bio' => (string)($r['bio'] ?? ''), 'ai' => !empty($r['ai'])])]);
      }
      fail('見つかりません', 404);
    }
    default: out(['ok' => true, 'app' => 'keisan-bridge', 'api' => 8]);
  }
} catch (Throwable $e) {
  if (db()->inTransaction()) db()->rollBack();
  error_log('[keisan-bridge] ' . $e->getMessage());
  fail('サーバーでエラーが起きました', 500);
}
