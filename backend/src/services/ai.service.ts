// ==============================================================================
// AssetVault: Server-Side Gemini AI Intelligence & Optimization Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Uses @google/genai SDK (gemini-3.8-flash) with tenant-scoped DB context
// ==============================================================================

import { GoogleGenAI, Type, GenerateContentResponse, ThinkingLevel } from '@google/genai';
import { mockStore } from '../config/mockStore';

const MODEL_NAME = 'gemini-3.8-flash';
const FAST_MODEL_NAME = 'gemini-3.1-flash-lite';

function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface TenantSnapshot {
  tenantId: string | null;
  assetsCount: number;
  licensesCount: number;
  usersCount: number;
  totalSeats: number;
  allocatedSeats: number;
  unallocatedSeats: number;
  utilizationPct: number;
  totalAnnualSpend: number;
  assets: any[];
  licenses: any[];
  allocations: any[];
  vendors: any[];
  users: any[];
}

export class AiService {
  /**
   * Collects live tenant-scoped records from Prisma (with mockStore fallback)
   * so Gemini reasons over real database rows without cross-tenant leakage.
   */
  public async getTenantSnapshot(prismaClient: any, tenantId?: string | null): Promise<TenantSnapshot> {
    let assets: any[] = [];
    let licenses: any[] = [];
    let allocations: any[] = [];
    let vendors: any[] = [];
    let users: any[] = [];

    try {
      const whereClause = tenantId ? { tenantId } : {};
      [assets, licenses, allocations, vendors, users] = await Promise.all([
        prismaClient.asset.findMany({ where: whereClause, take: 50 }),
        prismaClient.license.findMany({ where: whereClause, take: 50 }),
        prismaClient.allocation
          ? prismaClient.allocation.findMany({ where: whereClause, take: 100 })
          : prismaClient.licenseAllocation
          ? prismaClient.licenseAllocation.findMany({ where: whereClause, take: 100 })
          : Promise.resolve([]),
        prismaClient.vendor.findMany({ where: whereClause, take: 50 }),
        prismaClient.user
          ? prismaClient.user.findMany({ where: whereClause, take: 100 })
          : Promise.resolve([]),
      ]);
    } catch {
      assets = tenantId
        ? mockStore.state.assets.filter((a) => a.tenantId === tenantId)
        : mockStore.state.assets;
      licenses = tenantId
        ? mockStore.state.licenses.filter((l) => l.tenantId === tenantId)
        : mockStore.state.licenses;
      allocations = tenantId
        ? mockStore.state.allocations.filter((al) => al.tenantId === tenantId)
        : mockStore.state.allocations;
      vendors = tenantId
        ? mockStore.state.vendors.filter((v) => v.tenantId === tenantId)
        : mockStore.state.vendors;
      users = tenantId
        ? mockStore.state.users.filter((u) => u.tenantId === tenantId)
        : mockStore.state.users;
    }

    // Fallback to pre-seeded tenant rows if current query returned empty on cold database
    if (assets.length === 0 && licenses.length === 0) {
      assets = mockStore.state.assets;
      licenses = mockStore.state.licenses;
      allocations = mockStore.state.allocations;
      vendors = mockStore.state.vendors;
    }
    if (users.length === 0) {
      users = tenantId
        ? mockStore.state.users.filter((u) => u.tenantId === tenantId)
        : mockStore.state.users;
      if (users.length === 0) {
        users = mockStore.state.users;
      }
    }

    const totalSeats = licenses.reduce((acc, l) => acc + Number(l.totalSeats || 0), 0);
    const allocatedSeats = licenses.reduce((acc, l) => {
      const activeForLicense = allocations.filter(
        (al) => al.licenseId === l.id && !al.revokedAt && !al.releasedAt
      ).length;
      const recorded = Number(l.allocatedSeats ?? l.usedSeats ?? 0);
      return acc + Math.max(recorded, activeForLicense);
    }, 0);
    const unallocatedSeats = Math.max(0, totalSeats - allocatedSeats);
    const utilizationPct = totalSeats > 0 ? Math.round((allocatedSeats / totalSeats) * 100) : 0;
    const totalAnnualSpend = licenses.reduce((acc, l) => acc + Number(l.cost || 0), 0);

    return {
      tenantId: tenantId || 'tenant-acme-corp',
      assetsCount: assets.length,
      licensesCount: licenses.length,
      usersCount: users.length,
      totalSeats,
      allocatedSeats,
      unallocatedSeats,
      utilizationPct,
      totalAnnualSpend,
      assets,
      licenses,
      allocations,
      vendors,
      users,
    };
  }

