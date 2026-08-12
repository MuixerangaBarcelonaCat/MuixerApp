import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { LegalModule } from '../legal/legal.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { ConsentController } from './consent.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { SseJwtStrategy } from './strategies/jwt-sse.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { requireJwtSecret } from './constants/jwt-secret.util';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: requireJwtSecret('JWT_SECRET'),
      signOptions: { expiresIn: parseInt(process.env['JWT_ACCESS_TTL'] ?? '900', 10) },
    }),
    TypeOrmModule.forFeature([User, Person, RefreshToken]),
    LegalModule,
    AuditModule,
    MailModule,
  ],
  controllers: [AuthController, ConsentController],
  providers: [
    AuthService,
    TokenService,
    LocalStrategy,
    JwtStrategy,
    SseJwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [JwtAuthGuard, RolesGuard, AuthService, TokenService],
})
export class AuthModule {}
