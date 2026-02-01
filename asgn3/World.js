// World.js - Virtual World with textures, camera, and block manipulation
// By Ashan Devine - CSE 160 Assignment 3

// ============================================================================
// Shaders
// ============================================================================

var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  varying vec2 v_UV;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
  }
`;

var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform int u_whichTexture;
  varying vec2 v_UV;
  void main() {
    if (u_whichTexture == -2) {
      gl_FragColor = u_FragColor;                    // Solid color
    } else if (u_whichTexture == -1) {
      gl_FragColor = vec4(v_UV, 1.0, 1.0);           // Debug UV
    } else if (u_whichTexture == 0) {
      gl_FragColor = texture2D(u_Sampler0, v_UV);    // Texture 0 (grass/ground)
    } else if (u_whichTexture == 1) {
      gl_FragColor = texture2D(u_Sampler1, v_UV);    // Texture 1 (brick/wall)
    } else if (u_whichTexture == 2) {
      gl_FragColor = texture2D(u_Sampler2, v_UV);    // Texture 2 (sky)
    } else {
      gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);       // Error: magenta
    }
  }
`;

// ============================================================================
// Global Variables
// ============================================================================

var gl;
var canvas;
var a_Position;
var a_UV;
var u_ModelMatrix;
var u_ViewMatrix;
var u_ProjectionMatrix;
var u_GlobalRotateMatrix;
var u_FragColor;
var u_whichTexture;
var u_Sampler0;
var u_Sampler1;
var u_Sampler2;

// Camera
var camera;

// Textures loaded count
var g_texturesLoaded = 0;

// Map data (32x32 grid)
var g_map = [];

// Animation state
var g_seconds = 0;
var g_startTime = performance.now() / 1000;

// FPS tracking
var g_frameCount = 0;
var g_lastFPSUpdate = 0;
var g_currentFPS = 0;

// Mouse look state
var g_mouseLookEnabled = false;

// Key states for smooth movement
var g_keys = {};

// Rat position and state (for "Find the Rat" game)
var g_ratX = 0;
var g_ratZ = 0;
var g_ratFound = false;

// Rotation matrices (reusable)
var g_globalRotateMatrix = new Matrix4();

// Reusable matrices for performance (avoid allocations in render loop)
var g_blockMatrix = new Matrix4();
var g_skyMatrix = new Matrix4();
var g_groundMatrix = new Matrix4();
var g_ratMatrix = new Matrix4();
var g_ratBodyMatrix = new Matrix4();
var g_ratHeadBase = new Matrix4();
var g_ratPartMatrix = new Matrix4();

// Batched map geometry for performance
var g_mapVertices = null;      // Float32Array of all block vertices
var g_mapUVs = null;           // Float32Array of all block UVs
var g_mapVertexBuffer = null;  // WebGL buffer
var g_mapUVBuffer = null;      // WebGL buffer
var g_mapVertexCount = 0;      // Number of vertices to draw
var g_mapNeedsRebuild = true;  // Flag to rebuild when blocks change

// ============================================================================
// Setup Functions
// ============================================================================

function setupWebGL() {
  canvas = document.getElementById('webgl');
  if (!canvas) {
    console.log('Failed to retrieve the <canvas> element');
    return false;
  }

  gl = getWebGLContext(canvas, { preserveDrawingBuffer: true });
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return false;
  }

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.5, 0.7, 1.0, 1.0);  // Light blue sky color

  return true;
}

function connectVariablesToGLSL() {
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return false;
  }

  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
  u_Sampler2 = gl.getUniformLocation(gl.program, 'u_Sampler2');

  // Set identity matrix as default model matrix
  var identityM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityM.elements);

  return true;
}

// ============================================================================
// Texture Loading
// ============================================================================

function initTextures() {
  // Load grass texture (texture unit 0)
  var image0 = new Image();
  image0.onload = function() { sendTexture(image0, 0); };
  image0.onerror = function() {
    console.log('Failed to load grass texture, using procedural');
    sendProceduralTexture(0, 'grass');
  };
  image0.crossOrigin = 'anonymous';
  image0.src = 'textures/grass.jpg';

  // Load brick texture (texture unit 1)
  var image1 = new Image();
  image1.onload = function() { sendTexture(image1, 1); };
  image1.onerror = function() {
    console.log('Failed to load brick texture, using procedural');
    sendProceduralTexture(1, 'brick');
  };
  image1.crossOrigin = 'anonymous';
  image1.src = 'textures/brick.jpg';

  // Load sky texture (texture unit 2)
  var image2 = new Image();
  image2.onload = function() { sendTexture(image2, 2); };
  image2.onerror = function() {
    console.log('Failed to load sky texture, using procedural');
    sendProceduralTexture(2, 'sky');
  };
  image2.crossOrigin = 'anonymous';
  image2.src = 'textures/sky.jpg';
}

