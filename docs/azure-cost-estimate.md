# Physics IDE — Azure Hosting Cost Estimate

**Prepared:** 29 July 2026
**Region priced:** South Africa North (`southafricanorth`) — keeps data in-country for POPIA purposes
**Currency:** USD and ZAR. All figures are Microsoft's own published list prices, pulled live from the Azure Retail Prices API (`prices.azure.com`) on the date above.
**Pricing model:** Pay-as-you-go list price. No academic, EA, CSP or reservation discount applied.
**Implied FX:** Azure's own ZAR list prices work out to **R16.46 = US$1**. Azure bills South African customers in ZAR at Microsoft's rate, not the daily spot rate, so the ZAR column is the number that would actually appear on an invoice.

---

## 1. Executive summary

| Scenario | What it covers | USD / month | ZAR / month | ZAR / year |
|---|---|---:|---:|---:|
| **0. Current release (today)** | Static browser-only app, no accounts, no server | **$0** | **R0** | **R0** |
| **1. Pilot portal** | ~500 learners + 10 teachers, single course, minimum viable managed platform | **$40** | **R658** | **R7,900** |
| **2. Single-course production** | ~500 users, SLA-backed, containerised API, monitored | **$64** | **R1,061** | **R12,730** |
| **3. Faculty rollout** | ~3,000 learners + 60 teachers, multi-course | **$265** | **R4,365** | **R52,380** |
| **4. Institution-wide, hardened** | ~10,000 learners, high availability, WAF, long-term retention | **$948** | **R15,601** | **R187,210** |

**The headline point:** the Physics IDE as it exists today costs **nothing** to host, because all simulation and data-analysis computation runs in the student's own browser. Every rand in the table above buys *institutional features* — accounts, roles, teacher dashboards, submission tracking and audit trails — not simulation capacity.

A second, equally important point: **identity is effectively free** at any plausible scale for this project. Microsoft Entra External ID includes 50,000 monthly active users at no charge, and if learners sign in with existing university accounts the cost is zero regardless of headcount.

---

## 2. What is being costed

The current production release is a client-only single-page application: no backend, no database, no user accounts. Simulation runs in a sandboxed browser iframe (GlowScript/VPython) and data analysis runs in-browser via Arquero and Observable Plot. Projects persist to the browser's own IndexedDB storage.

The **managed learner/teacher platform** described in the technical documentation adds:

- Authentication and identity (institutional login, session management)
- A role model (teacher, student, optional teaching assistant)
- Course/class context with permission boundaries
- Persistent server-side project and workspace history
- Code-sharing workflows (teacher templates, student submissions, controlled peer sharing)
- An immutable audit trail for academic-integrity purposes — owner, sharer, recipient, timestamps, version hash

The simulation runtime does **not** change. It stays in the browser. This is why the compute figures below are so modest: the servers move JSON around and enforce permissions; they do not run physics.

---

## 3. Component unit prices (South Africa North, list price)

### 3.1 Frontend hosting — Azure Static Web Apps

Static Web Apps is a global service delivered over Microsoft's CDN; there is no South Africa region to select, but South African users are served from nearby edge nodes.

| Item | USD | ZAR |
|---|---:|---:|
| **Free plan** — 100 GB bandwidth/mo, 0.5 GB storage, 2 custom domains, 3 preview environments, free managed SSL. No SLA. | $0.00 | R0.00 |
| **Standard plan** — per app, per month. Adds SLA, private endpoints, custom auth providers, 2 GB storage, 6 custom domains, 10 preview environments. | $9.00 | R148.14 |
| Bandwidth beyond the included 100 GB, per GB | $0.20 | R3.29 |
| Optional Azure Front Door add-on, per hour (≈$17.52/mo) | $0.024 | R0.395 |

> **Sizing note:** the app is ~338 kB gzipped on first load and under 5 kB on cached loads. 100 GB of included bandwidth covers roughly **295,000 first-time loads per month**. Bandwidth will not be a cost factor at university scale. The Free plan's dedicated retirement of the old Dedicated plan (31 Oct 2025) does not affect Free or Standard.

