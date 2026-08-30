import { IServersController } from "@/api/controllers/serverController.js";
import { Router } from "express";

export const createServerRoutes = (serverController: IServersController): Router => {
	const router = Router();
	router.post("/", serverController.createServer);
	router.get("/", serverController.getServers);
	router.get("/:id", serverController.getServerById);
	router.patch("/:id", serverController.updateServer);
	router.delete("/:id", serverController.deleteServer);
	router.post("/:id/monitors", serverController.linkMonitor);
	router.delete("/:id/monitors/:monitorId", serverController.unlinkMonitor);
	router.post("/:id/scan-connections", serverController.scanConnections);
	return router;
};
