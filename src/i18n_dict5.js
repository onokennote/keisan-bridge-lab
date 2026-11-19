// 辞書（キャラのふきだし・対局の記録・AIの読み・結果の画面）
window.I18N_ROWS = (window.I18N_ROWS || []).concat(`
@	@	@
うわ、出せない…	Ugh, can't play…	呜，出不了…
えー、作れないよ〜	Aww, can't make it~	诶，凑不出来～
えー、ないよ〜	Aww, nothing~	诶，没有啊～
どうしよう…	What do I do…	怎么办…
また引くのか〜	Drawing again~	又要摸牌啊～
あと少しで上がれる！	Almost out!	马上就能出完了！
あと少しで上がり！	Almost out!	马上出完！
もうすぐ上がりそう！	Nearly there!	快要出完了！
もうすぐ上がれそう！	Nearly there!	快要出完了！
あと#枚！	# left!	还剩#张！
#枚も出せた！	Three cards at once!	一下出了三张！
やった、まとめて出せた！	Yes, played a bunch!	太好了，一起出掉了！
大きい数ばっかりで重い…	All big numbers, so heavy…	全是大数字，好重…
K とか Q がじゃまだなあ	These Ks and Qs are in the way	K和Q好碍事啊
手札が多すぎる〜	Too many cards~	手牌太多了～
全然減らない…	They're not going down…	一点都没减少…
これなら出せる！	I can play this!	这个能出！
よし、出せた	OK, played it	好，出掉了
やったー！上がった！	Yay! I'm out!	太好了！出完了！
わーい、勝った！	Woohoo, I won!	哇，赢了！
負けちゃった…	I lost…	输了…
くやしい〜！	So frustrating~!	好不甘心～！
つぎはがんばる…	I'll do better next time…	下次加油…
ワン！	Woof!	汪！
クゥ〜ン…	Whimper…	呜～…
ワンワン！	Woof woof!	汪汪！
にゃ〜	Meow~	喵～
にゃっ	Mew!	喵！
ペペッ	Pep!	噗噗！
ペン…	Pen…	企…
ブヒッ	Oink!	哼！
ブー…	Oink…	哼…
ケロッ	Ribbit!	呱！
ゲコ…	Croak…	咕…
ピヨッ	Cheep!	叽！
ピヨピヨ	Cheep cheep	叽叽
…むしゃむしゃ	…munch munch	…嚼嚼
ふぁ〜	Yawn~	哈～
まとめて行くぜ！	Here goes a bunch!	一起上！
一気に#枚！	Three at once!	一口气三张！
どんどん出す！	Keep 'em coming!	不停地出！
いくぜ！	Here I go!	上了！
よし！	Alright!	好！
くっ…	Tch…	可恶…
次こそ！	Next time for sure!	下次一定！
あと少し！	Almost!	就差一点！
もらった！	Got it!	拿下了！
よっしゃあ！	Yesss!	好嘞！
次は勝つ！	I'll win next time!	下次要赢！
大きい札から片付け	Big cards first	先收拾大牌
ここは処分	Time to unload	这里处理掉
安全第一	Safety first	安全第一
慎重に…	Carefully…	谨慎点…
想定内です	As expected	在预料之中
焦らない焦らない	No rush, no rush	不急不急
油断は禁物	Don't let your guard down	不能大意
ほっとした〜	Phew~	松了口气～
被害は小さく済んだかな	At least the damage was small	损失还算小吧
今日はこれ！	Today it's this!	今天就这个！
ふふん♪	Hmm-hmm♪	哼哼♪
なんとなく！	Just because!	随便啦！
これでいいや	This'll do	就这样吧
あらら	Oh dear	哎呀呀
まあいっか	Oh well	算了
いけるかも？	Maybe I can?	说不定能行？
やったー！	Yay!	太好了！
楽しかった！	That was fun!	好开心！
計算通り	As calculated	正如计算
確率的にはこう	By the odds, this	按概率是这样
ここは温存	Saving these	这里先留着
ふむ	Hmm	嗯
仕方ない	Can't be helped	没办法
期待値は悪くない	The expected value is fine	期望值不坏
読み切った	All figured out	全看透了
計算通りです	Just as calculated	正如计算
分散ですね	That's variance	这就是波动吧
ありがとうございました	Thank you for the game	谢谢指教
お疲れさまでした	Good game	辛苦了
どうぞ	Go ahead	请
はい	Yes	是
…	…	…
@：引いた（残#）	@: drew (# left)	@：摸牌（剩#）
山札から#枚引いた	Drew # from the deck	从牌堆摸了#张
捨て札を切り直して山札に	Discards reshuffled into the deck	弃牌重新洗入牌堆
・ 前の手 	· Last play 	· 上一手 
前の手	Last play	上一手
予選 #/#セット・第#卓	Qualifier set #/# · Table #	预选赛 第#/#盘 · 第#桌
予選#/#セット	Qualifier set #/#	预选赛 第#/#盘
決勝ライン#位	Final line: #th	决赛线：第#名
これから	Up next	即将开始
🪞@を写す★#	🪞 copies @ ★#	🪞 复制@★#
……写せた	…copied	……复制成功
📝 前回の判断	📝 Last decision	📝 上次判断
このゲーム	This game	本局
残り手札	Cards left	剩余手牌
バッジ外	No badges	不计徽章
あと#点	# pts to go	还差#分
あなたはこのゲーム#位	You placed #th this game	你本局第#名
あなたの上がり！	You went out!	你出完了！
今回のPP	This game's PP	本局PP
セット計	Set total	本盘合计
AIの総括	AI summary	AI总结
読みあり	AI used	看过分析
候補を見る	See candidates	查看候选
あなた＝最善	You = best	你＝最佳
最善扱い	Counted as best	按最佳计
好手	Good	好手
疑問手	Dubious	疑问手
悪手	Bad	恶手
最善	Best	最佳
ほぼ互角	Nearly even	几乎相当
盤面を見る	See the board	查看牌面
次のゲームへ	Next game	下一局
セット結果へ	To set results	查看本盘结果
セット終了	Set over	本盘结束
もっと深く読む	Read deeper	深入分析
# を出す	Play #	出 #
# # を出す	Play # #	出 # #
# # # を出す	Play # # #	出 # # #
このゲームで上がる	Go out this game	本局出完
ゲーム内の期待順位	Expected place in this game	本局期望名次
#枚出して残り#枚	Play #, # left	出#张，剩#张
残りPPは#	Remaining PP #	剩余PP #
次の場で出せる確率 #%（作れる数 #/#）	Chance to play on the next field #% (makeable #/#)	下个场数能出牌的概率 #%（能凑的数 #/#）
総合評価で最善と #pt 差	#pt behind the best overall	综合评价与最佳差#pt
あえて出さずに#枚引く（手札#枚に）	Draw # on purpose (hand becomes #)	故意不出摸#张（手牌变#张）
手札の合計#点を抱えたまま（引いた札の分だけ増える）	Keeps your #-point hand total (plus the drawn card)	保留手牌合计#分（再加上摸到的牌）
あなたの次の番までに誰かが上がる確率 #%	Chance someone goes out before your next turn #%	在你下一轮前有人出完的概率 #%
アウツ（来たら上がれる場）：# の#つ。見えていない札のうち#枚（約#%）	Outs (fields that let you go out): # (#). # of the unseen cards (about #%)	听牌（来了就能出完的场数）：#，共#种。看不见的牌中有#张（约#%）
アウツ（来たら上がれる場）：# と # の#つ。見えていない札のうち#枚（約#%）	Outs: # and # (#). # of the unseen cards (about #%)	听牌：#和#，共#种。看不见的牌中有#张（约#%）
引く（出せる組み合わせなし）	Draw (no playable combination)	摸牌（没有能出的组合）
シミュレーション中…（相手の手札を何千通りも想定して最後まで打ち切っています）	Simulating… (playing to the end with thousands of possible opponent hands)	模拟中…（设想数千种对手手牌并打到最后）
AIが考えた手（総合評価の高い順）	Moves the AI considered (best overall first)	AI考虑的着法（按综合评价排序）
このゲームはAIの読みを見たので、判断の評価と結果のバッジの対象外です。	You saw the AI reading this game, so it doesn't count for decision ratings or result badges.	本局看过AI分析，不计入判断评价和成绩徽章。
判断した手はすべてAIの読みを見たため、このゲームは評価していません。	Every decision this game was made after seeing the AI reading, so it isn't rated.	本局所有判断都看过AI分析，因此不作评价。
AIの読みを見た手・待ったでやり直した手（#回）は評価に入れていません。	Moves made after seeing the AI reading or redone with Undo (#) aren't rated.	看过AI分析或悔棋重下的着法（#次）不计入评价。
このゲームは結果のバッジの対象外です。	This game doesn't count for result badges.	本局不计成绩徽章。
あなたは決勝#位	You placed #th in the final	你决赛第#名
あなたは予選#位	You placed #th in the qualifiers	你预选赛第#名
優勝は@や〜！おめでとさん！みんなよう頑張った！	The champion is @! Congrats! Great effort, everyone!	冠军是@！恭喜！大家都很努力！
予選 総合順位（#セット終了時点）	Qualifier standings (after # sets)	预选赛总排名（第#盘结束时）
得点→累計PPの順。点線より上が決勝圏	Sorted by points, then total PP. Above the dotted line is the final zone	按得分→累计PP排序。虚线以上为决赛圈
各セット欄は「得点/PP」。累計PPは進行中セットのゲームも含みます。	Each set column shows "points/PP". Total PP includes games in the current set.	各盘栏为「得分/PP」。累计PP包含进行中这一盘的对局。
同じ設定でもう一度	Again with the same settings	同样设置再来一次
セット #位（#点）	Set #th (# pts)	本盘第#名（#分）
順位	Rank	名次
名前	Name	名字
得点	Points	得分
累計PP	Total PP	累计PP
今セットPP	This set PP	本盘PP
ブォン！	Vroom!	轰！
ブォォン！	Vrooom!	轰轰！
`.split('\n').filter(Boolean).map(l => l.split('\t')));