### 3.2 API / application tier

Two credible options. App Service is simpler and fixed-price; Container Apps scales to zero and is cheaper when traffic is bursty (which teaching traffic is — it clusters around lab sessions).

**Azure App Service (Linux), per month at 730 hours**

| SKU | vCPU / RAM | USD/hr | USD/mo | ZAR/mo |
|---|---|---:|---:|---:|
| F1 (Free) | shared, 60 CPU-min/day quota | $0.000 | $0.00 | R0 |
| **B1** | 1 vCPU / 1.75 GB | $0.0243 | **$17.74** | **R292** |
| B2 | 2 vCPU / 3.5 GB | $0.0487 | $35.55 | R585 |
| B3 | 4 vCPU / 7 GB | $0.0973 | $71.03 | R1,169 |
| S1 | 1 vCPU / 1.75 GB (+ autoscale, staging slots) | $0.139 | $101.47 | R1,670 |
| P0v3 | 1 vCPU / 4 GB | $0.0965 | $70.45 | R1,160 |
| P1v3 | 2 vCPU / 8 GB | $0.193 | $140.89 | R2,319 |

> F1 has no custom-domain SSL and no SLA — development only.

**Azure Container Apps (Consumption)**

| Meter | USD | ZAR |
|---|---:|---:|
| vCPU, active | $0.000024 / sec (= $0.0864/vCPU-hr) | R0.00040/sec |
| vCPU, idle | $0.000003 / sec (= $0.0108/vCPU-hr) | — |
| Memory | $0.000003 / GiB-sec (= $0.0108/GiB-hr) | — |
| Requests | $0.40 per million | R6.58 per million |
| **Free grant, per subscription per month** | **180,000 vCPU-sec + 360,000 GiB-sec + 2M requests** | — |
| Dedicated plan management (if needed) | $0.10/hr (≈$73/mo) | — |
| Dedicated vCPU / memory | $0.057077/vCPU-hr, $0.004978/GiB-hr | — |
| Dynamic Sessions (sandboxed untrusted code execution) | $0.03 / session-hour | — |

Worked monthly figures for one always-on replica at 0.5 vCPU / 1 GiB:

| Duty cycle | USD/mo |
|---|---:|
| Scale-to-zero, ~2 active hours/day | **$0.00** (inside the free grant) |
| Always on, mostly idle | $10.20 |
| Always on, ~30% active | $14.70 |
| Always on, 100% active | $34.02 |
| Always on, 1 vCPU / 2 GiB, 100% active | $73.44 |

> **Watch-out:** a Container Apps environment that uses a VNet, private endpoint or internal load balancer accrues charges **even when the app is scaled to zero**. Scale-to-zero economics only hold for the default public environment.

### 3.3 Container registry

| SKU | Included storage | USD/day | USD/mo | ZAR/mo |
|---|---|---:|---:|---:|
| Basic | 10 GB | $0.1666 | $5.07 | R83 |
| Standard | 100 GB | $0.6666 | $20.28 | R334 |
| Premium (incl. geo-replication) | 500 GB | $1.6666 | $50.70 | R835 |
| Storage beyond included, per GB/mo | — | — | $0.10 | R1.65 |

### 3.4 Database — Azure SQL Database

**DTU model** (all-inclusive: compute + storage + backup within limits). Best value and most predictable at this scale.

| Tier | DTUs / max size | USD/day | USD/mo | ZAR/mo |
|---|---|---:|---:|---:|
| **Basic** | 5 DTU / 2 GB | $0.235 | **$7.15** | **R118** |
| **S0** | 10 DTU / 250 GB | $0.707 | **$21.51** | **R354** |
| S1 | 20 DTU / 250 GB | $1.413 | $42.98 | R707 |
| S2 | 50 DTU / 250 GB | $3.533 | $107.47 | R1,769 |
| S3 | 100 DTU / 250 GB | $7.066 | $214.95 | R3,538 |

