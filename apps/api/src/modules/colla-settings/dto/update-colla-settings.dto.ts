import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { HeightGapThreshold, ShirtRequirements, TroncHeightThresholds, UpdateCollaSettings } from '@muixer/shared';

const WHOLE = { message: 'El valor ha de ser un nombre enter.' };

class ShirtRequirementsDto implements ShirtRequirements {
  @ApiProperty({ example: 2 })
  @IsInt(WHOLE)
  @Min(0, { message: 'El nombre mínim és 0.' })
  @Max(50, { message: 'El nombre màxim és 50.' })
  performances: number;

  @ApiProperty({ example: 6 })
  @IsInt(WHOLE)
  @Min(0, { message: 'El nombre mínim és 0.' })
  @Max(50, { message: 'El nombre màxim és 50.' })
  rehearsals: number;
}

class HeightGapThresholdDto implements HeightGapThreshold {
  @ApiProperty({ example: 5 })
  @IsInt(WHOLE)
  @Min(1, { message: "El llindar ha de ser d'1 cm com a mínim." })
  @Max(50, { message: 'El llindar ha de ser de 50 cm com a màxim.' })
  warning: number;

  @ApiProperty({ example: 10 })
  @IsInt(WHOLE)
  @Min(1, { message: "El llindar ha de ser d'1 cm com a mínim." })
  @Max(50, { message: 'El llindar ha de ser de 50 cm com a màxim.' })
  error: number;
}

class TroncHeightThresholdsDto implements TroncHeightThresholds {
  @ApiProperty({ type: HeightGapThresholdDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => HeightGapThresholdDto)
  floor: HeightGapThresholdDto;

  @ApiProperty({ type: HeightGapThresholdDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => HeightGapThresholdDto)
  support: HeightGapThresholdDto;
}

/** Any subset of the settings. A nested group (`shirtRequirements`, `troncHeightThresholds`) is replaced as a whole. */
export class UpdateCollaSettingsDto implements UpdateCollaSettings {
  @ApiPropertyOptional({ example: 'Muixeranga de Barcelona', maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'El nom de la colla és obligatori.' })
  @MaxLength(100, { message: 'El nom de la colla pot tindre 100 caràcters com a màxim.' })
  collaName?: string;

  @ApiPropertyOptional({ type: ShirtRequirementsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShirtRequirementsDto)
  shirtRequirements?: ShirtRequirementsDto;

  @ApiPropertyOptional({ example: 140 })
  @IsOptional()
  @IsInt(WHOLE)
  @Min(50, { message: "L'alçada de referència ha de ser de 50 cm com a mínim." })
  @Max(250, { message: "L'alçada de referència ha de ser de 250 cm com a màxim." })
  shoulderHeightBaselineCm?: number;

  @ApiPropertyOptional({ type: TroncHeightThresholdsDto, description: "Cada llindar d'avís ha de ser menor que el d'error." })
  @IsOptional()
  @ValidateNested()
  @Type(() => TroncHeightThresholdsDto)
  troncHeightThresholds?: TroncHeightThresholdsDto;

  @ApiPropertyOptional({ example: 2, description: '0 desactiva el bloqueig.' })
  @IsOptional()
  @IsInt(WHOLE)
  @Min(0, { message: 'El nombre de dies no pot ser negatiu.' })
  @Max(365, { message: 'El nombre màxim de dies és 365.' })
  assignmentLockDays?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  autoCheckInPerformances?: boolean;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'null: cap etiqueta.' })
  @IsOptional()
  @IsUUID('4', { message: "L'etiqueta no és vàlida." })
  defaultTagId?: string | null;

  @ApiPropertyOptional({ example: 16 })
  @IsOptional()
  @IsInt(WHOLE)
  @Min(1, { message: "L'edat mínima és 1 any." })
  @Max(25, { message: "L'edat màxima és 25 anys." })
  majorityAge?: number;
}
