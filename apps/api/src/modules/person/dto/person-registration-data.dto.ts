import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@muixer/shared';

/**
 * Personal-data subset shared between self-registration via invite link
 * (`RegisterViaInviteDto`) and dependent-completion (`DependentRegistrationDto`).
 * Excludes `phone`: the xicalla have none, so only the invite form asks for it.
 */
export class PersonRegistrationDataDto {
  @ApiProperty({ description: 'Nom', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Primer cognom', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  firstSurname: string;

  @ApiPropertyOptional({ description: 'Segon cognom', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  secondSurname?: string;

  @ApiProperty({ description: 'Gènere', enum: Gender })
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ description: 'Data de naixement (ISO 8601)', example: '2000-01-15' })
  @IsDateString()
  birthDate: string;
}
