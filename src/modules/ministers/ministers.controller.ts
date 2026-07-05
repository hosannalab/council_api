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
  AssignMinisterDto,
  CreateMinisterCommentDto,
  CreateMinisterDto,
  ListMinistersQueryDto,
  UpdateMinisterDto,
} from './dto/minister.dto';
import { MinistersService } from './ministers.service';

@ApiTags('ministers')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('ministers')
export class MinistersController {
  constructor(private readonly ministersService: MinistersService) {}

  @Permissions('ministers:read')
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListMinistersQueryDto) {
    return this.ministersService.findAll(user, query);
  }

  @Permissions('ministers:read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ministersService.findOne(user, id);
  }

  @Permissions('ministers:write')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMinisterDto) {
    return this.ministersService.create(user, dto);
  }

  @Permissions('ministers:write')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMinisterDto,
  ) {
    return this.ministersService.update(user, id, dto);
  }

  @Permissions('ministers:write')
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ministersService.deactivate(user, id);
  }

  @Permissions('ministers:read')
  @Get(':id/assignments')
  getAssignments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ministersService.getAssignments(user, id);
  }

  @Permissions('ministers:write')
  @Post(':id/assignments')
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignMinisterDto,
  ) {
    return this.ministersService.assign(user, id, dto);
  }

  @Permissions('ministers:read')
  @Get(':id/comments')
  getComments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ministersService.getComments(user, id);
  }

  @Permissions('ministers:write')
  @Post(':id/comments')
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateMinisterCommentDto,
  ) {
    return this.ministersService.addComment(user, id, dto);
  }
}
