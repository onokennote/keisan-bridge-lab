#!/bin/bash
cd "$(dirname "$0")/src"
{
echo '<title>計算ブリッジ作戦研究所</title>'
echo '<meta name="claude:viewport-fit-sides" content="cover">'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=JetBrains+Mono:wght@500;700&family=Zen+Kaku+Gothic+New:wght@400;700;900&display=swap">'
echo '<style>'; cat app.css; echo '</style>'
echo '<div id="app"></div>'
echo '<script>'; echo "window.KB_BUILD='$(cat engine.js avatar.js chars.js sound.js lines_*.js commentary.js app.js app.css | md5sum | cut -c1-10)';"; cat engine.js; echo; cat avatar.js; echo; cat chars.js; echo; cat sound.js; echo; cat lines_root.js; echo; cat lines_masa.js; echo; cat lines_more_root.js; echo; cat lines_more_masa.js; echo; cat lines_scene.js; echo; cat lines_extra.js; echo; cat lines_luck.js; echo; cat lines_table.js; echo; cat lines_philo.js; echo; cat lines_v4.js; echo; cat lines_attack.js; echo; cat commentary.js; echo; cat app.js; echo '</script>'
} > ../dist/artifact.html
node -e "const fs=require('fs');fs.writeFileSync(require('path').join(process.cwd(),'../test/page.html'),'<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><script>window.KB_TEST=1</'+'script></head><body>'+fs.readFileSync('../dist/artifact.html','utf8')+'</body></html>')"
