import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  ListTenantsQueryDto,
  CreateTenantDto,
  UpdateTenantDto,
} from './dto/tenant.dto';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Permissions('tenants:manage')
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListTenantsQueryDto) {
    return this.tenantsService.findAll(user, query);
  }

  @Permissions('tenants:manage')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tenantsService.findOne(user, id);
  }

  @Permissions('tenants:manage')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTenantDto) {
    return this.tenantsService.create(user, dto);
  }

  @Permissions('tenants:manage')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(user, id, dto);
  }
}
