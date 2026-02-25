/**
 * Supabase Storage adapter. Stub: returns mock URLs in dev when Supabase Storage is not configured.
 */
import { AppError } from '@/lib/errors/app-error';
import { ErrorCode } from '@/lib/errors/error-codes';
import { err, ok, type Result } from '@/lib/result';

const DEFAULT_BUCKET = 'attachments';
const MOCK_URL_PREFIX = 'https://mock-storage.example.com';

export type StorageClient = {
  uploadFile(
    bucket: string,
    path: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<Result<string, AppError>>;
  getSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
  ): Promise<Result<string, AppError>>;
  deleteFile(bucket: string, path: string): Promise<Result<void, AppError>>;
};

function isStorageConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Stub implementation: when Supabase is not configured, returns mock path/URLs.
 * Replace with real Supabase Storage client when B1 (Supabase) is available.
 */
export function createStorageClient(): StorageClient {
  async function uploadFile(
    _bucket: string,
    path: string,
    _buffer: Buffer,
    _contentType: string,
  ): Promise<Result<string, AppError>> {
    if (!isStorageConfigured()) {
      return ok(path);
    }
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      const supabase = createClient(url, key);
      const { error } = await supabase.storage
        .from(_bucket)
        .upload(path, _buffer, { upsert: true });
      if (error) {
        return err(
          new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, error.message, {
            provider: 'supabase-storage',
          }),
        );
      }
      return ok(path);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(
        new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, message, {
          provider: 'supabase-storage',
        }),
      );
    }
  }

  async function getSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds: number,
  ): Promise<Result<string, AppError>> {
    if (!isStorageConfigured()) {
      return ok(`${MOCK_URL_PREFIX}/${bucket}/${path}?expires=${String(expiresInSeconds)}`);
    }
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      const supabase = createClient(url, key);
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (error) {
        return err(
          new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, error.message, {
            provider: 'supabase-storage',
          }),
        );
      }
      const signedUrl = data.signedUrl;
      if (!signedUrl) {
        return err(
          new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, 'No signed URL', {
            provider: 'supabase-storage',
          }),
        );
      }
      return ok(signedUrl);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(
        new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, message, {
          provider: 'supabase-storage',
        }),
      );
    }
  }

  async function deleteFile(bucket: string, path: string): Promise<Result<void, AppError>> {
    if (!isStorageConfigured()) {
      return ok(undefined);
    }
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      const supabase = createClient(url, key);
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) {
        return err(
          new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, error.message, {
            provider: 'supabase-storage',
          }),
        );
      }
      return ok(undefined);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err(
        new AppError(ErrorCode.EXTERNAL_SERVICE_ERROR, 502, message, {
          provider: 'supabase-storage',
        }),
      );
    }
  }

  return { uploadFile, getSignedUrl, deleteFile };
}

export const defaultBucket = DEFAULT_BUCKET;
