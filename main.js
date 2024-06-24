// Importacion de Módulos
// Se importan los módulos necesarios de la biblioteca three.js y sus extensiones. THREE es el núcleo de la biblioteca, OrbitControls permite la interacción con la cámara y CSS2DRenderer se utiliza para renderizar etiquetas en 2D.
import * as THREE from "https://cdn.skypack.dev/three@0.136.0";
import { OrbitControls } from "https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls";
import { CSS2DRenderer, CSS2DObject } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/renderers/CSS2DRenderer.js';

// Se selecciona el contenedor del canvas donde se renderizará el globo terráqueo.
const canvasContainer = document.querySelector("#globe-container")

// Se crea una nueva escena (scene) y una cámara de perspectiva (camera). La cámara se posiciona y se ajusta su longitud.
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(50, canvasContainer.offsetWidth / canvasContainer.offsetHeight, 1, 2000);
camera.position.set(0.5, -0.2, 1).setLength(14);

// Se crea un renderizador WebGL (renderer) con antialiasing habilitado para suavizar los bordes. Se ajusta el tamaño del renderizador al tamaño del contenedor y se establece un color de fondo.
let renderer = new THREE.WebGLRenderer({ 
  antialias: true,
  canvas: document.querySelector("canvas")
});
renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
renderer.setClearColor(0xf9f9f9);

// Se crea un renderizador de etiquetas 2D (labelRenderer) y se ajusta su tamaño al del contenedor. Se posiciona de manera absoluta y se añade al contenedor del globo.
let labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
document.getElementById('globe-container').appendChild(labelRenderer.domElement);

// Ajuste del tamaño del renderizador al cambiar el tamaño de la ventana
window.addEventListener("resize", onWindowResize);

// Se crean los controles de órbita (controls) para permitir la interacción con la cámara. Se deshabilitan el paneo y el zoom, se establecen las distancias mínima y máxima, se habilita el amortiguamiento y la rotación automática con una velocidad reducida.
let controls = new OrbitControls(camera, labelRenderer.domElement);
controls.enablePan = false;
controls.enableZoom = false;
controls.minDistance = 6;
controls.maxDistance = 15;
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed *= 0.1;

// Se define un objeto de uniformes globales (globalUniforms) que contiene una variable de tiempo.
let globalUniforms = {
  time: { value: 0 }
};

// Se crea una instancia de THREE.TextureLoader para cargar texturas.
// Se carga la textura de la Tierra desde la ruta especificada ('img/testmap.jpg') y se almacena en earthTexture.
let textureLoader = new THREE.TextureLoader();
let earthTexture = textureLoader.load('https://i.imgur.com/Rvr9OHw.jpeg');

let rad = 5; // Se define el radio del globo (rad) como 5. 
let geometry = new THREE.SphereGeometry(rad, 32, 32); // Se crea una geometría esférica (THREE.SphereGeometry) con el radio especificado y 32 segmentos tanto en anchura como en altura.
let material = new THREE.MeshBasicMaterial({ map: earthTexture }); // Se crea un material básico (THREE.MeshBasicMaterial) y se asigna la textura de la Tierra (earthTexture) al mapa del material.
let globe = new THREE.Mesh(geometry, material); // Se crea una malla (THREE.Mesh) combinando la geometría y el material
scene.add(globe); // Se añade a la escena (scene).

// Se selecciona el elemento HTML para la etiqueta (labelDiv) y el botón de cierre (closeBtn).
let labelDiv = document.getElementById("markerLabel");
let closeBtn = document.getElementById("closeButton");
// Se añade un evento al botón de cierre para ocultar la etiqueta al hacer clic.
closeBtn.addEventListener("pointerdown", event => {
  labelDiv.classList.add("hidden");
})
// Se crea un objeto CSS2DObject para la etiqueta y se configura su userData con propiedades y una función para ajustar la visibilidad según la posición relativa al globo y la cámara.
// La función smoothstep se utiliza para suavizar la transición de la opacidad.
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

// Se define el número de marcadores (markerCount) como 4 y se inicializa un array para la información de los marcadores (markerInfo).
const markerCount = 4;
let markerInfo = [];
// Se crea una geometría de plano (THREE.PlaneGeometry) y un material básico (THREE.MeshBasicMaterial) con un color específico.
let gMarker = new THREE.PlaneGeometry();
let mMarker = new THREE.MeshBasicMaterial({
// Se configura el material para que use un shader personalizado que incluye un atributo phase y un uniforme time para animar los marcadores.
// Se crea una malla instanciada (THREE.InstancedMesh) con la geometría y el material, y se añade a la escena.
// Se utiliza un objeto dummy para posicionar los marcadores y se genera un array de fases aleatorias para desincronizar las animaciones de los marcadores.
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

// Función addMarker para agregar marcadores en posiciones específicas.
// Normaliza las coordenadas del marcador para que se ajusten al radio del globo.
// Posiciona y orienta el marcador usando el objeto dummy y actualiza la matriz de la malla instanciada.
// Añade la información del marcador al array markerInfo y asigna un identificador único al marcador.
function addMarker(x, y, z, id, mag, country) {
  let index = markerInfo.length;
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
  });

  // Añadir identificador único al marcador
  markers.userData[index] = { id: id };
}

