const APP_VERSION = '2.1.0';
const CONFIG = {
  GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw5kZ4Yjgge_sKnxhSjjVLkb8cI-hG0E_qcScyxP7820a7lzfCr42HhZDp3lW2kmNsy/exec'
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const state = {
  events: [],
  members: [],
  rows: [],
  latest: {},
  selectedEventId: '',
  currentEdit: null,
  changes: [],
  installPrompt: null
};

const els = {
  loading: $('#loadingScreen'),
  toast: $('#toast'),
  sync: $('#syncStatus'),
  refresh: $('#refreshBtn'),
  install: $('#installBtn'),
  views: $$('.view'),
  nav: $$('.nav-btn'),
  nextHero: $('#nextEventHero'),
  eventCards: $('#eventCards'),
  nextDetail: $('#nextDetail'),
  eventSelect: $('#eventSelect'),
  memberSearch: $('#memberSearch'),
  editSummary: $('#editSummary'),
  memberList: $('#memberList'),
  archiveList: $('#archiveList'),
  changesBlock: $('#changesBlock'),
  changesList: $('#changesList'),
  eventDialog: $('#eventDialog'),
  eventDialogContent: $('#eventDialogContent'),
  closeEventDialog: $('#closeEventDialog'),
  editDialog: $('#editDialog'),
  closeEditDialog: $('#closeEditDialog'),
  editEventLabel: $('#editEventLabel'),
  editName: $('#editName'),
  editCurrentStatus: $('#editCurrentStatus'),
  editMealBlock: $('#editMealBlock'),
  editGuest: $('#editGuest'),
  editGuestDetails: $('#editGuestDetails'),
  editGuestName: $('#editGuestName'),
  editGuestMeal: $('#editGuestMeal'),
  editNote: $('#editNote'),
  saveEdit: $('#saveEditBtn'),
  editSaveStatus: $('#editSaveStatus')
};

const storage = {
  getSnapshot(){
    try { return JSON.parse(localStorage.getItem('concordia_restaurator_snapshot_v2') || 'null'); }
    catch { return null; }
  },
  setSnapshot(snapshot){
    localStorage.setItem('concordia_restaurator_snapshot_v2', JSON.stringify(snapshot));
  }
};

const dateFmt = new Intl.DateTimeFormat('da-DK', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('da-DK', { day:'2-digit', month:'2-digit', year:'numeric' });
const shortMonthFmt = new Intl.DateTimeFormat('da-DK', { month:'short' });
const timeFmt = new Intl.DateTimeFormat('da-DK', { hour:'2-digit', minute:'2-digit' });

init();

function init(){
  $('#appVersion').textContent = APP_VERSION;
  bind();
  registerServiceWorker();
  loadData();
}

function bind(){
  els.refresh?.addEventListener('click', () => loadData(true));
  els.install?.addEventListener('click', installApp);

  els.nav.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

  els.eventSelect?.addEventListener('change', () => {
    state.selectedEventId = els.eventSelect.value;
    renderEditView();
  });

  els.memberSearch?.addEventListener('input', renderMembers);

  els.closeEventDialog?.addEventListener('click', () => els.eventDialog.close());
  els.eventDialog?.addEventListener('click', event => closeDialogOnBackdrop(event, els.eventDialog));

  els.closeEditDialog?.addEventListener('click', closeEditDialog);
  els.editDialog?.addEventListener('click', event => closeDialogOnBackdrop(event, els.editDialog));

  $$('[data-edit-attending]').forEach(btn => btn.addEventListener('click', () => chooseAttending(btn.dataset.editAttending)));
  $$('[data-edit-meal]').forEach(btn => btn.addEventListener('click', () => chooseMeal(btn.dataset.editMeal)));
  els.editGuest?.addEventListener('change', syncEditControls);
  els.saveEdit?.addEventListener('click', saveEdit);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    state.installPrompt = event;
    if (els.install) els.install.hidden = false;
  });
}

