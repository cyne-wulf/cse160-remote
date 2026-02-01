// Camera.js - First-person camera with movement and rotation
// By Ashan Devine

class Camera {
  constructor() {
    this.eye = new Vector3([0, 0.5, 3]);
    this.at = new Vector3([0, 0.5, -100]);
    this.up = new Vector3([0, 1, 0]);
    this.fov = 60;
  }

  // Check if a position is valid (not inside a wall)
  canMoveTo(x, z, map) {
    var gridX = Math.floor(x) + 16;
    var gridZ = Math.floor(z) + 16;
    if (gridX < 0 || gridX >= 32 || gridZ < 0 || gridZ >= 32) return false;
    return map[gridX][gridZ] === 0;  // Can only move to empty cells
  }

  // Move forward along view direction (constrained to XZ plane)
  moveForward(speed, map) {
    var f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.elements[1] = 0;  // Zero out Y - no flying
    f.normalize();
    f.mul(speed);

    var newX = this.eye.elements[0] + f.elements[0];
    var newZ = this.eye.elements[2] + f.elements[2];

    if (!map || this.canMoveTo(newX, newZ, map)) {
      this.eye.add(f);
      this.at.add(f);
    }
  }

  // Move backward (opposite of forward, constrained to XZ plane)
  moveBackward(speed, map) {
    var f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.elements[1] = 0;  // Zero out Y - no flying
    f.normalize();
    f.mul(speed);

    var newX = this.eye.elements[0] - f.elements[0];
    var newZ = this.eye.elements[2] - f.elements[2];

    if (!map || this.canMoveTo(newX, newZ, map)) {
      this.eye.sub(f);
      this.at.sub(f);
    }
  }

  // Strafe left (perpendicular to view direction)
  moveLeft(speed, map) {
    var f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.elements[1] = 0;  // Zero out Y for XZ plane movement
    f.normalize();

    // Cross product: s = f × up (right vector, then negate for left)
    var s = Vector3.cross(f, this.up);
    s.normalize();
    s.mul(speed);

    var newX = this.eye.elements[0] - s.elements[0];
    var newZ = this.eye.elements[2] - s.elements[2];

    if (!map || this.canMoveTo(newX, newZ, map)) {
      this.eye.sub(s);
      this.at.sub(s);
    }
  }

  // Strafe right
  moveRight(speed, map) {
    var f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);
    f.elements[1] = 0;  // Zero out Y for XZ plane movement
    f.normalize();

    // Cross product: s = f × up (right vector)
    var s = Vector3.cross(f, this.up);
    s.normalize();
    s.mul(speed);

    var newX = this.eye.elements[0] + s.elements[0];
    var newZ = this.eye.elements[2] + s.elements[2];

    if (!map || this.canMoveTo(newX, newZ, map)) {
      this.eye.add(s);
      this.at.add(s);
    }
  }

  // Rotate camera left (pan) - rotate 'at' around 'up' axis
  panLeft(alpha) {
    var f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);

    var rotationMatrix = new Matrix4();
    rotationMatrix.setRotate(alpha, this.up.elements[0], this.up.elements[1], this.up.elements[2]);

    var f_prime = rotationMatrix.multiplyVector3(f);

    this.at.set(this.eye);
    this.at.add(f_prime);
  }

  // Rotate camera right (pan)
  panRight(alpha) {
    this.panLeft(-alpha);
  }

  // Tilt camera up/down (pitch) - rotate 'at' around right vector
  tilt(alpha) {
    var f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);

    // Get right vector
    var s = Vector3.cross(f, this.up);
    s.normalize();

    var rotationMatrix = new Matrix4();
    rotationMatrix.setRotate(alpha, s.elements[0], s.elements[1], s.elements[2]);

    var f_prime = rotationMatrix.multiplyVector3(f);

    this.at.set(this.eye);
    this.at.add(f_prime);
  }

  // Get view matrix using lookAt
  getViewMatrix() {
    var viewMatrix = new Matrix4();
    viewMatrix.setLookAt(
      this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
      this.at.elements[0], this.at.elements[1], this.at.elements[2],
      this.up.elements[0], this.up.elements[1], this.up.elements[2]
    );
    return viewMatrix;
  }

  // Get projection matrix with perspective
  getProjectionMatrix(canvas) {
    var projMatrix = new Matrix4();
    projMatrix.setPerspective(this.fov, canvas.width / canvas.height, 0.1, 1000);
    return projMatrix;
  }
}
