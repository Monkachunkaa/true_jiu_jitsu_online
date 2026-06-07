/* ==========================================================
   submit-waiver.js — Save a waiver submission
   True Jiu Jitsu Online

   Public endpoint — no auth required. Called from both the
   standalone waiver (drop-in) and full onboarding flow.

   For onboarding mode, also creates a gym_members record
   and returns the gymMemberId so the frontend can proceed
   to billing setup.

   POST {
     mode: 'drop-in' | 'onboarding',
     firstName, lastName, dateOfBirth, isMinor,
     phone, email,
     emergencyContactName, emergencyContactPhone,
     agreedAssumptionOfRisk, agreedMedicalResponsibility,
     agreedLiabilityWaiver, agreedHoldHarmless,
     agreedGymRules, photoRelease,
     signatureName, guardianName?,
     planId?   (onboarding only)
   }
   Returns { success: true, gymMemberId? }
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
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function respond(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

/* ----------------------------------------------------------
   Send confirmation email to the submitter
   ---------------------------------------------------------- */
async function sendConfirmationEmail(email, name, mode) {
  const fromAddress = process.env.SES_FROM_ADDRESS;
  if (!fromAddress) return;

  const subject = 'Your True Jiu Jitsu waiver has been received';
  const modeNote = mode === 'onboarding'
    ? 'You will receive a separate email with your billing setup link shortly.'
    : 'If you have any questions, feel free to contact the gym directly.';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr>
          <td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #c41e2a;">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#c41e2a;">True Jiu Jitsu</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">Waiver Received</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#cccccc;">Hi ${name},</p>
            <p style="margin:0 0 16px;font-size:15px;color:#cccccc;line-height:1.7;">
              We have received your signed participation waiver for True Jiu Jitsu and Fitness.
              Your electronic signature has been recorded and this serves as your official confirmation.
            </p>
            <p style="margin:0;font-size:15px;color:#cccccc;line-height:1.7;">${modeNote}</p>
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

  await ses.sendEmail({
    Source:      fromAddress,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html, Charset: 'UTF-8' },
        Text: { Data: `Hi ${name},\n\nWe have received your signed participation waiver for True Jiu Jitsu and Fitness.\n\n${modeNote}\n\n— True Jiu Jitsu`, Charset: 'UTF-8' },
      },
    },
  }).promise();
}

/* ----------------------------------------------------------
   Send notification email to the admin
   ---------------------------------------------------------- */
async function sendAdminNotification(data, mode) {
  const fromAddress  = process.env.SES_FROM_ADDRESS;
  const adminEmail   = process.env.WAIVER_NOTIFICATION_EMAIL || process.env.SES_TO_ADDRESS;
  if (!fromAddress || !adminEmail) return;

  const subject = `New ${mode === 'onboarding' ? 'member onboarding' : 'drop-in waiver'} — ${data.firstName} ${data.lastName}`;
  const text    = [
    `New waiver submitted`,
    ``,
    `Name: ${data.firstName} ${data.lastName}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `DOB: ${data.dateOfBirth}`,
    `Minor: ${data.isMinor ? 'Yes' : 'No'}`,
    `Emergency Contact: ${data.emergencyContactName} (${data.emergencyContactPhone})`,
    `Photo Release: ${data.photoRelease ? 'Yes' : 'No'}`,
    `Signed As: ${data.signatureName}`,
    data.guardianName ? `Guardian: ${data.guardianName}` : '',
    ``,
    `Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
  ].filter(Boolean).join('\n');

  await ses.sendEmail({
    Source:      fromAddress,
    Destination: { ToAddresses: [adminEmail] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: text, Charset: 'UTF-8' } },
    },
  }).promise();
}


exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return respond(405, { error: 'Method not allowed' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON' }); }

  /* ----------------------------------------------------------
     Validate required fields
     ---------------------------------------------------------- */
  const required = [
    'firstName', 'lastName', 'dateOfBirth', 'phone', 'email',
    'emergencyContactName', 'emergencyContactPhone', 'signatureName',
  ];
  const missing = required.filter(k => !body[k]?.trim());
  if (missing.length) return respond(400, { error: `Missing: ${missing.join(', ')}` });

  const mustAgree = [
    'agreedAssumptionOfRisk', 'agreedMedicalResponsibility',
    'agreedLiabilityWaiver', 'agreedHoldHarmless', 'agreedGymRules',
  ];
  const notAgreed = mustAgree.filter(k => !body[k]);
  if (notAgreed.length) return respond(400, { error: 'All waiver sections must be agreed to' });

  /* ----------------------------------------------------------
     Get audit trail info
     ---------------------------------------------------------- */
  const ipAddress = event.headers['x-nf-client-connection-ip']
    || event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || null;
  const userAgent = event.headers['user-agent'] || null;

  /* ----------------------------------------------------------
     Save waiver submission
     ---------------------------------------------------------- */
  const { data: waiver, error: waiverError } = await supabase
    .from('waiver_submissions')
    .insert({
      first_name:               body.firstName.trim(),
      last_name:                body.lastName.trim(),
      date_of_birth:            body.dateOfBirth,
      is_minor:                 !!body.isMinor,
      phone:                    body.phone.trim(),
      email:                    body.email.trim().toLowerCase(),
      emergency_contact_name:   body.emergencyContactName.trim(),
      emergency_contact_phone:  body.emergencyContactPhone.trim(),
      agreed_assumption_of_risk:     true,
      agreed_medical_responsibility: true,
      agreed_liability_waiver:       true,
      agreed_hold_harmless:          true,
      agreed_gym_rules:              true,
      photo_release:            !!body.photoRelease,
      signature_name:           body.signatureName.trim(),
      guardian_name:            body.guardianName?.trim() || null,
      ip_address:               ipAddress,
      user_agent:               userAgent,
      submission_type:          body.mode === 'onboarding' ? 'onboarding' : 'drop-in',
    })
    .select('id')
    .single();

  if (waiverError || !waiver) {
    console.error('Waiver insert error:', waiverError);
    return respond(500, { error: 'Failed to save waiver' });
  }

  /* ----------------------------------------------------------
     If onboarding mode: create a gym_members record
     ---------------------------------------------------------- */
  let gymMemberId = null;

  if (body.mode === 'onboarding') {
    // Check if a gym member with this email already exists
    const { data: existingMember } = await supabase
      .from('gym_members')
      .select('id')
      .eq('email', body.email.trim().toLowerCase())
      .single();

    if (existingMember) {
      // Update existing member with waiver info
      gymMemberId = existingMember.id;
      await supabase
        .from('gym_members')
        .update({
          waiver_signed:    true,
          waiver_signed_at: new Date().toISOString(),
          waiver_id:        waiver.id,
          plan_id:          body.planId || null,
          updated_at:       new Date().toISOString(),
        })
        .eq('id', gymMemberId);
    } else {
      // Create a new gym member record
      const { data: newMember, error: memberError } = await supabase
        .from('gym_members')
        .insert({
          name:             `${body.firstName.trim()} ${body.lastName.trim()}`,
          email:            body.email.trim().toLowerCase(),
          phone:            body.phone.trim(),
          belt_rank:        'unknown',
          plan_id:          body.planId || null,
          waiver_signed:    true,
          waiver_signed_at: new Date().toISOString(),
          waiver_id:        waiver.id,
          subscription_status: 'pending',
        })
        .select('id')
        .single();

      if (memberError || !newMember) {
        console.error('Gym member insert error:', memberError);
        // Non-fatal — waiver is saved, just couldn't create member
      } else {
        gymMemberId = newMember.id;
      }
    }

    // Link gym member back to waiver
    if (gymMemberId) {
      await supabase
        .from('waiver_submissions')
        .update({ gym_member_id: gymMemberId })
        .eq('id', waiver.id);
    }
  }

  /* ----------------------------------------------------------
     Send emails — non-fatal if they fail
     ---------------------------------------------------------- */
  try {
    await sendConfirmationEmail(
      body.email,
      body.firstName,
      body.mode || 'drop-in'
    );
  } catch (err) {
    console.error('Confirmation email failed:', err.message);
  }

  try {
    await sendAdminNotification(body, body.mode || 'drop-in');
  } catch (err) {
    console.error('Admin notification failed:', err.message);
  }

  return respond(200, {
    success:     true,
    waivererId:  waiver.id,
    gymMemberId: gymMemberId,
  });
};
