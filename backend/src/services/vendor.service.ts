// ==============================================================================
// AssetVault: Vendor Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { vendorRepository } from '../repositories/vendor.repository';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';

export class VendorService {
  public async listVendors(prismaClient: any, params: PaginationParams) {
    const { data, total } = await vendorRepository.findMany(prismaClient, params);
    return formatPaginatedResponse(data, total, params);
  }

  public async getVendorById(prismaClient: any, id: string) {
    const vendor = await vendorRepository.findById(prismaClient, id);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }
    return vendor;
  }

  public async createVendor(prismaClient: any, data: any) {
    const existing = await prismaClient.vendor.findFirst({
      where: { name: data.name },
    });
    if (existing) {
      throw new ConflictError(`Vendor with name '${data.name}' already exists in your organization.`);
    }

    return vendorRepository.create(prismaClient, data);
  }

  public async updateVendor(prismaClient: any, id: string, data: any) {
    await this.getVendorById(prismaClient, id);
    if (data.name) {
      const existing = await prismaClient.vendor.findFirst({
        where: { name: data.name, id: { not: id } },
      });
      if (existing) {
        throw new ConflictError(`Vendor with name '${data.name}' already exists.`);
      }
    }
    return vendorRepository.update(prismaClient, id, data);
  }

  public async deleteVendor(prismaClient: any, id: string) {
    const vendor = await this.getVendorById(prismaClient, id);
    if (vendor._count?.licenses > 0) {
      throw new ConflictError('Cannot delete vendor associated with active or past licenses.');
    }
    return vendorRepository.delete(prismaClient, id);
  }
}

export const vendorService = new VendorService();
