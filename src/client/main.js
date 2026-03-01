// src/client/main.js
import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

console.log("main.js loaded");

const questionInput = document.getElementById("question");
const appInner = document.getElementById("app-inner");
const consultingOverlay = document.getElementById("consulting-overlay");
const consultingCanvas = document.getElementById("consulting-canvas");

let consultingScene = null;
let consultingRenderer = null;
let consultingClouds = [];
let consultingAnimationId = null;
let cloudPhase = 'idle'; // 'ramp' | 'peak' | 'taper' | 'idle'
let cloudPhaseStartTime = 0;
let cloudPeakCallback = null;
let cloudDoneCallback = null;
let pendingShareBlob = null;
let shareImageReadyResolve = null;
let shareImageReadyPromise = new Promise(resolve => { shareImageReadyResolve = resolve; });

// Create the consulting cloud scene.
// onPeak: fires when ramp completes — full coverage guaranteed, safe to switch content.
// onDone: fires when taper completes — overlay hidden, animation stopped.
function startConsultingClouds(onPeak, onDone) {
  if (!consultingCanvas) return;

  cloudPhase = 'ramp';
  cloudPhaseStartTime = Date.now();
  cloudPeakCallback = onPeak || null;
  cloudDoneCallback = onDone || null;

  // Canvas always at full CSS opacity — cloud material opacity + backdrop drive the fade.
  consultingCanvas.style.opacity = '1';
  consultingCanvas.style.transition = 'none';

  window.pauseBg?.();

  consultingRenderer = new THREE.WebGLRenderer({
    canvas: consultingCanvas,
    antialias: false,
    alpha: true
  });
  const SW = window.screen.width;
  const SH = window.screen.height;
  consultingRenderer.setSize(SW, SH, false);
  consultingRenderer.setPixelRatio(1);
  consultingRenderer.setClearColor(0x000000, 0);

  consultingScene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, SW / SH, 0.1, 100);
  camera.position.set(0, -1.5, 2);
  camera.lookAt(0, 0, 0);

  const purpleLight = new THREE.PointLight(0xd946ff, 8, 120);
  purpleLight.position.set(-2, 1, 5);
  const cyanLight = new THREE.PointLight(0x5ee7ff, 8, 120);
  cyanLight.position.set(2, -1, 5);
  const pinkLight = new THREE.PointLight(0xff6ad5, 6, 100);
  pinkLight.position.set(0, -2, 4);

  consultingScene.add(purpleLight, cyanLight, pinkLight);
  consultingScene.add(new THREE.AmbientLight(0x1f2937, 0.8));

  const cloudGeo = new THREE.PlaneGeometry(7, 7);
  consultingClouds = [];

  const loader = new THREE.TextureLoader();
  loader.load("./assets/smoke.png", (smokeTexture) => {
    const cloudCount = 80;
    for (let i = 0; i < cloudCount; i++) {
      const tintColors = [0xd946ff, 0xff6ad5, 0x5ee7ff];
      const tint = tintColors[i % tintColors.length];

      const material = new THREE.MeshLambertMaterial({
        map: smokeTexture,
        color: tint,
        transparent: true,
        opacity: 0, // driven by masterOpacity each frame
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });

      const cloud = new THREE.Mesh(cloudGeo, material);

      // Spread from y=3 (in visible zone) down to y=-17 so the top third of
      // clouds are already above FADE_IN_Y at t=0 — visible coverage starts
      // immediately as masterOpacity ramps, with no visible blank moment.
      cloud.position.set(
        (Math.random() - 0.5) * 8,
        3 - (i / cloudCount) * 20 + (Math.random() - 0.5),
        -1 - Math.random() * 2
      );

      cloud.rotation.z = Math.random() * Math.PI * 2;
      cloud.userData.riseSpeed = 0.022 + Math.random() * 0.015;
      cloud.userData.rotSpeed = (Math.random() - 0.5) * 0.005;
      cloud.userData.indOpacity = 0; // per-cloud fade; driven each frame

      consultingScene.add(cloud);
      consultingClouds.push(cloud);
    }

    const RAMP_DURATION = 3000;  // ms to fade in to full opacity
    const TAPER_DURATION = 4500; // ms to fade out after content switch
    const FADE_IN_Y = -4.0;     // y where a rising cloud starts fading in
    const FADE_OUT_Y = 5.0;     // y where an exiting cloud starts fading out
    const FADE_IN_SPEED = 0.04; // indOpacity per frame (≈25 frames / 0.4s)
    const FADE_OUT_SPEED = 0.04;

    function animateClouds() {
      consultingAnimationId = requestAnimationFrame(animateClouds);

      const now = Date.now();
      const elapsed = now - cloudPhaseStartTime;
      let masterOpacity = 1;

      if (cloudPhase === 'ramp') {
        masterOpacity = Math.min(1, elapsed / RAMP_DURATION);
        if (elapsed >= RAMP_DURATION) {
          cloudPhase = 'peak';
          cloudPhaseStartTime = now;
          if (cloudPeakCallback) { cloudPeakCallback(); cloudPeakCallback = null; }
        }
      } else if (cloudPhase === 'peak') {
        masterOpacity = 1;
      } else if (cloudPhase === 'taper') {
        masterOpacity = Math.max(0, 1 - elapsed / TAPER_DURATION);
        if (elapsed >= TAPER_DURATION) {
          consultingOverlay.classList.remove("visible");
          consultingOverlay.style.opacity = "";
          const cb = cloudDoneCallback;
          cloudDoneCallback = null;
          stopConsultingClouds();
          if (cb) cb();
          return; // stop loop — stopConsultingClouds cancelled the next frame
        }
      }

      // Backdrop darkens with clouds; at peak it fully blocks content for the card switch.
      const backdrop = document.getElementById('consulting-backdrop');
      if (backdrop) {
        backdrop.style.transition = 'none';
        backdrop.style.opacity = masterOpacity.toString();
      }

      consultingClouds.forEach((cloud) => {
        cloud.position.y += cloud.userData.riseSpeed;
        cloud.rotation.z += cloud.userData.rotSpeed;

        // Per-cloud fade: smooth entry from below and exit at top.
        // During taper, masterOpacity drives the global fade — indOpacity stays fixed.
        if (cloudPhase === 'ramp' || cloudPhase === 'peak') {
          if (cloud.position.y > FADE_OUT_Y) {
            // Fade out as cloud exits the top; respawn the moment it's invisible.
            cloud.userData.indOpacity = Math.max(0, cloud.userData.indOpacity - FADE_OUT_SPEED);
            if (cloud.userData.indOpacity <= 0) {
              cloud.position.y = -4.5 - Math.random() * 4;
              cloud.position.x = (Math.random() - 0.5) * 8;
            }
          } else if (cloud.position.y > FADE_IN_Y) {
            // Fade in as cloud enters the visible area from below.
            cloud.userData.indOpacity = Math.min(1, cloud.userData.indOpacity + FADE_IN_SPEED);
          }
        }

        cloud.material.opacity = masterOpacity * cloud.userData.indOpacity;
      });

      consultingRenderer.render(consultingScene, camera);
    }

    animateClouds();
  });
}

