// World.js - Virtual World with textures, camera, and Phong lighting
// By Ashan Devine - CSE 160 Assignment 4

// ============================================================================
// Shaders
// ============================================================================

var VSHADER_SOURCE = `
attribute vec4 a_Position;
attribute vec2 a_UV;
attribute vec3 a_Normal;

uniform mat4 u_ModelMatrix;
uniform mat4 u_ViewMatrix;
uniform mat4 u_ProjectionMatrix;
uniform mat4 u_GlobalRotateMatrix;
uniform mat4 u_NormalMatrix;

varying vec2 v_UV;
varying vec3 v_Normal;
varying vec3 v_Position;

void main() {
  gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
  v_UV = a_UV;
  v_Position = vec3(u_ModelMatrix * a_Position);
  v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 0.0)));
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
varying vec3 v_Normal;
varying vec3 v_Position;

uniform int u_ShowNormals;
uniform int u_LightingOn;

uniform int  u_LightOn;
uniform vec3 u_LightPos;
uniform vec3 u_LightColor;

uniform int   u_SpotOn;
uniform vec3  u_SpotPos;
uniform vec3  u_SpotDir;
uniform float u_SpotCutoff;
uniform float u_SpotExponent;

uniform vec3 u_CameraPos;
uniform int  u_FloodOn;
uniform vec3 u_FloodDir;
uniform float u_FloodIntensity;

void main() {
  vec4 baseColor;
  if (u_whichTexture == -2) {
    baseColor = u_FragColor;
  } else if (u_whichTexture == -1) {
    baseColor = vec4(v_UV, 1.0, 1.0);
  } else if (u_whichTexture == 0) {
    baseColor = texture2D(u_Sampler0, v_UV);
  } else if (u_whichTexture == 1) {
    baseColor = texture2D(u_Sampler1, v_UV);
  } else if (u_whichTexture == 2) {
    baseColor = texture2D(u_Sampler2, v_UV);
  } else {
    baseColor = vec4(1.0, 0.0, 1.0, 1.0);
  }

  if (u_ShowNormals == 1) {
    gl_FragColor = vec4(normalize(v_Normal) * 0.5 + 0.5, 1.0);
    return;
  }

  if (u_LightingOn == 0) {
    gl_FragColor = baseColor;
    return;
  }

  vec3 N = normalize(v_Normal);
  vec3 V = normalize(u_CameraPos - v_Position);

  vec3 result = 0.05 * baseColor.rgb;

  if (u_LightOn == 1) {
    vec3 L = normalize(u_LightPos - v_Position);
    float diff = max(dot(N, L), 0.0);
    vec3 R = reflect(-L, N);
    float spec = (diff > 0.0) ? pow(max(dot(R, V), 0.0), 32.0) : 0.0;
    result += u_LightColor * (diff * baseColor.rgb + 0.5 * spec * vec3(1.0));
  }

  if (u_SpotOn == 1) {
    vec3 L = normalize(u_SpotPos - v_Position);
    vec3 D = normalize(-u_SpotDir);
    float cosAngle = dot(D, L);
    if (cosAngle >= u_SpotCutoff) {
      float spotFactor = pow(cosAngle, u_SpotExponent);
      float diff = max(dot(N, L), 0.0);
      vec3 R = reflect(-L, N);
      float spec = (diff > 0.0) ? pow(max(dot(R, V), 0.0), 32.0) : 0.0;
      result += spotFactor * (diff * baseColor.rgb + 0.5 * spec * vec3(1.0));
    }
  }

  if (u_FloodOn == 1) {
    vec3 Lf = normalize(-u_FloodDir);
    float diffF = max(dot(N, Lf), 0.0);
    vec3 Rf = reflect(-Lf, N);
    float specF = (diffF > 0.0) ? pow(max(dot(Rf, V), 0.0), 20.0) : 0.0;
    result += u_FloodIntensity * (0.15 * baseColor.rgb + diffF * baseColor.rgb + 0.25 * specF * vec3(1.0));
  }

  result = clamp(result, 0.0, 1.0);
  gl_FragColor = vec4(result, baseColor.a);
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

// Lighting shader locations
var a_Normal;
var u_NormalMatrix;
var u_ShowNormals;
var u_LightingOn;

// Point light uniforms
var u_LightPos;
var u_LightColor;
var u_LightOn;

// Spotlight uniforms
var u_SpotPos;
var u_SpotDir;
var u_SpotCutoff;
var u_SpotExponent;
var u_SpotOn;

// Camera position uniform
var u_CameraPos;
var u_FloodOn;
var u_FloodDir;
var u_FloodIntensity;

// Lighting state
var g_lightingOn   = true;
var g_showNormals  = false;
var g_lightPos     = [5.0, 3.0, 0.0];
var g_lightColor   = [1.0, 1.0, 1.0];
var g_lightAngle   = 0.0;
var g_lightOn      = true;

// Spotlight state
var g_spotPos      = [0.0, 8.0, 0.0];
var g_spotDir      = [0.0, -1.0, 0.0];
var g_spotCutoff   = Math.cos(20 * Math.PI / 180);
var g_spotExponent = 15.0;
var g_spotAngle    = 315.0;
var g_spotOn       = true;
var g_spotTarget   = [0.0, 0.2, 0.0];  // Aim at bunny's location by default
var g_spotRadius   = 12.0;
var g_spotHeight   = 4.5;

// Floodlight state
var g_floodOn        = true;
var g_floodDir       = [0.0, -1.0, 0.0];
var g_floodIntensity = 0.0;

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
var g_autoLightOrbit = true;
var g_lastFrameTimeSeconds = null;
var g_deltaTime = 0;

// Mouse look state
var g_mouseLookEnabled = false;

// Key states for smooth movement
var g_keys = {};

// Bunny models
var g_bunny = null;
var g_floatingBunny = null;
var g_floatingBunnyAnchor = { x: 1.25, y: -0.2, z: -0.65 };  // Near center, slightly offset
var g_floatingBunnyScale = 0.12;
var g_floatingBunnyBobAmplitude = 0.12;
var g_floatingBunnyBobSpeed = 2.4;
var g_floatingBunnySpinSpeed = 40;

function updateSpotlightPosition() {
  var rad = g_spotAngle * Math.PI / 180;
  g_spotPos[0] = g_spotTarget[0] + g_spotRadius * Math.cos(rad);
  g_spotPos[1] = g_spotHeight;
  g_spotPos[2] = g_spotTarget[2] + g_spotRadius * Math.sin(rad);
  g_spotDir[0] = g_spotTarget[0] - g_spotPos[0];
  g_spotDir[1] = g_spotTarget[1] - g_spotPos[1];
  g_spotDir[2] = g_spotTarget[2] - g_spotPos[2];
}

// Rat position and state
var g_ratX = 0;
var g_ratZ = 0;
var g_ratFound = false;

// Light marker matrix
var g_lightMarkerMatrix = new Matrix4();

// Rotation matrices (reusable)
var g_globalRotateMatrix = new Matrix4();

// Reusable matrices for performance (avoid allocations in render loop)
var g_blockMatrix = new Matrix4();
var g_sphereMatrix = new Matrix4();
var g_skyMatrix = new Matrix4();
var g_groundMatrix = new Matrix4();
var g_ratMatrix = new Matrix4();
var g_ratBodyMatrix = new Matrix4();
var g_ratHeadBase = new Matrix4();
var g_ratPartMatrix = new Matrix4();
var g_floodPanelMatrix = new Matrix4();

// Batched map geometry for performance
var g_mapVertices = null;      // Float32Array of all block vertices
var g_mapUVs = null;           // Float32Array of all block UVs
var g_mapVertexBuffer = null;  // WebGL buffer
var g_mapUVBuffer = null;      // WebGL buffer
var g_mapVertexCount = 0;      // Number of vertices to draw
var g_mapNeedsRebuild = true;  // Flag to rebuild when blocks change
var g_mapNormals      = null;
var g_mapNormalBuffer = null;
var g_dirtyColumns    = new Set();
var g_columnMeshes    = {};
var g_columnOrder     = [];

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

  // Lighting attribute and uniforms
  a_Normal        = gl.getAttribLocation(gl.program,  'a_Normal');
  u_NormalMatrix  = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  u_ShowNormals   = gl.getUniformLocation(gl.program, 'u_ShowNormals');
  u_LightingOn    = gl.getUniformLocation(gl.program, 'u_LightingOn');
  u_LightPos      = gl.getUniformLocation(gl.program, 'u_LightPos');
  u_LightColor    = gl.getUniformLocation(gl.program, 'u_LightColor');
  u_LightOn       = gl.getUniformLocation(gl.program, 'u_LightOn');
  u_SpotPos       = gl.getUniformLocation(gl.program, 'u_SpotPos');
  u_SpotDir       = gl.getUniformLocation(gl.program, 'u_SpotDir');
  u_SpotCutoff    = gl.getUniformLocation(gl.program, 'u_SpotCutoff');
  u_SpotExponent  = gl.getUniformLocation(gl.program, 'u_SpotExponent');
  u_SpotOn        = gl.getUniformLocation(gl.program, 'u_SpotOn');
  u_CameraPos     = gl.getUniformLocation(gl.program, 'u_CameraPos');
  u_FloodOn       = gl.getUniformLocation(gl.program, 'u_FloodOn');
  u_FloodDir      = gl.getUniformLocation(gl.program, 'u_FloodDir');
  u_FloodIntensity= gl.getUniformLocation(gl.program, 'u_FloodIntensity');

  // Safe defaults — lighting off so existing render looks unchanged
  gl.uniform1i(u_ShowNormals,  0);
  gl.uniform1i(u_LightingOn,   1);
  gl.uniform1i(u_LightOn,      0);
  gl.uniform1i(u_SpotOn,       0);
  gl.uniform3f(u_LightPos,     5.0, 3.0, 0.0);
  gl.uniform3f(u_LightColor,   1.0, 1.0, 1.0);
  gl.uniform3f(u_SpotPos,      0.0, 8.0, 0.0);
  gl.uniform3f(u_SpotDir,      0.0, -1.0, 0.0);
  gl.uniform1f(u_SpotCutoff,   0.940);
  gl.uniform1f(u_SpotExponent, 15.0);
  gl.uniform3f(u_CameraPos,    0.0, 0.5, 3.0);
  gl.uniform1i(u_FloodOn,      1);
  gl.uniform3f(u_FloodDir,     g_floodDir[0], g_floodDir[1], g_floodDir[2]);
  gl.uniform1f(u_FloodIntensity, g_floodIntensity);

  // Default normal matrix = identity
  var identityNM = new Matrix4();
  gl.uniformMatrix4fv(u_NormalMatrix, false, identityNM.elements);

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

    // Add clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    // Draw a few random clouds
    for (var i = 0; i < 5; i++) {
      var cx = Math.random() * size;
      var cy = Math.random() * (size * 0.6); // Keep clouds in upper 60%
      var scale = Math.random() * 0.5 + 0.8;

      ctx.beginPath();
      ctx.arc(cx, cy, 6 * scale, 0, Math.PI * 2);
      ctx.arc(cx + 5 * scale, cy + 2 * scale, 5 * scale, 0, Math.PI * 2);
      ctx.arc(cx - 5 * scale, cy + 2 * scale, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
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

  g_mapNeedsRebuild = true;
  g_dirtyColumns.clear();
  g_columnMeshes = {};
  g_columnOrder = [];
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

function resetContinuousInput() {
  g_keys = {};
  g_mouseLookEnabled = false;
}

function setupKeyboard() {
  document.onkeydown = function(ev) {
    g_keys[ev.code] = true;
    if (ev.code === 'Space') {
      ev.preventDefault();
      camera.jump();
    }
    // Prevent scrolling with arrow keys
    if (ev.code === 'ArrowUp' || ev.code === 'ArrowDown') {
      ev.preventDefault();
    }
  };
  document.onkeyup = function(ev) {
    g_keys[ev.code] = false;
  };
  window.addEventListener('blur', resetContinuousInput);
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

function columnKey(x, z) {
  return x + ':' + z;
}

function markColumnDirty(x, z) {
  g_dirtyColumns.add(columnKey(x, z));
}

function addBlock() {
  // Calculate grid position in front of camera
  var f = new Vector3();
  f.set(camera.at);
  f.sub(camera.eye);
  f.normalize();

  var targetX = Math.floor(camera.eye.elements[0] + f.elements[0] * 3 + 0.5) + 16;
  var targetZ = Math.floor(camera.eye.elements[2] + f.elements[2] * 3 + 0.5) + 16;

  if (targetX >= 0 && targetX < 32 && targetZ >= 0 && targetZ < 32) {
    if (g_map[targetX][targetZ] < 5) {
      g_map[targetX][targetZ]++;
      markColumnDirty(targetX, targetZ);
      console.log('Added block at (' + targetX + ', ' + targetZ + '), height: ' + g_map[targetX][targetZ]);
    }
  }
}

function deleteBlock() {
  // Calculate view direction
  var f = new Vector3();
  f.set(camera.at);
  f.sub(camera.eye);
  f.normalize();

  // Raycast up to 5 units to find the first block
  // Start at 0.2 to avoid clipping self/camera
  for (var t = 0.2; t < 5.0; t += 0.1) {
    var checkPos = new Vector3();
    checkPos.set(f);
    checkPos.mul(t);
    checkPos.add(camera.eye);

    var x = checkPos.elements[0];
    var y = checkPos.elements[1];
    var z = checkPos.elements[2];

    var gridX = Math.floor(x + 0.5) + 16;
    var gridZ = Math.floor(z + 0.5) + 16;

    if (gridX >= 0 && gridX < 32 && gridZ >= 0 && gridZ < 32) {
      // Get stack height at this grid position
      var height = g_map[gridX][gridZ];

      // Check if ray is hitting the block stack
      // Blocks go from y=-0.5 to height-0.5
      // We check if point is within this vertical range
      if (height > 0 && y < height && y > -0.5) {
        g_map[gridX][gridZ]--;
        markColumnDirty(gridX, gridZ);
        console.log('Removed block at (' + gridX + ', ' + gridZ + '), dist: ' + t.toFixed(2));
        return; // Stop after removing one block
      }
    }
  }
  console.log('No block found to remove');
}

// ============================================================================
// Rat Logic
// ============================================================================

function checkRatProximity() {
  if (g_ratFound) return;

  var dx = camera.eye.elements[0] - g_ratX;
  var dz = camera.eye.elements[2] - g_ratZ;
  var dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 0.7) {
    g_ratFound = true;

    // Respawn rat after 1 second
    setTimeout(function() {
      placeRat();
      g_ratFound = false;
    }, 1000);
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

function renderScene(deltaTime, currentTimeSeconds) {
  var dt = deltaTime || (1 / 60);
  updateFPS();

  var currentTime = currentTimeSeconds || (performance.now() / 1000);
  g_seconds = currentTime - g_startTime;

  // Clear canvas
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (g_autoLightOrbit) {
    var lightOrbitSpeed = 30; // degrees per second
    var lightRadius = 5.0;
    g_lightAngle = (g_lightAngle + lightOrbitSpeed * dt) % 360;
    var lightRad = g_lightAngle * Math.PI / 180;
    g_lightPos[0] = lightRadius * Math.cos(lightRad);
    g_lightPos[1] = 3.0;
    g_lightPos[2] = lightRadius * Math.sin(lightRad);
  }

  var spotOrbitSpeed = 20;
  g_spotAngle = (g_spotAngle + spotOrbitSpeed * dt) % 360;

  updateSpotlightPosition();

  // Pass per-frame lighting flags
  gl.uniform1i(u_ShowNormals, g_showNormals ? 1 : 0);
  gl.uniform1i(u_LightingOn,  g_lightingOn  ? 1 : 0);

  // Pass camera position for specular
  gl.uniform3f(u_CameraPos,
    camera.eye.elements[0],
    camera.eye.elements[1],
    camera.eye.elements[2]);

  // Pass light state to shader
  gl.uniform3fv(u_LightPos,    g_lightPos);
  gl.uniform3fv(u_LightColor,  g_lightColor);
  gl.uniform1i(u_LightOn,      g_lightOn   ? 1 : 0);
  gl.uniform3fv(u_SpotPos,     g_spotPos);
  gl.uniform3fv(u_SpotDir,     g_spotDir);
  gl.uniform1f(u_SpotCutoff,   g_spotCutoff);
  gl.uniform1f(u_SpotExponent, g_spotExponent);
  gl.uniform1i(u_SpotOn,       g_spotOn    ? 1 : 0);
  gl.uniform1i(u_FloodOn,      g_floodOn   ? 1 : 0);
  gl.uniform3fv(u_FloodDir,    g_floodDir);
  gl.uniform1f(u_FloodIntensity, g_floodIntensity);

  // Set projection matrix
  var projMatrix = camera.getProjectionMatrix(canvas);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, projMatrix.elements);

  // Set view matrix
  var viewMatrix = camera.getViewMatrix();
  gl.uniformMatrix4fv(u_ViewMatrix, false, viewMatrix.elements);

  // Set global rotation (identity)
  g_globalRotateMatrix.setIdentity();
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, g_globalRotateMatrix.elements);

  // Sky is never lit
  gl.uniform1i(u_LightingOn, 0);
  drawSky();

  // Everything else respects the user's lighting toggle
  gl.uniform1i(u_LightingOn, g_lightingOn ? 1 : 0);
  drawGround();
  drawSpheres();
  drawBunny();
  drawFloatingBunny();
  drawMap();
  drawRat();

  // Light markers: always unlit (handled inside drawLightMarker)
  drawLightMarker();
  drawFloodPanel();
}

function drawSky() {
  // Large sky cube surrounding everything
  g_skyMatrix.setIdentity();
  g_skyMatrix.translate(0, 10, 0);
  g_skyMatrix.scale(200, 200, 200);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_skyMatrix, [1.0, 1.0, 1.0, 1.0], 2);  // Sky texture
}

function drawGround() {
  // Ground plane
  g_groundMatrix.setIdentity();
  g_groundMatrix.translate(0, -0.5, 0);
  g_groundMatrix.scale(32, 0.1, 32);
  drawCubeWithNormals(g_groundMatrix, [0.3, 0.6, 0.3, 1.0], 0);
}

// Build batched geometry for all map blocks
function createColumnMesh(x, z) {
  var height = g_map[x][z];
  if (height <= 0) {
    return {
      vertexCount: 0,
      vertices: new Float32Array(0),
      uvs: new Float32Array(0),
      normals: new Float32Array(0)
    };
  }

  var verts = [];
  var uvs = [];
  var norms = [];
  for (var y = 0; y < height; y++) {
    for (var i = 0; i < 36; i++) {
      verts.push(Cube.vertices[i*3]   + (x - 16));
      verts.push(Cube.vertices[i*3+1] + y);
      verts.push(Cube.vertices[i*3+2] + (z - 16));
      uvs.push(Cube.uvCoords[i*2], Cube.uvCoords[i*2+1]);
      norms.push(Cube.normals[i*3], Cube.normals[i*3 + 1], Cube.normals[i*3 + 2]);
    }
  }

  return {
    vertexCount: verts.length / 3,
    vertices: new Float32Array(verts),
    uvs: new Float32Array(uvs),
    normals: new Float32Array(norms)
  };
}

function ensureColumnOrder() {
  if (g_columnOrder.length) return;
  for (var x = 0; x < 32; x++) {
    for (var z = 0; z < 32; z++) {
      g_columnOrder.push(columnKey(x, z));
    }
  }
}

function uploadColumnMeshes() {
  var totalVertices = 0;
  for (var i = 0; i < g_columnOrder.length; i++) {
    var mesh = g_columnMeshes[g_columnOrder[i]];
    if (mesh) totalVertices += mesh.vertexCount;
  }

  g_mapVertexCount = totalVertices;
  if (totalVertices === 0) {
    g_mapVertices = null;
    g_mapUVs = null;
    g_mapNormals = null;
    return;
  }

  g_mapVertices = new Float32Array(totalVertices * 3);
  g_mapUVs = new Float32Array(totalVertices * 2);
  g_mapNormals = new Float32Array(totalVertices * 3);

  var vOffset = 0, uvOffset = 0, nOffset = 0;
  for (var j = 0; j < g_columnOrder.length; j++) {
    var key = g_columnOrder[j];
    var meshData = g_columnMeshes[key];
    if (!meshData || meshData.vertexCount === 0) continue;
    g_mapVertices.set(meshData.vertices, vOffset);
    vOffset += meshData.vertices.length;
    g_mapUVs.set(meshData.uvs, uvOffset);
    uvOffset += meshData.uvs.length;
    g_mapNormals.set(meshData.normals, nOffset);
    nOffset += meshData.normals.length;
  }

  if (!g_mapVertexBuffer) g_mapVertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_mapVertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, g_mapVertices, gl.DYNAMIC_DRAW);

  if (!g_mapUVBuffer) g_mapUVBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_mapUVBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, g_mapUVs, gl.DYNAMIC_DRAW);

  if (!g_mapNormalBuffer) g_mapNormalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, g_mapNormalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, g_mapNormals, gl.DYNAMIC_DRAW);
}

function buildMapGeometry() {
  ensureColumnOrder();

  if (g_mapNeedsRebuild) {
    for (var x = 0; x < 32; x++) {
      for (var z = 0; z < 32; z++) {
        var key = columnKey(x, z);
        g_columnMeshes[key] = createColumnMesh(x, z);
      }
    }
    g_mapNeedsRebuild = false;
    g_dirtyColumns.clear();
  } else if (g_dirtyColumns.size > 0) {
    g_dirtyColumns.forEach(function(key) {
      var parts = key.split(':');
      var cx = parseInt(parts[0], 10);
      var cz = parseInt(parts[1], 10);
      g_columnMeshes[key] = createColumnMesh(cx, cz);
    });
    g_dirtyColumns.clear();
  } else {
    return;
  }

  uploadColumnMeshes();
}

function drawMap() {
  if (g_mapNeedsRebuild || g_dirtyColumns.size > 0) {
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

  gl.bindBuffer(gl.ARRAY_BUFFER, g_mapNormalBuffer);
  gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Normal);

  // Map blocks use identity model matrix, so normal matrix = identity
  var identityM = new Matrix4();
  gl.uniformMatrix4fv(u_NormalMatrix, false, identityM.elements);

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
const RAT_TAIL_COLOR = [0.75, 0.65, 0.6, 1.0];  // Pinkish tail

function drawRat() {
  if (g_ratFound) return;  // Don't draw if found

  // Animation
  var legSwing = 30 * Math.sin(g_seconds * 6);
  var headNod = 5 * Math.sin(g_seconds * 3);
  var bodyBob = 0.02 * Math.sin(g_seconds * 6);
  var tailSwing = 20 * Math.sin(g_seconds * 4);  // Side-to-side sway

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
  drawCubeWithNormals(g_ratPartMatrix, RAT_BODY_COLOR, -2);

  // Head - store base in g_ratHeadBase for face parts to reference
  g_ratHeadBase.set(g_ratBodyMatrix);
  g_ratHeadBase.translate(0, 0.08 + headNod * 0.005, 0.35);
  g_ratHeadBase.rotate(headNod, 1, 0, 0);
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.scale(0.28, 0.24, 0.28);
  drawCubeWithNormals(g_ratPartMatrix, RAT_HEAD_COLOR, -2);

  // Snout
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(0, -0.02, 0.18);
  g_ratPartMatrix.scale(0.14, 0.1, 0.12);
  drawCubeWithNormals(g_ratPartMatrix, RAT_SNOUT_COLOR, -2);

  // Nose
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(0, -0.02, 0.25);
  g_ratPartMatrix.scale(0.06, 0.05, 0.04);
  drawCubeWithNormals(g_ratPartMatrix, RAT_NOSE_COLOR, -2);

  // Left Ear
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(-0.12, 0.12, 0);
  g_ratPartMatrix.scale(0.08, 0.12, 0.04);
  drawCubeWithNormals(g_ratPartMatrix, RAT_EAR_COLOR, -2);

  // Right Ear
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(0.12, 0.12, 0);
  g_ratPartMatrix.scale(0.08, 0.12, 0.04);
  drawCubeWithNormals(g_ratPartMatrix, RAT_EAR_COLOR, -2);

  // Left Eye
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(-0.1, 0.04, 0.12);
  g_ratPartMatrix.scale(0.05, 0.05, 0.05);
  drawCubeWithNormals(g_ratPartMatrix, RAT_EYE_COLOR, -2);

  // Right Eye
  g_ratPartMatrix.set(g_ratHeadBase);
  g_ratPartMatrix.translate(0.1, 0.04, 0.12);
  g_ratPartMatrix.scale(0.05, 0.05, 0.05);
  drawCubeWithNormals(g_ratPartMatrix, RAT_EYE_COLOR, -2);

  // Legs (simplified - 4 legs)
  drawRatLeg(-0.18, 0.2, legSwing);
  drawRatLeg(0.18, 0.2, -legSwing);
  drawRatLeg(-0.18, -0.22, -legSwing);
  drawRatLeg(0.18, -0.22, legSwing);

  // Tail - 3 segments for curved appearance
  // Segment 1 (base)
  g_ratPartMatrix.set(g_ratBodyMatrix);
  g_ratPartMatrix.translate(0, 0, -0.35);
  g_ratPartMatrix.rotate(tailSwing, 0, 1, 0);
  g_ratPartMatrix.translate(0, 0, -0.12);
  g_ratPartMatrix.scale(0.06, 0.06, 0.25);
  drawCubeWithNormals(g_ratPartMatrix, RAT_TAIL_COLOR, -2);

  // Segment 2 (middle)
  g_ratPartMatrix.set(g_ratBodyMatrix);
  g_ratPartMatrix.translate(0, 0, -0.35);
  g_ratPartMatrix.rotate(tailSwing, 0, 1, 0);
  g_ratPartMatrix.translate(0, 0, -0.25);
  g_ratPartMatrix.rotate(tailSwing * 0.5, 0, 1, 0);
  g_ratPartMatrix.translate(0, 0, -0.1);
  g_ratPartMatrix.scale(0.04, 0.04, 0.2);
  drawCubeWithNormals(g_ratPartMatrix, RAT_TAIL_COLOR, -2);

  // Segment 3 (tip)
  g_ratPartMatrix.set(g_ratBodyMatrix);
  g_ratPartMatrix.translate(0, 0, -0.35);
  g_ratPartMatrix.rotate(tailSwing, 0, 1, 0);
  g_ratPartMatrix.translate(0, 0, -0.25);
  g_ratPartMatrix.rotate(tailSwing * 0.5, 0, 1, 0);
  g_ratPartMatrix.translate(0, 0, -0.2);
  g_ratPartMatrix.rotate(tailSwing * 0.3, 0, 1, 0);
  g_ratPartMatrix.translate(0, 0, -0.08);
  g_ratPartMatrix.scale(0.025, 0.025, 0.15);
  drawCubeWithNormals(g_ratPartMatrix, RAT_TAIL_COLOR, -2);
}

function drawRatLeg(xOffset, zOffset, swing) {
  g_ratPartMatrix.set(g_ratBodyMatrix);
  g_ratPartMatrix.translate(xOffset, -0.12, zOffset);
  g_ratPartMatrix.rotate(swing, 1, 0, 0);
  g_ratPartMatrix.translate(0, -0.06, 0);
  g_ratPartMatrix.scale(0.07, 0.12, 0.07);
  drawCubeWithNormals(g_ratPartMatrix, RAT_LEG_COLOR, -2);
}

function drawSpheres() {
  // Sphere 1: white, near center
  g_sphereMatrix.setIdentity();
  g_sphereMatrix.translate(3.0, 0.5, 2.6);
  g_sphereMatrix.scale(0.8, 0.8, 0.8);
  drawSphere(g_sphereMatrix, [1.0, 1.0, 1.0, 1.0], -2);

  // Sphere 2: colored, offset
  g_sphereMatrix.setIdentity();
  g_sphereMatrix.translate(-3.0, 0.5, -3.0);
  g_sphereMatrix.scale(0.6, 0.6, 0.6);
  drawSphere(g_sphereMatrix, [0.2, 0.6, 1.0, 1.0], -2);
}

function drawBunny() {
  if (g_bunny) g_bunny.render();
}

function drawFloatingBunny() {
  if (!g_floatingBunny || !g_floatingBunny.isLoaded) return;

  var bob = g_floatingBunnyBobAmplitude * Math.sin(g_seconds * g_floatingBunnyBobSpeed);
  var spin = (g_seconds * g_floatingBunnySpinSpeed) % 360;

  g_floatingBunny.matrix.setIdentity();
  g_floatingBunny.matrix.translate(
    g_floatingBunnyAnchor.x,
    g_floatingBunnyAnchor.y + bob,
    g_floatingBunnyAnchor.z
  );
  g_floatingBunny.matrix.rotate(spin, 0, 1, 0);
  g_floatingBunny.matrix.scale(
    g_floatingBunnyScale,
    g_floatingBunnyScale,
    g_floatingBunnyScale
  );

  g_floatingBunny.render();
}

function drawLightMarker() {
  // Markers are always unlit regardless of global lighting toggle
  gl.uniform1i(u_LightingOn, 0);

  g_lightMarkerMatrix.setIdentity();
  g_lightMarkerMatrix.translate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  g_lightMarkerMatrix.scale(0.15, 0.15, 0.15);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_lightMarkerMatrix, [1.0, 1.0, 0.0, 1.0], -2);

  g_lightMarkerMatrix.setIdentity();
  g_lightMarkerMatrix.translate(g_spotPos[0], g_spotPos[1], g_spotPos[2]);
  g_lightMarkerMatrix.scale(0.15, 0.15, 0.15);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_lightMarkerMatrix, [0.0, 0.5, 1.0, 1.0], -2);

  // Restore lighting state for any draw calls that follow
  gl.uniform1i(u_LightingOn, g_lightingOn ? 1 : 0);
}

function drawFloodPanel() {
  if (!g_floodOn) return;

  gl.uniform1i(u_LightingOn, 0);
  g_floodPanelMatrix.setIdentity();
  g_floodPanelMatrix.translate(0, 10.5, 0);
  g_floodPanelMatrix.scale(18, 0.08, 18);

  var brightness = Math.min(1.0, 0.55 + 0.15 * g_floodIntensity);
  drawCubeTextured(gl, a_Position, a_UV, u_ModelMatrix, u_FragColor, u_whichTexture,
    g_floodPanelMatrix, [brightness, brightness, 0.9, 1.0], -2);

  gl.uniform1i(u_LightingOn, g_lightingOn ? 1 : 0);
}

// ============================================================================
// Animation Loop
// ============================================================================

function processInput(deltaTime) {
  var dt = deltaTime || (1 / 60);
  var speed = 4.0 * dt;    // units per second
  var rotSpeed = 90 * dt;  // degrees per second

  if (g_keys['ShiftLeft'] || g_keys['ShiftRight']) {
    speed *= 3.0;
  }

  if (g_keys['KeyW'] || g_keys['ArrowUp']) camera.moveForward(speed, g_map);
  if (g_keys['KeyS'] || g_keys['ArrowDown']) camera.moveBackward(speed, g_map);
  if (g_keys['KeyA']) camera.moveLeft(speed, g_map);
  if (g_keys['KeyD']) camera.moveRight(speed, g_map);
  if (g_keys['KeyQ'] || g_keys['ArrowLeft'] || g_keys['KeyJ']) camera.panLeft(rotSpeed);
  if (g_keys['KeyE'] || g_keys['ArrowRight'] || g_keys['KeyL']) camera.panRight(rotSpeed);

  if (g_keys['KeyI']) camera.applyPitch(rotSpeed);
  if (g_keys['KeyK']) camera.applyPitch(-rotSpeed);

  // Update physics (gravity, jumping)
  camera.updatePhysics(g_map, dt);

  checkRatProximity();
}

function tick() {
  var currentTime = performance.now() / 1000;
  if (g_lastFrameTimeSeconds === null) {
    g_deltaTime = 1 / 60;
  } else {
    g_deltaTime = Math.min(0.1, currentTime - g_lastFrameTimeSeconds);
  }
  g_lastFrameTimeSeconds = currentTime;

  processInput(g_deltaTime);
  renderScene(g_deltaTime, currentTime);
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
  Sphere.createGLBuffers(gl);

  g_bunny = new Model();
  g_bunny.loadOBJ(gl, 'bunny.obj');
  g_bunny.color = [0.8, 0.75, 0.7, 1.0];

  // The bunny OBJ is large (y ~0 to ~4) — scale down and position it
  g_bunny.matrix.setIdentity();
  g_bunny.matrix.translate(0.0, -0.5, 0.0);
  g_bunny.matrix.scale(0.15, 0.15, 0.15);

  g_floatingBunny = new Model();
  g_floatingBunny.loadOBJ(gl, 'bunny.obj');
  g_floatingBunny.color = [0.95, 0.85, 0.95, 1.0];
  g_floatingBunny.matrix.setIdentity();

  // Initialize map
  initMap();

  // Load textures
  initTextures();

  // Setup input
  setupKeyboard();
  setupMouse();

  // Wire up lighting control buttons
  document.getElementById('btn-normals').addEventListener('click', function() {
    g_showNormals = !g_showNormals;
    this.textContent = 'Show Normals: ' + (g_showNormals ? 'ON' : 'OFF');
  });
  document.getElementById('btn-lighting').addEventListener('click', function() {
    g_lightingOn = !g_lightingOn;
    this.textContent = 'Lighting: ' + (g_lightingOn ? 'ON' : 'OFF');
  });

  document.getElementById('btn-point-light').addEventListener('click', function() {
    g_lightOn = !g_lightOn;
    this.textContent = 'Point Light: ' + (g_lightOn ? 'ON' : 'OFF');
  });
  document.getElementById('btn-spotlight').addEventListener('click', function() {
    g_spotOn = !g_spotOn;
    this.textContent = 'Spotlight: ' + (g_spotOn ? 'ON' : 'OFF');
  });
  document.getElementById('btn-flood-light').addEventListener('click', function() {
    g_floodOn = !g_floodOn;
    this.textContent = 'Floodlight: ' + (g_floodOn ? 'ON' : 'OFF');
  });

  function updateLightColor() {
    var r = document.getElementById('slider-light-r').value / 255;
    var g_r = document.getElementById('slider-light-g').value / 255;
    var b = document.getElementById('slider-light-b').value / 255;
    g_lightColor = [r, g_r, b];
  }

  document.getElementById('slider-light-r').addEventListener('input', updateLightColor);
  document.getElementById('slider-light-g').addEventListener('input', updateLightColor);
  document.getElementById('slider-light-b').addEventListener('input', updateLightColor);

  var lightXSlider = document.getElementById('slider-light-x');
  var lightZSlider = document.getElementById('slider-light-z');
  var resetOrbitBtn = document.getElementById('btn-reset-orbit');

  function updateOrbitButtonLabel() {
    if (!resetOrbitBtn) return;
    var pointStatus = g_autoLightOrbit ? 'Point: Auto' : 'Point: Manual';
    resetOrbitBtn.textContent = 'Reset Light Orbit (' + pointStatus + ')';
  }

  function pauseLightOrbit() {
    if (!g_autoLightOrbit) return;
    g_autoLightOrbit = false;
    updateOrbitButtonLabel();
  }

  function syncLightSliders() {
    if (lightXSlider) lightXSlider.value = g_lightPos[0];
    if (lightZSlider) lightZSlider.value = g_lightPos[2];
  }

  lightXSlider.addEventListener('input', function() {
    pauseLightOrbit();
    g_lightPos[0] = parseFloat(this.value);
  });

  lightZSlider.addEventListener('input', function() {
    pauseLightOrbit();
    g_lightPos[2] = parseFloat(this.value);
  });

  resetOrbitBtn.addEventListener('click', function() {
    g_autoLightOrbit = true;
    g_lightAngle = 0;
    g_spotAngle = 315.0;
    updateSpotlightPosition();
    syncLightSliders();
    if (spotAngleSlider) spotAngleSlider.value = g_spotAngle;
    updateOrbitButtonLabel();
  });

  var spotAngleSlider = document.getElementById('slider-spot-angle');
  if (spotAngleSlider) {
    spotAngleSlider.value = g_spotAngle;
    spotAngleSlider.addEventListener('input', function() {
      g_spotAngle = parseFloat(this.value);
      updateSpotlightPosition();
    });
  }

  var spotCutoffSlider = document.getElementById('slider-spot-cutoff');
  if (spotCutoffSlider) {
    spotCutoffSlider.value = (Math.acos(g_spotCutoff) * 180 / Math.PI);
    spotCutoffSlider.addEventListener('input', function() {
      var deg = parseFloat(this.value);
      g_spotCutoff = Math.cos(deg * Math.PI / 180);
    });
  }

  var spotExpSlider = document.getElementById('slider-spot-exp');
  if (spotExpSlider) {
    spotExpSlider.value = g_spotExponent;
    spotExpSlider.addEventListener('input', function() {
      g_spotExponent = parseFloat(this.value);
    });
  }

  document.getElementById('slider-flood-intensity').addEventListener('input', function() {
    g_floodIntensity = parseFloat(this.value) / 100.0;
  });

  syncLightSliders();
  updateOrbitButtonLabel();
  updateSpotlightPosition();

  // Initialize FPS tracking
  g_lastFPSUpdate = performance.now() / 1000;

  // Start animation loop immediately — world is always active
  tick();

  console.log('World initialized successfully!');
  console.log('Controls: WASD to move, QE to rotate, Left-drag to look, Right-click to place block, Shift+Right-click to remove');
}
