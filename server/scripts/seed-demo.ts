/**
 * Demo seed for Checkmate-Ewen - REAL infrastructure data (NSC/Jupiter Jala Arta).
 *
 * Source: the rack inventory the user supplied (RACKMASTER PRO mockup data),
 * 8 racks / 54 devices: STAR-1, STAR-2, NETS1-6 at DC-STAR + DC-NETS Jakarta.
 *
 * Usage (from server/):  npm run seed
 *
 * Connects to the same DB as the app (DB_CONNECTION_STRING env, default
 * mongodb://localhost:27017/uptime_db), grabs the FIRST active user, then creates
 * the racks and devices under that user's team. Safe to re-run: existing racks and
 * hosts are skipped (unique teamId+name / teamId+hostname).
 */
import mongoose from "mongoose";
import { UserModel } from "../src/domain/users/user.model.js";
import { RackModel } from "../src/domain/racks/rack.model.js";
import { ServerModel } from "../src/domain/servers/server.model.js";
import type { ServerRole, ServerEnvironment } from "../src/domain/servers/server.type.js";

const uri = process.env.DB_CONNECTION_STRING ?? "mongodb://localhost:27017/uptime_db";

interface SeedServer {
	hostname: string;
	u: number;
	h: number;
	model: string;
	project: string;
	role: ServerRole;
	os: string;
	ip: string;
	isVmHost: boolean;
	vmNames: string[];
}

interface SeedRack {
	name: string;
	location: string;
	totalU: number;
	description: string;
	servers: SeedServer[];
}

