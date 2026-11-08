// 阳光小助手 reply rules (REQ-015 stage 2). Pure functions only: the service loads data, these decide what the
// question asks, which product it means and how the reply reads. Prices and dates always come from the facts passed in.

export type MailLine = 'NORMAL' | 'EXPRESS';
export type Intent = 'stock' | 'price' | 'expiry' | 'shipping';
export type ExpiryPrecision = 'DATE' | 'MONTH';

export type Analysis = {
  text: string;
  intents: Intent[];
  line: MailLine | null;
  stage: number | null;
  packUnit: '罐' | '袋' | null;
  mailCue: boolean;
  handoff: boolean;
  barcode: string | null;
  keywords: string[];
  numbers: string[];
  sizes: string[];
};

export type ProductCandidate = {
  id: string;
  names: string;
  barcodes: string[];
  mail: { displayName: string; line: MailLine; stage: number | null } | null;
};

export type Ranked = { candidate: ProductCandidate; score: number };

export type StoreFacts = {
  productId: string;
  name: string;
  priceCents: number | null;
  batches: { expiryDate: string; precision: ExpiryPrecision; quantity: number }[];
  recentDiscountCents: number | null;
};

export type MailFacts = {
  productId: string;
  displayName: string;
  line: MailLine;
  stage: number | null;
  packCount: number;
  packUnit: string;
  priceCents: number | null;
  transitText: string;
  shipFrom: string;
  promoText: string | null;
  promoDiscountCents: number | null;
  outOfStock: boolean;
};

export type FixedAnswer = { topic: string; keywords: string; reply: string; handoff: boolean };

export type Reply = { text: string; needsHuman: boolean; notes: string[] };

export const MAIL_TRANSIT: Record<MailLine, string> = { NORMAL: '6–8周', EXPRESS: '7–10个工作日' };
export const LINE_LABEL: Record<MailLine, string> = { NORMAL: '普通线', EXPRESS: '顺丰线' };
const LINE_ORDER: Record<MailLine, number> = { NORMAL: 0, EXPRESS: 1 };
export const MATCH_MIN_SCORE = 3;
// A runner-up this close to the best match means the question could be either product.
const AMBIGUOUS_RATIO = 0.85;
const HANDOFF_REPLY = '这个问题我帮您转给专业的同事确认一下哦～请稍等哈～';
const NOT_FOUND_REPLY = '亲～您问的是哪一款呀？可以发一下图片或者完整的名字吗～';

// Customer wording that rarely appears in product names. Staff add more in assistant_aliases.
export const BUILT_IN_ALIASES: [string, string][] = [
  ['爱他美', 'aptamil'], ['可瑞康', 'karicare'], ['安佳', 'anchor'], ['贝拉米', 'beilami bellamy'], ['雅培', 'abbott'],
  ['安素', 'ensure'], ['贺寿利', 'healtheries'], ['德运', 'deyun devondale'], ['美可卓', 'mei ke zhuo maxigenes'],
  ['蓝胖子', 'maxigenes'], ['山羊', 'goat'], ['羊奶', 'goat'], ['绵羊', 'sheep'], ['铂金', 'pro'], ['白金', 'pro'],
  ['金装', 'gold'], ['深度水解', 'allerpro'], ['全脂', 'full'], ['脱脂', 'trim skim'], ['康维他', 'comvita'],
  ['澳佳宝', 'blackmores'], ['斯维诗', 'swisse'], ['鱼油', 'fish oil'], ['蜂蜜', 'honey'], ['麦卢卡', 'manuka'],
];

