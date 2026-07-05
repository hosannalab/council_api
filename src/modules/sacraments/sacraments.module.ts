import { Module } from '@nestjs/common';
import { BaptismsController } from './baptisms.controller';
import { BaptismsService } from './baptisms.service';
import { DedicationsController } from './dedications.controller';
import { DedicationsService } from './dedications.service';
import { SacramentScopeService } from './sacrament-scope.service';

@Module({
  controllers: [BaptismsController, DedicationsController],
  providers: [SacramentScopeService, BaptismsService, DedicationsService],
  exports: [BaptismsService, DedicationsService, SacramentScopeService],
})
export class SacramentsModule {}