const SEED: SeedRack[] = [
	{
		name: "STAR-1",
		location: "DC-STAR (Jakarta)",
		totalU: 45,
		description: "STAR-1 - 13 devices",
		servers: [
			{
				hostname: "SE-10-CON",
				u: 44,
				h: 1,
				model: "Infra Manager",
				project: "INFRA",
				role: "other",
				os: "Linux",
				ip: "10.10.1.10",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "SE-10-LFA",
				u: 43,
				h: 2,
				model: "N9K-C9372PX",
				project: "NET",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.1.11",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "SE-10-LFB",
				u: 41,
				h: 2,
				model: "N9K-C9372PX",
				project: "NET",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.1.12",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "SE-10-FWA",
				u: 40,
				h: 1,
				model: "FortiGate 3700D",
				project: "FW",
				role: "firewall",
				os: "FortiOS",
				ip: "10.10.1.13",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "SE-10-BKP1",
				u: 39,
				h: 1,
				model: "FortiGate 3700D",
				project: "FW",
				role: "firewall",
				os: "FortiOS",
				ip: "10.10.1.14",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "SE-10-HV101",
				u: 32,
				h: 2,
				model: "SR65V",
				project: "HV101",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.1.15",
				isVmHost: true,
				vmNames: ["hv101-vsphere"],
			},
			{
				hostname: "SE-10-HV102",
				u: 28,
				h: 2,
				model: "SR65V",
				project: "HV102",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.1.16",
				isVmHost: true,
				vmNames: ["hv102-vsphere"],
			},
			{
				hostname: "SE-10-HV103",
				u: 25,
				h: 2,
				model: "SR65V",
				project: "HV103",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.1.17",
				isVmHost: true,
				vmNames: ["hv103-vsphere"],
			},
			{
				hostname: "SE-10-HV104",
				u: 22,
				h: 2,
				model: "SR65V",
				project: "HV104",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.1.18",
				isVmHost: true,
				vmNames: ["hv104-vsphere"],
			},
			{
				hostname: "SE-10-HV105",
				u: 19,
				h: 2,
				model: "SR65V",
				project: "HV105",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.1.19",
				isVmHost: true,
				vmNames: ["hv105-vsphere"],
			},
			{
				hostname: "SE-10-HV106",
				u: 16,
				h: 2,
				model: "SR65V",
				project: "HV106",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.1.20",
				isVmHost: true,
				vmNames: ["hv106-vsphere"],
			},
			{
				hostname: "SE-10-HV106-2",
				u: 8,
				h: 2,
				model: "HP DL380p Gen8",
				project: "HV106",
				role: "app-server",
				os: "Linux",
				ip: "10.10.1.21",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "SE-10-HV03",
				u: 6,
				h: 2,
				model: "HP DL380p Gen8",
				project: "INFRA",
				role: "app-server",
				os: "Linux",
				ip: "10.10.1.22",
				isVmHost: false,
				vmNames: [],
			},
		],
	},
	{
		name: "STAR-2",
		location: "DC-STAR (Jakarta)",
		totalU: 45,
		description: "STAR-2 - 10 devices",
		servers: [
			{
				hostname: "10-LFA",
				u: 41,
				h: 1,
				model: "N9K-C9372PX",
				project: "NET",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.2.10",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-LFC",
				u: 40,
				h: 1,
				model: "N9K-C9372PX",
				project: "NET",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.2.11",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-LFB",
				u: 35,
				h: 1,
				model: "N9K-C9372PX",
				project: "NET",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.2.12",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-FW01",
				u: 33,
				h: 1,
				model: "FortiGate 3700D",
				project: "FW",
				role: "firewall",
				os: "FortiOS",
				ip: "10.10.2.13",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-FWASA1",
				u: 32,
				h: 1,
				model: "ASA 5585-X",
				project: "FW",
				role: "firewall",
				os: "Cisco ASA",
				ip: "10.10.2.14",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-FWASA0",
				u: 30,
				h: 1,
				model: "ASA 5585-X",
				project: "FW",
				role: "firewall",
				os: "Cisco ASA",
				ip: "10.10.2.15",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-SP",
				u: 27,
				h: 1,
				model: "Nexus 9504",
				project: "CORE",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.2.16",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-SP-2",
				u: 24,
				h: 2,
				model: "Nexus 9504",
				project: "CORE",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.2.17",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-SP-3",
				u: 22,
				h: 2,
				model: "Nexus 9504 SUP",
				project: "CORE",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.2.18",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "SHELF",
				u: 19,
				h: 1,
				model: "Nexus 9504",
				project: "CORE",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.2.19",
				isVmHost: false,
				vmNames: [],
			},
		],
	},
	{
		name: "NETS6",
		location: "DC-NETS (Jakarta)",
		totalU: 45,
		description: "NETS6 - 6 devices",
		servers: [
			{
				hostname: "10-PR",
				u: 41,
				h: 1,
				model: "ASR-9006",
				project: "CORE",
				role: "router",
				os: "Cisco IOS-XR",
				ip: "10.10.3.10",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-PR-2",
				u: 10,
				h: 1,
				model: "ASR-9006",
				project: "CORE",
				role: "router",
				os: "Cisco IOS-XR",
				ip: "10.10.3.11",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-PR-3",
				u: 9,
				h: 1,
				model: "ASR-9006 10GE-36X",
				project: "CORE",
				role: "router",
				os: "Cisco IOS-XR",
				ip: "10.10.3.12",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "40-SE",
				u: 8,
				h: 1,
				model: "ASR-9006",
				project: "CORE",
				role: "router",
				os: "Cisco IOS-XR",
				ip: "10.10.3.13",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-DWA",
				u: 3,
				h: 1,
				model: "L-com Cat6 PDU",
				project: "POWER",
				role: "other",
				os: "Linux",
				ip: "10.10.3.14",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-CON",
				u: 1,
				h: 1,
				model: "Console Manager 48",
				project: "INFRA",
				role: "other",
				os: "Linux",
				ip: "10.10.3.15",
				isVmHost: false,
				vmNames: [],
			},
		],
	},
	{
		name: "NETS4",
		location: "DC-NETS (Jakarta)",
		totalU: 42,
		description: "NETS4 - 18 devices",
		servers: [
			{
				hostname: "10-vmwu17",
				u: 45,
				h: 1,
				model: "HP DL360p Gen8",
				project: "10-INT104",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.4.10",
				isVmHost: true,
				vmNames: ["vmwu17-vsphere"],
			},
			{
				hostname: "10-vmwu16",
				u: 44,
				h: 1,
				model: "HP DL360p Gen8",
				project: "10-INT103",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.4.11",
				isVmHost: true,
				vmNames: ["vmwu16-vsphere"],
			},
			{
				hostname: "10-vmwu15",
				u: 43,
				h: 1,
				model: "HP DL360p Gen8",
				project: "10-INT102",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.4.12",
				isVmHost: true,
				vmNames: ["vmwu15-vsphere"],
			},
			{
				hostname: "10-vmwu14",
				u: 42,
				h: 1,
				model: "HP DL360p Gen8",
				project: "10-INT101",
				role: "hypervisor",
				os: "VMware ESXi 7.0",
				ip: "10.10.4.13",
				isVmHost: true,
				vmNames: ["vmwu14-vsphere"],
			},
			{
				hostname: "10-INT01",
				u: 41,
				h: 1,
				model: "DELL R420",
				project: "10-INTDC0",
				role: "app-server",
				os: "Linux",
				ip: "10.10.4.14",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-INT02",
				u: 40,
				h: 1,
				model: "DELL R420",
				project: "10-INTDC1",
				role: "app-server",
				os: "Linux",
				ip: "10.10.4.15",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "Ulfi",
				u: 38,
				h: 1,
				model: "Supermicro",
				project: "10-INT04",
				role: "app-server",
				os: "Linux",
				ip: "10.10.4.16",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "Tjakra-Synology",
				u: 35,
				h: 1,
				model: "Synology DS",
				project: "CLIENT",
				role: "storage",
				os: "Synology DSM",
				ip: "10.10.4.17",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-LFX-FEX125",
				u: 28,
				h: 1,
				model: "Nexus 2232TM-E",
				project: "NETS4",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.4.18",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-LFX-FEX127",
				u: 17,
				h: 1,
				model: "Nexus 2232TM-E",
				project: "NETS4",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.4.19",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-STR133",
				u: 16,
				h: 2,
				model: "Supermicro 1U",
				project: "STORAGE",
				role: "storage",
				os: "Linux (storage node)",
				ip: "10.10.4.20",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-STR132",
				u: 14,
				h: 2,
				model: "Supermicro 1U",
				project: "STORAGE",
				role: "storage",
				os: "Linux (storage node)",
				ip: "10.10.4.21",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-STR131",
				u: 12,
				h: 2,
				model: "Supermicro 1U",
				project: "STORAGE",
				role: "storage",
				os: "Linux (storage node)",
				ip: "10.10.4.22",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-STR130",
				u: 10,
				h: 2,
				model: "Supermicro 1U",
				project: "STORAGE",
				role: "storage",
				os: "Linux (storage node)",
				ip: "10.10.4.23",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-STR127",
				u: 8,
				h: 2,
				model: "Supermicro OUDI #02",
				project: "STORAGE",
				role: "storage",
				os: "Linux (storage node)",
				ip: "10.10.4.24",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-STR126",
				u: 6,
				h: 2,
				model: "Supermicro OUDI #01",
				project: "STORAGE",
				role: "storage",
				os: "Linux (storage node)",
				ip: "10.10.4.25",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-STR125",
				u: 4,
				h: 2,
				model: "DELL R720",
				project: "FORTISANDBOX",
				role: "storage",
				os: "Linux (storage node)",
				ip: "10.10.4.26",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-STR125-2",
				u: 2,
				h: 2,
				model: "DELL R720",
				project: "FORTISANDBOX",
				role: "storage",
				os: "Linux (storage node)",
				ip: "10.10.4.27",
				isVmHost: false,
				vmNames: [],
			},
		],
	},
	{
		name: "NETS5",
		location: "DC-NETS (Jakarta)",
		totalU: 22,
		description: "NETS5 - 4 devices",
		servers: [
			{
				hostname: "HKI-10-LFA",
				u: 21,
				h: 2,
				model: "Nexus 6001",
				project: "NET",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.5.10",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "HKI-10-LFA-2",
				u: 19,
				h: 2,
				model: "Nexus 6001",
				project: "NET",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.5.11",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "HKI-10-FEX121",
				u: 17,
				h: 1,
				model: "Nexus 2232TM-E",
				project: "NET",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.5.12",
				isVmHost: false,
				vmNames: [],
			},
			{
				hostname: "10-HKI-NTNX",
				u: 14,
				h: 1,
				model: "Nutanix NX",
				project: "HKI",
				role: "hypervisor",
				os: "Nutanix AHV",
				ip: "10.10.5.13",
				isVmHost: true,
				vmNames: ["ntnx-prism"],
			},
		],
	},
	{
		name: "NETS3",
		location: "DC-NETS (Jakarta)",
		totalU: 24,
		description: "NETS3 - 1 devices",
		servers: [
			{
				hostname: "10-LFX-FEX129",
				u: 23,
				h: 1,
				model: "Nexus 2232TM-E",
				project: "NETS3",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.6.10",
				isVmHost: false,
				vmNames: [],
			},
		],
	},
	{
		name: "NETS2",
		location: "DC-NETS (Jakarta)",
		totalU: 24,
		description: "NETS2 - 1 devices",
		servers: [
			{
				hostname: "10-LFX-FEX131",
				u: 23,
				h: 1,
				model: "Nexus 2232TM-E",
				project: "NETS2",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.7.10",
				isVmHost: false,
				vmNames: [],
			},
		],
	},
	{
		name: "NETS1",
		location: "DC-NETS (Jakarta)",
		totalU: 24,
		description: "NETS1 - 1 devices",
		servers: [
			{
				hostname: "10-LFX-FEX133",
				u: 23,
				h: 1,
				model: "Nexus 2232TM-E",
				project: "NETS1",
				role: "switch",
				os: "Cisco NX-OS",
				ip: "10.10.8.10",
				isVmHost: false,
				vmNames: [],
			},
		],
	},
];

