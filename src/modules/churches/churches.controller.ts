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
import { ChurchesService } from './churches.service';
import {
  CreateChurchDto,
  ListChurchesQueryDto,
  UpdateChurchDto,
} from './dto/church.dto';

@ApiTags('churches')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('churches')
export class ChurchesController {
  constructor(private readonly churchesService: ChurchesService) {}

  @Permissions('churches:read')
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListChurchesQueryDto) {
    return this.churchesService.findAll(user, query);
  }

  @Permissions('churches:read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.churchesService.findOne(user, id);
  }

  @Permissions('churches:write')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateChurchDto) {
    return this.churchesService.create(user, dto);
  }

  @Permissions('churches:write')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateChurchDto,
  ) {
    return this.churchesService.update(user, id, dto);
  }

  @Permissions('churches:write')
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.churchesService.deactivate(user, id);
  }
}
