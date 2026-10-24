import {
  IsUUID,
  IsEnum,
  IsBoolean,
  IsOptional,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { DelegateType } from '@muixer/shared';

/** The delegate is named either by account (`userId`) or by person (`responsiblePersonId`), never both. */
@ValidatorConstraint({ name: 'exactlyOneDelegateTarget', async: false })
class ExactlyOneDelegateTargetConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const { userId, responsiblePersonId } = args.object as CreatePersonDelegateDto;
    return (userId === undefined) !== (responsiblePersonId === undefined);
  }

  defaultMessage(): string {
    return 'Indiqueu userId o responsiblePersonId, però no tots dos';
  }
}

export class CreatePersonDelegateDto {
  @ValidateIf((o: CreatePersonDelegateDto) => o.responsiblePersonId === undefined)
  @IsUUID()
  userId?: string;

  /**
   * A person instead of an account: the API gives them an inactive stub account if they have none
   * yet, so a responsible adult can be linked before their own invite has been sent.
   */
  @ValidateIf((o: CreatePersonDelegateDto) => o.userId === undefined)
  @IsUUID()
  responsiblePersonId?: string;

  // The cross-field rule sits on an always-validated field: `ValidateIf` above would skip it.
  @IsEnum(DelegateType)
  @Validate(ExactlyOneDelegateTargetConstraint)
  delegateType: DelegateType;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
