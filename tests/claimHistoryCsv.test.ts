import assert from 'node:assert/strict';
import test from 'node:test';
import {claimHistoryCsv, type ClaimHistoryRow} from '../src/utils/claimHistoryCsv.ts';

const base: ClaimHistoryRow = {
  id: 'rma-1',
  orderId: 'ORD-1',
  awb: 'SPX123',
  lane: 'RMA',
  channel: 'J&T Express',
  skus: 'SKU-A, SKU-B',
  requested: 20000,
  approved: 10000,
  received: 5000,
  result: 'PARTIAL',
  closedAt: '2026-10-31T10:00:00.000Z',
  owner: 'Tim RMA'
};

test('claim history CSV exports the visible financial separation and remaining balance', () => {
  const csv = claimHistoryCsv([base]);
  assert.ok(csv.startsWith('\uFEFF"Nomor pesanan","Resi"'));
  assert.ok(csv.includes('\r\n'));
  assert.ok(csv.includes('"Marketplace — CS"') === false);
  assert.ok(csv.includes('"Logistik — RMA"'));
  assert.ok(csv.includes('"Disetujui sebagian"'));
  assert.ok(csv.includes('"20000"'));
  assert.ok(csv.includes('"10000"'));
  assert.ok(csv.includes('"5000"'));
  assert.ok(csv.includes('"15000"'));
});

test('claim history CSV protects spreadsheet formulas and escapes text safely', () => {
  const csv = claimHistoryCsv([{
    ...base,
    orderId: '=HYPERLINK("https://example.test")',
    awb: '-1+2',
    skus: '+SUM(A1:A2)',
    owner: '@operator',
    channel: 'Toko "Utama", cabang\nbaru'
  }]);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("'-1+2"));
  assert.ok(csv.includes("'+SUM(A1:A2)"));
  assert.ok(csv.includes("'@operator"));
  assert.ok(csv.includes('"Toko ""Utama"", cabang\nbaru"'));
});

test('claim history CSV keeps an empty history exportable without data rows', () => {
  const csv = claimHistoryCsv([]);
  assert.equal(csv.split('\r\n').length, 1);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"Dana diterima (Rp)"'));
});

test('claim history CSV never reports a negative remaining balance', () => {
  const csv = claimHistoryCsv([{...base, requested: 5000, received: 8000}]);
  assert.ok(csv.includes('"0"'));
});
