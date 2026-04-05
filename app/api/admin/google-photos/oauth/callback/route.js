import { getPlatformConfig } from "@/lib/env";
import { createGooglePhotosPickingSessionWithToken } from "@/lib/google-photos-picker";

export const runtime = "nodejs";

function htmlPage(script, bodyText) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Google Photos</title></head><body>
<p>${bodyText}</p>
<script>${script}</script>
</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const maxItemCount = Number(searchParams.get("state") || "25");

  if (error || !code) {
    const msg = error === "access_denied" ? "Authorization was cancelled." : (error || "Authorization failed.");
    return htmlPage(
      `try { window.opener.postMessage({ type: "google-photos-oauth", error: ${JSON.stringify(msg)} }, "*"); } catch(e) {} window.close();`,
      "Authorization failed. You can close this window."
    );
  }

  const config = getPlatformConfig();
  const clientId = config.googleClientId || config.googleOauthClientId;
  const clientSecret = config.googleClientSecret || config.googleOauthClientSecret;
  const redirectUri = `${proto}://${host}/api/admin/google-photos/oauth/callback`;

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokenText = await tokenResponse.text();
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed (${tokenResponse.status}): ${tokenText}`);
    }

    const tokenData = JSON.parse(tokenText);
    if (!tokenData.access_token) {
      throw new Error("Token exchange did not return an access token.");
    }

    const session = await createGooglePhotosPickingSessionWithToken(tokenData.access_token, maxItemCount);

    const sessionJson = JSON.stringify({ id: session.id, pickerUri: session.pickerUri, pollIntervalMs: session.pollIntervalMs, expireTime: session.expireTime, mediaItemsSet: session.mediaItemsSet, accessToken: tokenData.access_token });

    return htmlPage(
      `try { window.opener.postMessage({ type: "google-photos-oauth", session: ${sessionJson} }, "*"); } catch(e) {} window.location.href = ${JSON.stringify(session.pickerUri)};`,
      "Redirecting to Google Photos picker..."
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth flow failed.";
    return htmlPage(
      `try { window.opener.postMessage({ type: "google-photos-oauth", error: ${JSON.stringify(msg)} }, "*"); } catch(e) {} window.close();`,
      `Error: ${msg}`
    );
  }
}
