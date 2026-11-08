<?php
// config.php にコピーして使う（api.php と同じフォルダ）
return [
  // データベースのファイル。公開フォルダ（www など）の外に置く
  'db' => __DIR__ . '/../../kb_data/kb.sqlite',
  // このAPIを使ってよいサイト（公開版のURL）
  'origins' => ['https://keisan-bridge.lolipop-now.app'],
];