const INTENT_PATTERNS: [Intent, RegExp][] = [
  ['stock', /有货|有没有|还有吗|有吗|现货|缺货|没货|断货|库存/],
  ['price', /多少钱|价格|几钱|多钱|怎么卖|报价|多少纽|多少刀|price/i],
  ['expiry', /日期|到期|保质|效期|新鲜|生产日|批次/],
  ['shipping', /多久|几天|时效|到货|发货|几周|快递/],
];
const MAIL_CUE = /邮寄|寄|包邮|顺丰|\bsf\b|普通线|直邮|快线|发货|运费|几天到|多久到/i;
const EXPRESS_CUE = /顺丰|\bsf\b|快线/i;
const NORMAL_CUE = /普通线|普通|直邮|慢线/;
const HANDOFF_CUE = /孕妇|怀孕|备孕|哺乳|过敏|生病|疾病|副作用|不良反应|投诉|退款|退货|赔偿|医生|吃药|药物|发烧|腹泻|便秘/;
const CHINESE_DIGITS: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 1: 1, 2: 2, 3: 3, 4: 4 };
// Wording about the question itself, removed before matching names so "多少钱" does not match products.
const QUESTION_WORDS = /请问|你好|您好|亲|多少钱|多少|价格|有货|有没有|还有|有吗|没有|日期|到期|保质期|保质|几段|什么时候|什么|一下|这个|那个|这款|那款|可以|邮寄|包邮|顺丰|普通线|普通|直邮|运费|多久|几天|发货|现在|吗|呢|呀|啊|的|[一二三四1-4]\s*段|\d+\s*[罐袋]/g;
const MILK_BRANDS = /karicare|aptamil|\ba2\b|anchor|abbott|ensure|healtheries goat|beilami|bellamy|devondale|deyun|mei ke zhuo|maxigenes|taupo|fresco|goat|sheep|milk powder|full cream|trim cream|skim cream|allerpro|immunohalo/i;
const PACK_PATTERN = /\d+\s*tins?\b|\d+\s*bags?\b|\*\s*\d+|\bsf\b/i;
// Price-list promotion on Anchor bags, filled in when the settings are first created; staff change it there.
const ANCHOR_BAG_PROMOTION = { promoText: '买一箱立减5纽币', promoDiscountCents: 500 };
// Shipped from Australia according to the price list.
const AUSTRALIAN_STOCK = /beilami|bellamy|abbott|maxigenes|\(au\)|（au）/i;
const COUNT_SIZE = /(\d{2,4})\s*(?:粒|片|颗|caps?\b|capsules?|tabs?\b|tablets?|softgels?|ta\b|s\b)/gi;
const SIZE_LABEL = /(\d{2,4})\s*(粒|片|颗|caps?\b|capsules?|tabs?\b|tablets?|softgels?|s\b)/i;
const STAGE_IN_NAME = /(?<![\w.*])([1-4])(?:st|nd|rd|th)?(?![\w.]|\s*(?:tins?|bags?|kg|g|ml)\b)/i;
const MAIL_SERIES: [RegExp, string][] = [
  [/karicare\s+goat/i, '可瑞康山羊奶粉'], [/karicare\s+sheep/i, '可瑞康绵羊奶粉'], [/karicare\s+gold/i, '可瑞康金装'],
  [/aptamil\s+allerpro/i, '爱他美深度水解'], [/aptamil.*\bpro\b/i, '爱他美铂金'], [/aptamil.*gold/i, '爱他美金装'],
  [/a2\s+pro/i, 'a2白金'], [/a2 milk powder adult/i, 'A2成人奶粉'], [/anchor\s+full/i, '安佳全脂奶粉'],
  [/anchor\s+trim/i, '安佳脱脂奶粉'], [/anchor\s+immunohalo/i, '安佳益生菌免疫奶粉'], [/abbott\s+ensure/i, '雅培安素'],
  [/healtheries\s+goat/i, '贺寿利羊奶粉'], [/beilami|bellamy/i, '贝拉米'], [/(deyun|devondale).*full/i, '德运全脂奶粉'],
  [/(deyun|devondale).*(trim|skim)/i, '德运脱脂奶粉'], [/maxigenes.*full/i, '美可卓蓝胖子全脂'],
  [/maxigenes.*skim/i, '美可卓蓝胖子脱脂'], [/mei ke zhuo.*full/i, '美可卓全脂奶粉'], [/mei ke zhuo.*skim/i, '美可卓脱脂奶粉'],
  [/taupo.*a2/i, 'Taupo A2奶粉'], [/taupo.*trim/i, 'TaupoPure脱脂'], [/taupo/i, 'TaupoPure全脂'], [/fresco/i, 'Fresco羊奶粉'],
];

export function normalizeText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function detectStage(text: string) {
  const match = text.match(/([一二三四1-4])\s*段|stage\s*([1-4])/i);
  const digit = match?.[1] ?? match?.[2];
  return digit ? CHINESE_DIGITS[digit] ?? null : null;
}

export function detectLine(text: string): MailLine | null {
  if (EXPRESS_CUE.test(text)) return 'EXPRESS';
  if (NORMAL_CUE.test(text)) return 'NORMAL';
  return null;
}

