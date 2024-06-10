import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls";
import { CSS2DRenderer, CSS2DObject } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/renderers/CSS2DRenderer.js';

const canvasContainer = document.querySelector("#globe-container")
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(50, canvasContainer.offsetWidth / canvasContainer.offsetHeight, 1, 2000);
camera.position.set(0.5, -0.2, 1).setLength(14);
let renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  canvas: document.querySelector("canvas")
});
renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
renderer.setClearColor(0xfffffff);

let labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
document.getElementById('globe-container').appendChild(labelRenderer.domElement);


window.addEventListener("resize", onWindowResize);

let controls = new OrbitControls(camera, labelRenderer.domElement);
controls.enablePan = false;
controls.enableZoom = false;
controls.minDistance = 6;
controls.maxDistance = 15;
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed *= 0.05;

let globalUniforms = {
  time: { value: 0 }
};

// Cargar la textura del planeta Tierra
let textureLoader = new THREE.TextureLoader();
let earthTexture = textureLoader.load('img/testmap.jpg'); // Reemplaza con la ruta a tu textura

let rad = 5;
let geometry = new THREE.SphereGeometry(rad, 32, 32);
let material = new THREE.MeshBasicMaterial({ map: earthTexture });
let globe = new THREE.Mesh(geometry, material);
scene.add(globe);

// <Label>
let labelDiv = document.getElementById("markerLabel");
let closeBtn = document.getElementById("closeButton");
closeBtn.addEventListener("pointerdown", event => {
  labelDiv.classList.add("hidden");
})
let label = new CSS2DObject(labelDiv);
label.userData = {
  cNormal: new THREE.Vector3(),
  cPosition: new THREE.Vector3(),
  mat4: new THREE.Matrix4(),
  trackVisibility: () => { // the closer to the edge, the less opacity
    let ud = label.userData;
    ud.cNormal.copy(label.position).normalize().applyMatrix3(globe.normalMatrix);
    ud.cPosition.copy(label.position).applyMatrix4(ud.mat4.multiplyMatrices(camera.matrixWorldInverse, globe.matrixWorld));
    let d = ud.cPosition.negate().normalize().dot(ud.cNormal);
    d = smoothstep(0.2, 0.7, d);
    label.element.style.opacity = d;
    
    // https://github.com/gre/smoothstep/blob/master/index.js
    function smoothstep (min, max, value) {
      var x = Math.max(0, Math.min(1, (value-min)/(max-min)));
      return x*x*(3 - 2*x);
    };
  }
}
scene.add(label);
// </Label>
// <Markers>
const markerCount = 4;
let markerInfo = []; // information on markers
let gMarker = new THREE.PlaneGeometry();
let mMarker = new THREE.MeshBasicMaterial({
  color: 0xff7c1b,
  onBeforeCompile: (shader) => {
    shader.uniforms.time = globalUniforms.time;
    shader.vertexShader = `
      attribute float phase;
      varying float vPhase;
      ${shader.vertexShader}
    `.replace(
      `#include <begin_vertex>`,
      `#include <begin_vertex>
        vPhase = phase; // de-synch of ripples
      `
    );
    //console.log(shader.vertexShader);
    shader.fragmentShader = `
      uniform float time;
      varying float vPhase;
      ${shader.fragmentShader}
    `.replace(
      `vec4 diffuseColor = vec4( diffuse, opacity );`,
      `
      vec2 lUv = (vUv - 0.5) * 2.;
      float val = 0.;
      float lenUv = length(lUv);
      val = max(val, 1. - step(0.15, lenUv)); // central circle
      val = max(val, step(0.5, lenUv) - step(0.5, lenUv)); // outer circle
      
      float tShift = fract(time * 0.5 + vPhase);
      val = max(val, step(0.4 + (tShift * 0.6), lenUv) - step(0.5 + (tShift * 0.5), lenUv)); // ripple
      
      if (val < 0.5) discard;
      
      vec4 diffuseColor = vec4( diffuse, opacity );`
    );
    //console.log(shader.fragmentShader)
  }
});
mMarker.defines = { USE_UV: " " }; // needed to be set to be able to work with UVs
let markers = new THREE.InstancedMesh(gMarker, mMarker, markerCount);