// Clean up the consulting scene
function stopConsultingClouds() {
  if (consultingAnimationId) {
    cancelAnimationFrame(consultingAnimationId);
    consultingAnimationId = null;
  }

  if (consultingRenderer) {
    consultingRenderer.dispose();
    consultingRenderer = null;
  }

  consultingClouds.forEach((cloud) => {
    if (cloud.geometry) cloud.geometry.dispose();
    if (cloud.material) {
      if (cloud.material.map) cloud.material.map.dispose();
      cloud.material.dispose();
    }
  });

  consultingClouds = [];
  consultingScene = null;
  cloudPhase = 'idle';
  cloudPeakCallback = null;
  cloudDoneCallback = null;
  consultingCanvas.style.opacity = '';
  consultingCanvas.style.transition = '';
  const bd = document.getElementById('consulting-backdrop');
  if (bd) { bd.style.transition = ''; bd.style.opacity = ''; }
  window.resumeBg?.();
}

// Intro clouds - cover screen on load, then exit naturally
function startIntroClouds() {
  if (!consultingCanvas) return;

  consultingRenderer = new THREE.WebGLRenderer({
    canvas: consultingCanvas,
    antialias: true,
    alpha: true
  });
  const SW = window.screen.width;
  const SH = window.screen.height;
  consultingRenderer.setSize(SW, SH, false);
  consultingRenderer.setPixelRatio(1);
  consultingRenderer.setClearColor(0x000000, 0);

  consultingScene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    SW / SH,
    0.1,
    100
  );
  camera.position.set(0, -1.5, 2);
  camera.lookAt(0, 0, 0);

  const purpleLight = new THREE.PointLight(0xd946ff, 8, 120);
  purpleLight.position.set(-2, 1, 5);

  const cyanLight = new THREE.PointLight(0x5ee7ff, 8, 120);
  cyanLight.position.set(2, -1, 5);

  const pinkLight = new THREE.PointLight(0xff6ad5, 6, 100);
  pinkLight.position.set(0, -2, 4);

  consultingScene.add(purpleLight, cyanLight, pinkLight);
  consultingScene.add(new THREE.AmbientLight(0x1f2937, 0.8));

  const cloudGeo = new THREE.PlaneGeometry(7, 7);
  consultingClouds = [];

  const loader = new THREE.TextureLoader();
  // Load texture first — animation starts only in the callback so no
  // frames render with flat-coloured planes before the texture arrives.
  loader.load("./assets/smoke.png", (smokeTexture) => {

    for (let i = 0; i < 60; i++) {
      const tintColors = [0xd946ff, 0xff6ad5, 0x5ee7ff];
      const tint = tintColors[i % tintColors.length];

      const material = new THREE.MeshLambertMaterial({
        map: smokeTexture,
        color: tint,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide
      });

      const cloud = new THREE.Mesh(cloudGeo, material);

      // All clouds start with their centres in the visible area (y 0–4).
      // A 7-unit-tall plane centred at y=0 already spans the full visible
      // height, so the screen is covered immediately and no cloud centre
      // is ever below the screen edge at spawn (which caused the blink).
      cloud.position.set(
        (Math.random() - 0.5) * 10,
        Math.random() * 4,
        -1 - Math.random() * 2
      );

      cloud.rotation.z = Math.random() * Math.PI * 2;
      cloud.userData.riseSpeed = 0.025 + Math.random() * 0.015;
      cloud.userData.rotSpeed = (Math.random() - 0.5) * 0.005;

      consultingScene.add(cloud);
      consultingClouds.push(cloud);
    }

    // Release pointer-events early so the user isn't locked out too long,
    // even while the last few clouds are still drifting off the top.
    setTimeout(() => {
      if (consultingOverlay) consultingOverlay.style.pointerEvents = 'none';
    }, 2500);

    function animateIntroClouds() {
      consultingAnimationId = requestAnimationFrame(animateIntroClouds);

      let allGone = true;
      consultingClouds.forEach((cloud) => {
        cloud.position.y += cloud.userData.riseSpeed;
        cloud.rotation.z += cloud.userData.rotSpeed;
        // Threshold is 9 (not 6) so the full 7-unit-tall plane clears the
        // top edge before we consider it gone.
        if (cloud.position.y < 9) allGone = false;
      });

      consultingRenderer.render(consultingScene, camera);

      if (allGone) {
        consultingOverlay.classList.remove("visible");
        stopConsultingClouds();
      }
    }

    animateIntroClouds();
  });
}

