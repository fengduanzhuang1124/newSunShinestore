import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';

export class CountedBatchDto {
  // YYYY-MM (month precision) or YYYY-MM-DD.
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/)
  expiry!: string;

  // At most 9,999 per batch: larger numbers are typing mistakes in this store (CR-005 C5).
  @IsInt()
  @Min(0)
  @Max(9999, { message: '单个批次数量不能超过 9999，请核对' })
  quantity!: number;
}

export class ExpectedBalanceDto {
  @IsString()
  @Matches(/^\d+$/)
  batchId!: string;

  @IsInt()
  quantity!: number;
}

export class ConfirmStockCountDto {
  // What was physically counted; an empty list means none on hand.
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CountedBatchDto)
  lines!: CountedBatchDto[];

  // The non-zero balances the phone showed when the product was opened; a mismatch means stock moved meanwhile.
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ExpectedBalanceDto)
  expected!: ExpectedBalanceDto[];

  @IsUUID()
  requestId!: string;
}

export class AddStockCountItemDto {
  @IsString()
  @Matches(/^\d+$/)
  productId!: string;
}

export class IgnoreStockCountItemDto {
  // Also stop suggesting the product for purchase (same as "忽略" in the management center).
  @IsBoolean()
  alsoHidePurchasing!: boolean;
}

// Links a POS-unmapped product from the count sheet (REQ-013): a scanned barcode, or a POS product picked by name.
export class LinkPosStockCountItemDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-Za-z-]{4,64}$/, { message: '条码格式无效' })
  barcode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: '商品编号无效' })
  fromProductId?: string;

  // Merging another product record needs an explicit second request after the admin has seen what will move.
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
