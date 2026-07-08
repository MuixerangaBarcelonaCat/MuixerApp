import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '@muixer/shared';
import { requireJwtSecret } from '../constants/jwt-secret.util';
import { extractSseQueryToken } from './sse-token-extractor.util';

/**
 * Same JWT validation as JwtStrategy, but also accepts the token via the
 * `?token=` query parameter. Only wired up for routes marked with
 * `@SseAuth()` — the browser's EventSource API cannot set custom headers,
 * so this is the only way it can authenticate an SSE connection (SEC-4).
 * Every other route only ever accepts the Authorization header.
 */
@Injectable()
export class SseJwtStrategy extends PassportStrategy(Strategy, 'jwt-sse') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractSseQueryToken,
      ]),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return payload;
  }
}
