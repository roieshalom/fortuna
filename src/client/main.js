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

// Create the consulting cloud scene
function startConsultingClouds() {
  console.log("startConsultingClouds called");
  console.log("consultingCanvas:", consultingCanvas);
  
  if (!consultingCanvas) {
    console.error("Canvas not found!");
    return;
  }
  
  console.log("Creating consulting clouds...");

  // Set up renderer
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

  // Dramatic lighting
  const purpleLight = new THREE.PointLight(0xd946ff, 8, 120);
  purpleLight.position.set(-2, 1, 5);

  const cyanLight = new THREE.PointLight(0x5ee7ff, 8, 120);
  cyanLight.position.set(2, -1, 5);

  const pinkLight = new THREE.PointLight(0xff6ad5, 6, 100);
  pinkLight.position.set(0, -2, 4);

  consultingScene.add(purpleLight, cyanLight, pinkLight);
  consultingScene.add(new THREE.AmbientLight(0x1f2937, 0.8));

  // Load smoke texture
  const loader = new THREE.TextureLoader();
  const smokeTexture = loader.load("/server/assets/smoke.png");

  const cloudGeo = new THREE.PlaneGeometry(7, 7);
  consultingClouds = [];

  // Spawn 50 clouds (increased for better coverage)
    for (let i = 0; i < 100; i++) {
    const tintColors = [0xd946ff, 0xff6ad5, 0x5ee7ff];
    const tint = tintColors[i % tintColors.length];

    const material = new THREE.MeshLambertMaterial({
      map: smokeTexture,
      color: tint,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const cloud = new THREE.Mesh(cloudGeo, material);

    // ALL clouds start BELOW viewport, rise up fully visible
    cloud.position.set(
      (Math.random() - 0.5) * 8,
      -6 - Math.random() * 3, // Start from -6 to -9 (all below screen)
      -1 - Math.random() * 2
    );


    cloud.rotation.z = Math.random() * Math.PI * 2;

    // Store upward velocity for animation
    cloud.userData.riseSpeed = 0.025 + Math.random() * 0.015;
    cloud.userData.rotSpeed = (Math.random() - 0.5) * 0.005;

    consultingScene.add(cloud);
    consultingClouds.push(cloud);
  }


  console.log("Created", consultingClouds.length, "clouds");

  // Animation loop
  let startTime = Date.now();

  function animateClouds() {
  consultingAnimationId = requestAnimationFrame(animateClouds);
  
  const elapsed = (Date.now() - startTime) / 1000;
  
  // Determine phase
  let phase = 'peak'; // Default to peak
  
  if (elapsed < 1.0) {
    phase = 'rampup';
  } else if (elapsed < 5.5) {
    phase = 'peak';
  } else if (elapsed < 8.0) {
    phase = 'taper';
  } else {
    phase = 'exit';
  }

  consultingClouds.forEach((cloud) => {
  cloud.position.y += cloud.userData.riseSpeed;
  cloud.rotation.z += cloud.userData.rotSpeed;

  // FADE OUT clouds at top edge only (prevents blink when repositioning)
if (cloud.position.y > 4) {
  cloud.material.opacity = Math.max(0, 1 - ((cloud.position.y - 4) / 2));
} else {
  // Full opacity everywhere else (clouds rise fully visible from bottom)
  cloud.material.opacity = 1;
}

  // DETERMINISTIC looping based on phase
  if (cloud.position.y > 6) {
    if (phase === 'rampup') {
      // Probabilistic ramp: 0 → 1
      const loopChance = elapsed / 1.0;
      if (Math.random() < loopChance) {
        cloud.position.y = -4 - Math.random() * 2;
      }
    } else if (phase === 'peak') {
      // GUARANTEED loop during peak - NO RANDOMNESS
      cloud.position.y = -4 - Math.random() * 2;
    } else if (phase === 'taper') {
      // Probabilistic taper: 1 → 0
      const loopChance = 1 - ((elapsed - 5.5) / 2.5);
      if (Math.random() < loopChance) {
        cloud.position.y = -4 - Math.random() * 2;
      }
    }
    // phase === 'exit': don't loop, let clouds fly off
  }
});


  consultingRenderer.render(consultingScene, camera);
}

  animateClouds();
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
}

// Intro clouds - cover screen on load, then exit
function startIntroClouds() {
  console.log("Starting intro clouds...");
  
  if (!consultingCanvas) {
    console.error("Canvas not found!");
    return;
  }

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

  const loader = new THREE.TextureLoader();
  const smokeTexture = loader.load("/server/assets/smoke.png");

  const cloudGeo = new THREE.PlaneGeometry(7, 7);
  consultingClouds = [];

  for (let i = 0; i < 40; i++) {
    const tintColors = [0xd946ff, 0xff6ad5, 0x5ee7ff];
    const tint = tintColors[i % tintColors.length];

    const material = new THREE.MeshLambertMaterial({
      map: smokeTexture,
      color: tint,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const cloud = new THREE.Mesh(cloudGeo, material);

    cloud.position.set(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 6,
      -1 - Math.random() * 2
    );

    cloud.rotation.z = Math.random() * Math.PI * 2;

    cloud.userData.riseSpeed = 0.025 + Math.random() * 0.015;
    cloud.userData.rotSpeed = (Math.random() - 0.5) * 0.005;

    consultingScene.add(cloud);
    consultingClouds.push(cloud);
  }

  console.log("Created", consultingClouds.length, "intro clouds");

  let startTime = Date.now();

  function animateIntroClouds() {
    consultingAnimationId = requestAnimationFrame(animateIntroClouds);
    
    const elapsed = (Date.now() - startTime) / 1000;

    consultingClouds.forEach((cloud) => {
      cloud.position.y += cloud.userData.riseSpeed;
      cloud.rotation.z += cloud.userData.rotSpeed;
    });

    consultingRenderer.render(consultingScene, camera);
  }

  animateIntroClouds();

  // Fade out smoothly before cleanup
  setTimeout(() => {
    if (consultingOverlay) {
      consultingOverlay.style.transition = "opacity 1s ease-out";
      consultingOverlay.style.opacity = "0";
      
      setTimeout(() => {
        consultingOverlay.classList.remove("visible");
        consultingOverlay.style.opacity = "";
        stopConsultingClouds();
      }, 1000);
    }
  }, 2500);
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
      consultingOverlay.classList.add("visible");
      consultingOverlay.style.opacity = "1";
      consultingOverlay.style.transition = "none";
      console.log("Overlay visible, about to start clouds");
      setTimeout(startConsultingClouds, 100);
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
      if (appInner) {
        appInner.style.display = "none";
      }
      
      const fortuneView = document.getElementById("fortune-view");
      const fortuneText = document.getElementById("fortune-text");
      
      if (fortuneView && fortuneText) {
        fortuneText.textContent = fortune;
        fortuneView.style.display = "block";

        shouldLoop = false;
        
        const appRoot = document.getElementById("app-root");
        if (appRoot) {
          appRoot.style.top = "0";
        }
        
        setTimeout(() => {
          fortuneView.classList.add("visible");
        }, 50);
      }

      if (consultingOverlay) {
        setTimeout(() => {
          consultingOverlay.style.transition = "opacity 1.5s ease-out";
          consultingOverlay.style.opacity = "0";
          
          setTimeout(() => {
            consultingOverlay.classList.remove("visible");
            consultingOverlay.style.opacity = "";
            stopConsultingClouds();
          }, 1500);
        }, 9000);
      }

    }, remainingTime);

  });
}

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
  }, 1000);
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