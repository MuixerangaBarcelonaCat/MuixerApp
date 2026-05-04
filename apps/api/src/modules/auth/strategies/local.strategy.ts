import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { User } from '../../user/user.entity';

/** Estratègia Passport per al login local (email + password). Usa 'email' com a camp identificador en lloc del 'username' per defecte. */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  /** Valida les credencials. Si no són vàlides, llança UnauthorizedException i el login no continua. */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.authService.validateUser(email, password);
    if (!user) throw new UnauthorizedException('Credencials incorrectes');
    return user;
  }
}
