// Product category, function and audience rules (REQ-014 appendix). Names are matched against these patterns in
// order; for categories the first match wins, so product forms (soap, toothpaste, hand cream ...) are listed before
// ingredients. A category typed in by a person always takes precedence over the rules.
// Function labels are for internal grouping only and are not health claims.

export type ProductCategory = { code: string; level1: string; level2: string };
type CategoryRule = ProductCategory & { pattern: RegExp };
type FunctionRule = { group: string; label: string; scope: readonly string[]; pattern: RegExp };

const rule = (source: string) => new RegExp(source, 'i');

const CATEGORY_RULES: CategoryRule[] = [
  { code: "G1", level1: "家庭常备", level2: "感冒鼻塞与咳嗽", pattern: rule("通鼻|nasal|鼻塞|chest syrup|止咳|咳嗽|cough|vapou?r patch|vapour rub|清肺液") },
  { code: "G2", level1: "家庭常备", level2: "驱虫与常备药", pattern: rule("打虫|驱虫|combantrin|worm") },
  { code: "G3", level1: "家庭常备", level2: "外用膏与急救", pattern: rule("黄金膏|golden balm|smelly feet|万用膏|急救|first aid") },
  { code: "E1", level1: "洗护用品", level2: "香皂", pattern: rule("香皂|soap|(?<!肥)皂(?!角)|spao|goats milk.*manuka") },
  { code: "F1", level1: "日用品", level2: "口腔护理", pattern: rule("牙膏|toothpaste|漱口|mouthwash|牙刷") },
  { code: "D7", level1: "护肤品", level2: "唇部护理", pattern: rule("唇膏|lip ?bl?a[lm]|lip balm|润唇|\\blip\\b") },
  { code: "D8", level1: "护肤品", level2: "手部护理", pattern: rule("护手|hand ?cre(a|)me|handcreme?|手霜|手模|手膜|touch hands|护脚|foot|heel") },
  { code: "D5", level1: "护肤品", level2: "眼部护理", pattern: rule("眼霜|眼膜|eye ?cre(a|)me?|eye ?mask|eye gel|眼部(?!.*(粒|caps|tab))") },
  { code: "D3", level1: "护肤品", level2: "面膜", pattern: rule("面膜|face ?mask|facemask|ddmask|\\bmask") },
  { code: "D6", level1: "护肤品", level2: "防晒", pattern: rule("防晒|spf|sunscreen") },
  { code: "D4", level1: "护肤品", level2: "洁面与卸妆", pattern: rule("洗面奶|洁面|cleanser|facial wash|卸妆|cleaner|洗脸巾|face wash") },
  { code: "E5", level1: "洗护用品", level2: "私处护理", pattern: rule("femfresh|私处|清洗液|洗液|intimate|vagisil") },
  { code: "E4", level1: "洗护用品", level2: "染发", pattern: rule("染发|hair colou?r") },
  { code: "E3", level1: "洗护用品", level2: "洗发护发", pattern: rule("洗发|shampoo|护发|conditioner|发膜|发油|hair oil|moroccanoil|kerastase|防脱洗") },
  { code: "E2", level1: "洗护用品", level2: "沐浴", pattern: rule("沐浴|body ?wash|shower|洗手|hand ?wash|泡澡|bath ?bomb") },
  { code: "F2", level1: "日用品", level2: "驱蚊与户外", pattern: rule("驱蚊|蚊|insect|repell") },
  { code: "F3", level1: "日用品", level2: "精油与香薰", pattern: rule("精油|essential oil|lavender oil|lemon oil|tea ?tree oil|茶树油|thursday plantation|diffuser|香薰|扩香") },
  { code: "D10", level1: "护肤品", level2: "修护膏与特护", pattern: rule("木瓜膏|papaw|paw ?paw|祛疤|dermatix|疤|tea tree gel|bio-?oil|百洛油") },
  { code: "D1", level1: "护肤品", level2: "绵羊油系列", pattern: rule("绵羊油|lanolin|lanilin|lanoin|lanocreme|lanolux|sheep|羊脂|emu") },
  { code: "D2", level1: "护肤品", level2: "面部护理", pattern: rule("面霜|乳液|爽肤水|精华液|精粹|礼盒|rosewater|玫瑰水|理肤泉|thermal (spring )?water|睫毛|face cream|day ?cream|night ?crea?me?|晚霜|保湿霜|眼霜") },
  { code: "F5", level1: "日用品", level2: "其他日用与玩具", pattern: rule("needoh|zuru|toy|玩具|fuzz ball|squish|jellycat|bagcharm") },
  { code: "F6", level1: "日用品", level2: "母婴用品", pattern: rule("学饮杯|sippy|lunch ?box|餐盒|奶瓶|护垫|尿布|nappy|nappies|bbox") },
  { code: "C2", level1: "奶粉与乳制品", level2: "婴幼儿与儿童奶粉", pattern: rule("aptamil|karicare|爱他美|可瑞康|stage ?\\d|\\d ?段|a2 stage") },
  { code: "B2", level1: "食品", level2: "喉糖与蜂蜜糖果", pattern: rule("喉糖|lozenge|棒棒糖|lollipop|lollies") },
  { code: "B3", level1: "食品", level2: "零食", pattern: rule("牛奶片|牛奶瓶|milk ?tab|jerky|肉干|jack ?links|夏威夷果|macadamia|坚果|\\bnuts?\\b|cookie|饼干|卷卷糖|vita rolls|\\bsalt\\b|盐") },
  { code: "A6", level1: "保健品", level2: "蜂胶与蜂产品保健", pattern: rule("蜂胶|propolis|pfl ?\\d|蜂王浆|royal jelly|蜂花粉|bee pollen|bio ?30") },
  { code: "A7", level1: "保健品", level2: "动物来源营养", pattern: rule("牛初乳|colostrum|乳铁蛋白|lactoferrin|羊胎|胎盘|placenta|鹿茸|鹿胎|鹿鞭|deer|生蚝|oyster|袋鼠|耳牛球|免疫球蛋白|neurio") },
  { code: "C2", level1: "奶粉与乳制品", level2: "婴幼儿与儿童奶粉", pattern: rule("(成长|儿童|婴|kids|junior|toddler|formula).*(奶粉|milk powder)|(奶粉|milk powder).*(成长|儿童|婴|kids|junior)") },
  { code: "C3", level1: "奶粉与乳制品", level2: "羊奶粉", pattern: rule("羊奶粉|羊奶|goat (milk )?powder|goat milk") },
  { code: "C1", level1: "奶粉与乳制品", level2: "成人奶粉", pattern: rule("奶粉|milk pow(d)?er|full ?cream|trim ?cream|anchor trim|\\bskim\\b|全脂|脱脂|特贝优|taupo ?pure ?1kg|taupo a2|a2 ?milk") },
  { code: "B1", level1: "食品", level2: "蜂蜜", pattern: rule("蜂蜜|honey|umf|mgo|manuka hunters|三叶草|comvita.*\\b\\d{1,2}\\+ ?\\d{3,4} ?g") },
  { code: "A4", level1: "保健品", level2: "辅酶与抗氧化营养素", pattern: rule("叶黄素|lutein|虾青素|astaxanthin|kids eye|macu ?vision") },
  { code: "A1", level1: "保健品", level2: "鱼油与 Omega-3", pattern: rule("鱼油|fish ?oil|omega|磷虾|krill|dha|鱼肝油|cod liver|海豹油|挪威小鱼|nordic|salmon (油|oil)|三文鱼油") },
  { code: "A4", level1: "保健品", level2: "辅酶与抗氧化营养素", pattern: rule("辅酶|\\bq10|coq10|mitoq|麦角硫因|ergothioneine|角鲨烯|squalene|\\bnmn\\b|pqq|白藜芦醇|resveratrol|槲皮素|querce") },
  { code: "A9", level1: "保健品", level2: "美容口服", pattern: rule("胶原|collagen|vida ?glow|hair,? ?skin|skin ?nails|美白胶囊|焕颜|焕肤|雪肌|美颜|luminous|beauty|regeneration|烟酰胺|nicotinamide|玫瑰.*(软胶囊|complex)|rose (油 )?complex|生发软糖|unichi") },
  { code: "A8", level1: "保健品", level2: "关节营养素", pattern: rule("维骨力|氨糖|glucosamine|软骨素|chondroitin|关节|joint|青口|mussel|\\bmsm\\b") },
  { code: "A5", level1: "保健品", level2: "益生菌与消化", pattern: rule("益生菌|probiotic|biotic|b420|养胃|消化|digest|益生元|inner health|pro-?b") },
  { code: "A3", level1: "保健品", level2: "植物与草本提取", pattern: rule("奶蓟|thistle|护肝|清肝|liver|姜黄|turmeric|curcumin|葡萄籽|grape ?seed|银杏|ginkgo|蓝莓|越橘|bilberry|蔓越莓|cranberry|芹菜|celery|西梅|prune|苹果醋|vinegar|接骨木|elderberry|百里香|thyme|清肺|harker|纳豆|红曲|月光宝盒|anthogenol|樱桃|cherry|人参|ginseng|黑加仑|blackcurrant|圣约翰|锯棕榈|saw palmetto|前列腺|prostate|血糖|胆固醇|cholesterol|螺旋藻|spirulina|大蒜|garlic|kyolic|水蛭|月见草|evening primrose|\\bepo\\b|紫雏菊|紫锥菊|echinacea|圣洁|vitex|chaste") },
  { code: "A2", level1: "保健品", level2: "维生素与矿物质", pattern: rule("钙|calcium|维生素|vitamin|多维|multi|综合维|女维|男维|\\bv ?c\\b|vc\\d|\\bv ?d3?\\b|\\bd3\\b|维d|维c|维b|b12|b族|executive b|b complex|镁|magnesium|锌|zinc|铁|iron|floradix|叶酸|folic|elevit|爱乐维|生物素|biotin|泡腾|甲钴胺|vc|维 ?[cdeb]|vit ?[cde]\\b|vitamin ?ad|bio c|natural e|high strength c|\\bc ?1000|magenesium|zine|\\bv ?e\\b|硒|selenium|生物栖") },
  { code: "A10", level1: "保健品", level2: "其他功能营养", pattern: rule("卵磷脂|lecithin|赖氨酸|lysine|成长素|ezz|解酒|hangover|代谢|metabolism|纤体|calibrate|睡眠|sleep|健脑|brain|免疫|immun|menopause|更年期|软胶囊|胶囊|caps?\\b|capsules?|tabs?\\b|tablets?|软糖|gumm|\\d+ ?粒|\\d+ ?片|drops|滴剂") },
  { code: "B4", level1: "食品", level2: "营养冲剂与饮品", pattern: rule("咖啡|coffee|花胶|ensure|安素|isowhey|营养粉|代餐|sachet|蛋白粉|whey|protein|greens|绿瘦子") },
  { code: "D2", level1: "护肤品", level2: "面部护理", pattern: rule("精华|serum|面霜|乳液|lotion|爽肤水|toner|mist|雅漾|avene|玫瑰果|rosehip|果油|day ?cream|night ?crea?me?|晚霜|保湿霜|cream|霜|skincare|护肤") },
  { code: "D9", level1: "护肤品", level2: "身体护理", pattern: rule("身体乳|body ?lotion|芦荟|aloe|身体油|body oil") },
];

