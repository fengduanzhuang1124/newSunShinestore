import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class PosStoreQueryDto {
  @Matches(/^\d+$/, { message: 'storeId必须是正整数' })
  storeId!: string;
}

export class PosPageQueryDto extends PosStoreQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}

export class PosOrderQueryDto extends PosPageQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from必须为YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to必须为YYYY-MM-DD' })
  to?: string;

  @IsOptional()
  @IsIn(['OBSERVED', 'SIMULATED', 'APPLIED', 'REVERSED', 'REVIEW_REQUIRED'])
  inventoryStatus?: 'OBSERVED' | 'SIMULATED' | 'APPLIED' | 'REVERSED' | 'REVIEW_REQUIRED';
}

export class PosMappingQueryDto extends PosPageQueryDto {
  @IsOptional()
  q?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}

export class PosMilkCatalogQueryDto extends PosPageQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'IGNORED'])
  reviewStatus?: 'PENDING' | 'APPROVED' | 'IGNORED';
}

export class PosProductCatalogQueryDto extends PosPageQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'IGNORED'])
  reviewStatus?: 'PENDING' | 'APPROVED' | 'IGNORED';

  @IsOptional()
  @IsIn(['UNTRANSLATED', 'DRAFT', 'APPROVED'])
  translationStatus?: 'UNTRANSLATED' | 'DRAFT' | 'APPROVED';
}

export class PosSimulationQueryDto extends PosPageQueryDto {
  @IsOptional()
  @IsIn(['READY', 'INSUFFICIENT', 'REVIEW_REQUIRED'])
  status?: 'READY' | 'INSUFFICIENT' | 'REVIEW_REQUIRED';
}

export class PosReviewQueryDto extends PosPageQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'RESOLVED', 'IGNORED'])
  status?: 'PENDING' | 'RESOLVED' | 'IGNORED';
}
