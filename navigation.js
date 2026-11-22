(() => {
  const names = ['ai','schedule','prepare','plans'];
  const tabs = [...document.querySelectorAll('.tc-nav-button')];
  const views = Object.fromEntries(names.map(n => [n, document.getElementById('view-' + n)]));
  const tips = document.getElementById('aiTips');
  function activate(name, scroll = true) {
    if (!names.includes(name)) name = 'ai';
    for (const tab of tabs) {
      const active = tab.dataset.view === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const n of names) views[n].hidden = n !== name;
    tips.hidden = name !== 'ai';
    document.body.dataset.view = name;
    if (scroll) document.querySelector('.tc-main-nav').scrollIntoView({behavior:'smooth',block:'start'});
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(tab.dataset.view));
    tab.addEventListener('keydown', e => {
      if (!['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) return;
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? 3 : (i + (e.key === 'ArrowRight' ? 1 : 3)) % 4;
      tabs[next].focus(); activate(tabs[next].dataset.view, false);
    });
  });
  document.getElementById('goScheduleFromAI')?.addEventListener('click', () => activate('schedule'));
  document.getElementById('goPlans').addEventListener('click', () => activate('plans'));
  document.getElementById('confirmImport').addEventListener('click', () => {
    if (document.getElementById('importPreview').hidden) activate('schedule', false);
  });
  window.travelConciergeShowView = activate;
  activate('ai', false);
})();
