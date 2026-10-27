-- CreateIndex
CREATE INDEX "asset_access_logs_user_id_idx" ON "asset_access_logs"("user_id");

-- CreateIndex
CREATE INDEX "license_allocations_license_id_idx" ON "license_allocations"("license_id");

-- CreateIndex
CREATE INDEX "licenses_license_type_id_idx" ON "licenses"("license_type_id");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- Ensure GIN Trigram Search Indexes remain intact
CREATE INDEX IF NOT EXISTS "idx_assets_name_trgm" ON "assets" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_licenses_name_trgm" ON "licenses" USING gin ("name" gin_trgm_ops);