async function loadData(force=false){
  if (!CONFIG.GOOGLE_APPS_SCRIPT_URL) {
    setStatus('Google Sheet er ikke koblet på.', true);
    hideLoading();
    return;
  }

  try {
    setStatus(force ? 'Opdaterer fra Google Sheet…' : 'Henter fra Google Sheet…');
    const url = `${CONFIG.GOOGLE_APPS_SCRIPT_URL}?action=list&t=${Date.now()}`;
    const res = await fetch(url, { cache:'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    state.members = normalizeMembers(data.members);
    state.events = normalizeEvents(data.events || []);
    state.rows = normalizeRows(data.rows || data.signups || []);
    state.latest = getLatestRows(state.rows);
    if (!state.selectedEventId) state.selectedEventId = getUpcomingEvents()[0]?.id || state.events[0]?.id || '';

    state.changes = findChanges(storage.getSnapshot(), buildSnapshot());
    storage.setSnapshot(buildSnapshot());

    renderAll();
    setStatus(`Koblet på Google Sheet · ${timeFmt.format(new Date())}`);
    if (force) showToast('Data er opdateret.');
  } catch (err) {
    console.warn('Kunne ikke hente data', err);
    setStatus('Kunne ikke hente fra Google Sheet.', true);
    showToast('Kunne ikke hente data fra Google Sheet.');
  } finally {
    hideLoading();
  }
}

function renderAll(){
  renderDashboard();
  renderNextView();
  renderEditEventSelect();
  renderEditView();
  renderArchive();
  renderChanges();
}

function renderDashboard(){
  const next = getUpcomingEvents()[0];
  if (!next) {
    els.nextHero.innerHTML = '<div class="empty">Der er ingen kommende logeaftener.</div>';
  } else {
    const s = getSummary(next.id);
    els.nextHero.innerHTML = `
      <article class="next-card">
        <div class="date-badge"><span>${day(next.date)}</span><small>${month(next.date)}</small></div>
        <div class="next-info">
          <p class="tag">Næste logeaften</p>
          <h3>${esc(next.title)}</h3>
          <p class="meta-line">${cap(formatDate(next.date))} · kl. ${esc(displayTime(next.time))}</p>
          ${next.description ? `<p class="desc">${esc(next.description)}</p>` : ''}
          <div class="hero-numbers">
            ${statHtml(s.totalMeals, 'Kuverter')}
            ${statHtml(s.memberMeals, 'Brødre')}
            ${statHtml(s.guestMeals, 'Gæster')}
            ${statHtml(s.noReply, 'Ikke svaret')}
          </div>
          <div class="card-actions">
            <button class="btn primary" type="button" data-open-event="${esc(next.id)}">Åbn overblik</button>
            <button class="btn soft" type="button" data-copy-event="${esc(next.id)}">Kopiér køkkenbesked</button>
          </div>
        </div>
      </article>`;
  }

  const upcoming = getUpcomingEvents();
  els.eventCards.innerHTML = upcoming.length ? upcoming.map(eventCardHtml).join('') : '<div class="empty">Ingen kommende aftener.</div>';
  bindDynamicActions();
}

function eventCardHtml(event){
  const s = getSummary(event.id);
  return `
    <article class="event-card" data-open-event="${esc(event.id)}">
      <div class="date-badge small"><span>${day(event.date)}</span><small>${month(event.date)}</small></div>
      <div class="event-card-body">
        <h3>${esc(event.title)}</h3>
        <p>${cap(formatDate(event.date))} · kl. ${esc(displayTime(event.time))}${event.category ? ` · ${esc(event.category)}` : ''}</p>
        <div class="mini-stats">
          <span><strong>${s.totalMeals}</strong> kuverter</span>
          <span><strong>${s.attending}</strong> deltager</span>
          <span><strong>${s.noReply}</strong> mangler</span>
        </div>
      </div>
      <div class="chev">›</div>
    </article>`;
}

function renderNextView(){
  const next = getUpcomingEvents()[0];
  els.nextDetail.innerHTML = next ? detailHtml(next, {full:true}) : '<div class="empty">Der er ingen kommende logeaftener.</div>';
  bindDynamicActions();
}

function renderEditEventSelect(){
  const events = getUpcomingEvents();
  const fallback = state.events;
  const list = events.length ? events : fallback;
  els.eventSelect.innerHTML = list.map(e => `<option value="${esc(e.id)}">${esc(shortDate(e.date))} · ${esc(e.title)}</option>`).join('');
  if (state.selectedEventId && list.some(e => e.id === state.selectedEventId)) els.eventSelect.value = state.selectedEventId;
  else {
    state.selectedEventId = list[0]?.id || '';
    els.eventSelect.value = state.selectedEventId;
  }
}

function renderEditView(){
  const event = eventById(state.selectedEventId);
  if (!event) {
    els.editSummary.innerHTML = '<div class="empty">Vælg en logeaften.</div>';
    els.memberList.innerHTML = '';
    return;
  }
  els.editSummary.innerHTML = compactSummaryHtml(event);
  renderMembers();
  bindDynamicActions();
}

function renderMembers(){
  const event = eventById(state.selectedEventId);
  if (!event) return;
  const q = norm(els.memberSearch.value || '');
  const rows = membersWithStatus(event.id).filter(item => !q || norm(item.member.name).includes(q));

  els.memberList.innerHTML = rows.length ? rows.map(({member, signup}) => `
    <button class="member-card ${statusClass(signup)}" type="button" data-edit-member="${esc(member.id)}" data-event-id="${esc(event.id)}">
      <div class="member-main">
        <strong>${esc(member.name)}</strong>
        <span>${statusText(signup)}</span>
      </div>
      <div class="member-side">
        ${signup?.guestMeal === 'yes' ? '<span class="guest-pill">+ gæstemad</span>' : ''}
        ${signup?.note ? '<span class="note-pill">note</span>' : ''}
        <span class="chev">›</span>
      </div>
    </button>
  `).join('') : '<div class="empty">Ingen brødre matcher søgningen.</div>';

  bindDynamicActions();
}

function renderArchive(){
  const past = getPastEvents();
  els.archiveList.innerHTML = past.length ? past.map(eventCardHtml).join('') : '<div class="empty">Der er ingen tidligere aftener i data endnu.</div>';
  bindDynamicActions();
}

function renderChanges(){
  if (!state.changes.length) {
    els.changesBlock.hidden = true;
    els.changesList.innerHTML = '';
    return;
  }

  els.changesBlock.hidden = false;
  els.changesList.innerHTML = state.changes.slice(0, 12).map(change => `
    <article class="change-card">
      <strong>${esc(change.name)}</strong>
      <span>${esc(change.text)}</span>
      <small>${esc(change.eventTitle)} · ${esc(shortDate(change.eventDate))}</small>
    </article>
  `).join('') + (state.changes.length > 12 ? `<p class="help-text">+ ${state.changes.length - 12} flere ændringer.</p>` : '');
}

function detailHtml(event, options={}){
  const s = getSummary(event.id);
  const groups = getGroups(event.id);
  const changes = state.changes.filter(c => c.eventId === event.id);

  return `
    <section class="detail-card" data-print-event="${esc(event.id)}">
      <div class="detail-head">
        <div>
          <p class="tag">${options.archive ? 'Arkiv' : 'Køkkenoverblik'}</p>
          <h2>${esc(event.title)}</h2>
          <p>${cap(formatDate(event.date))} · kl. ${esc(displayTime(event.time))}</p>
          ${event.description ? `<p class="desc">${esc(event.description)}</p>` : ''}
          ${deadlineText(event) ? `<p class="deadline-text">${esc(deadlineText(event))}</p>` : ''}
        </div>
        <div class="date-badge"><span>${day(event.date)}</span><small>${month(event.date)}</small></div>
      </div>

      <div class="stats-grid">
        ${statHtml(s.totalMeals, 'Kuverter i alt')}
        ${statHtml(s.memberMeals, 'Brødre til mad')}
        ${statHtml(s.guestMeals, 'Gæster til mad')}
        ${statHtml(s.attendingNoMeal, 'Uden mad')}
        ${statHtml(s.noReply, 'Ikke svaret')}
        ${statHtml(s.notAttending, 'Deltager ikke')}
      </div>

      <div class="action-grid no-print">
        <button class="btn primary" type="button" data-copy-event="${esc(event.id)}">Kopiér køkkenbesked</button>
        <button class="btn soft" type="button" data-print-current="${esc(event.id)}">Print</button>
        <button class="btn soft" type="button" data-go-edit="${esc(event.id)}">Ret tilmeldinger</button>
      </div>

      ${changes.length ? `
        <div class="sub-block no-print">
          <h3>Ændringer siden sidst</h3>
          <div class="changes-list compact-list">
            ${changes.map(c => `<article class="change-card"><strong>${esc(c.name)}</strong><span>${esc(c.text)}</span></article>`).join('')}
          </div>
        </div>` : ''}

      ${listBlock('Spiser med', groups.memberMeals, 'Ingen brødre er tilmeldt mad.', row => esc(row.name))}
      ${listBlock('Gæster til mad', groups.guestMeals, 'Ingen gæster til mad.', row => `${esc(row.name)}${row.guestName ? ` · gæst: ${esc(row.guestName)}` : ' · gæst'}`)}
      ${listBlock('Deltager uden mad', groups.attendingNoMeal, 'Ingen deltagere uden mad.', row => esc(row.name))}
      ${listBlock('Noter', groups.notes, 'Ingen noter.', row => `<strong>${esc(row.name)}</strong><br><span>${esc(row.note)}</span>`)}
      ${listBlock('Mangler svar', groups.noReply, 'Alle har svaret.', member => esc(member.name))}
    </section>`;
}

function compactSummaryHtml(event){
  const s = getSummary(event.id);
  return `
    <section class="detail-card compact-detail">
      <div class="detail-head compact-head">
        <div>
          <p class="tag">Retter for</p>
          <h2>${esc(event.title)}</h2>
          <p>${cap(formatDate(event.date))} · kl. ${esc(displayTime(event.time))}</p>
        </div>
      </div>
      <div class="stats-grid small-stats">
        ${statHtml(s.totalMeals, 'Kuverter')}
        ${statHtml(s.memberMeals, 'Brødre')}
        ${statHtml(s.guestMeals, 'Gæster')}
        ${statHtml(s.noReply, 'Mangler')}
      </div>
      <div class="action-grid">
        <button class="btn primary" type="button" data-copy-event="${esc(event.id)}">Kopiér køkkenbesked</button>
        <button class="btn soft" type="button" data-open-event="${esc(event.id)}">Åbn fuldt overblik</button>
      </div>
    </section>`;
}

function listBlock(title, items, empty, render){
  return `
    <div class="sub-block">
      <h3>${esc(title)} <span>${items.length}</span></h3>
      ${items.length ? `<ul class="plain-list">${items.map(item => `<li>${render(item)}</li>`).join('')}</ul>` : `<p class="help-text">${esc(empty)}</p>`}
    </div>`;
}

function bindDynamicActions(){
  $$('[data-open-event]').forEach(el => el.onclick = event => {
    event.stopPropagation();
    openEvent(el.dataset.openEvent);
  });
  $$('[data-copy-event]').forEach(el => el.onclick = event => {
    event.stopPropagation();
    copyKitchenMessage(el.dataset.copyEvent);
  });
  $$('[data-print-current]').forEach(el => el.onclick = event => {
    event.stopPropagation();
    printEvent(el.dataset.printCurrent);
  });
  $$('[data-go-edit]').forEach(el => el.onclick = event => {
    event.stopPropagation();
    state.selectedEventId = el.dataset.goEdit;
    showView('edit');
    renderEditEventSelect();
    renderEditView();
  });
  $$('[data-edit-member]').forEach(el => el.onclick = () => openEditDialog(el.dataset.eventId, el.dataset.editMember));
}

function openEvent(eventId){
  const event = eventById(eventId);
  if (!event) return;
  els.eventDialogContent.innerHTML = detailHtml(event, { archive: isPast(event.date) });
  els.eventDialog.showModal();
  bindDynamicActions();
}

function openEditDialog(eventId, memberId){
  const event = eventById(eventId);
  const member = memberById(memberId);
  if (!event || !member) return;
  const signup = latestFor(eventId, memberId);

  state.currentEdit = {
    event,
    member,
    attending: signup?.attending || null,
    meal: signup?.meal || null,
    guest: signup?.guest === 'yes',
    guestName: signup?.guestName || '',
    guestMeal: signup?.guestMeal === 'yes',
    note: signup?.note || ''
  };

  els.editEventLabel.textContent = `${cap(formatDate(event.date))} · ${event.title}`;
  els.editName.textContent = member.name;
  els.editCurrentStatus.textContent = signup ? `Nuværende: ${statusText(signup)}${signup.updatedAt ? ` · ${formatUpdated(signup.updatedAt)}` : ''}` : 'Nuværende: ikke svaret';
  els.editGuest.checked = state.currentEdit.guest;
  els.editGuestName.value = state.currentEdit.guestName;
  els.editGuestMeal.checked = state.currentEdit.guestMeal;
  els.editNote.value = state.currentEdit.note;
  els.editSaveStatus.textContent = '';

  syncEditControls();
  els.editDialog.showModal();
}

function closeEditDialog(){
  els.editDialog.close();
  state.currentEdit = null;
}

function chooseAttending(value){
  if (!state.currentEdit) return;
  state.currentEdit.attending = value;
  if (value === 'no') {
    state.currentEdit.meal = 'no';
    state.currentEdit.guest = false;
    state.currentEdit.guestName = '';
    state.currentEdit.guestMeal = false;
    els.editGuest.checked = false;
    els.editGuestName.value = '';
    els.editGuestMeal.checked = false;
  }
  syncEditControls();
}

function chooseMeal(value){
  if (!state.currentEdit || state.currentEdit.attending !== 'yes') return;
  state.currentEdit.meal = value;
  syncEditControls();
}

function syncEditControls(){
  if (!state.currentEdit) return;
  state.currentEdit.guest = els.editGuest.checked;
  if (!state.currentEdit.guest) {
    els.editGuestName.value = '';
    els.editGuestMeal.checked = false;
  }
  state.currentEdit.guestName = els.editGuestName.value;
  state.currentEdit.guestMeal = els.editGuestMeal.checked;

  $$('[data-edit-attending]').forEach(btn => btn.classList.toggle('active', btn.dataset.editAttending === state.currentEdit.attending));
  $$('[data-edit-meal]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.editMeal === state.currentEdit.meal);
    btn.disabled = state.currentEdit.attending !== 'yes';
  });

  const disabled = state.currentEdit.attending !== 'yes';
  els.editMealBlock.style.opacity = disabled ? '.55' : '1';
  els.editGuest.disabled = disabled;
  els.editGuestDetails.hidden = !els.editGuest.checked || disabled;
  els.editGuestName.disabled = disabled || !els.editGuest.checked;
  els.editGuestMeal.disabled = disabled || !els.editGuest.checked;
}

async function saveEdit(){
  if (!state.currentEdit) return;
  const edit = state.currentEdit;

  if (!edit.attending) {
    els.editSaveStatus.textContent = 'Vælg om broderen deltager eller ej.';
    return;
  }
  if (edit.attending === 'yes' && !edit.meal) {
    els.editSaveStatus.textContent = 'Vælg om broderen spiser med eller ej.';
    return;
  }

  const signup = {
    memberId: edit.member.id,
    name: edit.member.name,
    navn: edit.member.name,
    eventId: edit.event.id,
    eventDate: edit.event.date,
    eventTime: edit.event.time,
    eventTitle: edit.event.title,
    attending: edit.attending,
    deltager: edit.attending,
    meal: edit.attending === 'yes' ? edit.meal : 'no',
    mad: edit.attending === 'yes' ? edit.meal : 'no',
    guest: edit.attending === 'yes' && els.editGuest.checked ? 'yes' : 'no',
    guestName: edit.attending === 'yes' && els.editGuest.checked ? els.editGuestName.value.trim() : '',
    guestFood: edit.attending === 'yes' && els.editGuest.checked && els.editGuestMeal.checked ? 'yes' : 'no',
    guestMeal: edit.attending === 'yes' && els.editGuest.checked && els.editGuestMeal.checked ? 'yes' : 'no',
    note: els.editNote.value.trim(),
    updatedAt: new Date().toISOString(),
    editedBy: 'Restauratør-app'
  };

  try {
    els.editSaveStatus.textContent = 'Gemmer rettelse…';
    els.saveEdit.disabled = true;
    const res = await fetch(CONFIG.GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(signup)
    });
    const data = await res.json();
    if (!(data.ok || data.success)) throw new Error(data.error || 'Ukendt fejl');
    els.editSaveStatus.textContent = 'Rettelse gemt.';
    await loadData(true);
    setTimeout(() => closeEditDialog(), 400);
  } catch (err) {
    console.warn('Kunne ikke gemme rettelse', err);
    els.editSaveStatus.textContent = 'Kunne ikke gemme rettelsen.';
  } finally {
    els.saveEdit.disabled = false;
  }
}

