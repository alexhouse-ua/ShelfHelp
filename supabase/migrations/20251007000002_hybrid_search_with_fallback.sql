-- Enhance hybrid_search_books to include books without embeddings using keyword-only search
-- Books with embeddings get hybrid scoring, books without get keyword-only scoring

DROP FUNCTION IF EXISTS hybrid_search_books(VECTOR(768), TEXT, FLOAT, INT) CASCADE;

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
    -- Books WITH embeddings: use vector similarity
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
    -- Keyword search for ALL to_read books (with or without embeddings)
    SELECT
      k.id,
      ts_rank(
        to_tsvector('english',
          k.title || ' ' ||
          COALESCE(k.ai_summary, '') || ' ' ||
          COALESCE(k.author, '') || ' ' ||
          array_to_string(COALESCE(k.genres_primary, ARRAY[]::TEXT[]), ' ') || ' ' ||
          array_to_string(COALESCE(k.themes, ARRAY[]::TEXT[]), ' ') || ' ' ||
          COALESCE(k.tone, '')
        ),
        plainto_tsquery('english', query_text)
      )::DOUBLE PRECISION AS kw_rank
    FROM books k
    WHERE k.status = 'to_read'
  ),
  combined_results AS (
    -- Books with embeddings: hybrid score
    SELECT
      vs.id,
      vs.title,
      vs.author,
      vs.ai_summary,
      vs.similarity,
      COALESCE(ks.kw_rank, 0.0) AS kw_rank,
      (vs.similarity * 0.7 + COALESCE(ks.kw_rank, 0.0) * 0.3)::DOUBLE PRECISION AS score
    FROM vector_search vs
    LEFT JOIN keyword_search ks ON vs.id = ks.id

    UNION ALL

    -- Books WITHOUT embeddings: keyword-only score
    SELECT
      b.id,
      b.title,
      b.author,
      b.ai_summary,
      0.0 AS similarity,
      COALESCE(ks.kw_rank, 0.0) AS kw_rank,
      COALESCE(ks.kw_rank, 0.0)::DOUBLE PRECISION AS score
    FROM books b
    LEFT JOIN keyword_search ks ON b.id = ks.id
    WHERE
      b.status = 'to_read'
      AND b.embedding IS NULL
      AND COALESCE(ks.kw_rank, 0.0) > 0  -- Only include if keyword matched
  )
  SELECT
    cr.id,
    cr.title,
    cr.author,
    cr.ai_summary,
    cr.similarity,
    cr.kw_rank,
    cr.score
  FROM combined_results cr
  ORDER BY cr.score DESC
  LIMIT limit_count;
END;
$$;

COMMENT ON FUNCTION hybrid_search_books IS
'Story 2.2: Hybrid search with fallback. Books with embeddings get hybrid scoring (70% vector + 30% keyword). Books without embeddings get keyword-only scoring.';

-- Force schema reload
NOTIFY pgrst, 'reload schema';
