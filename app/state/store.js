// Central store placeholder for the next clean state migration.
export const store = {
  user: null,
  tasks: [],
  spaces: [],
  settings: {},
  focus: {},
  ai: {},
};
export function patchStore(next){ Object.assign(store, next || {}); return store; }
