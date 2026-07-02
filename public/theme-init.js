// Theme bootstrap — loaded as a parser-blocking script from the root layout so
// it runs before first paint (no flash of the wrong theme). External file (not
// inline) because the admin CSP drops 'unsafe-inline' for script-src.
// Mirrors resolveTheme() in src/lib/theme.ts: explicit stored choice, else system.
(function () {
  var theme = 'light';
  try {
    var stored = localStorage.getItem('rb-theme');
    theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
  } catch (_) {}
  document.documentElement.dataset.theme = theme;
})();
