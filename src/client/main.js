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
  consultingRenderer.setClearColor(0x000000, 0); // Transparent

  consultingScene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, -1.5, 2); // Lower, looking up
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

  // Spawn 40 clouds rising from below
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

    // Position clouds below the viewport, spread out
    cloud.position.set(
      (Math.random() - 0.5) * 8,
      -4 - Math.random() * 2, // Start lower
      -1 - Math.random() * 2
    );

    cloud.rotation.z = Math.random() * Math.PI * 2;

    // Store upward velocity for animation
    cloud.userData.riseSpeed = 0.015 + Math.random() * 0.01;
    cloud.userData.rotSpeed = (Math.random() - 0.5) * 0.005;

    consultingScene.add(cloud);
    consultingClouds.push(cloud);
  }

  console.log("Created", consultingClouds.length, "clouds");

  // Animation loop
let shouldLoop = true; // Track if clouds should loop back

function animateClouds() {
  consultingAnimationId = requestAnimationFrame(animateClouds);

  consultingClouds.forEach((cloud) => {
    // Rise upward
    cloud.position.y += cloud.userData.riseSpeed;
    // Rotate slowly
    cloud.rotation.z += cloud.userData.rotSpeed;

    // Only loop back down during first phase
    if (shouldLoop && cloud.position.y > 6) {
      cloud.position.y = -4 - Math.random() * 2;
    }
    // After shouldLoop=false, clouds just keep rising and disappear
  });

  consultingRenderer.render(consultingScene, camera);
}

// Stop looping after 4 seconds - clouds will drift away
setTimeout(() => {
  shouldLoop = false;
}, 4000);


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

async function fetchFortune(question) {
  // MOCK: Skip API call while testing animation
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate short network delay
  return "The stars whisper of change on the horizon. Trust your instincts, seeker.";
  
  // REAL API CALL (commented out for now):
  /*
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
  */
}

if (form && questionInput) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const question = questionInput.value.trim();
    if (!question) return;

    // Track when clouds started
    const cloudsStartTime = Date.now();

    // Start consulting overlay immediately
    if (consultingOverlay) {
      consultingOverlay.classList.add("visible");
      console.log("Overlay visible, about to start clouds");
      setTimeout(startConsultingClouds, 100);
    }

    // DELAY the UI dissolve so clouds rise first
    setTimeout(() => {
      if (appInner) {
        appInner.classList.add("app-consulting");
      }
      
      // Fade out logo at the same time as input box
      const logo = document.getElementById("splash-title");
      if (logo) {
        logo.style.transition = "opacity 1.2s ease";
        logo.style.opacity = "0";
      }
    }, 2400);

    let fortune;
    try {
      fortune = await fetchFortune(question);
    } catch (err) {
      console.error(err);
      fortune = "The nebula is silent. Try again.";
    }

    // Ensure clouds have been visible for at least 6 seconds
    const elapsed = Date.now() - cloudsStartTime;
    const minDisplayTime = 8000; // 8 seconds - gives clouds time to drift away    const remainingTime = Math.max(0, minDisplayTime - elapsed);
    console.log("API took:", elapsed, "ms. Waiting additional:", remainingTime, "ms");

    // Store fortune data BEFORE timing delays
    sessionStorage.setItem('fortuneText', fortune);
    sessionStorage.setItem('userQuestion', question);

    setTimeout(() => {
      // Navigate while clouds are still covering
      window.location.href = './reveal.html';
    }, remainingTime);

  });
}
