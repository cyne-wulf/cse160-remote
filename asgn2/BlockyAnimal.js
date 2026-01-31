// BlockyAnimal.js - 3D Blocky Rat with hierarchical joints and animation
// By Ashan Devine

// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  void main() {
    gl_Position = u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
  }
`;

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }
`;

// ============================================================================
// Global Variables
// ============================================================================

// WebGL context and shader locations
var gl;
var canvas;
var a_Position;
var u_ModelMatrix;
var u_GlobalRotateMatrix;
var u_FragColor;

// Rotation controls
var g_globalRotationSlider = 0;
var g_mouseRotationX = 0;
var g_mouseRotationY = 0;

// Joint angles (slider-controlled for front left leg)
var g_upperLegAngle = 0;
var g_lowerLegAngle = 0;
var g_footAngle = 0;

// Animation state
var g_isAnimating = false;
var g_seconds = 0;
var g_startTime = performance.now() / 1000;

// Animation angles (computed from time)
var g_legSwing = [0, 0, 0, 0];  // Front-left, front-right, back-left, back-right
var g_tailWag = 0;
var g_tailWag2 = 0;
var g_tailWag3 = 0;
var g_headNod = 0;
var g_bodyBob = 0;

// Poke animation state
var g_isPoking = false;
var g_pokeStartTime = 0;
var g_pokeJumpHeight = 0;
var g_pokeSpin = 0;

// Mouse drag state
var g_isDragging = false;
var g_lastMouseX = 0;
var g_lastMouseY = 0;

// FPS tracking
var g_frameCount = 0;
var g_lastFPSUpdate = 0;
var g_currentFPS = 0;

// Pre-allocated global rotation matrix (performance)
var g_globalRotateMatrix = new Matrix4();

// ============================================================================
// Color Scheme
// ============================================================================

const RAT_BODY_COLOR = [0.5, 0.45, 0.4, 1.0];
const RAT_HEAD_COLOR = [0.55, 0.5, 0.45, 1.0];
const RAT_LEG_COLOR = [0.45, 0.4, 0.35, 1.0];
const RAT_FOOT_COLOR = [0.7, 0.55, 0.5, 1.0];
const RAT_TAIL_COLOR = [0.7, 0.55, 0.5, 1.0];
const RAT_EAR_COLOR = [0.75, 0.6, 0.55, 1.0];
const RAT_SNOUT_COLOR = [0.6, 0.55, 0.5, 1.0];
const RAT_EYE_COLOR = [0.1, 0.1, 0.1, 1.0];
const RAT_NOSE_COLOR = [0.2, 0.15, 0.15, 1.0];

// ============================================================================
// Setup Functions
// ============================================================================

function setupWebGL() {
  canvas = document.getElementById('webgl');
  if (!canvas) {
    console.log('Failed to retrieve the <canvas> element');
    return false;
  }

  gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return false;
  }

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.2, 0.3, 0.4, 1.0);

  return true;
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return false;
  }

  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return false;
  }

  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return false;
  }

  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  if (!u_GlobalRotateMatrix) {
    console.log('Failed to get the storage location of u_GlobalRotateMatrix');
    return false;
  }

  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return false;
  }

  return true;
}

function setupUI() {
  // Global rotation slider
  document.getElementById('slider-rotation').oninput = function() {
    g_globalRotationSlider = parseFloat(this.value);
    document.getElementById('val-rotation').textContent = this.value;
  };

  // Upper leg angle slider (Level 1)
  document.getElementById('slider-upper-leg').oninput = function() {
    g_upperLegAngle = parseFloat(this.value);
    document.getElementById('val-upper-leg').textContent = this.value;
  };

  // Lower leg angle slider (Level 2)
  document.getElementById('slider-lower-leg').oninput = function() {
    g_lowerLegAngle = parseFloat(this.value);
    document.getElementById('val-lower-leg').textContent = this.value;
  };

  // Foot angle slider (Level 3)
  document.getElementById('slider-foot').oninput = function() {
    g_footAngle = parseFloat(this.value);
    document.getElementById('val-foot').textContent = this.value;
  };

  // Animation buttons
  document.getElementById('btn-anim-on').onclick = function() {
    g_isAnimating = true;
  };
  document.getElementById('btn-anim-off').onclick = function() {
    g_isAnimating = false;
  };
}

