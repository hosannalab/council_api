-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ChurchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MinisterRank" AS ENUM ('PASTOR', 'PRESBYTER', 'DEACON', 'EVANGELIST', 'OTHER');

-- CreateEnum
CREATE TYPE "MinisterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FinanceType" AS ENUM ('TITHE', 'OFFERING', 'MISC_INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "ActivityScope" AS ENUM ('COUNCIL', 'CHURCH');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ActivityAudience" AS ENUM ('ALL', 'PASTORS_ONLY', 'LEADERS_ONLY');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "MemberMaritalStatus" AS ENUM ('MARRIED', 'SINGLE', 'WIDOWED', 'OTHER');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentSessionId" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Church" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "status" "ChurchStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPastorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Minister" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "identityDocument" TEXT NOT NULL,
    "rank" "MinisterRank" NOT NULL,
    "ordinationAt" TIMESTAMP(3),
    "status" "MinisterStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Minister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinisterAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ministerId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinisterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinisterComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ministerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinisterComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "identityDocument" TEXT NOT NULL,
    "maritalStatus" "MemberMaritalStatus",
    "profession" TEXT,
    "workplace" TEXT,
    "addressLine" TEXT,
    "neighborhood" TEXT,
    "sector" TEXT,
    "email" TEXT,
    "birthDate" TIMESTAMP(3),
    "phone" TEXT,
    "mobilePhone" TEXT,
    "conversionDate" TIMESTAMP(3),
    "baptismDate" TIMESTAMP(3),
    "workGroup" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberChurchHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "MemberChurchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinanceKind" NOT NULL,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "type" "FinanceType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "description" TEXT,
    "justification" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Baptism" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "memberId" TEXT,
    "place" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "officiantId" TEXT,
    "participants" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Baptism_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildDedication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "churchId" TEXT NOT NULL,
    "childName" TEXT NOT NULL,
    "parents" TEXT,
    "godparents" TEXT,
    "place" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "officiantId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildDedication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" "ActivityScope" NOT NULL,
    "churchId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" "ActivityStatus" NOT NULL DEFAULT 'SCHEDULED',
    "audience" "ActivityAudience" NOT NULL DEFAULT 'ALL',
    "notifyByEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PastorCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ministerId" TEXT NOT NULL,
    "credentialNo" TEXT NOT NULL,
    "photoUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "verifyToken" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PastorCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Church_tenantId_idx" ON "Church"("tenantId");

-- CreateIndex
CREATE INDEX "Church_tenantId_status_idx" ON "Church"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Minister_userId_key" ON "Minister"("userId");

-- CreateIndex
CREATE INDEX "Minister_tenantId_idx" ON "Minister"("tenantId");

-- CreateIndex
CREATE INDEX "Minister_tenantId_status_idx" ON "Minister"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Minister_tenantId_identityDocument_key" ON "Minister"("tenantId", "identityDocument");

-- CreateIndex
CREATE INDEX "MinisterAssignment_tenantId_ministerId_idx" ON "MinisterAssignment"("tenantId", "ministerId");

-- CreateIndex
CREATE INDEX "MinisterAssignment_tenantId_churchId_idx" ON "MinisterAssignment"("tenantId", "churchId");

-- CreateIndex
CREATE INDEX "MinisterComment_tenantId_ministerId_idx" ON "MinisterComment"("tenantId", "ministerId");

-- CreateIndex
CREATE INDEX "Member_tenantId_churchId_idx" ON "Member"("tenantId", "churchId");

-- CreateIndex
CREATE INDEX "Member_tenantId_isActive_idx" ON "Member"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Member_tenantId_identityDocument_key" ON "Member"("tenantId", "identityDocument");

-- CreateIndex
CREATE INDEX "MemberChurchHistory_tenantId_memberId_idx" ON "MemberChurchHistory"("tenantId", "memberId");

-- CreateIndex
CREATE INDEX "MemberComment_tenantId_memberId_idx" ON "MemberComment"("tenantId", "memberId");

-- CreateIndex
CREATE INDEX "MemberLog_tenantId_memberId_idx" ON "MemberLog"("tenantId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategory_tenantId_name_key" ON "FinanceCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FinanceTransaction_tenantId_churchId_date_idx" ON "FinanceTransaction"("tenantId", "churchId", "date");

-- CreateIndex
CREATE INDEX "FinanceTransaction_tenantId_type_idx" ON "FinanceTransaction"("tenantId", "type");

-- CreateIndex
CREATE INDEX "Baptism_tenantId_churchId_date_idx" ON "Baptism"("tenantId", "churchId", "date");

-- CreateIndex
CREATE INDEX "ChildDedication_tenantId_churchId_date_idx" ON "ChildDedication"("tenantId", "churchId", "date");

-- CreateIndex
CREATE INDEX "Activity_tenantId_scope_idx" ON "Activity"("tenantId", "scope");

-- CreateIndex
CREATE INDEX "Activity_tenantId_startAt_idx" ON "Activity"("tenantId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "PastorCredential_credentialNo_key" ON "PastorCredential"("credentialNo");

-- CreateIndex
CREATE UNIQUE INDEX "PastorCredential_verifyToken_key" ON "PastorCredential"("verifyToken");

-- CreateIndex
CREATE INDEX "PastorCredential_tenantId_ministerId_idx" ON "PastorCredential"("tenantId", "ministerId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Church" ADD CONSTRAINT "Church_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Church" ADD CONSTRAINT "Church_currentPastorId_fkey" FOREIGN KEY ("currentPastorId") REFERENCES "Minister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minister" ADD CONSTRAINT "Minister_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minister" ADD CONSTRAINT "Minister_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinisterAssignment" ADD CONSTRAINT "MinisterAssignment_ministerId_fkey" FOREIGN KEY ("ministerId") REFERENCES "Minister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinisterAssignment" ADD CONSTRAINT "MinisterAssignment_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinisterAssignment" ADD CONSTRAINT "MinisterAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinisterComment" ADD CONSTRAINT "MinisterComment_ministerId_fkey" FOREIGN KEY ("ministerId") REFERENCES "Minister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinisterComment" ADD CONSTRAINT "MinisterComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberChurchHistory" ADD CONSTRAINT "MemberChurchHistory_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberChurchHistory" ADD CONSTRAINT "MemberChurchHistory_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberComment" ADD CONSTRAINT "MemberComment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberComment" ADD CONSTRAINT "MemberComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberLog" ADD CONSTRAINT "MemberLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baptism" ADD CONSTRAINT "Baptism_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baptism" ADD CONSTRAINT "Baptism_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baptism" ADD CONSTRAINT "Baptism_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Baptism" ADD CONSTRAINT "Baptism_officiantId_fkey" FOREIGN KEY ("officiantId") REFERENCES "Minister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildDedication" ADD CONSTRAINT "ChildDedication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildDedication" ADD CONSTRAINT "ChildDedication_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildDedication" ADD CONSTRAINT "ChildDedication_officiantId_fkey" FOREIGN KEY ("officiantId") REFERENCES "Minister"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_churchId_fkey" FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastorCredential" ADD CONSTRAINT "PastorCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastorCredential" ADD CONSTRAINT "PastorCredential_ministerId_fkey" FOREIGN KEY ("ministerId") REFERENCES "Minister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PastorCredential" ADD CONSTRAINT "PastorCredential_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
