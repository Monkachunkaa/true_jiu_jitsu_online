/* ==========================================================
   send-email.js — Transactional emails via AWS SES
   True Jiu Jitsu Online

   Sends transactional emails triggered by platform events.
   Called internally by stripe-webhook.js — not directly
   by the client.

   Email types:
     welcome       → sent on checkout.session.completed
     payment-failed → sent on invoice.payment_failed
     cancelled     → sent on customer.subscription.deleted
   ========================================================== */

const AWS = require('aws-sdk');

const ses = new AWS.SES({
  accessKeyId:     process.env.TJJ_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.TJJ_AWS_SECRET_ACCESS_KEY,
  region:          process.env.TJJ_AWS_REGION,
});

const FROM_NAME    = 'True Jiu Jitsu Online';
const FROM_ADDRESS = process.env.SES_FROM_ADDRESS
  ? `${FROM_NAME} <${process.env.SES_FROM_ADDRESS}>`
  : null;
const FROM_RAW     = process.env.SES_FROM_ADDRESS || null;
const SITE_URL     = process.env.SITE_URL || 'https://online.truebjj.academy';


/* ----------------------------------------------------------
   Email templates
   ---------------------------------------------------------- */

function buildWelcomeEmail(name) {
  const firstName = name?.split(' ')[0] || 'there';

  return {
    subject: 'Welcome to True Jiu Jitsu Online',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to True Jiu Jitsu Online</title>
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">

        <!-- Header -->
        <tr>
          <td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #c41e2a;">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#c41e2a;">
              True Jiu Jitsu Online
            </p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">
              Welcome, ${firstName}
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#cccccc;line-height:1.7;">
              Your membership is active. You now have unlimited access to the
              True Jiu Jitsu instructional video library — available anytime, on any device.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#cccccc;line-height:1.7;">
              Your 7-day free trial has started. No charge will be made until the
              trial period ends.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background-color:#c41e2a;border-radius:4px;">
                  <a href="${SITE_URL}"
                     style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;">
                    Start Training
                  </a>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #2a2a2a;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#555555;">
                  You can manage your subscription at any time from your
                  <a href="${SITE_URL}/pages/account.html" style="color:#888888;">account page</a>.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #2a2a2a;">
            <p style="margin:0;font-size:12px;color:#555555;text-align:center;">
              True Jiu Jitsu &nbsp;·&nbsp; Hickory, NC &nbsp;·&nbsp;
              <a href="${SITE_URL}/pages/account.html" style="color:#555555;text-decoration:underline;">Manage Subscription</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: [
      `Welcome to True Jiu Jitsu Online, ${firstName}!`,
      '',
      'Your membership is active. You now have unlimited access to the True Jiu Jitsu instructional video library.',
      '',
      'Your 7-day free trial has started. No charge will be made until the trial period ends.',
      '',
      `Start training: ${SITE_URL}`,
      '',
      `Manage your subscription: ${SITE_URL}/pages/account.html`,
    ].join('\n'),
  };
}

function buildPaymentFailedEmail(name) {
  const firstName = name?.split(' ')[0] || 'there';

  return {
    subject: 'Action required — payment failed',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed — True Jiu Jitsu Online</title>
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">

        <!-- Header -->
        <tr>
          <td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #c41e2a;">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#c41e2a;">
              True Jiu Jitsu Online
            </p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">
              Payment Failed
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#cccccc;line-height:1.7;">
              Hi ${firstName} — we weren't able to process your most recent payment
              for True Jiu Jitsu Online.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#cccccc;line-height:1.7;">
              Your access has been paused. Please update your payment information
              to restore it.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background-color:#c41e2a;border-radius:4px;">
                  <a href="${SITE_URL}/pages/account.html"
                     style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;">
                    Update Payment Method
                  </a>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #2a2a2a;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#555555;">
                  We'll retry the payment automatically. If the issue persists
                  your subscription will be cancelled.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #2a2a2a;">
            <p style="margin:0;font-size:12px;color:#555555;text-align:center;">
              True Jiu Jitsu &nbsp;·&nbsp; Hickory, NC
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: [
      `Hi ${firstName},`,
      '',
      "We weren't able to process your most recent payment for True Jiu Jitsu Online.",
      '',
      'Your access has been paused. Please update your payment information to restore it.',
      '',
      `Update your payment method: ${SITE_URL}/pages/account.html`,
      '',
      "We'll retry the payment automatically. If the issue persists your subscription will be cancelled.",
    ].join('\n'),
  };
}

