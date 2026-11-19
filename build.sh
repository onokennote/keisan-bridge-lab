#!/bin/bash
cd "$(dirname "$0")/src"
{
echo '<title>計算ブリッジ作戦研究所</title>'
echo '<meta name="claude:viewport-fit-sides" content="cover">'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=JetBrains+Mono:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;700;900&family=Noto+Sans+SC:wght@400;700;900&family=Noto+Serif+SC:wght@900&family=Fredoka:wght@500;700&family=ZCOOL+QingKe+HuangYou&family=Baloo+2:wght@500;800&family=Noto+Sans+Devanagari:wght@400;700&display=swap">'
echo '<style>'; cat app.css; echo '</style>'
echo '<div id="app"></div>'
echo '<script>'; echo "window.KB_BUILD='$(cat engine.js avatar.js chars.js sound.js lines_*.js commentary.js i18n*.js app.js app.css | md5sum | cut -c1-10)';"; cat engine.js; echo; cat avatar.js; echo; cat chars.js; echo; cat sound.js; echo; cat lines_root.js; echo; cat lines_masa.js; echo; cat lines_more_root.js; echo; cat lines_more_masa.js; echo; cat lines_scene.js; echo; cat lines_extra.js; echo; cat lines_luck.js; echo; cat lines_table.js; echo; cat lines_philo.js; echo; cat lines_v4.js; echo; cat lines_attack.js; echo; cat commentary.js; echo; cat i18n_names.js; echo; cat i18n_dict.js; echo; cat i18n_dict2.js; echo; cat i18n_dict3.js; echo; cat i18n_dict4.js; echo; cat i18n_dict5.js; echo; cat i18n_dict6.js; echo; cat i18n_dict7.js; echo; cat i18n_dict8.js; echo; cat i18n_dict9.js; echo; cat i18n_dict10.js; echo; cat i18n_dict11.js; echo; cat i18n_dict12.js; echo; cat i18n_dict13.js; echo; cat i18n_dict14.js; echo; cat i18n_dict15.js; echo; cat i18n_dict16.js; echo; cat i18n_dict17.js; echo; cat i18n_dict18.js; echo; cat i18n_lines.js; echo; cat i18n_tips.js; echo; cat i18n_hi.js; echo; cat i18n_hi2.js; echo; cat i18n.js; echo; cat app.js; echo '</script>'
} > ../dist/artifact.html
node -e "const fs=require('fs');fs.writeFileSync(require('path').join(process.cwd(),'../test/page.html'),'<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><script>window.KB_TEST=1</'+'script></head><body>'+fs.readFileSync('../dist/artifact.html','utf8')+'</body></html>')"
