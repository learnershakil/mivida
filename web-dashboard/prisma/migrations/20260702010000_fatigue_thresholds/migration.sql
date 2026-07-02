-- Insights group: flat fatigue thresholds mirroring the device `settings` columns 1:1 so the sync
-- mapper carries them through. Additive + nullable — safe/reversible.
ALTER TABLE "Setting" ADD COLUMN "fatigueScreenTimeThresholdHours" DOUBLE PRECISION;
ALTER TABLE "Setting" ADD COLUMN "fatigueStepsThreshold" INTEGER;
