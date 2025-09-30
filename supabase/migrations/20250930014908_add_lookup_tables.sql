-- Lookup Tables Migration for Story 1.2
-- Creates tables for genres, subgenres, tropes, spice_levels, and recommendation_sources

-- Genres table: Primary genre categories
CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- Subgenres table: Genre-specific subcategories
CREATE TABLE subgenres (
    id SERIAL PRIMARY KEY,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE (genre_id, name)
);

-- Tropes table: Genre-specific narrative tropes
CREATE TABLE tropes (
    id SERIAL PRIMARY KEY,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE (genre_id, name)
);

-- Spice Levels table: Romance content intensity ratings
CREATE TABLE spice_levels (
    id SERIAL PRIMARY KEY,
    label TEXT UNIQUE NOT NULL,
    description TEXT
);

-- Recommendation Sources table: External book recommendation sources
CREATE TABLE recommendation_sources (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    url TEXT,
    scope TEXT,
    categories TEXT[],
    priority INTEGER
);

-- Indexes for foreign keys and performance
CREATE INDEX idx_subgenres_genre_id ON subgenres(genre_id);
CREATE INDEX idx_tropes_genre_id ON tropes(genre_id);
CREATE INDEX idx_recommendation_sources_priority ON recommendation_sources(priority);