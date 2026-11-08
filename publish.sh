#!/bin/bash
# 本番（デプロイナウ）に出す：公開専用ブランチ lolipop-deploy を、いまの版で更新して push する
# デプロイナウは lolipop-deploy に push されると自動で本番にデプロイする
set -e
cd "$(dirname "$0")"
API=${KB_CLOUD_API:-https://onoken-web.sakura.ne.jp/kb/api.php}
./build.sh
KB_CLOUD_API="$API" ./deploy.sh
SRC=$(git rev-parse --short HEAD)
WT=$(mktemp -d)
git fetch -q origin lolipop-deploy 2>/dev/null && git worktree add -q "$WT" origin/lolipop-deploy -B lolipop-deploy || git worktree add -q --orphan -b lolipop-deploy "$WT"
cp dist/index.html dist/og.png "$WT/"
printf '# 公開専用ブランチ\n\n計算ブリッジ作戦研究所（非公式ファン制作）の本番（https://keisan-bridge.lolipop-now.app）に出すファイルだけを置くブランチです。\n手で編集せず、作業ブランチの `./publish.sh` で更新します。\n' > "$WT/README.md"
cd "$WT"
git add -A
if git diff --cached --quiet; then echo "変更なし"; else git commit -q -m "公開：作業ブランチ $SRC の版"; fi
git push -q -u origin lolipop-deploy
cd - >/dev/null
git worktree remove --force "$WT"
echo "lolipop-deploy を更新しました（もと：$SRC）"
