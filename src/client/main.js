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
let shouldLoop = true;
let consultingRespawn = true;
let currentFortune = '';

// Create the consulting cloud scene
function startConsultingClouds() {
  if (!consultingCanvas) return;

  // Bypass CSS opacity transition — canvas instantly visible.
  // Clouds start below the screen so nothing pops into view.
  consultingCanvas.style.opacity = '1';
  consultingCanvas.style.transition = 'none';

  window.pauseBg?.();

  consultingRenderer = new THREE.WebGLRenderer({
    canvas: consultingCanvas,
    antialias: false,
    alpha: true
  });
  // Use screen.height (full device height) so the canvas covers the viewport
  // even when the iOS URL bar is visible. Pass false so Three.js doesn't set
  // inline style.height and override the CSS inset:0 that fills the overlay.
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

  // Load texture first — no frames render until texture is ready.
  const loader = new THREE.TextureLoader();
  loader.load("./assets/smoke.png", (smokeTexture) => {
    const cloudCount = 35;
    for (let i = 0; i < cloudCount; i++) {
      const tintColors = [0xd946ff, 0xff6ad5, 0x5ee7ff];
      const tint = tintColors[i % tintColors.length];

      const material = new THREE.MeshLambertMaterial({
        map: smokeTexture,
        color: tint,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });

      const cloud = new THREE.Mesh(cloudGeo, material);

      // Even spread from y=-2 down to y=-12 — all below screen so nothing
      // pops into view when the texture loads. Backdrop covers content meanwhile.
      cloud.position.set(
        (Math.random() - 0.5) * 8,
        -2 - (i / cloudCount) * 10 + (Math.random() - 0.5),
        -1 - Math.random() * 2
      );

      cloud.rotation.z = Math.random() * Math.PI * 2;
      cloud.userData.riseSpeed = 0.025 + Math.random() * 0.015;
      cloud.userData.rotSpeed = (Math.random() - 0.5) * 0.005;

      consultingScene.add(cloud);
      consultingClouds.push(cloud);
    }

    function animateClouds() {
      consultingAnimationId = requestAnimationFrame(animateClouds);

      consultingClouds.forEach((cloud) => {
        cloud.position.y += cloud.userData.riseSpeed;
        cloud.rotation.z += cloud.userData.rotSpeed;

        // Threshold y>10: even the deepest clouds (z≈-3, visible top≈y4.8)
        // have their bottom edge (centre-3.5=6.5) safely off-screen.
        if (cloud.position.y > 10) {
          if (consultingRespawn) {
            cloud.position.y = -5 - Math.random() * 3;
            cloud.position.x = (Math.random() - 0.5) * 8;
          }
        }
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
  consultingRespawn = true;
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

  ctx.font = `600 italic ${fontSize}px "Cormorant Garamond", Georgia, serif`;
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

async function shareFortuneImage(fortuneText) {
  const btn = document.getElementById('share-btn');
  if (btn) { btn.textContent = 'Preparing...'; btn.disabled = true; btn.classList.add('loading'); }

  try {
    const canvas = await generateShareImage(fortuneText);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'my-fortune.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        text: 'Find out your fate: https://askesmeralda.com'
      });
    } else {
      // Fallback: download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-fortune.png';
      a.click();
      URL.revokeObjectURL(url);
    }
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Share failed:', err);
  } finally {
    if (btn) { btn.textContent = 'Share your fortune'; btn.disabled = false; btn.classList.remove('loading'); }
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
  const question = questionInput.value.trim();
  if (!question) return;

    const cloudsStartTime = Date.now();

    if (consultingOverlay) {
      consultingOverlay.style.pointerEvents = ''; // clear any intro override
      consultingOverlay.classList.add("visible");
      consultingOverlay.style.opacity = "1";
      consultingOverlay.style.transition = "none";
      console.log("Overlay visible, about to start clouds");
      setTimeout(startConsultingClouds, 0); // INSTANT - no delay
    }

    setTimeout(() => {
      if (appInner) {
        appInner.classList.add("app-consulting");
      }
      
      const logo = document.getElementById("splash-title");
      if (logo) {
        logo.style.transition = "opacity 1.2s ease";
        logo.style.opacity = "0";
      }
    }, 2200);

    let fortune;
    try {
      fortune = await fetchFortune(question);
    } catch (err) {
      console.error(err);
      fortune = "The nebula is silent. Try again.";
    }
    currentFortune = fortune;

    const elapsed = Date.now() - cloudsStartTime;
    const minDisplayTime = 4000;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);
    console.log("API took:", elapsed, "ms. Waiting additional:", remainingTime, "ms");

    setTimeout(() => {
      // Fade in backdrop now — covers the card switch 1 second from now
      const backdrop = document.getElementById('consulting-backdrop');
      if (backdrop) {
        backdrop.style.transition = 'opacity 0.6s ease';
        backdrop.style.opacity = '1';
      }

      // DELAY screen switch by 1 second (backdrop + clouds cover transition)
      setTimeout(() => {
        if (appInner) {
          appInner.style.display = "none";
        }
        
        const fortuneView = document.getElementById("fortune-view");
        const fortuneText = document.getElementById("fortune-text");
        
        if (fortuneView && fortuneText) {
          fortuneText.textContent = fortune;
          fortuneView.style.display = "block";

          consultingRespawn = false; // clouds drift off naturally, revealing the card

          // Re-enable transition then fade out backdrop — card visible through cloud canvas
          const backdrop = document.getElementById('consulting-backdrop');
          if (backdrop) {
            backdrop.style.transition = 'opacity 0.5s ease';
            backdrop.style.opacity = '0';
          }
          
          const appRoot = document.getElementById("app-root");
          if (appRoot) {
            appRoot.style.top = "0";
          }
          
          setTimeout(() => {
            fortuneView.classList.add("visible");
          }, 50);
        }
      }, 1000);

      if (consultingOverlay) {
        setTimeout(() => {
          consultingOverlay.classList.remove("visible");
          consultingOverlay.style.opacity = "";
          stopConsultingClouds();
        }, 10000);
      }

    }, remainingTime);
}

const submitBtn = document.getElementById("submit-btn");

function syncSubmitBtn() {
  if (!submitBtn) return;
  const empty = !questionInput?.value.trim();
  submitBtn.disabled = empty;
  submitBtn.style.opacity = empty ? "0.4" : "";
  submitBtn.style.cursor = empty ? "default" : "";
}

if (submitBtn) submitBtn.addEventListener("click", handleSubmit);
if (questionInput) {
  questionInput.addEventListener("input", syncSubmitBtn);
  questionInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSubmit();
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
  shareBtn.addEventListener('click', () => {
    if (currentFortune) shareFortuneImage(currentFortune);
  });
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
