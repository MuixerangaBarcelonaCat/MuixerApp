import { DelegateType } from '../enums/delegate-type.enum';

export const DELEGATE_TYPE_LABELS: Record<DelegateType, string> = {
  [DelegateType.PARENT]: 'Pare/mare',
  [DelegateType.GUARDIAN]: 'Tutor/a',
  [DelegateType.OTHER]: 'Altres',
};
