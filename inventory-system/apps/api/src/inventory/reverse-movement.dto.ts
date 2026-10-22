import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ReverseMovementDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  reason!: string;

  @IsUUID()
  idempotencyKey!: string;
}
