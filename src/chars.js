// ===== ごちゃまぜ倶楽部：固定キャラクター（名前・強さ・性格・見た目・口調・セリフ） =====
// ★が上がるほどキャラが立ち、セリフは局面の情報を出さない（ポーカーフェイス）。
// ★1〜2は本音がだだ漏れ（セリフから手札の様子が本当に分かる）。
// 新しいキャラは ROSTER に1行足すだけで登場する。
(function (G) {
'use strict';
const KB = G.KB;
// kind: human / dog / cat / tanuki / fox / bear / lion / panda / pig / penguin / chick / frog / turtle / robot / mailbox / alien / ghost / snowman / divsprite / kappa / tengu
// look（人間）: g 性別, age child|young|adult|senior, skin 0-4, hair 色, hs 髪型, shirt 服の色, gl めがね, acc 小物
// tone: end 語尾 / kata カタカナ / pre 前置き
const R = [
  // ---------- ★5（16人）：二つ名つき。局面と無関係なことしか言わない ----------
  { id: 'zero', name: 'ゼロ', title: '静かなる天才', lv: 5, st: 'keisan', kind: 'human', tag: '小4', look: { g: 'm', age: 'child', skin: 0, hair: '#14141c', hs: 'veil', shirt: '#3a3f7a', cool: true, bgpat: 'pat:stars' }, peek: true,
    prof: '無表情で全通りを暗算する天才小学生。誰も彼が笑ったところを見たことがない。ときどき、まだめくられていない札が「なんとなく」分かるらしい。本人はただの勘だと思っている。',
    idle: ['…今日の給食、カレーだった', '…', '雲、動いてる', '…眠い', 'この机、ちょっと傾いてる', '宿題、もう終わってる', '…ふうん', '外、雨が降りそう'], win: ['…おしまい', '…帰っていい？'], lose: ['…そう', '…次'] },
  { id: 'soroban', name: 'ソロバン9000', title: '無敗の演算機', lv: 5, st: 'keisan', kind: 'robot', tag: 'ロボ', look: { color: '#adb5bd' },
    prof: '全通りを読むという噂の算盤ロボ。話す内容は、だいたい天気。', tone: { kata: true },
    idle: ['本日の気温、18度', '充電、残り87%', 'ピピ…', '異常なし', 'ネジ、ゆるみなし', '処理中…処理中…', '湿度、良好', 'ガガ…'], win: ['任務、完了', '計算、終了'], lose: ['再起動、推奨', 'エラー、記録'] },
  { id: 'kujo', name: '九条教授', title: '理詰めの鬼', lv: 5, st: 'keisan', kind: 'human', tag: '教授', look: { g: 'm', age: 'senior', skin: 1, hair: '#d8d8d8', hs: 'bald', shirt: '#5c4033', gl: true, acc: 'bowtie' },
    prof: '数学一筋五十年の名誉教授。対局中は、なぜか論文の話しかしない。',
    idle: ['そういえば、あの論文の締め切りは…', '紅茶が冷めてしまったな', 'ふむ、良い天気だ', '学生時代を思い出すね', '…ああ、失礼。考えごとを', '素数は美しい', 'この椅子は座り心地が良い'], win: ['良い対局でした', 'ふむ、証明終わり'], lose: ['興味深い', 'これは研究の価値がある'] },
  { id: 'schre', name: 'シュレ', title: '箱の中の天才', lv: 5, st: 'keisan', kind: 'cat', tag: '量子猫', look: { color: '#9c9c9c', earC: '#7a7a7a' }, tone: { end: 'にゃ' },
    prof: 'いるのかいないのか分からない、量子の猫。気づくと箱の中で寝ている。',
    idle: ['箱、落ち着く', 'ふぁ〜あ', '観測しないでほしい', 'しっぽが、ここにある', 'ねむい', '…ゴロゴロ', '窓の外に鳥', 'ひなたぼっこ日和'], win: ['ふふん', 'おわり'], lose: ['箱に帰る', 'まあ、いいか'] },
  { id: 'roshi', name: '老師', title: '不沈の甲羅', lv: 5, st: 'inochi', kind: 'turtle', tag: '千年亀', look: { color: '#7fb069' }, tone: { end: 'じゃ' },
    prof: '千年生きた亀の老師。動きは遅いが、負けない打ち方を極めた。',
    idle: ['茶がうまい', '若いのう', 'ほっほっほ', '昔はのう…', 'ちと肩がこるわい', '今日もよい風', 'ゆっくり、ゆっくり', '腹が減ったのう'], win: ['ほっほっほ', '負けぬ者が、最後に勝つ'], lose: ['それもまた道', 'ほっほ、やりおる'] },
  { id: 'sebas', name: 'セバスチャン', title: '完璧なる守り', lv: 5, st: 'inochi', kind: 'human', tag: '執事', look: { g: 'm', age: 'senior', skin: 0, hair: '#bfbfbf', hs: 'side', shirt: '#1b1b1f', acc: 'butler' },
    prof: '名家に仕える老執事。どんな局面でも紅茶の温度を気にしている。',
    idle: ['お紅茶のおかわりはいかがですか', '少々お待ちを', '本日もよいお日和で', 'かしこまりました', '失礼いたします', 'お庭の薔薇が見ごろでございます', 'ふむ'], win: ['お粗末さまでございました', '恐れ入ります'], lose: ['お見事でございます', '精進いたします'] },
  { id: 'bork', name: 'ボルク大将', title: '北極の壁', lv: 5, st: 'inochi', kind: 'bear', tag: '白熊', look: { color: '#f4f1e8' },
    prof: '北極から来た白熊の大将。めったに動じず、PPを凍りつかせる。',
    idle: ['…暑いな', '氷が食べたい', 'ふむ', '北の海が恋しい', '…ガォ', '昼寝の時間だ', '鮭が食べたい'], win: ['うむ', '寒い国の勝ちだ'], lose: ['…ガォ', '修行が足りん'] },
  { id: 'haruhi', name: 'ハルヒ', title: '福を呼ぶ守り神', lv: 5, st: 'inochi', kind: 'human', tag: '座敷わらし', look: { g: 'f', age: 'child', skin: 0, hair: '#1b1b1f', hs: 'bob', shirt: '#c92a2a', acc: 'kimono' },
    prof: '古い屋敷に何百年も住む座敷わらし。見た目は子どもだが、誰より長生き。',
    idle: ['ふふ', 'お手玉、しよ？', 'このおうち、古いね', '…かくれんぼ', 'おまんじゅう、ほしいな', 'あそこ、だれかいる', '鈴の音、きこえる？'], win: ['ふふ、福が来た', 'あそんでくれて、ありがと'], lose: ['ふふ、またね', 'つぎはかくれんぼ'] },
  { id: 'leon', name: 'レオン', title: '百獣の計算王', lv: 5, st: 'gangan', kind: 'lion', tag: 'ライオン', look: { color: '#e9b44c', mane: '#a0522d' },
    prof: 'サバンナを統べる獅子の王。堂々と札を叩きつける。',
    idle: ['ガオォォ！', 'わが王国は広い', '昼寝がしたい', 'たてがみの手入れが大変だ', '王たるもの、焦らぬ', 'サバンナの風は良いぞ', 'ふん'], win: ['ガオォォォ！', '王の勝利だ'], lose: ['ぐぬぬ…', '王も、たまには負ける'] },
  { id: 'toki', name: 'トキ', title: '音速の老婆', lv: 5, st: 'gangan', kind: 'human', tag: 'ジェット婆ちゃん', look: { g: 'f', age: 'senior', skin: 1, hair: '#e8e8e8', hs: 'bun', shirt: '#e03131', acc: 'goggles' },
    prof: '大型バイクで現れる伝説のおばあちゃん。札を出すのも、とにかく速い。',
    idle: ['ブォン！', '今日はどこまで走ろうかね', 'エンジンの調子がいいよ', 'ヘルメット、どこやったっけ', '若いのに負けないよ', 'ガソリン入れなきゃ', 'ひゃっほう'], win: ['ブォォン！', '置いてくよ！'], lose: ['あらら、エンストかい', 'また走るよ'] },
  { id: 'kazakiri', name: 'カザキリ', title: '一閃の剣豪', lv: 5, st: 'gangan', kind: 'human', tag: '剣豪', look: { g: 'm', age: 'adult', skin: 2, hair: '#1b1b1f', hs: 'bun', shirt: '#3b5bdb', acc: 'samurai' },
    prof: '刀を算盤に持ち替えた剣豪。一太刀で三枚を斬る。',
    idle: ['…', '風が鳴いている', '刀の手入れをせねば', '団子が食いたい', '修行の身', '月がきれいだ', 'ふっ'], win: ['斬った', '一閃'], lose: ['未熟', '精進あるのみ'] },
  { id: 'nine', name: 'キャプテン・ナイン', title: '九つの星を奪った男', lv: 5, st: 'gangan', kind: 'human', tag: '宇宙海賊', look: { g: 'm', age: 'adult', skin: 3, hair: '#7a4b2a', hs: 'spiky', shirt: '#2b2522', acc: 'pirate' },
    prof: '銀河をまたにかける宇宙海賊の船長。地球には休暇で来たらしい。',
    idle: ['いい星だ、地球は', '宝の匂いがするな', 'ハッハッハ！', '船の燃料が心配だ', '地球の酒はうまい', '野郎ども、待ってろよ', 'ふん'], win: ['いただきだ！', 'ハッハッハ、楽勝！'], lose: ['覚えてやがれ！', '今日は見逃してやる'] },
  { id: 'omega', name: 'Ω（オメガ）', title: '宇宙から来た数学者', lv: 5, st: 'iroiro', kind: 'alien', tag: '転校生', look: { color: '#9be27a' },
    prof: 'ある日突然やってきた謎の転校生。たぶん宇宙人。地球の数字を研究中。',
    idle: ['地球の空は青い', 'この星の食べ物、興味深い', 'ピポ…', '母星に報告しなければ', '重力、少し強い', 'あなた、面白い', '…交信中'], win: ['データ、収集完了', '地球人、また遊ぼう'], lose: ['興味深い結果', '母星に帰って研究する'] },
  { id: 'pierre', name: 'ピエール', title: '笑う天才', lv: 5, st: 'iroiro', kind: 'human', tag: '道化師', look: { g: 'm', age: 'adult', skin: 0, hair: '#e03131', hs: 'spiky', shirt: '#7048e8', acc: 'clown' },
    prof: 'いつも笑っている道化師。本気なのか、ふざけているのか、誰にも分からない。',
    idle: ['アハハ！', 'ジャグリング、見る？', '風船、ふくらまそうか', 'ルンルン♪', 'おっとっと', 'ハト、出しちゃう？', 'ヒャッホー'], win: ['アハハハ！', 'ショーはおしまい！'], lose: ['アハハ、まいった！', '次の公演でね！'] },
  { id: 'kon', name: 'コン', title: '千の顔を持つ', lv: 5, st: 'iroiro', kind: 'fox', tag: '九尾の狐', look: { color: '#f08c3a' },
    prof: '九本のしっぽを持つ狐。打ち方も顔も、ころころ変える。',
    idle: ['コンコン', '今日はどの顔にしようかしら', 'しっぽの数、数えてみる？', 'うふふ', '油揚げが食べたいわ', '化かしてあげましょうか', 'あら'], win: ['うふふ、化かされた？', 'コーン！'], lose: ['あら、今日は化け損ね', 'うふふ、またね'] },
  { id: 'luna', name: 'ルナ', title: '月夜の怪盗', lv: 5, st: 'iroiro', kind: 'human', tag: '怪盗', look: { g: 'f', age: 'young', skin: 0, hair: '#4c3a7a', hs: 'long', shirt: '#1b1b1f', acc: 'thief' },
    prof: '予告状とともに現れる怪盗。盗むのは宝石と、上がりの一手。',
    idle: ['今夜は満月ね', 'ふふ', 'このお屋敷、警備がゆるいわ', '予告状、出し忘れた', 'あら、いい香り', '…静かね', 'シルクハット、似合う？'], win: ['いただいたわ', 'ごきげんよう'], lose: ['今夜は退散', '次は盗んでみせる'] },

  // ---------- ★4（11人）：口ぐせと要所のセリフ。情報はほとんど出さない ----------
  { id: 'kakeru', name: 'カケル', title: '計算番長', lv: 4, st: 'gangan', kind: 'human', tag: '小6', look: { g: 'm', age: 'child', skin: 2, hair: '#1b1b1f', hs: 'spiky', shirt: '#1b1b1f', acc: 'gakuran' },
    prof: '学ランを羽織った小学校の裏番長。ゼロにだけは勝てない。', idle: ['3枚出しは礼儀だろ', 'へっ', '番長に二言はねえ', '…気合だ'], win: ['どうだ！', 'これが番長だ！'], lose: ['くっ…覚えてろ', 'ゼロのやつめ…'] },
  { id: 'rin', name: 'リン', title: '鉄の生徒会長', lv: 4, st: 'keisan', kind: 'human', tag: '小6', look: { g: 'f', age: 'child', skin: 0, hair: '#3c2b20', hs: 'pony', shirt: '#1864ab', gl: true, acc: 'armband' },
    prof: '完璧主義の生徒会長。番長カケルとは犬猿の仲。', idle: ['静粛に', 'その手、校則違反です', '…計画どおり', 'メガネが曇りました'], win: ['以上、閉会します', '当然の結果です'], lose: ['反省会を開きます', '…想定外です'] },
  { id: 'migi', name: 'ミギ', title: '双子の右', lv: 4, st: 'gangan', kind: 'human', tag: '小5', look: { g: 'm', age: 'child', skin: 1, hair: '#7a4b2a', hs: 'short', shirt: '#e8590c', acc: 'cap' },
    prof: '双子の兄。ヒダリとは打ち方も性格も真逆。', idle: ['いくぞヒダリ！', '右から攻める！', 'よーし'], win: ['右の勝ち！', 'ヒダリ、見たか！'], lose: ['ヒダリに笑われる…', 'くぅ〜'] },
  { id: 'hidari', name: 'ヒダリ', title: '双子の左', lv: 4, st: 'inochi', kind: 'human', tag: '小5', look: { g: 'm', age: 'child', skin: 1, hair: '#7a4b2a', hs: 'short', shirt: '#1c7ed6', acc: 'cap' },
    prof: '双子の弟。慎重派で、兄のミギにいつもあきれている。', idle: ['ミギ、落ち着いて', '左から守る', 'ふう'], win: ['左の勝ちだね', 'ミギ、焦りすぎ'], lose: ['ミギに笑われる…', 'まあ、いっか'] },
  { id: 'nyandan', name: 'にゃん段', title: '元プロ棋士', lv: 4, st: 'keisan', kind: 'cat', tag: '猫', look: { color: '#f2d0a4', earC: '#c4935e' }, tone: { end: 'にゃ' },
    prof: '将棋のプロを引退した猫。三手先まで読むのが口ぐせ。', idle: ['三手先まで読めてる', '盤面は静か', '…ふむ', '肉球が冷える'], win: ['詰みにゃ', '読み筋どおりにゃ'], lose: ['参りました', 'まだまだ修行'] },
  { id: 'yukino', name: 'ユキノ', title: '氷の微笑', lv: 4, st: 'inochi', kind: 'human', tag: '雪女', look: { g: 'f', age: 'young', skin: 0, hair: '#e7f5ff', hs: 'long', shirt: '#d0ebff', acc: 'kimono' },
    prof: '雪山から来た雪女。熱くなった者から負けていく、と言う。', idle: ['熱くなったら負けよ', '…ひんやり', 'ふふ', '雪が恋しいわ'], win: ['凍らせてあげた', 'ふふ、冷たかった？'], lose: ['少し溶けちゃった', 'また雪の日に'] },
  { id: 'takashi', name: 'タカシ', title: '損得勘定のプロ', lv: 4, st: 'keisan', kind: 'human', tag: '商社マン', look: { g: 'm', age: 'adult', skin: 1, hair: '#2b2522', hs: 'side', shirt: '#495057', gl: true, acc: 'tie' },
    prof: '一流商社のエース。何事もコスパで考える。', idle: ['その手、コスパどうです？', 'なるほど', '会議の時間が…', 'ふむ、悪くない'], win: ['商談成立です', 'ありがとうございました'], lose: ['損切りです', '次の案件に期待'] },
  { id: 'karasu', name: 'カラス丸', title: '山の暴れ天狗', lv: 4, st: 'gangan', kind: 'tengu', tag: '天狗', look: { color: '#e03131' },
    prof: '山から下りてきた天狗。鼻と態度がでかい。', idle: ['カーッカッカ！', 'わしの鼻より高いものはない', '風を起こすぞ', 'ふん'], win: ['カーッカッカッカ！', '天狗の勝ちじゃ'], lose: ['鼻を折られた…', '山に帰る'] },
  { id: 'mirai', name: 'ミライ', title: '未来予報機', lv: 4, st: 'iroiro', kind: 'robot', tag: '占いロボ', look: { color: '#cc5de8' }, tone: { kata: true },
    prof: '未来を占うロボ。的中率はちょうど半分。', idle: ['今日ノ運勢、大吉', 'ラッキー数字ハ、7', '占イ中…', '未来ハ、見エテイル'], win: ['予言、的中', '占イ通リ'], lose: ['予言、ハズレ', '再計算シマス'] },
  { id: 'neon', name: 'ネオン', title: '電脳ゲーマー', lv: 4, st: 'iroiro', kind: 'human', tag: 'プロゲーマー', look: { g: 'f', age: 'young', skin: 1, hair: '#f06595', hs: 'pony', shirt: '#212529', acc: 'headphones' },
    prof: '世界大会常連のプロゲーマー。カードゲームも、だいたい攻略済み。', idle: ['GG', 'ラグい…', '配信つけてもいい？', 'このゲーム、神ゲー'], win: ['GG！', '勝ち確〜'], lose: ['GG…', 'リプレイ見直すわ'] },
  { id: 'go', name: 'ゴウ', title: '鉄壁の消防士', lv: 4, st: 'inochi', kind: 'human', tag: '消防士', look: { g: 'm', age: 'adult', skin: 2, hair: '#2b2522', hs: 'buzz', shirt: '#c92a2a', acc: 'helmet' },
    prof: '町を守る消防士。火の元とPPには、とにかく慎重。', idle: ['火の用心！', '安全確認よし', 'ふう', '鍛えてますから'], win: ['鎮火完了！', '安全第一の勝利です'], lose: ['油断しました', '訓練し直します'] },

  // ---------- ★3（12人）：口ぐせと口調。ときどき本音が漏れる ----------
  { id: 'shota', name: 'ショウタ', lv: 3, st: 'gangan', kind: 'human', tag: '小5', look: { g: 'm', age: 'child', skin: 2, hair: '#3c2b20', hs: 'spiky', shirt: '#2f9e44', acc: 'headband' }, prof: '天才ゼロの自称ライバル。毎回挑んでは負ける。', idle: ['次こそゼロに勝つ！', '燃えてきた！'], win: ['見たかゼロ！'], lose: ['くっそー！'] },
  { id: 'ponkichi', name: 'ポン吉', lv: 3, st: 'iroiro', kind: 'tanuki', tag: '化けダヌキ', look: { color: '#a07850' }, tone: { end: 'ぽん' }, prof: '打ち方がころころ化けるタヌキ。たまに葉っぱが混ざる。', idle: ['化けるぽん', '葉っぱ、どこやった'], win: ['ぽんぽこぽーん'], lose: ['しっぽが出た'] },
  { id: 'gen', name: 'ゲンさん', lv: 3, st: 'keisan', kind: 'human', tag: '銭湯の番台', look: { g: 'm', age: 'senior', skin: 2, hair: '#a5a5a5', hs: 'buzz', shirt: '#f1f3f5', acc: 'towel' }, prof: 'お釣りの計算なら町いちばん。', idle: ['お釣りはぴったりだよ', 'いい湯だな'], win: ['毎度あり！'], lose: ['湯冷めしちまった'] },
  { id: 'nana', name: 'マダム・ナナ', lv: 3, st: 'iroiro', kind: 'human', tag: '占い師', look: { g: 'f', age: 'adult', skin: 1, hair: '#5f3dc4', hs: 'long', shirt: '#862e9c', acc: 'turban' }, prof: '水晶玉で次の場を占う。たまに当たる。', idle: ['次の場は…7と出ています', '水晶が曇っているわ'], win: ['占いどおり'], lose: ['星の巡りが悪いわ'] },
  { id: 'marco', name: 'シェフ・マルコ', lv: 3, st: 'inochi', kind: 'human', tag: '料理人', look: { g: 'm', age: 'adult', skin: 0, hair: '#5a3a24', hs: 'short', shirt: '#f8f9fa', acc: 'chef' }, prof: '素材を大事にするイタリア料理人。大きい札から下ごしらえ。', idle: ['下ごしらえが大事', 'ボーノ'], win: ['ボーノ！'], lose: ['焦がしちゃった'] },
  { id: 'saki', name: 'サキ', lv: 3, st: 'gangan', kind: 'human', tag: '柔道部', look: { g: 'f', age: 'young', skin: 2, hair: '#2b2522', hs: 'pony', shirt: '#f8f9fa', acc: 'judo' }, prof: '一本勝ちしか狙わない柔道部のエース。', idle: ['一本！', '押忍！'], win: ['一本勝ち！'], lose: ['技あり取られた…'] },
  { id: 'shiori', name: 'シオリ', lv: 3, st: 'keisan', kind: 'human', tag: '小4', look: { g: 'f', age: 'child', skin: 0, hair: '#3c2b20', hs: 'bob', shirt: '#ffd43b', gl: true, acc: 'book' }, prof: '図書委員。計算の本を全部読んだ。', idle: ['本に書いてあった', 'しーっ、静かに'], win: ['本のとおり！'], lose: ['続きを読まなきゃ'] },
  { id: 'kawataro', name: 'カワタロウ', lv: 3, st: 'inochi', kind: 'kappa', tag: '河童', look: { color: '#69b34c' }, tone: { end: 'かっぱ' }, prof: '川から来た河童。頭の皿が乾くと弱くなる。', idle: ['皿が乾く', 'きゅうり食べたい'], win: ['かっぱっぱ！'], lose: ['皿が割れた'] },
  { id: 'poston', name: 'ポストン', lv: 3, st: 'keisan', kind: 'mailbox', tag: 'ポスト型ロボ', look: { color: '#e03131' }, tone: { kata: true }, prof: '町のポストがロボになった。数字の仕分けが得意。', idle: ['郵便デス', '仕分ケ中'], win: ['配達完了'], lose: ['宛先不明'] },
  { id: 'hama', name: 'ハマさん', lv: 3, st: 'gangan', kind: 'human', tag: '漁師', look: { g: 'm', age: 'senior', skin: 3, hair: '#e8e8e8', hs: 'buzz', shirt: '#1864ab', acc: 'headband' }, prof: '海の男。豪快に札を出す。', idle: ['大漁だ！', '海は広いぞ'], win: ['大漁旗だ！'], lose: ['今日は不漁だ'] },
  { id: 'airi', name: 'アイリ', lv: 3, st: 'iroiro', kind: 'human', tag: '歌姫', look: { g: 'f', age: 'young', skin: 0, hair: '#f783ac', hs: 'pony', shirt: '#f06595', acc: 'ribbon' }, prof: 'ステージ帰りのアイドル。気分で打ち方が変わる。', idle: ['ラララ♪', 'ファンのみんな、見てる〜？'], win: ['アンコールありがと！'], lose: ['次のライブで取り返す！'] },
  { id: 'midori', name: 'ミドリ先生', lv: 3, st: 'inochi', kind: 'human', tag: '保健室の先生', look: { g: 'f', age: 'adult', skin: 0, hair: '#5a3a24', hs: 'bun', shirt: '#f8f9fa', gl: true, acc: 'coat' }, prof: '保健室の先生。無理は禁物がモットー。', idle: ['無理は禁物よ', '深呼吸して'], win: ['お大事に'], lose: ['休憩しましょ'] },

  // ---------- ★2（11人）：本音がよく漏れる ----------
  { id: 'hayate', name: 'ハヤテ', lv: 2, st: 'gangan', kind: 'human', tag: '見習い忍者', look: { g: 'm', age: 'young', skin: 1, hair: '#1b1b1f', hs: 'short', shirt: '#343a40', acc: 'ninja' }, tone: { end: 'でござる' }, prof: '速さは一流、計算は二流の見習い忍者。' },
  { id: 'tome', name: 'トメさん', lv: 2, st: 'inochi', kind: 'human', tag: '八百屋', look: { g: 'f', age: 'senior', skin: 1, hair: '#c9c9c9', hs: 'bun', shirt: '#2f9e44', acc: 'apron' }, prof: '「Kは傷む前に売るんだよ！」大きい札から捨てる。' },
  { id: 'warizan', name: 'わりざん', lv: 2, st: 'iroiro', kind: 'divsprite', tag: '割り算の妖精', look: { color: '#ffd8a8' }, prof: '頭が÷の形をした妖精。「割り切れない世の中だよね〜」' },
  { id: 'penta', name: 'ペン太', lv: 2, st: 'keisan', kind: 'penguin', tag: 'ペンギン', look: {}, prof: '南極から迷い込んだペンギン。寒いと手が止まる。' },
  { id: 'susumu', name: 'ススム', lv: 2, st: 'keisan', kind: 'human', tag: '新入社員', look: { g: 'm', age: 'young', skin: 0, hair: '#2b2522', hs: 'side', shirt: '#4263eb', acc: 'tie' }, prof: '入社1年目。電卓が手放せない。' },
  { id: 'daichi', name: 'ダイチ', lv: 2, st: 'gangan', kind: 'human', tag: '小3', look: { g: 'm', age: 'child', skin: 3, hair: '#1b1b1f', hs: 'buzz', shirt: '#f8f9fa', acc: 'baseball' }, prof: '野球少年。全部ホームラン狙い。' },
  { id: 'hyudoro', name: 'ヒュードロ', lv: 2, st: 'iroiro', kind: 'ghost', tag: 'おばけ', look: {}, prof: '夜しか元気が出ないおばけ。昼間はずっと眠い。' },
  { id: 'hanako', name: 'ハナコ', lv: 2, st: 'inochi', kind: 'human', tag: '花屋', look: { g: 'f', age: 'adult', skin: 1, hair: '#a8763e', hs: 'bob', shirt: '#f783ac', acc: 'flower' }, prof: '花屋さん。札も花も、大事に扱う。' },
  { id: 'yamada', name: 'ヤマダ課長', lv: 2, st: 'gangan', kind: 'human', tag: '課長', look: { g: 'm', age: 'adult', skin: 1, hair: '#2b2522', hs: 'bald', shirt: '#868e96', gl: true, acc: 'tie' }, prof: 'カラオケが大好きな課長。勢いだけはある。' },
  { id: 'buko', name: 'ブーコ', lv: 2, st: 'inochi', kind: 'pig', tag: '子ブタ', look: {}, prof: 'のんびり屋の子ブタ。おやつの時間には誰より正確。' },
  { id: 'tetsu', name: 'テツ', lv: 2, st: 'keisan', kind: 'human', tag: '鉄道ファン', look: { g: 'm', age: 'young', skin: 0, hair: '#3c2b20', hs: 'short', shirt: '#0ca678', gl: true, acc: 'cap' }, prof: '時刻表を全部覚えている鉄道ファン。' },

  // ---------- ★1（10人）：本音がだだ漏れ ----------
  { id: 'pochi', name: 'ポチ', lv: 1, st: 'iroiro', kind: 'dog', tag: '柴犬', look: { color: '#d9925b' }, tone: { end: 'ワン' }, prof: '札をかじるのが好きな柴犬。好きな数字は骨の数。' },
  { id: 'mio', name: 'ミオ', lv: 1, st: 'gangan', kind: 'human', tag: '小1', look: { g: 'f', age: 'child', skin: 0, hair: '#3c2b20', hs: 'pony', shirt: '#fab005', acc: 'ribbon' }, prof: 'とにかく3枚出したい小学1年生。' },
  { id: 'sasa', name: 'ササ', lv: 1, st: 'inochi', kind: 'panda', tag: 'パンダ', look: {}, prof: '笹を食べながら打つパンダ。だいたい眠そう。' },
  { id: 'piyo', name: 'ピヨ', lv: 1, st: 'iroiro', kind: 'chick', tag: 'ひよこ', look: {}, tone: { end: 'ピヨ' }, prof: '生まれたてのひよこ。数字はまだ3までしか知らない。' },
  { id: 'yukio', name: 'ユキオ', lv: 1, st: 'inochi', kind: 'snowman', tag: '雪だるま', look: {}, prof: '冬のあいだだけ倶楽部に来る雪だるま。暑いと溶ける。' },
  { id: 'pipo', name: 'ピポ', lv: 1, st: 'gangan', kind: 'alien', tag: '宇宙人の子', look: { color: '#74c0fc' }, tone: { end: 'ピポ' }, prof: 'Ωについてきた宇宙人の子ども。地球の数字は勉強中。' },
  { id: 'heikichi', name: 'ヘイキチじいさん', lv: 1, st: 'keisan', kind: 'human', tag: 'ご隠居', look: { g: 'm', age: 'senior', skin: 1, hair: '#e8e8e8', hs: 'bald', shirt: '#868e96', gl: true }, prof: '「老眼で数字がよう見えん」が口ぐせのご隠居。' },
  { id: 'tama', name: 'タマ', lv: 1, st: 'iroiro', kind: 'cat', tag: '三毛猫', look: { color: '#fff4e6', earC: '#e8590c' }, tone: { end: 'にゃ' }, prof: '気まぐれな三毛猫。札よりひなたが好き。' },
  { id: 'suisui', name: 'スイスイ', lv: 1, st: 'keisan', kind: 'robot', tag: 'お掃除ロボ', look: { color: '#dee2e6' }, tone: { kata: true }, prof: '掃除のついでに参加しているロボ。たまに札を吸い込む。' },
  { id: 'kerosuke', name: 'ケロスケ', lv: 1, st: 'gangan', kind: 'frog', tag: 'カエル', look: {}, tone: { end: 'ケロ' }, prof: '雨の日だけ元気なカエル。とにかく跳ねるように出す。' }
];
KB.ROSTER = R;
// ---------- ★6（唯一）：カナタ。ROSTER には入れない（予選・練習では当たらず、大会の決勝にだけ現れる） ----------
// 大会に参加する確率は、ほかのキャラの1.5倍（参加AIの人数 ÷ キャラの総数 × 1.5）
KB.KANATA = { id: 'kanata', name: 'カナタ', title: '卓の彼方を視る者', lv: 6, st: 'keisan', kind: 'human', tag: '年齢不詳', look: { g: 'm', age: 'adult', skin: 0, hair: '#eef0f6', hs: 'long', shirt: '#1b2340', cool: true, closed: true, bgpat: 'pat:void' },
  prof: '計算ブリッジ倶楽部の初代チャンピオン。いつから倶楽部にいるのか、誰も知らない。ゼロに計算を教えた師。ふだんは目を閉じたまま打つが、奥義「絶対透視」で目を開くと、山札の底まで見通すという。',
  idle: ['……'], win: ['最初から、そう決まっていた'], lose: ['……面白い'] };
KB.kanataRate = nAI => Math.min(1, nAI / (R.length + 1) * 1.5); // ほかのキャラが選ばれる割合の1.5倍（出会いやすく）
// ライバル関係（同じ卓にいると、上がったときに相手が反応する）
KB.RIVALS = { zero: 'shota', shota: 'zero', kakeru: 'rin', rin: 'kakeru', migi: 'hidari', hidari: 'migi', pipo: 'omega' };

// ---------- キャラを選ぶ ----------
const SKIN = ['#f6d7bf', '#efc4a2', '#e2ab84', '#c98d65', '#9b6646'];
KB.charToCh = function (c) {
  const L = c.look || {};
  return { charId: c.id, kind: c.kind, name: c.name, title: c.title || '', ageJa: c.tag || '', gender: L.g || 'm', age: L.age || 'adult', skin: SKIN[L.skin || 0], hair: L.hair || '#2b2522', hs: L.hs || 'short', shirt: L.shirt || '#868e96', glasses: !!L.gl, acc: L.acc || null, cool: !!L.cool, closed: !!L.closed, bgpat: L.bgpat || null, color: L.color, earC: L.earC, mane: L.mane };
};
KB.charById = id => id === 'kanata' ? KB.KANATA : R.find(c => c.id === id);
// level の中から、style（指定があれば優先）で、まだ使っていないキャラを選ぶ。いなければ近い強さから
KB.pickChar = function (level, style, used) {
  used = used || new Set();
  const free = lv => R.filter(c => c.lv === lv && !used.has(c.id));
  for (const d of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
    const lv = level + d; if (lv < 1 || lv > 5) continue;
    let pool = free(lv); if (!pool.length) continue;
    if (style && d === 0) { const s = pool.filter(c => c.st === style); if (s.length) pool = s; }
    const c = pool[(Math.random() * pool.length) | 0]; used.add(c.id);
    return c;
  }
  return R[(Math.random() * R.length) | 0];
};

// ---------- セリフ ----------
const toKata = s => s.replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
function applyTone(c, s) {
  const t = c && c.tone; if (!t || !s) return s;
  if (t.end && !/^[…・]+$/.test(s) && !s.includes(t.end)) s = s.replace(/([。！？!?…♪〜ー]*)$/, (m) => t.end + (m.replace(/。/g, '') || ''));
  if (t.kata) s = toKata(s);
  return s;
}
// 本音（★1〜2）：手札の様子がそのまま出る
const TELL = {
  draw: ['うわ、出せない…', 'えー、作れないよ〜', 'どうしよう…', 'また引くのか〜'],
  reach: ['あと少しで上がれる！', 'もうすぐ上がりそう！', 'あと{h}枚！'],
  play3: ['3枚も出せた！', 'やった、まとめて出せた！'],
  heavy: ['大きい数ばっかりで重い…', 'K とか Q がじゃまだなあ'],
  many: ['手札が多すぎる〜', '全然減らない…'],
  play: ['これなら出せる！', 'よし、出せた'],
  win: ['やったー！上がった！', 'わーい、勝った！'],
  lose: ['負けちゃった…', 'くやしい〜！', 'つぎはがんばる…']
};
const ANIMAL = { dog: ['ワン！', 'クゥ〜ン…', 'ワンワン！'], cat: ['にゃ〜', 'にゃっ'], penguin: ['ペペッ', 'ペン…'], pig: ['ブヒッ', 'ブー…'], frog: ['ケロッ', 'ゲコ…'], chick: ['ピヨッ', 'ピヨピヨ'], panda: ['…むしゃむしゃ', 'ふぁ〜'] };
const STYLE_LINES = {
  gangan: { play3: ['まとめて行くぜ！', '一気に3枚！'], play: ['いくぜ！', 'よし！'], draw: ['くっ…', '次こそ！'], reach: ['もらった！'], win: ['よっしゃあ！'], lose: ['次は勝つ！'] },
  inochi: { play3: ['大きい札から片付け', 'ここは処分'], play: ['安全第一', '慎重に…'], draw: ['想定内です', '焦らない焦らない'], reach: ['油断は禁物'], win: ['ほっとした〜'], lose: ['被害は小さく済んだかな'] },
  iroiro: { play3: ['今日はこれ！', 'ふふん♪'], play: ['なんとなく！', 'これでいいや'], draw: ['あらら', 'まあいっか'], reach: ['いけるかも？'], win: ['やったー！'], lose: ['楽しかった！'] },
  keisan: { play3: ['計算通り', '確率的にはこう'], play: ['ここは温存', 'ふむ'], draw: ['仕方ない', '期待値は悪くない'], reach: ['読み切った'], win: ['計算通りです'], lose: ['分散ですね'] }
};
// p: プレイヤー（ch.charId があれば固定キャラ）、kind: play|play3|draw|reach|win|lose、info: {h:残り枚数, big:10以上の枚数}
KB.charLine = function (p, kind, info) {
  info = info || {};
  const c = p && p.ch && p.ch.charId ? KB.charById(p.ch.charId) : null;
  const pick = a => a[(Math.random() * a.length) | 0];
  const lv = c ? c.lv : (p && p.level) || 3;
  if (!c) return KB.line(p.style, kind, null, p.level);
  const fill = s => s.replace('{h}', info.h != null ? info.h : '');
  if (kind === 'win' && c.win) return applyTone(c, pick(c.win));
  if (kind === 'lose' && c.lose) return applyTone(c, pick(c.lose));
  // ★4〜5：局面に関係のない口ぐせ・独り言（どの局面でも同じように出る）
  if (lv >= 4) return applyTone(c, pick(c.idle || ['…']));
  // ★3：口ぐせが半分、残りは打ち方のセリフ（本音もときどき）
  if (lv === 3) {
    if (c.idle && Math.random() < 0.5) return applyTone(c, pick(c.idle));
    if (Math.random() < 0.35 && TELL[kind]) return applyTone(c, fill(pick(TELL[kind])));
    const L = STYLE_LINES[c.st] || STYLE_LINES.keisan; return applyTone(c, pick(L[kind] || L.play));
  }
  // ★1〜2：本音がだだ漏れ（手札が重い・多いも本当のこと）
  if (ANIMAL[c.kind] && Math.random() < 0.35) { const a = ANIMAL[c.kind]; return kind === 'draw' || info.big >= 2 ? a[1] || a[0] : a[0]; }
  let k = kind;
  if ((kind === 'play' || kind === 'draw') && info.big >= 2 && Math.random() < 0.5) k = 'heavy';
  else if (kind === 'draw' && info.h >= 9 && Math.random() < 0.5) k = 'many';
  return applyTone(c, fill(pick(TELL[k] || TELL.play)));
};
KB.charTalkRate = function (p) {
  const c = p && p.ch && p.ch.charId ? KB.charById(p.ch.charId) : null;
  if (!c) return KB.talkRate(p.level);
  return [0.85, 0.7, 0.45, 0.28, 0.22, 0.12][c.lv - 1]; // ★5も少しは話す（ただし中身は無関係）
};

// ---------- 見た目：人間以外のキャラと、人間の小物 ----------
const INK = '#2a211c';
function faceParts(mood, cx, eyY, ex, er, my, light) {
  const ink = light ? '#fff' : INK;
  let eyes;
  if (mood === 'happy') eyes = `<path d="M${cx - ex - 4} ${eyY + 1}Q${cx - ex} ${eyY - 4} ${cx - ex + 4} ${eyY + 1}M${cx + ex - 4} ${eyY + 1}Q${cx + ex} ${eyY - 4} ${cx + ex + 4} ${eyY + 1}" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  else if (mood === 'smug' || mood === 'sleepy') eyes = `<path d="M${cx - ex - 4} ${eyY}L${cx - ex + 4} ${eyY}M${cx + ex - 4} ${eyY}L${cx + ex + 4} ${eyY}" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
  else eyes = `<circle cx="${cx - ex}" cy="${eyY}" r="${er}" fill="${ink}"/><circle cx="${cx + ex}" cy="${eyY}" r="${er}" fill="${ink}"/><circle cx="${cx - ex + 1}" cy="${eyY - 1}" r="0.9" fill="#fff"/><circle cx="${cx + ex + 1}" cy="${eyY - 1}" r="0.9" fill="#fff"/>`;
  let mouth;
  if (mood === 'happy') mouth = `<path d="M${cx - 6} ${my - 1}Q${cx} ${my + 7} ${cx + 6} ${my - 1}Z" fill="#8c2f2f"/>`;
  else if (mood === 'worried') mouth = `<path d="M${cx - 5} ${my + 3}Q${cx} ${my - 2} ${cx + 5} ${my + 3}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  else mouth = `<path d="M${cx - 5} ${my}Q${cx} ${my + 3} ${cx + 5} ${my}" stroke="${ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  return eyes + mouth;
}
KB.creatureSVG = function (ch, mood) {
  const k = ch.kind, c = ch.color;
  const body = (fill) => `<path d="M16 104Q20 82 50 80Q80 82 84 104Z" fill="${fill}"/>`;
  const head = (fill, rx, ry, cy) => `<ellipse cx="50" cy="${cy || 52}" rx="${rx || 24}" ry="${ry || 23}" fill="${fill}"/>`;
  const f = (eyY, my, ex, light) => faceParts(mood, 50, eyY, ex || 9, 3, my, light);
  switch (k) {
    case 'dog': return body('#c97d45') + `<ellipse cx="27" cy="44" rx="8" ry="14" fill="${ch.earC || '#a0612f'}" transform="rotate(20 27 44)"/><ellipse cx="73" cy="44" rx="8" ry="14" fill="${ch.earC || '#a0612f'}" transform="rotate(-20 73 44)"/>` + head(c || '#d9925b') + `<ellipse cx="50" cy="62" rx="12" ry="9" fill="#fff3e0"/><ellipse cx="50" cy="57" rx="4" ry="3" fill="${INK}"/>` + f(49, 66);
    case 'cat': return body(c || '#f2d0a4') + `<path d="M28 40L30 18L44 32Z M72 40L70 18L56 32Z" fill="${ch.earC || c || '#c4935e'}"/>` + head(c || '#f2d0a4') + `<path d="M30 60h-10M30 64h-10M70 60h10M70 64h10" stroke="#7a6a5a" stroke-width="1"/><path d="M48 58h4l-2 3Z" fill="#e8798a"/>` + f(50, 64);
    case 'tanuki': return body('#8a6a48') + `<circle cx="30" cy="32" r="8" fill="#6b4e33"/><circle cx="70" cy="32" r="8" fill="#6b4e33"/>` + head(c || '#a07850') + `<ellipse cx="40" cy="51" rx="9" ry="7" fill="#4a3424"/><ellipse cx="60" cy="51" rx="9" ry="7" fill="#4a3424"/><ellipse cx="50" cy="63" rx="10" ry="7" fill="#efe1c8"/><circle cx="50" cy="59" r="3" fill="${INK}"/><path d="M47 22q3 -6 8 -2q-2 4 -8 2Z" fill="#40c057"/>` + f(51, 66, 10, true);
    case 'fox': return body('#e8873a') + `<path d="M26 44L28 14L46 32Z M74 44L72 14L54 32Z" fill="${c || '#f08c3a'}"/><path d="M30 38L31 22L40 32Z M70 38L69 22L60 32Z" fill="#fff3e0"/>` + head(c || '#f08c3a') + `<path d="M34 58Q50 80 66 58Q58 66 50 66Q42 66 34 58Z" fill="#fff3e0"/><circle cx="50" cy="63" r="3" fill="${INK}"/><path d="M42 30l-3 8M58 30l3 8" stroke="#c92a2a" stroke-width="2"/>` + f(50, 69);
    case 'bear': return body('#e9e4d8') + `<circle cx="30" cy="32" r="9" fill="${c || '#f4f1e8'}"/><circle cx="70" cy="32" r="9" fill="${c || '#f4f1e8'}"/>` + head(c || '#f4f1e8', 26, 24) + `<ellipse cx="50" cy="62" rx="11" ry="8" fill="#fff"/><ellipse cx="50" cy="58" rx="4" ry="3" fill="${INK}"/><path d="M38 76h24" stroke="#c92a2a" stroke-width="4"/>` + f(49, 66);
    case 'dragon': return `<path d="M20 74Q2 50 8 26Q16 42 30 54Z M80 74Q98 50 92 26Q84 42 70 54Z" fill="#1f7a35"/><path d="M12 32Q18 46 28 54M88 32Q82 46 72 54" stroke="#69db7c" stroke-width="1.5" fill="none"/>` + body('#2f9e44') + `<path d="M38 104Q40 88 50 86Q60 88 62 104Z" fill="#d8f5a2"/>` + `<path d="M33 34L25 8L43 28Z M67 34L75 8L57 28Z" fill="#fff3bf" stroke="#e8c547" stroke-width="1"/>` + head(c || '#40c057', 25, 22, 46) + `<path d="M43 28l3 -9 3 9M51 28l3 -9 3 9" fill="#8ce99a"/><path d="M30 40q6 -4 12 -1M70 40q-6 -4 -12 -1" stroke="#1f7a35" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
      // 長い鼻先：顔と同じ色でつなげて下へ張り出す（輪郭線なし）。先だけ明るく、鼻すじは顔から続く
      `<path d="M30 54Q50 44 70 54Q70 70 64 77Q57 84 50 84Q43 84 36 77Q30 70 30 54Z" fill="${c || '#40c057'}"/><path d="M44 46Q43 60 41 70M56 46Q57 60 59 70" stroke="#2f9e44" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M43 58q7 2 14 0M42 64q8 2 16 0" stroke="#2f9e44" stroke-width="1" fill="none"/><ellipse cx="50" cy="74" rx="13" ry="8" fill="#8ce99a" opacity=".8"/>` +
      `<ellipse cx="45" cy="72" rx="3" ry="2" fill="#1b4d2a" transform="rotate(-20 45 72)"/><ellipse cx="55" cy="72" rx="3" ry="2" fill="#1b4d2a" transform="rotate(20 55 72)"/>` +
      // 金色の長いひげ（左右1本ずつ。鼻の横から大きく流れて先がくるり）
      `<path d="M40 72Q22 66 14 78Q8 90 4 98Q2 104 8 104M60 72Q78 66 86 78Q92 90 96 98Q98 104 92 104" stroke="#fcc419" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
      faceParts(mood, 50, 42, 11, 3.2, 79, false) + `<path d="M45 80l1.5 3.5 1.5 -3.5M52 80l1.5 3.5 1.5 -3.5" fill="#fff"/>`;
    case 'lion': return body('#d9a441') + `<circle cx="50" cy="52" r="34" fill="${ch.mane || '#a0522d'}"/><path d="M50 18l4 -8 4 8M30 24l-2 -8 7 5M70 24l2 -8 -7 5" fill="#f2c94c"/>` + head(c || '#e9b44c', 24, 23) + `<ellipse cx="50" cy="62" rx="11" ry="8" fill="#f7e0b0"/><path d="M46 57h8l-4 4Z" fill="${INK}"/>` + f(49, 66);
    case 'panda': return body('#fff') + `<circle cx="29" cy="31" r="8" fill="#222"/><circle cx="71" cy="31" r="8" fill="#222"/>` + head('#fff') + `<ellipse cx="40" cy="50" rx="7" ry="8" fill="#222" transform="rotate(-20 40 50)"/><ellipse cx="60" cy="50" rx="7" ry="8" fill="#222" transform="rotate(20 60 50)"/><ellipse cx="50" cy="60" rx="4" ry="3" fill="${INK}"/><path d="M62 76l12 -14" stroke="#40c057" stroke-width="3"/>` + f(51, 66, 10, true);
    case 'pig': return body('#f7a8b8') + `<path d="M30 36L28 22L42 30Z M70 36L72 22L58 30Z" fill="#f48ba3"/>` + head('#f7b5c4') + `<ellipse cx="50" cy="62" rx="9" ry="6.5" fill="#f48ba3"/><circle cx="47" cy="62" r="1.6" fill="#a13a55"/><circle cx="53" cy="62" r="1.6" fill="#a13a55"/>` + f(50, 70);
    case 'penguin': return body('#2d3436') + head('#2d3436', 25, 25) + `<ellipse cx="50" cy="58" rx="17" ry="17" fill="#fff"/><path d="M45 60h10l-5 6Z" fill="#f59f00"/>` + f(52, 70, 8);
    case 'chick': return body('#ffd43b') + `<path d="M48 26q2 -8 6 -4q-1 4 -6 4Z" fill="#fab005"/>` + head('#ffe066', 25, 25) + `<path d="M45 60h10l-5 6Z" fill="#f76707"/>` + f(52, 70, 9);
    case 'frog': return body('#5aa84f') + `<circle cx="36" cy="34" r="10" fill="#7bc96f"/><circle cx="64" cy="34" r="10" fill="#7bc96f"/><circle cx="36" cy="34" r="6" fill="#fff"/><circle cx="64" cy="34" r="6" fill="#fff"/>` + head('#7bc96f', 27, 21, 56) + faceParts(mood, 50, 34, 14, 3, 64);
    case 'turtle': return body('#6a994e') + `<path d="M22 70Q50 40 78 70Z" fill="#a47148"/><path d="M34 62h32M40 54l20 0" stroke="#7f5539" stroke-width="2"/>` + head(c || '#7fb069', 21, 20, 46) + `<path d="M38 62q12 6 24 0" stroke="#e8e8e8" stroke-width="4" fill="none"/>` + f(44, 54, 8);
    case 'skeleton': return body('#343a40') + `<path d="M36 84v20M64 84v20M38 90h24M39 96h22" stroke="#e9ecef" stroke-width="2.4" stroke-linecap="round"/><path d="M50 82v22" stroke="#e9ecef" stroke-width="3"/>` + `<path d="M27 50Q26 24 50 24Q74 24 73 50Q73 62 64 66V74H36V66Q27 62 27 50Z" fill="#f8f9fa" stroke="#ced4da" stroke-width="1"/>` + (mood === 'sleepy' ? `<path d="M34 50h10M56 50h10" stroke="#212529" stroke-width="3" stroke-linecap="round"/>` : `<ellipse cx="40" cy="50" rx="7" ry="${mood === 'shock' ? 9 : 7.5}" fill="#212529"/><ellipse cx="60" cy="50" rx="7" ry="${mood === 'shock' ? 9 : 7.5}" fill="#212529"/><circle cx="41.5" cy="48" r="1.8" fill="#fff"/><circle cx="61.5" cy="48" r="1.8" fill="#fff"/>`) + `<path d="M50 56l-3.5 6h7Z" fill="#212529"/><path d="M39 67h22M43 64v7M47 64v7M51 64v7M55 64v7" stroke="#868e96" stroke-width="1.2"/>` + (mood === 'happy' || mood === 'smug' ? `<path d="M37 67Q50 75 63 67" fill="none" stroke="#495057" stroke-width="1.4"/>` : '');
    case 'robot': return body('#868e96') + `<path d="M50 24V12" stroke="#495057" stroke-width="3"/><circle cx="50" cy="11" r="4" fill="#ff6b6b"/><rect x="26" y="26" width="48" height="46" rx="10" fill="${c || '#adb5bd'}" stroke="#495057" stroke-width="2"/><rect x="32" y="38" width="36" height="14" rx="5" fill="#1b1b1f"/><circle cx="41" cy="45" r="4" fill="${mood === 'worried' ? '#ff6b6b' : '#69db7c'}"/><circle cx="59" cy="45" r="4" fill="${mood === 'worried' ? '#ff6b6b' : '#69db7c'}"/><path d="M40 62h20" stroke="#495057" stroke-width="3" stroke-dasharray="3 2"/>`;
    case 'mailbox': return body('#868e96') + `<rect x="27" y="22" width="46" height="54" rx="12" fill="${c || '#e03131'}" stroke="#a51111" stroke-width="2"/><rect x="34" y="30" width="32" height="5" rx="2" fill="#1b1b1f"/><path d="M42 38h16M50 38v8" stroke="#fff" stroke-width="2.5"/>` + faceParts(mood, 50, 54, 9, 3, 64, true);
    case 'alien': return body('#495057') + `<path d="M40 30l-6 -14M60 30l6 -14" stroke="${c || '#9be27a'}" stroke-width="3"/><circle cx="34" cy="15" r="3.5" fill="#ffd43b"/><circle cx="66" cy="15" r="3.5" fill="#ffd43b"/><path d="M24 50Q24 24 50 24Q76 24 76 50Q76 74 50 78Q24 74 24 50Z" fill="${c || '#9be27a'}"/><ellipse cx="39" cy="50" rx="7" ry="9" fill="#1b1b1f" transform="rotate(-15 39 50)"/><ellipse cx="61" cy="50" rx="7" ry="9" fill="#1b1b1f" transform="rotate(15 61 50)"/><circle cx="41" cy="47" r="2" fill="#fff"/><circle cx="63" cy="47" r="2" fill="#fff"/><path d="M45 66q5 ${mood === 'happy' ? 4 : 1} 10 0" stroke="#1b1b1f" stroke-width="2" fill="none"/>`;
    case 'ghost': return `<path d="M24 92V50Q24 22 50 22Q76 22 76 50V92l-8 -6l-9 6l-9 -6l-9 6l-9 -6Z" fill="#f8f9fa" stroke="#ced4da"/><path d="M42 18l8 -6 8 6" fill="none" stroke="#ced4da" stroke-width="2"/>` + f(48, 62);
    case 'snowman': return `<circle cx="50" cy="86" r="22" fill="#f8f9fa"/>` + head('#fff', 22, 21, 50) + `<rect x="34" y="22" width="32" height="10" fill="#1b1b1f"/><rect x="30" y="31" width="40" height="4" fill="#1b1b1f"/><path d="M50 56l12 3l-12 2Z" fill="#f76707"/><path d="M30 70h40" stroke="#c92a2a" stroke-width="5"/>` + f(48, 62);
    case 'divsprite': return body('#ffa94d') + `<circle cx="50" cy="12" r="5" fill="#f08c00"/><rect x="26" y="20" width="48" height="6" rx="3" fill="#f08c00"/>` + head(c || '#ffd8a8', 23, 22, 54) + `<circle cx="50" cy="88" r="5" fill="#f08c00"/>` + f(52, 66);
    case 'kappa': return body('#4c9a3a') + head(c || '#69b34c') + `<ellipse cx="50" cy="31" rx="15" ry="5" fill="#e7f5ff" stroke="#a5d8ff"/><path d="M42 60h16l-8 6Z" fill="#fab005"/><path d="M28 40q-6 -4 -2 -10M72 40q6 -4 2 -10" stroke="#2b2522" stroke-width="2" fill="none"/>` + f(49, 70);
    case 'tengu': return body('#343a40') + `<path d="M26 40Q26 22 50 22Q74 22 74 40" fill="#1b1b1f"/><rect x="44" y="12" width="12" height="12" fill="#1b1b1f"/>` + head(c || '#e03131') + `<path d="M48 54l22 6l-22 4Z" fill="#c92a2a"/><path d="M36 42l10 3M64 42l-10 3" stroke="#fff" stroke-width="2.5"/>` + f(50, 70);
    default: return head('#ccc');
  }
};
// 人間の小物（キャラごとの目印）。fy=顔の中心の高さ、rx=顔の横幅、top=頭のてっぺん
// 顔の小物（ひげ・そばかす・サングラスなど）
KB.faceSVG = function (face, fy, eyY, ex) {
  switch (face) {
    case 'mustache': return `<path d="M50 ${fy + 9}q-5 -3 -10 1q4 4 10 0q6 4 10 0q-5 -4 -10 -1Z" fill="#3c2b20"/>`;
    case 'beard': return `<path d="M${50 - 20} ${fy + 4}Q${50 - 18} ${fy + 30} 50 ${fy + 30}Q${50 + 18} ${fy + 30} ${50 + 20} ${fy + 4}Q${50 + 12} ${fy + 20} 50 ${fy + 19}Q${50 - 12} ${fy + 20} ${50 - 20} ${fy + 4}Z" fill="#5a3a24"/>`;
    case 'freckles': return `<g fill="#b5763a" opacity=".7">${[-1, 1].map(sg => [0, 1, 2].map(k => `<circle cx="${50 + sg * (ex + 1 + k * 2.5)}" cy="${eyY + 6 + (k % 2) * 1.5}" r=".9"/>`).join('')).join('')}</g>`;
    case 'blush': return `<ellipse cx="${50 - ex - 4}" cy="${eyY + 7}" rx="4" ry="2.4" fill="#f06595" opacity=".55"/><ellipse cx="${50 + ex + 4}" cy="${eyY + 7}" rx="4" ry="2.4" fill="#f06595" opacity=".55"/>`;
    case 'sunglasses': return `<path d="M${50 - ex - 7} ${eyY - 4}h12v6q-6 4 -12 0Z M${50 + ex - 5} ${eyY - 4}h12v6q-6 4 -12 0Z" fill="#1b1b1f"/><path d="M${50 - ex + 5} ${eyY - 3}h${2 * ex - 10}" stroke="#1b1b1f" stroke-width="2"/>`;
    case 'monocle': return `<circle cx="${50 + ex}" cy="${eyY}" r="6.5" fill="rgba(200,230,255,.25)" stroke="#fcc419" stroke-width="2"/><path d="M${50 + ex + 5} ${eyY + 5}q4 10 -2 22" stroke="#fcc419" stroke-width="1" fill="none"/>`;
    case 'bandage': return `<rect x="${50 + ex - 4}" y="${eyY + 6}" width="10" height="4" rx="1.5" fill="#ffd8a8" transform="rotate(-20 ${50 + ex} ${eyY + 8})"/>`;
    case 'kirakira': return `<g fill="#fff">${[[50 - ex - 9, eyY - 6, 3], [50 + ex + 9, eyY - 7, 2.4], [50 + ex + 7, eyY + 6, 1.8]].map(([x, y, r]) => `<path d="M${x} ${y - r * 2}L${x + r * .5} ${y - r * .5}L${x + r * 2} ${y}L${x + r * .5} ${y + r * .5}L${x} ${y + r * 2}L${x - r * .5} ${y + r * .5}L${x - r * 2} ${y}L${x - r * .5} ${y - r * .5}Z"/>`).join('')}</g>`;
    case 'flame': return `<path d="M${50 + ex + 6} ${eyY + 12}q-6 -4 -2 -12q1 4 3 3q-1 -5 3 -8q-1 6 3 9q2 5 -2 8Z" fill="#ff922b"/><path d="M${50 + ex + 7} ${eyY + 11}q-3 -2 -1 -6q2 3 3 2q1 3 -2 4Z" fill="#ffe066"/>`;
    case 'scar': return `<path d="M${50 - ex - 7} ${eyY + 3}L${50 - ex + 2} ${eyY + 12}" stroke="#c0846a" stroke-width="1.6"/><path d="M${50 - ex - 4} ${eyY + 9}l4 -3M${50 - ex - 1} ${eyY + 12}l4 -3" stroke="#c0846a" stroke-width="1"/>`;
    case 'bolt': return `<path d="M${50 - ex - 4} ${eyY + 2}l-3 6h3l-2 6l6 -8h-3l2 -4Z" fill="#fcc419" stroke="#e67700" stroke-width=".5"/>`;
    case 'star': return `<path d="M${50 - ex - 4} ${eyY + 7}l1.5 3 3.3 .4-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.4Z" fill="#ffd43b"/>`;
    default: return '';
  }
};
// めがね
KB.glSVG = function (gl, eyY, ex) {
  const c = (x, r, col, w) => `<circle cx="${x}" cy="${eyY}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
  const bridge = (col, w) => `<path d="M${50 - ex + 6} ${eyY}h${2 * ex - 12}" stroke="${col}" stroke-width="${w || 1.6}"/>`;
  switch (gl) {
    case 'round': return `<g>${c(50 - ex, 6, '#333', 1.6)}${c(50 + ex, 6, '#333', 1.6)}${bridge('#333')}</g>`;
    case 'square': return `<g fill="none" stroke="#333" stroke-width="1.8"><rect x="${50 - ex - 6}" y="${eyY - 5}" width="12" height="10" rx="2"/><rect x="${50 + ex - 6}" y="${eyY - 5}" width="12" height="10" rx="2"/></g>${bridge('#333')}`;
    case 'shades': return `<path d="M${50 - ex - 7} ${eyY - 4}h12v6q-6 4 -12 0Z M${50 + ex - 5} ${eyY - 4}h12v6q-6 4 -12 0Z" fill="#1b1b1f"/>${bridge('#1b1b1f', 2)}`;
    case 'gold': return `<g>${c(50 - ex, 6.5, '#fcc419', 2.4)}${c(50 + ex, 6.5, '#fcc419', 2.4)}${bridge('#fcc419', 2)}</g>`;
    case 'star': { const st = x => `<path d="M${x} ${eyY - 8}l2.2 5 5.4 .4-4.1 3.5 1.3 5.3-4.8-2.9-4.8 2.9 1.3-5.3-4.1-3.5 5.4-.4Z" fill="rgba(255,212,59,.35)" stroke="#f08c00" stroke-width="1.4"/>`; return st(50 - ex) + st(50 + ex) + bridge('#f08c00'); }
    case 'heart': { const h = x => `<path d="M${x} ${eyY + 6}l-6 -6a3.4 3.4 0 0 1 6 -4a3.4 3.4 0 0 1 6 4Z" fill="rgba(240,101,149,.35)" stroke="#e64980" stroke-width="1.4"/>`; return h(50 - ex) + h(50 + ex) + bridge('#e64980'); }
    case 'visor': return `<rect x="${50 - ex - 9}" y="${eyY - 5}" width="${2 * ex + 18}" height="9" rx="4" fill="rgba(34,184,207,.55)" stroke="#15aabf" stroke-width="1.2"/><path d="M${50 - ex - 6} ${eyY - 2}h${2 * ex + 6}" stroke="#e3fafc" stroke-width="1" opacity=".8"/>`;
    default: return '';
  }
};
// 手に持つもの（右下）
KB.holdSVG = function (h) {
  switch (h) {
    case 'torch': return `<g transform="translate(74 66) rotate(12)"><path d="M-3 10L3 10L1.6 38H-1.6Z" fill="#adb5bd" stroke="#495057"/><rect x="-6" y="6" width="12" height="5" rx="1.5" fill="#fcc419" stroke="#e67700"/><path d="M0 6Q-9 -4 -2 -14Q-1 -6 3 -10Q9 -2 0 6Z" fill="#ff922b"/><path d="M0 5Q-4 -1 0 -7Q4 -1 0 5Z" fill="#ffe066"/></g>`;
    case 'goldcup': return `<g transform="translate(66 68)"><path d="M2 0H24Q24 16 13 19Q2 16 2 0Z" fill="#fcc419" stroke="#e67700" stroke-width="1.2"/><path d="M2 3Q-5 3 -4 9Q-3 14 4 13M24 3Q31 3 30 9Q29 14 22 13" stroke="#e67700" stroke-width="2" fill="none"/><rect x="10.5" y="19" width="5" height="6" fill="#e67700"/><rect x="6" y="25" width="14" height="5" rx="1.5" fill="#8b5a2b"/><text x="13" y="11" text-anchor="middle" font-size="9" font-weight="900" fill="#7a4b00" font-family="sans-serif">1</text></g>`;
    case 'flag': return `<g transform="translate(70 62)"><rect x="0" y="0" width="2.4" height="40" fill="#8b5a2b"/><path d="M2.4 1h20l-4 6 4 6h-20Z" fill="#e03131"/><circle cx="10" cy="7" r="3" fill="#fff"/></g>`;
    case 'scepter': return `<g transform="translate(72 100) rotate(-25)"><rect width="3" height="-1" fill="none"/><rect x="0" y="-34" width="3.4" height="34" rx="1.5" fill="#e67700"/><circle cx="1.7" cy="-37" r="5" fill="#fcc419" stroke="#e67700"/><circle cx="1.7" cy="-37" r="2" fill="#e03131"/></g>`;
    case 'compass': return `<g transform="translate(76 70)"><circle cx="6" cy="2" r="3" fill="#495057"/><path d="M5 4L-2 26M7 4L14 26" stroke="#868e96" stroke-width="2.4" stroke-linecap="round"/><path d="M14 26l1 4" stroke="#1b1b1f" stroke-width="1.4"/></g>`;
    case 'calc': return `<g transform="translate(68 74)"><rect width="20" height="26" rx="3" fill="#343a40"/><rect x="3" y="3" width="14" height="6" fill="#c3fae8"/><text x="15.5" y="8.2" text-anchor="end" font-size="5.5" font-weight="900" fill="#0b3d2e" font-family="sans-serif">7</text>${[0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${3 + c * 5}" y="${12 + r * 4.4}" width="4" height="3.4" rx=".8" fill="${c === 2 ? '#f59f00' : '#adb5bd'}"/>`).join('')).join('')}</g>`;
    case 'stopwatch': return `<g transform="translate(80 84)"><rect x="-2" y="-15" width="4" height="4" fill="#495057"/><circle r="11" fill="#f8f9fa" stroke="#495057" stroke-width="2.4"/><path d="M0 0V-7M0 0l5 3" stroke="#e03131" stroke-width="1.8" stroke-linecap="round"/></g>`;
    case 'dice': return `<g transform="translate(70 76) rotate(-12)"><rect width="18" height="18" rx="3.5" fill="#fff" stroke="#adb5bd"/><g fill="#e03131"><circle cx="5" cy="5" r="1.8"/><circle cx="9" cy="9" r="1.8"/><circle cx="13" cy="13" r="1.8"/></g></g>`;
    case 'hourglass': return `<g transform="translate(70 72)"><rect width="20" height="3" rx="1" fill="#8b5a2b"/><rect y="25" width="20" height="3" rx="1" fill="#8b5a2b"/><path d="M3 3h14Q17 11 10 14Q17 17 17 25H3Q3 17 10 14Q3 11 3 3Z" fill="rgba(208,235,255,.8)" stroke="#adb5bd"/><path d="M6 25Q10 19 14 25Z M7 7h6Q12 11 10 12Q8 11 7 7Z" fill="#fcc419"/></g>`;
    case 'book': return `<g transform="translate(66 76) rotate(-8)"><rect width="24" height="20" rx="2" fill="#2f9e44"/><rect x="2" y="2" width="20" height="16" rx="1" fill="#40c057"/><text x="12" y="13.5" text-anchor="middle" font-size="8" font-weight="900" fill="#fff3bf" font-family="sans-serif">式</text></g>`;
    case 'trophy': return `<g transform="translate(70 70)"><path d="M2 2h16v6a8 8 0 0 1 -16 0Z" fill="#fcc419" stroke="#e67700"/><path d="M2 4h-3a4 4 0 0 0 4 6M18 4h3a4 4 0 0 1 -4 6" stroke="#e67700" fill="none"/><rect x="8" y="15" width="4" height="5" fill="#e67700"/><rect x="4" y="20" width="12" height="4" fill="#5c3a1a"/></g>`;
    case 'ticket': return `<g transform="translate(66 76) rotate(-15)"><rect width="24" height="13" rx="2" fill="#fcc419" stroke="#e67700"/><path d="M6 0v13" stroke="#e67700" stroke-dasharray="2 1.5"/><text x="15" y="9" text-anchor="middle" font-size="6" font-weight="900" fill="#a05a00" font-family="sans-serif">★</text></g>`;
    case 'scroll': return `<g transform="translate(68 74) rotate(-20)"><rect width="22" height="12" fill="#fff3bf" stroke="#c9a227"/><rect x="-2" y="-1" width="3" height="14" rx="1.5" fill="#8b5a2b"/><rect x="21" y="-1" width="3" height="14" rx="1.5" fill="#8b5a2b"/><path d="M5 4h12M5 8h9" stroke="#5c3a1a" stroke-width="1"/></g>`;
    case 'soccer': return `<g transform="translate(80 84)"><circle r="10" fill="#fff" stroke="#333"/><path d="M0 -4l4 3-1.5 4.5h-5L-4 -1Z" fill="#333"/><path d="M0 -4V-10M4 -1l6 -2M2.5 3.5l3 5M-2.5 3.5l-3 5M-4 -1l-6 -2" stroke="#333" stroke-width="1"/></g>`;
    case 'bokken': return `<g transform="translate(70 100) rotate(-50)"><rect width="40" height="4" rx="2" fill="#c08a4a"/><rect x="0" y="-1" width="10" height="6" rx="1" fill="#5c3a1a"/><rect x="10" y="-2" width="2" height="8" fill="#343a40"/></g>`;
    case 'wand': return `<g transform="translate(72 98) rotate(-40)"><rect width="26" height="3" rx="1.5" fill="#5f3dc4"/><path d="M30 1.5l2.4 4.6 5.1.7-3.7 3.6.9 5-4.7-2.4-4.7 2.4.9-5-3.7-3.6 5.1-.7Z" transform="translate(-4 -8)" fill="#ffd43b" stroke="#f08c00" stroke-width=".8"/></g>`;
    case 'abacus': return `<g transform="translate(64 78)"><rect width="28" height="18" rx="2" fill="#8b5a2b"/><rect x="2" y="2" width="24" height="14" fill="#f4e3c3"/><path d="M2 7h24" stroke="#5c3a1a" stroke-width="1.5"/>${[5, 10, 15, 20].map(x => `<path d="M${x + 1} 2v14" stroke="#5c3a1a" stroke-width=".6"/><ellipse cx="${x + 1}" cy="4.5" rx="2.2" ry="1.4" fill="#a0522d"/><ellipse cx="${x + 1}" cy="10" rx="2.2" ry="1.4" fill="#a0522d"/><ellipse cx="${x + 1}" cy="13" rx="2.2" ry="1.4" fill="#a0522d"/>`).join('')}</g>`;
    case 'magnifier': return `<g transform="translate(74 78)"><circle r="8" fill="rgba(165,216,255,.4)" stroke="#495057" stroke-width="2.5"/><path d="M6 6l9 9" stroke="#5c3a1a" stroke-width="4" stroke-linecap="round"/></g>`;
    case 'crystal': return `<g transform="translate(78 84)"><circle r="10" fill="rgba(208,191,255,.75)" stroke="#9775fa"/><circle cx="-3" cy="-3" r="3" fill="#fff" opacity=".7"/><path d="M-8 9h16l-3 5h-10Z" fill="#5f3dc4"/></g>`;
    default: return '';
  }
};
// おとも（左下の小さな仲間）
KB.petSVG = function (p) {
  switch (p) {
    case 'goldbird': return `<g transform="translate(6 76)"><path d="M4 12Q-4 6 2 2Q6 8 10 9Z M22 12Q30 6 24 2Q20 8 16 9Z" fill="#f59f00"/><ellipse cx="13" cy="13" rx="10" ry="8" fill="#fcc419"/><circle cx="13" cy="4" r="6.5" fill="#ffd43b"/><path d="M11 -2l2 -5 2 5" fill="#e67700"/><circle cx="10.5" cy="3.5" r="1.2" fill="#1b1b1f"/><circle cx="15.5" cy="3.5" r="1.2" fill="#1b1b1f"/><path d="M11.5 6h3l-1.5 2.5Z" fill="#e8590c"/><path d="M6 10l1.5 1.5M20 10l-1.5 1.5" stroke="#fff3bf" stroke-width="1"/></g>`;
    case 'chick': return `<g transform="translate(8 80)"><ellipse cx="12" cy="11" rx="11" ry="9" fill="#ffe066"/><circle cx="12" cy="3" r="7" fill="#ffe066"/><circle cx="9" cy="2" r="1.3" fill="#1b1b1f"/><circle cx="15" cy="2" r="1.3" fill="#1b1b1f"/><path d="M10.5 5h3l-1.5 2.5Z" fill="#f59f00"/><path d="M11 -4l1 -3 1 3" stroke="#f59f00" fill="none"/></g>`;
    case 'phoenix': return `<g transform="translate(4 70)"><path d="M2 10Q8 -4 14 6Q20 -6 28 6Q22 8 20 14Q16 22 10 20Q4 18 2 10Z" fill="#fa5252"/><path d="M8 12Q14 4 22 10Q16 12 14 18Z" fill="#ffa94d"/><path d="M10 20l-6 8M14 21l0 8M18 20l5 7" stroke="#fcc419" stroke-width="2" stroke-linecap="round"/><circle cx="22" cy="7" r="1.3" fill="#1b1b1f"/><path d="M26 7l4 1-4 2Z" fill="#fcc419"/></g>`;
    case 'minirobo': return `<g transform="translate(8 76)"><path d="M12 0V-4" stroke="#495057" stroke-width="1.6"/><circle cx="12" cy="-5" r="2" fill="#ff6b6b"/><rect x="2" y="0" width="20" height="14" rx="4" fill="#adb5bd"/><rect x="5" y="3" width="14" height="7" rx="2" fill="#212529"/><circle cx="9" cy="6.5" r="1.6" fill="#51cf66"/><circle cx="15" cy="6.5" r="1.6" fill="#51cf66"/><rect x="5" y="15" width="14" height="9" rx="2" fill="#868e96"/></g>`;
    case 'kitten': return `<g transform="translate(6 78)"><ellipse cx="13" cy="16" rx="10" ry="7" fill="#495057"/><circle cx="13" cy="8" r="8" fill="#495057"/><path d="M6 4l0 -7l5 4M20 4l0 -7l-5 4" fill="#495057"/><circle cx="10" cy="8" r="1.8" fill="#ffd43b"/><circle cx="16" cy="8" r="1.8" fill="#ffd43b"/><circle cx="10" cy="8" r=".7" fill="#1b1b1f"/><circle cx="16" cy="8" r=".7" fill="#1b1b1f"/><path d="M23 18q6 -2 4 -8" stroke="#495057" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`;
    case 'swallow': return `<g transform="translate(4 74)"><path d="M2 6Q12 2 18 8L30 2L24 10Q28 14 22 16Q12 18 6 12L-2 16L2 8Z" fill="#1c3f7a"/><path d="M10 12Q16 14 22 13Q16 17 10 14Z" fill="#fff"/><circle cx="20" cy="8" r="1.2" fill="#fff"/><path d="M22 9l3 1" stroke="#e03131" stroke-width="1.4"/></g>`;
    case 'bat': return `<g transform="translate(4 74)"><path d="M0 8Q4 0 8 6Q10 2 13 6Q16 2 18 6Q22 0 26 8Q22 6 20 12Q16 10 13 14Q10 10 6 12Q4 6 0 8Z" fill="#5f3dc4"/><circle cx="13" cy="8" r="4.5" fill="#7048e8"/><path d="M10 4l1 -3 1.5 2.5M14.5 3.5l1.5 -2.5 1 3" fill="#7048e8"/><circle cx="11.5" cy="8" r=".9" fill="#ffd43b"/><circle cx="14.5" cy="8" r=".9" fill="#ffd43b"/></g>`;
    case 'crow': return `<g transform="translate(6 76)"><ellipse cx="12" cy="12" rx="11" ry="9" fill="#212529"/><circle cx="16" cy="4" r="6" fill="#212529"/><path d="M21 4l7 2-7 2Z" fill="#495057"/><circle cx="17" cy="3" r="1.4" fill="#fff"/><path d="M2 10q-4 4 -2 8l6 -4" fill="#343a40"/><path d="M10 20v4M14 20v4" stroke="#495057" stroke-width="1.4"/></g>`;
    case 'ufo': return `<g transform="translate(4 72)"><path d="M12 6Q14 -2 20 -2Q26 -2 28 6Z" fill="rgba(165,216,255,.8)" stroke="#74c0fc"/><ellipse cx="20" cy="8" rx="16" ry="5" fill="#adb5bd"/><ellipse cx="20" cy="7" rx="12" ry="2.4" fill="#868e96"/><g fill="#ffd43b"><circle cx="9" cy="9" r="1.4"/><circle cx="20" cy="11" r="1.4"/><circle cx="31" cy="9" r="1.4"/></g><path d="M14 13L8 26H32L26 13Z" fill="rgba(255,236,153,.35)"/></g>`;
    case 'dragon': return `<g transform="translate(8 74)"><path d="M6 12q-6 -10 4 -12q4 -6 10 0q6 -2 4 6l4 2q-2 6 -8 4q-6 6 -14 0Z" fill="#40c057"/><path d="M12 2l2 -6l3 5M18 1l3 -5l1 6" fill="#ffd43b"/><circle cx="18" cy="6" r="1.6" fill="#1b1b1f"/><path d="M2 8q-6 -6 -2 -10q4 4 6 6" fill="#2f9e44"/><path d="M14 12q4 3 8 0" stroke="#1b1b1f" stroke-width="1" fill="none"/></g>`;
    case 'hamster': return `<g transform="translate(8 80)"><ellipse cx="12" cy="10" rx="12" ry="9" fill="#f4c27a"/><ellipse cx="12" cy="12" rx="7" ry="5" fill="#fff4e6"/><circle cx="4" cy="3" r="3" fill="#f4c27a"/><circle cx="20" cy="3" r="3" fill="#f4c27a"/><circle cx="8" cy="8" r="1.4" fill="#1b1b1f"/><circle cx="16" cy="8" r="1.4" fill="#1b1b1f"/><circle cx="12" cy="11" r="1" fill="#e8798a"/></g>`;
    case 'luckycat': return `<g transform="translate(6 70)"><ellipse cx="13" cy="20" rx="11" ry="10" fill="#fff"/><circle cx="13" cy="10" r="9" fill="#fff" stroke="#dee2e6"/><path d="M5 5l1 -6l5 4M21 5l-1 -6l-5 4" fill="#fff" stroke="#dee2e6"/><path d="M9 10q1 -2 2 0M15 10q1 -2 2 0" stroke="#1b1b1f" stroke-width="1" fill="none"/><path d="M4 18v-9" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="13" cy="21" r="2.5" fill="#fcc419"/><path d="M8 16h10" stroke="#e03131" stroke-width="1.5"/></g>`;
    default: return '';
  }
};
// 背景の柄
KB.bgPatSVG = function (pat) {
  switch (pat) {
    case 'aurora': return `<rect x="0" y="0" width="100" height="100" fill="#0b1640"/><path d="M-5 40Q20 20 45 34T100 26V52Q75 40 50 54T-5 56Z" fill="rgba(105,219,124,.45)"/><path d="M-5 30Q25 12 55 26T105 18V34Q80 26 55 38T-5 42Z" fill="rgba(151,117,250,.4)"/>${[[12, 8], [80, 10], [92, 60], [6, 70], [60, 6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1" fill="#fff"/>`).join('')}`;
    case 'podium': return `<rect x="0" y="0" width="100" height="100" fill="#1b1d2b"/><path d="M50 -10L20 100H80Z" fill="rgba(255,236,153,.22)"/><g font-family="sans-serif" font-weight="900" font-size="9" text-anchor="middle"><rect x="2" y="78" width="30" height="22" fill="#ced4da"/><text x="17" y="92" fill="#495057">2</text><rect x="35" y="70" width="30" height="30" fill="#fcc419"/><text x="50" y="86" fill="#7a4b00">1</text><rect x="68" y="84" width="30" height="16" fill="#e8a76a"/><text x="83" y="95" fill="#6b3d12">3</text></g>`;
    case 'fire': return `<rect x="0" y="0" width="100" height="100" fill="#3b0d0d"/><path d="M0 100V70q8 -14 14 0q4 -18 12 -4q6 -16 12 0q6 -20 14 -2q6 -14 12 2q6 -16 12 0q6 -12 14 4V100Z" fill="#e8590c"/><path d="M0 100V82q8 -10 14 0q6 -12 12 0q6 -10 12 0q6 -12 14 0q6 -10 12 0q6 -10 12 0q6 -8 14 2V100Z" fill="#fcc419"/>`;
    case 'void': return `<rect x="0" y="0" width="100" height="100" fill="#0a0820"/><g fill="none" stroke="rgba(170,150,255,.22)">${[14, 26, 38, 50, 62].map(r => `<circle cx="50" cy="52" r="${r}"/>`).join('')}</g>${[[12, 14], [86, 20], [20, 84], [80, 82], [52, 6], [6, 50], [94, 54]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? .8 : 1.3}" fill="#d0bfff"/>`).join('')}`;
    case 'stars': return `<rect x="0" y="0" width="100" height="100" fill="#1b1f4a"/>${[[14, 18], [30, 10], [80, 16], [88, 40], [10, 50], [70, 8], [20, 80], [86, 76], [50, 6], [94, 60]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1 : 1.8}" fill="#fff3bf"/>`).join('')}`;
    case 'rainbow': return `<rect x="0" y="0" width="100" height="100" fill="#d0ebff"/>${['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].map((c, i) => `<path d="M${-10 + i * 6} 100A${60 - i * 6} ${60 - i * 6} 0 0 1 ${110 - i * 6} 100" stroke="${c}" stroke-width="6" fill="none"/>`).join('')}`;
    case 'formula': return `<rect x="0" y="0" width="100" height="100" fill="#0b3d2e"/><g fill="rgba(255,255,255,.28)" font-family="sans-serif" font-weight="900" font-size="11">${[['÷', 10, 20], ['×', 78, 18], ['+', 16, 70], ['−', 84, 66], ['=', 50, 12], ['7', 30, 40], ['13', 64, 40], ['(', 8, 44], [')', 90, 44]].map(([t, x, y]) => `<text x="${x}" y="${y}">${t}</text>`).join('')}</g>`;
    case 'sakura': return `<rect x="0" y="0" width="100" height="100" fill="#ffdeeb"/>${[[12, 14], [80, 12], [30, 40], [88, 44], [8, 66], [70, 30], [20, 88], [92, 80], [56, 8]].map(([x, y], i) => `<g transform="translate(${x} ${y}) rotate(${i * 40})" fill="#f783ac">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-3" rx="2" ry="3" transform="rotate(${a})"/>`).join('')}<circle r="1" fill="#fff"/></g>`).join('')}`;
    case 'spot': return `<rect x="0" y="0" width="100" height="100" fill="#212529"/><path d="M50 -10L10 100H90Z" fill="rgba(255,236,153,.28)"/><path d="M50 -10L30 100H70Z" fill="rgba(255,236,153,.3)"/>${[[14, 20], [86, 16], [20, 60], [84, 56]].map(([x, y]) => `<path d="M${x} ${y - 4}l1.2 2.8 3 .2-2.3 2 .8 3-2.7-1.6-2.7 1.6.8-3-2.3-2 3-.2Z" fill="#fcc419"/>`).join('')}`;
    case 'grid': return `<rect x="0" y="0" width="100" height="100" fill="#e7f5ff"/><g stroke="#a5d8ff" stroke-width=".8">${[10, 20, 30, 40, 50, 60, 70, 80, 90].map(v => `<path d="M${v} 0V100M0 ${v}H100"/>`).join('')}</g>`;
    case 'checker': return `<rect x="0" y="0" width="100" height="100" fill="#fff3bf"/><g fill="#ffd8a8">${Array.from({ length: 100 }, (_, i) => (i % 10 + Math.floor(i / 10)) % 2 ? `<rect x="${(i % 10) * 10}" y="${Math.floor(i / 10) * 10}" width="10" height="10"/>` : '').join('')}</g>`;
    case 'speed': return `<rect x="0" y="0" width="100" height="100" fill="#fff"/><g stroke="#ced4da" stroke-width="1.6">${Array.from({ length: 24 }, (_, i) => { const a = i / 24 * Math.PI * 2; return `<path d="M${50 + Math.cos(a) * 40} ${50 + Math.sin(a) * 40}L${50 + Math.cos(a) * 80} ${50 + Math.sin(a) * 80}"/>`; }).join('')}</g>`;
    case 'moon': return `<rect x="0" y="0" width="100" height="100" fill="#14213d"/><circle cx="80" cy="20" r="11" fill="#fff3bf"/><circle cx="86" cy="16" r="10" fill="#14213d"/>${[[14, 16], [30, 30], [60, 10], [10, 50], [92, 50]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#fff"/>`).join('')}`;
    case 'clock': return `<rect x="0" y="0" width="100" height="100" fill="#3d2c1e"/><circle cx="50" cy="50" r="46" fill="none" stroke="#c9a227" stroke-width="2"/><g fill="#c9a227" font-family="serif" font-weight="700" font-size="9" text-anchor="middle">${['XII', 'III', 'VI', 'IX'].map((t, i) => `<text x="${50 + Math.sin(i * Math.PI / 2) * 39}" y="${53 - Math.cos(i * Math.PI / 2) * 39}">${t}</text>`).join('')}</g>${Array.from({ length: 12 }, (_, i) => `<circle cx="${50 + Math.sin(i * Math.PI / 6) * 46}" cy="${50 - Math.cos(i * Math.PI / 6) * 46}" r="1.6" fill="#c9a227"/>`).join('')}`;
    case 'galaxy': return `<defs><radialGradient id="gxy" cx=".3" cy=".3"><stop offset="0" stop-color="#9775fa"/><stop offset=".5" stop-color="#3b1f7a"/><stop offset="1" stop-color="#0b0b2a"/></radialGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#gxy)"/><ellipse cx="26" cy="24" rx="20" ry="6" fill="rgba(255,255,255,.18)" transform="rotate(-25 26 24)"/>${[[60, 12], [86, 30], [10, 60], [80, 70], [40, 6], [94, 90], [16, 90]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 1 : 1.6}" fill="#fff"/>`).join('')}`;
    case 'gold': return `<defs><radialGradient id="gbg"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#e67700"/></radialGradient></defs><rect x="0" y="0" width="100" height="100" fill="url(#gbg)"/>`;
    default: return '';
  }
};
KB.accSVG = function (acc, fy, rx, top) {
  const L = 50 - rx, Rr = 50 + rx;
  switch (acc) {
    case 'hoodie': return { back: `<path d="M${L - 8} ${fy + 30}Q${L - 10} ${top - 8} 50 ${top - 10}Q${Rr + 10} ${top - 8} ${Rr + 8} ${fy + 30}Z" fill="#495057"/>`, front: '' };
    case 'bowtie': return { back: '', front: `<path d="M40 86l10 4l-10 4Z M60 86l-10 4l10 4Z" fill="#c92a2a"/>` };
    case 'butler': return { back: '', front: `<path d="M42 84l8 6l8 -6v20h-16Z" fill="#fff"/><path d="M44 86l6 3l-6 3Z M56 86l-6 3l6 3Z" fill="#1b1b1f"/>` };
    case 'kimono': return { back: '', front: `<path d="M30 104L50 82L70 104" fill="none" stroke="#fff" stroke-width="4"/><rect x="30" y="94" width="40" height="6" fill="#f59f00"/>` };
    case 'goggles': return { back: '', front: `<rect x="${L}" y="${top + 4}" width="${2 * rx}" height="8" rx="4" fill="#495057"/><circle cx="41" cy="${top + 8}" r="5" fill="#74c0fc" stroke="#343a40" stroke-width="2"/><circle cx="59" cy="${top + 8}" r="5" fill="#74c0fc" stroke="#343a40" stroke-width="2"/>` };
    case 'samurai': return { back: '', front: `<path d="M30 104L50 84L70 104" fill="#f8f9fa"/><path d="M72 70l14 -30" stroke="#868e96" stroke-width="3"/><path d="M70 74l6 -6" stroke="#c92a2a" stroke-width="4"/>` };
    case 'pirate': return { back: '', front: `<path d="M${L - 6} ${top + 10}Q50 ${top - 16} ${Rr + 6} ${top + 10}Z" fill="#1b1b1f"/><circle cx="50" cy="${top + 2}" r="3" fill="#fff"/><path d="M${50 - 14} ${fy - 6}h10v8h-10Z" fill="#1b1b1f"/><path d="M${L} ${fy - 6}L${Rr} ${fy - 8}" stroke="#1b1b1f" stroke-width="1.5"/>` };
    case 'clown': return { back: '', front: `<circle cx="50" cy="${fy + 6}" r="5" fill="#e03131"/><path d="M${L + 2} ${top + 4}L50 ${top - 18}L${Rr - 2} ${top + 4}Z" fill="#fcc419"/><circle cx="50" cy="${top - 18}" r="4" fill="#e03131"/>` };
    case 'thief': return { back: '', front: `<path d="M${L - 2} ${fy - 9}Q50 ${fy - 14} ${Rr + 2} ${fy - 9}L${Rr + 2} ${fy - 1}Q50 ${fy - 6} ${L - 2} ${fy - 1}Z" fill="#1b1b1f"/><rect x="${L + 2}" y="${top - 14}" width="${2 * rx - 4}" height="14" fill="#1b1b1f"/><rect x="${L - 6}" y="${top - 2}" width="${2 * rx + 12}" height="4" fill="#1b1b1f"/>` };
    case 'gakuran': return { back: '', front: `<path d="M18 104Q20 82 50 80Q80 82 82 104Z" fill="#1b1b1f"/><path d="M44 82h12v6h-12Z" fill="#1b1b1f" stroke="#ffd43b" stroke-width="1"/><circle cx="50" cy="94" r="2" fill="#ffd43b"/>` };
    case 'armband': return { back: '', front: `<rect x="20" y="92" width="14" height="7" fill="#e03131" transform="rotate(-20 27 95)"/>` };
    case 'cap': return { back: '', front: `<path d="M${L - 1} ${top + 10}Q${L} ${top - 6} 50 ${top - 6}Q${Rr} ${top - 6} ${Rr + 1} ${top + 10}Z" fill="#1c7ed6"/><path d="M${L - 1} ${top + 10}Q50 ${top + 5} ${Rr + 1} ${top + 10}L${Rr + 12} ${top + 14}Q50 ${top + 9} ${L - 1} ${top + 14}Z" fill="#1864ab"/>` };
    case 'baseball': return { back: '', front: `<path d="M${L - 1} ${top + 10}Q${L} ${top - 6} 50 ${top - 6}Q${Rr} ${top - 6} ${Rr + 1} ${top + 10}Z" fill="#e03131"/><path d="M${L - 1} ${top + 10}L${L - 12} ${top + 14}Q50 ${top + 8} ${Rr + 1} ${top + 12}Z" fill="#c92a2a"/>` };
    case 'headphones': return { back: '', front: `<path d="M${L - 2} ${fy}Q${L - 4} ${top - 8} 50 ${top - 8}Q${Rr + 4} ${top - 8} ${Rr + 2} ${fy}" stroke="#212529" stroke-width="4" fill="none"/><rect x="${L - 6}" y="${fy - 6}" width="8" height="14" rx="3" fill="#f06595"/><rect x="${Rr - 2}" y="${fy - 6}" width="8" height="14" rx="3" fill="#f06595"/>` };
    case 'helmet': return { back: '', front: `<path d="M${L - 4} ${top + 12}Q${L - 2} ${top - 10} 50 ${top - 10}Q${Rr + 2} ${top - 10} ${Rr + 4} ${top + 12}Z" fill="#e03131"/><rect x="${L - 8}" y="${top + 10}" width="${2 * rx + 16}" height="4" rx="2" fill="#c92a2a"/><path d="M50 ${top - 8}v18" stroke="#ffd43b" stroke-width="3"/>` };
    case 'headband': return { back: '', front: `<rect x="${L - 1}" y="${top + 8}" width="${2 * rx + 2}" height="5" fill="#fff"/><path d="M${Rr} ${top + 10}l8 4l-8 2Z" fill="#fff"/>` };
    case 'towel': return { back: '', front: `<rect x="${L}" y="${top - 2}" width="${2 * rx}" height="8" rx="3" fill="#fff" stroke="#74c0fc"/>` };
    case 'turban': return { back: '', front: `<path d="M${L - 3} ${top + 10}Q${L - 6} ${top - 14} 50 ${top - 14}Q${Rr + 6} ${top - 14} ${Rr + 3} ${top + 10}Z" fill="#7048e8"/><circle cx="50" cy="${top + 2}" r="4" fill="#ffd43b"/>` };
    case 'chef': return { back: '', front: `<path d="M${L + 2} ${top + 8}V${top - 6}Q${L - 4} ${top - 16} ${L + 8} ${top - 18}Q50 ${top - 28} ${Rr - 8} ${top - 18}Q${Rr + 4} ${top - 16} ${Rr - 2} ${top - 6}V${top + 8}Z" fill="#fff" stroke="#dee2e6"/>` };
    case 'judo': return { back: '', front: `<path d="M30 104L50 84L70 104" fill="none" stroke="#e9ecef" stroke-width="5"/><rect x="28" y="96" width="44" height="6" fill="#1b1b1f"/>` };
    case 'book': return { back: '', front: `<rect x="62" y="80" width="18" height="14" rx="2" fill="#4263eb" transform="rotate(-10 70 87)"/><path d="M71 81v12" stroke="#fff" stroke-width="1"/>` };
    case 'ribbon': return { back: '', front: `<path d="M${Rr - 12} ${top + 2}l-9 -6v12Z M${Rr - 12} ${top + 2}l9 -6v12Z" fill="#f03e3e"/><circle cx="${Rr - 12}" cy="${top + 2}" r="2.5" fill="#c92a2a"/>` };
    case 'coat': return { back: '', front: `<path d="M30 104L48 82M70 104L52 82" stroke="#dee2e6" stroke-width="3"/>` };
    case 'ninja': return { back: '', front: `<path d="M${L - 2} ${fy + 2}Q${L - 4} ${top - 8} 50 ${top - 8}Q${Rr + 4} ${top - 8} ${Rr + 2} ${fy + 2}Q50 ${fy - 8} ${L - 2} ${fy + 2}Z" fill="#343a40"/><path d="M${L} ${fy + 8}Q50 ${fy + 2} ${Rr} ${fy + 8}V${fy + 24}H${L}Z" fill="#343a40"/><path d="M${Rr} ${top + 6}l12 -4l-4 8Z" fill="#343a40"/>` };
    case 'apron': return { back: '', front: `<path d="M34 104V88h32v16Z" fill="#fff"/><path d="M34 88L40 80M66 88L60 80" stroke="#fff" stroke-width="2"/><rect x="${L - 1}" y="${top + 8}" width="${2 * rx + 2}" height="5" fill="#e03131"/>` };
    case 'flower': return { back: '', front: `<circle cx="${Rr - 8}" cy="${top + 4}" r="5" fill="#f783ac"/><circle cx="${Rr - 8}" cy="${top + 4}" r="2" fill="#ffd43b"/>` };
    case 'tie': return { back: '', front: `<path d="M46 82h8l-2 4l4 16h-12l4 -16Z" fill="#e03131"/>` };
    case 'platcrown': return { back: '', front: `<path d="M${L + 1} ${top + 4}l3 -16l8 10l7 -14l7 14l8 -10l3 16Z" fill="#e9ecef" stroke="#868e96" stroke-width="1.2"/><path d="M${L + 2} ${top + 1}h${(50 - L) * 2 - 4}" stroke="#adb5bd" stroke-width="1.5"/><circle cx="50" cy="${top - 7}" r="2.6" fill="#4dabf7" stroke="#1971c2"/><circle cx="${L + 12}" cy="${top - 3}" r="1.6" fill="#da77f2"/><circle cx="${100 - L - 12}" cy="${top - 3}" r="1.6" fill="#da77f2"/>` };
    case 'gown': return { back: `<path d="M10 104Q12 70 34 64H66Q88 70 90 104Z" fill="#5f3dc4"/>`, front: `<path d="M38 66L44 104M62 66L56 104" stroke="#fcc419" stroke-width="3.2"/><path d="M34 66Q50 74 66 66" stroke="#fcc419" stroke-width="2.4" fill="none"/><circle cx="50" cy="86" r="5.5" fill="#fcc419" stroke="#e67700"/><text x="50" y="88.6" text-anchor="middle" font-size="6.5" font-weight="900" fill="#7a4b00" font-family="sans-serif">1</text>` };
    case 'crown': return { back: '', front: `<path d="M${L + 2} ${top + 4}l4 -14l8 9l6 -12l6 12l8 -9l4 14Z" fill="#fcc419" stroke="#e67700"/><circle cx="50" cy="${top - 4}" r="2" fill="#e03131"/>` };
    // ---- 追加の帽子・頭の小物 ----
    case 'kinhachi': return { back: '', front: `<path d="M${L - 2} ${top + 12}Q50 ${top + 4} ${Rr + 2} ${top + 12}L${Rr + 2} ${top + 18}Q50 ${top + 10} ${L - 2} ${top + 18}Z" fill="#fff"/><circle cx="50" cy="${top + 12}" r="3.6" fill="#e03131"/><path d="M${Rr} ${top + 14}l10 6l-3 4l-8 -6Z" fill="#fff" stroke="#dee2e6" stroke-width=".6"/>` };
    case 'antenna': return { back: '', front: `<path d="M${L + 6} ${top + 4}L${L} ${top - 14}M${Rr - 6} ${top + 4}L${Rr} ${top - 14}" stroke="#495057" stroke-width="2.4"/><circle cx="${L}" cy="${top - 15}" r="3.6" fill="#22b8cf"/><circle cx="${Rr}" cy="${top - 15}" r="3.6" fill="#22b8cf"/><path d="M${L - 2} ${top + 8}Q50 ${top - 4} ${Rr + 2} ${top + 8}" stroke="#868e96" stroke-width="5" fill="none"/>` };
    case 'goldhelm': return { back: '', front: `<path d="M${L - 4} ${top + 14}Q${L - 4} ${top - 12} 50 ${top - 12}Q${Rr + 4} ${top - 12} ${Rr + 4} ${top + 14}L${Rr - 2} ${top + 12}Q50 ${top + 4} ${L + 2} ${top + 12}Z" fill="#fcc419" stroke="#e67700" stroke-width="1.2"/><path d="M50 ${top - 12}V${top + 6}" stroke="#e67700" stroke-width="2"/><path d="M${L - 2} ${top - 2}l-8 -12l12 6Z M${Rr + 2} ${top - 2}l8 -12l-12 6Z" fill="#fcc419" stroke="#e67700" stroke-width="1"/>` };
    case 'tophat': return { back: '', front: `<rect x="${L - 4}" y="${top + 2}" width="${2 * rx + 8}" height="5" rx="2" fill="#1b1b1f"/><rect x="${L + 4}" y="${top - 22}" width="${2 * rx - 8}" height="26" rx="2" fill="#1b1b1f"/><rect x="${L + 4}" y="${top - 4}" width="${2 * rx - 8}" height="4" fill="#e03131"/>` };
    case 'wizard': return { back: '', front: `<path d="M${L - 6} ${top + 8}L50 ${top - 30}L${Rr + 6} ${top + 8}Z" fill="#5f3dc4"/><path d="M${L - 8} ${top + 8}h${2 * rx + 16}" stroke="#4c2fb0" stroke-width="5" stroke-linecap="round"/><path d="M46 ${top - 10}l2 4 4 .5-3 3 .8 4-3.8-2-3.8 2 .8-4-3-3 4-.5Z" fill="#ffd43b"/>` };
    case 'halo': return { back: '', front: `<ellipse cx="50" cy="${top - 10}" rx="${rx - 4}" ry="5" fill="none" stroke="#ffe066" stroke-width="3.5"/>` };
    case 'nekomimi': return { back: '', front: `<path d="M${L} ${top + 10}L${L + 2} ${top - 12}L${L + 16} ${top + 2}Z M${Rr} ${top + 10}L${Rr - 2} ${top - 12}L${Rr - 16} ${top + 2}Z" fill="#343a40"/><path d="M${L + 4} ${top + 4}L${L + 5} ${top - 6}L${L + 12} ${top + 1}Z M${Rr - 4} ${top + 4}L${Rr - 5} ${top - 6}L${Rr - 12} ${top + 1}Z" fill="#f783ac"/>` };
    case 'beret': return { back: '', front: `<ellipse cx="46" cy="${top + 2}" rx="${rx + 2}" ry="8" fill="#c92a2a"/><circle cx="46" cy="${top - 6}" r="2" fill="#c92a2a"/>` };
    case 'bunny': return { back: `<ellipse cx="40" cy="${top - 14}" rx="5" ry="16" fill="#f8f9fa"/><ellipse cx="60" cy="${top - 14}" rx="5" ry="16" fill="#f8f9fa"/><ellipse cx="40" cy="${top - 14}" rx="2.5" ry="11" fill="#fcc2d7"/><ellipse cx="60" cy="${top - 14}" rx="2.5" ry="11" fill="#fcc2d7"/>`, front: '' };
    case 'horns': return { back: '', front: `<path d="M${L + 4} ${top + 6}q-6 -12 2 -18q-1 10 6 14Z M${Rr - 4} ${top + 6}q6 -12 -2 -18q1 10 -6 14Z" fill="#fff3bf" stroke="#e8b04b"/>` };
    case 'laurel': return { back: '', front: `<g fill="#40c057">${[-1, 1].map(sg => [0, 1, 2, 3].map(k => `<ellipse cx="${50 + sg * (rx - 2 - k * 1)}" cy="${top + 14 - k * 6}" rx="3" ry="6" transform="rotate(${sg * (30 + k * 20)} ${50 + sg * (rx - 2 - k * 1)} ${top + 14 - k * 6})"/>`).join('')).join('')}</g>` };
    case 'cowboy': return { back: '', front: `<ellipse cx="50" cy="${top + 6}" rx="${rx + 14}" ry="6" fill="#8b5a2b"/><path d="M${L + 4} ${top + 6}Q${L + 6} ${top - 16} 50 ${top - 12}Q${Rr - 6} ${top - 16} ${Rr - 4} ${top + 6}Z" fill="#a0692f"/><rect x="${L + 4}" y="${top + 1}" width="${2 * rx - 8}" height="3" fill="#5c3a1a"/>` };
    case 'divpin': return { back: '', front: `<g fill="#ffd43b" stroke="#e67700" stroke-width=".8"><circle cx="${Rr - 8}" cy="${top + 1}" r="2"/><rect x="${Rr - 14}" y="${top + 4}" width="12" height="2.5" rx="1"/><circle cx="${Rr - 8}" cy="${top + 9.5}" r="2"/></g>` };
    case 'mortarboard': return { back: '', front: `<path d="M${L - 6} ${top}L50 ${top - 10}L${Rr + 6} ${top}L50 ${top + 8}Z" fill="#1b1b1f"/><rect x="${L + 6}" y="${top + 2}" width="${2 * rx - 12}" height="8" fill="#1b1b1f"/><path d="M50 ${top - 1}L${Rr + 2} ${top + 2}V${top + 14}" stroke="#ffd43b" stroke-width="1.5" fill="none"/><circle cx="${Rr + 2}" cy="${top + 15}" r="2" fill="#ffd43b"/>` };
    // ---- 服（outfit） ----
    case 'blackbelt': return { back: '', front: `<path d="M18 104Q20 82 50 80Q80 82 82 104Z" fill="#f8f9fa"/><path d="M38 82L50 96L62 82" stroke="#dee2e6" stroke-width="3" fill="none"/><rect x="22" y="97" width="56" height="6" fill="#1b1b1f"/>` };
    case 'uniform': return { back: '', front: `<path d="M18 104Q20 82 50 80Q80 82 82 104Z" fill="#1c7ed6"/><path d="M42 81L50 86L58 81" stroke="#fff" stroke-width="2" fill="none"/><text x="50" y="101" text-anchor="middle" font-size="12" font-weight="900" fill="#fff" font-family="sans-serif">10</text>` };
    case 'sash': return { back: '', front: `<path d="M28 84L36 82L74 104H64Z" fill="#e03131"/><path d="M28 84L36 82L74 104H64Z" fill="none" stroke="#ffd43b" stroke-width="1"/>` };
    case 'royal': return { back: `<path d="M12 104Q14 70 32 64H68Q86 70 88 104Z" fill="#a61e4d"/>`, front: `<path d="M24 84Q50 76 76 84Q72 92 50 88Q28 92 24 84Z" fill="#f8f9fa"/><g fill="#1b1b1f"><circle cx="36" cy="85" r="1"/><circle cx="50" cy="83" r="1"/><circle cx="64" cy="85" r="1"/></g><circle cx="50" cy="94" r="3" fill="#fcc419"/>` };
    case 'armor': return { back: '', front: `<path d="M18 104Q20 82 50 80Q80 82 82 104Z" fill="#868e96"/><path d="M24 90Q50 84 76 90M22 98Q50 92 78 98" stroke="#495057" stroke-width="2" fill="none"/><circle cx="26" cy="86" r="4" fill="#adb5bd"/><circle cx="74" cy="86" r="4" fill="#adb5bd"/>` };
    case 'racer': return { back: '', front: `<path d="M18 104Q20 82 50 80Q80 82 82 104Z" fill="#e03131"/><path d="M40 82L44 104M60 82L56 104" stroke="#fff" stroke-width="3"/><circle cx="50" cy="96" r="4" fill="#fff"/><text x="50" y="98" text-anchor="middle" font-size="5" font-weight="900" fill="#e03131" font-family="sans-serif">1</text>` };
    case 'goldjacket': return { back: '', front: `<defs><linearGradient id="gj" x1="0" x2="1"><stop offset="0" stop-color="#e67700"/><stop offset=".5" stop-color="#ffe066"/><stop offset="1" stop-color="#e67700"/></linearGradient></defs><path d="M18 104Q20 82 50 80Q80 82 82 104Z" fill="url(#gj)"/><path d="M50 82V104" stroke="#b35c00" stroke-width="1.5"/>` };
    case 'badgevest': return { back: '', front: `<path d="M24 104L28 84L44 82L50 104Z M76 104L72 84L56 82L50 104Z" fill="#5c940d"/><g>${[['#fcc419', 32, 92], ['#e03131', 38, 98], ['#1c7ed6', 30, 100], ['#ae3ec9', 66, 92], ['#20c997', 62, 99], ['#f08c00', 70, 100]].map(([c, x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${c}" stroke="#fff" stroke-width=".6"/>`).join('')}</g>` };
    case 'cape': return { back: `<path d="M14 104Q16 72 32 66H68Q84 72 86 104Z" fill="#c92a2a"/>`, front: `<circle cx="50" cy="84" r="3" fill="#fcc419"/>` };
    case 'medal': return { back: '', front: `<path d="M44 80l6 12l6 -12" stroke="#1c7ed6" stroke-width="3" fill="none"/><circle cx="50" cy="95" r="6" fill="#fcc419" stroke="#e67700"/><path d="M48 93l2 -2v7" stroke="#e67700" stroke-width="1.5" fill="none"/>` };
    case 'champion': return { back: '', front: `<rect x="20" y="92" width="60" height="9" rx="3" fill="#495057"/><ellipse cx="50" cy="96" rx="12" ry="8" fill="#fcc419" stroke="#e67700" stroke-width="1.2"/><path d="M50 90l1.6 3.4 3.7.4-2.8 2.5.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.8-2.5 3.7-.4Z" fill="#e67700"/>` };
    case 'suit': return { back: '', front: `<path d="M18 104Q20 84 40 81L50 100L60 81Q80 84 82 104Z" fill="#343a40"/><path d="M45 81h10l-5 8Z" fill="#fff"/><path d="M48 87h4l1 12h-6Z" fill="#1c7ed6"/>` };
    case 'robe': return { back: `<path d="M14 104Q18 70 34 66H66Q82 70 86 104Z" fill="#5f3dc4"/>`, front: `<path d="M18 104Q20 84 50 82Q80 84 82 104Z" fill="#7048e8"/><path d="M50 82V104" stroke="#ffd43b" stroke-width="2"/><g fill="#ffd43b"><circle cx="32" cy="94" r="1.5"/><circle cx="68" cy="92" r="1.5"/><circle cx="40" cy="100" r="1"/><circle cx="62" cy="100" r="1"/></g>` };
    case 'shinobi': return { back: '', front: `<path d="M18 104Q20 84 50 82Q80 84 82 104Z" fill="#343a40"/><path d="M30 84L60 104M70 84L44 104" stroke="#212529" stroke-width="5"/><path d="M36 82Q50 90 64 82" stroke="#495057" stroke-width="3" fill="none"/>` };
    case 'starrobe': return { back: `<path d="M14 104Q16 72 32 66H68Q84 72 86 104Z" fill="#1b1f4a"/>`, front: `<path d="M24 84Q50 78 76 84" stroke="#ffd43b" stroke-width="2" fill="none"/><g fill="#fff3bf"><circle cx="22" cy="92" r="1.4"/><circle cx="78" cy="96" r="1.4"/><circle cx="18" cy="100" r="1"/><circle cx="84" cy="88" r="1"/></g><circle cx="50" cy="86" r="3" fill="#ffd43b"/>` };
    case 'spacesuit': return { back: '', front: `<path d="M16 104Q18 80 50 78Q82 80 84 104Z" fill="#f1f3f5" stroke="#adb5bd"/><rect x="40" y="90" width="20" height="10" rx="2" fill="#495057"/><circle cx="45" cy="95" r="1.6" fill="#ff6b6b"/><circle cx="50" cy="95" r="1.6" fill="#ffd43b"/><circle cx="55" cy="95" r="1.6" fill="#51cf66"/><path d="M28 80Q50 74 72 80" stroke="#adb5bd" stroke-width="4" fill="none"/>` };
    case 'stripe': return { back: '', front: `<path d="M18 92h64M18 98h64" stroke="rgba(255,255,255,.5)" stroke-width="3"/>` };
    case 'hoodie': return { back: `<path d="M${L - 8} ${fy + 30}Q${L - 10} ${top - 8} 50 ${top - 10}Q${Rr + 10} ${top - 8} ${Rr + 8} ${fy + 30}Z" fill="#495057"/>`, front: '' };
    default: return { back: '', front: '' };
  }
};
})(typeof window !== 'undefined' ? window : globalThis);
