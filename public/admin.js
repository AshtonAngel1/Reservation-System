function setupTabs() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.admin-panel').forEach(panel => {
        panel.style.display = panel.id === tab ? 'block' : 'none';
      });
    });
  });
}

async function loadAnalytics() {
  const res = await fetch('/admin/analytics');
  const data = await res.json();
  const el = document.getElementById('analytics');

  const itemList = (data.top_three_requested_items_this_month || []).map(i => `<li>${i.name} (${i.total})</li>`).join('') || '<li>None</li>';
  const staffList = (data.top_three_staff_this_month || []).map(i => `<li>${i.staff_name} (${i.total})</li>`).join('') || '<li>None</li>';
  const userList = (data.top_three_users_this_month || []).map(i => `<li>${i.email} (${i.total})</li>`).join('') || '<li>None</li>';
  const cancelCategory = (data.cancellations_this_month_by_category || []).map(i => `<li>${i.category}: ${i.total}</li>`).join('') || '<li>None</li>';

  el.innerHTML = `
    <h2>Analytics</h2>
    <p><strong>All Time Registered Users:</strong> ${data.all_time_registered_users || 0}</p>
    <p><strong>All Time Reservations:</strong> ${data.all_time_reservations || 0}</p>
    <p><strong>Reservations This Month:</strong> ${data.reservations_this_month || 0}</p>
    <p><strong>Unique Users This Month:</strong> ${data.unique_users_this_month || 0}</p>
    <p><strong>Total Cancellations:</strong> ${data.total_cancellations || 0}</p>
    <p><strong>Cancellations This Month:</strong> ${data.cancellations_this_month || 0}</p>
    <h3>Top 3 Requested Items (Month)</h3><ul>${itemList}</ul>
    <h3>Top 3 Staff (Month)</h3><ul>${staffList}</ul>
    <h3>Top 3 Users (Month)</h3><ul>${userList}</ul>
    <h3>Cancellations by Category (Month)</h3><ul>${cancelCategory}</ul>
  `;
}

// Can add ItemType later if needed (update delete button)
async function loadReservations() {
  const res = await fetch('/admin/reservations');
  const rows = await res.json();
  const tbody = document.getElementById('reservationRows');
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.item_name}</td>
      <td>${r.user_email}</td>
      <td>${new Date(r.start_date).toLocaleString()}</td>
      <td>${new Date(r.end_date).toLocaleString()}</td>
      <td><button data-id="${r.id}" class="cancel-res-btn">Cancel</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.cancel-res-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const reason = prompt('Cancellation reason (required):');
      if (!reason) return;
      await fetch(`/admin/reservations/${btn.dataset.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      await loadReservations();
      await loadCancellations();
      await loadAnalytics();
    });
  });
}

async function loadCancellations() {
  const res = await fetch('/admin/cancellations');
  const rows = await res.json();
  const tbody = document.getElementById('cancellationRows');
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.item_name}</td>
      <td>${r.user_email}</td>
      <td>${r.cancel_category || 'unknown'}</td>
      <td>${r.cancel_reason || ''}</td>
      <td>${r.canceled_at ? new Date(r.canceled_at).toLocaleString() : ''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Implement Delete user route
async function loadUsers() {
  const res = await fetch('/admin/users');

  if (!res.ok) {
    alert("Failed to load users");
    return;
  }

  const rows = await res.json();
  const tbody = document.getElementById('userRows');
  tbody.innerHTML = '';

  rows.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.email}</td>
      <td>${u.days_registered || 0}</td>
      <td>${u.total_reservations || 0}</td>
      <td>${u.past_reservations || 0}</td>
      <td>${u.upcoming_reservations || 0}</td>
      <td><button class="delete-user" data-id="${u.id}">Soft Delete</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.delete-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      await fetch(`/admin/users/${btn.dataset.id}`, { method: 'DELETE' });
      await loadUsers();
    });
  });
}

setupTabs();
loadAnalytics();
loadReservations();
loadCancellations();
loadUsers();