// Create a procedural texture when image files are not available
function sendProceduralTexture(texUnit, type) {
  var size = 64;
  var canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext('2d');

  if (type === 'grass') {
    // Green grass pattern
    ctx.fillStyle = '#3a7d32';
    ctx.fillRect(0, 0, size, size);
    // Add some noise/variation
    for (var i = 0; i < 200; i++) {
      var x = Math.random() * size;
      var y = Math.random() * size;
      var shade = Math.floor(Math.random() * 40) + 30;
      ctx.fillStyle = 'rgb(' + shade + ',' + (shade + 60) + ',' + shade + ')';
      ctx.fillRect(x, y, 2, 4);
    }
  } else if (type === 'brick') {
    // Brick pattern
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#654321';
    // Draw brick lines
    for (var row = 0; row < 4; row++) {
      var y = row * 16;
      ctx.fillRect(0, y, size, 2);
      var offset = (row % 2) * 16;
      for (var col = 0; col < 4; col++) {
        ctx.fillRect(offset + col * 32, y, 2, 16);
      }
    }
  } else if (type === 'sky') {
    // Sky gradient
    var gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, '#4a90d9');
    gradient.addColorStop(1, '#87ceeb');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  // Create texture from canvas
  var texture = gl.createTexture();
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.activeTexture(gl.TEXTURE0 + texUnit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

  if (texUnit === 0) gl.uniform1i(u_Sampler0, 0);
  else if (texUnit === 1) gl.uniform1i(u_Sampler1, 1);
  else if (texUnit === 2) gl.uniform1i(u_Sampler2, 2);

  g_texturesLoaded++;
  console.log('Procedural texture ' + texUnit + ' (' + type + ') created');
}

function sendTexture(image, texUnit) {
  var texture = gl.createTexture();
  if (!texture) {
    console.log('Failed to create texture object');
    return;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.activeTexture(gl.TEXTURE0 + texUnit);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  // Set sampler uniform
  if (texUnit === 0) {
    gl.uniform1i(u_Sampler0, 0);
  } else if (texUnit === 1) {
    gl.uniform1i(u_Sampler1, 1);
  } else if (texUnit === 2) {
    gl.uniform1i(u_Sampler2, 2);
  }

  g_texturesLoaded++;
  console.log('Texture ' + texUnit + ' loaded successfully');
}

// ============================================================================
// Map Generation
// ============================================================================

function initMap() {
  // Initialize 32x32 map with zeros
  for (var x = 0; x < 32; x++) {
    g_map[x] = [];
    for (var z = 0; z < 32; z++) {
      g_map[x][z] = 0;
    }
  }

  // Create border walls (height 4)
  for (var i = 0; i < 32; i++) {
    g_map[0][i] = 4;      // Left edge
    g_map[31][i] = 4;     // Right edge
    g_map[i][0] = 4;      // Front edge
    g_map[i][31] = 4;     // Back edge
  }

  // Create a maze-like structure
  // Central walls
  for (var i = 5; i < 27; i++) {
    if (i !== 15 && i !== 16) {
      g_map[i][10] = 3;
      g_map[i][20] = 3;
    }
  }

  // Cross walls
  for (var i = 5; i < 27; i++) {
    if (i !== 10 && i !== 20) {
      g_map[8][i] = 2;
      g_map[23][i] = 2;
    }
  }

  // Some scattered blocks
  g_map[12][5] = 2;
  g_map[13][5] = 2;
  g_map[19][5] = 1;
  g_map[20][5] = 2;
  g_map[12][26] = 2;
  g_map[19][26] = 1;

  // Create some towers at corners of inner area
  g_map[5][5] = 4;
  g_map[5][26] = 4;
  g_map[26][5] = 4;
  g_map[26][26] = 4;

  // Place the rat in a random location (empty spot)
  placeRat();
}

function placeRat() {
  var attempts = 0;
  while (attempts < 100) {
    var rx = Math.floor(Math.random() * 30) + 1;
    var rz = Math.floor(Math.random() * 30) + 1;
    if (g_map[rx][rz] === 0) {
      g_ratX = rx - 16;  // Convert to world coordinates
      g_ratZ = rz - 16;
      console.log('Rat placed at grid (' + rx + ', ' + rz + '), world (' + g_ratX + ', ' + g_ratZ + ')');
      return;
    }
    attempts++;
  }
  // Fallback position
  g_ratX = 0;
  g_ratZ = 0;
}

// ============================================================================
// Input Handling
// ============================================================================

function setupKeyboard() {
  document.onkeydown = function(ev) {
    g_keys[ev.code] = true;
  };
  document.onkeyup = function(ev) {
    g_keys[ev.code] = false;
  };
}

function setupMouse() {
  // Left click + drag for looking around
  canvas.onmousedown = function(ev) {
    if (ev.button === 0) {
      g_mouseLookEnabled = true;
    }
  };

  canvas.onmouseup = function(ev) {
    if (ev.button === 0) {
      g_mouseLookEnabled = false;
    }
  };

  canvas.onmouseleave = function() {
    g_mouseLookEnabled = false;
  };

  canvas.onmousemove = function(ev) {
    if (g_mouseLookEnabled) {
      camera.panLeft(ev.movementX * -0.2);
      camera.tilt(ev.movementY * -0.2);
    }
  };

  // Right click for block placement
  canvas.oncontextmenu = function(ev) {
    ev.preventDefault();
    if (ev.shiftKey) {
      deleteBlock();
    } else {
      addBlock();
    }
    return false;
  };
}

// ============================================================================
// Block Manipulation
// ============================================================================

function addBlock() {
  // Calculate grid position in front of camera
  var f = new Vector3();
  f.set(camera.at);
  f.sub(camera.eye);
  f.normalize();

  var targetX = Math.floor(camera.eye.elements[0] + f.elements[0] * 3) + 16;
  var targetZ = Math.floor(camera.eye.elements[2] + f.elements[2] * 3) + 16;

  if (targetX >= 0 && targetX < 32 && targetZ >= 0 && targetZ < 32) {
    if (g_map[targetX][targetZ] < 5) {
      g_map[targetX][targetZ]++;
      g_mapNeedsRebuild = true;  // Trigger geometry rebuild
      console.log('Added block at (' + targetX + ', ' + targetZ + '), height: ' + g_map[targetX][targetZ]);
    }
  }
}

function deleteBlock() {
  // Calculate grid position in front of camera
  var f = new Vector3();
  f.set(camera.at);
  f.sub(camera.eye);
  f.normalize();

  var targetX = Math.floor(camera.eye.elements[0] + f.elements[0] * 3) + 16;
  var targetZ = Math.floor(camera.eye.elements[2] + f.elements[2] * 3) + 16;

  if (targetX >= 0 && targetX < 32 && targetZ >= 0 && targetZ < 32) {
    if (g_map[targetX][targetZ] > 0) {
      g_map[targetX][targetZ]--;
      g_mapNeedsRebuild = true;  // Trigger geometry rebuild
      console.log('Removed block at (' + targetX + ', ' + targetZ + '), height: ' + g_map[targetX][targetZ]);
    }
  }
}

// ============================================================================
// Game Logic
// ============================================================================

function checkRatProximity() {
  if (g_ratFound) return;

  var dx = camera.eye.elements[0] - g_ratX;
  var dz = camera.eye.elements[2] - g_ratZ;
  var dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.7) {  // Reduced from 2 - actual touch distance
    g_ratFound = true;
    document.getElementById('game-message').textContent = 'You found the rat! Congratulations!';
    document.getElementById('game-message').style.color = '#0f0';
  }
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

  // Update time
  g_seconds = performance.now() / 1000 - g_startTime;

  // Clear canvas
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Set projection matrix
  var projMatrix = camera.getProjectionMatrix(canvas);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMatrix.elements);

  // Set view matrix
  var viewMatrix = camera.getViewMatrix();
  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);

  // Set global rotation (identity for now, could add global view rotation)
  g_globalRotateMatrix.setIdentity();
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, g_globalRotateMatrix.elements);

  // Draw world
  drawSky();
  drawGround();
  drawMap();
  drawRat();
}

