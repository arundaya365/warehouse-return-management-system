import QRCode from 'qrcode';

export interface DeskQrCardOptions {
  qrCodeValue?: string;
  stationTitle?: string;
  deskLabel?: string;
}

/**
 * Menghasilkan raw DataURL gambar QR code beresolusi tinggi (PNG)
 */
export async function generateRawQrCodeDataUrl(
  text: string = 'SELESAI',
  size: number = 600
): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });
}

/**
 * Menghasilkan kartu/stiker siap print beresolusi tinggi (Canvas)
 * Dilengkapi border potong, instruksi meja, dan QR Code besar
 */
export async function generateDeskQrCardCanvas(
  options: DeskQrCardOptions = {}
): Promise<HTMLCanvasElement> {
  const qrValue = options.qrCodeValue || 'SELESAI';
  const qrDataUrl = await generateRawQrCodeDataUrl(qrValue, 600);

  const canvas = document.createElement('canvas');
  const width = 900;
  const height = 1200;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas context');

  // Background putih bersih
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Border garis potong (cut line) putus-putus
  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(30, 30, width - 60, height - 60);
  ctx.restore();

  // Teks instruksi gunting di atas
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 18px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✂️ GUNTING MENGIKUTI GARIS PUTUS-PUTUS & TEMPEL DI MEJA KERJA UNBOXING', width / 2, 65);

  // Header Box Card
  ctx.fillStyle = '#0F766E';
  ctx.beginPath();
  ctx.roundRect(60, 95, width - 120, 150, 24);
  ctx.fill();

  // Header Title
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 30px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('UNBOXIN — PT. TIRTA KUMALA SARI', width / 2, 145);

  ctx.font = 'bold 20px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#ccfbf1';
  ctx.fillText('STASIUN UNBOXING & AUTO-UPLOAD GOOGLE DRIVE', width / 2, 185);

  ctx.font = '15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#f0fdfa';
  ctx.fillText('Scan QR Code ini untuk otomatis simpan data dan upload video unboxing', width / 2, 218);

  // Gambar QR Code dari DataURL
  const qrImg = new Image();
  qrImg.src = qrDataUrl;
  await new Promise((resolve, reject) => {
    qrImg.onload = resolve;
    qrImg.onerror = reject;
  });

  // Background kotak untuk QR Code
  const qrBoxSize = 540;
  const qrX = (width - qrBoxSize) / 2;
  const qrY = 275;

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qrBoxSize, qrBoxSize, 28);
  ctx.fill();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Draw QR Image
  const qrPadding = 30;
  ctx.drawImage(qrImg, qrX + qrPadding, qrY + qrPadding, qrBoxSize - qrPadding * 2, qrBoxSize - qrPadding * 2);

  // Label besar di bawah QR
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 38px monospace';
  ctx.fillText(`KODE: ${qrValue}`, width / 2, 865);

  // Box Panduan Pemakaian
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.roundRect(60, 900, width - 120, 220, 20);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 20px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('📌 PETUNJUK OPERATOR GUDANG (PT. TIRTA KUMALA SARI):', 90, 940);

  ctx.font = '16px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('1. Tempelkan kartu ini pada permukaan meja kerja unboxing (mudah dijangkau barcode scanner).', 90, 975);
  ctx.fillText('2. Setelah seluruh produk selesai di-scan, tembak QR Code di atas dengan scanner gun.', 90, 1010);
  ctx.fillText('3. Sistem otomatis menghentikan perekaman, memproses status, dan upload ke Google Drive.', 90, 1045);

  ctx.font = 'bold 13px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#0F766E';
  ctx.fillText('Unboxin WMS © Copyright Yaya Sanjaya • PT. Tirta Kumala Sari', 90, 1085);

  return canvas;
}

/**
 * Download kartu QR Meja sebagai file PNG beresolusi tinggi
 */
export async function downloadDeskQrCard(filename: string = 'QR_SELESAI_TEMPEL_MEJA.png'): Promise<void> {
  const canvas = await generateDeskQrCardCanvas();
  const dataUrl = canvas.toDataURL('image/png');

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Cetak / Print kartu stiker meja langsung ke printer
 */
export async function printDeskQrCard(): Promise<void> {
  const canvas = await generateDeskQrCardCanvas();
  const dataUrl = canvas.toDataURL('image/png');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback download if popup blocked
    await downloadDeskQrCard();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Cetak QR Code Selesai - Tempel di Meja Unboxing</title>
        <style>
          @page {
            size: auto;
            margin: 10mm;
          }
          body {
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff;
            font-family: system-ui, sans-serif;
          }
          img {
            max-width: 95%;
            max-height: 95vh;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" alt="QR Selesai Meja Unboxing" />
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
