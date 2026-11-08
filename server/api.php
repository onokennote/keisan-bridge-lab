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
        $badges = max(0, min(500, (int)($s['badges'] ?? 0))); $bp = max(0, min(20000, (int)($s['bp'] ?? 0))); $atk = max(0, min(5000, (int)($s['atk'] ?? 0)));
        $av = isset($s['avatar']) ? substr(json_encode($s['avatar'], JSON_UNESCAPED_UNICODE), 0, 1500) : null;
        $d->prepare('INSERT INTO ranks (uid, pid, name, shown, rating, badges, bp, atk, avatar, bio, card, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid, pid) DO UPDATE SET name=excluded.name, shown=excluded.shown, rating=excluded.rating, badges=excluded.badges, bp=excluded.bp, atk=excluded.atk, avatar=excluded.avatar, bio=excluded.bio, card=excluded.card, updated=excluded.updated')
          ->execute([$u['uid'], $pid, safeName((string)($s['name'] ?? ''), $u['uid'], $pid), empty($s['hide']) ? 1 : 0, $rating, $badges, $bp, $atk, $av, safeBio((string)($s['bio'] ?? '')), safeCard($s['card'] ?? null), time()]);
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
    case 'rankings': { // 4つのランキングをまとめて返す（各上位20人＋20位より下の自分の行）
      $uid = preg_replace('/[^a-f0-9]/', '', (string)($_GET['uid'] ?? '')); $lim = 20; $res = [];
      $defs = ['rating' => ['rating IS NOT NULL', 'rating DESC', fn($r, $m) => $r['rating'] > $m['rating']],
        'badges' => ['badges > 0', 'badges DESC, bp DESC', fn($r, $m) => $r['badges'] > $m['badges'] || ($r['badges'] == $m['badges'] && $r['bp'] > $m['bp'])],
        'bp' => ['bp > 0', 'bp DESC', fn($r, $m) => $r['bp'] > $m['bp']],
        'attack' => ['atk > 0', 'atk DESC', fn($r, $m) => $r['atk'] > $m['atk']]];
      $row = fn($r, $rank) => ['rank' => $rank, 'name' => $r['name'], 'rating' => $r['rating'] !== null ? round((float)$r['rating'], 1) : null, 'badges' => (int)$r['badges'], 'bp' => (int)$r['bp'], 'atk' => (int)$r['atk'], 'avatar' => $r['avatar'] ? json_decode($r['avatar'], true) : null, 'rid' => rid($r['uid'], $r['pid']), 'me' => $uid !== '' && $r['uid'] === $uid];
      foreach ($defs as $type => [$where, $order, $better]) {
        $all = db()->query("SELECT uid, pid, name, rating, badges, bp, atk, avatar FROM ranks WHERE shown = 1 AND $where ORDER BY $order, updated ASC")->fetchAll();
        $list = []; $mine = [];
        foreach ($all as $i => $r) {
          $rank = 1; foreach ($all as $o) { if ($better($o, $r)) $rank++; else break; } // 同じ値は同じ順位
          if ($i < $lim) $list[] = $row($r, $rank); elseif ($uid !== '' && $r['uid'] === $uid) $mine[] = $row($r, $rank);
        }
        $res[$type] = ['list' => $list, 'mine' => $mine, 'total' => count($all)];
      }
      out(['ok' => true, 'rankings' => $res]);
    }
    case 'card': { // ランキングの人の成績カード（自己紹介つき）。rid で指す
      $rid = preg_replace('/[^a-f0-9]/', '', (string)($_GET['rid'] ?? ''));
      foreach (db()->query('SELECT uid, pid, name, rating, badges, bp, atk, avatar, bio, card FROM ranks WHERE shown = 1')->fetchAll() as $r) {
        if (rid($r['uid'], $r['pid']) !== $rid) continue;
        out(['ok' => true, 'card' => array_merge($r['card'] ? json_decode($r['card'], true) : ['ach' => []], ['name' => $r['name'], 'rating' => $r['rating'] !== null ? round((float)$r['rating'], 2) : null, 'atk' => (int)$r['atk'], 'avatar' => $r['avatar'] ? json_decode($r['avatar'], true) : null, 'bio' => (string)($r['bio'] ?? '')])]);
      }
      fail('見つかりません', 404);
    }
    default: out(['ok' => true, 'app' => 'keisan-bridge', 'api' => 3]);
  }
} catch (Throwable $e) {
  if (db()->inTransaction()) db()->rollBack();
  error_log('[keisan-bridge] ' . $e->getMessage());
  fail('サーバーでエラーが起きました', 500);
}
