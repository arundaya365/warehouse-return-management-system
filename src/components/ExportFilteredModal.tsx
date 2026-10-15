import React, { useState, useMemo } from 'react';
import {
  Download,
  X,
  FileSpreadsheet,
  FileCode,
  Printer,
  Calendar,
  Filter,
  CheckSquare,
  Square,
  Layers,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Package,
  User,
  Hash,
  Sparkles,
  Cloud,
  Check
} from 'lucide-react';
import { ProcessedReturnRow, StandardKondisi } from '../processor';

export interface ExportFilterCriteria {
  startDate?: string;
  endDate?: string;
  orderId?: string;
  operator?: string;
  skuId?: string;
  condition?: string; // 'ALL' or specific
  conditions?: string[]; // multi-condition checklist support
}

interface ExportFilteredModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: ProcessedReturnRow[];
  activePageFilter?: ExportFilterCriteria;
}

const AVAILABLE_CONDITIONS: StandardKondisi[] = [
  'Good',
  'Damage Packaging',
  'Damage Product',
  'Totally Damage',
  'Wrong Item',
  'Missing Item',
  'Missing',
  'Unexpected'
];

interface ColumnOption {
  key: keyof ProcessedReturnRow;
  label: string;
}

const ALL_COLUMNS: ColumnOption[] = [
  { key: 'Waktu_Proses', label: 'Waktu Proses' },
  { key: 'Operator_ID', label: 'Operator ID' },
  { key: 'Order_ID', label: 'Order ID' },
  { key: 'SKU_ID', label: 'SKU ID' },
  { key: 'Nama_Barang', label: 'Nama Barang' },
  { key: 'Kondisi', label: 'Status Kondisi' },
  { key: 'Catatan_Tambahan', label: 'Catatan Tambahan' },
  { key: 'Video_Timestamp', label: 'Timestamp Video' },
  { key: 'Nama_File_Video', label: 'Nama File Video' },
  { key: 'Link_Video', label: 'Link Google Drive' }
];

