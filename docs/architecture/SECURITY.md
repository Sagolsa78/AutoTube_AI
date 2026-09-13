# AutoTube AI — Security Architecture

## 1. Authentication & JWT Tokens
- **Native JWT Auth**: Issued upon registration or login via `/api/auth/login` or `/api/auth/register`.
- **Claims**: `sub` (User ID), `email`, `iat`, `exp` (30-day token lifetime).
- **Signing**: HMAC-SHA256 with `settings.JWT_SECRET`.
- **Validation**: Enforced across API endpoints via `get_current_user` FastAPI dependency.

---

## 2. Multi-Tenant Authorization Invariant
- **Rule**: A UUID is NOT an authorization permit.
- Every endpoint verifying user ownership executes queries filtered by `WHERE Model.user_id == current_user.id`.
- Attempts by User A to view, update, delete, render, or preview User B's channels, ideas, scripts, scenes, assets, videos, or jobs return `404 Not Found` or `403 Forbidden`.

---

## 3. YouTube OAuth Security & Encryption
- **No Global Token File**: Tokens are stored per-user in the `youtube_connections` table.
- **At-Rest Encryption**: OAuth `access_token` and `refresh_token` are encrypted with Fernet symmetric cryptography (`backend.security.encrypt_value` / `decrypt_value`) using `settings.ENCRYPTION_KEY`.
- **No Plaintext Logging**: Credentials and refresh tokens are strictly masked in logs.
- **OAuth State Parameter**: Generated with cryptographically random tokens mapped to initiating user sessions and verified during callback.

---

## 4. Video Preview Security
- Private video preview requests (`/api/videos/{id}/preview`) are authenticated.
- If storage is local, the file is streamed directly to the authorized caller.
- If storage is cloud (S3/R2), preview generates a short-lived presigned URL (1 hour expiry) or streams securely through the API, preventing arbitrary public bucket scraping.
