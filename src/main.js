import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SceneManager } from './scene/SceneManager.js';
import { sound } from './audio/SoundEngine.js';

gsap.registerPlugin(ScrollTrigger);

const CHAPTER_LABELS = [
  '01 / INTRO',
  '02 / NOTEBOOK',
  '03 / DESK',
  '04 / DOWNLOAD',
  '05 / REPLY',
];

function initApp() {
  document.body.classList.add('is-loading');

  const canvas = document.getElementById('webgl-canvas');
  const preloader = document.getElementById('preloader');
  const preloaderBar = document.getElementById('preloader-bar');
  const preloaderPercent = document.getElementById('preloader-percent');
  const scrollBar = document.getElementById('scroll-progress-bar');
  const chapterIndicator = document.getElementById('chapter-indicator');
  const cameraTelemetry = document.getElementById('camera-telemetry');

  // 1. Initialize Three.js SceneManager
  const sceneManager = new SceneManager(canvas);

  let lastCamX = -999;
  let lastProgressInt = -1;
  const atmosphereOverlay = document.querySelector('.atmosphere-overlay');

  sceneManager.onTelemetry = (pos, progress) => {
    if (cameraTelemetry && Math.abs(pos.x - lastCamX) > 0.05) {
      lastCamX = pos.x;
      cameraTelemetry.textContent = `CAM ${pos.x.toFixed(1)} / ${pos.y.toFixed(1)} / ${pos.z.toFixed(1)}`;
    }
    // High-performance GPU composite transform (0ms reflow)
    if (scrollBar) {
      scrollBar.style.transform = `scaleY(${progress})`;
    }
    // Throttle ambient glow background updates on atmosphere overlay
    const progressInt = Math.round(progress * 150);
    if (progressInt !== lastProgressInt) {
      lastProgressInt = progressInt;
      const glowX = 50 + Math.sin(progress * Math.PI * 2) * 28;
      const glowY = 22 + progress * 58;
      if (atmosphereOverlay) {
        atmosphereOverlay.style.setProperty('--glow-x', `${glowX.toFixed(1)}%`);
        atmosphereOverlay.style.setProperty('--glow-y', `${glowY.toFixed(1)}%`);
      }
    }
  };

  // 2. Day / Night Mode Toggle
  const themeBtn = document.getElementById('theme-toggle-btn');
  const themeLabel = document.getElementById('theme-label');
  const iconMoon = document.getElementById('icon-moon');
  const iconSun = document.getElementById('icon-sun');
  let isNight = false;

  themeBtn?.addEventListener('click', () => {
    isNight = !isNight;
    document.documentElement.setAttribute('data-theme', isNight ? 'night' : 'day');
    sceneManager.setNightMode(isNight);
    if (themeLabel) themeLabel.textContent = isNight ? 'Day' : 'Night';
    if (iconMoon) iconMoon.style.display = isNight ? 'none' : 'block';
    if (iconSun) iconSun.style.display = isNight ? 'block' : 'none';
    sound.playPenClick();
  });

  // Sound Engine Mute/Unmute Toggle
  const soundBtn = document.getElementById('sound-toggle-btn');
  const iconSoundOff = document.getElementById('icon-sound-off');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const soundLabel = document.getElementById('sound-label');

  soundBtn?.addEventListener('click', () => {
    const isEnabled = sound.toggle();
    if (iconSoundOff) iconSoundOff.style.display = isEnabled ? 'none' : 'block';
    if (iconSoundOn) iconSoundOn.style.display = isEnabled ? 'block' : 'none';
    if (soundLabel) soundLabel.textContent = isEnabled ? 'On' : 'Audio';
  });

  // 3D Object Inspect HUD Handlers
  const inspectHud = document.getElementById('inspect-hud');
  const inspectTitle = document.getElementById('inspect-hud-title');
  const inspectDesc = document.getElementById('inspect-hud-desc');
  const inspectClose = inspectHud?.querySelector('.inspect-hud__close');

  inspectClose?.addEventListener('click', () => {
    sceneManager.exitInspection();
    sound.playPenClick();
  });

  sceneManager.onInspectChange = (item) => {
    if (item && inspectHud) {
      if (inspectTitle) inspectTitle.textContent = item.title;
      if (inspectDesc) inspectDesc.textContent = item.desc;
      inspectHud.classList.add('is-visible');
      if (item.id === 'pen') sound.playPenClick();
      else if (item.id === 'cup') sound.playCeramicClink();
      else if (item.id === 'book') sound.playPageTurn();
      else sound.playChime();
    } else if (inspectHud) {
      inspectHud.classList.remove('is-visible');
    }
  };

  sceneManager.onPageFlip = (pageIdx) => {
    sound.playPageTurn();
    if (inspectDesc && sceneManager.inspectedTarget === 'book') {
      inspectDesc.textContent = `Turned to folio page 0${pageIdx + 1} — handwritten ink signature unfolding. Click to turn again.`;
    }
  };

  // 3. Preloader Sequence -> Hero Entrance
  let loadProgress = 0;
  const loadTimer = setInterval(() => {
    loadProgress = Math.min(100, loadProgress + Math.floor(Math.random() * 18) + 14);
    if (preloaderBar) preloaderBar.style.width = `${loadProgress}%`;
    if (preloaderPercent) preloaderPercent.textContent = String(loadProgress).padStart(3, '0') + '%';

    if (loadProgress >= 100) {
      clearInterval(loadTimer);
      setTimeout(() => {
        preloader?.classList.add('is-done');
        document.body.classList.remove('is-loading');
        playHeroEntrance();
      }, 240);
    }
  }, 55);

  function playHeroEntrance() {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.from('.hero-badge', { y: 24, opacity: 0, duration: 0.9 })
      .from('.hero-title .line-inner', {
        yPercent: 115,
        duration: 1.05,
        stagger: 0.13,
      }, '-=0.6')
      .from('.hero-subtitle', { y: 20, opacity: 0, duration: 0.85 }, '-=0.65')
      .from('.hero-cta-row', { y: 18, opacity: 0, duration: 0.8 }, '-=0.6');
  }

  // 4. Lenis Smooth Scroll - Snappy, instant response without drag lag
  const lenis = new Lenis({
    lerp: 0.16, // Snappy & direct, zero drag lag
    wheelMultiplier: 1.15,
    touchMultiplier: 1.6,
    smoothWheel: true,
    syncTouch: false,
    autoRaf: false,
  });

  lenis.on('scroll', (e) => {
    ScrollTrigger.update();
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? e.scroll / maxScroll : 0;
    sceneManager.setScrollProgress(progress);
  });

  // Single unified high-refresh tick: Lenis -> ScrollTrigger -> Three.js in lockstep
  sceneManager.isExternallyDriven = true;
  gsap.ticker.add((time, deltaTime) => {
    const delta = Math.min(deltaTime / 1000, 0.05);
    lenis.raf(time * 1000);
    sceneManager.renderFrame(delta, time);
  });
  gsap.ticker.lagSmoothing(500, 33);

  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        lenis.scrollTo(targetEl, { duration: 1.4 });
      }
    });
  });

  // 5. Chapter Triggers & Card Reveal Animations
  const chapters = document.querySelectorAll('.chapter');
  const navLinks = document.querySelectorAll('.nav-link');

  chapters.forEach((chapter, idx) => {
    ScrollTrigger.create({
      trigger: chapter,
      start: 'top 55%',
      end: 'bottom 45%',
      onEnter: () => updateActiveChapter(idx),
      onEnterBack: () => updateActiveChapter(idx),
    });

    const card = chapter.querySelector('.glass-card');
    if (card) {
      gsap.from(card, {
        y: 48,
        opacity: 0,
        duration: 1.0,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: chapter,
          start: 'top 72%',
          once: true,
        },
      });
    }
  });

  function updateActiveChapter(idx) {
    if (chapterIndicator) {
      chapterIndicator.textContent = CHAPTER_LABELS[idx] || CHAPTER_LABELS[0];
    }
    navLinks.forEach((link, i) => {
      link.classList.toggle('is-active', i === idx - 1);
    });
  }

  // 6. Pointer Parallax & Custom Magnetic Cursor (GPU translate3d locked for 120Hz/144Hz)
  const cursor = document.getElementById('cursor');
  const cursorDot = cursor?.querySelector('.cursor__dot');
  const cursorRing = cursor?.querySelector('.cursor__ring');

  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const ringPos = { x: mouse.x, y: mouse.y };

  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;

    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    sceneManager.setPointer(nx, ny);

    if (cursorDot) {
      cursorDot.style.transform = `translate3d(${mouse.x - 3}px, ${mouse.y - 3}px, 0)`;
    }
  }, { passive: true });

  gsap.ticker.add((time, deltaTime) => {
    const dt = Math.min(deltaTime / 1000, 0.05);
    const damp = 1 - Math.exp(-18 * dt);
    ringPos.x += (mouse.x - ringPos.x) * damp;
    ringPos.y += (mouse.y - ringPos.y) * damp;
    if (cursorRing) {
      cursorRing.style.transform = `translate3d(${ringPos.x - 17}px, ${ringPos.y - 17}px, 0)`;
    }
  });

  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('mouseenter', () => cursor?.classList.add('is-hover'));
    el.addEventListener('mouseleave', () => {
      cursor?.classList.remove('is-hover');
      gsap.to(el, { x: 0, y: 0, duration: 0.45, ease: 'elastic.out(1, 0.5)' });
    });
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.18;
      const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.18;
      gsap.to(el, { x: dx, y: dy, duration: 0.3, ease: 'power2.out' });
    });
  });

  // 7. Subtle 3D Tilt on Glass Cards
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -5;
      const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 5;
      card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  });

  // 8. Interactive Controls
  document.getElementById('camera-reset-btn')?.addEventListener('click', () => {
    sceneManager.resetCamera();
    lenis.scrollTo('#chapter-hero', { duration: 1.5 });
  });

  const likeBtn = document.getElementById('like-btn');
  const likeLabel = document.getElementById('like-label');
  const likeNote = document.getElementById('like-count-note');
  let liked = false;

  likeBtn?.addEventListener('click', () => {
    liked = !liked;
    likeBtn.classList.toggle('is-active', liked);
    if (likeLabel) likeLabel.textContent = liked ? 'Liked' : 'Like';
    if (likeNote) likeNote.textContent = liked ? 'You liked this post.' : 'Be the first to like this.';
    if (liked) sceneManager.triggerBurst();
  });

  const commentForm = document.getElementById('comment-form');
  const commentInput = document.getElementById('comment-input');
  const authorInput = document.getElementById('author-input');
  const commentList = document.getElementById('comment-list');

  commentForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = commentInput?.value.trim();
    if (!text) return;
    const author = authorInput?.value.trim() || 'Guest Reader';

    const li = document.createElement('li');
    li.className = 'comment-item';
    const head = document.createElement('div');
    head.className = 'comment-item__head';
    const strong = document.createElement('strong');
    strong.textContent = author;
    const time = document.createElement('span');
    time.textContent = 'Just now';
    head.append(strong, time);

    const body = document.createElement('p');
    body.className = 'comment-item__body';
    body.textContent = text;

    li.append(head, body);
    commentList?.prepend(li);

    commentInput.value = '';
    sceneManager.triggerBurst();
  });
}

window.addEventListener('DOMContentLoaded', initApp);