export const ExportFilteredModal: React.FC<ExportFilteredModalProps> = ({
  isOpen,
  onClose,
  rows,
  activePageFilter
}) => {
  // Criteria State
  const [startDate, setStartDate] = useState<string>(activePageFilter?.startDate || '');
  const [endDate, setEndDate] = useState<string>(activePageFilter?.endDate || '');
  const [orderQuery, setOrderQuery] = useState<string>(activePageFilter?.orderId || '');
  const [operatorQuery, setOperatorQuery] = useState<string>(activePageFilter?.operator || '');
  const [skuQuery, setSkuQuery] = useState<string>(activePageFilter?.skuId || '');
  const [selectedConditions, setSelectedConditions] = useState<Set<string>>(() => {
    if (activePageFilter?.conditions && activePageFilter.conditions.length > 0) {
      return new Set(activePageFilter.conditions);
    }
    if (activePageFilter?.condition && activePageFilter.condition !== 'ALL') {
      return new Set([activePageFilter.condition]);
    }
    return new Set(AVAILABLE_CONDITIONS);
  });
  const [driveFilter, setDriveFilter] = useState<'all' | 'with_drive' | 'without_drive'>('all');

  // Structure & Format Selection
  const [exportStructure, setExportStructure] = useState<'order_summary' | 'sku_detail'>('order_summary');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'html'>('csv');

  // Column Selection
  const [selectedColumns, setSelectedColumns] = useState<Set<keyof ProcessedReturnRow>>(
    new Set(ALL_COLUMNS.map((c) => c.key))
  );

  // Status feedback
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Helper untuk reset filter kriteria di modal
  const handleResetModalFilters = () => {
    setStartDate('');
    setEndDate('');
    setOrderQuery('');
    setOperatorQuery('');
    setSkuQuery('');
    setSelectedConditions(new Set(AVAILABLE_CONDITIONS));
    setDriveFilter('all');
  };

  // Helper untuk menyalin filter aktif halaman
  const handleApplyPageFilter = () => {
    setStartDate(activePageFilter?.startDate || '');
    setEndDate(activePageFilter?.endDate || '');
    setOrderQuery(activePageFilter?.orderId || '');
    setOperatorQuery(activePageFilter?.operator || '');
    setSkuQuery(activePageFilter?.skuId || '');
    if (activePageFilter?.conditions && activePageFilter.conditions.length > 0) {
      setSelectedConditions(new Set(activePageFilter.conditions));
    } else if (activePageFilter?.condition && activePageFilter.condition !== 'ALL') {
      setSelectedConditions(new Set([activePageFilter.condition]));
    } else {
      setSelectedConditions(new Set(AVAILABLE_CONDITIONS));
    }
    setDriveFilter('all');
  };

  // Presets Tanggal Cepat
  const applyDatePreset = (preset: 'today' | 'yesterday' | 'last7' | 'thisMonth') => {
    const now = new Date();
    const formatDate = (d: Date) => {
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const da = String(d.getDate()).padStart(2, '0');
      return `${yr}-${mo}-${da}`;
    };

    if (preset === 'today') {
      const today = formatDate(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const str = formatDate(yest);
      setStartDate(str);
      setEndDate(str);
    } else if (preset === 'last7') {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      setStartDate(formatDate(past));
      setEndDate(formatDate(now));
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatDate(firstDay));
      setEndDate(formatDate(now));
    }
  };

  // Toggle Condition Checkbox
  const toggleCondition = (cond: string) => {
    const next = new Set(selectedConditions);
    if (next.has(cond)) {
      if (next.size > 1) {
        next.delete(cond);
      }
    } else {
      next.add(cond);
    }
    setSelectedConditions(next);
  };

  // Toggle All Conditions
  const toggleAllConditions = () => {
    if (selectedConditions.size === AVAILABLE_CONDITIONS.length) {
      setSelectedConditions(new Set(['Good']));
    } else {
      setSelectedConditions(new Set(AVAILABLE_CONDITIONS));
    }
  };

  // Toggle Column
  const toggleColumn = (key: keyof ProcessedReturnRow) => {
    const next = new Set(selectedColumns);
    if (next.has(key)) {
      if (next.size > 1) next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedColumns(next);
  };

  const toggleAllColumns = () => {
    if (selectedColumns.size === ALL_COLUMNS.length) {
      // Keep primary columns
      setSelectedColumns(new Set(['Waktu_Proses', 'Order_ID', 'SKU_ID', 'Nama_Barang', 'Kondisi']));
    } else {
      setSelectedColumns(new Set(ALL_COLUMNS.map((c) => c.key)));
    }
  };

  // Filter Computation
  const filteredExportRows = useMemo(() => {
    return rows.filter((row) => {
      // 1. Tanggal
      if (startDate || endDate) {
        const rawDate = row.Waktu_Proses || row.Video_Timestamp || '';
        let rowDate = '';
        if (rawDate.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
          rowDate = rawDate.slice(0, 10);
        } else {
          const match = rawDate.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
          if (match) {
            rowDate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
          }
        }

        if (rowDate) {
          if (startDate && rowDate < startDate) return false;
          if (endDate && rowDate > endDate) return false;
        }
      }

      // 2. Order ID
      if (orderQuery.trim()) {
        const q = orderQuery.trim().toLowerCase();
        if (!row.Order_ID.toLowerCase().includes(q)) return false;
      }

      // 3. Operator
      if (operatorQuery.trim()) {
        const q = operatorQuery.trim().toLowerCase();
        if (!row.Operator_ID.toLowerCase().includes(q)) return false;
      }

      // 4. SKU / Nama
      if (skuQuery.trim()) {
        const q = skuQuery.trim().toLowerCase();
        const matchSku = row.SKU_ID.toLowerCase().includes(q);
        const matchName = row.Nama_Barang.toLowerCase().includes(q);
        if (!matchSku && !matchName) return false;
      }

      // 5. Kondisi
      if (!selectedConditions.has(row.Kondisi)) {
        return false;
      }

      // 6. Drive Status
      if (driveFilter === 'with_drive') {
        if (!row.Link_Video || !row.Link_Video.includes('drive.google.com')) return false;
      } else if (driveFilter === 'without_drive') {
        if (row.Link_Video && row.Link_Video.includes('drive.google.com')) return false;
      }

      return true;
    });
  }, [rows, startDate, endDate, orderQuery, operatorQuery, skuQuery, selectedConditions, driveFilter]);

  // Statistik baris yang cocok
  const matchedCount = filteredExportRows.length;
  const goodCount = filteredExportRows.filter((r) => r.Kondisi === 'Good').length;
  const damageProductCount = filteredExportRows.filter((r) => r.Kondisi === 'Damage Product').length;
  const damagePackagingCount = filteredExportRows.filter((r) => r.Kondisi === 'Damage Packaging').length;
  const missingCount = filteredExportRows.filter((r) => r.Kondisi === 'Missing').length;
  const unexpectedCount = filteredExportRows.filter((r) => r.Kondisi === 'Unexpected').length;

  // Nama file dinamis
  const generatedFilenameBase = useMemo(() => {
    let name = 'RMA_OTWOO_LAPORAN';
    if (startDate && endDate) {
      if (startDate === endDate) {
        name += `_${startDate}`;
      } else {
        name += `_${startDate}_sd_${endDate}`;
      }
    } else if (startDate) {
      name += `_DARI_${startDate}`;
    } else if (endDate) {
      name += `_SD_${endDate}`;
    } else {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      name += `_${dateStr}`;
    }

    if (orderQuery.trim()) {
      name += `_${orderQuery.trim().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    }
    if (operatorQuery.trim()) {
      name += `_${operatorQuery.trim().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    }
    if (selectedConditions.size === 1) {
      name += `_${Array.from(selectedConditions)[0].replace(/\s+/g, '_')}`;
    }
    return name;
  }, [startDate, endDate, orderQuery, operatorQuery, selectedConditions]);

  // Eksekusi Ekspor
  const handleExecuteExport = () => {
    if (matchedCount === 0) {
      return;
    }

    // STRUKTUR 1: REKAPITULASI PER ORDER ID (TOTAL QTY & VARIASI SKU DALAM 1 ORDER ID)
    if (exportStructure === 'order_summary') {
      const map = new Map<string, {
        orderId: string;
        operatorId: string;
        waktuProses: string;
        totalQty: number;
        skuMap: Map<string, number>;
        good: number;
        damageProduct: number;
        damagePackaging: number;
        missingUnexpected: number;
        namaFileVideo: string;
        linkVideo: string;
      }>();

      for (const r of filteredExportRows) {
        const oid = r.Order_ID || 'UNKNOWN';
        let entry = map.get(oid);
        if (!entry) {
          entry = {
            orderId: oid,
            operatorId: r.Operator_ID || '-',
            waktuProses: r.Waktu_Proses || r.Video_Timestamp || '-',
            totalQty: 0,
            skuMap: new Map(),
            good: 0,
            damageProduct: 0,
            damagePackaging: 0,
            missingUnexpected: 0,
            namaFileVideo: r.Nama_File_Video || '-',
            linkVideo: r.Link_Video || ''
          };
          map.set(oid, entry);
        }
        entry.totalQty += 1;
        entry.skuMap.set(r.SKU_ID, (entry.skuMap.get(r.SKU_ID) || 0) + 1);
        if (r.Kondisi === 'Good') entry.good += 1;
        else if (r.Kondisi === 'Damage Product') entry.damageProduct += 1;
        else if (r.Kondisi === 'Damage Packaging') entry.damagePackaging += 1;
        else entry.missingUnexpected += 1;
      }

      const summaries = Array.from(map.values());
      const filename = `${generatedFilenameBase}_REKAP_ORDER_${summaries.length}orders`;

      if (exportFormat === 'csv') {
        const headers = [
          'Order ID',
          'Operator ID',
          'Waktu Proses',
          'Total Qty Return',
          'Jumlah Variasi SKU',
          'Rincian Variasi SKU',
          'Kondisi Baik (Good)',
          'Kondisi Cacat Produk',
          'Kondisi Rusak Kemasan',
          'Kondisi Hilang/Salah',
          'Nama File Video',
          'Link Google Drive'
        ];
        const rowsCsv = summaries.map((s) => {
          const skuStr = Array.from(s.skuMap.entries()).map(([sku, q]) => `${sku} (${q}x)`).join('; ');
          return [
            `"${s.orderId.replace(/"/g, '""')}"`,
            `"${s.operatorId.replace(/"/g, '""')}"`,
            `"${s.waktuProses.replace(/"/g, '""')}"`,
            s.totalQty,
            s.skuMap.size,
            `"${skuStr.replace(/"/g, '""')}"`,
            s.good,
            s.damageProduct,
            s.damagePackaging,
            s.missingUnexpected,
            `"${s.namaFileVideo.replace(/"/g, '""')}"`,
            `"${s.linkVideo.replace(/"/g, '""')}"`
          ].join(',');
        });
        const csvString = '\uFEFF' + [headers.map((h) => `"${h}"`).join(','), ...rowsCsv].join('\r\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'json') {
        const dataJson = summaries.map((s) => ({
          Order_ID: s.orderId,
          Operator_ID: s.operatorId,
          Waktu_Proses: s.waktuProses,
          Total_Qty_Return: s.totalQty,
          Jumlah_Variasi_SKU: s.skuMap.size,
          Rincian_Variasi_SKU: Array.from(s.skuMap.entries()).map(([sku, q]) => ({ SKU_ID: sku, Qty: q })),
          Kondisi: {
            Good: s.good,
            Damage_Product: s.damageProduct,
            Damage_Packaging: s.damagePackaging,
            Missing_Unexpected: s.missingUnexpected
          },
          Nama_File_Video: s.namaFileVideo,
          Link_Video: s.linkVideo
        }));
        const blob = new Blob([JSON.stringify(dataJson, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'html') {
        const printDate = new Date().toLocaleString('id-ID');
        const tableHeaders = `
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px;">No</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px;">Order ID & Operator</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px;">Waktu Proses</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px; text-align: center;">Total Qty</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px;">Variasi SKU</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px;">Kondisi</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px;">Video Drive</th>
        `;
        const tableRows = summaries.map((s, idx) => {
          const skuStr = Array.from(s.skuMap.entries()).map(([sku, q]) => `<span style="display:inline-block; padding:2px 6px; background:#f1f5f9; border-radius:4px; margin:2px;"><b>${sku}</b> × ${q}</span>`).join(' ');
          return `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; text-align:center;">${idx + 1}</td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px;"><b>${s.orderId}</b><br><span style="color:#64748b; font-size:10px;">${s.operatorId}</span></td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px;">${s.waktuProses}</td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 12px; font-weight:bold; text-align:center; color:#6d28d9;">${s.totalQty} Unit</td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px;"><b>${s.skuMap.size} Variasi:</b><br>${skuStr}</td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 10px;">Good: ${s.good} | Rusak: ${s.damageProduct + s.damagePackaging + s.missingUnexpected}</td>
              <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 10px;">${s.namaFileVideo}</td>
            </tr>
          `;
        }).join('');

        const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Rekapitulasi Return per Order ID - ${filename}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #1e293b; }
    .header { border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18px; font-weight: 800; color: #4c1d95; }
    .sub { font-size: 12px; color: #64748b; margin-top: 3px; }
    .stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; border: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    @media print { body { margin: 10px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">RMA Warehouse Otwoo Cosmetics Indonesia</div>
      <div class="sub">Laporan Rekapitulasi Return per Order ID (Total Qty & Variasi SKU)</div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #64748b;">
      Dicetak: ${printDate}<br>
      Total: <strong>${summaries.length} Order ID</strong> (${matchedCount} Unit Barang)
    </div>
  </div>
  <div class="stats">
    <div class="badge" style="background: #f1f5f9;">Total Order: ${summaries.length}</div>
    <div class="badge" style="background: #ede9fe; color: #5b21b6;">Total Qty Barang: ${matchedCount} Unit</div>
    <div class="badge" style="background: #ecfdf5; color: #065f46;">Kondisi Baik: ${goodCount}</div>
    <div class="badge" style="background: #fef2f2; color: #991b1b;">Rusak/Masalah: ${damageProductCount + damagePackagingCount + missingCount + unexpectedCount}</div>
  </div>
  <table>
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #7c3aed; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
      🖨️ Cetak / Simpan sebagai PDF
    </button>
  </div>
</body>
</html>`;
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
        onClose();
      }, 1800);
      return;
    }

    // STRUKTUR 2: DETAIL PER BARIS SKU
    const colsToExport = ALL_COLUMNS.filter((c) => selectedColumns.has(c.key));

    if (exportFormat === 'csv') {
      // Buat file CSV dengan UTF-8 BOM (\uFEFF) untuk kompatibilitas Excel penuh
      const headers = colsToExport.map((c) => `"${c.label}"`).join(',');
      const rowsCsv = filteredExportRows.map((row) =>
        colsToExport
          .map((c) => {
            const val = String(row[c.key] || '').replace(/"/g, '""');
            return `"${val}"`;
          })
          .join(',')
      );
      const csvString = '\uFEFF' + [headers, ...rowsCsv].join('\r\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedFilenameBase}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (exportFormat === 'json') {
      const dataToExport = filteredExportRows.map((row) => {
        const item: Record<string, unknown> = {};
        colsToExport.forEach((col) => {
          item[col.key] = row[col.key];
        });
        return item;
      });
      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedFilenameBase}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (exportFormat === 'html') {
      // HTML Print / Rekap Format
      const printDate = new Date().toLocaleString('id-ID');
      const tableHeaders = colsToExport.map((c) => `<th style="padding: 8px 10px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 11px; text-align: left;">${c.label}</th>`).join('');
      const tableRows = filteredExportRows
        .map(
          (row, idx) => `
          <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            ${colsToExport
              .map(
                (c) => `<td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px;">${String(
                  row[c.key] || '-'
                )}</td>`
              )
              .join('')}
          </tr>
        `
        )
        .join('');

      const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Laporan Unboxing RMA - ${generatedFilenameBase}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #1e293b; }
    .header { border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18px; font-weight: 800; color: #4c1d95; }
    .sub { font-size: 12px; color: #64748b; margin-top: 3px; }
    .stats { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; border: 1px solid #e2e8f0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    @media print {
      body { margin: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">RMA Warehouse Otwoo Cosmetics Indonesia</div>
      <div class="sub">Laporan Rekapitulasi Unboxing Retur & Bukti Video</div>
    </div>
    <div style="text-align: right; font-size: 11px; color: #64748b;">
      Dicetak: ${printDate}<br>
      Total: <strong>${matchedCount} baris</strong>
    </div>
  </div>

  <div class="stats">
    <div class="badge" style="background: #f1f5f9;">Total: ${matchedCount}</div>
    <div class="badge" style="background: #ecfdf5; color: #065f46; border-color: #a7f3d0;">Good: ${goodCount}</div>
    <div class="badge" style="background: #fef2f2; color: #991b1b; border-color: #fecaca;">Damage Produk: ${damageProductCount}</div>
    <div class="badge" style="background: #fffbeb; color: #92400e; border-color: #fde68a;">Damage Kemasan: ${damagePackagingCount}</div>
    <div class="badge" style="background: #fdf4ff; color: #86198f; border-color: #f5d0fe;">Missing: ${missingCount}</div>
  </div>

  <table>
    <thead>
      <tr>${tableHeaders}</tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #7c3aed; color: #fff; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">
      🖨️ Cetak / Simpan sebagai PDF
    </button>
  </div>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedFilenameBase}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Header Modal */}
        <div className="bg-[#0F766E] p-5 text-white flex items-center justify-between border-b border-teal-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                Download File Laporan dengan Filter Kriteria
              </h3>
              <p className="text-xs text-teal-100">
                Pilih parameter tanggal, order, operator, SKU, dan kondisi sebelum mengunduh file
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
            title="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action quick bar */}
        <div className="bg-[#F0FDFA] px-5 py-2.5 border-b border-teal-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-xs text-[#0F766E]">
            <Sparkles className="w-4 h-4 text-[#0F766E]" />
            <span>
              Total Database: <strong>{rows.length}</strong> baris | Cocok saat ini:{' '}
              <strong className="text-[#0F766E] font-bold">{matchedCount}</strong> baris
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {activePageFilter && (
              <button
                type="button"
                onClick={handleApplyPageFilter}
                className="text-[11px] font-semibold text-[#0F766E] hover:text-[#115E59] bg-white hover:bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-2xs"
                title="Terapkan filter yang sedang aktif di halaman saat ini"
              >
                Gunakan Filter Halaman
              </button>
            )}
            <button
              type="button"
              onClick={handleResetModalFilters}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-2xs"
            >
              Reset Filter Modal
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {/* SECTION 1: KRITERIA FILTER UTAMA */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>1. Kriteria Filter Data Unduhan</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* KRITERIA A: RENTANG TANGGAL */}
              <div className="md:col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#0F766E]" />
                    <span>Rentang Tanggal Proses (Dari ... Sampai ...)</span>
                  </label>
                  {(startDate || endDate) && (
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                    >
                      Hapus Tanggal
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-[#0F766E] focus-within:ring-2 focus-within:ring-teal-100">
                    <span className="text-[11px] text-slate-400 font-semibold mr-2 shrink-0">Dari:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-xs text-slate-800 outline-none bg-transparent"
                    />
                  </div>
                  <div className="flex items-center bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus-within:border-[#0F766E] focus-within:ring-2 focus-within:ring-teal-100">
                    <span className="text-[11px] text-slate-400 font-semibold mr-2 shrink-0">Sampai:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-xs text-slate-800 outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Preset Cepat */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-500 font-medium mr-1">Preset:</span>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('today')}
                    className="px-2 py-0.5 text-[10px] font-semibold bg-white hover:bg-teal-50 text-slate-700 hover:text-[#0F766E] border border-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('yesterday')}
                    className="px-2 py-0.5 text-[10px] font-semibold bg-white hover:bg-teal-50 text-slate-700 hover:text-[#0F766E] border border-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Kemarin
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('last7')}
                    className="px-2 py-0.5 text-[10px] font-semibold bg-white hover:bg-teal-50 text-slate-700 hover:text-[#0F766E] border border-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    7 Hari Terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset('thisMonth')}
                    className="px-2 py-0.5 text-[10px] font-semibold bg-white hover:bg-teal-50 text-slate-700 hover:text-[#0F766E] border border-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Bulan Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="px-2 py-0.5 text-[10px] font-semibold bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* KRITERIA B: ORDER ID */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>Order ID</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    placeholder="Contoh: ORD-1002 (Kosongkan utk semua)"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 outline-none text-slate-800"
                  />
                  {orderQuery && (
                    <button
                      type="button"
                      onClick={() => setOrderQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* KRITERIA C: OPERATOR ID */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>Operator ID</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={operatorQuery}
                    onChange={(e) => setOperatorQuery(e.target.value)}
                    placeholder="Contoh: OPR-992 (Kosongkan utk semua)"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 outline-none text-slate-800"
                  />
                  {operatorQuery && (
                    <button
                      type="button"
                      onClick={() => setOperatorQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* KRITERIA D: SKU ID / NAMA BARANG */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <Package className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>SKU ID / Nama Barang</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={skuQuery}
                    onChange={(e) => setSkuQuery(e.target.value)}
                    placeholder="Contoh: sc064 / Lipstick (Kosongkan utk semua)"
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 outline-none text-slate-800"
                  />
                  {skuQuery && (
                    <button
                      type="button"
                      onClick={() => setSkuQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* KRITERIA E: STATUS LINK GOOGLE DRIVE */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                  <Cloud className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>Status Video Google Drive</span>
                </label>
                <select
                  value={driveFilter}
                  onChange={(e) => setDriveFilter(e.target.value as 'all' | 'with_drive' | 'without_drive')}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:border-[#0F766E] focus:ring-2 focus:ring-teal-100 outline-none text-slate-800"
                >
                  <option value="all">Semua Data (Dengan / Tanpa Link Drive)</option>
                  <option value="with_drive">Hanya Data dengan Video Drive Terunggah</option>
                  <option value="without_drive">Hanya Data Belum Memiliki Link Video Drive</option>
                </select>
              </div>

              {/* KRITERIA F: MULTI-SELECT STATUS KONDISI */}
              <div className="md:col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Status Kondisi Barang (Pilih Satu atau Beberapa)</span>
                  </label>
                  <button
                    type="button"
                    onClick={toggleAllConditions}
                    className="text-[11px] text-[#0F766E] hover:underline font-semibold cursor-pointer"
                  >
                    {selectedConditions.size === AVAILABLE_CONDITIONS.length
                      ? 'Pilih Good Saja'
                      : 'Pilih Semua Kondisi'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {AVAILABLE_CONDITIONS.map((cond) => {
                    const isSelected = selectedConditions.has(cond);
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => toggleCondition(cond)}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-left ${
                          isSelected
                            ? cond === 'Good'
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-300'
                              : cond === 'Damage Product'
                              ? 'bg-rose-50 text-rose-900 border-rose-300 ring-1 ring-rose-300'
                              : cond === 'Damage Packaging'
                              ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-300'
                              : cond === 'Missing'
                              ? 'bg-red-50 text-red-950 border-red-300 ring-1 ring-red-300'
                              : 'bg-slate-100 text-slate-800 border-slate-300 ring-1 ring-slate-300'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 shrink-0 text-current" />
                        ) : (
                          <Square className="w-4 h-4 shrink-0 text-slate-400" />
                        )}
                        <span className="truncate">{cond}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: PILIHAN FORMAT DOWNLOAD */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Download className="w-3.5 h-3.5 text-[#0F766E]" />
              <span>2. Format File Hasil Download</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: CSV Excel */}
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  exportFormat === 'csv'
                    ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-400/40 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">Microsoft Excel (.CSV)</div>
                    <div className="text-[10px] text-slate-500">UTF-8 BOM, Kompatibel Excel & Sheets</div>
                  </div>
                </div>
              </button>

              {/* Option 2: JSON Array */}
              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  exportFormat === 'json'
                    ? 'bg-teal-50/80 border-teal-300 ring-2 ring-teal-400/40 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-[#0F766E] flex items-center justify-center shrink-0">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">JSON Array (.json)</div>
                    <div className="text-[10px] text-slate-500">Struktur API & Backup Sistem</div>
                  </div>
                </div>
              </button>

              {/* Option 3: Rekap Cetak HTML / PDF */}
              <button
                type="button"
                onClick={() => setExportFormat('html')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  exportFormat === 'html'
                    ? 'bg-slate-100/90 border-slate-400 ring-2 ring-slate-300 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Laporan Cetak (.html / PDF)</div>
                    <div className="text-[10px] text-slate-500">Kop RMA Otwoo siap cetak</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 3: PILIHAN KOLOM DATA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-[#0F766E]" />
                <span>3. Pilih Kolom yang Disertakan ({selectedColumns.size}/{ALL_COLUMNS.length})</span>
              </div>
              <button
                type="button"
                onClick={toggleAllColumns}
                className="text-[11px] text-[#0F766E] hover:underline font-semibold cursor-pointer"
              >
                {selectedColumns.size === ALL_COLUMNS.length ? 'Kolom Ringkas' : 'Pilih Semua Kolom'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              {ALL_COLUMNS.map((col) => {
                const isChecked = selectedColumns.has(col.key);
                return (
                  <label
                    key={col.key}
                    className="flex items-center space-x-2 text-xs text-slate-700 font-medium cursor-pointer p-1 rounded-lg hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded text-[#0F766E] focus:ring-[#0F766E] w-3.5 h-3.5"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: RINGKASAN PRATINJAU SEBELUM DOWNLOAD */}
          <div className="p-4 rounded-2xl bg-[#F0FDFA] border border-teal-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded-lg bg-[#0F766E] text-white flex items-center justify-center font-bold text-xs">
                  ✓
                </div>
                <div className="text-xs font-semibold text-slate-900">
                  Pratinjau Hasil Filter Unduhan
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#0F766E] text-white shadow-2xs">
                {matchedCount} Baris Siap Diunduh
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-1">
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500">Good</div>
                <div className="text-sm font-extrabold text-emerald-700 font-mono">{goodCount}</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500">Dmg Produk</div>
                <div className="text-sm font-extrabold text-rose-700 font-mono">{damageProductCount}</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500">Dmg Kemasan</div>
                <div className="text-sm font-extrabold text-amber-700 font-mono">{damagePackagingCount}</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500">Missing</div>
                <div className="text-sm font-extrabold text-red-700 font-mono">{missingCount}</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500">Unexpected</div>
                <div className="text-sm font-extrabold text-slate-700 font-mono">{unexpectedCount}</div>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 font-mono bg-white/80 p-2 rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="text-slate-400">Nama File:</span>
              <span className="font-bold text-[#0F766E] truncate ml-2">
                {generatedFilenameBase}.{exportFormat === 'html' ? 'html' : exportFormat}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-4 sm:p-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer"
          >
            Batal
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={matchedCount === 0}
              onClick={handleExecuteExport}
              className={`px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center space-x-2 cursor-pointer ${
                matchedCount === 0
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : downloadSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0F766E] hover:bg-[#115E59] text-white active:scale-95'
              }`}
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Berhasil Diunduh!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>
                    Unduh Sekarang ({matchedCount} Baris - {exportFormat.toUpperCase()})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
