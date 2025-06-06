# Supabase Storage Setup

Since storage bucket creation requires special permissions, you need to set up storage buckets manually through the Supabase Studio UI.

## Steps to Setup Storage Buckets

1. **Open Supabase Studio**
   - Go to http://127.0.0.1:54323
   - Login if required (default credentials for local development)

2. **Navigate to Storage**
   - Click on "Storage" in the left sidebar

3. **Create Required Buckets**
   
   Create the following buckets:
   
   a. **slide-visuals**
      - Click "New bucket"
      - Name: `slide-visuals`
      - Public bucket: ✓ (check this)
      - Click "Create bucket"
   
   b. **processing-results**
      - Click "New bucket"
      - Name: `processing-results`
      - Public bucket: ✓ (check this)
      - Click "Create bucket"

   c. **exported-files** (for future use)
      - Click "New bucket"
      - Name: `exported-files`
      - Public bucket: ✓ (check this)
      - Click "Create bucket"

   d. **original-files** (for future use)
      - Click "New bucket"
      - Name: `original-files`
      - Public bucket: ✓ (check this)
      - Click "Create bucket"

4. **Configure Bucket Policies (Optional for Development)**
   
   For development, public buckets should work fine. For production, you may want to add RLS policies:
   
   - Click on the bucket name
   - Go to "Policies" tab
   - Add appropriate policies based on your security requirements

## Alternative: Disable RLS for Storage (Development Only)

If you're still having issues with storage uploads, you can run this SQL in the SQL Editor:

```sql
-- WARNING: Only for local development!
-- This gives unrestricted access to storage
CREATE POLICY "Allow public access" ON storage.objects
  FOR ALL USING (true) WITH CHECK (true);
```

## Verifying Storage Setup

After creating the buckets, your application should be able to:
- Upload SVG files to `slide-visuals`
- Upload result JSON files to `processing-results`
- (In the future) Upload exported PPTX files to `exported-files`
- Generate public URLs for uploaded files

The application will automatically handle file uploads once the buckets exist. 