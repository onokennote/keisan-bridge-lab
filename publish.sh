#!/bin/bash
# 本番（デプロイナウ）に出す：公開専用ブランチ lolipop-deploy を、いまの版で更新して push する
# デプロイナウは lolipop-deploy に push されると自動で本番にデプロイする
set -e
cd "$(dirname "$0")"
API=${KB_CLOUD_API:-https://onoken-web.sakura.ne.jp/kb/api.php}
./build.sh
# 判定（AIの読み・最善手・損失）の自動チェック。矛盾があれば本番に出さない（どうしても出すときは KB_SKIP_JUDGE=1 ./publish.sh）
if [ -z "$KB_SKIP_JUDGE" ]; then
  (cd test && node judge.js quick) || { echo '判定チェックで失敗したので、本番には出しませんでした（test/out/judge_fail.json）'; exit 1; }
fi
# Googleでまもる：GoogleのOAuthクライアントID（公開してよい値。空ならボタンを出さない）。サーバー側は api.php の GOOGLE_CLIENT_ID
GCID=${KB_GOOGLE_CLIENT_ID:-769381686727-qobbdpictds21fl24d6sdcmbs92acp9v.apps.googleusercontent.com}
KB_CLOUD_API="$API" KB_GOOGLE_CLIENT_ID="$GCID" ./deploy.sh
SRC=$(git rev-parse --short HEAD)
WT=$(mktemp -d)
git fetch -q origin lolipop-deploy 2>/dev/null && git worktree add -q "$WT" origin/lolipop-deploy -B lolipop-deploy || git worktree add -q --orphan -b lolipop-deploy "$WT"
cp dist/index.html dist/og.png "$WT/"
# どの版か分かるように、ページに版の印を入れる（ページのソースの <meta name="kb-version"> で確かめられる）
STAMP="$SRC $(TZ=Asia/Tokyo date '+%Y-%m-%d %H:%M')"
sed -i "s|<head>|<head><meta name=\"kb-version\" content=\"$STAMP\">|" "$WT/index.html"
printf '# 公開専用ブランチ\n\n計算ブリッジ作戦研究所（非公式ファン制作）の本番（https://keisan-bridge.lolipop-now.app）に出すファイルだけを置くブランチです。\n手で編集せず、作業ブランチの `./publish.sh` で更新します。\n' > "$WT/README.md"
cd "$WT"
git add -A
git commit -q -m "公開：作業ブランチ $SRC の版（$STAMP）"
git push -q -u origin lolipop-deploy
cd - >/dev/null
git worktree remove --force "$WT"
echo "lolipop-deploy を更新しました（もと：$SRC）"
