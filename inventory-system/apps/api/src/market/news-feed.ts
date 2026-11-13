// Industry news (REQ-016 part 3): reading RSS 2.0 / Atom feeds and tagging articles with the store's topics.
// Pure functions only; fetching and storage live in news.service.ts.
import { isIP } from 'node:net';

export type FeedEntry = { title: string; summary: string | null; link: string; publishedAt: Date | null };

export const NEWS_MAX_AGE_DAYS = 90;
const TITLE_MAX = 300;
const SUMMARY_MAX = 600;
const LINK_MAX = 700;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™', eacute: 'é',
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const value = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

// Feed text may be CDATA, escaped HTML or both: unwrap, decode, drop tags, decode what the tags carried, tidy spaces.
export function plainText(raw: string) {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const withoutTags = decodeEntities(unwrapped)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

function clip(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function element(block: string, names: string[]) {
  for (const name of names) {
    const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
    if (match && match[1].trim()) return match[1];
  }
  return null;
}

function attribute(tag: string, name: string) {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return match ? decodeEntities(match[2] ?? match[3] ?? '') : null;
}

// Atom gives links as <link href="…" rel="alternate"/>; RSS as <link>…</link>, sometimes only as a permalink guid.
function entryLink(block: string) {
  const atomLinks = [...block.matchAll(/<link\b[^>]*\/?>/gi)].map((match) => match[0]).filter((tag) => attribute(tag, 'href'));
  const alternate = atomLinks.find((tag) => (attribute(tag, 'rel') ?? 'alternate') === 'alternate');
  if (alternate) return attribute(alternate, 'href');
  const rssLink = element(block, ['link']);
  if (rssLink) return plainText(rssLink);
  const guid = /<guid(\s[^>]*)?>([\s\S]*?)<\/guid>/i.exec(block);
  if (guid && !/isPermaLink\s*=\s*["']false["']/i.test(guid[1] ?? '')) return plainText(guid[2]);
  return null;
}

export function safeLink(value: string | null) {
  if (!value || value.length > LINK_MAX) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    // Tracking parameters differ between feeds that carry the same article; without them one article is one link.
    for (const key of [...url.searchParams.keys()]) if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return null;
  }
}

function entryDate(block: string) {
  const raw = element(block, ['pubDate', 'published', 'updated', 'dc:date']);
  if (!raw) return null;
  const date = new Date(plainText(raw));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Entries without a title or an http(s) link are dropped; so are entries older than the 90-day window.
export function parseFeed(xml: string, now = new Date()): FeedEntry[] {
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
  const oldest = now.getTime() - NEWS_MAX_AGE_DAYS * 86_400_000;
  const entries: FeedEntry[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    const title = plainText(element(block, ['title']) ?? '');
    const link = safeLink(entryLink(block));
    if (!title || !link || seen.has(link)) continue;
    const publishedAt = entryDate(block);
    if (publishedAt && publishedAt.getTime() < oldest) continue;
    const summary = plainText(element(block, ['description', 'summary', 'content:encoded', 'content']) ?? '');
    seen.add(link);
    entries.push({ title: clip(title, TITLE_MAX), summary: summary ? clip(summary, SUMMARY_MAX) : null, link, publishedAt });
  }
  return entries;
}

export function looksLikeFeed(text: string) {
  return /<(rss|feed|rdf:RDF)\b/i.test(text.slice(0, 2000));
}

// Addresses a feed may not resolve to: loopback, private, link-local, carrier-grade NAT, multicast and unspecified.
export function isPublicAddress(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224);
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPublicAddress(mapped[1]);
    return !(lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith('ff'));
  }
  return false;
}

// News topics. Function topics use the group and label names of the product taxonomy (CR-021) so a topic can be
// matched to products in stock; category topics match a product category instead. Patterns are written for article
// text: the product-name rules are too loose there ("growth", "vision" and "rose" are everyday business words).
export type NewsTopicKind = 'function' | 'category' | 'other';
export type NewsTopic = { key: string; group: string; label: string; kind: NewsTopicKind; pattern: RegExp };

const topic = (kind: NewsTopicKind, group: string, label: string, source: string): NewsTopic => (
  { key: `${group}/${label}`, group, label, kind, pattern: new RegExp(source, 'i') }
);

export const NEWS_TOPICS: NewsTopic[] = [
  topic('function', '心脑血管', '鱼油与 Omega-3', '\\bomega[- ]?3|fish oil|\\bkrill|\\bepa\\b|鱼油'),
  topic('function', '心脑血管', '护心', 'heart health|cardiovascular|cardiometabolic|\\bcoq10|coenzyme q10|心血管|护心'),
  topic('function', '心脑血管', '血脂胆固醇', 'cholesterol|blood lipid|胆固醇|血脂'),
  topic('function', '骨骼关节', '关节', 'joint health|\\bjoints?\\b|glucosamine|chondroitin|green[- ]lipped mussel|osteoarthritis|关节'),
  topic('function', '骨骼关节', '补钙与维 D', 'calcium|vitamin d\\b|bone health|osteoporosis|骨骼|补钙'),
  topic('function', '骨骼关节', '补镁', 'magnesium|补镁'),
  topic('function', '代谢管理', '血糖', 'blood sugar|blood glucose|diabet|glycaemic|glycemic|血糖'),
  topic('function', '代谢管理', '体重管理', 'weight management|weight loss|obesity|\\bglp-1|satiety|体重管理|减肥'),
  topic('function', '器官养护', '护肝', 'liver health|milk thistle|fatty liver|护肝'),
  topic('function', '器官养护', '护眼', 'eye health|\\blutein|zeaxanthin|macular|护眼|叶黄素'),
  topic('function', '器官养护', '益生菌', 'probiotic|prebiotic|postbiotic|synbiotic|microbiome|gut health|益生菌|肠道'),
  topic('function', '器官养护', '消化通便', 'digestive health|digestion|constipation|dietary fib(re|er)|消化'),
  topic('function', '器官养护', '泌尿健康', 'cranberr|urinary tract|泌尿'),
  topic('function', '免疫与精力', '免疫力', 'immun|vitamin c\\b|\\bzinc\\b|elderberr|propolis|colostrum|lactoferrin|免疫'),
  topic('function', '免疫与精力', '能量与抗疲劳', 'fatigue|ginseng|vitamin b12|b vitamins|energy drink|抗疲劳'),
  topic('function', '免疫与精力', '综合营养', 'multivitamin|multi-vitamin|whey protein|protein powder|综合维生素'),
  topic('function', '脑与情绪', '睡眠', '\\bsleep|melatonin|insomnia|睡眠'),
  topic('function', '脑与情绪', '情绪压力', '\\bstress\\b|anxiety|\\bmood\\b|mental (health|wellbeing)|cortisol|情绪|压力'),
  topic('function', '脑与情绪', '健脑益智', 'cognitive|cognition|brain health|\\bmemory\\b|\\bdha\\b|nootropic|健脑'),
  topic('function', '美容抗衰', '胶原蛋白', 'collagen|胶原'),
  topic('function', '美容抗衰', '美容养颜', 'beauty from within|nutricosmetic|beauty supplement|skin health|hair health|美容'),
  topic('function', '美容抗衰', '抗氧化与抗衰', 'healthy (ageing|aging)|longevity|anti-?(ageing|aging)|antioxidant|\\bnmn\\b|\\bnad\\+|抗衰|抗氧化'),
  topic('function', '人群专项', '女性健康', "women'?s health|menopaus|\\bpms\\b|female health|女性健康|更年期"),
  topic('function', '人群专项', '男性健康', "men'?s health|prostate|testosterone|男性健康"),
  topic('function', '人群专项', '孕产', 'pregnan|prenatal|maternal|breastfeed|lactating|孕'),
  topic('function', '人群专项', '儿童成长', '\\bchild(ren)?\\b|\\bkids?\\b|paediatric|pediatric|toddler|儿童'),
  topic('category', '奶粉与乳制品', '奶粉与乳制品', 'infant formula|milk powder|\\bformula milk|\\bdairy\\b|\\ba2 milk|奶粉|乳制品'),
  topic('category', '食品', '蜂蜜', '\\bhoney\\b|manuka|蜂蜜'),
  topic('category', '护肤品', '护肤品', 'skincare|skin care|sunscreen|cosmetic|护肤'),
  topic('other', '行业', '监管与召回', '\\bregulat|\\brecall|\\btga\\b|\\bmpi\\b|medsafe|\\bfsanz\\b|\\bfda\\b|\\bsamr\\b|监管|召回'),
  topic('other', '行业', '跨境与中国市场', 'cross-border|\\bchina\\b|chinese consumers|daigou|tmall|jd\\.com|douyin|xiaohongshu|跨境|代购'),
];

export function newsTopics(text: string) {
  return NEWS_TOPICS.filter((candidate) => candidate.pattern.test(text));
}
