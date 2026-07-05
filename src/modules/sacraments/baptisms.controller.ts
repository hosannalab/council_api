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
import { BaptismsService } from './baptisms.service';
import {
  CreateBaptismDto,
  ListBaptismsQueryDto,
  UpdateBaptismDto,
} from './dto/baptism.dto';
import { SacramentScopeService } from './sacrament-scope.service';

@ApiTags('baptisms')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('baptisms')
export class BaptismsController {
  constructor(
    private readonly baptismsService: BaptismsService,
    private readonly scopeService: SacramentScopeService,
  ) {}

  @Permissions('baptisms:read')
  @Get('scope')
  getScope(@CurrentUser() user: AuthUser) {
    return this.scopeService.resolveScope(user);
  }

  @Permissions('baptisms:read')
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListBaptismsQueryDto) {
    return this.baptismsService.findAll(user, query);
  }

  @Permissions('baptisms:read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.baptismsService.findOne(user, id);
  }

  @Permissions('baptisms:write')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBaptismDto) {
    return this.baptismsService.create(user, dto);
  }

  @Permissions('baptisms:write')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBaptismDto,
  ) {
    return this.baptismsService.update(user, id, dto);
  }
}
