// Local Smart Engine: safe browser-side intelligence without exposing API keys.
const HIGH = ['اختبار','تسليم','deadline','urgent','مهم','ضروري'];
export function scoreTask(title = ''){
  const text = title.toLowerCase();
  let score = 1;
  if (HIGH.some(word => text.includes(word))) score += 5;
  if (text.includes('راجع') || text.includes('study') || text.includes('جامعة')) score += 2;
  return score;
}
export function sortTasks(tasks = []){
  return [...tasks].sort((a,b)=> scoreTask(b.title || '') - scoreTask(a.title || ''));
}
export function suggestionFromTasks(tasks = []){
  const first = sortTasks(tasks).find(t => !t.done);
  return first ? `ابدأ بهدوء: ${first.title}` : 'مساحتك جاهزة لبداية هادئة.';
}
