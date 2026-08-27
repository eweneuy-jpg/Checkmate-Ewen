import { DiagnosticService, IDiagnosticService } from "@/domain/diagnostics/diagnostic.service.js";
import { IInviteService, InviteService } from "@/domain/invites/invite.service.js";
import { IMaintenanceWindowService, MaintenanceWindowService } from "@/domain/maintenance-windows/maintenance-window.service.js";
import { IMonitorService, MonitorService } from "@/domain/monitors/monitor.service.js";
import { IStatusPageService, StatusPageService } from "@/domain/status-pages/status-page.service.js";
import { ITagsService, TagsService } from "@/domain/tags/tag.service.js";
import { TopologyService } from "@/domain/topology/topology.service.js";
import { ITopologyService } from "@/domain/topology/topology.type.js";
import { IServersService, ServersService } from "@/domain/servers/server.service.js";
import { IRacksService, RacksService } from "@/domain/racks/rack.service.js";
import { ApmService } from "@/domain/apm/apm.service.js";
import { IApmService } from "@/domain/apm/apm.type.js";
import { IUserService, UserService } from "@/domain/users/user.service.js";
import { IJobScheduler } from "@/worker/worker.interface.js";

// Third-party
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { games } from "gamedig";

import { SharedServices } from "@/config/services.shared.js";

export interface ApiServices extends SharedServices {
	worker: IJobScheduler; // control-plane handle only (DBQueueWorker in all-in-one, bare JobScheduler in API-only)
	userService: IUserService;
	monitorService: IMonitorService;
	maintenanceWindowService: IMaintenanceWindowService;
	inviteService: IInviteService;
	statusPageService: IStatusPageService;
	tagsService: ITagsService;
	topologyService: ITopologyService;
	apmService: IApmService;
	serversService: IServersService;
	racksService: IRacksService;
	diagnosticService: IDiagnosticService;
}

export const buildApi = (shared: SharedServices, jobScheduler: IJobScheduler): ApiServices => {
	const {
		logger,
		db,
		settingsService,
		emailService,
		monitorsRepository,
		checksRepository,
		geoChecksRepository,
		monitorStatsRepository,
		statusPagesRepository,
		usersRepository,
		invitesRepository,
		recoveryTokensRepository,
		settingsRepository,
		tagsRepository,
		incidentsRepository,
		teamsRepository,
		maintenanceWindowsRepository,
		serversRepository,
		racksRepository,
		jobsRepository,
	} = shared;

	const userService = new UserService({
		crypto,
		emailService,
		settingsService,
		logger,
		jwt,
		scheduler: jobScheduler,
		monitorsRepository,
		usersRepository,
		invitesRepository,
		recoveryTokensRepository,
		settingsRepository,
		teamsRepository,
	});

	// ***********************
	//  Business services
	// ***********************

	const monitorService = new MonitorService({
		scheduler: jobScheduler,
		logger,
		games,
		monitorsRepository,
		checksRepository,
		geoChecksRepository,
		monitorStatsRepository,
		statusPagesRepository,
		incidentsRepository,
	});

	const maintenanceWindowService = new MaintenanceWindowService({
		monitorsRepository,
		maintenanceWindowsRepository,
		jobsRepository,
		scheduler: jobScheduler,
	});

	const inviteService = new InviteService({
		invitesRepository,
		settingsService,
		emailService,
	});

	const statusPageService = new StatusPageService(statusPagesRepository, settingsService, monitorsRepository);
	const tagsService = new TagsService(tagsRepository, monitorsRepository);
	const topologyService = new TopologyService({ monitorsRepository });
	const apmService = new ApmService(checksRepository, monitorsRepository, logger);
	const serversService = new ServersService(logger, serversRepository, monitorsRepository);
	const racksService = new RacksService(logger, racksRepository);
	const diagnosticService = new DiagnosticService(db);

	return {
		...shared,
		worker: jobScheduler,
		userService,
		monitorService,
		maintenanceWindowService,
		inviteService,
		statusPageService,
		tagsService,
		topologyService,
		apmService,
		serversService,
		racksService,
		diagnosticService,
	};
};
