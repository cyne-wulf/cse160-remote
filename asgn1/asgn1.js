// asg1.js - Main application file for WebGL painting application
// By Ashan Devine

// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
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

// Global variables
var gl;
var canvas;
var a_Position;
var u_FragColor;
var u_Size;

// Shape list and state
var g_shapesList = [];
var g_undoStack = [];  // For redo functionality

// Currently selected options
var g_selectedColor = [1.0, 0.0, 0.0, 1.0];
var g_selectedSize = 10;
var g_selectedType = 'point';
var g_selectedSegments = 10;
var g_selectedSparseness = 1.0;  // 1.0 = normal, higher = fewer shapes

// For gap filling - track previous mouse position
var g_prevMousePos = null;

// ============================================================================
// Setup Functions
// ============================================================================

function setupWebGL() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');
  if (!canvas) {
    console.log('Failed to retrieve the <canvas> element');
    return false;
  }

  // Get the rendering context for WebGL using cuon-utils.js (textbook pattern)
  // Note: preserveDrawingBuffer is not needed because we store shapes in g_shapesList
  // and redraw everything in renderAllShapes() - same pattern as ColoredPoints.js
  gl = getWebGLContext(canvas);
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return false;
  }

  return true;
}

function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to initialize shaders.');
    return false;
  }

  // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return false;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return false;
  }

  // Get the storage location of u_Size
  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  if (!u_Size) {
    console.log('Failed to get the storage location of u_Size');
    return false;
  }

  return true;
}

function setupUI() {
  // Setup slider event handlers
  document.getElementById('slider-red').oninput = function() {
    g_selectedColor[0] = parseFloat(this.value);
    document.getElementById('val-red').textContent = this.value;
    updateColorPreview();
  };

  document.getElementById('slider-green').oninput = function() {
    g_selectedColor[1] = parseFloat(this.value);
    document.getElementById('val-green').textContent = this.value;
    updateColorPreview();
  };

  document.getElementById('slider-blue').oninput = function() {
    g_selectedColor[2] = parseFloat(this.value);
    document.getElementById('val-blue').textContent = this.value;
    updateColorPreview();
  };

  document.getElementById('slider-size').oninput = function() {
    g_selectedSize = parseFloat(this.value);
    document.getElementById('val-size').textContent = this.value;
  };

  document.getElementById('slider-segments').oninput = function() {
    g_selectedSegments = parseInt(this.value);
    document.getElementById('val-segments').textContent = this.value;
  };

  document.getElementById('slider-sparseness').oninput = function() {
    g_selectedSparseness = parseFloat(this.value);
    document.getElementById('val-sparseness').textContent = this.value;
  };

  // Setup canvas mouse events
  canvas.onmousedown = function(ev) {
    handleClicks(ev);
    g_prevMousePos = getWebGLCoords(ev);
  };

  canvas.onmousemove = function(ev) {
    if (ev.buttons === 1) {  // Left mouse button is held
      handleMouseMove(ev);
    }
  };

  canvas.onmouseup = function(ev) {
    g_prevMousePos = null;
  };

  canvas.onmouseleave = function(ev) {
    g_prevMousePos = null;
  };
}

function updateColorPreview() {
  var r = Math.round(g_selectedColor[0] * 255);
  var g = Math.round(g_selectedColor[1] * 255);
  var b = Math.round(g_selectedColor[2] * 255);
  document.getElementById('color-preview').style.backgroundColor =
    `rgb(${r}, ${g}, ${b})`;
}

// ============================================================================
// Event Handlers
// ============================================================================

function getWebGLCoords(ev) {
  var rect = ev.target.getBoundingClientRect();
  var x = ((ev.clientX - rect.left) - canvas.width/2) / (canvas.width/2);
  var y = (canvas.height/2 - (ev.clientY - rect.top)) / (canvas.height/2);
  return [x, y];
}

function handleClicks(ev) {
  var coords = getWebGLCoords(ev);
  addShapeAtPosition(coords[0], coords[1]);

  // Clear redo stack when new shape is added
  g_undoStack = [];

  renderAllShapes();
}

