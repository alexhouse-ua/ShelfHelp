-- Seed data for lookup tables (Story 1.2)

-- Insert initial genres
INSERT INTO genres (name) VALUES
('Fantasy'),
('Science Fiction'),
('Mystery & Crime'),
('Thriller & Suspense'),
('Horror'),
('Romance'),
('Contemporary Fiction'),
('Historical Fiction'),
('Literary Fiction'),
('Young Adult');

-- Insert spice levels (need explicit IDs for referential integrity in existing code)
INSERT INTO spice_levels (id, label, description) VALUES
(1, '🌶️ Glimpses and kisses', 'Meaningful glances and perhaps a kiss, but no sex on and off page.'),
(2, '🌶️🌶️ Behind closed doors', 'At least one intimate scene occurs, but without the reader present.'),
(3, '🌶️🌶️🌶️ Open door', 'At least one intimate scene with the reader present, euphemistic language for act and body parts.'),
(4, '🌶️🌶️🌶️🌶️ Explicit open door', 'At least two intimate scenes, explicit language with a variety of sexual acts.'),
(5, '🌶️🌶️🌶️🌶️🌶️ Explicit and plentiful', 'Several explicit scenes, a variety of adventurous acts, dotted throughout the book.');

-- Sync sequence for spice_levels after manual ID insertion
SELECT setval('spice_levels_id_seq', (SELECT MAX(id) FROM spice_levels));

-- Insert sample subgenres for Fantasy (using genre lookup)
INSERT INTO subgenres (genre_id, name) VALUES
((SELECT id FROM genres WHERE name = 'Fantasy'), 'Epic Fantasy'),
((SELECT id FROM genres WHERE name = 'Fantasy'), 'Urban Fantasy'),
((SELECT id FROM genres WHERE name = 'Fantasy'), 'Dark Fantasy'),
((SELECT id FROM genres WHERE name = 'Fantasy'), 'High Fantasy');

-- Insert sample tropes for Romance (using genre lookup)
INSERT INTO tropes (genre_id, name) VALUES
((SELECT id FROM genres WHERE name = 'Romance'), 'Enemies to Lovers'),
((SELECT id FROM genres WHERE name = 'Romance'), 'Forced Proximity'),
((SELECT id FROM genres WHERE name = 'Romance'), 'Second Chance Romance'),
((SELECT id FROM genres WHERE name = 'Romance'), 'Fake Relationship');

-- Insert sample recommendation sources
INSERT INTO recommendation_sources (name, url, scope, categories, priority) VALUES
('BookTok', 'https://www.tiktok.com', 'global', ARRAY['fiction', 'romance', 'fantasy'], 1),
('Goodreads', 'https://www.goodreads.com', 'global', ARRAY['all'], 2),
('NPR Books', 'https://www.npr.org/books', 'global', ARRAY['literary', 'nonfiction'], 3);