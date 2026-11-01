export type ClaimHistoryResult = 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'CLOSED';

export type ClaimHistoryRow = {
  id: string;
  orderId: string;
  awb: string;
  lane: 'CS' | 'RMA';
  channel: string;
  skus: string;
  requested: number;
  approved: number;
  received: number;
  result: ClaimHistoryResult;
  closedAt: string;
  owner: string;
};

const LANE_LABEL: Record<ClaimHistoryRow['lane'], string> = {
  CS: 'Marketplace — CS',
  RMA: 'Logistik — RMA'
};

const RESULT_LABEL: Record<ClaimHistoryResult, string> = {
  APPROVED: 'Disetujui penuh',
  PARTIAL: 'Disetujui sebagian',
  REJECTED: 'Banding tidak berhasil',
  CLOSED: 'Kasus ditutup'
};

export const claimHistoryResultLabel = (result: ClaimHistoryResult): string => RESULT_LABEL[result];
export const claimHistoryLaneLabel = (lane: ClaimHistoryRow['lane']): string => LANE_LABEL[lane];

function cell(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^\s*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

export function claimHistoryCsv(rows: ClaimHistoryRow[]): string {
  const header = [
    'Nomor pesanan',
    'Resi',
    'Jalur',
    'Kanal',
    'SKU',
    'Nilai diajukan (Rp)',
    'Disetujui (Rp)',
    'Dana diterima (Rp)',
    'Sisa (Rp)',
    'Hasil',
    'Selesai',
    'Petugas'
  ];
  const body = rows.map(row => [
    row.orderId,
    row.awb,
    LANE_LABEL[row.lane],
    row.channel,
    row.skus,
    row.requested,
    row.approved,
    row.received,
    Math.max(0, row.requested - row.received),
    RESULT_LABEL[row.result],
    row.closedAt,
    row.owner
  ]);
  return '\uFEFF' + [header, ...body].map(line => line.map(cell).join(',')).join('\r\n');
}
