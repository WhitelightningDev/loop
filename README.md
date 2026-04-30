# loop

## Email sending

Loop can send invite emails via:
- **Google (Gmail API)** (recommended for Vercel/serverless)
- **Gmail SMTP** (env-based)
- **Custom SMTP** (per-workspace settings in the DB)

### Option A: Google (Gmail API) — recommended
1. In Google Cloud Console, enable the **Gmail API** for your project.
2. Create an **OAuth Client ID (Web application)** and add this redirect URI:
   - `https://<your-domain>/api/integrations/oauth/callback`
3. In Loop: **Admin → Integrations**
   - Configure **Google (Gmail)** with your Client ID + Client Secret
   - Click **Connect** and approve
4. Test via **Admin → SMTP** → “Send test”.

### Option B: Gmail SMTP (env vars)
Set:
- `EMAIL_PROVIDER=gmail_smtp`
- `GMAIL_USER=you@domain.com`
- `GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx`

### Option C: Custom SMTP (per workspace)
Use **Admin → SMTP** to save host/port/username/password/from fields.
