import { Expose } from 'class-transformer';
import { AccountState, DelegationCandidate } from '@muixer/shared';

export class DelegationCandidateResponseDto implements DelegationCandidate {
  @Expose()
  candidateUserId: string;

  @Expose()
  personId: string;

  @Expose()
  alias: string;

  @Expose()
  name: string;

  @Expose()
  accountState: AccountState;
}
