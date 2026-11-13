import { IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(1, 80)
  username!: string;

  @IsString()
  @Length(1, 128)
  password!: string;

  // CR-025: the browser's position, sent only when an in-store account asks for it.
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;
}
