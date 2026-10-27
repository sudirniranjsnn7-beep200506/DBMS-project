# AssetVault: Custom Domain, Dynamic DNS & SSL Setup Guide
**Domain Providers**: DuckDNS (Free Dynamic DNS) / Namecheap / Cloudflare  
**Hosting Platforms**: Vercel (Frontend SPA) + Render (Docker API)  
**Security**: Automated Let's Encrypt TLS/SSL, Strict-Transport-Security (HSTS), Cross-Origin Cookies

---

## 1. Free Domain Configuration with DuckDNS

DuckDNS provides completely free subdomains under `*.duckdns.org` that can point directly to cloud deployments.

### A. Register DuckDNS Subdomains
1. Navigate to [duckdns.org](https://www.duckdns.org) and authenticate (via GitHub or Google).
2. Create two subdomains:
   - Frontend SPA: `assetvault-app.duckdns.org`
   - Backend API: `assetvault-api.duckdns.org`
3. Note your DuckDNS account token.

### B. Standard DNS Records (For Custom Domains via Cloudflare/Namecheap)
If you own a custom domain (e.g., `assetvault.io`):

| Type | Name / Host | Target Value | Purpose |
|---|---|---|---|
| `CNAME` | `app` | `cname.vercel-dns.com` | Points `app.assetvault.io` to Vercel |
| `CNAME` | `api` | `assetvault-api.onrender.com` | Points `api.assetvault.io` to Render |
| `A` | `@` (Apex) | `76.76.21.21` | Points apex root domain to Vercel |

---

## 2. Vercel Custom Domain Configuration

1. In the **Vercel Dashboard**, open your `assetvault-web` project.
2. Navigate to **Settings** -> **Domains**.
3. Enter your domain: `assetvault-app.duckdns.org` (or `app.yourdomain.com`).
4. Click **Add**.
5. Vercel automatically verifies the CNAME/A record and generates a trusted **Let's Encrypt Wildcard / SNI SSL Certificate**.
6. When verified, a green checkmark will appear with **Valid Configuration**.

---

## 3. Render Custom Domain Configuration

1. In the **Render Dashboard**, open your `assetvault-api` service.
2. Navigate to **Settings** -> **Custom Domains**.
3. Click **Add Custom Domain** and enter: `assetvault-api.duckdns.org` (or `api.yourdomain.com`).
4. Follow Render's verification instruction:
   - Add a CNAME pointing `assetvault-api.duckdns.org` to `assetvault-api.onrender.com`.
5. Render automatically provisions an SSL/TLS certificate through Let's Encrypt within 1–2 minutes.

---

## 4. Updating Application Environment Variables

Once custom domains are verified, update your environment variables across Render and Vercel:

### In Render (Backend Web Service):
```bash
# Comma-separated list to support default Vercel domain, local development, and custom domain
CLIENT_URL="https://assetvault-app.duckdns.org,https://assetvault.vercel.app"
CORS_ORIGIN="https://assetvault-app.duckdns.org"

# If both API and Web share a parent domain (e.g. app.assetvault.io & api.assetvault.io),
# you can set COOKIE_DOMAIN so cookies are shared across subdomains:
COOKIE_DOMAIN=".assetvault.io"
COOKIE_SAMESITE="lax"

# Update Google OAuth callback URL to your custom API domain:
GOOGLE_CALLBACK_URL="https://assetvault-api.duckdns.org/api/v1/auth/google/callback"
```

### In Vercel (Frontend Web App):
Update the API base URL in **Project Settings** -> **Environment Variables**:
```bash
VITE_API_BASE_URL="https://assetvault-api.duckdns.org/api"
```
Or, if you use Vercel's reverse proxy rewrites in [`frontend/vercel.json`](../frontend/vercel.json), update the rewrite destination:
```json
{
  "source": "/api/(.*)",
  "destination": "https://assetvault-api.duckdns.org/api/$1"
}
```

---

## 5. Google OAuth 2.0 Credentials Update

When deploying on a custom domain, Google Cloud Console requires registering the new URIs:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Select your OAuth 2.0 Client ID for AssetVault.
3. Under **Authorized JavaScript origins**, add:
   - `https://assetvault-app.duckdns.org`
   - `https://assetvault.vercel.app`
4. Under **Authorized redirect URIs**, add:
   - `https://assetvault-api.duckdns.org/api/v1/auth/google/callback`
   - `https://assetvault-api.onrender.com/api/v1/auth/google/callback`
5. Click **Save**. Updates take effect within 5 minutes.

---

## 6. Cross-Subdomain Cookie & CORS Troubleshooting

| Symptom | Cause | Resolution |
|---|---|---|
| `CORS blocked: Origin ... not allowed by policy` | Domain not in `CLIENT_URL` / `CORS_ORIGIN` | Add your custom domain to `CLIENT_URL` (comma-separated list supported). |
| 401 on `/api/auth/refresh` after login | Browser blocked cross-origin cookie | Ensure `COOKIE_SAMESITE` is set to `lax` (with Vercel rewrites) or `none` with `secure: true` (for cross-origin). |
| OAuth redirect fails with `redirect_uri_mismatch` | Google Console missing callback URI | Ensure `GOOGLE_CALLBACK_URL` matches the registered URI in Google Console exactly. |
| SSL warning: Certificate Untrusted | DNS record not fully propagated | Wait 2–5 minutes for Let's Encrypt challenge verification to complete. |
