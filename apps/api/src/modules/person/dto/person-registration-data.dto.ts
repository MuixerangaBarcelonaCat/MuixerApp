import { IsDateString, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@muixer/shared';

/**
 * Personal-data subset shared between self-registration via invite link
 * (`RegisterViaInviteDto`) and dependent-completion (`DependentRegistrationDto`).
 * The phone regex is a placeholder E.164-ish check — replaced by a
 * libphonenumber-js-backed validator once that dependency lands (see plan Phase 6).
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

  @ApiProperty({ description: 'Telèfon en format E.164', example: '+34612345678' })
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'El telèfon ha de tenir format E.164, per exemple +34612345678',
  })
  phone: string;

  @ApiProperty({ description: 'Data de naixement (ISO 8601)', example: '2000-01-15' })
  @IsDateString()
  birthDate: string;
}
