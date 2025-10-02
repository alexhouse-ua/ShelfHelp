// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { createLogger, generateRequestId } from "../_shared/logger.ts";
import { badRequest, internalError, notFound } from "../_shared/error-handler.ts";

/**
 * Book enrichment data structure
 */
interface BookEnrichmentData {
  genres_primary: string[];
  genres_secondary: string[];
  tropes: string[];
  themes: string[];
  pacing: string;
  tone: string;
  writing_style: string;
  pov_type: string;
  pov_gender: string;
  spice_level: string;
}

/**
 * Retry helper for API calls with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  logger: ReturnType<typeof createLogger>,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.error(`Attempt ${attempt} failed`, { error: lastError.message });

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        logger.info(`Retrying in ${backoffMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}

/**
 * Enrich book metadata using Gemini 1.5 Pro API
 */
async function enrichBookMetadata(
  title: string,
  author: string,
  geminiApiKey: string,
  logger: ReturnType<typeof createLogger>,
): Promise<BookEnrichmentData> {
  const GEMINI_MODEL = "gemini-1.5-pro";
  const GEMINI_API_URL =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const prompt =
    `Analyze the book "${title}" by ${author}. Return a JSON object with the following fields:
{
  "genres_primary": ["genre1", "genre2"],
  "genres_secondary": ["genre3", "genre4"],
  "tropes": ["trope1", "trope2", "trope3"],
  "themes": ["theme1", "theme2", "theme3"],
  "pacing": "slow/medium/fast",
  "tone": "light/dark/mixed",
  "writing_style": "descriptive/minimalist/lyrical/etc",
  "pov_type": "first-person/third-person-limited/third-person-omniscient/etc",
  "pov_gender": "male/female/multiple/neutral/unknown",
  "spice_level": "none/low/medium/high"
}

Return ONLY valid JSON with no additional text or markdown.`;

  const fetchEnrichment = async (): Promise<BookEnrichmentData> => {
    const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded");
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("No response from Gemini");
    }

    const textContent = data.candidates[0].content.parts[0].text;

    // Parse JSON response
    const cleanedText = textContent
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const enrichmentData = JSON.parse(cleanedText) as BookEnrichmentData;

    // Validate required fields
    if (
      !Array.isArray(enrichmentData.genres_primary) ||
      !Array.isArray(enrichmentData.genres_secondary) ||
      !Array.isArray(enrichmentData.tropes) ||
      !Array.isArray(enrichmentData.themes)
    ) {
      throw new Error("Invalid enrichment data structure");
    }

    return enrichmentData;
  };

  // Retry with exponential backoff
  return await retryWithBackoff(fetchEnrichment, 3, logger);
}

/**
 * Main handler
 */
Deno.serve(async (req: Request) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);
  logger.info("Enrich metadata function invoked");

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GOOGLE_GEMINI_API_KEY not configured");
    }

    // Parse request body
    const { book_id } = await req.json();

    if (!book_id) {
      return badRequest("book_id is required", requestId);
    }

    logger.info("Fetching book data", { book_id });

    // Fetch book data
    const { data: book, error: fetchError } = await supabase
      .from("books")
      .select("id, title, author, goodreads_id")
      .eq("id", book_id)
      .single();

    if (fetchError || !book) {
      logger.error("Book not found", { book_id, error: fetchError });
      return notFound("Book not found", requestId);
    }

    logger.info("Enriching book metadata", {
      book_id,
      title: book.title,
      author: book.author,
    });

    // Enrich metadata
    const enrichmentData = await enrichBookMetadata(book.title, book.author, geminiApiKey, logger);

    logger.info("Updating book with enrichment data", { book_id });

    // Update book with enrichment data
    const { error: updateError } = await supabase
      .from("books")
      .update({
        genres_primary: enrichmentData.genres_primary,
        genres_secondary: enrichmentData.genres_secondary,
        tropes: enrichmentData.tropes,
        themes: enrichmentData.themes,
        pacing: enrichmentData.pacing,
        tone: enrichmentData.tone,
        writing_style: enrichmentData.writing_style,
        pov_type: enrichmentData.pov_type,
        pov_gender: enrichmentData.pov_gender,
        spice_level: enrichmentData.spice_level,
        status: "enriched",
      })
      .eq("id", book_id);

    if (updateError) {
      logger.error("Failed to update book", { book_id, error: updateError });
      throw new Error(`Failed to update book: ${updateError.message}`);
    }

    logger.info("Book enrichment completed successfully", { book_id });

    return new Response(
      JSON.stringify({
        success: true,
        book_id,
        enrichmentData,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    logger.error("Enrich metadata failed", { error: String(error) });
    return internalError(error instanceof Error ? error.message : String(error), requestId);
  }
});
