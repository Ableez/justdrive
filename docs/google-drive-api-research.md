# Google Drive API v3 Research — juststore CLI

**Issue:** [#2](https://github.com/Ableez/juststore/issues/2)  
**Date:** 2026-07-16  
**Purpose:** Research Google Drive API v3 capabilities for the `juststore` CLI tool. Unblocks auth, file operations, and path resolution tickets.

---

## 1. Required OAuth Scopes

The scope you choose determines what files the app can access. There is a tradeoff between breadth of access and verification burden.

### Recommended for juststore: `drive` (restricted)

```
https://www.googleapis.com/auth/drive
```

This scope grants **full read/write access to all files** in the user's Drive. It is required because `juststore` needs to:
- Create folders anywhere (`juststore/` root + subfolders)
- Upload/download arbitrary files
- Move, rename, delete files
- Manage sharing/permissions
- List files across the Drive (not just files the app created)

**Why not `drive.file`?**  
`drive.file` is non-sensitive and only grants access to files the app created or that the user explicitly shared via the Picker API. Since `juststore` needs to manage its own `juststore/` folder tree and browse existing content, `drive.file` is too restrictive — it cannot see folders or files the user created outside the app.

### Scope Breakdown by Operation

| Operation | Minimum Scope | Recommended |
|---|---|---|
| Upload files | `drive.file` | `drive` |
| Download files | `drive.readonly` | `drive` |
| Create folders | `drive.file` | `drive` |
| Move/rename files | `drive.metadata` | `drive` |
| List files in folder | `drive.metadata.readonly` | `drive` |
| Change sharing/permissions | `drive` | `drive` |
| Delete files | `drive` | `drive` |
| Search by name | `drive.metadata.readonly` | `drive` |

### Gotcha: Restricted Scope Verification

`drive` is a **restricted scope**. Apps using it must undergo a security assessment if they store Drive data on servers. For a local CLI tool that only stores tokens locally, this is simpler, but you still need to complete the restricted scope verification process through Google Cloud Console.

**Alternative:** If you want to avoid restricted scope verification, you could use `drive.file` + Google Picker API for file selection, but this fundamentally limits what a CLI tool can do. The full `drive` scope is the pragmatic choice for a CLI file manager.

### OAuth Flow for CLI Tools

Use the **OAuth 2.0 for Devices** flow or a **localhost redirect** flow:
1. Client ID + Client Secret from Google Cloud Console (type: "Desktop app")
2. Open browser for user consent
3. Capture authorization code via localhost redirect or manual paste
4. Exchange for access + refresh tokens
5. Store refresh token securely in `~/.juststore/credentials.json`

**Source:** https://developers.google.com/workspace/drive/api/guides/api-specific-auth

---

## 2. File Browsing — Metadata, Thumbnails, Pagination

### Metadata Returned Per File

The `files.list` and `files.get` methods return a `File` resource. By default, `list` returns only: `kind`, `id`, `name`, `mimeType`, `resourceKey`.

To get useful metadata, request specific fields:

```
GET /drive/v3/files?q='FOLDER_ID' in parents&fields=nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, iconLink, thumbnailLink, fileExtension, md5Checksum, webViewLink, owners, capabilities)
```

**Key metadata fields:**

| Field | Description |
|---|---|
| `id` | Unique file ID (use for all subsequent operations) |
| `name` | Display name including extension |
| `mimeType` | MIME type (e.g., `application/pdf`, `application/vnd.google-apps.folder`) |
| `size` | File size in bytes (absent for folders and Google Docs types) |
| `modifiedTime` | ISO 8601 timestamp |
| `createdTime` | ISO 8601 timestamp |
| `iconLink` | URL to file type icon |
| `thumbnailLink` | URL to thumbnail image (only for files with Drive-generated thumbnails) |
| `fileExtension` | Derived from `name` |
| `md5Checksum` | MD5 hash for binary files |
| `webViewLink` | Link to open in Drive UI |
| `owners` | Array of owner objects with `displayName`, `emailAddress`, `photoLink` |
| `parents` | Array of parent folder IDs |
| `capabilities` | Object with boolean flags: `canEdit`, `canDownload`, `canShare`, `canDelete`, etc. |
| `shared` | Boolean, whether file is shared |
| `trashed` | Boolean, whether file is in trash |

### Thumbnails

Yes, the API returns thumbnails via the `thumbnailLink` field. However:
- Thumbnails are **only available for files with previewable content** (images, PDFs, videos, etc.)
- **Google Workspace files** (Docs, Sheets, Slides) have thumbnails
- **Folders** do NOT have thumbnails via the API
- The `thumbnailLink` URL is temporary and requires authentication
- You can request `thumbnailLink` in the `fields` parameter

**To get thumbnails:**
```
fields=files(id, name, thumbnailLink)
```

### Folder Tree Traversal Depth

There is **no hard depth limit**. You can traverse as deep as you want by recursively querying `q='{parentId}' in parents`. However:
- Each level requires a separate API call
- Deep trees mean many sequential requests (no single "get tree" endpoint)
- Consider caching folder structures locally

### Pagination

**Critical gotcha:** The `files.list` method uses **page tokens** for pagination.

```
GET /drive/v3/files?q='{parentId}' in parents&pageSize=100&pageToken=...
```

- Default page size: **100 files** (max: also 100 for `list`; `files.list` returns up to 1000 in some contexts but 100 is the safe default)
- `nextPageToken` in the response indicates more results
- When `nextPageToken` is `null`/absent, you've reached the end
- **The `pageSize` parameter is NOT a hard guarantee** — the API may return fewer items

**Gotcha: `incompleteSearch`**  
If you search across multiple corpora (user + domain), the response may set `incompleteSearch: true`, meaning results were truncated. For `juststore`, stick to `corpora: 'user'` to avoid this.

**Gotcha: `orderBy` with `createdTime`**  
Using `orderBy=createdTime` on large collections causes extra processing and may timeout. Use `modifiedTime` instead.

**Source:** https://developers.google.com/workspace/drive/api/guides/search-files

---

## 3. The `juststore/` Root Folder

### Search for Folder by Name

```
GET /drive/v3/files?q=name = 'juststore' and mimeType = 'application/vnd.google-apps.folder' and trashed = false
```

This returns all folders named "juststore" that the user owns or has access to.

### Create Folder If Not Exists

The API does NOT have an atomic "create if not exists" operation. The pattern is:

```
1. Search: q=name = 'juststore' and mimeType = 'application/vnd.google-apps.folder' and trashed = false
2. If results.length > 0 → use results[0].id
3. If empty → POST /drive/v3/files with body:
   {
     "name": "juststore",
     "mimeType": "application/vnd.google-apps.folder"
   }
4. Cache the folder ID locally (e.g., in ~/.juststore/config.json)
```

### Race Condition Warning

Two instances of `juststore` running simultaneously could both see "no folder" and both create one. To handle this:
1. After creating, search again
2. If multiple found, use the oldest one (by `createdTime`)
3. Optionally delete the duplicate

### Using the Folder ID as Root

Once you have the `juststore/` folder ID, use it as the parent for all operations:

- **List contents:** `q='{juststore_folder_id}' in parents`
- **Upload to it:** Set `parents: ['{juststore_folder_id}']` in file metadata
- **Create subfolder:** Set `parents: ['{juststore_folder_id}']` on the new folder

**Cache the folder ID** in a local config file to avoid searching on every command. Invalidate the cache if operations fail with 404.

**Source:** https://developers.google.com/workspace/drive/api/guides/folder

---

## 4. Path Resolution

### No Native Path-Based Access

The Drive API has **no concept of file paths**. There is no way to resolve `/juststore/subfolder/file.pdf` to a file ID in a single API call.

### Recommended Approach: Walk the Tree

To resolve a path like `juststore/subfolder/file.pdf`:

```
function resolvePath(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  let currentParentId = ROOT_FOLDER_ID; // cached juststore/ ID

  for (let i = 0; i < segments.length; i++) {
    const isLast = i === segments.length - 1;
    const segment = segments[i];

    // For the last segment, don't filter by mimeType (could be file or folder)
    // For intermediate segments, must be folders
    const q = isLast
      ? `name = '${escapeQuery(segment)}' and '${currentParentId}' in parents and trashed = false`
      : `name = '${escapeQuery(segment)}' and mimeType = 'application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed = false`;

    const result = files.list({ q, fields: 'files(id, name, mimeType)' });

    if (!result.files || result.files.length === 0) return null;

    currentParentId = result.files[0].id;
  }

  return currentParentId; // this is the file/folder ID of the final segment
}
```

### Performance Optimization

Each path segment requires one API call. For a path like `a/b/c/d/file.txt`, that's 5 sequential calls. Mitigations:

1. **Cache folder IDs locally** — Map paths to IDs in `~/.juststore/path-cache.json`
2. **Batch the lookups** — Not possible here since each depends on the previous result
3. **Limit tree depth** — Warn users if paths are excessively deep (e.g., > 10 levels)

### Gotcha: Duplicate Names

Google Drive allows **multiple files with the same name in the same folder**. The query `name = 'foo' and '{parentId}' in parents` may return multiple results. Strategy:
- Always take the first result (most recently modified)
- Or warn the user about ambiguity
- Or require unique names within a folder (enforce in `juststore`)

### Gotcha: Special Characters in Query

File names containing `'` or `\` must be escaped in queries:
```
name = 'O\'Brien\\'s file'
```

