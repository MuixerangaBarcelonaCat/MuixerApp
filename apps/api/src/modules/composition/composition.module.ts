import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompositionTemplate } from './entities/composition-template.entity';
import { CompositionSlot } from './entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { CompositionTemplateController } from './composition-template.controller';
import { CompositionTemplateService } from './composition-template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CompositionTemplate, CompositionSlot, FigureTemplate, FigureInstance]),
  ],
  controllers: [CompositionTemplateController],
  providers: [CompositionTemplateService],
  exports: [CompositionTemplateService],
})
export class CompositionModule {}
