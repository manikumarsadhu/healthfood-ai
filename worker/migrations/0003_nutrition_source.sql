ALTER TABLE foods
ADD COLUMN fdc_id TEXT;

CREATE INDEX idx_foods_fdc_id
ON foods(fdc_id);