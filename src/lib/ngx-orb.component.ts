import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  Input,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import {CommonModule, isPlatformBrowser} from '@angular/common';

import {Mesh, OGLRenderingContext, Program, Renderer, Triangle, Vec3} from 'ogl';

@Component({
  selector: 'om-orb',
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./ngx-orb.component.html",
  styleUrl: './ngx-orb.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgxOrbComponent implements AfterViewInit, OnDestroy {
  @ViewChild('OmOrb') containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('OmOrbCanvas') canvasWrapperRef!: ElementRef<HTMLDivElement>;

  @Input() set hue(v: number) {
    this.hueSignal.set(v);
    if (this.initialized) this.updateUniform('hue', v);
  }

  @Input() set hoverIntensity(v: number) {
    this.hoverIntensitySignal.set(v);
    if (this.initialized) this.updateUniform('hoverIntensity', v);
  }

  @Input() set rotateOnHover(v: boolean) {
    this.rotateOnHoverSignal.set(v);
  }

  @Input() set forceHoverState(v: boolean) {
    this.forceHoverStateSignal.set(v);
  }

  hueSignal = signal(0);
  hoverIntensitySignal = signal(0.2);
  rotateOnHoverSignal = signal(true);
  forceHoverStateSignal = signal(false);

  private renderer: any;
  private gl?: OGLRenderingContext;
  private program?: Program;
  private mesh?: Mesh;
  private rafId?: number;
  private initialized = false;
  private lastTime = 0;
  private targetHover = 0;
  private currentRot = 0;
  private running = true;
  private intersectionObserver?: IntersectionObserver;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.setupOGL();
    this.observeInView();
  }

  ngOnDestroy() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.intersectionObserver) this.intersectionObserver.disconnect();
    if (this.gl?.canvas && this.canvasWrapperRef.nativeElement.contains(this.gl.canvas)) {
      this.canvasWrapperRef.nativeElement.removeChild(this.gl.canvas);
    }
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
    window.removeEventListener('resize', this.resizeHandler);
    this.containerRef.nativeElement.removeEventListener('mousemove', this.handleMouseMove);
    this.containerRef.nativeElement.removeEventListener('mouseleave', this.handleMouseLeave);
  }

  private observeInView() {
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.running = entry.isIntersecting;
      if (this.running) this.rafId = requestAnimationFrame(this.update);
    });
    this.intersectionObserver.observe(this.containerRef.nativeElement);
  }

  private setupOGL() {
    const vert = `precision highp float; attribute vec2 position; attribute vec2 uv; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

    // (Use your full fragment shader code here)
    const frag = `
      precision highp float;
      uniform float iTime;
      uniform vec3 iResolution;
      uniform float hue;
      uniform float hover;
      uniform float rot;
      uniform float hoverIntensity;
      varying vec2 vUv;

      vec3 rgb2yiq(vec3 c) {
        float y = dot(c, vec3(0.299, 0.587, 0.114));
        float i = dot(c, vec3(0.596, -0.274, -0.322));
        float q = dot(c, vec3(0.211, -0.523, 0.312));
        return vec3(y, i, q);
      }

      vec3 yiq2rgb(vec3 c) {
        float r = c.x + 0.956 * c.y + 0.621 * c.z;
        float g = c.x - 0.272 * c.y - 0.647 * c.z;
        float b = c.x - 1.106 * c.y + 1.703 * c.z;
        return vec3(r, g, b);
      }

      vec3 adjustHue(vec3 color, float hueDeg) {
        float hueRad = hueDeg * 3.14159265 / 180.0;
        vec3 yiq = rgb2yiq(color);
        float cosA = cos(hueRad);
        float sinA = sin(hueRad);
        float i = yiq.y * cosA - yiq.z * sinA;
        float q = yiq.y * sinA + yiq.z * cosA;
        yiq.y = i;
        yiq.z = q;
        return yiq2rgb(yiq);
      }

      vec3 hash33(vec3 p3) {
        p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
        p3 += dot(p3, p3.yxz + 19.19);
        return -1.0 + 2.0 * fract(vec3(
          p3.x + p3.y,
          p3.x + p3.z,
          p3.y + p3.z
        ) * p3.zyx);
      }

      float snoise3(vec3 p) {
        const float K1 = 0.333333333;
        const float K2 = 0.166666667;
        vec3 i = floor(p + (p.x + p.y + p.z) * K1);
        vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
        vec3 e = step(vec3(0.0), d0 - d0.yzx);
        vec3 i1 = e * (1.0 - e.zxy);
        vec3 i2 = 1.0 - e.zxy * (1.0 - e);
        vec3 d1 = d0 - (i1 - K2);
        vec3 d2 = d0 - (i2 - K1);
        vec3 d3 = d0 - 0.5;
        vec4 h = max(0.6 - vec4(
          dot(d0, d0),
          dot(d1, d1),
          dot(d2, d2),
          dot(d3, d3)
        ), 0.0);

        vec4 n = h * h * h * h * vec4(
          dot(d0, hash33(i)),
          dot(d1, hash33(i + i1)),
          dot(d2, hash33(i + i2)),
          dot(d3, hash33(i + 1.0))
        );

        return dot(vec4(31.316), n);
      }

      vec4 extractAlpha(vec3 colorIn) {
        float a = max(max(colorIn.r, colorIn.g), colorIn.b);
        return vec4(colorIn.rgb / (a + 1e-5), a);
      }

      const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
      const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
      const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
      const float innerRadius = 0.6;
      const float noiseScale = 0.65;

      float light1(float intensity, float attenuation, float dist) {
        return intensity / (1.0 + dist * attenuation);
      }
      float light2(float intensity, float attenuation, float dist) {
        return intensity / (1.0 + dist * dist * attenuation);
      }

      vec4 draw(vec2 uv) {
        vec3 color1 = adjustHue(baseColor1, hue);
        vec3 color2 = adjustHue(baseColor2, hue);
        vec3 color3 = adjustHue(baseColor3, hue);

        float ang = atan(uv.y, uv.x);
        float len = length(uv);
        float invLen = len > 0.0 ? 1.0 / len : 0.0;

        float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
        float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
        float d0 = distance(uv, (r0 * invLen) * uv);
        float v0 = light1(1.0, 10.0, d0);
        v0 *= smoothstep(r0 * 1.05, r0, len);
        float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

        float a = iTime * -1.0;
        vec2 pos = vec2(cos(a), sin(a)) * r0;
        float d = distance(uv, pos);
        float v1 = light2(1.5, 5.0, d);
        v1 *= light1(1.0, 50.0, d0);

        float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
        float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

        vec3 col = mix(color1, color2, cl);
        col = mix(color3, col, v0);
        col = (col + v1) * v2 * v3;
        col = clamp(col, 0.0, 1.0);

        return extractAlpha(col);
      }

      vec4 mainImage(vec2 fragCoord) {
        vec2 center = iResolution.xy * 0.5;
        float size = min(iResolution.x, iResolution.y);
        vec2 uv = (fragCoord - center) / size * 2.0;

        float angle = rot;
        float s = sin(angle);
        float c = cos(angle);
        uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

        uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
        uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

        return draw(uv);
      }

      void main() {
        vec2 fragCoord = vUv * iResolution.xy;
        vec4 col = mainImage(fragCoord);
        gl_FragColor = vec4(col.rgb * col.a, col.a);
      }
    `;

    this.renderer = new Renderer({alpha: true, premultipliedAlpha: false});
    this.gl = this.renderer.gl;

    if (!this.gl) {
      return;
    }

    this.gl.clearColor(0, 0, 0, 0);
    this.canvasWrapperRef.nativeElement.appendChild(this.gl.canvas);

    const geometry = new Triangle(this.gl);
    this.program = new Program(this.gl, {
      vertex: vert,
      fragment: frag,
      uniforms: {
        iTime: {value: 0},
        iResolution: {value: new Vec3(this.gl.canvas.width, this.gl.canvas.height, this.gl.canvas.width / this.gl.canvas.height)},
        hue: {value: this.hueSignal()},
        hover: {value: 0},
        rot: {value: 0},
        hoverIntensity: {value: this.hoverIntensitySignal()},
      },
    });
    this.mesh = new Mesh(this.gl, {geometry, program: this.program});

    window.addEventListener('resize', this.resizeHandler);
    this.containerRef.nativeElement.addEventListener('mousemove', this.handleMouseMove);
    this.containerRef.nativeElement.addEventListener('mouseleave', this.handleMouseLeave);
    this.resizeHandler();

    this.initialized = true;
    this.rafId = requestAnimationFrame(this.update);
  }

  private resizeHandler = () => {
    if (!this.canvasWrapperRef.nativeElement) return;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvasWrapperRef.nativeElement.clientWidth;
    const height = this.canvasWrapperRef.nativeElement.clientHeight;
    this.renderer.setSize(width * dpr, height * dpr);
    this.gl!.canvas.style.width = width + "px";
    this.gl!.canvas.style.height = height + "px";
    this.program!.uniforms['iResolution'].value.set(this.gl!.canvas.width, this.gl!.canvas.height, this.gl!.canvas.width / this.gl!.canvas.height);
  };

  private handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvasWrapperRef.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    const size = Math.min(width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const uvX = ((x - centerX) / size) * 2.0;
    const uvY = ((y - centerY) / size) * 2.0;
    this.targetHover = Math.sqrt(uvX * uvX + uvY * uvY) < 0.8 ? 1 : 0;
  };

  private handleMouseLeave = () => {
    this.targetHover = 0;
  };

  private updateUniform(key: string, value: any) {
    if (this.program && this.program.uniforms && key in this.program.uniforms) {
      this.program.uniforms[key].value = value;
    }
  }

  private update = (t: number) => {
    if (!this.running || !this.program) return;
    const dt = (t - this.lastTime) * 0.001;
    this.lastTime = t;

    const hue = this.hueSignal();
    const hoverIntensity = this.hoverIntensitySignal();
    const rotateOnHover = this.rotateOnHoverSignal();
    const forceHoverState = this.forceHoverStateSignal();

    this.program.uniforms['iTime'].value = t * 0.001;
    this.program.uniforms['hue'].value = hue;
    this.program.uniforms['hoverIntensity'].value = hoverIntensity;

    const effectiveHover = forceHoverState ? 1 : this.targetHover;
    this.program.uniforms['hover'].value += (effectiveHover - this.program.uniforms['hover'].value) * 0.1;

    if (rotateOnHover && effectiveHover > 0.5) {
      this.currentRot += dt * 0.3;
    }
    this.program.uniforms['rot'].value = this.currentRot;

    this.renderer.render({scene: this.mesh});
    this.rafId = requestAnimationFrame(this.update);
  };
}
