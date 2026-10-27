// ==============================================================================
// AssetVault: Plan Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { planRepository } from '../repositories/plan.repository';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';

export class PlanService {
  public async listPlans(prismaClient: any, params: PaginationParams, filter?: { isActive?: boolean }) {
    const { data, total } = await planRepository.findMany(prismaClient, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getPlanById(prismaClient: any, id: number) {
    const plan = await planRepository.findById(prismaClient, id);
    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
    }
    return plan;
  }

  public async createPlan(prismaClient: any, data: any) {
    const existing = await planRepository.findByName(prismaClient, data.name);
    if (existing) {
      throw new ConflictError(`Plan with name '${data.name}' already exists.`);
    }
    return planRepository.create(prismaClient, data);
  }

  public async updatePlan(prismaClient: any, id: number, data: any) {
    await this.getPlanById(prismaClient, id);
    if (data.name) {
      const existing = await planRepository.findByName(prismaClient, data.name);
      if (existing && existing.id !== id) {
        throw new ConflictError(`Plan with name '${data.name}' already exists.`);
      }
    }
    return planRepository.update(prismaClient, id, data);
  }

  public async deletePlan(prismaClient: any, id: number) {
    await this.getPlanById(prismaClient, id);
    return planRepository.delete(prismaClient, id);
  }
}

export const planService = new PlanService();
