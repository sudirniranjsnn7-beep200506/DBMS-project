// ==============================================================================
// AssetVault: User HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';

export class UserController {
  public listUsers = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'createdAt', ['createdAt', 'fullName', 'email', 'lastLoginAt']);
    const roleName = req.query.role as string;
    const isActiveFilter = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const result = await userService.listUsers(req.prisma, params, {
      roleName,
      isActive: isActiveFilter,
    });
    sendResponse(res, 200, result.data, result.meta);
  });

  public getUserById = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.getUserById(req.prisma, req.params.id as string);
    sendResponse(res, 200, user);
  });

  public createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.createUser(req.prisma, req.user!.tenantId as string, req.body, req.user?.id);
    sendResponse(res, 201, user);
  });

  public updateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.updateUser(req.prisma, req.params.id as string, req.body);
    sendResponse(res, 200, user);
  });

  public updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const { isActive } = req.body;
    const user = await userService.updateUserStatus(req.prisma, req.params.id as string, isActive);
    sendResponse(res, 200, user);
  });

  public changeRole = asyncHandler(async (req: Request, res: Response) => {
    const { roleName, reason } = req.body;
    const user = await userService.changeUserRole(
      req.user!.tenantId as string,
      req.params.id as string,
      roleName,
      reason,
      req.user?.id
    );
    sendResponse(res, 200, user);
  });

  public resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { newPassword } = req.body;
    await userService.resetPassword(req.prisma, req.params.id as string, newPassword);
    sendResponse(res, 200, { message: 'Password reset successfully. Active sessions revoked.' });
  });

  public deleteUser = asyncHandler(async (req: Request, res: Response) => {
    await userService.deleteUser(req.prisma, req.params.id as string);
    sendResponse(res, 200, { message: 'User deleted successfully' });
  });
}

export const userController = new UserController();
