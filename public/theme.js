(() => {
  const STORAGE_KEY = 'financeiro_theme';
  const root = document.documentElement;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const saved = localStorage.getItem(STORAGE_KEY);
  let currentTheme = saved === 'dark' || saved === 'light' ? saved : 'light';

  function updateButton() {
    const button = document.querySelector('#globalThemeToggle');
    if (!button) return;
    const dark = currentTheme === 'dark';
    button.innerHTML = `<span class="theme-toggle-icon" aria-hidden="true">${dark ? '☀' : '☾'}</span><span class="theme-toggle-label">${dark ? 'Modo claro' : 'Modo noturno'}</span>`;
    button.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo noturno');
    button.setAttribute('title', dark ? 'Ativar modo claro' : 'Ativar modo noturno');
  }

  function applyTheme(theme, persist = true) {
    currentTheme = theme === 'dark' ? 'dark' : 'light';
    root.dataset.theme = currentTheme;
    root.style.colorScheme = currentTheme;
    if (metaTheme) metaTheme.setAttribute('content', currentTheme === 'dark' ? '#070b16' : '#f5f7fb');
    if (persist) localStorage.setItem(STORAGE_KEY, currentTheme);
    updateButton();
  }

  function mountToggle() {
    if (document.querySelector('#globalThemeToggle')) return;
    const button = document.createElement('button');
    button.id = 'globalThemeToggle';
    button.className = 'theme-toggle';
    button.type = 'button';
    button.addEventListener('click', () => applyTheme(currentTheme === 'dark' ? 'light' : 'dark'));
    document.body.appendChild(button);
    updateButton();
  }

  applyTheme(currentTheme, false);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountToggle, { once: true });
  else mountToggle();

  window.financeiroTheme = {
    get: () => currentTheme,
    set: theme => applyTheme(theme)
  };
})();
