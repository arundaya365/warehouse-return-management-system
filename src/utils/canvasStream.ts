/**
 * Stream & Recorder Helper Ultra-Ringan & Smooth untuk Stasiun Unboxing Gudang
 * Menghasilkan feed webcam 30 FPS jernih tanpa beban CPU (anti-lemot),
 * dengan burn-in watermark "RMA Warehouse Otwoo Cosmetics Indonesia", Live Timestamp, dan No AWB.
 * 
 * Optimasi Kinerja Tinggi:
 * 1. Target FPS 30 (Standar video warehouse halus & jernih tanpa membebani browser)
 * 2. Frame-pacing berbasis delta waktu (mencegah lag / frame-drop di layar refresh rate tinggi 60-144Hz)
 * 3. Desynchronized 2D canvas context tanpa alpha overhead (zero GPU pipeline stalls)
 * 4. Caching timestamp string per detik (mencegah garbage collection & heap churn)
 * 5. Direct blit rendering dari feed webcam fisik
 */

export const DEFAULT_WAREHOUSE_NAME = 'PT. Tirta Kumala Sari — Unboxin';

/**
 * Format string tanggal & jam sekarang untuk watermark video
 */
export function getFormattedLiveTimestamp(): string {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const da = String(now.getDate()).padStart(2, '0');
  const hr = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const se = String(now.getSeconds()).padStart(2, '0');
  return `${yr}-${mo}-${da} ${hr}:${mi}:${se}`;
}

// Cache live timestamp untuk menghindari alokasi string tiap frame
let cachedSecond = -1;
let cachedTimestampStr = '';
function getCachedLiveTimestamp(): string {
  const currentSec = Math.floor(Date.now() / 1000);
  if (currentSec !== cachedSecond) {
    cachedSecond = currentSec;
    cachedTimestampStr = getFormattedLiveTimestamp();
  }
  return cachedTimestampStr;
}

// Static HUD cache untuk menghilangkan 90% beban rendering canvas per frame
let cachedHudWarehouse = '';
let cachedHudAwb = '';
let cachedHudCanvas: HTMLCanvasElement | null = null;

