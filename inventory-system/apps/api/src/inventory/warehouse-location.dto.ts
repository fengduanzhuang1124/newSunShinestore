import { IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class SaveWarehouseLocationDto {
  @IsString() @MaxLength(40) code!: string;
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(40) zone?: string;
  @IsOptional() @IsString() @MaxLength(40) aisle?: string;
  @IsOptional() @IsString() @MaxLength(40) shelf?: string;
  @IsOptional() @IsString() @MaxLength(40) level?: string;
}

export class AssignWarehouseLocationDto {
  @IsString() @Matches(/^\d+$/) productId!: string;
  @IsString() @Matches(/^\d+$/) batchId!: string;
  @IsString() @Matches(/^\d+$/) locationId!: string;
  @IsInt() @Min(0) quantity!: number;
}
