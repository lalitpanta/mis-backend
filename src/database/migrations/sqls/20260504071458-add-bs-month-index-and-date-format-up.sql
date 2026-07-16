ALTER TABLE "month_class_data" ADD COLUMN IF NOT EXISTS bs_month_index INTEGER;
ALTER TABLE "month_class_data" ADD COLUMN IF NOT EXISTS date_format VARCHAR(10) DEFAULT 'BS';