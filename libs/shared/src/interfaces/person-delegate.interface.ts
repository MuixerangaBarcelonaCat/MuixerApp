import { DelegateType } from '../enums/delegate-type.enum';

export interface PersonDelegateDto {
  id: string;
  userId: string;
  userEmail: string;
  personId: string;
  personAlias: string;
  delegateType: DelegateType;
  isActive: boolean;
  createdAt: string;
}
