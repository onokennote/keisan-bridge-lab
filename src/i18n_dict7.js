// 辞書（対局中の帯・AIの読みの理由・候補の手）。§ は式や手札のかたまり
window.I18N_ROWS = (window.I18N_ROWS || []).concat(`
第#セット開始	Set # begins	第#盘开始
席は抽選で決まりました。あなたは第#卓（#人）	Seats were drawn. You're at table # (# players)	座位已抽签决定。你在第#桌（#人）
席替えで第#卓（#人）へ	New seats: table # (# players)	换座位：第#桌（#人）
運命の最終セット	The fateful final set	命运的最后一盘
予選 最終ゲーム	Qualifiers: last game	预选赛最后一局
決勝戦 開幕	The final begins	决赛开幕
このセットのPPだけで優勝が決まる	Only this set's PP decides the winner	只靠这一盘的PP决定冠军
決勝 最終ゲーム	Final: last game	决赛最后一局
あなたは暫定#位・決勝圏内	You're provisionally #th · in the final zone	你暂列第#名 · 在决赛圈内
あなたは暫定#位・決勝ラインまであと#点	You're provisionally #th · # pts to the final line	你暂列第#名 · 距决赛线还差#分
@が上がりました！	@ went out!	@出完了！
あなたのPP：	Your PP:	你的PP：
結果を見る	See results	查看结果
最終結果へ	To final results	查看最终结果
これで上がり！	This goes out!	这样就出完了！
連続最善の自己ベスト更新中：#	New best-move streak record: #	连续最佳刷新个人纪录中：#
決勝進出！ ただしこの大会でAIの読みを見たか、待ったを使ったため、大会のバッジは対象外です	You reached the final! But you saw the AI reading or used Undo in this tournament, so tournament badges don't count	进入决赛！但本次比赛看过AI分析或用过悔棋，所以不计比赛徽章
・#枚出し（§）もありましたが、あえて#枚。上がる確率は#%→#%です。	· A #-card play (§) was possible, but you chose #. Chance of going out: #%→#%.	· 也可以出#张（§），但故意出了#张。出完概率#%→#%。
・#枚出し（§）もありましたが、あえて#枚。残り札で作れる場の数が#通り→#通りと、次の巡の対応力が違います。	· A #-card play (§) was possible, but you chose #. Fields you can make with what's left: # → #, a big difference for the next round.	· 也可以出#张（§），但故意出了#张。剩余牌能凑的场数从#种→#种，下一巡的应对能力不同。
・場が#と大きい巡は、大きい札をまとめて処分できる好機。「§」でしっかり活かしました。	· A big field like # is a chance to unload big cards together. "§" made the most of it.	· 场数#这样大的巡是集中处理大牌的好机会。「§」充分利用了这一点。
・残り#枚は#面待ち。次の番で上がれる確率は約#%です。	· Your last # cards wait on # fields. Chance to go out next turn: about #%.	· 剩下的#张是#面听牌。下一轮出完的概率约#%。
・@が残り#枚の場面で、合計#点分を処分。上がられても傷を浅くする、正しい優先順位です。	· With @ down to # cards, you unloaded # points. Keeping the damage small if they go out is the right priority.	· 在@只剩#张时，处理掉了合计#分。即使被出完也能减少损失，优先顺序正确。
・#枚残し。上がれるのは場が#のときだけ（約#%）ですが、手札の合計は#まで軽くなりました。	· Keeping # card. You go out only if the field is # (about #%), but your hand total dropped to #.	· 留#张。只有场数为#时才能出完（约#%），但手牌合计降到了#。
手札 §	Hand §	手牌 §
場 #	Field #	场上 #
相手 @ #枚	Opponents @ #	对手 @ #张
@ #枚	@ #	@ #张
@ #枚。	@ #.	@ #张。
相手	Opponents	对手
大きい札§を処分：残りPPは#	Unload big cards §: remaining PP #	处理大牌§：剩余PP #
§ を出す	Play §	出 §
アウツ（来たら上がれる場）：§ の#つ。見えていない札のうち#枚（約#%）	Outs (fields that let you go out): § (#). # of the unseen cards (about #%)	听牌（来了就能出完的场数）：§，共#种。看不见的牌中有#张（约#%）
候補 #手を約#回シミュレーション（#ms）。	Simulated # candidate moves about # times (# ms).	模拟了#个候选着法约#次（#ms）。
並びは「総合評価」順：優勝率を主に、差が小さいときは上がり率と期待PPも加味します。数%の差は誤差の範囲です。	Sorted by "overall score": mainly chance of winning; when close, chance of going out and expected PP also count. A few % is within the margin of error.	按「综合评价」排序：以夺冠概率为主，差距小时也考虑出完概率和期望PP。几个百分点的差距在误差范围内。
並びは「総合評価」順：決勝進出率を主に、差が小さいときは上がり率と期待PPも加味します。数%の差は誤差の範囲です。	Sorted by "overall score": mainly chance of reaching the final; when close, chance of going out and expected PP also count. A few % is within the margin of error.	按「综合评价」排序：以进入决赛概率为主，差距小时也考虑出完概率和期望PP。几个百分点的差距在误差范围内。
並びは「総合評価」順：セット期待点を主に、差が小さいときは上がり率と期待PPも加味します。数%の差は誤差の範囲です。	Sorted by "overall score": mainly expected set points; when close, chance of going out and expected PP also count. A few % is within the margin of error.	按「综合评价」排序：以本盘期望分为主，差距小时也考虑出完概率和期望PP。几个百分点的差距在误差范围内。
このセットの順位ごとの決勝進出率（推定）：#位 #% / #位 #% / #位 #% / #位 #% / #位 #%	Chance of reaching the final by set rank (est.): #st #% / #nd #% / #rd #% / #th #% / #th #%	本盘各名次进入决赛的概率（估计）：第#名 #% / 第#名 #% / 第#名 #% / 第#名 #% / 第#名 #%
このセットの順位ごとの決勝進出率（推定）：#位 #% / #位 #% / #位 #% / #位 #%	Chance of reaching the final by set rank (est.): #st #% / #nd #% / #rd #% / #th #%	本盘各名次进入决赛的概率（估计）：第#名 #% / 第#名 #% / 第#名 #% / 第#名 #%
総合＝決勝進出率（%）÷#×# ＋ 上がり（%）×# − 期待PP×#（#%はこのセットを#位で終えたときの決勝進出率）。「最善扱い」＝最善との差が誤差の範囲（#巡目は#pt以内）	Overall = chance of final (%) ÷ # × # + going out (%) × # − expected PP × # (#% is the chance of reaching the final if you finish this set #st). "Counted as best" = within the margin of error of the best (round #: within # pt)	综合＝进入决赛概率（%）÷#×# ＋ 出完（%）×# − 期望PP×#（#%是本盘第#名结束时的进入决赛概率）。「按最佳计」＝与最佳的差在误差范围内（第#巡在#pt以内）
総合＝決勝進出率（%）÷#×# ＋ 上がり（%）×# − 期待PP×#（#%はこのセットを#位で終えたときの決勝進出率）。「最善扱い」＝最善との差が誤差の範囲（#pt以内）	Overall = chance of final (%) ÷ # × # + going out (%) × # − expected PP × # (#% is the chance of reaching the final if you finish this set #st). "Counted as best" = within the margin of error of the best (within # pt)	综合＝进入决赛概率（%）÷#×# ＋ 出完（%）×# − 期望PP×#（#%是本盘第#名结束时的进入决赛概率）。「按最佳计」＝与最佳的差在误差范围内（#pt以内）
損失pt＝最善手との総合評価の差（決勝進出率を#点満点とし、上がり率と期待PPを少し加味）。#pt以内は誤差として最善扱い。	Loss pt = difference in overall score from the best move (chance of final out of #, with a little weight on going out and expected PP). Within # pt counts as best (margin of error).	损失pt＝与最佳着法的综合评价差（进入决赛概率满分#分，稍加考虑出完概率和期望PP）。#pt以内视为误差，按最佳计。
損失pt＝最善手との総合評価の差（優勝率を#点満点とし、上がり率と期待PPを少し加味）。#pt以内は誤差として最善扱い。	Loss pt = difference in overall score from the best move (chance of winning out of #, with a little weight on going out and expected PP). Within # pt counts as best (margin of error).	损失pt＝与最佳着法的综合评价差（夺冠概率满分#分，稍加考虑出完概率和期望PP）。#pt以内视为误差，按最佳计。
・ 前の手 §	· Last play §	· 上一手 §
・ 前の手 #	· Last play #	· 上一手 #
（上がり！）	(out!)	（出完！）
第#セット #位（+#点）	Set # · #th (+# pts)	第#盘 第#名（+#分）
第#卓（@）	Table # (@)	第#桌（@）
次のセットへ（席替え）	Next set (new seats)	下一盘（换座位）
相手：§	Opponents: §	对手：§
あなたが優勝！	You won!	你夺冠了！
優勝！ ただしこの大会でAIの読みを見たか、待ったを使ったため、大会のバッジは対象外です	Champion! But you saw the AI reading or used Undo in this tournament, so tournament badges don't count	夺冠！但本次比赛看过AI分析或用过悔棋，所以不计比赛徽章
席替えで第#卓（#人）へ	New seats: table # (# players)	换座位：第#桌（#人）
あなたは予選#位で惜しくも敗退。決勝の行方を見届けましょう。	You finished #th in the qualifiers, just missing the final. Let's watch how the final goes.	你在预选赛获得第#名，遗憾止步。一起看看决赛的走向吧。
決勝の結果を見る	See the final results	查看决赛结果
予選の最終順位を見る	See the final qualifier standings	查看预选赛最终排名
AIの読みを見たので、このゲームは結果のバッジの対象外です。	You saw the AI reading, so this game doesn't count for result badges.	看过AI分析，所以本局不计成绩徽章。
判断は最善なので、PPが大きかったのは運の巡り合わせです。	Your decisions were the best, so the high PP was just luck.	判断是最佳的，PP高只是运气不好。
判断は次善もありましたが、結果は期待より良く「結果オーライ」です。	Some decisions were second-best, but the result beat expectations. It worked out.	判断中有次佳的，但结果比预期好，算是「结果不错」。
このゲームは判定できる場面がありませんでした（「引く」しかない局面とお手つきのみ）。	There was nothing to judge this game (only forced draws and fouls).	本局没有可判定的场面（只有不得不摸牌的局面和犯规）。
このゲームは選択肢のある場面がありませんでした（すべて「引く」しかない局面）。	There were no real choices this game (every turn was a forced draw).	本局没有可选择的场面（全部是只能摸牌的局面）。
お手つきが#回ありました（ペナルティで計#枚）。	There were # foul(s) (# penalty card(s) in total).	犯规#次（共罚#张）。
出せる場面で#回あえて引きました（うち最善判定 #回）。	You drew on purpose # time(s) when you could play (# judged best).	能出牌时故意摸牌#次（其中判定为最佳#次）。
最後の判断時点の期待PPは#、実際は#でした。	Expected PP at your last decision was #; actual was #.	最后一次判断时的期望PP是#，实际是#。
@の上がり！	@ went out!	@出完了！
@はこのゲーム#位	@ placed #th this game	@本局第#名
おおむね良い判断です（#回中#回が最善）。差がついた場面を表で確認しましょう。	Mostly good decisions (# of # best). Check the turning points in the table.	判断大体不错（#次中#次最佳）。在表中确认拉开差距的场面吧。
予選 第#セット	Qualifier set #	预选赛 第#盘
判断はほぼAIの最善手どおりで、結果もついてきました（#回中#回が最善）。	Your decisions nearly matched the AI's best, and the result followed (# of # best).	判断几乎都和AI的最佳着法一致，结果也跟上了（#次中#次最佳）。
判断はほぼAIの最善手どおりでした（#回中#回が最善）。結果は振るいませんでしたが、確率的には正しい打ち方です。	Your decisions nearly matched the AI's best (# of # best). The result wasn't great, but by the odds you played correctly.	判断几乎都和AI的最佳着法一致（#次中#次最佳）。结果虽不理想，但从概率上看是正确的打法。
改善の余地があります（#回中#回が最善）。「損失」が大きい巡を見直すのがおすすめです。	There's room to improve (# of # best). Review the rounds with large "loss".	还有改进空间（#次中#次最佳）。建议回顾「损失」大的回合。
選んだ手はAIの最善手どおりでした（#回中#回が最善）。ただ、お手つきで札が増えたのが響きました。出す前に、式が場の数になるかを確かめましょう。	Your moves matched the AI's best (# of # best), but fouls added cards to your hand. Check the formula equals the field number before playing.	所选着法与AI的最佳着法一致（#次中#次最佳）。但犯规让手牌增加了。出牌前确认算式是否等于场上数字吧。
練習	Practice	练习
損失pt＝最善手との総合評価の差（セット期待点を#点満点とし、上がり率と期待PPを少し加味）。#pt以内は誤差として最善扱い。	Loss pt = difference in overall score from the best move (expected set points scaled to #, with a little weight on going out and expected PP). Within # pt counts as best (margin of error).	损失pt＝与最佳着法的综合评价差（本盘期望分按满分#分计，稍加考虑出完概率和期望PP）。#pt以内视为误差，按最佳计。
損失pt＝最善手との総合評価の差（勝ち抜け率を#点満点とし、上がり率と期待PPを少し加味）。#pt以内は誤差として最善扱い。	Loss pt = difference in overall score from the best move (chance of advancing out of #, with a little weight on going out and expected PP). Within # pt counts as best (margin of error).	损失pt＝与最佳着法的综合评价差（晋级概率满分#分，稍加考虑出完概率和期望PP）。#pt以内视为误差，按最佳计。
理由と候補	Reasons & options	理由与候选
損失 #pt	Loss #pt	损失 #pt
総合評価	overall score	综合评价
`.split('\n').filter(Boolean).map(l => l.split('\t')));
