// Point.js - Point shape class for WebGL painting application

class Point {
  constructor() {
    this.type = 'point';
    this.position = [0.0, 0.0];  // x, y in WebGL coordinates
    this.color = [1.0, 1.0, 1.0, 1.0];  // RGBA
    this.size = 10.0;  // Point size
  }

  render(gl, a_Position, u_FragColor, u_Size) {
    // Set the color
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);

    // Set the size
    gl.uniform1f(u_Size, this.size);

    // Disable vertex attrib array so we can use constant vertex attribute
    gl.disableVertexAttribArray(a_Position);

    // Set the vertex position
    gl.vertexAttrib3f(a_Position, this.position[0], this.position[1], 0.0);

    // Draw the point
    gl.drawArrays(gl.POINTS, 0, 1);
  }
}
