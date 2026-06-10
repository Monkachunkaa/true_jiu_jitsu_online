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
     { type: 'code',     text: '...' }
   ---------------------------------------------------------- */
const MANUAL_SECTIONS = [

  /* ========================================================
     GETTING STARTED
     ======================================================== */
  {
    id:    'getting-started',
    title: 'Getting Started',
    icon:  '&#x1F44B;',
    blocks: [
      { type: 'p', text: 'Welcome to the True Jiu Jitsu admin portal. This is where you manage everything — your members, their billing, waivers, and the online video content your members can access.' },
      { type: 'p', text: 'The navigation on the left side of the screen is split into two areas: <strong>Members</strong> (people and billing) and <strong>Content</strong> (videos and articles). Most of your day-to-day work will be in the Members section.' },
      { type: 'callout', variant: 'tip', text: 'On a phone or tablet, tap the menu icon in the top-left corner to open the navigation.' },
    ],
  },

  /* ========================================================
     YOUR DASHBOARD
     ======================================================== */
  {
    id:    'dashboard',
    title: 'Your Dashboard',
    icon:  '&#x1F3E0;',
    blocks: [
      { type: 'p', text: 'The <strong>Home</strong> page gives you a quick health check of the gym at a glance. You\'ll see four numbers at the top: active members, active online subscribers, estimated monthly revenue, and a "Needs Attention" count for anything that requires follow-up.' },
      { type: 'screenshot', caption: 'The dashboard home page with stat cards and quick action tiles.' },

      { type: 'h3', text: 'Needs Attention' },
      { type: 'p', text: 'This number breaks down into three categories:' },
      { type: 'ul', items: [
        '<strong>Past due</strong> — a member\'s payment failed. You\'ll want to reach out to them to update their card. Stripe will retry automatically, but it\'s good to give them a heads up.',
        '<strong>Pending</strong> — a member\'s record exists but they haven\'t set up billing yet. You may need to resend them their billing link.',
        '<strong>Visitors</strong> — people who signed a waiver but haven\'t signed up for a membership. They might be someone worth following up with.',
      ]},

      { type: 'h3', text: 'Quick actions' },
      { type: 'p', text: 'The four tiles below the numbers are shortcuts for the most common tasks: adding a member, sending an announcement, uploading a video, and checking analytics. Clicking <strong>Add Member</strong> from the dashboard works the same way as from the Members page.' },
    ],
  },

  /* ========================================================
     ADDING A NEW MEMBER
     ======================================================== */
  {
    id:    'adding-members',
    title: 'Adding a New Member',
    icon:  '&#x2795;',
    blocks: [
      { type: 'p', text: 'There are three ways someone becomes a member in your system. Which one you use depends on the situation.' },

      { type: 'h3', text: 'They walk in and sign a waiver themselves' },
      { type: 'p', text: 'This is the most hands-off option. Hand them a tablet or phone with the drop-in waiver open at <strong>your-site.com/waiver</strong>, or the full onboarding form at <strong>your-site.com/join</strong>. When they submit, their record is created automatically — you don\'t need to do anything.' },
      { type: 'ul', items: [
        'Drop-in waiver → they show up in your Members table as a <strong>Visitor</strong>.',
        'Onboarding form → they choose a plan, sign the waiver, and set up billing all in one go. They\'ll show up as <strong>Active</strong> once payment goes through.',
      ]},
      { type: 'screenshot', caption: 'The public drop-in waiver — works great on a tablet at the front desk.' },

      { type: 'h3', text: 'You fill it out for them' },
      { type: 'p', text: 'Use this when someone is standing in front of you and you want to enter their details on their behalf — or when you\'re importing an existing member you already have info for.' },
      { type: 'ol', items: [
        'Click <strong>+ Add Member</strong> in the top right.',
        'Choose <strong>"Fill out on this device."</strong>',
        'Enter their name, email, phone, and the plan they\'re signing up for.',
        'Click <strong>Add Member</strong>.',
        'Their record will appear in the table with a status of <strong>Pending</strong>.',
        'Click <strong>Send Billing Link</strong> on their row to email them a link where they can enter their card details.',
      ]},
      { type: 'callout', variant: 'warning', text: 'This path doesn\'t collect a waiver. Make sure they also sign one — either on your tablet using the drop-in waiver, or by sending them the onboarding form link separately.' },
      { type: 'screenshot', caption: 'The Add Member modal.' },

      { type: 'h3', text: 'Send them a link to do it themselves' },
      { type: 'p', text: 'Great for signing someone up remotely — they get an email with a link, click it, and work through the whole process (their info, waiver, billing) on their own device.' },
      { type: 'ol', items: [
        'Click <strong>+ Add Member</strong>.',
        'Choose <strong>"Send onboarding link."</strong>',
        'Type their email address and click <strong>Send Link</strong>.',
        'They\'ll receive an email with a link. Once they complete everything, they\'ll appear in your Members table as <strong>Active</strong> automatically.',
      ]},
    ],
  },

  /* ========================================================
     UNDERSTANDING MEMBER STATUSES
     ======================================================== */
  {
    id:    'member-statuses',
    title: 'Member Statuses',
    icon:  '&#x1F3F7;',
    blocks: [
      { type: 'p', text: 'Every member in your table has a colored status badge. Here\'s what each one means and what (if anything) you need to do about it.' },
      {
        type: 'table',
        headers: ['Status', 'What it means', 'What to do'],
        rows: [
          ['Visitor',   'They signed a waiver — either walking in or through your drop-in form. They haven\'t set up a membership yet.',  'If they\'re interested in joining, assign them a plan and click Send Billing Link.'],
          ['Pending',   'Their record exists and they may have a plan assigned, but they haven\'t entered billing info yet.',              'Send them their billing link. Check they have a plan assigned first.'],
          ['Active',    'Everything is set up. They\'re paying and in good standing.',                                                    'Nothing — they\'re good to go.'],
          ['Past Due',  'Their last payment failed. Stripe will try again automatically.',                                                'Consider reaching out. If the card keeps failing, they\'ll need to update it.'],
          ['Cancelled', 'Their membership was cancelled.',                                                                                'Nothing required unless they want to rejoin, in which case send a new billing link.'],
          ['Archived',  'They\'ve been hidden from your main view. Record kept for your files.',                                          'Nothing unless you need to look them up — use "Show Archived" in the filter bar.'],
        ],
      },
      { type: 'screenshot', caption: 'Status badges in the Members table — each colour tells you where someone is in the membership lifecycle.' },
    ],
  },

  /* ========================================================
     MANAGING MEMBERS
     ======================================================== */
  {
    id:    'managing-members',
    title: 'Managing Members',
    icon:  '&#x1F465;',
    blocks: [
      { type: 'p', text: 'The <strong>Members</strong> page is your main tool for day-to-day management. You can search by name, email, or phone, and filter by status.' },
      { type: 'screenshot', caption: 'The Members table with search, status filter, and action buttons.' },

      { type: 'h3', text: 'Editing a member\'s details' },
      { type: 'p', text: 'Click <strong>Edit</strong> on any member\'s row to update their name, email, phone number, plan, or any notes you want to keep about them. You can also add or update a discount from here.' },

      { type: 'h3', text: 'Sending a billing link' },
      { type: 'p', text: 'Any member who is <strong>Visitor</strong> or <strong>Pending</strong> will have a <strong>Send Billing Link</strong> button. Clicking it emails them a secure link where they can enter their card details. You can send it more than once if they lost the email.' },
      { type: 'callout', variant: 'info', text: 'Before sending a billing link, make sure the member has both an email address and a plan assigned. If either is missing, you\'ll see a message telling you what to add first.' },

      { type: 'h3', text: 'Cancelling a membership' },
      { type: 'p', text: 'Active members have a red <strong>Cancel</strong> button on their row. You\'ll be asked to confirm before anything happens. Once cancelled, billing stops immediately — they won\'t be charged again, and they lose access to the online content.' },

      { type: 'h3', text: 'Archiving a member' },
      { type: 'p', text: 'If you need to remove someone from your main view — for example, someone who\'s been banned, or an old test record — use <strong>Archive</strong> instead of anything else. Click the <strong>&bull;&bull;&bull;</strong> button on their row and select <strong>"Archive member."</strong>' },
      { type: 'p', text: 'Archiving hides the person from your main Members table and cancels any active subscription. Critically, <strong>all their records and waivers are kept forever</strong> — they\'re just moved out of your day-to-day view.' },
      { type: 'callout', variant: 'tip', text: 'If you ever need to look up an archived member — say, because someone is threatening legal action and you need to confirm they signed a waiver — click <strong>"Show Archived"</strong> in the filter bar. Their full record will be there.' },

      { type: 'h3', text: 'Discounts' },
      { type: 'p', text: 'When editing a member, you can apply a percentage discount to their membership. Set the percentage, then choose whether it should apply forever or just for a set number of months. Leave the percentage blank to remove a discount.' },

      { type: 'h3', text: 'Filtering the table' },
      { type: 'p', text: 'Use the search box to find anyone by name, email, or phone. Use the status dropdown to show only one group at a time — for example, showing only "Past Due" members when you want to follow up on failed payments.' },
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
      { type: 'p', text: 'Every person who comes through the gym should have a signed waiver on file. The waiver system is designed so this happens automatically — when someone fills out the form online, their signature is recorded and linked to their member record.' },

      { type: 'h3', text: 'Where to find them' },
      { type: 'p', text: 'Go to <strong>Waivers</strong> in the sidebar. You\'ll see every submission — name, email, whether they consented to photo release, and when they signed. Click <strong>View</strong> on any row to see the full submission, including their signature and emergency contact.' },
      { type: 'screenshot', caption: 'The Waivers table.' },

      { type: 'h3', text: 'Sharing the waiver forms' },
      { type: 'p', text: 'In the top right of the Waivers page you\'ll find quick links to both public forms:' },
      { type: 'ul', items: [
        '<strong>Drop-in Waiver</strong> — for walk-ins and one-time visitors. You can bookmark this, create a QR code for it, or keep it open on a tablet at the front desk.',
        '<strong>Member Onboarding</strong> — the full sign-up flow for new members joining the gym. Includes waiver, plan selection, and billing setup.',
      ]},

      { type: 'h3', text: 'Waivers on the Members table' },
      { type: 'p', text: 'The <strong>Waivers Signed</strong> column on the Members table tells you how many waivers are on file for each person. A number higher than one usually means someone signed the drop-in waiver first and then later went through the full onboarding — both are kept.' },

      { type: 'callout', variant: 'warning', text: 'Don\'t delete waivers unless you\'re certain it\'s a test submission or a duplicate. A signed waiver is a legal document. Even if you archive or remove a member, their waiver stays in the system permanently.' },
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
      { type: 'p', text: 'Membership plans are the pricing tiers you offer. Each plan has a name, a monthly price, and an optional description. When you assign a plan to a member and send them a billing link, Stripe uses that plan\'s price to set up their recurring charge.' },

      { type: 'h3', text: 'Creating a plan' },
      { type: 'ol', items: [
        'Go to <strong>Membership Plans</strong> in the sidebar.',
        'Click <strong>+ New Plan</strong>.',
        'Give it a name (e.g. "Adult BJJ"), set the monthly price, and add an optional description.',
        'If the plan includes access to the online video library, turn on <strong>"Includes online video access"</strong> — this gets shown to prospective members on the sign-up form.',
        'Click <strong>Save</strong>.',
      ]},

      { type: 'h3', text: 'Changing a plan\'s price' },
      { type: 'p', text: 'You can update a plan\'s price at any time. The new price will apply to any <em>new</em> billing links you send after that point. Members who are already active won\'t be automatically updated — their rate stays the same until their billing link is regenerated.' },

      { type: 'h3', text: 'Hiding a plan' },
      { type: 'p', text: 'If you want to retire a plan without deleting it, toggle it to inactive. It won\'t appear on the public sign-up form or in the plan dropdown when adding new members, but existing members on that plan are not affected.' },

      { type: 'h3', text: 'Reordering plans' },
      { type: 'p', text: 'The order you arrange plans in this page is the order they appear to prospective members on the sign-up form. Drag them to put your most popular option first.' },
    ],
  },

  /* ========================================================
     ANNOUNCEMENTS
     ======================================================== */
  {
    id:    'announcements',
    title: 'Sending Announcements',
    icon:  '&#x1F4E3;',
    blocks: [
      { type: 'p', text: 'Use announcements to send an email to all of your active gym members at once. Good uses: schedule changes, gym closures, events, tournaments, or anything you\'d normally post in a group chat.' },

      { type: 'h3', text: 'Sending one' },
      { type: 'ol', items: [
        'Go to <strong>Announcements</strong> in the sidebar.',
        'Click <strong>+ New Announcement</strong>.',
        'Write a subject line and your message.',
        'Click <strong>Send to All Members</strong>.',
      ]},
      { type: 'callout', variant: 'warning', text: 'Announcements go to <strong>Active</strong> members only. Visitors, Pending, and Cancelled members won\'t receive them. There\'s no way to undo a send, so give it a quick read-over before hitting the button.' },
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
      { type: 'p', text: 'The <strong>Videos</strong> section is where you manage all the instructional content your members can watch online. Videos are uploaded and stored securely — members can only watch them when they\'re logged in.' },

      { type: 'h3', text: 'Uploading a video' },
      { type: 'ol', items: [
        'Go to <strong>Videos</strong> in the sidebar and click <strong>Upload Video</strong>.',
        'Drag your video file into the upload area or click to browse.',
        'While it uploads, fill in the title, a short description, and add some tags (more on tags below).',
        'Optionally add a thumbnail image — if you skip this, a frame from the video will be used.',
        'When you\'re ready for members to see it, flip the <strong>Published</strong> toggle.',
      ]},
      { type: 'callout', variant: 'info', text: 'After uploading, the video needs a minute or two to process before it will play. You\'ll see it in your library straight away, but playback might not be ready immediately.' },
      { type: 'screenshot', caption: 'The video upload modal.' },

      { type: 'h3', text: 'Tags' },
      { type: 'p', text: 'Tags are how members find what they\'re looking for. When you tag a video with things like "Guard," "Submission," or "Beginner," members can filter by those tags in the video library. Add as many relevant tags as you like — more tags means the video shows up in more searches.' },

      { type: 'h3', text: 'Drafts and published videos' },
      { type: 'p', text: 'A video with the Published toggle off is a <strong>draft</strong> — only visible to admins. This is useful if you want to upload and organize content in advance before making it available to members. Flip Published when you\'re ready.' },
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
      { type: 'p', text: 'Playlists let you group videos (and articles) into a structured course or curriculum. Members can work through a playlist in order and track their progress as they go.' },
      { type: 'p', text: 'A good playlist might be "Fundamentals Week 1" with six videos covering the basics, or a deep-dive series on a specific position. You can mix videos and articles in the same playlist.' },

      { type: 'h3', text: 'Creating a playlist' },
      { type: 'ol', items: [
        'Go to <strong>Playlists</strong> and click <strong>+ New Playlist</strong>.',
        'Add a title and description.',
        'Use the search box to find videos or articles and add them to the playlist.',
        'Drag them into the order you want members to watch them.',
        'Flip <strong>Published</strong> when it\'s ready.',
      ]},
      { type: 'screenshot', caption: 'The playlist editor with drag-and-drop ordering.' },
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
      { type: 'p', text: 'Articles are written content for your members — technique breakdowns, training tips, nutrition advice, gym news, or anything else you want to write. They live in the same library as your videos and can be added to playlists.' },

      { type: 'h3', text: 'Writing an article' },
      { type: 'ol', items: [
        'Go to <strong>Articles</strong> and click <strong>+ New Article</strong>.',
        'Write your content using the text editor. You can add headings, bold text, bullet points, and images.',
        'Add tags the same way you would for a video.',
        'Flip <strong>Published</strong> when it\'s ready.',
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
      { type: 'p', text: 'The <strong>Analytics</strong> page shows you how the gym is doing over time and how members are engaging with the online content.' },

      { type: 'h3', text: 'What you\'ll see' },
      { type: 'ul', items: [
        '<strong>Members over time</strong> — a chart showing how your gym membership and online subscription numbers have grown over the last 6 months.',
        '<strong>New vs churned</strong> — month by month, how many people joined versus how many cancelled.',
        '<strong>Revenue by plan</strong> — which membership plans are generating the most revenue each month, with discounts factored in.',
        '<strong>Most watched videos</strong> — your most popular content. Good to know when planning what to record next.',
        '<strong>Playlist completion</strong> — on average, how far through each playlist your members are getting.',
      ]},
      { type: 'callout', variant: 'info', text: 'Revenue figures are estimates based on the plans and discounts in your portal. For exact billing figures, check your Stripe dashboard.' },
      { type: 'screenshot', caption: 'The Analytics page.' },
    ],
  },

  /* ========================================================
     COMMON SCENARIOS
     ======================================================== */
  {
    id:    'scenarios',
    title: 'Common Scenarios',
    icon:  '&#x2753;',
    blocks: [
      { type: 'p', text: 'Quick answers to situations that come up regularly.' },

      { type: 'h3', text: 'A new member came in today and signed a waiver — what do I do next?' },
      { type: 'p', text: 'If they signed through the tablet in the gym, their record is already created automatically as a <strong>Visitor</strong>. Go to the Members page, find them, assign a plan if they want to join, and click <strong>Send Billing Link</strong>. Once they enter their card details, they\'ll become <strong>Active</strong>.' },

      { type: 'h3', text: 'A member\'s payment failed — what should I do?' },
      { type: 'p', text: 'Their status will show as <strong>Past Due</strong>. Stripe will automatically try the charge again a few times over the next week or so. In the meantime, it\'s worth sending them a quick message to let them know and ask them to update their card. They can update it directly in Stripe\'s customer portal — the link to that is on their account page on the website.' },

      { type: 'h3', text: 'A member wants to change their plan' },
      { type: 'p', text: 'Click <strong>Edit</strong> on their row, select the new plan from the dropdown, and save. Then click <strong>Send Billing Link</strong> to send them a new checkout link at the updated price. Their current subscription stays in place until they complete the new checkout.' },

      { type: 'h3', text: 'I need to ban someone from the gym' },
      { type: 'p', text: 'Find them in the Members table, click the <strong>&bull;&bull;&bull;</strong> button on their row, and select <strong>Archive member</strong>. If they have an active subscription it will be cancelled immediately. Their record — including their signed waiver — is kept forever in your system. Use "Show Archived" in the filter bar if you ever need to access it.' },

      { type: 'h3', text: 'A drop-in signed a waiver but I want to see their details' },
      { type: 'p', text: 'Go to the <strong>Waivers</strong> page and search for their name. Click <strong>View</strong> to see their full submission including emergency contact, date of birth, and signature. Their record will also appear on the Members page with a <strong>Visitor</strong> status.' },

      { type: 'h3', text: 'I accidentally added a duplicate member record' },
      { type: 'p', text: 'Archive the duplicate using the <strong>&bull;&bull;&bull;</strong> overflow menu. It will disappear from your main view. The real record stays untouched.' },

      { type: 'h3', text: 'How do I know if someone has access to the online videos?' },
      { type: 'p', text: 'Online video access is tied to their plan — if their plan includes online access, they can log in and watch. Alternatively, if they signed up for an online-only subscription through the website, they\'ll have their own separate account. You can check the <strong>Analytics</strong> page to see who\'s actively watching.' },
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
          <p class="manual-subtitle">True Jiu Jitsu Online &mdash; How to manage your gym portal</p>
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
