-- PR1: Create activity_entity_type ENUM
-- This enum defines the types of entities that can have activities

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_entity_type') THEN
    CREATE TYPE activity_entity_type AS ENUM ('job','contact');
  END IF;
END$;