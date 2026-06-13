import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsNotEmpty,
  MaxLength,
  Min,
  Matches,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  FigureZone,
  NodeShape,
  PINYA_POSITION_TYPES,
  PinyaPositionType,
  DECORATION_POSITION_TYPES,
  DecorationPositionType,
  DIRECTION_ZONES,
  AD_HOC_ALLOWED_ZONES_PHASE3,
} from '@muixer/shared';

@ValidatorConstraint({ name: 'isValidPositionType', async: false })
export class IsValidPositionTypeConstraint
  implements ValidatorConstraintInterface
{
  validate(
    positionType: string | undefined,
    args: ValidationArguments,
  ): boolean {
    const obj = args.object as CreateAdHocNodeDto;
    if (obj.zone === FigureZone.PINYA) {
      return (
        !positionType ||
        PINYA_POSITION_TYPES.includes(positionType as PinyaPositionType)
      );
    }
    if (obj.zone === FigureZone.DECORATION) {
      return (
        !!positionType &&
        DECORATION_POSITION_TYPES.includes(
          positionType as DecorationPositionType,
        )
      );
    }
    if ((DIRECTION_ZONES as readonly FigureZone[]).includes(obj.zone)) {
      return !positionType;
    }
    return false;
  }

  defaultMessage(): string {
    return 'positionType no vàlid per a la zona seleccionada.';
  }
}

export class CreateAdHocNodeDto {
  @IsIn([...AD_HOC_ALLOWED_ZONES_PHASE3])
  zone: FigureZone;

  @IsOptional()
  @Validate(IsValidPositionTypeConstraint)
  positionType?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  height?: number;

  @IsOptional()
  @IsNumber()
  rotation?: number;

  @IsOptional()
  @IsIn(Object.values(NodeShape))
  shape?: NodeShape;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}
