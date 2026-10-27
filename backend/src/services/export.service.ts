// ==============================================================================
// AssetVault: Export Subsystem (PDF License Reports & CSV Audit Logs)
// Course: BCSE307L Database Systems (Fall 2026-27)
// Generates styled PDF reports with PDFKit and RFC 4180 compliant CSV exports
// ==============================================================================

import PDFDocument from 'pdfkit';
import { prismaForRequest } from '../config/prisma';
import { NotFoundError } from '../errors/AppError';

export class ExportService {
  /**
   * Generates a styled PDF license dossier
   */
  public async generateLicensePdf(licenseId: string, tenantId: string): Promise<InstanceType<typeof PDFDocument>> {
    const scopedPrisma = prismaForRequest({ tenantId });

    // 1. Fetch license with related vendor, covered assets, allocations, and renewals
    const license = await scopedPrisma.license.findFirst({
      where: {
        id: licenseId,
        tenantId,
        deletedAt: null,
      },
      include: {
        vendor: true,
        licenseType: true,
        assetLicenses: {
          include: {
            asset: true,
          },
        },
        allocations: {
          where: { status: 'ACTIVE' },
          include: {
            user: true,
          },
        },
        renewals: {
          orderBy: { renewedAt: 'desc' },
          include: {
            renewer: true,
          },
        },
      },
    });

    if (!license) {
      throw new NotFoundError(`License with ID ${licenseId} not found`);
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    // Document styling constants
    const primaryColor = '#0f172a';
    const accentColor = '#2563eb';
    const grayColor = '#64748b';
    const darkGray = '#1e293b';

    // Header banner
    doc.rect(40, 40, 515, 60).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('ASSETVAULT ENTERPRISE REPORT', 55, 52);
    doc.fontSize(10).font('Helvetica').text(`Comprehensive Software License Dossier • Generated: ${new Date().toISOString().split('T')[0]}`, 55, 75);

    doc.moveDown(3);

    // Section 1: License Overview
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text(`1. License Overview: ${license.name}`);
    doc.moveDown(0.5);

    const startY = doc.y;
    doc.rect(40, startY, 515, 110).stroke('#e2e8f0');

    doc.fontSize(9).font('Helvetica-Bold').fillColor(grayColor);
    doc.text('VENDOR', 55, startY + 12);
    doc.text('LICENSE TYPE', 190, startY + 12);
    doc.text('STATUS', 330, startY + 12);
    doc.text('TOTAL SEATS', 450, startY + 12);

    doc.fontSize(10).font('Helvetica').fillColor(darkGray);
    doc.text(license.vendor.name, 55, startY + 26);
    doc.text(license.licenseType.name, 190, startY + 26);
    doc.text(license.status, 330, startY + 26);
    doc.text(license.totalSeats.toString(), 450, startY + 26);

    doc.fontSize(9).font('Helvetica-Bold').fillColor(grayColor);
    doc.text('START DATE', 55, startY + 52);
    doc.text('EXPIRATION DATE', 190, startY + 52);
    doc.text('ANNUAL COST', 330, startY + 52);
    doc.text('AUTO RENEW', 450, startY + 52);

    doc.fontSize(10).font('Helvetica').fillColor(darkGray);
    doc.text(license.startDate ? (new Date(license.startDate).toISOString().split('T')[0] || '') : 'N/A', 55, startY + 66);
    doc.text(license.endDate ? (new Date(license.endDate).toISOString().split('T')[0] || '') : 'Perpetual', 190, startY + 66);
    doc.text(`$${Number(license.cost).toFixed(2)} ${license.currency}`, 330, startY + 66);
    doc.text(license.autoRenew ? 'Enabled (Auto)' : 'Manual', 450, startY + 66);

    doc.fontSize(9).font('Helvetica-Bold').fillColor(grayColor);
    doc.text('MASKED KEY', 55, startY + 88);
    doc.fontSize(10).font('Helvetica').fillColor(accentColor);
    doc.text(license.licenseKey ? '••••-••••-••••-' + license.licenseKey.slice(-4) : 'N/A', 140, startY + 88);

    doc.y = startY + 125;

    // Section 2: Covered Assets
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text(`2. Covered Digital Assets (${license.assetLicenses.length})`);
    doc.moveDown(0.3);

    if (license.assetLicenses.length === 0) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(grayColor).text('No digital assets are currently associated with this license.');
    } else {
      let assetY = doc.y;
      doc.rect(40, assetY, 515, 18).fill('#f1f5f9');
      doc.fillColor(darkGray).fontSize(8).font('Helvetica-Bold');
      doc.text('ASSET CODE', 45, assetY + 5);
      doc.text('ASSET NAME', 140, assetY + 5);
      doc.text('TYPE', 360, assetY + 5);
      doc.text('STATUS', 470, assetY + 5);

      assetY += 20;
      doc.font('Helvetica').fontSize(8);

      for (const al of license.assetLicenses.slice(0, 8)) {
        doc.text(al.asset.assetCode, 45, assetY);
        doc.text(al.asset.name.slice(0, 35), 140, assetY);
        doc.text(al.asset.assetType, 360, assetY);
        doc.text(al.asset.status, 470, assetY);
        assetY += 15;
      }
      doc.y = assetY;
    }

    doc.moveDown(1);

    // Section 3: Active Seat Allocations
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text(`3. Active Seat Allocations (${license.allocations.length} / ${license.totalSeats})`);
    doc.moveDown(0.3);

    if (license.allocations.length === 0) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(grayColor).text('No active seat allocations currently assigned for this license.');
    } else {
      let allocY = doc.y;
      doc.rect(40, allocY, 515, 18).fill('#f1f5f9');
      doc.fillColor(darkGray).fontSize(8).font('Helvetica-Bold');
      doc.text('MEMBER NAME', 45, allocY + 5);
      doc.text('EMAIL ADDRESS', 200, allocY + 5);
      doc.text('ALLOCATED AT', 420, allocY + 5);

      allocY += 20;
      doc.font('Helvetica').fontSize(8);

      for (const la of license.allocations.slice(0, 10)) {
        doc.text(la.user.fullName, 45, allocY);
        doc.text(la.user.email, 200, allocY);
        doc.text(new Date(la.allocatedAt).toISOString().split('T')[0] || '', 420, allocY);
        allocY += 14;
      }
      doc.y = allocY;
    }

