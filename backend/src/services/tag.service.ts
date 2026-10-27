// ==============================================================================
// AssetVault: Tag Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { tagRepository } from '../repositories/tag.repository';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';

export class TagService {
  public async listTags(prismaClient: any, params: PaginationParams) {
    const { data, total } = await tagRepository.findMany(prismaClient, params);
    return formatPaginatedResponse(data, total, params);
  }

  public async getTagById(prismaClient: any, id: string) {
    const tag = await tagRepository.findById(prismaClient, id);
    if (!tag) {
      throw new NotFoundError('Tag not found');
    }
    return tag;
  }

  public async createTag(prismaClient: any, data: any) {
    const existing = await tagRepository.findByName(prismaClient, data.name);
    if (existing) {
      throw new ConflictError(`Tag '${data.name}' already exists.`);
    }
    return tagRepository.create(prismaClient, data);
  }

  public async updateTag(prismaClient: any, id: string, data: any) {
    await this.getTagById(prismaClient, id);
    if (data.name) {
      const existing = await prismaClient.tag.findFirst({
        where: { name: data.name, id: { not: id } },
      });
      if (existing) {
        throw new ConflictError(`Tag '${data.name}' already exists.`);
      }
    }
    return tagRepository.update(prismaClient, id, data);
  }

  public async deleteTag(prismaClient: any, id: string) {
    await this.getTagById(prismaClient, id);
    return tagRepository.delete(prismaClient, id);
  }
}

export const tagService = new TagService();
