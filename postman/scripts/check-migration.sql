-- Check address table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'core' AND table_name = 'address'
AND column_name IN ('state_id', 'country_id', 'state_code')
ORDER BY ordinal_position;

-- Check license table columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'core' AND table_name = 'license'
AND column_name IN ('state_id', 'country_id', 'state_code')
ORDER BY ordinal_position;

-- Check if country_program table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'core' AND table_name = 'country_program';

-- Check if state_program table still exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'core' AND table_name = 'state_program';

-- Check unique constraint on state table
SELECT constraint_name, column_name
FROM information_schema.constraint_column_usage
WHERE table_schema = 'core'
AND table_name = 'state'
AND constraint_name = 'uk_state_country_code';