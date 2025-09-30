-- Seed data for lookup tables (Story 1.2)

-- Insert initial genres
INSERT INTO genres (id, name) VALUES
(1, 'Fantasy'),
(2, 'Science Fiction'),
(3, 'Mystery & Crime'),
(4, 'Thriller & Suspense'),
(5, 'Horror'),
(6, 'Romance'),
(7, 'Contemporary Fiction'),
(8, 'Historical Fiction'),
(9, 'Literary Fiction'),
(10, 'Young Adult');

-- Insert spice levels
INSERT INTO spice_levels (id, label, description) VALUES
(1, '🌶️ Glimpses and kisses', 'Meaningful glances and perhaps a kiss, but no sex on and off page.'),
(2, '🌶️🌶️ Behind closed doors', 'At least one intimate scene occurs, but without the reader present.'),
(3, '🌶️🌶️🌶️ Open door', 'At least one intimate scene with the reader present, euphemistic language for act and body parts.'),
(4, '🌶️🌶️🌶️🌶️ Explicit open door', 'At least two intimate scenes, explicit language with a variety of sexual acts.'),
(5, '🌶️🌶️🌶️🌶️🌶️ Explicit and plentiful', 'Several explicit scenes, a variety of adventurous acts, dotted throughout the book.');

-- Insert sample subgenres for Fantasy
INSERT INTO subgenres (genre_id, name) VALUES
(1, 'Epic Fantasy'),
(1, 'Urban Fantasy'),
(1, 'Dark Fantasy'),
(1, 'High Fantasy');

-- Insert sample tropes for Romance
INSERT INTO tropes (genre_id, name) VALUES
(6, 'Enemies to Lovers'),
(6, 'Forced Proximity'),
(6, 'Second Chance Romance'),
(6, 'Fake Relationship');

-- Insert sample recommendation sources
INSERT INTO recommendation_sources (name, url, scope, categories, priority) VALUES
('BookTok', 'https://www.tiktok.com', 'global', ARRAY['fiction', 'romance', 'fantasy'], 1),
('Goodreads', 'https://www.goodreads.com', 'global', ARRAY['all'], 2),
('NPR Books', 'https://www.npr.org/books', 'global', ARRAY['literary', 'nonfiction'], 3);