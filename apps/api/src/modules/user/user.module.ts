import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../person/person.entity';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from '../auth/auth.module';
import { PersonDelegateModule } from '../person-delegate/person-delegate.module';
// Només el necessitava l'enllaç de recuperació (desactivat, vegeu user.controller.ts).
// import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Person]),
    AuthModule,
    PersonDelegateModule,
    // AuditModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
