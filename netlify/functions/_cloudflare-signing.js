/* ==========================================================
   _cloudflare-signing.js — Shared Cloudflare Stream signing
   True Jiu Jitsu Online

   Prefixed with _ to signal this is an internal utility,
   not a Netlify function endpoint.

   Exports two functions:

     generateSignedPlaybackUrl(cloudflareVideoId)
       Returns the signed iframe embed URL for video playback.
       e.g. https://iframe.cloudflarestream.com/{token}

     generateSignedThumbnailUrl(cloudflareVideoId, timeSecs)
       Returns a signed thumbnail image URL using the same JWT.
       e.g. https://videodelivery.net/{token}/thumbnails/thumbnail.jpg?time=2s
       timeSecs defaults to 2 (skips black fade-in frames).

   Both functions use the same RSA-signed JWT. The token's
   'sub' field is the Cloudflare video UID and expiry is
   1 hour. Cloudflare accepts the same token for playback
   and thumbnail access when requireSignedURLs is enabled.

   Environment variables required:
     CLOUDFLARE_STREAM_KEY_ID      — key ID from Cloudflare dashboard
     CLOUDFLARE_STREAM_SIGNING_KEY — base64-encoded RSA PEM private key
   ========================================================== */

const crypto = require('crypto');


/* ----------------------------------------------------------
   Build and sign a JWT for a given Cloudflare video ID.
   Returns just the token string (not the full URL).
   ---------------------------------------------------------- */
function buildSignedToken(cloudflareVideoId) {
  const keyId     = process.env.CLOUDFLARE_STREAM_KEY_ID;
  const pemBase64 = process.env.CLOUDFLARE_STREAM_SIGNING_KEY;

  if (!keyId || !pemBase64) {
    throw new Error('Cloudflare signing credentials are not configured');
  }

  // PEM is stored base64-encoded in the env var
  const pem = Buffer.from(pemBase64, 'base64').toString('utf8');

  // Token expires in 1 hour
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;

  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: cloudflareVideoId,
    kid: keyId,
    exp: expiresAt,
    accessRules: [{ type: 'any', action: 'allow' }],
  })).toString('base64url');

  const signingInput = `${header}.${payload}`;

  const sign      = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(pem, 'base64url');

  return `${signingInput}.${signature}`;
}


/* ----------------------------------------------------------
   Returns a signed iframe embed URL for video playback.
   ---------------------------------------------------------- */
function generateSignedPlaybackUrl(cloudflareVideoId) {
  const token = buildSignedToken(cloudflareVideoId);
  return `https://iframe.cloudflarestream.com/${token}`;
}


/* ----------------------------------------------------------
   Returns a signed thumbnail image URL.

   timeSecs — which frame to use (default: 2s skips black
   fade-in frames that often appear at the very start).
   ---------------------------------------------------------- */
function generateSignedThumbnailUrl(cloudflareVideoId, timeSecs = 2) {
  const token = buildSignedToken(cloudflareVideoId);
  return `https://videodelivery.net/${token}/thumbnails/thumbnail.jpg?time=${timeSecs}s&height=400`;
}


module.exports = { generateSignedPlaybackUrl, generateSignedThumbnailUrl };
