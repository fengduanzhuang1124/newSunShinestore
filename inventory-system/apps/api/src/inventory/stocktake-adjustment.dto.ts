import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class StocktakeAdjustmentDto {
  @IsString()
  @Matches(/^\d+$/)
  batchId!: string;

  @IsInt()
  @Min(0)
  actualQuantity!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason!: string;
}

export class StockIncreaseDto {
  @IsString()
  @Matches(/^\d+$/)
  productId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  batchId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  expiryMonth?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  expiryDay?: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  warehouseId?: string;

  @IsUUID()
  idempotencyKey!: string;
}
