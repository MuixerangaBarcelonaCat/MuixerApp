import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@muixer/shared';
import { Request } from 'express';

/**
 * Estratègia Passport per validar el JWT en peticions autenticades.
 * Suporta dos extractors: Bearer token de la capçalera Authorization (peticions HTTP normals)
 * i paràmetre `?token=` de la query string (necessari per a SSE, que no suporta capçaleres personalitzades).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          // Support SSE via query parameter
          const token = req.query?.['token'] as string | undefined;
          return token ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env['JWT_SECRET'] ?? 'change-me',
    });
  }

  /** Retorna el payload del JWT tal qual — ja validat per Passport. Disponible com a `request.user` als controllers. */
  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
