import { BadRequestException } from '@nestjs/common';
import type { PosPageRequest } from '../domain/pos.types.js';

const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 500;

export interface CreatePosPageRequestInput {
  cursor?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export function createPosPageRequest(
  input: CreatePosPageRequestInput,
): PosPageRequest {
  const limit = input.limit ?? DEFAULT_PAGE_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    throw new BadRequestException(
      `POS page limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`,
    );
  }

  if (input.from && input.to && input.from.getTime() > input.to.getTime()) {
    throw new BadRequestException(
      'POS synchronization start time must not be after end time',
    );
  }

  return {
    limit,
    ...(input.cursor ? { cursor: input.cursor } : {}),
    ...(input.from ? { from: input.from } : {}),
    ...(input.to ? { to: input.to } : {}),
  };
}