function copyKitchenMessage(eventId){
  const event = eventById(eventId);
  if (!event) return;
  const text = kitchenMessage(event);
  navigator.clipboard?.writeText(text).then(() => showToast('Køkkenbesked kopieret.')).catch(() => {
    showToast('Kunne ikke kopiere automatisk.');
    console.log(text);
  });
}

function kitchenMessage(event){
  const s = getSummary(event.id);
  const groups = getGroups(event.id);
  const notes = groups.notes.length ? groups.notes.map(r => `- ${r.name}: ${r.note}`).join('\n') : '- Ingen noter';
  const guests = groups.guestMeals.length ? groups.guestMeals.map(r => `- ${r.name}${r.guestName ? `: ${r.guestName}` : ': gæst'}`).join('\n') : '- Ingen gæster til mad';
  const missing = groups.noReply.length ? groups.noReply.map(m => m.name).join(', ') : 'Ingen';

  return [
    `Logeaften: ${event.title}`,
    `Dato: ${cap(formatDate(event.date))} kl. ${displayTime(event.time)}`,
    '',
    `Kuverter i alt: ${s.totalMeals}`,
    `Brødre til mad: ${s.memberMeals}`,
    `Gæster til mad: ${s.guestMeals}`,
    `Deltager uden mad: ${s.attendingNoMeal}`,
    `Deltager ikke: ${s.notAttending}`,
    `Ikke svaret: ${s.noReply}`,
    '',
    'Gæster:',
    guests,
    '',
    'Noter:',
    notes,
    '',
    `Mangler svar: ${missing}`
  ].join('\n');
}

