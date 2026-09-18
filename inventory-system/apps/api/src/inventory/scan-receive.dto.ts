import { IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';

export class ScanReceiveDto {
  @IsString()
  @Matches(/^\d+$/)
  warehouseId!: string;

  @IsUUID('4')
  idempotencyKey!: string;

  @IsString()
  @Length(1, 128)
  barcode!: string;

  @IsString()
  @Length(1, 255)
  productName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  productId?: string;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  expiryMonth!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  expiryDay?: number;

  @IsInt()
  @Min(1)
  quantity!: number;
}