function setupMouseControls() {
  canvas.onmousedown = function(ev) {
    if (ev.shiftKey) {
      // Poke animation
      g_isPoking = true;
      g_pokeStartTime = g_seconds;
    } else {
      // Start drag rotation
      g_isDragging = true;
      g_lastMouseX = ev.clientX;
      g_lastMouseY = ev.clientY;
    }
  };

  canvas.onmousemove = function(ev) {
    if (!g_isDragging) return;

    var dx = ev.clientX - g_lastMouseX;
    var dy = ev.clientY - g_lastMouseY;

    g_mouseRotationY += dx * 0.5;
    g_mouseRotationX += dy * 0.5;

    // Clamp vertical rotation
    g_mouseRotationX = Math.max(-90, Math.min(90, g_mouseRotationX));

    g_lastMouseX = ev.clientX;
    g_lastMouseY = ev.clientY;
  };

  canvas.onmouseup = function(ev) {
    g_isDragging = false;
  };

  canvas.onmouseleave = function(ev) {
    g_isDragging = false;
  };
}

// ============================================================================
// Animation Functions
// ============================================================================

function updateAnimationAngles() {
  if (!g_isAnimating) return;

  // Walking legs (opposite pairs move together)
  g_legSwing[0] = 30 * Math.sin(g_seconds * 6);          // Front-left
  g_legSwing[1] = 30 * Math.sin(g_seconds * 6 + Math.PI); // Front-right
  g_legSwing[2] = 30 * Math.sin(g_seconds * 6 + Math.PI); // Back-left
  g_legSwing[3] = 30 * Math.sin(g_seconds * 6);          // Back-right

  // Tail wave (phase offset down chain for wave effect)
  g_tailWag = 15 * Math.sin(g_seconds * 6);
  g_tailWag2 = 20 * Math.sin(g_seconds * 6 - 0.5);
  g_tailWag3 = 25 * Math.sin(g_seconds * 6 - 1.0);

  // Head nod and body bob
  g_headNod = 5 * Math.sin(g_seconds * 3);
  g_bodyBob = 0.02 * Math.sin(g_seconds * 6);
}

function updatePokeAnimation() {
  if (!g_isPoking) return;

  var t = (g_seconds - g_pokeStartTime) / 1.5; // 1.5 sec duration

  if (t > 1) {
    g_isPoking = false;
    g_pokeJumpHeight = 0;
    g_pokeSpin = 0;
    return;
  }

  // Jump arc
  g_pokeJumpHeight = 0.3 * Math.sin(t * Math.PI);
  // Full spin
  g_pokeSpin = 360 * t;
}

// ============================================================================
// FPS Tracking
// ============================================================================

function updateFPS() {
  g_frameCount++;
  var currentTime = performance.now() / 1000;

  if (currentTime - g_lastFPSUpdate >= 1.0) {
    g_currentFPS = g_frameCount / (currentTime - g_lastFPSUpdate);
    g_frameCount = 0;
    g_lastFPSUpdate = currentTime;
    document.getElementById('fps-display').textContent = 'FPS: ' + g_currentFPS.toFixed(1);
  }
}

// ============================================================================
// Render Functions
// ============================================================================

function renderScene() {
  updateFPS();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Build global rotation matrix
  g_globalRotateMatrix.setIdentity();
  g_globalRotateMatrix.rotate(g_mouseRotationX, 1, 0, 0);
  g_globalRotateMatrix.rotate(g_mouseRotationY + g_globalRotationSlider, 0, 1, 0);

  if (g_isPoking) {
    g_globalRotateMatrix.rotate(g_pokeSpin, 0, 1, 0);
  }

  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, g_globalRotateMatrix.elements);

  // Draw the rat
  drawRat();
}