// ── Share image helpers ────────────────────────────────────────────────────

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function generateShareImage(fortuneText) {
  const W = 1080;
  const FRAME = 60;  // padding on all sides
  const cardW = W - FRAME * 2; // 960px — fills the width

  await document.fonts.ready;
  const cardImg = await loadImg('./assets/fortune-card.png');

  const cardH = Math.round(cardW * (cardImg.height / cardImg.width));
  const GAP = 50;
  const CTA_H = 160;
  const H = FRAME + cardH + GAP + CTA_H + FRAME;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, W, H);

  // Atmospheric glows — top-left purple, bottom-right cyan
  const purpleGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, 700);
  purpleGlow.addColorStop(0, 'rgba(168, 85, 247, 0.25)');
  purpleGlow.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = purpleGlow;
  ctx.fillRect(0, 0, W, H);

  const cyanGlow = ctx.createRadialGradient(W, H, 0, W, H, 600);
  cyanGlow.addColorStop(0, 'rgba(94, 231, 255, 0.2)');
  cyanGlow.addColorStop(1, 'rgba(94, 231, 255, 0)');
  ctx.fillStyle = cyanGlow;
  ctx.fillRect(0, 0, W, H);

  // Card
  const cardX = FRAME;
  const cardY = FRAME;
  ctx.drawImage(cardImg, cardX, cardY, cardW, cardH);

  // Fortune text — matching CSS card padding proportions (top 25%, sides 15%, bottom 18%)
  const textCenterX = cardX + cardW / 2;
  const textAreaTop = cardY + cardH * 0.25;
  const textAreaH = cardH * 0.57;
  const maxTextWidth = cardW * 0.70;
  const fontSize = 62;
  const lineHeight = 82;

  ctx.font = `400 italic ${fontSize}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillStyle = '#1a1008';
  ctx.textAlign = 'center';

  const lines = wrapText(ctx, fortuneText, maxTextWidth);
  const totalTextH = lines.length * lineHeight;
  const textStartY = textAreaTop + (textAreaH - totalTextH) / 2 + fontSize * 0.8;
  lines.forEach((line, i) => ctx.fillText(line, textCenterX, textStartY + i * lineHeight));

  // CTA — larger and more prominent
  const ctaStartY = cardY + cardH + GAP;

  ctx.font = 'bold 56px "Cinzel", serif';
  ctx.fillStyle = '#a855f7';
  ctx.textAlign = 'center';
  ctx.fillText('What does your fate hold?', W / 2, ctaStartY + 58);

  ctx.font = '34px "Cinzel", serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fillText('askesmeralda.com', W / 2, ctaStartY + 58 + 70);

  return canvas;
}

async function shareFortuneImage() {
  const btn = document.getElementById('share-btn');
  let blob = pendingShareBlob;

  if (!blob) {
    // Image still generating — show feedback and wait
    if (btn) { btn.textContent = 'Generating...'; btn.disabled = true; btn.classList.add('loading'); }
    blob = await shareImageReadyPromise;
    if (btn) { btn.textContent = 'Share your fortune'; btn.disabled = false; btn.classList.remove('loading'); }
  }

  if (!blob) return;
  if (typeof clarity === 'function') clarity('event', 'fortune_shared');
  const file = new File([blob], 'my-fortune.png', { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: 'Find out your fate: https://askesmeralda.com' });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-fortune.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Share failed:', err);
  }
}

// ──────────────────────────────────────────────────────────────────────────

async function fetchFortune(question) {
  const res = await fetch("/api/fortune", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });

  if (!res.ok) {
    throw new Error("Network response was not ok");
  }

  const data = await res.json();
  return data.fortune || "The nebula murmurs, but softly.";
}

async function handleSubmit() {
  const question = questionInput.textContent.trim();
  if (!question) return;

  if (typeof clarity === 'function') clarity('event', 'fortune_submitted');

  // Show overlay immediately
  if (consultingOverlay) {
    consultingOverlay.style.pointerEvents = '';
    consultingOverlay.classList.add("visible");
    consultingOverlay.style.opacity = "1";
    consultingOverlay.style.transition = "none";
  }

  // Logo fades out at 2.2s during ramp — canvas is covering the form at this point,
  // so no app-consulting class needed (form stays still, canvas covers it naturally).
  setTimeout(() => {
    const logo = document.getElementById("splash-title");
    if (logo) {
      logo.style.transition = "opacity 1.2s ease";
      logo.style.opacity = "0";
    }
  }, 2200);

  // Coordinate: switch fires when BOTH peak is reached AND API is ready
  let peakReached = false;
  let fortuneReady = false;
  let fortuneResult = null;

  function doSwitch() {
    if (!peakReached || !fortuneReady) return;

    // Clouds and backdrop are at full opacity (peak) — swap content, invisible to user.
    if (appInner) appInner.style.display = "none";

    const fortuneView = document.getElementById("fortune-view");
    const fortuneTextEl = document.getElementById("fortune-text");
    if (fortuneView && fortuneTextEl) {
      fortuneTextEl.textContent = fortuneResult;
      fortuneView.style.display = "block";
    }

    const appRoot = document.getElementById("app-root");
    if (appRoot) appRoot.style.top = "0";

    // Kick off card fade-in (0.8s CSS transition) — still fully hidden by peak clouds+backdrop.
    setTimeout(() => {
      if (fortuneView) fortuneView.classList.add("visible");
      shareImageReadyPromise = new Promise(resolve => { shareImageReadyResolve = resolve; });
      pendingShareBlob = null;
      generateShareImage(fortuneResult).then(canvas => {
        canvas.toBlob(blob => {
          pendingShareBlob = blob;
          if (shareImageReadyResolve) shareImageReadyResolve(blob);
        }, 'image/png');
      }).catch(() => { if (shareImageReadyResolve) shareImageReadyResolve(null); });
    }, 50);

    // Wait for card CSS transition to complete (0.8s + 100ms buffer), then begin taper.
    // Card CSS transition: 50ms lead-in + 800ms ease = 850ms total.
    // Wait 2000ms so card is fully settled and visible before clouds start clearing.
    setTimeout(() => {
      cloudPhase = 'taper';
      cloudPhaseStartTime = Date.now();
    }, 2000);
  }

  // Start clouds: onPeak fires doSwitch (with API), onDone fires the share glow
  setTimeout(() => startConsultingClouds(
    () => { peakReached = true; doSwitch(); },
    () => {
      const btn = document.getElementById('share-btn');
      if (btn) {
        btn.classList.add('ready');
        btn.addEventListener('animationend', () => btn.classList.remove('ready'), { once: true });
      }
    }
  ), 0);

  // API call runs in parallel with the ramp animation
  let fortune;
  try {
    fortune = await fetchFortune(question);
  } catch (err) {
    console.error(err);
    fortune = "The nebula is silent. Try again.";
  }

  fortuneResult = fortune;
  fortuneReady = true;
  doSwitch();
}

const submitBtn = document.getElementById("submit-btn");

function syncSubmitBtn() {
  if (!submitBtn) return;
  const empty = !questionInput?.textContent.trim();
  questionInput?.classList.toggle("is-empty", empty);
  submitBtn.disabled = empty;
  submitBtn.style.opacity = empty ? "0.4" : "";
  submitBtn.style.cursor = empty ? "default" : "";
}

if (submitBtn) submitBtn.addEventListener("click", handleSubmit);
if (questionInput) {
  questionInput.classList.add("is-empty");
  questionInput.addEventListener("input", syncSubmitBtn);
  questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // prevent newline in contenteditable
      handleSubmit();
    }
  });
  questionInput.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));
    selection.collapseToEnd();
    syncSubmitBtn();
  });
}
syncSubmitBtn();

window.addEventListener("beforeunload", () => {
  const fortuneView = document.getElementById("fortune-view");
  if (fortuneView) fortuneView.style.visibility = "hidden";
  if (consultingOverlay) consultingOverlay.style.visibility = "hidden";
});

window.addEventListener("resize", () => {
  const logo = document.getElementById("splash-title");
  if (logo) {
    logo.style.top = "";
    logo.style.left = "";
    logo.style.transform = "";
  }
});

window.addEventListener("DOMContentLoaded", () => {
  if (consultingOverlay) {
    consultingOverlay.classList.add("visible");
    startIntroClouds();
  }
  
  setTimeout(() => {
    const logo = document.getElementById("splash-title");
    if (logo) {
      logo.style.transition = "opacity 1s ease";
      logo.style.opacity = "1";
    }
    
    const mainContainer = document.querySelector(".main-container");
    if (mainContainer) {
      mainContainer.style.transition = "opacity 1s ease";
      mainContainer.style.opacity = "1";
    }
    
    const aboutBtn = document.getElementById("about-btn");
    if (aboutBtn) {
      aboutBtn.style.transition = "opacity 1s ease";
      aboutBtn.style.opacity = "1";
    }
  }, 1500); // UI fades in at 1.5s
});

// Share button
const shareBtn = document.getElementById('share-btn');
if (shareBtn) {
  shareBtn.addEventListener('click', shareFortuneImage);
}

// About modal functionality
const aboutBtn = document.getElementById("about-btn");
const aboutModal = document.getElementById("about-modal");
const aboutClose = document.getElementById("about-close");

if (aboutBtn && aboutModal && aboutClose) {
  aboutBtn.addEventListener("click", () => {
    aboutModal.classList.add("visible");
  });

  aboutClose.addEventListener("click", () => {
    aboutModal.classList.remove("visible");
  });

  aboutModal.addEventListener("click", (e) => {
    if (e.target === aboutModal) {
      aboutModal.classList.remove("visible");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && aboutModal.classList.contains("visible")) {
      aboutModal.classList.remove("visible");
    }
  });
}
