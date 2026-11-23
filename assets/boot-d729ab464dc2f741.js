const mount = document.getElementById('pages-mount');

async function fetchResource(url, format) {
 const response = await fetch(new URL(url, import.meta.url));
 if (!response.ok) throw new Error(`${response.status} ${response.url}`);
 return response[format]();
}

async function start() {
 mount.setAttribute('aria-busy', 'true');
 try {
  const [workspace, data] = await Promise.all([
   fetchResource('./workspace-d00908f579e5e6ca.html', 'text'),
   fetchResource('./project-catalog-9033e054771f2458.json', 'json'),
  ]);
  mount.innerHTML = workspace;
  const dataElement = document.createElement('script');
  dataElement.id = 'project-data';
  dataElement.type = 'application/json';
  dataElement.textContent = JSON.stringify(data);
  mount.append(dataElement);
  await import('./workspace-ui-e75fee584eb94fce.js');
 } catch (error) {
  console.error(error);
  const retry = document.createElement('button');
  retry.textContent = 'Повторить';
  retry.onclick = () => location.reload();
  const message = document.createElement('p');
  message.className = 'workspace-loading';
  message.setAttribute('role', 'alert');
  message.append('Просмотрщик не загрузился. ', retry);
  mount.replaceChildren(message);
 } finally {
  mount.setAttribute('aria-busy', 'false');
 }
}

start();
