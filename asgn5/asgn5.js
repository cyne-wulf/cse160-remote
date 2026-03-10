// Assignment 5 — Japan Night Festival (Obon Matsuri)
// Full Temple Complex — CSE 160, WI26

// ---------------------------------------------------------------------------
// Section 1 — Imports
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { OrbitControls }      from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader }          from 'three/addons/loaders/GLTFLoader.js';

// ---------------------------------------------------------------------------
// Section 2 — Renderer
// ---------------------------------------------------------------------------
const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
const MAX_RENDER_PIXEL_RATIO = 1.25;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_RENDER_PIXEL_RATIO));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping         = THREE.LinearToneMapping;
renderer.toneMappingExposure = 1.2;
const gltfLoader = new GLTFLoader();
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
let shadowRefreshQueued = true;

function queueShadowRefresh() {
  shadowRefreshQueued = true;
}

// ---------------------------------------------------------------------------
// Section 3 — Scene + Fog
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a1a, 0.007); // lighter fog for larger scene

// ---------------------------------------------------------------------------
// Section 4 — Procedural Textures (9 total)
// ---------------------------------------------------------------------------
function makeTex(drawFn, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  drawFn(ctx, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function blendCanvasHorizontalSeam(ctx, w, h, blendWidth = 192) {
  const clampedBlendWidth = Math.max(1, Math.min(blendWidth, Math.floor(w / 2)));
  const leftStrip = ctx.getImageData(0, 0, clampedBlendWidth, h);
  const rightStrip = ctx.getImageData(w - clampedBlendWidth, 0, clampedBlendWidth, h);
  const leftData = leftStrip.data;
  const rightData = rightStrip.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < clampedBlendWidth; x++) {
      const blendT = x / Math.max(1, clampedBlendWidth - 1);
      const mirroredX = clampedBlendWidth - 1 - x;
      const leftIndex = (y * clampedBlendWidth + x) * 4;
      const rightIndex = (y * clampedBlendWidth + mirroredX) * 4;

      for (let c = 0; c < 4; c++) {
        const mixed = Math.round(leftData[leftIndex + c] * (1 - blendT) + rightData[rightIndex + c] * blendT);
        leftData[leftIndex + c] = mixed;
        rightData[rightIndex + c] = mixed;
      }
    }
  }

  ctx.putImageData(leftStrip, 0, 0);
  ctx.putImageData(rightStrip, w - clampedBlendWidth, 0);
}

// Stone — dark grey patches + grid mortar lines
const stoneTex = makeTex((ctx, w, h) => {
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#4a4a4a';
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random()*w, Math.random()*h, 20+Math.random()*40, 10+Math.random()*20, Math.random()*Math.PI, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for (let y = 0; y < h; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
});
stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;

// Lacquer — deep red with vertical grain + highlight streaks
const lacquerTex = makeTex((ctx, w, h) => {
  ctx.fillStyle = '#8b0000'; ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 4) {
    ctx.fillStyle = `rgba(255,100,100,${0.03+Math.random()*0.08})`;
    ctx.fillRect(x, 0, 2, h);
  }
  for (let i = 0; i < 8; i++) {
    const x = Math.random()*w;
    const g = ctx.createLinearGradient(x,0,x+20,h);
    g.addColorStop(0,'rgba(255,200,200,0.1)'); g.addColorStop(0.5,'rgba(255,200,200,0.25)'); g.addColorStop(1,'rgba(255,200,200,0.05)');
    ctx.fillStyle=g; ctx.fillRect(x,0,20,h);
  }
});

// Lantern — radial warm glow + horizontal ribs
const lanternTex = makeTex((ctx, w, h) => {
  const g = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
  g.addColorStop(0,'#ffe080'); g.addColorStop(0.5,'#ff9900'); g.addColorStop(1,'#cc4400');
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(80,20,0,0.4)'; ctx.lineWidth=3;
  for (let y=0; y<h; y+=32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
});

// Tile — near-black with arc scale pattern
const tileTex = makeTex((ctx, w, h) => {
  ctx.fillStyle='#111118'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#2a2a3a'; ctx.lineWidth=2;
  const s=32;
  for (let row=0; row*s<h+s; row++) {
    const off=(row%2)*(s/2);
    for (let col=-1; col*s<w+s; col++) {
      ctx.beginPath(); ctx.arc(col*s+off, row*s, s*0.55, 0.1*Math.PI, 0.9*Math.PI); ctx.stroke();
    }
  }
});

// Blossom — dark purple with random pink petal circles
const blossomTex = makeTex((ctx, w, h) => {
  ctx.fillStyle='#2d0a2d'; ctx.fillRect(0,0,w,h);
  for (let i=0; i<200; i++) {
    ctx.beginPath();
    ctx.arc(Math.random()*w, Math.random()*h, 3+Math.random()*12, 0, Math.PI*2);
    ctx.fillStyle=`rgba(255,${140+Math.floor(Math.random()*80)},${180+Math.floor(Math.random()*60)},${0.4+Math.random()*0.6})`;
    ctx.fill();
  }
});

// Sky — 4096² star field with horizon glow, nebula haze, Milky Way, and constellations
const skyTex = makeTex((ctx, w, h) => {
  const base = ctx.createLinearGradient(0, 0, 0, h);
  base.addColorStop(0.00, '#02030b');
  base.addColorStop(0.35, '#040816');
  base.addColorStop(0.68, '#08101f');
  base.addColorStop(1.00, '#13233d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  const horizonGlow = ctx.createLinearGradient(0, h * 0.55, 0, h);
  horizonGlow.addColorStop(0.00, 'rgba(0,0,0,0)');
  horizonGlow.addColorStop(0.45, 'rgba(24,46,82,0.20)');
  horizonGlow.addColorStop(0.75, 'rgba(46,76,128,0.30)');
  horizonGlow.addColorStop(1.00, 'rgba(88,132,198,0.40)');
  ctx.fillStyle = horizonGlow;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const alpha = 0.02 + Math.random() * 0.05;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }

  [
    [0.16, 0.22, 0.28, 0.18, 'rgba(70,95,190,0.26)'],
    [0.74, 0.24, 0.24, 0.16, 'rgba(78,42,120,0.24)'],
    [0.58, 0.48, 0.30, 0.18, 'rgba(38,108,120,0.18)'],
    [0.28, 0.56, 0.25, 0.14, 'rgba(120,52,92,0.18)'],
  ].forEach(([nx, ny, rx, ry, color]) => {
    const g = ctx.createRadialGradient(nx * w, ny * h, 0, nx * w, ny * h, Math.max(rx * w, ry * h));
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(nx * w, ny * h);
    ctx.scale(rx * w, ry * h);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  ctx.save();
  ctx.translate(w * 0.52, h * 0.30);
  ctx.rotate(-0.28);
  const milkyWay = ctx.createLinearGradient(-w * 0.48, 0, w * 0.48, 0);
  milkyWay.addColorStop(0.00, 'rgba(0,0,0,0)');
  milkyWay.addColorStop(0.18, 'rgba(80,95,170,0.10)');
  milkyWay.addColorStop(0.50, 'rgba(200,210,255,0.24)');
  milkyWay.addColorStop(0.82, 'rgba(98,110,180,0.12)');
  milkyWay.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = milkyWay;
  ctx.fillRect(-w * 0.5, -h * 0.08, w, h * 0.16);

  for (let i = 0; i < 2200; i++) {
    const x = (Math.random() - 0.5) * w * 0.92;
    const y = (Math.random() - 0.5) * h * 0.10;
    const size = 0.6 + Math.random() * 1.8;
    const alpha = 0.10 + Math.random() * 0.22;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(235,240,255,${alpha})`;
    ctx.fill();
  }
  ctx.restore();

  const drawGlowStar = (x, y, radius, color, glowAlpha) => {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 8);
    glow.addColorStop(0.00, `rgba(255,255,255,${glowAlpha})`);
    glow.addColorStop(0.35, color.replace('rgb', 'rgba').replace(')', `,${glowAlpha * 0.55})`));
    glow.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius * 8, y - radius * 8, radius * 16, radius * 16);

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = color.replace('rgb', 'rgba').replace(')', ',0.45)');
    ctx.lineWidth = Math.max(0.7, radius * 0.35);
    ctx.beginPath();
    ctx.moveTo(x - radius * 3.2, y);
    ctx.lineTo(x + radius * 3.2, y);
    ctx.moveTo(x, y - radius * 3.2);
    ctx.lineTo(x, y + radius * 3.2);
    ctx.stroke();
  };

  for (let i = 0; i < 6800; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h * 0.92;
    const roll = Math.random();
    const radius = roll < 0.014 ? 2.2 + Math.random() * 2.7
      : roll < 0.10 ? 0.9 + Math.random() * 1.2
      : 0.25 + Math.random() * 0.8;
    const alpha = 0.42 + Math.random() * 0.58;
    const color = roll < 0.72 ? `rgba(255,252,245,${alpha})`
      : roll < 0.84 ? `rgba(186,212,255,${alpha})`
      : roll < 0.95 ? `rgba(255,222,168,${alpha})`
      : `rgba(255,176,176,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    if (radius > 2.1) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 6.5);
      glow.addColorStop(0.00, 'rgba(255,244,220,0.22)');
      glow.addColorStop(0.45, 'rgba(190,210,255,0.10)');
      glow.addColorStop(1.00, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - radius * 7, y - radius * 7, radius * 14, radius * 14);
    }
  }

  [
    [[0.20, 0.24], [0.24, 0.21], [0.27, 0.25], [0.31, 0.22]],
    [[0.70, 0.18], [0.74, 0.16], [0.78, 0.20], [0.82, 0.17], [0.86, 0.22]],
    [[0.61, 0.40], [0.64, 0.37], [0.68, 0.39], [0.72, 0.35]],
  ].forEach((chain) => {
    ctx.strokeStyle = 'rgba(150,170,220,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    chain.forEach(([nx, ny], index) => {
      const x = nx * w;
      const y = ny * h;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    chain.forEach(([nx, ny]) => {
      drawGlowStar(nx * w, ny * h, 3.3, 'rgb(235,240,255)', 0.20);
    });
  });

  for (let i = 0; i < 3; i++) {
    const x = w * (0.18 + Math.random() * 0.64);
    const y = h * (0.10 + Math.random() * 0.28);
    const len = 140 + Math.random() * 120;
    const angle = -0.45 + Math.random() * 0.16;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const trail = ctx.createLinearGradient(0, 0, len, 0);
    trail.addColorStop(0.00, 'rgba(255,255,255,0.75)');
    trail.addColorStop(0.12, 'rgba(200,220,255,0.35)');
    trail.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = 2.0 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    drawGlowStar(0, 0, 2.6, 'rgb(255,250,240)', 0.24);
    ctx.restore();
  }

  blendCanvasHorizontalSeam(ctx, w, h, 256);
}, 2048);
skyTex.wrapS = THREE.RepeatWrapping;

// Bamboo — green with vertical grain + horizontal nodes
const bambooTex = makeTex((ctx, w, h) => {
  ctx.fillStyle='#3d6e2f'; ctx.fillRect(0,0,w,h);
  for (let x=0; x<w; x+=8) {
    ctx.fillStyle=`rgba(${x%2?80:60},${x%2?120:100},${x%2?40:30},0.4)`;
    ctx.fillRect(x,0,6,h);
  }
  ctx.fillStyle='#2a4e1f';
  for (let y=0; y<h; y+=80) { ctx.fillRect(0,y-3,w,6); }
});

// Wood — warm brown with wavy grain
const woodTex = makeTex((ctx, w, h) => {
  ctx.fillStyle='#5c3a1e'; ctx.fillRect(0,0,w,h);
  for (let i=0; i<30; i++) {
    const y=Math.random()*h;
    ctx.strokeStyle=`rgba(${60+Math.random()*30},${30+Math.random()*20},10,0.5)`;
    ctx.lineWidth=1+Math.random()*3;
    ctx.beginPath();
    ctx.moveTo(0,y);
    ctx.bezierCurveTo(w*0.3,y+Math.random()*20-10, w*0.7,y+Math.random()*20-10, w,y+5);
    ctx.stroke();
  }
});

// Gravel — raked sand with pebbles
const gravelTex = makeTex((ctx, w, h) => {
  ctx.fillStyle='#c8b89a'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='#b8a88a'; ctx.lineWidth=1;
  for (let y=0; y<h; y+=8) {
    ctx.beginPath();
    for (let x=0; x<w; x+=4) {
      const j=Math.sin(x*0.3+y*0.2)*2;
      x===0 ? ctx.moveTo(x,y+j) : ctx.lineTo(x,y+j);
    }
    ctx.stroke();
  }
  for (let i=0; i<100; i++) {
    ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, 1+Math.random()*2, 0, Math.PI*2);
    ctx.fillStyle=`rgba(160,145,120,${0.4+Math.random()*0.4})`; ctx.fill();
  }
});
gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping;

