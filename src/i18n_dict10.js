// 辞書（場面の解説・ミニゲームのプレイ画面・バッジアタック）
window.I18N_ROWS = (window.I18N_ROWS || []).concat(`
特別バッジ 皆勤賞	Special badge: Perfect Attendance	特别徽章 全勤奖
特別バッジ 常勝の冠	Special badge: Crown of Victory	特别徽章 常胜之冠
特別バッジ 精密の極み	Special badge: Peak Precision	特别徽章 精密之极
特別バッジ 計算の匠	Special badge: Master Calculator	特别徽章 计算名匠
特別バッジ 神速	Special badge: Godspeed	特别徽章 神速
特別バッジ 確率の賢者	Special badge: Sage of Probability	特别徽章 概率贤者
特別バッジ 時の覇者	Special badge: Ruler of Time	特别徽章 时间霸者
特別バッジ 式の宝庫	Special badge: Treasury of Formulas	特别徽章 算式宝库
特別バッジ 頂点の証	Special badge: Proof of the Summit	特别徽章 巅峰之证
特別バッジ 宿命の好敵手	Special badge: Destined Rival	特别徽章 宿命劲敌
特別バッジ 日輪の覇者	Special badge: Ruler of the Sun	特别徽章 日轮霸者
第#・#巡の判断です。手札が#枚前後あり、選択肢がいちばん多い時期です。	Decisions in rounds #–#. You hold about # cards, so this is when you have the most options.	第#・#巡的判断。手牌约#张，是选择最多的时期。
序盤は上がりよりも、重い札を処分しつつ「次の場で出せる形」を残すことが大切です。	Early on, rather than going out, it matters to unload heavy cards while keeping a shape that can play on the next field.	开局时比起出完，更重要的是一边处理重牌，一边留下「下个场数能出的形」。
第#巡以降で、まだ手札が#枚以上ある場面です。	Round # or later, still holding # or more cards.	第#巡以后，手牌还有#张以上的场面。
相手の残り枚数が減ってくる時期です。上がりを急ぐか、PPを抑えるかの切り替えを意識しましょう。	Opponents' hands are shrinking. Be mindful of switching between racing to go out and keeping PP down.	对手剩余张数在减少。注意在抢着出完和压低PP之间切换。
自分の手札が#枚以下の終盤です。	The endgame, with # or fewer cards in your hand.	自己手牌#张以下的终盘。
残す札の組み合わせで、次の番に上がれる場の数（アウツ）が決まります。#枚残しより#〜#枚残しの方が待ちが広いことも多いです。	The cards you keep decide how many fields let you go out next turn (outs). Keeping #–# cards often gives a wider wait than keeping #.	留下的牌的组合决定了下一轮能出完的场数（听牌）。留#～#张往往比留#张听得更宽。
手札が#枚以上にふくらんだ場面です。	Your hand has swollen to # or more cards.	手牌膨胀到#张以上的场面。
負けたときのPPが大きくなりやすいので、大きい札を含む#枚出しで一気に軽くする判断が重要です。	Your PP if you lose tends to be large, so it's key to lighten up fast with #-card plays that include big cards.	输的时候PP容易变大，所以用包含大牌的出#张一口气减轻很重要。
相手の誰かが残り#枚以下の場面です。	Someone has # or fewer cards left.	有对手只剩#张以下的场面。
上がられる可能性が高いので、手札の合計（PP）を減らす手が優先になりやすい局面です。	Someone's likely to go out, so moves that cut your hand total (PP) usually take priority.	被出完的可能性高，减少手牌合计（PP）的着法往往优先。
相手の誰かが残り#枚の場面です。	Someone has # cards left.	有对手剩#张的场面。
まだ少し余裕がありますが、次の巡で一気に上がられることもあります。PPの重い札は早めに。	There's still a little room, but they could go out next round. Unload heavy PP cards early.	还有一点余裕，但下一巡也可能一下子被出完。PP重的牌要尽早处理。
場の数が#以下の場面です。	The field number is # or less.	场上数字在#以下的场面。
小さい場でも、引き算や割り算を使えば大きい札を絡められます。K−Qのような差も狙い目です。	Even small fields can use big cards via subtraction or division. Differences like K−Q are a good target.	小场数也能用减法或除法带上大牌。K−Q这样的差值也值得瞄准。
場の数が#〜#の場面です。	The field number is #–#.	场上数字在#～#的场面。
選択肢がいちばん多くなりやすい場です。#枚か#枚か、残す札の形で比べましょう。	These fields tend to have the most options. Compare # vs # cards by the shape of what you keep.	这类场数选择往往最多。出#张还是#张，按留下的牌形来比较。
場の数が#以上の場面です。	The field number is # or more.	场上数字在#以上的场面。
大きい場は、大きい札をそのまま、または足し算でまとめて処分できる好機です。	Big fields are a chance to unload big cards directly or several at once by adding.	大场数是直接或用加法一起处理大牌的好机会。
#枚で出せる組み合わせがある場面です（実際に#枚出すかどうかは問いません）。	Spots where a #-card combo was available (whether or not you actually played #).	有能出#张的组合的场面（不论实际是否出了#张）。
#枚出しは枚数が一気に減りますが、残る札の柔軟さが落ちることもあります。いつも#枚が正解とは限りません。	A #-card play cuts your count fast, but can reduce the flexibility of what's left. # cards isn't always right.	出#张能一口气减少张数，但留下的牌的灵活性可能下降。并不总是出#张最好。
AIの評価で、#枚出しが最善だった場面です。	Spots where the AI rated a #-card play as best.	AI评价中出#张最佳的场面。
ここで#枚以下にしてしまうと、枚数とPPの両方で損をしやすくなります。	Playing # or fewer here tends to cost you in both card count and PP.	这里出#张以下的话，张数和PP两方面都容易吃亏。
複数枚の出し方もあるのに、#枚だけ出すのが最善だった場面です。	Spots where playing just # card was best even though multi-card plays existed.	明明有出多张的方法，却只出#张最佳的场面。
あえて札を残すことで、次の場に対応しやすい形や広い待ちを保てます。気づきにくい好手です。	Keeping cards on purpose preserves a shape that handles the next field or a wide wait. An easy-to-miss good move.	故意留牌能保持容易应对下个场数的形或宽听牌。是不容易发现的好手。
最善手を選ぶと手札が#枚だけ残る場面です。	Spots where the best move leaves you with just # card.	选最佳着法后手牌只剩#张的场面。
#枚残しは、その数字の場が来ないと上がれません。残す#枚の数字と、残り枚数をよく見て選びましょう。	With # card left, you only go out if that exact field comes. Check the number you keep and how many are left unseen.	留#张的话，不来那个数字的场就出不完。好好看留下的#张数字和剩余张数再选。
あえて引くのが最善だった場面と、あなたが出さずに引いた場面です。	Spots where drawing on purpose was best, and spots where you drew instead of playing.	故意摸牌最佳的场面，以及你没出牌而摸牌的场面。
出せるときでも、出すと形が崩れるなら引く方が良いことがあります。逆に、出せるのに引くのは損になりやすいので注意。	Even when you can play, drawing can be better if playing breaks your shape. But drawing when you could play often costs you, so be careful.	即使能出，如果出了会破坏牌形，摸牌可能更好。反过来，能出却摸牌往往吃亏，要注意。
割り算やかっこを使う式が最善だった場面です。	Spots where a formula with division or brackets was best.	用除法或括号的算式最佳的场面。
思いつきにくい式ほど、大きい札をまとめて処分できることがあります。かっこの使い方を覚えておきましょう。	The harder a formula is to spot, the more it may unload big cards together. Learn how to use brackets.	越难想到的算式，越可能一起处理掉大牌。记住括号的用法吧。
まだ回数が少ないので、傾向は見えていません。	Not enough data yet to see a trend.	次数还少，看不出倾向。
あなたの平均損失は#pt。全体の平均（#pt）より小さく、得意な場面と言えます。	Your average loss is # pt, smaller than your overall average (# pt). This is a strength.	你的平均损失是#pt，比整体平均（#pt）小，可以说是擅长的场面。
あなたの平均損失は#pt。全体の平均（#pt）より大きいので、伸びしろのある場面です。	Your average loss is # pt, larger than your overall average (# pt). Room to grow here.	你的平均损失是#pt，比整体平均（#pt）大，是有提升空间的场面。
あなたの平均損失は#pt。全体の平均（#pt）とほぼ同じです。	Your average loss is # pt, about the same as your overall average (# pt).	你的平均损失是#pt，和整体平均（#pt）差不多。
損失#pt以上の判断は#回中#回でした。	# of # decisions had a loss of #+ pt.	损失#pt以上的判断在#次中有#次。
#分間で、どれだけバッジを取れるか	How many badges can you earn in # minutes?	#分钟内能拿到多少徽章
さあ、#分間のバッジアタックや！取れるだけ取ったろ！準備はええか？	Here we go, the #-minute Badge Attack! Grab all you can! Ready?	来吧，#分钟的徽章冲刺！能拿多少拿多少！准备好了吗？
持ち時間は#分。速さと正確さ、両方が問われる勝負ですね。	You have # minutes. Speed and accuracy are both on trial.	时间是#分钟。速度和准确都要考验。
← ホーム	← Home	← 主页
アウツチャレンジ #/#	Outs Challenge #/#	听牌挑战 #/#
難しさ ★	Difficulty ★	难度 ★
難しさ ★★	Difficulty ★★	难度 ★★
難しさ ★★★	Difficulty ★★★	难度 ★★★
次の番で上がれる札（アウツ）がいちばん多くなるように、出す札を選んでください。	Choose the cards to play so that you have the most cards that let you go out next turn (outs).	请选择要出的牌，让下一轮能出完的牌（听牌）最多。
アウツ＝残った札をちょうど出し切れる場の数字の、まだ見えていない札の枚数。	Outs = the number of unseen cards whose value lets you play out all your remaining cards exactly.	听牌＝能把剩余手牌正好出完的场上数字，在看不见的牌中的张数。
これまでに出た札（#枚）	Cards played so far (#)	已经出过的牌（#张）
前の場札	Previous field cards	之前的场牌
見えていない札（山札と他の人の手札）は合計#枚。	# unseen cards in total (deck and other players' hands).	看不见的牌（牌堆和其他人的手牌）共#张。
ヒント：残り枚数を見る	Hint: see remaining counts	提示：查看剩余张数
あなたの手札	Your hand	你的手牌
出す札を#〜#枚タップしてください	Tap #–# cards to play	请点选要出的#～#张牌
これで決定	Confirm	就这样决定
正解！	Correct!	正确！
残念…	Too bad…	可惜…
出し方の一覧（アウツの多い順）	All plays (most outs first)	出法一览（按听牌数排序）
アウツがいちばん多い出し方です。	This play has the most outs.	这是听牌最多的出法。
まだ見えていない札（残り枚数）	Unseen cards (remaining counts)	还没出现的牌（剩余张数）
アウツ	Outs	听牌
式ハンター 結果	Formula Hunter results	算式猎人 结果
狩りを始める	Start hunting	开始狩猎
もう一度狩りに出る	Hunt again	再去狩猎
図鑑を見る	See collection	查看图鉴
標的（場の数）	Target (field number)	目标（场上数字）
標的	Target	目标
新しい標的！	New target!	新目标！
獲物の気配	Prey nearby	猎物气息
獲物なし	No prey	没有猎物
捕獲	Captured	捕获
式を捕獲	Formula captured	捕获算式
捕獲した式（図鑑に登録）	Captured formulas (added to collection)	捕获的算式（已登录图鉴）
逃した獲物	Escaped prey	逃走的猎物
見送る	Skip	跳过
見送りも手	Skipping is a move too	跳过也是一种策略
作った式	Your formula	凑出的算式
手札の#枚	Your # cards	手牌的#张
場	Field	场
得点	Score	得分
連続	Streak	连续
最多	Most	最多
制覇済み	Conquered	已制霸
自己ベスト更新！	New personal best!	刷新个人最佳！
匹	caught	只
くわしいルール	Detailed rules	详细规则
じっくり考えてOK	Take your time	慢慢想也没关系
この手札に	In this hand:	这手牌中有
(未登録の式)	(new formulas)	（未登录的算式）
（未登録の式）	(new formulas)	（未登录的算式）
数字を選ぶと、標的がずっとその数になります（「図鑑の場」バッジを狙うときに）。残りは、手札#枚で作れる未登録の式の数。	Pick a number to keep the target fixed to it (for the "Collection field" badges). The remaining count is the number of new formulas makeable with # cards.	选择数字后，目标会一直是这个数（瞄准「图鉴场数」徽章时用）。剩余数是用#张手牌能凑出的未登录算式数量。
札を選ぶと、獲物（未登録の式）の筋があるか色でわかります。	As you pick cards, the color shows whether there's a path to prey (a new formula).	选牌时，颜色会显示是否有通往猎物（未登录算式）的路线。
見送った標的や最後の標的で、手札から作れた未登録の式です。	New formulas you could have made from your hand on skipped targets or the last target.	在跳过的目标或最后的目标中，手牌能凑出的未登录算式。
🎯 自動照準を使って始める	🎯 Start with auto-aim	🎯 使用自动瞄准开始
🎯 自動照準 作動中　自動捕獲	🎯 Auto-aim active · auto-capturing	🎯 自动瞄准运行中　自动捕获
`.split('\n').filter(Boolean).map(l => l.split('\t')));
