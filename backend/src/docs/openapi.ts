// ==============================================================================
// AssetVault: OpenAPI 3.0.3 Specification Document
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'AssetVault REST API',
    version: '1.0.0',
    description:
      'Complete RESTful API for AssetVault: Multi-Tenant Digital Asset & License Management System. Built with Express, TypeScript, and Prisma ORM on PostgreSQL 16.',
    contact: {
      name: 'AssetVault Engineering Team',
      email: 'support@assetvault.internal',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'AssetVault Primary API Endpoint',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your short-lived (15 min) JWT access token in the Authorization header.',
      },
      CookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description: 'Rotating HTTP-only refresh token for token refreshment.',
      },
    },
    schemas: {
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 5 },
          hasNext: { type: 'boolean', example: true },
          hasPrev: { type: 'boolean', example: false },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          statusCode: { type: 'integer', example: 400 },
          error: { type: 'string', example: 'Bad Request' },
          message: { type: 'string', example: 'Invalid input parameters' },
          details: { type: 'object' },
        },
      },
      Plan: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Free' },
          maxUsers: { type: 'integer', example: 5 },
          maxAssets: { type: 'integer', example: 50 },
          monthlyPrice: { type: 'number', example: 0 },
          isActive: { type: 'boolean', example: true },
        },
      },
      Tenant: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Acme Corp' },
          slug: { type: 'string', example: 'acme-corp' },
          status: { type: 'string', enum: ['TRIAL', 'ACTIVE', 'SUSPENDED'], example: 'ACTIVE' },
          contactEmail: { type: 'string', example: 'admin@acme.com' },
          planId: { type: 'integer', example: 1 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email', example: 'user@acme.com' },
          fullName: { type: 'string', example: 'Alice Smith' },
          role: { type: 'string', enum: ['SUPER_ADMIN', 'TENANT_ADMIN', 'ASSET_MANAGER', 'MEMBER'] },
          isActive: { type: 'boolean', example: true },
          tenantId: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Asset: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
          ownerId: { type: 'string', format: 'uuid' },
          assetCode: { type: 'string', example: 'AST-1001' },
          name: { type: 'string', example: 'Brand Guidelines 2026' },
          description: { type: 'string' },
          assetType: { type: 'string', enum: ['FONT', 'IMAGE', 'SOFTWARE', 'DATASET', 'VIDEO', 'DOCUMENT'] },
          status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      License: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          tenantId: { type: 'string', format: 'uuid' },
          vendorId: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Adobe CC Enterprise' },
          licenseKey: { type: 'string', example: '••••••••-1234' },
          totalSeats: { type: 'integer', example: 25 },
          cost: { type: 'number', example: 1200 },
          currency: { type: 'string', example: 'USD' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date', nullable: true },
          status: { type: 'string', enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'] },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'System health check and database connectivity verification',
        responses: {
          200: { description: 'Healthy' },
        },
      },
    },
    '/auth/register-tenant': {
      post: {
        tags: ['Authentication'],
        summary: 'Tenant self-registration with primary TENANT_ADMIN user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['organizationName', 'adminName', 'email', 'password'],
                properties: {
                  organizationName: { type: 'string', example: 'Acme Design Studio' },
                  adminName: { type: 'string', example: 'Alice Admin' },
                  email: { type: 'string', example: 'admin@acmedesign.internal' },
                  password: { type: 'string', example: 'Complex#P4ssw0rd!' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Tenant registered successfully' },
          400: { description: 'Validation failed' },
          409: { description: 'Organization or Email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Email and password authentication',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'admin@acmedesign.internal' },
                  password: { type: 'string', example: 'Complex#P4ssw0rd!' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated successfully with accessToken and refresh cookie' },
          401: { description: 'Invalid email or password' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate refresh token and issue new access token',
        responses: {
          200: { description: 'Token refreshed' },
          401: { description: 'Invalid or expired refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke active refresh token session',
        responses: {
          200: { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get currently authenticated user context',
        responses: {
          200: { description: 'User profile and tenant details' },
        },
      },
    },
    '/plans': {
      get: {
        tags: ['Plans'],
        summary: 'List subscription plans',
        responses: { 200: { description: 'List of plans' } },
      },
      post: {
        tags: ['Plans'],
        summary: 'Create subscription plan (SUPER_ADMIN only)',
        responses: { 201: { description: 'Plan created' } },
      },
    },
    '/tenants': {
      get: {
        tags: ['Tenants'],
        summary: 'List all tenants (SUPER_ADMIN only)',
        responses: { 200: { description: 'List of tenants' } },
      },
    },
    '/tenants/{id}': {
      get: {
        tags: ['Tenants'],
        summary: 'Get tenant details (SUPER_ADMIN or own tenant)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Tenant details' }, 404: { description: 'Tenant not found' } },
      },
      patch: {
        tags: ['Tenants'],
        summary: 'Update own tenant name/email (TENANT_ADMIN)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Tenant updated' } },
      },
    },
    '/tenants/{id}/status': {
      patch: {
        tags: ['Tenants'],
        summary: 'Suspend or activate tenant (SUPER_ADMIN only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Status updated' } },
      },
    },
    '/tenants/{id}/plan': {
      patch: {
        tags: ['Tenants'],
        summary: 'Change tenant plan (SUPER_ADMIN only)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Plan updated' } },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'List organization users (TENANT_ADMIN within tenant)',
        responses: { 200: { description: 'List of users' } },
      },
      post: {
        tags: ['Users'],
        summary: 'Create user within tenant (TENANT_ADMIN)',
        responses: { 201: { description: 'User created' } },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'User retrieved' } },
      },
      patch: {
        tags: ['Users'],
        summary: 'Update user profile',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'User updated' } },
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'User deleted' } },
      },
    },
    '/users/{id}/allocations': {
      get: {
        tags: ['Users'],
        summary: 'List license seats allocated to user',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'User allocations' } },
      },
    },
    '/vendors': {
      get: { tags: ['Vendors'], summary: 'List vendors', responses: { 200: { description: 'Vendors list' } } },
      post: { tags: ['Vendors'], summary: 'Create vendor', responses: { 201: { description: 'Vendor created' } } },
    },
    '/categories': {
      get: { tags: ['Categories'], summary: 'List categories', responses: { 200: { description: 'Categories list' } } },
      post: { tags: ['Categories'], summary: 'Create category', responses: { 201: { description: 'Category created' } } },
    },
    '/categories/tree': {
      get: { tags: ['Categories'], summary: 'Get category tree hierarchy', responses: { 200: { description: 'Hierarchical categories' } } },
    },
    '/tags': {
      get: { tags: ['Tags'], summary: 'List tags', responses: { 200: { description: 'Tags list' } } },
      post: { tags: ['Tags'], summary: 'Create tag', responses: { 201: { description: 'Tag created' } } },
    },
    '/assets': {
      get: { tags: ['Assets'], summary: 'List assets from v_asset_catalog with filtering', responses: { 200: { description: 'Assets catalog' } } },
      post: { tags: ['Assets'], summary: 'Create asset', responses: { 201: { description: 'Asset created' } } },
    },
    '/assets/export': {
      get: { tags: ['Assets'], summary: 'Export assets to CSV format', responses: { 200: { description: 'CSV file' } } },
    },
    '/assets/import': {
      post: { tags: ['Assets'], summary: 'Bulk import assets from CSV (atomic transaction)', responses: { 201: { description: 'Import summary' } } },
    },
    '/assets/{id}': {
      get: { tags: ['Assets'], summary: 'Get asset details', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Asset details' } } },
      patch: { tags: ['Assets'], summary: 'Update asset', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Asset updated' } } },
      delete: { tags: ['Assets'], summary: 'Soft delete asset', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Moved to trash' } } },
    },
    '/assets/{id}/restore': {
      post: { tags: ['Assets'], summary: 'Restore soft-deleted asset', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Asset restored' } } },
    },
    '/assets/{id}/versions': {
      get: { tags: ['Assets'], summary: 'List all asset versions', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Asset versions' } } },
      post: { tags: ['Assets'], summary: 'Upload new version (increments version_no)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 201: { description: 'Version created' } } },
    },
    '/assets/{id}/checkout': {
      post: { tags: ['Asset Access'], summary: 'Seat-gated asset checkout (sets IN_USE)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Checked out' }, 403: { description: 'No covering license seat' } } },
    },
    '/assets/{id}/checkin': {
      post: { tags: ['Asset Access'], summary: 'Asset checkin (sets AVAILABLE)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Checked in' } } },
    },
    '/assets/{id}/download': {
      get: { tags: ['Asset Access'], summary: 'Seat-gated asset download', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Download metadata and URL' }, 403: { description: 'Forbidden' } } },
    },
    '/assets/{id}/access-logs': {
      get: {
        tags: ['Asset Access'],
        summary: 'List access and audit logs for asset',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'cursor', in: 'query', required: false, schema: { type: 'string', pattern: '^\\d+$' } },
          { name: 'action', in: 'query', required: false, schema: { type: 'string', enum: ['VIEW', 'DOWNLOAD', 'CHECKOUT', 'CHECKIN'] } },
          { name: 'userId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
          { name: 'dateFrom', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'dateTo', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'sort', in: 'query', required: false, schema: { type: 'string', enum: ['accessedAt', 'action', 'id'] } },
          { name: 'order', in: 'query', required: false, schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: { description: 'Asset access logs' },
          400: { description: 'Validation failed (VALIDATION_ERROR)' },
        },
      },
    },
    '/licenses': {
      get: { tags: ['Licenses'], summary: 'List licenses with masked license keys', responses: { 200: { description: 'License list' } } },
      post: { tags: ['Licenses'], summary: 'Create license', responses: { 201: { description: 'License created' } } },
    },
    '/licenses/export': {
      get: { tags: ['Licenses'], summary: 'Export licenses to CSV', responses: { 200: { description: 'CSV file' } } },
    },
    '/licenses/{id}': {
      get: { tags: ['Licenses'], summary: 'Get license details (Reveals key to ADMIN/MANAGER and writes audit log)', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'License details' } } },
      patch: { tags: ['Licenses'], summary: 'Update license', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'License updated' } } },
      delete: { tags: ['Licenses'], summary: 'Soft delete license', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Moved to trash' } } },
    },
    '/licenses/{id}/restore': {
      post: { tags: ['Licenses'], summary: 'Restore soft-deleted license', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'License restored' } } },
    },
    '/licenses/{id}/renew': {
      post: { tags: ['Licenses'], summary: 'Renew license via sp_renew_license', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'License renewed' } } },
    },
    '/licenses/{id}/renewals': {
      get: { tags: ['Licenses'], summary: 'List license renewals history', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Renewal ledger' } } },
    },
    '/licenses/{id}/link-asset/{assetId}': {
      post: { tags: ['Licenses'], summary: 'Link asset to license coverage', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'assetId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 201: { description: 'Asset linked' } } },
      delete: { tags: ['Licenses'], summary: 'Unlink asset from license', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'assetId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Asset unlinked' } } },
    },
    '/licenses/{id}/allocate': {
      post: { tags: ['Allocations'], summary: 'Allocate seat via sp_allocate_license_seat', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 201: { description: 'Seat allocated' }, 409: { description: 'Full or already allocated' } } },
    },
    '/licenses/{id}/release': {
      post: { tags: ['Allocations'], summary: 'Release seat via sp_release_license_seat', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Seat released' } } },
    },
    '/licenses/{id}/allocations': {
      get: { tags: ['Allocations'], summary: 'List seats allocated for license', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Active allocations' } } },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List user notifications',
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'cursor', in: 'query', required: false, schema: { type: 'string', pattern: '^\\d+$' } },
          { name: 'isRead', in: 'query', required: false, schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'type', in: 'query', required: false, schema: { type: 'string', enum: ['EXPIRY_30', 'EXPIRY_15', 'EXPIRY_7', 'EXPIRED', 'OVER_ALLOCATION', 'SYSTEM'] } },
          { name: 'dateFrom', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'dateTo', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          { name: 'sort', in: 'query', required: false, schema: { type: 'string', enum: ['createdAt', 'isRead', 'type', 'id'] } },
          { name: 'order', in: 'query', required: false, schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: {
          200: { description: 'Notifications' },
          400: { description: 'Validation failed (VALIDATION_ERROR)' },
        },
      },
    },
    '/notifications/{id}/read': {
      patch: { tags: ['Notifications'], summary: 'Mark notification as read', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'Marked read' } } },
    },
    '/notifications/read-all': {
      patch: { tags: ['Notifications'], summary: 'Mark all user notifications as read', responses: { 200: { description: 'All marked read' } } },
    },
    '/admin/run-expiry-check': {
      post: { tags: ['Notifications'], summary: 'Trigger automated license expiration checks (fn_generate_expiry_notifications)', responses: { 200: { description: 'Notifications created count' } } },
    },
    '/audit-logs': {
      get: { tags: ['Audit'], summary: 'Query immutable audit ledger (TENANT_ADMIN only)', responses: { 200: { description: 'Audit log entries' } } },
    },
    '/audit-logs/{id}/diff': {
      get: { tags: ['Audit'], summary: 'Get oldData vs newData change diff', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'JSON diff' } } },
    },
    '/reports/dashboard': {
      get: { tags: ['Reports'], summary: 'Tenant operational and financial KPIs (fn_tenant_dashboard_stats)', responses: { 200: { description: 'Dashboard stats' } } },
    },
    '/reports/license-utilization': {
      get: { tags: ['Reports'], summary: 'License seat utilization view (v_license_utilization)', responses: { 200: { description: 'Utilization report' } } },
    },
    '/reports/expiring-licenses': {
      get: { tags: ['Reports'], summary: 'Licenses expiring within 30 days (v_expiring_licenses)', responses: { 200: { description: 'Expiring licenses' } } },
    },
    '/reports/vendor-spend': {
      get: { tags: ['Reports'], summary: 'Vendor spend analysis (v_vendor_spend)', responses: { 200: { description: 'Vendor spend' } } },
    },
    '/reports/spend-by-month': {
      get: { tags: ['Reports'], summary: 'Monthly spend and running total (Window Function SUM OVER)', responses: { 200: { description: 'Monthly running spend' } } },
    },
    '/reports/top-assets': {
      get: { tags: ['Reports'], summary: 'Top downloaded assets (Window Function RANK OVER)', responses: { 200: { description: 'Top assets' } } },
    },
    '/reports/unlicensed-assets': {
      get: { tags: ['Reports'], summary: 'Unlicensed and expired assets (v_asset_catalog compliance)', responses: { 200: { description: 'Unlicensed assets' } } },
    },
    '/reports/access-trend': {
      get: { tags: ['Reports'], summary: 'Access frequency trends (mv_monthly_access_stats)', responses: { 200: { description: 'Access trends' } } },
    },
    '/reports/compliance': {
      get: { tags: ['Reports'], summary: 'Tenant compliance score (0-100) and remediation checklist', responses: { 200: { description: 'Compliance score and drill-down' } } },
    },
    '/reports/unused-seats': {
      get: { tags: ['Reports'], summary: 'Unused license seat reclamation candidates and top vendor costs', responses: { 200: { description: 'Cost optimization insights' } } },
    },
    '/search': {
      get: { tags: ['Search'], summary: 'Global trigram multi-entity search across assets, licenses, vendors, and tags', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Search results grouped by entity' } } },
    },
    '/search/assets': {
      get: { tags: ['Search'], summary: 'Search digital assets with assets:read permission', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Matching assets' }, 403: { description: 'Forbidden' } } },
    },
    '/search/licenses': {
      get: { tags: ['Search'], summary: 'Search licenses with licenses:read permission (masks license keys for non-admin roles)', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Matching licenses' }, 403: { description: 'Forbidden' } } },
    },
    '/search/vendors': {
      get: { tags: ['Search'], summary: 'Search vendors with vendors:read permission', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Matching vendors' }, 403: { description: 'Forbidden' } } },
    },
    '/search/tags': {
      get: { tags: ['Search'], summary: 'Search metadata tags with tags:read permission', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Matching tags' }, 403: { description: 'Forbidden' } } },
    },
    '/licenses/{id}/pdf': {
      get: { tags: ['Licenses'], summary: 'Download branded PDF dossier for a software license', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { 200: { description: 'PDF binary stream' } } },
    },
    '/audit-logs/export': {
      get: { tags: ['Audit'], summary: 'Export filtered audit ledger records to RFC 4180 CSV', responses: { 200: { description: 'CSV file stream' } } },
    },
    '/tenant/export': {
      get: { tags: ['Tenants'], summary: 'Export complete tenant organization data archive as JSON (Tenant Admin)', responses: { 200: { description: 'Full JSON backup archive' } } },
    },
    '/notifications/stream': {
      get: { tags: ['Notifications'], summary: 'Server-Sent Events (SSE) stream for real-time notification delivery', responses: { 200: { description: 'SSE event stream' } } },
    },
    '/ready': {
      get: { tags: ['Health'], summary: 'Database connectivity readiness probe', responses: { 200: { description: 'PostgreSQL ready' }, 503: { description: 'Database disconnected' } } },
    },
    '/metrics': {
      get: { tags: ['Observability'], summary: 'Prometheus metrics endpoint (Protected by Bearer Token)', security: [{ BearerAuth: [] }], responses: { 200: { description: 'Prometheus metrics text' } } },
    },
    '/platform/overview': {
      get: { tags: ['Platform'], summary: 'Super Admin platform overview across all tenants (v_tenant_summary)', responses: { 200: { description: 'Cross-tenant summary' } } },
    },
  },
};