// ---------------------------------------------------------------------------
// Section 4.1 — Procedural Grass Texture
// ---------------------------------------------------------------------------
const grassTex = makeTex((ctx, w, h) => {
  const wrapDraw = (drawAt, x, y, rx, ry) => {
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        drawAt(x + ox, y + oy, rx, ry);
      }
    }
  };

  // Broad value shifts break up the terrain before the fine grass detail repeats.
  ctx.fillStyle = '#2f5f1f';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 22; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const radius = 80 + Math.random() * 120;
    const centerColor = `rgba(${55 + Math.random() * 30}, ${105 + Math.random() * 50}, ${30 + Math.random() * 25}, 0.30)`;
    wrapDraw((dx, dy, r) => {
      const gradient = ctx.createRadialGradient(dx, dy, 0, dx, dy, r);
      gradient.addColorStop(0, centerColor);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }, x, y, radius, radius);
  }

  for (let i = 0; i < 1000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const bh = 6 + Math.random() * 18;
    const bw = 1 + Math.random() * 1.4;
    const color = Math.random() > 0.45
      ? `rgba(${70 + Math.random() * 45}, ${135 + Math.random() * 55}, ${35 + Math.random() * 20}, ${0.10 + Math.random() * 0.12})`
      : `rgba(${18 + Math.random() * 22}, ${45 + Math.random() * 35}, ${10 + Math.random() * 14}, ${0.08 + Math.random() * 0.10})`;
    wrapDraw((dx, dy, rw, rh) => {
      ctx.fillStyle = color;
      ctx.fillRect(dx, dy, rw, rh);
    }, x, y, bw, bh);
  }

  for (let i = 0; i < 180; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rx = 8 + Math.random() * 22;
    const ry = 4 + Math.random() * 12;
    const rot = Math.random() * Math.PI;
    const color = `rgba(${35 + Math.random() * 28}, ${90 + Math.random() * 55}, ${18 + Math.random() * 18}, 0.10)`;
    wrapDraw((dx, dy, erx, ery) => {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, erx, ery, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }, x, y, rx, ry);
  }
}, 1024);
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(4, 4);
grassTex.anisotropy = maxAnisotropy;

// ---------------------------------------------------------------------------
// Section 5 — Skybox background (procedural equirectangular texture -> cubemap)
// ---------------------------------------------------------------------------
const skyboxTarget = new THREE.WebGLCubeRenderTarget(512);
skyboxTarget.fromEquirectangularTexture(renderer, skyTex);
scene.background = skyboxTarget.texture;

// ---------------------------------------------------------------------------
// Section 6 — Camera
// ---------------------------------------------------------------------------
const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 2000);
camera.position.set(0, 22, 58);

// ---------------------------------------------------------------------------
// Section 7 — OrbitControls
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 5, -12);
controls.enableDamping  = true;
controls.dampingFactor  = 0.05;
controls.maxPolarAngle  = Math.PI * 0.82;
controls.minDistance    = 5;
controls.maxDistance    = 150;
controls.update();

// ---------------------------------------------------------------------------
// Section 7b — Ground / FPS mode
// ---------------------------------------------------------------------------
const player = {
  speed:  8,      // units/sec
  height: 1.7,    // eye height above terrain
  radius: 0.42,   // horizontal body radius for broad object collision
  bodyHeight: 1.55,
  footOffset: 0.08,
  headroom: 0.32,
  skin: 0.04,
};

let fpVelY  = 0;   // vertical velocity for jump (units/sec)
const FP_LOOK_SPEED = 1.5;   // radians/sec for keyboard look
const FP_GRAVITY    = 20;    // units/sec²
const FP_JUMP_SPEED = 9;     // initial upward velocity on jump

const keys = { w:false, a:false, s:false, d:false, q:false, e:false, space:false };

let groundMode = false;
let suppressUnlockHandler = false;
const orbitSavedPos    = new THREE.Vector3();
const orbitSavedTarget = new THREE.Vector3();
const fpControls = new PointerLockControls(camera, renderer.domElement);
const fpForward = new THREE.Vector3();
const fpRight = new THREE.Vector3();
const fpMove = new THREE.Vector3();
const fpEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const worldUp = new THREE.Vector3(0, 1, 0);
const fpBodyMin = new THREE.Vector3();
const fpBodyMax = new THREE.Vector3();

if ('pointerSpeed' in fpControls) {
  fpControls.pointerSpeed = 1;
}
if ('minPolarAngle' in fpControls) {
  fpControls.minPolarAngle = Math.PI * 0.06;
}
if ('maxPolarAngle' in fpControls) {
  fpControls.maxPolarAngle = Math.PI * 0.94;
}

const infoBadge    = document.getElementById('mode-badge');
const infoControls = document.getElementById('info-controls');

function updateInfoText() {
  if (groundMode) {
    infoControls.innerHTML = 'WASD move &nbsp;|&nbsp; Mouse look &nbsp;|&nbsp; Q/E turn &nbsp;|&nbsp; Space jump &nbsp;|&nbsp; <strong>G</strong> or <strong>Esc</strong> = Fly mode';
    infoBadge.textContent = '[WALK]';
  } else {
    infoControls.innerHTML = 'Drag to orbit &nbsp;|&nbsp; Scroll to zoom &nbsp;|&nbsp; Right-drag to pan &nbsp;|&nbsp; <strong>G</strong> = Ground mode';
    infoBadge.textContent = '[FLY]';
  }
}

function enterGroundMode() {
  orbitSavedPos.copy(camera.position);
  orbitSavedTarget.copy(controls.target);
  controls.enabled = false;

  const minEyeY = terrainHeight(camera.position.x, camera.position.z) + player.height;
  camera.position.y = Math.max(camera.position.y, minEyeY);
  fpVelY = 0;
  groundMode = true;
  updateInfoText();
  fpControls.lock();
}

function exitGroundMode({ unlockPointer = true } = {}) {
  if (!groundMode && !unlockPointer) return;

  groundMode = false;
  if (unlockPointer && fpControls.isLocked) {
    suppressUnlockHandler = true;
    fpControls.unlock();
  }

  controls.enabled = true;
  camera.position.copy(orbitSavedPos);
  controls.target.copy(orbitSavedTarget);
  controls.update();
  updateInfoText();
}

function toggleMode() {
  if (groundMode) exitGroundMode();
  else enterGroundMode();
}

fpControls.addEventListener('unlock', () => {
  if (suppressUnlockHandler) {
    suppressUnlockHandler = false;
    return;
  }

  if (groundMode) {
    exitGroundMode({ unlockPointer: false });
  }
});

window.addEventListener('keydown', e => {
  if (e.code === 'KeyW') keys.w = true;
  if (e.code === 'KeyA') keys.a = true;
  if (e.code === 'KeyS') keys.s = true;
  if (e.code === 'KeyD') keys.d = true;
  if (e.code === 'KeyQ') keys.q = true;
  if (e.code === 'KeyE') keys.e = true;
  if (e.code === 'Space') keys.space = true;
  if (e.code === 'KeyG') toggleMode();
});
window.addEventListener('keyup', e => {
  if (e.code === 'KeyW') keys.w = false;
  if (e.code === 'KeyA') keys.a = false;
  if (e.code === 'KeyS') keys.s = false;
  if (e.code === 'KeyD') keys.d = false;
  if (e.code === 'KeyQ') keys.q = false;
  if (e.code === 'KeyE') keys.e = false;
  if (e.code === 'Space') keys.space = false;
});

// ---------------------------------------------------------------------------
// Section 8 — Lights (5 types)
// ---------------------------------------------------------------------------

// 1. AmbientLight
const ambientLight = new THREE.AmbientLight(0x446688, 2.5);
scene.add(ambientLight);

// 2. HemisphereLight
const hemiLight = new THREE.HemisphereLight(0x223366, 0x111122, 1.5);
scene.add(hemiLight);

// 3. DirectionalLight — moonlight, large shadow frustum for full scene
const moonLight = new THREE.DirectionalLight(0xb8c8ff, 2.0);
moonLight.position.set(-30, 50, -20);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.near   = 0.5;
moonLight.shadow.camera.far    = 300;
moonLight.shadow.camera.left   = -70;
moonLight.shadow.camera.right  =  70;
moonLight.shadow.camera.top    =  70;
moonLight.shadow.camera.bottom = -70;
scene.add(moonLight);
scene.add(moonLight.target); // target at origin

// 4. PointLights — stone lanterns (8, spread along approach and compound)
const lanternLightPositions = [
  [-4.5, 2.5,  +15], [ 4.5, 2.5,  +15],
  [-4.5, 2.5,   +5], [ 4.5, 2.5,   +5],
  [-4.5, 2.5,   -5], [ 4.5, 2.5,   -5],
  [-4.5, 2.5,  -16], [ 4.5, 2.5,  -16],
];
const lanternLights = lanternLightPositions.map(([x, y, z]) => {
  const pl = new THREE.PointLight(0xff9933, 8, 12);
  pl.position.set(x, y, z);
  scene.add(pl);
  return pl;
});

// 5. SpotLight — uplight main torii gate
const toriiSpot = new THREE.SpotLight(0xff6622, 18, 40, Math.PI / 9, 0.3);
toriiSpot.position.set(0, 0.5, -4);
toriiSpot.castShadow = true;
scene.add(toriiSpot);
toriiSpot.target.position.set(0, 11, -12);
scene.add(toriiSpot.target);

