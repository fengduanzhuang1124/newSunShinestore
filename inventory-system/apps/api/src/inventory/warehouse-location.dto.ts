import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

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

// Set (or clear, with locationId null) the home location of many products at once (CR-008 F5).
export class SetProductLocationsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @IsString({ each: true }) @Matches(/^\d+$/, { each: true }) productIds!: string[];
  @IsOptional() @IsString() @Matches(/^\d+$/) locationId?: string | null;
}

export class ProductLocationQueryDto {
  @IsOptional() @IsString() @MaxLength(80) brand?: string;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @IsString() @Matches(/^(\d+|NONE)$/) locationId?: string;
  @IsOptional() @IsIn(['true', 'false']) inStock?: string;
}
