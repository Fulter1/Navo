// Shared motion utilities for future screens.
export function revealNow(selector = '.reveal-on-scroll'){
  document.querySelectorAll(selector).forEach(el => el.classList.add('visible'));
}
