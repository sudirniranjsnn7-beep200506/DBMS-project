import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { sendResponse } from '../utils/response.util';

describe('sendResponse serialization', () => {
  it('serializes Prisma Decimal values as numeric strings', () => {
    const json = vi.fn();
    const response = {
      status: vi.fn().mockReturnThis(),
      json,
    } as unknown as Response;

    sendResponse(response, 200, [
      { name: 'Free Trial', monthlyPrice: new Prisma.Decimal('0.00') },
      { name: 'Pro', monthlyPrice: new Prisma.Decimal('49.00') },
      { name: 'Enterprise', monthlyPrice: new Prisma.Decimal('199.50') },
    ]);

    expect(json).toHaveBeenCalledWith({
      status: 'success',
      data: [
        { name: 'Free Trial', monthlyPrice: '0' },
        { name: 'Pro', monthlyPrice: '49' },
        { name: 'Enterprise', monthlyPrice: '199.5' },
      ],
    });
  });

  it('still serializes nested BigInt values and dates', () => {
    const json = vi.fn();
    const response = {
      status: vi.fn().mockReturnThis(),
      json,
    } as unknown as Response;
    const createdAt = new Date('2026-10-18T00:00:00.000Z');

    sendResponse(response, 200, {
      id: 123n,
      createdAt,
      details: { value: new Prisma.Decimal('12.34') },
    });

    expect(json).toHaveBeenCalledWith({
      status: 'success',
      data: {
        id: '123',
        createdAt: '2026-10-18T00:00:00.000Z',
        details: { value: '12.34' },
      },
    });
  });
});
