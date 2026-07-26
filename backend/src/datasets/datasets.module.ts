import { Module } from '@nestjs/common';
import { ClassificationService } from '../classification/classification.service';
import { ParsingService } from '../parsing/parsing.service';
import { ProfilingService } from '../profiling/profiling.service';
import { ScoringService } from '../scoring/scoring.service';
import { DatasetsController } from './datasets.controller';
import { DatasetsService } from './datasets.service';

@Module({
  controllers: [DatasetsController],
  providers: [
    DatasetsService,
    ParsingService,
    ProfilingService,
    ClassificationService,
    ScoringService,
  ],
})
export class DatasetsModule {}
