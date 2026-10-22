import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReviewPosProductDto {
  @IsIn(['APPROVED', 'IGNORED'])
  reviewStatus!: 'APPROVED' | 'IGNORED';

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  englishName!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  chineseName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryName?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason!: string;

  @IsUUID()
  idempotencyKey!: string;
}