**Source:** https://developers.google.com/workspace/drive/api/guides/search-files

---

## 5. Rate Limits and Batching

### Rate Limits

| Limit Type | Default |
|---|---|
| **Queries per day** | 1,000,000,000 (effectively unlimited for a CLI) |
| **Queries per 100 seconds per user** | 12,000 |
| **Queries per 100 seconds per user per project** | 12,000 |
| **Concurrent requests** | No hard limit, but avoid > 10 parallel |

The per-user rate limit (12,000 requests per 100 seconds = 120/sec) is generous. A CLI tool will rarely hit it unless doing bulk operations.

### Handling 429 / Rate Limit Errors

```
HTTP 403: rateLimitExceeded
HTTP 429: Too Many Requests
```

**Best practice:** Implement exponential backoff:
```
retry_delay = min(initial_delay * 2^attempt, max_delay) + jitter
```

Google's official recommendation: retry with backoff on 403 rate limit errors and all 5xx errors.

### Batch Requests

**Yes, the API supports batch requests** via the `batch` endpoint:

```
POST https://www.googleapis.com/batch/drive/v3
Content-Type: multipart/mixed; boundary=batch_boundary
```

Batch requests let you combine up to **100 operations** in a single HTTP request. This is useful for:
- Creating multiple files/folders at once
- Updating permissions on multiple files
- Deleting multiple files