function printEvent(eventId){
  const event = eventById(eventId);
  if (!event) return;
  els.eventDialogContent.innerHTML = detailHtml(event);
  document.body.classList.add('printing-event');
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printing-event');
  }, 50);
}

function showView(name){
  els.views.forEach(view => view.classList.toggle('active-view', view.id === `view${capId(name)}`));
  els.nav.forEach(btn => btn.classList.toggle('active', btn.dataset.view === name));
  if (name === 'next') renderNextView();
  if (name === 'edit') renderEditView();
}

function getSummary(eventId){
  const groups = getGroups(eventId);
  return {
    attending: groups.attending.length,
    memberMeals: groups.memberMeals.length,
    guestMeals: groups.guestMeals.length,
    totalMeals: groups.memberMeals.length + groups.guestMeals.length,
    attendingNoMeal: groups.attendingNoMeal.length,
    notAttending: groups.notAttending.length,
    noReply: groups.noReply.length
  };
}

function getGroups(eventId){
  const latestRows = Object.values(state.latest).filter(r => r.eventId === eventId);
  const byMember = new Map(latestRows.map(r => [String(r.memberId || memberIdFromName(r.name)), r]));

  const attending = latestRows.filter(r => r.attending === 'yes').sort(byName);
  const memberMeals = attending.filter(r => r.meal === 'yes').sort(byName);
  const guestMeals = attending.filter(r => r.guestMeal === 'yes').sort(byName);
  const attendingNoMeal = attending.filter(r => r.meal !== 'yes').sort(byName);
  const notAttending = latestRows.filter(r => r.attending === 'no').sort(byName);
  const notes = latestRows.filter(r => String(r.note || '').trim()).sort(byName);
  const noReply = state.members.filter(m => !byMember.has(String(m.id))).sort((a,b) => a.name.localeCompare(b.name, 'da'));
  return { attending, memberMeals, guestMeals, attendingNoMeal, notAttending, notes, noReply };
}

