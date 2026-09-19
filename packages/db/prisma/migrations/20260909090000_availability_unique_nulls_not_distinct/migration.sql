-- DoctorAvailability: make the unique constraint actually constrain.
--
-- `@@unique([doctorId, dayOfWeek, startTime, effectiveFrom])` has never applied to a single
-- row. `effectiveFrom` is nullable and means "always"; every row in the database has it
-- null, and Postgres treats NULLs as DISTINCT in a unique index. Two identical always-rows
-- were therefore not duplicates as far as the index was concerned.
--
-- Two things followed. The seed used createMany({ skipDuplicates: true }) and believed
-- itself idempotent, so every run appended another six windows — the dev clinic reached 27
-- identical windows per weekday and the availability screen rendered as a wall of chips.
-- And the application has the same hole: POST /doctors/:id/availability calls create() with
-- no guard, so tapping Add twice makes a doctor doubly available to the booking engine.
--
-- Postgres 15 added NULLS NOT DISTINCT, which says exactly what was meant. Prisma cannot
-- express it in schema.prisma, so this is hand-written and the model carries a note.

-- 1. Collapse existing duplicates, keeping the earliest row of each group.
--    IS NOT DISTINCT FROM matches nulls to each other, which is the whole point.
DELETE FROM "DoctorAvailability" a
USING "DoctorAvailability" b
WHERE a."doctorId" = b."doctorId"
  AND a."dayOfWeek" = b."dayOfWeek"
  AND a."startTime" = b."startTime"
  AND a."effectiveFrom" IS NOT DISTINCT FROM b."effectiveFrom"
  AND a.ctid > b.ctid;

-- 2. Replace the index with one that counts null effectiveFrom values as equal.
DROP INDEX IF EXISTS "DoctorAvailability_doctorId_dayOfWeek_startTime_effectiveFrom_key";

CREATE UNIQUE INDEX "DoctorAvailability_doctorId_dayOfWeek_startTime_effectiveFrom_key"
  ON "DoctorAvailability" ("doctorId", "dayOfWeek", "startTime", "effectiveFrom")
  NULLS NOT DISTINCT;
