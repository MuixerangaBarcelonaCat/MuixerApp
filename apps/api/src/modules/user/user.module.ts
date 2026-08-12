import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../person/person.entity';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from '../auth/auth.module';
import { PersonDelegateModule } from '../person-delegate/person-delegate.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Person]), AuthModule, PersonDelegateModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
