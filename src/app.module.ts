import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AppConfigModule } from './config/config.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { ChurchesModule } from './modules/churches/churches.module';
import { FinanceModule } from './modules/finance/finance.module';
import { MembersModule } from './modules/members/members.module';
import { MinistersModule } from './modules/ministers/ministers.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { SacramentsModule } from './modules/sacraments/sacraments.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { PrismaModule } from './prisma/prisma.module';
import { CredentialsModule } from './modules/credentials/credentials.module';
import { ActivitiesModule } from './modules/activities/activities.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    RbacModule,
    ChurchesModule,
    MinistersModule,
    MembersModule,
    FinanceModule,
    SacramentsModule,
    TenantsModule,
    CredentialsModule,
    ActivitiesModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
