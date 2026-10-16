import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ReviewMilkProductDto {
  @IsIn(['APPROVED', 'IGNORED'])
  reviewStatus!: 'APPROVED' | 'IGNORED';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  englishName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  chineseName?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  packQuantity?: number;

  @IsOptional()
  @IsIn(['LOCAL_STOCK', 'EXTERNAL_WAREHOUSE', 'REVIEW_REQUIRED'])
  inventoryPolicy?: 'LOCAL_STOCK' | 'EXTERNAL_WAREHOUSE' | 'REVIEW_REQUIRED';

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason!: string;

  @IsUUID()
  idempotencyKey!: string;
}
