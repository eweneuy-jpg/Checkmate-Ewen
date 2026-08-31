import { get, post, patch, deleteOp } from "@/Utils/ApiClient";
import type { AxiosResponse } from "axios";
import type { RackServer, VirtualMachine } from "@/Types/Rack";

const BASE = "/servers";

export const ServerService = {
	getServers: async (): Promise<RackServer[]> => {
		const res: AxiosResponse<{ data: RackServer[] }> = await get(BASE);
		return res.data.data;
	},

	getServer: async (id: string): Promise<RackServer> => {
		const res: AxiosResponse<{ data: RackServer }> = await get(`${BASE}/${id}`);
		return res.data.data;
	},

	createServer: async (body: {
		hostname: string;
		ipAddress: string;
		role?: string;
		environment?: string;
		os?: string;
		location?: string;
		sshUsername?: string;
		sshPort?: number;
		hardwareModel?: string;
		serialNumber?: string;
		rackId?: string;
		uStart?: number;
		uHeight?: number;
		face?: string;
		isVmHost?: boolean;
		vmNames?: string[];
		projectName?: string;
		ports?: { name: string; label: string; target?: string }[];
		tags?: string[];
	}): Promise<RackServer> => {
		const res: AxiosResponse<{ data: RackServer }> = await post(BASE, body);
		return res.data.data;
	},

	updateServer: async (id: string, body: Partial<{
		hostname: string;
		ipAddress: string;
		role: string;
		environment: string;
		os: string;
		location: string;
		sshUsername: string;
		sshPort: number;
		hardwareModel: string;
		serialNumber: string;
		rackId: string;
		uStart: number;
		uHeight: number;
		face: string;
		isVmHost: boolean;
		vmNames: string[];
		projectName: string;
		ports: { name: string; label: string; target?: string }[];
	}>): Promise<RackServer> => {
		const res: AxiosResponse<{ data: RackServer }> = await patch(`${BASE}/${id}`, body);
		return res.data.data;
	},

	deleteServer: async (id: string): Promise<void> => {
		await deleteOp(`${BASE}/${id}`);
	},

	scanConnections: async (id: string): Promise<{
		localPort: string;
		remoteHostname: string;
		remotePort: string;
	}[]> => {
		const res: AxiosResponse<{ data: { localPort: string; remoteHostname: string; remotePort: string }[] }> = await post(`${BASE}/${id}/scan-connections`, {});
		return res.data.data;
	},

	scanVms: async (id: string): Promise<VirtualMachine[]> => {
		const res: AxiosResponse<{ data: VirtualMachine[] }> = await post(`${BASE}/${id}/scan-vms`, {});
		return res.data.data;
	},
};
