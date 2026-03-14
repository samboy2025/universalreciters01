

## Plan: Migrate Storage to Cloudinary

Currently, four files upload to Supabase Storage (buckets: `streams`, `cms-assets`, `thumbnails`). We'll create a Cloudinary upload edge function and update all upload points to use it.

### Prerequisites

You'll need a **Cloudinary account** with:
- **Cloud Name**
- **API Key** (publishable, stored in code)
- **API Secret** (stored as a backend secret)

I'll store `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` as secrets.

### Changes

**1. Create edge function `supabase/functions/cloudinary-upload/index.ts`**
- Accepts file uploads (base64 or FormData) with a `folder` parameter
- Uses Cloudinary's Upload API (`https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload`)
- Signs uploads server-side using the API secret
- Returns the `secure_url` from Cloudinary
- Supports both images and videos via the `auto` resource type

**2. Create a client-side helper `src/lib/cloudinary.ts`**
- `uploadToCloudinary(file: File | Blob, folder: string)` — converts to base64, calls the edge function, returns the public URL
- Replaces all `supabase.storage.from(...).upload(...)` + `getPublicUrl()` patterns

**3. Update upload points (4 files)**
- **`src/components/recitation/SelfieMirror.tsx`** — video uploads (folder: `streams`)
- **`src/pages/dashboard/Settings.tsx`** — avatar uploads (folder: `avatars`)
- **`src/pages/admin/AdminVideos.tsx`** — video/thumbnail uploads (folder: `videos`)
- **`src/pages/admin/AdminCMS.tsx`** — logo/OG image uploads (folder: `cms-assets`)

Each will call `uploadToCloudinary()` instead of Supabase Storage, getting back a direct Cloudinary URL to store in the database.

**4. Update `supabase/config.toml`** — add `verify_jwt = false` for the new edge function (handled automatically).

### What stays the same
- Database tables and their `video_url`, `thumbnail_url`, `avatar_url` columns — they'll just store Cloudinary URLs instead of Supabase Storage URLs
- All existing functionality (recording, unlock, pay-per-view) remains unchanged