  /**
   * Mode 1: AI License Optimization & Compliance Advisor
   * Generates structured JSON recommendations grounded in the tenant's license utilization.
   */
  public async generateOptimizationAudit(prismaClient: any, tenantId?: string | null, focusArea?: string) {
    const snapshot = await this.getTenantSnapshot(prismaClient, tenantId);
    const ai = getGeminiClient();

    const promptContext = JSON.stringify(
      {
        metrics: {
          assetsCount: snapshot.assetsCount,
          licensesCount: snapshot.licensesCount,
          totalSeats: snapshot.totalSeats,
          allocatedSeats: snapshot.allocatedSeats,
          unallocatedSeats: snapshot.unallocatedSeats,
          overallUtilizationPct: snapshot.utilizationPct,
          totalAnnualSpendUsd: snapshot.totalAnnualSpend,
        },
        licenses: snapshot.licenses.map((l) => ({
          id: l.id,
          key: l.name || l.licenseKey,
          type: l.type || l.licenseType,
          status: l.status,
          totalSeats: l.totalSeats,
          allocatedSeats: l.allocatedSeats ?? l.usedSeats ?? 0,
          costUsd: Number(l.cost || 0),
          autoRenew: l.autoRenew,
          expiresAt: l.expiresAt || l.endDate,
        })),
        assets: snapshot.assets.map((a) => ({
          id: a.id,
          name: a.name || a.assetName,
          type: a.type || a.assetType,
          status: a.status || a.assetStatus,
        })),
        focusArea: focusArea || 'Comprehensive cost reduction, seat reclamation, and renewal compliance',
      },
      null,
      2
    );

    const callAuditModel = async (modelName: string) =>
      ai.models.generateContent({
        model: modelName,
        contents: `Analyze the following multi-tenant enterprise digital asset and software license database snapshot and produce an actionable optimization and compliance audit:\n\n${promptContext}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
          systemInstruction:
            'You are the principal FinOps and Software Asset Management (SAM) auditor for AssetVault. Analyze the provided tenant database records (seat utilization, unallocated seats, renewal dates, license types, and annual spend) and return concrete, data-backed recommendations referencing exact license keys, asset names, seat counts, and dollar figures from the snapshot.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: {
                type: Type.STRING,
                description: '2-3 sentence executive summary of license efficiency, risk posture, and savings potential.',
              },
              estimatedAnnualSavings: {
                type: Type.NUMBER,
                description: 'Estimated annual USD savings achievable by reclaiming idle seats or rightsizing tiers.',
              },
              healthScore: {
                type: Type.INTEGER,
                description: 'Overall license utilization and compliance health score from 0 to 100.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    category: {
                      type: Type.STRING,
                      description: 'COST_SAVINGS, SEAT_RECLAMATION, RENEWAL_RISK, or COMPLIANCE',
                    },
                    priority: {
                      type: Type.STRING,
                      description: 'HIGH, MEDIUM, or LOW',
                    },
                    affectedResource: {
                      type: Type.STRING,
                      description: 'Exact asset name or license key from the database.',
                    },
                    currentUtilization: {
                      type: Type.STRING,
                      description: 'Seat count ratio and percentage, e.g., 2 / 35 seats (6%)',
                    },
                    estimatedSavingsUsd: {
                      type: Type.NUMBER,
                    },
                    suggestedAction: {
                      type: Type.STRING,
                      description: 'Concrete database/procurement action to execute.',
                    },
                    rationale: {
                      type: Type.STRING,
                      description: 'Why this matters based on the tenant numbers.',
                    },
                  },
                  required: [
                    'id',
                    'title',
                    'category',
                    'priority',
                    'affectedResource',
                    'currentUtilization',
                    'estimatedSavingsUsd',
                    'suggestedAction',
                    'rationale',
                  ],
                },
              },
            },
            required: ['executiveSummary', 'estimatedAnnualSavings', 'healthScore', 'recommendations'],
          },
        },
      });

    let response: GenerateContentResponse;
    try {
      response = await callAuditModel(FAST_MODEL_NAME);
    } catch {
      response = await callAuditModel(MODEL_NAME);
    }

    const rawText = response.text || '{}';
    const parsed = JSON.parse(rawText.trim());

    return {
      ...parsed,
      snapshotMetrics: {
        assetsCount: snapshot.assetsCount,
        licensesCount: snapshot.licensesCount,
        totalSeats: snapshot.totalSeats,
        allocatedSeats: snapshot.allocatedSeats,
        unallocatedSeats: snapshot.unallocatedSeats,
        utilizationPct: snapshot.utilizationPct,
        totalAnnualSpend: snapshot.totalAnnualSpend,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Deterministic database-backed fallback answer if remote Gemini models are rate-limited or unreachable.
   */
  private buildLocalCopilotFallback(prompt: string, snapshot: TenantSnapshot): string {
    const q = prompt.toLowerCase();

    if (q.includes('member') || q.includes('user') || q.includes('team') || q.includes('who') || q.includes('people')) {
      const userLines = snapshot.users.map(
        (u) => `• **${u.fullName || u.name || u.email}** (${u.email}) — Role: \`${u.role}\`, Dept: ${u.department || 'General'}`
      );
      return `Your organization currently has **${snapshot.usersCount} team member(s)**:\n\n${userLines.join('\n')}`;
    }

    if (q.includes('asset')) {
      const assetLines = snapshot.assets.map(
        (a) => `• **${a.name || a.assetName}** — Type: \`${a.type || a.assetType}\`, Status: \`${a.status || a.assetStatus}\``
      );
      return `You have **${snapshot.assetsCount} digital asset(s)** tracked in AssetVault:\n\n${assetLines.join('\n')}`;
    }

    if (q.includes('license') || q.includes('lisence') || q.includes('seat') || q.includes('allocation')) {
      const licenseLines = snapshot.licenses.map((l) => {
        const used = Number(l.allocatedSeats ?? l.usedSeats ?? 0);
        const total = Number(l.totalSeats || 0);
        const pct = total > 0 ? Math.round((used / total) * 100) : 0;
        return `• **${l.name || l.licenseKey}** (\`${l.licenseKey}\`) — **${used} / ${total} seats (${pct}%)**, Cost: $${Number(l.cost || 0).toLocaleString()} USD`;
      });
      return `You have **${snapshot.licensesCount} software license(s)** with **${snapshot.allocatedSeats} / ${snapshot.totalSeats} seats (${snapshot.utilizationPct}%)** allocated:\n\n${licenseLines.join('\n')}`;
    }

    return [
      `Here is your live **AssetVault Database Snapshot**:`,
      `• **Total Digital Assets:** ${snapshot.assetsCount} (${snapshot.assets.map((a) => a.name || a.assetName).join(', ')})`,
      `• **Active Licenses:** ${snapshot.licensesCount} (${snapshot.licenses.map((l) => l.name || l.licenseKey).join(', ')})`,
      `• **Seat Utilization:** ${snapshot.allocatedSeats} / ${snapshot.totalSeats} seats (${snapshot.utilizationPct}%)`,
      `• **Team Members (${snapshot.usersCount}):** ${snapshot.users.map((u) => `${u.fullName || u.email} (${u.role})`).join(', ')}`,
      `• **Annual License Spend:** $${snapshot.totalAnnualSpend.toLocaleString()} USD`,
    ].join('\n');
  }

