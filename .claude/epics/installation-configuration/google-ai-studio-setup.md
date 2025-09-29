# Google AI Studio Setup Guide

## Overview
This guide walks through setting up Google AI Studio account, generating API keys for Gemini model access, and configuring the integration for the Shelf Help Assistant project.

## Prerequisites
- Google account with access to Google AI Studio
- Basic understanding of API key management
- Command line access for testing

## Step 1: Create Google AI Studio Account

1. **Navigate to Google AI Studio**
   - Go to [aistudio.google.com](https://aistudio.google.com)
   - Sign in with your Google account

2. **Accept Terms of Service**
   - Review and accept the Google AI Studio Terms of Service
   - Review and accept the Generative AI Prohibited Use Policy

3. **Verify Account Access**
   - Confirm you can access the AI Studio dashboard
   - Verify you can see the available models (Gemini Pro, Gemini Pro Vision)

## Step 2: Generate API Key

1. **Access API Key Management**
   - In Google AI Studio, click on "Get API key" in the left sidebar
   - Select "Create API key in new project" or use existing project

2. **Create New Project (Recommended)**
   - Click "Create API key in new project"
   - Project will be automatically created with name like "Generative Language Client"
   - API key will be generated automatically

3. **Secure the API Key**
   - **CRITICAL**: Copy the API key immediately - it won't be shown again
   - Store it securely (see Environment Configuration section)
   - Never commit API keys to version control

## Step 3: Configure API Permissions

1. **Review Default Permissions**
   - API key has access to Generative Language API by default
   - Includes access to Gemini Pro and Gemini Pro Vision models

2. **Configure API Restrictions (Optional but Recommended)**
   - Go to Google Cloud Console for your project
   - Navigate to APIs & Services > Credentials
   - Click on your API key to edit restrictions
   - Add application restrictions (HTTP referrers) if deploying to web
   - Add API restrictions to limit to only Generative Language API

## Step 4: Configure Usage Quotas and Billing

1. **Review Free Tier Limits**
   - Gemini Pro: 60 requests per minute (RPM)
   - Gemini Pro Vision: 60 requests per minute (RPM)
   - Free tier includes generous quota for development

2. **Monitor Usage**
   - Check quota usage in Google Cloud Console
   - Navigate to APIs & Services > Quotas
   - Monitor the "Requests per minute per model" metric

3. **Set up Billing Alerts (Optional)**
   - Enable billing alerts to monitor costs
   - Set conservative limits for development phase

## Step 5: Configure Safety Settings

1. **Access Safety Settings**
   - Safety settings are configured per request in the API call
   - Default settings filter harmful content appropriately for book recommendations

2. **Recommended Safety Configuration for Shelf Help**
   ```json
   {
     "safety_settings": [
       {
         "category": "HARM_CATEGORY_HARASSMENT",
         "threshold": "BLOCK_MEDIUM_AND_ABOVE"
       },
       {
         "category": "HARM_CATEGORY_HATE_SPEECH",
         "threshold": "BLOCK_MEDIUM_AND_ABOVE"
       },
       {
         "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
         "threshold": "BLOCK_MEDIUM_AND_ABOVE"
       },
       {
         "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
         "threshold": "BLOCK_MEDIUM_AND_ABOVE"
       }
     ]
   }
   ```

## Step 6: Environment Configuration

1. **Create Environment Variables**
   Create a `.env.local` file in the project root (never commit this):
   ```
   GOOGLE_AI_API_KEY=your_api_key_here
   GOOGLE_AI_PROJECT_ID=your_project_id_here
   ```

2. **Environment Variable Template**
   Create `.env.example` for team reference:
   ```
   # Google AI Studio Configuration
   GOOGLE_AI_API_KEY=your_google_ai_studio_api_key
   GOOGLE_AI_PROJECT_ID=your_google_cloud_project_id
   ```

3. **Update .gitignore**
   Ensure the following are in your `.gitignore`:
   ```
   .env
   .env.local
   .env.production
   ```

## Step 7: Test API Connectivity

1. **Basic API Test with curl**
   ```bash
   curl \
     -H 'Content-Type: application/json' \
     -d '{"contents":[{"parts":[{"text":"Test API connectivity"}]}]}' \
     -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY"
   ```

2. **Test with Deno/TypeScript**
   Create `test-gemini-api.ts`:
   ```typescript
   const API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

   if (!API_KEY) {
     console.error('❌ GOOGLE_AI_API_KEY environment variable not set');
     Deno.exit(1);
   }

   async function testGeminiAPI() {
     try {
       const response = await fetch(
         `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
         {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             contents: [{
               parts: [{
                 text: 'Recommend a good book for someone interested in science fiction.'
               }]
             }]
           })
         }
       );

       if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
       }

       const data = await response.json();
       console.log('✅ API Test Successful!');
       console.log('Response:', data.candidates[0].content.parts[0].text);

     } catch (error) {
       console.error('❌ API Test Failed:', error.message);
       Deno.exit(1);
     }
   }

   testGeminiAPI();
   ```

3. **Run the test**:
   ```bash
   deno run --allow-net --allow-env test-gemini-api.ts
   ```

## Step 8: Integration Guidelines

1. **API Usage Patterns**
   - Use streaming for real-time responses where possible
   - Implement proper error handling for rate limits
   - Cache responses when appropriate to reduce API calls
   - Use batch requests for multiple recommendations

2. **Error Handling Strategy**
   ```typescript
   interface APIError {
     code: number;
     message: string;
     status: string;
   }

   function handleGeminiError(error: APIError) {
     switch (error.code) {
       case 429:
         // Rate limit exceeded - implement backoff
         break;
       case 400:
         // Bad request - check input validation
         break;
       case 403:
         // Permission denied - check API key
         break;
       default:
         // Log unexpected errors
         break;
     }
   }
   ```

3. **Rate Limiting Best Practices**
   - Implement exponential backoff for rate limit errors
   - Track usage to stay within free tier limits
   - Consider request queuing for high-traffic scenarios

## Troubleshooting

### Common Issues

1. **API Key Not Working**
   - Verify API key is correct and hasn't been regenerated
   - Check that Generative Language API is enabled
   - Ensure no extra characters or spaces in environment variable

2. **Rate Limit Errors**
   - Check current usage in Google Cloud Console
   - Implement request throttling
   - Consider upgrading to paid tier if needed

3. **Permission Denied**
   - Verify API key permissions in Google Cloud Console
   - Check that billing is set up (required even for free tier)
   - Ensure terms of service are accepted

### Validation Checklist

- [ ] Google AI Studio account created and accessible
- [ ] API key generated and securely stored
- [ ] Environment variables configured correctly
- [ ] Basic API test returns successful response
- [ ] Rate limits and quotas reviewed
- [ ] Safety settings configured appropriately
- [ ] Error handling strategy documented

## Security Best Practices

1. **API Key Security**
   - Never commit API keys to version control
   - Use environment variables for all configurations
   - Rotate API keys regularly
   - Implement API key restrictions where possible

2. **Request Security**
   - Validate all user inputs before sending to API
   - Implement request size limits
   - Use HTTPS for all API communications
   - Log API usage for monitoring

## Free Tier Optimization

1. **Usage Monitoring**
   - Track requests per minute to stay within limits
   - Monitor monthly usage to avoid unexpected charges
   - Implement caching to reduce duplicate requests

2. **Cost-Effective Patterns**
   - Use shorter prompts when possible
   - Implement response caching for repeated queries
   - Batch related requests when API supports it
   - Use appropriate model (Gemini Pro vs Pro Vision) based on needs

## Next Steps

After completing this setup:
1. Integration with Shelf Help Assistant recommendation engine
2. Implementation of book recommendation prompts
3. Testing with real book data and user queries
4. Performance optimization and caching strategies