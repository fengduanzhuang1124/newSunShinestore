import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// CR-020 F5: why a product is no longer sold, kept in the audit record.
export class DiscontinueProductDto {
  @IsString()
  @IsNotEmpty({ message: '请填写停售原因' })
  @MaxLength(255)
  reason!: string;
}

// CR-020 F7: the new product name typed by an admin.
export class RenameProductDto {
  @IsString()
  @IsNotEmpty({ message: '商品名称不能为空' })
  @MaxLength(255)
  name!: string;
}
