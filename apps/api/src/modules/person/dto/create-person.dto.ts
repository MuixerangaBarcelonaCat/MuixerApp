import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsUUID,
  IsArray,
  IsDateString,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, AvailabilityStatus, OnboardingStatus } from '@muixer/shared';

export class CreatePersonDto {
  @ApiProperty({ description: 'Nom del membre', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Primer cognom', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  firstSurname: string;

  @ApiPropertyOptional({ description: 'Segon cognom', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  secondSurname?: string;

  @ApiProperty({ description: 'Àlies únic del membre', maxLength: 20 })
  @IsString()
  @MaxLength(20)
  alias: string;

  @ApiPropertyOptional({ description: 'Email de contacte' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Telèfon de contacte', maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Data de naixement (ISO 8601)', example: '2000-01-15' })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Alçada d\'espatlles en cm', minimum: 50, maximum: 250 })
  @IsInt()
  @Min(50)
  @Max(250)
  @IsOptional()
  shoulderHeight?: number;

  @ApiPropertyOptional({ description: 'Gènere', enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ description: 'És xicalla (< 16 anys)', default: false })
  @IsBoolean()
  @IsOptional()
  isXicalla?: boolean;

  @ApiPropertyOptional({ description: 'Està actiu', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'És membre oficial', default: false })
  @IsBoolean()
  @IsOptional()
  isMember?: boolean;

  @ApiPropertyOptional({ description: 'Estat de disponibilitat', enum: AvailabilityStatus, default: AvailabilityStatus.AVAILABLE })
  @IsEnum(AvailabilityStatus)
  @IsOptional()
  availability?: AvailabilityStatus;

  @ApiPropertyOptional({ description: 'Estat d\'onboarding', enum: OnboardingStatus })
  @IsEnum(OnboardingStatus)
  @IsOptional()
  onboardingStatus?: OnboardingStatus;

  @ApiPropertyOptional({ description: 'Notes internes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Data de lliurament de samarreta', example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  shirtDate?: string;

  @ApiPropertyOptional({ description: 'Data d\'entrada a la colla', example: '2024-01-15' })
  @IsDateString()
  @IsOptional()
  joinDate?: string;

  @ApiPropertyOptional({ description: 'IDs de posicions assignades', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  positionIds?: string[];

  @ApiPropertyOptional({ description: 'ID del mentor assignat' })
  @IsUUID('4')
  @IsOptional()
  mentorId?: string;
}