// Extra warm point light over festival stage
const stageLight = new THREE.PointLight(0xffcc44, 12, 20);
stageLight.position.set(12, 8, 18);
scene.add(stageLight);

// ---------------------------------------------------------------------------
// Section 9 — Full Temple Complex
// ---------------------------------------------------------------------------

// --- Materials ---
const matLacquer   = new THREE.MeshPhongMaterial({ map: lacquerTex, shininess: 120 });
const matStone     = new THREE.MeshPhongMaterial({ map: stoneTex });
const matTile      = new THREE.MeshPhongMaterial({ map: tileTex });
const matLanternM  = new THREE.MeshPhongMaterial({
  map: lanternTex, emissive: new THREE.Color(0xff6600), emissiveIntensity: 0.7,
});
const matBlossom   = new THREE.MeshPhongMaterial({
  map: blossomTex, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
});
const matTrunk     = new THREE.MeshPhongMaterial({ color: 0x4a2800 });
const matMoon      = new THREE.MeshBasicMaterial({ color: 0xfff8e8 });
const matWater     = new THREE.MeshPhongMaterial({
  color: 0x001a33, transparent: true, opacity: 0.75, shininess: 200,
});
const matFuji      = new THREE.MeshPhongMaterial({ color: 0x334455 });
const matFujiSnow  = new THREE.MeshPhongMaterial({ color: 0xeef4ff });
const matBamboo    = new THREE.MeshPhongMaterial({ map: bambooTex });
const matWood      = new THREE.MeshPhongMaterial({ map: woodTex });
const matGravel    = new THREE.MeshPhongMaterial({ map: gravelTex });
const matPine      = new THREE.MeshPhongMaterial({ color: 0x1a4a1a });
const matGold      = new THREE.MeshPhongMaterial({ color: 0xd4a800, shininess: 180 });
const matPaper     = new THREE.MeshPhongMaterial({
  color: 0xdd2200, emissive: new THREE.Color(0x881100), emissiveIntensity: 0.4,
  transparent: true, opacity: 0.9,
});
const matWhiteWood = new THREE.MeshPhongMaterial({ color: 0xf0e8d0 });
const matKoi       = new THREE.MeshPhongMaterial({
  color: 0xff5500, emissive: new THREE.Color(0xff3300), emissiveIntensity: 0.5,
});

const collisionRegistry = [];
const worldCollisionBox = new THREE.Box3();

function normalizeCollisionPadding(padding = 0) {
  if (typeof padding === 'number') {
    return { x: padding, y: padding, z: padding };
  }
  return {
    x: padding.x || 0,
    y: padding.y || 0,
    z: padding.z || 0,
  };
}

function registerCollisionBounds(minX, minY, minZ, maxX, maxY, maxZ, source = 'static') {
  collisionRegistry.push({ minX, minY, minZ, maxX, maxY, maxZ, source });
}

function registerCollisionVolume(cx, cy, cz, sx, sy, sz, options = {}) {
  const padding = normalizeCollisionPadding(options.padding);
  const halfX = sx * 0.5 + padding.x;
  const halfY = sy * 0.5 + padding.y;
  const halfZ = sz * 0.5 + padding.z;
  registerCollisionBounds(
    cx - halfX,
    cy - halfY,
    cz - halfZ,
    cx + halfX,
    cy + halfY,
    cz + halfZ,
    options.source
  );
}

function registerCollisionBox(object, options = {}) {
  object.updateWorldMatrix(true, true);
  worldCollisionBox.setFromObject(object);
  if (worldCollisionBox.isEmpty()) return null;

  const padding = normalizeCollisionPadding(options.padding);
  registerCollisionBounds(
    worldCollisionBox.min.x - padding.x,
    worldCollisionBox.min.y - padding.y,
    worldCollisionBox.min.z - padding.z,
    worldCollisionBox.max.x + padding.x,
    worldCollisionBox.max.y + padding.y,
    worldCollisionBox.max.z + padding.z,
    options.source || object.name || object.userData?.sourceKey || 'mesh'
  );
  return object;
}

function freezeStaticObject(root) {
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    child.matrixAutoUpdate = false;
    child.updateMatrix();
  });
}

function freezeStaticSceneMeshes(dynamicRoots) {
  const dynamicRootSet = new Set(dynamicRoots);
  scene.traverse((object) => {
    if (!object.isMesh) return;

    let current = object;
    while (current) {
      if (dynamicRootSet.has(current)) return;
      current = current.parent;
    }

    object.matrixAutoUpdate = false;
    object.updateMatrix();
  });
}

function setPlayerCollisionBounds(x, z, eyeY) {
  const bodyMinY = eyeY - player.height + player.footOffset;
  const bodyMaxY = Math.max(bodyMinY + player.bodyHeight, eyeY + player.headroom);
  const radius = player.radius + player.skin;
  fpBodyMin.set(x - radius, bodyMinY, z - radius);
  fpBodyMax.set(x + radius, bodyMaxY, z + radius);
}

function collidesAt(x, z, eyeY) {
  setPlayerCollisionBounds(x, z, eyeY);
  for (const blocker of collisionRegistry) {
    if (fpBodyMax.x <= blocker.minX || fpBodyMin.x >= blocker.maxX) continue;
    if (fpBodyMax.y <= blocker.minY || fpBodyMin.y >= blocker.maxY) continue;
    if (fpBodyMax.z <= blocker.minZ || fpBodyMin.z >= blocker.maxZ) continue;
    return true;
  }
  return false;
}

function movePlayerWithCollisions(moveX, moveZ) {
  if (Math.abs(moveX) > 1e-6) {
    const nextX = THREE.MathUtils.clamp(camera.position.x + moveX, -85, 85);
    if (!collidesAt(nextX, camera.position.z, camera.position.y)) {
      camera.position.x = nextX;
    }
  }

  if (Math.abs(moveZ) > 1e-6) {
    const nextZ = THREE.MathUtils.clamp(camera.position.z + moveZ, -85, 85);
    if (!collidesAt(camera.position.x, nextZ, camera.position.y)) {
      camera.position.z = nextZ;
    }
  }
}

function addMesh(geo, mat, x, y, z, collision = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow    = !(mat.transparent || mat === matLanternM || mat === matWater || mat === matKoi);
  m.receiveShadow = true;
  scene.add(m);
  if (collision) {
    registerCollisionBox(m, collision === true ? {} : collision);
  }
  return m;
}

function addScaledMesh(geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, collision = null) {
  const m = addMesh(geo, mat, x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.set(rx, ry, rz);
  if (collision) {
    registerCollisionBox(m, collision === true ? {} : collision);
  }
  return m;
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function plateauMask(x, z, cx, cz, rx, rz, feather = 0.22) {
  const nx = Math.abs(x - cx) / rx;
  const nz = Math.abs(z - cz) / rz;
  const d = Math.max(nx, nz);
  return 1 - smoothstep(1 - feather, 1, d);
}

function terrainHeight(x, z) {
  const dx = x / 28;
  const dz = (z + 22) / 48;
  const compound = Math.max(Math.abs(dx), Math.abs(dz));
  const outsideBlend = smoothstep(0.72, 1.18, compound);
  const ridgeBlend = smoothstep(0.56, 0.95, compound);
  const lowFreq = Math.sin(x * 0.085) * 1.4 + Math.cos(z * 0.07) * 1.2;
  const ripples = Math.sin((x + z) * 0.12) * 0.6 + Math.cos((x - z) * 0.08) * 0.55;
  const westHill = Math.max(0, 1 - Math.hypot((x + 34) / 16, (z + 10) / 26)) * 8.5;
  const eastHill = Math.max(0, 1 - Math.hypot((x - 34) / 18, (z + 18) / 30)) * 7.0;
  const backRise = Math.max(0, 1 - Math.hypot((x + 4) / 34, (z + 76) / 24)) * 13.0;
  const pondDip = Math.max(0, 1 - Math.hypot((x + 24) / 14, (z - 12) / 10)) * 1.6;
  const approachFlatten = 1 - smoothstep(3, 12, Math.abs(x)) * smoothstep(-2, 28, z);

  let h = (lowFreq + ripples) * outsideBlend;
  h += (westHill + eastHill + backRise) * ridgeBlend;
  h -= pondDip * outsideBlend;
  h *= 0.95;
  h *= 1 - approachFlatten * 0.55;

  // Broad flat valley floor for the temple grounds, pond, and festival area.
  const valleyMask = plateauMask(x, z, 0, -12, 40, 56, 0.34);
  h = THREE.MathUtils.lerp(h, 0, valleyMask);

  return h;
}

function terrainPoint(x, z, offset = 0) {
  return new THREE.Vector3(x, terrainHeight(x, z) + offset, z);
}

// ---------------------------------------------------------------------------
// Section 8c — Placement Helpers
// ---------------------------------------------------------------------------
function roundPlacementValue(value) {
  return Number(value.toFixed(4));
}

function createTerrainPlacement(sourceKey, x, z, yOffset, scale = 1, rotationY = 0, extra = {}) {
  return {
    placementId: extra.placementId || sourceKey,
    kind: extra.kind || 'group',
    sourceKey,
    anchorMode: 'terrain',
    position: {
      x: roundPlacementValue(x),
      z: roundPlacementValue(z),
      yOffset: roundPlacementValue(yOffset),
    },
    rotation: {
      y: roundPlacementValue(rotationY),
    },
    scale: roundPlacementValue(scale),
    edited: false,
  };
}

function createAbsolutePlacement(sourceKey, x, y, z, scale = 1, rotationY = 0, extra = {}) {
  return {
    placementId: extra.placementId || sourceKey,
    kind: extra.kind || 'group',
    sourceKey,
    anchorMode: 'absolute',
    position: {
      x: roundPlacementValue(x),
      y: roundPlacementValue(y),
      z: roundPlacementValue(z),
    },
    rotation: {
      y: roundPlacementValue(rotationY),
    },
    scale: roundPlacementValue(scale),
    edited: false,
  };
}


// ── 9.1  Ground & Gardens ───────────────────────────────────────────────────
stoneTex.repeat.set(20, 20);
const terrainGeo = new THREE.PlaneGeometry(180, 180, 84, 84);
const terrainPos = terrainGeo.attributes.position;
for (let i = 0; i < terrainPos.count; i++) {
  const x = terrainPos.getX(i);
  const z = terrainPos.getY(i);
  terrainPos.setZ(i, terrainHeight(x, z));
}
terrainGeo.rotateX(-Math.PI / 2);
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({
  map: grassTex,
  color: 0xffffff,
  roughness: 0.95,
  metalness: 0.0,
});
const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

const courtyardMesh = new THREE.Mesh(new THREE.PlaneGeometry(60, 78), matStone);
courtyardMesh.rotation.x = -Math.PI / 2;
courtyardMesh.position.set(0, 0.02, -18);
courtyardMesh.receiveShadow = true;
scene.add(courtyardMesh);

// Raked gravel garden inside compound
gravelTex.repeat.set(8, 8);
const gardenMesh = new THREE.Mesh(new THREE.PlaneGeometry(42, 36), matGravel);
gardenMesh.rotation.x = -Math.PI / 2;
gardenMesh.position.set(0, 0.01, -28);
gardenMesh.receiveShadow = true;
scene.add(gardenMesh);

// Low retaining stones marking the transition from level sacred ground to the hills.
[-26, 26].forEach((x) => {
  for (let i = 0; i < 9; i++) {
    addMesh(new THREE.BoxGeometry(0.8, 0.9, 7.4), matStone, x, 0.45, 10 - i * 8);
  }
});
for (let i = 0; i < 7; i++) {
  addMesh(new THREE.BoxGeometry(7.2, 0.9, 0.8), matStone, -18 + i * 6, 0.45, -57);
}
registerCollisionVolume(-26, 0.45, -22, 1.0, 0.9, 71, { source: 'retaining-wall-west' });
registerCollisionVolume(26, 0.45, -22, 1.0, 0.9, 71, { source: 'retaining-wall-east' });
registerCollisionVolume(0, 0.45, -57, 43.2, 0.9, 1.0, { source: 'retaining-wall-back' });

// Main approach path slabs (12)
for (let i = 0; i < 12; i++) {
  addMesh(new THREE.BoxGeometry(3.5, 0.16, 1.8), matStone, 0, 0.08, 22 - i * 4);
}

// Side stepping-stone paths (10 total)
for (let i = 0; i < 5; i++) {
  addMesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), matStone,  -7, 0.05,  8 - i * 4);
  addMesh(new THREE.BoxGeometry(1.0, 0.1, 1.0), matStone,   7, 0.05,  8 - i * 4);
}

