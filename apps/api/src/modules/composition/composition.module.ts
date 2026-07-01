import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Composition } from './entities/composition.entity';
import { CompositionEntry } from './entities/composition-entry.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { CompositionController } from './composition.controller';
import { CompositionService } from './composition.service';

@Module({
  imports: [TypeOrmModule.forFeature([Composition, CompositionEntry, FigureTemplate])],
  controllers: [CompositionController],
  providers: [CompositionService],
  exports: [CompositionService],
})
export class CompositionModule {}
