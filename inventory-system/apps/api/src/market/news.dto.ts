import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export const NEWS_REGIONS = ['ANZ', 'ASIA', 'GLOBAL'] as const;
export type NewsRegionCode = typeof NEWS_REGIONS[number];

export class CreateNewsSourceDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  // Public RSS / Atom addresses only; the server refuses internal addresses when it reads the feed.
  @IsString() @MaxLength(500) @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  url!: string;

  @IsIn(NEWS_REGIONS)
  region!: NewsRegionCode;
}

export class UpdateNewsSourceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80)
  name?: string;

  @IsOptional() @IsIn(NEWS_REGIONS)
  region?: NewsRegionCode;

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}
