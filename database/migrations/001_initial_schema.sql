-- Migration: 001_initial_schema.sql
-- Description: Initial PostgreSQL DDL Schema for THEIAKSHI ENTERPRISE HRMS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Include base schema definition
\i database/schema.sql