// Broad front stair that lets the complex read as a raised terrace.
for (let i = 0; i < 4; i++) {
  addMesh(new THREE.BoxGeometry(18 - i * 2.2, 0.22, 2.8), matStone, 0, 0.11 + i * 0.22, 28 - i * 2.1);
}

// ── 9.2  Four Torii Gates (GLB model) ────────────────────────────────────────
// Staged through the broad front grounds so the empty foreground reads like a
// ceremonial approach instead of leftover space.
const toriiGatePlacements = [
//   { x: 0.0, z: 68, targetH: 4.8, rotY: 0, yOffset: 0 },
//   { x: 0.0, z: 54, targetH: 5.2, rotY: 0, yOffset: 0 },
//   { x: 0.0, z: 40, targetH: 5.7, rotY: 0, yOffset: 0 },
  { x: 0.0, z: 26, targetH: 6.2, rotY: 0.85, yOffset: .4 },
];

// ── 9.3  Stone Lantern Avenue (9 pairs × 4 shapes = 72 shapes) ──────────────
function addStoneLantern(x, z) {
  addMesh(new THREE.CylinderGeometry(0.17, 0.22, 0.65, 6), matStone,   x, 0.33, z);
  addMesh(new THREE.BoxGeometry(0.55, 0.55, 0.55),          matLanternM, x, 0.88, z);
  addMesh(new THREE.BoxGeometry(0.72, 0.1, 0.72),           matStone,   x, 1.19, z);
  addMesh(new THREE.ConeGeometry(0.46, 0.48, 4),            matStone,   x, 1.52, z);
  registerCollisionVolume(x, 0.85, z, 0.9, 1.7, 0.9, {
    source: 'stone-lantern',
    padding: { x: 0.04, z: 0.04 },
  });
}

for (let i = 0; i < 9; i++) {
  const z = 18 - i * 4.5;
  addStoneLantern(-4.5, z);
  addStoneLantern( 4.5, z);
}

// ── 9.4  Compound Perimeter Walls ────────────────────────────────────────────
// Side walls (8 segments each side, z = -8 to -48)
for (let i = 0; i < 8; i++) {
  const wz = -10 - i * 5;
  addMesh(new THREE.BoxGeometry(0.5, 2.5, 5.2), matStone, -21, 1.25, wz);
  addMesh(new THREE.BoxGeometry(0.5, 2.5, 5.2), matStone,  21, 1.25, wz);
  // Wall cap tiles
  addMesh(new THREE.BoxGeometry(0.7, 0.3, 5.4), matTile, -21, 2.65, wz);
  addMesh(new THREE.BoxGeometry(0.7, 0.3, 5.4), matTile,  21, 2.65, wz);
}
// Front wall flanking main torii
addMesh(new THREE.BoxGeometry(11.5, 2.5, 0.5), matStone, -14.8, 1.25, -8);
addMesh(new THREE.BoxGeometry(11.5, 2.5, 0.5), matStone,  14.8, 1.25, -8);
addMesh(new THREE.BoxGeometry(12.2, 0.3, 0.7), matTile,  -14.8, 2.65, -8);
addMesh(new THREE.BoxGeometry(12.2, 0.3, 0.7), matTile,   14.8, 2.65, -8);
// Back wall
addMesh(new THREE.BoxGeometry(42.5, 2.5, 0.5), matStone, 0, 1.25, -50);
addMesh(new THREE.BoxGeometry(43.2, 0.3, 0.7), matTile,  0, 2.65, -50);
registerCollisionVolume(-21, 1.25, -27.5, 0.7, 2.8, 40.4, { source: 'compound-wall-west' });
registerCollisionVolume(21, 1.25, -27.5, 0.7, 2.8, 40.4, { source: 'compound-wall-east' });
registerCollisionVolume(-14.8, 1.25, -8, 11.8, 2.8, 0.8, { source: 'compound-wall-front-west' });
registerCollisionVolume(14.8, 1.25, -8, 11.8, 2.8, 0.8, { source: 'compound-wall-front-east' });
registerCollisionVolume(0, 1.25, -50, 42.8, 2.8, 0.8, { source: 'compound-wall-back' });

// ── 9.5  Temizuya — Purification Water Pavilion (left of main gate) ──────────
const [TWX, TWZ] = [-13, -9];
const TWY = terrainHeight(TWX, TWZ);
// Four corner posts
[[-1.5,-1.2],[1.5,-1.2],[-1.5,1.2],[1.5,1.2]].forEach(([dx,dz]) => {
  addMesh(new THREE.CylinderGeometry(0.14,0.14,3.0,8), matWood, TWX+dx, TWY + 1.5, TWZ+dz);
});
addMesh(new THREE.BoxGeometry(3.5,0.15,0.15), matWood, TWX, TWY + 2.9, TWZ); // ridgepole
const twRoof = addMesh(new THREE.ConeGeometry(2.6,1.3,4), matTile, TWX, TWY + 3.55, TWZ);
twRoof.rotation.y = Math.PI / 4;
addMesh(new THREE.BoxGeometry(2.2,0.6,1.4), matStone, TWX, TWY + 0.6, TWZ);       // basin
addMesh(new THREE.BoxGeometry(1.8,0.07,1.0), matWater, TWX, TWY + 0.94, TWZ);     // water
registerCollisionVolume(TWX, TWY + 1.25, TWZ, 3.4, 2.5, 2.8, {
  source: 'temizuya',
  padding: { x: 0.1, z: 0.1 },
});

// ── 9.6  Guardian Lion-Dogs (Komainu) ────────────────────────────────────────
[-5, 5].forEach(x => {
  addMesh(new THREE.BoxGeometry(0.9,0.5,0.9), matStone, x,  0.25, -10);  // body
  addMesh(new THREE.SphereGeometry(0.42,8,6), matStone, x,  0.82, -9.7); // head
  addMesh(new THREE.ConeGeometry(0.14,0.38,6), matStone, x, 1.28, -9.7); // topknot
  addMesh(new THREE.BoxGeometry(1.1,0.12,1.1), matStone, x, 0.06, -10);  // pedestal
});

// ── 9.7  Haiden — Worship Hall ───────────────────────────────────────────────
const [HDX, HDZ] = [0, -22];

// Platform + steps
addMesh(new THREE.BoxGeometry(16, 1.0, 12), matStone, HDX, 0.5, HDZ);
addMesh(new THREE.BoxGeometry(5.5, 0.28, 1.2), matStone, HDX, 0.28, HDZ+6.6);
addMesh(new THREE.BoxGeometry(5.5, 0.28, 1.2), matStone, HDX, 0.56, HDZ+5.4);
addMesh(new THREE.BoxGeometry(5.5, 0.28, 1.2), matStone, HDX, 0.84, HDZ+4.2);

// Engawa floor
addMesh(new THREE.BoxGeometry(16, 0.18, 12), matWood, HDX, 1.09, HDZ);

// Front pillars (6)
for (let i = 0; i < 6; i++) {
  addMesh(new THREE.CylinderGeometry(0.18,0.2,4.6,10), matLacquer, HDX-6+i*2.4, 3.4, HDZ+5.9);
}
// Back + side pillars (4)
[[-6.9, HDZ+2],[ 6.9, HDZ+2],[-6.9, HDZ-2],[6.9, HDZ-2]].forEach(([px,pz]) => {
  addMesh(new THREE.CylinderGeometry(0.18,0.2,4.6,10), matLacquer, px, 3.4, pz);
});

// Main body
addMesh(new THREE.BoxGeometry(13, 4.6, 9), matWood, HDX, 3.4, HDZ);

// Shoji screen panels (front, 4 panels)
for (let i = 0; i < 4; i++) {
  addMesh(new THREE.BoxGeometry(2.4,3.4,0.1), matWhiteWood, HDX-3.6+i*2.4, 3.0, HDZ+4.6);
}

// Eave + hip roof
addMesh(new THREE.BoxGeometry(16, 0.5, 10.2), matLacquer, HDX, 5.85, HDZ);
const hdRoof = addMesh(new THREE.ConeGeometry(9.8, 3.6, 4), matTile, HDX, 7.65, HDZ);
hdRoof.rotation.y = Math.PI / 4;

// Ridge, finial, chigi (decorative ridge horns)
addMesh(new THREE.BoxGeometry(12, 0.38, 0.38), matLacquer, HDX, 9.45, HDZ);
addMesh(new THREE.SphereGeometry(0.3, 8, 6),   matGold,    HDX, 9.9,  HDZ);
addMesh(new THREE.BoxGeometry(0.25,1.1,0.25),  matGold,    HDX-5.8, 9.6, HDZ);
addMesh(new THREE.BoxGeometry(0.25,1.1,0.25),  matGold,    HDX+5.8, 9.6, HDZ);

// Front gable gold trim + offertory box
addMesh(new THREE.BoxGeometry(8.5, 0.18, 0.12), matGold, HDX, 8.3, HDZ+4.9);
addMesh(new THREE.BoxGeometry(1.5, 0.9, 0.95),  matWood, HDX, 1.95, HDZ+4.9);
registerCollisionVolume(HDX, 3.45, HDZ, 13.2, 5.3, 9.2, {
  source: 'haiden',
  padding: { x: 0.15, z: 0.15 },
});

// ── 9.8  Honden — Inner Main Shrine (most sacred) ────────────────────────────
const [HNX, HNZ] = [0, -39];

