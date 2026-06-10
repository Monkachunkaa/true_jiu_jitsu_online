/* ==========================================================
   admin-manual.js — Admin User Manual
   True Jiu Jitsu Online

   Self-contained manual page. All content lives here as
   structured data so it's easy to update without touching
   HTML. The renderManual() function builds the page.
   ========================================================== */


/* ----------------------------------------------------------
   MANUAL CONTENT
   Each section has an id (used for anchor links), a title,
   and an array of content blocks.

   Block types:
     { type: 'p',        text: '...' }
     { type: 'h3',       text: '...' }
     { type: 'ul',       items: ['...'] }
     { type: 'ol',       items: ['...'] }
     { type: 'callout',  variant: 'info|warning|tip', text: '...' }
     { type: 'screenshot', caption: '...' }
     { type: 'table',    headers: [...], rows: [[...]] }
   ---------------------------------------------------------- */
const MANUAL_SECTIONS = [

  /* ========================================================
     OVERVIEW
     ======================================================== */
  {
    id:    'overview',
    title: 'Overview',
    icon:  '&#x1F3E0;',
    blocks: [
      { type: 'p', text: 'This manual covers the True Jiu Jitsu admin portal — the back-end tool used to manage gym members, waivers, membership plans, content, and announcements. The portal lives at <code>/pages/admin/</code> and is only accessible to users listed in the <code>admins</code> table in Supabase.' },
      { type: 'p', text: 'The admin portal is divided into two areas: <strong>Members</strong> (people, billing, waivers) and <strong>Content</strong> (videos, articles, playlists). Most day-to-day work happens in the Members section.' },
      { type: 'callout', variant: 'info', text: 'The portal works on mobile, though the Members table is easier to use on a tablet or desktop where more columns are visible at once.' },
    ],
  },

  /* ========================================================
     MEMBER STATUSES
     ======================================================== */
  {
    id:    'member-statuses',
    title: 'Member Statuses',
    icon:  '&#x1F3F7;',
    blocks: [
      { type: 'p', text: 'Every gym member record has a <strong>status</strong> that describes where they are in the membership lifecycle. Understanding these is key to knowing what actions are available for each member.' },
      {
        type: 'table',
        headers: ['Status', 'Meaning', 'How they get here'],
        rows: [
          ['Visitor',   'Signed a waiver (drop-in or onboarding form), no billing set up yet.',           'Waiver submitted on the public drop-in or member onboarding form.'],
          ['Pending',   'Admin has assigned a plan and sent a billing link; awaiting payment setup.',      'Admin clicks "Send Billing Link", or member was added manually.'],
          ['Active',    'Billing is live. Stripe subscription confirmed.',                                  'Member completes Stripe checkout after receiving a billing link.'],
          ['Past Due',  'Payment failed. Stripe was unable to charge the card on file.',                   'Stripe webhook fires when a payment attempt fails.'],
          ['Cancelled', 'Membership was cancelled. No active subscription.',                               'Admin cancels manually, or member cancels through their account.'],
          ['Archived',  'Record hidden from the default view. Subscription cancelled. Data preserved.',    'Admin selects "Archive member" from the overflow menu.'],
        ],
      },
      { type: 'callout', variant: 'tip', text: 'Archived members never appear in the default table view but are never deleted. Use "Show Archived" to find them if you ever need to look up a past member\'s record or waiver for legal purposes.' },
    ],
  },

  /* ========================================================
     ADDING A MEMBER
     ======================================================== */
  {
    id:    'adding-members',
    title: 'Adding a Member',
    icon:  '&#x2795;',
    blocks: [
      { type: 'p', text: 'There are three ways a new member record gets created. The right one depends on the situation.' },

      { type: 'h3', text: 'Option 1 — Walk-in signs a waiver (automatic)' },
      { type: 'p', text: 'When anyone fills out the public drop-in waiver at <code>/waiver</code> or the onboarding form at <code>/join</code>, a member record is automatically created in the background. No admin action needed.' },
      { type: 'ul', items: [
        'Drop-in waiver → status set to <strong>Visitor</strong>',
        'Onboarding form → status set to <strong>Pending</strong>',
        'If the email already exists in the system, the new waiver is linked to the existing record. Status is never downgraded (an active member who signs a drop-in waiver stays active).',
      ]},
      { type: 'screenshot', caption: 'The public drop-in waiver at /waiver — submitting this creates a Visitor record automatically.' },

      { type: 'h3', text: 'Option 2 — Fill out the form on this device' },
      { type: 'p', text: 'Use this when a new member is standing in front of you and you want to enter their details directly.' },
      { type: 'ol', items: [
        'Click <strong>+ Add Member</strong> in the top-right of the Members page.',
        'Choose <strong>"Fill out on this device"</strong>.',
        'Enter their name, email, phone, membership plan, and any discount.',
        'Click <strong>Add Member</strong>. The record is created with status <strong>Pending</strong>.',
        'Click <strong>Send Billing Link</strong> on their row to email them a Stripe checkout link.',
      ]},
      { type: 'callout', variant: 'warning', text: 'This path does not collect a waiver. The member will need to sign one separately — either on the public form or on a tablet in the gym.' },
      { type: 'screenshot', caption: 'The Add Member modal — "Fill out on this device" option.' },

      { type: 'h3', text: 'Option 3 — Send an onboarding link' },
      { type: 'p', text: 'Use this when you want the member to complete everything themselves from home — their info, their waiver, and their billing — all in one flow.' },
      { type: 'ol', items: [
        'Click <strong>+ Add Member</strong>.',
        'Choose <strong>"Send onboarding link"</strong>.',
        'Enter their email address and click <strong>Send Link</strong>.',
        'They receive an email with a link to <code>/join</code>, where they fill out their info, choose a plan, sign the waiver, and set up billing in one session.',
        'When they complete billing, their record is automatically set to <strong>Active</strong>.',
      ]},
      { type: 'screenshot', caption: 'The "Send Onboarding Link" modal.' },
    ],
  },

  /* ========================================================
     BILLING
     ======================================================== */
  {
    id:    'billing',
    title: 'Billing & Stripe',
    icon:  '&#x1F4B3;',
    blocks: [
      { type: 'p', text: 'Billing is handled entirely through Stripe. The admin portal does not store card details — it only stores a Stripe subscription ID that links the member record to their subscription in Stripe.' },

      { type: 'h3', text: 'Sending a billing link' },
      { type: 'p', text: 'Any member with status <strong>Visitor</strong> or <strong>Pending</strong> will have a <strong>Send Billing Link</strong> button on their row.' },
      { type: 'ol', items: [
        'Make sure the member has an email address and a plan assigned. If either is missing, the button will show an error toast.',
        'Click <strong>Send Billing Link</strong>.',
        'The portal creates a Stripe Checkout session and emails the member a link.',
        'When they complete checkout, Stripe fires a webhook that sets their status to <strong>Active</strong>.',
      ]},
      { type: 'callout', variant: 'info', text: 'You can send the billing link more than once — for example if the member lost their email or the link expired. Each click generates a fresh Stripe Checkout session.' },

      { type: 'h3', text: 'Cancelling a membership' },
      { type: 'p', text: 'Active members have a red <strong>Cancel</strong> button on their row. Clicking it shows an inline confirmation. Confirming cancels the Stripe subscription immediately (not at period end) and sets the status to <strong>Cancelled</strong>.' },
      { type: 'callout', variant: 'warning', text: 'Cancellation is immediate. The member loses access as soon as you confirm — they are not billed again, and there is no proration.' },

      { type: 'h3', text: 'Discounts' },
      { type: 'p', text: 'When adding or editing a member, you can apply a percentage discount. This is applied to the plan price when calculating MRR estimates in the portal, and is sent to Stripe when the billing link is generated.' },
      { type: 'ul', items: [
        '<strong>Indefinite</strong> — the discount applies permanently.',
        '<strong>Set duration</strong> — enter a number of months. After that period, Stripe reverts to full price automatically.',
        'Leave the percentage blank to remove any discount.',
      ]},
    ],
  },

  /* ========================================================
     WAIVERS
     ======================================================== */
  {
    id:    'waivers',
    title: 'Waivers',
    icon:  '&#x1F4CB;',
    blocks: [
      { type: 'p', text: 'Waivers are the foundation of the member system. Every person who sets foot in the gym should have a signed waiver on file.' },

      { type: 'h3', text: 'How waivers are collected' },
      { type: 'ul', items: [
        '<strong>Drop-in waiver</strong> — public form at <code>/waiver</code>. Intended for one-time visitors and walk-ins. Automatically creates a <strong>Visitor</strong> member record.',
        '<strong>Onboarding form</strong> — public form at <code>/join</code>. Includes waiver + plan selection + billing setup. Creates a <strong>Pending</strong> record on submission, <strong>Active</strong> when billing completes.',
      ]},
      { type: 'callout', variant: 'tip', text: 'Quick links to both public forms are available at the top right of the Waivers page for easy sharing or QR code generation.' },

      { type: 'h3', text: 'Viewing waiver submissions' },
      { type: 'p', text: 'The <strong>Waivers</strong> page lists all submissions. Click <strong>View</strong> on any row to see the full submission — personal info, all agreed sections, photo release, signature, and the IP address/timestamp audit trail.' },
      { type: 'screenshot', caption: 'The Waivers table and detail modal.' },

      { type: 'h3', text: 'Waiver count on the Members table' },
      { type: 'p', text: 'The <strong>Waivers Signed</strong> column on the Members table shows how many waiver submissions are linked to each member. A member can have more than one waiver — for example if they signed a drop-in waiver before becoming a full member, or if they re-signed after a waiver update.' },

      { type: 'h3', text: 'Deleting a waiver' },
      { type: 'p', text: 'Waivers can be deleted from the Waivers table using the <strong>Delete</strong> button. Use this only to remove test submissions or obvious duplicates — a signed waiver is a legal document and should generally be kept permanently.' },
      { type: 'callout', variant: 'warning', text: 'Deleting a waiver is permanent and cannot be undone. When you archive or delete a member record, their waivers are preserved — the link is set to null, but the waiver row itself remains in the database.' },
    ],
  },

  /* ========================================================
     ARCHIVING MEMBERS
     ======================================================== */
  {
    id:    'archiving',
    title: 'Archiving Members',
    icon:  '&#x1F4E6;',
    blocks: [
      { type: 'p', text: 'Archiving is the correct way to remove someone from your day-to-day view. It is a soft action — the member\'s record, history, and waivers are fully preserved. Nothing is deleted.' },

      { type: 'h3', text: 'When to archive' },
      { type: 'ul', items: [
        'A member is permanently banned from the gym.',
        'A test record was added during setup.',
        'A duplicate record needs to be hidden (keep the correct one, archive the duplicate).',
        'A member has left and you want a clean table without fully deleting their history.',
      ]},

      { type: 'h3', text: 'How to archive' },
      { type: 'ol', items: [
        'Find the member in the table.',
        'Click the <strong>&bull;&bull;&bull;</strong> overflow button on the far right of their row.',
        'Click <strong>Archive member</strong>.',
        'If they have an active subscription, the confirmation prompt will warn you: <em>"Their active subscription will be cancelled."</em>',
        'Confirm to proceed. The subscription is cancelled in Stripe, and the member disappears from the default view.',
      ]},
      { type: 'screenshot', caption: 'The overflow menu showing "Archive member".' },

      { type: 'h3', text: 'Viewing archived members' },
      { type: 'p', text: 'Click <strong>Show Archived</strong> in the filter bar. The table switches to show only archived members, with a muted visual treatment. The "Joined" column header changes to "Archived" to show when they were archived.' },

      { type: 'h3', text: 'Unarchiving a member' },
      { type: 'p', text: 'In the archived view, each row\'s overflow menu shows <strong>Unarchive member</strong>. Clicking it immediately restores the member to the active view with no confirmation needed. Their status and data are unchanged — unarchiving does not reinstate any Stripe subscription.' },
      { type: 'callout', variant: 'tip', text: 'If you unarchive a member who had an active subscription before archiving, their status will show as Cancelled (since the subscription was cancelled at archive time). You\'ll need to send them a new billing link to reactivate.' },
    ],
  },

  /* ========================================================
     MEMBERSHIP PLANS
     ======================================================== */
  {
    id:    'plans',
    title: 'Membership Plans',
    icon:  '&#x1F4B0;',
    blocks: [
      { type: 'p', text: 'Membership plans define the pricing tiers available to gym members. Plans are created in the admin portal and stored in Supabase. Each plan maps to a Stripe Price object, which handles the actual recurring billing.' },

      { type: 'h3', text: 'Creating a plan' },
      { type: 'ol', items: [
        'Go to <strong>Membership Plans</strong> in the sidebar.',
        'Click <strong>+ New Plan</strong>.',
        'Enter the plan name, monthly price in dollars, and an optional description.',
        'Optionally enable <strong>Includes online video access</strong> — this flag appears on the onboarding form so prospective members know what they\'re getting.',
        'Click <strong>Save</strong>. The plan is immediately available when assigning plans to members.',
      ]},
      { type: 'callout', variant: 'warning', text: 'Price changes do not automatically update existing members\' Stripe subscriptions — they only affect new billing links created after the change. To update an existing member\'s price, edit their plan assignment and re-send their billing link.' },

      { type: 'h3', text: 'Display order' },
      { type: 'p', text: 'Plans can be reordered by dragging them in the Plans list. The order here is the order members see on the onboarding form at <code>/join</code>.' },

      { type: 'h3', text: 'Deactivating a plan' },
      { type: 'p', text: 'Toggling a plan inactive hides it from the onboarding form and from the plan assignment dropdown when adding new members. Existing members on that plan are unaffected.' },
    ],
  },

  /* ========================================================
     ANNOUNCEMENTS
     ======================================================== */
  {
    id:    'announcements',
    title: 'Announcements',
    icon:  '&#x1F4E3;',
    blocks: [
      { type: 'p', text: 'Announcements are bulk emails sent to all active gym members. Use them for schedule changes, event reminders, closures, or any gym-wide communication.' },

      { type: 'h3', text: 'Sending an announcement' },
      { type: 'ol', items: [
        'Go to <strong>Announcements</strong> in the sidebar.',
        'Click <strong>+ New Announcement</strong>.',
        'Write your subject line and message body. The body supports basic rich text formatting.',
        'Click <strong>Send to All Members</strong>.',
        'The email is sent immediately to every member with status <strong>Active</strong>.',
      ]},
      { type: 'callout', variant: 'warning', text: 'Announcements go to Active members only — Visitors, Pending, and Cancelled members do not receive them. There is no undo once sent.' },
      { type: 'screenshot', caption: 'The announcement composer.' },
    ],
  },

  /* ========================================================
     VIDEOS
     ======================================================== */
  {
    id:    'videos',
    title: 'Videos',
    icon:  '&#x1F3A5;',
    blocks: [
      { type: 'p', text: 'Videos are the core content of the online platform. They are stored in Cloudflare Stream and surfaced to members through the portal.' },

      { type: 'h3', text: 'Uploading a video' },
      { type: 'ol', items: [
        'Go to <strong>Videos</strong> in the sidebar.',
        'Click <strong>Upload Video</strong> (or navigate directly with <code>/pages/admin/videos.html?action=upload</code>).',
        'Drag and drop a video file or click to browse.',
        'Add a title, description, and tags while the video uploads to Cloudflare.',
        'Optionally upload a thumbnail image.',
        'Toggle <strong>Published</strong> when ready to make it visible to members. Unpublished videos are not shown in the catalogue.',
      ]},
      { type: 'callout', variant: 'info', text: 'Video processing in Cloudflare takes a few minutes after upload. The video will appear in the library immediately, but playback may not be available until processing completes.' },
      { type: 'screenshot', caption: 'The video upload modal.' },

      { type: 'h3', text: 'Tags' },
      { type: 'p', text: 'Tags categorize videos and power the search and filter system on the member-facing catalogue. Tags are grouped (e.g. Position, Technique, Level). Assign as many as are relevant — members can filter by any combination of tags.' },

      { type: 'h3', text: 'Editing and deleting' },
      { type: 'p', text: 'Click <strong>Edit</strong> on any video row to update its metadata. Deleting a video removes it from the database but does <em>not</em> delete it from Cloudflare Stream — do that separately in the Cloudflare dashboard if needed.' },
    ],
  },

  /* ========================================================
     PLAYLISTS
     ======================================================== */
  {
    id:    'playlists',
    title: 'Playlists',
    icon:  '&#x1F4FC;',
    blocks: [
      { type: 'p', text: 'Playlists are ordered collections of videos and articles. They appear in the member catalogue and show a progress indicator as members work through the content.' },

      { type: 'h3', text: 'Creating a playlist' },
      { type: 'ol', items: [
        'Go to <strong>Playlists</strong> in the sidebar.',
        'Click <strong>+ New Playlist</strong>.',
        'Add a title, description, and optional thumbnail.',
        'Use the content search box to find and add videos or articles. Drag them to reorder.',
        'Toggle <strong>Published</strong> when ready.',
      ]},

      { type: 'h3', text: 'Progress tracking' },
      { type: 'p', text: 'Member progress is tracked automatically as they watch videos. The Analytics page shows average completion rates per playlist. Members see their own progress on the Playlist page.' },
    ],
  },

  /* ========================================================
     ARTICLES
     ======================================================== */
  {
    id:    'articles',
    title: 'Articles',
    icon:  '&#x1F4F0;',
    blocks: [
      { type: 'p', text: 'Articles are long-form written content — technique breakdowns, training notes, gym news, etc. They live alongside videos in the catalogue and can be added to playlists.' },

      { type: 'h3', text: 'Writing an article' },
      { type: 'ol', items: [
        'Go to <strong>Articles</strong> in the sidebar.',
        'Click <strong>+ New Article</strong>.',
        'Write your content in the rich text editor. Supports headings, bold, italic, lists, and images.',
        'Add tags to make the article discoverable in the catalogue.',
        'Toggle <strong>Published</strong> when ready.',
      ]},
    ],
  },

  /* ========================================================
     ANALYTICS
     ======================================================== */
  {
    id:    'analytics',
    title: 'Analytics',
    icon:  '&#x1F4CA;',
    blocks: [
      { type: 'p', text: 'The Analytics page gives a snapshot of the health of the business and the engagement with online content.' },

      { type: 'h3', text: 'What\'s on the page' },
      {
        type: 'table',
        headers: ['Chart', 'What it shows'],
        rows: [
          ['Members Over Time',        'Cumulative gym and online member counts over the last 6 months.'],
          ['New vs Churned',           'Side-by-side bar chart of new sign-ups and cancellations per month.'],
          ['Monthly Revenue by Plan',  'MRR broken out by membership plan, accounting for discounts. Online subscriptions shown as their own bar.'],
          ['Most Watched Videos',      'Top videos by total view count.'],
          ['Avg Playlist Completion',  'Average percentage of each playlist that members have completed.'],
        ],
      },
      { type: 'callout', variant: 'info', text: 'Revenue figures are estimates based on plan prices and discounts recorded in the portal. They may differ slightly from Stripe\'s actual revenue if any billing adjustments were made directly in Stripe.' },
    ],
  },

  /* ========================================================
     ONLINE MEMBERS (VIDEO SUBSCRIPTIONS)
     ======================================================== */
  {
    id:    'online-members',
    title: 'Online Members',
    icon:  '&#x1F4BB;',
    blocks: [
      { type: 'p', text: 'The platform has two separate member populations that overlap but are not the same thing:' },
      {
        type: 'table',
        headers: ['Table', 'Who they are', 'How they sign up'],
        rows: [
          ['gym_members',  'Physical gym members. Managed through the Members admin page.',             'Walk-in waiver, onboarding form, or admin adds them manually.'],
          ['members',      'Online video subscribers. Pay $8.99/mo for video access only.',             'Subscribe through the public website at /subscribe.'],
        ],
      },
      { type: 'p', text: 'Some people will be in both tables — a gym member whose plan includes online access, for example. The portal does not currently manage online-only subscribers directly. Their billing is handled through Stripe Checkout on the public site, and their status is updated via Stripe webhook.' },
      { type: 'callout', variant: 'info', text: 'Online subscriber management (refunds, cancellations) should be done directly in the Stripe dashboard for now.' },
    ],
  },

  /* ========================================================
     SUPABASE MIGRATIONS
     ======================================================== */
  {
    id:    'migrations',
    title: 'Required Database Migrations',
    icon:  '&#x1F5C4;',
    blocks: [
      { type: 'p', text: 'The following SQL migrations need to be run in the Supabase SQL editor whenever noted during development. They are collected here for reference.' },

      { type: 'h3', text: 'Add visitor status to gym_members' },
      { type: 'p', text: 'Required for the waiver → member creation workflow where drop-ins get status "visitor".' },
      {
        type: 'code',
        text: `ALTER TABLE gym_members DROP CONSTRAINT IF EXISTS gym_members_subscription_status_check;

ALTER TABLE gym_members ADD CONSTRAINT gym_members_subscription_status_check
  CHECK (subscription_status IN (
    'visitor', 'pending', 'active', 'past_due', 'cancelled', 'inactive'
  ));`,
      },

      { type: 'h3', text: 'Add gym_member_id to waiver_submissions' },
      { type: 'p', text: 'Links every waiver to the gym member record it belongs to.' },
      {
        type: 'code',
        text: `ALTER TABLE waiver_submissions
  ADD COLUMN IF NOT EXISTS gym_member_id UUID
  REFERENCES gym_members(id) ON DELETE SET NULL;`,
      },

      { type: 'h3', text: 'Add archived_at to gym_members' },
      { type: 'p', text: 'Enables soft-delete (archiving) of member records.' },
      {
        type: 'code',
        text: `ALTER TABLE gym_members
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;`,
      },

      { type: 'callout', variant: 'warning', text: 'Run migrations in the Supabase SQL editor (Database → SQL Editor). Always back up your data before running schema changes in production.' },
    ],
  },

];