function drawSky() {
  // Large sky cube surrounding everything
  g_skyMatrix.setIdentity();
  g_skyMatrix.translate(0, 10, 0);
  g_skyMatrix.scale(200, 200, 200);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_skyMatrix, [0.5, 0.7, 1.0, 1.0], -2);  // Solid sky blue color
}

function drawGround() {
  // Ground plane
  g_groundMatrix.setIdentity();
  g_groundMatrix.translate(0, -0.5, 0);
  g_groundMatrix.scale(32, 0.1, 32);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_groundMatrix, [0.3, 0.6, 0.3, 1.0], 0);  // Grass texture
}

// Build batched geometry for all map blocks
function buildMapGeometry() {
  // Count total vertices needed (36 per cube)
  var cubeCount = 0;
  for (var x = 0; x < 32; x++) {
    for (var z = 0; z < 32; z++) {
      cubeCount += g_map[x][z];
    }
  }

  var vertexCount = cubeCount * 36;
  g_mapVertices = new Float32Array(vertexCount * 3);
  g_mapUVs = new Float32Array(vertexCount * 2);

  var vIdx = 0, uvIdx = 0;
  for (var x = 0; x < 32; x++) {
    for (var z = 0; z < 32; z++) {
      var height = g_map[x][z];
      for (var y = 0; y < height; y++) {
        // Copy cube vertices with offset (x-16, y, z-16)
        for (var i = 0; i < 36; i++) {
          g_mapVertices[vIdx++] = Cube.vertices[i*3]   + (x - 16);
          g_mapVertices[vIdx++] = Cube.vertices[i*3+1] + y;
          g_mapVertices[vIdx++] = Cube.vertices[i*3+2] + (z - 16);
          g_mapUVs[uvIdx++] = Cube.uvCoords[i*2];
          g_mapUVs[uvIdx++] = Cube.uvCoords[i*2+1];
        }
      }
    }
  }

  g_mapVertexCount = vertexCount;

  // Upload to GPU
  if (!g_mapVertexBuffer) {
    g_mapVertexBuffer = gl.createBuffer();
    g_mapUVBuffer = gl.createBuffer();
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, g_mapVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, g_mapVertices, gl.DYNAMIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, g_mapUVBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, g_mapUVs, gl.DYNAMIC_DRAW);

  g_mapNeedsRebuild = false;
  console.log('Map geometry rebuilt: ' + cubeCount + ' cubes, ' + vertexCount + ' vertices');
}

