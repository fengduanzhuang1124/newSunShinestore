import {
  analyzeQuestion, ASK_STAGE, BUILT_IN_ALIASES, composeReply, expiryLabel, isAmbiguous, isMailMilkName, mailReply, matchingAnswers,
  needsStage, parseMailMilkName, rankCandidates, settleByStock, sizeQuestion, storeReply, type MailFacts, type ProductCandidate, type StoreFacts,
} from './assistant-rules.js';

const mail = (id: string, name: string): ProductCandidate => {
  const parsed = parseMailMilkName(name);
  return { id, names: name, barcodes: [], mail: { displayName: parsed.displayName, line: parsed.line, stage: parsed.stage } };
};
const store = (id: string, names: string, barcodes: string[] = []): ProductCandidate => ({ id, names, barcodes, mail: null });
const mailFacts = (overrides: Partial<MailFacts>): MailFacts => ({
  productId: '1', displayName: '可瑞康山羊奶粉 1段', line: 'NORMAL', stage: 1, packCount: 3, packUnit: '罐', priceCents: 16800,
  transitText: '6–8周', shipFrom: '新西兰', promoText: null, promoDiscountCents: null, outOfStock: false, ...overrides,
});

describe('mail-order milk names (REQ-015)', () => {
  it('reads line, stage, pack and a Chinese name from POS names', () => {
    expect(parseMailMilkName('karicare goat 1 3tins')).toMatchObject({ line: 'NORMAL', stage: 1, packCount: 3, packUnit: '罐', displayName: '可瑞康山羊奶粉 1段', transitText: '6–8周' });
    expect(parseMailMilkName('Karicare Goat SF 1* 6tins')).toMatchObject({ line: 'EXPRESS', stage: 1, packCount: 6, transitText: '7–10个工作日' });
    expect(parseMailMilkName('Karicare Gold 1*3 SF')).toMatchObject({ line: 'EXPRESS', stage: 1, packCount: 3, displayName: '可瑞康金装 1段' });
    expect(parseMailMilkName('karicare goat 2rd 3tin')).toMatchObject({ stage: 2, packCount: 3 });
    expect(parseMailMilkName('Aptamil Pro 4 SF* 3TINS')).toMatchObject({ line: 'EXPRESS', stage: 4, packCount: 3, displayName: '爱他美铂金 4段' });
    expect(parseMailMilkName('Aptamil 2 gold*3')).toMatchObject({ stage: 2, packCount: 3, displayName: '爱他美金装 2段' });
    expect(parseMailMilkName('A2 pro 1 SF *6 tins')).toMatchObject({ line: 'EXPRESS', stage: 1, packCount: 6, displayName: 'a2白金 1段' });
    expect(parseMailMilkName('Anchor Full cream 1kg SF *6')).toMatchObject({ line: 'EXPRESS', stage: null, packCount: 6, packUnit: '袋', displayName: '安佳全脂奶粉', promoText: '买一箱立减5纽币', promoDiscountCents: 500 });
    expect(parseMailMilkName('Anchor Trim cream 1kg SF *6')).toMatchObject({ packUnit: '袋', promoDiscountCents: 500 });
    expect(parseMailMilkName('Anchor Full cream 900g SF *6 tins')).toMatchObject({ packUnit: '罐', promoText: null, promoDiscountCents: null });
    expect(parseMailMilkName('karicare goat 1 3tins')).toMatchObject({ promoText: null, promoDiscountCents: null });
    expect(parseMailMilkName('A2 Milk Powder Adult 6bags')).toMatchObject({ packCount: 6, packUnit: '袋', stage: null, shipFrom: '新西兰' });
    expect(parseMailMilkName('maxigenes full cream 1kg*3（AU）')).toMatchObject({ packCount: 3, packUnit: '罐', shipFrom: '澳洲', displayName: '美可卓蓝胖子全脂' });
    expect(parseMailMilkName('beilami stage2 *6s ex. gst')).toMatchObject({ stage: 2, packCount: 6, shipFrom: '澳洲' });
  });

  it('only treats milk with a pack in its name as mail-order', () => {
    expect(isMailMilkName('aptamil pro stage1 3tins')).toBe(true);
    expect(isMailMilkName('Mei Ke Zhuo full cream *6s')).toBe(true);
    expect(isMailMilkName('LACUES 胶原蛋白 面膜 *5')).toBe(false);
    expect(isMailMilkName('Aptamil Gold+ 1 900g')).toBe(false);
  });
});

