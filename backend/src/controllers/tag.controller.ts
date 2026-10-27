// ==============================================================================
// AssetVault: Tag HTTP Controller
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { Request, Response } from 'express';
import { tagService } from '../services/tag.service';
import { getPaginationParams } from '../utils/pagination.util';
import { sendResponse } from '../utils/response.util';
import { asyncHandler } from '../utils/asyncHandler';

export class TagController {
  public listTags = asyncHandler(async (req: Request, res: Response) => {
    const params = getPaginationParams(req, 'name', ['name', 'createdAt']);
    const result = await tagService.listTags(req.prisma, params);
    sendResponse(res, 200, result.data, result.meta);
  });

  public getTagById = asyncHandler(async (req: Request, res: Response) => {
    const tag = await tagService.getTagById(req.prisma, req.params.id as string);
    sendResponse(res, 200, tag);
  });

  public createTag = asyncHandler(async (req: Request, res: Response) => {
    const tag = await tagService.createTag(req.prisma, req.body);
    sendResponse(res, 201, tag);
  });

  public updateTag = asyncHandler(async (req: Request, res: Response) => {
    const tag = await tagService.updateTag(req.prisma, req.params.id as string, req.body);
    sendResponse(res, 200, tag);
  });

  public deleteTag = asyncHandler(async (req: Request, res: Response) => {
    await tagService.deleteTag(req.prisma, req.params.id as string);
    sendResponse(res, 200, { message: 'Tag removed successfully' });
  });
}

export const tagController = new TagController();
