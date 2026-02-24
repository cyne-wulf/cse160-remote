// Model.js — OBJ loader (adapted from lab, raw WebGL pattern)
// Supports: v, vn, f (triangles only, v//vn format)

class Model {
  constructor() {
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
    this.isLoaded = false;
    this.vertexBuffer = null;
    this.normalBuffer = null;
    this.vertexCount = 0;
  }

  loadOBJ(gl, filePath) {
    var self = this;
    fetch(filePath)
      .then(function(r) {
        if (!r.ok) throw new Error('Could not load ' + filePath);
        return r.text();
      })
      .then(function(text) {
        self._parse(gl, text);
      })
      .catch(function(e) {
        console.error('Model load error:', e);
      });
  }

  _parse(gl, text) {
    var lines = text.split('\n');
    var allVerts   = [];
    var allNormals = [];
    var unpackedV  = [];
    var unpackedN  = [];

    for (var i = 0; i < lines.length; i++) {
      var tokens = lines[i].trim().split(/\s+/);
      if (tokens[0] === 'v') {
        allVerts.push(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
      } else if (tokens[0] === 'vn') {
        allNormals.push(parseFloat(tokens[1]), parseFloat(tokens[2]), parseFloat(tokens[3]));
      } else if (tokens[0] === 'f') {
        // Faces: triangles only, format v//vn
        for (var k = 1; k <= 3; k++) {
          var parts = tokens[k].split('//');
          var vi = (parseInt(parts[0]) - 1) * 3;
          var ni = (parseInt(parts[1]) - 1) * 3;
          unpackedV.push(allVerts[vi],   allVerts[vi+1],   allVerts[vi+2]);
          unpackedN.push(allNormals[ni], allNormals[ni+1], allNormals[ni+2]);
        }
      }
    }

    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(unpackedV), gl.STATIC_DRAW);

    this.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(unpackedN), gl.STATIC_DRAW);

    this.vertexCount = unpackedV.length / 3;
    this.isLoaded = true;
    console.log('Model loaded: ' + this.vertexCount + ' vertices');
  }

  render() {
    if (!this.isLoaded) return;

    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    var normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(this.matrix);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniform1i(u_whichTexture, -2);  // solid color

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Normal);

    // Disable UV (OBJ has no UVs) — bind a dummy or leave from last call
    gl.disableVertexAttribArray(a_UV);

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);

    // Re-enable UV for subsequent draw calls
    gl.enableVertexAttribArray(a_UV);
  }
}
