// ==============================================================================
// AssetVault: Notification Repository
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Prisma, PrismaClient, NotificationType } from '@prisma/client';
import { PaginationParams } from '../utils/pagination.util';

export class NotificationRepository {
  public async findUserNotifications(
    prismaClient: PrismaClient,
    userId: string,
    params: PaginationParams,
    filter: { isRead?: boolean; type?: NotificationType; dateFrom?: Date; dateTo?: Date } = {}
  ) {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(filter.isRead !== undefined ? { isRead: filter.isRead } : {}),
      ...(filter.type ? { type: filter.type } : {}),
    };

    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) where.createdAt.gte = filter.dateFrom;
      if (filter.dateTo) where.createdAt.lte = filter.dateTo;
    }

    const [data, total] = await Promise.all([
      prismaClient.notification.findMany({
        where,
        skip: params.skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
        include: {
          license: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prismaClient.notification.count({ where }),
    ]);

    return { data, total };
  }

  public async markAsRead(prismaClient: PrismaClient, id: string, userId: string) {
    return prismaClient.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: {
        isRead: true,
      },
    });
  }

  public async markAllAsRead(prismaClient: PrismaClient, userId: string) {
    return prismaClient.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });
  }

  public async runExpiryCheck(prismaClient: any, tenantId: string, lookaheadDays: number = 30): Promise<number> {
    const result = await prismaClient.$queryRaw(
      Prisma.sql`SELECT fn_generate_expiry_notifications(${tenantId}::uuid, ${lookaheadDays}::integer) AS count;`
    );
    const count = (result as any[])[0]?.count;
    return typeof count === 'number' ? count : parseInt(count, 10) || 0;
  }
}

export const notificationRepository = new NotificationRepository();
