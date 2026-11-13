import { Injectable } from '@nestjs/common';
import { MoniAuthService } from './moni-auth.service.js';
import { MoniApiError, MoniHttpClient } from './moni-http-client.js';

const ROOT_PARENT_ID = '0';
const MAX_CATEGORY_DEPTH = 8;
const MAX_CATEGORY_COUNT = 10_000;

interface MoniCategoryRecord {
  cate_id?: unknown;
  cate_name?: unknown;
  parent_id?: unknown;
  level_id?: unknown;
  bg_color?: unknown;
  img?: unknown;
  sort_num?: unknown;
  rate_id?: unknown;
}

interface MoniCategoryListData {
  list?: unknown;
}

export interface MoniCategory {
  externalCategoryId: string;
  name: string;
  parentId: string;
  level: number | null;
  backgroundColor: string | null;
  imageUrl: string | null;
  sortNumber: number | null;
  taxRateId: string | null;
}

interface CategoryQueueItem {
  parentId: string;
  depth: number;
}

function toOptionalInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new MoniApiError(`Moni ${field} must be a non-negative integer`);
  }

  return parsed;
}

function toOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

@Injectable()
export class MoniCategoryGateway {
  constructor(
    private readonly auth: MoniAuthService,
    private readonly http: MoniHttpClient,
  ) {}

  async listChildren(
    parentId: string | number = ROOT_PARENT_ID,
    keyword?: string,
  ): Promise<readonly MoniCategory[]> {
    const normalizedParentId = String(parentId).trim();
    if (!normalizedParentId) {
      throw new RangeError('Moni category parent ID is required');
    }

    const login = await this.auth.ensureLoggedIn();
    const normalizedKeyword = keyword?.trim();
    const data = await this.http.postReadOnly<MoniCategoryListData>(
      'Webretailcate/cateList',
      {
        shop_id: login.shopId,
        login_token: login.loginToken,
        parent_id: normalizedParentId,
        ...(normalizedKeyword ? { keyword: normalizedKeyword } : {}),
      },
    );

    if (!Array.isArray(data.list)) {
      throw new MoniApiError('Moni category list must be an array');
    }

    return data.list.map((raw) => {
      if (!raw || typeof raw !== 'object') {
        throw new MoniApiError('Moni category record is invalid');
      }

      const record = raw as MoniCategoryRecord;
      if (record.cate_id === undefined || typeof record.cate_name !== 'string') {
        throw new MoniApiError('Moni category identity is missing');
      }

      return {
        externalCategoryId: String(record.cate_id),
        name: record.cate_name,
        parentId:
          record.parent_id === undefined
            ? normalizedParentId
            : String(record.parent_id),
        level: toOptionalInteger(record.level_id, 'category level'),
        backgroundColor: toOptionalString(record.bg_color),
        imageUrl: toOptionalString(record.img),
        sortNumber: toOptionalInteger(record.sort_num, 'category sort number'),
        taxRateId:
          record.rate_id === undefined || record.rate_id === null
            ? null
            : String(record.rate_id),
      };
    });
  }

  async listAll(): Promise<readonly MoniCategory[]> {
    const queue: CategoryQueueItem[] = [{ parentId: ROOT_PARENT_ID, depth: 1 }];
    const visitedParents = new Set<string>();
    const byId = new Map<string, MoniCategory>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visitedParents.has(current.parentId)) {
        continue;
      }
      if (current.depth > MAX_CATEGORY_DEPTH) {
        throw new MoniApiError('Moni category hierarchy exceeds the depth limit');
      }

      visitedParents.add(current.parentId);
      const children = await this.listChildren(current.parentId);
      for (const category of children) {
        byId.set(category.externalCategoryId, category);
        if (byId.size > MAX_CATEGORY_COUNT) {
          throw new MoniApiError('Moni category count exceeds the safety limit');
        }
        if (!visitedParents.has(category.externalCategoryId)) {
          queue.push({
            parentId: category.externalCategoryId,
            depth: current.depth + 1,
          });
        }
      }
    }

    return [...byId.values()];
  }
}
