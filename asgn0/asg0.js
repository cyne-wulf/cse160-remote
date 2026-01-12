// asg0.js

var canvas = null;
var ctx = null;

function main() {
  canvas = document.getElementById("example");
  if (!canvas) {
    console.log("Failed to retrieve the <canvas> element");
    return;
  }

  ctx = canvas.getContext("2d");
  if (!ctx) {
    console.log("Failed to get 2D context");
    return;
  }

  // Initial draw based on current input values
  handleDrawEvent();
}

function clearCanvas() {
  // Clear and then paint black so screenshots always show a black canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function readNumber(id) {
  var raw = document.getElementById(id).value;
  var n = parseFloat(raw);
  if (Number.isNaN(n)) {
    return 0;
  }
  return n;
}

function readV1() {
  var x = readNumber("v1x");
  var y = readNumber("v1y");
  return new Vector3([x, y, 0]);
}

function readV2() {
  var x = readNumber("v2x");
  var y = readNumber("v2y");
  return new Vector3([x, y, 0]);
}

function cloneV3(v) {
  return new Vector3([v.elements[0], v.elements[1], v.elements[2]]);
}

// Draw vector from canvas center, scaling components by 20
// Uses lineTo() per assignment requirement.
function drawVector(v, color) {
  var cx = canvas.width / 2;
  var cy = canvas.height / 2;
  var scale = 20;

  var x2 = cx + v.elements[0] * scale;
  var y2 = cy - v.elements[1] * scale; // invert y for math-style axes

  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  ctx.moveTo(cx, cy);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function handleDrawEvent() {
  clearCanvas();

  var v1 = readV1();
  var v2 = readV2();

  drawVector(v1, "red");
  drawVector(v2, "blue");
}

function handleDrawOperationEvent() {
  clearCanvas();

  var v1 = readV1();
  var v2 = readV2();

  // Always draw originals first
  drawVector(v1, "red");
  drawVector(v2, "blue");

  var op = document.getElementById("op").value;
  var s = readNumber("scalar");

  if (op === "add") {
    var v3 = cloneV3(v1);
    v3.add(v2);
    drawVector(v3, "green");
    return;
  }

  if (op === "sub") {
    var v3s = cloneV3(v1);
    v3s.sub(v2);
    drawVector(v3s, "green");
    return;
  }

  if (op === "mul") {
    var v3m = cloneV3(v1);
    var v4m = cloneV3(v2);
    v3m.mul(s);
    v4m.mul(s);
    drawVector(v3m, "green");
    drawVector(v4m, "green");
    return;
  }

  if (op === "div") {
    var v3d = cloneV3(v1);
    var v4d = cloneV3(v2);
    v3d.div(s);
    v4d.div(s);
    drawVector(v3d, "green");
    drawVector(v4d, "green");
    return;
  }

  if (op === "mag") {
    console.log("||v1|| =", v1.magnitude());
    console.log("||v2|| =", v2.magnitude());
    return;
  }

  if (op === "norm") {
    var n1 = cloneV3(v1);
    var n2 = cloneV3(v2);
    n1.normalize();
    n2.normalize();
    drawVector(n1, "green");
    drawVector(n2, "green");
    return;
  }

  if (op === "angle") {
    var deg = angleBetween(v1, v2);
    console.log("angle(v1, v2) degrees =", deg);
    return;
  }

  if (op === "area") {
    var area = areaTriangle(v1, v2);
    console.log("area triangle(v1, v2) =", area);
    return;
  }
}

function angleBetween(v1, v2) {
  var m1 = v1.magnitude();
  var m2 = v2.magnitude();

  if (m1 === 0 || m2 === 0) {
    return NaN;
  }

  var dot = Vector3.dot(v1, v2);
  var cosA = dot / (m1 * m2);

  // Clamp to avoid NaN from floating point drift
  if (cosA > 1) cosA = 1;
  if (cosA < -1) cosA = -1;

  var rad = Math.acos(cosA);
  return rad * (180 / Math.PI);
}

function areaTriangle(v1, v2) {
  var c = Vector3.cross(v1, v2);
  // ||v1 x v2|| is parallelogram area; triangle is half
  return c.magnitude() / 2;
}