// Double platform
addMesh(new THREE.BoxGeometry(13, 1.2, 10), matStone, HNX, 0.6, HNZ);
addMesh(new THREE.BoxGeometry(11, 0.8, 8),  matWood,  HNX, 1.6, HNZ);

// Steps (3)
addMesh(new THREE.BoxGeometry(4.2,0.38,0.9), matStone, HNX, 0.38, HNZ+5.4);
addMesh(new THREE.BoxGeometry(4.2,0.38,0.9), matStone, HNX, 0.76, HNZ+4.5);
addMesh(new THREE.BoxGeometry(4.2,0.38,0.9), matStone, HNX, 1.14, HNZ+3.6);

// Corner + front pillars
[[-4.2,HNZ+3.3],[4.2,HNZ+3.3],[-4.2,HNZ-3.3],[4.2,HNZ-3.3],[-2,HNZ+3.3],[2,HNZ+3.3]].forEach(([px,pz]) => {
  addMesh(new THREE.CylinderGeometry(0.2,0.22,4.6,10), matLacquer, px, 4.2, pz);
});

// Main body + gold trim bands
addMesh(new THREE.BoxGeometry(10, 4.6, 7.5), matWood, HNX, 4.2, HNZ);
addMesh(new THREE.BoxGeometry(9.2, 0.28, 0.1), matGold, HNX, 3.4, HNZ+3.78);
addMesh(new THREE.BoxGeometry(9.2, 0.28, 0.1), matGold, HNX, 5.0, HNZ+3.78);

// Eave
addMesh(new THREE.BoxGeometry(12, 0.5, 9.5), matLacquer, HNX, 6.8, HNZ);

// Double roof (irimoya style) — lower hip + upper gable
const hnRoof1 = addMesh(new THREE.ConeGeometry(8.0, 2.6, 4), matTile, HNX, 8.1, HNZ);
hnRoof1.rotation.y = Math.PI / 4;
const hnRoof2 = addMesh(new THREE.ConeGeometry(5.8, 3.0, 4), matTile, HNX, 10.8, HNZ);
hnRoof2.rotation.y = Math.PI / 4;

// Ridge, spire, gold accents
addMesh(new THREE.BoxGeometry(9, 0.35, 0.35), matLacquer,  HNX, 12.3, HNZ);
addMesh(new THREE.SphereGeometry(0.42,8,6),   matGold,     HNX, 12.85, HNZ);
addMesh(new THREE.ConeGeometry(0.16,1.6,8),   matGold,     HNX, 13.8, HNZ);
addMesh(new THREE.SphereGeometry(0.25,6,4),   matGold,     HNX-4.2, 12.45, HNZ);
addMesh(new THREE.SphereGeometry(0.25,6,4),   matGold,     HNX+4.2, 12.45, HNZ);
registerCollisionVolume(HNX, 4.2, HNZ, 10.4, 5.0, 7.9, {
  source: 'honden',
  padding: { x: 0.15, z: 0.15 },
});

// ── 9.9  Bell Tower (Shōrō) ──────────────────────────────────────────────────
const [BTX, BTZ] = [18, -15];

[[-2,-1.5],[2,-1.5],[-2,1.5],[2,1.5]].forEach(([dx,dz]) => {
  addMesh(new THREE.CylinderGeometry(0.22,0.27,5.8,8), matWood, BTX+dx, 2.9, BTZ+dz);
});
// Cross-beams
addMesh(new THREE.BoxGeometry(5.2,0.24,0.24), matWood, BTX, 5.4, BTZ-1.5);
addMesh(new THREE.BoxGeometry(5.2,0.24,0.24), matWood, BTX, 5.4, BTZ+1.5);
addMesh(new THREE.BoxGeometry(0.24,0.24,3.8), matWood, BTX-2, 5.4, BTZ);
addMesh(new THREE.BoxGeometry(0.24,0.24,3.8), matWood, BTX+2, 5.4, BTZ);
// Roof
const btRoof = addMesh(new THREE.ConeGeometry(3.6, 2.2, 4), matTile, BTX, 7.2, BTZ);
btRoof.rotation.y = Math.PI / 4;
// Bonshō bell body + ring + rope
const bellMesh = addMesh(new THREE.CylinderGeometry(0.52,0.72,1.5,14), matGold, BTX, 3.9, BTZ);
addMesh(new THREE.TorusGeometry(0.58,0.1,8,16), matGold, BTX, 4.65, BTZ);
addMesh(new THREE.CylinderGeometry(0.04,0.04,2.2,5), matWood, BTX+0.8, 4.4, BTZ-1.8); // swing rope
registerCollisionVolume(BTX, 2.9, BTZ, 4.8, 5.8, 3.8, {
  source: 'bell-tower',
  padding: { x: 0.1, z: 0.1 },
});

// ── 9.10  Treasure House (Hōzō) ──────────────────────────────────────────────
const [THX, THZ] = [18, -33];
addMesh(new THREE.BoxGeometry(8.5, 1.0, 6.5), matStone, THX, 0.5, THZ);
addMesh(new THREE.BoxGeometry(7.2, 3.6, 5.5), matWood,  THX, 2.8, THZ);
addMesh(new THREE.BoxGeometry(8.4, 0.36, 6.2), matLacquer, THX, 4.78, THZ);
const thRoof = addMesh(new THREE.ConeGeometry(5.2, 2.2, 4), matTile, THX, 6.0, THZ);
thRoof.rotation.y = Math.PI / 4;
addMesh(new THREE.BoxGeometry(5.8, 0.22, 0.28), matLacquer, THX, 7.1, THZ);
addMesh(new THREE.BoxGeometry(1.6, 2.3, 0.12), matLacquer, THX, 2.15, THZ+2.78); // door
registerCollisionVolume(THX, 2.8, THZ, 7.4, 4.2, 5.8, {
  source: 'treasure-house',
  padding: { x: 0.15, z: 0.15 },
});

// ── 9.11  Five-Story Pagoda ───────────────────────────────────────────────────
const [PGX, PGZ] = [-13, -55];
addMesh(new THREE.BoxGeometry(7, 0.85, 7), matStone, PGX, 0.43, PGZ);
const pgTiers = [
  {bw:6.0,bh:2.6,rr:4.4,rh:1.3},
  {bw:4.6,bh:2.1,rr:3.5,rh:1.1},
  {bw:3.5,bh:1.9,rr:2.7,rh:0.95},
  {bw:2.6,bh:1.6,rr:2.0,rh:0.8},
  {bw:1.9,bh:1.3,rr:1.5,rh:0.68},
];
let pgY = 0.85;
pgTiers.forEach(({bw,bh,rr,rh}) => {
  pgY += bh / 2;
  addMesh(new THREE.BoxGeometry(bw,bh,bw), matTile, PGX, pgY, PGZ);
  pgY += bh/2 + rh/2;
  addMesh(new THREE.ConeGeometry(rr,rh,4), matLacquer, PGX, pgY, PGZ).rotation.y = Math.PI/4;
  pgY += rh/2;
});
addMesh(new THREE.ConeGeometry(0.2,2.8,8), matGold, PGX, pgY+1.4, PGZ); // spire
registerCollisionVolume(PGX, 4.2, PGZ, 6.6, 8.4, 6.6, {
  source: 'pagoda',
  padding: { x: 0.12, z: 0.12 },
});

// Dry-garden accent stones around the pagoda base.
[
  [-17.5, -58.5, 1.2, 0.8, 1.0],
  [-9.2, -58.0, 1.0, 0.7, 0.9],
  [-18.4, -51.7, 0.9, 0.6, 0.8],
  [-8.5, -50.8, 1.1, 0.75, 1.0],
].forEach(([x, z, sx, sy, sz]) => {
  const stone = addMesh(new THREE.DodecahedronGeometry(0.9, 0), matStone, x, 0.45, z);
  stone.scale.set(sx, sy, sz);
  stone.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.4);
});

// ── 9.12  Bamboo Grove (left side, 22 stalks) ────────────────────────────────
const bambooSpots = [
  [-17,-6],[-18,-10],[-20,-14],[-16,-18],[-22,-22],[-18,-26],[-19,-12],[-21,-8],
  [-23,-16],[-17,-20],[-22,-28],[-24,-10],[-20,-30],[-16,-24],[-19,-32],
  [-21,-5],[-23,-20],[-18,-16],[-20,-8],[-16,-28],[-22,-34],[-19,-38],
];
bambooSpots.forEach(([bx,bz]) => {
  const h = 7 + Math.random() * 5;
  addMesh(new THREE.CylinderGeometry(0.11,0.15,h,6), matBamboo,
    bx+(Math.random()-0.5)*0.8, h/2, bz+(Math.random()-0.5)*0.8);
});

// ── 9.13  Pine Trees (right side, 6 trees × 4 shapes = 24) ──────────────────
function addPineTree(x, z) {
  const h = 5 + Math.random() * 3;
  addMesh(new THREE.CylinderGeometry(0.18,0.34,h*0.55,8), matTrunk, x, h*0.275, z, { padding: 0.05 });
  addMesh(new THREE.ConeGeometry(2.9,2.4,8), matPine, x, h*0.55+1.2, z);
  addMesh(new THREE.ConeGeometry(2.2,2.1,8), matPine, x, h*0.55+3.0, z);
  addMesh(new THREE.ConeGeometry(1.4,1.7,8), matPine, x, h*0.55+4.6, z);
}
[[17,-8],[21,-18],[15,-28],[23,-38],[14,-44],[25,-12]].forEach(([x,z]) => addPineTree(x,z));

// ── 9.14  Cherry Trees (8 trees lining inner compound) ───────────────────────
const blossomMeshes = [];
[[-9,-12],[9,-12],[-10,-20],[10,-20],[-9,-30],[9,-30],[-8,-39],[8,-39]].forEach(([cx,cz]) => {
  addMesh(new THREE.CylinderGeometry(0.17,0.27,3.6,8), matTrunk, cx, 1.8, cz, { padding: 0.05 });
  blossomMeshes.push(addMesh(new THREE.SphereGeometry(1.9,12,8), matBlossom, cx, 4.8, cz));
});

// ── 9.15  Hanging Lanterns (approach + haiden front) ─────────────────────────
const hangingLanterns = [];
// Haiden front lanterns (3 large, decorative)
[-4, 0, 4].forEach(x => {
  hangingLanterns.push(addMesh(new THREE.CylinderGeometry(0.32,0.32,1.1,10), matLanternM, x, 7.2, HDZ+6.2));
  addMesh(new THREE.ConeGeometry(0.4,0.4,10), matLanternM, x, 6.65, HDZ+6.2).rotation.x = Math.PI;
});

