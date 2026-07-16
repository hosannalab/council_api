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
import { ActivitiesScopeService } from './activities-scope.service';
import { ActivitiesService } from './activities.service';
import {
  CreateActivityDto,
  ListActivitiesQueryDto,
  UpdateActivityDto,
} from './dto/activity.dto';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly scopeService: ActivitiesScopeService,
  ) {}

  @Permissions('activities:read')
  @Get('scope')
  getScope(@CurrentUser() user: AuthUser) {
    return this.scopeService.resolveScope(user);
  }

  @Permissions('activities:read')
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListActivitiesQueryDto,
  ) {
    return this.activitiesService.findAll(user, query);
  }

  @Permissions('activities:read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.activitiesService.findOne(user, id);
  }

  @Permissions('activities:write')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateActivityDto) {
    return this.activitiesService.create(user, dto);
  }

  @Permissions('activities:write')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    return this.activitiesService.update(user, id, dto);
  }
}
