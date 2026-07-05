import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import {
  paginate,
  paginatedResult,
} from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { isSuperAdmin } from '../rbac/rbac.utils';
import {
  CreateChurchDto,
  ListChurchesQueryDto,
  UpdateChurchDto,
} from './dto/church.dto';

const churchInclude = {
  currentPastor: {
    select: { id: true, fullName: true, rank: true },
  },
} as const;

@Injectable()
export class ChurchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(actor: AuthUser, query: ListChurchesQueryDto) {
    const tenantId = this.requireTenantId(actor);
    const { skip, take, page, pageSize } = paginate(query.page, query.pageSize);

    const where: Prisma.ChurchWhereInput = { tenantId };

    if (query.status) where.status = query.status;
    if (query.city?.trim()) {
      where.city = { contains: query.city.trim(), mode: 'insensitive' };
    }
    if (query.currentPastorId) where.currentPastorId = query.currentPastorId;
    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { city: { contains: query.search.trim(), mode: 'insensitive' } },
        { address: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.church.findMany({
        where,
        skip,
        take,
        include: churchInclude,
        orderBy: { name: 'asc' },
      }),
      this.prisma.church.count({ where }),
    ]);

    return paginatedResult(
      items.map((church) => this.toResponse(church)),
      total,
      page,
      pageSize,
    );
  }

  async findOne(actor: AuthUser, id: string) {
    const church = await this.getScopedChurch(actor, id);
    return this.toResponse(church);
  }

  async create(actor: AuthUser, dto: CreateChurchDto) {
    const tenantId = this.requireTenantId(actor);
    await this.validatePastor(tenantId, dto.currentPastorId);

    const church = await this.prisma.church.create({
      data: {
        tenantId,
        name: dto.name,
        address: dto.address,
        city: dto.city,
        phone: dto.phone,
        status: dto.status,
        currentPastorId: dto.currentPastorId,
      },
      include: churchInclude,
    });

    return this.toResponse(church);
  }

  async update(actor: AuthUser, id: string, dto: UpdateChurchDto) {
    const existing = await this.getScopedChurch(actor, id);

    if (dto.currentPastorId !== undefined && dto.currentPastorId !== null) {
      await this.validatePastor(existing.tenantId, dto.currentPastorId);
    }

    const church = await this.prisma.church.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        city: dto.city,
        phone: dto.phone,
        status: dto.status,
        currentPastorId: dto.currentPastorId,
      },
      include: churchInclude,
    });

    return this.toResponse(church);
  }

  async deactivate(actor: AuthUser, id: string) {
    const church = await this.getScopedChurch(actor, id);

    const updated = await this.prisma.church.update({
      where: { id: church.id },
      data: { status: 'INACTIVE' },
      include: churchInclude,
    });

    return this.toResponse(updated);
  }

  private requireTenantId(actor: AuthUser): string {
    if (isSuperAdmin(actor)) {
      throw new BadRequestException(
        'Super Admin must operate within a tenant context for churches',
      );
    }
    if (!actor.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return actor.tenantId;
  }

  private async getScopedChurch(actor: AuthUser, id: string) {
    const church = await this.prisma.church.findUnique({
      where: { id },
      include: churchInclude,
    });

    if (!church) {
      throw new NotFoundException('Church not found');
    }

    if (!isSuperAdmin(actor) && church.tenantId !== actor.tenantId) {
      throw new ForbiddenException('Access denied to this church');
    }

    return church;
  }

  private async validatePastor(tenantId: string, pastorId?: string | null) {
    if (!pastorId) return;

    const minister = await this.prisma.minister.findFirst({
      where: { id: pastorId, tenantId },
    });

    if (!minister) {
      throw new BadRequestException('Pastor not found in this tenant');
    }
  }

  private toResponse(church: {
    id: string;
    tenantId: string;
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    status: string;
    currentPastorId: string | null;
    createdAt: Date;
    updatedAt: Date;
    currentPastor: { id: string; fullName: string; rank: string } | null;
  }) {
    return {
      id: church.id,
      tenantId: church.tenantId,
      name: church.name,
      address: church.address,
      city: church.city,
      phone: church.phone,
      status: church.status,
      currentPastorId: church.currentPastorId,
      currentPastor: church.currentPastor,
      createdAt: church.createdAt,
      updatedAt: church.updatedAt,
    };
  }
}