// ── 9.16  Garden Pond with Bridge, Stepping Stones, Koi ──────────────────────
const POND_X_OFFSET = 6;
const POND_Z_OFFSET = -2;
const [PNDX, PNDZ] = [-24 + POND_X_OFFSET, 12 + POND_Z_OFFSET];
addMesh(new THREE.PlaneGeometry(15,11), matStone, PNDX, 0.01, PNDZ).rotation.x = -Math.PI/2;
const pondWater = addMesh(new THREE.SphereGeometry(6.5,24,8), matWater, PNDX, 0, PNDZ);
pondWater.scale.y = 0.04;
registerCollisionVolume(PNDX - 1.6, 0.45, PNDZ, 8.6, 1.4, 8.8, {
  source: 'pond',
  padding: { x: 0.1, z: 0.1 },
});
// Stepping stones (3)
addMesh(new THREE.CylinderGeometry(0.65,0.7,0.18,8),  matStone, PNDX+2.2, 0.09, PNDZ);
addMesh(new THREE.CylinderGeometry(0.55,0.6,0.15,8),  matStone, PNDX+1.0, 0.08, PNDZ-1.5);
addMesh(new THREE.CylinderGeometry(0.6,0.65,0.16,8),  matStone, PNDX-0.5, 0.08, PNDZ-2.5);
// Wooden bridge (3 planks + 2 railings)
addMesh(new THREE.BoxGeometry(1.4,0.14,5.5), matWood, PNDX+3.8, 0.28, PNDZ+1.5);
addMesh(new THREE.BoxGeometry(0.1,0.55,5.5), matWood, PNDX+3.15, 0.52, PNDZ+1.5);
addMesh(new THREE.BoxGeometry(0.1,0.55,5.5), matWood, PNDX+4.45, 0.52, PNDZ+1.5);
// Koi (3 orange spheres)
addMesh(new THREE.SphereGeometry(0.2,6,4), matKoi, PNDX-1.5, 0.05, PNDZ+1.2);
addMesh(new THREE.SphereGeometry(0.16,6,4), matKoi, PNDX-2.8, 0.05, PNDZ-0.5);
addMesh(new THREE.SphereGeometry(0.22,6,4), matKoi, PNDX-1.0, 0.05, PNDZ-1.8);
// Pond lantern on rock
addMesh(new THREE.CylinderGeometry(0.14,0.18,0.5,6), matStone, PNDX-4.5, 0.35, PNDZ+2.5);
addMesh(new THREE.BoxGeometry(0.5,0.5,0.5), matLanternM, PNDX-4.5, 0.88, PNDZ+2.5);
addMesh(new THREE.ConeGeometry(0.38,0.42,4), matStone, PNDX-4.5, 1.26, PNDZ+2.5);

// Shoreline stones around the pond.
[
  [PNDX - 5.5, PNDZ - 2.8, 1.4],
  [PNDX - 5.8, PNDZ + 0.9, 0.9],
  [PNDX - 2.8, PNDZ + 4.4, 1.0],
  [PNDX + 1.8, PNDZ + 4.8, 0.8],
  [PNDX + 5.0, PNDZ - 3.8, 1.2],
].forEach(([x, z, s]) => {
  const stone = addMesh(new THREE.IcosahedronGeometry(0.75, 0), matStone, x, 0.26, z);
  stone.scale.set(1.3 * s, 0.65 * s, 1.0 * s);
  stone.rotation.set(Math.random() * 0.7, Math.random() * Math.PI, Math.random() * 0.3);
});

// ── 9.17  Obon Festival Stage (Yagura) ───────────────────────────────────────
const [FSX, FSZ] = [12, 18];
addMesh(new THREE.BoxGeometry(8.5, 0.85, 8.5), matWood, FSX, 0.43, FSZ);
[[FSX-3.8,FSZ-3.8],[FSX+3.8,FSZ-3.8],[FSX-3.8,FSZ+3.8],[FSX+3.8,FSZ+3.8]].forEach(([px,pz]) => {
  addMesh(new THREE.CylinderGeometry(0.22,0.22,6.5,8), matWood, px, 4.1, pz);
});
const fsRoof = addMesh(new THREE.ConeGeometry(6.5,2.8,4), matTile, FSX, 8.2, FSZ);
fsRoof.rotation.y = Math.PI / 4;
// Taiko drum on stage
addMesh(new THREE.CylinderGeometry(0.85,0.85,1.3,16), matLacquer, FSX, 1.5, FSZ);
addMesh(new THREE.CylinderGeometry(0.87,0.87,0.12,16), matGold, FSX, 2.1, FSZ); // drum head ring
// Decorative banners hanging from roof eaves
[-3.5, 0, 3.5].forEach(dx => {
  addMesh(new THREE.BoxGeometry(0.8,2.5,0.06), matPaper, FSX+dx, 6.2, FSZ+3.9);
});

// ── 9.18  Yatai Festival Stalls (3 stalls) ───────────────────────────────────
[[14,28],[20,25],[26,22]].forEach(([sx,sz]) => {
  const sy = terrainHeight(sx, sz);
  addMesh(new THREE.BoxGeometry(5.2,2.6,3.2), matWood, sx, sy + 1.3, sz);
  addMesh(new THREE.BoxGeometry(5.8,0.16,3.8), matPaper, sx, sy + 2.7, sz);   // awning top
  addMesh(new THREE.BoxGeometry(0.1,1.3,0.1), matWood, sx-2.6, sy + 2.05, sz+1.9); // front post
  addMesh(new THREE.BoxGeometry(0.1,1.3,0.1), matWood, sx+2.6, sy + 2.05, sz+1.9);
  addMesh(new THREE.BoxGeometry(4.5,0.12,0.1), matGold, sx, sy + 2.96, sz+1.95); // noren bar
  registerCollisionVolume(sx, sy + 1.35, sz, 5.4, 2.8, 3.4, {
    source: 'festival-stall',
    padding: { x: 0.08, z: 0.08 },
  });
});

// Vendor crates and barrel details around the stalls.
[
  [12.6, 29.5], [15.0, 29.4], [18.7, 26.6], [21.9, 26.6], [24.3, 23.5], [27.8, 23.1],
].forEach(([x, z], i) => {
  const y = terrainHeight(x, z);
  if (i % 2 === 0) {
    addMesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), matWood, x, y + 0.42, z);
  } else {
    addMesh(new THREE.CylinderGeometry(0.45, 0.45, 0.95, 12), matLacquer, x, y + 0.48, z);
  }
});

// ── 9.19  Moon + glow halo ────────────────────────────────────────────────────
const moon = new THREE.Mesh(new THREE.SphereGeometry(4.5, 24, 16), matMoon);
moon.position.set(-50, 48, -85);
scene.add(moon);

// Inner corona halo (tight, brighter)
const moonHalo1 = new THREE.Mesh(
  new THREE.SphereGeometry(5.6, 16, 8),
  new THREE.MeshBasicMaterial({ color: 0xfff8d0, transparent: true, opacity: 0.18, side: THREE.BackSide })
);
moon.add(moonHalo1);

// Outer diffuse glow (wide, atmospheric scatter)
const moonHalo2 = new THREE.Mesh(
  new THREE.SphereGeometry(9.5, 16, 8),
  new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.07, side: THREE.BackSide })
);
moon.add(moonHalo2);

// Moonglow PointLight — casts soft blue-white light into the scene from moon position
const moonGlowLight = new THREE.PointLight(0xd8e8ff, 1.8, 200);
moon.add(moonGlowLight); // follows moon as it drifts

freezeStaticSceneMeshes([bellMesh, moon, ...blossomMeshes, ...hangingLanterns]);

const POLY_PIZZA_MOUNTAIN_Y_LIFT = 20;
const FUJI_Y_OFFSET = -4;
const FOOTHILL_Y_OFFSET = -1.2;

// ── 9.20  Mt. Fuji (background) ──────────────────────────────────────────────
const fuji = addMesh(new THREE.ConeGeometry(30,38,4), matFuji, -58, 16 + FUJI_Y_OFFSET, -125);
fuji.rotation.y = Math.PI / 4;
const fujiSnow = addMesh(new THREE.ConeGeometry(11,15,4), matFujiSnow, -58, 28 + FUJI_Y_OFFSET, -125);
fujiSnow.rotation.y = Math.PI / 4;

// ── 9.21  Valley Edge Foothills ──────────────────────────────────────────────
[
  [-64, -70, 1.25, 0.38, 1.5, 0.05],
  [-34, -76, 1.35, 0.46, 1.7, -0.08],
  [4,   -82, 1.55, 0.54, 1.9, 0.02],
  [40,  -76, 1.35, 0.46, 1.7, 0.12],
  [70,  -64, 1.2, 0.36, 1.45, -0.04],
  [-78, -24, 1.0, 0.30, 1.35, 0.18],
  [80,  -18, 1.05, 0.32, 1.4, -0.16],
].forEach(([x, z, sx, sy, sz, ry], i) => {
  addScaledMesh(
    new THREE.SphereGeometry(8.5, 22, 16),
    i % 2 === 0 ? matFuji : matStone,
    x,
    terrainHeight(x, z) + sy * 4.4 - 1.4 + FOOTHILL_Y_OFFSET,
    z,
    sx, sy, sz,
    0, ry, 0
  );
});

// ---------------------------------------------------------------------------
// Section 10 — External GLTF Assets
// ---------------------------------------------------------------------------

// Rocks — scattered around the mid-ground perimeter
const rockPlacementRecords = [
  [-44, -46, -0.05, 1.25, 0.00],
  [-34, -54, -0.04, 1.43, 0.63],
  [-22, -60, -0.05, 1.61, 1.26],
  [-8,  -64, -0.06, 1.79, 1.89],
  [8,   -64, -0.06, 1.97, 2.52],
  [24,  -60, -0.05, 1.25, 3.15],
  [38,  -52, -0.04, 1.43, 3.78],
  [48,  -42, -0.05, 1.61, 4.41],
  [-52, -12, -0.05, 1.79, 5.04],
  [54,  -6,  -0.05, 1.97, 5.67],
  [-46, 18,  -0.05, 1.25, 6.30],
  [48,  20,  -0.05, 1.43, 6.93],
].map(([x, z, yOffset, scale, rotationY]) =>
  createTerrainPlacement('poly-pizza-rock', x, z, yOffset, scale, rotationY, { kind: 'gltf' })
);

// Broad trees — mid-ground groupings flanking the approach and open areas
const treePlacementRecords = [
  [-18, 30,  0, 2.8, 0.3],
  [-26, 24,  0, 3.1, 1.1],
  [-14, 38,  0, 2.5, 2.0],
  [ 20, 30,  0, 2.9, 0.8],
  [ 16, 40,  0, 2.6, 2.6],
  [-38,  4,  0, 3.0, 0.5],
  [-42, -8,  0, 2.7, 3.0],
  [ 40,  6,  0, 3.1, 1.4],
  [ 44, -10, 0, 2.8, 4.2],
  [-30, -30, 0, 2.6, 0.2],
  [ 32, -28, 0, 2.9, 5.0],
].filter((_, index) => index % 2 === 0)
  .map(([x, z, yOffset, scale, rotationY]) =>
  createTerrainPlacement('poly-pizza-tree', x, z, yOffset, scale, rotationY, { kind: 'gltf' })
);

