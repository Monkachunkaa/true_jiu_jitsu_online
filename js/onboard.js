/* ==========================================================
   onboard.js — Full member onboarding flow
   True Jiu Jitsu Online

   Five-step form:
     1. Participant info + emergency contact
     2. Membership plan selection
     3. Waiver agreement (sections B–G)
     4. Electronic signature + submit (creates gym member)
     5. Billing setup → Stripe Checkout

   Mode: 'onboarding' — creates gym_members record and
   redirects to Stripe Checkout for billing setup.
   ========================================================== */

/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
let currentStep   = 1;
const TOTAL_STEPS = 5;
let allPlans      = [];
let selectedPlanId = null;
let gymMemberId   = null;  // set after waiver submission


/* ----------------------------------------------------------
   Step indicator
   ---------------------------------------------------------- */
const STEP_TITLES = {
  1: 'Your Information',
  2: 'Choose Your Membership',
  3: 'Participation Waiver',
  4: 'Electronic Signature',
  5: 'Set Up Billing',
};

function updateStepIndicator(step) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot  = document.getElementById(`dot-${i}`);
    const line = document.getElementById(`line-${i}`);
    if (!dot) continue;

    dot.classList.remove('step-indicator__dot--active', 'step-indicator__dot--done');
    if (i < step)       dot.classList.add('step-indicator__dot--done'),   dot.textContent = '✓';
    else if (i === step) dot.classList.add('step-indicator__dot--active'), dot.textContent = i;
    else                 dot.textContent = i;

    if (line) line.classList.toggle('step-indicator__line--done', i < step);
  }
}

function showPanel(step) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const panel = document.getElementById(`panel-${i}`);
    if (panel) panel.classList.toggle('intake-panel--active', i === step);
  }
  document.getElementById('card-title').textContent = STEP_TITLES[step] || '';
  updateStepIndicator(step);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setError(panelNum, message) {
  const el = document.getElementById(`error-${panelNum}`);
  if (el) el.textContent = message || '';
}


/* ----------------------------------------------------------
   Step 1 validation
   ---------------------------------------------------------- */
function validateStep1() {
  const firstName = document.getElementById('o-first-name').value.trim();
  const lastName  = document.getElementById('o-last-name').value.trim();
  const dob       = document.getElementById('o-dob').value;
  const phone     = document.getElementById('o-phone').value.trim();
  const email     = document.getElementById('o-email').value.trim();
  const ecName    = document.getElementById('o-ec-name').value.trim();
  const ecPhone   = document.getElementById('o-ec-phone').value.trim();

  if (!firstName || !lastName) { setError(1, 'Please enter your full name.'); return false; }
  if (!dob)                     { setError(1, 'Please enter your date of birth.'); return false; }
  if (!phone)                   { setError(1, 'Please enter your phone number.'); return false; }
  if (!email || !email.includes('@')) { setError(1, 'Please enter a valid email address.'); return false; }
  if (!ecName)                  { setError(1, 'Please enter an emergency contact name.'); return false; }
  if (!ecPhone)                 { setError(1, 'Please enter an emergency contact phone number.'); return false; }

  setError(1, '');
  return true;
}


/* ----------------------------------------------------------
   Step 2 — Load and render plans
   ---------------------------------------------------------- */