export function analyzeQuestion(question: string, aliases: [string, string][]): Analysis {
  const text = normalizeText(question);
  const intents = INTENT_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([intent]) => intent);
  const barcode = text.match(/\b\d{8,14}\b/)?.[0] ?? null;
  const keywords = aliases.filter(([term]) => term && text.includes(normalizeText(term))).flatMap(([, keyword]) => normalizeText(keyword).split(' '));
  return {
    text,
    intents,
    line: detectLine(text),
    stage: detectStage(text),
    packUnit: /袋/.test(text) ? '袋' : /罐/.test(text) ? '罐' : null,
    mailCue: MAIL_CUE.test(text),
    handoff: HANDOFF_CUE.test(text),
    barcode,
    keywords: [...new Set(keywords.filter(Boolean))],
    numbers: [...new Set(text.match(/(?<![\d.])\d{2,6}(?![\d.])/g) ?? [])],
    sizes: countSizes(text),
  };
}

// Mail-order milk is recognised by name: a milk brand plus a pack such as "3tins", "*6" or "SF".
export function isMailMilkName(name: string) {
  return MILK_BRANDS.test(name) && PACK_PATTERN.test(name);
}

export function parseMailMilkName(name: string) {
  const tins = name.match(/(\d+)\s*tins?\b/i);
  const bags = name.match(/(\d+)\s*bags?\b/i);
  const star = name.match(/\*\s*(\d+)/);
  const packCount = Number(tins?.[1] ?? bags?.[1] ?? star?.[1] ?? 3);
  const bagged = Boolean(bags) || (!tins && /1\s*kg/i.test(name) && /anchor|taupo|deyun|devondale/i.test(name));
  const stageMatch = name.match(/stage\s*([1-4])/i) ?? name.match(STAGE_IN_NAME);
  const stage = stageMatch ? Number(stageMatch[1]) : null;
  const line: MailLine = /\bsf\b/i.test(name) ? 'EXPRESS' : 'NORMAL';
  const series = MAIL_SERIES.find(([pattern]) => pattern.test(name))?.[1];
  return {
    line,
    stage,
    packCount,
    packUnit: bagged ? '袋' : '罐',
    displayName: series ? `${series}${stage ? ` ${stage}段` : ''}` : name.trim(),
    transitText: MAIL_TRANSIT[line],
    shipFrom: AUSTRALIAN_STOCK.test(name) ? '澳洲' : '新西兰',
    ...(bagged && /anchor/i.test(name) ? ANCHOR_BAG_PROMOTION : { promoText: null, promoDiscountCents: null }),
  };
}

function chineseBigrams(text: string) {
  const runs = text.replace(QUESTION_WORDS, ' ').match(/[一-鿿]{2,}/g) ?? [];
  const grams = new Set<string>();
  for (const run of runs) for (let index = 0; index < run.length - 1; index += 1) grams.add(run.slice(index, index + 2));
  return [...grams];
}

// Pack sizes such as "200粒", "120tabs", "200s": asking for one size rules out products that only come in others.
export function countSizes(text: string) {
  return [...new Set([...text.matchAll(COUNT_SIZE)].map((match) => match[1]))];
}

// Letters and digits are split ("swiss200" is "swiss" and 200) so a brand typed against a size still matches.
function latinWords(text: string) {
  const words = text.replace(QUESTION_WORDS, ' ').match(/[a-z]{2,}\+?|\b[a-z]\d\b/g) ?? [];
  return [...new Set(words.filter((word) => word !== 'sf'))];
}

export function candidateStage(candidate: ProductCandidate) {
  const stage = candidate.mail?.stage ?? detectStage(candidate.names) ?? candidate.names.match(STAGE_IN_NAME)?.[1];
  return stage ? Number(stage) : null;
}

export function scoreCandidate(analysis: Analysis, candidate: ProductCandidate) {
  if (analysis.barcode && candidate.barcodes.includes(analysis.barcode)) return 100;
  const stage = candidateStage(candidate);
  if (analysis.stage && stage && stage !== analysis.stage) return 0;
  const haystack = normalizeText(`${candidate.names} ${candidate.mail?.displayName ?? ''}`);
  const sizes = analysis.sizes.length ? countSizes(haystack) : [];
  if (sizes.length && !analysis.sizes.some((size) => sizes.includes(size))) return 0;
  const words = [...new Set([...latinWords(analysis.text), ...analysis.keywords])];
  let score = 0;
  for (const word of words) if (haystack.includes(word)) score += 2;
  for (const number of analysis.numbers) if (number !== analysis.barcode && new RegExp(`(?<!\\d)${number}(?!\\d)`).test(haystack)) score += 3;
  for (const gram of chineseBigrams(analysis.text)) if (haystack.includes(gram)) score += 1;
  if (score && analysis.stage && stage) score += 2;
  return score;
}

export function rankCandidates(analysis: Analysis, candidates: ProductCandidate[]): Ranked[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(analysis, candidate) }))
    .filter((row) => row.score >= MATCH_MIN_SCORE)
    .sort((left, right) => right.score - left.score);
}

