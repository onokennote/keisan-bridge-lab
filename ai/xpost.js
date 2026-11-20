// Xへの投稿（@keisan_bridge_l）：サーバーの待ち行列（x_tick）から文を受け取り、X API v2 で投稿して x_done で印を付ける
// 必要な環境変数：KB_API・KB_ADMIN_KEY（サーバー）、X_API_KEY・X_API_SECRET・X_ACCESS_TOKEN・X_ACCESS_SECRET（X。GitHub の Secrets）
// Xの鍵がないときは投稿せず、文を表示するだけ（印も付けない）。node ai/xpost.js list で最近の控えを表示
const crypto = require('crypto');
const API = process.env.KB_API || 'https://onoken-web.sakura.ne.jp/kb/api.php', KEY = process.env.KB_ADMIN_KEY || '';
const X = { ck: process.env.X_API_KEY, cs: process.env.X_API_SECRET, at: process.env.X_ACCESS_TOKEN, as: process.env.X_ACCESS_SECRET };
const hasX = X.ck && X.cs && X.at && X.as;
async function api(a, body) {
  const r = await fetch(API + '?a=' + a, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ key: KEY }, body || {})) });
  const j = await r.json(); if (!j.ok) throw new Error(a + ': ' + (j.error || r.status)); return j;
}
// OAuth 1.0a（ユーザーの鍵で投稿）。JSON の本文は署名に入れない
const pe = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function oauth(method, url) {
  const o = { oauth_consumer_key: X.ck, oauth_nonce: crypto.randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: X.at, oauth_version: '1.0' };
  const base = [method, pe(url), pe(Object.keys(o).sort().map(k => pe(k) + '=' + pe(o[k])).join('&'))].join('&');
  o.oauth_signature = crypto.createHmac('sha1', pe(X.cs) + '&' + pe(X.as)).update(base).digest('base64');
  return 'OAuth ' + Object.keys(o).sort().map(k => pe(k) + '="' + pe(o[k]) + '"').join(', ');
}
async function tweet(text) {
  const url = 'https://api.x.com/2/tweets';
  const r = await fetch(url, { method: 'POST', headers: { Authorization: oauth('POST', url), 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data) return { ok: false, res: r.status + ' ' + JSON.stringify(j).slice(0, 180), retry: r.status === 429 || r.status === 402 || r.status >= 500 }; // 402＝Xのクレジット切れ：文は残して、入ったら次の回に出す
  return { ok: true, res: j.data.id };
}
(async () => {
  if (!KEY) { console.log('KB_ADMIN_KEY がありません'); process.exit(1); }
  if (process.argv[2] === 'list') { const j = await api('x_list'); j.posts.forEach(p => console.log(`#${p.id} [${p.kind}] posted=${p.posted} ${p.res || ''}\n${p.text}\n`)); return; }
  const j = await api('x_tick', { max: 4, redo: process.env.X_REDO || '' }); // X_REDO：まだ出していない文を作り直す（例 daily:20261120）
  console.log(`投稿待ち ${j.posts.length}件（きょうの残り ${j.left}件）${hasX ? '' : '・Xの鍵がないので表示だけ'}`);
  const done = [];
  for (const p of j.posts) {
    console.log(`--- #${p.id} [${p.kind}]\n${p.text}`);
    if (!hasX) continue;
    const r = await tweet(p.text); console.log(r.ok ? `→ 投稿しました（${r.res}）` : `→ 失敗：${r.res}`);
    if (r.ok || !r.retry) done.push({ id: p.id, ok: r.ok, res: r.res }); // 混雑・Xの不調は次の回にもう一度
    if (!r.ok && r.retry) break;
    await new Promise(res => setTimeout(res, 3000));
  }
  if (done.length) await api('x_done', { done });
})().catch(e => { console.error(e.message); process.exit(1); });
