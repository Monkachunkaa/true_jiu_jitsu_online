/* ==========================================================
   admin-tag-picker.js — Shared searchable tag picker
   True Jiu Jitsu Online

   Renders a searchable, grouped tag picker into a container.
   Used in the video upload, video edit, and article editor.

   Usage:
     const picker = await createTagPicker(containerEl, selectedTagIds);
     const ids    = picker.getSelectedIds(); // returns array of tag UUIDs
   ========================================================== */


/* ----------------------------------------------------------
   Load all tags from Supabase (called once, cached globally)
   ---------------------------------------------------------- */
let _cachedTags = null;

async function loadAllTags() {
  if (_cachedTags) return _cachedTags;

  const { data, error } = await window.supabaseClient
    .from('tags')
    .select('id, name, slug, category, display_order')
    .order('display_order');

  if (error) {
    console.error('Failed to load tags:', error);
    return [];
  }

  _cachedTags = data || [];
  return _cachedTags;
}


/* ----------------------------------------------------------
   Group tags by category
   ---------------------------------------------------------- */
function groupTagsByCategory(tags) {
  const groups = {};
  tags.forEach(tag => {
    if (!groups[tag.category]) groups[tag.category] = [];
    groups[tag.category].push(tag);
  });
  return groups;
}


/* ----------------------------------------------------------
   createTagPicker
   Renders the tag picker UI into the given container.

   Parameters:
     container       — DOM element to render into
     selectedTagIds  — array of pre-selected tag UUIDs (for edit mode)

   Returns:
     { getSelectedIds() } — call to get current selection
   ---------------------------------------------------------- */
async function createTagPicker(container, selectedTagIds = []) {
  const allTags     = await loadAllTags();
  const selectedIds = new Set(selectedTagIds);

  container.innerHTML = `
    <div class="tag-picker">
      <!-- Search input -->
      <input
        type="text"
        class="form__input tag-picker__search"
        id="tag-picker-search"
        placeholder="Search tags…"
        autocomplete="off"
      >

      <!-- Selected tags summary -->
      <div class="tag-picker__selected" id="tag-picker-selected">
        <span class="tag-picker__selected-label">No tags selected</span>
      </div>

      <!-- Tag groups -->
      <div class="tag-picker__groups" id="tag-picker-groups"></div>
    </div>
  `;

  const searchInput  = container.querySelector('#tag-picker-search');
  const selectedWrap = container.querySelector('#tag-picker-selected');
  const groupsWrap   = container.querySelector('#tag-picker-groups');

  /* ----------------------------------------------------------
     Render the selected tags summary bar
     ---------------------------------------------------------- */
  function renderSelected() {
    const selected = allTags.filter(t => selectedIds.has(t.id));

    if (!selected.length) {
      selectedWrap.innerHTML = `<span class="tag-picker__selected-label">No tags selected</span>`;
      return;
    }

    selectedWrap.innerHTML = selected.map(tag => `
      <button
        type="button"
        class="tag-pill tag-pill--selected"
        data-id="${tag.id}"
        title="Remove ${tag.name}"
      >
        ${tag.name} ✕
      </button>
    `).join('');

    // Remove on click
    selectedWrap.querySelectorAll('.tag-pill--selected').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedIds.delete(btn.dataset.id);
        renderSelected();
        renderGroups(searchInput.value);
      });
    });
  }

  /* ----------------------------------------------------------
     Render the grouped tag grid, filtered by search query
     ---------------------------------------------------------- */
  function renderGroups(query = '') {
    const q = query.toLowerCase().trim();

    const filtered = q
      ? allTags.filter(t => t.name.toLowerCase().includes(q))
      : allTags;

    const groups = groupTagsByCategory(filtered);

    if (!filtered.length) {
      groupsWrap.innerHTML = `
        <p style="color:var(--color-gray);font-size:var(--text-sm);padding:var(--space-md);">
          No tags match "${query}"
        </p>
      `;
      return;
    }

    groupsWrap.innerHTML = Object.entries(groups).map(([category, tags]) => `
      <div class="tag-picker__group">
        <p class="tag-picker__group-label">${category}</p>
        <div class="tag-picker__pills">
          ${tags.map(tag => `
            <button
              type="button"
              class="tag-pill ${selectedIds.has(tag.id) ? 'tag-pill--active' : ''}"
              data-id="${tag.id}"
            >
              ${tag.name}
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Toggle on click
    groupsWrap.querySelectorAll('.tag-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
          btn.classList.remove('tag-pill--active');
        } else {
          selectedIds.add(id);
          btn.classList.add('tag-pill--active');
        }
        renderSelected();
      });
    });
  }

  /* ----------------------------------------------------------
     Search input handler
     ---------------------------------------------------------- */
  searchInput.addEventListener('input', () => {
    renderGroups(searchInput.value);
  });

  /* ----------------------------------------------------------
     Initial render
     ---------------------------------------------------------- */
  renderSelected();
  renderGroups();

  /* ----------------------------------------------------------
     Public API
     ---------------------------------------------------------- */
  return {
    getSelectedIds: () => Array.from(selectedIds),
  };
}
