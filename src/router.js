import { create, deleteById, deleteSetting, getAll, getAllSettings, getById, getSetting, update, upsertSetting } from './db.js';

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendMethodNotAllowed(res) {
  sendJson(res, 405, { error: 'Method Not Allowed' });
}

function sendNotFound(res) {
  sendJson(res, 404, { error: 'Not Found' });
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();

  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON body');
  }
}

function parseContactId(pathname) {
  const match = pathname.match(/^\/api\/contacts\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function parseSettingKey(pathname) {
  const match = pathname.match(/^\/api\/settings\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderSettingsPage(settings) {
  const rows = settings.length
    ? settings
        .map(
          (setting) => `
            <tr>
              <td>${escapeHtml(setting.key)}</td>
              <td>${escapeHtml(setting.value ?? '')}</td>
              <td>
                <button type="button" data-action="edit" data-key="${escapeHtml(setting.key)}" data-value="${escapeHtml(setting.value ?? '')}">Edit</button>
                <button type="button" data-action="delete" data-key="${escapeHtml(setting.key)}">Delete</button>
              </td>
            </tr>
          `,
        )
        .join('')
    : '<tr><td colspan="3">No settings saved yet.</td></tr>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Settings</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; }
      form { display: grid; gap: 0.75rem; max-width: 28rem; margin-bottom: 1.5rem; }
      input, button { font: inherit; padding: 0.5rem; }
      table { border-collapse: collapse; width: 100%; max-width: 48rem; }
      th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
      .actions { display: flex; gap: 0.5rem; }
      #status { margin: 1rem 0; min-height: 1.5rem; }
    </style>
  </head>
  <body>
    <h1>Settings</h1>
    <p>Manage key-value settings stored in SQLite.</p>

    <form id="settings-form">
      <label>
        Key
        <input id="key" name="key" required />
      </label>
      <label>
        Value
        <input id="value" name="value" />
      </label>
      <div class="actions">
        <button type="submit">Save</button>
        <button type="button" id="reset-form">Clear</button>
      </div>
    </form>

    <div id="status" aria-live="polite"></div>

    <table>
      <thead>
        <tr>
          <th>Key</th>
          <th>Value</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="settings-rows">${rows}</tbody>
    </table>

    <script>
      const form = document.getElementById('settings-form');
      const keyInput = document.getElementById('key');
      const valueInput = document.getElementById('value');
      const status = document.getElementById('status');
      const resetButton = document.getElementById('reset-form');

      function setStatus(message, isError = false) {
        status.textContent = message;
        status.style.color = isError ? 'crimson' : 'inherit';
      }

      async function refreshSettings() {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        const tbody = document.getElementById('settings-rows');

        if (!settings.length) {
          tbody.innerHTML = '<tr><td colspan="3">No settings saved yet.</td></tr>';
          return;
        }

        tbody.innerHTML = settings.map((setting) => {
          const key = String(setting.key)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
          const value = String(setting.value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');

          return '<tr>'
            + '<td>' + key + '</td>'
            + '<td>' + value + '</td>'
            + '<td>'
            + '<button type="button" data-action="edit" data-key="' + key + '" data-value="' + value + '">Edit</button>'
            + '<button type="button" data-action="delete" data-key="' + key + '">Delete</button>'
            + '</td>'
            + '</tr>';
        }).join('');
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        setStatus('Saving...');

        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: keyInput.value, value: valueInput.value }),
        });

        if (!response.ok) {
          const payload = await response.json();
          setStatus(payload.error || 'Failed to save setting.', true);
          return;
        }

        await refreshSettings();
        setStatus('Setting saved.');
      });

      resetButton.addEventListener('click', () => {
        form.reset();
        keyInput.focus();
        setStatus('');
      });

      document.body.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');

        if (!button) {
          return;
        }

        const { action, key, value } = button.dataset;

        if (action === 'edit') {
          keyInput.value = key;
          valueInput.value = value || '';
          keyInput.focus();
          setStatus('Editing ' + key);
          return;
        }

        if (action === 'delete') {
          const response = await fetch('/api/settings/' + encodeURIComponent(key), { method: 'DELETE' });

          if (!response.ok) {
            const payload = await response.json();
            setStatus(payload.error || 'Failed to delete setting.', true);
            return;
          }

          if (keyInput.value === key) {
            form.reset();
          }

          await refreshSettings();
          setStatus('Deleted ' + key);
        }
      });
    </script>
  </body>
</html>`;
}

export async function router(req, res) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;

  try {
    if (pathname === '/settings') {
      if (method !== 'GET') {
        return sendMethodNotAllowed(res);
      }

      return sendHtml(res, 200, renderSettingsPage(getAllSettings()));
    }

    if (pathname === '/api/health') {
      if (method !== 'GET') {
        return sendMethodNotAllowed(res);
      }

      return sendJson(res, 200, { status: 'ok' });
    }

    if (pathname === '/api/contacts') {
      if (method === 'GET') {
        return sendJson(res, 200, getAll());
      }

      if (method === 'POST') {
        const body = await readJsonBody(req);
        const contact = create(body);
        return sendJson(res, 201, contact);
      }

      return sendMethodNotAllowed(res);
    }

    if (pathname === '/api/settings') {
      if (method === 'GET') {
        return sendJson(res, 200, getAllSettings());
      }

      if (method === 'POST') {
        const body = await readJsonBody(req);
        const { setting, created } = upsertSetting(body.key, body.value);
        return sendJson(res, created ? 201 : 200, setting);
      }

      return sendMethodNotAllowed(res);
    }

    const contactId = parseContactId(pathname);

    if (contactId !== null) {
      if (method === 'GET') {
        const contact = getById(contactId);
        return contact ? sendJson(res, 200, contact) : sendNotFound(res);
      }

      if (method === 'PUT') {
        const body = await readJsonBody(req);
        const contact = update(contactId, body);
        return contact ? sendJson(res, 200, contact) : sendNotFound(res);
      }

      if (method === 'DELETE') {
        const deleted = deleteById(contactId);

        if (!deleted) {
          return sendNotFound(res);
        }

        res.writeHead(204, { 'Content-Type': 'application/json' });
        return res.end();
      }

      return sendMethodNotAllowed(res);
    }

    const settingKey = parseSettingKey(pathname);

    if (settingKey !== null) {
      if (method === 'GET') {
        const setting = getSetting(settingKey);
        return setting ? sendJson(res, 200, setting) : sendNotFound(res);
      }

      if (method === 'DELETE') {
        const deleted = deleteSetting(settingKey);

        if (!deleted) {
          return sendNotFound(res);
        }

        res.writeHead(204, { 'Content-Type': 'application/json' });
        return res.end();
      }

      return sendMethodNotAllowed(res);
    }

    return sendNotFound(res);
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid JSON body') {
      return sendJson(res, 400, { error: error.message });
    }

    if (error instanceof Error && (error.message === 'name is required' || error.message === 'key is required')) {
      return sendJson(res, 400, { error: error.message });
    }

    console.error(error);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
}
