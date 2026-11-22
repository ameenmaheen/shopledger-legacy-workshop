'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../config');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

test('CURRENT BEHAVIOUR: order pricing applies HSN GST to discounted taxable value', function () {
  const items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 }];

  assert.deepEqual(pricing.computeTotals(items, '').tax, 10);
  assert.deepEqual(pricing.computeTotals(items, '').total, 210);
});

test('invoice resolves item GST using HSN when gstRate is absent', function () {
  const order = { items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 2 }] };
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(config.tax.defaultRate, 0.18);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 10);
  assert.equal(figures.total, 210);
});

test('invoice uses the capped coupon and applies tax after discount', function () {
  const items = [{ id: 2, name: 'Rice', hsn: '1006', price: 500, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiced = invoice.computeInvoiceFigures({ items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 50);
  assert.equal(billed.tax, 22.5);
  assert.equal(billed.total, 472.5);
  assert.equal(invoiced.discount, 50);
  assert.equal(invoiced.tax, 22.5);
  assert.equal(invoiced.total, 472.5);
});

test('invoice percent coupon honors maxDiscount and minimum subtotal', function () {
  const high = invoice.computeInvoiceFigures({
    items: [{ name: 'Tea', price: 2000, qty: 1 }], coupon: 'SAVE10'
  });
  const low = invoice.computeInvoiceFigures({
    items: [{ name: 'Tea', price: 100, qty: 1 }], coupon: 'SAVE10'
  });

  assert.equal(config.coupons.SAVE10.maxDiscount, 150);
  assert.equal(config.coupons.SAVE10.minOrder, 500);
  assert.equal(high.discount, 150);
  assert.equal(low.discount, 0);
});

test('invoice flat coupon is capped at the subtotal', function () {
  const figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Rice', price: 100, qty: 1 }], coupon: 'FLAT50'
  });

  assert.equal(figures.discount, 0);
  assert.equal(figures.total, 118);
});

test('invoice reports order pricing tax after applying coupon', function () {
  const figures = invoice.computeInvoiceFigures({
    items: [
      { name: 'Rice', hsn: '1006', price: 100, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 100, qty: 1 }
    ],
    coupon: 'WELCOME'
  });

  assert.equal(figures.discount, 10);
  assert.equal(figures.rows[0].line, 100);
  assert.equal(figures.rows[1].line, 100);
  assert.equal(figures.tax, 21.85);
});

test('invoice render warns when computed total differs from stored order total', function () {
  const html = invoice.render({
    id: 7,
    date: '2026-11-22',
    status: 'completed',
    customer: 'Sample',
    paymentMode: 'cash',
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    total: 100
  });

  assert.match(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice computed total/);
});