**vCore model — General Purpose, Gen5 provisioned**

| Item | USD | ZAR |
|---|---:|---:|
| Compute, per vCore-hour | $0.203971 | R3.36 |
| 1 vCore, per month | $148.90 | R2,451 |
| **2 vCore, per month** | **$297.80** | **R4,902** |
| 4 vCore, per month | $595.59 | R9,804 |
| Data storage, per GB/mo | $0.154 | R2.53 |
| Data storage, zone-redundant, per GB/mo | $0.308 | R5.07 |
| PITR backup, LRS or ZRS, per GB/mo | $0.134 | R2.21 |
| PITR backup, geo-redundant, per GB/mo | $0.268 | R4.41 |
| Long-term retention backup, ZRS, per GB/mo | $0.0335 | R0.55 |

**The Azure SQL free offer — read this before relying on it.** Every subscription can run up to 10 free databases, each with 100,000 vCore-seconds of compute, 32 GB of data and 32 GB of backup per month. That sounds generous but 100,000 vCore-seconds is only **27.8 vCore-hours** — under 4% of a month. Serverless SQL bills for every second the database is *online*, not for CPU work done, and auto-pause requires zero sessions **and** zero CPU for the full delay window. Any connection pool, health probe or monitoring agent keeps it online. Real-world reports of the entire monthly grant being consumed in two days are common. **Treat the free offer as suitable only for genuinely intermittent access, not for a portal with a live connection pool.** The Basic DTU tier at R118/month is both cheaper in practice and predictable.

### 3.5 Database — Azure Database for PostgreSQL Flexible Server

The technical documentation names PostgreSQL as the recommended engine. At pilot scale it is cheaper than Azure SQL.

| SKU | vCore / RAM | USD/hr | USD/mo | ZAR/mo |
|---|---|---:|---:|---:|
| **B1ms** | 1 / 2 GB | $0.0215 | **$15.70** | **R258** |
| B2s | 2 / 4 GB | $0.086 | $62.78 | R1,033 |
| B2ms | 2 / 8 GB | $0.172 | $125.56 | R2,067 |
| D2ds_v5 (General Purpose) | 2 / 8 GB | $0.235 | $171.55 | R2,824 |

| Storage item | USD | ZAR |
|---|---:|---:|
| Provisioned storage, per GB/mo | $0.151 | R2.49 |
| Backup storage beyond the free allowance (100% of provisioned storage is free), LRS, per GB/mo | $0.113 | R1.86 |

### 3.6 Object storage — Azure Blob (General Block Blob v2, Hot, LRS)

For project bundles, exported chart PNGs, CSV datasets and submission artefacts.

| Meter | USD | ZAR |
|---|---:|---:|
| Data stored, per GB/mo (first 50 TB) | $0.0219 | R0.3605 |
| Write operations, per 10,000 | $0.060 | R0.99 |
| Read operations, per 10,000 | $0.004 | R0.066 |
| All other operations, per 10,000 | $0.004 | R0.066 |

Cool tier (30-day minimum) and Cold tier (90-day minimum) reduce storage cost substantially at the expense of higher per-operation and retrieval charges — worth using for submissions older than one term.

### 3.7 Identity and access

| Option | Cost |
|---|---|
| **University Entra ID / institutional SSO** — learners and staff sign in with existing UWC accounts | **$0 additional.** Already covered by the institution's Microsoft 365 / EDU agreement. |
| **Microsoft Entra External ID** — for users outside the university tenant | **First 50,000 monthly active users free.** Beyond that: $0.00325/MAU (P1) or $0.01625/MAU (P2). Optional data-residency add-on $0.02/MAU. |

At 10,000 learners the External ID cost is **$0.00**. Identity is not a cost driver for this project at any realistic scale.

### 3.8 Monitoring, secrets, and network

