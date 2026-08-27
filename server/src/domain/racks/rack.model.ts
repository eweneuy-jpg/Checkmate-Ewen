import { Schema, model, Types } from "mongoose";
import type { Rack } from "./rack.type.js";

type RackDocumentBase = Omit<Rack, "id" | "teamId" | "createdAt" | "updatedAt">;

interface RackDocument extends RackDocumentBase {
	_id: Types.ObjectId;
	teamId: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const RackSchema = new Schema<RackDocument>(
	{
		teamId: {
			type: Schema.Types.ObjectId,
			ref: "Team",
			immutable: true,
			required: true,
		},
		name: {
			type: String,
			required: true,
			trim: true,
			maxLength: 100,
		},
		location: {
			type: String,
			required: true,
			trim: true,
			maxLength: 200,
		},
		totalU: {
			type: Number,
			required: true,
			min: 1,
			max: 60,
			default: 42,
		},
		description: {
			type: String,
			trim: true,
			maxLength: 500,
		},
	},
	{ timestamps: true },
);

RackSchema.index({ teamId: 1, name: 1 }, { unique: true });

const RackModel = model<RackDocument>("Rack", RackSchema);

export type { RackDocument };
export { RackModel };
export default RackModel;
