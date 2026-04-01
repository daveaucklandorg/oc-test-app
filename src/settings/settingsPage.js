export function renderSettingsPage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Settings</title>
    <style>
      body {
        font-family: system-ui, sans-serif;
        margin: 2rem;
        max-width: 900px;
      }

      h1 {
        margin-top: 0;
      }

      form {
        display: grid;
        gap: 0.75rem;
        max-width: 420px;
        margin-bottom: 1.5rem;
      }

      label {
        display: grid;
        gap: 0.25rem;
      }

      input, button {
        font: inherit;
        padding: 0.5rem;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th, td {
        padding: 0.75rem;
        border-bottom: 1px solid #ddd;
        text-align: left;
        vertical-align: top;
      }

      .actions {
        display: flex;
        gap: 0.5rem;
      }

      #message {
        min-height: 1.5rem;
        margin: 0.75rem 0;
        color: #0a5;
      }

      #message.error {
        color: #b00;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Settings</h1>
      <p>Manage key-value application settings.</p>

      <form id="settings-form">
        <label>
          Key
          <input id="key" name="key" type="text" required>
        </label>
        <label>
          Value
          <input id="value" name="value" type="text" required>
        </label>
        <div class="actions">
          <button type="submit">Save setting</button>
          <button type="button" id="reset-form">Clear</button>
        </div>
      </form>

      <div id="message" aria-live="polite"></div>

      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="settings-table-body">
          <tr>
            <td colspan="3">Loading settings…</td>
          </tr>
        </tbody>
      </table>
    </main>

    <script>
      const form = document.getElementById('settings-form');
      const keyInput = document.getElementById('key');
      const valueInput = document.getElementById('value');
      const resetButton = document.getElementById('reset-form');
      const message = document.getElementById('message');
      const tableBody = document.getElementById('settings-table-body');

      function showMessage(text, isError) {
        message.textContent = text;
        message.className = isError ? 'error' : '';
      }

      function escapeHtml(value) {
        return value
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#39;');
      }

      function populateForm(setting) {
        keyInput.value = setting.key;
        valueInput.value = setting.value;
        keyInput.focus();
      }

      function renderRows(settings) {
        if (settings.length === 0) {
          tableBody.innerHTML = '<tr><td colspan="3">No settings yet.</td></tr>';
          return;
        }

        tableBody.innerHTML = settings.map(function (setting) {
          const safeKey = escapeHtml(setting.key);
          const safeValue = escapeHtml(setting.value);

          return '<tr>'
            + '<td>' + safeKey + '</td>'
            + '<td>' + safeValue + '</td>'
            + '<td><div class="actions">'
            + '<button type="button" data-action="edit" data-key="' + safeKey + '">Edit</button>'
            + '<button type="button" data-action="delete" data-key="' + safeKey + '">Delete</button>'
            + '</div></td>'
            + '</tr>';
        }).join('');
      }

      async function loadSettings() {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        renderRows(settings);
      }

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        showMessage('', false);

        const key = keyInput.value.trim();
        const value = valueInput.value;

        const response = await fetch('/api/settings/' + encodeURIComponent(key), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: value })
        });

        if (!response.ok) {
          const payload = await response.json().catch(function () {
            return { error: 'Request failed' };
          });
          showMessage(payload.error || 'Request failed', true);
          return;
        }

        const savedSetting = await response.json();
        showMessage('Saved ' + savedSetting.key + '.', false);
        form.reset();
        await loadSettings();
      });

      resetButton.addEventListener('click', function () {
        form.reset();
        showMessage('', false);
        keyInput.focus();
      });

      tableBody.addEventListener('click', async function (event) {
        const target = event.target;

        if (!(target instanceof HTMLButtonElement)) {
          return;
        }

        const action = target.dataset.action;
        const key = target.dataset.key;

        if (!action || !key) {
          return;
        }

        if (action === 'edit') {
          const response = await fetch('/api/settings/' + encodeURIComponent(key));
          const setting = await response.json();
          populateForm(setting);
          showMessage('Editing ' + setting.key + '.', false);
          return;
        }

        if (action === 'delete') {
          const response = await fetch('/api/settings/' + encodeURIComponent(key), {
            method: 'DELETE'
          });

          if (!response.ok) {
            const payload = await response.json().catch(function () {
              return { error: 'Delete failed' };
            });
            showMessage(payload.error || 'Delete failed', true);
            return;
          }

          showMessage('Deleted ' + key + '.', false);
          await loadSettings();
        }
      });

      loadSettings().catch(function (error) {
        console.error(error);
        showMessage('Failed to load settings.', true);
        tableBody.innerHTML = '<tr><td colspan="3">Failed to load settings.</td></tr>';
      });
    </script>
  </body>
</html>`;
}