| Item | USD | ZAR |
|---|---:|---:|
| Log Analytics / Application Insights ingestion, per GB (Analytics Logs) | $3.36 | R55.31 |
| — first 5 GB/month per billing account | free | free |
| Key Vault Standard, per 10,000 operations | $0.03 | R0.49 |
| Azure Front Door Standard, base fee per month | $35.00 | R576 |
| Azure Front Door Premium (adds managed WAF rulesets), base fee per month | $330.00 | R5,432 |

**Egress bandwidth** (account-wide, internet-bound, on top of any bandwidth included in a service plan):

| Volume | USD/GB |
|---|---:|
| First 100 GB / month | **free** |
| Next 10 TB | $0.12 |
| 10–50 TB | $0.085 |
| Above 50 TB | $0.075 |

> Log Analytics at $3.36/GB is the single most commonly underestimated line in an Azure bill. See §5 for how to reduce it.

---

## 4. Scenario build-ups

### Scenario 0 — Current release (what is deployed today)

| Line item | SKU | USD/mo | ZAR/mo |
|---|---|---:|---:|
| Frontend hosting | Static Web Apps, Free plan | 0.00 | 0 |
| Bandwidth | ~1.3 GB/mo for 3,000 students — inside the 100 GB allowance | 0.00 | 0 |
| Backend | none | 0.00 | 0 |
| Database | none — projects persist in the browser (IndexedDB) | 0.00 | 0 |
| Identity | none | 0.00 | 0 |
| **Total** | | **$0.00** | **R0** |

**Annual: R0.** This reflects the deliberate architectural decision that all execution and persistence happen client-side.

---

### Scenario 1 — Pilot portal (≈500 learners + 10 teachers, one course)

Minimum viable managed platform. No SLA on the frontend, single API instance, burstable database. Appropriate for a one-semester pilot.

| Line item | SKU / assumption | USD/mo | ZAR/mo |
|---|---|---:|---:|
| Frontend hosting | Static Web Apps, Free plan | 0.00 | 0 |
| API tier | App Service B1 Linux, 1 vCPU / 1.75 GB | 17.74 | 292 |
| Database compute | PostgreSQL Flexible B1ms, 1 vCore / 2 GB | 15.70 | 258 |
| Database storage | 32 GB @ $0.151/GB | 4.83 | 80 |
| Database backup | 32 GB — within the free allowance | 0.00 | 0 |
| Object storage | 20 GB Hot LRS | 0.44 | 7 |
| Storage transactions | ~1M reads + 100k writes | 1.00 | 16 |
| Identity | Entra External ID, 510 MAU — inside the 50,000 free tier | 0.00 | 0 |
| Monitoring | Application Insights, ~3 GB — inside the 5 GB free tier | 0.00 | 0 |
| Secrets | Key Vault Standard | 0.30 | 5 |
| Egress | ~30 GB — inside the 100 GB free tier | 0.00 | 0 |
| **Total** | | **$40.01** | **R659** |

**Annual: $480 / ≈R7,900**

---

### Scenario 2 — Single-course production (≈500 users, SLA-backed)

Adds an SLA on the frontend, a containerised API with scale-to-zero, managed SQL, and real monitoring. This is the smallest configuration defensible for graded coursework.

| Line item | SKU / assumption | USD/mo | ZAR/mo |
|---|---|---:|---:|
| Frontend hosting | Static Web Apps **Standard**, 1 app (SLA, custom auth, private endpoint) | 9.00 | 148 |
| API tier | Container Apps, 1 replica @ 0.5 vCPU / 1 GiB, ~30% duty cycle | 14.70 | 242 |
| Container registry | ACR Basic (10 GB) | 5.07 | 83 |
| Database | Azure SQL **S0** — 10 DTU, up to 250 GB | 21.51 | 354 |
| Database backup | 5 GB PITR, LRS | 0.67 | 11 |
| Object storage | 50 GB Hot LRS | 1.10 | 18 |
| Storage transactions | 2M reads + 200k writes | 2.00 | 33 |
| Identity | Entra External ID, 510 MAU — free tier | 0.00 | 0 |
| Monitoring | 8 GB ingested, 3 GB billable @ $3.36 | 10.08 | 166 |
| Secrets | Key Vault Standard | 0.30 | 5 |
| Egress | ~50 GB — inside the free tier | 0.00 | 0 |
| **Total** | | **$64.43** | **R1,061** |

