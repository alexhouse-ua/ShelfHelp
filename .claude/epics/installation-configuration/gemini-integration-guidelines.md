# Gemini API Integration Guidelines

## Overview
This document provides specific implementation patterns and best practices for integrating Google's Gemini API into the Shelf Help Assistant for book recommendations and natural language processing.

## Core Integration Patterns

### 1. API Client Setup

```typescript
// src/services/gemini-client.ts
export class GeminiClient {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    this.apiKey = Deno.env.get('GOOGLE_AI_API_KEY')!;
    if (!this.apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is required');
    }
  }

  async generateContent(prompt: string, options?: GenerationOptions): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          safetySettings: this.getDefaultSafetySettings(),
          generationConfig: options?.config
        })
      }
    );

    if (!response.ok) {
      throw new GeminiAPIError(await response.json());
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private getDefaultSafetySettings() {
    return [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
    ];
  }
}
```

### 2. Book Recommendation Service

```typescript
// src/services/recommendation-service.ts
export class BookRecommendationService {
  constructor(private geminiClient: GeminiClient) {}

  async getPersonalizedRecommendations(userProfile: UserProfile): Promise<BookRecommendation[]> {
    const prompt = this.buildRecommendationPrompt(userProfile);

    try {
      const response = await this.geminiClient.generateContent(prompt, {
        config: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      });

      return this.parseRecommendationResponse(response);
    } catch (error) {
      if (error instanceof GeminiAPIError && error.isRateLimit()) {
        // Implement exponential backoff
        await this.backoffAndRetry();
        return this.getPersonalizedRecommendations(userProfile);
      }
      throw error;
    }
  }

  private buildRecommendationPrompt(profile: UserProfile): string {
    return `You are an expert book recommendation assistant. Based on the following user profile, recommend 3 books that would be perfect matches.

User Profile:
- Favorite genres: ${profile.favoriteGenres.join(', ')}
- Recently read: ${profile.recentBooks.join(', ')}
- Reading preferences: ${profile.preferences}
- Mood: ${profile.currentMood}

Requirements:
1. Provide exactly 3 book recommendations
2. Include title, author, and brief explanation (2-3 sentences)
3. Ensure recommendations are diverse within preferred genres
4. Consider the user's current mood and recent reading history
5. Format as JSON array

Response format:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "reason": "Why this book fits the user's profile",
    "genre": "Primary Genre",
    "confidence": 0.95
  }
]`;
  }

  private parseRecommendationResponse(response: string): BookRecommendation[] {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      // Fallback parsing for non-JSON responses
      return this.parseTextRecommendations(response);
    }
  }
}
```

### 3. Error Handling and Resilience

```typescript
// src/services/gemini-error-handler.ts
export class GeminiAPIError extends Error {
  constructor(
    public apiError: any,
    public retryable: boolean = false
  ) {
    super(apiError.error?.message || 'Unknown Gemini API error');
  }

  isRateLimit(): boolean {
    return this.apiError.error?.code === 429;
  }

  isQuotaExceeded(): boolean {
    return this.apiError.error?.code === 429 &&
           this.apiError.error?.message?.includes('quota');
  }

  isInvalidRequest(): boolean {
    return this.apiError.error?.code === 400;
  }
}

export class GeminiRetryHandler {
  private maxRetries = 3;
  private baseDelay = 1000; // 1 second

  async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!(error instanceof GeminiAPIError) || !error.retryable) {
          throw error;
        }

        if (attempt < this.maxRetries) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  private calculateDelay(attempt: number): number {
    return this.baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 4. Response Caching

```typescript
// src/services/recommendation-cache.ts
export class RecommendationCache {
  private cache = new Map<string, CachedRecommendation>();
  private readonly ttl = 24 * 60 * 60 * 1000; // 24 hours

  async get(cacheKey: string): Promise<BookRecommendation[] | null> {
    const cached = this.cache.get(cacheKey);

    if (!cached || this.isExpired(cached)) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.recommendations;
  }

  async set(cacheKey: string, recommendations: BookRecommendation[]): Promise<void> {
    this.cache.set(cacheKey, {
      recommendations,
      timestamp: Date.now()
    });

    // Clean up expired entries periodically
    this.cleanupExpired();
  }

  private isExpired(cached: CachedRecommendation): boolean {
    return (Date.now() - cached.timestamp) > this.ttl;
  }

  private cleanupExpired(): void {
    for (const [key, value] of this.cache.entries()) {
      if (this.isExpired(value)) {
        this.cache.delete(key);
      }
    }
  }

  generateCacheKey(userProfile: UserProfile): string {
    const profileHash = this.hashUserProfile(userProfile);
    return `recommendations:${profileHash}`;
  }

