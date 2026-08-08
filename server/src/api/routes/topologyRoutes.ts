import { ITopologyController } from "@/api/controllers/topologyController.js";
import { Router } from "express";

export const createTopologyRoutes = (topologyController: ITopologyController): Router => {
	const router = Router();
	router.get("/", topologyController.getTopology);
	return router;
};
