// Tiny DOM helpers for future modules.
export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
export function on(type, selector, handler, scope = document){
  scope.addEventListener(type, (event) => {
    const target = event.target.closest(selector);
    if (target) handler(event, target);
  });
}
