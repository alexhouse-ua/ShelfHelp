# API Testing Guide

This document provides examples for testing the Supabase API endpoints locally.

## Local Development API Endpoints

- **Base URL**: `http://127.0.0.1:54321`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`

## Test Commands

### 1. List All Books (Public Access)
```bash
curl -X GET "http://127.0.0.1:54321/rest/v1/books" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

### 2. Get Single Book by ID
```bash
curl -X GET "http://127.0.0.1:54321/rest/v1/books?id=eq.550e8400-e29b-41d4-a716-446655440001" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

### 3. Search Books by Title
```bash
curl -X GET "http://127.0.0.1:54321/rest/v1/books?title=ilike.*Dune*" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

### 4. Get User Profiles (Requires Authentication)
```bash
curl -X GET "http://127.0.0.1:54321/rest/v1/user_profiles" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

## Expected Responses

### Books Endpoint Response
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "The Pragmatic Programmer",
    "author": "Andrew Hunt, David Thomas",
    "isbn_13": "9780135957059",
    "publisher": "Addison-Wesley Professional",
    "publication_date": "2019-09-13",
    "page_count": 352,
    "language": "en",
    "description": "The Pragmatic Programmer illustrates the best approaches and major pitfalls of many different aspects of software development.",
    "format": "physical",
    "genres": ["Programming", "Technology", "Software Engineering"],
    "tags": ["career", "best-practices", "software-development"]
  }
]
```

### User Profiles Response (Anonymous Access)
```json
[]
```
*Note: Returns empty array due to Row Level Security policies*

## Testing with Supabase Studio

Access the local Supabase Studio at: http://127.0.0.1:54323

From the Studio you can:
- Browse tables and data
- Run SQL queries
- Test RLS policies
- View API documentation
- Monitor real-time subscriptions

## Schema Information

### Tables Created
- `user_profiles` - User account extensions
- `books` - Book catalog with metadata
- `reading_sessions` - User reading progress and history
- `book_embeddings` - AI embeddings for recommendations

### Functions Available
- `search_books_by_embedding()` - Vector similarity search (fallback in local)
- `get_reading_recommendations()` - Personalized book recommendations
- `add_sample_user_data()` - Helper to add sample data for testing

### Views Available
- `user_reading_stats` - Aggregated reading statistics per user