/** Build plausible port labels: link leaves to hypervisors/storage in the same rack. */
const buildPorts = (rack: SeedRack, me: SeedServer) => {
	const others = rack.servers.filter((s) => s.hostname !== me.hostname);
	const peers = others.filter((s) => s.role === "hypervisor" || s.role === "storage" || s.role === "router");
	const ports: { name: string; label: string; target?: string }[] = [];
	if (me.role === "switch") {
		const n = Math.min(4, peers.length);
		for (let i = 0; i < n; i++) {
			const p = peers[i];
			if (!p) continue;
			ports.push({ name: "Eth1/" + (i + 1), label: "Ke " + p.hostname, target: p.hostname });
		}
		ports.push({ name: "Eth1/49", label: "Uplink core" });
		ports.push({ name: "Eth1/50", label: "Uplink core" });
	} else if (me.role === "hypervisor" || me.role === "app-server" || me.role === "storage") {
		ports.push({ name: "eno1", label: "Uplink ke switch", target: peers.find((p) => p.role === "switch")?.hostname });
		ports.push({ name: "eno2", label: "Uplink ke switch (bond)" });
	} else if (me.role === "firewall") {
		ports.push({ name: "port1", label: "WAN" });
		ports.push({ name: "port2", label: "LAN / core", target: peers.find((p) => p.role === "router")?.hostname });
	} else if (me.role === "router") {
		ports.push({ name: "Gi0/0/0", label: "Uplink peer" });
		ports.push({ name: "Gi0/0/1", label: "Ke core switch", target: peers.find((p) => p.role === "switch")?.hostname });
	}
	return ports;
};

