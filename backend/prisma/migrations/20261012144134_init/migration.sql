-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "asset_type" AS ENUM ('FONT', 'IMAGE', 'VIDEO', 'AUDIO', 'SOFTWARE', 'DATASET', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "license_status" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "allocation_status" AS ENUM ('ACTIVE', 'RELEASED', 'REVOKED');

-- CreateEnum
CREATE TYPE "access_action" AS ENUM ('VIEW', 'DOWNLOAD', 'CHECKOUT', 'CHECKIN');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('EXPIRY_30', 'EXPIRY_15', 'EXPIRY_7', 'EXPIRED', 'OVER_ALLOCATION', 'SYSTEM');

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "max_users" INTEGER NOT NULL,
    "max_assets" INTEGER NOT NULL,
    "monthly_price" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "status" "tenant_status" NOT NULL DEFAULT 'TRIAL',
    "contact_email" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID,
    "role_id" INTEGER NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255),
    "google_id" VARCHAR(100),
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "user_agent" TEXT,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "contact_email" VARCHAR(255),
    "website" VARCHAR(255),
    "support_phone" VARCHAR(50),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "category_id" UUID,
    "owner_id" UUID NOT NULL,
    "asset_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "asset_type" "asset_type" NOT NULL,
    "status" "asset_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "change_notes" TEXT,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL DEFAULT '#6366f1',

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_tags" (
    "asset_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "asset_tags_pkey" PRIMARY KEY ("asset_id","tag_id")
);

-- CreateTable
CREATE TABLE "license_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "is_seat_based" BOOLEAN NOT NULL DEFAULT true,
    "is_expirable" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,

    CONSTRAINT "license_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "license_type_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "license_key" VARCHAR(255) NOT NULL,
    "total_seats" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "status" "license_status" NOT NULL DEFAULT 'ACTIVE',
    "terms" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_licenses" (
    "asset_id" UUID NOT NULL,
    "license_id" UUID NOT NULL,
    "assigned_by" UUID,
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_licenses_pkey" PRIMARY KEY ("asset_id","license_id")
);

