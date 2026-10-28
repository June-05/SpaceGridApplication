/*
 * renter-dashboard.js — Controller script for renter/dashboard.html
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Session verification
  try {
    if (typeof auth !== 'undefined' && typeof auth.requireLogin === 'function') {
      await auth.requireLogin('RENTER');
    }
  } catch (e) {
    console.warn('Auth check skipped or offline:', e);
  }

  // 2. Control setup
  setupLogout();
  setupSearchFilter();

  // 3. Render leases
  await loadRenterLeases();
});

async function loadRenterLeases() {
  const container = document.getElementById('leases');
  if (!container) return;

  let leases = [];

  try {
    leases = await api.get('/api/leases');
  } catch (err) {
    console.error('Failed to fetch leases:', err);
    container.innerHTML = '<p class="error-data">Unable to load leases. Please try again later.</p>';
    return;
  }

  if (!leases || leases.length === 0) {
    container.innerHTML = '<p class="no-data">No active leases found.</p>';
    return;
  }

  const cardElementsHtml = await Promise.all(
    leases.map(async (lease) => {
      let nextDueFormatted = '₱0.00';

      try {
        const statement = await api.get(`/api/leases/${lease.id}/statement`);
        if (Array.isArray(statement)) {
          const dueItem = statement.find(
            (item) => item.status === 'OVERDUE' || item.status === 'DUE'
          );
          if (dueItem) {
            nextDueFormatted = typeof format !== 'undefined' && format.currency 
              ? format.currency(dueItem.amount) 
              : `₱${Number(dueItem.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
          }
        }
      } catch (err) {
        console.warn(`Unable to fetch statement for lease ID ${lease.id}:`, err);
      }

      const stateBadge = (lease.currentState || 'ACTIVE').toUpperCase();
      const stateClass = stateBadge.toLowerCase();

      return `
        <article class="card lease-card" data-search="${(lease.propertyName || '').toLowerCase()} ${(lease.unitName || '').toLowerCase()}">
          <div class="lease-header">
            <h2>${lease.propertyName || 'Property Unit'}</h2>
            <span class="badge badge-${stateClass}">${stateBadge}</span>
          </div>

          <!-- Image Placeholder between Title and Unit Info -->
          <div class="lease-card-image">
            ${lease.imageUrl 
              ? `<img src="${lease.imageUrl}" alt="${lease.propertyName || 'Property Preview'}">` 
              : `<span>📷 Property Image Placeholder</span>`
            }
          </div>

          <p class="unit-info"><strong>Unit:</strong> ${lease.unitName || 'N/A'}</p>
          <p class="due-info"><strong>Next Amount Due:</strong> ${nextDueFormatted}</p>
          <p class="days-info"><strong>Days Remaining:</strong> ${lease.daysRemaining ?? 0} days</p>

          <div class="card-actions">
            <a href="/lease.html?id=${lease.id}" class="btn btn-primary">View Lease</a>
            <a href="/renter/pay.html?leaseId=${lease.id}" class="btn">Pay Statement</a>
          </div>
        </article>
      `;
    })
  );

  container.innerHTML = cardElementsHtml.join('');
}

function setupLogout() {
  const btnLogout = document.getElementById('btnLogout');
  if (!btnLogout) return;

  btnLogout.addEventListener('click', async () => {
    try {
      if (typeof auth !== 'undefined' && typeof auth.logout === 'function') {
        await auth.logout();
      } else {
        await api.post('/api/auth/logout');
        window.location.href = '/login.html';
      }
    } catch (err) {
      console.error('Logout error:', err);
      window.location.href = '/login.html';
    }
  });
}

function setupSearchFilter() {
  const searchInput = document.getElementById('leaseSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll('#leases .lease-card');

    cards.forEach((card) => {
      const searchData = card.getAttribute('data-search') || card.textContent.toLowerCase();
      if (searchData.includes(query)) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  });
}