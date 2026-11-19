// 辞書（オンラインの卓・デイリーの大会の画面）
window.I18N_ROWS = (window.I18N_ROWS || []).concat(`
デイリートーナメント #/# 第#部（#:#）	Daily tournament #/# · Session # (#:#)	每日赛 #/# 第#场（#:#）
🃏 予選 #セット×#ゲーム	🃏 Qualifiers: # sets × # games	🃏 预选赛 #盘×#局
🏆 上位#人で決勝	🏆 Final: top #	🏆 前#名进入决赛
出られるのは	You can play	可参加
エントリーは	Entry opens	报名时间
開始の#分前	# min before the start	开始前#分钟
から	from	起
のグループ（空きはAI研究員・AI）	per group (empty seats: AI researchers and AI)	一组（空位由AI研究员和AI填补）
上位#人・#ゲーム	Top # · # games	前#名 · #局
🌐 予選 第#セット・§卓	🌐 Qualifier set # · table §	🌐 预选赛 第#盘 · §桌
🌐 決勝	🌐 Final	🌐 决赛
🤖 @の番（AIが打っています）	🤖 @'s turn (AI is playing)	🤖 @的回合（AI出牌中）
AIが考え中	AI thinking	AI思考中
🤖 AIに任せる	🤖 Let AI play	🤖 交给AI
自分で打つ	Play myself	自己出牌
空いた席をうめるAI	AI filling an empty seat	填补空座的AI
空いた席をうめるAI（ポイント・ランキングなし）	AI filling an empty seat (no points or ranking)	填补空座的AI（无积分·不上榜）
これまでの場札	Field cards so far	之前的场牌
手番の順	Turn order	出牌顺序
ひとことを送る	Send a message	发送一句话
いまの推定実力−#の強さ（最低★#）のAIが代わりに打ちます	An AI one level below your estimated skill (min ★#) plays for you	由比你当前推定实力低#级的AI（最低★#）代打
あなたの番・残り#秒	Your turn · # sec left	你的回合 · 剩#秒
新しい場	New field	新场数
次のゲームまで #秒	Next game in # sec	距下一局#秒
大会の順位へ	To tournament standings	去比赛排名
🏁 セット終了	🏁 Set over	🏁 本盘结束
予選 第#/#セット	Qualifier set #/#	预选赛 第#/#盘
次は 予選 第#セット	Next: qualifier set #	下一盘：预选赛第#盘
次は 決勝	Next: the final	下一盘：决赛
そろったら始まります。準備ができたら押してください	It starts when everyone's ready. Tap when you're ready	大家到齐就开始。准备好了请点击
✋ 準備OK	✋ Ready	✋ 准备好了
準備OK！ ほかの人を待っています（#/#人）	Ready! Waiting for others (#/#)	准备好了！等待其他人（#/#人）
出場する人の準備を待っています（#/#人）	Waiting for players to get ready (#/#)	等待参赛者准备（#/#人）
あと#分#秒で、そろっていなくても始まります（来ていない人の席はAIが打ちます）	Starts in #m #s even if not everyone's ready (AI plays for anyone missing)	#分#秒后即使没到齐也会开始（缺席者由AI代打）
第#セットまでの成績（次は第#セット）	Results through set # (next: set #)	截至第#盘的成绩（下一盘第#盘）
いま第#セットの対局中（全部の卓が終わると反映）	Set # in progress (updated when all tables finish)	第#盘进行中（所有桌结束后更新）
予選の最終成績	Final qualifier results	预选赛最终成绩
最終順位	Final standings	最终排名
⏳ ほかの卓が終わるのを待っています	⏳ Waiting for other tables to finish	⏳ 等待其他桌结束
終わった卓 #/#。全部の卓が終わると、このセットの成績が順位に入り、次へ進みます。	Finished tables: #/#. When all tables finish, this set's results go into the standings and we move on.	已结束的桌 #/#。所有桌结束后，本盘成绩计入排名并进入下一步。
終わった卓 #/#。全部の卓が終わると、このセットの成績が順位に入り、決勝の順位が決まります。	Finished tables: #/#. When all tables finish, this set's results go into the standings and the final ranking is decided.	已结束的桌 #/#。所有桌结束后，本盘成绩计入排名并决定决赛名次。
🏆 決勝の対局中です	🏆 The final is in progress	🏆 决赛进行中
決勝の卓が終わると、順位が決まります。下の「観戦する卓を選ぶ」から決勝を見られます。	The ranking is decided when the final table finishes. You can watch the final from "Choose a table to watch" below.	决赛桌结束后决定名次。可以从下面的「选择观战的桌」观看决赛。
・セットPP #	· Set PP #	· 本盘PP #
このゲーム PP #	This game PP #	本局 PP #
📋 順位	📋 Standings	📋 排名
💬	💬	💬
対局中	Playing	对局中
決勝進出	To final	进入决赛
うーん…	Hmm…	嗯…
やった！	Yes!	太好了！
これでどうや	How's this	这样如何
計算どおり	As calculated	正如计算
しまった	Oops	糟糕
いけっ	Go!	上！
ふふん	Heh	哼哼
引くしかないか…	Guess I have to draw…	只能摸牌了…
むむ…	Hmm…	唔…
ここは引く	Drawing here	这里摸牌
`.split('\n').filter(Boolean).map(l => l.split('\t')));