function handleMouseMove(ev) {
  var coords = getWebGLCoords(ev);

  // Gap filling - if we have a previous position, interpolate
  if (g_prevMousePos !== null) {
    var dx = coords[0] - g_prevMousePos[0];
    var dy = coords[1] - g_prevMousePos[1];
    var distance = Math.sqrt(dx * dx + dy * dy);

    // Threshold for gap filling (smaller = more points)
    var threshold = (g_selectedSize / 400.0) * g_selectedSparseness;

    if (distance > threshold) {
      // Calculate number of intermediate points needed
      var numPoints = Math.floor(distance / threshold);

      for (var i = 1; i <= numPoints; i++) {
        var t = i / (numPoints + 1);
        var interpX = g_prevMousePos[0] + dx * t;
        var interpY = g_prevMousePos[1] + dy * t;
        addShapeAtPosition(interpX, interpY);
      }
    }
  }

  // Add shape at current position
  addShapeAtPosition(coords[0], coords[1]);

  // Update previous position
  g_prevMousePos = coords;

  // Clear redo stack when new shape is added
  g_undoStack = [];

  renderAllShapes();
}

function addShapeAtPosition(x, y) {
  var shape;

  if (g_selectedType === 'point') {
    shape = new Point();
  } else if (g_selectedType === 'triangle') {
    shape = new Triangle();
  } else if (g_selectedType === 'circle') {
    shape = new Circle();
    shape.segments = g_selectedSegments;
  }

  shape.position = [x, y];
  shape.color = g_selectedColor.slice();  // Copy the color array
  shape.size = g_selectedSize;

  g_shapesList.push(shape);
}

// ============================================================================
// Shape Type Selection
// ============================================================================

function setShapeType(type) {
  g_selectedType = type;

  // Update button styles
  document.getElementById('btn-point').classList.remove('active');
  document.getElementById('btn-triangle').classList.remove('active');
  document.getElementById('btn-circle').classList.remove('active');
  document.getElementById('btn-' + type).classList.add('active');
}

// ============================================================================
// Rendering
// ============================================================================

function renderAllShapes() {
  // Clear canvas
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Draw all shapes
  for (var i = 0; i < g_shapesList.length; i++) {
    g_shapesList[i].render(gl, a_Position, u_FragColor, u_Size);
  }
}

// ============================================================================
// Canvas Actions
// ============================================================================

function clearCanvas() {
  g_shapesList = [];
  g_undoStack = [];
  renderAllShapes();
}

function undo() {
  if (g_shapesList.length > 0) {
    var shape = g_shapesList.pop();
    g_undoStack.push(shape);
    renderAllShapes();
  }
}

function redo() {
  if (g_undoStack.length > 0) {
    var shape = g_undoStack.pop();
    g_shapesList.push(shape);
    renderAllShapes();
  }
}

// ============================================================================
// Draw Picture - Simple Landscape with "AD" initials
// Uses grid-friendly coordinates (0.1 increments) for easy graph paper sketching
// ============================================================================