function buildCancelledEmail(name) {
  const firstName = name?.split(' ')[0] || 'there';

  return {
    subject: 'Your subscription has been cancelled',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Cancelled — True Jiu Jitsu Online</title>
</head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">

        <!-- Header -->
        <tr>
          <td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #2a2a2a;">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#888888;">
              True Jiu Jitsu Online
            </p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">
              Subscription Cancelled
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#cccccc;line-height:1.7;">
              Hi ${firstName} — your True Jiu Jitsu Online subscription has been
              cancelled and your access has ended.
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#cccccc;line-height:1.7;">
              If you'd like to resubscribe in the future, you're always welcome back.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background-color:#2a2a2a;border-radius:4px;border:1px solid #444;">
                  <a href="${SITE_URL}"
                     style="display:inline-block;padding:14px 32px;color:#cccccc;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;">
                    Resubscribe
                  </a>
                </td>
              </tr>
            </table>

            <!-- Divider -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #2a2a2a;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#555555;">
                  You will not be charged again unless you resubscribe.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #2a2a2a;">
            <p style="margin:0;font-size:12px;color:#555555;text-align:center;">
              True Jiu Jitsu &nbsp;·&nbsp; Hickory, NC
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: [
      `Hi ${firstName},`,
      '',
      'Your True Jiu Jitsu Online subscription has been cancelled and your access has ended.',
      '',
      "If you'd like to resubscribe in the future, you're always welcome back.",
      '',
      `Resubscribe: ${SITE_URL}`,
      '',
      'You will not be charged again unless you resubscribe.',
    ].join('\n'),
  };
}


function buildAnnouncementEmail(name, subject, message) {
  const firstName = name?.split(' ')[0] || 'there';
  // Convert newlines to <br> tags for HTML version
  const messageHtml = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  return {
    subject,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr>
          <td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #c41e2a;">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#c41e2a;">True Jiu Jitsu</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">${subject}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;font-size:15px;color:#cccccc;">Hi ${firstName},</p>
            <p style="margin:0;font-size:15px;color:#cccccc;line-height:1.8;">${messageHtml}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #2a2a2a;">
            <p style="margin:0;font-size:12px;color:#555555;text-align:center;">
              True Jiu Jitsu &nbsp;·&nbsp; Hickory, NC
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    text: `Hi ${firstName},\n\n${message}\n\n— True Jiu Jitsu`,
  };
}


/* ----------------------------------------------------------
   GYM MEMBER EMAIL TEMPLATES
   ---------------------------------------------------------- */

function buildGymBillingInviteEmail(name, extra = {}) {
  const firstName   = name?.split(' ')[0] || 'there';
  const checkoutUrl = extra.checkoutUrl || '#';
  const planName    = extra.planName    || 'Membership';
  const priceStr    = extra.priceStr    || '';

  return {
    subject: 'Set up your membership billing — True Jiu Jitsu',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr>
          <td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #c41e2a;">
            <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#c41e2a;">True Jiu Jitsu</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">Welcome, ${firstName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#cccccc;line-height:1.7;">You've been added to the True Jiu Jitsu gym as a <strong style="color:#ffffff;">${planName}</strong> member${priceStr ? ` at <strong style="color:#ffffff;">${priceStr}/month</strong>` : ''}.</p>
            <p style="margin:0 0 28px;font-size:15px;color:#cccccc;line-height:1.7;">Click below to securely enter your payment details. This only takes a minute and you won't be charged until your billing date.</p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr><td style="background-color:#c41e2a;border-radius:4px;">
                <a href="${checkoutUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;">Set Up Billing</a>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="border-top:1px solid #2a2a2a;padding-top:20px;">
                <p style="margin:0;font-size:12px;color:#555555;">This link is secure and expires after 24 hours. If you have any questions, contact us directly.</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr><td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #2a2a2a;">
          <p style="margin:0;font-size:12px;color:#555555;text-align:center;">True Jiu Jitsu &nbsp;·&nbsp; Hickory, NC</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    text: [
      `Welcome to True Jiu Jitsu, ${firstName}!`,
      '',
      `You've been added as a ${planName} member.`,
      '',
      `Set up your billing here: ${checkoutUrl}`,
      '',
      'This link expires after 24 hours.',
    ].join('\n'),
  };
}

