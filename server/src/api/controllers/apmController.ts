import { Request, Response, RequestHandler } from "express";
import { catchAsync } from "@/utils/catchAsync.js";
import { IApmService } from "@/domain/apm/apm.type.js";
import { requireTeamId } from "./controllerUtils.js";
import { DateRange } from "@/types/query.js";

export interface IApmController {
	getMonitorApm: RequestHandler;
	getTeamApm: RequestHandler;
}

class ApmController implements IApmController {
	constructor(private apmService: IApmService) {}

	getMonitorApm = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const monitorId = req.params.monitorId;
		const dateRange = (req.query.range as DateRange) || "day";
		const threshold = req.query.threshold ? Number(req.query.threshold) : undefined;

		if (!monitorId) {
			return res.status(400).json({ success: false, msg: "monitorId is required" });
		}

		const metrics = await this.apmService.getMonitorApm(monitorId, teamId, dateRange, threshold);
		return res.status(200).json({
			success: true,
			msg: "APM metrics retrieved",
			data: metrics,
		});
	});

	getTeamApm = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const dateRange = (req.query.range as DateRange) || "day";
		const threshold = req.query.threshold ? Number(req.query.threshold) : undefined;

		const summary = await this.apmService.getTeamApm(teamId, dateRange, threshold);
		return res.status(200).json({
			success: true,
			msg: "Team APM summary retrieved",
			data: summary,
		});
	});
}

export default ApmController;
