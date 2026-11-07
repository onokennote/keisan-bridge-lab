# 計算ブリッジ作戦研究所（非公式ファン制作）

カードゲーム「計算ブリッジ」（考案：上野晋太郎さん／すうがっくま）を練習・研究するための非公式Webアプリです。
AIの最善手と自分の手を突き合わせながら、練習・大会形式で打てます。

- 公開版（claude.ai アーティファクト）：https://claude.ai/artifact/Mkh8TNciukTYjh41D9YyWD
- 開発の決まりごと：[CLAUDE.md](CLAUDE.md)

## 構成

| パス | 内容 |
| --- | --- |
| `src/` | ソース（ゲームとAI、キャラ、効果音、実況・解説のセリフ、画面、CSS） |
| `build.sh` | `src/` を連結して `dist/artifact.html`（アーティファクト用）と `test/page.html`（テスト用）を作る |
| `deploy.sh` | `dist/index.html`（単体で動く版）を作る。先に `./build.sh` |
| `test/run.js` | 1セット／大会を自動で最後まで打つテスト（Playwright） |
| `test/rv.js` | でたらめ打ち（または `good` で最善手打ち）をして、AI総評を出力 |

## 使い方

```bash
./build.sh
```

```bash
mkdir -p test/out && cd test && node run.js practice
```

- `node run.js tour` … 大会を最後まで
- `node rv.js practice` / `node rv.js tour` … でたらめ打ちの総評
- `node rv.js practice good` … 最善手どおりに打った総評

Playwright（Chromium）が必要です。

## 注意

非公式のファン制作です。公式キャラクター・公式画像は使っていません。