/** Build embedded VM records for hypervisors so the VM panel is populated. */
const buildVms = (me: SeedServer, idx: number) => {
	if (!me.isVmHost) return [];
	const names = me.vmNames.length ? me.vmNames : ["vm-" + me.hostname];
	const out = [];
	let vmid = 100 + idx * 10;
	const specs = [
		{ vcpu: 4, ramMB: 8192, diskGB: 100, os: "Ubuntu 22.04", status: "running" as const },
		{ vcpu: 8, ramMB: 16384, diskGB: 250, os: "Debian 12", status: "running" as const },
		{ vcpu: 2, ramMB: 4096, diskGB: 60, os: "Windows Server 2022", status: "stopped" as const },
	];
	for (let i = 0; i < names.length && i < 3; i++) {
		const spec = specs[i] ?? specs[0]!;
		out.push({
			id: String(vmid++),
			name: names[i] ?? "vm-" + i,
			vcpu: spec.vcpu,
			ramMB: spec.ramMB,
			diskGB: spec.diskGB,
			os: spec.os,
			ipAddress: "",
			macAddress: "02:00:00:" + String(idx).padStart(2, "0") + ":00:" + String(i + 1).padStart(2, "0"),
			vlanId: 10 + idx,
			status: spec.status,
			hypervisor: (me.os.toLowerCase().includes("nutanix") ? "kvm" : "esxi") as "proxmox" | "kvm" | "esxi",
		});
	}
	return out;
};

