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
import { Public } from '../../common/decorators/public.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  CreateCredentialDto,
  ListCredentialsQueryDto,
  RenewCredentialDto,
} from './dto/credentials.dto';
import { CredentialsService } from './credentials.service';

@ApiTags('credentials')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('credentials')
export class CredentialsController {
  constructor(private readonly credentialsService: CredentialsService) {}

  @Public()
  @Get('verify/:token')
  verify(@Param('token') token: string) {
    return this.credentialsService.verify(token);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthUser) {
    return this.credentialsService.findMine(user);
  }

  @Permissions('credentials:read')
  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: ListCredentialsQueryDto) {
    return this.credentialsService.findAll(user, query);
  }

  @Permissions('credentials:read')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.credentialsService.findOne(user, id);
  }

  @Permissions('credentials:write')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCredentialDto) {
    return this.credentialsService.create(user, dto);
  }

  @Permissions('credentials:write')
  @Patch(':id/renew')
  renew(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RenewCredentialDto,
  ) {
    return this.credentialsService.renew(user, id, dto);
  }

  @Permissions('credentials:write')
  @Patch(':id/suspend')
  suspend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.credentialsService.suspend(user, id);
  }

  @Permissions('credentials:write')
  @Patch(':id/revoke')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.credentialsService.revoke(user, id);
  }
}
