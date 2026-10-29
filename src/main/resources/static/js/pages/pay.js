/*
 * pay.js — script for renter/pay.html?leaseId=&month=   (month like "2026-11": the first month of a billing period)
 *
 * 1. GET /api/leases/{leaseId} (property and unit for the summary) and GET /api/leases/{leaseId}/statement:
 *    the amount comes from the line for that period. Without ?month= the oldest unpaid period is used
 *    (the server only accepts that one anyway).
 * 2. Pay: POST /api/leases/{leaseId}/payments { billingMonth, method, accountNumber }
 *    payment.status 'PAID' → show payment.referenceNo (+ "Pay next" when another month is unpaid);
 *    'FAILED' → "Payment declined" (account numbers ending in 0000).
 */
const $ = (id) => document.getElementById(id);

const METHOD = {                            // method → label of the account field, placeholder, name on the receipt
  GCASH: ['GCash mobile number', 'e.g. 09171234567', 'GCash'],
  MAYA: ['Maya mobile number', 'e.g. 09181234567', 'Maya'],
  CARD: ['Card number', 'e.g. 4111 1111 1111 1111', 'Card']
};
const DUE_STYLE = { DUE: 'bg-amber-100 text-amber-800', OVERDUE: 'bg-rose-100 text-rose-800', UPCOMING: 'bg-slate-100 text-slate-600' };

function showError(text) {
  $('error').textContent = text;
  $('error').classList.toggle('hidden', !text);
}

const method = () => $('payForm').querySelector('input[name="method"]:checked').value;

document.addEventListener('DOMContentLoaded', async () => {
  await auth.requireLogin('RENTER');
  const query = new URLSearchParams(location.search);
  const leaseId = query.get('leaseId');
  if (!leaseId) {
    showError('Open this page from one of your leases.');
    $('payBtn').disabled = true;
    return;
  }
  $('backLink').href = `/lease.html?id=${leaseId}`;
  $('backText').textContent = 'Back to the lease';
  $('resultLeaseLink').href = `/lease.html?id=${leaseId}`;

  $('methods').addEventListener('change', () => {
    const [label, placeholder] = METHOD[method()];
    $('accountLabel').textContent = label;
    $('accountNumber').placeholder = placeholder;
  });

  let lease;
  let statement;
  try {
    [lease, statement] = await Promise.all([api.get(`/api/leases/${leaseId}`), api.get(`/api/leases/${leaseId}/statement`)]);
  } catch (err) {
    showError(err.message);
    $('payBtn').disabled = true;
    return;
  }
  const unpaid = statement.filter((s) => s.status !== 'PAID');
  const line = statement.find((s) => s.billingMonth === query.get('month')) || unpaid[0];
  $('summary').classList.remove('hidden');
  $('sumLease').textContent = `${lease.propertyName} · ${lease.unitName}`;
  if (!line || line.status === 'PAID') {
    $('amountInfo').textContent = 'Everything on this lease is paid. Thank you!';
    $('sumPeriod').textContent = '';
    $('sumStatus').className = 'hidden';
    $('payBtn').disabled = true;
    return;
  }
  $('billingMonth').value = line.billingMonth;
  $('sumPeriod').textContent = `Billing period ${line.billingMonth}` + (line.months > 1 ? ` (${line.months} months)` : '');
  $('sumStatus').textContent = format.label(line.status);
  $('sumStatus').className = `flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${DUE_STYLE[line.status] || DUE_STYLE.UPCOMING}`;
  $('amountInfo').textContent = format.peso(line.amountDue);
  $('sumDue').textContent = `Due ${format.date(line.dueDate)}`;

  $('payForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');
    const account = $('accountNumber').value.trim();
    if (!account) {
      showError('Enter the account or card number.');
      return;
    }
    $('payBtn').disabled = true;
    try {
      const payment = await api.form('POST', `/api/leases/${leaseId}/payments`, {
        billingMonth: line.billingMonth,
        method: method(),
        accountNumber: account
      });
      if (payment.status === 'PAID') {
        $('refNo').textContent = payment.referenceNo;
        $('refMethod').textContent = METHOD[payment.method] ? METHOD[payment.method][2] : format.label(payment.method);
        const next = unpaid.find((s) => s.billingMonth !== line.billingMonth);
        if (next) {
          $('payNextLink').href = `/renter/pay.html?leaseId=${leaseId}&month=${next.billingMonth}`;
          $('payNextLink').textContent = `Pay next: ${next.billingMonth}`;
          $('payNextLink').classList.remove('hidden');
        }
        $('payForm').classList.add('hidden');
        $('result').classList.remove('hidden');
        return;                                   // this period is paid: the form stays closed
      }
      showError('Payment declined. Check the account number and try again.');
    } catch (err) {
      showError(err.message);                     // e.g. "Please pay 2026-10 first."
    }
    $('payBtn').disabled = false;
  });
});
