# クラウド保存・ランキング用API（さくらのレンタルサーバー用）

公開版（ロリポップ！デプロイナウ）の「クラウド保存」「引き継ぎコード」「ランキング」を受け持つ、PHP 1ファイルのAPIです。
データベースは SQLite（ファイル1つ）なので、データベースの作成は不要です。

## 置き方（さくらのレンタルサーバー）

1. サーバーに、公開フォルダの中に `kb` フォルダを作る（例：`~/www/kb/`）
2. `api.php` を `~/www/kb/` に置く
3. `config.sample.php` を `config.php` という名前にして、同じ `~/www/kb/` に置く
   - `db`：データベースのファイルの場所。**公開フォルダの外**にする（初期値は `~/kb_data/kb.sqlite` になるように `__DIR__ . '/../../kb_data/kb.sqlite'`）
   - `origins`：このAPIを使ってよいサイト。公開版のURL（`https://keisan-bridge.lolipop-now.app`）
4. ブラウザで `https://（あなたのドメイン）/kb/api.php` を開き、`{"ok":true,"app":"keisan-bridge","api":1}` と出れば準備完了
   - このとき `~/kb_data/kb.sqlite` が自動で作られる
5. 公開版を作るときに、APIのURLを渡す

```bash
./build.sh
```

```bash
KB_CLOUD_API=https://（あなたのドメイン）/kb/api.php ./deploy.sh
```

`KB_CLOUD_API` を渡さずに作った公開版は、これまでどおり端末の中だけに保存します（クラウド・ランキングは出ません）。

## しくみ

- **アカウント**：はじめて開いたときに、名前もメールもなしの匿名アカウントが自動でできる。端末には「鍵」（トークン）だけを置く
- **引き継ぎコード**：`XXXX-XXXX-XXXX`（12文字）。別の端末で入れると同じ記録に入れる（「プレイヤー」→「クラウド保存」）。両方の端末で使い続けられる
- **保存**：記録はまるごとクラウドへ（変更があると数秒後・画面を閉じるとき）。ほかの端末がもっと新しい記録を保存していたら上書きせず、新しいほうを読み込む
- **ランキング**：推定実力・バッジ数（同数はBP）・バッジアタックの自己ベスト。プレイヤーごとに「ランキングに載せない」を選べる
- **名前**：NGワード・URL・電話番号らしいものを含む名前は、ランキングでは「研究員○○」と表示
- **ズル対策**：厳密ではない（ありえない値ははじく程度）

## 試す（手元）

`test/cloud.js` が、PHPの内蔵サーバーでこのAPIを動かして通しで確かめます。

```bash
cd test && node cloud.js
```

## 自動で送る（GitHub Actions）

`server/api.php` を変えて作業ブランチに push すると、`.github/workflows/sakura-api.yml` が SFTP で `~/www/kb/api.php` に送り、
`api.php` を開いてバージョン（`"api":○`）が新しくなったかまで確かめます。`config.php` とデータベースは送りません。

使えるようにするには、GitHub のリポジトリの Settings → Secrets and variables → Actions → New repository secret で3つを登録します。

- `SAKURA_HOST`：`onoken-web.sakura.ne.jp`
- `SAKURA_USER`：さくらのアカウント名（例：`onoken-web`）
- `SAKURA_PASSWORD`：サーバーパスワード

登録するまでは、送る手順は飛ばされます（失敗にはなりません）。結果は GitHub の Actions タブで見られます。手で動かすときは、Actions → 「さくらにAPIを送る」→ Run workflow。
