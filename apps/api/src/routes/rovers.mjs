import { Router } from "express";

import { ApiError, asyncHandler, readText, send } from "../lib/http.mjs";
import { requireAuth } from "../middleware/auth.mjs";
import { findUserById, setActiveRover } from "../repositories/users.mjs";
import {
  findRover,
  markConnected,
  markDisconnected,
  resetConnection,
} from "../repositories/rovers.mjs";
import { roverView, userView } from "../services/serializers.mjs";

export const roversRouter = Router();

roversRouter.use(requireAuth);

async function ownedBinding(req) {
  const roverId = readText(req.params.roverId ?? req.body?.roverId, {
    field: "Rover ID",
    min: 8,
    max: 64,
  });

  const binding = await findRover(roverId);
  if (!binding) throw new ApiError(404, "Rover not associated.", "rover_not_found");
  if (binding.user_id !== req.user.id) {
    throw new ApiError(403, "This rover belongs to another owner.", "forbidden");
  }
  return binding;
}

roversRouter.get(
  "/:roverId",
  asyncHandler(async (req, res) => {
    const binding = await findRover(
      readText(req.params.roverId, { field: "Rover ID", min: 8, max: 64 }),
    );
    if (!binding) throw new ApiError(404, "Rover not associated.", "rover_not_found");

    const owner = await findUserById(binding.user_id);
    if (!owner) throw new ApiError(404, "Owner not found.", "owner_not_found");

    send(res, 200, { ok: true, rover: roverView(binding), owner: userView(owner) });
  }),
);

roversRouter.post(
  "/connect",
  asyncHandler(async (req, res) => {
    const binding = await ownedBinding(req);

    if (req.user.active_rover_id && req.user.active_rover_id !== binding.rover_id) {
      await resetConnection(req.user.active_rover_id);
    }

    const connected = await markConnected(binding.rover_id);
    await setActiveRover(req.user.id, binding.rover_id);

    const owner = await findUserById(req.user.id);
    send(res, 200, { ok: true, rover: roverView(connected), owner: userView(owner) });
  }),
);

roversRouter.post(
  "/disconnect",
  asyncHandler(async (req, res) => {
    const binding = await ownedBinding(req);
    const updated = await markDisconnected(binding.rover_id);

    if (req.user.active_rover_id === binding.rover_id && updated?.connection_count === 0) {
      await setActiveRover(req.user.id, null);
    }

    send(res, 200, { ok: true, rover: roverView(updated) });
  }),
);
