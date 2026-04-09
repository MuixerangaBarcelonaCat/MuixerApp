import { UserProfile } from '@muixer/shared';

export class AuthResponseDto {
  accessToken: string;
  user: UserProfile;
}