**Annual: $773 / ≈R12,730**

---

### Scenario 3 — Faculty rollout (≈3,000 learners + 60 teachers, multi-course)

| Line item | SKU / assumption | USD/mo | ZAR/mo |
|---|---|---:|---:|
| Frontend hosting | Static Web Apps Standard | 9.00 | 148 |
| API tier | Container Apps, 2 replicas @ 0.75 vCPU / 1.5 GiB, ~40% duty, 20M requests | 70.39 | 1,159 |
| Container registry | ACR Standard (100 GB) | 20.28 | 334 |
| Database | Azure SQL **S2** — 50 DTU | 107.47 | 1,769 |
| Database backup | 20 GB PITR, LRS | 2.68 | 44 |
| Object storage | 250 GB Hot LRS | 5.48 | 90 |
| Storage transactions | 10M reads + 1M writes | 10.00 | 165 |
| Identity | Entra External ID, 3,060 MAU — free tier | 0.00 | 0 |
| Monitoring | 15 GB ingested, 10 GB billable @ $3.36 | 33.60 | 553 |
| Secrets | Key Vault Standard | 0.30 | 5 |
| Egress | 150 GB total, 50 GB billable @ $0.12 | 6.00 | 99 |
| **Total** | | **$265.20** | **R4,365** |

**Annual: $3,182 / ≈R52,380**

---

### Scenario 4 — Institution-wide, production-hardened (≈10,000 learners)

High availability, web application firewall, geo-replicated registry, long-term backup retention for academic-integrity records.

| Line item | SKU / assumption | USD/mo | ZAR/mo |
|---|---|---:|---:|
| Frontend hosting | Static Web Apps Standard | 9.00 | 148 |
| CDN / WAF | Azure Front Door Standard, base fee | 35.00 | 576 |
| API tier | Container Apps, 3 replicas @ 1 vCPU / 2 GiB, ~50% duty, 80M requests | 179.54 | 2,955 |
| Container registry | ACR Premium with geo-replication | 50.70 | 835 |
| Database compute | Azure SQL General Purpose, 2 vCore Gen5, provisioned | 297.80 | 4,902 |
| Database storage | 200 GB @ $0.154/GB | 30.80 | 507 |
| Database PITR backup | 200 GB, LRS | 26.80 | 441 |
| Database long-term retention | 500 GB, ZRS (audit-trail retention) | 16.75 | 276 |
| Object storage | 1 TB Hot LRS | 22.43 | 369 |
| Storage transactions | 50M reads + 5M writes | 50.00 | 823 |
| Identity | Entra External ID, 10,200 MAU — still inside the 50,000 free tier | 0.00 | 0 |
| Monitoring | 55 GB ingested, 50 GB billable @ $3.36 | 168.00 | 2,765 |
| Secrets | Key Vault Standard | 1.00 | 16 |
| Egress | 600 GB total, 500 GB billable @ $0.12 | 60.00 | 988 |
| **Total** | | **$947.82** | **R15,601** |

**Annual: $11,374 / ≈R187,210**

---

## 5. Cost reduction levers

These are ordered by how much they move the number, largest first.

1. **Reduce log ingestion.** At $3.36/GB, monitoring is 18% of Scenario 4. Switching non-critical tables to the Basic Logs tier, enabling sampling in Application Insights, and shortening retention typically cuts this by 60–80% — roughly **R2,200/month saved in Scenario 4**.

2. **Buy reserved capacity for the database.** A one-year reservation on Azure SQL vCore compute is commonly around 35% off list, three-year around 55%. Scenario 4's R4,902 database line falls to roughly **R3,200/month** on a one-year term. Reservations suit this workload because the database is genuinely always on.

