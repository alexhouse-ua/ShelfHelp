/**
 * Google Gemini Flash API client for intent parsing and entity extraction
 * @module gemini-client
 */

const GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-2.5-flash";
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
 * Extract book title and author from natural language input using Gemini Flash
 * @param userInput - Raw natural language text from user
 * @returns Extracted book data or error
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
 * Build prompt for book information extraction
 */
function buildExtractionPrompt(userInput: string): string {
  return `Extract the book title and author from the following user message. Return ONLY a JSON object with "title", "author", and "confidence" fields. The confidence should be "high", "medium", or "low" based on how clearly the book information is stated.

If the user message doesn't contain book information, return: {"title": "", "author": "", "confidence": "low"}

User message: "${userInput}"

Return only valid JSON, no other text.`;
}

/**
 * Parse Gemini's JSON response into BookExtractionResult
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
