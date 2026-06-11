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
    Source:      `True Jiu-Jitsu <${fromAddress}>`,
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

  const subject = `New waiver — ${data.firstName} ${data.lastName}`;
  const text    = [
    `New waiver submitted`,
    ``,
    `Name: ${data.firstName} ${data.lastName}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `DOB: ${data.dateOfBirth}`,
    `Minor: ${calculateIsMinor(data.dateOfBirth) ? 'Yes' : 'No'}`,
    `Emergency Contact: ${data.emergencyContactName} (${data.emergencyContactPhone})`,
    `Photo Release: ${data.photoRelease ? 'Yes' : 'No'}`,
    `Signed As: ${data.signatureName}`,
    data.guardianName ? `Guardian: ${data.guardianName}` : '',
    ``,
    `Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`,
  ].filter(Boolean).join('\n');

  await ses.sendEmail({
    Source:      `True Jiu-Jitsu <${fromAddress}>`,
    Destination: { ToAddresses: [adminEmail] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Text: { Data: text, Charset: 'UTF-8' } },
    },
  }).promise();
}


/* ----------------------------------------------------------
   Calculate whether a DOB is under 18 today
   ---------------------------------------------------------- */
function calculateIsMinor(dateOfBirth) {
  if (!dateOfBirth) return false;
  const today = new Date();
  const dob   = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age < 18;
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
      is_minor:                 calculateIsMinor(body.dateOfBirth),
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
     Find or create a gym_members record.

     Both drop-in and onboarding modes go through the same
     logic now:

       - If an active/pending member already exists with
         this email, just add a new waiver row linked to
         them — don’t touch their status.

       - If a visitor record exists, add the waiver and
         keep them as a visitor (they’ve been in before).

       - If no record exists at all, create one:
           • drop-in  → status 'visitor'
           • onboarding → status 'pending'

     Either way we link the waiver to the member record
     via gym_member_id so there are no orphaned waivers.
     ---------------------------------------------------------- */
  let gymMemberId = null;

  const email = body.email.trim().toLowerCase();

  const { data: existingMember } = await supabase
    .from('gym_members')
    .select('id, subscription_status')
    .eq('email', email)
    .order('joined_at', { ascending: false })
    .limit(1)
    .single();

  if (existingMember) {
    // Member already exists — link this new waiver to them.
    // We never downgrade status (e.g. an active member doing
    // a new drop-in waiver stays active).
    gymMemberId = existingMember.id;

    await supabase
      .from('gym_members')
      .update({
        // Only fill in phone/plan if the existing record is missing them
        ...(body.planId ? { plan_id: body.planId } : {}),
        waiver_signed:    true,
        waiver_signed_at: new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', gymMemberId);

  } else {
    // No existing record — create one
    const newStatus = body.mode === 'onboarding' ? 'pending' : 'visitor';

    const { data: newMember, error: memberError } = await supabase
      .from('gym_members')
      .insert({
        name:                `${body.firstName.trim()} ${body.lastName.trim()}`,
        email,
        phone:               body.phone.trim(),
        plan_id:             body.planId || null,
        waiver_signed:       true,
        waiver_signed_at:    new Date().toISOString(),
        subscription_status: newStatus,
      })
      .select('id')
      .single();

    if (memberError || !newMember) {
      console.error('Gym member insert error:', memberError);
      // Non-fatal — waiver is saved even if member record fails
    } else {
      gymMemberId = newMember.id;
    }
  }

  // Link the waiver back to the member record
  if (gymMemberId) {
    await supabase
      .from('waiver_submissions')
      .update({ gym_member_id: gymMemberId })
      .eq('id', waiver.id);
  }

  /* ----------------------------------------------------------
     Auto-convert any matching lead.

     If a lead exists with the same email address, link it to
     the gym_member record and mark it converted. This means
     contact form leads are automatically moved off the
     pipeline the moment the person signs a waiver — no
     manual conversion step needed.

     We match on email only, taking the most recent
     non-archived, non-converted lead to avoid touching
     historical records.
     ---------------------------------------------------------- */
  if (gymMemberId && email) {
    try {
      const { data: matchingLead } = await supabase
        .from('leads')
        .select('id')
        .ilike('email', email)
        .is('archived_at', null)
        .neq('stage', 'converted')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (matchingLead) {
        await supabase
          .from('leads')
          .update({
            gym_member_id: gymMemberId,
            stage:         'converted',
          })
          .eq('id', matchingLead.id);

        console.log(`Lead ${matchingLead.id} auto-converted for email ${email}`);
      }
    } catch (err) {
      // Non-fatal — waiver and member record are already saved
      console.error('Lead auto-conversion failed:', err.message);
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
