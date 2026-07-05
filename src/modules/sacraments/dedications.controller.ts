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
import { DedicationsService } from './dedications.service';
import {
  CreateDedicationDto,
  ListDedicationsQueryDto,
  UpdateDedicationDto,
} from './dto/dedication.dto';
import { SacramentScopeService } from './sacrament-scope.service';

@ApiTags('dedications')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('dedications')
export class DedicationsController {
  constructor(
    private readonly dedicationsService: DedicationsService,
    private readonly scopeService: SacramentScopeService,
  ) {}

  @Permissions('dedications:read')
  @Get('scope')
  getScope(@CurrentUser() user: AuthUser) {
    return this.scopeService.resolveScope(user);
  }

  @Permissions('dedications:read')
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListDedicationsQueryDto,
  ) {
    return this.dedicationsService.findAll(user, query);
  }

  @Permissions('dedications:read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.dedicationsService.findOne(user, id);
  }

  @Permissions('dedications:write')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDedicationDto) {
    return this.dedicationsService.create(user, dto);
  }

  @Permissions('dedications:write')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDedicationDto,
  ) {
    return this.dedicationsService.update(user, id, dto);
  }
}
