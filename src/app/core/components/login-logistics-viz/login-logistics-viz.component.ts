import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  viewChild,
} from '@angular/core';

type RoadTruck = {
  x: number;
  speed: number;
  scale: number;
  seed: number;
  kind: 'container' | 'lowboy';
};

/** Carretera de montaña de noche: sierras, firme y tractocamiones (contenedor / carga pesada). */
@Component({
  selector: 'app-login-logistics-viz',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="login-logistics-viz" aria-hidden="true"></canvas>`,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    .login-logistics-viz {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class LoginLogisticsVizComponent implements AfterViewInit, OnDestroy {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private rafId = 0;
  private disposed = false;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private time = 0;
  private lastTs = 0;
  private mouseX = 0;
  private mouseY = 0;
  private smoothX = 0;
  private smoothY = 0;
  private trucks: RoadTruck[] = [];
  private readonly reduceMotion =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.canvasRef().nativeElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    this.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  };

  private readonly onResize = (): void => {
    this.resize();
  };

  ngAfterViewInit(): void {
    this.trucks = [
      { x: 0.18, speed: 0.016, scale: 2.05, seed: 0.8, kind: 'container' },
      { x: 0.52, speed: 0.012, scale: 1.35, seed: 2.1, kind: 'container' },
      { x: 0.72, speed: 0.01, scale: 1.65, seed: 1.4, kind: 'lowboy' },
    ];
    this.resize();
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('resize', this.onResize, { passive: true });
    this.rafId = requestAnimationFrame(this.tick);
  }

  ngOnDestroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('resize', this.onResize);
  }

  private readonly tick = (ts: number): void => {
    if (this.disposed) {
      return;
    }
    const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0.016;
    this.lastTs = ts;
    this.time += this.reduceMotion ? 0 : dt;
    this.smoothX += (this.mouseX - this.smoothX) * 0.055;
    this.smoothY += (this.mouseY - this.smoothY) * 0.055;
    this.draw();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private resize(): void {
    const canvas = this.canvasRef().nativeElement;
    const parent = canvas.parentElement;
    if (!parent) {
      return;
    }
    this.width = parent.clientWidth || window.innerWidth;
    this.height = parent.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
    canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;
  }

  private draw(): void {
    const ctx = this.canvasRef().nativeElement.getContext('2d');
    if (!ctx) {
      return;
    }
    const width = this.width;
    const height = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const px = this.smoothX;
    const py = this.smoothY;
    const time = this.time;

    this.drawSky(ctx, width, height);
    this.drawStars(ctx, width, height);
    this.drawMoon(ctx, width * 0.78 + px * 8, height * 0.12 - py * 4);

    const farY = height * 0.38 - py * 5;
    const farAmp = height * 0.07;
    this.drawMountainRange(ctx, width, height, farY, farAmp, '#2a3548', time, 0, px * 6, 0.55);
    this.drawMountainPeaks(ctx, width, farY, farAmp, time, 0, px * 6, '#3d4a62', 5);

    const midY = height * 0.52 - py * 8;
    const midAmp = height * 0.085;
    this.drawMountainRange(ctx, width, height, midY, midAmp, '#1e2838', time, 1, px * 12, 0.75);
    this.drawPineLine(ctx, width, midY, midAmp, time, 1, px * 12, 14, 0.85);

    const nearY = height * 0.68 - py * 11;
    const nearAmp = height * 0.095;
    this.drawMountainRange(ctx, width, height, nearY, nearAmp, '#121a28', time, 2, px * 20, 1);
    this.drawPineLine(ctx, width, nearY, nearAmp, time, 2, px * 20, 11, 1.1);

    const roadBaseY = height * 0.82 - py * 8;
    this.drawRoadCut(ctx, width, height, roadBaseY, nearAmp, time, 2, px * 22);

    for (const truck of this.trucks) {
      const progress = this.reduceMotion ? truck.x : (truck.x + time * truck.speed) % 1.1;
      const x = (progress - 0.05) * width + px * 24;
      const roadY = this.ridgeY(x, width, roadBaseY, nearAmp * 0.35, time, 2) + 2;
      if (truck.kind === 'lowboy') {
        this.drawTractorLowboy(ctx, x, roadY, truck.scale, 1, time + truck.seed);
      } else {
        this.drawTractorContainer(ctx, x, roadY, truck.scale, 1, time + truck.seed);
      }
    }

    this.drawRoadMarkings(ctx, width, roadBaseY, nearAmp, time, 2, px * 22);
    this.drawVignette(ctx, width, height);
  }

  private drawSky(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0a1018');
    sky.addColorStop(0.35, '#131c2b');
    sky.addColorStop(0.62, '#1f2a3c');
    sky.addColorStop(0.82, '#2a3545');
    sky.addColorStop(1, '#141c28');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(
      width * 0.45,
      height * 0.72,
      10,
      width * 0.5,
      height * 0.78,
      width * 0.65,
    );
    glow.addColorStop(0, 'rgba(232, 196, 120, 0.12)');
    glow.addColorStop(1, 'rgba(232, 196, 120, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  private drawStars(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = 'rgba(229, 237, 248, 0.36)';
    for (let i = 0; i < 28; i++) {
      const x = (((i * 97) % 1000) / 1000) * width;
      const y = (((i * 53) % 400) / 1000) * height;
      ctx.beginPath();
      ctx.arc(x, y, i % 6 === 0 ? 1.2 : 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.beginPath();
    ctx.fillStyle = 'rgba(229, 237, 248, 0.08)';
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(229, 237, 248, 0.72)';
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  private ridgeY(x: number, width: number, baseY: number, amp: number, time: number, seed: number): number {
    const u = x / width;
    return (
      baseY +
      Math.sin(u * 2.4 + seed * 1.3) * amp +
      Math.sin(u * 5.5 + seed * 2 + time * 0.04) * amp * 0.3 +
      Math.sin(u * 11 + seed) * amp * 0.12
    );
  }

  private drawMountainRange(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    baseY: number,
    amp: number,
    color: string,
    time: number,
    seed: number,
    shift: number,
    alpha: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(-40 + shift, height + 20);
    for (let x = -40; x <= width + 40; x += 5) {
      ctx.lineTo(x + shift, this.ridgeY(x, width, baseY, amp, time, seed));
    }
    ctx.lineTo(width + 40 + shift, height + 20);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = seed === 0 ? 'rgba(200, 210, 230, 0.18)' : 'rgba(120, 140, 170, 0.1)';
    ctx.lineWidth = seed === 0 ? 1.5 : 1;
    ctx.stroke();
    ctx.restore();
  }

  private drawMountainPeaks(
    ctx: CanvasRenderingContext2D,
    width: number,
    baseY: number,
    amp: number,
    time: number,
    seed: number,
    shift: number,
    snow: string,
    count: number,
  ): void {
    ctx.fillStyle = snow;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;
      const x = u * width + shift + Math.sin(i * 2.1) * 30;
      const ground = this.ridgeY(x, width, baseY, amp, time, seed);
      const peakH = amp * (0.55 + (i % 3) * 0.15);
      ctx.beginPath();
      ctx.moveTo(x - peakH * 0.55, ground);
      ctx.lineTo(x, ground - peakH);
      ctx.lineTo(x + peakH * 0.55, ground);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawPineLine(
    ctx: CanvasRenderingContext2D,
    width: number,
    baseY: number,
    amp: number,
    time: number,
    seed: number,
    shift: number,
    count: number,
    size: number,
  ): void {
    ctx.fillStyle = '#0e141f';
    for (let i = 0; i < count; i++) {
      const edge = i / (count - 1);
      if (edge > 0.18 && edge < 0.82 && i % 3 !== 0) {
        continue;
      }
      const x = edge * width + shift + Math.sin(i * 2.8 + seed) * 18;
      const ground = this.ridgeY(edge * width, width, baseY, amp, time, seed);
      this.drawPine(ctx, x, ground + 2, (38 + (i * 17) % 36) * size);
    }
  }

  private drawPine(ctx: CanvasRenderingContext2D, x: number, ground: number, h: number): void {
    ctx.beginPath();
    ctx.moveTo(x, ground - h);
    ctx.lineTo(x + h * 0.22, ground - h * 0.55);
    ctx.lineTo(x + h * 0.1, ground - h * 0.55);
    ctx.lineTo(x + h * 0.28, ground - h * 0.25);
    ctx.lineTo(x + h * 0.06, ground - h * 0.25);
    ctx.lineTo(x + h * 0.14, ground);
    ctx.lineTo(x - h * 0.14, ground);
    ctx.lineTo(x - h * 0.06, ground - h * 0.25);
    ctx.lineTo(x - h * 0.28, ground - h * 0.25);
    ctx.lineTo(x - h * 0.1, ground - h * 0.55);
    ctx.lineTo(x - h * 0.22, ground - h * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  private drawRoadCut(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    roadBaseY: number,
    amp: number,
    time: number,
    seed: number,
    shift: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(-30 + shift, height + 15);
    for (let x = -30; x <= width + 30; x += 6) {
      const shoulder = this.ridgeY(x, width, roadBaseY, amp * 0.28, time, seed);
      ctx.lineTo(x + shift, shoulder + 14);
    }
    ctx.lineTo(width + 30 + shift, height + 15);
    ctx.closePath();
    ctx.fillStyle = '#1a222e';
    ctx.fill();

    ctx.beginPath();
    for (let x = -30; x <= width + 30; x += 6) {
      const y = this.ridgeY(x, width, roadBaseY, amp * 0.28, time, seed) + 6;
      if (x === -30) {
        ctx.moveTo(x + shift, y);
      } else {
        ctx.lineTo(x + shift, y);
      }
    }
    ctx.strokeStyle = 'rgba(229, 237, 248, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#252f3d';
    ctx.beginPath();
    ctx.moveTo(-30 + shift, height + 15);
    for (let x = -30; x <= width + 30; x += 6) {
      ctx.lineTo(x + shift, this.ridgeY(x, width, roadBaseY, amp * 0.28, time, seed) + 22);
    }
    ctx.lineTo(width + 30 + shift, height + 15);
    ctx.closePath();
    ctx.fill();
  }

  private drawRoadMarkings(
    ctx: CanvasRenderingContext2D,
    width: number,
    roadBaseY: number,
    amp: number,
    time: number,
    seed: number,
    shift: number,
  ): void {
    ctx.strokeStyle = 'rgba(240, 192, 64, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([14, 18]);
    ctx.lineDashOffset = this.reduceMotion ? 0 : -(time * 34);
    ctx.beginPath();
    for (let x = -20; x <= width + 20; x += 10) {
      const y = this.ridgeY(x, width, roadBaseY, amp * 0.28, time, seed) + 14;
      if (x === -20) {
        ctx.moveTo(x + shift, y);
      } else {
        ctx.lineTo(x + shift, y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawTractorContainer(
    ctx: CanvasRenderingContext2D,
    x: number,
    ground: number,
    scale: number,
    dir: number,
    time: number,
  ): void {
    const s = 14 * scale;
    const bounce = this.reduceMotion ? 0 : Math.sin(time * 3.5) * 0.4;
    ctx.save();
    ctx.translate(x, ground + bounce);
    ctx.scale(dir, 1);

    const cw = s * 2.75;
    const ch = s * 1.42;
    this.drawContainerBox(ctx, -cw - s * 0.45, -s * 0.12, cw, ch);

    this.drawTractorCab(ctx, s);
    this.drawTruckTaillights(ctx, -cw - s * 0.48, s);
    this.drawTruckWheels(ctx, s, time, [-s * 2.1, -s * 1.38, -s * 0.62, s * 0.48]);

    ctx.restore();
  }

  private drawTractorLowboy(
    ctx: CanvasRenderingContext2D,
    x: number,
    ground: number,
    scale: number,
    dir: number,
    time: number,
  ): void {
    const s = 14 * scale;
    const bounce = this.reduceMotion ? 0 : Math.sin(time * 2.8) * 0.28;
    ctx.save();
    ctx.translate(x, ground + bounce);
    ctx.scale(dir, 1);

    const deckLen = s * 3.05;
    const deckX = -deckLen - s * 0.4;
    ctx.fillStyle = '#2a3340';
    ctx.fillRect(deckX, -s * 0.38, deckLen, s * 0.22);
    ctx.strokeStyle = 'rgba(229, 237, 248, 0.12)';
    ctx.strokeRect(deckX + 0.5, -s * 0.38 + 0.5, deckLen - 1, s * 0.22 - 1);

    ctx.fillStyle = '#3a4555';
    ctx.beginPath();
    ctx.moveTo(deckX, -s * 0.38);
    ctx.lineTo(deckX + s * 0.35, -s * 0.55);
    ctx.lineTo(deckX + s * 0.35, -s * 0.38);
    ctx.closePath();
    ctx.fill();

    this.drawHeavyMachine(ctx, deckX + s * 0.55, -s * 0.38, s, time);

    this.drawTractorCab(ctx, s);
    this.drawTruckTaillights(ctx, deckX - s * 0.08, s);
    this.drawTruckWheels(ctx, s, time, [-s * 2.35, -s * 1.55, -s * 0.72, s * 0.48, -s * 1.95]);

    ctx.restore();
  }

  /** Cabina a la derecha = avance hacia la derecha (dir 1). */
  private drawTractorCab(ctx: CanvasRenderingContext2D, s: number): void {
    ctx.fillStyle = '#3d4a5c';
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.1);
    ctx.lineTo(s * 0.72, -s * 0.1);
    ctx.lineTo(s * 0.9, -s * 1.02);
    ctx.lineTo(s * 0.9, -s * 1.52);
    ctx.lineTo(-s * 0.4, -s * 1.52);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(130, 175, 230, 0.4)';
    ctx.fillRect(s * 0.1, -s * 1.42, s * 0.4, s * 0.62);
    ctx.fillRect(s * 0.54, -s * 1.32, s * 0.26, s * 0.48);

    ctx.fillStyle = 'rgba(255, 200, 110, 0.85)';
    ctx.beginPath();
    ctx.arc(s * 0.84, -s * 0.42, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTruckTaillights(ctx: CanvasRenderingContext2D, rearX: number, s: number): void {
    ctx.fillStyle = 'rgba(255, 70, 55, 0.9)';
    ctx.fillRect(rearX, -s * 1.15, s * 0.11, s * 0.22);
    ctx.fillRect(rearX, -s * 0.55, s * 0.11, s * 0.22);
  }

  private drawTruckWheels(
    ctx: CanvasRenderingContext2D,
    s: number,
    time: number,
    positions: number[],
  ): void {
    const wheelR = s * 0.36;
    const wheelY = s * 0.14;
    const step = this.reduceMotion ? 0 : Math.sin(time * 3.5) * 0.35;
    ctx.fillStyle = '#0a0e14';
    for (const wx of positions) {
      const swing = wx < s * 0.2 ? step : -step * 0.65;
      ctx.beginPath();
      ctx.arc(wx + swing * s * 0.08, wheelY, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 210, 220, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(wx + swing * s * 0.08, wheelY, wheelR * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Excavadora sobre plataforma baja (carga pesada). */
  private drawHeavyMachine(
    ctx: CanvasRenderingContext2D,
    x: number,
    deckTop: number,
    s: number,
    time: number,
  ): void {
    const trackY = deckTop - s * 0.08;
    ctx.fillStyle = '#1a1f28';
    ctx.fillRect(x, trackY, s * 1.35, s * 0.18);
    ctx.fillRect(x + s * 1.55, trackY, s * 1.1, s * 0.18);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(x + 4 + i * 8, trackY + 3, 4, s * 0.12);
      ctx.fillRect(x + s * 1.55 + 4 + i * 7, trackY + 3, 4, s * 0.12);
    }

    ctx.fillStyle = '#a88632';
    ctx.fillRect(x + s * 0.35, deckTop - s * 0.95, s * 1.05, s * 0.62);
    ctx.fillStyle = 'rgba(80, 120, 180, 0.45)';
    ctx.fillRect(x + s * 0.55, deckTop - s * 1.25, s * 0.45, s * 0.32);

    const armSwing = this.reduceMotion ? 0 : Math.sin(time * 0.45) * 0.08;
    ctx.strokeStyle = '#8a7028';
    ctx.lineWidth = s * 0.09;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.95, deckTop - s * 0.72);
    ctx.lineTo(x + s * (1.55 + armSwing), deckTop - s * 1.35);
    ctx.lineTo(x + s * (2.05 + armSwing), deckTop - s * 0.88);
    ctx.stroke();

    ctx.fillStyle = '#6a5a28';
    ctx.beginPath();
    ctx.moveTo(x + s * (2.05 + armSwing), deckTop - s * 0.88);
    ctx.lineTo(x + s * (2.35 + armSwing), deckTop - s * 0.75);
    ctx.lineTo(x + s * (2.15 + armSwing), deckTop - s * 0.62);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 200, 80, 0.55)';
    ctx.fillRect(x + s * 2.5, deckTop - s * 1.05, s * 0.12, s * 0.35);
  }

  private drawContainerBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    bottomY: number,
    w: number,
    h: number,
  ): void {
    const top = bottomY - h;
    ctx.fillStyle = '#355070';
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(x, top, w, 3);

    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, top + 0.5, w - 1, h - 1);

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    for (let i = 1; i <= 3; i++) {
      const lx = x + (w * i) / 4;
      ctx.beginPath();
      ctx.moveTo(lx, top + 4);
      ctx.lineTo(lx, bottomY - 4);
      ctx.stroke();
    }

    ctx.fillStyle = '#f0c040';
    ctx.fillRect(x + w - 16, top + h * 0.38, 11, 4);
  }

  private drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const v = ctx.createRadialGradient(
      width * 0.5,
      height * 0.55,
      height * 0.14,
      width * 0.5,
      height * 0.5,
      height * 0.9,
    );
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, width, height);
  }
}