**Client library support for batching:**

| Library | Batch Support |
|---|---|
| Node.js (`googleapis`) | `service.new_batch_http_request(callback)` |
| Python | `service.new_batch_http_request(callback)` |
| Java | `service.batch()` + `BatchRequest` |
| Go | Manual via `googleapi.BatchRequest` |

**Node.js example:**
```typescript
const batch = google.drive({ version: 'v3', auth }).new_batch_http_request();

batch.add(service.files.create({ requestBody: { name: 'a.txt', parents: [folderId] }, media: {...} }));
batch.add(service.files.create({ requestBody: { name: 'b.txt', parents: [folderId] }, media: {...} }));

await batch.execute();
```

**Gotcha:** Batch requests are sent as a single HTTP request but each sub-request counts separately against rate limits.

**Source:** https://developers.google.com/workspace/drive/api/guides/performance#batch-requests

---

## 6. Known Limitations

### File Size Limits

| Upload Type | Max Size |
|---|---|
| Simple upload (`uploadType=media`) | **5 MB** |
| Multipart upload (`uploadType=multipart`) | **5 MB** |
| Resumable upload (`uploadType=resumable`) | **5 TB** (theoretical) |

For `juststore`, use **resumable uploads** for all files. It works for small files too (minimal overhead: one extra HTTP request) and provides:
- Progress tracking
- Automatic resume on network failure
- No size limit concerns for practical use

### Upload Types in Detail

**Simple upload** — `POST /upload/drive/v3/files?uploadType=media`
- Single request with file body
- No metadata (name inferred)
- Max 5 MB

**Multipart upload** — `POST /upload/drive/v3/files?uploadType=multipart`
- Single request with metadata + file body
- Boundary-separated parts
- Max 5 MB

**Resumable upload** — `POST /upload/drive/v3/files?uploadType=resumable`
1. Initiate: POST with metadata, get `Location` header with session URI
2. Upload: PUT to session URI with file body (single or chunked)
3. Resume: PUT with `Content-Range: */SIZE` to query status, then continue
- Session URI expires after **1 week**
- Chunks must be multiples of **256 KB** (except final chunk)
- Use `Content-Range: bytes start-end/total` for chunked uploads

### Google Workspace Files vs Binary Files

Google Drive has two categories of files:

**Binary files** (uploaded content):
- PDF, JPEG, PNG, ZIP, etc.
- Have `size`, `md5Checksum`
- Can be downloaded directly with `alt=media`
- Can be uploaded as-is

**Google Workspace files** (native):
- Google Docs, Sheets, Slides, Forms, Drawings
- **Do NOT have a `size` field**
- **Cannot be downloaded as-is** — must use `files.export` with a target MIME type
- **Cannot be uploaded as-is** — you upload a different format and set `mimeType` to convert
- Store in Drive as collaborative documents