// Ejemplo de cómo agregar marcadores
addMarker(1.7, -0.45, 4.95, 'Venezuela', '+00 123 4567 891');
addMarker(-1, 2.8, 4.95, 'Estados Unidos', '+00 123 4567 891');
addMarker(-1.3, 1, 4.95, 'México', '+00 123 4567 891');
addMarker(18.5, 11.5, 4.95, 'España', '+00 123 4567 891');

// Se crean variables para el puntero (pointer), el raycaster (raycaster), y las intersecciones (intersections).
let pointer = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let intersections;
// Se seleccionan los elementos HTML para mostrar la información del marcador (divID, divMag, divCrd).
let divID = document.getElementById("idNum");
let divMag = document.getElementById("magnitude");
// Se añade un evento para detectar clics (pointerdown) en la ventana.
let hidePopupTimeout = null;
const hideDelay = 200; // Retraso en milisegundos antes de ocultar el popup

// Función para ocultar el popup
function hidePopup() {
  label.element.classList.add("hidden");
}

// Evento de clic para mostrar el popup
window.addEventListener("pointerdown", event => {
  // Cancelar cualquier temporizador de ocultación previo
  if (hidePopupTimeout) {
    clearTimeout(hidePopupTimeout);
    hidePopupTimeout = null;
  }

  // Obtener las dimensiones y la posición del contenedor del canvas.
  const rect = canvasContainer.getBoundingClientRect();

  // Calcular las coordenadas del clic en el sistema de coordenadas normalizadas del dispositivo.
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Actualizar el raycaster con la cámara y la posición del puntero.
  raycaster.setFromCamera(pointer, camera);

  // Calcular las intersecciones entre el raycaster y los marcadores.
  intersections = raycaster.intersectObject(markers);

  if (intersections.length > 0) {
    // Si hay intersecciones, obtener el índice del marcador intersectado y mostrar la información del marcador en un popup.
    let index = intersections[0].instanceId;

    // Mostrar mensaje basado en el identificador del marcador
    let markerId = markers.userData[index].id;
    let marker = markerInfo.find(marker => marker.id === markerId);

    // Mostrar el popup
    divID.innerHTML = `<b>${marker.id}</b>`;
    divMag.innerHTML = `<b>${marker.mag}</b>`;
    label.position.copy(marker.crd);
    label.element.animate([
      { width: "0px", height: "0px", marginTop: "0px", marginLeft: "0px" },
      { width: "230px", height: "50px", marginTop: "-25px", marginLeft: "120px" }
    ], {
      duration: 250
    });
    label.element.classList.remove("hidden");

    // Girar la cámara hacia la posición del marcador con una animación suave
    animateCameraTo(marker.crd);
  }
});

// Evento de movimiento del ratón para ocultar el popup
window.addEventListener("pointermove", event => {
  // Verificar si el puntero está fuera del área del popup
  const rect = label.element.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    // Iniciar temporizador para ocultar el popup si el cursor está fuera del área
    if (!hidePopupTimeout) {
      hidePopupTimeout = setTimeout(hidePopup, hideDelay);
    }
  } else {
    // Cancelar temporizador si el cursor está dentro del área del popup
    if (hidePopupTimeout) {
      clearTimeout(hidePopupTimeout);
      hidePopupTimeout = null;
    }
  }
});

// Función para animar la cámara hacia una nueva posición
// Guardar el objetivo original de los controles de órbita al inicio
let originalTarget = controls.target.clone();

function animateCameraTo(targetPosition) {
  let startPosition = camera.position.clone();
  let duration = 0.5;
  let startTime = performance.now();

  function animate() {
    let elapsed = (performance.now() - startTime) / 1000;
    if (elapsed < duration) {
      requestAnimationFrame(animate);
    } else {
      elapsed = duration;
    }

    let t = elapsed / duration;

    // Animar la posición de la cámara hacia el objetivo sin modificar el objetivo de los controles
    camera.position.lerpVectors(startPosition, targetPosition.clone().setLength(14), t);
    controls.update();
  }

  animate();

  // Restaurar el objetivo original después de la animación
  setTimeout(() => {
    controls.target.copy(originalTarget);
    controls.update();
  }, duration * 1000);
}

// Se crea una instancia de THREE.Clock llamada clock. Este reloj se utiliza para medir el tiempo transcurrido desde que se inició la animación.
let clock = new THREE.Clock();

renderer.setAnimationLoop(() => { // establece un bucle de animación que se ejecuta continuamente.
  let t = clock.getElapsedTime(); // obtiene el tiempo transcurrido desde que se inició el reloj.
  globalUniforms.time.value = t; //  actualiza el valor del uniforme global time con el tiempo transcurrido.
  controls.update(); // actualiza los controles de órbita para reflejar cualquier cambio en la posición de la cámara.
  renderer.render(scene, camera); // renderiza la escena utilizando la cámara.
  label.userData.trackVisibility(); // ajusta la visibilidad de la etiqueta según su posición relativa al globo y la cámara.
  labelRenderer.render(scene, camera); // renderiza las etiquetas 2D en la escena.
});

function onWindowResize() {
  camera.aspect = canvasContainer.offsetWidth / canvasContainer.offsetHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
  labelRenderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
}
