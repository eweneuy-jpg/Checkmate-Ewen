import { IRacksController } from "@/api/controllers/rackController.js";
import { Router } from "express";

export const createRackRoutes = (rackController: IRacksController): Router => {
	const router = Router();
	router.post("/", rackController.createRack);
	router.get("/", rackController.getRacks);
	router.get("/:id", rackController.getRackById);
	router.patch("/:id", rackController.updateRack);
	router.delete("/:id", rackController.deleteRack);
	return router;
};
