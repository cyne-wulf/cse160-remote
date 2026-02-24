// Sphere.js — Programmatic UV sphere with normals
// For a unit sphere centered at origin: normal == position (normalized)

class Sphere {
  constructor() {
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
    this.textureNum = -2;
  }

  static vertices    = null;
  static normals     = null;
  static uvCoords    = null;
  static vertexBuffer  = null;
  static normalBuffer  = null;
  static uvBuffer      = null;
  static vertexCount   = 0;

  static initGeometry(slices, stacks) {
    if (Sphere.vertices !== null) return;

    var verts = [], norms = [], uvs = [];

    for (var i = 0; i < stacks; i++) {
      var phi1 = (i / stacks) * Math.PI - Math.PI / 2;
      var phi2 = ((i + 1) / stacks) * Math.PI - Math.PI / 2;

      for (var j = 0; j < slices; j++) {
        var theta1 = (j / slices) * 2 * Math.PI;
        var theta2 = ((j + 1) / slices) * 2 * Math.PI;

        // Four corners of the lat/lon quad
        var v1 = [Math.cos(phi1)*Math.cos(theta1), Math.sin(phi1), Math.cos(phi1)*Math.sin(theta1)];
        var v2 = [Math.cos(phi2)*Math.cos(theta1), Math.sin(phi2), Math.cos(phi2)*Math.sin(theta1)];
        var v3 = [Math.cos(phi2)*Math.cos(theta2), Math.sin(phi2), Math.cos(phi2)*Math.sin(theta2)];
        var v4 = [Math.cos(phi1)*Math.cos(theta2), Math.sin(phi1), Math.cos(phi1)*Math.sin(theta2)];

        // Triangle 1: v1, v2, v3
        verts.push(v1[0],v1[1],v1[2], v2[0],v2[1],v2[2], v3[0],v3[1],v3[2]);
        norms.push(v1[0],v1[1],v1[2], v2[0],v2[1],v2[2], v3[0],v3[1],v3[2]);
        uvs.push(j/slices, i/stacks,  j/slices, (i+1)/stacks,  (j+1)/slices, (i+1)/stacks);

        // Triangle 2: v1, v3, v4
        verts.push(v1[0],v1[1],v1[2], v3[0],v3[1],v3[2], v4[0],v4[1],v4[2]);
        norms.push(v1[0],v1[1],v1[2], v3[0],v3[1],v3[2], v4[0],v4[1],v4[2]);
        uvs.push(j/slices, i/stacks,  (j+1)/slices, (i+1)/stacks,  (j+1)/slices, i/stacks);
      }
    }

    Sphere.vertices    = new Float32Array(verts);
    Sphere.normals     = new Float32Array(norms);
    Sphere.uvCoords    = new Float32Array(uvs);
    Sphere.vertexCount = verts.length / 3;
  }

  static createGLBuffers(gl) {
    Sphere.initGeometry(24, 12);

    Sphere.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Sphere.vertices, gl.STATIC_DRAW);

    Sphere.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Sphere.normals, gl.STATIC_DRAW);

    Sphere.uvBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Sphere.uvCoords, gl.STATIC_DRAW);
  }
}

// Draw a sphere at given matrix/color/texture, with normals for lighting
function drawSphere(matrix, color, textureNum) {
  gl.uniform1i(u_whichTexture, textureNum);
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);
  gl.uniformMatrix4fv(u_ModelMatrix, false, matrix.elements);

  var normalMatrix = new Matrix4();
  normalMatrix.setInverseOf(matrix);
  normalMatrix.transpose();
  gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

  gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.vertexBuffer);
  gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.uvBuffer);
  gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_UV);

  gl.bindBuffer(gl.ARRAY_BUFFER, Sphere.normalBuffer);
  gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Normal);

  gl.drawArrays(gl.TRIANGLES, 0, Sphere.vertexCount);
}
