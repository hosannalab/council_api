import { Module } from '@nestjs/common';
import { MinistersController } from './ministers.controller';
import { MinistersService } from './ministers.service';

@Module({
  controllers: [MinistersController],
  providers: [MinistersService],
  exports: [MinistersService],
})
export class MinistersModule {}
