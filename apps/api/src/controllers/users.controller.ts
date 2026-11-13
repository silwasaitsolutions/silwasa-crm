import type { Request, Response } from "express";
import { userService } from "../services/user.service";
import { ok } from "../utils/api-response";
import { requestMeta } from "../utils/request-meta";
import { uuidParam } from "../validators/common";
import {
  createUserSchema,
  setPermissionsSchema,
  updateUserSchema,
  userListQuerySchema,
} from "../validators/user.validators";

export const usersController = {
  async list(req: Request, res: Response) {
    const { role, ...query } = userListQuerySchema.parse(req.query);
    const { items, pagination } = await userService.list({ ...query, roleKey: role });
    ok(res, items, { pagination });
  },

  async get(req: Request, res: Response) {
    const { id } = uuidParam.parse(req.params);
    ok(res, await userService.get(id));
  },

  async create(req: Request, res: Response) {
    const input = createUserSchema.parse(req.body);
    ok(res, await userService.create(req.auth!.user.id, input, requestMeta(req)), undefined, 201);
  },

  async update(req: Request, res: Response) {
    const { id } = uuidParam.parse(req.params);
    const input = updateUserSchema.parse(req.body);
    ok(res, await userService.update(req.auth!.user.id, id, input, requestMeta(req)));
  },

  async remove(req: Request, res: Response) {
    const { id } = uuidParam.parse(req.params);
    await userService.remove(req.auth!.user.id, id, requestMeta(req));
    res.status(204).end();
  },

  async restore(req: Request, res: Response) {
    const { id } = uuidParam.parse(req.params);
    ok(res, await userService.restore(req.auth!.user.id, id, requestMeta(req)));
  },

  async listRoles(_req: Request, res: Response) {
    ok(res, await userService.listRoles());
  },

  async listPermissions(_req: Request, res: Response) {
    ok(res, await userService.listPermissions());
  },

  async setRolePermissions(req: Request, res: Response) {
    const { id } = uuidParam.parse(req.params);
    const { permissions } = setPermissionsSchema.parse(req.body);
    await userService.setRolePermissions(req.auth!.user.id, id, permissions, requestMeta(req));
    res.status(204).end();
  },
};
