GLP-1 Companion v5.6.1 — Corrective Compliance Patch

UPLOAD METHOD: CLEAN / LIMPIAR PRIMERO

The exact v5.6.0 FINAL source contains obsolete internal/report files that are intentionally excluded from the v5.6.1 source ZIP. An overlay would leave those files behind. Clean the repository code files first, while keeping the repository, Pages settings and Git history.

1) Keep the repository itself, Pages settings and history, but remove the current code files from main.
2) Extract this ZIP and upload all of its contents to the repository root.
3) Replace .github/workflows/deploy.yml manually with the separately supplied deploy_v5.6.1_FINAL_QA.yml because .github can be hidden on Windows.
4) Commit to main.
5) Wait for both the build and deploy jobs to turn green before considering v5.6.1 deployed.

The workflow generates public/runtime/*.js and public/sw.js from TypeScript during CI. Those generated files must not be added to the source repository.

WHAT v5.6.1 CORRECTS
- Water, Protein and Target Weight use the same stored settings as the existing Settings area; Activity Minutes remains the single v5.6 activity field.
- Goal inputs support explicit clearing and reject invalid or obviously accidental values without silently clamping them.
- Daily Water, Protein and Activity cards show current value, goal, percentage, remaining amount and reached/pending state.
- Weekly comparison displays the exact current and previous seven-day ranges, coverage, missing days, goal-achieved days, adherence, absolute difference, percentage change when mathematically valid, direction and limitations.
- Weight comparison uses the latest weight inside each exact seven-day period. Symptom comparison counts only explicitly saved symptom days.
- Explain My Progress receives the complete deterministic calculation context and retains the existing bilingual Smart Cache and AI History behavior.
- A real non-recoverable Primary AI failure is counted as a Primary attempt before the generation is marked failed.
- Representative v5.5.0 and v5.6.0 backup restores preserve goals, activity, AI History, telemetry and unrelated records.
- The PK curve has persistent sparse point markers, a distinct current point and click/tap selection without changing PK calculations.
- Maintenance Mode now explains exactly what it evaluates and what it does not change.

TECHNICAL
App: v5.6.1
Schema: 16
Minimum supported client: v5.5.0
Service worker: v5.6.1-pwa
Runtime architecture: proven 10-module layout generated from src/runtime/*.ts.
Smart Cache fingerprint remains v5.3.0-cache1 for compatibility with existing saved reports.

VALIDATION SCOPE
- Desktop and narrow/mobile viewport browser checks were performed locally.
- The mobile check used viewport simulation; it was not a physical iPhone test.
- Backup compatibility was tested with constructed representative fixtures, not a real user backup.