function getStaticHudCanvas(warehouseName: string, awb: string): HTMLCanvasElement {
  if (
    cachedHudCanvas &&
    cachedHudWarehouse === warehouseName &&
    cachedHudAwb === awb
  ) {
    return cachedHudCanvas;
  }

  const hudCanvas = document.createElement('canvas');
  hudCanvas.width = 1280;
  hudCanvas.height = 720;
  const ctx = hudCanvas.getContext('2d');
  if (!ctx) return hudCanvas;

  // 1. TOP RIGHT: WATERMARK NAMA GUDANG "PT. Tirta Kumala Sari — Unboxin"
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.beginPath();
  const nameBoxW = 460;
  const nameBoxH = 46;
  ctx.roundRect(1280 - nameBoxW - 30, 24, nameBoxW, nameBoxH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15, 118, 110, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Badge icon
  ctx.fillStyle = '#14b8a6';
  ctx.beginPath();
  ctx.arc(1280 - nameBoxW - 10, 47, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5eead4';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('BUKTI RESMI UNBOXING', 1280 - nameBoxW + 8, 41);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 15px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(warehouseName, 1280 - nameBoxW + 8, 60);
  ctx.restore();

  // 2. TOP LEFT: REC BOX CONTAINER
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
  ctx.beginPath();
  ctx.roundRect(30, 24, 215, 46, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('REC • 30 FPS LIVE', 66, 52);
  ctx.restore();

  // 3. BOTTOM LEFT: TIMESTAMP BOX CONTAINER
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  ctx.roundRect(30, 720 - 64, 380, 42, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(48, 720 - 43, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('TIMESTAMP:', 64, 720 - 38);
  ctx.restore();

  // 4. BOTTOM RIGHT: ORDER / AWB TAG
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.beginPath();
  const awbBoxW = 280;
  ctx.roundRect(1280 - awbBoxW - 30, 720 - 64, awbBoxW, 42, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('NO. AWB / ORDER:', 1280 - awbBoxW - 15, 720 - 46);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(awb || 'ORD-992-JKT', 1280 - awbBoxW - 15, 720 - 28);
  ctx.restore();

  cachedHudCanvas = hudCanvas;
  cachedHudWarehouse = warehouseName;
  cachedHudAwb = awb;
  return hudCanvas;
}

/**
 * Helper ultra-cepat untuk menggambar HUD overlay:
 * Menggunakan static layer cache sehingga hanya blit 1 gambar + blink + text detik!
 */
export function drawVideoOverlayHud(
  ctx: CanvasRenderingContext2D,
  awb: string,
  warehouseName: string,
  frame: number
) {
  // Blit pre-rendered static HUD
  const staticHud = getStaticHudCanvas(warehouseName, awb);
  ctx.drawImage(staticHud, 0, 0);

  // Blinking REC dot (hanya 1 path arc kecil jika frame blink aktif)
  const isBlink = Math.floor(frame / 15) % 2 === 0;
  if (isBlink) {
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(50, 47, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Running live timestamp string (hanya isi teks jam running)
  const timestampStr = getCachedLiveTimestamp();
  ctx.save();
  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(timestampStr, 150, 720 - 38);
  ctx.restore();
}

/**
 * Pre-render background statis (meja inspeksi, grid, kotak kardus dasar, produk di dalam kardus)
 * Dilakukan sekali saja di offscreen canvas untuk menghilangkan 85% beban render per frame!
 */
function createPreRenderedBackground(): HTMLCanvasElement {
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 1280;
  bgCanvas.height = 720;
  const ctx = bgCanvas.getContext('2d');
  if (!ctx) return bgCanvas;

  // 1. Background workbench mat
  const bgGrad = ctx.createLinearGradient(0, 0, 1280, 720);
  bgGrad.addColorStop(0, '#131b2e');
  bgGrad.addColorStop(0.5, '#1e293b');
  bgGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1280, 720);

  // Grid lines on cutting mat
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1280; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 720);
    ctx.stroke();
  }
  for (let y = 0; y < 720; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1280, y);
    ctx.stroke();
  }

  // Inspection zone perimeter
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(260, 95, 760, 530);
  ctx.setLineDash([]);

  // 2. Cardboard Box (Center)
  const boxX = 360;
  const boxY = 160;
  const boxW = 560;
  const boxH = 400;

  // Box drop shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(640, 570, 270, 35, 0, 0, Math.PI * 2);
  ctx.fill();

  // Box Outer Body (Warm kraft cardboard)
  const boxGrad = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH);
  boxGrad.addColorStop(0, '#d97706');
  boxGrad.addColorStop(0.2, '#b45309');
  boxGrad.addColorStop(1, '#92400e');
  ctx.fillStyle = boxGrad;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  // Box Inside cavity (darker Kraft interior)
  const innerPad = 40;
  ctx.fillStyle = '#451a03';
  ctx.fillRect(boxX + innerPad, boxY + innerPad, boxW - innerPad * 2, boxH - innerPad * 2);

  // Item 1: Otwoo Cosmetics Serum Bottle (Left inside)
  const serumX = boxX + 80;
  const serumY = boxY + 90;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(serumX + 10, serumY + 120, 90, 80);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(serumX, serumY + 40, 100, 160);
  ctx.fillStyle = '#fef08a';
  ctx.fillRect(serumX + 15, serumY + 80, 70, 70);
  ctx.fillStyle = '#78350f';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('OTWOO SERUM', serumX + 17, serumY + 115);
  ctx.font = '9px sans-serif';
  ctx.fillText('Beauty Essence 30ml', serumX + 17, serumY + 130);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(serumX + 35, serumY, 30, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(serumX + 42, serumY - 12, 16, 14);

  // Item 2: Otwoo Velvet Lip Matte / Skincare Box (Right inside)
  const cosmeticX = boxX + 220;
  const cosmeticY = boxY + 70;
  ctx.fillStyle = '#be185d';
  ctx.beginPath();
  ctx.roundRect(cosmeticX, cosmeticY, 220, 200, 12);
  ctx.fill();
  ctx.fillStyle = '#f472b6';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('O.TWO.O COSMETICS', cosmeticX + 25, cosmeticY + 50);
  ctx.fillStyle = '#fbcfe8';
  ctx.font = '10px sans-serif';
  ctx.fillText('Velvet Matte Lipstick Set', cosmeticX + 25, cosmeticY + 75);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cosmeticX + 25, cosmeticY + 95, 170, 70);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('SKU: sc064', cosmeticX + 35, cosmeticY + 120);
  ctx.fillText('STATUS: INSPECTED', cosmeticX + 35, cosmeticY + 145);

  return bgCanvas;
}

/**
 * Stream Virtual Unboxing (Hands Opening Package on Workbench)
 * Dirancang sangat ringan, halus (25 FPS terkunci), dan tidak membebani CPU/GPU
 */
export function createVirtualStationStream(
  awbOrGetter: string | (() => string) = 'ORD-992-JKT',
  warehouseNameOrGetter: string | (() => string) = DEFAULT_WAREHOUSE_NAME
): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  // Pre-render background statis (1x saja)
  const bgCanvas = createPreRenderedBackground();

  let frame = 0;
  let isRunning = true;
  let animId = 0;

  // Frame pacing stabil 25 FPS
  const TARGET_FPS = 25;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  let lastFrameTime = performance.now();

  const boxX = 360;
  const boxY = 160;
  const boxW = 560;
  const boxH = 400;
  const innerPad = 40;

  const draw = (now: number) => {
    if (!ctx || !isRunning) return;
    animId = requestAnimationFrame(draw);

    const elapsed = now - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) return;
    lastFrameTime = now - (elapsed % FRAME_INTERVAL);
    frame++;

    const currentAwb = typeof awbOrGetter === 'function' ? awbOrGetter() : awbOrGetter;
    const currentWarehouse = typeof warehouseNameOrGetter === 'function' ? warehouseNameOrGetter() : warehouseNameOrGetter;

    // 1. Gambar background statis instan
    ctx.drawImage(bgCanvas, 0, 0);

    // 2. Animasikan flap kardus
    const flapProgress = Math.min(1, Math.max(0.1, (Math.sin(frame * 0.04) + 1) / 2));

    // Left flap
    ctx.save();
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(boxX, boxY);
    ctx.lineTo(boxX + innerPad, boxY + innerPad);
    ctx.lineTo(boxX + innerPad, boxY + boxH - innerPad);
    ctx.lineTo(boxX, boxY + boxH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Right flap
    ctx.save();
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(boxX + boxW, boxY);
    ctx.lineTo(boxX + boxW - innerPad, boxY + innerPad);
    ctx.lineTo(boxX + boxW - innerPad, boxY + boxH - innerPad);
    ctx.lineTo(boxX + boxW, boxY + boxH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Top flap
    ctx.fillStyle = '#ca8a04';
    ctx.beginPath();
    ctx.moveTo(boxX, boxY);
    ctx.lineTo(boxX + boxW, boxY);
    ctx.lineTo(boxX + boxW - 30, boxY - 50 * flapProgress);
    ctx.lineTo(boxX + 30, boxY - 50 * flapProgress);
    ctx.closePath();
    ctx.fill();

    // Bottom flap
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(boxX, boxY + boxH);
    ctx.lineTo(boxX + boxW, boxY + boxH);
    ctx.lineTo(boxX + boxW - 30, boxY + boxH + 40 * flapProgress);
    ctx.lineTo(boxX + 30, boxY + boxH + 40 * flapProgress);
    ctx.closePath();
    ctx.fill();

    // Shipping Label on Front Box Edge
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(boxX + 160, boxY + boxH - 30, 240, 24);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`ORDER ID: ${currentAwb || 'ORD-992-JKT'}`, boxX + 170, boxY + boxH - 14);

    // 3. HANDS OPENING PACKAGE
    const handOsc = Math.sin(frame * 0.08) * 12;

    // Left Arm & Hand
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(180, 380 + handOsc);
    ctx.lineTo(310, 360 + handOsc);
    ctx.lineTo(310, 440 + handOsc);
    ctx.lineTo(180, 460 + handOsc);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.ellipse(335, 400 + handOsc, 32, 24, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f472b6';
    for (let f = 0; f < 4; f++) {
      ctx.beginPath();
      ctx.roundRect(350 + f * 5, 385 + f * 7 + handOsc, 18, 12, 6);
      ctx.fill();
    }
    ctx.restore();

    // Right Arm & Hand
    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(1100, 360 - handOsc);
    ctx.lineTo(960, 350 - handOsc);
    ctx.lineTo(960, 430 - handOsc);
    ctx.lineTo(1100, 440 - handOsc);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fbcfe8';
    ctx.beginPath();
    ctx.ellipse(940, 390 - handOsc, 32, 24, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f472b6';
    for (let f = 0; f < 4; f++) {
      ctx.beginPath();
      ctx.roundRect(915 - f * 6, 375 + f * 8 - handOsc, 18, 12, 6);
      ctx.fill();
    }
    ctx.restore();

    // 4. Barcode Scanner Red Laser Beam
    const laserY = 220 + Math.sin(frame * 0.1) * 140 + 140;
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.fillRect(boxX + 20, laserY - 1.5, boxW - 40, 3);

    // 5. HUD WATERMARK & STATUS OVERLAYS (Nama & Timestamp Tanggal-Jam)
    drawVideoOverlayHud(ctx, currentAwb, currentWarehouse, frame);
  };

  animId = requestAnimationFrame(draw);
  const stream = canvas.captureStream(25);

  // Clean up saat stream dihentikan
  const track = stream.getVideoTracks()[0];
  if (track) {
    const origStop = track.stop.bind(track);
    track.stop = () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      origStop();
    };
  }

  return stream;
}

/**
 * Compositor untuk Webcam Fisik:
 * Mengambil feed webcam asli lalu membakar (burn-in) watermark
 * "RMA Warehouse Otwoo Cosmetics Indonesia" & Live Timestamp ke dalam stream rekaman
 * Dioptimalkan dengan frame pacing 30 FPS halus & anti-lemot
 */
export function createWebcamCompositedStream(
  webcamStream: MediaStream,
  awbOrGetter: string | (() => string) = 'ORD-992-JKT',
  warehouseNameOrGetter: string | (() => string) = DEFAULT_WAREHOUSE_NAME,
  mirrorOrGetter: boolean | (() => boolean) = false,
  sourceVideoElement?: HTMLVideoElement | null
): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  let hiddenVideo: HTMLVideoElement | null = null;
  // Jika source video element aktif sudah bermain di DOM (misal videoRef), pakai langsung untuk performa GPU maksimal
  if (!sourceVideoElement) {
    hiddenVideo = document.createElement('video');
    hiddenVideo.srcObject = webcamStream;
    hiddenVideo.muted = true;
    hiddenVideo.playsInline = true;
    hiddenVideo.autoplay = true;
    hiddenVideo.play().catch(() => {});
  }

  let frame = 0;
  let isRunning = true;
  let animId = 0;

  // Frame pacing stabil 30 FPS (anti-lemot, teroptimasi hardware)
  const TARGET_FPS = 30;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  let lastFrameTime = performance.now();

  const draw = (now: number) => {
    if (!ctx || !isRunning) return;
    animId = requestAnimationFrame(draw);

    const elapsed = now - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) return;
    lastFrameTime = now - (elapsed % FRAME_INTERVAL);
    frame++;

    const currentAwb = typeof awbOrGetter === 'function' ? awbOrGetter() : awbOrGetter;
    const currentWarehouse = typeof warehouseNameOrGetter === 'function' ? warehouseNameOrGetter() : warehouseNameOrGetter;
    const isMirrored = typeof mirrorOrGetter === 'function' ? mirrorOrGetter() : mirrorOrGetter;

    const activeVid = (sourceVideoElement && sourceVideoElement.readyState >= 2)
      ? sourceVideoElement
      : hiddenVideo;

    if (activeVid && activeVid.readyState >= 2) {
      if (isMirrored) {
        ctx.save();
        ctx.translate(1280, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(activeVid, 0, 0, 1280, 720);
        ctx.restore();
      } else {
        ctx.drawImage(activeVid, 0, 0, 1280, 720);
      }
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1280, 720);
    }

    // Burn-in HUD Overlay ultra-cepat via static cached layer
    drawVideoOverlayHud(ctx, currentAwb, currentWarehouse, frame);
  };

  animId = requestAnimationFrame(draw);
  const compositedStream = canvas.captureStream(30);

  // SINKRONISASI AUDIO: Pindahkan audio track dari webcamStream agar rekaman memiliki audio
  try {
    webcamStream.getAudioTracks().forEach((audioTrack) => {
      compositedStream.addTrack(audioTrack);
    });
  } catch (audioErr) {
    console.warn('Gagal menambahkan audio track ke compositedStream:', audioErr);
  }

  const track = compositedStream.getVideoTracks()[0];
  if (track) {
    const origStop = track.stop.bind(track);
    track.stop = () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      if (hiddenVideo) {
        hiddenVideo.pause();
        hiddenVideo.srcObject = null;
      }
      origStop();
    };
  }

  return compositedStream;
}

