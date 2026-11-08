import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  analyzeQuestion, ASK_STAGE, BUILT_IN_ALIASES, chooseTarget, chosenTarget, closeMatches, composeReply, expiryLabel, isMailMilkName, mailReply, matchingAnswers,
  parseMailMilkName, rankCandidates, settleByStock, sizeQuestion, storeReply, type MailFacts, type ProductCandidate, type Ranked, type StoreFacts,
} from './assistant-rules.js';
import type {
  AssistantAliasDto, AssistantAnswerDto, AssistantFeedbackDto, UpdateAssistantAliasDto, UpdateAssistantAnswerDto, UpdateMailMilkDto,
} from './assistant.dto.js';

const DISCOUNT_WINDOW_DAYS = 14;
const CANDIDATE_LIMIT = 5;

type MailProfileRow = {
  productId: bigint; displayName: string; line: 'NORMAL' | 'EXPRESS'; stage: number | null; packCount: number; packUnit: string;
  transitText: string; shipFrom: string; promoText: string | null; promoDiscountCents: number | null;
  outOfStock: boolean; enabled: boolean;
};
type StorePrice = { sellingPriceCents: number | null; level4PriceCents: number | null };
type CatalogRow = {
  id: bigint; name: string; englishName: string | null; chineseName: string | null;
  barcodes: { barcode: string }[]; storeProducts: StorePrice[]; mailMilkProfile: MailProfileRow | null;
};

// The retail price is the POS Level 4 price (CR-014); the POS item price stands in until Level 4 is synced.
const retailPrice = (price: StorePrice | undefined) => price?.level4PriceCents ?? price?.sellingPriceCents ?? null;
const PRICE_SELECT = { sellingPriceCents: true, level4PriceCents: true } as const;

// 阳光小助手 (REQ-015 stage 2): suggests a reply from this system's prices, stock and expiry dates and the mail-order
// milk settings. Reading happens here; deciding what to say happens in assistant-rules.ts.
@Injectable()
export class AssistantService {
  constructor(private readonly prisma: PrismaService) {}

  async reply(organizationId: bigint, userId: bigint, storeId: bigint, question: string, productId: bigint | null = null) {
    await this.storeAccess(organizationId, userId, storeId);
    const [catalog, aliases, answers] = await Promise.all([
      this.catalog(organizationId, storeId),
      this.prisma.client.assistantAlias.findMany({ where: { organizationId, enabled: true }, select: { term: true, keyword: true } }),
      this.prisma.client.assistantAnswer.findMany({ where: { organizationId, enabled: true }, select: { topic: true, keywords: true, reply: true, handoff: true } }),
    ]);
    const analysis = analyzeQuestion(question, [...BUILT_IN_ALIASES, ...aliases.map((alias): [string, string] => [alias.term, alias.keyword])]);
    const candidates = this.productCandidates(catalog);
    const chosen = productId === null ? null : candidates.find((candidate) => candidate.id === productId.toString());
    if (productId !== null && !chosen) throw new NotFoundException('商品不存在或已停用');
    let target = chosen ? chosenTarget(chosen) : chooseTarget(analysis, rankCandidates(analysis, candidates));
    const tieNotes: string[] = [];
    if (target.ambiguous && target.kind === 'store') {
      const close = closeMatches(target.list);
      const pick = settleByStock(target.list, await this.stockByProduct(organizationId, storeId, close.map((row) => BigInt(row.candidate.id))));
      if (pick) {
        const others = close.filter((row) => row !== pick).map((row) => this.candidateName(row, catalog));
        tieNotes.push(`相近的商品没有库存，已按有库存的这款回答；没有库存的：${others.join('、')}`);
        target = chosenTarget(pick.candidate);
      }
    }
    const top = target.list[0]?.candidate;
    const settled = top && !target.askStage && !target.ambiguous;

    const storeFacts = settled && target.kind === 'store' ? await this.storeFacts(organizationId, storeId, catalog, BigInt(top.id)) : null;
    const mailFacts = settled && target.kind === 'mail' ? this.mailFacts(catalog, top.mail!.displayName) : null;
    const productReply = storeFacts ? storeReply(analysis, storeFacts) : mailFacts?.length ? mailReply(analysis, mailFacts) : null;
    const fixed = matchingAnswers(analysis, answers);
    const clarify = target.askStage ? ASK_STAGE : target.ambiguous ? sizeQuestion(target.list) : null;
    const reply = composeReply(analysis, productReply, fixed, clarify);
    const facts = {
      kind: settled ? target.kind : 'none',
      intents: analysis.intents,
      store: storeFacts && this.storeSummary(storeFacts),
      mail: mailFacts,
      candidates: settled ? [] : this.candidates(target.list, catalog),
      answers: fixed.map((answer) => answer.topic),
      notes: [...tieNotes, ...this.priceNotes(catalog, storeFacts ? [storeFacts.productId] : mailFacts?.map((row) => row.productId) ?? []), ...reply.notes],
    };
    const log = await this.prisma.client.assistantReplyLog.create({
      data: { organizationId, storeId, userId, question, intents: analysis.intents.join(','), reply: reply.text, facts, needsHuman: reply.needsHuman },
      select: { id: true },
    });
    return { replyId: log.id.toString(), reply: reply.text, needsHuman: reply.needsHuman, facts };
  }

