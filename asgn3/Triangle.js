// Triangle.js - Triangle shape class for WebGL painting application

class Triangle {
  constructor() {
    this.type = 'triangle';
    this.position = [0.0, 0.0];  // Center position in WebGL coordinates
    this.color = [1.0, 1.0, 1.0, 1.0];  // RGBA
    this.size = 10.0;  // Size (determines triangle dimensions)
    this.vertices = null;  // Custom vertices [x1, y1, x2, y2, x3, y3] - if set, overrides position/size
  }

  render(gl, a_Position, u_FragColor, u_Size) {
    // Set the color
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);

    var vertices;

    // Use custom vertices if provided, otherwise calculate from position/size
    if (this.vertices !== null) {
      vertices = new Float32Array(this.vertices);
    } else {
      // Calculate triangle size (convert from point size to WebGL units)
      // Size slider ranges 1-50, map to reasonable triangle size
      var d = this.size / 200.0;

      // Calculate the three vertices of an equilateral triangle centered at position
      var cx = this.position[0];
      var cy = this.position[1];

      // Vertices: top, bottom-left, bottom-right
      vertices = new Float32Array([
        cx, cy + d,              // Top vertex
        cx - d, cy - d,          // Bottom-left vertex
        cx + d, cy - d           // Bottom-right vertex
      ]);
    }

    // Create a buffer and put the vertices in it
    var vertexBuffer = gl.createBuffer();
    if (!vertexBuffer) {
      console.log('Failed to create buffer object for triangle');
      return;
    }

    // Bind the buffer and write data
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Assign buffer to a_Position and enable it
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    // Draw the triangle
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Clean up - delete the buffer
    gl.deleteBuffer(vertexBuffer);
  }
}

// Helper function to draw a triangle with specific vertices (used for the picture)
function drawTriangle(gl, a_Position, u_FragColor, vertices, color) {
  // Set the color
  gl.uniform4f(u_FragColor, color[0], color[1], color[2], color[3]);

  // Create buffer
  var vertexBuffer = gl.createBuffer();
  if (!vertexBuffer) {
    console.log('Failed to create buffer object');
    return;
  }

  // Bind and fill buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Assign to attribute
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  // Draw
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // Clean up
  gl.deleteBuffer(vertexBuffer);
}