3. **Apply Azure Hybrid Benefit.** If the university already holds SQL Server licences with active Software Assurance, the vCore compute rate drops to the base rate — a further material reduction on top of reservations. Worth checking with ICT before assuming list pricing.

4. **Negotiate the academic agreement.** Every figure here is public pay-as-you-go list price. Universities buying through an Enterprise Agreement or CSP partner do not pay list. Ask your Microsoft account team for the EDU rate card before presenting any of these numbers as final.

5. **Size to the academic calendar.** Teaching runs roughly eight months of twelve. Container Apps genuinely bills nothing when scaled to zero (outside VNet-enabled environments), and databases can be scaled down between terms. Realistic annual figures are approximately **25–30% below** the twelve-month multiples quoted above.

6. **Choose the database engine on scale, not habit.** At pilot scale PostgreSQL B1ms (R258) beats Azure SQL S0 (R354). At faculty scale the Azure SQL DTU tiers are more predictable and easier to budget. Do not default to serverless SQL — at $0.522/vCore-hour it costs 3.4× provisioned vCore and only wins below roughly a 30% duty cycle.

7. **Use Dev/Test subscriptions for non-production.** A staging environment otherwise roughly doubles Scenarios 1 and 2. Dev/Test rates plus nightly teardown reduce that to a rounding error.

8. **Do not pay for identity.** With 50,000 free monthly active users in Entra External ID — or R0 if learners use existing university accounts — there is no reason for the identity line to be non-zero at this scale.

---

## 6. What these figures exclude

| Excluded | Note |
|---|---|
| Development and maintenance effort | The portal described here does not exist yet. Build cost is staff time, not infrastructure. |
| Microsoft support plans | Basic support is included; Developer, Standard and Professional Direct tiers are priced separately. Confirm current rates with your Microsoft account team. |
| Domain registration and DNS | Nominal — SSL certificates are included free with Static Web Apps. |
| Security review, penetration testing, POPIA assessment | Required before handling student records, but not an Azure line item. |
| Disaster-recovery replica in South Africa West | A warm standby roughly adds the database and API lines again. |
| Data egress to non-Azure destinations at volume | Modelled conservatively above; verify against real telemetry after the first term. |
| Third-party CDN assets | Blockly, Monaco and the GlowScript runtime load from public CDNs directly to the student's browser and consume no Azure bandwidth. |

---

## 7. The alternative worth stating explicitly

The project's existing technical documentation proposes deployment on **ilifu** (the IDIA/UWC research computing facility) using OpenStack virtual machines. An `ilifu-A` instance (1 vCPU, 4 GB RAM, 20 GB disk) running Nginx is sufficient for the current static release; `ilifu-B` or `ilifu-C` (2 vCPU, 8–16 GB RAM) is the recommended starting point for the managed platform.

Under a research allocation, that infrastructure carries **no direct cost to the department**. The Azure figures in this document are therefore best read as the cost of choosing a commercial cloud over the institutional facility — and the case for doing so has to rest on operational grounds (managed backup, SLA, patching, identity integration, no VM administration burden), not on price.

A reasonable middle path: keep the static application where it is at zero cost, and only move to a managed platform when a concrete teaching requirement — teacher dashboards, roster management, submission tracking — actually forces it.

---

## 8. Sources and verification

- All unit prices retrieved from the **Azure Retail Prices API** (`https://prices.azure.com/api/retail/prices`) on 29 July 2026, filtered to `armRegionName eq 'southafricanorth'`, `priceType eq 'Consumption'`, in both USD and ZAR.
- Free-tier grants, quotas and service limits verified against Microsoft Learn documentation.
- Note that the public pricing pages on `azure.microsoft.com` render prices client-side and are unreliable for programmatic extraction; the Retail Prices API is the authoritative machine-readable source and is what was used here.
- Prices change. Re-run the same queries before submitting any figure in a funding application or procurement document.
