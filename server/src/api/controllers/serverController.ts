import { Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { catchAsync } from "@/utils/catchAsync.js";
import { IServersService } from "@/domain/servers/server.service.js";
import { requireTeamId, requireUserId } from "./controllerUtils.js";
import {
	createServerBodyValidation,
	updateServerBodyValidation,
	serverIdParamValidation,
	linkMonitorBodyValidation,
} from "@/api/validation/index.js";

export interface IServersController {
	createServer: RequestHandler;
	getServers: RequestHandler;
	getServerById: RequestHandler;
	updateServer: RequestHandler;
	deleteServer: RequestHandler;
	linkMonitor: RequestHandler;
	unlinkMonitor: RequestHandler;
}

const unlinkMonitorParamValidation = z.object({
	id: z.string().min(1, "Server ID is required"),
	monitorId: z.string().min(1, "monitorId is required"),
});

class ServersController implements IServersController {
	constructor(private serversService: IServersService) {}

	createServer = catchAsync(async (req: Request, res: Response) => {
		const validated = createServerBodyValidation.parse(req.body);
		const teamId = requireTeamId(req.user?.teamId);
		const userId = requireUserId(req.user?.id);
		const server = await this.serversService.createServer(validated, userId, teamId);
		return res.status(201).json({ success: true, msg: "Server created", data: this.serversService.toResponse(server) });
	});

	getServers = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const servers = await this.serversService.getServersByTeamId(teamId);
		return res.status(200).json({ success: true, msg: "Servers retrieved", data: servers });
	});

	getServerById = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const { id } = serverIdParamValidation.parse(req.params);
		const server = await this.serversService.getServerWithMonitors(id, teamId);
		return res.status(200).json({ success: true, msg: "Server retrieved", data: server });
	});

	updateServer = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const { id } = serverIdParamValidation.parse(req.params);
		const validated = updateServerBodyValidation.parse(req.body);
		const server = await this.serversService.updateServer(id, teamId, validated);
		return res.status(200).json({ success: true, msg: "Server updated", data: this.serversService.toResponse(server) });
	});

	deleteServer = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const { id } = serverIdParamValidation.parse(req.params);
		await this.serversService.deleteServer(id, teamId);
		return res.status(200).json({ success: true, msg: "Server deleted" });
	});

	linkMonitor = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const { id } = serverIdParamValidation.parse(req.params);
		const { monitorId } = linkMonitorBodyValidation.parse(req.body);
		const server = await this.serversService.linkMonitor(id, teamId, monitorId);
		return res.status(200).json({ success: true, msg: "Monitor linked", data: this.serversService.toResponse(server) });
	});

	unlinkMonitor = catchAsync(async (req: Request, res: Response) => {
		const teamId = requireTeamId(req.user?.teamId);
		const { id, monitorId } = unlinkMonitorParamValidation.parse(req.params);
		const server = await this.serversService.unlinkMonitor(id, teamId, monitorId);
		return res.status(200).json({ success: true, msg: "Monitor unlinked", data: this.serversService.toResponse(server) });
	});
}

export default ServersController;
