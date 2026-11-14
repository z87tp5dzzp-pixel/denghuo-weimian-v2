/* 《燈火未眠》 VN engine core: state, VM, scheduler. UI-agnostic (ui object injected). */
(function (root) {
'use strict';
const X = (typeof module !== 'undefined' && module.exports) ? require('./expr.js') : root.VExpr;
const { LEADS, CHARS, COLORS } = X;

const NAMES = { kael: '凱爾', rowan: '洛恩', cecil: '塞西爾', elio: '艾利歐', orion: '奧瑞恩', ash: '艾許', leo: '利奧',
  silas: '塞拉斯', noa: '諾亞', vex: '維克斯', arno: '亞諾', yasi: '亞思', sophia: '蘇菲亞', lily: '莉莉', marcus: '馬可斯',
  julian: '朱利安', vaughn: '范恩署長', evelyn: '伊芙琳', mora: '莫拉', hana: '漢娜', hannah: '漢娜', tobi: '托比', toby: '托比',
  darren: '戴倫', ben: '班', tarin: '塔林', trainee: '見習生', extra: '' };
const HIDDEN = ['silas', 'noa', 'vex', 'arno'];
const HEART = { kael: 'silver_gray', rowan: 'hearth_red', cecil: 'blue', elio: 'green', orion: 'purple', ash: 'gold', leo: 'orange',
  silas: 'white', noa: 'pink', vex: 'black', arno: 'brown' };
const COLOR_TO_HEART = { silver_gray: 'silver_gray', hearth_red: 'hearth_red', red_fire: 'hearth_red', blue: 'blue', green: 'green',
  purple: 'purple', gold: 'gold', orange: 'orange', white: 'white', pink: 'pink', black: 'black', brown: 'brown' };
const COLOR_NAME = { silver_gray: '銀灰', hearth_red: '紅', red_fire: '紅', red_blood: '紅', blue: '藍', green: '綠', purple: '紫', gold: '金',
  orange: '橘', white: '白', pink: '粉紅', black: '黑', brown: '棕' };
const COLOR_HEX = { silver_gray: '#c9cdd6', hearth_red: '#d9483b', red_fire: '#e8603a', red_blood: '#8f1d1d', blue: '#3d7fd9', green: '#4fae6a',
  purple: '#9b62d6', gold: '#e2b84a', orange: '#ef8a33', white: '#f4f1ea', pink: '#ef8fb5', black: '#2a2730', brown: '#9a6a43', red: '#d9483b',
  gray: '#9a9a9a', rainbow: '#e2b84a', twelfth: '#7fe0d8' };
const EPILOGUE = { kael: 'K32', rowan: 'R33', cecil: 'C31', elio: 'E31', orion: 'O34', ash: 'A34', leo: 'L34', silas: 'S33', noa: 'N33', vex: 'V32', arno: 'AR34' };
const LOC_NAME = { medbay: '醫療室', outside_wall: '牆外', old_port_bar: '舊港酒館', roof: '屋頂', sea_wall: '海堤', tower: '嚮導塔', chapel: '禮拜堂',
  mess: '食堂', canteen: '食堂', wall_top: '城牆', kitchen: '廚房', training: '訓練場', guide_room_corridor: '疏導室走廊', dorm: '宿舍', archive: '檔案室',
  hq_corridor: '總部走廊', hq_locker: '更衣室', research: '研究所', research_dorm: '研究所宿舍', research_roof: '研究所屋頂', facility_ruin: '設施廢墟',
  detention: '拘留室', north_city: '北城', shallows: '淺灘', cemetery: '墓地', lab: '實驗室', old_port_pier: '舊港碼頭', old_port_alley: '舊港巷弄',
  rift_edge: '裂隙邊緣', bar: '酒館', chapel_yard: '禮拜堂中庭', lighthouse: '燈塔', east_seawall: '東海堤', briefing: '簡報室', cecil_office: '上校辦公室', city: '城區', city_north: '北城', dorm_yasi: '我的宿舍', east_district: '東區', greenhouse: '溫室', guide_room: '疏導室', harbor: '港口', hq_office: '總部辦公室', hq_roof: '總部屋頂', hq_yard: '中庭', manor: '宅邸', market: '市場', mess_hall: '食堂', old_port: '舊港', orphanage: '孤兒院', purify_room: '淨化室', rowan_room: '洛恩的房間', seawall: '海堤', slum_market: '貧民區市場', training_ground: '訓練場' };
const NOON_T = ['predawn', 'dawn', 'morning', 'noon', 'dusk'];
const NIGHT_T = ['evening', 'night', 'late_night'];
const ZHD = '零一二三四五六七八九';
function zhNum(x) { let n = Math.max(0, Math.round(X.num(x))); if (n >= 100) return n === 100 ? '一百' : String(n); if (n < 10) return ZHD[n]; const t = Math.floor(n / 10), u = n % 10; return (t === 1 ? '' : ZHD[t]) + '十' + (u ? ZHD[u] : ''); }
const GUIDE_AFTER = new Set(['R08']); // 疏導結束後才發生的組合事件（排在當晚之後）
const GUIDE_REFS = /\b(g1|g2|guide_g1|guide_g2|anchor|sent_in|guide_pair|guide_tag|guide_mode|__gi)\b/;
// ---- v2 systems (REWRITE_PLAN §4) ----
const GUIDES = ['rowan', 'cecil', 'elio', 'orion', 'noa', 'arno'];
const SENTINELS = ['kael', 'ash', 'leo', 'silas', 'vex'];
const CONF_SEEN = { kael: 'K21', ash: 'A23', leo: 'L21', silas: 'S24', vex: 'V23' }; // 路線告白場＝也算 confessed
const MX_TYPES = ['patrol', 'recon', 'escort', 'outside_wall', 'dark_op', 'execution'];
const STAGE_T = [0, 0, 8, 15, 22, 30, 40, 55, 60]; // aff needed for stage n (stage 7: ≥55 until confession scenes exist)
const PURIFY_ID = /^(GUIDE_|GS_|GR_|GX_|GXF_|WX_|WATCH_|JOIN_|LOAD_|TEMP_ANCHOR|ANCHOR_|EMERG|SENT_PRESENCE|SHARED_SENSE)/;
const LOAD_MAX = 120;
const PLACE_KEY = { canteen: 'mess', east_seawall: 'sea_wall', old_port_pier: 'old_port_bar', old_port_alley: 'old_port_bar', bar: 'old_port_bar', chapel_yard: 'chapel', research_roof: 'roof' };
const PLACE_VERB = { mess: '去食堂', training: '去訓練場', roof: '上屋頂', sea_wall: '去海堤走走', archive: '去檔案室', medbay: '去醫療室', wall_top: '上城牆',
  chapel: '去禮拜堂', tower: '去嚮導塔', old_port_bar: '去舊港', kitchen: '去廚房', dorm: '回宿舍待著', guide_room_corridor: '去疏導室那一層', hq_corridor: '在總部裡走走',
  hq_locker: '去更衣室', research: '去研究所', research_dorm: '去研究所宿舍', outside_wall: '出牆外', north_city: '去北城', shallows: '去淺灘', cemetery: '去墓地',
  lab: '去實驗室', lighthouse: '去燈塔', rift_edge: '去裂隙邊緣', facility_ruin: '去設施廢墟', detention: '去拘留室', roam: '隨便走走' };
const LEAD_HOME = { kael: 'training', rowan: 'mess', cecil: 'tower', elio: 'medbay', orion: 'archive', ash: 'wall_top', leo: 'training', silas: 'chapel', noa: 'old_port_bar', vex: 'roof', arno: 'sea_wall' };
// ---- 新版（v2 重製）：時段卡、任務板、故事佇列、負荷玩法 ----
const ACT_END_WEEK = [1, 1, 6, 11, 15, 17]; // index = 幕（1..5）
const ACT_END_DAY = [7, 7, 42, 77, 105, 113];
const actOfWeek = (w) => w <= 1 ? 1 : w <= 6 ? 2 : w <= 11 ? 3 : w <= 15 ? 4 : 5;
// 重要劇情：必看。負荷條件不符時，用「她自己推感官／兩位嚮導緊急疏導」橋接
const V2_KEY = ['VV13', 'NV_AR16', 'NV_AR08', 'K21', 'CV15', 'EV13', 'OV13', 'AV18', 'LV18', 'KV18', 'KV08', 'RV18', 'RV13', 'RV14', 'RV24', 'RV23', 'K16', 'K16x', 'K_trust_repair', 'K23', 'KV_N0', 'KV39', 'KV42', 'K11b', 'V14', 'V21', 'S22', 'A23', 'L21', 'S24', 'V23', 'R18', 'C23', 'E23', 'O22', 'N24', 'AR22', 'K20', 'S11', 'N21', 'V20', 'AR27', 'O10', 'L20', 'A22', 'R17', 'C22', 'E22', 'O21', 'N23', 'S23', 'V22'];
// 框架場景：同一輪裡看過的句子不再出現（選項前那一句除外）
const FRAME_ID = /^(GUIDE_DAILY|BRIEFING_RANDOM|SENT_(DOOR|STAY|ORDER)|PATROL|MX_SETTING|MX_AFTER|MX_CARRY|LOAD_(CHECK|70|90|100)|PLACE_[A-Z_]+|GX_(OPEN|MAIN|MA|MAB|URGENT|MISSED|PATROL|PILL|WAR|WAR_LATE|RAIN|SNOW|AGAIN|LOAD|PAIR)|GXF_[A-Z]+(_\d+)?|WATCH_(SHALLOW|MID|DEEP)|GR_[A-Z_0-9]+|GUIDE_STAGE_GENERIC|LAMP_RITUAL|NEGLECT_GENERIC|MB_[A-Z_]+|SLOT_[A-Z_]+|MX_SENSE(_[A-Z]+)?|CAMP_[A-Z_]+|SLOAD_[A-Z_]+|GFAT_[A-Z_]+|V2_[A-Z_]+|GRAVE_[A-Z_0-9]+|SNEAK_[A-Z_0-9]+|GUIDE_NONE|MXF_[A-Z_0-9]+)$/;
const OVERNIGHT = ['outside_wall', 'outpost', 'sealed'];
const MB_TYPES_BY_ACT = { 2: ['patrol', 'recon', 'escort', 'outpost'], 3: ['patrol', 'recon', 'escort', 'outpost', 'outside_wall', 'dark_op'], 4: ['patrol', 'recon', 'escort', 'outside_wall', 'dark_op', 'sealed', 'execution'], 5: ['patrol', 'recon', 'outside_wall', 'sealed'] };
const MB_NAME = { patrol: '城牆巡邏', recon: '偵察', escort: '護送', outside_wall: '牆外（兩天一夜）', dark_op: '暗勤', execution: '處刑', outpost: '前哨站（過夜）', sealed: '封鎖區（過夜）' };
const BAND_NAME = ['安靜', '吵', '吃緊', '透支'];
const MB_TXT = {
  patrol: ['北牆第三段，夜裡有東西撞過鐵網。去走一趟，把破口標出來。', '東區的哨塔換班缺人。站一個下午，看著雪線。', '城牆外側的照明壞了兩盞。護送維修班上去，順便巡一圈。', '巡邏路線改了。新路線沒人走過，馬可斯要第一份紀錄。', '南門的鐵柵有刮痕，不是人抓的。查清楚，回來寫報告。'],
  recon: ['廢棄車站的地下層有回聲。下去看，不要戀戰。', '舊港倉庫連續三晚有光。看清楚是什麼人，不要被看見。', '裂隙邊緣的雪變色了。帶樣本回來，越快越好。', '北城的廢樓裡有人在搬東西。數人數，記臉。', '一份地圖缺了兩條街。走一遍，補上。'],
  escort: ['護送研究所的兩位研究員到北城的觀測站。他們話很多。', '把一批藥送到東區的臨時醫站。路不好走，車會拋錨。', '帶一個從牆外逃回來的孩子去登記處。他不肯說話。', '護送署方的文件車。文件上寫什麼，不准問。', '陪後勤嚮導去外圍營區例行疏導。哨兵負責站門口。'],
  outside_wall: ['牆外第二營地。去，待一夜，天亮再回來。帳篷只有兩頂。', '牆外的舊燈塔還亮著。有人說那不是燈。去看，過一夜。', '牆外的搜救。失聯小隊最後的位置在峽谷。來回兩天。', '牆外的補給點被翻過了。查清楚是什麼東西翻的。要過夜。'],
  dark_op: ['不寫進紀錄的任務。地點到了才會知道。', '一個名字，一個地址。只看，不碰。', '署方要一份「不存在的」報告。今晚交。', '跟著一個人，到他停下來為止。'],
  execution: ['處刑名單上有一個名字。執行者需要一位見證。', '失控的哨兵，關在北區的隔離室。今天下午。', '名單上的人還沒失控。署方說「快了」。'],
  outpost: ['北坡前哨站缺一夜的守備。爐子壞了，被子很薄。', '海邊的前哨站。一間屋子，兩張床，一個窗。守到天亮。', '前哨站的訊號斷了。去接上，然後在那裡過一夜確認。', '雪線上的前哨站。上去要半天，下來要明天。'],
  sealed: ['封鎖區第七街。裡面的時間好像停了。守一夜，記錄異常。', '封鎖區的醫院。有人在裡面敲牆。去看，天亮再出來。', '封鎖區的邊界在移動。釘新的界樁，過一夜看它會不會再動。']
};
// ===== 第 2 期：主線狀態、主線任務卡、節日、日記 =====
// 主線走到哪（看過哪一場主線）→ 現在是哪一段
const PLOT_PH = [['M1-01', 'a1'], ['M2-01', 'p2a'], ['M2-03', 'p2b'], ['M2-04', 'p2c'], ['M2-05', 'p2d'], ['M2-06', 'p2e'],
  ['M3-01', 'p3a'], ['M3-03', 'p3b'], ['M3-04', 'p3c'], ['M3-05', 'p3d'], ['M3-06', 'p3e'], ['M3-07', 'p3f'], ['M3-08', 'p3g'],
  ['M4-02', 'p4a'], ['M4-03', 'p4b'], ['M4-04', 'p4c'], ['M4-05', 'p4d'], ['M5-01', 'p5']];
// 跟著主線長出來的任務單（base＝實際走哪一種任務流程）
const PLOT_MB = {
  p2a: [{ base: 'escort', txt: '新嚮導團第一次跟外勤：護送後勤嚮導去外環營區。讓新來的人看看牆外的風。' }],
  p2b: [{ base: 'escort', txt: '替失控的那位同僚，把遺物送回他母親家。署方不派車。' }, { base: 'recon', txt: '他吃的藥從哪裡來？去他常去的那條街，問、聽、記下來。' }],
  p2c: [{ base: 'recon', txt: '下水道那批貨的另一半還沒找到。再下去一次。不准點火。' }, { base: 'patrol', txt: '舊港碼頭夜裡有船靠岸，沒有登記。去堤上守一個下午。' }],
  p2d: [{ base: 'escort', txt: '貧民區失控的哨兵留下兩個孩子。帶他們去登記處——他們不肯放開彼此的手。' }, { base: 'outpost', txt: '黑市的貨從北坡進來。北坡前哨站缺一夜的守備，順便看著那條路。' }],
  p2e: [{ base: 'escort', txt: '研究部要一批負荷資料，指定 A-08 護送採樣員。資料是誰的，單子上沒寫。' }],
  p3a: [{ base: 'patrol', txt: '城牆下有人在撿佈道時撒下來的傳單。去收走——收傳單，不收人。' }, { base: 'outside_wall', txt: '教團的補給線經過牆外第二營地。去那裡過一夜，看半夜誰在搬東西。' }],
  p3b: [{ base: 'escort', txt: '圍剿那天活下來的信徒家屬，要送去外圍區安置。護送。' }, { base: 'recon', txt: '那條街上還有沒有人想「自願」？去聽。聽到了，不要先動手。' }],
  p3c: [{ base: 'patrol', txt: '輪休期間城牆缺人。半天的班，不算出勤——馬可斯說的。' }],
  p3d: [{ base: 'dark_op', txt: '慈善會的捐款名冊少了一頁。便衣去舊貴族的宅邸區，看是誰拿走的。' }],
  p3e: [{ base: 'patrol', txt: '停電夜之後，還有三區的燈沒亮。護送修線班，一條街一條街點回來。' }, { base: 'recon', txt: '停電那晚走失的孩子還有兩個沒找到。去外圍區，挨家挨戶。' }],
  p3f: [{ base: 'recon', txt: '研究部要裂隙邊緣的雪樣本。最近大家都在採樣——採雪，採血。' }],
  p4a: [{ base: 'execution', txt: '隔離區名單上有一個名字。署方說：例行。' }],
  p4b: [{ base: 'patrol', txt: '外環巡邏。附註：A-08 須有哨兵同行，全程不得離開視線。' }],
  p4c: [{ base: 'recon', txt: '雨季的下水道漲水了。有人看見穿研究部外套的人在裡面。去查。' }, { base: 'outpost', txt: '海邊的前哨站，雨停之前沒有人下得來。去守——離開這座城兩天。' }],
  p4d: [{ base: 'sealed', txt: '封鎖區的界樁又動了。這一次，是往城裡動。' }],
  p5: [{ base: 'patrol', txt: '牆內防衛：東區食堂街那一段。每一條街都是前線。' }, { base: 'escort', txt: '流民在城門外排隊。護送第一批進來的人，到他們能睡的地方。' }]
};
// 節日與季節（都是休假日）
const FEST = { 21: 'HARVEST', 35: 'SEA', 49: 'LONGNIGHT', 63: 'SNOW', 70: 'LANTERN' };
// 每晚的日記（點燈之後）。每一句只寫一次；用完就少寫一句。
const DY = {
  main: ['今天發生的事太大了，寫不進這麼小的格子裡。只寫一行：我還在。', '我把今天寫了三次，撕了兩次。剩下的這一行是：我回來了。', '今天的事，我不想寫。可是不寫的話，明天我會假裝它沒有發生。', '筆停在紙上很久，墨水暈開成一個黑點。就讓它代替今天吧。', '今天以後，有些事不一樣了。我還不知道是哪些。'],
  mission: ['出勤。走了很長的路，聽了很多心跳。回來的時候，數字是對的——出去幾個，回來幾個。', '今天的任務很普通。普通得讓我想把它記下來。普通的日子，是有人守著才有的。', '任務。風很大。我把一個陌生人的心跳聽了一整個下午，他不知道。', '出牆、回牆。城門闔上的聲音，我今天第一次覺得像「到家了」。……我是不是寫錯了。', '巡邏的時候，有個小孩隔著鐵網對我揮手。我沒有揮回去。我現在後悔了。', '今天走過的那條街，三年前死過很多人。今天，它有人在晾衣服。', '回報寫了兩頁。馬可斯說他看得出我是活著寫的。'],
  hurt: ['受傷了。不痛，是我騙自己的。痛，才是真的。', '繃帶纏到手肘。寫字的時候，字歪了。歪的字也是我寫的。', '醫療室的天花板我已經很熟了。今天有人坐在床邊，一直沒走。', '他們說我差一點。差一點，是一個很近的距離。'],
  push: ['今天我把感官全打開了。世界大到我裝不下，可是我聽見了要聽的東西。值得嗎。……值得的。大概。', '開了感官。耳朵裡的雪原現在還在下。', '我又一個人撐了。寫下來，是為了下一次記得：有人說過不准。', '今天，我又把自己當成刀了。刀不會痛。可是我會。'],
  guided: ['疏導。{g}的光走進來的時候，我沒有先躲。', '今晚是{g}。雪原安靜下來之後，我聽見自己的呼吸，很慢，很普通。', '{g}握著我的手腕，很久。我以為我會想抽回來。我沒有。', '疏導結束，{g}說了一句「晚安」。我回了。這是第一次嗎？我想不起來。', '{g}今天走得很小心，像怕踩碎什麼。我想跟他說，我沒有那麼容易碎。……我沒說。', '疏導室的燈關掉以前，{g}看了我一眼。我不知道那一眼是什麼意思，可是我記住了。', '今天的雪原，{g}走到了很裡面。他回來的時候，眼睛是濕的。我不敢問他看見了什麼。', '{g}的手很暖。我把這件事寫下來，是因為我怕明天就忘了暖是什麼感覺。'],
  grave: ['去了墓地。說了一些活人的事。他們應該會想聽。', '墓碑上的名字，我一個一個摸過去。手很冷，名字是溫的。', '我在墓地站到天黑。回來的路上，路燈一盞一盞亮起來，像有人在替我數。', '墓地的風很安靜。安靜到我差一點，就想留下來。'],
  quiet: ['今天沒有什麼事。我在窗邊坐了很久，看雲。雲是灰的，可是它在動。', '一個人待著。吃了一顆蘋果，很酸。我把它吃完了。', '今天很安靜。安靜的日子，我反而睡不著。', '什麼都沒做的一天。以前我會覺得這是浪費。今天我覺得，這是休息。', '房間裡的燈油快用完了。明天要去領。……我是在計畫明天嗎。', '我把刀擦了一遍，又擦了一遍。刀已經很亮了。擦的是我自己。'],
  fest: { HARVEST: '秋收市集。手裡塞滿了別人給的東西：一顆梨、一塊餅、一句「謝謝妳守著」。我不知道要把它們放在哪裡。', SEA: '今天去了海邊。水很冷，太陽很暖。我的腳踝上還有沙。我沒有馬上洗掉。', LONGNIGHT: '長夜。一年裡最黑的一天，整座城都點著燈。我第一次覺得，黑夜不是只有我一個人在怕。', SNOW: '雪季。有人往我的領子裡塞了雪。我追了他半個訓練場。我笑了嗎？大家說我笑了。', LANTERN: '燈節。我放了一盞燈到海上。燈上寫了什麼，連日記都不告訴。' },
  lead: {
    kael: ['{n}今天坐在我左邊。七年都是左邊。我今天才發現，我也一直留著那個位子。', '{n}今天說了很多話——以他的標準。七句。我數了。', '{n}的劍帶又磨損了。我想替他換一條，又怕他不習慣。', '{n}今天叫了我的名字，叫完就走了。我在原地站了很久。', '{n}的手今天碰到我的手背。他沒有道歉。以前他會道歉。', '七年了。{n}還在。我寫下這一行，是因為我怕有一天它不是真的。'],
    rowan: ['{n}今天又塞了東西給我吃。我吃完了。他笑得像我打了勝仗。', '{n}的手套又燒了一個洞。他說沒關係。他每次都說沒關係。', '{n}今天哼了一首歌。我聽不出是什麼歌，可是我一直記得旋律。', '今天在食堂，{n}坐進我那一圈雪裡，好像那裡本來就是他的位子。', '{n}說，冬天的湯要煮久一點。我問為什麼。他說，因為會有人晚回來。', '{n}看我的時候，像在看火。我不知道我有什麼好看的。'],
    cecil: ['{n}今天在報告上寫了我的名字，不是編號。我看到了。', '{n}的眼鏡鏈今天勾到了我的袖子。他說「失禮」，耳朵紅了。', '{n}把我的排程改了三次。最後一次，空出了一個下午。', '{n}說，評估報告要寫實話。我問他，那你寫了什麼。他沒有回答。', '{n}今天沒有看錶。我跟他說話的時候，他一次都沒有看。', '{n}的字很好看。我把他寫給我的便條留下來了。不知道為什麼。'],
    elio: ['{n}今天又檢查了一次我的藥。他的手指在藥袋上停了很久。', '{n}說我瘦了。他把一顆糖放進我的口袋，說是處方。', '{n}笑起來的時候，眼角那顆痣會動一下。我今天才注意到。', '{n}值完夜班，在醫療室的椅子上睡著了。我替他蓋了一件外套。他不知道。', '{n}說，痛的時候要說痛。我今天說了一次。他說，很好，很勇敢。', '{n}的書裡夾著一片葉子。他說是淺灘撿的。我想看看淺灘。'],
    orion: ['{n}今天說，他夢到了明天。我沒有問明天是什麼樣子。', '{n}在窗邊站著，好像一直都在那裡。我開始習慣了。這很危險。', '{n}哼了一首沒有歌詞的歌。我好像在哪裡聽過。', '{n}說，門有兩邊。我不知道他在說哪一扇門。', '{n}看我的時候，像在看很久以前的人。我不喜歡。……我不討厭。', '{n}今天碰了我的額頭。他的手很涼，像十年前的風。'],
    ash: ['{n}今天在我的門口蹲了一下午。我開門的時候，他假裝路過。', '{n}的項圈燈今天一直是綠的。我數了，綠了三個小時。', '{n}聞了我的頭髮，說今天的味道比較不苦。', '{n}說他記得每一個人的味道。我問他我是什麼味道。他說：雪。', '{n}把一顆石頭放在我的窗台上。很圓。他說是河邊最圓的。', '{n}今天笑了，露出犬齒。我想多看一次。'],
    leo: ['{n}今天挑戰我三次。輸了三次。第三次，他差一點贏。', '{n}的耳機今天沒有開。他說，因為在我旁邊很安靜。', '{n}吵了一整天。我發現，我沒有嫌他吵。', '{n}說他睡不著。我說我也是。我們各自在自己的屋頂上，醒到天亮。', '{n}今天叫我「前輩」叫了二十一次。我沒有數。……我數了。', '{n}的心跳很快，像小鳥。在我旁邊的時候，會慢一點。'],
    silas: ['{n}今天替一個不認識的人點了蠟燭。他說，總要有人記得。', '{n}的手套是白的，今天沾了一點灰。他沒有馬上拍掉。', '{n}叫我的名字的時候，用的是「您」。我開始覺得那個字很暖。', '禮拜堂的燭火今天很穩。{n}說，是因為有人在。', '{n}說他不祈禱。他只是點燈。我們在這件事上，好像是同一種人。', '{n}今天什麼都沒說，只是陪我坐著。那樣就夠了。'],
    noa: ['{n}今天又給我調了草莓牛奶。我喝完了。他笑得很得意。', '{n}說的話，一半是玩笑。今天，我分不出是哪一半。', '{n}擦杯子的時候，會偷看我。我假裝不知道。', '{n}今天沒有開玩笑。整整一個晚上。我有點不習慣。', '{n}說酒館打烊以後，才是他真正的時間。他讓我留下來了。', '{n}的手很巧，綁繃帶比醫療室的人還快。我沒問他在哪裡學的。'],
    vex: ['{n}今天叫我「小刀」。我回他一句。他笑到差點從牆上掉下去。', '{n}的營地今天有一個孩子在學寫字。寫的是我的名字。', '{n}說，牆外的星星比較多。我抬頭看，真的。', '{n}把他的菸熄了，因為我咳了一聲。', '{n}說他扛著兩百個人。今天，我替他扛了一個下午。', '{n}的槍上刻了很多道刻痕。今天，他沒有再刻新的。'],
    arno: ['{n}今天煮了湯。他說，以前也煮過。我想不起來，可是我喝得出來。', '{n}叫我的名字，跟別人都不一樣。像在叫一個很小的人。', '{n}的手很冷，跟我一樣。我們都在用對方暖手。', '{n}今天說了一件小時候的事。我不記得了。可是我哭了。', '{n}說，以後每年都要一起過冬天。以後。他說了以後。', '{n}在海堤上等我，等了一整個下午。他說他習慣等。我不想讓他再習慣了。']
  },
  close: {
    hi: ['如果明天不用醒來，好像也可以。……燈還沒點完。先點完再說。', '夜很長。我數著自己的心跳，數到一半就不想數了。', '我想，我是在等一個可以停下來的理由。今天也沒有等到。', '雪原在叫我。叫得很溫柔。我把燈調亮了一點。', '我把刀放在枕頭邊。不是怕有人來。是怕我自己。', '今天也活下來了。我不知道這句話，應該寫成好消息還是壞消息。', '如果我先走了，這本日記會留給誰呢。……誰都不要看。', '窗外的燈一盞一盞熄掉。我是最後一盞。', '我想睡很久很久。久到醒來的時候，什麼都不用撐了。', '今天有人說「明天見」。我回了「嗯」。我說謊了嗎？'],
    mid: ['有時候想停下來。有時候，又想看看明天會不會比較好。今天是後面那種。', '燈點好了。今晚不黑。', '我把明天的事寫在紙條上，貼在門後面。我在計畫明天。這件事，我想記下來。', '睡前想到一個人的臉。我沒有寫是誰。', '今天沒有很想死。我把這一句寫得很小，怕被誰看見。', '心跳很普通，呼吸很普通。普通，原來可以是一種好消息。', '我好像有一點點，捨不得什麼了。', '今天的雪原有風，可是不冷。', '晚安。……這兩個字，我以前不寫的。', '有人在等我明天出現。我想讓他等到。'],
    lo: ['明天，想早一點起來。去食堂喝第一鍋的湯。', '我想看看明天的天空是什麼顏色。我是說真的。', '今天想活。明天也想。我第一次把這兩句連在一起寫。', '燈點了兩盞。一盞給今天的人，一盞給我自己。', '我把刀擦好，放回架上，不放在枕頭邊了。', '如果有明天——不，明天一定會有。我在等它。', '晚安。明天見。我寫給誰呢？寫給明天的我。', '有人教會我一件事：把自己也算進去。今天，我算了。', '我今天笑了兩次。一次被看見，一次沒有。', '睡前，我第一次想到一年以後。']
  },
  over: ['字寫不直。耳朵裡的雪太大了。', '今天很吵。我只寫一行，怕寫多了，手會抖。', '負荷很高。燈的火在我眼裡分成三個。我不知道哪一個是真的。', '雪原在響。日記先寫到這裡。']
};

const SLOT_PROMPT = {
  day: [
    ['今天的白天空著。要做什麼？', '簡報結束，走廊上的人散開了。我呢？', '白天還很長。我想把它花在哪裡？'],
    ['耳朵有點吵，但還能用。白天要做什麼？', '雪原在響，聲音不大。我還有一個白天。', '腦袋裡有一點雜音。……白天，要去哪裡？'],
    ['負荷吃緊。每一件事都會再加一點。今天白天，要拿來做什麼？', '我的手指在抖。白天還很長——要花在哪裡？', '耳朵裡的聲音比外面還大。白天，我要去哪裡？'],
    ['透支了。牆上的鐘在我的牙齒裡走。……今天白天，我還要做什麼？', '我聽得見三層樓外有人在翻書。白天——我要怎麼撐過去？', '世界太大聲了。白天，我要拿什麼去換一點安靜？']
  ],
  eve: [
    ['傍晚了。疏導室的燈亮著。今晚，我要去哪裡？', '太陽沉到城牆後面。傍晚這一段，要給誰？', '晚飯的鐘響了。傍晚，要做什麼？'],
    ['傍晚。雪原有點吵，疏導室的門開著。要去嗎？還是——', '天色暗下來，耳朵還在響。傍晚要做什麼？', '傍晚。我可以去疏導，也可以不去。'],
    ['負荷吃緊。疏導室的燈亮著——不去的話，明天會更吵。傍晚要做什麼？', '我的視線邊緣在發白。傍晚，要去疏導嗎？', '耳朵很痛。今晚如果不疏導……傍晚要去哪裡？'],
    ['透支了。不去疏導室，今晚可能會出事。……我還是要選嗎？', '整棟樓的心跳都在我的耳朵裡。傍晚，要去哪裡？', '我站不太穩。疏導室的燈在走廊盡頭，很遠。要過去嗎？']
  ],
  night: [
    ['夜裡了。要去哪裡？', '熄燈前還有一點時間。要給誰？', '夜很長。我要去哪裡？'],
    ['夜裡。耳朵還有一點吵。要去哪裡？', '走廊的燈一盞一盞熄掉。夜裡，我要去哪裡？', '睡不著。夜裡要做什麼？'],
    ['夜裡。負荷吃緊——再吵一點就會失控。要去哪裡？', '我躺不下去。夜裡，要去哪裡？', '夜裡的聲音比白天更尖。我要去哪裡？'],
    ['夜裡。透支。我數著自己的心跳，數到一百就重來。……要去哪裡？', '夜裡。世界在我的皮膚上爬。我要去哪裡？', '我想要安靜。夜裡，哪裡有安靜？']
  ]
};
function hashStr(t) { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
const PLACE_POOL = ['mess', 'training', 'roof', 'sea_wall', 'archive', 'medbay', 'wall_top', 'tower', 'chapel', 'old_port_bar'];

function weatherOf(d) {
  if (d === 3) return 'rain';
  if (d >= 8 && d <= 77) {
    if ([60, 61, 62, 69, 75].includes(d)) return 'snow';
    return d % 6 === 4 ? 'rain' : 'clear';
  }
  if (d >= 78 && d <= 91) return d % 4 === 0 ? 'clear' : 'rain';
  if (d >= 92 && d <= 105) return 'rain';
  return 'clear';
}
function isDayOff(d) { return d > 0 && (d % 7 === 0 || ((d >= 57 && d <= 70) && d % 7 === 6)); }
const pairKey = (a, b) => [String(a), String(b)].sort().join('_');
function normVar(name) {
  if (name.startsWith('seen_')) name = name.replace(/-/g, '_');
  const m = /^(pair_bond|pair_sync|shared_sense_result|shared_sense)_([a-z]+)_([a-z]+)$/.exec(name);
  if (m && LEADS.includes(m[2]) && LEADS.includes(m[3])) return m[1] + '_' + pairKey(m[2], m[3]);
  return name;
}
const clone = (o) => JSON.parse(JSON.stringify(o));

class Engine {
  constructor(data, ui, persist) {
    this.D = data; this.ui = ui; this.P = persist; // persist: {endings:{}, cgs:{}, unlocks:{}, read:Set, gallery:{}}
    this.mainIndex = {}; data.order.forEach((id, i) => { this.mainIndex[id] = i; });
    this.events = Object.entries(data.scenes).filter(([id, s]) => (s.when || s.slot) && !(id in this.mainIndex)).map(([id, s]) => ({ id, s }));
    this.errors = [];
    this.purify = new Set();
    for (const [id, sc] of Object.entries(data.scenes)) {
      if (PURIFY_ID.test(id) || (sc.whenx && GUIDE_REFS.test(sc.whenx)) || /疏導|淨化/.test(sc.title || '')) this.purify.add(id);
      else if (id in this.mainIndex && /疏導/.test(JSON.stringify(sc.code))) this.purify.add(id);
    }
    this.ctx = { scopes: [], get: (n) => this.getVar(n), fn: (f, a) => this.callFn(f, a), isId: (n) => this.isId(n) };
    this.S = null;
  }
  // ---------- state ----------
  newState() {
    const ng = Object.keys(this.P.endings || {}).length > 0;
    return {
      v: { aff_kael: 10, bond_kael: 45, toby_alive: true, lily_alive: true, hannah_alive: true, load: 0, day: 0, act: 0, time: 'morning',
        colors_seen: [], saved: [], lost: [], qualified: [], lights: [], ng_plus: ng, guide_tag: '', g1: '', g2: '', anchor: '', window: '',
        ending_lead: '', eve_lovers: [], eve_last: '', multi_left: [], three_left: '', other_side_lead: '', secret_arno_partner: '', gate_keeper: '' },
      stack: [], queue: [], synth: {}, synthN: 0, cursor: -1, fallback: false, ended: false, endingId: null,
      pres: { bg: null, bgfx: 'gray', sprites: {}, cg: null, bgm: null, amb: null, counter: null, pov: 'yasi', names: {}, combat: null, date: '', title: '' },
      log: []
    };
  }
  isId(n) { return CHARS.includes(n) || COLORS.includes(n) || n in LOC_NAME; }
  getVar(n) {
    const v = this.S.v;
    if (n === 'load' && this._loadCtx != null) return this._loadCtx;
    if (n === 'week' && this._weekCtx != null) return this._weekCtx;
    switch (n) {
      case 'load_band': { const L = X.num(v.load); return L >= 90 ? 3 : L >= 70 ? 2 : L >= 40 ? 1 : 0; }
      case 'plot': return this.plotNow().k;
      case 'plot_age': { const p = this.plotNow(); return p.d === null ? 99 : X.num(v.day) - p.d; }
      case 'band_name': { const L = X.num(v.load); return BAND_NAME[L >= 90 ? 3 : L >= 70 ? 2 : L >= 40 ? 1 : 0]; }
      case 'guides_able': return this.guidesAble().length;
      case 'camp_tonight': return X.num(v.camp_day) === X.num(v.day) && X.num(v.day) > 0;
      case 'mission_overnight': return OVERNIGHT.includes(v.mission_type);
      case 'colors_count': return (v.colors_seen || []).length;
      case 'saved_count': return (v.saved || []).length;
      case 'lost_count': return (v.lost || []).length;
      case 'all_leads': return LEADS.slice();
      case 'known_guides': return GUIDES.filter(x => x === 'noa' ? !!v.guide_noa_unlocked : x === 'arno' ? !!v.arno_met : !!v[x + '_met']); // 她已知道是嚮導的人（與 LOAD_90 選項同條件）
      case 'all_leads_stage4': return (v.eve_lovers || []).length === 11;
      case 'week': return v.day > 0 ? Math.ceil(v.day / 7) : 0;
      case 'weather': return weatherOf(v.day);
      case 'snow_day': return weatherOf(v.day) === 'snow';
      case 'rain_tomorrow': return weatherOf(v.day + 1) === 'rain';
      case 'guide_g1': return v.g1;
      case 'guide_mode': return (v.time === 'night' && (v.g1 === 'orion' || v.g2 === 'orion') && v.seen_O05) ? 'dream' : 'normal';
      case 'noa_letters_lead': return v.arno_letters_route === 'noa';
      case 'arno_reunited': return !!v.seen_AR04;
      case 'late_night': return v.time === 'late_night';
      case 'injured_hospitalized': return v.injury_yasi === 2;
      case 'mission_outside_wall': return v.mission_type === 'outside_wall' && X.num(v.mission_day) >= X.num(v.day) - 1 && X.num(v.mission_day) > 0;
      case 'mission_today': return X.num(v.mission_day) === X.num(v.day) && X.num(v.day) > 0;
      case 'executed_today': case 'seen_today_execution': return v.mission_type === 'execution' && X.num(v.mission_day) === X.num(v.day) && X.num(v.day) > 0;
      case 'dark_op_partner_includes': return (v.mission_type === 'dark_op' && X.num(v.mission_day) === X.num(v.day)) ? (v.dark_op_with || '') : '';
      case 'mission_banned': return X.num(v.mission_ban_until) >= X.num(v.day);
    }
    if (n === 'rain_day') return !!v.rain_day || weatherOf(v.day) === 'rain';
    const nn = normVar(n);
    if (nn.startsWith('seen_ending_')) return !!(this.P.endings && this.P.endings[nn.slice(12)]) || v[nn];
    return v[nn];
  }
  setVar(n, val) { n = normVar(n); if (typeof val === 'number' && n.startsWith('pair_bond_') && val > 100) val = 100; this.S.v[n] = val; }
  capPB() { const v = this.S.v; for (const k in v) if (k.startsWith('pair_bond_') && typeof v[k] === 'number' && v[k] > 100) v[k] = 100; } // v2 批2：pair_bond 上限 100
  met(x) {
    const v = this.S.v;
    if (!v[x + '_met']) return false;
    if (x === 'silas') return !!v.silas_unlocked;
    if (x === 'noa') return !!v.noa_unlocked;
    if (x === 'vex') return !!v.vex_unlocked;
    if (x === 'arno') return !!v.arno_truth;
    return true;
  }
  callFn(f, a) {
    const v = this.S.v;
    switch (f) {
      case 'len': return Array.isArray(a[0]) || typeof a[0] === 'string' ? a[0].length : 0;
      case 'upper': return String(a[0] || '').toUpperCase();
      case 'lower': return String(a[0] || '').toLowerCase();
      case 'has_scene': return !!this.D.scenes[String(a[0])];
      case 'gxpick': { // 情境池：從 n 句裡挑一句，不與上一次同一句（同池不連續重複）
        const key = 'gxp_' + String(a[0]); const nn = Math.max(1, X.num(a[1])); const last = v[key];
        let r = Math.floor(Math.random() * nn); if (nn > 1 && r === last) r = (r + 1 + Math.floor(Math.random() * (nn - 1))) % nn;
        v[key] = r; return r;
      }
      case 'has_event': return !!this.pickEventByTag(String(a[0]));
      case 'zh': return zhNum(a[0]);
      case 'load_after': { // 這場疏導結束後的負荷（與 guideEffects 同一套算法），給事件文字用
        const cur = X.num(v.load); const floor = 5 * Math.max(1, X.num(v.act));
        if (v.guide_ev && v.ev_load0 !== undefined && v.ev_load0 !== '') { // 路線疏導事件：事件自己的降幅與標準降幅取大
          const done = Math.max(0, X.num(v.ev_load0) - cur); const extra = Math.max(0, this.guideRed() - done);
          return Math.max(Math.min(cur, floor), cur - extra);
        }
        return Math.max(Math.min(cur, floor), cur - Math.max(0, this.guideRed()));
      }
      case 'min_pair_bond': { const L = a[0] || []; let m = Infinity; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) m = Math.min(m, X.num(v['pair_bond_' + pairKey(L[i], L[j])])); return m === Infinity ? 0 : m; }
      case 'pair_key': return pairKey(a[0], a[1]);
      case 'yname': { // 這位嚮導現在怎麼叫她（依 addr_<g>_yasi；design/naming.md）
        const g = String(a[0]); const ad = v['addr_' + g + '_yasi'];
        if (g === 'rowan') return ad === 'xiaohai' ? '小海' : ad === 'surname' ? '卡菲希爾' : '亞思';
        if (g === 'cecil') return (ad === 'given' || ad === 'fullname' || ad === 'variable' || v.cecil_calls_name) ? '亞思' : 'A-08';
        if (g === 'elio') return ad === 'nickname' ? '小思' : (ad === 'given' || ad === 'fullname') ? '亞思' : '卡菲希爾';
        if (g === 'orion') return ad === 'nickname' ? '夜鶯' : '亞思';
        if (g === 'noa') return ad === 'nickname_strawberry' ? '草莓' : ad === 'given' ? '亞思' : ad === 'surname' ? '卡菲希爾' : '小姐';
        if (g === 'arno') return '小思';
        return '亞思';
      }
      case 'sname': { // 第 2 期：這位男主現在怎麼叫她（naming.md）
        const x = String(a[0]);
        if (x === 'kael') return v.nickname_kael ? '思' : v.kael_calls_name ? '亞思' : '卡菲希爾';
        if (x === 'ash') return (v.seen_A21 && !v.seen_A22) ? '卡菲希爾' : '雪';
        if (x === 'leo') return v.nickname_leo ? '亞亞' : (v.leo_sulk || !v.seen_L11) ? '前輩' : '亞思前輩';
        if (x === 'silas') return v.nickname_silas ? '小燭' : v.silas_unlocked ? '亞思' : '卡菲希爾小姐';
        if (x === 'vex') return v.nickname_vex ? '小刀' : '署方的小刀';
        if (x === 'arno') return '思思';
        return this.callFn('yname', [x]);
      }
      case 'hname': { // 她現在怎麼叫他（naming.md；退回叫姓的狀態也算）
        const x = String(a[0]);
        if (x === 'kael') return (v.seen_K07a && !v.seen_K10) ? '格雷森' : '凱爾';
        if (x === 'ash') return v.call_name_ash ? '艾許' : '貝克特';
        if (x === 'leo') return v.call_name_leo ? '利奧' : v.seen_L11 ? '艾弗雷特' : '新人';
        if (x === 'silas') return v.call_name_silas ? '塞拉斯' : '處刑官';
        if (x === 'vex') return v.call_name_vex ? '維克斯' : '布萊克莫爾';
        if (x === 'rowan') return v.call_name_rowan ? '洛恩' : '布蘭德';
        if (x === 'cecil') return v.call_name_cecil ? '塞西爾' : '上校';
        if (x === 'elio') return v.call_name_elio ? '艾利歐' : '梅多斯醫官';
        if (x === 'orion') return (v.call_name_orion || v.seen_O13) ? '奧瑞恩' : '諾克斯';
        if (x === 'noa') return v.call_name_noa ? '諾亞' : '老闆';
        if (x === 'arno') return '哥';
        return NAMES[x] || x;
      }
      case 'chance': return Math.random() * 100 < X.num(a[0]);
      case 'vpick': { // 不重複輪替：用完回傳 -1（劇本寫短版或略過）
        const k = 'vp_' + a[0], n = X.num(a[1]); const used = Array.isArray(v[k]) ? v[k] : [];
        const free = []; for (let i = 0; i < n; i++) if (!used.includes(i)) free.push(i);
        if (!free.length) { v[k] = used; return -1; }
        const p = free[Math.floor(Math.random() * free.length)]; used.push(p); v[k] = used; return p;
      }
      case 'vcycle': { // 輪替但不連續重複（用在選項前的提示句）
        const k = 'vc_' + a[0], n = X.num(a[1]); let used = Array.isArray(v[k]) ? v[k] : [];
        if (used.length >= n) used = used.slice(-1);
        const free = []; for (let i = 0; i < n; i++) if (!used.includes(i)) free.push(i);
        const p = free[Math.floor(Math.random() * free.length)]; used.push(p); v[k] = used; return p;
      }
      case 'mb_has': return (v.mb || []).some(c => c.t === a[0]);
      case 'mb_left': { const c = (v.mb || []).find(c => c.t === a[0]); return c ? Math.max(0, c.dl - X.num(v.day)) : 0; }
      case 'mb_txt': { const c = (v.mb || []).find(c => c.t === a[0]); return c ? this.mbText(c) : ''; }
      case 'sload_of': return X.num(v['sload_' + a[0]]);
      case 'gfat_of': return X.num(v['gfat_' + a[0]]);
      case 'able': return this.guidesAble().includes(String(a[0]));
      case 'name': case 'lover_name': return NAMES[a[0]] !== undefined ? NAMES[a[0]] : String(a[0]);
      case 'max_by': { const L = a[0] || []; const k = a[1] || 'aff'; let best = '', bv = -Infinity; for (const x of L) { const s = X.num(v[k + '_' + x]); if (s > bv) { bv = s; best = x; } } return best; }
      case 'top_by_aff': { const L = (a[0] || []).slice(); L.sort((p, q) => X.num(v['aff_' + q]) - X.num(v['aff_' + p])); return L.slice(0, X.num(a[1]) || 1); }
      case 'worst_pair': { const L = a[0] || []; let w = null, wv = Infinity; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const s = X.num(v['pair_bond_' + pairKey(L[i], L[j])]); if (s < wv) { wv = s; w = [L[i], L[j]]; } } return w || []; }
      case 'met': return this.met(String(a[0]));
      case 'unlocked': return this.met(String(a[0])) || !HIDDEN.includes(a[0]);
      case 'color_name': return COLOR_NAME[a[0]] || String(a[0]);
      case 'heart_color': return HEART[a[0]] || '';
      case 'epilogue_scene': return EPILOGUE[a[0]] || '';
      case 'min': return Math.min(...a.map(X.num));
      case 'max': return Math.max(...a.map(X.num));
      case 'abs': return Math.abs(X.num(a[0]));
      case 'int': return Math.floor(X.num(a[0]));
      case 'str': return String(a[0]);
      case '__loc': return this._locCtx ? this._locCtx(a[0]) : (v.cur_loc === a[0]);
      case '__time': { const t = a[0] === 'late' ? 'late_night' : a[0]; if (this._timeCtx) return this._timeCtx.includes(t); return v.time === t; }
      case '__gi': return [v.g1, v.g2, v.anchor].includes(a[0]);
      case '__dop': return false;
    }
    this.err('unknown function ' + f);
    return false;
  }
  ev(s) { try { return X.evaluate(s, this.ctx); } catch (e) { this.err('expr: ' + s + ' :: ' + e.message); return false; } }
  cond(s) { return s == null ? true : X.truthy(this.ev(s)); }
  interp(t) {
    if (!t || t.indexOf('{') < 0) return t;
    return t.replace(/\{([^{}]+)\}/g, (m, e) => {
      const r = this.ev(e);
      if (Array.isArray(r)) return r.map(x => NAMES[x] || x).join('、');
      return r === undefined || r === false ? '' : String(r);
    });
  }
  interpText(t) { // in displayed text, bare ids become names
    if (!t || t.indexOf('{') < 0) return t;
    return t.replace(/\{([^{}]+)\}/g, (m, e) => {
      const r = this.ev(e);
      if (Array.isArray(r)) return r.map(x => NAMES[x] || x).join('、');
      if (typeof r === 'string' && NAMES[r]) return NAMES[r];
      return r === undefined || r === false ? '' : String(r);
    });
  }
  interpId(t) { // ids like END_{upper(x)}_SOLO / {g1}
    if (!t || t.indexOf('{') < 0) return t;
    return t.replace(/\{([^{}]+)\}/g, (m, e) => { const r = this.ev(e); return r === undefined || r === false ? '' : String(r); });
  }
  err(m) { const f = this.S && this.S.stack.length ? this.S.stack[this.S.stack.length - 1] : null; const w = f ? f.s + ':' + f.pc : '-'; this.errors.push(w + ' ' + m); if (this.ui.onError) this.ui.onError(w + ' ' + m); }
  code(sid) { const s = this.D.scenes[sid]; return s ? s.code : (this.S.synth[sid] || null); }
  // ---------- frames ----------
  push(sid) {
    if (!this.code(sid)) { this.err('missing scene ' + sid); return false; }
    this.S.stack.push({ s: sid, pc: 0, loops: [] });
    const sc = this.D.scenes[sid];
    if (sc && sc.date) this.applyDate(sc.date);
    return true;
  }
  markSeen(sid) { if (this.D.scenes[sid]) { this.setVar('seen_' + sid, true); } }
  finishFrame() {
    const f = this.S.stack.pop();
    this.markSeen(f.s);
    this.afterScene(f.s, this.S.stack.length === 0);
  }
  afterScene(sid, top) {
    const v = this.S.v;
    if (sid === 'GUIDE_DAILY' && v.g1 && v.g2) this.guideEffects();
    this.capPB();
    { const m = /^SO_([A-Z]+)_([A-Z]+)_\d+$/.exec(sid); if (m) { const s1 = m[2].toLowerCase(), s2 = m[1].toLowerCase(); const x = SENTINELS.includes(s1) ? s1 : SENTINELS.includes(s2) ? s2 : ''; if (x) v['sload_' + x] = Math.max(0, X.num(v['sload_' + x]) - 25); } }
    const sc = this.D.scenes[sid];
    if (sc && sc.lead && !(sid in this.mainIndex) && LEADS.includes(sc.lead)) {
      this.seenLead(sc.lead);
      if (SENTINELS.includes(sc.lead) && !this.purify.has(sid) && !/^(NEGLECT_|CONTACT_|PATROL|PLACE_)/.test(sid)) this.contactProgress(sc.lead, 1);
    }
    // (2026-10-26) Engine bond stopgap removed: script milestones supply bond_X (FORMAT §H).
    if (sid === 'EVE_TOGETHER') {
      const L = v.eve_lovers || []; const b = X.num(v.eve_pair_bonus) || 3;
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const k = 'pair_bond_' + pairKey(L[i], L[j]); v[k] = X.num(v[k]) + b; }
    }
    if (top && sid in this.mainIndex) {
      // after= hooks
      const hooks = this.events.filter(e => e.s.slotd && e.s.slotd.after === sid && !e.s.slotd.time && !e.s.slotd.loc && !this.getVar('seen_' + e.id) && this.whenOK(e, {}));
      hooks.sort((a, b) => b.s.prio - a.s.prio);
      for (const h of hooks.reverse()) this.S.queue.unshift({ t: 'scene', id: h.id });
    }
  }
  guideEffects() {
    const v = this.S.v; const g1 = v.g1, g2 = v.g2; const k = pairKey(g1, g2);
    // guide-context route events (g1/g2/anchor based), evaluated with pre-guiding load
    // v2 批4：v2 疏導沒有設 guide_pair → 舊的組合事件從來不會觸發。兩種順序都試。
    // 2026-10-30：疏導情境的路線事件改在 guideStage 裡「取代」當天的 GX（不再排到深夜變成第二場疏導）。
    // 這裡只排「疏導結束後」的事件（GUIDE_AFTER，例：半夜廚房），而且只看主導＋在場的實際順序。
    v.guide_pair = g1 + '_' + g2;
    const aft = this.pickEvent(e => GUIDE_AFTER.has(e.id) && e.s.whenx && !/window ==/.test(e.s.whenx), {});
    if (aft) this.S.queue.unshift({ t: 'scene', id: aft.id });
    const st1 = X.num(v['gstage_' + g1]), st2 = X.num(v['gstage_' + g2]);
    const fresh = !!v.gs_new;
    let a1 = fresh ? 3 : 2; const b1 = fresh ? 2 : 1;
    if (g1 === 'cecil' && st1 < 3) a1 -= 1; // 塞西爾：負面起點，第 3 階前增益減半
    v['aff_' + g1] = Math.min(100, X.num(v['aff_' + g1]) + a1);
    v['bond_' + g1] = Math.min(100, X.num(v['bond_' + g1]) + b1);
    if (st2 >= 3) v['aff_' + g2] = Math.min(100, X.num(v['aff_' + g2]) + 1); else v['jealousy_' + g2] = X.num(v['jealousy_' + g2]) + 1;
    if (g2 === 'arno' && v.arno_truth) v.bond_arno = Math.min(100, X.num(v.bond_arno) + 1); // 家人疏導：在場也算陪伴
    v['pair_bond_' + k] = X.num(v['pair_bond_' + k]) + 1;
    v['pair_sync_' + k] = X.num(v['pair_sync_' + k]) + 3;
    let red = this.guideRed();
    // 新版：嚮導的疲勞。主導 +12、在場 +6；她要求走深，兩個人都再 +8，降幅 +10
    v['gfat_' + g1] = Math.min(100, X.num(v['gfat_' + g1]) + 12 + (v.gd_deep ? 8 : 0));
    v['gfat_' + g2] = Math.min(100, X.num(v['gfat_' + g2]) + 6 + (v.gd_deep ? 8 : 0));
    if (X.num(v['gfat_' + g1]) >= 55) v['gf_noticed_' + g1] = true;
    if (v.gd_deep) { red += 10; v.deep_day = v.day; }
    v.gd_deep = false;
    // 2026-10-30：取代 GX 的路線疏導事件自己會 @set load -=。那就是這一場的降幅，不再額外疊一次標準降幅（總降幅＝兩者取大）。
    if (v.guide_ev && v.ev_load0 !== undefined && v.ev_load0 !== '') { const done = X.num(v.ev_load0) - X.num(v.load); if (done > 0) red = Math.max(0, red - done); }
    v.ev_load0 = '';
    // 第一幕的嚮導藥：身體以為嚮導隨時都在，真正的疏導反而進不深。疏導 6 次後清掉（PILL_CLEAR）。
    if (v.pill_dependence) { v.pill_dep_n = X.num(v.pill_dep_n) + 1; if (v.pill_dep_n >= 6) { v.pill_dependence = false; v.pill_dep_cleared = true; const qi = this.S.queue.findIndex(q => q.t !== 'scene'); this.S.queue.splice(qi < 0 ? this.S.queue.length : qi, 0, { t: 'scene', id: 'PILL_CLEAR' }); } }
    // 殘響底線：日常疏導降不到底線以下（底線隨幕數上升；緊急疏導／加入場不受限）
    const cur = X.num(v.load); const floor = 5 * Math.max(1, X.num(v.act));
    this.setLoad(Math.max(Math.min(cur, floor), cur - Math.max(0, red)), true);
    v['last_lead_' + g1] = v.day; this.seenLead(g1); this.seenLead(g2);
    v.guided_day = v.day;
    if (g1 === 'rowan') v.rowan_lead_count = X.num(v.rowan_lead_count) + 1;
    if (this.getVar('week') === 3 && (g1 === 'cecil' || g2 === 'cecil')) v.cecil_in_guide_w3 = true;
    if (v.seen_K10a && v.sent_in === 'kael') v.anchor_count_kael_after_K10a = X.num(v.anchor_count_kael_after_K10a) + 1;
    if (v.kael_romance_lock && X.num(v.aff_kael) > 19) v.aff_kael = 19;
  }
  guideRed() {
    const v = this.S.v; const st1 = X.num(v['gstage_' + v.g1]), st2 = X.num(v['gstage_' + v.g2]);
    let red = 12 + 2 * st1 + Math.floor(st2 / 2);
    if (weatherOf(v.day) === 'rain') red -= 4;
    if (v.anchor_refused) red = Math.floor(red / 2);
    if (v.pill_dependence) red -= 3;
    return red;
  }
  // ---------- v2: stages, presence, load, neglect ----------
  stageCan(x, next, kind) {
    const v = this.S.v; if (next > 8) return false;
    const aff = X.num(v['aff_' + x]); const load = X.num(v.load);
    if (next > 1 && aff < STAGE_T[next]) return false;
    if (next >= 5 && load >= 90) return false;
    if (next >= 6 && load >= 70) return false;
    const conf = v['confessed_' + x] || (CONF_SEEN[x] && v['seen_' + CONF_SEEN[x]]);
    if (next >= 7 && !(conf || aff >= 55)) return false;
    if (next >= 8 && !(conf && aff >= 60 && load < 70)) return false;
    if (next >= 8 && kind === 's' && !this._mxNight) return false; // 第 2 期：哨兵第 8 階只在任務夜（MX）發生，有合理的理由 // 第 3 批：第 8 階＝告白後、aff≥60、負荷<70
    if (kind === 'g' && x === 'arno') return false;
    if (x === 'kael' && v.kael_romance_lock && next >= 5) return false;
    return true;
  }
  guideStage(quiet) {
    const v = this.S.v; const g = v.g1; const cur = X.num(v['gstage_' + g]);
    let n = cur, fresh = false;
    v['gprog_' + g] = X.num(v['gprog_' + g]) + 1;
    if (cur >= 1 && X.num(v['gprog_' + g]) >= 3 && this.stageCan(g, cur + 1, 'g')) { n = cur + 1; fresh = true; v['gstage_' + g] = n; v['gprog_' + g] = 0; }
    if (!n) { n = 1; fresh = true; v['gstage_' + g] = 1; v['gprog_' + g] = 0; }
    v.gs_n = n; v.gs_new = fresh; v.gs_band = n >= 5 ? 'high' : n >= 3 ? 'mid' : 'low';
    v.guide_ev = '';
    if (quiet && !fresh) return;
    if (!fresh) {
      // 路線的疏導事件（RX/EX/AX…）＝這一場疏導本身：取代 GX，不另外加一場。只用實際的主導_在場順序判定。
      if (!v.sent_pre) this.sentinelPick();
      v.guide_pair = v.g1 + '_' + v.g2;
      let ev = this.pickEvent(e => e.s.whenx && GUIDE_REFS.test(e.s.whenx) && !GUIDE_AFTER.has(e.id) && !/window ==|guide_tag ==|guide_mode ==/.test(e.s.whenx), {});
      if (!ev) { // 新版：疏導情境的重要劇情只差負荷 → 她今天其實很糟（橋接）
        for (const e of this.events) {
          if (!V2_KEY.includes(e.id) || !e.s.whenx || !GUIDE_REFS.test(e.s.whenx) || this.getVar('seen_' + e.id) || v['__started_' + e.id]) continue;
          if (/window ==|guide_tag ==|guide_mode ==/.test(e.s.whenx) || !this.slotOK(e, {})) continue;
          const b = this.bridgeNeed(e, {}); if (!b) continue;
          ev = e; v.br_need = b.need; v.br_dir = b.dir; v.gd_bridge = true; break;
        }
      }
      if (ev) {
        v.guide_ev = ev.id; v.pair_event_played = true; v.ev_load0 = X.num(v.load);
        if (/sent_in/.test(ev.s.whenx)) v.sent_shown = true;
        // 路線事件本身寫了守夜哨兵（AX04：艾許守夜…）→ 今天在場的哨兵就是他，不再另外播 SENT_PRESENCE
        const sl = this.D.scenes[ev.id] && this.D.scenes[ev.id].lead;
        if (sl && SENTINELS.includes(sl) && sl !== v.g1 && sl !== v.g2) { v.sent_in = sl; v.sent_mode = 'stay'; v.sent_shown = true; v['sent_last_' + sl] = v.day; }
        v.wx_pending = ''; this.push(ev.id);
        if (v.gd_bridge) { v.gd_bridge = false; this.push('GD_BRIDGE'); }
        return;
      }
    }
    this.wxPeek();
    const G = g.toUpperCase();
    let id;
    if (fresh) id = this.D.scenes['GS_' + G + '_' + n] ? 'GS_' + G + '_' + n : 'GUIDE_STAGE_GENERIC';
    else {
      // GX：每次疏導都是新的一段（同一位嚮導的連續劇情）；用完後改走 GXF_ 情境組合池
      // 情境層（GX_OPEN 讀）：距上次由他主疏導幾天、隔天早上、被冷落、巡邏日、輪替序號
      v.gx_gap = v['gx_lastday_' + g] === undefined ? 0 : X.num(v.day) - X.num(v['gx_lastday_' + g]); v['gx_lastday_' + g] = v.day;
      v.gx_ma = v.ma_x === g && X.num(v.ma_day) === X.num(v.day) - 1;
      v.gx_mab = !v.gx_ma && v.ma_by === g && X.num(v.ma_day) === X.num(v.day) - 1;
      v.gx_seek = !!v['seek_' + g];
      v.gx_patrol = X.num(v.patrol_day) === X.num(v.day) && X.num(v.day) > 0;
      v.gx_k = X.num(v['gx_n_' + g]) % 3; v.gx_odd = X.num(v['gx_n_' + g]) % 2;
      id = this.gxNext(g, n);
      if (!id) id = this.D.scenes['GXF_' + G] ? 'GXF_' + G : this.D.scenes['GR_' + G + '_' + v.gs_band] ? 'GR_' + G + '_' + v.gs_band : 'GUIDE_STAGE_GENERIC';
      v.gx_tick = X.num(v.gx_tick) + 1; v.gx_cur = id; v['gx_last_' + g] = id;
      v['gx_n_' + g] = X.num(v['gx_n_' + g]) + 1;
    }
    this.push(id);
  }
  gxList(g) {
    if (!this._gx) this._gx = {};
    if (!this._gx[g]) {
      const re = new RegExp('^GX_' + g.toUpperCase() + '_(\\d+)$');
      this._gx[g] = Object.entries(this.D.scenes).filter(([id, s]) => s.gx && re.test(id))
        .map(([id, s]) => ({ id, k: +id.match(re)[1], gx: s.gx })).sort((a, b) => a.k - b.k);
    }
    return this._gx[g];
  }
  gxNext(g, n) {
    const v = this.S.v;
    for (const e of this.gxList(g)) {
      if (v['gxs_' + e.id]) continue;
      if (n < e.gx.min || n > e.gx.max) continue;
      if (e.gx.req && !this.cond(e.gx.req)) continue;
      v['gxs_' + e.id] = true; v['gx_' + g] = X.num(v['gx_' + g]) + 1;
      return e.id;
    }
    return null;
  }
  // ---------- 第 2 期：任務弧（MX_<S>_k，用 @gx min max req；min/max＝接觸階段 cstage） ----------
  mxList(x) {
    if (!this._mx) this._mx = {};
    if (!this._mx[x]) {
      const re = new RegExp('^MX_' + x.toUpperCase() + '_(\\d+)$');
      this._mx[x] = Object.entries(this.D.scenes).filter(([id, s]) => s.gx && re.test(id))
        .map(([id, s]) => ({ id, k: +id.match(re)[1], gx: s.gx })).sort((a, b) => a.k - b.k);
    }
    return this._mx[x];
  }
  mxBeat(x) {
    const v = this.S.v; const X_ = x.toUpperCase(); const n = X.num(v['cstage_' + x]) || 1;
    v.mx_gap = v['mx_lastday_' + x] === undefined ? 0 : X.num(v.day) - X.num(v['mx_lastday_' + x]);
    v['mx_lastday_' + x] = v.day;
    v.mx_k = X.num(v['mx_n_' + x]) % 3; v.mx_odd = X.num(v['mx_n_' + x]) % 2;
    v.mx_ma = v.ma_x === x && X.num(v.ma_day) >= X.num(v.day) - 2;
    v.mx_hurt_prev = X.num(v['injury_' + x]) > 0;
    let id = null;
    for (const e of this.mxList(x)) {
      if (v['mxs_' + e.id]) continue;
      if (n < e.gx.min || n > e.gx.max) continue;
      if (e.gx.req && !this.cond(e.gx.req)) continue;
      v['mxs_' + e.id] = true; v['mx_' + x] = X.num(v['mx_' + x]) + 1; id = e.id; break;
    }
    if (!id) id = this.D.scenes['MXF_' + X_] ? 'MXF_' + X_ : null;
    v.mx_cur = id || ''; v['mx_n_' + x] = X.num(v['mx_n_' + x]) + 1;
    if (id) this.push(id);
  }
  guideWatch() {
    const v = this.S.v; const g1 = v.g1, g2 = v.g2;
    const st1 = X.num(v['gstage_' + g1]), st2 = X.num(v['gstage_' + g2]);
    v.watch_band = st2 >= 6 ? 'deep' : st2 >= 3 ? 'mid' : 'shallow';
    const load = X.num(v.load);
    v.join_try = g2 !== 'arno' && g1 !== 'arno' && st2 >= 3 && X.num(v['aff_' + g2]) >= 25 && load >= 50 && load < 90 && Math.random() * 100 < 15 + 5 * (st2 - 3);
    v.join_deep = !!(v.join_try && st1 >= 6 && st2 >= 6);
    // 2026-10-30：旁觀也是連續劇情。每一組「主導→在場」有自己的 WX_<G1>_<G2>_k 鏈（吃醋→同盟→告白→同意→三人），
    // 依序播、不重複；鏈用完（或這一階段還沒有能播的）才回到 WATCH_<band> 變體池。路線疏導事件那天仍跳過旁觀（只做加入判定）。
    if (!v.guide_ev) {
      if (v.wx_pending === undefined || v.wx_day !== v.day) this.wxPeek();
      const id = v.wx_pending;
      if (id && this.D.scenes[id]) {
        v['wxs_' + id] = true; const k = 'wx_n_' + g1 + '_' + g2; v[k] = X.num(v[k]) + 1; v.wx_cur = id; v.wx_pending = '';
        v.join_try = false; v.join_deep = false; // 鏈裡的伸手／三人由劇情自己寫
        this.push(id); return;
      }
    }
    v.wx_cur = '';
    this.push('WATCH_' + v.watch_band.toUpperCase());
  }
  wxList(g1, g2) {
    if (!this._wx) this._wx = {};
    const key = g1 + '_' + g2;
    if (!this._wx[key]) {
      const re = new RegExp('^WX_' + g1.toUpperCase() + '_' + g2.toUpperCase() + '_(\\d+)$');
      this._wx[key] = Object.entries(this.D.scenes).filter(([id, s]) => re.test(id))
        .map(([id, s]) => ({ id, k: +id.match(re)[1], gx: s.gx || { min: 0, max: 8, req: '' } })).sort((a, b) => a.k - b.k);
    }
    return this._wx[key];
  }
  wxPhase(a, b) { // 這一組走到哪：有 PB 場的組合＝pbeat；沒有的（諾亞＋奧瑞恩）已同意＝4，否則看 pair_bond。
    const v = this.S.v; const k = pairKey(a, b);
    // 有 PB 場的組合只看 pbeat（同意若來自 JOIN_DEEP 而 PB 還沒播，旁觀段不能先引用 PB 的內容）
    if (this.D.scenes['PB_' + k.toUpperCase() + '_1']) return X.num(v['pbeat_' + k]);
    if (v['consent_' + k]) return 4;
    const pb = X.num(v['pair_bond_' + k]); return pb >= 20 ? 3 : pb >= 12 ? 2 : pb >= 5 ? 1 : 0;
  }
  wxPeek() { // 在 GX 開場前先決定今天的旁觀段（有的話 GX_PAIR 那一行就不播，避免同一個人講兩次）
    const v = this.S.v; const g1 = v.g1, g2 = v.g2; v.wx_pending = ''; v.wx_day = v.day;
    if (!g1 || !g2 || g1 === g2) return '';
    v.wx_ph = this.wxPhase(g1, g2); v.wx_k = pairKey(g1, g2);
    v.wx_ma = v.ma_x === g2 && X.num(v.ma_day) === X.num(v.day) - 1; v.wx_seek = !!v['seek_' + g2];
    const st2 = X.num(v['gstage_' + g2]);
    for (const e of this.wxList(g1, g2)) {
      if (v['wxs_' + e.id]) continue;
      if (st2 < e.gx.min || st2 > e.gx.max) continue;
      if (e.gx.req && !this.cond(e.gx.req)) continue;
      v.wx_pending = e.id; return e.id;
    }
    return '';
  }
  sentinelPresence() {
    const v = this.S.v;
    if (!v.sent_pre) this.sentinelPick();
    const who = v.sent_in; v.sent_pre = false;
    if (who && !v.sent_shown) this.push('SENT_PRESENCE');
    v.sent_shown = false;
  }
  sentinelPick() {
    const v = this.S.v; const g1 = v.g1; const load = X.num(v.load); v.sent_pre = true;
    const met = SENTINELS.filter(x => this.met(x) || (x === 'kael'));
    // v2 批3：輪流——好幾天沒來的人優先，再比好感（避免永遠是同一個哨兵）
    const due = (x) => (v['sent_last_' + x] === undefined || X.num(v.day) - X.num(v['sent_last_' + x]) >= 4) ? 1 : 0;
    const byAff = (L) => L.sort((p, q) => (due(q) - due(p)) || (X.num(v['aff_' + q]) - X.num(v['aff_' + p])))[0] || '';
    let who = '', mode = '';
    who = byAff(met.filter(x => X.num(v['cstage_' + x]) >= 5 && (v['consent_' + pairKey(g1, x)] || X.num(v['pair_bond_' + pairKey(g1, x)]) >= 18)));
    if (who) mode = 'stay';
    // v2 批3：留下的人已經連著來了，而另一個哨兵好幾天沒見到她——今天換他在門口等
    if (who && !due(who)) { const o = byAff(met.filter(x => x !== who && due(x) && X.num(v['aff_' + x]) >= 40 && X.num(v['cstage_' + x]) >= 4)); if (o) { who = o; mode = 'door'; } }
    if (!who && v.mission_partner && v.mission_partner_day === v.day && X.num(v['sload_' + v.mission_partner]) >= 60) { who = v.mission_partner; mode = 'order'; }
    if (!who) { who = byAff(met.filter(x => X.num(v['aff_' + x]) >= 25 && (load >= 70 || v.fought_day === v.day || v['quarrel_day_' + x] === v.day || (X.num(v['aff_' + x]) >= 40 && X.num(v['cstage_' + x]) >= 4 && due(x))))); if (who) mode = 'door'; }
    v.sent_in = who; v.sent_mode = mode; // v2 批4：哨兵只能在場／守門，不能當錨（anchor 只給嚮導）
    if (who) { v['sent_last_' + who] = v.day; this.seenLead(who); }
  }
  contactProgress(x, n) {
    const v = this.S.v; if (!SENTINELS.includes(x)) return;
    if (!X.num(v['cstage_' + x])) v['cstage_' + x] = 1;
    v['cprog_' + x] = X.num(v['cprog_' + x]) + (n || 1);
    const next = X.num(v['cstage_' + x]) + 1;
    if (X.num(v['cprog_' + x]) >= 2 && this.stageCan(x, next, 's')) {
      v['cstage_' + x] = next; v['cprog_' + x] = 0; v.cs_who = x; v.cs_n = next;
      const id = 'CS_' + x.toUpperCase() + '_' + next;
      this.push(this.D.scenes[id] ? id : 'CONTACT_STAGE');
    }
  }
  seenLead(x) {
    const v = this.S.v; if (!LEADS.includes(x)) return;
    v['last_seen_' + x] = v.day; v['neglect_tier_' + x] = 0;
  }
  inPurify() { return this.S.stack.some(f => this.purify.has(f.s)); }
  setLoad(n, ctxOK) {
    const v = this.S.v; const prev = X.num(v.load);
    n = Math.max(0, Math.min(LOAD_MAX, Math.round(X.num(n))));
    v.load = n;
    if (n > prev) this.loadCross(prev, n, ctxOK);
    this.ui.gauge && this.ui.gauge(this.S);
  }
  loadCross(prev, n, force) {
    const v = this.S.v; if (X.num(v.day) < 1) return;
    const inMain = !force && this.S.stack.length && (this.S.stack[0].s in this.mainIndex);
    let T = 0; for (const t of [70, 90, 100]) if (prev < t && n >= t) T = t;
    if (!T) return;
    if (T === 100 && !inMain && v.act2_guiding_unlocked) v.overdraw_count = X.num(v.overdraw_count) + 1;
    // 第一幕（新團到任前）：主線裡她自己勉強到九十／一百，也一定要有人來拉（EARLY_OVERLOAD）；其餘主線自己寫了失控
    const early = !v.flag_new_team_arrived && !v.act2_guiding_unlocked;
    if (inMain && !(early && T >= 90)) return;
    if (v['load_ev_' + T] === v.day) return;
    v['load_ev_' + T] = v.day;
    v.load_pending = Math.max(X.num(v.load_pending), T);
    if (!this.S.queue.some(q => q.id === 'LOAD_CHECK')) this.S.queue.unshift({ t: 'scene', id: 'LOAD_CHECK', force: true });
  }
  onNewDay(d) {
    const v = this.S.v;
    if (d <= X.num(v.last_drift_day)) return;
    v.last_drift_day = d;
    if (d >= 1) v.kael_met = true;
    if (Math.floor(d / 7) !== X.num(v.orion_wk_id)) { v.orion_wk_id = Math.floor(d / 7); v.orion_week = 0; } // 奧瑞恩：每週最多兩次
    for (const x of LEADS) if (this.met(x) || (x === 'kael' && d >= 1)) { if (SENTINELS.includes(x) && !X.num(v['cstage_' + x])) v['cstage_' + x] = 1; if (v['last_seen_' + x] === undefined) v['last_seen_' + x] = d; }
    if (d >= 2) {
      let up = v.act2_guiding_unlocked ? (isDayOff(d) ? 2 : 4) + Math.floor(X.num(v.act) / 2) : 1 + (v.pill_dependence ? 1 : 0); // 第一幕：停勤＋加量的抑制劑，每天只漲 1；吃過嚮導藥（pill_dependence）會反彈，每天 2。過載只會來自她自己勉強（推感官的選項）
      up -= Math.min(3, Math.floor(X.num(v.steady) / 10));
      if (LEADS.some(x => X.num(v['gstage_' + x]) >= 6 || X.num(v['cstage_' + x]) >= 6)) up -= 1;
      if (v.pill_day === d) up -= 3;
      if (up > 0) this.setLoad(X.num(v.load) + up, true);
      // 第一幕：休息日後勤嚮導例行梳理（不留羈絆，只把負荷壓回 40 左右）
      if (!v.act2_guiding_unlocked && isDayOff(d) && X.num(v.load) > 40) this.setLoad(Math.max(40, X.num(v.load) - 15), true);
    }
    v.steady = Math.max(0, X.num(v.steady) - 1);
    // 新版：男人的負荷。哨兵每天自己退一點（只有兩位嚮導的疏導才會大幅降）；嚮導的疲勞睡一晚退 10。
    for (const x of SENTINELS) { const s0 = X.num(v['sload_' + x]); if (s0 > 0) v['sload_' + x] = Math.max(0, s0 - 3); if (X.num(v['sload_' + x]) < 50) v['sl_noticed_' + x] = false; }
    for (const g of GUIDES) { const f0 = X.num(v['gfat_' + g]); if (f0 > 0) v['gfat_' + g] = Math.max(0, f0 - 10); if (X.num(v['gfat_' + g]) < 50) v['gf_noticed_' + g] = false; }
    if (X.num(v.deep_day) === d - 1 && d >= 2) this.setLoad(X.num(v.load) + 2, true); // 走深的隔天，殘響比較重
    // 冷落
    v.neglect_who = ''; v.neglect_tier = 0;
    let best = '', bt = 0, ba = -1;
    for (const x of LEADS) {
      if (!this.met(x) || X.num(v['aff_' + x]) < 15) continue;
      if (x === 'kael' && v.kael_romance_lock) continue;
      if (v['seek_' + x]) {
        if (d - X.num(v['seek_day_' + x]) > 3) { v['seek_' + x] = false; v['aff_' + x] = Math.max(0, X.num(v['aff_' + x]) - 2); v['jealousy_' + x] = X.num(v['jealousy_' + x]) + 2; v['seek_missed_' + x] = X.num(v['seek_missed_' + x]) + 1; }
        continue;
      }
      const gap = d - X.num(v['last_seen_' + x]); const t = X.num(v['neglect_tier_' + x]);
      let tier = 0; if (gap > 18 && t === 1) tier = 2; else if (gap > 10 && t === 0) tier = 1;
      if (tier && X.num(v['aff_' + x]) > ba) { best = x; bt = tier; ba = X.num(v['aff_' + x]); }
    }
    if (best) { v.neglect_who = best; v.neglect_tier = bt; v['neglect_tier_' + best] = bt; }
  }
  dayCode(d, rest) {
    const v = this.S.v; const off = isDayOff(d);
    const guides = ['rowan', 'cecil', 'elio', 'orion'].some(x => v[x + '_met']) && !!v.act2_guiding_unlocked;
    const patrol = !off && this.getVar('week') >= 2 && [2, 4].includes(d % 7) && SENTINELS.some(x => this.met(x));
    const code = [];
    if (v.neglect_who) { const id = 'NEGLECT_' + v.neglect_who.toUpperCase() + '_' + v.neglect_tier; code.push(['call', this.D.scenes[id] ? id : 'NEGLECT_GENERIC']); }
    code.push(['call', 'LOAD_CHECK']);
    // 新版：一天三個時段（白天／傍晚／夜），每個時段由她自己選要做什麼。任務從任務板接、疏導是選項。
    v.slot_rest = !!rest; void patrol;
    if (off) code.push(['cmd', 'freetime', 'day_off', 0]);
    else code.push(['cmd', 'slot', 'day', 0]);
    code.push(['call', 'LOAD_CHECK']);
    if (guides && !off) code.push(['cmd', 'slot', 'eve', 0]);
    if (off && FEST[d] && this.D.scenes['FEST_' + FEST[d]] && !v['seen_FEST_' + FEST[d]] && !rest) code.push(['call', 'FEST_' + FEST[d]]);
    code.push(['cmd', 'slot', isDayOff(d + 1) ? 'night_eve' : 'night', 0]);
    code.push(['call', 'LOAD_CHECK']);
    code.push(['cmd', 'msg_pick', '', 0]);
    code.push(['call', 'LAMP_RITUAL']);
    return code;
  }
  // ---------- event selection ----------
  slotOK(e, o) {
    const sd = e.s.slotd; if (!sd) return true;
    const wk = this.getVar('week'); const d = this.S.v.day;
    if (sd.w0 !== undefined) { if (wk < sd.w0) return false; if (!o.ignoreLate && wk > this.lateWeek(e)) return false; }
    if (typeof sd.day === 'number' && d < sd.day) return false;
    if (typeof sd.act === 'number' && X.num(this.S.v.act) < sd.act) return false;
    if (sd.after && !this.getVar('seen_' + sd.after)) return false;
    if (sd.before && this.getVar('seen_' + sd.before)) return false;
    if (o.times && sd.time && !o.times.includes(sd.time)) return false;
    return true;
  }
  lateWeek(e) { // 新版：事件在自己那一幕結束前都不會過期；重要劇情再多兩週
    const sd = e.s.slotd; if (!sd || sd.w1 === undefined) return 99;
    const a = actOfWeek(sd.w1); let L = Math.max(sd.w1 + 2, ACT_END_WEEK[a]);
    if (V2_KEY.includes(e.id)) L = Math.max(L, Math.min(17, ACT_END_WEEK[a] + 2));
    return L;
  }
  overdue(e) { const sd = e.s.slotd; return !!(sd && sd.w1 !== undefined && this.getVar('week') > sd.w1); }
  whenOK(e, o) {
    if (!e.s.whenx) return true;
    const saveT = this._timeCtx, saveL = this._locCtx, saveW = this.S.v.window, saveWk = this._weekCtx;
    this._timeCtx = o.times || null; this._locCtx = () => true;
    // 新版：劇本裡的「week == N」以事件自己的週窗夾住判斷（晚一點去找他，劇情還在）
    const sd = e.s.slotd;
    if (sd && sd.w0 !== undefined && sd.w1 !== undefined) { const wk = this.getVar('week'); if (wk > sd.w1) this._weekCtx = sd.w1; }
    if (o.window !== undefined) this.S.v.window = o.window;
    try { return this.cond(e.s.whenx); } finally { this._timeCtx = saveT; this._locCtx = saveL; this.S.v.window = saveW; this._weekCtx = saveWk; }
  }
  // 負荷橋接：重要劇情只差負荷條件時，回傳需要的負荷值（否則 null）
  bridgeNeed(e, o) {
    if (!V2_KEY.includes(e.id) || !e.s.whenx) return null;
    const m = /\bload\s*(>=|>|<=|<)\s*(\d+)/.exec(e.s.whenx); if (!m) return null;
    let need = Number(m[2]); if (m[1] === '>') need += 1; if (m[1] === '<') need -= 1;
    this._loadCtx = need;
    try { return this.whenOK(e, o) ? { need, dir: m[1][0] === '>' ? 'up' : 'down' } : null; } finally { this._loadCtx = null; }
  }
  pickEvent(filter, o) {
    let best = null;
    for (const e of this.events) {
      if (this.getVar('seen_' + e.id) || (this.S.v['__started_' + e.id])) continue;
      if (!filter(e)) continue;
      if (!this.slotOK(e, o) || !this.whenOK(e, o)) continue;
      if (!best || e.s.prio > best.s.prio) best = e;
    }
    return best;
  }
  pickEventByTag(tag) {
    const m = /^(\w+)=(.*)$/.exec(tag); if (!m) return null;
    const key = m[1];
    return this.pickEvent(e => e.s.whenx && e.s.whenx.includes(key), {});
  }
  candidates(times, window) {
    const out = [];
    for (const e of this.events) {
      const s = e.s;
      if (this.getVar('seen_' + e.id)) continue;
      if (/^(EVE_|NIGHT_OF_COLORS|THREE_|END_|FATE_|MULTI|HAREM)/.test(e.id) && !(s.whenx && s.whenx.includes('window =='))) continue;
      const wx = s.whenx || '';
      if (GUIDE_REFS.test(wx)) continue;
      const hasWin = /window ==/.test(wx);
      if (window) { if (!wx.includes('"' + window + '"') && !(window === 'day_off' && !hasWin && s.slotd && (s.slotd.loc || s.slotd.time))) continue; }
      else if (hasWin) continue;
      if (s.slotd && s.slotd.after && !s.slotd.time && !s.slotd.loc && !s.slotd.w0 && !this.getVar('seen_' + s.slotd.after)) continue; // pure after-hooks（新版：主線看過後留在他身邊等她）
      if (s.slotd && s.slotd.before) continue;
      if (!s.slotd && !wx) continue;
      if (!s.slotd && !window && !/__loc|__time/.test(wx)) continue; // condition-only events need a place/time hook
      if (!this.slotOK(e, { times })) continue;
      if (!this.whenOK(e, { times, window: window || this.S.v.window })) {
        if (!this._bridgeOK) continue;
        const b = this.bridgeNeed(e, { times, window: window || this.S.v.window }); if (!b) continue;
        this._bridges[e.id] = b;
      }
      out.push(e);
    }
    return out;
  }
  // ---------- date ----------
  applyDate(dt) {
    const v = this.S.v;
    if (dt.day !== undefined) {
      const nd = dt.day !== v.day && dt.day > X.num(v.day);
      if (dt.day !== v.day) { if (weatherOf(dt.day) === 'rain') v.rain_day_count = X.num(v.rain_day_count) + 1; }
      v.day = dt.day;
      if (nd) this.onNewDay(dt.day);
    }
    if (dt.time) v.time = dt.time;
    v.window = dt.day_off ? 'day_off' : '';
  }
  // ---------- scheduler ----------
  async schedule() {
    const S = this.S;
    if (S.ended) return false;
    while (S.queue.length) {
      const t = S.queue.shift();
      if (t.t === 'scene') { if (!this.getVar('seen_' + t.id) || t.force) { if (this.push(t.id)) return true; } continue; }
      if (t.t === 'main') { this.startMain(t.id); return true; }
      if (t.t === 'day') { if (this.startDay(t.d)) return true; continue; }
      if (t.t === 'fallback') { S.fallback = true; continue; }
    }
    // next main scene
    const O = this.D.order; let i = S.cursor + 1; let id = null;
    for (; i < O.length; i++) {
      const c = O[i];
      if (this.getVar('seen_' + c)) continue;
      if (/_/.test(c)) { if (S.fallback && this.isFallbackFor(c)) { id = c; break; } continue; }
      id = c; break;
    }
    S.fallback = false;
    if (!id) { S.ended = true; return false; }
    const sc = this.D.scenes[id];
    const target = sc.date && sc.date.day;
    if (target !== undefined && target > S.v.day + 1 && S.v.day >= 1) {
      for (let d = S.v.day + 1; d < target; d++) S.queue.push({ t: 'day', d });
    }
    S.queue.push({ t: 'main', id });
    return this.schedule();
  }
  nextMainIdx() { // 下一個還沒演的主線（不含 _ 分歧）位置
    const O = this.D.order; for (let i = this.S.cursor + 1; i < O.length; i++) { const c = O[i]; if (this.getVar('seen_' + c) || /_/.test(c)) continue; return i; }
    return O.length;
  }
  isFallbackFor(c) { const base = c.split('_')[0]; return this.S.lastMain && this.S.lastMain.split('_')[0] === base; }
  startMain(id) {
    const S = this.S;
    S.cursor = this.mainIndex[id]; S.lastMain = id;
    this.push(id);
    const pre = this.events.filter(e => e.s.slotd && e.s.slotd.before === id && !this.getVar('seen_' + e.id) && this.whenOK(e, {}));
    for (const e of pre) this.push(e.id);
  }
  startDay(d) {
    const v = this.S.v;
    v.day = d; if (weatherOf(d) === 'rain') v.rain_day_count = X.num(v.rain_day_count) + 1;
    const off = isDayOff(d);
    v.window = '';
    this.onNewDay(d);
    this.mbRefill();
    const act = X.num(v.act) || 1;
    const actZh = ['序章', '第一幕', '第二幕', '第三幕', '第四幕', '第五幕'][act] || '';
    const label = `${actZh}・W${Math.ceil(d / 7)}・Day ${d}${off ? '・休假日' : ''}`;
    const sid = this.synth([
      ['cmd', 'date', label, 0],
      ['cmd', 'bg', off ? 'bg_sea_wall_day fx=gray' : 'bg_briefing_room fx=gray', 0],
      ['cmd', '__daylabel', '', 0],
      ...(this.morningAfter(d) ? [['call', 'MORNING_AFTER']] : (X.num(v.nv_ar_ma) > 0 && X.num(v.nv_ar_ma) === d - 1 && this.D.scenes['NV_AR_MA'] ? [['call', 'NV_AR_MA']] : [])),
      ...(off ? [] : [['call', 'BRIEFING_RANDOM']]),
      ...(this.actEndVisit(d) || []),
      ...this.dayCode(d, false),
      ['end']
    ]);
    this.push(sid);
    return true;
  }
  // 第 3 批：第 8 階隔天早上，有人發現。原因輪替、發現的人＝她身邊最在意她的另一位男主
  morningAfter(d) {
    const v = this.S.v; const who = v.ma_who;
    if (!who || X.num(v.ma_day) !== d - 1) { if (who && X.num(v.ma_day) < d - 1) v.ma_who = ''; return false; }
    const tn3 = X.num(v.tn3_day) === d - 1 ? v.tn3_b : '';
    if (tn3) { const gs = GUIDES.filter(g => g !== who && g !== tn3 && g !== 'arno' && this.met(g)); v.tn_pg1 = gs[0] || 'elio'; v.tn_pg2 = gs[1] || (gs[0] === 'rowan' ? 'cecil' : 'rowan'); }
    const by = LEADS.filter(x => x !== who && x !== tn3 && this.met(x) && !(x === 'kael' && v.kael_romance_lock))
      .sort((p, q) => X.num(v['aff_' + q]) - X.num(v['aff_' + p]))[0] || '';
    // 第 2 期：發現的方式跟著發現者的能力走——艾許用鼻子、利奧用耳朵、嚮導讀負荷曲線；其他人只看得到印子、外套、哼歌
    const isS = SENTINELS.includes(who); const k = X.num(v.ma_count);
    let cause = [0, 3, 5][k % 3];
    if (by === 'ash') cause = 1; else if (by === 'leo') cause = 4; else if (GUIDES.includes(by)) cause = isS ? 6 : 2;
    if (tn3 && (v.tn_pg1 === by || v.tn_pg2 === by)) { const gs = GUIDES.filter(g => g !== who && g !== tn3 && g !== by && g !== 'arno' && this.met(g)); v.tn_pg1 = gs[0] || (by === 'elio' ? 'rowan' : 'elio'); v.tn_pg2 = gs[1] || ([ 'rowan', 'cecil', 'elio' ].find(g => g !== v.tn_pg1 && g !== by)); }
    v.ma_x = who; v.ma_by = by; v.ma_cause = cause; v.ma_known = [1, 3, 4, 5].includes(cause); v.ma_kind = isS ? 's' : 'g';
    v.ma_count = k + 1; v.ma_who = '';
    return true;
  }
  // 任務劇情第三批：三個人的夜（TN）。亞思＋兩位男主，每組三人自己一條路：
  //   ask  「那我呢」：A 的夜隔天，發現的人 B（高好感、告白過）來問 → B 的夜（她可說「還不要」）
  //   know A 知道了 B（發現跟著發現者；不是他發現的，就是她自己說）→ 有 consent_<pk> 才說「那我們三個呢」，沒有就等他們先和好
  //   invite 兩個人都已經跟她過夜、彼此也同意了 → 其中一個直接提
  //   three 三個人都說好（畫面上），然後才發生；哨兵在場而負荷 ≥70 → 拒絕
  tnOK(x) {
    const v = this.S.v; if (!LEADS.includes(x) || !this.met(x)) return false;
    if (X.num(v['aff_' + x]) < 60) return false;
    if (x === 'kael' && v.kael_romance_lock) return false;
    if (x === 'arno') return !!(v.arno_truth && v.arno_romance_open && v.arno_love);
    const conf = v['confessed_' + x] || (CONF_SEEN[x] && v['seen_' + CONF_SEEN[x]]); if (!conf) return false;
    const st = SENTINELS.includes(x) ? X.num(v['cstage_' + x]) : X.num(v['gstage_' + x]);
    return st >= 7;
  }
  tnPick() {
    const v = this.S.v; const d = X.num(v.day); v.tn_mode = ''; v.tn_how = '';
    if (X.num(v.tn_day) === d || X.num(v.ma_day) === d || X.num(v.tn3_day) === d) return;
    const pk = (a, b) => [a, b].sort().join('_');
    const set = (mode, a, b, how) => {
      const k = pk(a, b); Object.assign(v, { tn_mode: mode, tn_a: a, tn_b: b, tn_k: k, tn_how: how || '',
        tn_ss: SENTINELS.includes(a) && SENTINELS.includes(b), tn_has_s: SENTINELS.includes(a) || SENTINELS.includes(b),
        tn_s1: SENTINELS.includes(a) ? a : (SENTINELS.includes(b) ? b : ''), tn_vex: a === 'vex' || b === 'vex', tn_noa: a === 'noa' || b === 'noa' });
      return true;
    };
    // 今天早上的發現
    if (X.num(v.ma_day) === d - 1 && v.ma_x && LEADS.includes(v.ma_by || '')) {
      const A = v.ma_x, B = v.ma_by, k = pk(A, B), ph = X.num(v['tn_' + k]);
      if (ph === 2 && v['tn_first_' + k] === B && v['slept_' + B]) return set('know', B, A, v['tn_told_' + k] ? 'told' : (v.ma_known ? 'saw' : 'guess'));
      if (ph === 0 && v['slept_' + A] && !v['slept_' + B] && this.tnOK(B) && this.tnOK(A)) return set('ask', A, B, v.ma_known ? 'saw' : 'guess');
    }
    const L = LEADS.filter(x => this.met(x));
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const k = pk(L[i], L[j]), ph = X.num(v['tn_' + k]); const A = v['tn_first_' + k], B = A === L[i] ? L[j] : L[i];
      if (ph === 1 && d >= X.num(v['tn_wait_' + k]) && this.tnOK(B) && !v['slept_' + B]) return set('again', A, B);
      if (ph === 2 && d >= X.num(v['tn_d_' + k]) + 3) return set('know', A, B, 'told');
      if (ph === 21 && v['consent_' + k] && d >= X.num(v['tn_d_' + k]) + 2) return set('know', A, B, 'ally');
      if (ph === 3 && d >= X.num(v['tn_d_' + k]) + 2 && this.tnOK(L[i]) && this.tnOK(L[j])) return set('three', A, B);
    }
    if (X.num(v.act) < 3) return;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j], k = pk(a, b);
      if (X.num(v['tn_' + k]) || !v['consent_' + k] || !v['slept_' + a] || !v['slept_' + b] || !this.tnOK(a) || !this.tnOK(b)) continue;
      if (d < X.num(v['tn_inv_' + k])) continue;
      const first = X.num(v['aff_' + a]) >= X.num(v['aff_' + b]) ? a : b;
      return set('invite', first, first === a ? b : a);
    }
  }
  // ---------- 牽手・抱抱・親親（TC）：一晚最多一件，全域兩天一次，每人冷卻 3 天；同種最多 3 個版本、從不重播 ----------
  tcKinds(x) {
    const v = this.S.v; const aff = X.num(v['aff_' + x]); const S = SENTINELS.includes(x);
    const st = S ? X.num(v['cstage_' + x]) : X.num(v['gstage_' + x]);
    const conf = v['confessed_' + x] || (CONF_SEEN[x] && v['seen_' + CONF_SEEN[x]]);
    const arnoOK = x === 'arno' ? !!(v.arno_truth && v.arno_romance_open) : true;
    const ks = [];
    if (aff >= 40 && (x === 'arno' ? arnoOK : st >= 2)) ks.push('hand');
    if (aff >= 55 && (x === 'arno' ? arnoOK : st >= (S ? 5 : 4))) ks.push('hug');
    if (aff >= 65 && (x === 'arno' ? arnoOK && !!v.arno_love : !!conf && st >= 6)) ks.push('kiss');
    return ks;
  }
  tcPick() {
    const v = this.S.v; const d = X.num(v.day); v.tc_mode = ''; v.tc_x = ''; v.tc_kind = ''; v.tc_v = 0;
    if (v.tc_day !== undefined && v.tc_day !== '' && d - X.num(v.tc_day) < 2) return;
    if (X.num(v.ma_day) === d || X.num(v.tn3_day) === d || X.num(v.tn_day) === d) return;
    const cands = [];
    for (const x of LEADS) {
      if (!this.met(x) || X.num(v['last_seen_' + x]) !== d) continue;
      if (x === 'kael' && v.kael_romance_lock) continue;
      const last = v['tc_day_' + x]; if (last !== undefined && last !== '' && d - X.num(last) < 3) continue;
      const ks = this.tcKinds(x).filter(k => X.num(v['tc_' + x + '_' + k]) < 3 && this.D.scenes['TC_' + x.toUpperCase() + '_' + k.toUpperCase() + '_' + (X.num(v['tc_' + x + '_' + k]) + 1)]);
      if (!ks.length) continue;
      cands.push({ x, ks, sc: X.num(v['aff_' + x]) - 5 * X.num(v['tc_n_' + x]) });
    }
    if (!cands.length) return;
    cands.sort((a, b) => b.sc - a.sc);
    const { x, ks } = cands[0]; const order = ['hand', 'hug', 'kiss'];
    const kind = ks.slice().sort((a, b) => (X.num(v['tc_' + x + '_' + a]) - X.num(v['tc_' + x + '_' + b])) || (order.indexOf(b) - order.indexOf(a)))[0];
    Object.assign(v, { tc_mode: 'on', tc_x: x, tc_kind: kind, tc_v: X.num(v['tc_' + x + '_' + kind]) + 1 });
  }
  synth(code) { const id = '__s' + (this.S.synthN++); this.S.synth[id] = code; return id; }
  // ---------- freetime ----------
  optLabel(e, prefix) {
    const s = e.s; const lead = s.lead;
    const loc = s.slotd && s.slotd.loc ? (LOC_NAME[s.slotd.loc] || '') : '';
    if (lead) {
      if (this.met(lead)) return loc ? `去${loc}找${NAMES[lead]}` : `去找${NAMES[lead]}`;
      return `去${loc || '別處'}看看（……好像有人在）`;
    }
    return `（${s.title || loc || '……'}）`;
  }
  freetime(arg) {
    const v = this.S.v;
    const special = ['day_off', 'first_snow_night', 'blackout_city', 'final_night'].includes(arg);
    let times = NOON_T, window = null;
    if (arg === 'noon') times = NOON_T;
    else if (arg === 'night') times = NIGHT_T;
    else if (arg === 'day_off_eve') { times = NIGHT_T; window = 'day_off_eve'; }
    else if (arg === 'day_off') { times = NOON_T; window = 'day_off'; }
    else { times = NIGHT_T; window = arg; }
    if (arg === 'final_night') v.eve_lovers = LEADS.filter(x => this.met(x) && X.num(v['stage_' + x]) >= 4);
    if (arg === 'day_off') {
      let best = '', bv = -1;
      for (const x of LEADS) { if (x === 'arno') continue; const a = X.num(v['aff_' + x]); if (a >= 50 && (X.num(v['pair_bond_' + pairKey('arno', x)]) >= 20 || v['shared_sense_' + pairKey('arno', x)]) && a > bv) { bv = a; best = x; } }
      v.secret_arno_partner = best;
    }
    v.window = window || '';
    let cands = this.candidates(times, window);
    if (window === 'day_off_eve' && !cands.length) cands = this.candidates(times, null);
    // one per lead, highest priority
    const byKey = new Map();
    for (const e of cands.sort((a, b) => b.s.prio - a.s.prio)) {
      const key = e.s.lead || e.id;
      if (!byKey.has(key)) byKey.set(key, e);
    }
    let list = [...byKey.values()];
    const order = (e) => { const i = LEADS.indexOf(e.s.lead); return i < 0 ? 99 : i; };
    if (arg === 'final_night') {
      const solo = list.filter(e => /_night$/.test(e.id)).sort((a, b) => order(a) - order(b));
      const nc = list.find(e => e.id === 'NIGHT_OF_COLORS'); const et = list.find(e => e.id === 'EVE_TOGETHER');
      const code = []; const labels = {};
      const choices = [];
      const mkChoice = (label, opts) => { labels[label] = code.length; const ins = ['choice', null, opts, 'END', 0, '最後的夜。我想去見誰？']; code.push(ins); choices.push(ins); };
      const opt = (text, body, next, cond) => { const pc = code.length; code.push(...body); code.push(['goto', next]); return { text, pc, cond: cond || null }; };
      // build bodies after choice instructions: choices first as placeholders
      const o0 = [], o1 = [], o2 = [];
      mkChoice('R0', o0); mkChoice('R1', o1); mkChoice('R2', o2);
      // R0 jumps over R1/R2 bodies by explicit gotos
      if (nc) o0.push(opt('……所有人。', [['call', nc.id]], 'END'));
      if (et) o0.push(opt('……大家。', [['call', et.id]], 'END'));
      const qn = list.find(e => e.id === 'quad_night');
      if (qn) o0.push(opt('去疏導室，找他們三個', [['call', qn.id]], 'END'));
      for (const e of solo) if (e.id !== 'quad_night') o0.push(opt(this.optLabel(e), [['call', e.id]], 'R1', 'not seen_' + e.id));
      o0.push(opt(o0.length ? '（今晚，一個人點燈。）' : '（點燈。）', [['cmd', '__fallback', '1', 0]], 'END'));
      for (const e of solo.filter(x => x.id !== 'quad_night')) o1.push(opt(this.optLabel(e), [['call', e.id]], 'R2', 'not seen_' + e.id));
      o1.push(opt('（……夠了。今晚到這裡。）', [], 'END'));
      for (const e of solo.filter(x => x.id !== 'quad_night')) o2.push(opt(this.optLabel(e), [['call', e.id]], 'END', 'not seen_' + e.id));
      o2.push(opt('（……夠了。今晚到這裡。）', [], 'END'));
      labels.END = code.length; code.push(['end']);
      // R0 -> R1 -> R2 are sequential instructions; make each choice's natural fallthrough go to END
      for (const ins of code) if (ins[0] === 'goto' && typeof ins[1] === 'string') ins[1] = labels[ins[1]];
      for (const ins of choices) ins[3] = labels.END;
      if (!o1.length || solo.length < 2) { /* nothing */ }
      return this.push(this.synth(code));
    }
    if (['noon', 'night', 'day_off', 'day_off_eve'].includes(arg)) return this.placeFree(cands, times, arg);
    list.sort((a, b) => order(a) - order(b));
    list = list.slice(0, 7);
    if (!list.length) { if (special) this.S.fallback = true; return; }
    const code = [null]; const opts = [];
    for (const e of list) {
      const pc = code.length;
      if (e.s.slotd && e.s.slotd.loc) code.push(['set', 'cur_loc', '=', '"' + e.s.slotd.loc + '"']);
      if (e.s.slotd && /sea_wall|east_seawall/.test(e.s.slotd.loc || '')) code.push(['set', 'yasi_goes_seawall', '=', 'true']);
      code.push(['call', e.id]); code.push(['goto', -1]);
      opts.push({ text: this.optLabel(e), pc });
    }
    const apc = code.length; code.push(['cmd', '__fallback', special ? '1' : '', 0]); code.push(['goto', -1]);
    opts.push({ text: special ? '（一個人。）' : (times === NIGHT_T ? '（早點休息。）' : '（一個人待著。）'), pc: apc });
    const endPc = code.length; code.push(['end']);
    for (const ins of code) if (ins && ins[0] === 'goto') ins[1] = endPc;
    code[0] = ['choice', null, opts, endPc, 0, special ? '今晚，我想去見誰？' : (times === NIGHT_T ? '夜裡，要去哪裡？' : '空下來的時間，要去哪裡？')];
    this.push(this.synth(code));
  }
  placeOf(e) {
    const s = e.s; let loc = (s.slotd && s.slotd.loc) || (/__loc\(\s*"?(\w+)/.exec(s.whenx || '') || [])[1] || LEAD_HOME[s.lead] || 'roam';
    return PLACE_KEY[loc] || loc;
  }
  placeFree(cands, times, arg) {
    const v = this.S.v; const night = times === NIGHT_T;
    const lastSeen = (x) => x ? X.num(v['last_seen_' + x]) : 1e9;
    const byLoc = new Map();
    const sorted = cands.slice().sort((a, b) => (b.s.prio - a.s.prio) || (lastSeen(a.s.lead) - lastSeen(b.s.lead)) || (Math.random() - 0.5));
    for (const e of sorted) { const L = this.placeOf(e); if (!byLoc.has(L)) byLoc.set(L, e); }
    const code = [null]; const opts = [];
    const add = (text, body, meta) => { const pc = code.length; code.push(...body); code.push(['goto', -1]); opts.push({ text, pc, meta: meta || null }); };
    // 劇情給了理由，才會出現「去找他」
    for (const x of LEADS) {
      if (!v['seek_' + x] || !this.met(x)) continue;
      const ev = cands.find(e => e.s.lead === x);
      if (ev) for (const [L, e] of byLoc) if (e === ev) byLoc.delete(L);
      add(`去找${NAMES[x]}`, [['set', 'seek_who', '=', '"' + x + '"'], ['call', 'SEEK_VISIT'], ...(ev ? [['call', ev.id]] : [])], { lead: x, ev: ev ? ev.id : null });
    }
    let places = [...byLoc.keys()].slice(0, 5);
    const pool = PLACE_POOL.filter(L => !places.includes(L) && (L !== 'chapel' || v.seen_S04) && (L !== 'old_port_bar' || v.seen_N01) && this.D.scenes['PLACE_' + L.toUpperCase()]);
    const want = Math.max(2, 5 - places.length);
    for (let i = 0; i < want && pool.length; i++) places.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    places.sort((p, q) => (PLACE_POOL.indexOf(p) < 0 ? 99 : PLACE_POOL.indexOf(p)) - (PLACE_POOL.indexOf(q) < 0 ? 99 : PLACE_POOL.indexOf(q)));
    for (const L of places) {
      const e = byLoc.get(L); const body = [['set', 'cur_loc', '=', '"' + L + '"']];
      if (L === 'sea_wall') body.push(['set', 'yasi_goes_seawall', '=', 'true']);
      const pid = 'PLACE_' + L.toUpperCase();
      body.push(['call', e ? e.id : (this.D.scenes[pid] ? pid : 'PLACE_GENERIC')]);
      add(PLACE_VERB[L] || ('去' + (LOC_NAME[L] || L)), body, { lead: e ? e.s.lead || null : null, ev: e ? e.id : null, place: L });
    }
    const apc = code.length; code.push(['call', night ? 'PLACE_REST_NIGHT' : 'PLACE_REST']); code.push(['goto', -1]);
    opts.push({ text: night ? '回房間，早點休息' : '回宿舍，一個人待著', pc: apc, meta: { rest: true } });
    const endPc = code.length; code.push(['end']);
    for (const ins of code) if (ins && ins[0] === 'goto') ins[1] = endPc;
    code[0] = ['choice', null, opts, endPc, 0, night ? '夜裡，要去哪裡？' : (arg === 'day_off' ? '休假日。要去哪裡？' : '空下來的時間，要去哪裡？')];
    this.push(this.synth(code));
  }
  guidesAble() {
    const v = this.S.v;
    return GUIDES.filter(x => (x === 'noa' ? !!v.guide_noa_unlocked : x === 'arno' ? !!v.arno_met : !!v[x + '_met']) && X.num(v['gfat_' + x]) < 70);
  }
  mbText(c) {
    if (c.t === 'plot') { const L = PLOT_MB[c.ph] || []; return (L[c.i] || {}).txt || '……'; }
    const T = MB_TXT[c.t] || ['……']; return T[c.k % T.length];
  }
  // 第 2 期：主線走到哪一段（最後一場看過的主線）
  plotNow() {
    const v = this.S.v; let k = '', id = '';
    for (const [m, ph] of PLOT_PH) if (v['seen_' + m.replace(/-/g, '_')]) { k = ph; id = m; }
    const sc = id && this.D.scenes[id]; let d = sc && sc.date && typeof sc.date.day === 'number' ? sc.date.day : null;
    if (d === null && id) d = X.num(v['plot_d_' + k]) || null;
    return { k, d };
  }
  // 第 2 期：沒見面的夜裡，通訊器的訊息（全域兩天一則、同一人五天一則、每人最多九則）
  msgPick() {
    const v = this.S.v; const d = X.num(v.day);
    if (X.num(v.camp_night) === d || X.num(v.msg_day) >= d - 1 || X.num(v.act) < 2) return;
    if (X.num(v.tn_day) === d || X.num(v.ma_day) === d) return;
    let best = '', bs = -1;
    for (const x of LEADS) {
      if (!this.met(x) || X.num(v['aff_' + x]) < 25 || X.num(v['last_seen_' + x]) >= d) continue;
      if (x === 'kael' && v.kael_romance_lock) continue;
      if (v['msg_day_' + x] !== undefined && d - X.num(v['msg_day_' + x]) < 5) continue;
      if (X.num(v['msg_n_' + x]) >= 9 || !this.D.scenes['MSG_' + x.toUpperCase()]) continue;
      const sc = X.num(v['aff_' + x]) + 3 * Math.min(10, d - X.num(v['last_seen_' + x])) + Math.random() * 10;
      if (sc > bs) { bs = sc; best = x; }
    }
    if (!best) return;
    v.msg_day = d; v['msg_day_' + best] = d; v['msg_n_' + best] = X.num(v['msg_n_' + best]) + 1; v.msg_who = best;
    const a = X.num(v['aff_' + best]); v.msg_band = a >= 70 ? 2 : a >= 45 ? 1 : 0;
    this.push('MSG_' + best.toUpperCase());
  }
  // 第 2 期：每晚自動寫的日記（每一句只寫一次）
  dyTake(key, arr) {
    const v = this.S.v; const k = 'dy_' + key; const used = Array.isArray(v[k]) ? v[k] : [];
    const free = []; for (let i = 0; i < arr.length; i++) if (!used.includes(i)) free.push(i);
    if (!free.length) return '';
    const i = free[Math.floor(Math.random() * free.length)]; v[k] = used.concat([i]); return arr[i];
  }
  diaryCompose() {
    const v = this.S.v; const d = X.num(v.day); if (d < 1) return '';
    const parts = []; const L = X.num(v.load); const dw = X.num(v.deathwish);
    if (L >= 90) { const t = this.dyTake('over', DY.over); return t ? t : ''; }
    const p = this.plotNow();
    if (FEST[d] && v['seen_FEST_' + FEST[d]] && !v['dyf_' + FEST[d]]) { v['dyf_' + FEST[d]] = true; parts.push(DY.fest[FEST[d]]); }
    else if (p.d === d && p.k) parts.push(this.dyTake('main', DY.main));
    else if (X.num(v.mission_day) === d && v.mx_hurt) parts.push(this.dyTake('hurt', DY.hurt));
    else if (X.num(v.mission_day) === d && X.num(v.mx_pushed) >= 2) parts.push(this.dyTake('push', DY.push));
    else if (X.num(v.mission_day) === d) parts.push(this.dyTake('mission', DY.mission));
    else if (X.num(v.guided_day) === d && v.g1) parts.push(this.dyTake('guided', DY.guided).replace(/\{g\}/g, this.callFn('hname', [v.g1])));
    else if (X.num(v.grave_day) === d) parts.push(this.dyTake('grave', DY.grave));
    else parts.push(this.dyTake('quiet', DY.quiet));
    const seen = LEADS.filter(x => this.met(x) && X.num(v['last_seen_' + x]) === d && DY.lead[x] && !(x === 'kael' && v.kael_romance_lock && d > 7))
      .sort((a, b) => X.num(v['aff_' + b]) - X.num(v['aff_' + a]));
    for (const x of seen) { const t = this.dyTake('l_' + x, DY.lead[x]); if (t) { parts.push(t.replace(/\{n\}/g, this.callFn('hname', [x]))); break; } }
    parts.push(this.dyTake('c_' + (dw >= 55 ? 'hi' : dw >= 30 ? 'mid' : 'lo'), DY.close[dw >= 55 ? 'hi' : dw >= 30 ? 'mid' : 'lo']));
    const txt = parts.filter(Boolean).join('');
    return txt ? `Day ${d}。` + txt : '';
  }
  mbRefill() {
    const v = this.S.v; const d = X.num(v.day); const act = Math.max(2, X.num(v.act) || 1);
    if (!SENTINELS.some(x => this.met(x)) || this.getVar('week') < 2) return;
    const mb = (v.mb || []).filter(c => { if (c.dl < d) { v.mb_lapsed = c.t; v.mb_lapsed_day = d; v.mb_lapse_n = X.num(v.mb_lapse_n) + 1; return false; } return true; });
    const pool = (MB_TYPES_BY_ACT[Math.min(5, act)] || MB_TYPES_BY_ACT[2]).filter(t => !mb.some(c => c.t === t) && (t !== 'execution' || !!v.seen_S04) && (t !== 'dark_op' || this.met('vex') || this.met('silas')));
    const want = act >= 4 ? 3 : 2;
    // 第 2 期：主線長出來的單子（一次一張；過期就被別人接走了）
    const ph = this.plotNow().k; const PL = PLOT_MB[ph] || [];
    if (!mb.some(c => c.t === 'plot')) for (let i = 0; i < PL.length; i++) {
      if (v['mbp_' + ph + '_' + i]) continue;
      if (PL[i].base === 'execution' && !v.seen_S04) { v['mbp_' + ph + '_' + i] = 'skip'; continue; }
      v['mbp_' + ph + '_' + i] = 'issued'; mb.unshift({ t: 'plot', ph, i, base: PL[i].base, d0: d, dl: d + 3 + Math.floor(Math.random() * 2), k: 0 }); break;
    }
    while (mb.length < want && pool.length) {
      const t = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const k = X.num(v['mbk_' + t]); v['mbk_' + t] = k + 1;
      mb.push({ t, d0: d, dl: d + 2 + Math.floor(Math.random() * 3), k });
    }
    v.mb = mb;
  }
  // 新版時段選單：任務板／疏導（選項）／每位男主的下一段劇情／地點／墓地／看看他（男人的負荷）／休息
  slot(kind) {
    const v = this.S.v; const d = X.num(v.day);
    const night = kind !== 'day';
    if (kind === 'eve' && X.num(v.camp_day) === d) { v.camp_night = d; return this.push('CAMP_NIGHT'); }
    if (night && kind !== 'eve' && X.num(v.camp_day) === d && X.num(v.camp_night) !== d) { v.camp_night = d; return this.push('CAMP_NIGHT'); } // 第 5 期：休假日（沒有傍晚時段）或傍晚才排到的過夜劇情，夜裡補上營地
    if (night && kind !== 'eve' && X.num(v.camp_night) === d) return;
    const times = night ? NIGHT_T : NOON_T; const window = kind === 'night_eve' ? 'day_off_eve' : null;
    v.window = window || ''; v.slot_kind = kind;
    this._bridgeOK = true; this._bridges = {};
    let cands;
    try { cands = this.candidates(times, window); if (window === 'day_off_eve' && !cands.length) cands = this.candidates(times, null); } finally { this._bridgeOK = false; }
    const bridges = this._bridges;
    // 男人的負荷：今天見過、心跳不對 → 先讓她聽見
    if (night) {
      for (const x of SENTINELS) {
        if (!this.met(x) || X.num(v['sload_' + x]) < 60 || v['sl_noticed_' + x] || X.num(v['last_seen_' + x]) < d - 1) continue;
        if (x === 'kael' && v.kael_romance_lock && X.num(v.aff_kael) < 10) continue;
        v['sl_noticed_' + x] = true; v.sl_who = x;
        return this.push(this.synth([['call', 'SLOAD_NOTICE'], ['cmd', 'slot', kind, 0], ['end']]));
      }
    }
    const code = [null]; const opts = [];
    const add = (text, body, meta) => { const pc = code.length; code.push(...body); code.push(['goto', -1]); opts.push({ text, pc, meta: meta || null }); };
    const band = this.getVar('load_band');
    const evBody = (e) => {
      const b = []; const L = this.placeOf(e);
      b.push(['set', 'cur_loc', '=', '"' + L + '"']);
      if (L === 'sea_wall') b.push(['set', 'yasi_goes_seawall', '=', 'true']);
      const br = bridges[e.id];
      if (br) { const gs = this.guidesAble().filter(g => g !== 'arno'); b.push(['set', 'br_need', '=', String(br.need)], ['set', 'br_dir', '=', '"' + br.dir + '"'], ['set', 'br_lead', '=', '"' + (e.s.lead || '') + '"'], ['set', 'br_g1', '=', '"' + (gs[0] || 'elio') + '"'], ['set', 'br_g2', '=', '"' + (gs[1] || (gs[0] === 'rowan' ? 'cecil' : 'rowan')) + '"'], ['call', 'V2_BRIDGE']); }
      b.push(['call', e.id]); return b;
    };
    // 1) 任務板（白天）
    if (kind === 'day' && !v.slot_rest && (v.mb || []).length) {
      const banned = X.num(v.mission_ban_until) >= d;
      if (banned) add('去任務板看一眼（我還在停職）', [['call', 'PATROL_BENCHED']], { card: 'mission' });
      else if (band >= 3) add('去任務板（……現在這個負荷，馬可斯不會簽）', [['call', 'MB_REFUSED']], { card: 'mission' });
      else add(`去任務板接任務（${(v.mb || []).length} 張）`, [['set', 'mb_cancel', '=', 'false'], ['call', 'MB_BOARD'], ['cmd', 'slot_again', kind, 0]], { card: 'mission' });
    }
    // 2) 疏導（傍晚，選項）
    if (kind === 'eve') {
      const able = this.guidesAble();
      const tag = ['', '（有點吵）', '（吃緊）', '（透支——不能再拖）'][band];
      if (able.filter(g => g !== 'arno').length >= 1 && able.length >= 2) add('去疏導室' + tag, [['call', 'GUIDE_DAILY']], { card: 'guide' });
      else add('去疏導室' + tag + '——今晚撐得住的嚮導不夠兩個', [['call', 'GUIDE_NONE']], { card: 'guide' });
    }
    // 3) 男人的負荷：她選擇把這個時段花在他身上
    for (const x of SENTINELS) if (this.met(x) && v['sl_noticed_' + x] && X.num(v['sload_' + x]) >= 60) add(`去看看${this.callFn('hname', [x])}（他的心跳不對）`, [['set', 'sl_who', '=', '"' + x + '"'], ['call', 'SLOAD_CARE']], { lead: x, care: true });
    for (const g of GUIDES) if (this.met(g) && X.num(v['gfat_' + g]) >= 70 && v['gf_noticed_' + g]) add(`去看看${this.callFn('hname', [g])}（他累壞了）`, [['set', 'gf_who', '=', '"' + g + '"'], ['call', 'GFAT_CARE']], { lead: g, care: true });
    // 第 2 期：吃醋——他在鬧彆扭（一次一位；同一人五天內不再出現）
    { const jx = LEADS.filter(x => this.met(x) && X.num(v['jealousy_' + x]) >= 6 && X.num(v['aff_' + x]) >= 30 && !(x === 'kael' && v.kael_romance_lock) && d - X.num(v['jl_day_' + x]) >= 5 && X.num(v['jl_n_' + x]) < 6 && this.D.scenes['JEAL_VISIT'])
        .sort((a, b) => X.num(v['jealousy_' + b]) - X.num(v['jealousy_' + a]))[0];
      if (jx) add(`去找${this.callFn('hname', [jx])}（他好像在鬧彆扭）`, [['set', 'jl_who', '=', '"' + jx + '"'], ['call', 'JEAL_VISIT']], { lead: jx, care: true }); }
    // 第 2 期：兩個男人起了衝突，她出面（白天／傍晚；六天一次；同一組最多兩次）
    if (!night || kind === 'eve') {
      if (X.num(v.act) >= 2 && d - X.num(v.md_day) >= 6 && this.D.scenes['MEDIATE']) {
        const ml = LEADS.filter(x => this.met(x) && X.num(v['aff_' + x]) >= 30 && d - X.num(v['last_seen_' + x]) <= 7 && !(x === 'kael' && v.kael_romance_lock) && x !== 'arno');
        let pair = null;
        for (let i = 0; i < ml.length && !pair; i++) for (let j = i + 1; j < ml.length; j++) {
          const k = pairKey(ml[i], ml[j]);
          if (v['consent_' + k] || X.num(v['pbeat_' + k]) >= 2 || X.num(v['pair_bond_' + k]) >= 14 || X.num(v['md_n_' + k]) >= 2) continue;
          if (X.num(v['md_last_' + k]) && d - X.num(v['md_last_' + k]) < 14) continue;
          pair = [ml[i], ml[j]]; break;
        }
        if (pair) add(`（走廊那頭吵起來了——${this.callFn('hname', [pair[0]])}和${this.callFn('hname', [pair[1]])}）`, [['set', 'md_a', '=', '"' + pair[0] + '"'], ['set', 'md_b', '=', '"' + pair[1] + '"'], ['call', 'MEDIATE']], { mediate: true });
      }
    }
    // 4) 每位男主的下一段（故事佇列：一人一張；過期的優先、標示「在等我」）
    const lastSeen = (x) => x ? X.num(v['last_seen_' + x]) : 1e9;
    const wk0 = (e) => (e.s.slotd && e.s.slotd.w0 !== undefined) ? e.s.slotd.w0 : 0;
    const actNow = X.num(v.act);
    const actClosing = (e) => { const m = /\bact\s*(==|<=|<)\s*(\d+)/.exec(e.s.whenx || ''); if (!m) return 0; const last = m[1] === '<' ? +m[2] - 1 : +m[2]; return Number(actNow >= last); };
    const closing = (e) => Number(/not seen_/.test(e.s.whenx || '')) + 2 * actClosing(e); // 會被後面的劇情（或換幕）關掉的段落，先播
    const sorted = cands.slice().sort((a, b) => (Number(this.overdue(b)) - Number(this.overdue(a))) || (closing(b) - closing(a)) || (Number(V2_KEY.includes(b.id)) - Number(V2_KEY.includes(a.id))) || (b.s.prio - a.s.prio) || (wk0(a) - wk0(b)) || (Math.random() - 0.5));
    const byLead = new Map(); const misc = []; const extra = []; const nBy = {};
    for (const e of sorted) { const x = e.s.lead; if (x && LEADS.includes(x)) { nBy[x] = (nBy[x] || 0) + 1; if (!byLead.has(x)) byLead.set(x, e); else if (nBy[x] === 2) extra.push(e); } else misc.push(e); }
    // 新版：同一個人積了很多段（或第二段也快過期），而且在別的地方 → 第二張卡
    for (const e of extra) { const x = e.s.lead; const f = byLead.get(x); if ((nBy[x] >= 3 || this.overdue(e)) && this.placeOf(e) !== this.placeOf(f) && this.met(x)) byLead.set(x + '#2', e); }
    // 每個人的第一張卡優先於任何人的第二張卡；她最在意的兩個人，第一張卡一定在選單上
    const rankL = (a, b) => (Number(this.overdue(b)) - Number(this.overdue(a))) || (X.num(v['aff_' + b.s.lead]) - X.num(v['aff_' + a.s.lead])) || (lastSeen(a.s.lead) - lastSeen(b.s.lead));
    const prim = [...byLead.entries()].filter(([k]) => !k.includes('#')).map(([, e]) => e).sort(rankL);
    const sec = [...byLead.entries()].filter(([k]) => k.includes('#')).map(([, e]) => e).sort(rankL);
    const fav = prim.filter(e => this.met(e.s.lead)).slice().sort((a, b) => X.num(v['aff_' + b.s.lead]) - X.num(v['aff_' + a.s.lead])).slice(0, 2);
    const head = prim.filter(e => !fav.includes(e)).slice(0, 6 - fav.length);
    const leadList = [...prim.filter(e => fav.includes(e) || head.includes(e)), ...prim.filter(e => !fav.includes(e) && !head.includes(e)), ...sec];
    const used = new Set();
    for (const x of LEADS) { // 劇情給了理由的「去找他」
      if (!v['seek_' + x] || !this.met(x)) continue;
      const ev = byLead.get(x); if (ev) used.add(ev.id);
      add(`去找${this.callFn('hname', [x])}`, [['set', 'seek_who', '=', '"' + x + '"'], ['call', 'SEEK_VISIT'], ...(ev ? evBody(ev) : [])], { lead: x, ev: ev ? ev.id : null });
    }
    let nLead = 0, nHid = 0;
    for (const e of leadList) {
      if (used.has(e.id)) continue;
      // 還沒認識的人（「好像有人在」）不佔六張卡的名額（隱藏的人最多四位）
      if (!this.met(e.s.lead)) { if (nHid >= 4) continue; nHid++; } else { if (nLead >= 6) continue; nLead++; }
      const x = e.s.lead; const L = this.placeOf(e); const ln = LOC_NAME[L] || '';
      let text;
      if (!this.met(x)) text = `去${ln || '別處'}看看（……好像有人在）`;
      else if (this.overdue(e) && this.getVar('week') >= this.lateWeek(e)) text = `去${ln ? ln + '找' : '找'}${this.callFn('hname', [x])}——他好像在等我`;
      else text = ln ? `去${ln}找${this.callFn('hname', [x])}` : `去找${this.callFn('hname', [x])}`;
      add(text, evBody(e), { lead: x, ev: e.id, place: L, key: V2_KEY.includes(e.id) });
    }
    // 4b) 沒有劇情的時候，也可以去找他（每人四段，不重播；最多三張）
    const hang = LEADS.filter(x => this.met(x) && !byLead.has(x) && X.num(v['aff_' + x]) >= 12 && (Array.isArray(v['vp_hang_' + x]) ? v['vp_hang_' + x].length : 0) < 4 && this.D.scenes['HANG_' + x.toUpperCase()] && !(x === 'kael' && X.num(v.day) < 8))
      .sort((p, q) => (X.num(v['aff_' + q]) - X.num(v['aff_' + p])) || (lastSeen(p) - lastSeen(q))).slice(0, 3);
    if (v.vex_met && v.vex_camp_visit && !v.vex_unlocked && X.num(v.aff_vex) < 35 && (Array.isArray(v.vp_hang_vexcamp) ? v.vp_hang_vexcamp.length : 0) < 4 && X.num(v.act) >= 3) add('去牆外的營地', [['call', 'HANG_VEXCAMP']], { lead: 'vex', hang: true });
    for (const x of hang) add((night ? '去找' : '約') + this.callFn('hname', [x]) + (night ? '待一會兒' : '出去走走'), [['call', 'HANG_' + x.toUpperCase()]], { lead: x, hang: true });
    // 5) 沒有男主的事件與地點（2～3 個）
    const places = [];
    for (const e of misc) { const L = this.placeOf(e); if (places.length < 2 && !places.some(p => p.L === L)) places.push({ L, e }); }
    const pool = PLACE_POOL.filter(L => !places.some(p => p.L === L) && (L !== 'chapel' || v.seen_S04) && (L !== 'old_port_bar' || v.seen_N01) && this.D.scenes['PLACE_' + L.toUpperCase()]);
    const wantP = nLead >= 5 ? 2 : 3;
    while (places.length < wantP && pool.length) places.push({ L: pool.splice(Math.floor(Math.random() * pool.length), 1)[0], e: null });
    for (const { L, e } of places) {
      const body = [['set', 'cur_loc', '=', '"' + L + '"']];
      if (L === 'sea_wall') body.push(['set', 'yasi_goes_seawall', '=', 'true']);
      const pid = 'PLACE_' + L.toUpperCase();
      body.push(['call', e ? e.id : (this.D.scenes[pid] ? pid : 'PLACE_GENERIC')]);
      add(PLACE_VERB[L] || ('去' + (LOC_NAME[L] || L)), body, { ev: e ? e.id : null, place: L });
    }
    // 6) 向死而生：墓地／一個人溜出牆
    if (night && X.num(this.getVar('week')) >= 2 && (X.num(v.deathwish) >= 20 || this.getVar('lost_count') > 0 || this.getVar('executed_today')) && X.num(v.grave_day) < d - 2) add('去墓地', [['set', 'grave_day', '=', String(d)], ['call', 'GRAVE_VISIT']], { grave: true });
    if (!night && kind === 'day' && X.num(this.getVar('week')) >= 3 && X.num(v.deathwish) >= 40 && band >= 1 && X.num(v.sneak_day) < d - 4 && !(X.num(v.mission_ban_until) >= d)) add('（不跟任何人說，一個人溜去北牆）', [['set', 'sneak_day', '=', String(d)], ['call', 'SNEAK_OUT']], { sneak: true });
    // 7) 休息
    const apc = code.length; code.push(['call', night ? 'PLACE_REST_NIGHT' : 'PLACE_REST']); code.push(['goto', -1]);
    opts.push({ text: night ? '回房間，早點休息' : '回宿舍，一個人待著', pc: apc, meta: { rest: true } });
    const endPc = code.length; code.push(['end']);
    for (const ins of code) if (ins && ins[0] === 'goto') ins[1] = endPc;
    const P = SLOT_PROMPT[kind === 'night_eve' ? 'night' : kind][band];
    const prompt = P[this.callFn('vcycle', ['sp_' + kind + band, P.length])];
    code[0] = ['choice', null, opts, endPc, 0, prompt];
    this.push(this.synth(code));
  }
  // 幕末：快要錯過的重要劇情，他自己來找她（一天最多一次）
  actEndVisit(d) {
    const v = this.S.v; const act = X.num(v.act) || 1; if (act < 2) return null;
    const end = ACT_END_DAY[Math.min(5, act)]; const wk = this.getVar('week');
    this._bridgeOK = true; this._bridges = {};
    let cands = [];
    try {
      for (const e of this.events) {
        const sd = e.s.slotd; if (!sd || sd.w1 === undefined || !e.s.lead || !this.met(e.s.lead)) continue;
        if (this.getVar('seen_' + e.id) || v['__started_' + e.id]) continue;
        const key = V2_KEY.includes(e.id); const last = this.lateWeek(e);
        if (!(wk >= last - (key ? 1 : 0) || (end - d <= 3 && actOfWeek(sd.w1) === actOfWeek(wk)))) continue;
        if (!key && X.num(v['aff_' + e.s.lead]) < 30) continue;
        if (/^(EVE_|NIGHT_OF_COLORS|THREE_|END_|FATE_|MULTI|HAREM)/.test(e.id)) continue;
        const wx = e.s.whenx || ''; if (GUIDE_REFS.test(wx) || /window ==/.test(wx)) continue;
        if (sd.after && !sd.w0 && !this.getVar('seen_' + sd.after)) continue;
        if (sd.before) continue;
        if (!this.slotOK(e, {})) continue;
        if (!this.whenOK(e, { times: null })) { const b = this.bridgeNeed(e, { times: null }); if (!b) continue; this._bridges[e.id] = b; }
        cands.push(e);
      }
    } finally { this._bridgeOK = false; }
    if (!cands.length) return null;
    cands.sort((a, b) => (Number(V2_KEY.includes(b.id)) - Number(V2_KEY.includes(a.id))) || (X.num(v['aff_' + b.s.lead]) - X.num(v['aff_' + a.s.lead])));
    const e = cands[0]; const br = this._bridges[e.id];
    const body = [['set', 'visit_lead', '=', '"' + e.s.lead + '"'], ['call', 'V2_VISIT']];
    if (br) { const gs = this.guidesAble().filter(g => g !== 'arno'); body.push(['set', 'br_need', '=', String(br.need)], ['set', 'br_dir', '=', '"' + br.dir + '"'], ['set', 'br_lead', '=', '"' + e.s.lead + '"'], ['set', 'br_g1', '=', '"' + (gs[0] || 'elio') + '"'], ['set', 'br_g2', '=', '"' + (gs[1] || (gs[0] === 'rowan' ? 'cecil' : 'rowan')) + '"'], ['call', 'V2_BRIDGE']); }
    body.push(['set', 'cur_loc', '=', '"' + this.placeOf(e) + '"'], ['call', e.id]);
    return body;
  }
  guideFree(tag) {
    const v = this.S.v;
    v.guide_tag = tag || 'free';
    const code = [['call', 'GUIDE_DAILY'], ['cmd', '__guide_tag_events', '', 0], ['set', 'guide_tag', '=', '""'], ['end']];
    this.push(this.synth(code));
  }
  // ---------- VM ----------
  snapshot() { return clone({ v: this.S.v, stack: this.S.stack, queue: this.S.queue, synth: this.S.synth, synthN: this.S.synthN, cursor: this.S.cursor, fallback: this.S.fallback, ended: this.S.ended, endingId: this.S.endingId, pres: this.S.pres, lastMain: this.S.lastMain, log: this.S.log.slice(-60) }); }
  load(snap) { this.S = clone(snap); this.S.log = this.S.log || []; }
  async run() {
    const S = this.S;
    let guard = 0;
    for (;;) {
      if (this.stopped) return 'stopped';
      if (!S.stack.length) {
        if (!(await this.schedule())) { return S.endingId ? 'ending' : 'end'; }
        continue;
      }
      const f = S.stack[S.stack.length - 1];
      const code = this.code(f.s);
      if (!code || f.pc >= code.length) { this.finishFrame(); continue; }
      const ins = code[f.pc];
      if (++guard % 5000 === 0) await this.ui.yieldTick();
      switch (ins[0]) {
        case 'say': {
          this.lastSnap = this.snapshot();
          const who = ins[1] ? this.interpId(ins[1].replace(/^\{(.*)\}$/, '{$1}')) : '';
          const text = this.interpText(ins[3]);
          const key = f.s + ':' + f.pc;
          if (FRAME_ID.test(f.s) || f.s.startsWith('__s')) { // 新版：同一輪不重播框架句
            const nx = code[f.pc + 1]; const h = hashStr(text);
            const rd = S.v.__rd || (S.v.__rd = {});
            if (rd[h] && !(nx && nx[0] === 'choice') && text.replace(/[\s…。，、「」！？—～~]/g, '').length > 4) { f.pc++; break; }
            rd[h] = 1;
          }
          f.pc++;
          const line = { who, expr: ins[2], text, kind: ins[4], key, read: this.P.read.has(key), pov: S.pres.pov, name: this.speakerName(who) };
          if (who && ins[2] && ins[2] !== 'default') this.ui.expr && this.ui.expr(who, ins[2]);
          S.log.push({ n: line.name, t: text, k: line.kind }); if (S.log.length > 150) S.log.splice(0, S.log.length - 150);
          await this.ui.say(line);
          this.P.read.add(key);
          break;
        }
        case 'if': f.pc = this.cond(ins[1]) ? f.pc + 1 : ins[2]; break;
        case 'goto': f.pc = ins[1]; break;
        case 'forstart': {
          const L = this.ev(ins[2]);
          if (!Array.isArray(L) || !L.length) { f.pc = ins[3]; break; }
          f.loops.push({ v: ins[1], L, i: 0, start: f.pc }); this.setVar(ins[1], L[0]); f.pc++; break;
        }
        case 'fornext': {
          const lp = f.loops[f.loops.length - 1];
          if (!lp) { f.pc++; break; }
          lp.i++;
          if (lp.i < lp.L.length) { this.setVar(lp.v, lp.L[lp.i]); f.pc = lp.start + 1; } else { f.loops.pop(); f.pc++; }
          break;
        }
        case 'choice': {
          const opts = this.buildOptions(ins[2]);
          if (!opts.length) { f.pc = ins[3]; break; }
          this.lastSnap = this.snapshot();
          const idx = await this.ui.choice(opts.map(o => ({ text: o.text, meta: o.meta || null })), ins[1], ins[5] || '');
          const o = opts[Math.max(0, Math.min(opts.length - 1, idx))];
          for (const k in o.bind) this.setVar(k, o.bind[k]);
          S.log.push({ n: '▸', t: o.text, k: 'choice' });
          f.pc = o.pc;
          break;
        }
        case 'set': { f.pc++; this.doSet(ins[1], ins[2], ins[3]); break; }
        case 'clamp': {
          f.pc++;
          if (ins[4] && !this.cond(ins[4])) break;
          const n = this.interpId(ins[1]); this.setVar(n, Math.max(ins[2], Math.min(ins[3], X.num(this.getVar(n))))); break;
        }
        case 'jump': { this.jump(this.interpId(ins[1])); break; }
        case 'call': {
          f.pc++;
          const t = this.interpId(ins[1]);
          if (!this.D.scenes[t] && !S.synth[t]) { this.err('call target missing: ' + t); break; }
          this.push(t); break;
        }
        case 'return': case 'end': this.finishFrame(); break;
        case 'cmd': { f.pc++; await this.command(ins[1], ins[2], ins); break; }
        default: f.pc++; this.err('bad instr ' + ins[0]);
      }
    }
  }
  buildOptions(raw) {
    const out = [];
    for (const o of raw) {
      const fors = o.fors || [];
      const combos = [{}];
      for (const [vn, le] of fors) {
        const next = [];
        for (const c of combos) {
          this.ctx.scopes.push(c);
          let L; try { L = this.ev(le); } finally { this.ctx.scopes.pop(); }
          if (Array.isArray(L)) for (const x of L) next.push(Object.assign({}, c, { [vn]: x }));
        }
        combos.splice(0, combos.length, ...next);
      }
      for (const c of combos) {
        this.ctx.scopes.push(c);
        try {
          if (o.cond && !this.cond(o.cond)) continue;
          const text = this.interpText(o.text);
          out.push({ text, pc: o.pc, bind: c, meta: o.meta || null });
        } finally { this.ctx.scopes.pop(); }
      }
    }
    return out;
  }
  doSet(lhs, op, rhs) {
    const name = this.interpId(lhs);
    let val;
    const bare = /^[A-Za-z_][\w]*$/.test(rhs) && !['true', 'false'].includes(rhs);
    val = this.ev(rhs);
    if (val === undefined && bare) val = (op === '=') ? (/^(aff|bond|stage|seen|pair|load|jealousy)_/.test(rhs) ? 0 : rhs) : rhs;
    const cur = this.getVar(name);
    const prevLoad = X.num(this.S.v.load);
    if (op === '=') this.setVar(name, val === undefined ? false : val);
    else if (op === '+=') {
      if (Array.isArray(cur)) { this.setVar(name, cur.concat(Array.isArray(val) ? val : [val])); }
      else if (cur === undefined && typeof val === 'string' && isNaN(+val)) this.setVar(name, [val]);
      else if (typeof cur === 'string' && typeof val === 'string') this.setVar(name, cur + val);
      else this.setVar(name, X.num(cur) + X.num(val));
    } else if (op === '-=') {
      if (Array.isArray(cur)) this.setVar(name, cur.filter(x => x !== val));
      else this.setVar(name, X.num(cur) - X.num(val));
    } else if (op === '*=') this.setVar(name, X.num(cur) * X.num(val));
    if (/^(aff|bond)_/.test(name)) { const n = X.num(this.getVar(name)); if (n > 100) this.setVar(name, 100); }
    if (name === 'load') {
      let n = X.num(this.S.v.load); this.S.v.load = prevLoad;
      if (op === '-=' && n < prevLoad && !this.inPurify()) { // 只有嚮導疏導能降 load；其他（戀愛、安撫、獨處）→ 穩定度
        this.S.v.steady = Math.min(30, X.num(this.S.v.steady) + Math.ceil((prevLoad - n) / 2)); n = prevLoad;
      }
      this.setLoad(n);
    }
    if (name === 'loc' && this.S.pres.combat) this.ui.gauge && this.ui.gauge(this.S);
  }
  jump(t) {
    const S = this.S;
    const f = S.stack[S.stack.length - 1];
    if (!this.D.scenes[t]) { this.err('jump target missing: ' + t); f.pc++; return; }
    this.markSeen(f.s);
    if (t in this.mainIndex) {
      if (this.getVar('seen_' + t) && this.mainIndex[t] <= S.cursor) { S.stack.pop(); this.afterScene(f.s, S.stack.length === 0); return; }
      // v2：個人事件（例如休假日事件）提早被排到時，不可以跳過還沒演的主線——結束事件，主線照順序走。
      if (this.mainIndex[t] > this.nextMainIdx() || this.getVar('seen_' + t)) { S.stack.pop(); this.afterScene(f.s, S.stack.length === 0); return; }
      S.stack.length = 0;
      S.cursor = this.mainIndex[t]; S.lastMain = t;
      this.push(t);
      return;
    }
    S.stack.pop();
    this.push(t);
  }
  speakerName(who) {
    if (!who) return '';
    const P = this.S.pres;
    if (P.names[who]) return P.names[who];
    if (LEADS.includes(who) && !this.S.v[who + '_met'] && !(who === 'kael' && this.S.v.day >= 1)) return '？？？';
    if (who === 'yasi') return '亞思';
    return NAMES[who] !== undefined ? NAMES[who] : who;
  }
  async command(c, a, ins) {
    const S = this.S, P = S.pres, v = S.v;
    a = a || '';
    switch (c) {
      case 'name': {
        const m = /^(\{?[\w{}()]+\}?)\s+(.*)$/.exec(a); if (!m) break;
        const id = this.interpId(m[1]); const rest = m[2].trim();
        if (rest === 'reset') delete P.names[id]; else P.names[id] = this.interpText(rest.replace(/^「|」$/g, ''));
        break;
      }
      case 'pov': P.pov = this.interpId(a.trim()) || 'yasi'; break;
      case 'date': { P.date = this.interpText(a); const sc = this.D.scenes[ins.__sid]; this.ui.date && await this.ui.date(P.date); break; }
      case 'color': {
        const id = this.interpId(a.trim().split(/\s+/)[0]);
        const h = COLOR_TO_HEART[id];
        if (h && !id.startsWith('hint_') && !v.colors_seen.includes(h)) { v.colors_seen.push(h); v['color_' + h] = true; }
        this.ui.color && await this.ui.color(id, S);
        break;
      }
      case 'freetime': this.freetime(this.interpId(a.trim())); break;
      case 'guide': { const p = a.trim().split(/\s+/); if (p[0] === 'free') this.guideFree(p[1] || 'free'); else this.push('GUIDE_DAILY'); break; }
      case '__guide_tag_events': {
        // 新版：同一晚有好幾段可播時，播她最在意的那個人的（不再只看優先度）
        const L = this.events.filter(e => e.s.whenx && /guide_tag ==/.test(e.s.whenx) && !this.getVar('seen_' + e.id) && !v['__started_' + e.id] && this.slotOK(e, {}) && this.whenOK(e, {}));
        L.sort((p, q) => (X.num(v['aff_' + q.s.lead]) - X.num(v['aff_' + p.s.lead])) || (q.s.prio - p.s.prio));
        if (L[0]) this.push(L[0].id);
        break;
      }
      case '__fallback': if (a === '1') S.fallback = true; break;
      case 'play_event': {
        const tag = String(this.ev(a));
        const e = this.pickEventByTag(tag);
        if (e) this.push(e.id);
        break;
      }
      case 'ending': {
        const id = this.interpId(a.trim());
        S.endingId = id; v.ending_id = id;
        this.P.endings[id] = this.P.endings[id] || Date.now();
        v['seen_ending_' + id] = true;
        this.ui.persist && this.ui.persist();
        break;
      }
      case 'unlock': { const id = this.interpId(a.trim()); this.P.unlocks[id] = true; this.ui.persist && this.ui.persist(); break; }
      case 'gallery_color': { const t = this.ev(a.trim()); this.P.gallery[String(t || a.trim())] = true; this.ui.persist && this.ui.persist(); break; }
      case 'combat': {
        const p = a.trim().split(/\s+/);
        if (p[0] === 'begin') { v.loc = Math.floor(X.num(v.load) / 2); P.combat = { id: p[1] || '' }; }
        else P.combat = null;
        this.ui.gauge && this.ui.gauge(S);
        break;
      }
      case 'cg': {
        let id = this.interpId(a.trim().split(/\s+/)[0]);
        if (id === 'off') { P.cg = null; }
        else { P.cg = { id, note: ins[4] || '' }; this.P.cgs[id] = true; this.ui.persist && this.ui.persist(); }
        break;
      }
      case 'bg': {
        const p = a.trim().split(/\s+/); const id = this.interpId(p[0]);
        const fx = (/fx=(\w+)/.exec(a) || [])[1] || 'gray';
        P.bg = id; P.bgfx = fx; P.cg = null;
        break;
      }
      case 'show': {
        const p = this.interpId(a).trim().split(/\s+/);
        const id = p[0]; const outfit = p[1] && !p[1].includes('=') ? p[1] : 'uniform'; const ex = p[2] && !p[2].includes('=') ? p[2] : 'default';
        const pos = (/pos=(\w+)/.exec(a) || [])[1] || (P.sprites[id] && P.sprites[id].pos) || 'center';
        P.sprites[id] = { outfit, expr: ex, pos, t: Date.now() };
        if (LEADS.includes(id) && S.stack.length && !(S.stack[0].s in this.mainIndex)) this.seenLead(id);
        break;
      }
      case 'show_group': {
        const m = /^(\[.*?\]|\S+)\s+(\S+)/.exec(a.trim()); if (!m) break;
        let L = this.ev(m[1]); if (!Array.isArray(L)) L = [];
        const pos = ['far_left', 'left', 'center', 'right', 'far_right'];
        L.slice(0, 5).forEach((id, i) => { P.sprites[id] = { outfit: m[2], expr: 'default', pos: pos[Math.round(i * 4 / Math.max(1, Math.min(5, L.length) - 1))] || 'center', t: Date.now() }; });
        break;
      }
      case 'expr': { const p = a.trim().split(/\s+/); const id = this.interpId(p[0]); if (P.sprites[id]) P.sprites[id].expr = p[1]; break; }
      case 'hide': { const id = this.interpId(a.trim().split(/\s+/)[0]); if (id === 'all' || !id) P.sprites = {}; else delete P.sprites[id]; break; }
      case 'bgm': { const p = a.trim().split(/\s+/); const id = this.interpId(p[0]); P.bgm = (id === 'stop' || !id) ? null : id; break; }
      case 'amb': { const p = a.trim().split(/\s+/); const id = this.interpId(p[0]); P.amb = (id === 'stop' || !id) ? null : { id, vol: parseFloat((/vol=([\d.]+)/.exec(a) || [])[1] || '0.5') }; break; }
      case 'counter': {
        const p = a.trim().split(/\s+/); const val = p[0];
        const col = (/color=(\w+)/.exec(a) || [])[1];
        if (val === 'off') P.counter = null;
        else if (val === 'stop') { if (P.counter) P.counter.stop = true; }
        else if (/^[+-]\d+$/.test(val)) { const cur = P.counter ? X.num(P.counter.n) : 0; P.counter = { n: cur + parseInt(val, 10), color: col || (P.counter && P.counter.color) }; }
        else P.counter = { n: val, color: col };
        break;
      }
      case 'title': {
        const t = this.interpText(a).replace(/sub=.*/, '').trim().replace(/^「|」$/g, '');
        const sub = (/sub=(.*)$/.exec(a) || [])[1];
        P.title = t; this.ui.title && await this.ui.title(t, sub ? this.interpText(sub.replace(/^「|」$/g, '')) : '');
        break;
      }
      case 'comm': {
        const m = /^(\{?[\w{}()]+\}?)\s*(.*)$/.exec(a.trim()); if (!m) break;
        const who = this.interpId(m[1]);
        this.lastSnap = this.snapshot();
        const text = this.interpText(m[2]);
        S.log.push({ n: '通訊・' + this.speakerName(who), t: text, k: 'comm' });
        await this.ui.say({ who, expr: '', text, kind: 'comm', key: null, read: false, pov: P.pov, name: this.speakerName(who) });
        break;
      }
      case 'diary': {
        const text = a.trim() === 'auto' ? this.diaryCompose() : this.interpText(a.trim());
        if (!text) break;
        v.diary = (v.diary || []).concat([{ d: v.day, t: text }]).slice(-200);
        this.lastSnap = this.snapshot();
        S.log.push({ n: '日記', t: text, k: 'diary' });
        await this.ui.say({ who: '', expr: '', text, kind: 'diary', key: null, read: false, pov: P.pov, name: '日記' });
        break;
      }
      case 'clickable': break;
      case 'guide_stage': this.guideStage(a.trim() === 'quiet' || !!v.pair_event_played); break;
      case 'guide_watch': this.guideWatch(); break;
      case 'sentinel_presence': this.sentinelPresence(); break;
      case 'patrol_second': { const x = this.interpId(a.trim()); if (x) { this.seenLead(x); this.contactProgress(x, 1); } break; }
      case 'mx': { const x = this.interpId(a.trim()); if (x) this.mxBeat(x); break; }
      case 'tn_pick': this.tnPick(); break;
      case 'tc_pick': this.tcPick(); break;
      case 'mx_night': { // 任務夜：允許這位哨兵進第 8 階（之後由劇本 @set cstage_x = 8）
        const x = this.interpId(a.trim()); this._mxNight = true; v.mx_night_ok = !!x && this.stageCan(x, 8, 's'); this._mxNight = false; break;
      }
      case 'patrol_with': {
        const x = this.interpId(a.trim()); if (!x) break;
        v.mission_day = v.day; v.mission_count = X.num(v.mission_count) + 1;
        // 任務專屬冷落：其他已相遇、在意她的哨兵，連續幾次沒被選
        v.mx_neglect = '';
        for (const y of SENTINELS) {
          if (y === x) { v['mx_skip_' + y] = 0; continue; }
          if (!this.met(y)) continue;
          v['mx_skip_' + y] = X.num(v['mx_skip_' + y]) + 1;
          const t = X.num(v['mxn_tier_' + y]);
          if (!v.mx_neglect && X.num(v['mx_skip_' + y]) >= (t ? 4 : 3) + t && X.num(v['aff_' + y]) >= 25 && X.num(v['cstage_' + y]) >= 3 && t < 3 && !(y === 'kael' && v.kael_romance_lock && t >= 1)) {
            v.mx_neglect = y; v.mx_neglect_tier = t + 1; v['mxn_tier_' + y] = t + 1; v['mx_skip_' + y] = 0;
          }
        }
        v.mission_partner = x; v.mission_partner_day = v.day; v.fought_day = v.day;
        v['sload_' + x] = Math.min(100, X.num(v['sload_' + x]) + (v.mx_shield ? 14 : 8) + (OVERNIGHT.includes(v.mission_type) ? 6 : 0));
        if (OVERNIGHT.includes(v.mission_type)) v.camp_day = v.day;
        v['aff_' + x] = Math.min(100, X.num(v['aff_' + x]) + 1);
        if (x === 'kael' && v.kael_romance_lock && v.aff_kael > 19) v.aff_kael = 19;
        this.seenLead(x);
        this.setLoad(X.num(v.load) + 6, true);
        this.contactProgress(x, 1);
        break;
      }
      case 'slot': this.slot(a.trim()); break;
      case 'slot_again': if (v.mb_cancel) { v.mb_cancel = false; this.slot(a.trim()); } break;
      case 'mb_take': {
        const t = this.interpId(a.trim()); const card = (v.mb || []).find(c => c.t === t);
        v.mb = (v.mb || []).filter(c => c.t !== t); v.mb_type = t; v.mb_taken = X.num(v.mb_taken) + 1; v.mx_plot = '';
        if (t === 'plot' && card) { v.mb_type = card.base; v.mx_plot = card.ph + '_' + card.i; v['mbp_' + card.ph + '_' + card.i] = 'taken'; }
        break;
      }
      case 'msg_pick': this.msgPick(); break;
      case 'sload': { const [x, n] = a.trim().split(/\s+/); const id = this.interpId(x); if (SENTINELS.includes(id)) v['sload_' + id] = Math.max(0, Math.min(100, X.num(v['sload_' + id]) + X.num(this.ev(n)))); break; }
      case 'gfat': { const [x, n] = a.trim().split(/\s+/); const id = this.interpId(x); if (GUIDES.includes(id)) v['gfat_' + id] = Math.max(0, Math.min(100, X.num(v['gfat_' + id]) + X.num(this.ev(n)))); break; }
      case 'dayrest': { const sid = this.synth([...this.dayCode(v.day, true), ['end']]); this.push(sid); break; }
      case 'load_mark': v.load_pending = 0; break;
      case 'emergency_load': { this.setLoad(X.num(this.ev(a.trim())), true); break; }
      default:
        if (this.ui.fx) await this.ui.fx(c, this.interpText(a), S);
    }
    if (this.ui.present) this.ui.present(S, c);
  }
}
const api = { Engine, NAMES, LEADS, HIDDEN, GUIDES, SENTINELS, STAGE_T, HEART, COLOR_HEX, COLOR_NAME, LOC_NAME, weatherOf };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VEngine = api;
})(typeof self !== 'undefined' ? self : this);
