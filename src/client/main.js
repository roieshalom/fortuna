// src/client/main.js
import * as THREE from "https://unpkg.com/three@0.158.0/build/three.module.js";

console.log("main.js loaded");

const form = document.getElementById("fortune-form");
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

// Create the consulting cloud scene
function startConsultingClouds() {
  if (!consultingCanvas) return;

  // Bypass CSS opacity transition — canvas instantly visible.
  // Clouds start below the screen so nothing pops into view.
  consultingCanvas.style.opacity = '1';
  consultingCanvas.style.transition = 'none';

  consultingRenderer = new THREE.WebGLRenderer({
    canvas: consultingCanvas,
    antialias: true,
    alpha: true
  });
  consultingRenderer.setSize(window.innerWidth, window.innerHeight);
  consultingRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  consultingRenderer.setClearColor(0x000000, 0);

  consultingScene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
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
    for (let i = 0; i < 100; i++) {
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

      // All clouds start below the visible area.
      // Visible bottom ≈ y=0; cloud top edge = centre + 3.5.
      // Centres spread over -4…-12 for a staggered rising wave.
      cloud.position.set(
        (Math.random() - 0.5) * 8,
        -4 - Math.random() * 8,
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
}

// Intro clouds - cover screen on load, then exit naturally
function startIntroClouds() {
  if (!consultingCanvas) return;

  consultingRenderer = new THREE.WebGLRenderer({
    canvas: consultingCanvas,
    antialias: true,
    alpha: true
  });
  consultingRenderer.setSize(window.innerWidth, window.innerHeight);
  consultingRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  consultingRenderer.setClearColor(0x000000, 0);

  consultingScene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
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

if (form && questionInput) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

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

    const elapsed = Date.now() - cloudsStartTime;
    const minDisplayTime = 4000;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);
    console.log("API took:", elapsed, "ms. Waiting additional:", remainingTime, "ms");

    setTimeout(() => {
      // DELAY screen switch by 1 second (clouds cover transition)
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

  });
}

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
