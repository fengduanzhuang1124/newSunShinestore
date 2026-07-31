import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';

export class ManualIssueDto {
  @IsString()
  @Matches(/^\d+$/)
  batchId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MaxLength(255)
  reason = '上货架';
}
