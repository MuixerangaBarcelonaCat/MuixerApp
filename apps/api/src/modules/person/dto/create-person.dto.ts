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
} from 'class-validator';
import { Gender, AvailabilityStatus, OnboardingStatus } from '@muixer/shared';

export class CreatePersonDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  firstSurname: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  secondSurname?: string;

  @IsString()
  @MaxLength(20)
  alias: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsInt()
  @Min(50)
  @Max(250)
  @IsOptional()
  shoulderHeight?: number;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsBoolean()
  @IsOptional()
  isXicalla?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isMember?: boolean;

  @IsEnum(AvailabilityStatus)
  @IsOptional()
  availability?: AvailabilityStatus;

  @IsEnum(OnboardingStatus)
  @IsOptional()
  onboardingStatus?: OnboardingStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  shirtDate?: string;

  @IsDateString()
  @IsOptional()
  joinDate?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  positionIds?: string[];

  @IsUUID('4')
  @IsOptional()
  mentorId?: string;
}
