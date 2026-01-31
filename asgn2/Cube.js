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
