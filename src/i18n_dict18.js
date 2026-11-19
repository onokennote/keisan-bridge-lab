// 辞書（お手つきまわり・AIの読みとの比べ・成長記録の判断の実力）
window.I18N_ROWS = (window.I18N_ROWS || []).concat(`
お手つき	Foul	错算
お手つき！	Foul!	错算！
（お手つき）	(foul)	（错算）
では作れません	can't make it	凑不出来
ペナルティ：山札から#枚	Penalty: draw # from the deck	罚：从牌堆摸#张
お手つき（§）→ #枚引いた（残#）	foul (§) → drew # (# left)	错算（§）→ 摸了#张（剩#张）
お手つき（§）→#枚引く	Foul (§) → draw #	错算（§）→ 摸#张
「§」では場の#が作れず、お手つきで#枚引きました。	"§" couldn't make the field #, so it was a foul and you drew #.	「§」凑不出场上的#，错算，摸了#张。
例）§ = #	e.g. § = #	例：§ = #
お手つきは推定実力で差し引かれます（お手つき#割で−#）。式を出す前に、もう一度計算を確かめよう。	Fouls are deducted from your estimated skill (−#2 for fouls on #10% of moves). Check the math once more before you play.	错算会从推定实力中扣分（错算#成扣#）。出牌前再验算一遍吧。
判断の実力	Decision skill	判断实力
最善率	Best-move rate	最佳率
AIを見た手	Moves after AI reading	看过AI的着法
平均損失	Average loss	平均损失
#回	# times	#次
AIの最善	AI's best	AI最佳
あなたの手	Your move	你的着法
セット期待点	Expected set points	本盘期望分
上がる確率	Chance of going out	出完概率
期待PP	Expected PP	期望PP
期待点	Exp. points	期望分
決勝進出	Final	进决赛
決勝進出率	Chance of final	决赛晋级率
優勝率	Chance of winning	夺冠率
勝ち抜け	Advance	晋级
勝ち抜け率	Chance of advancing	晋级率
差	Gap	差
最善手の方が良い点：	Why the best move is better:	最佳着法更好的地方：
相手に先に上がられる危険が小さい	lower risk of an opponent going out first	被对手抢先出完的风险更小
数字の差は小さく、細かな有利の積み重ねです	the numbers are close; it's a pile of small advantages	数字差距不大，是细小优势的积累
セット期待点が # 高い	expected set points # higher	本盘期望分高#
セット期待点が #点 高い	expected set points # higher	本盘期望分高#分
上がる確率が #% 高い	chance of going out #% higher	出完概率高#%
期待PPが # 小さい	expected PP # lower	期望PP少#
残る手札で次の場に出せる確率が #%（あなたの手だと #%）	chance to play on the next field with what's left #% (#% with your move)	用剩下的手牌在下一场出牌的概率#%（你的着法是#%）
決勝進出率が #% 高い	chance of final #% higher	决赛晋级率高#%
優勝率が #% 高い	chance of winning #% higher	夺冠率高#%
勝ち抜け率が #% 高い	chance of advancing #% higher	晋级率高#%
（上がる確率だけなら、あなたの手が #% 上。総合では最善手が上回ります）	(On chance of going out alone, your move is #% higher. Overall, the best move wins.)	（只看出完概率，你的着法高#%。综合来看最佳着法更好）
総合＝セット期待点×# ＋ 上がり（%）×# − 期待PP×#。「最善扱い」＝最善との差が誤差の範囲（#巡目は#pt以内）	Overall = expected set points × # + going out (%) × # − expected PP × #. "Counted as best" = within the margin of error of the best (round #: within # pt)	综合＝本盘期望分×# ＋ 出完（%）×# − 期望PP×#。「视同最佳」＝与最佳的差在误差范围内（第#巡在#pt以内）
総合＝セット期待点×# ＋ 上がり（%）×# − 期待PP×#。「最善扱い」＝最善との差が誤差の範囲（#pt以内）	Overall = expected set points × # + going out (%) × # − expected PP × #. "Counted as best" = within the margin of error of the best (within # pt)	综合＝本盘期望分×# ＋ 出完（%）×# − 期望PP×#。「视同最佳」＝与最佳的差在误差范围内（#pt以内）
AIの手番の速さ	AI turn speed	AI回合速度
はやい（押すたびに切り替え）	Fast (tap to change)	快（每按一次切换）
ゆっくり（押すたびに切り替え）	Slow (tap to change)	慢（每按一次切换）
ふつう（押すたびに切り替え）	Normal (tap to change)	普通（每按一次切换）
一瞬（押すたびに切り替え）	Instant (tap to change)	瞬间（每按一次切换）
これまでの場札	Field cards so far	之前的场牌
これまでの場札 #	Field cards so far: #	之前的场牌 #
これまでの場札 §	Field cards so far: §	之前的场牌 §
切り直し後の場札 #	Field cards since the reshuffle: #	重洗后的场牌 #
切り直し後の場札 §	Field cards since the reshuffle: §	重洗后的场牌 §
切り直し後の場札	Field cards since the reshuffle	重洗后的场牌
切り直し後の場札（それより前は山札に戻っています）	Field cards since the reshuffle (earlier ones went back into the deck)	重洗后的场牌（之前的已回到牌堆）
直前の自分の手まで巻き戻す	Rewind to your previous move	倒回到自己的上一手
§（切り直しで山札に戻った札）	§ (went back into the deck in the reshuffle)	§（重洗时回到了牌堆）
#（切り直しで山札に戻った札）	# (went back into the deck in the reshuffle)	#（重洗时回到了牌堆）
これまでの場札 A	Field cards so far: A	之前的场牌 A
これまでの場札 J	Field cards so far: J	之前的场牌 J
これまでの場札 Q	Field cards so far: Q	之前的场牌 Q
これまでの場札 K	Field cards so far: K	之前的场牌 K
推定実力の推移	Estimated skill over time	推定实力变化
次の自分の番までに誰かが上がる確率 #%	Chance someone goes out before your next turn: #%	到你下一轮前有人出完的概率 #%
#	#	#
第#巡 場#	Round #, field #	第#巡 场#
第#卓（#人）	Table # (# players)	第#桌（#人）
あなたは暫定#位	You're provisionally #th	你暂列第#
決勝圏内	in the final zone	决赛圈内
決勝ラインまであと#点	# pts to the final line	距决赛线还差#分
🃏 札の形式	🃏 Card style	🃏 牌的样式
札の形式	Card style	牌的样式
各自の設定	Each player's choice	各自的设置
🃏 トランプ	🃏 Playing cards	🃏 扑克牌
🎴 花札	🎴 Hanafuda	🎴 花札
🀄 麻雀牌	🀄 Mahjong tiles	🀄 麻将牌
🔤 数のことば	🔤 Number words	🔤 数字单词
🪷 ガンジファ	🪷 Ganjifa	🪷 甘吉法牌
「各自の設定」は、それぞれが言語の切り替えの下で選んだ札。ほかを選ぶと、この大会の卓では全員がその札で打ちます	"Each player's choice" uses the cards each player picked under the language switch. Pick another and everyone plays with those cards at this tournament's tables	「各自的设置」使用每个人在语言切换下方选择的牌。选择其他样式时，本赛事的牌桌上所有人都用那种牌
また、数学とトランプは国境を越え、人種や言語の壁を取り払い、文化をつなぐことができるのです！（後付け😅）	And math and playing cards cross borders, break down the walls of race and language, and connect cultures! (Added afterwards 😅)	而且，数学和扑克牌能跨越国界，打破种族和语言的隔阂，连接不同的文化！（事后补的😅）
よろしくお願いしまーーす！	Pleeease, I'm counting on you!!	拜托啦——！
コンボ終了	Combo over	连击结束
図鑑に登録（#/#）	Added to collection (#/#)	登入图鉴（#/#）
ほな、卓をつくろか！今日はどの相手と打つ？	Let's set up a table! Who are you playing today?	来，开一桌吧！今天想和谁打？
ほな、大会の準備や！どんな相手がおるか楽しみやな！	Time to get the tournament ready! Can't wait to see who's in it!	来，准备比赛吧！真期待会遇到什么对手！
`.split('\n').filter(Boolean).map(l => l.split('\t')));