  async feedback(organizationId: bigint, userId: bigint, storeId: bigint, replyId: bigint, input: AssistantFeedbackDto) {
    await this.storeAccess(organizationId, userId, storeId);
    const updated = await this.prisma.client.assistantReplyLog.updateMany({
      where: { id: replyId, organizationId, storeId },
      data: { outcome: input.outcome, editedReply: input.outcome === 'EDITED' ? input.editedReply?.trim() || null : null, feedbackAt: new Date() },
    });
    if (!updated.count) throw new NotFoundException('回复记录不存在');
    return { replyId: replyId.toString(), outcome: input.outcome };
  }

  async mailMilk(organizationId: bigint, userId: bigint, storeId: bigint) {
    await this.requireAdmin(organizationId, userId, storeId);
    const [profiles, products] = await Promise.all([
      this.prisma.client.mailMilkProfile.findMany({
        where: { organizationId },
        include: { product: { select: { name: true, status: true, storeProducts: { where: { storeId }, select: PRICE_SELECT } } } },
        orderBy: [{ displayName: 'asc' }, { line: 'asc' }],
      }),
      this.prisma.client.product.findMany({ where: { organizationId, status: 'ACTIVE', mailMilkProfile: null }, select: { name: true } }),
    ]);
    return {
      items: profiles.map((profile) => ({
        ...this.profileSummary(profile), productName: profile.product.name, productActive: profile.product.status === 'ACTIVE',
        priceCents: retailPrice(profile.product.storeProducts[0]),
      })),
      undetected: products.filter((product) => isMailMilkName(product.name)).length,
    };
  }