  private hashUserProfile(profile: UserProfile): string {
    const key = JSON.stringify({
      genres: profile.favoriteGenres.sort(),
      recent: profile.recentBooks.slice(-5).sort(), // Last 5 books
      mood: profile.currentMood
    });

    return btoa(key).slice(0, 16);
  }
}
```

### 5. Usage Monitoring

```typescript
// src/services/usage-monitor.ts
export class GeminiUsageMonitor {
  private requestCount = 0;
  private tokenCount = 0;
  private windowStart = Date.now();
  private readonly windowSize = 60 * 1000; // 1 minute window

  recordRequest(tokenUsage: number): void {
    this.checkWindow();
    this.requestCount++;
    this.tokenCount += tokenUsage;
  }

  canMakeRequest(): boolean {
    this.checkWindow();
    return this.requestCount < 60; // Gemini Pro limit: 60 RPM
  }

  getUsageStats(): UsageStats {
    this.checkWindow();
    return {
      requestsThisMinute: this.requestCount,
      tokensThisMinute: this.tokenCount,
      remainingRequests: Math.max(0, 60 - this.requestCount)
    };
  }

  private checkWindow(): void {
    const now = Date.now();
    if (now - this.windowStart >= this.windowSize) {
      this.requestCount = 0;
      this.tokenCount = 0;
      this.windowStart = now;
    }
  }
}
```

## Prompt Engineering Best Practices

### 1. Book Recommendation Prompts

```typescript
export const RECOMMENDATION_PROMPTS = {
  PERSONALIZED: `You are an expert librarian with deep knowledge of literature across all genres.
Analyze the user's reading history and preferences to recommend books they'll love.

User Context: {userContext}

Provide 3 thoughtful recommendations that:
1. Match their stated preferences
2. Introduce slight variety to expand their horizons
3. Consider their current mood and situation

Format each recommendation with:
- Title and Author
- Genre and sub-genre
- 2-3 sentence explanation of why it's perfect for them
- Confidence level (1-10)`,

  MOOD_BASED: `Based on the user's current mood: {mood}
Recommend books that will either complement or positively shift their emotional state.

Consider:
- Escapist fiction for stress relief
- Uplifting stories for low mood
- Thought-provoking works for contemplative moods
- Light entertainment for relaxation`,

  SIMILAR_TO: `The user loved "{bookTitle}" by {author}.
Find books that share similar:
- Themes and emotional resonance
- Writing style and pace
- Character development approach
- World-building quality (if applicable)

Avoid obvious sequels or series. Focus on books that capture the same feeling.`
};
```

### 2. Response Validation

```typescript
export function validateRecommendationResponse(response: string): BookRecommendation[] {
  try {
    const recommendations = parseRecommendations(response);

    for (const rec of recommendations) {
      if (!rec.title || !rec.author) {
        throw new Error('Missing required fields: title or author');
      }

      if (!rec.reason || rec.reason.length < 20) {
        throw new Error('Recommendation reason too short');
      }

      if (rec.confidence && (rec.confidence < 0 || rec.confidence > 1)) {
        throw new Error('Invalid confidence score');
      }
    }

    return recommendations;
  } catch (error) {
    throw new ValidationError(`Invalid recommendation response: ${error.message}`);
  }
}
```

## Configuration Patterns

### 1. Environment-based Configuration

```typescript
// src/config/gemini-config.ts
export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  requestTimeout: number;
  rateLimitRpm: number;
}

export function getGeminiConfig(): GeminiConfig {
  const env = Deno.env.get('NODE_ENV') || 'development';

  const baseConfig: GeminiConfig = {
    apiKey: Deno.env.get('GOOGLE_AI_API_KEY')!,
    model: 'gemini-pro',
    temperature: 0.7,
    maxTokens: 1024,
    requestTimeout: 30000,
    rateLimitRpm: 60
  };

  if (env === 'production') {
    return {
      ...baseConfig,
      temperature: 0.6, // More consistent responses in production
      requestTimeout: 20000 // Faster timeout in production
    };
  }

  return baseConfig;
}
```

### 2. Feature Flags

```typescript
// src/config/feature-flags.ts
export interface FeatureFlags {
  useGeminiStreamingApi: boolean;
  enableRecommendationCaching: boolean;
  enableUsageMonitoring: boolean;
  enableFallbackRecommendations: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    useGeminiStreamingApi: Deno.env.get('ENABLE_STREAMING') === 'true',
    enableRecommendationCaching: Deno.env.get('ENABLE_CACHING') !== 'false',
    enableUsageMonitoring: Deno.env.get('ENABLE_MONITORING') !== 'false',
    enableFallbackRecommendations: Deno.env.get('ENABLE_FALLBACK') !== 'false'
  };
}
```

## Testing Patterns

### 1. Unit Tests

```typescript
// tests/services/recommendation-service.test.ts
import { assertEquals, assertRejects } from '@std/testing/asserts';
import { BookRecommendationService } from '../../src/services/recommendation-service.ts';
import { MockGeminiClient } from '../mocks/gemini-client.mock.ts';