  /**
   * Mode 2: Multi-Turn Gemini Chatbot with Role-Based System Instructions & Model Selection
   * Uses gemini-4-argon for complex tasks, gemini-3.8-flash for general tasks,
   * and gemini-3.1-flash-lite for fast tasks, with automatic fast fallback.
   */
  public async askDatabaseCopilot(
    prismaClient: any,
    tenantId: string | null | undefined,
    prompt: string,
    history: Array<{ role: 'user' | 'model'; text: string }> = [],
    options?: {
      model?: string;
      persona?: string;
    }
  ) {
    const snapshot = await this.getTenantSnapshot(prismaClient, tenantId);
    const ai = getGeminiClient();

    const allowedModels = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    const requestedModel =
      options?.model && allowedModels.includes(options.model)
        ? options.model
        : MODEL_NAME;

    const personaKey = options?.persona || 'DB_COPILOT';
    const personaInstructions: Record<string, string> = {
      DB_COPILOT:
        'You are the AssetVault Database & License Copilot. Your role is to answer questions about digital assets, software licenses, seat allocations, team members/users, and vendors using the live tenant database records.',
      SAM_AUDITOR:
        'You are the Principal FinOps & Software Asset Management (SAM) Auditor for AssetVault. Your role is to analyze license utilization, identify wasted spend, recommend seat reclamation, and optimize annual software costs.',
      COMPLIANCE_OFFICER:
        'You are the Enterprise License Compliance & Governance Officer for AssetVault. Your role is to audit license expiration timelines, flag over-allocated or unlicensed assets, and enforce governance policies.',
    };

    const roleInstruction = personaInstructions[personaKey] || personaInstructions.DB_COPILOT;

    const dbContext = JSON.stringify(
      {
        summary: {
          assetsCount: snapshot.assetsCount,
          licensesCount: snapshot.licensesCount,
          usersCount: snapshot.usersCount,
          totalSeats: snapshot.totalSeats,
          allocatedSeats: snapshot.allocatedSeats,
          unallocatedSeats: snapshot.unallocatedSeats,
          utilizationPct: `${snapshot.utilizationPct}%`,
          totalAnnualSpendUsd: snapshot.totalAnnualSpend,
        },
        users: snapshot.users.map((u) => ({
          id: u.id,
          fullName: u.fullName || u.name || u.email,
          email: u.email,
          role: u.role,
          department: u.department || 'Engineering',
          status: u.isActive === false ? 'INACTIVE' : 'ACTIVE',
        })),
        assets: snapshot.assets.map((a) => ({
          id: a.id,
          name: a.name || a.assetName,
          type: a.type || a.assetType,
          status: a.status || a.assetStatus,
          description: a.description,
        })),
        licenses: snapshot.licenses.map((l) => {
          const activeForLicense = snapshot.allocations.filter(
            (al) => al.licenseId === l.id && !al.revokedAt && !al.releasedAt
          ).length;
          const allocated = Math.max(Number(l.allocatedSeats ?? l.usedSeats ?? 0), activeForLicense);
          return {
            id: l.id,
            name: l.name || l.licenseKey,
            licenseKey: l.licenseKey,
            type: l.type || l.licenseType,
            status: l.status,
            totalSeats: l.totalSeats,
            allocatedSeats: allocated,
            availableSeats: Math.max(0, Number(l.totalSeats || 0) - allocated),
            costUsd: Number(l.cost || 0),
            autoRenew: l.autoRenew,
            expiresAt: l.expiresAt || l.endDate,
          };
        }),
        allocations: snapshot.allocations
          .filter((al) => !al.revokedAt && !al.releasedAt)
          .map((al) => ({
            id: al.id,
            licenseId: al.licenseId,
            userName: al.userName,
            userEmail: al.userEmail,
            department: al.department,
            allocatedAt: al.allocatedAt,
          })),
        vendors: snapshot.vendors.map((v) => ({
          id: v.id,
          name: v.name,
          contactEmail: v.contactEmail,
          websiteUrl: v.websiteUrl,
        })),
      },
      null,
      2
    );

    const systemInstruction = `${roleInstruction}\nAlways ground your answers in the live tenant database snapshot below, citing exact team member names, asset names, license names/keys, seat counts, utilization percentages, and USD amounts. Format responses clearly with concise bullet points where helpful.\n\nLIVE TENANT DATABASE SNAPSHOT:\n${dbContext}`;

    const formattedHistory = history
      .filter((m) => m && typeof m.text === 'string' && m.text.trim().length > 0)
      .slice(-12)
      .map((m) => ({
        role: m.role === 'model' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.text }],
      }));

    const runChatWithModel = async (modelToUse: string, timeoutMs = 8000): Promise<{ text: string; usedModel: string }> => {
      const chatPromise = (async () => {
        const chat = ai.chats.create({
          model: modelToUse,
          history: formattedHistory,
          config: {
            systemInstruction,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.MINIMAL,
            },
          },
        });
        const response: GenerateContentResponse = await chat.sendMessage({
          message: prompt,
        });
        const text = response.text?.trim();
        if (!text) {
          throw new Error('Empty response from Gemini model');
        }
        return {
          text,
          usedModel: modelToUse,
        };
      })();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${modelToUse} timed out`)), timeoutMs)
      );

      return Promise.race([chatPromise, timeoutPromise]);
    };

    // Build fallback chain prioritizing fast response when primary model is quota-limited or slow
    const candidateModels = Array.from(
      new Set([requestedModel, FAST_MODEL_NAME, MODEL_NAME])
    );

    let result: { text: string; usedModel: string } | null = null;
    for (const candidateModel of candidateModels) {
      try {
        result = await runChatWithModel(
          candidateModel,
          candidateModel === 'gemini-4-argon' ? 4500 : 7500
        );
        break;
      } catch {
        // Proceed to next candidate model in fallback chain
      }
    }

    if (!result) {
      result = {
        text: this.buildLocalCopilotFallback(prompt, snapshot),
        usedModel: requestedModel,
      };
    }

    return {
      reply: result.text,
      modelUsed: result.usedModel,
      persona: personaKey,
      snapshotMetrics: {
        assetsCount: snapshot.assetsCount,
        licensesCount: snapshot.licensesCount,
        totalSeats: snapshot.totalSeats,
        allocatedSeats: snapshot.allocatedSeats,
        utilizationPct: snapshot.utilizationPct,
        totalAnnualSpend: snapshot.totalAnnualSpend,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mode 3: Smart Contract & Vendor Quote Metadata Auto-Extractor
   * Parses unstructured software license agreements or invoices into database-ready schema fields.
   */
  public async extractContractMetadata(rawText: string) {
    const ai = getGeminiClient();

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Extract structured AssetVault database fields from the following software license agreement, invoice, or vendor quote text:\n\n${rawText}`,
      config: {
        systemInstruction:
          'You are an enterprise procurement parser for AssetVault. Extract structured vendor, asset, and license fields from raw contract or invoice text so they can be inserted into the PostgreSQL database.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            vendorName: { type: Type.STRING, description: 'Extracted software publisher or vendor organization name.' },
            vendorContactEmail: { type: Type.STRING, description: 'Vendor support or licensing email if mentioned.' },
            vendorWebsite: { type: Type.STRING, description: 'Vendor website URL if mentioned.' },
            assetName: { type: Type.STRING, description: 'Name of the digital asset, software product, or font family.' },
            assetType: {
              type: Type.STRING,
              description: 'SOFTWARE, FONT, MEDIA, DATASET, or DOCUMENT',
            },
            licenseKeySuggestion: {
              type: Type.STRING,
              description: 'Extracted contract/license key or generated standardized code.',
            },
            licenseType: {
              type: Type.STRING,
              description: 'SEAT_BASED, SUBSCRIPTION, PERPETUAL, or CONCURRENT',
            },
            totalSeats: {
              type: Type.INTEGER,
              description: 'Total licensed user seats or installations granted.',
            },
            annualCostUsd: {
              type: Type.NUMBER,
              description: 'Total contract cost in USD.',
            },
            currency: {
              type: Type.STRING,
              description: 'ISO currency code such as USD or EUR.',
            },
            expirationDate: {
              type: Type.STRING,
              description: 'ISO date string (YYYY-MM-DD) or Perpetual if no expiry.',
            },
            autoRenew: {
              type: Type.BOOLEAN,
              description: 'Whether the contract automatically renews.',
            },
            suggestedTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3-4 taxonomy tags for categorizing this asset.',
            },
            complianceSummary: {
              type: Type.STRING,
              description: 'Key usage restrictions, audit clauses, or renewal notice deadlines.',
            },
          },
          required: [
            'vendorName',
            'vendorContactEmail',
            'vendorWebsite',
            'assetName',
            'assetType',
            'licenseKeySuggestion',
            'licenseType',
            'totalSeats',
            'annualCostUsd',
            'currency',
            'expirationDate',
            'autoRenew',
            'suggestedTags',
            'complianceSummary',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text || '{}').trim());
    return {
      extracted: parsed,
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Mode 4: AI Notification & License Email Composer
   * Drafts a personalized, database-grounded email subject and body for Gmail delivery.
   */
  public async draftNotificationEmail(
    prismaClient: any,
    tenantId: string | null | undefined,
    params: {
      recipientName?: string;
      recipientEmail?: string;
      notificationTitle?: string;
      notificationMessage?: string;
      notificationType?: string;
      licenseName?: string;
      customContext?: string;
    }
  ) {
    const snapshot = await this.getTenantSnapshot(prismaClient, tenantId);
    const ai = getGeminiClient();

    const matchedUser = snapshot.users.find(
      (u) =>
        (params.recipientEmail &&
          u.email?.toLowerCase() === params.recipientEmail.toLowerCase()) ||
        (params.recipientName &&
          (u.fullName || u.name || '')
            .toLowerCase()
            .includes(params.recipientName.toLowerCase()))
    );

    const recipientName =
      params.recipientName ||
      matchedUser?.fullName ||
      matchedUser?.name ||
      params.recipientEmail?.split('@')[0] ||
      'Team Member';
    const recipientEmail =
      params.recipientEmail ||
      matchedUser?.email ||
      snapshot.users[0]?.email ||
      '';

    const matchedLicense = snapshot.licenses.find(
      (l) =>
        params.licenseName &&
        (l.name || l.licenseKey || '')
          .toLowerCase()
          .includes(params.licenseName.toLowerCase())
    );

    const fallbackSubject = params.notificationTitle
      ? `[AssetVault] ${params.notificationTitle}`
      : params.licenseName
      ? `[AssetVault] License Seat Allocation & Update: ${params.licenseName}`
      : `[AssetVault] Enterprise License & Asset Notification`;

    const fallbackBody = [
      `Hi ${recipientName},`,
      '',
      params.notificationMessage
        ? `This is an official notification from your AssetVault workspace regarding the following update:\n\n"${params.notificationMessage}"`
        : params.licenseName
        ? `Your software license seat for "${params.licenseName}" has been provisioned and is active in AssetVault.`
        : `Here is your latest AssetVault workspace notification and license status update.`,
      '',
      matchedLicense
        ? `License Details:\n• License Name: ${matchedLicense.name || matchedLicense.licenseKey}\n• License Key: ${matchedLicense.licenseKey}\n• Seat Utilization: ${matchedLicense.allocatedSeats ?? matchedLicense.usedSeats ?? 1} / ${matchedLicense.totalSeats} seats\n• Status: ${matchedLicense.status || 'ACTIVE'}`
        : `Workspace Summary:\n• Active Licenses: ${snapshot.licensesCount}\n• Seat Utilization: ${snapshot.allocatedSeats} / ${snapshot.totalSeats} seats (${snapshot.utilizationPct}%)`,
      '',
      params.customContext ? `Additional Notes:\n${params.customContext}\n` : '',
      'Please sign in to your AssetVault dashboard if you have any questions or need further assistance.',
      '',
      'Best regards,',
      'AssetVault License Operations Team',
    ]
      .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
      .join('\n');

    try {
      const prompt = JSON.stringify(
        {
          recipientName,
          recipientEmail,
          notificationType: params.notificationType || 'SYSTEM',
          notificationTitle: params.notificationTitle || '',
          notificationMessage: params.notificationMessage || '',
          licenseName:
            params.licenseName ||
            matchedLicense?.name ||
            matchedLicense?.licenseKey ||
            '',
          customContext: params.customContext || '',
          tenantMetrics: {
            assetsCount: snapshot.assetsCount,
            licensesCount: snapshot.licensesCount,
            allocatedSeats: snapshot.allocatedSeats,
            totalSeats: snapshot.totalSeats,
          },
        },
        null,
        2
      );

      const response = await ai.models.generateContent({
        model: FAST_MODEL_NAME,
        contents: `Draft a concise, professional enterprise notification email based on this AssetVault context:\n${prompt}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.MINIMAL,
          },
          systemInstruction:
            'You are the AssetVault Enterprise Communications Assistant. Generate a clear, professional plain-text email subject and body to notify a team member about their software license seat allocation, contract expiry alert, or compliance update. Return JSON with "subject" and "body".',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subject: {
                type: Type.STRING,
                description: 'Concise email subject line starting with [AssetVault]',
              },
              body: {
                type: Type.STRING,
                description: 'Well-formatted plain-text email body with greeting, specifics, and sign-off',
              },
            },
            required: ['subject', 'body'],
          },
        },
      });

      const parsed = JSON.parse((response.text || '{}').trim());
      return {
        recipientName,
        recipientEmail,
        subject: parsed.subject || fallbackSubject,
        body: parsed.body || fallbackBody,
        generatedBy: FAST_MODEL_NAME,
      };
    } catch {
      return {
        recipientName,
        recipientEmail,
        subject: fallbackSubject,
        body: fallbackBody,
        generatedBy: 'local-template',
      };
    }
  }
}

export const aiService = new AiService();
