#!/usr/bin/env deno run --allow-net --allow-env

/**
 * Google AI Studio API Connectivity Test
 *
 * This script tests the Google AI Studio Gemini API integration
 * for the Shelf Help Assistant project.
 *
 * Usage:
 *   1. Set GOOGLE_AI_API_KEY environment variable
 *   2. Run: deno run --allow-net --allow-env test-gemini-api.ts
 */

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
    safetyRatings: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GeminiError {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

class GeminiAPITester {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    const apiKey = Deno.env.get('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      console.error('❌ GOOGLE_AI_API_KEY environment variable not set');
      console.error('   Please set your API key: export GOOGLE_AI_API_KEY=your_key_here');
      Deno.exit(1);
    }
    this.apiKey = apiKey;
  }

  async testBasicConnectivity(): Promise<boolean> {
    console.log('🔄 Testing basic API connectivity...');

    try {
      const response = await fetch(
        `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: 'Hello! Please respond with "API Test Successful" to confirm connectivity.'
              }]
            }]
          })
        }
      );

      if (!response.ok) {
        const errorData: GeminiError = await response.json();
        console.error(`❌ API Request Failed (${response.status}):`, errorData.error.message);
        return false;
      }

      const data: GeminiResponse = await response.json();
      console.log('✅ Basic connectivity test passed');
      console.log(`   Response: ${data.candidates[0].content.parts[0].text}`);
      console.log(`   Tokens used: ${data.usageMetadata.totalTokenCount}`);

      return true;
    } catch (error) {
      console.error('❌ Network error:', error.message);
      return false;
    }
  }

  async testBookRecommendation(): Promise<boolean> {
    console.log('🔄 Testing book recommendation functionality...');

    const prompt = `You are a book recommendation assistant. Please recommend a science fiction book for someone who enjoys complex world-building and character development. Include the title, author, and a brief reason for the recommendation.`;

    try {
      const response = await fetch(
        `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: prompt
              }]
            }],
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_MEDIUM_AND_ABOVE'
              }
            ]
          })
        }
      );

      if (!response.ok) {
        const errorData: GeminiError = await response.json();
        console.error(`❌ Book recommendation test failed (${response.status}):`, errorData.error.message);
        return false;
      }

      const data: GeminiResponse = await response.json();
      console.log('✅ Book recommendation test passed');
      console.log('   Sample recommendation:');
      console.log(`   ${data.candidates[0].content.parts[0].text.substring(0, 200)}...`);
      console.log(`   Tokens used: ${data.usageMetadata.totalTokenCount}`);
      console.log(`   Safety ratings: ${data.candidates[0].safetyRatings.length} checks passed`);

      return true;
    } catch (error) {
      console.error('❌ Book recommendation test error:', error.message);
      return false;
    }
  }

  async testRateLimiting(): Promise<boolean> {
    console.log('🔄 Testing rate limiting behavior...');

    const requests = [];
    const startTime = Date.now();

    // Send 5 rapid requests to test rate limiting
    for (let i = 0; i < 5; i++) {
      requests.push(
        fetch(
          `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Rate limit test request ${i + 1}`
                }]
              }]
            })
          }
        )
      );
    }

    try {
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const successful = responses.filter(r => r.ok).length;
      const rateLimited = responses.filter(r => r.status === 429).length;

      console.log('✅ Rate limiting test completed');
      console.log(`   Successful requests: ${successful}/5`);
      console.log(`   Rate limited requests: ${rateLimited}/5`);
      console.log(`   Total time: ${duration}ms`);

      if (rateLimited > 0) {
        console.log('   ⚠️  Rate limiting is active (this is normal)');
      }

      return true;
    } catch (error) {
      console.error('❌ Rate limiting test error:', error.message);
      return false;
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Google AI Studio API Tests\n');

    const tests = [
      { name: 'Basic Connectivity', test: () => this.testBasicConnectivity() },
      { name: 'Book Recommendation', test: () => this.testBookRecommendation() },
      { name: 'Rate Limiting', test: () => this.testRateLimiting() },
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
      console.log(`\n--- ${name} Test ---`);
      try {
        const result = await test();
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ ${name} test crashed:`, error.message);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
      console.log('🎉 All tests passed! Google AI Studio integration is ready.');
    } else {
      console.log('⚠️  Some tests failed. Please check your configuration.');
      Deno.exit(1);
    }
  }
}

// Run tests if this script is executed directly
if (import.meta.main) {
  const tester = new GeminiAPITester();
  await tester.runAllTests();
}