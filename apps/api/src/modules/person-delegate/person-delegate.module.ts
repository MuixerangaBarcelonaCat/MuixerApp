import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonDelegate } from './person-delegate.entity';
import { Person } from '../person/person.entity';
import { User } from '../user/user.entity';
import { PersonDelegateService } from './person-delegate.service';
import { PersonDelegateController } from './person-delegate.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PersonDelegate, Person, User])],
  controllers: [PersonDelegateController],
  providers: [PersonDelegateService],
  exports: [PersonDelegateService],
})
export class PersonDelegateModule {}
