export type ServerOverallStatus = "up" | "down" | "degraded" | "paused" | "unmonitored";
export type RackFace = "front" | "back" | "both";
export type VmStatus = "running" | "stopped" | "paused";

export interface VirtualMachine {
	id: string;
	name: string;
	vcpu: number;
	ramMB: number;
	diskGB: number;
	os: string;
	ipAddress: string;
	macAddress: string;
	vlanId: number | null;
	status: VmStatus;
	hypervisor: "proxmox" | "kvm" | "esxi";
}

export interface ServerPort {
	name: string;
	label: string;
}

export interface RackServer {
	id: string;
	hostname: string;
	ipAddress: string;
	description?: string;
	role: string;
	environment: string;
	os?: string;
	location?: string;
	sshUsername?: string;
	sshPort?: number;
	monitors: string[];
	tags: string[];
	overallStatus: ServerOverallStatus;
	// Rack position
	rackId?: string;
	uStart?: number;
	uHeight?: number;
	face?: RackFace;
	// Hardware
	hardwareModel?: string;
	serialNumber?: string;
	// VM / Project
	isVmHost?: boolean;
	vmNames?: string[];
	projectName?: string;
	ports?: ServerPort[];
	createdAt: string;
	updatedAt: string;
}

export interface RackSlot {
	u: number;
	server: RackServer | null;
}

export interface Rack {
	id: string;
	name: string;
	location: string;
	totalU: number;
	createdAt: string;
	updatedAt: string;
}

export interface RackWithSlots extends Rack {
	slots: RackSlot[];
	usedU: number;
	serverCount: number;
}

export interface RackSummary {
	id: string;
	name: string;
	location: string;
	totalU: number;
	usedU: number;
	serverCount: number;
}
