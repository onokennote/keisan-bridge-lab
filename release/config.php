<?php
// config.php にコピーして使う（api.php と同じフォルダ）
return [
  // データベースのファイル。公開フォルダ（www など）の外に置く
  'db' => __DIR__ . '/../../kb_data/kb.sqlite',
  // このAPIを使ってよいサイト（公開版のURL）
  // 試験用のプロジェクト（kblab-test-7q）でも使えるようにしている。本番に移ったら消してよい
  'origins' => ['https://keisan-bridge.lolipop-now.app', 'https://kblab-test-7q.lolipop-now.app'],
];