describe('question analysis and matching', () => {
  const candidates = [
    mail('1', 'karicare goat 1 3tins'), mail('2', 'Karicare Goat SF 1* 6tins'), mail('3', 'karicare goat 2rd 3tin'),
    mail('4', 'aptamil pro stage1 3tins'), store('5', 'Karicare Goat Milk 1 900g 可瑞康山羊奶粉1段', ['9421000000001']),
    store('6', 'Nutralife fish oil 1500mg 鱼油'),
  ];

  it('reads intent, line and stage from Chinese questions', () => {
    const analysis = analyzeQuestion('可瑞康山羊奶1段顺丰多少钱？', BUILT_IN_ALIASES);
    expect(analysis).toMatchObject({ intents: ['price'], line: 'EXPRESS', stage: 1, mailCue: true, handoff: false });
    expect(analysis.keywords).toEqual(expect.arrayContaining(['karicare', 'goat']));
    expect(analyzeQuestion('二段有货吗', [])).toMatchObject({ stage: 2, intents: ['stock'] });
    expect(analyzeQuestion('孕妇可以吃吗', []).handoff).toBe(true);
  });

  it('matches Chinese wording to English POS names and keeps the asked stage', () => {
    const ranked = rankCandidates(analyzeQuestion('可瑞康山羊奶1段多少钱', BUILT_IN_ALIASES), candidates);
    expect(ranked.map((row) => row.candidate.id)).not.toContain('3');
    expect(ranked.map((row) => row.candidate.id).slice(0, 3)).toEqual(expect.arrayContaining(['1', '2']));
  });

  it('prefers an exact barcode, asks for the stage and flags close runner-ups', () => {
    const ranked = rankCandidates(analyzeQuestion('9421000000001 有货吗', []), candidates);
    expect(ranked[0]).toMatchObject({ score: 100, candidate: { id: '5' } });
    expect(isAmbiguous(ranked)).toBe(false);
    const vagueAnalysis = analyzeQuestion('可瑞康羊奶有货吗', BUILT_IN_ALIASES);
    expect(needsStage(vagueAnalysis, rankCandidates(vagueAnalysis, candidates))).toBe(true);
    const fishOil = analyzeQuestion('鱼油有货吗', BUILT_IN_ALIASES);
    expect(needsStage(fishOil, rankCandidates(fishOil, candidates))).toBe(false);
    const two = [store('7', 'Swisse 胶原蛋白 口服液'), store('8', 'Swisse 胶原蛋白 片')];
    const collagen = analyzeQuestion('swisse胶原蛋白多少钱', []);
    expect(isAmbiguous(rankCandidates(collagen, two))).toBe(true);
  });
});

describe('sizes and duplicate records', () => {
  const liver = [
    store('1608', 'swisse 120粒护肝 swisse liver detox 120tabs'), store('1609', 'swisse 200粒护肝1 swisse liver detox 200s'),
    store('1700', 'swisse 月见草200粒 swisse EPO 200s'), store('1701', 'swisse 200粒护肝 swisse liver 200ta'),
  ];

  it('splits a brand typed against its size and rules out other sizes', () => {
    const ranked = rankCandidates(analyzeQuestion('swiss200粒护肝有货吗', []), liver);
    expect(ranked.map((row) => row.candidate.id)).not.toContain('1608');
    expect(ranked[0].candidate.id).toMatch(/^(1609|1701)$/);
    expect(ranked[0].score).toBeGreaterThan(ranked.find((row) => row.candidate.id === '1700')!.score);
  });

  it('answers about the only in-stock record when duplicates tie', () => {
    const ranked = rankCandidates(analyzeQuestion('swisse 200粒护肝有货吗', []), liver);
    expect(isAmbiguous(ranked)).toBe(true);
    expect(settleByStock(ranked, new Map([['1609', 25], ['1701', 0]]))?.candidate.id).toBe('1609');
    expect(settleByStock(ranked, new Map([['1609', 25], ['1701', 3]]))).toBeNull();
  });

  it('asks for the size when close matches differ only in size', () => {
    const ranked = rankCandidates(analyzeQuestion('swiss 护肝有货吗', []), liver.slice(0, 2));
    expect(sizeQuestion(ranked)).toBe('亲要120粒还是200粒的呢～告诉我帮您查哈～');
    expect(sizeQuestion(rankCandidates(analyzeQuestion('swisse 200粒护肝', []), liver))).toBeNull();
  });
});

