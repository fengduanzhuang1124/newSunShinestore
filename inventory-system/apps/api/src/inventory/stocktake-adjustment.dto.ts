import { IsInt, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

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
