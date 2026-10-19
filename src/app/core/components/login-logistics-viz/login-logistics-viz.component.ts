import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  viewChild,
} from '@angular/core';

type TruckRoute = 'main' | 'scenic';

type RoadTruck = {
  x: number;
  speed: number;
  scale: number;
  seed: number;
  kind: 'container' | 'lowboy';
  /** 2 = full doble (tándem de contenedores). */
  containerCount?: 1 | 2;
  /** Carril en la vía principal (px sobre el firme). */
  lane: number;
};

/** Progreso 0–1; al reiniciar el ciclo los camiones entran por la izquierda sin quedar fuera de pantalla. */
const TRUCK_CYCLE = 1;

const SCENIC_BRANCH_START = 0.33;
const SCENIC_BRANCH_END = 0.84;

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
      {
        x: 0.08,
        speed: 0.0145,
        scale: 2.05,
        seed: 0.8,
        kind: 'container',
        containerCount: 2,
        lane: 0,
      },
      { x: 0.42, speed: 0.0145, scale: 1.35, seed: 2.1, kind: 'container', lane: 5 },
      { x: 0.68, speed: 0.012, scale: 1.65, seed: 1.4, kind: 'lowboy', lane: 0 },
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
    this.drawScenicBranchRoad(ctx, width, height, roadBaseY, nearAmp, time, 2, px * 22);

    const truckProgress = this.trucks.map((truck) => ({
      truck,
      progress: this.truckProgress(truck, time),
    }));
    const routes = this.resolveTruckRoutes(truckProgress, width, px);
    const placements = truckProgress.map(({ truck, progress }) =>
      this.truckPlacement(truck, progress, routes, width, roadBaseY, nearAmp, time, px),
    );
    placements.sort((a, b) => a.y - b.y || a.x - b.x);

    for (const place of placements) {
      const { truck, x, y } = place;
      if (truck.kind === 'lowboy') {
        this.drawTractorLowboy(ctx, x, y, truck.scale, 1, time + truck.seed);
      } else if (truck.containerCount === 2) {
        this.drawTractorDoubleContainer(ctx, x, y, truck.scale, 1, time + truck.seed);
      } else {
        this.drawTractorContainer(ctx, x, y, truck.scale, 1, time + truck.seed);
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

  private truckProgress(truck: RoadTruck, time: number): number {
    if (this.reduceMotion) {
      return truck.x;
    }
    const raw = truck.x + time * truck.speed;
    const cycle = Math.floor(raw / TRUCK_CYCLE) * TRUCK_CYCLE;
    return raw - cycle;
  }

  private truckMainScreenX(progress: number, width: number, px: number): number {
    return (progress - 0.05) * width + px * 24;
  }

  private inScenicBranch(progress: number): boolean {
    return progress >= SCENIC_BRANCH_START && progress <= SCENIC_BRANCH_END;
  }

  /** Dos pasos sin recursión (evita stack overflow cuando dos contenedores comparten el ramal). */
  private resolveTruckRoutes(
    all: Array<{ truck: RoadTruck; progress: number }>,
    width: number,
    px: number,
  ): Map<RoadTruck, TruckRoute> {
    const routes = new Map<RoadTruck, TruckRoute>();
    for (const { truck, progress } of all) {
      if (!this.inScenicBranch(progress)) {
        routes.set(truck, 'main');
      } else if (truck.kind === 'lowboy') {
        routes.set(truck, 'scenic');
      } else {
        routes.set(truck, 'main');
      }
    }

    const minGapPx = width * 0.1;
    for (const { truck, progress } of all) {
      if (routes.get(truck) !== 'main' || !this.inScenicBranch(progress)) {
        continue;
      }
      const myX = this.truckMainScreenX(progress, width, px);
      for (const other of all) {
        if (other.truck === truck || routes.get(other.truck) !== 'main') {
          continue;
        }
        const gapPx = myX - this.truckMainScreenX(other.progress, width, px);
        if (gapPx > 0 && gapPx < minGapPx && truck.speed > other.truck.speed + 0.0005) {
          routes.set(truck, 'scenic');
          break;
        }
      }
    }

    return routes;
  }

  private truckPlacement(
    truck: RoadTruck,
    progress: number,
    routes: Map<RoadTruck, TruckRoute>,
    width: number,
    roadBaseY: number,
    nearAmp: number,
    time: number,
    px: number,
  ): { truck: RoadTruck; x: number; y: number; route: TruckRoute } {
    const route = routes.get(truck) ?? 'main';
    const screenProgress = progress - 0.05;
    let x = screenProgress * width + px * 24;

    if (route === 'main') {
      const y =
        this.ridgeY(x, width, roadBaseY, nearAmp * 0.35, time, 2) + 2 + truck.lane;
      return { truck, x, y, route };
    }

    const u = (progress - SCENIC_BRANCH_START) / (SCENIC_BRANCH_END - SCENIC_BRANCH_START);
    const lift = Math.sin(u * Math.PI) * 42;
    const cutIn = Math.min(1, u / 0.14);
    const cutOut = Math.min(1, (1 - u) / 0.16);
    const branchBlend = Math.min(cutIn, cutOut);
    const lateral = Math.sin(u * Math.PI) * -18 * branchBlend;
    x += lateral;
    const mainY = this.ridgeY(x, width, roadBaseY, nearAmp * 0.35, time, 2) + 2;
    const y = mainY - lift * branchBlend;
    return { truck, x, y, route };
  }

  /** Ramal elevado (curva de montaña) donde desvía el lowboy o quien iba a alcanzar al de adelante. */
  private scenicBranchPoints(
    width: number,
    roadBaseY: number,
    amp: number,
    time: number,
    seed: number,
    shift: number,
  ): Array<{ x: number; y: number }> {
    const steps = 32;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const progress = SCENIC_BRANCH_START + u * (SCENIC_BRANCH_END - SCENIC_BRANCH_START);
      const x = (progress - 0.05) * width + shift;
      const lift = Math.sin(u * Math.PI) * 42;
      const cutIn = Math.min(1, u / 0.14);
      const cutOut = Math.min(1, (1 - u) / 0.16);
      const branchBlend = Math.min(cutIn, cutOut);
      const lateral = Math.sin(u * Math.PI) * -18 * branchBlend;
      const mainY = this.ridgeY(x + lateral, width, roadBaseY, amp * 0.35, time, seed) + 2;
      points.push({ x: x + lateral, y: mainY - lift * branchBlend });
    }
    return points;
  }

  private strokePath(
    ctx: CanvasRenderingContext2D,
    points: Array<{ x: number; y: number }>,
    offsetY: number,
  ): void {
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        ctx.moveTo(p.x, p.y + offsetY);
      } else {
        ctx.lineTo(p.x, p.y + offsetY);
      }
    }
    ctx.stroke();
  }

  /** Ramal elevado: solo trazo sobre el paisaje (sin relleno vertical que cortaba el firme). */
  private drawScenicBranchRoad(
    ctx: CanvasRenderingContext2D,
    width: number,
    _height: number,
    roadBaseY: number,
    amp: number,
    time: number,
    seed: number,
    shift: number,
  ): void {
    const points = this.scenicBranchPoints(width, roadBaseY, amp, time, seed, shift);
    if (points.length < 2) {
      return;
    }

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = 'rgba(26, 34, 46, 0.85)';
    ctx.lineWidth = 22;
    this.strokePath(ctx, points, 10);

    ctx.strokeStyle = 'rgba(229, 237, 248, 0.08)';
    ctx.lineWidth = 2;
    this.strokePath(ctx, points, 6);

    ctx.strokeStyle = 'rgba(240, 192, 64, 0.42)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 14]);
    ctx.lineDashOffset = this.reduceMotion ? 0 : -(time * 28);
    this.strokePath(ctx, points, 10);
    ctx.setLineDash([]);
    ctx.restore();
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

  /** Tracto con tándem de dos contenedores (20+20). */
  private drawTractorDoubleContainer(
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

    const cw = s * 2.28;
    const ch = s * 1.38;
    const gap = s * 0.14;
    const hitch = s * 0.42;
    const rearX = -(cw * 2 + gap + hitch);
    const frontX = rearX + cw + gap;

    this.drawContainerBox(ctx, rearX, -s * 0.12, cw, ch, '#2f4560');
    this.drawContainerBox(ctx, frontX, -s * 0.12, cw, ch, '#355070');

    ctx.fillStyle = '#1a222c';
    ctx.fillRect(frontX - gap - s * 0.06, -s * 0.28, gap + s * 0.1, s * 0.14);
    ctx.fillStyle = 'rgba(229, 237, 248, 0.14)';
    ctx.fillRect(frontX - gap * 0.5 - s * 0.04, -s * 0.22, s * 0.08, s * 0.06);

    this.drawTractorCab(ctx, s);
    this.drawTruckTaillights(ctx, rearX - s * 0.04, s);
    this.drawTruckWheels(ctx, s, time, [
      -s * 3.95,
      -s * 3.05,
      -s * 2.15,
      -s * 1.35,
      -s * 0.58,
      s * 0.48,
    ]);

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
    fill = '#355070',
  ): void {
    const top = bottomY - h;
    ctx.fillStyle = fill;
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