describe('replies', () => {
  const facts: StoreFacts = {
    productId: '5', name: '可瑞康山羊奶粉1段', priceCents: 4999, recentDiscountCents: null,
    batches: [{ expiryDate: '2029-03-31', precision: 'MONTH', quantity: 4 }, { expiryDate: '2028-05-31', precision: 'DATE', quantity: 2 }],
  };

  it('says "有货" with the oldest date and never the quantity', () => {
    const reply = storeReply(analyzeQuestion('这款有货吗', []), facts);
    expect(reply.text).toBe('有货哦～日期是28年5月哈～');
    expect(reply.text).not.toMatch(/[246]个|数量/);
    expect(storeReply(analyzeQuestion('多少钱', []), facts).text).toBe('可瑞康山羊奶粉1段 49.99纽币哦～');
    expect(storeReply(analyzeQuestion('有货吗多少钱', []), facts).text).toBe('有货哦～可瑞康山羊奶粉1段 49.99纽币，日期是28年5月哈～');
  });

  it('says out of stock and warns when an in-store product is asked for mailing', () => {
    expect(storeReply(analyzeQuestion('有货吗', []), { ...facts, batches: [] }).text).toBe('可瑞康山羊奶粉1段暂时没货哦～到货了第一时间告诉您哈～');
    const mailing = storeReply(analyzeQuestion('可以邮寄吗', []), facts);
    expect(mailing.text).toContain('不能邮寄');
    expect(mailing.notes[0]).toContain('不能邮寄');
  });

  it('asks a person to check a missing price instead of inventing one', () => {
    const reply = storeReply(analyzeQuestion('多少钱', []), { ...facts, priceCents: null });
    expect(reply.needsHuman).toBe(true);
    expect(reply.text).not.toMatch(/纽币/);
  });

  it('lists both mail lines with packs, transit and promotions', () => {
    const rows = [mailFacts({}), mailFacts({ productId: '2', line: 'EXPRESS', packCount: 6, priceCents: 37500, transitText: '7–10个工作日' })];
    expect(mailReply(analyzeQuestion('可瑞康山羊奶1段多少钱', []), rows).text)
      .toBe('可瑞康山羊奶粉 1段：普通线 3罐 168纽币包邮，6–8周到哈～顺丰线 6罐 375纽币，7–10个工作日到哈～');
    expect(mailReply(analyzeQuestion('顺丰多少钱', []), rows).text).toBe('可瑞康山羊奶粉 1段：顺丰线 6罐 375纽币，7–10个工作日到哈～');
    const anchor = mailFacts({ displayName: '安佳全脂奶粉', line: 'EXPRESS', packCount: 6, packUnit: '袋', priceCents: 11500, transitText: '7–10天', promoText: '买一箱立减5纽币', promoDiscountCents: 500 });
    expect(mailReply(analyzeQuestion('安佳全脂多少钱', []), [anchor]).text).toBe('安佳全脂奶粉：顺丰线 6袋 115纽币，买一箱立减5纽币，到手110纽币，7–10天到哈～');
    const tins = mailFacts({ displayName: '安佳全脂奶粉', line: 'EXPRESS', packCount: 6, priceCents: 13000, transitText: '7–10天' });
    expect(mailReply(analyzeQuestion('安佳全脂袋装多少钱', []), [tins, anchor]).text).not.toContain('6罐');
  });

  it('marks out-of-stock lines and leaves mail-order dates to the warehouse', () => {
    const reply = mailReply(analyzeQuestion('日期是多久的', []), [mailFacts({ outOfStock: true })]);
    expect(reply.text).toContain('暂时断货');
    expect(reply.text).toContain('日期帮您确认一下哦～');
    expect(reply.needsHuman).toBe(true);
    expect(reply.notes).toContain('邮寄奶粉的日期随批次变化，请向仓库确认后回复');
    expect(mailReply(analyzeQuestion('多少钱', []), [mailFacts({})]).needsHuman).toBe(false);
  });

  it('adds fixed answers, hands health questions to a person and asks for the stage when unclear', () => {
    const analysis = analyzeQuestion('寄新疆运费多少，孕妇能喝吗', []);
    const answers = matchingAnswers(analysis, [{ topic: '偏远运费', keywords: '新疆，甘肃、青海', reply: '新疆3罐需另加10纽币运费哦～', handoff: false }]);
    const reply = composeReply(analysis, null, answers, null);
    expect(reply.text).toContain('转给专业的同事');
    expect(reply.text).toContain('新疆3罐需另加10纽币');
    expect(reply.needsHuman).toBe(true);
    expect(composeReply(analyzeQuestion('可瑞康羊奶多少钱', []), null, [], ASK_STAGE).text).toContain('几段');
    expect(composeReply(analyzeQuestion('孕妇能喝可瑞康羊奶吗', []), null, [], ASK_STAGE).text).not.toContain('几段');
    expect(composeReply(analyzeQuestion('那个白色的', []), null, [], null).text).toContain('哪一款');
  });

  it('labels expiry by year and month', () => {
    expect(expiryLabel('2028-05-31')).toBe('28年5月');
  });
});
