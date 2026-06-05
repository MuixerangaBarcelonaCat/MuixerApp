import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenceElement } from './entities/reference-element.entity';
import { Event } from '../event/event.entity';
import { ReferenceElementService } from './reference-element.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReferenceElement, Event])],
  providers: [ReferenceElementService],
  exports: [ReferenceElementService],
})
export class ReferenceElementModule {}
