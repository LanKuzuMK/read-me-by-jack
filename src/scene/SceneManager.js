import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class SceneManager {
  constructor(canvas, onReady) {
    this.canvas = canvas;
    this.onReady = onReady;

    this.scrollProgress = 0;
    this.targetScroll = 0;
    this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.burstIntensity = 0;
    this.isNight = false;
    this.nightMix = 0;
    this.clock = new THREE.Clock();

    // Interactive Inspection & Page Physics States
    this.inspectedTarget = null; // 'book' | 'pen' | 'cup' | 'plaque' | null
    this.inspectCamPos = new THREE.Vector3();
    this.inspectLookAt = new THREE.Vector3();
    this.inspectTransition = 0; // 0 (scroll-driven) -> 1 (inspected)

    this.flippedPages = 0; // page turn click counter
    this.pageFlipProgress = [0, 0, 0, 0, 0, 0]; // per-leaf animation values
    this.inkSignProgress = 0; // signature writing on book page (0 -> 1)

    this.initRenderer();
    this.initScene();
    this.initLights();
    this.buildDesk();
    this.buildBook();
    this.buildReadMePlaque();
    this.buildEyewearAndPen();
    this.buildDeskProps();
    this.buildDustParticles();
    this.initCameraCurves();
    this.initScrollGlowLights();
    this.initRaycasting();

    this.isExternallyDriven = false;
    this.bindEvents();

    if (this.onReady) {
      this.onReady();
    }
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    // Calibrated pixel ratio to eliminate GPU fillrate bottlenecks and maintain high refresh rates
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.dayFogColor = new THREE.Color(0xa6c0db);
    this.nightFogColor = new THREE.Color(0x060c18);
    this.scene.fog = new THREE.FogExp2(this.dayFogColor.getHex(), 0.02);

    this.camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0.35, 1.05, 5.2);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Textures & Procedural Maps
    const bookClothMaps = this.createBookClothTextures();
    this.bookClothMap = bookClothMaps.diffuse;
    this.bookClothBump = bookClothMaps.bump;

    // Realistic physical materials in Very Light Blue & Silver
    this.matBrushedSilver = new THREE.MeshStandardMaterial({
      color: 0xd4e1ee,
      metalness: 0.88,
      roughness: 0.22,
      envMapIntensity: 1.25,
    });

    this.matChrome = new THREE.MeshStandardMaterial({
      color: 0xf7fbff,
      metalness: 0.98,
      roughness: 0.06,
      envMapIntensity: 1.45,
    });

    this.matGoldAccent = new THREE.MeshStandardMaterial({
      color: 0xe8c772,
      metalness: 0.9,
      roughness: 0.18,
      envMapIntensity: 1.3,
    });

    this.matPenResin = new THREE.MeshPhysicalMaterial({
      color: 0x1a2638,
      metalness: 0.15,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.85,
      envMapIntensity: 1.35,
    });

    this.matAnodizedBlue = new THREE.MeshStandardMaterial({
      color: 0x89bce8,
      metalness: 0.62,
      roughness: 0.32,
      emissive: new THREE.Color(0x3a8ee6),
      emissiveIntensity: 0.04,
    });

    this.matBookCloth = new THREE.MeshStandardMaterial({
      map: this.bookClothMap,
      bumpMap: this.bookClothBump,
      bumpScale: 0.008,
      color: 0xa4bad1,
      metalness: 0.14,
      roughness: 0.68,
      envMapIntensity: 0.65,
    });

    this.matOpticalGlass = new THREE.MeshPhysicalMaterial({
      color: 0xe8f4ff,
      metalness: 0.1,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.35,
      reflectivity: 0.95,
      envMapIntensity: 1.5,
    });

    this.matCeramic = new THREE.MeshPhysicalMaterial({
      color: 0xf4f8fd,
      metalness: 0.04,
      roughness: 0.16,
      clearcoat: 0.92,
      clearcoatRoughness: 0.1,
      reflectivity: 0.88,
      envMapIntensity: 1.2,
    });
  }

  createBookClothTextures() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#b6cadc';
    ctx.fillRect(0, 0, size, size);

    // Fine woven bookbinder linen texture
    for (let x = 0; x < size; x += 4) {
      ctx.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(70,95,125,0.14)';
      ctx.fillRect(x, 0, 2, size);
    }
    for (let y = 0; y < size; y += 4) {
      ctx.fillStyle = y % 8 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(70,95,125,0.12)';
      ctx.fillRect(0, y, size, 2);
    }

    const diffuse = new THREE.CanvasTexture(c);
    diffuse.wrapS = THREE.RepeatWrapping;
    diffuse.wrapT = THREE.RepeatWrapping;
    diffuse.repeat.set(4, 4);

    // Bump map for tactile woven depth
    const bumpC = document.createElement('canvas');
    bumpC.width = 256;
    bumpC.height = 256;
    const bCtx = bumpC.getContext('2d');
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 4) {
      for (let y = 0; y < 256; y += 4) {
        const val = ((x + y) % 8 === 0) ? '#999999' : '#666666';
        bCtx.fillStyle = val;
        bCtx.fillRect(x, y, 2, 2);
      }
    }
    const bump = new THREE.CanvasTexture(bumpC);
    bump.wrapS = THREE.RepeatWrapping;
    bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.set(8, 8);

    return { diffuse, bump };
  }

  initLights() {
    this.hemiLight = new THREE.HemisphereLight(0xf7fbff, 0x9fb6cf, 1.05);
    this.scene.add(this.hemiLight);

    // Studio window key light casting real shadows onto the desk
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.85);
    this.keyLight.position.set(4.8, 7.5, 4.5);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 22;
    this.keyLight.shadow.camera.left = -6;
    this.keyLight.shadow.camera.right = 6;
    this.keyLight.shadow.camera.top = 6;
    this.keyLight.shadow.camera.bottom = -6;
    this.keyLight.shadow.bias = -0.0004;
    this.scene.add(this.keyLight);

    this.iceRim = new THREE.DirectionalLight(0x93c5fd, 1.15);
    this.iceRim.position.set(-5.5, 3.0, -4.5);
    this.scene.add(this.iceRim);
  }

  createDeskTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#d8e6f4';
    ctx.fillRect(0, 0, size, size);

    // Subtle matte stone/linen micro-grain
    for (let i = 0; i < 16000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const v = Math.random() > 0.5 ? 'rgba(255,255,255,0.16)' : 'rgba(130,156,184,0.12)';
      ctx.fillStyle = v;
      ctx.fillRect(x, y, 1.5, 1.5);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildDesk() {
    const deskTex = this.createDeskTexture();
    this.deskMat = new THREE.MeshStandardMaterial({
      map: deskTex,
      color: 0x8da6c2,
      metalness: 0.34,
      roughness: 0.38,
      envMapIntensity: 1.1,
    });

    const deskGeo = new THREE.PlaneGeometry(34, 26);
    deskGeo.rotateX(-Math.PI / 2);
    this.deskMesh = new THREE.Mesh(deskGeo, this.deskMat);
    this.deskMesh.position.set(0, -1.45, -1.0);
    this.deskMesh.receiveShadow = true;
    this.scene.add(this.deskMesh);
  }

  createPrintedPageTexture(isRight) {
    const w = 512;
    const h = 640;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');

    // Warm-cool off-white cotton paper
    const grad = ctx.createLinearGradient(isRight ? 0 : w, 0, isRight ? w : 0, 0);
    grad.addColorStop(0, '#c8d8e8'); // Deep spine gutter shadow
    grad.addColorStop(0.08, '#e2edf7');
    grad.addColorStop(0.2, '#f8fbff');
    grad.addColorStop(0.88, '#f4f8fc');
    grad.addColorStop(0.98, '#dce6f2'); // Natural outer rim falloff
    grad.addColorStop(1, '#c2d2e2');    // Crisp paper edge boundary line
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine dark edge slice outline on top and bottom cuts (matching hand-drawn ink art)
    ctx.fillStyle = 'rgba(64, 88, 116, 0.75)';
    ctx.fillRect(0, 0, w, 2);
    ctx.fillRect(0, h - 2, w, 2);
    if (isRight) {
      ctx.fillRect(w - 3, 0, 3, h);
    } else {
      ctx.fillRect(0, 0, 3, h);
    }

    // Subtle printed book lines & header
    ctx.fillStyle = 'rgba(50, 75, 102, 0.45)';
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText(isRight ? 'Read Me — Edition 01' : 'JACKFX Notes', 52, 54);

    ctx.fillStyle = 'rgba(58, 78, 102, 0.28)';
    for (let y = 96; y < 560; y += 24) {
      const lineW = y % 120 === 0 ? 280 : 380 + ((y * 7) % 35);
      ctx.fillRect(52, y, lineW, 3);
    }

    ctx.fillStyle = 'rgba(50, 75, 102, 0.5)';
    ctx.font = '14px monospace';
    ctx.fillText(isRight ? '02' : '01', isRight ? w - 68 : 52, h - 36);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  updateRightPageTexture(progress) {
    const w = 512;
    const h = 640;
    const ctx = this.rightPageCtx;
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#c8d8e8');
    grad.addColorStop(0.08, '#e2edf7');
    grad.addColorStop(0.2, '#f8fbff');
    grad.addColorStop(0.88, '#f4f8fc');
    grad.addColorStop(0.98, '#dce6f2');
    grad.addColorStop(1, '#c2d2e2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fine dark edge slice outline
    ctx.fillStyle = 'rgba(64, 88, 116, 0.75)';
    ctx.fillRect(0, 0, w, 2);
    ctx.fillRect(0, h - 2, w, 2);
    ctx.fillRect(w - 3, 0, 3, h);

    // Printed header & book text lines
    ctx.fillStyle = 'rgba(50, 75, 102, 0.45)';
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText('Read Me — Edition 01', 52, 54);

    ctx.fillStyle = 'rgba(58, 78, 102, 0.28)';
    for (let y = 96; y < 440; y += 24) {
      const lineW = y % 120 === 0 ? 280 : 380 + ((y * 7) % 35);
      ctx.fillRect(52, y, lineW, 3);
    }

    // Dynamic Fountain Pen Handwritten Calligraphy: "Jack VFX" with elegant underline flourish
    if (progress > 0.04) {
      ctx.save();
      
      // Progressive reveal clip as user scrolls through the desk
      const revealProgress = Math.min(1, Math.max(0, (progress - 0.04) / 0.85));
      const revealW = 55 + (w - 75) * revealProgress;
      ctx.beginPath();
      ctx.rect(0, 455, revealW, 160);
      ctx.clip();

      // Fluid calligraphic signature: "Jack VFX"
      ctx.fillStyle = '#142c4c';
      ctx.strokeStyle = '#142c4c';
      ctx.font = 'italic 700 46px "Caveat", "Segoe Script", "Brush Script MT", cursive';
      ctx.fillText('Jack VFX', 72, 526);

      // Sweeping calligraphic flourish underline
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(62, 542);
      ctx.bezierCurveTo(120, 548, 200, 536, 275, 528);
      ctx.stroke();

      // Delicate return flourish tail
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(275, 528);
      ctx.bezierCurveTo(240, 538, 170, 554, 98, 552);
      ctx.stroke();

      ctx.restore();
    }

    ctx.fillStyle = 'rgba(50, 75, 102, 0.5)';
    ctx.font = '14px monospace';
    ctx.fillText('02', w - 68, h - 36);

    if (this.rightPageTex) {
      this.rightPageTex.needsUpdate = true;
    }
  }

  createPageEdgeTexture(sideSign) {
    const w = 512;
    const h = 256;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');

    // High-resolution multi-line page edge grain
    ctx.fillStyle = '#ebf2f8';
    ctx.fillRect(0, 0, w, h);

    // Deep ink slice lines along the outer rim edges (matching hand-drawn illustration style)
    for (let y = 0; y < h; y += 3) {
      const isHeavy = (y % 12 === 0);
      const isMedium = (y % 6 === 0);
      ctx.fillStyle = isHeavy ? 'rgba(75, 100, 130, 0.95)' :
                      isMedium ? 'rgba(105, 132, 162, 0.85)' :
                      'rgba(175, 196, 218, 0.65)';
      ctx.fillRect(0, y, w, isHeavy ? 2 : 1);
    }

    // Outer corner aging / shadow gradient
    const edgeGrad = ctx.createLinearGradient(0, 0, w, 0);
    if (sideSign < 0) {
      edgeGrad.addColorStop(0, 'rgba(80, 108, 138, 0.65)');
      edgeGrad.addColorStop(0.25, 'rgba(180, 204, 226, 0.2)');
      edgeGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    } else {
      edgeGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      edgeGrad.addColorStop(0.75, 'rgba(180, 204, 226, 0.2)');
      edgeGrad.addColorStop(1, 'rgba(80, 108, 138, 0.65)');
    }
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(0, 0, w, h);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  createLetterTexture(letter) {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.6, '#e1edf9');
    grad.addColorStop(1, '#bfd2e6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(110, 140, 174, 0.65)';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, size - 20, size - 20);

    ctx.fillStyle = '#182436';
    ctx.font = '700 132px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, size / 2, size / 2 + 8);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  createPageGeometry(width, depth, archHeight, sideSign) {
    const geom = new THREE.PlaneGeometry(width, depth, 24, 6);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const localX = x + (sideSign * width) / 2;
      const t = Math.abs(localX) / width;
      const y = Math.sin(t * Math.PI) * archHeight + t * 0.02;
      pos.setX(i, localX);
      pos.setY(i, y);
    }
    geom.computeVertexNormals();
    return geom;
  }

  createBookContactShadow() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    // Oval gradient contact shadow for ambient occlusion under book
    const grad = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size / 2 - 20);
    grad.addColorStop(0, 'rgba(15, 26, 42, 0.75)');
    grad.addColorStop(0.5, 'rgba(25, 42, 65, 0.35)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), mat);
    shadowMesh.rotateX(-Math.PI / 2);
    shadowMesh.position.set(0, -0.42, 0);
    return shadowMesh;
  }

  buildBook() {
    this.bookGroup = new THREE.Group();
    // Resting realistically on a brushed-silver book stand / desk
    this.bookGroup.position.set(0.25, -0.98, -0.45);
    this.bookGroup.rotation.set(0.18, -0.26, 0.02);

    // Ambient occlusion contact shadow plane beneath the book
    const contactShadow = this.createBookContactShadow();
    this.bookGroup.add(contactShadow);

    // Hardcover boards with bevelled corner extrusion
    const createCover = (sideSign) => {
      const coverShape = new THREE.Shape();
      const w = 1.62;
      const h = 2.04;
      const r = 0.025; // rounded outer corner
      coverShape.moveTo(-w / 2, -h / 2);
      coverShape.lineTo(w / 2 - r, -h / 2);
      coverShape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      coverShape.lineTo(w / 2, h / 2 - r);
      coverShape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      coverShape.lineTo(-w / 2, h / 2);
      coverShape.closePath();

      const geo = new THREE.ExtrudeGeometry(coverShape, {
        depth: 0.045,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 3,
      });
      geo.rotateX(-Math.PI / 2);

      const mesh = new THREE.Mesh(geo, this.matBookCloth);
      mesh.position.set(sideSign * 0.85, -0.06, 0);
      mesh.rotation.z = sideSign * 0.06;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    const leftCover = createCover(-1);
    const rightCover = createCover(1);

    // Rounded cloth spine with embossed silver ribs
    const spineGroup = new THREE.Group();
    const spineGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.06, 24, 1, false, -Math.PI / 2, Math.PI);
    spineGeo.rotateX(Math.PI / 2);
    const spine = new THREE.Mesh(spineGeo, this.matBookCloth);
    spine.position.set(0, -0.1, 0);
    spine.castShadow = true;
    spineGroup.add(spine);

    // Raised decorative spine ribs (headband & tailband details)
    for (let r = -0.8; r <= 0.8; r += 0.4) {
      const ribGeo = new THREE.TorusGeometry(0.092, 0.008, 8, 24, Math.PI);
      ribGeo.rotateY(Math.PI / 2);
      ribGeo.rotateZ(Math.PI / 2);
      const rib = new THREE.Mesh(ribGeo, this.matBrushedSilver);
      rib.position.set(0, -0.1, r);
      spineGroup.add(rib);
    }

    // Realistic Multi-Layered Paper Block with visible page edges & strata
    const leftEdgeTex = this.createPageEdgeTexture(-1);
    const rightEdgeTex = this.createPageEdgeTexture(1);

    const makePageBlockMaterials = (isRight) => {
      const edgeTex = isRight ? rightEdgeTex : leftEdgeTex;
      const edgeMat = new THREE.MeshStandardMaterial({
        map: edgeTex,
        roughness: 0.85,
        metalness: 0.02,
      });
      const paperFaceMat = new THREE.MeshStandardMaterial({
        color: 0xf3f7fc,
        roughness: 0.75,
        metalness: 0.02,
      });
      // Order: +X, -X, +Y, -Y, +Z, -Z
      return [
        edgeMat,
        edgeMat,
        paperFaceMat,
        paperFaceMat,
        edgeMat,
        edgeMat,
      ];
    };

    const blockL = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.16, 1.94), makePageBlockMaterials(false));
    blockL.position.set(-0.78, 0.04, 0);
    blockL.rotation.z = -0.06;
    blockL.castShadow = true;
    blockL.receiveShadow = true;

    const blockR = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.16, 1.94), makePageBlockMaterials(true));
    blockR.position.set(0.78, 0.04, 0);
    blockR.rotation.z = 0.06;
    blockR.castShadow = true;
    blockR.receiveShadow = true;

    this.bookGroup.add(leftCover, rightCover, spineGroup, blockL, blockR);

    // Top printed curved individual leaves (6 distinct fanned leaves with delicate edge shadows)
    const leftPageMat = new THREE.MeshStandardMaterial({
      map: this.createPrintedPageTexture(false),
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    this.rightPageCanvas = document.createElement('canvas');
    this.rightPageCanvas.width = 512;
    this.rightPageCanvas.height = 640;
    this.rightPageCtx = this.rightPageCanvas.getContext('2d');
    this.updateRightPageTexture(0); // initial render without signature
    this.rightPageTex = new THREE.CanvasTexture(this.rightPageCanvas);
    this.rightPageTex.colorSpace = THREE.SRGBColorSpace;
    this.rightPageTex.anisotropy = 4;

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        this.updateRightPageTexture(this.inkSignProgress);
      });
    }

    const rightPageMat = new THREE.MeshStandardMaterial({
      map: this.rightPageTex,
      roughness: 0.72,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    this.pageMeshes = [];
    const leafCount = 6;
    for (let i = 0; i < leafCount; i++) {
      const ratio = i / (leafCount - 1);
      const arch = 0.10 + ratio * 0.14;
      const yOff = 0.125 + i * 0.016;

      const lGeo = this.createPageGeometry(1.46, 1.90, arch, -1);
      const lPage = new THREE.Mesh(lGeo, leftPageMat);
      lPage.position.set(-0.02, yOff, 0);
      lPage.rotation.z = -0.04 - ratio * 0.055;
      lPage.castShadow = true;
      lPage.receiveShadow = true;
      lPage.userData = { baseRotZ: lPage.rotation.z, index: i, side: -1 };

      const rGeo = this.createPageGeometry(1.46, 1.90, arch, 1);
      const rPage = new THREE.Mesh(rGeo, rightPageMat);
      rPage.position.set(0.02, yOff, 0);
      rPage.rotation.z = 0.04 + ratio * 0.055;
      rPage.castShadow = true;
      rPage.receiveShadow = true;
      rPage.userData = { baseRotZ: rPage.rotation.z, index: i, side: 1 };

      this.bookGroup.add(lPage, rPage);
      this.pageMeshes.push(lPage, rPage);
    }

    // Silk bookmark ribbon resting out of the spine with metallic angled tip
    const ribbonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.12, 0.2),
      new THREE.Vector3(0.05, 0.06, 0.95),
      new THREE.Vector3(0.18, -0.25, 1.28),
      new THREE.Vector3(0.32, -0.42, 1.55),
    ]);
    const bookmarkGeo = new THREE.TubeGeometry(ribbonCurve, 24, 0.018, 6, false);
    bookmarkGeo.scale(1.8, 0.25, 1);
    const bookmark = new THREE.Mesh(bookmarkGeo, this.matAnodizedBlue);
    bookmark.castShadow = true;
    this.bookGroup.add(bookmark);

    // Raised metallic J-A-C-K index blocks along the lower cover edge
    const letters = ['J', 'A', 'C', 'K'];
    const blockGeo = new THREE.BoxGeometry(0.22, 0.13, 0.22);
    letters.forEach((char, idx) => {
      const tex = this.createLetterTexture(char);
      const faceMat = new THREE.MeshStandardMaterial({
        map: tex,
        metalness: 0.25,
        roughness: 0.24,
      });
      const mats = [
        this.matBrushedSilver,
        this.matBrushedSilver,
        faceMat,
        this.matBrushedSilver,
        faceMat,
        this.matBrushedSilver,
      ];
      const block = new THREE.Mesh(blockGeo, mats);
      block.position.set(-1.18 + idx * 0.26, 0.02, 1.04);
      block.rotation.z = -0.06;
      block.castShadow = true;
      this.bookGroup.add(block);
    });

    this.scene.add(this.bookGroup);
  }

  buildReadMePlaque() {
    this.plaqueGroup = new THREE.Group();
    // Positioned in the open foreground desk space right of the pen, completely clear of the book
    this.plaqueGroup.position.set(1.15, -1.22, 1.35);
    this.plaqueGroup.rotation.set(-0.16, -0.22, 0.0);

    const w = 512;
    const h = 160;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#e3f0fc');
    grad.addColorStop(0.5, '#c6e1fa');
    grad.addColorStop(1, '#dce8f5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.fillStyle = '#172334';
    ctx.font = '600 66px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Read Me', w / 2, h / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    this.plaqueMat = new THREE.MeshPhysicalMaterial({
      map: tex,
      roughness: 0.14,
      metalness: 0.12,
      clearcoat: 0.9,
      emissive: new THREE.Color(0x6bb8ff),
      emissiveIntensity: 0,
    });

    const plaqueSlab = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.56, 0.05),
      [
        this.matChrome,
        this.matChrome,
        this.matChrome,
        this.matChrome,
        this.plaqueMat,
        this.matBrushedSilver,
      ]
    );
    plaqueSlab.castShadow = true;
    plaqueSlab.receiveShadow = true;

    // Machined silver stand base
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.06, 0.34),
      this.matBrushedSilver
    );
    base.position.set(0, -0.3, -0.05);
    base.rotation.x = 0.24;
    base.castShadow = true;
    base.receiveShadow = true;

    this.plaqueGroup.add(plaqueSlab, base);
    this.scene.add(this.plaqueGroup);
  }

  createEyewearFrameShape(w, h, r) {
    const outer = new THREE.Shape();
    outer.moveTo(-w / 2 + r, -h / 2);
    outer.lineTo(w / 2 - r, -h / 2);
    outer.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    outer.lineTo(w / 2, h / 2 - r);
    outer.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    outer.lineTo(-w / 2 + r, h / 2);
    outer.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    outer.lineTo(-w / 2, -h / 2 + r);
    outer.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

    const inset = 0.032;
    const iw = w - inset * 2;
    const ih = h - inset * 2;
    const ir = Math.max(0.01, r - inset * 0.5);

    const hole = new THREE.Path();
    hole.moveTo(-iw / 2 + ir, -ih / 2);
    hole.lineTo(iw / 2 - ir, -ih / 2);
    hole.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + ir);
    hole.lineTo(iw / 2, ih / 2 - ir);
    hole.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - ir, ih / 2);
    hole.lineTo(-iw / 2 + ir, ih / 2);
    hole.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - ir);
    hole.lineTo(-iw / 2, -ih / 2 + ir);
    hole.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + ir, -ih / 2);

    outer.holes.push(hole);
    return outer;
  }

  createNibTexture() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Fine ink slit down the center of the fountain pen nib
    ctx.strokeStyle = '#223348';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size * 0.75);
    ctx.stroke();

    // Circular breather hole
    ctx.fillStyle = '#1c2838';
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.52, 14, 0, Math.PI * 2);
    ctx.fill();

    // Subtle scrollwork engraving
    ctx.strokeStyle = 'rgba(70, 95, 125, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.52, 38, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildEyewearAndPen() {
    this.artifactGroup = new THREE.Group();
    this.artifactGroup.position.set(-1.15, -1.24, 0.95);
    this.artifactGroup.rotation.set(0, 0.34, 0);

    // Real rounded-rectangle Eyeglasses resting on the desk
    const glasses = new THREE.Group();
    const frameShape = this.createEyewearFrameShape(0.46, 0.25, 0.05);
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 3,
    });

    const leftRim = new THREE.Mesh(frameGeo, this.matChrome);
    leftRim.position.set(-0.28, 0.14, 0);
    leftRim.castShadow = true;

    const rightRim = new THREE.Mesh(frameGeo, this.matChrome);
    rightRim.position.set(0.28, 0.14, 0);
    rightRim.castShadow = true;

    const lensGeo = new THREE.PlaneGeometry(0.39, 0.18);
    const leftLens = new THREE.Mesh(lensGeo, this.matOpticalGlass);
    leftLens.position.set(-0.28, 0.14, 0.012);
    const rightLens = new THREE.Mesh(lensGeo, this.matOpticalGlass);
    rightLens.position.set(0.28, 0.14, 0.012);

    // Nose bridge
    const bridgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.06, 0.17, 0.01),
      new THREE.Vector3(0, 0.19, 0.025),
      new THREE.Vector3(0.06, 0.17, 0.01),
    ]);
    const bridge = new THREE.Mesh(
      new THREE.TubeGeometry(bridgeCurve, 12, 0.012, 8, false),
      this.matChrome
    );

    // Curved temple arms resting back onto the desk
    const armL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.51, 0.19, 0.0),
      new THREE.Vector3(-0.53, 0.16, -0.55),
      new THREE.Vector3(-0.48, 0.03, -0.95),
    ]);
    const leftArm = new THREE.Mesh(
      new THREE.TubeGeometry(armL, 16, 0.012, 8, false),
      this.matBrushedSilver
    );
    leftArm.castShadow = true;

    const armR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.51, 0.19, 0.0),
      new THREE.Vector3(0.53, 0.16, -0.55),
      new THREE.Vector3(0.48, 0.03, -0.95),
    ]);
    const rightArm = new THREE.Mesh(
      new THREE.TubeGeometry(armR, 16, 0.012, 8, false),
      this.matBrushedSilver
    );
    rightArm.castShadow = true;

    glasses.add(leftRim, rightRim, leftLens, rightLens, bridge, leftArm, rightArm);
    glasses.position.set(0, -0.05, 0);
    glasses.rotation.x = -0.14;
    this.artifactGroup.add(glasses);

    // High-Detail Lathe-Turned Precision Fountain Pen
    const pen = new THREE.Group();

    // 1. Turned Resin Barrel with threaded step-down
    const barrelPoints = [
      new THREE.Vector2(0.0, 0.0),        // cap-end finial point
      new THREE.Vector2(0.018, 0.02),
      new THREE.Vector2(0.038, 0.15),
      new THREE.Vector2(0.046, 0.45),     // mid barrel swell
      new THREE.Vector2(0.044, 0.78),
      new THREE.Vector2(0.042, 0.92),
      new THREE.Vector2(0.038, 0.94),     // thread step
      new THREE.Vector2(0.038, 0.98),
      new THREE.Vector2(0.0, 0.98),
    ];
    const barrelGeo = new THREE.LatheGeometry(barrelPoints, 32);
    const barrel = new THREE.Mesh(barrelGeo, this.matPenResin);
    barrel.position.y = 0.32;
    barrel.castShadow = true;

    // 2. Anodized Blue Center Band with knurling grooves
    const centerBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.055, 32),
      this.matAnodizedBlue
    );
    centerBand.position.y = 0.30;
    centerBand.castShadow = true;

    // 3. Polished Grip Section tapering towards the nib
    const gripPoints = [
      new THREE.Vector2(0.038, 0.0),
      new THREE.Vector2(0.036, 0.05),
      new THREE.Vector2(0.031, 0.14),
      new THREE.Vector2(0.029, 0.22),
      new THREE.Vector2(0.032, 0.26),     // collar flare
      new THREE.Vector2(0.0, 0.26),
    ];
    const gripGeo = new THREE.LatheGeometry(gripPoints, 32);
    const grip = new THREE.Mesh(gripGeo, this.matBrushedSilver);
    grip.position.y = 0.04;
    grip.castShadow = true;

    // 4. Two-Tone Stainless Steel & Gold Nib with ink slit and breather hole
    const nibShape = new THREE.Shape();
    nibShape.moveTo(-0.022, 0);
    nibShape.lineTo(-0.018, 0.10);
    nibShape.lineTo(0.0, 0.21);          // sharp iridium tip
    nibShape.lineTo(0.018, 0.10);
    nibShape.lineTo(0.022, 0);
    nibShape.closePath();

    const nibGeo = new THREE.ExtrudeGeometry(nibShape, {
      depth: 0.005,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
    });
    const nibMat = new THREE.MeshStandardMaterial({
      map: this.createNibTexture(),
      metalness: 0.94,
      roughness: 0.12,
      envMapIntensity: 1.4,
    });
    const nib = new THREE.Mesh(nibGeo, nibMat);
    nib.rotation.x = Math.PI;
    nib.position.set(0, 0.04, 0.004);
    nib.castShadow = true;

    // 5. Black Ebonite Ink Feed under the nib
    const feed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.008, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.85 })
    );
    feed.position.set(0, -0.03, -0.006);

    // 6. Spring-Tempered Faceted Pocket Clip & Finial Crown
    const clipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.25, 0.045),
      new THREE.Vector3(0, 1.18, 0.062),
      new THREE.Vector3(0, 0.72, 0.054),
      new THREE.Vector3(0, 0.68, 0.046),
    ]);
    const clip = new THREE.Mesh(
      new THREE.TubeGeometry(clipCurve, 16, 0.008, 6, false),
      this.matChrome
    );
    clip.castShadow = true;

    const finialCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.038, 0.04, 24),
      this.matChrome
    );
    finialCrown.position.y = 1.26;
    finialCrown.castShadow = true;

    // 7. Contact shadow directly under the resting pen
    const penShadowMat = new THREE.MeshBasicMaterial({
      color: 0x121e30,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const penShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 1.35), penShadowMat);
    penShadow.rotateX(-Math.PI / 2);
    penShadow.position.set(0, -0.042, 0.6);

    pen.add(barrel, centerBand, grip, nib, feed, clip, finialCrown, penShadow);
    pen.position.set(0.65, -0.16, 0.32);
    pen.rotation.set(Math.PI / 2, 0.02, -0.45);
    this.artifactGroup.add(pen);

    this.scene.add(this.artifactGroup);
  }

  createMugOcclusionTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    const grad = ctx.createRadialGradient(size / 2, size / 2, 28, size / 2, size / 2, size / 2 - 10);
    grad.addColorStop(0, 'rgba(15, 24, 38, 0.85)');
    grad.addColorStop(0.5, 'rgba(25, 42, 65, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  buildDeskProps() {
    // Highly Realistic Ceramic Studio Mug & Coaster on back-left of desk
    this.propsGroup = new THREE.Group();
    this.propsGroup.position.set(-2.15, -1.44, -1.25);

    // 1. Realistic Lathe Mug Profile with authentic wall thickness & curved base fillet
    const cupProfile = [
      new THREE.Vector2(0.0, 0.0),          // center foot recess
      new THREE.Vector2(0.24, 0.0),
      new THREE.Vector2(0.27, 0.015),       // foot ring
      new THREE.Vector2(0.30, 0.02),
      new THREE.Vector2(0.32, 0.06),        // base fillet
      new THREE.Vector2(0.34, 0.36),        // mid body
      new THREE.Vector2(0.325, 0.70),       // slight upper taper
      new THREE.Vector2(0.315, 0.74),       // rounded rim outer
      new THREE.Vector2(0.295, 0.74),       // rounded rim inner
      new THREE.Vector2(0.285, 0.70),       // inner wall
      new THREE.Vector2(0.295, 0.36),
      new THREE.Vector2(0.275, 0.08),       // inner bottom fillet
      new THREE.Vector2(0.0, 0.08),         // inner base floor
    ];
    const cupGeo = new THREE.LatheGeometry(cupProfile, 48);
    const cup = new THREE.Mesh(cupGeo, this.matCeramic);
    cup.castShadow = true;
    cup.receiveShadow = true;

    // 2. Liquid surface inside the mug (rich dark roast coffee with subtle meniscus reflection)
    const liquidGeo = new THREE.CircleGeometry(0.29, 32);
    liquidGeo.rotateX(-Math.PI / 2);
    const liquidMat = new THREE.MeshStandardMaterial({
      color: 0x18110b,
      roughness: 0.1,
      metalness: 0.15,
      envMapIntensity: 0.85,
    });
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    liquid.position.y = 0.62;

    // 3. Ergonomic Ceramic Handle with smooth attachment fillets
    const handleCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.32, 0.58, 0),
      new THREE.Vector3(0.42, 0.57, 0),
      new THREE.Vector3(0.50, 0.44, 0),
      new THREE.Vector3(0.48, 0.26, 0),
      new THREE.Vector3(0.38, 0.18, 0),
      new THREE.Vector3(0.31, 0.18, 0),
    ]);
    const handleGeo = new THREE.TubeGeometry(handleCurve, 32, 0.028, 14, false);
    // Give handle a subtle elliptical cross-section for realism
    handleGeo.scale(1, 1, 0.75);
    const handle = new THREE.Mesh(handleGeo, this.matCeramic);
    handle.castShadow = true;
    handle.receiveShadow = true;

    // 4. Machined Brushed-Silver Coaster with bevelled lip
    const coasterGeo = new THREE.CylinderGeometry(0.42, 0.44, 0.028, 48);
    const coaster = new THREE.Mesh(coasterGeo, this.matBrushedSilver);
    coaster.position.y = 0.014;
    coaster.receiveShadow = true;
    coaster.castShadow = true;

    // 5. Contact shadow between mug and coaster
    const occTex = this.createMugOcclusionTexture();
    const occMat = new THREE.MeshBasicMaterial({
      map: occTex,
      transparent: true,
      depthWrite: false,
    });
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), occMat);
    contactShadow.rotateX(-Math.PI / 2);
    contactShadow.position.y = 0.03;

    // 6. Volumetric Steam Particles Rising from Fresh Hot Coffee
    const steamCount = 36;
    const steamPos = new Float32Array(steamCount * 3);
    this.steamData = [];
    for (let i = 0; i < steamCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.16;
      steamPos[i * 3] = Math.cos(angle) * r;
      steamPos[i * 3 + 1] = 0.65 + Math.random() * 0.8;
      steamPos[i * 3 + 2] = Math.sin(angle) * r;
      this.steamData.push({
        baseAngle: angle,
        speedY: 0.003 + Math.random() * 0.004,
        swirlSpeed: 0.8 + Math.random() * 1.2,
        seed: Math.random() * Math.PI * 2,
      });
    }

    const steamGeo = new THREE.BufferGeometry();
    steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));
    const steamTex = this.createGlowTexture('rgba(255,255,255,0.75)', 'rgba(215,235,255,0.2)');
    this.steamMat = new THREE.PointsMaterial({
      size: 0.22,
      map: steamTex,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.steamPoints = new THREE.Points(steamGeo, this.steamMat);

    this.propsGroup.add(cup, liquid, handle, coaster, contactShadow, this.steamPoints);
    this.scene.add(this.propsGroup);
  }

  createGlowTexture(innerColor, outerColor) {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(0.35, outerColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  buildDustParticles() {
    // Subtle natural air motes in sunlight / night lamp beam
    const count = 160;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 9;
      positions[i3 + 1] = -1.1 + Math.random() * 4.2;
      positions[i3 + 2] = (Math.random() - 0.5) * 6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const tex = this.createGlowTexture('rgba(255,255,255,0.9)', 'rgba(200,228,255,0.35)');
    this.particleMat = new THREE.PointsMaterial({
      size: 0.055,
      map: tex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geo, this.particleMat);
    this.scene.add(this.particles);
  }

  initCameraCurves() {
    this.cameraCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.15, 1.45, 5.0),   // 0: Hero framing (shifted right so text on left doesn't overlap the book)
      new THREE.Vector3(1.85, 1.55, 2.65),  // 1: Notebook close-up
      new THREE.Vector3(-2.25, 0.2, 2.75),  // 2: Eyewear & fountain pen macro
      new THREE.Vector3(0.2, 0.85, 4.75),   // 3: Full desk showcase
      new THREE.Vector3(0.85, 2.55, 4.2),   // 4: Elevated studio angle
    ]);

    this.targetCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.65, -0.65, -0.15), // Look directly into the book spread
      new THREE.Vector3(0.25, -0.85, -0.45),
      new THREE.Vector3(-0.95, -1.15, 0.8),
      new THREE.Vector3(0.1, -0.85, 0.0),
      new THREE.Vector3(0.0, -0.95, -0.3),
    ]);

    this.currentLookAt = new THREE.Vector3(0.65, -0.65, -0.15);
  }

  initScrollGlowLights() {
    // Moving night-mode desk lamp lights & soft volumetric glow that travel with scroll
    this.lightCurvePrimary = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.2, 1.1, 1.8),
      new THREE.Vector3(1.8, 0.9, 1.1),
      new THREE.Vector3(-1.8, 0.2, 1.9),
      new THREE.Vector3(1.5, 0.6, 1.8),
      new THREE.Vector3(0.0, 1.8, 1.2),
    ]);

    this.lightCurveSecondary = new THREE.CatmullRomCurve3([
      new THREE.Vector3(2.2, 0.4, 0.9),
      new THREE.Vector3(-1.8, 0.8, -1.2),
      new THREE.Vector3(1.1, 0.3, 1.5),
      new THREE.Vector3(-2.0, 1.0, 1.2),
      new THREE.Vector3(0.4, 0.2, 1.9),
    ]);

    this.scrollLightPrimary = new THREE.PointLight(0x7cc4ff, 0.0, 8, 2.0);
    this.scrollLightSecondary = new THREE.PointLight(0xdbeafe, 0.0, 7, 2.0);
    this.scene.add(this.scrollLightPrimary, this.scrollLightSecondary);

    const glowTexBlue = this.createGlowTexture('rgba(210, 238, 255, 0.95)', 'rgba(90, 175, 255, 0.4)');
    const glowTexSilver = this.createGlowTexture('rgba(255, 255, 255, 0.9)', 'rgba(170, 210, 255, 0.3)');

    this.glowSpritePrimary = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexBlue,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.glowSpritePrimary.scale.set(1.4, 1.4, 1);

    this.glowSpriteSecondary = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexSilver,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.glowSpriteSecondary.scale.set(1.1, 1.1, 1);

    this.scene.add(this.glowSpritePrimary, this.glowSpriteSecondary);
  }

  initRaycasting() {
    this.raycaster = new THREE.Raycaster();
    this.mouseCoords = new THREE.Vector2(-999, -999);

    // Click inspection targets defined with focal offsets and metadata
    this.interactiveTargets = [
      {
        id: 'book',
        title: 'Hardcover Notebook',
        desc: 'Hand-bound linen boards, stratified paper strata, and silk bookmark ribbon.',
        group: this.bookGroup,
        camPos: new THREE.Vector3(1.35, 1.15, 3.2),
        lookAt: new THREE.Vector3(0.55, -0.75, -0.15),
      },
      {
        id: 'pen',
        title: 'Precision Fountain Pen',
        desc: 'Lathe-turned midnight resin barrel, two-tone stainless steel nib, and knurled center ring.',
        group: this.artifactGroup,
        camPos: new THREE.Vector3(-0.35, -0.45, 2.3),
        lookAt: new THREE.Vector3(-0.55, -1.05, 1.25),
      },
      {
        id: 'cup',
        title: 'Ceramic Studio Mug',
        desc: 'Authentic porcelain lathe profile with inner liquid coffee, steam, and silver coaster.',
        group: this.propsGroup,
        camPos: new THREE.Vector3(-1.45, -0.45, 1.4),
        lookAt: new THREE.Vector3(-2.15, -1.15, -1.25),
      },
      {
        id: 'plaque',
        title: 'Read Me Display Plaque',
        desc: 'Frosted acrylic slab with bevelled chamfers and machined silver desk base.',
        group: this.plaqueGroup,
        camPos: new THREE.Vector3(1.65, -0.55, 2.8),
        lookAt: new THREE.Vector3(1.15, -1.15, 1.35),
      },
    ];

    this.onCanvasClick = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.mouseCoords.set(x, y);

      this.raycaster.setFromCamera(this.mouseCoords, this.camera);

      // Check intersections
      let clickedItem = null;
      for (const target of this.interactiveTargets) {
        if (!target.group) continue;
        const hits = this.raycaster.intersectObjects(target.group.children, true);
        if (hits.length > 0) {
          clickedItem = target;
          break;
        }
      }

      if (clickedItem) {
        if (this.inspectedTarget === clickedItem.id) {
          // If already inspecting book, flip a page!
          if (clickedItem.id === 'book') {
            this.flipPage();
          } else {
            this.exitInspection();
          }
        } else {
          this.enterInspection(clickedItem);
        }
      } else if (this.inspectedTarget) {
        this.exitInspection();
      }
    };

    this.canvas.addEventListener('click', this.onCanvasClick);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.inspectedTarget) {
        this.exitInspection();
      }
    });
  }

  enterInspection(item) {
    this.inspectedTarget = item.id;
    this.inspectCamPos.copy(item.camPos);
    this.inspectLookAt.copy(item.lookAt);
    if (this.onInspectChange) {
      this.onInspectChange(item);
    }
    this.triggerBurst();
  }

  exitInspection() {
    this.inspectedTarget = null;
    if (this.onInspectChange) {
      this.onInspectChange(null);
    }
  }

  flipPage() {
    this.flippedPages = (this.flippedPages + 1) % (this.pageMeshes.length / 2 + 1);
    if (this.onPageFlip) {
      this.onPageFlip(this.flippedPages);
    }
    this.triggerBurst();
  }

  setScrollProgress(progress) {
    this.targetScroll = THREE.MathUtils.clamp(progress, 0, 1);
  }

  setPointer(nx, ny) {
    this.pointer.targetX = nx;
    this.pointer.targetY = ny;
  }

  setNightMode(isNight) {
    this.isNight = isNight;
  }

  resetCamera() {
    this.pointer.targetX = 0;
    this.pointer.targetY = 0;
    this.burstIntensity = 0.85;
  }

  triggerBurst() {
    this.burstIntensity = 1.3;
  }

  bindEvents() {
    this.onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this.onResize);
  }

  renderFrame(delta = 0.016, elapsed = 0) {
    const dt = Math.min(delta, 0.05);

    // High-refresh framerate-independent exponential damping (instant response, zero drag lag)
    this.scrollProgress = THREE.MathUtils.damp(this.scrollProgress, this.targetScroll, 14.0, dt);
    this.pointer.x = THREE.MathUtils.damp(this.pointer.x, this.pointer.targetX, 8.5, dt);
    this.pointer.y = THREE.MathUtils.damp(this.pointer.y, this.pointer.targetY, 8.5, dt);
    this.burstIntensity *= Math.pow(0.94, dt * 60);

    const targetNight = this.isNight ? 1 : 0;
    this.nightMix = THREE.MathUtils.damp(this.nightMix, targetNight, 5.5, dt);

    this.scene.fog.color.copy(this.dayFogColor).lerp(this.nightFogColor, this.nightMix);
    this.hemiLight.intensity = THREE.MathUtils.lerp(1.05, 0.25, this.nightMix);
    this.keyLight.intensity = THREE.MathUtils.lerp(1.85, 0.45, this.nightMix);
    this.iceRim.intensity = THREE.MathUtils.lerp(1.15, 1.9, this.nightMix);

    if (this.deskMat) {
      this.deskMat.color.setHex(0x8da6c2).lerp(new THREE.Color(0x0f1a2b), this.nightMix);
    }
    this.matAnodizedBlue.emissiveIntensity = THREE.MathUtils.lerp(0.04, 0.85, this.nightMix);
    if (this.plaqueMat) {
      this.plaqueMat.emissiveIntensity = THREE.MathUtils.lerp(0.0, 0.22, this.nightMix);
    }

    // Move Night Mode Glow & Point Lights simultaneously with scrollProgress
    const p1 = this.lightCurvePrimary.getPointAt(this.scrollProgress);
    const p2 = this.lightCurveSecondary.getPointAt(this.scrollProgress);

    this.scrollLightPrimary.position.set(
      p1.x + Math.sin(elapsed * 1.0) * 0.12,
      p1.y + Math.cos(elapsed * 0.8) * 0.1,
      p1.z
    );
    this.scrollLightSecondary.position.set(
      p2.x + Math.cos(elapsed * 0.8) * 0.12,
      p2.y + Math.sin(elapsed * 1.0) * 0.1,
      p2.z
    );

    // Natural, non-blown-out night lighting and subtle warm-blue glow
    const glowStrength = this.nightMix * (1 + this.burstIntensity * 0.25);
    this.scrollLightPrimary.intensity = 1.35 * glowStrength;
    this.scrollLightSecondary.intensity = 0.95 * glowStrength;

    this.glowSpritePrimary.position.copy(this.scrollLightPrimary.position);
    this.glowSpriteSecondary.position.copy(this.scrollLightSecondary.position);
    this.glowSpritePrimary.material.opacity = 0.28 * this.nightMix;
    this.glowSpriteSecondary.material.opacity = 0.22 * this.nightMix;

    // Camera along spline OR smoothly interpolate to inspected 3D target
    const targetInspect = this.inspectedTarget ? 1 : 0;
    this.inspectTransition = THREE.MathUtils.damp(this.inspectTransition, targetInspect, 8.5, dt);

    const scrollCamPos = this.cameraCurve.getPointAt(this.scrollProgress);
    const scrollLookTarget = this.targetCurve.getPointAt(this.scrollProgress);

    const baseCamPos = new THREE.Vector3().copy(scrollCamPos).lerp(this.inspectCamPos, this.inspectTransition);
    const finalLookTarget = new THREE.Vector3().copy(scrollLookTarget).lerp(this.inspectLookAt, this.inspectTransition);

    this.camera.position.set(
      baseCamPos.x + this.pointer.x * (0.36 * (1 - this.inspectTransition * 0.6)),
      baseCamPos.y - this.pointer.y * (0.22 * (1 - this.inspectTransition * 0.6)),
      baseCamPos.z
    );
    this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, finalLookTarget.x, 12.0, dt);
    this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, finalLookTarget.y, 12.0, dt);
    this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, finalLookTarget.z, 12.0, dt);
    this.camera.lookAt(this.currentLookAt);

    // Dynamic Fountain Pen Signature Writing (unfolds as user scrolls through Hero & Notebook)
    const targetInk = THREE.MathUtils.clamp((this.scrollProgress - 0.04) * 4.5, 0, 1);
    if (Math.abs(targetInk - this.inkSignProgress) > 0.025) {
      this.inkSignProgress = targetInk;
      this.updateRightPageTexture(this.inkSignProgress);
    }

    // Interactive Page Flip Animation on click/inspection
    const halfLeaves = this.pageMeshes.length / 2;
    for (let i = 0; i < halfLeaves; i++) {
      const targetFlip = i < this.flippedPages ? 1 : 0;
      this.pageFlipProgress[i] = THREE.MathUtils.damp(this.pageFlipProgress[i] || 0, targetFlip, 10.0, dt);

      // Animate right page turning over to the left side
      const rPage = this.pageMeshes[i * 2 + 1];
      if (rPage) {
        const { baseRotZ } = rPage.userData;
        const flipAngle = this.pageFlipProgress[i] * (Math.PI * 0.92);
        rPage.rotation.z = baseRotZ - flipAngle;
        rPage.position.y = rPage.userData.index * 0.016 + Math.sin(this.pageFlipProgress[i] * Math.PI) * 0.18;
      }
    }

    // Subtle real-world page air movement on scroll
    this.pageMeshes.forEach((p) => {
      const { baseRotZ, index, side } = p.userData;
      const breeze = Math.sin(elapsed * 1.4 + index * 0.45 + this.scrollProgress * 6) * 0.012;
      if (side === -1 || !this.pageFlipProgress[Math.floor(index / 2)]) {
        p.rotation.z = baseRotZ + side * breeze;
      }
    });

    // Animate rising coffee steam with delta-time scaling
    if (this.steamPoints && this.steamData) {
      const pos = this.steamPoints.geometry.attributes.position;
      const speedScale = dt * 60;
      for (let i = 0; i < this.steamData.length; i++) {
        const d = this.steamData[i];
        let y = pos.getY(i) + d.speedY * speedScale;
        if (y > 1.8) {
          y = 0.65;
        }
        pos.setY(i, y);

        const progress = (y - 0.65) / 1.15;
        const currentAngle = d.baseAngle + elapsed * d.swirlSpeed + d.seed;
        const currentR = progress * 0.22;
        pos.setX(i, Math.cos(currentAngle) * currentR);
        pos.setZ(i, Math.sin(currentAngle) * currentR);
      }
      pos.needsUpdate = true;
    }

    if (this.particles) {
      this.particles.rotation.y = elapsed * 0.02;
      this.particleMat.opacity = THREE.MathUtils.lerp(0.45, 0.75, this.nightMix);
    }

    if (this.onTelemetry) {
      this.onTelemetry(this.camera.position, this.scrollProgress);
    }

    this.renderer.render(this.scene, this.camera);
  }

  animate() {
    if (this.isExternallyDriven) return;
    requestAnimationFrame(() => this.animate());
    const dt = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();
    this.renderFrame(dt, elapsed);
  }
}
