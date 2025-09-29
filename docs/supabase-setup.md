# Supabase Setup Guide for Shelf Help Assistant

This guide walks you through setting up Supabase for the Shelf Help Assistant project, including database configuration, authentication, and local development environment.

## Prerequisites

- [x] Supabase CLI installed (v2.45.5+)
- [ ] Supabase account created at [supabase.com](https://supabase.com)
- [ ] Git repository cloned locally

## Step 1: Create Supabase Project

1. **Go to [supabase.com](https://supabase.com)** and sign in/sign up
2. **Click "New Project"**
3. **Project Settings:**
   - **Name**: `shelf-help-assistant`
   - **Database Password**: Generate a strong password (save this securely!)
   - **Region**: Choose closest to your location (e.g., `US East`)
   - **Pricing Plan**: Start with "Free" tier

4. **Wait for project creation** (usually takes 1-2 minutes)

## Step 2: Enable pgvector Extension

1. Go to your project dashboard
2. Navigate to **Database** → **Extensions**
3. Search for `pgvector` and enable it
4. This extension is required for AI embeddings functionality

## Step 3: Configure Authentication

1. Navigate to **Authentication** → **Settings**
2. **Site URL**: Set to `http://localhost:3000` for development
3. **Email Auth**: Enable if not already enabled
4. **Confirm email**: You can disable this for development
5. **Additional redirect URLs**: Add `http://localhost:8000` for the bot server

## Step 4: Get API Keys and Project Details

Navigate to **Project Settings** → **API** and note these values:

- **Project URL**: `https://your-project-ref.supabase.co`
- **Project API Key (anon key)**: Used for client-side operations
- **Service Role Key**: Used for server-side operations (keep secret!)
- **Project Reference ID**: Short string identifier

## Step 5: Set Up Environment Variables

1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your actual Supabase values:
   ```env
   SUPABASE_URL=https://your-actual-project-ref.supabase.co
   SUPABASE_ANON_KEY=your_actual_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
   DATABASE_URL=postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres
   ```

## Step 6: Link Local Project to Supabase

```bash
# Link your local project to the remote Supabase project
supabase link --project-ref your-project-ref

# You'll be prompted for your database password
```

## Step 7: Apply Database Schema

```bash
# Push the initial schema to your remote database
supabase db push

# This will apply the migration file:
# supabase/migrations/20250928_000001_initial_schema.sql
```

## Step 8: Verify Setup

1. **Test database connection:**
   ```bash
   supabase db pull
   ```

2. **Check tables were created:**
   - Go to your Supabase dashboard
   - Navigate to **Database** → **Tables**
   - Verify these tables exist:
     - `user_profiles`
     - `books`
     - `reading_sessions`
     - `book_embeddings`

3. **Test Row Level Security:**
   - Navigate to **Authentication** → **Policies**
   - Verify RLS policies are active

## Step 9: Local Development Environment

For local development with the Supabase CLI:

```bash
# Start local Supabase services
supabase start

# This will start:
# - PostgreSQL database on port 54322
# - Supabase Studio on port 54323
# - API Gateway on port 54321
# - Inbucket (email testing) on port 54324
```

Local development URLs:
- **Supabase Studio**: http://localhost:54323
- **API Gateway**: http://localhost:54321
- **Database**: postgresql://postgres:postgres@localhost:54322/postgres

## Step 10: Test the Setup

Run the built-in tests to verify everything is working:

```bash
# Test database connection and basic operations
supabase test db

# Test API endpoints (if available)
curl -X GET "https://your-project-ref.supabase.co/rest/v1/books" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"
```

## Database Schema Overview

The database includes these main tables:

### `user_profiles`
- Extends Supabase auth.users
- Stores user preferences and Telegram integration data
- RLS: Users can only access their own profile

### `books`
- Core book information (title, author, ISBN, etc.)
- Support for multiple formats (physical, ebook, audiobook)
- Public read access, authenticated write access

### `reading_sessions`
- Tracks user's reading progress and history
- Links users to books with status, ratings, notes
- RLS: Users can only access their own sessions

### `book_embeddings`
- Stores AI embeddings for book recommendations
- Uses pgvector for similarity search
- Public read access for AI features

## Security Notes

- **Never commit `.env.local`** or files with real API keys
- **Service Role Key** has admin access - keep it secure
- **Row Level Security** is enabled on all tables
- **Anonymous access** is limited to public book data only

## Troubleshooting

### Common Issues

1. **"pgvector extension not found"**
   - Solution: Enable pgvector extension in Dashboard → Database → Extensions

2. **"Permission denied for table"**
   - Solution: Check RLS policies are correctly applied
   - Ensure you're using the correct API key for your user level

3. **"Connection refused"**
   - Solution: Verify project URL and API keys are correct
   - Check if project is paused (free tier limitation)

4. **"Migration failed"**
   - Solution: Check for syntax errors in migration files
   - Ensure database user has sufficient permissions

### Getting Help

- **Supabase Docs**: https://supabase.com/docs
- **Discord Community**: https://discord.supabase.com
- **GitHub Issues**: Create an issue in this repository

## Next Steps

After completing this setup:

1. **Test the Telegram bot integration** (Issue #13)
2. **Configure Google Gemini AI** (Issue #14)
3. **Set up local development server** (Issue #15)
4. **Deploy to production** (Epic 3)

## Maintenance

### Regular Tasks

- **Monitor usage**: Check Supabase dashboard for API usage
- **Backup database**: Use `supabase db dump` for backups
- **Update CLI**: Run `brew upgrade supabase` regularly
- **Review logs**: Check dashboard for errors or unusual activity