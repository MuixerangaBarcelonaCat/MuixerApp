import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY, IS_SSE_KEY } from '../constants/auth.constants';

/**
 * Guard global d'autenticació JWT. Protegeix tots els endpoints per defecte.
 * Els endpoints marcats amb `@Public()` es salten aquest guard automàticament.
 * Els marcats amb `@SseAuth()` es validen amb `SseJwtStrategy` (accepta
 * `?token=`) en lloc de l'estratègia per defecte, que només accepta
 * l'Authorization header (SEC-4).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly sseGuard = new (AuthGuard('jwt-sse'))();

  constructor(private readonly reflector: Reflector) {
    super();
  }

  /** Permet el pas si l'endpoint té `@Public()`; delega a `SseJwtStrategy` si té `@SseAuth()`; altrament a la validació JWT per defecte. */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isSse = this.reflector.getAllAndOverride<boolean>(IS_SSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isSse) return this.sseGuard.canActivate(context);

    return super.canActivate(context);
  }
}
