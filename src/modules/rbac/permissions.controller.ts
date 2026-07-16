import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RbacService } from './rbac.service';
@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rbacService: RbacService) {}

  @Permissions('roles:read')
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.rbacService.listPermissions(query);
  }
}
