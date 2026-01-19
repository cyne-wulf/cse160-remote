// Circle.js - Circle shape class for WebGL painting application

class Circle {
  constructor() {
    this.type = 'circle';
    this.position = [0.0, 0.0];  // Center position in WebGL coordinates
    this.color = [1.0, 1.0, 1.0, 1.0];  // RGBA
    this.size = 10.0;  // Size (determines circle radius)
    this.segments = 10;  // Number of segments (triangle fan sections)
  }

  render(gl, a_Position, u_FragColor, u_Size) {
    // Set the color
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);

    // Calculate circle radius (convert from size slider to WebGL units)
    var radius = this.size / 200.0;

    var cx = this.position[0];
    var cy = this.position[1];

    // Generate vertices for triangle fan
    // First vertex is the center, then segments+1 vertices around the edge
    // (segments+1 to close the circle by returning to the starting angle)
    var vertices = [];

    // Center vertex
    vertices.push(cx, cy);

    // Edge vertices
    var angleStep = (2 * Math.PI) / this.segments;
    for (var i = 0; i <= this.segments; i++) {
      var angle = i * angleStep;
      var x = cx + radius * Math.cos(angle);
      var y = cy + radius * Math.sin(angle);
      vertices.push(x, y);
    }

    // Create buffer
    var vertexBuffer = gl.createBuffer();
    if (!vertexBuffer) {
      console.log('Failed to create buffer object for circle');
      return;
    }

    // Bind and fill buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    // Assign to attribute
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    // Draw as triangle fan
    // Total vertices: 1 (center) + segments + 1 (closing vertex)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.segments + 2);

    // Clean up
    gl.deleteBuffer(vertexBuffer);
  }
}
