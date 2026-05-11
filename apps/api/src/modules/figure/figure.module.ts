import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { FigureTemplateController } from './figure-template.controller';
import { FigureTemplateService } from './figure-template.service';

@Module({
  imports: [TypeOrmModule.forFeature([FigureTemplate, FigureNode, CompositionSlot, FigureInstance])],
  controllers: [FigureTemplateController],
  providers: [FigureTemplateService],
  exports: [FigureTemplateService],
})
export class FigureModule {}
