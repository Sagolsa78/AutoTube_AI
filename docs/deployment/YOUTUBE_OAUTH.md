# YouTube OAuth2 Production Configuration

## 1. Google Cloud Console Setup
1. Create a project in Google Cloud Console.
2. Enable the **YouTube Data API v3**.
3. Configure the OAuth Consent Screen:
   - User Type: External (or Internal if Google Workspace).
   - Scopes:
     - `https://www.googleapis.com/auth/youtube.upload`
     - `https://www.googleapis.com/auth/youtube`
4. Create Credentials -> OAuth Client ID -> Web Application.
   - **Authorized redirect URIs**:
     - Local: `http://localhost:8000/api/youtube/callback`
     - Cloud: `https://<YOUR_RENDER_DOMAIN>/api/youtube/callback`

---

## 2. Configuration & Key Encryption
1. Place client credentials in `client_secret.json` or configure client ID and client secret environment variables.
2. Generate an encryption key:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
3. Set `ENCRYPTION_KEY` in environment variables.
4. When a user connects their YouTube account, tokens are encrypted with `ENCRYPTION_KEY` and saved in `youtube_connections`.
