import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@muixer/shared';
import { requireJwtSecret } from '../constants/jwt-secret.util';

/**
 * Estratègia Passport per validar el JWT en peticions autenticades. Només
 * accepta el Bearer token de la capçalera Authorization — les rutes SSE
 * (que no poden enviar capçaleres) usen `SseJwtStrategy` en el seu lloc,
 * activada explícitament amb `@SseAuth()` (SEC-4).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret('JWT_SECRET'),
    });
  }

  /** Retorna el payload del JWT tal qual — ja validat per Passport. Disponible com a `request.user` als controllers. */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