function drawRat() {
  // Calculate body bob for animation
  var bodyYOffset = g_isPoking ? g_pokeJumpHeight : g_bodyBob;

  // ========================================
  // BODY (Root)
  // ========================================
  var bodyMatrix = new Matrix4();
  bodyMatrix.translate(0, bodyYOffset, 0);
  bodyMatrix.scale(0.5, 0.3, 0.7);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, bodyMatrix, RAT_BODY_COLOR);

  // We need the body's base transformation (without scale) for children
  var bodyBase = new Matrix4();
  bodyBase.translate(0, bodyYOffset, 0);

  // ========================================
  // HEAD (Level 1 - child of body)
  // ========================================
  var headMatrix = new Matrix4(bodyBase);
  headMatrix.translate(0, 0.08 + g_headNod * 0.005, 0.35);
  headMatrix.rotate(g_headNod, 1, 0, 0);

  // Save head base for children
  var headBase = new Matrix4(headMatrix);

  headMatrix.scale(0.28, 0.24, 0.28);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, headMatrix, RAT_HEAD_COLOR);

  // ========================================
  // SNOUT (Level 2 - child of head)
  // ========================================
  var snoutMatrix = new Matrix4(headBase);
  snoutMatrix.translate(0, -0.02, 0.18);
  snoutMatrix.scale(0.14, 0.1, 0.12);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, snoutMatrix, RAT_SNOUT_COLOR);

  // Nose
  var noseMatrix = new Matrix4(headBase);
  noseMatrix.translate(0, -0.02, 0.25);
  noseMatrix.scale(0.06, 0.05, 0.04);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, noseMatrix, RAT_NOSE_COLOR);

  // ========================================
  // EARS (Level 2 - child of head)
  // ========================================
  var earOffset = 0.12;

  // Left ear
  var leftEarMatrix = new Matrix4(headBase);
  leftEarMatrix.translate(-earOffset, 0.12, 0);
  leftEarMatrix.scale(0.08, 0.12, 0.04);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, leftEarMatrix, RAT_EAR_COLOR);

  // Right ear
  var rightEarMatrix = new Matrix4(headBase);
  rightEarMatrix.translate(earOffset, 0.12, 0);
  rightEarMatrix.scale(0.08, 0.12, 0.04);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, rightEarMatrix, RAT_EAR_COLOR);

  // ========================================
  // EYES (Level 2 - child of head)
  // ========================================
  var eyeOffset = 0.1;

  // Left eye
  var leftEyeMatrix = new Matrix4(headBase);
  leftEyeMatrix.translate(-eyeOffset, 0.04, 0.12);
  leftEyeMatrix.scale(0.05, 0.05, 0.05);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, leftEyeMatrix, RAT_EYE_COLOR);

  // Right eye
  var rightEyeMatrix = new Matrix4(headBase);
  rightEyeMatrix.translate(eyeOffset, 0.04, 0.12);
  rightEyeMatrix.scale(0.05, 0.05, 0.05);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, rightEyeMatrix, RAT_EYE_COLOR);

  // ========================================
  // TAIL (3-Level Cylinder Chain)
  // ========================================
  renderTail(bodyBase);

  // ========================================
  // LEGS (4x 3-Level Chains)
  // ========================================
  renderFrontLeftLeg(bodyBase);
  renderFrontRightLeg(bodyBase);
  renderBackLeftLeg(bodyBase);
  renderBackRightLeg(bodyBase);
}

// ============================================================================
// Tail Rendering (3-Level Cylinder Chain)
// ============================================================================

function renderTail(bodyBase) {
  var tailSegmentLength = 0.15;
  var tailRadius = 0.03;

  // LEVEL 1: Tail Base
  var tailBase = new Matrix4(bodyBase);
  tailBase.translate(0, 0, -0.35);
  tailBase.rotate(-30 + g_tailWag, 0, 1, 0);
  tailBase.rotate(-20, 1, 0, 0);

  var tailBaseRender = new Matrix4(tailBase);
  tailBaseRender.translate(0, -tailSegmentLength/2, 0);
  tailBaseRender.rotate(90, 1, 0, 0); // Align cylinder along -Z
  tailBaseRender.scale(tailRadius, tailSegmentLength, tailRadius);
  drawCylinder(gl, a_Position, u_ModelMatrix, u_FragColor, tailBaseRender, RAT_TAIL_COLOR);

  // LEVEL 2: Tail Middle
  var tailMid = new Matrix4(tailBase);
  tailMid.translate(0, -tailSegmentLength, 0);
  tailMid.rotate(g_tailWag2, 0, 1, 0);

  var tailMidRender = new Matrix4(tailMid);
  tailMidRender.translate(0, -tailSegmentLength/2, 0);
  tailMidRender.rotate(90, 1, 0, 0);
  tailMidRender.scale(tailRadius * 0.8, tailSegmentLength, tailRadius * 0.8);
  drawCylinder(gl, a_Position, u_ModelMatrix, u_FragColor, tailMidRender, RAT_TAIL_COLOR);

  // LEVEL 3: Tail Tip
  var tailTip = new Matrix4(tailMid);
  tailTip.translate(0, -tailSegmentLength, 0);
  tailTip.rotate(g_tailWag3, 0, 1, 0);

  var tailTipRender = new Matrix4(tailTip);
  tailTipRender.translate(0, -tailSegmentLength/2, 0);
  tailTipRender.rotate(90, 1, 0, 0);
  tailTipRender.scale(tailRadius * 0.6, tailSegmentLength, tailRadius * 0.6);
  drawCylinder(gl, a_Position, u_ModelMatrix, u_FragColor, tailTipRender, RAT_TAIL_COLOR);
}

// ============================================================================
// Leg Rendering Functions (3-Level Joint Hierarchy)
// ============================================================================