/* ----------------------------------------------------------
   Render a single content block
   ---------------------------------------------------------- */
function renderBlock(block) {
  switch (block.type) {

    case 'p':
      return `<p class="manual-p">${block.text}</p>`;

    case 'h3':
      return `<h3 class="manual-h3">${block.text}</h3>`;

    case 'ul':
      return `<ul class="manual-list">${block.items.map(i => `<li>${i}</li>`).join('')}</ul>`;

    case 'ol':
      return `<ol class="manual-list manual-list--ordered">${block.items.map(i => `<li>${i}</li>`).join('')}</ol>`;

    case 'callout':
      return `
        <div class="manual-callout manual-callout--${block.variant}">
          <span class="manual-callout__icon">${calloutIcon(block.variant)}</span>
          <p>${block.text}</p>
        </div>`;

    case 'screenshot':
      return `
        <div class="manual-screenshot">
          <div class="manual-screenshot__placeholder">
            <span>&#x1F4F7;</span>
            <p>${block.caption}</p>
          </div>
        </div>`;

    case 'table':
      return `
        <div class="manual-table-wrap">
          <table class="manual-table">
            <thead><tr>${block.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${block.rows.map(row =>
              `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
            ).join('')}</tbody>
          </table>
        </div>`;

    case 'code':
      return `<pre class="manual-code"><code>${escapeHtml(block.text)}</code></pre>`;

    default:
      return '';
  }
}

function calloutIcon(variant) {
  if (variant === 'warning') return '&#x26A0;&#xFE0F;';
  if (variant === 'tip')     return '&#x1F4A1;';
  return 'ℹ️';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


/* ----------------------------------------------------------
   Build the full manual page and inject it into content
   ---------------------------------------------------------- */
function renderManual(content) {
  // Table of contents
  const tocItems = MANUAL_SECTIONS.map(s =>
    `<li><a href="#${s.id}" class="manual-toc__link">${s.icon} ${s.title}</a></li>`
  ).join('');

  // Section bodies
  const sections = MANUAL_SECTIONS.map(s => `
    <section class="manual-section" id="${s.id}">
      <h2 class="manual-section__title">${s.icon} ${s.title}</h2>
      ${s.blocks.map(renderBlock).join('')}
    </section>
  `).join('');

  content.innerHTML = `
    <div class="manual-layout">

      <!-- Sticky table of contents sidebar -->
      <aside class="manual-toc">
        <p class="manual-toc__heading">Contents</p>
        <ul>${tocItems}</ul>
      </aside>

      <!-- Main content -->
      <div class="manual-body">
        <div class="manual-header">
          <h1 class="manual-title">Admin Manual</h1>
          <p class="manual-subtitle">True Jiu Jitsu Online &mdash; Admin Portal Reference</p>
        </div>
        ${sections}
      </div>

    </div>
  `;

  // Highlight the active TOC link as the user scrolls
  wireScrollSpy();
}


/* ----------------------------------------------------------
   Scroll spy — highlights the current section in the TOC
   ---------------------------------------------------------- */
function wireScrollSpy() {
  const sectionEls = document.querySelectorAll('.manual-section');
  const tocLinks   = document.querySelectorAll('.manual-toc__link');
  if (!sectionEls.length || !tocLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        tocLinks.forEach(link => {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
        });
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });

  sectionEls.forEach(el => observer.observe(el));
}


/* ----------------------------------------------------------
   MAIN
   ---------------------------------------------------------- */
(async function init() {

  const auth = await requireAdmin();
  if (!auth) return;

  const content = renderAdminShell('manual', 'Admin Manual');
  renderManual(content);

})();
