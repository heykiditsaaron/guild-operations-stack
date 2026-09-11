async function send(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

for (const form of document.querySelectorAll('[data-coordinator-form]')) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('[data-coordinator-status]');
    const controls = [...form.querySelectorAll('button, input, select')];
    for (const control of controls) control.disabled = true;
    if (status) status.textContent = 'Saving…';
    try {
      const data = formDataObject(form);
      const payload = await send(form.dataset.endpoint, data);
      if (payload.redirect) window.location.href = payload.redirect;
      else window.location.reload();
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
      for (const control of controls) control.disabled = false;
    }
  });
}

for (const button of document.querySelectorAll('[data-coordinator-action]')) {
  button.addEventListener('click', async () => {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Working…';
    try {
      await send(button.dataset.endpoint, {});
      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
      button.disabled = false;
      button.textContent = original;
    }
  });
}