async function loadPlans() {
  const container = document.getElementById('plan-cards');

  try {
    const res  = await fetch('/.netlify/functions/get-public-plans');
    const data = await res.json();
    allPlans   = data.plans || [];
  } catch (err) {
    console.error('Plans load error:', err);
    allPlans = [];
  }

  if (!allPlans.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:var(--space-xl) 0;color:var(--color-gray);">
        <p style="max-width:none;">No membership plans are currently available.</p>
        <p style="font-size:var(--text-sm);max-width:none;">Please contact the gym to complete your enrollment.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = allPlans.map(plan => `
    <div class="plan-card" data-plan-id="${plan.id}" role="button" tabindex="0"
         aria-pressed="false">
      <div class="plan-card__radio"></div>
      <div class="plan-card__info">
        <p class="plan-card__name">${plan.name}</p>
        ${plan.description ? `<p class="plan-card__description">${plan.description}</p>` : ''}
        ${plan.includes_online_access ? `<p class="plan-card__description" style="color:var(--color-success);">✓ Includes online video access</p>` : ''}
      </div>
      <div class="plan-card__price">
        $${(plan.price_cents / 100).toFixed(0)}<span>/mo</span>
      </div>
    </div>
  `).join('');

  // Wire up plan card clicks
  container.querySelectorAll('.plan-card').forEach(card => {
    const select = () => {
      container.querySelectorAll('.plan-card').forEach(c => {
        c.classList.remove('is-selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('is-selected');
      card.setAttribute('aria-pressed', 'true');
      selectedPlanId = card.dataset.planId;
    };

    card.addEventListener('click', select);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });
  });

  // Auto-select first plan if only one
  if (allPlans.length === 1) {
    container.querySelector('.plan-card')?.click();
  }
}

function validateStep2() {
  if (!selectedPlanId) {
    setError(2, 'Please select a membership plan to continue.');
    return false;
  }
  setError(2, '');
  return true;
}


/* ----------------------------------------------------------
   Step 3 validation — all required sections checked
   ---------------------------------------------------------- */
function validateStep3() {
  const required  = ['agree-b', 'agree-c', 'agree-d', 'agree-e', 'agree-f'];
  const allChecked = required.every(id => document.getElementById(id)?.checked);
  if (!allChecked) {
    setError(3, 'Please read and agree to all sections before continuing.');
    return false;
  }
  setError(3, '');
  return true;
}


/* ----------------------------------------------------------
   Step 4 validation
   ---------------------------------------------------------- */
function validateStep4() {
  const sig     = document.getElementById('o-signature').value.trim();
  const isMinor = document.getElementById('o-is-minor').checked;
  const guardian = document.getElementById('o-guardian').value.trim();

  if (!sig) { setError(4, 'Please type your full name to sign.'); return false; }
  if (isMinor && !guardian) {
    setError(4, 'A parent or guardian must provide their name for minor participants.');
    return false;
  }
  setError(4, '');
  return true;
}


/* ----------------------------------------------------------
   Submit waiver (step 4 → 5)
   ---------------------------------------------------------- */
async function submitWaiver() {
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Saving…';

  const payload = {
    mode:                    'onboarding',
    planId:                  selectedPlanId,
    firstName:               document.getElementById('o-first-name').value.trim(),
    lastName:                document.getElementById('o-last-name').value.trim(),
    dateOfBirth:             document.getElementById('o-dob').value,
    isMinor:                 document.getElementById('o-is-minor').checked,
    phone:                   document.getElementById('o-phone').value.trim(),
    email:                   document.getElementById('o-email').value.trim(),
    emergencyContactName:    document.getElementById('o-ec-name').value.trim(),
    emergencyContactPhone:   document.getElementById('o-ec-phone').value.trim(),
    agreedAssumptionOfRisk:      document.getElementById('agree-b').checked,
    agreedMedicalResponsibility: document.getElementById('agree-c').checked,
    agreedLiabilityWaiver:       document.getElementById('agree-d').checked,
    agreedHoldHarmless:          document.getElementById('agree-e').checked,
    agreedGymRules:              document.getElementById('agree-f').checked,
    photoRelease:                document.getElementById('agree-g').checked,
    signatureName:           document.getElementById('o-signature').value.trim(),
    guardianName:            document.getElementById('o-guardian').value.trim() || null,
  };

  try {
    const res    = await fetch('/.netlify/functions/submit-waiver', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const result = await res.json();

    if (!res.ok || !result.success) {
      setError(4, result.error || 'Submission failed. Please try again.');
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Submit & Continue →';
      return;
    }

    gymMemberId = result.gymMemberId;

    // Populate step 5 billing summary
    const plan = allPlans.find(p => p.id === selectedPlanId);
    if (plan) {
      document.getElementById('billing-plan-name').textContent  = plan.name;
      document.getElementById('billing-plan-price').textContent = `$${(plan.price_cents / 100).toFixed(0)}/month`;
    }

    currentStep = 5;
    showPanel(5);

  } catch (err) {
    console.error('Submit error:', err);
    setError(4, 'Something went wrong. Please check your connection and try again.');
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit & Continue →';
  }
}


/* ----------------------------------------------------------
   Step 5 — Redirect to Stripe Checkout
   ---------------------------------------------------------- */
async function startBilling() {
  if (!gymMemberId || !selectedPlanId) {
    setError(5, 'Something went wrong. Please refresh the page and try again.');
    return;
  }

  const billingBtn = document.getElementById('billing-btn');
  billingBtn.disabled    = true;
  billingBtn.textContent = 'Redirecting to billing…';

  try {
    const res    = await fetch('/.netlify/functions/create-onboard-checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ gymMemberId, planId: selectedPlanId }),
    });
    const result = await res.json();

    if (!res.ok || !result.checkoutUrl) {
      setError(5, result.error || 'Failed to create billing session. Please contact the gym.');
      billingBtn.disabled    = false;
      billingBtn.textContent = 'Set Up Billing →';
      return;
    }

    window.location.href = result.checkoutUrl;

  } catch (err) {
    console.error('Billing error:', err);
    setError(5, 'Something went wrong. Please contact the gym directly.');
    billingBtn.disabled    = false;
    billingBtn.textContent = 'Set Up Billing →';
  }
}


/* ----------------------------------------------------------
   Wire up waiver section checkboxes → visual state
   ---------------------------------------------------------- */
function wireWaiverSections() {
  const sections = {
    'agree-b': 'section-b',
    'agree-c': 'section-c',
    'agree-d': 'section-d',
    'agree-e': 'section-e',
    'agree-f': 'section-f',
  };
  Object.entries(sections).forEach(([checkId, sectionId]) => {
    document.getElementById(checkId)?.addEventListener('change', (e) => {
      document.getElementById(sectionId)?.classList.toggle('is-agreed', e.target.checked);
    });
  });
}


/* ----------------------------------------------------------
   Minor toggle
   ---------------------------------------------------------- */
function wireMinorToggle() {
  document.getElementById('o-is-minor')?.addEventListener('change', (e) => {
    const isMinor = e.target.checked;
    document.getElementById('o-guardian-field').style.display = isMinor ? '' : 'none';
  });
}


/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  showPanel(1);
  wireWaiverSections();
  wireMinorToggle();

  // Load plans in background so step 2 is ready
  loadPlans();

  // Step 1 → 2
  document.getElementById('next-1')?.addEventListener('click', () => {
    if (validateStep1()) { currentStep = 2; showPanel(2); }
  });

  // Step 2 → back
  document.getElementById('back-1')?.addEventListener('click', () => {
    currentStep = 1; showPanel(1);
  });

  // Step 2 → 3
  document.getElementById('next-2')?.addEventListener('click', () => {
    if (validateStep2()) { currentStep = 3; showPanel(3); }
  });

  // Step 3 → back
  document.getElementById('back-2')?.addEventListener('click', () => {
    currentStep = 2; showPanel(2);
  });

  // Step 3 → 4
  document.getElementById('next-3')?.addEventListener('click', () => {
    if (validateStep3()) { currentStep = 4; showPanel(4); }
  });

  // Step 4 → back
  document.getElementById('back-3')?.addEventListener('click', () => {
    currentStep = 3; showPanel(3);
  });

  // Step 4 → submit
  document.getElementById('submit-btn')?.addEventListener('click', async () => {
    if (validateStep4()) await submitWaiver();
  });

  // Step 5 → billing
  document.getElementById('billing-btn')?.addEventListener('click', startBilling);
});
