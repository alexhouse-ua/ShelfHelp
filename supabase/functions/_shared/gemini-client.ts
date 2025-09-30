/**
 * Google Gemini Flash API client for intent parsing and entity extraction
 * @module gemini-client
 */

const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-1.5-flash";
const GEMINI_API_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface BookExtractionResult {
  title: string;
  author: string;
  confidence: "high" | "medium" | "low";
}

export interface GeminiError {
  error: string;
  code?: string;
}

/**
 * Parse a user's message to identify a book title, author, and confidence using the Google Gemini Flash API.
 *
 * @param userInput - The raw user-provided text that may contain book information
 * @returns A `BookExtractionResult` with `title`, `author`, and `confidence` on success, or a `GeminiError` containing an `error` message and optional `code` on failure
 */
export async function extractBookInfo(
  userInput: string,
): Promise<BookExtractionResult | GeminiError> {
  if (!GEMINI_API_KEY) {
    return { error: "GOOGLE_GEMINI_API_KEY not configured", code: "CONFIG_ERROR" };
  }

  if (!userInput || userInput.trim().length === 0) {
    return { error: "Empty input provided", code: "INVALID_INPUT" };
  }

  const prompt = buildExtractionPrompt(userInput);

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
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
          temperature: 0.1,
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error:", errorData);

      if (response.status === 429) {
        return { error: "Rate limit exceeded", code: "RATE_LIMIT" };
      }

      return {
        error: `Gemini API error: ${response.status}`,
        code: "API_ERROR",
      };
    }

    const data = await response.json();

    if (!data.candidates || data.candidates.length === 0) {
      return { error: "No response from Gemini", code: "NO_RESPONSE" };
    }

    const textContent = data.candidates[0].content.parts[0].text;
    return parseExtractionResponse(textContent);
  } catch (error) {
    console.error("Gemini client error:", error);

    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        return { error: "Request timeout", code: "TIMEOUT" };
      }
    }

    return {
      error: "Failed to connect to Gemini API",
      code: "NETWORK_ERROR",
    };
  }
}

/**
 * Create a prompt instructing Gemini to extract a book's title, author, and confidence as a strict JSON object.
 *
 * The returned prompt asks the model to produce only a valid JSON object with fields `"title"`, `"author"`, and `"confidence"` (one of `"high"`, `"medium"`, `"low"`), and to return an explicit empty result `{"title": "", "author": "", "confidence": "low"}` when no book information is present.
 *
 * @param userInput - The user message to embed in the prompt for extraction
 * @returns A string prompt that requests only valid JSON containing `title`, `author`, and `confidence` based on the provided `userInput`
 */
function buildExtractionPrompt(userInput: string): string {
  return `Extract the book title and author from the following user message. Return ONLY a JSON object with "title", "author", and "confidence" fields. The confidence should be "high", "medium", or "low" based on how clearly the book information is stated.

If the user message doesn't contain book information, return: {"title": "", "author": "", "confidence": "low"}

User message: "${userInput}"

Return only valid JSON, no other text.`;
}

/**
 * Parse Gemini's JSON output into a validated book extraction result.
 *
 * @param textContent - Raw text returned by Gemini; may contain a JSON object or be wrapped in Markdown code fences (e.g., ```json ... ```).
 * @returns A `BookExtractionResult` with trimmed `title` and `author` and `confidence` set to `"high" | "medium" | "low"` on success, or a `GeminiError` with `code: "PARSE_ERROR"` and an explanatory `error` message on failure.
 */
function parseExtractionResponse(textContent: string): BookExtractionResult | GeminiError {
  try {
    // Remove markdown code fences if present
    const cleanedText = textContent
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleanedText);

    // Validate required fields
    if (typeof parsed.title !== "string" || typeof parsed.author !== "string") {
      return { error: "Invalid response format from Gemini", code: "PARSE_ERROR" };
    }

    // Validate confidence level
    const confidence = parsed.confidence || "medium";
    if (!["high", "medium", "low"].includes(confidence)) {
      return { error: "Invalid confidence level", code: "PARSE_ERROR" };
    }

    return {
      title: parsed.title.trim(),
      author: parsed.author.trim(),
      confidence: confidence as "high" | "medium" | "low",
    };
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return { error: "Failed to parse response", code: "PARSE_ERROR" };
  }
}
