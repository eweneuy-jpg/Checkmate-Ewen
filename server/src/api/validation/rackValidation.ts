import { z } from "zod";

export const createRackBodyValidation = z.object({
	name: z.string().min(1, "Rack name is required").max(100),
	location: z.string().min(1, "Location is required").max(200),
	totalU: z.number().int().min(1).max(60).default(42),
	description: z.string().max(500).optional(),
});

export const updateRackBodyValidation = createRackBodyValidation.partial();

export const rackIdParamValidation = z.object({
	id: z.string().min(1, "Rack ID is required"),
});
