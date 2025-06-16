# ngx-orb

<a href="https://ngxui.com" target="_blank" style="display: flex;gap: .5rem;align-items: center;cursor: pointer; padding: 0 0 0 0; height: fit-content;">
  <img src="https://ngxui.com/assets/img/ngxui-logo.png" style="width: 64px;height: 64px;">
</a>

This library is part of the NGXUI ecosystem. View all available components at [https://ngxui.com](https://ngxui.com)

`@omnedia/ngx-orb` is an Angular standalone component for an **animated, interactive 3D orb** with procedural GLSL shaders (OGL/WebGL). Customizable hue, hover effects, animation, and full signal/zones support.

## Features

* Procedural 3D orb shader using OGL, running on a real WebGL canvas.
* Fully interactive: reacts to hover and mouse movement, with smooth signal-driven animation.
* Customize hue, hover intensity, auto-rotation on hover, forced hover state.
* Standalone Angular 20: SSR-safe, zone-less, signals-based inputs.
* Animation is paused automatically when out of view (IntersectionObserver).
* Responsive: resizes to its parent container.
* Proper cleanup: no memory leaks, disposes GL context and events.

## Installation

```sh
npm install @omnedia/ngx-orb ogl
```

> **Note:** Requires `ogl` as a peer dependency.

## Usage

Import the `NgxOrbComponent` in your module/component:

```typescript
import { NgxOrbComponent } from '@omnedia/ngx-orb';

@Component({
  ...
  imports: [NgxOrbComponent],
})
export class DemoComponent {}
```

Use it in your template:

```html
<div style="width: 350px; height: 350px; background: #15181a;">
  <om-orb
    [hue]="210"
    [hoverIntensity]="0.35"
    [rotateOnHover]="true"
    [forceHoverState]="false"
    style="width: 100%; height: 100%; display: block;"
  ></om-orb>
</div>
```

## API

```html
<om-orb
  [hue]="number"                // Hue in degrees (0-360)
  [hoverIntensity]="number"      // 0–1, default: 0.2
  [rotateOnHover]="boolean"      // default: true
  [forceHoverState]="boolean"    // default: false
  [styleClass]="customClass"
>
    <ng-content></ng-content>
</om-orb>
```

* `hue` (default: `0`): Base hue for the orb colors (float, degrees).
* `hoverIntensity` (default: `0.2`): How strongly the orbs hover effect appears.
* `rotateOnHover` (default: `true`): Auto-rotate animation on hover.
* `forceHoverState` (default: `false`): Force hover effect.
* `styleClass` (optional): Add your own CSS class to the host element.

## Styling

* Fills its parent by default—set size via style or CSS.
* All rendering is inside a transparent WebGL canvas. Overlay your own content with CSS if desired.

## Notes

* Animation pauses when component is out of view.
* SSR-safe: DOM access is guarded.
* All inputs are reactive/signals, update instantly.
* Zone-free, standalone Angular 20 component.
* Full disposal on destroy: cleans GL, removes listeners, releases context.

## Contributing

PRs, issues, and feedback welcome!

## License

MIT
