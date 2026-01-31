// Cube.js - Optimized Cube class with pre-allocated static buffer
// By Ashan Devine

class Cube {
  constructor() {
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
  }

  // Static vertices for a unit cube centered at origin (-0.5 to 0.5)
  // 6 faces × 2 triangles × 3 vertices = 36 vertices
  static vertices = null;
  static vertexBuffer = null;

  static initVertices() {
    if (Cube.vertices !== null) return;

    Cube.vertices = new Float32Array([
      // Front face (z = 0.5)
      -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,
      -0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
      // Back face (z = -0.5)
      -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,
      -0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5, -0.5, -0.5,
      // Top face (y = 0.5)
      -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,
      -0.5,  0.5, -0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
      // Bottom face (y = -0.5)
      -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,
      -0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
      // Right face (x = 0.5)
       0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,
       0.5, -0.5, -0.5,   0.5,  0.5,  0.5,   0.5, -0.5,  0.5,
      // Left face (x = -0.5)
      -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,
      -0.5, -0.5, -0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5,
    ]);
  }

  static createGLBuffers(gl) {
    Cube.initVertices();

    if (Cube.vertexBuffer !== null) return;

    Cube.vertexBuffer = gl.createBuffer();
    if (!Cube.vertexBuffer) {
      console.log('Failed to create cube vertex buffer');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Cube.vertices, gl.STATIC_DRAW);
  }

  render(gl, a_Position, u_ModelMatrix, u_FragColor) {
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    gl.bindBuffer(gl.ARRAY_BUFFER, Cube.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
}

// Helper function to draw a cube with a given matrix and color
function drawCube(gl, a_Position, u_ModelMatrix, u_FragColor, matrix, color) {
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);

  gl.bindBuffer(gl.ARRAY_BUFFER, Cube.vertexBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.drawArrays(gl.TRIANGLES, 0, 36);
}

// ============================================================================
// Fake Lighting Support
// ============================================================================

// Light direction (normalized) - upper right front
const LIGHT_DIR = [0.5, 0.7, 0.4];

// Face normals for unit cube (matches vertex order in Cube.vertices)
const CUBE_FACE_NORMALS = [
  [0, 0, 1],   // Front  (vertices 0-5)
  [0, 0, -1],  // Back   (vertices 6-11)
  [0, 1, 0],   // Top    (vertices 12-17)
  [0, -1, 0],  // Bottom (vertices 18-23)
  [1, 0, 0],   // Right  (vertices 24-29)
  [-1, 0, 0]   // Left   (vertices 30-35)
];

// Draw cube with per-face lighting based on face normal dot light direction
function drawCubeWithLighting(gl, a_Position, u_ModelMatrix, u_FragColor, matrix, color) {
  gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);
  gl.bindBuffer(gl.ARRAY_BUFFER, Cube.vertexBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  for (var i = 0; i < 6; i++) {
    // Calculate brightness from dot product of face normal and light direction
    var normal = CUBE_FACE_NORMALS[i];
    var dot = normal[0]*LIGHT_DIR[0] + normal[1]*LIGHT_DIR[1] + normal[2]*LIGHT_DIR[2];
    var brightness = 0.4 + 0.6 * Math.max(0, dot);  // Ambient 0.4, diffuse 0.6

    // Apply brightness to color
    gl.uniform4f(u_FragColor,
      color[0] * brightness,
      color[1] * brightness,
      color[2] * brightness,
      color[3]);

    // Draw 6 vertices for this face
    gl.drawArrays(gl.TRIANGLES, i * 6, 6);
  }
}