async function main() {
	await mongoose.connect(uri);
	console.log("Connected to " + uri);

	const user = await UserModel.findOne({ isActive: true }).sort({ createdAt: 1 });
	if (!user || !user.teamId) {
		console.log("No active user with a team found. Register/login in the UI first, then re-run.");
		await mongoose.disconnect();
		return;
	}
	const teamId = user.teamId;
	console.log("Seeding for " + user.email + " (team " + String(teamId) + ")");

	let racksCreated = 0;
	let racksSkipped = 0;
	let serversCreated = 0;
	let serversSkipped = 0;
	let virtualizationHosts = 0;
	let vmsCreated = 0;

	for (const rackDef of SEED) {
		let rack = await RackModel.findOne({ teamId, name: rackDef.name });
		if (rack) {
			racksSkipped += 1;
		} else {
			rack = await RackModel.create({
				teamId,
				name: rackDef.name,
				location: rackDef.location,
				totalU: rackDef.totalU,
				description: rackDef.description,
			});
			racksCreated += 1;
			console.log("  rack " + rackDef.name + " created");
		}

		let idx = 0;
		for (const s of rackDef.servers) {
			idx += 1;
			const existing = await ServerModel.findOne({ teamId, hostname: s.hostname });
			if (existing) {
				serversSkipped += 1;
				continue;
			}
			const vms = buildVms(s, idx);
			await ServerModel.create({
				teamId,
				userId: user._id,
				hostname: s.hostname,
				ipAddress: s.ip,
				role: s.role,
				environment: "production" as ServerEnvironment,
				os: s.os,
				hardwareModel: s.model || undefined,
				location: rackDef.location,
				rackId: rack._id,
				uStart: s.u,
				uHeight: s.h,
				face: "front",
				projectName: s.project || undefined,
				isVmHost: s.isVmHost,
				vmNames: s.vmNames,
				vms,
				sshPort: 22,
				tags: [s.project, s.role].filter(Boolean),
				ports: buildPorts(rackDef, s),
			});
			serversCreated += 1;
			if (s.isVmHost) virtualizationHosts += 1;
			vmsCreated += vms.length;
		}
	}

	console.log("");
	console.log("Done.");
	console.log("  racks   : " + racksCreated + " created, " + racksSkipped + " already existed");
	console.log("  servers : " + serversCreated + " created, " + serversSkipped + " already existed");
	console.log("  VM hosts: " + virtualizationHosts + " (with " + vmsCreated + " embedded VM records)");
	await mongoose.disconnect();
}

main().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
