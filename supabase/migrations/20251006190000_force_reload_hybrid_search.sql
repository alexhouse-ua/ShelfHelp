-- Force reload of hybrid_search_books function to fix ambiguous column error
-- Run this directly in Supabase SQL Editor if schema reload didn't work

-- Drop existing function first
DROP FUNCTION IF EXISTS hybrid_search_books(VECTOR(768), TEXT, FLOAT, INT);

-- Recreate with explicit table qualifications
CREATE OR REPLACE FUNCTION hybrid_search_books(
  query_embedding VECTOR(768),
  query_text TEXT,
  match_threshold FLOAT DEFAULT 0.7,
  limit_count INT DEFAULT 10
)
RETURNS TABLE (
  book_id UUID,
  title TEXT,
  author TEXT,
  ai_summary TEXT,
  similarity_score FLOAT,
  keyword_rank FLOAT,
  combined_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT
      b.id,
      b.title,
      b.author,
      b.ai_summary,
      -- Cosine similarity: 1 - cosine distance
      (1 - (b.embedding <=> query_embedding)) AS similarity
    FROM books b
    WHERE
      b.status = 'to_read'
      AND b.embedding IS NOT NULL
      AND (1 - (b.embedding <=> query_embedding)) > match_threshold
  ),
  keyword_search AS (
    SELECT
      k.id,
      -- Full-text search rank across title, summary, genres, themes
      ts_rank(
        to_tsvector('english',
          k.title || ' ' ||
          COALESCE(k.ai_summary, '') || ' ' ||
          array_to_string(COALESCE(k.genres_primary, ARRAY[]::TEXT[]), ' ') || ' ' ||
          array_to_string(COALESCE(k.themes, ARRAY[]::TEXT[]), ' ') || ' ' ||
          COALESCE(k.tone, '')
        ),
        plainto_tsquery('english', query_text)
      ) AS kw_rank
    FROM books k
    WHERE k.status = 'to_read'
  )
  SELECT
    vs.id AS book_id,
    vs.title,
    vs.author,
    vs.ai_summary,
    vs.similarity AS similarity_score,
    COALESCE(ks.kw_rank, 0.0) AS keyword_rank,
    -- Weighted combination: 70% vector, 30% keyword
    (vs.similarity * 0.7 + COALESCE(ks.kw_rank, 0.0) * 0.3) AS combined_score
  FROM vector_search vs
  LEFT JOIN keyword_search ks ON vs.id = ks.id
  ORDER BY combined_score DESC
  LIMIT limit_count;
END;
$$;

COMMENT ON FUNCTION hybrid_search_books IS
'Story 2.2: Hybrid search combining vector similarity (70%) and keyword matching (30%) for mood-based book recommendations. Filters books with status=to_read.';

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