function buildGymWelcomeEmail(name) {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: 'Membership confirmed — True Jiu Jitsu',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr><td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #c41e2a;">
          <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#c41e2a;">True Jiu Jitsu</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;">You're all set, ${firstName}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#cccccc;line-height:1.7;">Your membership billing is confirmed. You'll be charged automatically each month — no action needed.</p>
          <p style="margin:0;font-size:15px;color:#cccccc;line-height:1.7;">See you on the mats.</p>
        </td></tr>
        <tr><td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #2a2a2a;">
          <p style="margin:0;font-size:12px;color:#555555;text-align:center;">True Jiu Jitsu &nbsp;·&nbsp; Hickory, NC</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    text: `Hi ${firstName},\n\nYour membership billing is confirmed. You'll be charged automatically each month.\n\nSee you on the mats.`,
  };
}

function buildGymPaymentFailedEmail(name) {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: 'Membership payment failed — True Jiu Jitsu',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr><td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #c41e2a;">
          <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#c41e2a;">True Jiu Jitsu</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;">Payment Failed</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#cccccc;line-height:1.7;">Hi ${firstName} — we weren't able to process your membership payment. Please update your payment method to keep your membership active.</p>
          <p style="margin:0;font-size:14px;color:#888888;">Contact the gym directly if you need help.</p>
        </td></tr>
        <tr><td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #2a2a2a;">
          <p style="margin:0;font-size:12px;color:#555555;text-align:center;">True Jiu Jitsu &nbsp;·&nbsp; Hickory, NC</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    text: `Hi ${firstName},\n\nWe weren't able to process your membership payment. Please contact the gym to update your payment method.`,
  };
}

function buildGymCancelledEmail(name) {
  const firstName = name?.split(' ')[0] || 'there';
  return {
    subject: 'Membership cancelled — True Jiu Jitsu',
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#111111;font-family:Arial,sans-serif;color:#f0f0f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111111;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#1e1e1e;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;">
        <tr><td style="background-color:#0a0a0a;padding:28px 32px;border-bottom:3px solid #2a2a2a;">
          <p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:#888888;">True Jiu Jitsu</p>
          <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;text-transform:uppercase;">Membership Cancelled</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#cccccc;line-height:1.7;">Hi ${firstName} — your True Jiu Jitsu membership has been cancelled. You will not be charged again.</p>
          <p style="margin:0;font-size:15px;color:#cccccc;line-height:1.7;">We hope to see you back on the mats soon.</p>
        </td></tr>
        <tr><td style="background-color:#0a0a0a;padding:20px 32px;border-top:1px solid #2a2a2a;">
          <p style="margin:0;font-size:12px;color:#555555;text-align:center;">True Jiu Jitsu &nbsp;·&nbsp; Hickory, NC</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    text: `Hi ${firstName},\n\nYour True Jiu Jitsu membership has been cancelled. You will not be charged again.\n\nWe hope to see you back soon.`,
  };
}


/* ----------------------------------------------------------
   Send an email via SES
   ---------------------------------------------------------- */
async function sendEmail({ to, name, type, extra = {} }) {
  if (!FROM_ADDRESS) {
    throw new Error('SES_FROM_ADDRESS environment variable is not set');
  }

  let template;

  if (type === 'welcome')             template = buildWelcomeEmail(name);
  else if (type === 'payment-failed')  template = buildPaymentFailedEmail(name);
  else if (type === 'cancelled')       template = buildCancelledEmail(name);
  else if (type === 'gym-welcome')     template = buildGymWelcomeEmail(name);
  else if (type === 'gym-payment-failed') template = buildGymPaymentFailedEmail(name);
  else if (type === 'gym-cancelled')   template = buildGymCancelledEmail(name);
  else if (type === 'gym-billing-invite') template = buildGymBillingInviteEmail(name, extra);
  else throw new Error(`Unknown email type: ${type}`);

  const params = {
    Source:      FROM_RAW,   // bare email — SES verifies against the domain
    ReplyToAddresses: [],
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: template.subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: template.html.replace(/{{FROM_NAME}}/g, FROM_NAME), Charset: 'UTF-8' },
        Text: { Data: template.text, Charset: 'UTF-8' },
      },
    },
  };

  return ses.sendEmail(params).promise();
}


/* ----------------------------------------------------------
   HANDLER — accepts internal POST calls from stripe-webhook
   ---------------------------------------------------------- */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function respond(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON' });
  }

  const { type, to, name, extra } = body;
  if (!type || !to) return respond(400, { error: 'type and to are required' });

  try {
    await sendEmail({ to, name, type, extra });
    return respond(200, { success: true });
  } catch (err) {
    console.error('SES send error:', err);
    return respond(500, { error: 'Failed to send email' });
  }
};

// Also export sendEmail directly so stripe-webhook can call
// it as a module without an HTTP round trip
exports.sendEmail = sendEmail;