export const UNCLASSIFIED: ProductCategory = { code: 'Z', level1: "其他", level2: "未识别" };

const HEALTH = ["保健品", "奶粉与乳制品", "食品"] as const;
const SKIN = ["护肤品", "洗护用品"] as const;
const ORAL = ["日用品"] as const;
const HEALTH_AND_HAIR = ["保健品", "奶粉与乳制品", "洗护用品", "食品"] as const;

const FUNCTION_RULES: FunctionRule[] = [
  { group: "器官与系统", label: "护肝", scope: HEALTH, pattern: rule("护肝|清肝|(?<!鱼)肝(?!油)|(?<!cod )liver|奶蓟|thistle|42000|liver guard") },
  { group: "器官与系统", label: "护心", scope: HEALTH, pattern: rule("护心|心脏|heart|辅酶|\\bq10|coq10|mitoq(?!.*(肝|liver|血糖|姜黄|麦角|鱼油))") },
  { group: "器官与系统", label: "心脑血管", scope: HEALTH, pattern: rule("鱼油|fish ?oil|omega|磷虾|krill|胆固醇|cholesterol|红曲|纳豆|卵磷脂|lecithin|银杏|ginkgo|血管|角鲨烯|squalene|海豹油|salmon|大蒜|garlic|kyolic|水蛭|静脉|venotrex|omg ?3") },
  { group: "器官与系统", label: "健脑益智", scope: HEALTH, pattern: rule("dha|健脑|brain|银杏|ginkgo|磷脂酰丝氨酸|益智") },
  { group: "器官与系统", label: "护眼", scope: HEALTH, pattern: rule("护眼|叶黄素|lutein|越橘|bilberry|蓝莓|blueberry|虾青素|astaxanthin|鱼肝油|cod liver|kids eye|macu|vision|眼(?!霜|膜)") },
  { group: "器官与系统", label: "骨骼与补钙", scope: HEALTH, pattern: rule("钙|calcium|bone|骨骼|\\bv ?d3?\\b|d3|维 ?d|vitamin ?ad|维生素d|vit(amin)? ?d|\\bk2\\b|镁|magnesium") },
  { group: "器官与系统", label: "关节", scope: HEALTH, pattern: rule("维骨力|氨糖|glucosamine|软骨素|chondroitin|关节|joint|青口|mussel|\\bmsm\\b|姜黄|turmeric|curcumin|骨胶原|鹿筋|flexi") },
  { group: "器官与系统", label: "肠胃消化", scope: HEALTH, pattern: rule("益生菌|probiotic|biotic|pro-?b|养胃|消化|digest|西梅|prune|通便|纤维|fib(re|er)|益生元|苹果醋|vinegar|牛初乳|colostrum|b420|酶|enzyme|gut|肠道|phloe|detox|排毒") },
  { group: "器官与系统", label: "呼吸与咽喉", scope: HEALTH, pattern: rule("喉|lozenge|清肺|lung|oral|喷雾|百里香|thyme|harker|throat|接骨木|elderberry") },
  { group: "器官与系统", label: "泌尿健康", scope: HEALTH, pattern: rule("蔓越莓|cranberry|泌尿") },
  { group: "代谢", label: "血糖平衡", scope: HEALTH, pattern: rule("血糖|glucose|sugar balance|糖尿病|diabet|肉桂|cinnamon|苦瓜|isowhey") },
  { group: "代谢", label: "血压", scope: HEALTH, pattern: rule("血压|blood pressure") },
  { group: "代谢", label: "尿酸与痛风", scope: HEALTH, pattern: rule("芹菜|celery|尿酸|痛风") },
  { group: "代谢", label: "体重管理", scope: HEALTH, pattern: rule("瘦|减肥|shape|b420|苹果醋|vinegar|代餐|燃脂|体重|weight|代谢|metabolism|纤体|calibrate|greens") },
  { group: "全身", label: "免疫力", scope: HEALTH, pattern: rule("免疫|immun|vc|维 ?c|vitamin ?c|维生素c|维生suc|bio c|澳佳宝c|锌|zinc|蜂胶|propolis|pfl|硒|selenium|生物栖|紫雏菊|大蒜|garlic|zin[ce]|灵芝|林芝|mushroom|牛初乳|colostrum|乳铁蛋白|lactoferrin|接骨木|elderberry|耳牛球|紫锥菊|echinacea|neurio|蜂蜜|honey") },
  { group: "全身", label: "抗氧化与抗衰", scope: HEALTH, pattern: rule("葡萄籽|grape ?seed|麦角硫因|ergothioneine|槲皮素|querce|硒|selenium|生物栖|\\bv ?e\\b|维 ?e|natural e|vitamin ?e|螺旋藻|spirulina|虾青素|astaxanthin|角鲨烯|squalene|\\bnmn\\b|pqq|白藜芦醇|抗氧化|antioxid|抗衰|age protect|月光宝盒|anthogenol|mitoq|羊胎|placenta") },
  { group: "全身", label: "睡眠与情绪", scope: HEALTH, pattern: rule("睡眠|sleep|助眠|褪黑|樱桃|cherry|安神|情绪|mood|stress|压力|圣约翰") },
  { group: "全身", label: "能量与抗疲劳", scope: HEALTH, pattern: rule("b族|维b|b12|executive b|b complex|能量|energy|疲劳|人参|ginseng|鹿茸|鹿血|red power|蜂花粉|bee pollen|cyclopower") },
  { group: "全身", label: "补铁补血", scope: HEALTH, pattern: rule("铁|iron|floradix|b12|甲钴胺|补血") },
  { group: "全身", label: "综合营养", scope: HEALTH, pattern: rule("多维|multi|综合维|多种维生素|女维|男维|女士维生素|营养粉|ensure|安素|蔬菜软糖|蛋白粉|whey|protein") },
  { group: "全身", label: "解酒", scope: HEALTH, pattern: rule("解酒|hangover") },
  { group: "美容", label: "美容养颜", scope: HEALTH, pattern: rule("胶原|collagen|vida ?glow|hair,? ?skin|skin ?nails|焕颜|焕肤|雪肌|美颜|luminous|beauty|regeneration|brightskin|提亮|鹿胎|inner glow|玫瑰|rose|羊胎|placenta|蜂王浆|royal jelly|美白|烟酰胺|nicotinamide|玻尿酸|hyaluronic") },
  { group: "美容", label: "头发", scope: HEALTH_AND_HAIR, pattern: rule("生物素|biotin|生发|防脱|hair,? ?skin|头发") },
  { group: "人群专项", label: "女性健康", scope: HEALTH, pattern: rule("蔓越莓|cranberry|妇科|女性|女士|women|lady|更年期|menopause|女维|蜂王浆|月见草|evening primrose|\\bepo\\b|圣洁|vitex|chaste|痛经|naprogesic|nuwoman|hormone|荷尔蒙|肌醇|inositol|卵巢") },
  { group: "人群专项", label: "男性健康", scope: HEALTH, pattern: rule("前列腺|prostate|男性|\\bmen\\b|男维|生蚝|oyster|鹿鞭|鹿茸|袋鼠|锯棕榈") },
  { group: "人群专项", label: "孕产", scope: HEALTH, pattern: rule("孕|pregnan|叶酸|folic|elevit|爱乐维|conception") },
  { group: "人群专项", label: "儿童成长", scope: HEALTH, pattern: rule("成长|赖氨酸|lysine|长高|growth|ezz|挑食") },
  { group: "护肤", label: "保湿补水", scope: SKIN, pattern: rule("保湿|补水|hydrat|moistur|玻尿酸|hyaluronic|绵羊油|lanolin|lanocreme|芦荟|aloe|乳木果|shea") },
  { group: "护肤", label: "修护", scope: SKIN, pattern: rule("修护|修复|repair|木瓜|papaw|屏障|barrier|万用") },
  { group: "护肤", label: "抗皱紧致", scope: SKIN, pattern: rule("抗衰|抗皱|紧致|firming|胶原|collagen|玻色因|xylane|zylane|胜肽|peptide|羊胎|placenta|鱼子|caviar|24k|蜂毒") },
  { group: "护肤", label: "美白提亮", scope: SKIN, pattern: rule("美白|提亮|bright|\\bvc\\b|vc |维c|vitamin ?c|烟酰胺|nicotinamide|whiten") },
  { group: "护肤", label: "祛疤", scope: SKIN, pattern: rule("疤|scar|dermatix") },
  { group: "护肤", label: "防晒", scope: SKIN, pattern: rule("防晒|spf|sunscreen") },
  { group: "护肤", label: "舒缓敏感", scope: SKIN, pattern: rule("舒缓|敏感|sensitive|calm|雅漾|avene|\\bqv\\b|茶树|tea ?tree") },
  { group: "口腔", label: "牙齿美白去渍", scope: ORAL, pattern: rule("烟民|美白|whiten|苏打|soda") },
  { group: "口腔", label: "防蛀", scope: ORAL, pattern: rule("防蛀|fluoride|含氟|complete ?care|kids") },
  { group: "口腔", label: "牙龈护理", scope: ORAL, pattern: rule("牙龈|gum|蜂胶|propolis|草本|herb") },
  { group: "口腔", label: "清新口气", scope: ORAL, pattern: rule("柠檬|lemon|mint|清新|薄荷") },
];

