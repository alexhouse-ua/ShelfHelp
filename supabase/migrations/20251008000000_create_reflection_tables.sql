-- Migration: Extend existing tables for reflection workflow
-- Story: 2.3 Post-Read Reflection
-- Task 0: Create database schema migrations for reflection workflow

-- Note: book_events, reflections, and conversational_state tables already exist
-- from initial_schema.sql. We only need to extend them for reflection workflow.

-- 1. Extend book_events.event_type CHECK constraint to include reflection events
-- Drop old constraint and recreate with new values
ALTER TABLE book_events DROP CONSTRAINT IF EXISTS book_events_event_type_check;
ALTER TABLE book_events ADD CONSTRAINT book_events_event_type_check
    CHECK (event_type IN ('added', 'enriched', 'queued', 'started', 'finished', 'rated', 'reflected', 'reflection_requested', 'reflection_completed', 'reflection_deferred'));

-- 2. Extend reflections table for Story 2.3 reflection workflow
-- Add user_reflection column (TEXT) to store concatenated reflection responses
-- Add ai_analysis column (JSONB) for Story 2.4 AI analysis (NULL for now)
ALTER TABLE reflections
    ADD COLUMN IF NOT EXISTS user_reflection TEXT,
    ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

-- 3. Extend conversational_state table for reflection workflow state persistence
-- Add expires_at for state timeout management
-- Change last_book_id from UUID reference to TEXT for flexibility
ALTER TABLE conversational_state
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Already has last_book_id as UUID REFERENCES books(id) - leave as-is for now
-- We can use state_data JSONB for reflection-specific data

-- Create index for cleanup of expired states
CREATE INDEX IF NOT EXISTS idx_conversational_state_expires ON conversational_state(expires_at);
