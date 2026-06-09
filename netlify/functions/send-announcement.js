/* ==========================================================
   send-announcement.js — Broadcast email to all active members
   True Jiu Jitsu Online

   Admin only. Sends a custom subject + message to every
   active gym member who has an email address and has not
   opted out of marketing emails.

   Emails are sent individually so each one is personalised
   with the member's first name.

   POST { subject, message }
   Returns { sent, skipped, failed }
   ========================================================== */

const AWS           = require('aws-sdk');
const { createClient } = require('@supabase/supabase-js');

const ses = new AWS.SES({
  accessKeyId:     process.env.TJJ_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.TJJ_AWS_SECRET_ACCESS_KEY,
  region:          process.env.TJJ_AWS_REGION,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function respond(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

/* ----------------------------------------------------------
   Build the personalised email HTML for each recipient
   ---------------------------------------------------------- */
function buildEmail(name, subject, message) {
  const firstName   = (name || '').split(' ')[0] || 'there';
  const messageHtml = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr>
          <td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #c41e2a;">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#c41e2a;">True Jiu Jitsu</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">
              ${subject}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#cccccc;">Hi ${firstName},</p>
            <p style="margin:0;font-size:15px;color:#cccccc;line-height:1.8;">${messageHtml}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #2a2a2a;">
            <p style="margin:0;font-size:12px;color:#555555;text-align:center;">
              True Jiu Jitsu &nbsp;&middot;&nbsp; Hickory, NC
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Hi ${firstName},\n\n${message}\n\n\u2014 True Jiu Jitsu`;

  return { html, text };
}

exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  /* ----------------------------------------------------------
     Verify admin
     ---------------------------------------------------------- */
  const token = (event.headers.authorization || '').replace('Bearer ', '');
  if (!token) return respond(401, { error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond(401, { error: 'Unauthorized' });

  const { data: admin } = await supabase
    .from('admins').select('id').eq('email', user.email).single();
  if (!admin) return respond(403, { error: 'Admin access required' });

  /* ----------------------------------------------------------
     Parse and validate request
     ---------------------------------------------------------- */
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  const { subject, message } = body;
  if (!subject?.trim()) return respond(400, { error: 'Subject is required' });
  if (!message?.trim()) return respond(400, { error: 'Message is required' });

  /* ----------------------------------------------------------
     Fetch eligible recipients:
       - Active subscription
       - Has an email address
       - Has not opted out
     ---------------------------------------------------------- */
  const { data: members, error: membersError } = await supabase
    .from('gym_members')
    .select('id, name, email')
    .eq('subscription_status', 'active')
    .eq('marketing_opt_out', false)
    .not('email', 'is', null);

  if (membersError) {
    console.error('Failed to fetch members:', membersError);
    return respond(500, { error: 'Failed to fetch recipients' });
  }

  if (!members?.length) {
    return respond(200, { sent: 0, skipped: 0, failed: 0, message: 'No eligible recipients' });
  }

  const fromAddress = process.env.SES_FROM_ADDRESS;
  if (!fromAddress) return respond(500, { error: 'SES_FROM_ADDRESS not configured' });

  const fromFormatted = `True Jiu-Jitsu <${fromAddress}>`;

  /* ----------------------------------------------------------
     Send emails one by one.
     We track sent / failed counts and never throw — a single
     failed send shouldn't abort the whole batch.
     ---------------------------------------------------------- */
  let sent    = 0;
  let failed  = 0;
  const skipped = 0; // reserved for future use (e.g. invalid emails)

  for (const member of members) {
    const { html, text } = buildEmail(member.name, subject, message);

    try {
      await ses.sendEmail({
        Source:      fromFormatted,
        Destination: { ToAddresses: [member.email] },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: html, Charset: 'UTF-8' },
            Text: { Data: text, Charset: 'UTF-8' },
          },
        },
      }).promise();

      sent++;
    } catch (err) {
      console.error(`Failed to send to ${member.email}:`, err.message);
      failed++;
    }
  }

  console.log(`Announcement sent — subject: "${subject}", sent: ${sent}, failed: ${failed}`);
  return respond(200, { sent, skipped, failed });
};
