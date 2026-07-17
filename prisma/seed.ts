import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  { key: 'tenants:manage', label: 'Administrar concilios' },
  { key: 'churches:read', label: 'Ver iglesias' },
  { key: 'churches:write', label: 'Gestionar iglesias' },
  { key: 'ministers:read', label: 'Ver ministros' },
  { key: 'ministers:write', label: 'Gestionar ministros' },
  { key: 'members:read', label: 'Ver miembros' },
  { key: 'members:write', label: 'Gestionar miembros' },
  { key: 'finance:read', label: 'Ver finanzas' },
  { key: 'finance:write', label: 'Gestionar finanzas' },
  { key: 'baptisms:read', label: 'Ver bautismos' },
  { key: 'baptisms:write', label: 'Gestionar bautismos' },
  { key: 'dedications:read', label: 'Ver presentaciones' },
  { key: 'dedications:write', label: 'Gestionar presentaciones' },
  { key: 'activities:read', label: 'Ver actividades' },
  { key: 'activities:write', label: 'Gestionar actividades' },
  { key: 'credentials:read', label: 'Ver credenciales' },
  { key: 'credentials:write', label: 'Gestionar credenciales' },
  { key: 'users:read', label: 'Ver usuarios' },
  { key: 'users:write', label: 'Gestionar usuarios' },
  { key: 'roles:read', label: 'Ver roles' },
  { key: 'roles:write', label: 'Gestionar roles' },
  { key: 'audit:read', label: 'Ver auditoría' },
] as const;

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { label: permission.label },
      create: permission,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const permissionIds = allPermissions.map((p) => p.id);

  let superAdminRole = await prisma.role.findFirst({
    where: { tenantId: null, name: 'Super Admin' },
  });

  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: {
        name: 'Super Admin',
        description: 'Administrador global de la plataforma',
      },
    });
  }

  await prisma.rolePermission.deleteMany({
    where: { roleId: superAdminRole.id },
  });
  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({
      roleId: superAdminRole.id,
      permissionId,
    })),
    skipDuplicates: true,
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-concilio' },
    update: { name: 'Concilio Demo' },
    create: {
      name: 'Concilio Demo',
      slug: 'demo-concilio',
    },
  });

  const councilAdminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Council Admin' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Council Admin',
      description: 'Administrador del concilio',
    },
  });

  const councilPermissions = allPermissions.filter(
    (p) => p.key !== 'tenants:manage',
  );

  await prisma.rolePermission.deleteMany({
    where: { roleId: councilAdminRole.id },
  });
  await prisma.rolePermission.createMany({
    data: councilPermissions.map((p) => ({
      roleId: councilAdminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  const passwordHash = await bcrypt.hash('Admin123!', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@council.local' },
    update: { passwordHash, fullName: 'Super Admin', isActive: true },
    create: {
      email: 'superadmin@council.local',
      passwordHash,
      fullName: 'Super Admin',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id },
    },
    update: {},
    create: { userId: superAdmin.id, roleId: superAdminRole.id },
  });

  const councilAdmin = await prisma.user.upsert({
    where: { email: 'admin@demo-concilio.local' },
    update: {
      passwordHash,
      fullName: 'Admin Concilio Demo',
      tenantId: tenant.id,
      isActive: true,
    },
    create: {
      email: 'admin@demo-concilio.local',
      passwordHash,
      fullName: 'Admin Concilio Demo',
      tenantId: tenant.id,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: councilAdmin.id, roleId: councilAdminRole.id },
    },
    update: {},
    create: { userId: councilAdmin.id, roleId: councilAdminRole.id },
  });

  const pastorPermissions = allPermissions.filter((p) =>
    [
      'members:read',
      'members:write',
      'finance:read',
      'finance:write',
      'baptisms:read',
      'baptisms:write',
      'dedications:read',
      'dedications:write',
      'activities:read',
      'activities:write',
      'credentials:read',
    ].includes(p.key),
  );

  const pastorRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Pastor' } },
    update: { description: 'Pastor de iglesia local' },
    create: {
      tenantId: tenant.id,
      name: 'Pastor',
      description: 'Pastor de iglesia local',
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: pastorRole.id } });
  await prisma.rolePermission.createMany({
    data: pastorPermissions.map((p) => ({
      roleId: pastorRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  const church = await prisma.church.upsert({
    where: { id: 'seed-church-demo' },
    update: { name: 'Iglesia Central Demo' },
    create: {
      id: 'seed-church-demo',
      tenantId: tenant.id,
      name: 'Iglesia Central Demo',
      city: 'Santo Domingo',
      address: 'Av. Principal #123',
    },
  });

  const demoPastorUser = await prisma.user.upsert({
    where: { email: 'pastor@demo-concilio.local' },
    update: {
      passwordHash,
      fullName: 'Pastor Demo',
      tenantId: tenant.id,
      isActive: true,
    },
    create: {
      email: 'pastor@demo-concilio.local',
      passwordHash,
      fullName: 'Pastor Demo',
      tenantId: tenant.id,
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: demoPastorUser.id, roleId: pastorRole.id },
    },
    update: {},
    create: { userId: demoPastorUser.id, roleId: pastorRole.id },
  });

  const demoMinister = await prisma.minister.upsert({
    where: {
      tenantId_identityDocument: {
        tenantId: tenant.id,
        identityDocument: '40200000000',
      },
    },
    update: {
      fullName: 'Pastor Demo',
      rank: 'PASTOR',
      status: 'ACTIVE',
      userId: demoPastorUser.id,
    },
    create: {
      tenantId: tenant.id,
      fullName: 'Pastor Demo',
      identityDocument: '40200000000',
      rank: 'PASTOR',
      status: 'ACTIVE',
      userId: demoPastorUser.id,
    },
  });

  const existingAssignment = await prisma.ministerAssignment.findFirst({
    where: {
      ministerId: demoMinister.id,
      churchId: church.id,
      endedAt: null,
    },
  });

  if (!existingAssignment) {
    await prisma.ministerAssignment.create({
      data: {
        tenantId: tenant.id,
        ministerId: demoMinister.id,
        churchId: church.id,
        startedAt: new Date(),
        createdById: councilAdmin.id,
      },
    });
  }

  await prisma.church.update({
    where: { id: church.id },
    data: { currentPastorId: demoMinister.id },
  });

  await prisma.pastorCredential.upsert({
    where: { credentialNo: 'CRE-DEMO-CONCILIO-2026-0001' },
    update: {
      status: 'ACTIVE',
      ministerId: demoMinister.id,
      tenantId: tenant.id,
    },
    create: {
      tenantId: tenant.id,
      ministerId: demoMinister.id,
      credentialNo: 'CRE-DEMO-CONCILIO-2026-0001',
      issuedAt: new Date(),
      expiresAt: new Date(new Date().getFullYear() + 2, 11, 31),
      status: 'ACTIVE',
      verifyToken: 'demo-pastor-verify-token-seed',
      createdById: councilAdmin.id,
    },
  });

  const councilActivityStart = new Date();
  councilActivityStart.setDate(councilActivityStart.getDate() + 14);
  councilActivityStart.setHours(10, 0, 0, 0);

  await prisma.activity.upsert({
    where: { id: 'seed-activity-council' },
    update: {
      title: 'Asamblea General del Concilio',
      tenantId: tenant.id,
    },
    create: {
      id: 'seed-activity-council',
      tenantId: tenant.id,
      scope: 'COUNCIL',
      title: 'Asamblea General del Concilio',
      description: 'Reunión anual de pastores y líderes del concilio.',
      location: 'Salón principal — sede central',
      startAt: councilActivityStart,
      endAt: new Date(councilActivityStart.getTime() + 3 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      notifyByEmail: false,
    },
  });

  const churchActivityStart = new Date();
  churchActivityStart.setDate(churchActivityStart.getDate() + 7);
  churchActivityStart.setHours(18, 30, 0, 0);

  await prisma.activity.upsert({
    where: { id: 'seed-activity-church' },
    update: {
      title: 'Servicio especial de oración',
      tenantId: tenant.id,
      churchId: church.id,
    },
    create: {
      id: 'seed-activity-church',
      tenantId: tenant.id,
      scope: 'CHURCH',
      churchId: church.id,
      title: 'Servicio especial de oración',
      description: 'Jornada de oración congregacional.',
      location: church.name,
      startAt: churchActivityStart,
      endAt: new Date(churchActivityStart.getTime() + 2 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      notifyByEmail: false,
    },
  });

  console.log('Seed completed.');
  console.log('Super Admin: superadmin@council.local / Admin123!');
  console.log('Council Admin: admin@demo-concilio.local / Admin123!');
  console.log('Pastor Demo: pastor@demo-concilio.local /  ');
  console.log('Demo church:', church.name);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
