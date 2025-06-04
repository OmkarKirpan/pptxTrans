# How to Fix Your .env File

The issue with "Invalid API key" is caused by having line breaks in your Supabase API key in the .env file.

## Steps to Fix

1. Open your `.env` file
2. Find the `SUPABASE_KEY` line
3. Replace the multi-line key with a single-line version:

```
# WRONG (has line breaks):
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6
ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# CORRECT (single line):
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
```

4. Save the file
5. Restart the server

## Why This Works

JWT tokens (like your Supabase key) must be in a specific format with no line breaks. The API expects a continuous string.

## Code Fix

I've already updated the `supabase_service.py` file to properly handle the API key by:
1. Removing whitespace and newlines
2. Removing any surrounding quotes

This change should make your app more robust, but fixing the .env file is still recommended for better maintainability. 