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
  CreateMemberCommentDto,
  CreateMemberDto,
  ListMembersQueryDto,
  TransferMemberDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { MembersService } from './members.service';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Permissions('members:read')
  @Get('scope')
  getScope(@CurrentUser() user: AuthUser) {
    return this.membersService.resolveScope(user);
  }

  @Permissions('members:read')
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListMembersQueryDto) {
    return this.membersService.findAll(user, query);
  }

  @Permissions('members:read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.membersService.findOne(user, id);
  }

  @Permissions('members:write')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMemberDto) {
    return this.membersService.create(user, dto);
  }

  @Permissions('members:write')
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.update(user, id, dto);
  }

  @Permissions('members:write')
  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.membersService.deactivate(user, id);
  }

  @Permissions('members:write')
  @Post(':id/transfer')
  transfer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: TransferMemberDto,
  ) {
    return this.membersService.transfer(user, id, dto);
  }

  @Permissions('members:read')
  @Get(':id/history')
  getHistory(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.membersService.getHistory(user, id);
  }

  @Permissions('members:read')
  @Get(':id/comments')
  getComments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.membersService.getComments(user, id);
  }

  @Permissions('members:write')
  @Post(':id/comments')
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateMemberCommentDto,
  ) {
    return this.membersService.addComment(user, id, dto);
  }
}
