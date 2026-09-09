import { describe, expect, it } from "@jest/globals";
import {
	pickFreeVmid,
	isProxmoxTemplate,
	parseProxmoxVmListEntries,
	detectProxmoxTemplates,
	shellQuote,
	buildProxmoxProvisionCommand,
} from "../../../../src/domain/servers/vm.provisioner.js";

const SAMPLE_QM_LIST = `VMID NAME                 STATUS    MEM     VCPU
100  vm-ubuntu-01         running   16384   4
101  vm-db-02             stopped   32768   8
9000 template-ubuntu      stopped   2048    2
9001 template-debian      stopped   4096    2
`;

describe("parseProxmoxVmListEntries", () => {
	it("parses VM entries from qm list output", () => {
		const entries = parseProxmoxVmListEntries(SAMPLE_QM_LIST);
		expect(entries).toHaveLength(4);
		expect(entries[0]).toMatchObject({ id: 100, name: "vm-ubuntu-01", status: "running", ramMB: 16384, vcpu: 4 });
		expect(entries[2]).toMatchObject({ id: 9000, name: "template-ubuntu", status: "stopped" });
	});

	it("returns empty array for header-only or empty output", () => {
		expect(parseProxmoxVmListEntries("VMID NAME STATUS MEM VCPU")).toHaveLength(0);
		expect(parseProxmoxVmListEntries("")).toHaveLength(0);
	});
});

describe("isProxmoxTemplate", () => {
	it("detects template: 1 in config", () => {
		expect(isProxmoxTemplate("name: template-ubuntu\nmemory: 2048\ntemplate: 1\n")).toBe(true);
	});
	it("returns false for normal VM config", () => {
		expect(isProxmoxTemplate("name: vm-web-01\nmemory: 8192\ncores: 4\n")).toBe(false);
	});
});

describe("pickFreeVmid", () => {
	it("returns 100 when nothing used", () => {
		expect(pickFreeVmid([])).toBe(100);
	});
	it("skips existing ids", () => {
		expect(pickFreeVmid([100, 101, 102])).toBe(103);
	});
	it("skips template pool ids passed as used", () => {
		expect(pickFreeVmid([100, 101, 9000])).toBe(102);
	});
	it("throws when no free id below 9000", () => {
		const all = Array.from({ length: 8900 }, (_, i) => i + 100);
		expect(() => pickFreeVmid(all)).toThrow(/No free VMID/);
	});
});

describe("detectProxmoxTemplates", () => {
	it("filters only template configs", () => {
		const configs = new Map<string, string>([
			["9000", "name: template-ubuntu\nmemory: 2048\ncores: 2\ntemplate: 1\nscsi0: local-lvm:vm-9000-disk-0,size=20G\n"],
			["9001", "name: template-debian\nmemory: 4096\ncores: 2\ntemplate: 1\nscsi0: local-lvm:vm-9001-disk-0,size=10G\n"],
			["100", "name: vm-ubuntu-01\nmemory: 16384\ncores: 4\n"],
		]);
		const templates = detectProxmoxTemplates(SAMPLE_QM_LIST, configs);
		expect(templates).toHaveLength(2);
		expect(templates[0]).toMatchObject({ id: "9000", name: "template-ubuntu", ramMB: 2048, vcpu: 2, diskGB: 20 });
		expect(templates[1]).toMatchObject({ id: "9001", name: "template-debian", diskGB: 10 });
	});

	it("handles disks in T and M units", () => {
		const configs = new Map<string, string>([
			["9000", "name: template-big\nmemory: 2048\ncores: 2\ntemplate: 1\nscsi0: local-lvm:vm-9000-disk-0,size=1T\n"],
		]);
		const templates = detectProxmoxTemplates("VMID NAME STATUS MEM VCPU\n9000 template-big stopped 2048 2\n", configs);
		expect(templates[0]?.diskGB).toBe(1024);
	});
});

describe("shellQuote", () => {
	it("wraps in single quotes and escapes embedded quotes", () => {
		expect(shellQuote("simple")).toBe("'simple'");
		expect(shellQuote("a'b")).toBe("'a'\\''b'");
	});
});

describe("buildProxmoxProvisionCommand", () => {
	const template = { id: "9000", name: "template-ubuntu", os: "linux", diskGB: 20, ramMB: 2048, vcpu: 2 };

	it("builds clone + set + start chain", () => {
		const cmd = buildProxmoxProvisionCommand(
			{ name: "vm-web-01", templateId: "9000", vcpu: 4, ramMB: 8192, diskGB: 20, startVm: true },
			template,
			200,
		);
		expect(cmd).toContain("qm clone 9000 200 --name 'vm-web-01'");
		expect(cmd).toContain("qm set 200 --memory 8192 --cores 4");
		expect(cmd).toContain("qm start 200");
		expect(cmd).not.toContain("qm resize"); // disk not increased
	});

	it("adds resize when disk grows", () => {
		const cmd = buildProxmoxProvisionCommand(
			{ name: "vm-big", templateId: "9000", vcpu: 2, ramMB: 2048, diskGB: 100, startVm: false },
			template,
			201,
		);
		expect(cmd).toContain("qm resize 201 scsi0 100G");
		expect(cmd).not.toContain("qm start");
	});

	it("includes bridge, vlan and ip config when provided", () => {
		const cmd = buildProxmoxProvisionCommand(
			{
				name: "vm-net",
				templateId: "9000",
				vcpu: 2,
				ramMB: 2048,
				diskGB: 20,
				bridge: "vmbr0",
				vlanTag: 20,
				ipAddress: "10.10.10.51",
				gateway: "10.10.10.1",
				startVm: true,
			},
			template,
			202,
		);
		expect(cmd).toContain("--net0 'model=virtio,bridge=vmbr0,tag=20'");
		expect(cmd).toContain("--ipconfig0 'ip=10.10.10.51,gw=10.10.10.1'");
	});
});
