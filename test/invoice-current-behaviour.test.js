'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice uses the same configured HSN slab and totals as order pricing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.deepEqual(
    { tax: billed.tax, total: billed.total },
    { tax: 5, total: 105 }
  );
  assert.deepEqual(
    { tax: printed.tax, total: printed.total, gstPercent: printed.rows[0].gstPercent },
    { tax: 5, total: 105, gstPercent: 5 }
  );
});

test('invoice uses the same capped coupon and post-discount taxable amount as order pricing', function () {
  const items = [{ id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 1000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'WELCOME');
  const printed = invoice.computeInvoiceFigures({ items: items, coupon: 'WELCOME' });

  assert.deepEqual(
    { discount: billed.discount, tax: billed.tax, total: billed.total },
    { discount: 50, tax: 47.5, total: 997.5 }
  );
  assert.deepEqual(
    { discount: printed.discount, tax: printed.tax, total: printed.total },
    { discount: 50, tax: 47.5, total: 997.5 }
  );
});

test('invoice GST reconciliation agrees with the stored billed order', function () {
  const order = {
    id: 42,
    date: '2026-11-22',
    customer: 'Test customer',
    coupon: '',
    status: 'completed',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 0,
    tax: 5,
    total: 105
  };
  const result = reports.getGstReconciliation({ orders: [order], products: [], customers: [] });

  assert.deepEqual(
    {
      totalChecked: result.totalChecked,
      mismatchCount: result.mismatchCount,
      totalDelta: result.totalDelta,
      rowDelta: result.rows[0].delta,
      matched: result.rows[0].matched
    },
    { totalChecked: 1, mismatchCount: 0, totalDelta: 0, rowDelta: 0, matched: true }
  );
});

test('invoice render omits reconciliation notice when its computed total matches the order', function () {
  const html = invoice.render({
    id: 42,
    date: '2026-11-22',
    customer: 'Test customer',
    paymentMode: 'cash',
    status: 'completed',
    coupon: '',
    total: 105,
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
