import { DelegateType } from '../enums/delegate-type.enum';

export type AccountState = 'NONE' | 'PENDING_ACTIVATION' | 'ACTIVE';

export interface PersonDelegateDto {
  id: string;
  delegateType: DelegateType;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
  user: {
    id: string;
    person: {
      id: string;
      alias: string;
    } | null;
  };
  person: {
    id: string;
    alias: string;
  };
}

export interface AdminPersonDelegateDto extends PersonDelegateDto {
  user: PersonDelegateDto['user'] & {
    email: string | null;
  };
}

export interface DelegationCandidate {
  candidateUserId: string;
  personId: string;
  alias: string;
  name: string;
  accountState: AccountState;
}
