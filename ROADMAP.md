# Checkmate-Ewen Roadmap

> Fork of [bluewave-labs/Checkmate](https://github.com/bluewave-labs/Checkmate)
> extended toward a **network-engineering-grade monitoring platform** (mini-NMS).
>
> Origin: fork ini lahir dari sesi troubleshooting nyata (8 Agu 2026) —
> BGP MED-overflow dari peer AS13335 di PE router + host unreachable asimetris
> di balik FortiGate. Semua fitur di bawah diprioritaskan dari kebutuhan
> operasional network engineer (PE/Nexus/FortiGate/CPE multi-vendor).

## Yang Sudah Selesai ✅

- [x] **BGP monitor** (`type: bgp`) — SSH ke router, parse `show ip bgp
  summary` / `neighbors X routes` (Cisco IOS-XE, VRF-aware), evaluasi 5 rule:
  session-state, asn-match, min-prefixes, **med-validity** (deteksi MED
  4294967295), routes-received. 14 unit test dari output router produksi.
  → commit `ea88ed3`

---

## Fase 1 — Network Core (fondasi mini-NMS)

> Tema: semua yang kemarin masih dikerjakan manual via SSH/CLI.

| # | Fitur | Deskripsi | Basis kode |
|---|-------|-----------|------------|
| 1.1 | **`ssh-command` monitor** | Generalisasi BgpProvider: command SSH bebas + evaluasi output (regex / expected string / JSONPath). Membuka: interface errors, OSPF/HSRP state, `show environment` suhu/power. | `IRouterCommandRunner` sudah ada — refactor jadi provider generik |
| 1.2 | **SNMP monitor** | Interface up/down, bandwidth, error counters, CPU/mem perangkat (Cisco/Huawei/FortiGate). Library: `net-snmp`. Fitur NMS paling fundamental. | Provider baru, pola sama |
| 1.3 | **Traceroute / path-change detection** | Simpan hop-by-hop path, alert saat path berubah → deteksi perubahan policy routing & asimetri (pola Isu B). | Provider baru (system `mtr`/`traceroute`) |
| 1.4 | **Multi-vantage agent** | Agent ringan per segmen (VLAN user vs VLAN DC) ping target yang sama → otomatis menjawab "down di user, up di DC?" | Extend geo-checks yang sudah ada |
| 1.5 | **Syslog receiver** | Terima syslog, alert by pattern (`%BGP-5-ADJCHANGE`, `%LINK-3-UPDOWN`). Melengkapi polling dengan event-driven detection. | Service baru (UDP 514) + rule engine |

## Fase 2 — Network Advanced (diferensiasi)

| # | Fitur | Deskripsi |
|---|-------|-----------|
| 2.1 | **Config backup & diff** | Snapshot `show running-config` berkala, history + alert saat berubah ("siapa ubah route-map kemarin?" — akar Isu A) |
| 2.2 | **RPKI/IRR route validator** | Validasi prefix BGP terhadap RPKI/RIPEstat → deteksi route leak/hijack, bukan cuma sesi down |
| 2.3 | **Troubleshooting timeline** | Korelasi incident lintas monitor dalam satu timeline (BGP flap → interface error → host unreachable) |
| 2.4 | **Alert auto-diagnosis** | Saat monitor down: auto-jalankan ping + traceroute + port check + last syslog, lampirkan di notifikasi ("DOWN — traceroute berhenti di hop 3") |

## Fase 3 — Alerting Pintar

| # | Fitur | Deskripsi |
|---|-------|-----------|
| 3.1 | **Alert grouping & dependency** | Parent-child topology (PE → CE → services). Core down = 1 alert root-cause, bukan 50 alert banjir |
| 3.2 | **On-call rotation & escalation** | Alert → orang A, no-ack 15 mnt → eskalasi B. Built-in, gratis (vs PagerDuty) |
| 3.3 | **Recurring maintenance window** | Jadwal berulang (tiap Minggu 02:00–04:00), bulk-apply ke group/tag, auto-silence |
| 3.4 | **ChatOps 2-arah** | Bot Telegram/Slack: `/ack`, `/silence 1h`, `/status` langsung dari chat |

## Fase 4 — Pelaporan & Platform

| # | Fitur | Deskripsi |
|---|-------|-----------|
| 4.1 | **SLA/SLO + error budget** | Target 99.9%/bulan, alert saat budget menipis — bukan setelah jebol |
| 4.2 | **Scheduled PDF reports** | Laporan uptime mingguan/bulanan via email (uptime %, MTTR, top incidents) untuk management & klien enterprise |
| 4.3 | **White-label status page** | Custom domain per-tenant/pelanggan |
| 4.4 | **Inbound webhook hub** | Terima push event dari Zabbix/Prometheus/Grafana → migrasi bertahap tanpa big-bang |
| 4.5 | **AI incident summary** | Ringkasan otomatis saat resolved (durasi, pola, checks gagal) via LLM API |
| 4.6 | **Cert & domain expiry monitor** | SSL cert (sudah ada parsial) + domain expiry via RDAP |
| 4.7 | **Audit log viewer** | Siapa ubah/hapus monitor, kapan — wajib untuk NOC shared-account |

---

## Prinsip Prioritas

1. **Fase 1 dulu** — setiap item langsung menghilangkan pekerjaan manual harian
   (1.1 + 1.2 adalah kombinasi impact × effort terbaik).
2. **Jangan fork-forever** — fitur yang generik (Fase 3–4 sebagian) layak
   di-upstream-kan sebagai PR ke bluewave-labs/Checkmate; fitur network-specific
   (Fase 1–2) kemungkinan tetap khas fork ini.
3. **Setiap provider baru wajib**: injeksi dependency untuk testability (pola
   `IRouterCommandRunner`), unit test dari output perangkat nyata, terdaftar di
   `services.worker.ts`, field di schema Mongoose + Zod + client types.

## Tracking

Progress dicatat dengan mengubah `[ ]` → `[x]` + referensi commit per item.