// Pine trees — denser, closer to the mountain backdrop
const pinePlacementRecords = [
  [-62, -48, 0, 3.4, 0.4],
  [-56, -58, 0, 3.8, 1.2],
  [-44, -66, 0, 3.1, 2.1],
  [-28, -72, 0, 3.6, 0.9],
  [ -8, -76, 0, 3.9, 3.5],
  [ 14, -74, 0, 3.3, 2.8],
  [ 32, -68, 0, 3.7, 0.6],
  [ 48, -58, 0, 3.2, 4.1],
  [ 60, -44, 0, 3.5, 1.8],
  [-66, -18, 0, 3.0, 0.1],
  [ 64, -14, 0, 3.4, 5.2],
  [-60,  10, 0, 3.1, 2.3],
  [ 62,  12, 0, 3.6, 3.9],
].filter((_, index) => index % 2 === 0)
  .map(([x, z, yOffset, scale, rotationY]) =>
  createTerrainPlacement('poly-pizza-pine-tree', x, z, yOffset, scale, rotationY, { kind: 'gltf' })
);

const lanternPlacementRecords = [
  createTerrainPlacement('poly-pizza-lantern', PNDX + 5.6, PNDZ + 4.1, 0.02, 0.34, 0.0, { kind: 'gltf' }),
  createTerrainPlacement('poly-pizza-lantern', PNDX + 6.4, PNDZ - 3.8, 0.02, 0.34, 1.1, { kind: 'gltf' }),
  createAbsolutePlacement('poly-pizza-lantern', FSX - 6.0, 0.85, FSZ + 5.8, 0.34, 2.2, { kind: 'gltf' }),
  createAbsolutePlacement('poly-pizza-lantern', FSX + 5.6, 0.85, FSZ + 5.8, 0.34, 3.3, { kind: 'gltf' }),
  createAbsolutePlacement('poly-pizza-lantern', THX + 5.2, 0.02, THZ + 3.5, 0.34, 4.4, { kind: 'gltf' }),
];

const mountainPlacementRecords = [
  [-88, -94, -1.6, 24, 0.1],
  [-52, -100, -1.4, 22, 0.8],
  [-8,  -106, -1.5, 24, 1.3],
  [38,  -102, -1.4, 22, 1.9],
  [84,  -92, -1.5, 21, 2.5],
  [-96, -34, -1.3, 18, 1.2],
  [98,  -18, -1.3, 18, 2.9],
].map(([x, z, yOffset, scale, rotationY], index) => {
  const liftJitter = 0.65 + ((Math.sin(index * 12.9898 + 78.233) + 1) * 0.5) * 0.7;
  return createTerrainPlacement(
    'poly-pizza-mountain-a',
    x,
    z,
    yOffset + POLY_PIZZA_MOUNTAIN_Y_LIFT * liftJitter,
    scale,
    rotationY,
    { kind: 'gltf' }
  );
});

const courtyardSakuraPlacementRecords = [
  createTerrainPlacement('poly-pizza-tree-konta', 13.8, 1.8, 0.0, 0.1, 0.5, { kind: 'gltf' }),
];

const bonsaiPlacementRecords = [
  createTerrainPlacement('poly-pizza-big-sakura-bonsai', PNDX - 6.4, PNDZ + 3.8, 3.2, 30.85, 3.75, { kind: 'gltf' }),
  createTerrainPlacement('poly-pizza-big-sakura-bonsai', PNDX - 6.4, PNDZ + 3.8, 3.2, 10.85, 3.75, { kind: 'gltf' }),
  createTerrainPlacement('poly-pizza-big-sakura-bonsai', -14.4, 0.8, 6.5, 8.85, 3.0, { kind: 'gltf' }),
];

function prepStaticModel(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function isFoliageSourceKey(sourceKey) {
  return sourceKey === 'poly-pizza-tree'
    || sourceKey === 'poly-pizza-pine-tree'
    || sourceKey === 'poly-pizza-tree-konta'
    || sourceKey === 'poly-pizza-big-sakura-bonsai';
}

function prepStaticTemplate(root, materialMutator = null) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (!child.material || !materialMutator) return;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => {
        const nextMaterial = material.clone();
        materialMutator(nextMaterial);
        return nextMaterial;
      });
      return;
    }

    child.material = child.material.clone();
    materialMutator(child.material);
  });
}

function registerPlacementCollision(instance, placement) {
  if (!placement) return;

  const sourceKey = placement.sourceKey;
  const x = instance.position.x;
  const z = instance.position.z;
  const groundY = placement.anchorMode === 'terrain'
    ? terrainHeight(x, z)
    : placement.position.y;

  if (sourceKey === 'poly-pizza-tree') {
    registerCollisionVolume(x, groundY + 2.8, z, placement.scale * 1.1, 5.6, placement.scale * 1.1, {
      source: sourceKey,
      padding: { x: 0.08, z: 0.08 },
    });
    return;
  }

  if (sourceKey === 'poly-pizza-pine-tree') {
    registerCollisionVolume(x, groundY + 3.2, z, placement.scale * 0.95, 6.4, placement.scale * 0.95, {
      source: sourceKey,
      padding: { x: 0.08, z: 0.08 },
    });
    return;
  }

  if (sourceKey === 'poly-pizza-lantern') {
    registerCollisionVolume(x, groundY + 0.85, z, 0.7, 1.7, 0.7, {
      source: sourceKey,
      padding: { x: 0.04, z: 0.04 },
    });
    return;
  }

  if (sourceKey === 'poly-pizza-tree-konta') {
    registerCollisionVolume(x, groundY + 3.8, z, 2.2, 7.6, 2.2, {
      source: sourceKey,
      padding: { x: 0.05, z: 0.05 },
    });
    return;
  }

  if (sourceKey === 'poly-pizza-big-sakura-bonsai') {
    registerCollisionVolume(x, groundY + 1.0, z, 1.5, 2.0, 1.5, {
      source: sourceKey,
      padding: { x: 0.04, z: 0.04 },
    });
    return;
  }

  registerCollisionBox(instance, {
    source: sourceKey,
    padding: sourceKey === 'poly-pizza-mountain-a'
      ? { x: 0.2, z: 0.2 }
      : { x: 0.08, z: 0.08 },
  });
}

function addModelInstance(source, position, scale, rotationY = 0, placement = null) {
  const instance = source.clone(true);
  instance.position.copy(position);
  instance.scale.setScalar(scale);
  instance.rotation.y = rotationY;
  prepStaticModel(instance);
  if (placement && isFoliageSourceKey(placement.sourceKey)) {
    instance.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
    });
  }
  scene.add(instance);
  registerPlacementCollision(instance, placement);
  freezeStaticObject(instance);
  return instance;
}

gltfLoader.load(
  'resources/models/external/poly-pizza-lantern.glb',
  (gltf) => {
    const lanternTemplate = gltf.scene;
    prepStaticTemplate(lanternTemplate, (material) => {
      material.emissive = new THREE.Color(0xffb347);
      material.emissiveIntensity = 0.45;
    });
    lanternPlacementRecords.forEach((placement) => {
      const pos = placement.anchorMode === 'terrain'
        ? terrainPoint(placement.position.x, placement.position.z, placement.position.yOffset)
        : new THREE.Vector3(placement.position.x, placement.position.y, placement.position.z);
      addModelInstance(lanternTemplate, pos, placement.scale, placement.rotation.y, placement);
    });
    queueShadowRefresh();
  },
	  undefined,
	  (err) => console.warn('Poly Pizza lantern GLB failed:', err)
	);

gltfLoader.load(
  'resources/models/external/poly-pizza-mountain-a.glb',
  (gltf) => {
    const mountainTemplate = gltf.scene;
    prepStaticTemplate(mountainTemplate, (material) => {
      material.roughness = 1.0;
      material.metalness = 0.0;
    });
    mountainPlacementRecords.forEach((placement) => {
      const pos = terrainPoint(placement.position.x, placement.position.z, placement.position.yOffset);
      addModelInstance(mountainTemplate, pos, placement.scale, placement.rotation.y, placement);
    });
    queueShadowRefresh();
  },
  undefined,
  (err) => console.warn('Poly Pizza mountain A GLB failed:', err)
);

gltfLoader.load(
  'resources/models/external/poly-pizza-rock.glb',
  (gltf) => {
    const template = gltf.scene;
    prepStaticTemplate(template);
    rockPlacementRecords.forEach((p) => {
      addModelInstance(template, terrainPoint(p.position.x, p.position.z, p.position.yOffset), p.scale, p.rotation.y, p);
    });
    queueShadowRefresh();
  },
  undefined,
  (err) => console.warn('Poly Pizza rock GLB failed:', err)
);

gltfLoader.load(
  'resources/models/external/poly-pizza-tree-konta.glb',
  (gltf) => {
    const template = gltf.scene;
    prepStaticTemplate(template);
    courtyardSakuraPlacementRecords.forEach((p) => {
      addModelInstance(template, terrainPoint(p.position.x, p.position.z, p.position.yOffset), p.scale, p.rotation.y, p);
    });
    queueShadowRefresh();
  },
  undefined,
  (err) => console.warn('Poly Pizza courtyard sakura GLB failed:', err)
);

gltfLoader.load(
  'resources/models/external/poly-pizza-big-sakura-bonsai.glb',
  (gltf) => {
    const template = gltf.scene;
    prepStaticTemplate(template);
    bonsaiPlacementRecords.forEach((p) => {
      addModelInstance(template, terrainPoint(p.position.x, p.position.z, p.position.yOffset), p.scale, p.rotation.y, p);
    });
    queueShadowRefresh();
  },
  undefined,
  (err) => console.warn('Poly Pizza bonsai GLB failed:', err)
);

gltfLoader.load(
  'resources/models/external/Tree.glb',
  (gltf) => {
    const template = gltf.scene;
    prepStaticTemplate(template);
    treePlacementRecords.forEach((p) => {
      addModelInstance(template, terrainPoint(p.position.x, p.position.z, p.position.yOffset), p.scale, p.rotation.y, p);
    });
    queueShadowRefresh();
  },
  undefined,
  (err) => console.warn('Poly Pizza tree GLB failed:', err)
);

gltfLoader.load(
  'resources/models/external/Pine Tree.glb',
  (gltf) => {
    const template = gltf.scene;
    prepStaticTemplate(template);
    pinePlacementRecords.forEach((p) => {
      addModelInstance(template, terrainPoint(p.position.x, p.position.z, p.position.yOffset), p.scale, p.rotation.y, p);
    });
    queueShadowRefresh();
  },
  undefined,
  (err) => console.warn('Poly Pizza pine tree GLB failed:', err)
);

gltfLoader.load(
  'resources/models/external/Torii Gate.glb',
  (gltf) => {
    const template = gltf.scene;

    // Measure native model size (template at scale=1, not yet in scene).
    const bbox = new THREE.Box3().setFromObject(template);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    // Native "height" is Y if the model is upright; use whichever axis is tallest.
    const nativeHeight = Math.max(size.x, size.y, size.z);

    toriiGatePlacements.forEach(({ x, z, targetH, rotY = 0, yOffset = 0 }) => {
      const instance = template.clone(true);
      const finalScale = targetH / nativeHeight;
      instance.scale.setScalar(finalScale);

      // Torii placements can override the model's default facing.
      instance.rotation.y = rotY;

      // Snap bottom of gate to terrain (bbox.min.y is the lowest point in local space).
      const groundY = terrainHeight(x, z);
      instance.position.set(x, groundY - bbox.min.y * finalScale + yOffset, z);

      instance.traverse((child) => {
        if (child.isMesh) { child.castShadow = child.receiveShadow = true; }
      });
      scene.add(instance);
      freezeStaticObject(instance);
    });
    queueShadowRefresh();
  },
  undefined,
  (err) => console.warn('Torii Gate GLB failed:', err)
);

