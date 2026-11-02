-- ============================================================================
-- ZESTFLOW OS: STORAGE BUCKET SPECIFICATION & POLICIES
-- Target Bucket: business-assets (Private)
-- ============================================================================

-- 1. Create Private Bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-assets',
  'business-assets',
  false,
  2097152, -- 2 MB limit per file (well above 700KB max asset)
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'];

-- 2. Clean RLS policies for storage objects in business-assets
DROP POLICY IF EXISTS "business_assets_select_owner" ON storage.objects;
DROP POLICY IF EXISTS "business_assets_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "business_assets_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "business_assets_delete_owner" ON storage.objects;

-- Only authenticated owner can read files in their folder
CREATE POLICY "business_assets_select_owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only authenticated owner can upload files into their folder
CREATE POLICY "business_assets_insert_owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only authenticated owner can update their files
CREATE POLICY "business_assets_update_owner" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only authenticated owner can delete their files
CREATE POLICY "business_assets_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
