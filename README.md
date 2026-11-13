# Read Me by Jack — 3D WebGL Studio Experience

<p align="center">
  <img src="public/favicon.jpg" alt="JACKFX Studio Logo" width="100" style="border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);" />
</p>

<p align="center">
  <strong>A high-performance, studio-grade 3D interactive editorial experience for the personal release announcement of <em>Read Me by Jack</em>.</strong>
</p>

<p align="center">
  <a href="https://github.com/LanKuzuMK/read-me-by-jack"><img src="https://img.shields.io/badge/Three.js-r187-000000?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" /></a>
  <a href="https://vite.dev"><img src="https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://greensock.com/gsap/"><img src="https://img.shields.io/badge/GSAP-3.15-88CE02?style=for-the-badge&logo=greensock&logoColor=white" alt="GSAP" /></a>
  <a href="https://github.com/darkroomengineering/lenis"><img src="https://img.shields.io/badge/Lenis-Smooth_Scroll-black?style=for-the-badge" alt="Lenis" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Display-120Hz_%2F_144Hz_Locked-38bdf8?style=for-the-badge" alt="High Refresh Rate" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Audio-Web_Audio_Synth-818cf8?style=for-the-badge" alt="Web Audio" /></a>
</p>

---

## 🌟 Overview & Heritage

Inspired by the authentic release post by **JACKFX** for the educational app **Read Me by Jack**, this project reimagines traditional blog publication as a tactile, cinematic 3D desk environment. As you scroll, the camera sweeps smoothly across five choreographed chapters, interacting with physically grounded 3D objects that reflect the tools of thought, writing, and design.

