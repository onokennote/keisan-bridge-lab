#!/bin/bash
# デプロイナウ用：単体で動く dist/index.html を作る（先に ./build.sh）
cd "$(dirname "$0")"
node -e "
const fs=require('fs');
const body=fs.readFileSync('dist/artifact.html','utf8').replace(/<title>[^<]*<\/title>\n?/,'').replace(/<meta name=\"claude:[^>]*>\n?/,'');
const icon=\"data:image/svg+xml,\"+encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\"><rect x=\"8\" y=\"4\" width=\"48\" height=\"56\" rx=\"8\" fill=\"#fbf3dc\" stroke=\"#f2b632\" stroke-width=\"4\"/><text x=\"32\" y=\"44\" text-anchor=\"middle\" font-size=\"32\" font-weight=\"900\" font-family=\"sans-serif\" fill=\"#0b3d2e\">7</text></svg>');
const head='<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><title>計算ブリッジ作戦研究所</title><meta name=\"description\" content=\"カードの数字で式を作って出し切る「計算ブリッジ」を、AIの最善手と突き合わせながら練習できる作戦研究アプリ。\"><meta property=\"og:title\" content=\"計算ブリッジ作戦研究所\"><meta property=\"og:description\" content=\"AIたちと本番そっくりの卓を囲み、自分の手とAIの最善手を突き合わせて、勝ち抜く打ち方を見つけよう。\"><meta property=\"og:type\" content=\"website\"><meta name=\"theme-color\" content=\"#0b1a14\"><link rel=\"icon\" href=\"'+icon+'\"><style>html,body{margin:0;background:#0b1a14}</style></head><body>';
fs.writeFileSync('dist/index.html',head+body+'</body></html>');
"