function drawPicture() {
  // Define triangles as [x1, y1, x2, y2, x3, y3] and color as [r, g, b, a]
  // All coordinates use 0.1 increments for easy graph paper reference
  var triangles = [];

  // ========== Sky background (2 triangles to form a rectangle) ==========
  triangles.push({
    vertices: [-1.0, 1.0, -1.0, -0.2, 1.0, 1.0],
    color: [0.5, 0.8, 1.0, 1.0]  // Light blue sky
  });
  triangles.push({
    vertices: [-1.0, -0.2, 1.0, -0.2, 1.0, 1.0],
    color: [0.5, 0.8, 1.0, 1.0]  // Light blue sky
  });

  // ========== Sun (1 triangle) ==========
  triangles.push({
    vertices: [0.7, 0.8, 0.6, 0.6, 0.8, 0.6],
    color: [1.0, 1.0, 0.0, 1.0]  // Yellow
  });

  // ========== Mountains (5 triangles) ==========
  // Far left mountain
  triangles.push({
    vertices: [-1.0, -0.2, -0.6, 0.4, -0.2, -0.2],
    color: [0.5, 0.5, 0.6, 1.0]  // Gray
  });
  // Center-left mountain
  triangles.push({
    vertices: [-0.6, -0.2, -0.3, 0.6, 0.0, -0.2],
    color: [0.6, 0.5, 0.4, 1.0]  // Brown-gray
  });
  // Center mountain (tallest)
  triangles.push({
    vertices: [-0.2, -0.2, 0.2, 0.7, 0.6, -0.2],
    color: [0.5, 0.4, 0.4, 1.0]  // Dark brown
  });
  // Center-right mountain
  triangles.push({
    vertices: [0.3, -0.2, 0.6, 0.5, 0.9, -0.2],
    color: [0.6, 0.6, 0.5, 1.0]  // Tan
  });
  // Far right mountain
  triangles.push({
    vertices: [0.6, -0.2, 0.9, 0.3, 1.0, -0.2],
    color: [0.5, 0.5, 0.5, 1.0]  // Gray
  });

  // ========== Ground/Grass (3 triangles) ==========
  triangles.push({
    vertices: [-1.0, -1.0, -1.0, -0.2, 0.0, -1.0],
    color: [0.2, 0.6, 0.2, 1.0]  // Green
  });
  triangles.push({
    vertices: [-1.0, -0.2, 0.0, -1.0, 1.0, -0.2],
    color: [0.3, 0.7, 0.3, 1.0]  // Light green
  });
  triangles.push({
    vertices: [0.0, -1.0, 1.0, -0.2, 1.0, -1.0],
    color: [0.2, 0.6, 0.2, 1.0]  // Green
  });

  // ========== House (4 triangles) ==========
  // House front wall (left half)
  triangles.push({
    vertices: [-0.8, -0.3, -0.8, -0.7, -0.5, -0.7],
    color: [0.8, 0.6, 0.4, 1.0]  // Tan/beige
  });
  // House front wall (right half)
  triangles.push({
    vertices: [-0.8, -0.3, -0.5, -0.7, -0.5, -0.3],
    color: [0.9, 0.7, 0.5, 1.0]  // Light tan
  });
  // House roof
  triangles.push({
    vertices: [-0.9, -0.3, -0.65, 0.0, -0.4, -0.3],
    color: [0.6, 0.2, 0.2, 1.0]  // Red roof
  });
  // House door
  triangles.push({
    vertices: [-0.7, -0.5, -0.6, -0.5, -0.65, -0.7],
    color: [0.4, 0.2, 0.1, 1.0]  // Brown door
  });

  // ========== Tree (3 triangles) ==========
  // Tree trunk
  triangles.push({
    vertices: [0.7, -0.5, 0.6, -0.8, 0.8, -0.8],
    color: [0.4, 0.3, 0.2, 1.0]  // Brown
  });
  // Tree crown bottom
  triangles.push({
    vertices: [0.7, -0.2, 0.5, -0.5, 0.9, -0.5],
    color: [0.1, 0.5, 0.1, 1.0]  // Dark green
  });
  // Tree crown top
  triangles.push({
    vertices: [0.7, 0.1, 0.55, -0.2, 0.85, -0.2],
    color: [0.2, 0.6, 0.2, 1.0]  // Green
  });

  // ========== Letter "A" - blocky style (3 triangles) ==========
  // A - left diagonal
  triangles.push({
    vertices: [-0.3, 0.9, -0.4, 0.5, -0.2, 0.5],
    color: [0.0, 0.8, 0.8, 1.0]  // Cyan
  });
  // A - right diagonal
  triangles.push({
    vertices: [-0.1, 0.9, -0.2, 0.5, 0.0, 0.5],
    color: [0.0, 0.7, 0.7, 1.0]  // Cyan
  });
  // A - crossbar
  triangles.push({
    vertices: [-0.35, 0.65, -0.05, 0.65, -0.2, 0.55],
    color: [0.0, 0.9, 0.9, 1.0]  // Light cyan
  });

  // ========== Letter "D" - blocky style (4 triangles) ==========
  // D - vertical bar left half
  triangles.push({
    vertices: [0.1, 0.9, 0.1, 0.5, 0.2, 0.5],
    color: [0.2, 0.8, 0.3, 1.0]  // Green
  });
  // D - vertical bar right half
  triangles.push({
    vertices: [0.1, 0.9, 0.2, 0.5, 0.2, 0.9],
    color: [0.3, 0.9, 0.4, 1.0]  // Light green
  });
  // D - curve top part
  triangles.push({
    vertices: [0.2, 0.9, 0.2, 0.7, 0.4, 0.7],
    color: [0.2, 0.7, 0.3, 1.0]  // Green
  });
  // D - curve bottom part
  triangles.push({
    vertices: [0.2, 0.7, 0.4, 0.7, 0.2, 0.5],
    color: [0.3, 0.8, 0.4, 1.0]  // Light green
  });

  // Add all triangles to g_shapesList so they persist
  for (var i = 0; i < triangles.length; i++) {
    var t = new Triangle();
    t.vertices = triangles[i].vertices;
    t.color = triangles[i].color;
    g_shapesList.push(t);
  }

  // Redraw all shapes including the new triangles
  renderAllShapes();

  console.log('Drew picture with ' + triangles.length + ' triangles');
}

// ============================================================================
// Main
// ============================================================================

function main() {
  // Setup WebGL
  if (!setupWebGL()) {
    return;
  }

  // Setup GLSL variables
  if (!connectVariablesToGLSL()) {
    return;
  }

  // Setup UI
  setupUI();

  // Initial render (clear canvas)
  renderAllShapes();

  console.log('Painting application initialized successfully!');
}

// Application is started via <body onload="main()"> in index.html (textbook pattern)