// Infant milk comes in stages; without one, a close match at another stage means asking "几段" instead of guessing.
export function needsStage(analysis: Analysis, ranked: Ranked[]) {
  const [first] = ranked;
  const stage = first ? candidateStage(first.candidate) : null;
  if (analysis.stage || !first || stage === null || first.score >= 100) return false;
  return ranked.some((row) => row.score >= first.score * AMBIGUOUS_RATIO && ![null, stage].includes(candidateStage(row.candidate)));
}

// Close matches staff may mean; used for candidates and for settling a tie by stock.
export function closeMatches(ranked: Ranked[]) {
  const [first] = ranked;
  return first ? ranked.filter((row) => row.score >= first.score * AMBIGUOUS_RATIO) : [];
}

// Duplicate records of one product often tie; when only one of them has stock, that is the one to answer about.
export function settleByStock(ranked: Ranked[], stockById: Map<string, number>) {
  const inStock = closeMatches(ranked).filter((row) => (stockById.get(row.candidate.id) ?? 0) > 0);
  return inStock.length === 1 ? inStock[0] : null;
}

// Staff picked a product from the candidates, so there is nothing left to guess.
export function chosenTarget(candidate: ProductCandidate) {
  return { kind: candidate.mail ? 'mail' as const : 'store' as const, list: [{ candidate, score: 100 }], askStage: false, ambiguous: false };
}

export function isAmbiguous(ranked: Ranked[]) {
  const [first, second] = ranked;
  if (!first || !second || first.score >= 100) return false;
  const sameMailProduct = first.candidate.mail && second.candidate.mail && first.candidate.mail.displayName === second.candidate.mail.displayName;
  return !sameMailProduct && second.score >= first.score * AMBIGUOUS_RATIO;
}

// Mail-order milk when the question is about mailing; otherwise whichever kind matched better. In-store products
// with barcodes cannot be mailed, so a mailing question about one still answers about it and says so.
export function chooseTarget(analysis: Analysis, ranked: Ranked[]) {
  const mail = ranked.filter((row) => row.candidate.mail);
  const store = ranked.filter((row) => !row.candidate.mail);
  const asksInStore = analysis.intents.includes('stock') || analysis.intents.includes('expiry');
  const mailTop = mail[0]?.score ?? 0;
  const storeTop = store[0]?.score ?? 0;
  const mailWins = analysis.mailCue ? mail.length > 0 : mailTop > storeTop || (mailTop > 0 && mailTop === storeTop && !asksInStore);
  const list = mailWins ? mail : store;
  const kind: 'mail' | 'store' | 'none' = list.length ? (mailWins ? 'mail' : 'store') : 'none';
  const askStage = needsStage(analysis, list);
  return { kind, list, askStage, ambiguous: !askStage && isAmbiguous(list) };
}

// Stores keep expiry to the day or the month; customers are told the month, the oldest batch first.
export function expiryLabel(isoDate: string) {
  const [year, month] = isoDate.split('-');
  return `${year.slice(2)}年${Number(month)}月`;
}

export function amount(cents: number) {
  return (cents / 100).toFixed(2).replace(/\.?0+$/, '');
}

export function intentsFor(analysis: Analysis, kind: 'store' | 'mail'): Intent[] {
  if (analysis.intents.length) return analysis.intents;
  return kind === 'store' ? ['stock', 'price'] : ['price', 'shipping'];
}

export function storeReply(analysis: Analysis, facts: StoreFacts): Reply {
  const intents = intentsFor(analysis, 'store');
  const inStock = facts.batches.filter((batch) => batch.quantity > 0).sort((left, right) => left.expiryDate.localeCompare(right.expiryDate));
  const notes: string[] = [];
  if (analysis.mailCue) notes.push('店内有条码的商品不能邮寄；如客人要邮寄，请改推邮寄款');
  if (facts.recentDiscountCents !== null) notes.push(`近 14 天有低于原价的售出（最低 ${amount(facts.recentDiscountCents)} 纽币），报价前请确认是否有活动`);
  if (analysis.mailCue && !analysis.intents.includes('price') && !analysis.intents.includes('stock')) {
    return { text: `${facts.name}是店内商品，不能邮寄哦～可以帮您看看邮寄款哈～`, needsHuman: false, notes };
  }
  if (!inStock.length) return { text: `${facts.name}暂时没货哦～到货了第一时间告诉您哈～`, needsHuman: false, notes };
  const parts = [intents.includes('stock') || intents.includes('expiry') ? '有货哦～' : ''];
  if (intents.includes('price')) {
    if (facts.priceCents === null) notes.push('系统没有这个商品的零售价，请核对后再回复');
    else parts.push(`${facts.name} ${amount(facts.priceCents)}纽币，`);
  }
  if (intents.includes('expiry') || intents.includes('stock')) parts.push(`日期是${expiryLabel(inStock[0].expiryDate)}哈～`);
  const text = parts.join('').replace(/，$/, '哦～');
  return { text, needsHuman: intents.includes('price') && facts.priceCents === null, notes };
}