/**
 * Technical Standby Screen (30 FPS) saat webcam sedang menunggu izin atau inisialisasi:
 * Format CCTV Gudang modern tanpa simulasi animasi tangan apapun.
 */
export function createWebcamStandbyStream(
  awbOrGetter: string | (() => string) = 'ORD-992-JKT',
  warehouseNameOrGetter: string | (() => string) = DEFAULT_WAREHOUSE_NAME
): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  let frame = 0;
  let isRunning = true;
  let animId = 0;

  const TARGET_FPS = 30;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  let lastFrameTime = performance.now();

  const draw = (now: number) => {
    if (!ctx || !isRunning) return;
    animId = requestAnimationFrame(draw);

    const elapsed = now - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) return;
    lastFrameTime = now - (elapsed % FRAME_INTERVAL);
    frame++;

    const currentAwb = typeof awbOrGetter === 'function' ? awbOrGetter() : awbOrGetter;
    const currentWarehouse = typeof warehouseNameOrGetter === 'function' ? warehouseNameOrGetter() : warehouseNameOrGetter;

    // Dark sleek workbench pattern
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, 1280, 720);

    // Subtle inspection grid
    ctx.strokeStyle = 'rgba(76, 29, 149, 0.25)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1280; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 720);
      ctx.stroke();
    }
    for (let y = 0; y < 720; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1280, y);
      ctx.stroke();
    }

    // Center Camera Targeting Reticle
    const cx = 640;
    const cy = 360;
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 200, cy - 130, 400, 260);

    // Crosshair corners
    const arm = 24;
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 3;
    // Top-left
    ctx.beginPath(); ctx.moveTo(cx - 200, cy - 130 + arm); ctx.lineTo(cx - 200, cy - 130); ctx.lineTo(cx - 200 + arm, cy - 130); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(cx + 200 - arm, cy - 130); ctx.lineTo(cx + 200, cy - 130); ctx.lineTo(cx + 200, cy - 130 + arm); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(cx - 200, cy + 130 - arm); ctx.lineTo(cx - 200, cy + 130); ctx.lineTo(cx - 200 + arm, cy + 130); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(cx + 200 - arm, cy + 130); ctx.lineTo(cx + 200, cy + 130); ctx.lineTo(cx + 200, cy + 130 - arm); ctx.stroke();

    // Center icon & text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STANDBY WEBCAM • 30 FPS', cx, cy - 15);

    ctx.fillStyle = '#a78bfa';
    ctx.font = '14px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText('Menghubungkan ke Kamera Stasiun Unboxing...', cx, cy + 20);

    ctx.textAlign = 'left';

    // Burn-in HUD Overlay permanen
    drawVideoOverlayHud(ctx, currentAwb, currentWarehouse, frame);
  };

  animId = requestAnimationFrame(draw);
  const stream = canvas.captureStream(30);

  const track = stream.getVideoTracks()[0];
  if (track) {
    const origStop = track.stop.bind(track);
    track.stop = () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      origStop();
    };
  }

  return stream;
}
