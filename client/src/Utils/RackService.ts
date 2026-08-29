import { get, post, patch, deleteOp } from "@/Utils/ApiClient";
import type { AxiosResponse } from "axios";
import type { Rack, RackWithSlots, RackSummary } from "@/Types/Rack";

const BASE = "/racks";

export const RackService = {
	getRacks: async (): Promise<RackSummary[]> => {
		const res: AxiosResponse<{ data: RackSummary[] }> = await get(BASE);
		return res.data.data;
	},

	getRack: async (id: string): Promise<RackWithSlots> => {
		const res: AxiosResponse<{ data: RackWithSlots }> = await get(`${BASE}/${id}`);
		return res.data.data;
	},

	createRack: async (body: {
		name: string;
		location: string;
		totalU?: number;
	}): Promise<Rack> => {
		const res: AxiosResponse<{ data: Rack }> = await post(BASE, body);
		return res.data.data;
	},

	updateRack: async (
		id: string,
		body: Partial<Pick<Rack, "name" | "location" | "totalU">>
	): Promise<Rack> => {
		const res: AxiosResponse<{ data: Rack }> = await patch(`${BASE}/${id}`, body);
		return res.data.data;
	},

	deleteRack: async (id: string): Promise<void> => {
		await deleteOp(`${BASE}/${id}`);
	},
};