function renderFrontLeftLeg(bodyBase) {
  // This leg uses slider-controlled angles when not animating
  var upperAngle = g_isAnimating ? g_legSwing[0] : g_upperLegAngle;
  var lowerAngle = g_isAnimating ? Math.max(0, -g_legSwing[0] * 0.5 + 20) : g_lowerLegAngle;
  var footAngleVal = g_isAnimating ? g_legSwing[0] * 0.3 : g_footAngle;

  renderLeg(bodyBase, -0.18, 0.2, upperAngle, lowerAngle, footAngleVal);
}

function renderFrontRightLeg(bodyBase) {
  var upperAngle = g_isAnimating ? g_legSwing[1] : 0;
  var lowerAngle = g_isAnimating ? Math.max(0, -g_legSwing[1] * 0.5 + 20) : 20;
  var footAngleVal = g_isAnimating ? g_legSwing[1] * 0.3 : 0;

  renderLeg(bodyBase, 0.18, 0.2, upperAngle, lowerAngle, footAngleVal);
}

function renderBackLeftLeg(bodyBase) {
  var upperAngle = g_isAnimating ? g_legSwing[2] : 0;
  var lowerAngle = g_isAnimating ? Math.max(0, -g_legSwing[2] * 0.5 + 20) : 20;
  var footAngleVal = g_isAnimating ? g_legSwing[2] * 0.3 : 0;

  renderLeg(bodyBase, -0.18, -0.22, upperAngle, lowerAngle, footAngleVal);
}

function renderBackRightLeg(bodyBase) {
  var upperAngle = g_isAnimating ? g_legSwing[3] : 0;
  var lowerAngle = g_isAnimating ? Math.max(0, -g_legSwing[3] * 0.5 + 20) : 20;
  var footAngleVal = g_isAnimating ? g_legSwing[3] * 0.3 : 0;

  renderLeg(bodyBase, 0.18, -0.22, upperAngle, lowerAngle, footAngleVal);
}

function renderLeg(bodyBase, xOffset, zOffset, upperAngle, lowerAngle, footAngleVal) {
  // Leg dimensions
  var upperLen = 0.12;
  var lowerLen = 0.10;
  var footLen = 0.08;

  // LEVEL 1: Upper Leg
  var upperLeg = new Matrix4(bodyBase);
  upperLeg.translate(xOffset, -0.12, zOffset);  // Hip joint position
  upperLeg.rotate(upperAngle, 1, 0, 0);          // Hip rotation

  var upperLegRender = new Matrix4(upperLeg);
  upperLegRender.translate(0, -upperLen/2, 0);   // Pivot offset
  upperLegRender.scale(0.07, upperLen, 0.07);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, upperLegRender, RAT_LEG_COLOR);

  // LEVEL 2: Lower Leg (inherits upper leg transform)
  var lowerLegBase = new Matrix4(upperLeg);
  lowerLegBase.translate(0, -upperLen, 0);       // To knee joint
  lowerLegBase.rotate(lowerAngle, 1, 0, 0);      // Knee rotation

  var lowerLegRender = new Matrix4(lowerLegBase);
  lowerLegRender.translate(0, -lowerLen/2, 0);
  lowerLegRender.scale(0.055, lowerLen, 0.055);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, lowerLegRender, RAT_LEG_COLOR);

  // LEVEL 3: Foot (inherits upper + lower transforms)
  var footBase = new Matrix4(lowerLegBase);
  footBase.translate(0, -lowerLen, 0);           // To ankle joint
  footBase.rotate(footAngleVal, 1, 0, 0);        // Ankle rotation

  var footRender = new Matrix4(footBase);
  footRender.translate(0, -0.02, 0.02);          // Offset for foot shape
  footRender.scale(0.06, 0.04, 0.09);
  drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, footRender, RAT_FOOT_COLOR);
}

// ============================================================================
// Animation Loop
// ============================================================================

function tick() {
  g_seconds = performance.now() / 1000 - g_startTime;

  updateAnimationAngles();
  updatePokeAnimation();
  renderScene();

  requestAnimationFrame(tick);
}

// ============================================================================
// Main
// ============================================================================

function main() {
  if (!setupWebGL()) {
    return;
  }

  if (!connectVariablesToGLSL()) {
    return;
  }

  // Create static buffers for shapes
  Cube.createGLBuffers(gl);
  Cylinder.createGLBuffers(gl);

  setupUI();
  setupMouseControls();

  // Initialize FPS tracking
  g_lastFPSUpdate = performance.now() / 1000;

  // Start animation loop
  tick();

  console.log('BlockyAnimal initialized successfully!');
}

// Application is started via <body onload="main()"> in asgn2.html
