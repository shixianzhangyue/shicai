-- Add headcount (招聘人数) column to jobs table
ALTER TABLE jobs ADD COLUMN headcount INTEGER DEFAULT 1;