Deno.test('BookRecommendationService - successful recommendation', async () => {
  const mockClient = new MockGeminiClient();
  const service = new BookRecommendationService(mockClient);

  const userProfile = {
    favoriteGenres: ['sci-fi', 'fantasy'],
    recentBooks: ['Dune', 'The Hobbit'],
    preferences: 'Complex world-building',
    currentMood: 'adventurous'
  };

  const recommendations = await service.getPersonalizedRecommendations(userProfile);

  assertEquals(recommendations.length, 3);
  assertEquals(mockClient.getLastPrompt().includes('sci-fi'), true);
});
```

### 2. Integration Tests

```typescript
// tests/integration/gemini-api.test.ts
Deno.test('Gemini API Integration - real API call', async () => {
  // Only run if API key is available
  const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
  if (!apiKey) {
    console.log('Skipping integration test - no API key');
    return;
  }

  const client = new GeminiClient();
  const response = await client.generateContent('Test prompt for integration');

  assertEquals(typeof response, 'string');
  assertEquals(response.length > 0, true);
});
```

## Performance Optimization

### 1. Request Batching

```typescript
// src/services/batch-processor.ts
export class RecommendationBatchProcessor {
  private batchQueue: BatchRequest[] = [];
  private readonly batchSize = 5;
  private readonly batchTimeout = 2000;

  async addRequest(request: RecommendationRequest): Promise<BookRecommendation[]> {
    return new Promise((resolve, reject) => {
      this.batchQueue.push({ request, resolve, reject });

      if (this.batchQueue.length >= this.batchSize) {
        this.processBatch();
      } else {
        this.scheduleTimeout();
      }
    });
  }

  private async processBatch(): Promise<void> {
    const batch = this.batchQueue.splice(0, this.batchSize);

    try {
      const batchPrompt = this.buildBatchPrompt(batch.map(b => b.request));
      const response = await this.geminiClient.generateContent(batchPrompt);
      const results = this.parseBatchResponse(response);

      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => item.reject(error));
    }
  }
}
```

### 2. Response Streaming

```typescript
// src/services/streaming-recommendations.ts
export class StreamingRecommendationService {
  async getStreamingRecommendations(
    userProfile: UserProfile,
    onUpdate: (partial: PartialRecommendation) => void
  ): Promise<BookRecommendation[]> {

    const prompt = this.buildStreamingPrompt(userProfile);

    // Note: Gemini streaming API implementation
    const stream = await this.geminiClient.generateContentStream(prompt);

    let buffer = '';
    const recommendations: BookRecommendation[] = [];

    for await (const chunk of stream) {
      buffer += chunk.text;

      // Parse partial recommendations as they arrive
      const partial = this.parsePartialRecommendations(buffer);
      onUpdate(partial);
    }

    return this.parseCompleteRecommendations(buffer);
  }
}
```

## Security Considerations

### 1. Input Sanitization

```typescript
export function sanitizeUserInput(input: string): string {
  return input
    .trim()
    .slice(0, 1000) // Limit input length
    .replace(/[^\w\s\-.,!?]/g, '') // Remove special characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}
```

### 2. Response Filtering

```typescript
export function filterRecommendationResponse(response: string): string {
  // Remove any potentially harmful content
  const filtered = response
    .replace(/https?:\/\/[^\s]+/g, '[URL]') // Remove URLs
    .replace(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/g, '[DATE]'); // Remove dates

  return filtered;
}
```

## Monitoring and Observability

```typescript
// src/services/gemini-metrics.ts
export class GeminiMetrics {
  static recordApiCall(endpoint: string, duration: number, tokens: number): void {
    // Implementation depends on your metrics system
    console.log(`Gemini API Call: ${endpoint}, Duration: ${duration}ms, Tokens: ${tokens}`);
  }

  static recordError(error: GeminiAPIError): void {
    console.error(`Gemini API Error: ${error.message}`, {
      code: error.apiError?.error?.code,
      retryable: error.retryable
    });
  }

  static recordCacheHit(key: string): void {
    console.log(`Cache Hit: ${key}`);
  }
}
```

This integration guide provides a solid foundation for implementing Gemini API integration in the Shelf Help Assistant while following best practices for reliability, performance, and security.