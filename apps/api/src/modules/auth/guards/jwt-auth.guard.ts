import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../constants/auth.constants';

/**
 * Guard global d'autenticació JWT. Protegeix tots els endpoints per defecte.
 * Els endpoints marcats amb `@Public()` es salten aquest guard automàticament.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /** Permet el pas si l'endpoint té `@Public()`, altrament delega a la validació JWT de Passport. */
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