function membersWithStatus(eventId){
  return state.members.map(member => ({ member, signup: latestFor(eventId, member.id) })).sort((a,b) => a.member.name.localeCompare(b.member.name, 'da'));
}

function latestFor(eventId, memberId){
  return state.latest[`${eventId}__${memberId}`] || null;
}

function getLatestRows(rows){
  const latest = {};
  rows.forEach(row => {
    if (!row || !row.eventId) return;
    const memberId = row.memberId || memberIdFromName(row.name);
    const key = `${row.eventId}__${memberId}`;
    if (!latest[key] || new Date(row.updatedAt || 0) >= new Date(latest[key].updatedAt || 0)) latest[key] = { ...row, memberId };
  });
  return latest;
}

function buildSnapshot(){
  const snap = {};
  Object.values(state.latest).forEach(row => {
    const key = `${row.eventId}__${row.memberId || memberIdFromName(row.name)}`;
    snap[key] = {
      eventId: row.eventId,
      eventDate: row.eventDate || row.eventId,
      eventTitle: eventById(row.eventId)?.title || row.eventTitle || 'Logeaften',
      memberId: row.memberId || memberIdFromName(row.name),
      name: row.name,
      attending: row.attending,
      meal: row.meal,
      guest: row.guest,
      guestName: row.guestName,
      guestMeal: row.guestMeal,
      note: row.note,
      updatedAt: row.updatedAt
    };
  });
  return snap;
}

