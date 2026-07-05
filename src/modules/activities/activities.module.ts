import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller';
import { ActivitiesScopeService } from './activities-scope.service';
import { ActivitiesService } from './activities.service';

@Module({
  controllers: [ActivitiesController],
  providers: [ActivitiesScopeService, ActivitiesService],
  exports: [ActivitiesService, ActivitiesScopeService],
})
export class ActivitiesModule {}
