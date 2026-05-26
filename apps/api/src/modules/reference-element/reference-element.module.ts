import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferenceElement } from './entities/reference-element.entity';
import { Event } from '../event/event.entity';
import { ReferenceElementService } from './reference-element.service';
import { ReferenceElementController } from './reference-element.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReferenceElement, Event])],
  controllers: [ReferenceElementController],
  providers: [ReferenceElementService],
  exports: [ReferenceElementService],
})
export class ReferenceElementModule {}
