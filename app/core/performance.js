// Navo Core: performance guardrails run before the full runtime.
export function bootPerformance(){
  const memory = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  const low = memory <= 4 || cores <= 4 || matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.dataset.navoReady = 'true';
  document.body.classList.toggle('performance-low', low);
}
bootPerformance();