function drawMap() {
  if (g_mapNeedsRebuild) {
    buildMapGeometry();
  }

  if (g_mapVertexCount === 0) return;

  // Set uniforms once
  gl.uniform1i(u_whichTexture, 1);  // Brick texture
  gl.uniform4f(u_FragColor, 1.0, 1.0, 1.0, 1.0);
  g_blockMatrix.setIdentity();
  gl.uniformMatrix4fv(u_ModelMatrix, false, g_blockMatrix.elements);

  // Bind batched buffers
  gl.bindBuffer(gl.ARRAY_BUFFER, g_mapVertexBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.bindBuffer(gl.ARRAY_BUFFER, g_mapUVBuffer);
  gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_UV);

  // Single draw call for entire map!
  gl.drawArrays(gl.TRIANGLES, 0, g_mapVertexCount);
}

// ============================================================================
// Rat Drawing (from BlockyAnimal.js, adapted)
// ============================================================================

// Rat colors
const RAT_BODY_COLOR = [0.5, 0.45, 0.4, 1.0];
const RAT_HEAD_COLOR = [0.55, 0.5, 0.45, 1.0];
const RAT_LEG_COLOR = [0.45, 0.4, 0.35, 1.0];
const RAT_FOOT_COLOR = [0.7, 0.55, 0.5, 1.0];
const RAT_EAR_COLOR = [0.75, 0.6, 0.55, 1.0];
const RAT_SNOUT_COLOR = [0.6, 0.55, 0.5, 1.0];
const RAT_EYE_COLOR = [0.1, 0.1, 0.1, 1.0];
const RAT_NOSE_COLOR = [0.2, 0.15, 0.15, 1.0];

