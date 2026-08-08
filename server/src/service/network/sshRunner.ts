import { Client } from "ssh2";

/** Abstraksi eksekusi perintah di perangkat remote — di-inject agar bisa di-mock saat test. */
export interface IRouterCommandRunner {
	exec(host: string, port: number, username: string, password: string, command: string): Promise<string>;
}

/** Runner produksi: SSH ke perangkat (Cisco IOS-XE / NX-OS / IOS-XR / Linux style CLI). */
export class SshRouterCommandRunner implements IRouterCommandRunner {
	constructor(private timeoutMs = 15000) {}

	exec(host: string, port: number, username: string, password: string, command: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const conn = new Client();
			let output = "";
			let settled = false;

			const done = (err: Error | null, data = "") => {
				if (settled) return;
				settled = true;
				try {
					conn.end();
				} catch {
					/* noop */
				}
				if (err) reject(err);
				else resolve(data);
			};

			const timer = setTimeout(() => done(new Error(`SSH timeout after ${this.timeoutMs}ms`)), this.timeoutMs);

			conn.on("ready", () => {
				conn.exec(`${command}\n`, (err, stream) => {
					if (err) {
						clearTimeout(timer);
						return done(err);
					}
					stream
						.on("data", (d: Buffer) => (output += d.toString()))
						.on("close", () => {
							clearTimeout(timer);
							done(null, output);
						})
						.stderr.on("data", () => {});
					stream.end("exit\n");
				});
			})
				.on("error", (err) => {
					clearTimeout(timer);
					done(err);
				})
				.connect({ host, port, username, password, readyTimeout: this.timeoutMs });
		});
	}
}