| Workspace Type | MIME Type | Import From | Export To |
|---|---|---|---|
| Google Docs | `application/vnd.google-apps.document` | DOCX, HTML, RTF, TXT, ODT, EPUB | PDF, DOCX, HTML, RTF, TXT, ODT, EPUB |
| Google Sheets | `application/vnd.google-apps.spreadsheet` | XLSX, CSV, TSV, ODS | PDF, XLSX, CSV, TSV, ODS |
| Google Slides | `application/vnd.google-apps.presentation` | PPTX, ODP | PDF, PPTX, ODP |

**For juststore:** Treat binary files as the primary use case. If the user uploads a `.docx`, you have two choices:
1. Upload as binary (preserves original format, user can download as-is)
2. Upload with conversion to Google Docs (collaborative editing, but loses original format)

Recommendation: Default to binary upload. Offer `--convert` flag for Workspace conversion.

### Download Gotchas

**Binary files:**
```
GET /drive/v3/files/{fileId}?alt=media
```

**Google Workspace files (export):**
```
GET /drive/v3/files/{fileId}/export?mimeType=application/pdf
```

Export has format-specific limitations (e.g., Sheets max 10MB export).

### Other Gotchas

1. **File names are not unique** — Multiple files can have the same name in the same folder. Always use file ID for operations, not name.

2. **Trash is not delete** — `files.delete` moves to trash. `files.emptyTrash` permanently deletes. Files in trash still count against storage quota.

3. **Shared drives** — If the user has Shared Drives, file listing behavior changes. Use `supportsAllDrives=true` parameter if you want to include Shared Drive files.

4. **Storage quota** — Google Workspace files (Docs, Sheets, etc.) do NOT count against storage quota. Uploaded binary files do. Google Photos storage rules are complex.

5. **Maximum file name length** — 32,767 characters (effectively unlimited).

6. **Maximum folder depth** — No documented hard limit, but performance degrades with deep nesting.

7. **`fields` parameter is critical** — Always specify `fields` to avoid returning default/empty responses. Omitting it wastes bandwidth.

8. **Permissions cascade** — Folder permissions propagate to children. Moving a file to a new folder changes its effective permissions.

---

## Quick Reference: Key Endpoints

| Operation | Method | Endpoint |
|---|---|---|
| List files | `GET` | `/drive/v3/files?q=...` |
| Get file metadata | `GET` | `/drive/v3/files/{fileId}` |
| Get file content | `GET` | `/drive/v3/files/{fileId}?alt=media` |
| Create folder | `POST` | `/drive/v3/files` (mimeType: folder) |
| Upload file | `POST` | `/upload/drive/v3/files?uploadType=resumable` |
| Update file content | `PATCH` | `/upload/drive/v3/files/{fileId}?uploadType=resumable` |
| Move/rename | `PATCH` | `/drive/v3/files/{fileId}` (update name/parents) |
| Delete | `DELETE` | `/drive/v3/files/{fileId}` |
| Export Workspace | `GET` | `/drive/v3/files/{fileId}/export?mimeType=...` |
| Create permission | `POST` | `/drive/v3/files/{fileId}/permissions` |
| List permissions | `GET` | `/drive/v3/files/{fileId}/permissions` |
| Batch | `POST` | `/batch/drive/v3` |

---

## Recommendations for Implementation

1. **Use `googleapis` Node.js client** — Well-maintained, supports all operations, has TypeScript types
2. **Always use resumable uploads** — Works for all file sizes, supports resume on failure
3. **Cache folder IDs** — Store `juststore/` root ID and subfolder IDs in `~/.juststore/cache.json`
4. **Always specify `fields`** — Reduces payload size and avoids surprises
5. **Implement exponential backoff** — For 429 and 5xx errors
6. **Use batch requests** — For bulk operations (creating multiple files, etc.)
7. **Escape query strings** — Sanitize file names in `q` parameters
8. **Use `modifiedTime` over `createdTime`** — Better performance for sorting

---

## Sources

- [Drive API v3 Reference](https://developers.google.com/workspace/drive/api/reference/rest/v3)
- [Choose Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Upload File Data](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Search Files](https://developers.google.com/workspace/drive/api/guides/search-files)
- [Manage Sharing](https://developers.google.com/workspace/drive/api/guides/manage-sharing)
- [Usage Limits](https://developers.google.com/workspace/drive/api/guides/limits)
- [Performance Best Practices](https://developers.google.com/workspace/drive/api/guides/performance)
- [Create Folders](https://developers.google.com/workspace/drive/api/guides/folder)
- [Supported MIME Types](https://developers.google.com/workspace/drive/api/guides/mime-types)