function drawRat() {
  if (g_ratFound) return;  // Don't draw if found

  // Animation
  var legSwing = 30 * Math.sin(g_seconds * 6);
  var headNod = 5 * Math.sin(g_seconds * 3);
  var bodyBob = 0.02 * Math.sin(g_seconds * 6);

  // Base transform - position rat in world
  g_ratMatrix.setIdentity();
  g_ratMatrix.translate(g_ratX, 0.15, g_ratZ);
  g_ratMatrix.scale(0.5, 0.5, 0.5);  // Scale down the rat
  g_ratMatrix.rotate(g_seconds * 30, 0, 1, 0);  // Slow rotation so player can spot it

  // Body - store in g_ratBodyMatrix for legs to reference
  g_ratBodyMatrix.set(g_ratMatrix);
  g_ratBodyMatrix.translate(0, bodyBob, 0);
  g_ratPartMatrix.set(g_ratBodyMatrix);
  g_ratPartMatrix.scale(0.5, 0.3, 0.7);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_ratPartMatrix, RAT_BODY_COLOR, -2);

  // Head - store base in g_ratHeadBase for face parts to reference
  g_ratHeadBase.set(g_ratBodyMatrix);
  g_ratHeadBase.translate(0, 0.08 + headNod * 0.005, 0.35);
  g_ratHeadBase.rotate(headNod, 1, 0, 0);
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.scale(0.28, 0.24, 0.28);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_ratPartMatrix, RAT_HEAD_COLOR, -2);

  // Snout
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(0, -0.02, 0.18);
  g_ratPartMatrix.scale(0.14, 0.1, 0.12);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_ratPartMatrix, RAT_SNOUT_COLOR, -2);

  // Nose
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(0, -0.02, 0.25);
  g_ratPartMatrix.scale(0.06, 0.05, 0.04);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_ratPartMatrix, RAT_NOSE_COLOR, -2);

  // Left Ear
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(-0.12, 0.12, 0);
  g_ratPartMatrix.scale(0.08, 0.12, 0.04);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_ratPartMatrix, RAT_EAR_COLOR, -2);

  // Right Ear
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(0.12, 0.12, 0);
  g_ratPartMatrix.scale(0.08, 0.12, 0.04);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_ratPartMatrix, RAT_EAR_COLOR, -2);

  // Left Eye
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(-0.1, 0.04, 0.12);
  g_ratPartMatrix.scale(0.05, 0.05, 0.05);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_ratPartMatrix, RAT_EYE_COLOR, -2);

  // Right Eye
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(0.1, 0.04, 0.12);
  g_ratPartMatrix.scale(0.05, 0.05, 0.05);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_ratPartMatrix, RAT_EYE_COLOR, -2);

  // Legs (simplified - 4 legs)
  drawRatLeg(-0.18, 0.2, legSwing);
  drawRatLeg(0.18, 0.2, -legSwing);
  drawRatLeg(-0.18, -0.22, -legSwing);
  drawRatLeg(0.18, -0.22, legSwing);
}

function drawRatLeg(xOffset, zOffset, swing) {
  g_ratPartMatrix.set(g_ratBodyMatrix);
  g_ratPartMatrix.translate(xOffset, -0.12, zOffset);
  g_ratPartMatrix.rotate(swing, 1, 0, 0);
  g_ratPartMatrix.translate(0, -0.06, 0);
  g_ratPartMatrix.scale(0.07, 0.12, 0.07);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_ratPartMatrix, RAT_LEG_COLOR, -2);
}

// ============================================================================
// Animation Loop
// ============================================================================

function processInput() {
  var speed = 0.1;  // Per-frame speed (lower since called every frame)
  var rotSpeed = 2;

  if (g_keys['KeyW']) camera.moveForward(speed, g_map);
  if (g_keys['KeyS']) camera.moveBackward(speed, g_map);
  if (g_keys['KeyA']) camera.moveLeft(speed, g_map);
  if (g_keys['KeyD']) camera.moveRight(speed, g_map);
  if (g_keys['KeyQ']) camera.panLeft(rotSpeed);
  if (g_keys['KeyE']) camera.panRight(rotSpeed);

  checkRatProximity();
}

function tick() {
  processInput();
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

  // Create camera
  camera = new Camera();

  // Create static buffers
  Cube.createGLBuffers(gl);

  // Initialize map
  initMap();

  // Load textures
  initTextures();

  // Setup input
  setupKeyboard();
  setupMouse();

  // Initialize FPS tracking
  g_lastFPSUpdate = performance.now() / 1000;

  // Start animation loop
  tick();

  console.log('World initialized successfully!');
  console.log('Controls: WASD to move, QE to rotate, Left-drag to look, Right-click to place block, Shift+Right-click to remove');
  console.log('Find the rat hidden in the maze!');
}
