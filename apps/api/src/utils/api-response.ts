import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ok<T>(res: Response, data: T, meta?: { pagination?: PaginationMeta }, status = 200) {
  return res.status(status).json({ success: true, data, meta: { requestId: res.req.id, ...meta } });
}
