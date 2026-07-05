import { Module } from '@nestjs/common';
import { PermissionsController } from './permissions.controller';
import { RbacService } from './rbac.service';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [PermissionsController, RolesController, UsersController],
  providers: [RbacService, RolesService, UsersService],
  exports: [RbacService],
})
export class RbacModule {}