function findChanges(previous, current){
  if (!previous) return [];
  const changes = [];
  Object.entries(current).forEach(([key, now]) => {
    const before = previous[key];
    if (!before) {
      changes.push({ ...now, text: `ny tilmelding: ${plainStatus(now)}` });
      return;
    }
    const fields = ['attending','meal','guest','guestName','guestMeal','note'];
    const changed = fields.some(field => String(before[field] || '') !== String(now[field] || ''));
    if (!changed) return;
    changes.push({ ...now, text: `${plainStatus(before)} → ${plainStatus(now)}` });
  });
  return changes.sort((a,b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

function normalizeMembers(input){
  if (!Array.isArray(input) || !input.length) return [];
  let members;
  if (Array.isArray(input[0])) {
    const header = input[0].map(h => normalizeKey(h));
    const idIndex = findIndex(header, ['id','memberid','medlemsnr']);
    const nameIndex = findIndex(header, ['navn','name','broder']);
    members = input.slice(1).map(row => ({ id: row[idIndex], name: row[nameIndex] }));
  } else {
    members = input.map(m => ({ id: m.id || m.memberId || m.medlemsnr || m.nummer || m.name || m.navn, name: m.name || m.navn || m.broder }));
  }
  return members
    .filter(m => m.id && m.name)
    .map(m => ({ id: String(m.id).trim(), name: String(m.name).trim() }))
    .sort((a,b) => a.name.localeCompare(b.name, 'da'));
}

function normalizeEvents(input){
  if (!Array.isArray(input) || !input.length) return [];
  let events;
  if (Array.isArray(input[0])) {
    const header = input[0].map(h => normalizeKey(h));
    const idx = names => findIndex(header, names);
    events = input.slice(1).map(row => ({
      id: row[idx(['id','eventid'])],
      date: row[idx(['dato','date'])],
      time: row[idx(['tid','time','kl'])],
      title: row[idx(['titel','title'])],
      description: row[idx(['beskrivelse','description'])],
      category: row[idx(['kategori','category','type'])],
      allowGuests: row[idx(['allowguests','gæstertilladt','gaestertilladt','gastertilladt'])],
      deadline: row[idx(['deadline','frist','tilmeldingsfrist'])]
    }));
  } else {
    events = input;
  }

  return events.map(normalizeEvent).filter(e => e.id && e.date).sort((a,b) => String(a.date + a.time).localeCompare(String(b.date + b.time)));
}

function normalizeEvent(e){
  const date = normalizeDate(e.date || e.dato || e.eventDate || e.id || '');
  const id = normalizeDate(e.id || e.eventId || date);
  return {
    id,
    date,
    time: normalizeTime(e.time || e.tid || e.eventTime || '19:00'),
    title: String(e.title || e.titel || e.eventTitle || 'Logeaften').trim(),
    description: String(e.description || e.beskrivelse || '').trim(),
    category: String(e.category || e.kategori || e.type || '').trim(),
    allowGuests: isYes(e.allowGuests ?? e.gæsterTilladt ?? e.gaesterTilladt),
    deadline: normalizeDeadline(e.deadline || e.frist || e.tilmeldingsfrist || '', date)
  };
}

function normalizeRows(input){
  if (!Array.isArray(input) || !input.length) return [];
  let rows;
  if (Array.isArray(input[0])) {
    const header = input[0].map(h => String(h).trim());
    rows = input.slice(1).filter(r => r.length).map(row => {
      const obj = {};
      header.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  } else {
    rows = input;
  }
  return rows.map(normalizeRow).filter(r => r.eventId && (r.memberId || r.name));
}

function normalizeRow(row){
  const name = String(row.name || row.navn || row.broder || '').trim();
  return {
    memberId: String(row.memberId || row.id || memberIdFromName(name) || '').trim(),
    name,
    eventId: normalizeDate(row.eventId || row.eventDate || row.dato || ''),
    eventDate: normalizeDate(row.eventDate || row.dato || row.eventId || ''),
    eventTime: row.eventTime || row.tid || '',
    eventTitle: row.eventTitle || row.titel || '',
    attending: yn(row.attending || row.deltager || row.deltagelse),
    meal: yn(row.meal || row.mad || row.spiser),
    guest: yn(row.guest || row.gaest || row.gæst),
    guestName: String(row.guestName || row.gaesteNavn || row.gæsteNavn || row.gaestNavn || '').trim(),
    guestMeal: yn(row.guestMeal || row.guestFood || row.gaestMad || row.gæstMad),
    note: String(row.note || row.bemaerkning || row.bemærkning || '').trim(),
    updatedAt: row.updatedAt || row.timestamp || row.tidspunkt || new Date().toISOString()
  };
}

function normalizeDate(value){
  if (value instanceof Date && !isNaN(value)) return value.toISOString().slice(0,10);
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const dk = raw.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (dk) {
    const year = dk[3].length === 2 ? `20${dk[3]}` : dk[3];
    return `${year}-${String(dk[2]).padStart(2,'0')}-${String(dk[1]).padStart(2,'0')}`;
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed)) return parsed.toISOString().slice(0,10);
  return raw;
}

function normalizeTime(value){
  const raw = String(value || '').trim();
  if (!raw) return '19:00';
  const match = raw.match(/(\d{1,2})[:.](\d{2})(?![.\/-]\d)/);
  if (match) return `${String(match[1]).padStart(2,'0')}:${match[2]}`;
  const hour = raw.match(/^\d{1,2}$/);
  if (hour) return `${String(raw).padStart(2,'0')}:00`;
  return raw;
}

function normalizeDeadline(value, eventDate){
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = normalizeDate(raw) || eventDate;
  const time = normalizeTime(raw.includes(':') || raw.includes('.') ? raw : '23:59');
  return `${date}T${time}:00`;
}

function getUpcomingEvents(){
  return state.events.filter(e => !isPast(e.date));
}

function getPastEvents(){
  return state.events.filter(e => isPast(e.date)).reverse();
}

function eventById(id){ return state.events.find(e => String(e.id) === String(id)); }
function memberById(id){ return state.members.find(m => String(m.id) === String(id)); }
function memberIdFromName(name){ return state.members.find(m => norm(m.name) === norm(name))?.id || norm(name); }

function statusText(signup){
  if (!signup) return 'Ikke svaret';
  if (signup.attending === 'no') return 'Deltager ikke';
  if (signup.attending === 'yes' && signup.meal === 'yes') return signup.guestMeal === 'yes' ? 'Deltager · mad · gæstemad' : 'Deltager · mad';
  if (signup.attending === 'yes') return signup.guestMeal === 'yes' ? 'Deltager · uden mad · gæstemad' : 'Deltager · uden mad';
  return 'Ikke svaret';
}

function plainStatus(signup){
  if (!signup || !signup.attending) return 'ikke svaret';
  let parts = [];
  parts.push(signup.attending === 'yes' ? 'deltager' : 'deltager ikke');
  if (signup.attending === 'yes') parts.push(signup.meal === 'yes' ? 'mad' : 'uden mad');
  if (signup.guestMeal === 'yes') parts.push('gæstemad');
  if (signup.note) parts.push('note');
  return parts.join(' · ');
}

function statusClass(signup){
  if (!signup) return 'status-none';
  if (signup.attending === 'no') return 'status-no';
  if (signup.attending === 'yes' && signup.meal === 'yes') return 'status-yes';
  if (signup.attending === 'yes') return 'status-warn';
  return 'status-none';
}

function deadlineText(event){
  if (!event.deadline) return '';
  const d = new Date(event.deadline);
  if (isNaN(d)) return '';
  return `Tilmeldingsfrist: ${shortDateFmt.format(d)} kl. ${timeFmt.format(d)}`;
}

function statHtml(value, label){
  return `<div class="stat-card"><strong>${Number(value) || 0}</strong><span>${esc(label)}</span></div>`;
}

function setStatus(text, error=false){
  els.sync.textContent = text;
  els.sync.classList.toggle('error', error);
}

function showToast(text){
  els.toast.textContent = text;
  els.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.hidden = true, 2600);
}

function hideLoading(){
  if (!els.loading) return;
  els.loading.classList.add('hidden');
  setTimeout(() => els.loading.remove(), 350);
}

function closeDialogOnBackdrop(event, dialog){
  const sheet = dialog.querySelector('.sheet');
  if (!sheet) return;
  const rect = sheet.getBoundingClientRect();
  const inside = rect.top <= event.clientY && event.clientY <= rect.bottom && rect.left <= event.clientX && event.clientX <= rect.right;
  if (!inside) dialog.close();
}

async function installApp(){
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  els.install.hidden = true;
}

function registerServiceWorker(){
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker kunne ikke registreres', err));
  }
}

function byName(a,b){ return String(a.name || '').localeCompare(String(b.name || ''), 'da'); }
function isPast(date){ const d = new Date(`${normalizeDate(date)}T23:59:59`); const now = new Date(); now.setHours(0,0,0,0); return d < now; }
function isYes(v){ return ['yes','ja','true','1','x','on'].includes(norm(v)); }
function yn(v){ return isYes(v) ? 'yes' : ['no','nej','false','0'].includes(norm(v)) ? 'no' : ''; }
function norm(v){ return String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function normalizeKey(v){ return norm(v).replace(/[^a-z0-9]/g,''); }
function findIndex(header, names){ const normalized = names.map(normalizeKey); return header.findIndex(h => normalized.includes(normalizeKey(h))); }
function esc(v){ return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function cap(v){ const s = String(v || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
function capId(v){ return String(v).charAt(0).toUpperCase() + String(v).slice(1); }
function formatDate(date){ return dateFmt.format(new Date(`${normalizeDate(date)}T12:00:00`)); }
function shortDate(date){ return shortDateFmt.format(new Date(`${normalizeDate(date)}T12:00:00`)); }
function day(date){ return new Date(`${normalizeDate(date)}T12:00:00`).getDate(); }
function month(date){ return shortMonthFmt.format(new Date(`${normalizeDate(date)}T12:00:00`)).replace('.', ''); }
function displayTime(time){ return String(time || '').replace(':','.'); }
function formatUpdated(value){ const d = new Date(value); return isNaN(d) ? '' : `rettet ${shortDateFmt.format(d)} kl. ${timeFmt.format(d)}`; }