const AUDIENCE_RULES: { label: string; pattern: RegExp }[] = [
  { label: "婴幼儿", pattern: rule("婴|baby|infant|toddler|宝宝") },
  { label: "儿童", pattern: rule("儿童|kids?\\b|child|junior|小孩|童年|teddi|男孩|女孩|boys?|girls?") },
  { label: "青少年", pattern: rule("青少年|teen") },
  { label: "孕产", pattern: rule("孕|pregnan|elevit|爱乐维|哺乳") },
  { label: "女性", pattern: rule("女|women|woman|lady|妇科|femfresh|menopause|更年期") },
  { label: "男性", pattern: rule("男(?!孩)|\\bmen\\b|\\bman\\b|prostate|前列腺|鹿鞭") },
  { label: "中老年", pattern: rule("中老年|50 ?\\+|60 ?\\+|老人|senior|50s|60s") },
];

const byCode = new Map(CATEGORY_RULES.map(({ code, level1, level2 }) => [code, { code, level1, level2 }]));

// The category of a product from its names; `manual` is the category typed in by a person, if any.
export function productCategory(names: (string | null | undefined)[], manual?: string | null): ProductCategory {
  const typed = manual?.trim();
  if (typed) return [...byCode.values()].find((category) => category.level2 === typed || `${category.level1}/${category.level2}` === typed) ?? { code: 'M', level1: typed, level2: typed };
  const text = names.filter(Boolean).join(' ');
  const match = CATEGORY_RULES.find((candidate) => candidate.pattern.test(text));
  return match ? { code: match.code, level1: match.level1, level2: match.level2 } : UNCLASSIFIED;
}

export function productFunctions(names: (string | null | undefined)[], category: ProductCategory): string[] {
  const text = names.filter(Boolean).join(' ');
  return FUNCTION_RULES.filter((candidate) => candidate.scope.includes(category.level1) && candidate.pattern.test(text)).map((candidate) => candidate.label);
}

export function productAudiences(names: (string | null | undefined)[]): string[] {
  const text = names.filter(Boolean).join(' ');
  return AUDIENCE_RULES.filter((candidate) => candidate.pattern.test(text)).map((candidate) => candidate.label);
}