// ---------------------------------------------------------------------------
// Section 12 — FireworkSystem (Wow Feature — physics particles + scene lighting)
// ---------------------------------------------------------------------------
const FIREWORK_COLORS = [0xff4444, 0xffcc00, 0x44aaff, 0xff88cc, 0x88ffaa, 0xffffff];

class Firework {
  constructor(x, z) {
    this.phase       = 'rocket';
    this.color       = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
    this.burstHeight = 20 + Math.random() * 12;

    // Rocket
    const rocketGeo = new THREE.BufferGeometry();
    rocketGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([x,1,z]), 3));
    this.rocket    = new THREE.Points(rocketGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    this.rocketPos = new THREE.Vector3(x, 1, z);
    this.rocketVel = new THREE.Vector3(
      (Math.random()-0.5)*2, 18+Math.random()*6, (Math.random()-0.5)*2
    );

    // Burst particles
    const N = 72;
    const bp = new Float32Array(N * 3);
    this.burstVels = [];
    for (let i = 0; i < N; i++) {
      bp[i*3]=x; bp[i*3+1]=this.burstHeight; bp[i*3+2]=z;
      const theta = Math.random()*Math.PI*2, phi = Math.acos(2*Math.random()-1);
      const spd   = 3 + Math.random()*6;
      this.burstVels.push(new THREE.Vector3(
        Math.sin(phi)*Math.cos(theta)*spd, Math.sin(phi)*Math.sin(theta)*spd, Math.cos(phi)*spd
      ));
    }
    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    this.burst = new THREE.Points(burstGeo, new THREE.PointsMaterial({
      color: this.color, size: 0.35, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true, opacity: 1,
    }));

    this.burstLight = new THREE.PointLight(this.color, 0, 100);
    this.burstLight.position.set(x, this.burstHeight, z);
  }

  update(delta, scene) {
    if (this.phase === 'rocket') {
      this.rocketPos.addScaledVector(this.rocketVel, delta);
      const pos = this.rocket.geometry.attributes.position;
      pos.setXYZ(0, this.rocketPos.x, this.rocketPos.y, this.rocketPos.z);
      pos.needsUpdate = true;
      if (this.rocketPos.y >= this.burstHeight) {
        this.phase = 'burst';
        scene.remove(this.rocket);
        scene.add(this.burst);
        scene.add(this.burstLight);
        this.burstLight.intensity = 500;
      }
    } else if (this.phase === 'burst') {
      const posAttr = this.burst.geometry.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i < this.burstVels.length; i++) {
        this.burstVels[i].y -= 9.8 * delta;
        this.burstVels[i].multiplyScalar(0.97);
        arr[i*3]   += this.burstVels[i].x * delta;
        arr[i*3+1] += this.burstVels[i].y * delta;
        arr[i*3+2] += this.burstVels[i].z * delta;
      }
      posAttr.needsUpdate = true;
      this.burst.material.opacity -= 0.4 * delta;
      this.burstLight.intensity = Math.max(0, this.burst.material.opacity) * 500;
      if (this.burst.material.opacity <= 0) this.phase = 'dead';
    }
  }

  removeFromScene(scene) {
    scene.remove(this.rocket);
    scene.remove(this.burst);
    scene.remove(this.burstLight);
    this.rocket.geometry.dispose(); this.rocket.material.dispose();
    this.burst.geometry.dispose();  this.burst.material.dispose();
  }
}

class FireworkSystem {
  constructor(scene) {
    this.scene = scene; this.fireworks = [];
    this._scheduleNext();
  }
  _scheduleNext() {
    setTimeout(() => { this._launchCluster(); this._scheduleNext(); }, 2000+Math.random()*1500);
  }
  _launchCluster() {
    const count = 2 + Math.floor(Math.random()*2);
    for (let i = 0; i < count; i++) {
      const fw = new Firework((Math.random()-0.5)*50, (Math.random()-0.5)*30);
      this.scene.add(fw.rocket);
      this.fireworks.push(fw);
    }
  }
  update(delta) {
    for (let i = this.fireworks.length-1; i >= 0; i--) {
      this.fireworks[i].update(delta, this.scene);
      if (this.fireworks[i].phase === 'dead') {
        this.fireworks[i].removeFromScene(this.scene);
        this.fireworks.splice(i, 1);
      }
    }
  }
}

const fireworkSystem = new FireworkSystem(scene);

// ---------------------------------------------------------------------------
// Section 13 — Cherry Blossom Petals
// ---------------------------------------------------------------------------
const PETAL_COUNT = 120;
const DEFAULT_ORBIT_CAMERA_Y = 22;
const PETAL_SPAWN_MIN_Y = DEFAULT_ORBIT_CAMERA_Y + 6;
const PETAL_SPAWN_RANGE_Y = 10;
const petalPositions = new Float32Array(PETAL_COUNT * 3);
const petalDrifts    = new Float32Array(PETAL_COUNT * 2); // base horizontal drift
const petalSpeeds    = new Float32Array(PETAL_COUNT);     // individual fall speeds
const petalPhases    = new Float32Array(PETAL_COUNT);     // sinusoidal drift phase offset

for (let i = 0; i < PETAL_COUNT; i++) {
  petalPositions[i*3]   = (Math.random()-0.5)*80;
  petalPositions[i*3+1] = PETAL_SPAWN_MIN_Y + Math.random() * PETAL_SPAWN_RANGE_Y;
  petalPositions[i*3+2] = (Math.random()-0.5)*80;
  petalDrifts[i*2]   = (Math.random()-0.5)*1.4;   // base X drift
  petalDrifts[i*2+1] = (Math.random()-0.5)*1.4;   // base Z drift
  petalSpeeds[i]  = 0.7 + Math.random() * 1.9;    // fall speed 0.7–2.6 units/s
  petalPhases[i]  = Math.random() * Math.PI * 2;  // random phase for sway
}

const petalGeo = new THREE.BufferGeometry();
petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPositions, 3).setUsage(THREE.DynamicDrawUsage));
const petalMat = new THREE.PointsMaterial({
  color: 0xffaacc, size: 0.13, transparent: true, opacity: 0.85,
  blending: THREE.NormalBlending, depthWrite: false,
});
scene.add(new THREE.Points(petalGeo, petalMat));

// ---------------------------------------------------------------------------
// Section 14 — resizeIfNeeded
// ---------------------------------------------------------------------------
function resizeIfNeeded() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_RENDER_PIXEL_RATIO));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

// ---------------------------------------------------------------------------
// Section 15 — render() loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function render() {
  requestAnimationFrame(render);
  resizeIfNeeded();

  const delta = clock.getDelta();
  const time  = clock.elapsedTime;

  // Lantern flicker
  lanternLights.forEach((pl, i) => {
    pl.intensity = 7 + Math.sin(time*2 + i*1.2)*2;
  });
  // Stage light pulse (festival energy)
  stageLight.intensity = 11 + Math.sin(time*3.5)*3;

  // Blossom sphere sway
  blossomMeshes.forEach((b, i) => {
    b.rotation.z = Math.sin(time*0.8 + i*1.1)*0.06;
  });

  // Moon slow drift
  moon.position.x = Math.cos(time*0.008)*40 - 30;
  moon.position.y = 42 + Math.sin(time*0.008)*10;

  // Hanging lanterns sway
  hangingLanterns.forEach((hl, i) => {
    hl.rotation.z = Math.sin(time*1.2 + i*0.8)*0.09;
  });

  // Bell gentle swing
  bellMesh.rotation.z = Math.sin(time*0.6)*0.12;

  // Petal fall — each petal has unique speed + sinusoidal sway for natural snow-like motion
  const pos = petalGeo.attributes.position;
  for (let i = 0; i < PETAL_COUNT; i++) {
    const sway = Math.sin(time * petalSpeeds[i] * 0.55 + petalPhases[i]);
    const swayZ = Math.cos(time * petalSpeeds[i] * 0.38 + petalPhases[i] * 1.3);
    pos.array[i*3]   += (petalDrifts[i*2]   * 0.25 + sway  * 0.18) * delta;
    pos.array[i*3+1] -= petalSpeeds[i] * delta;
    pos.array[i*3+2] += (petalDrifts[i*2+1] * 0.25 + swayZ * 0.14) * delta;
    if (pos.array[i*3+1] < 0) {
      pos.array[i*3]   = (Math.random()-0.5)*80;
      pos.array[i*3+1] = PETAL_SPAWN_MIN_Y + Math.random() * PETAL_SPAWN_RANGE_Y;
      pos.array[i*3+2] = (Math.random()-0.5)*80;
    }
  }
  pos.needsUpdate = true;

  fireworkSystem.update(delta);

  // Ground-mode movement + look
  if (groundMode) {
    if (keys.q || keys.e) {
      fpEuler.setFromQuaternion(camera.quaternion);
      if (keys.q) fpEuler.y += FP_LOOK_SPEED * delta;
      if (keys.e) fpEuler.y -= FP_LOOK_SPEED * delta;
      camera.quaternion.setFromEuler(fpEuler);
    }

    // --- movement ---
    camera.getWorldDirection(fpForward);
    fpForward.y = 0;
    if (fpForward.lengthSq() > 1e-6) {
      fpForward.normalize();
    } else {
      fpEuler.setFromQuaternion(camera.quaternion);
      fpForward.set(-Math.sin(fpEuler.y), 0, -Math.cos(fpEuler.y));
    }
    fpRight.crossVectors(fpForward, worldUp);
    if (fpRight.lengthSq() > 1e-6) {
      fpRight.normalize();
    }

    fpMove.set(0, 0, 0);
    if (keys.w) fpMove.add(fpForward);
    if (keys.s) fpMove.sub(fpForward);
    if (keys.a) fpMove.sub(fpRight);
    if (keys.d) fpMove.add(fpRight);
    if (fpMove.lengthSq() > 0) {
      fpMove.normalize().multiplyScalar(player.speed * delta);
      movePlayerWithCollisions(fpMove.x, fpMove.z);
    }

    // --- jump & gravity ---
    const minEyeY = terrainHeight(camera.position.x, camera.position.z) + player.height;
    const grounded = camera.position.y <= minEyeY + 1e-3;
    if (grounded && keys.space) {
      fpVelY = FP_JUMP_SPEED;
    }
    fpVelY -= FP_GRAVITY * delta;
    camera.position.y += fpVelY * delta;
    if (camera.position.y < minEyeY) {
      camera.position.y = minEyeY;
      fpVelY = 0;
    }
  }
  if (!groundMode) controls.update();
  if (shadowRefreshQueued) {
    renderer.shadowMap.needsUpdate = true;
    shadowRefreshQueued = false;
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(render);
