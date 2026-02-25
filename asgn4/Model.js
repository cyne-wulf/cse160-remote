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
    this.gl = null;
  }

  loadOBJ(gl, filePath) {
    this.gl = gl;
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
        self._loadFallback(gl);
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

    this._uploadBuffers(gl, new Float32Array(unpackedV), new Float32Array(unpackedN));
  }

  _uploadBuffers(gl, positions, normals) {
    if (!positions || positions.length === 0) {
      console.warn('Model upload skipped: no vertex data');
      return;
    }
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    this.normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

    this.vertexCount = positions.length / 3;
    this.isLoaded = true;
    console.log('Model loaded: ' + this.vertexCount + ' vertices');
  }

  _loadFallback(gl) {
    if (typeof BUNNY_FALLBACK_POSITIONS !== 'undefined' && typeof BUNNY_FALLBACK_NORMALS !== 'undefined') {
      this._uploadBuffers(gl, BUNNY_FALLBACK_POSITIONS, BUNNY_FALLBACK_NORMALS);
      console.log('Loaded bunny from embedded fallback data.');
      return;
    }

    var fileInput = document.getElementById('bunny-file-input');
    var hint = document.getElementById('bunny-upload-hint');
    if (!fileInput || !hint) {
      console.warn('No fallback bunny input available.');
      return;
    }
    hint.style.display = 'block';
    fileInput.style.display = 'block';

    var self = this;
    function handleUpload() {
      if (!fileInput.files || fileInput.files.length === 0) return;
      var file = fileInput.files[0];
      var reader = new FileReader();
      reader.onload = function(evt) {
        hint.textContent = 'Custom bunny OBJ loaded.';
        self._parse(gl, evt.target.result);
      };
      reader.onerror = function() {
        hint.textContent = 'Failed to read OBJ file.';
      };
      reader.readAsText(file);
      fileInput.removeEventListener('change', handleUpload);
    }

    fileInput.addEventListener('change', handleUpload);
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