- **App Built Date:** February 10, 2022
- **Post Publication Date:** February 15, 2023
- **Author:** JACKFX ([Facebook](https://www.facebook.com/jackurgodking) • [Telegram](https://t.me/TianyiXiong) • [GitHub](https://github.com/))
- **Original Source:** [bbbjackthegod.wordpress.com](https://bbbjackthegod.wordpress.com/2023/02/15/read-me-by-jack/)
- **Download Package:** [Google Drive APK Archive](https://drive.google.com/file/d/1iZ2auLwjii-Xx6qsM7pjB4lRCV5AUq62/view?usp=drivesdk)

---

## 💎 Key Highlights & Physical Craft

### 1. Hardcover Notebook & Dynamic Handwriting
- **Linen Binding:** Procedural book cloth texture with custom normal and bump mapping.
- **Stratified Paper Edge:** High-contrast edge slice lines capturing individual page boundaries.
- **6-Leaf Fanned Foliage:** Individual curved page geometries responding to scroll air resistance.
- **Interactive Page Flip:** Click on the book in inspect mode to flip through individual pages with synthesized paper rustle sound effects.
- **Live Fountain Pen Signature:** Dynamic handwriting animation that fluidly writes **"Jack VFX"** in cursive calligraphy across the right folio as you scroll into the notebook.
- **Raised Metallic Index Blocks:** `J · A · C · K` extruded letter blocks resting along the lower cover.

### 2. Studio Ceramic Mug & Rising Steam
- **Lathe Geometry:** Double-walled ceramic mug with authentic rim thickness, interior cavity, and specular glaze.
- **Dark Roast Liquid:** Reflective meniscus with realistic waterline.
- **Dynamic Steam Physics:** 35 rising particle vortex points drifting upward with delta-time scaled turbulence.
- **Machined Silver Coaster:** Brushed aluminum coaster with subtle lip and realistic contact occlusion shadow.

### 3. Lathe-Turned Precision Fountain Pen
- **Body Construction:** Contoured midnight resin barrel with knurled anodized blue center band.
- **Two-Tone Stainless & Gold Nib:** Detailed ink slit, breather hole, feed curvature, and pocket clip.
- **Grip Section:** Ergonomic tapering polished grip.

### 4. Wireframe Optical Eyewear & Acrylic Plaque
- **Spectacles:** Sterling silver wireframe with contoured nose bridge, hinges, and high-index optical lenses with clearcoat reflections.
- **Read Me Plaque:** Machined silver base holding a frosted acrylic slab positioned in the foreground right of the pen tip without blocking text or viewport edges.

---

## ⚡ 120Hz / 144Hz Locked Performance Engineering

Built from the ground up to eliminate micro-stutter and input lag on high-refresh displays:

- **Unified Master Ticker:** GSAP ticker synchronizes Lenis scroll interpolation, ScrollTrigger, and Three.js draw calls into a single sequential RAF loop. No frame-phase beating or camera jitter.
- **Frame-Rate Independent Damping (`THREE.MathUtils.damp`):** Physics, camera positions, pointer parallax, and look-at vectors scale with delta time ($1 - e^{-\lambda \Delta t}$).
- **GPU Transform Acceleration:** Custom halo cursor and scroll progress bars render entirely via `translate3d` and `scaleY` on the compositor thread with zero reflow/repaint costs.
- **Fillrate Protection:** Dynamically clamped pixel ratio (`Math.min(devicePixelRatio, 1.35)`) and 1024×1024 shadow maps preserve a strict sub-6.9ms GPU frame budget on 4K laptops and integrated GPUs.

---

## 🎨 Dual Lighting Architecture (Day & Night Mode)

| Feature | Day Mode | Night Mode |
|---|---|---|
| **Palette** | Glacial light blue & brushed silver | Nocturnal deep navy & icy cobalt |
| **Atmosphere** | Crisp natural daylight window key | Atmospheric dark studio with subtle rim lighting |
| **Lighting Tracking** | Fixed directional sun with soft shadows | Dynamic point lights travelling along the desk spline |
| **Glow & Emissive** | Subtle metallic sheen | Gentle blue fluorite emissive on pen band & plaque |

---

## 🔊 Web Audio Synthesizer (Zero Audio Assets)

All sound effects are generated in real-time in pure mathematical code via the HTML5 Web Audio API:
- **Page Turn:** White-noise buffer filtered through a dynamic bandpass sweep to simulate real paper friction.
- **Ceramic Clink:** Dual damped sine waves (1250 Hz & 3100 Hz) simulating porcelain contact.
- **Pen Click:** High-Q resonant click with rapid exponential decay.
- **Startup Chime:** Harmonic overtone chord greeting the user upon scene load.
- *Includes global audio toggle with persistent state.*

---

## 🛠️ Tech Stack & Architecture

```
read-me-jack-studio/
├── index.html              # Semantic HTML5 layout, 5-chapter markup, SVG iconography
├── package.json            # Vite 8, Three.js 0.187, GSAP 3.15, Lenis 1.3
├── vite.config.js          # Production build configuration with relative assets base
├── public/
│   └── favicon.jpg         # Original JACKFX avatar (192x192)
└── src/
    ├── main.js             # Unified ticker, Lenis smooth scroll, UI event handling
    ├── audio/
    │   └── SoundEngine.js  # Procedural Web Audio API sound generator
    ├── scene/
    │   └── SceneManager.js # Three.js scene, procedural textures, camera spline, lights
    └── styles/
        └── main.css        # Studio design system, frosted glassmorphism, responsive grid
```

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Node.js 18+ (tested on v24)
- npm 9+

### 1. Clone & Install
```bash
git clone https://github.com/LanKuzuMK/read-me-by-jack.git
cd read-me-by-jack
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) to view the scene.

### 3. Production Build
```bash
npm run build
```
Generates production-optimized static assets in `dist/`.

---

## 🌐 Deployment

### Deploy to Vercel (Recommended)
```bash
npx vercel
```
*Zero-config: detects Vite, sets `dist` output, and assigns free HTTPS edge domain instantly.*

### Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy dist
```

---

## 📜 Credits & License

- **Concept & Original Post:** JACKFX ([Read Me announcement](https://bbbjackthegod.wordpress.com/2023/02/15/read-me-by-jack/))
- **3D Design & Engineering:** Created with Three.js, GSAP, and Vite.
- **License:** ISC License. Open for educational and showcase use.