    doc.moveDown(1);

    // Section 4: Renewal History
    doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold').text(`4. Historical Contract Renewals (${license.renewals.length})`);
    doc.moveDown(0.3);

    if (license.renewals.length === 0) {
      doc.fontSize(9).font('Helvetica-Oblique').fillColor(grayColor).text('No historical renewals recorded on this license ledger.');
    } else {
      let renewY = doc.y;
      doc.rect(40, renewY, 515, 18).fill('#f1f5f9');
      doc.fillColor(darkGray).fontSize(8).font('Helvetica-Bold');
      doc.text('RENEWAL DATE', 45, renewY + 5);
      doc.text('NEW EXPIRY', 140, renewY + 5);
      doc.text('COST', 250, renewY + 5);
      doc.text('PERFORMED BY', 340, renewY + 5);

      renewY += 20;
      doc.font('Helvetica').fontSize(8);

      for (const ren of license.renewals.slice(0, 5)) {
        doc.text(new Date(ren.renewedAt).toISOString().split('T')[0] || '', 45, renewY);
        doc.text(new Date(ren.newEndDate).toISOString().split('T')[0] || '', 140, renewY);
        doc.text(`$${Number(ren.cost).toFixed(2)}`, 250, renewY);
        doc.text(ren.renewer?.fullName || 'System Administrator', 340, renewY);
        renewY += 14;
      }
      doc.y = renewY;
    }

    // Document Footer
    doc.fontSize(8).fillColor(grayColor).text('Confidential Document • AssetVault Multi-Tenant SaaS • Academic Course Project BCSE307L', 40, 780, {
      align: 'center',
      width: 515,
    });

    return doc;
  }

  /**
   * Generates RFC 4180 CSV export of filtered audit logs
   */
  public async generateAuditLogCsv(
    tenantId: string,
    filters: {
      action?: string;
      tableName?: string;
      startDate?: string;
      endDate?: string;
      userId?: string;
    }
  ): Promise<string> {
    const where: any = { tenantId };

    const validAuditActions = ['INSERT', 'UPDATE', 'DELETE'];
    if (filters.action) {
      if (validAuditActions.includes(filters.action)) {
        where.action = filters.action;
      } else {
        where.id = BigInt(-1);
      }
    }
    if (filters.tableName) {
      where.tableName = filters.tableName;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.startDate || filters.endDate) {
      where.performedAt = {};
      if (filters.startDate) where.performedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.performedAt.lte = new Date(filters.endDate);
    }

    const scopedPrisma = prismaForRequest({ tenantId });
    const auditLogs = await scopedPrisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { performedAt: 'desc' },
      take: 1000,
    });

    const rows = auditLogs.map((al: any) => ({
      id: al.id.toString(),
      performed_at: al.performedAt.toISOString(),
      action: al.action,
      table_name: al.tableName,
      record_id: al.recordId,
      user_name: al.user?.fullName || null,
      user_email: al.user?.email || null,
      ip_address: 'N/A',
      old_data: al.oldData,
      new_data: al.newData,
    }));

    const escapeCsv = (str: any): string => {
      if (str === null || str === undefined) return '""';
      const s = typeof str === 'object' ? JSON.stringify(str) : String(str);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'Table Name',
      'Record ID',
      'Performed By Name',
      'Performed By Email',
      'IP Address',
      'Old Data',
      'New Data',
    ];

    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        escapeCsv(r.id),
        escapeCsv(new Date(r.performed_at).toISOString()),
        escapeCsv(r.action),
        escapeCsv(r.table_name),
        escapeCsv(r.record_id),
        escapeCsv(r.user_name || 'System/Worker'),
        escapeCsv(r.user_email || 'N/A'),
        escapeCsv(r.ip_address || 'N/A'),
        escapeCsv(r.old_data),
        escapeCsv(r.new_data),
      ];
      csvLines.push(line.join(','));
    }

    return csvLines.join('\r\n');
  }
}

export const exportService = new ExportService();
