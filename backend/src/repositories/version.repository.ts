// ==============================================================================
// AssetVault: Asset Version Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { PrismaClient, AssetVersion, Prisma } from '@prisma/client';

export class VersionRepository {
  public async findByAssetId(prisma: PrismaClient | any, assetId: string): Promise<AssetVersion[]> {
    return prisma.assetVersion.findMany({
      where: { assetId },
      orderBy: { versionNo: 'desc' },
      include: {
        uploader: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  public async findByVersionNo(
    prisma: PrismaClient | any,
    assetId: string,
    versionNo: number
  ): Promise<AssetVersion | null> {
    return prisma.assetVersion.findUnique({
      where: {
        assetId_versionNo: { assetId, versionNo },
      },
      include: {
        uploader: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  public async findById(prisma: PrismaClient | any, id: string): Promise<AssetVersion | null> {
    return prisma.assetVersion.findUnique({
      where: { id },
      include: {
        uploader: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  public async getLatestVersionNo(prisma: PrismaClient | any, assetId: string): Promise<number> {
    const latest = await prisma.assetVersion.findFirst({
      where: { assetId },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true },
    });
    return latest?.versionNo || 0;
  }

  public async create(prisma: PrismaClient | any, data: Prisma.AssetVersionCreateInput): Promise<AssetVersion> {
    return prisma.assetVersion.create({
      data,
      include: {
        uploader: { select: { id: true, fullName: true, email: true } },
      },
    });
  }
}

export const versionRepository = new VersionRepository();
