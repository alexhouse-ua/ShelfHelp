-- Story 2.2: Hybrid Search Function for Mood-Based Recommendations
-- Creates a PostgreSQL function that performs hybrid search combining:
-- 1. Vector similarity search (semantic matching)
-- 2. Full-text keyword search (explicit genre/topic matching)
-- Weighted 70/30 (vector/keyword) ranking

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
      id,
      title,
      author,
      ai_summary,
      -- Cosine similarity: 1 - cosine distance
      (1 - (embedding <=> query_embedding)) AS similarity
    FROM books
    WHERE
      status = 'to_read'
      AND embedding IS NOT NULL
      AND (1 - (embedding <=> query_embedding)) > match_threshold
  ),
  keyword_search AS (
    SELECT
      id,
      -- Full-text search rank across title, summary, genres, themes
      ts_rank(
        to_tsvector('english',
          books.title || ' ' ||
          COALESCE(books.ai_summary, '') || ' ' ||
          array_to_string(COALESCE(books.genres_primary, ARRAY[]::TEXT[]), ' ') || ' ' ||
          array_to_string(COALESCE(books.themes, ARRAY[]::TEXT[]), ' ') || ' ' ||
          COALESCE(books.tone, '')
        ),
        plainto_tsquery('english', query_text)
      ) AS kw_rank
    FROM books
    WHERE books.status = 'to_read'
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

-- Add comment for documentation
COMMENT ON FUNCTION hybrid_search_books IS
'Story 2.2: Hybrid search combining vector similarity (70%) and keyword matching (30%) for mood-based book recommendations. Filters books with status=to_read.';
