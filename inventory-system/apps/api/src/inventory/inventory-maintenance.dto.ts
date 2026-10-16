import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CorrectBatchExpiryDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  expiryMonth!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  expiryDay?: number;

  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason!: string;
}

export class ExpiryAlertActionDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  handlingMethod!: string;
}

export class ExpiryAlertActionStatusDto {
  @IsString()
  @IsIn(['OPEN', 'COMPLETED', 'IGNORED'])
  status!: 'OPEN' | 'COMPLETED' | 'IGNORED';
}

export class DeleteExpiryAlertDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason!: string;
}
