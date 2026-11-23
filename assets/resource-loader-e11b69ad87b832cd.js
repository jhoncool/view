// Resource URLs come from the same build as this module.
const pending = new Map();

function loadOnce(key, read, apply) {
  if (pending.has(key)) return pending.get(key);
  const request = read().then(value => {
    apply(value);
    pending.set(key, undefined);
  }).catch(error => {
    pending.delete(key);
    throw error;
  });
  pending.set(key, request);
  return request;
}

async function read(url, format) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response[format]();
}

export function createPagesAssets(modules) {
  const drawings = new Map();
  return {
    drawings,
    load(keys, files, applyData, drawing) {
      const requests = keys.map(key => {
        if (Object.hasOwn(modules, key)) {
          const [load, apply] = modules[key];
          return loadOnce(key, load, apply);
        }
        const url = files[key];
        if (!url) throw new Error(`Unknown viewer resource: ${key}`);
        return loadOnce(key, () => read(url, 'json'), applyData);
      });
      if (drawing?.endsWith('.svg')) {
        requests.push(loadOnce(drawing, () => read(drawing, 'text'), source => drawings.set(drawing, source)));
      }
      const waiting = requests.filter(Boolean);
      return waiting.length ? Promise.all(waiting) : undefined;
    },
  };
}
