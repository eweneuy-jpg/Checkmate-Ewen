/**
 * Demo seed for Checkmate-Ewen — racks & servers.
 *
 * Usage (from server/):
 *   npx tsx scripts/seed-demo.ts
 *
 * Connects to the same DB as the app (DB_CONNECTION_STRING env, default
 * mongodb://localhost:27017/uptime_db), grabs the FIRST active user, then
 * creates sample racks + servers under that user's team if none exist yet.
 * Safe to re-run: skips racks that already exist (unique teamId+name).
 */
import mongoose from "mongoose";
import { UserModel } from "../src/domain/users/user.model.js";
import { RackModel } from "../src/domain/racks/rack.model.js";
import { ServerModel } from "../src/domain/servers/server.model.js";
import { Types } from "mongoose";

const uri = process.env.DB_CONNECTION_STRING ?? "mongodb://localhost:27017/uptime_db";

async function main() {
	await mongoose.connect(uri);
	console.log("Connected to", uri);

	const user = await UserModel.findOne({ isActive: true }).sort({ createdAt: 1 });
	if (!user) {
		console.log("No active user found. Register/login first, then re-run this seed.");
		await mongoose.disconnect();
		return;
	}
	if (!user.teamId) {
		console.log("User has no teamId. Register/login first, then re-run this seed.");
		await mongoose.disconnect();
		return;
	}
	const teamId = user.teamId;
	console.log(`Seeding for user ${user.email} (team ${String(teamId)})`);

	// ---- Racks ----
	const racks = [
		{
			name: "RACK-A1",
			location: "DC-JKT NETS4",
			totalU: 42,
			description: "Core network & firewall (edge)",
		},
		{
			name: "RACK-B2",
			location: "DC-JKT NETS4",
			totalU: 42,
			description: "Compute & hypervisor",
		},
	];

	const rackIds = new Map<string, Types.ObjectId>();
	for (const r of racks) {
		let existing = await RackModel.findOne({ teamId, name: r.name });
		if (!existing) {
			existing = await RackModel.create({ teamId, ...r });
			console.log("Created rack", r.name);
		} else {
			console.log("Rack exists, skip", r.name);
		}
		rackIds.set(r.name, existing._id);
	}

	// ---- Servers ----
	const servers = [
		{
			hostname: "13-PE-R59",
			ipAddress: "10.10.0.59",
			role: "router",
			environment: "production",
			os: "Cisco IOS-XE",
			hardwareModel: "Cisco ASR-1000",
			location: "RACK-A1",
			rackId: "RACK-A1",
			uStart: 40,
			uHeight: 2,
			projectName: "BACKBONE",
			tags: ["cisco", "core", "vrf-10-017"],
			ports: [
				{ name: "Port49", label: "Ke 12-SP-RDES" },
				{ name: "Port50", label: "Uplink DC" },
			],
		},
		{
			hostname: "12-SP-RDES",
			ipAddress: "10.10.0.12",
			role: "switch",
			environment: "production",
			os: "Cisco NX-OS",
			hardwareModel: "Cisco Nexus 9300",
			location: "RACK-A1",
			rackId: "RACK-A1",
			uStart: 36,
			uHeight: 1,
			projectName: "BACKBONE",
			tags: ["nexus", "dc"],
			ports: [
				{ name: "Eth1/1", label: "Ke 13-PE-R59" },
				{ name: "Eth1/2", label: "Ke 10-SE-FWA_RSE01" },
			],
		},
		{
			hostname: "10-SE-FWA_RSE01",
			ipAddress: "10.10.1.254",
			role: "firewall",
			environment: "dmz",
			os: "FortiOS",
			hardwareModel: "FortiGate 100F",
			location: "RACK-A1",
			rackId: "RACK-A1",
			uStart: 33,
			uHeight: 1,
			projectName: "SECURITY",
			tags: ["fortigate", "vdom"],
			ports: [
				{ name: "Port1", label: "WAN" },
				{ name: "Port2", label: "Ke 12-SP-RDES" },
			],
		},
		{
			hostname: "SVR-10-vmwu16",
			ipAddress: "10.10.2.16",
			role: "hypervisor",
			environment: "production",
			os: "Proxmox VE 8.2",
			hardwareModel: "Dell PowerEdge R740",
			location: "RACK-B2",
			rackId: "RACK-B2",
			uStart: 20,
			uHeight: 2,
			isVmHost: true,
			vmNames: ["vm-web-01", "vm-db-01", "vm-mon-01"],
			projectName: "COMPUTE",
			tags: ["proxmox", "kvm"],
			ports: [{ name: "eno1", label: "Ke 12-SP-RDES" }],
			vms: [
				{
					id: "101",
					name: "vm-web-01",
					vcpu: 4,
					ramMB: 8192,
					diskGB: 100,
					os: "Ubuntu 22.04",
					ipAddress: "10.10.2.101",
					macAddress: "02:00:00:aa:01:01",
					vlanId: 10,
					status: "running",
					hypervisor: "proxmox",
				},
				{
					id: "102",
					name: "vm-db-01",
					vcpu: 8,
					ramMB: 16384,
					diskGB: 250,
					os: "Debian 12",
					ipAddress: "10.10.2.102",
					macAddress: "02:00:00:aa:01:02",
					vlanId: 10,
					status: "running",
					hypervisor: "proxmox",
				},
				{
					id: "103",
					name: "vm-mon-01",
					vcpu: 2,
					ramMB: 4096,
					diskGB: 50,
					os: "Ubuntu 24.04",
					ipAddress: "",
					macAddress: "02:00:00:aa:01:03",
					vlanId: 10,
					status: "stopped",
					hypervisor: "proxmox",
				},
			],
		},
		{
			hostname: "ce-6851-leaf",
			ipAddress: "10.10.3.1",
			role: "switch",
			environment: "production",
			os: "CE6851 V200R005",
			hardwareModel: "Huawei CE6851",
			location: "RACK-B2",
			rackId: "RACK-B2",
			uStart: 14,
			uHeight: 1,
			projectName: "FABRIC",
			tags: ["huawei", "leaf"],
			ports: [
				{ name: "GE1/0/1", label: "Ke SVR-10-vmwu16" },
				{ name: "GE1/0/2", label: "Uplink spine" },
			],
		},
	];

	let created = 0;
	for (const s of servers) {
		const existing = await ServerModel.findOne({ teamId, hostname: s.hostname });
		if (existing) {
			console.log("Server exists, skip", s.hostname);
			continue;
		}
		const { location, rackId, ...rest } = s;
		const rackObjId = rackIds.get(rackId);
		await ServerModel.create({
			...rest,
			teamId,
			userId: user._id,
			rackId: rackObjId ?? null,
			location,
			sshPort: 22,
			tags: s.tags ?? [],
			ports: s.ports ?? [],
		});
		created += 1;
		console.log("Created server", s.hostname);
	}

	console.log(`\nDone. Racks: ${rackIds.size}, servers created: ${created}`);
	await mongoose.disconnect();
}

main().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
