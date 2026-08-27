import { z } from "zod";
import { ServerEnvironments, ServerRoles, RackFaces } from "@/domain/servers/server.type.js";

export const createServerBodyValidation = z.object({
	hostname: z.string().min(1, "hostname is required").max(255),
	ipAddress: z.string().min(1, "ipAddress is required"),
	description: z.string().max(500).optional(),
	role: z.enum(ServerRoles).default("other"),
	environment: z.enum(ServerEnvironments).default("production"),
	os: z.string().max(100).optional(),
	location: z.string().max(100).optional(),
	sshUsername: z.string().max(100).optional(),
	sshPassword: z.string().max(200).optional(),
	sshPort: z.number().int().min(1).max(65535).default(22),
	tags: z.array(z.string()).default([]),
	monitors: z.array(z.string()).default([]),
	// Rack position
	rackId: z.string().optional(),
	uStart: z.number().int().min(1).max(60).optional(),
	uHeight: z.number().int().min(1).max(10).default(1),
	face: z.enum(RackFaces).default("front"),
	// Hardware
	hardwareModel: z.string().max(200).optional(),
	serialNumber: z.string().max(100).optional(),
	// VM / Project
	isVmHost: z.boolean().default(false),
	vmNames: z.array(z.string()).default([]),
	projectName: z.string().max(100).optional(),
	ports: z.array(z.object({
		name: z.string(),
		label: z.string(),
		target: z.string().optional(),
	})).default([]),
});

export const updateServerBodyValidation = createServerBodyValidation.partial();

export const serverIdParamValidation = z.object({
	id: z.string().min(1, "Server ID is required"),
});

export const linkMonitorBodyValidation = z.object({
	monitorId: z.string().min(1, "monitorId is required"),
});
