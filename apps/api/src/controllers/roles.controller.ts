import type { Request, Response } from "express";
import { roleService } from "../services/role.service";
import { ok } from "../utils/api-response";
import { requestMeta } from "../utils/request-meta";
import { uuidParam } from "../validators/common";
import { createRoleSchema, updateRoleSchema } from "../validators/role.validators";

export const rolesController = {
  async create(req: Request, res: Response) {
    const input = createRoleSchema.parse(req.body);
    ok(res, await roleService.create(req.auth!.user.id, input, requestMeta(req)), undefined, 201);
  },

  async update(req: Request, res: Response) {
    const { id } = uuidParam.parse(req.params);
    await roleService.update(req.auth!.user.id, id, updateRoleSchema.parse(req.body), requestMeta(req));
    res.status(204).end();
  },

  async remove(req: Request, res: Response) {
    const { id } = uuidParam.parse(req.params);
    await roleService.remove(req.auth!.user.id, id, requestMeta(req));
    res.status(204).end();
  },
};