let dummy = new THREE.Object3D();
let phase = [];
for (let i = 0; i < markerCount; i++) {
  phase.push(Math.random());
}
gMarker.setAttribute(
  "phase",
  new THREE.InstancedBufferAttribute(new Float32Array(phase), 1)
);

scene.add(markers);

// Función para agregar marcadores en coordenadas específicas
function addMarker(x, y, z, id, mag, country) {
  let index = markerInfo.length;
  
  // Normalizar el vector de posición
  let length = Math.sqrt(x * x + y * y + z * z);
  let normalizedX = (x / length) * rad;
  let normalizedY = (y / length) * rad;
  let normalizedZ = (z / length) * rad;
  
  dummy.position.set(normalizedX, normalizedY, normalizedZ);
  dummy.lookAt(dummy.position.clone().setLength(rad + 1));
  dummy.updateMatrix();
  markers.setMatrixAt(index, dummy.matrix);

  markerInfo.push({
    id: id,
    mag: mag,
    crd: dummy.position.clone(),
    country: country // Añadir información del país
  });

  // Añadir identificador único al marcador
  markers.userData[index] = { id: id };
}

// Ejemplo de cómo agregar marcadores
addMarker(2, -0.60, 4.95, 'Venezuela', '+00 123 4567 891'); // En una posición arbitraria
addMarker(-1, 2.8, 4.95, 'Estados Unidos', '+00 123 4567 891');
addMarker(-0.90, 1, 4.95, 'México', '+00 123 4567 891');
addMarker(20.5, 12, 4.95, 'España', '+00 123 4567 891');

// </Markers>
// <Interaction>
let pointer = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let intersections;
let divID = document.getElementById("idNum");
let divMag = document.getElementById("magnitude");
let divCrd = document.getElementById("coordinates");
window.addEventListener("pointerdown", event => {

  // Obtener las dimensiones y la posición del contenedor
  const rect = canvasContainer.getBoundingClientRect();

  // Calcular la posición del clic en coordenadas normalizadas del dispositivo
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Actualizar el raycaster con la cámara y la posición del puntero
  raycaster.setFromCamera(pointer, camera);

  // Calcular intersecciones
  intersections = raycaster.intersectObject(markers);

  if (intersections.length > 0) {
    // Obtener el índice del marcador intersectado
    let index = intersections[0].instanceId;

    // Mostrar mensaje basado en el identificador del marcador
    let markerId = markers.userData[index].id;
    let marker = markerInfo.find(marker => marker.id === markerId);

    // Mostrar el popup
    divID.innerHTML = `<b>${marker.id}</b>`;
    divMag.innerHTML = `<b>${marker.mag}</b>`;
    divCrd.innerHTML = `X: <b>${marker.crd.x.toFixed(2)}</b>; Y: <b>${marker.crd.y.toFixed(2)}</b>; Z: <b>${marker.crd.z.toFixed(2)}</b>`;
    label.position.copy(marker.crd);
    label.element.animate([
      {width: "0px", height: "0px", marginTop: "0px", marginLeft: "0px"},
      {width: "230px", height: "50px", marginTop: "-25px", maginLeft: "120px"}
    ],{
      duration: 250
    });
    label.element.classList.remove("hidden");
  }
  
})
// </Interaction>

let clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  let t = clock.getElapsedTime();
  globalUniforms.time.value = t;
  controls.update();
  renderer.render(scene, camera);
  label.userData.trackVisibility();
  labelRenderer.render(scene, camera);
});

function onWindowResize() {
  camera.aspect = canvasContainer.offsetWidth / canvasContainer.offsetHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
  labelRenderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
}