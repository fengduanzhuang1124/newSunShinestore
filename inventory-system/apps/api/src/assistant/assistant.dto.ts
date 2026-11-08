import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AskAssistantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  question!: string;

  // Set when staff pick one of the suggested products; the question is then answered about that product.
  @IsOptional()
  @Matches(/^\d{1,19}$/)
  productId?: string;
}

export class AssistantFeedbackDto {
  @IsIn(['ADOPTED', 'EDITED', 'REJECTED', 'HANDOFF'])
  outcome!: 'ADOPTED' | 'EDITED' | 'REJECTED' | 'HANDOFF';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  editedReply?: string;
}

export class UpdateMailMilkDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  displayName?: string;

  @IsOptional() @IsIn(['NORMAL', 'EXPRESS'])
  line?: 'NORMAL' | 'EXPRESS';

  // null clears the stage (adult milk has none).
  @IsOptional() @IsInt() @Min(1) @Max(4)
  stage?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(24)
  packCount?: number;

  @IsOptional() @IsIn(['罐', '袋'])
  packUnit?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(60)
  transitText?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(20)
  shipFrom?: string;

  @IsOptional() @IsString() @MaxLength(120)
  promoText?: string;

  @IsOptional() @IsInt() @Min(0) @Max(100000)
  promoDiscountCents?: number | null;

  @IsOptional() @IsBoolean()
  outOfStock?: boolean;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class AssistantAliasDto {
  @IsString() @MinLength(1) @MaxLength(60)
  term!: string;

  @IsString() @MinLength(1) @MaxLength(120)
  keyword!: string;
}

export class UpdateAssistantAliasDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60)
  term?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  keyword?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class AssistantAnswerDto {
  @IsString() @MinLength(1) @MaxLength(60)
  topic!: string;

  @IsString() @MinLength(1) @MaxLength(255)
  keywords!: string;

  @IsString() @MinLength(1) @MaxLength(2000)
  reply!: string;

  @IsOptional() @IsBoolean()
  handoff?: boolean;
}

export class UpdateAssistantAnswerDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60)
  topic?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(255)
  keywords?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000)
  reply?: string;

  @IsOptional() @IsBoolean()
  handoff?: boolean;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}
