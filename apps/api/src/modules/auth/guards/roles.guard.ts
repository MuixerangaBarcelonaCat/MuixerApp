import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole, JwtPayload } from '@muixer/shared';
import { ROLES_KEY } from '../constants/auth.constants';

/**
 * Guard global d'autorització per rols. S'executa després del JwtAuthGuard.
 * Si un endpoint no té `@Roles()`, tots els usuaris autenticats hi poden accedir.
 * La comprovació és plana (sense jerarquia implícita): cada endpoint declara exactament quins rols hi accedeixen.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /** Comprova que el rol de l'usuari autenticat estigui a la llista de rols permesos per l'endpoint. */
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;
    if (!user) return false;

    // Comprovació plana: el rol de l'usuari ha d'estar explícitament a la llista.
    // Sense jerarquia implícita — cada endpoint declara exactament quins roles hi accedeixen.
    return requiredRoles.includes(user.role);
  }
}
