import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './person.entity';
import { Tag } from '../tag/tag.entity';
import { PersonService } from './person.service';
import { PersonController } from './person.controller';
import { AuditModule } from '../audit/audit.module';
import { PersonDelegateModule } from '../person-delegate/person-delegate.module';

@Module({
  imports: [TypeOrmModule.forFeature([Person, Tag]), AuditModule, PersonDelegateModule],
  controllers: [PersonController],
  providers: [PersonService],
  exports: [PersonService],
})
export class PersonModule {}
