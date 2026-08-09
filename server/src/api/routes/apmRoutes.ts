import { IApmController } from "@/api/controllers/apmController.js";
import { Router } from "express";

export const createApmRoutes = (apmController: IApmController): Router => {
	const router = Router();
	router.get("/team", apmController.getTeamApm);
	router.get("/monitor/:monitorId", apmController.getMonitorApm);
	return router;
};
