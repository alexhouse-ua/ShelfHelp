-- Final fix for hybrid_search_books function
-- Completely drop and recreate to ensure clean state

-- Drop any existing versions
DROP FUNCTION IF EXISTS hybrid_search_books(VECTOR(768), TEXT, FLOAT, INT) CASCADE;

-- Recreate with correct structure
CREATE FUNCTION hybrid_search_books(
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
  similarity_score DOUBLE PRECISION,
  keyword_rank DOUBLE PRECISION,
  combined_score DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH vector_search AS (
    SELECT
      b.id,
      b.title,
      b.author,
      b.ai_summary,
      (1 - (b.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity
    FROM books b
    WHERE
      b.status = 'to_read'
      AND b.embedding IS NOT NULL
      AND (1 - (b.embedding <=> query_embedding)) > match_threshold
  ),
  keyword_search AS (
    SELECT
      k.id,
      ts_rank(
        to_tsvector('english',
          k.title || ' ' ||
          COALESCE(k.ai_summary, '') || ' ' ||
          array_to_string(COALESCE(k.genres_primary, ARRAY[]::TEXT[]), ' ') || ' ' ||
          array_to_string(COALESCE(k.themes, ARRAY[]::TEXT[]), ' ') || ' ' ||
          COALESCE(k.tone, '')
        ),
        plainto_tsquery('english', query_text)
      )::DOUBLE PRECISION AS kw_rank
    FROM books k
    WHERE k.status = 'to_read'
  )
  SELECT
    vs.id,
    vs.title,
    vs.author,
    vs.ai_summary,
    vs.similarity,
    COALESCE(ks.kw_rank, 0.0),
    (vs.similarity * 0.7 + COALESCE(ks.kw_rank, 0.0) * 0.3)::DOUBLE PRECISION
  FROM vector_search vs
  LEFT JOIN keyword_search ks ON vs.id = ks.id
  ORDER BY (vs.similarity * 0.7 + COALESCE(ks.kw_rank, 0.0) * 0.3) DESC
  LIMIT limit_count;
END;
$$;

COMMENT ON FUNCTION hybrid_search_books IS
'Story 2.2: Hybrid search combining vector similarity (70%) and keyword matching (30%) for mood-based book recommendations.';

-- Force schema reload
NOTIFY pgrst, 'reload schema';
