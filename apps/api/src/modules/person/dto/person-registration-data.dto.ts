import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@muixer/shared';
import { IsValidPhoneNumber } from '../../../common/validators/is-valid-phone-number.decorator';

/**
 * Personal-data subset shared between self-registration via invite link
 * (`RegisterViaInviteDto`) and dependent-completion (`DependentRegistrationDto`).
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
  @IsValidPhoneNumber()
  phone: string;

  @ApiProperty({ description: 'Data de naixement (ISO 8601)', example: '2000-01-15' })
  @IsDateString()
  birthDate: string;
}