-- CreateTable
CREATE TABLE "license_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "license_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "allocated_by" UUID,
    "allocated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ,
    "status" "allocation_status" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "license_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_access_logs" (
    "id" BIGSERIAL NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID,
    "license_id" UUID,
    "action" "access_action" NOT NULL,
    "ip_address" VARCHAR(45),
    "accessed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_renewals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "license_id" UUID NOT NULL,
    "renewed_by" UUID,
    "old_end_date" DATE NOT NULL,
    "new_end_date" DATE NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "renewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "table_name" VARCHAR(100) NOT NULL,
    "record_id" UUID NOT NULL,
    "action" "audit_action" NOT NULL,
    "old_data" JSONB,
    "new_data" JSONB,
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "license_id" UUID,
    "type" "notification_type" NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_plan_id_idx" ON "tenants"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "vendors_tenant_id_idx" ON "vendors"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tenant_id_name_key" ON "vendors"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "categories_tenant_id_idx" ON "categories"("tenant_id");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_name_key" ON "categories"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "assets_tenant_id_status_idx" ON "assets"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "assets_category_id_idx" ON "assets"("category_id");

-- CreateIndex
CREATE INDEX "assets_owner_id_idx" ON "assets"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenant_id_asset_code_key" ON "assets"("tenant_id", "asset_code");

-- CreateIndex
CREATE INDEX "asset_versions_asset_id_version_no_idx" ON "asset_versions"("asset_id", "version_no" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "asset_versions_asset_id_version_no_key" ON "asset_versions"("asset_id", "version_no");

-- CreateIndex
CREATE INDEX "tags_tenant_id_idx" ON "tags"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tags_tenant_id_name_key" ON "tags"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "asset_tags_tag_id_idx" ON "asset_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "license_types_name_key" ON "license_types"("name");

-- CreateIndex
CREATE INDEX "licenses_tenant_id_status_idx" ON "licenses"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "licenses_vendor_id_idx" ON "licenses"("vendor_id");

-- CreateIndex
CREATE INDEX "licenses_end_date_idx" ON "licenses"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_tenant_id_license_key_key" ON "licenses"("tenant_id", "license_key");

-- CreateIndex
CREATE INDEX "asset_licenses_license_id_idx" ON "asset_licenses"("license_id");

-- CreateIndex
CREATE INDEX "license_allocations_user_id_idx" ON "license_allocations"("user_id");

-- CreateIndex
CREATE INDEX "asset_access_logs_asset_id_accessed_at_idx" ON "asset_access_logs"("asset_id", "accessed_at" DESC);

-- CreateIndex
CREATE INDEX "license_renewals_license_id_renewed_at_idx" ON "license_renewals"("license_id", "renewed_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_performed_at_idx" ON "audit_logs"("tenant_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_versions" ADD CONSTRAINT "asset_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_tags" ADD CONSTRAINT "asset_tags_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_tags" ADD CONSTRAINT "asset_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_license_type_id_fkey" FOREIGN KEY ("license_type_id") REFERENCES "license_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_licenses" ADD CONSTRAINT "asset_licenses_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_licenses" ADD CONSTRAINT "asset_licenses_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_licenses" ADD CONSTRAINT "asset_licenses_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_allocations" ADD CONSTRAINT "license_allocations_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_allocations" ADD CONSTRAINT "license_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_allocations" ADD CONSTRAINT "license_allocations_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_access_logs" ADD CONSTRAINT "asset_access_logs_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_access_logs" ADD CONSTRAINT "asset_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_access_logs" ADD CONSTRAINT "asset_access_logs_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_renewals" ADD CONSTRAINT "license_renewals_renewed_by_fkey" FOREIGN KEY ("renewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==============================================================================
-- Extensions and Advanced Relational Integrity Constraints
-- Added as mandated by course specifications (/database/data-dictionary.md)
-- ==============================================================================

-- 1. PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. CHECK Constraints
ALTER TABLE "plans" ADD CONSTRAINT "chk_plans_max_users" CHECK ("max_users" > 0);
ALTER TABLE "plans" ADD CONSTRAINT "chk_plans_max_assets" CHECK ("max_assets" > 0);
ALTER TABLE "plans" ADD CONSTRAINT "chk_plans_monthly_price" CHECK ("monthly_price" >= 0);

ALTER TABLE "users" ADD CONSTRAINT "chk_users_auth_provider" CHECK ("password_hash" IS NOT NULL OR "google_id" IS NOT NULL);

ALTER TABLE "asset_versions" ADD CONSTRAINT "chk_asset_versions_version_no" CHECK ("version_no" >= 1);
ALTER TABLE "asset_versions" ADD CONSTRAINT "chk_asset_versions_file_size" CHECK ("file_size_bytes" >= 0);

ALTER TABLE "licenses" ADD CONSTRAINT "chk_licenses_total_seats" CHECK ("total_seats" >= 1);
ALTER TABLE "licenses" ADD CONSTRAINT "chk_licenses_cost" CHECK ("cost" >= 0);
ALTER TABLE "licenses" ADD CONSTRAINT "chk_licenses_dates" CHECK ("end_date" IS NULL OR "end_date" > "start_date");

ALTER TABLE "license_renewals" ADD CONSTRAINT "chk_license_renewals_cost" CHECK ("cost" >= 0);
ALTER TABLE "license_renewals" ADD CONSTRAINT "chk_license_renewals_dates" CHECK ("new_end_date" > "old_end_date");

-- 3. Partial Unique Indexes
CREATE UNIQUE INDEX "idx_license_alloc_active" ON "license_allocations" ("license_id", "user_id") WHERE status = 'ACTIVE';

-- 4. Partial Soft-Delete and Status Indexes
CREATE INDEX "idx_assets_deleted_at" ON "assets" ("deleted_at") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_licenses_deleted_at" ON "licenses" ("deleted_at") WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_licenses_end_date_active" ON "licenses" ("end_date") WHERE status = 'ACTIVE';
CREATE INDEX "idx_notifications_user_unread" ON "notifications" ("user_id", "is_read") WHERE is_read = false;

-- 5. GIN Trigram Indexes for Fast Fuzzy Text Search
CREATE INDEX "idx_assets_name_trgm" ON "assets" USING gin ("name" gin_trgm_ops);
CREATE INDEX "idx_licenses_name_trgm" ON "licenses" USING gin ("name" gin_trgm_ops);
