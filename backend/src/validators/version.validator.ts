// ==============================================================================
// AssetVault: Asset Version Request Validators
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { z } from 'zod';

export const createVersionSchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      const rawSize = val.fileSize !== undefined ? val.fileSize : val.fileSizeBytes;
      const rawChecksum = val.checksum !== undefined ? val.checksum : val.checksumSha256;
      const rawChangelog = val.changelog !== undefined ? val.changelog : val.changeNotes;

      const fileSize =
        typeof rawSize === 'string' && rawSize.trim() !== ''
          ? Number(rawSize)
          : rawSize;

      return {
        ...val,
        fileUrl: val.fileUrl,
        fileSize,
        checksum: rawChecksum,
        changelog: rawChangelog ?? null,
        fileSizeBytes: fileSize,
        checksumSha256: rawChecksum,
        changeNotes: rawChangelog ?? null,
      };
    }
    return val;
  },
  z
    .object({
      fileUrl: z.string().url('fileUrl must be a valid URL'),
      fileSize: z.number().int().positive('fileSize must be a positive integer in bytes'),
      checksum: z
        .string()
        .length(64, 'SHA-256 checksum must be exactly 64 hex characters')
        .trim(),
      changelog: z.string().max(1000).optional().nullable(),
      fileSizeBytes: z.number().int().positive().optional(),
      checksumSha256: z
        .string()
        .length(64, 'SHA-256 checksum must be exactly 64 hex characters')
        .trim()
        .optional(),
      changeNotes: z.string().max(1000).optional().nullable(),
    })
    .passthrough()
);

export const compareVersionsQuerySchema = z.preprocess(
  (val: any) => {
    if (val && typeof val === 'object') {
      const rawFrom = val.from !== undefined ? val.from : val.v1;
      const rawTo = val.to !== undefined ? val.to : val.v2;

      return {
        from: typeof rawFrom === 'string' ? parseInt(rawFrom, 10) : rawFrom,
        to: typeof rawTo === 'string' ? parseInt(rawTo, 10) : rawTo,
      };
    }
    return val;
  },
  z
    .object({
      from: z.number().int().positive('from must be a valid positive integer version number'),
      to: z.number().int().positive('to must be a valid positive integer version number'),
    })
    .strip()
);
