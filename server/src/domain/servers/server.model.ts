import { Schema, model, Types } from "mongoose";
import type { Server } from "./server.type.js";
import { ServerEnvironments, ServerRoles, RackFaces } from "./server.type.js";

type ServerDocumentBase = Omit<
	Server,
	"id" | "userId" | "teamId" | "monitors" | "tags" | "createdAt" | "updatedAt"
> & {
	monitors: Types.ObjectId[];
	tags: string[];
};

interface ServerDocument extends ServerDocumentBase {
	_id: Types.ObjectId;
	userId: Types.ObjectId;
	teamId: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

const ServerSchema = new Schema<ServerDocument>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			immutable: true,
			required: true,
		},
		teamId: {
			type: Schema.Types.ObjectId,
			ref: "Team",
			immutable: true,
			required: true,
		},
		hostname: {
			type: String,
			required: true,
			trim: true,
			maxLength: 255,
		},
		ipAddress: {
			type: String,
			required: true,
			trim: true,
		},
		description: {
			type: String,
			trim: true,
			maxLength: 500,
		},
		role: {
			type: String,
			enum: ServerRoles,
			default: "other",
		},
		environment: {
			type: String,
			enum: ServerEnvironments,
			default: "production",
		},
		os: {
			type: String,
			trim: true,
		},
		location: {
			type: String,
			trim: true,
			maxLength: 100,
		},
		sshUsername: {
			type: String,
			trim: true,
		},
		sshPassword: {
			type: String,
		},
		sshPort: {
			type: Number,
			default: 22,
			min: 1,
			max: 65535,
		},
		monitors: [
			{
				type: Schema.Types.ObjectId,
				ref: "Monitor",
			},
		],
		tags: {
			type: [String],
			default: [],
		},
		// --- Rack position ---
		rackId: {
			type: Schema.Types.ObjectId,
			ref: "Rack",
			default: null,
		},
		uStart: {
			type: Number,
			min: 1,
			max: 60,
		},
		uHeight: {
			type: Number,
			min: 1,
			max: 10,
			default: 1,
		},
		face: {
			type: String,
			enum: RackFaces,
			default: "front",
		},
		// --- Hardware metadata ---
		hardwareModel: {
			type: String,
			trim: true,
			maxLength: 200,
		},
		serialNumber: {
			type: String,
			trim: true,
			maxLength: 100,
		},
		// --- VM / Project ---
		isVmHost: {
			type: Boolean,
			default: false,
		},
		vmNames: {
			type: [String],
			default: [],
		},
		projectName: {
			type: String,
			trim: true,
			maxLength: 100,
		},
		ports: {
			type: [
				{
					name: { type: String, trim: true },
					label: { type: String, trim: true },
					target: { type: String, trim: true },
				},
			],
			default: [],
		},
	},
	{ timestamps: true },
);

ServerSchema.index({ teamId: 1, hostname: 1 }, { unique: true });
ServerSchema.index({ teamId: 1, ipAddress: 1 });
ServerSchema.index({ teamId: 1 });

const ServerModel = model<ServerDocument>("Server", ServerSchema);

export type { ServerDocument };
export { ServerModel };
export default ServerModel;
