import crypto from "node:crypto";
import { Router } from "express";

import { hashPassword, normalizeMac, roverIdForMac } from "../lib/crypto.mjs";
import { ApiError, asyncHandler, readPassword, readText, send } from "../lib/http.mjs";
import { requireAuth } from "../middleware/auth.mjs";
import {
  createUser,
  findUserById,
  listUsers,
} from "../repositories/users.mjs";
import {
  deleteRover,
  findRover,
  listRoversForUser,
  upsertRover,
} from "../repositories/rovers.mjs";
import { encryptMac, roverView, userView } from "../services/serializers.mjs";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await listUsers();
    send(res, 200, { ok: true, users: rows.map(userView) });
  }),
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const name = readText(req.body?.name, { field: "Owner name", min: 2, max: 40 });
    const password = readPassword(req.body?.password);

    const user = await createUser({
      id: `user_${crypto.randomBytes(8).toString("hex")}`,
      name,
      passwordHash: hashPassword(password),
    });

    send(res, 201, { ok: true, user: userView(user) });
  }),
);

usersRouter.get(
  "/:id/rovers",
  asyncHandler(async (req, res) => {
    const user = await findUserById(req.params.id);
    if (!user) throw new ApiError(404, "Owner not found.", "owner_not_found");

    const rows = await listRoversForUser(user.id);
    send(res, 200, {
      ok: true,
      user: userView(user),
      rovers: rows.map(roverView),
      canManage: user.id === req.user.id,
    });
  }),
);

usersRouter.post(
  "/:id/rovers",
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user.id) {
      throw new ApiError(403, "You can only bind rovers to your own account.", "forbidden");
    }

    const normalized = normalizeMac(req.body?.mac);
    if (!normalized) {
      throw new ApiError(400, "Enter a valid MAC address (AA:BB:CC:DD:EE:FF).", "invalid_mac");
    }

    const roverId = roverIdForMac(normalized);
    const existing = await findRover(roverId);
    if (existing && existing.user_id !== req.user.id) {
      throw new ApiError(409, "That rover is already bound to another owner.", "rover_claimed");
    }

    const row = await upsertRover({
      roverId,
      userId: req.user.id,
      macCipher: encryptMac(normalized),
    });

    send(res, 201, { ok: true, rover: roverView(row) });
  }),
);

usersRouter.delete(
  "/:id/rovers/:roverId",
  asyncHandler(async (req, res) => {
    const binding = await findRover(req.params.roverId);
    if (!binding || binding.user_id !== req.user.id || req.params.id !== req.user.id) {
      throw new ApiError(404, "Rover not found for this owner.", "rover_not_found");
    }

    await deleteRover(binding.rover_id);
    send(res, 200, { ok: true });
  }),
);