  // Creates settings for POS products named like mail-order milk that have none yet; existing settings are kept.
  async detectMailMilk(organizationId: bigint, userId: bigint, storeId: bigint) {
    await this.requireAdmin(organizationId, userId, storeId);
    const products = await this.prisma.client.product.findMany({
      where: { organizationId, status: 'ACTIVE', mailMilkProfile: null }, select: { id: true, name: true, chineseName: true },
    });
    const rows = products.filter((product) => isMailMilkName(product.name)).map((product) => ({ organizationId, productId: product.id, ...parseMailMilkName(product.name) }));
    await this.prisma.client.$transaction(async (tx) => {
      if (rows.length) await tx.mailMilkProfile.createMany({ data: rows, skipDuplicates: true });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: 'assistant.mail_milk.detect', entityType: 'MailMilkProfile', requestId: randomUUID(), afterSummary: { created: rows.length, productIds: rows.map((row) => row.productId.toString()) } } });
    });
    return { created: rows.length };
  }

  async updateMailMilk(organizationId: bigint, userId: bigint, storeId: bigint, productId: bigint, input: UpdateMailMilkDto) {
    await this.requireAdmin(organizationId, userId, storeId);
    const data = { ...input, promoText: this.blankToNull(input.promoText) };
    return this.prisma.client.$transaction(async (tx) => {
      const before = await tx.mailMilkProfile.findFirst({ where: { organizationId, productId } });
      if (!before) throw new NotFoundException('邮寄奶粉设置不存在');
      const after = await tx.mailMilkProfile.update({ where: { productId }, data });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: 'assistant.mail_milk.update', entityType: 'MailMilkProfile', entityId: productId.toString(), requestId: randomUUID(), beforeSummary: this.profileSummary(before), afterSummary: this.profileSummary(after) } });
      return this.profileSummary(after);
    });
  }

  async aliases(organizationId: bigint, userId: bigint, storeId: bigint) {
    await this.requireAdmin(organizationId, userId, storeId);
    const rows = await this.prisma.client.assistantAlias.findMany({ where: { organizationId }, orderBy: { term: 'asc' } });
    return { items: rows.map((row) => ({ id: row.id.toString(), term: row.term, keyword: row.keyword, enabled: row.enabled })), builtIn: BUILT_IN_ALIASES.map(([term, keyword]) => ({ term, keyword })) };
  }

  async saveAlias(organizationId: bigint, userId: bigint, storeId: bigint, id: bigint | null, input: AssistantAliasDto | UpdateAssistantAliasDto) {
    await this.requireAdmin(organizationId, userId, storeId);
    const data = { ...input, term: input.term?.trim(), keyword: input.keyword?.trim().toLowerCase() };
    try {
      const row = await this.prisma.client.$transaction(async (tx) => {
        if (id && !(await tx.assistantAlias.findFirst({ where: { id, organizationId }, select: { id: true } }))) throw new NotFoundException('叫法不存在');
        const saved = id
          ? await tx.assistantAlias.update({ where: { id }, data })
          : await tx.assistantAlias.create({ data: { organizationId, term: data.term!, keyword: data.keyword! } });
        await tx.auditLog.create({ data: { organizationId, userId, storeId, action: id ? 'assistant.alias.update' : 'assistant.alias.create', entityType: 'AssistantAlias', entityId: saved.id.toString(), requestId: randomUUID(), afterSummary: { term: saved.term, keyword: saved.keyword, enabled: saved.enabled } } });
        return saved;
      });
      return { id: row.id.toString(), term: row.term, keyword: row.keyword, enabled: row.enabled };
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') throw new ConflictException('这个叫法已经存在');
      throw error;
    }
  }

  async answers(organizationId: bigint, userId: bigint, storeId: bigint) {
    await this.requireAdmin(organizationId, userId, storeId);
    const rows = await this.prisma.client.assistantAnswer.findMany({ where: { organizationId }, orderBy: [{ topic: 'asc' }, { id: 'asc' }] });
    return { items: rows.map((row) => this.answerSummary(row)) };
  }

  async saveAnswer(organizationId: bigint, userId: bigint, storeId: bigint, id: bigint | null, input: AssistantAnswerDto | UpdateAssistantAnswerDto) {
    await this.requireAdmin(organizationId, userId, storeId);
    const row = await this.prisma.client.$transaction(async (tx) => {
      if (id && !(await tx.assistantAnswer.findFirst({ where: { id, organizationId }, select: { id: true } }))) throw new NotFoundException('固定回复不存在');
      const saved = id
        ? await tx.assistantAnswer.update({ where: { id }, data: input })
        : await tx.assistantAnswer.create({ data: { organizationId, topic: input.topic!, keywords: input.keywords!, reply: input.reply!, handoff: input.handoff ?? false } });
      await tx.auditLog.create({ data: { organizationId, userId, storeId, action: id ? 'assistant.answer.update' : 'assistant.answer.create', entityType: 'AssistantAnswer', entityId: saved.id.toString(), requestId: randomUUID(), afterSummary: this.answerSummary(saved) } });
      return saved;
    });
    return this.answerSummary(row);
  }

  private catalog(organizationId: bigint, storeId: bigint): Promise<CatalogRow[]> {
    return this.prisma.client.product.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: {
        id: true, name: true, englishName: true, chineseName: true,
        barcodes: { where: { status: 'ACTIVE' }, select: { barcode: true } },
        storeProducts: { where: { storeId }, select: PRICE_SELECT },
        mailMilkProfile: true,
      },
    });
  }

  // Mail-order milk is matched through its settings; until settings exist it is left out rather than answered as an
  // in-store product it is not.
  private productCandidates(catalog: CatalogRow[]) {
    const candidates: ProductCandidate[] = [];
    for (const row of catalog) {
      const profile = row.mailMilkProfile;
      if (profile ? !profile.enabled : isMailMilkName(row.name)) continue;
      candidates.push({
        id: row.id.toString(),
        names: [row.name, row.englishName, row.chineseName].filter(Boolean).join(' '),
        barcodes: row.barcodes.map((barcode) => barcode.barcode),
        mail: profile && { displayName: profile.displayName, line: profile.line, stage: profile.stage },
      });
    }
    return candidates;
  }

  private async stockByProduct(organizationId: bigint, storeId: bigint, productIds: bigint[]) {
    const rows = await this.prisma.client.inventoryBalance.groupBy({
      by: ['productId'], _sum: { quantity: true },
      where: { organizationId, productId: { in: productIds }, quantity: { gt: 0 }, warehouse: { storeId, status: 'ACTIVE' } },
    });
    return new Map(rows.map((row) => [row.productId.toString(), row._sum.quantity ?? 0]));
  }

  private async storeFacts(organizationId: bigint, storeId: bigint, catalog: CatalogRow[], productId: bigint): Promise<StoreFacts> {
    const row = catalog.find((product) => product.id === productId)!;
    const priceCents = retailPrice(row.storeProducts[0]);
    const since = new Date(Date.now() - DISCOUNT_WINDOW_DAYS * 86_400_000);
    const [balances, sold] = await Promise.all([
      this.prisma.client.inventoryBalance.findMany({
        where: { organizationId, productId, quantity: { gt: 0 }, warehouse: { storeId, status: 'ACTIVE' } },
        select: { quantity: true, batch: { select: { expiryDate: true, expiryPrecision: true } } },
      }),
      this.prisma.client.posOrderItem.aggregate({
        _min: { unitPrice: true },
        where: { productId, isMinus: false, status: 'ACTIVE', unitPrice: { gt: 0 }, order: { storeId, orderedAt: { gte: since } } },
      }),
    ]);
    const byDate = new Map<string, StoreFacts['batches'][number]>();
    for (const balance of balances) {
      const expiryDate = balance.batch.expiryDate.toISOString().slice(0, 10);
      const current = byDate.get(expiryDate);
      if (current) current.quantity += balance.quantity;
      else byDate.set(expiryDate, { expiryDate, precision: balance.batch.expiryPrecision, quantity: balance.quantity });
    }
    const lowest = sold._min.unitPrice === null ? null : Math.round(Number(sold._min.unitPrice) * 100);
    return {
      productId: productId.toString(),
      name: row.chineseName?.trim() || row.name,
      priceCents,
      batches: [...byDate.values()].sort((left, right) => left.expiryDate.localeCompare(right.expiryDate)),
      recentDiscountCents: lowest !== null && priceCents !== null && lowest < priceCents ? lowest : null,
    };
  }

  // Every line and pack of the same milk, so one question about it shows normal and express prices together.
  private mailFacts(catalog: CatalogRow[], displayName: string): MailFacts[] {
    return catalog
      .filter((row) => row.mailMilkProfile?.enabled && row.mailMilkProfile.displayName === displayName)
      .map((row) => ({
        ...this.profileSummary(row.mailMilkProfile!),
        priceCents: retailPrice(row.storeProducts[0]),
      }));
  }

  private priceNotes(catalog: CatalogRow[], productIds: string[]) {
    const fallback = catalog.some((row) => productIds.includes(row.id.toString())
      && row.storeProducts[0]?.level4PriceCents == null && row.storeProducts[0]?.sellingPriceCents != null);
    return fallback ? ['POS 的 Level 4 价格未设置，暂按 POS 商品售价回答，请核对'] : [];
  }

  private storeSummary(facts: StoreFacts) {
    return {
      ...facts,
      totalQuantity: facts.batches.reduce((sum, batch) => sum + batch.quantity, 0),
      batches: facts.batches.map((batch) => ({ ...batch, label: expiryLabel(batch.expiryDate) })),
    };
  }

  // Close matches for staff to pick from; the lines and packs of one mail-order milk show once.
  private candidates(ranked: Ranked[], catalog: CatalogRow[]) {
    const seen = new Set<string>();
    const rows: { productId: string; name: string; kind: 'mail' | 'store'; score: number }[] = [];
    for (const row of ranked) {
      const name = this.candidateName(row, catalog);
      if (seen.has(name)) continue;
      seen.add(name);
      rows.push({ productId: row.candidate.id, name, kind: row.candidate.mail ? 'mail' : 'store', score: row.score });
      if (rows.length === CANDIDATE_LIMIT) break;
    }
    return rows;
  }

  private candidateName(row: Ranked, catalog: CatalogRow[]) {
    const product = catalog.find((item) => item.id.toString() === row.candidate.id);
    return row.candidate.mail?.displayName ?? (product?.chineseName?.trim() || product?.name || row.candidate.names);
  }

  private profileSummary(profile: MailProfileRow) {
    return {
      productId: profile.productId.toString(), displayName: profile.displayName, line: profile.line, stage: profile.stage,
      packCount: profile.packCount, packUnit: profile.packUnit, transitText: profile.transitText,
      shipFrom: profile.shipFrom, promoText: profile.promoText, promoDiscountCents: profile.promoDiscountCents,
      outOfStock: profile.outOfStock, enabled: profile.enabled,
    };
  }

  private answerSummary(row: { id: bigint; topic: string; keywords: string; reply: string; handoff: boolean; enabled: boolean }) {
    return { id: row.id.toString(), topic: row.topic, keywords: row.keywords, reply: row.reply, handoff: row.handoff, enabled: row.enabled };
  }

  private blankToNull(value: string | undefined) {
    return value === undefined ? undefined : value.trim() || null;
  }

  private async requireAdmin(organizationId: bigint, userId: bigint, storeId: bigint) {
    const admin = await this.storeAccess(organizationId, userId, storeId);
    if (!admin) throw new ForbiddenException('只有管理员可以维护阳光小助手设置');
  }

  // Anyone with a role in the store may ask; returns whether the user is an administrator there.
  private async storeAccess(organizationId: bigint, userId: bigint, storeId: bigint) {
    const roles = await this.prisma.client.userStoreRole.findMany({
      where: { userId, storeId, role: { organizationId }, store: { organizationId, status: 'ACTIVE' } },
      select: { role: { select: { code: true } } },
    });
    if (!roles.length) throw new ForbiddenException('没有该门店的访问权限');
    return roles.some((item) => item.role.code === 'ADMIN');
  }
}