function mailLineText(row: MailFacts) {
  const head = `${LINE_LABEL[row.line]} ${row.packCount}${row.packUnit}`;
  if (row.outOfStock) return `${head}暂时断货哦～`;
  if (row.priceCents === null) return `${head}价格帮您确认一下哦～`;
  const shipping = row.line === 'NORMAL' ? '包邮' : '';
  const promo = row.promoDiscountCents ? `，${row.promoText ?? '活动价'}，到手${amount(row.priceCents - row.promoDiscountCents)}纽币` : '';
  return `${head} ${amount(row.priceCents)}纽币${shipping}${promo}，${row.transitText}到哈～`;
}

export function mailReply(analysis: Analysis, rows: MailFacts[]): Reply {
  const intents = intentsFor(analysis, 'mail');
  const wanted = rows.filter((row) => (!analysis.line || row.line === analysis.line) && (!analysis.packUnit || row.packUnit === analysis.packUnit));
  const shown = (wanted.length ? wanted : rows).slice().sort((left, right) => LINE_ORDER[left.line] - LINE_ORDER[right.line] || left.packCount - right.packCount);
  const notes = rows.some((row) => row.shipFrom !== '新西兰') ? [`发货地点：${[...new Set(rows.map((row) => row.shipFrom))].join('、')}`] : [];
  if ((analysis.line || analysis.packUnit) && !wanted.length) notes.push('没有客人问的线路或包装，已列出现有的全部');
  const lines = shown.map(mailLineText);
  // Mail-order expiry changes with every batch and is not kept, so a date question waits for the warehouse.
  if (intents.includes('expiry')) {
    lines.push('日期帮您确认一下哦～');
    notes.push('邮寄奶粉的日期随批次变化，请向仓库确认后回复');
  }
  const needsHuman = shown.some((row) => row.priceCents === null) || intents.includes('expiry');
  const available = intents.includes('stock') && shown.some((row) => !row.outOfStock) ? '有货哦～' : '';
  return { text: `${available}${shown[0].displayName}：${lines.join('')}`, needsHuman, notes };
}

export function matchingAnswers(analysis: Analysis, answers: FixedAnswer[]) {
  return answers.filter((answer) => answer.keywords.split(/[,，、\s]+/).some((keyword) => keyword && analysis.text.includes(normalizeText(keyword))));
}

// Puts the product reply, fixed answers and the hand-off together; a hand-off question never gets a product claim alone.
export const ASK_STAGE = '亲要几段的呢～告诉我帮您查哈～';

// Close matches that differ only in pack size ("120粒" / "200粒") are settled by asking for the size.
export function sizeQuestion(ranked: Ranked[]) {
  const labels = closeMatches(ranked).map((row) => row.candidate.names.match(SIZE_LABEL));
  if (labels.length < 2 || labels.length > 4 || labels.some((label) => !label)) return null;
  const sizes = [...new Set(labels.map((label) => `${label![1]}${/[粒片颗]/.test(label![2]) ? label![2] : '粒'}`))];
  return sizes.length === labels.length ? `亲要${sizes.join('还是')}的呢～告诉我帮您查哈～` : null;
}

// clarify is a question back to the customer (stage or size) when the product is not settled yet.
export function composeReply(analysis: Analysis, product: Reply | null, answers: FixedAnswer[], clarify: string | null): Reply {
  const notes = product ? [...product.notes] : [];
  const texts: string[] = [];
  let needsHuman = product?.needsHuman ?? false;
  if (analysis.handoff) {
    texts.push(HANDOFF_REPLY);
    needsHuman = true;
    notes.push('涉及健康、用药或售后，请人工回复；下方商品信息仅供参考');
  } else if (clarify) texts.push(clarify);
  else if (product) texts.push(product.text);
  for (const answer of answers) {
    texts.push(answer.reply);
    if (answer.handoff) needsHuman = true;
  }
  if (!texts.length) texts.push(NOT_FOUND_REPLY);
  return { text: texts.join('\n'), needsHuman, notes };
}
