/* ==========================================================
   waiver.js — Standalone drop-in waiver
   True Jiu Jitsu Online

   Three-step form:
     1. Participant info + emergency contact
     2. Read and agree to waiver sections B–G
     3. Electronic signature + submit

   Mode: 'drop-in' — no billing, no gym member record created.
   ========================================================== */

/* ----------------------------------------------------------
   State
   ---------------------------------------------------------- */
let currentStep = 1;
const TOTAL_STEPS = 3;


/* ----------------------------------------------------------
   Step indicator
   ---------------------------------------------------------- */
function updateStepIndicator(step) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot  = document.getElementById(`dot-${i}`);
    const line = document.getElementById(`line-${i}`);
    if (!dot) continue;

    dot.classList.remove('step-indicator__dot--active', 'step-indicator__dot--done');
    if (i < step)       dot.classList.add('step-indicator__dot--done'),   dot.textContent = '✓';
    else if (i === step) dot.classList.add('step-indicator__dot--active'), dot.textContent = i;
    else                 dot.textContent = i;

    if (line) {
      line.classList.toggle('step-indicator__line--done', i < step);
    }
  }
}

function showPanel(step) {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const panel = document.getElementById(`panel-${i}`);
    if (panel) panel.classList.toggle('intake-panel--active', i === step);
  }
  updateStepIndicator(step);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showSuccess() {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const panel = document.getElementById(`panel-${i}`);
    if (panel) panel.classList.remove('intake-panel--active');
  }
  document.getElementById('panel-success')?.classList.add('intake-panel--active');
  document.getElementById('step-indicator').style.display = 'none';
  document.getElementById('card-title').textContent = 'Waiver Received';
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
  const firstName = document.getElementById('w-first-name').value.trim();
  const lastName  = document.getElementById('w-last-name').value.trim();
  const dob       = document.getElementById('w-dob').value;
  const phone     = document.getElementById('w-phone').value.trim();
  const email     = document.getElementById('w-email').value.trim();
  const ecName    = document.getElementById('w-ec-name').value.trim();
  const ecPhone   = document.getElementById('w-ec-phone').value.trim();

  if (!firstName || !lastName) { setError(1, 'Please enter your full name.'); return false; }
  if (!dob) { setError(1, 'Please enter your date of birth.'); return false; }
  if (!phone) { setError(1, 'Please enter your phone number.'); return false; }
  if (!email || !email.includes('@')) { setError(1, 'Please enter a valid email address.'); return false; }
  if (!ecName) { setError(1, 'Please enter an emergency contact name.'); return false; }
  if (!ecPhone) { setError(1, 'Please enter an emergency contact phone number.'); return false; }

  setError(1, '');
  return true;
}


/* ----------------------------------------------------------
   Step 2 validation — all required sections must be checked
   ---------------------------------------------------------- */
function validateStep2() {
  const required = ['agree-b', 'agree-c', 'agree-d', 'agree-e', 'agree-f'];
  const allChecked = required.every(id => document.getElementById(id)?.checked);
  if (!allChecked) {
    setError(2, 'Please read and agree to all sections before continuing.');
    return false;
  }
  setError(2, '');
  return true;
}


/* ----------------------------------------------------------
   Step 3 validation
   ---------------------------------------------------------- */
function validateStep3() {
  const sig      = document.getElementById('w-signature').value.trim();
  const isMinor  = document.getElementById('w-is-minor').checked;
  const guardian = document.getElementById('w-guardian').value.trim();

  if (!sig) { setError(3, 'Please type your full name to sign.'); return false; }

  if (isMinor && !guardian) {
    setError(3, 'A parent or guardian must provide their name for minor participants.');
    return false;
  }

  setError(3, '');
  return true;
}


/* ----------------------------------------------------------
   Build the submission payload
   ---------------------------------------------------------- */
function buildPayload() {
  return {
    mode:                    'drop-in',
    firstName:               document.getElementById('w-first-name').value.trim(),
    lastName:                document.getElementById('w-last-name').value.trim(),
    dateOfBirth:             document.getElementById('w-dob').value,
    isMinor:                 document.getElementById('w-is-minor').checked,
    phone:                   document.getElementById('w-phone').value.trim(),
    email:                   document.getElementById('w-email').value.trim(),
    emergencyContactName:    document.getElementById('w-ec-name').value.trim(),
    emergencyContactPhone:   document.getElementById('w-ec-phone').value.trim(),
    agreedAssumptionOfRisk:     document.getElementById('agree-b').checked,
    agreedMedicalResponsibility: document.getElementById('agree-c').checked,
    agreedLiabilityWaiver:      document.getElementById('agree-d').checked,
    agreedHoldHarmless:         document.getElementById('agree-e').checked,
    agreedGymRules:             document.getElementById('agree-f').checked,
    photoRelease:               document.getElementById('agree-g').checked,
    signatureName:           document.getElementById('w-signature').value.trim(),
    guardianName:            document.getElementById('w-guardian').value.trim() || null,
  };
}


/* ----------------------------------------------------------
   Submit the waiver
   ---------------------------------------------------------- */
async function submitWaiver() {
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Submitting…';

  try {
    const response = await fetch('/.netlify/functions/submit-waiver', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildPayload()),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      setError(3, result.error || 'Submission failed. Please try again.');
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Submit Waiver';
      return;
    }

    showSuccess();

  } catch (err) {
    console.error('Submit error:', err);
    setError(3, 'Something went wrong. Please check your connection and try again.');
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit Waiver';
  }
}


/* ----------------------------------------------------------
   Wire up checkbox → agreed state on waiver sections
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
    const checkbox = document.getElementById(checkId);
    const section  = document.getElementById(sectionId);
    if (!checkbox || !section) return;

    checkbox.addEventListener('change', () => {
      section.classList.toggle('is-agreed', checkbox.checked);
    });
  });
}


/* ----------------------------------------------------------
   Minor toggle
   ---------------------------------------------------------- */
function wireMinorToggle() {
  const toggle      = document.getElementById('w-is-minor');
  const minorFields = document.getElementById('minor-fields');
  const guardianEl  = document.getElementById('guardian-field');

  toggle?.addEventListener('change', () => {
    const isMinor = toggle.checked;
    if (minorFields) minorFields.style.display = isMinor ? '' : 'none';
    if (guardianEl)  guardianEl.style.display  = isMinor ? '' : 'none';
  });
}


/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('page-ready');
  showPanel(1);
  wireWaiverSections();
  wireMinorToggle();

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

  // Submit
  document.getElementById('submit-btn')?.addEventListener('click', async () => {
    if (validateStep3()) await submitWaiver();
  });
});
