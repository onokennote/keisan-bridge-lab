// 辞書（このアプリができるまで・数字で見る計算ブリッジ）
window.I18N_ROWS = (window.I18N_ROWS || []).concat(`
悔しかったので、	Out of frustration,	因为不甘心，
作りました。	I made this.	所以做了这个。
計算ブリッジ作戦研究所（非公式ファン制作）	Keisan Bridge Strategy Lab (unofficial fan-made)	算式桥牌战术研究所（非官方粉丝自制）
#年#月#日、第#回計算ブリッジ・日本一決定戦。息子と初めて出て、ふたりとも決勝に行けずに惨敗しました。正直、なめてました。ガチ勢はほんとにガチだった。	On #/#/#, at the #th Keisan Bridge Japan Championship, I entered for the first time with my son. Neither of us made the final; we were crushed. Honestly, I underestimated it. The serious players were seriously good.	#年#月#日，第#届算式桥牌日本第一决定战。我第一次和儿子参赛，两个人都没进决赛，惨败而归。说实话，是我太小看了。认真的玩家是真的认真。
その中に、家族#人（うち子ども#人）で参加して、#人が#人枠の決勝に進み、優勝までかっさらうというガチ家族がいて、これは練習しないと勝てないなと。	Among them was one serious family: # members (# of them kids) entered, # made the #-player final, and they even took the title. I realized we'd never win without practice.	其中有一个认真的家庭：一家#口（其中#个孩子）参赛，#人进入#人名额的决赛，还拿下了冠军。我想，不练习是赢不了的。
悔しかったので、特訓用のアプリを作りはじめました。AI（Claude）に「こういう特訓用アプリを作って」と言っては試し、また言っては試し。息子が飽きないように、遊びも入れて。	Frustrated, I started making a training app. I'd ask an AI (Claude) to "make a training app like this", try it, ask again, try again. I added fun parts too, so my son wouldn't get bored.	因为不甘心，我开始做特训用的应用。对AI（Claude）说「帮我做一个这样的特训应用」，试一试，再说，再试。为了不让儿子玩腻，还加了游戏元素。
特訓のつもりが、思いのほか遊べるものになったので、みなさんにも遊んでもらうことにしました。	It was meant for training, but it turned out to be surprisingly fun, so I decided to share it with everyone.	本来是为了特训，没想到做得挺好玩，于是决定也让大家来玩。
一緒に日本一を目指しましょう！	Let's aim for No. 1 in Japan together!	一起冲击日本第一吧！
「計算ブリッジ」は上野晋太郎さん（すうがっくま）が考案したゲームです。このアプリは非公式のファン制作で、キャラクターはすべてオリジナルです。	"Keisan Bridge" is a game created by 上野晋太郎さん (すうがっくま). This app is an unofficial fan creation, and all characters are original.	「算式桥牌」是上野晋太郎さん（すうがっくま）设计的游戏。本应用是非官方粉丝自制，所有角色均为原创。
要するに、負けず嫌いが止まらんかったっちゅうことや！	In short, the competitive streak just wouldn't stop!	说白了，就是不服输停不下来！
くやしさは、いちばん強い学びの入り口です。	Frustration is the strongest doorway to learning.	不甘心，是最有力的学习入口。
数字で見る	In numbers	用数字看
勘を、数字にしてみました	We turned gut feeling into numbers	把直觉变成了数字
「このまま進んだら何点失うか」の見込み	An estimate of "how many points you'll lose from here"	「照这样下去会失多少分」的估计
たとえば期待PP # の手は、同じ場面を何度もくり返したら、平均で#点くらい失うという意味です。上がれた回は#点、上がられた回は残った札の合計。それを全部ならした数字です。「AIの読み」は、出せる手ごとにこの期待PPと上がれる確率を出して比べています。	For example, a move with expected PP # means that if the same spot were replayed many times, you'd lose about # points on average. Going out counts as #; getting caught counts your leftover cards. It's the average of all of those. "AI reading" computes this expected PP and the chance of going out for each playable move and compares them.	比如期望PP #的着法，意思是同样的场面重复多次，平均会失#分左右。出完算#分，被出完算剩余牌合计，把这些全部平均。「AI分析」对每个能出的着法计算期望PP和出完概率进行比较。
AIの読みと同じ計算です。候補手ごとに、まだ見えていないカードを相手の手札と山札に何千通りも割り振り、最後まで打ち切ってみて失点を平均します（モンテカルロ法）。	The same calculation as the AI reading: for each candidate move, the unseen cards are dealt to opponents' hands and the deck thousands of ways, played to the end, and the losses averaged (Monte Carlo method).	和AI分析是同样的计算：对每个候选着法，把还看不见的牌以数千种方式分给对手手牌和牌堆，打到最后再平均失分（蒙特卡洛方法）。
#ゲームの平均の失点（打ち方別）	Average loss per game (by play style)	每局平均失分（按打法）
AIの最善手どおりに打つと、#ゲームの失点は平均#。★#相当の打ち方なら#。差は#ゲームでは#点でも、#ゲームの#セットなら約#点。順位がひっくり返る差です。	Playing the AI's best moves, you lose # per game on average; at ★# level, #. Only # points per game, but about # over a #-game set. Enough to flip the standings.	按AI最佳着法打，每局平均失分#；★#水平的打法是#。每局只差#分，但#局的一盘就差约#分，足以颠倒名次。
最善手どおり	Best moves	按最佳着法
★#相当	★# level	★#水平
最善手どおりの#は、人の席をAIの最善手で打たせた大会#回のシミュレーションで測った値。★#・★#相当の値は、大会の設定画面の決勝進出率の目安と同じものです。	The best-move value of # was measured in # simulated tournaments with the human seat played by the AI's best moves. The ★# and ★# values are the same as the estimates on the tournament setup screen.	按最佳着法的#，是让AI最佳着法代打真人席位、模拟#场比赛测得的值。★#、★#水平的值与比赛设置画面的进入决赛概率估计相同。
「セット期待点」＝#セットで取れる得点の見込み	"Expected set points" = the points you can expect from # set	「本盘期望分」＝一盘能拿到的得分估计
「決勝進出率」＝予選を勝ち抜く確率	"Chance of reaching the final" = the probability of getting through the qualifiers	「进入决赛概率」＝闯过预选赛的概率
参加者の平均は#%	Field average: #%	参赛者平均为#%
親（#番手）の上がり率	Dealer's (#st to play) going-out rate	庄家（第#个出牌）的出完率
★#どうしの#人卓を、AIだけで実際に#,#ゲーム打たせ、上がった人の順番を数えました。	We had AIs play #,# games at #-player tables of ★# players and counted the turn position of whoever went out.	让★#水平的AI在#人桌实际打了#,#局，统计出完者的出牌顺序。
上がりまでの平均	Average time to go out	出完的平均回合
上と同じ#,#ゲームで、上がった巡と、上がれなかった人の失点を平均しました。	From the same #,# games, we averaged the round when someone went out and the losses of those who didn't.	用上面同样的#,#局，平均了出完的巡数和没出完的人的失分。
#枚の手札の、平均の待ち	Average wait with # cards	#张手牌的平均听牌
の#面。弱い組は#面しかありません。残す札で、上がりやすさは何倍も変わります。	, with # ways. Weak combos have only #. What you keep changes your odds of going out several times over.	，#面。弱的组合只有#面。留下的牌不同，出完的难易度会差好几倍。
面数ごとの組の数（全#通り）	Number of combos by wait count (# total)	按听牌面数统计的组合数（共#种）
#枚の組#通りすべてについて、場#〜#のどれで#枚とも出し切れるかを調べ上げた数です（見込みではなく、計算で確定した値）。	For all #-card combos (#), we checked which fields #–# let you play all # cards (exact values, not estimates).	对#张牌的全部#种组合，逐一检查场数#～#中哪些能把#张全部出完（是计算确定的值，不是估计）。
大会で優勝する確率（最善手どおりの場合）	Chance of winning a tournament (with best moves)	比赛夺冠概率（按最佳着法时）
参加者の平均は優勝#%・決勝#%	Field average: win #% · final #%	参赛者平均：夺冠#% · 决赛#%
決勝進出率と同じ#,#大会で、決勝（進出した#人で#セット。PPの合計が最少の人が優勝）まで続けた割合です。	From the same #,# tournaments as the final-chance estimate, played through the final (# finalists, # set, lowest total PP wins).	用和进入决赛概率相同的#,#场比赛，一直打到决赛（#名决赛选手打#盘，PP合计最少者夺冠）统计的比例。
※ 平均や確率は、このアプリのAIどうしの対戦と、その結果から作ったモデルで計算した見込みです。実際の大会の結果ではありません。	* Averages and probabilities are estimates from games between this app's AIs and a model built from them. They are not real tournament results.	※ 平均值和概率是根据本应用AI之间的对战及其结果建立的模型计算出的估计，不是实际比赛的结果。
勘で打っていたところに、数字の裏づけがあると、迷いが減ります。	When numbers back up what you used to play by feel, you hesitate less.	在凭直觉打的地方有了数字支撑，犹豫就会减少。
数字は裏切らへん！でも#ゲームは運も大きいで。そこがおもろいんや！	Numbers don't lie! But a single game has a lot of luck. That's what makes it fun!	数字不会骗人！不过一局里运气也很重要。这才有意思！
セットはPPの合計が少ない順に#位#点・#位#点・#位#点・#位#点。セット期待点は、同じセットを何度もくり返したときの得点の平均です。練習のAIの読みは、失点の少なさ（期待PP）だけでなく、この点数で手を比べます。大きくリードしていれば無理をしない手、離されていれば上がりを狙う手が上に来るのはそのためです。#人卓・#ゲーム（相手はまんべんなく）なら、最善手どおりで平均#点・#位#%、★#相当で#点です。	In a set, lower total PP ranks higher: #st # pts, #nd # pts, #rd # pts, #th # pts. Expected set points is the average score if the same set were replayed many times. In practice, the AI reading compares moves by these points, not just by low losses (expected PP). That's why, with a big lead, safe moves rise to the top, and when far behind, moves that aim to go out do. At a #-player table over # games (balanced opponents), best moves average # pts with #st place #% of the time; ★# level averages # pts.	一盘按PP合计从少到多排名：第#名#分、第#名#分、第#名#分、第#名#分。本盘期望分是同一盘重复多次时得分的平均。练习中的AI分析不只看失分少（期望PP），也用这个分数比较着法。所以大幅领先时稳妥的着法会排前面，被拉开时争取出完的着法会排前面。#人桌、#局（对手均衡）的话，按最佳着法平均#分、第#名#%，★#水平平均#分。
相手#人の強さを「まんべんなく」の割合（★#〜★#を#：#：#：#：#）で選び、★ごとの#ゲームのPP（平均とばらつき。AIだけの大会#回で測定）から#ゲームの合計を作って順位を決めます。これを#,#セットくり返した平均です。	The # opponents' strengths are picked in the "balanced" mix (★# to ★# at #:#:#:#:#). From each ★'s per-game PP (mean and spread, measured in # AI-only tournaments), we build #-game totals and decide ranks. This is the average over #,# sets.	#个对手的强度按「均衡」比例（★#～★#为#：#：#：#：#）选择，用各★每#局的PP（平均和波动，在#场纯AI比赛中测得）合成#局的合计并决定名次。这是重复#,#盘的平均值。
大会の予選では、AIの読みは「この手で決勝に進める確率」で手を比べます。今のセットの残りのゲーム、ほかの卓の進み具合、残りのセットの席替えまで何千回も試して、総合順位（得点→累計PP）が決勝ラインの内側に入った割合を出します。ラインより十分上なら安全な手、ぎりぎりや下なら、PPが少し増えても順位を上げる手が上に来ます。参加#人・予選#セット・上位#人が決勝なら、最善手どおりで#%、★#相当で#%です。	In tournament qualifiers, the AI reading compares moves by "the chance this move gets you to the final". It simulates the rest of the set, the other tables and the reseating of later sets thousands of times, and counts how often your overall rank (points → total PP) lands inside the final line. Well above the line, safe moves rise; near or below it, moves that climb places even at some PP cost rise. With # players, # qualifier sets and the top # in the final: #% with best moves, #% at ★# level.	在比赛预选赛中，AI分析按「这一手能进决赛的概率」比较着法。把本盘剩余对局、其他桌的进度、后面几盘的换座位都模拟数千次，计算总排名（得分→累计PP）进入决赛线以内的比例。远高于线时稳妥的着法排前面；接近或低于线时，即使PP稍增也能提升名次的着法排前面。#人参赛、预选#盘、前#名进决赛的话，按最佳着法#%，★#水平#%。
参加者の強さを「まんべんなく」の割合で選び、セットごとに卓を作り直して予選#セットを行い、総合順位（得点→累計PP）を決めます。#,#大会のうち上位#人に入った割合です。自分の#ゲームのPPは打ち方別の平均（ばらつき#）を使います。	Participants' strengths are picked in the "balanced" mix, tables are redrawn every set, # qualifier sets are played, and the overall ranking (points → total PP) is decided. It's the share of #,# tournaments where you finished in the top #. Your own per-#-game PP uses the average for each play style (spread #).	参赛者强度按「均衡」比例选择，每盘重新分桌进行#盘预选赛，决定总排名（得分→累计PP）。这是#,#场比赛中进入前#名的比例。自己每#局的PP使用各打法的平均值（波动#）。
だれかが上がったら、その場で終わり。だから順番が大事です。★#どうしの#人卓を#,#ゲーム打たせると、上がった人のうち親が#%、#番手は#%。前のゲームで負けた人が親になるのは、ささやかな救済です。	When someone goes out, the game is over right there. That's why turn order matters. In #,# games at #-player tables of ★# players, the dealer accounted for #% of outs, the #th seat #%. Making the previous game's loser the dealer is a small consolation.	有人出完就当场结束，所以顺序很重要。让★#水平的#人桌打#,#局，出完的人里庄家占#%，第#个出牌的占#%。让上一局的输家当庄家，算是小小的补偿。
ゲームは平均で第#巡に終わります。#枚の手札を#〜#回の手番で出し切る計算。#回の手番でおよそ#枚ずつ減らしていく速さが目安です。上がれずにいる人の失点は、平均#点でした。	Games end in round # on average: # cards played out over #–# turns. Dropping about # cards per # turn is the pace to aim for. Players who didn't go out lost # points on average.	游戏平均在第#巡结束：#张手牌分#～#回合出完。每#回合减约#张是标准速度。没出完的人平均失分#。
残り#枚になったとき、#種類の場のうち平均#種類で上がれます。最強は	With # cards left, you go out on # of the # field numbers on average. The strongest is	剩#张时，#种场数中平均有#种能出完。最强的是
上と同じ大会で、決勝まで含めて最善手どおりに打ち続けた場合の見込みです。決勝はその#セットのPPだけで決まり、価値があるのは#位だけ。だから決勝のAIの読みは「優勝率」で手を比べ、#位を守るより#位を狙う手を選びます（上がれるのにあえて上がらない「捨て身」が最善になることも）。打ち方の差は、大会の結果にここまで響きます。	The estimate for playing best moves all the way through the final in the same tournament. The final is decided only by that # set's PP, and only #st place counts. So in the final the AI reading compares moves by "chance of winning" and goes for #st over protecting #nd (sometimes even holding back from going out, a "sacrifice", is best). This is how much play style affects tournament results.	在同样的比赛中，包括决赛都一直按最佳着法打时的估计。决赛只看那#盘的PP，有价值的只有第#名。所以决赛中AI分析按「夺冠概率」比较着法，比起守住第#名更会选择冲击第#名（有时能出完却故意不出的「舍身」反而最佳）。打法的差距会对比赛结果产生这么大的影响。
静かなる天才	The Quiet Genius	沉静的天才
無敗の演算機	The Undefeated Calculator	不败的演算机
理詰めの鬼	The Logic Demon	逻辑之鬼
箱の中の天才	The Genius in the Box	箱中的天才
不沈の甲羅	The Unsinkable Shell	不沉之壳
完璧なる守り	Perfect Defense	完美的防守
北極の壁	The Arctic Wall	北极之墙
福を呼ぶ守り神	The Lucky Guardian	招福的守护神
百獣の計算王	King of Calculating Beasts	百兽的计算王
音速の老婆	The Supersonic Granny	音速老奶奶
一閃の剣豪	The Flash Swordmaster	一闪的剑豪
九つの星を奪った男	The Man Who Stole Nine Stars	夺走九颗星的男人
宇宙から来た数学者	The Mathematician from Space	来自宇宙的数学家
笑う天才	The Laughing Genius	欢笑的天才
千の顔を持つ	The Thousand Faces	千面之人
月夜の怪盗	The Moonlight Thief	月夜怪盗
計算番長	Calculation Boss	计算老大
鉄の生徒会長	The Iron Class President	铁血学生会长
双子の右	The Right Twin	双胞胎之右
双子の左	The Left Twin	双胞胎之左
元プロ棋士	Former Pro Shogi Player	前职业棋手
氷の微笑	The Icy Smile	冰之微笑
損得勘定のプロ	Pro of Profit and Loss	精打细算的专家
山の暴れ天狗	The Wild Mountain Tengu	山中的暴躁天狗
未来予報機	The Future Forecaster	未来预报机
電脳ゲーマー	The Cyber Gamer	电脑玩家
鉄壁の消防士	The Iron-Wall Firefighter	铁壁消防员
写し身	The Mirror Image	复制之身
🥋 日本一への道	🥋 Road to No. 1 in Japan	🥋 日本第一之路
`.split('\n').filter(Boolean).map(l => l.split('\t')));
