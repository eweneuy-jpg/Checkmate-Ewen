import { Request, Response, RequestHandler } from "express";
import { catchAsync } from "@/utils/catchAsync.js";
import { IRacksService } from "@/domain/racks/rack.service.js";
import { requireTeamId } from "./controllerUtils.js";
import {
	createRackBodyValidation,
	updateRackBodyValidation,
	rackIdParamValidation,
} from "@/api/validation/index.js";

export interface IRacksController {
	createRack: RequestHandler;
	getRacks: RequestHandler;
	getRackById: RequestHandler;
	updateRack: RequestHandler;
	deleteRack: RequestHandler;
}

class RacksController implements IRacksController {
	constructor(private racksService: IRacksService) {}

	createRack = catchAsync(async (req: Request, res: Response) => {
		const validated = createRackBodyValidation.parse(req.body);
		const teamId = requireTeamId(req.user?.teamId);
		const rack = await this.racksService.createRack(validated, teamId);
		return res.status(201).json({ success: true, msg: "Rack created", data: rack });
	});

	getRacks = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const racks = await this.racksService.getRacksByTeamId(teamId);
		return res.status(200).json({ success: true, msg: "Racks retrieved", data: racks });
	});

	getRackById = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const { id } = rackIdParamValidation.parse(req.params);
		const rack = await this.racksService.getRackWithSlots(id, teamId);
		return res.status(200).json({ success: true, msg: "Rack retrieved", data: rack });
	});

	updateRack = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const { id } = rackIdParamValidation.parse(req.params);
		const validated = updateRackBodyValidation.parse(req.body);
		const rack = await this.racksService.updateRack(id, teamId, validated);
		return res.status(200).json({ success: true, msg: "Rack updated", data: rack });
	});

	deleteRack = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const { id } = rackIdParamValidation.parse(req.params);
		await this.racksService.deleteRack(id, teamId);
		return res.status(200).json({ success: true, msg: "Rack deleted" });
	});
}

export default RacksController;
