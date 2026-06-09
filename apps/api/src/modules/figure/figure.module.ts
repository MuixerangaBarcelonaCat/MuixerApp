import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FigureFamily } from './entities/figure-family.entity';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { FigureFamilyNode } from './entities/figure-family-node.entity';
import { Rengla } from './entities/rengla.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { FigureFamilyController } from './figure-family.controller';
import { FigureFamilyService } from './figure-family.service';
import { FigureTemplateController } from './figure-template.controller';
import { FigureTemplateService } from './figure-template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([FigureFamily, FigureTemplate, FigureNode, FigureFamilyNode, Rengla, CompositionSlot, FigureInstance]),
  ],
  controllers: [FigureFamilyController, FigureTemplateController],
  providers: [FigureFamilyService, FigureTemplateService],
  exports: [FigureFamilyService, FigureTemplateService],
})
export class FigureModule {}
