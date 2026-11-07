// テスト用ブラウザで Google Fonts を確実に使うための手助け。
// curl でCSSとフォントを tools/.fonts に取り置き、ページからの取得をそのファイルで返す
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = path.join(__dirname, '.fonts'); fs.mkdirSync(dir, { recursive: true });
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
function get(url) {
  const f = path.join(dir, crypto.createHash('md5').update(url).digest('hex'));
  if (!fs.existsSync(f)) execFileSync('curl', ['-sSL', '-A', UA, '-o', f, url]);
  return fs.readFileSync(f);
}
module.exports = async function useFonts(target) {
  await target.route(/fonts\.(googleapis|gstatic)\.com/, route => {
    const u = route.request().url();
    try {
      const body = get(u);
      route.fulfill({ status: 200, body, headers: { 'content-type': /googleapis/.test(u) ? 'text/css' : 'font/woff2', 'access-control-allow-origin': '*' } });
    } catch (e) { route.abort(); }
  });
};
