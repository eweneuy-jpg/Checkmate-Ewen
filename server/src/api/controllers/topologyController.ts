import { Request, Response, RequestHandler } from "express";
import { catchAsync } from "@/utils/catchAsync.js";
import { ITopologyService } from "@/domain/topology/topology.type.js";
import { requireTeamId } from "./controllerUtils.js";

export interface ITopologyController {
	getTopology: RequestHandler;
}

class TopologyController implements ITopologyController {
	constructor(private topologyService: ITopologyService) {}

	getTopology = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const graph = await this.topologyService.buildGraph(teamId);
		return res.status(200).json({
			success: true,
			msg: "Topology retrieved successfully",
			data: graph,
		});
	});
}

export default TopologyController;
