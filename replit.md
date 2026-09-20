# Sistem Manajemen Mutu QA/QC Konstruksi

Aplikasi web dan video pengenalan untuk pengendalian mutu konstruksi berbasis alur QA/QC dan jenjang kompetensi SKKNI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/qa-qc-konstruksi/` — website aplikasi QA/QC utama pada route root.
- `artifacts/qa-qc-konstruksi/src/lib/store.tsx` — data contoh dan persistence localStorage.
- `artifacts/qa-qc-konstruksi/src/pages/` — dashboard, rencana mutu, inspeksi, NCR/CAPA, dokumen, dan laporan.
- `artifacts/qa-qc-konstruksi-video/` — video animasi 90 detik.
- `artifacts/qa-qc-konstruksi-video/src/components/video/VideoTemplate.tsx` — urutan, durasi, audio, dan komposisi utama.
- `artifacts/qa-qc-konstruksi-video/src/components/video/video_scenes/Scenes.tsx` — sepuluh scene video.
- `artifacts/qa-qc-konstruksi-video/src/index.css` — token warna, tipografi, dan lapisan visual.

## Architecture decisions

- Website MVP menggunakan persistence localStorage agar seluruh CRUD langsung berfungsi tanpa ketergantungan backend.
- Rasio video dikunci 16:9 untuk presentasi, YouTube, dan web.
- Durasi total 90 detik dibagi ke sepuluh scene dengan musik instrumental yang tersinkron.
- Kontrol preview hanya muncul dalam iframe Replit; hasil ekspor tetap bersih tanpa kontrol.

## Product

Website mendukung dashboard mutu, RMK/ITP, MIR/WIR, checklist inspeksi, bukti lapangan, NCR/CAPA, dokumen terkendali, audit, dan laporan. Video menjelaskan nilai serta alur produk tersebut.

## User preferences

- Gunakan bahasa Indonesia.
- Durasi video 90 detik dengan rasio 16:9.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
