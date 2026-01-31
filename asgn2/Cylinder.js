// Cylinder.js - Cylinder class with pre-allocated static buffer
// By Ashan Devine

class Cylinder {
  constructor() {
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
  }

  // Static vertices for a unit cylinder (height 1.0 along Y-axis, radius 0.5)
  static vertices = null;
  static vertexBuffer = null;
  static vertexCount = 0;
  static segments = 12;

  static initVertices(segments = 12) {
    if (Cylinder.vertices !== null) return;

    Cylinder.segments = segments;
    var verts = [];
    var angleStep = (2 * Math.PI) / segments;

    // Generate vertices for cylinder
    for (var i = 0; i < segments; i++) {
      var angle1 = i * angleStep;
      var angle2 = (i + 1) * angleStep;

      var x1 = 0.5 * Math.cos(angle1);
      var z1 = 0.5 * Math.sin(angle1);
      var x2 = 0.5 * Math.cos(angle2);
      var z2 = 0.5 * Math.sin(angle2);

      // Side face - two triangles per segment
      // Triangle 1 (bottom-left, bottom-right, top-right)
      verts.push(x1, -0.5, z1);
      verts.push(x2, -0.5, z2);
      verts.push(x2, 0.5, z2);

      // Triangle 2 (bottom-left, top-right, top-left)
      verts.push(x1, -0.5, z1);
      verts.push(x2, 0.5, z2);
      verts.push(x1, 0.5, z1);

      // Top cap triangle (center to edge)
      verts.push(0, 0.5, 0);
      verts.push(x1, 0.5, z1);
      verts.push(x2, 0.5, z2);

      // Bottom cap triangle (center to edge)
      verts.push(0, -0.5, 0);
      verts.push(x2, -0.5, z2);
      verts.push(x1, -0.5, z1);
    }

    Cylinder.vertices = new Float32Array(verts);
    Cylinder.vertexCount = verts.length / 3;
  }

  static createGLBuffers(gl, segments = 12) {
    Cylinder.initVertices(segments);

    if (Cylinder.vertexBuffer !== null) return;

    Cylinder.vertexBuffer = gl.createBuffer();
    if (!Cylinder.vertexBuffer) {
      console.log('Failed to create cylinder vertex buffer');
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, Cylinder.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Cylinder.vertices, gl.STATIC_DRAW);
  }

  render(gl, a_Position, u_ModelMatrix, u_FragColor) {
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    gl.bindBuffer(gl.ARRAY_BUFFER, Cylinder.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.drawArrays(gl.TRIANGLES, 0, Cylinder.vertexCount);
  }
}

// Helper function to draw a cylinder with a given matrix and color
function drawCylinder(gl, a_Position, u_ModelMatrix, u_FragColor, matrix, color) {
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);

  gl.bindBuffer(gl.ARRAY_BUFFER, Cylinder.vertexBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.drawArrays(gl.TRIANGLES, 0, Cylinder.vertexCount);
}
