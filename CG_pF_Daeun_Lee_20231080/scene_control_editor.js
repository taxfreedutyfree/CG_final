import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const ROCK_MODEL_PATH = "./rock.obj";
const STAIR_MODEL_PATH = "./stair_rock.obj";
const CHICKEN_MODEL_PATH = "./chicken.glb";
const HDRI_PATH = "./kloofendal_48d_partly_cloudy_puresky_4k.hdr";
const TEXTURE_PATHS = {
  map: "./Diffuse.png",
  normalMap: "./Normal.png",
  roughnessMap: "./Roughness.png"
};
const STAIR_TEXTURE_PATHS = {
  map: "./stair_diffuse.png",
  normalMap: "./stair_normal.png",
  roughnessMap: "./stair_roughness.png"
};

const PLATFORM_SIZE = 8;
const PLATFORM_THICKNESS = 1.2;
const STAIR_WIDTH = 4.2;
const ROUTE_SURFACE_LIFT = 0.02;
const ROUTE_LINE_LIFT = 0.03;
const DEFAULT_CHICKEN_COUNT = 12;
const CHICKEN_SCALE = 3.0;
const HEIGHT_LEVEL_MIN = 10;
const EXTRA_CONNECTION_CHANCE = 0.38;
const MAX_NODE_DEGREE = 3;
const CAMERA_STORAGE_KEY = "main-scene-camera";
const SETTINGS_STORAGE_KEY = "main-scene-settings";
const SETTINGS_FILE_NAME = "saved_settings.txt";
const SCHEDULE_CYCLE_MS = 3 * 60 * 1000;
const SCHEDULE_WALK_MS = 2.5 * 60 * 1000;
const SCHEDULE_ACTION_MS = 30 * 1000;
const DAILY_STRETCH_WINDOWS = [
  [8, 30, 9, 0],
  [10, 0, 10, 30],
  [11, 30, 12, 0],
  [13, 0, 13, 30],
  [14, 30, 15, 0],
  [16, 0, 16, 30]
];
const DAILY_DANCE_POINTS = [
  [10, 15],
  [11, 45],
  [13, 15],
  [14, 45],
  [16, 15],
  [17, 45]
];
const DEFAULT_CAMERA_POSE = {
  mode: "orthographic",
  fov: 45,
  position: [-96, 108, 148],
  target: [0, 28, 0]
};
const CHICKEN_COLLISION_DISTANCE = 2.2;
const CHICKEN_COLLISION_COOLDOWN = 16;
const CHICKEN_SIT_HOLD_SECONDS = 10;
const CHICKEN_SIT_PLAYBACK_SPEED = 0.5;
const SHOW_ROUTE_LINES = true;
const SHADOW_LIGHT_RADIUS = 30;
const SHADOW_LIGHT_HEIGHT = 36;
const CHICKEN_SHADOW_PLANE_SIZE = { x: 2.4, z: 1.8 };

let gridSize = 5;
let cellSpacing = 20;
let globalRockScale = 1;
let randomScaleMin = 0.7;
let pillarVerticalGap = 2.6;
let pillarLevelMax = 10;
let pillarRotationMaxDeg = 180;
let pillarNoiseAmount = 0;
let stairStartInset = 4;
let stairSurfaceYOffset = 0;
let stairOffsetZ = 0;
let routePillarTopYOffset = 0;
let routeOffsetX = 0;
let routeOffsetY = 0;
let routeOffsetZ = 0;
let stairStepCount = 8;
let stairStepHeight = 0.28;
let stairNoiseAmountDeg = 0;
let chickenCount = DEFAULT_CHICKEN_COUNT;
let chickenScale = CHICKEN_SCALE;
let chickenAnimSpeed = 1;
let chickenPivotYOffset = 0;
let clockUiScale = 1;
let lowerFogOpacity = 0.12;
let lowerFogColorHex = "#e9eef8";
let cameraClipStart = 0.03;
let focusDistanceMin = 88;
let focusDistanceMax = 132;
let orthoZoomMin = 4.8;
let orthoZoomMax = 8.5;
let focusLiftOffset = 6;
let focusTargetYOffset = 18;
let focusScreenYOffset = 0;
let markerArrowYOffset = 0;
let shadowLightAngleDeg = 37;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe9eef8, 140, 420);

const perspectiveCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.03, 900);
perspectiveCamera.position.fromArray(DEFAULT_CAMERA_POSE.position);

const orthographicSize = 140;
const orthographicCamera = new THREE.OrthographicCamera(
  -orthographicSize * window.innerWidth / window.innerHeight / 2,
  orthographicSize * window.innerWidth / window.innerHeight / 2,
  orthographicSize / 2,
  -orthographicSize / 2,
  0.03,
  900
);
orthographicCamera.position.copy(perspectiveCamera.position);

let camera = orthographicCamera;
let cameraMode = DEFAULT_CAMERA_POSE.mode;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 24;
controls.maxDistance = 520;
controls.target.fromArray(DEFAULT_CAMERA_POSE.target);
focusTargetYOffset = DEFAULT_CAMERA_POSE.target[1];
controls.update();

const clock = new THREE.Clock();
const tempAxisY = new THREE.Vector3(0, 1, 0);
const tempQuat = new THREE.Quaternion();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

scene.add(new THREE.HemisphereLight(0xffffff, 0xaeb8c7, 1.45));

const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
keyLight.position.set(24, 36, 18);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -160;
keyLight.shadow.camera.right = 160;
keyLight.shadow.camera.top = 160;
keyLight.shadow.camera.bottom = -160;
scene.add(keyLight);
scene.add(keyLight.target);

const fillLight = new THREE.DirectionalLight(0xb8cbff, 0.5);
fillLight.position.set(-18, 12, -24);
scene.add(fillLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.12 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

function formatShadowAngle(value) {
  return value.toFixed(1) + " deg";
}

function applyShadowLightAngle() {
  const rad = THREE.MathUtils.degToRad(shadowLightAngleDeg);
  keyLight.position.set(Math.cos(rad) * SHADOW_LIGHT_RADIUS, SHADOW_LIGHT_HEIGHT, Math.sin(rad) * SHADOW_LIGHT_RADIUS);
  keyLight.target.position.set(0, 0, 0);
  keyLight.target.updateMatrixWorld();
}

function hexToRgbLabel(hex) {
  const clean = hex.replace("#", "");
  const intValue = parseInt(clean, 16);
  const r = (intValue >> 16) & 255;
  const g = (intValue >> 8) & 255;
  const b = intValue & 255;
  return r + "," + g + "," + b;
}

const lowerFogMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  uniforms: {
    uColor: { value: new THREE.Color(0xe9eef8) },
    uMaxAlpha: { value: 0.42 },
    uHeight: { value: 36 }
  },
  vertexShader: [
    'varying vec3 vLocalPosition;' ,
    'void main() {' ,
    '  vLocalPosition = position;' ,
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);' ,
    '}'
  ].join('\n'),
  fragmentShader: [
    'uniform vec3 uColor;' ,
    'uniform float uMaxAlpha;' ,
    'uniform float uHeight;' ,
    'varying vec3 vLocalPosition;' ,
    'void main() {' ,
    '  float t = clamp((vLocalPosition.y + 0.5 * uHeight) / max(uHeight, 0.0001), 0.0, 1.0);' ,
    '  float alpha = (1.0 - smoothstep(0.18, 1.0, t)) * uMaxAlpha;' ,
    '  if (alpha <= 0.001) discard;' ,
    '  gl_FragColor = vec4(uColor, alpha);' ,
    '}'
  ].join('\n')
});
const lowerFogVolume = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), lowerFogMaterial);
lowerFogVolume.position.y = 18;
lowerFogVolume.renderOrder = 10;
scene.add(lowerFogVolume);

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(420, 48, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide, fog: false })
);
skyDome.visible = false;
scene.add(skyDome);

const world = new THREE.Group();
scene.add(world);
const stairGroup = new THREE.Group();
const pillarGroup = new THREE.Group();
const chickenGroup = new THREE.Group();
const routeLineGroup = new THREE.Group();
world.add(stairGroup, pillarGroup, chickenGroup, routeLineGroup);

const cameraModeSelect = document.getElementById("camera-mode");
const cameraModeLabel = document.getElementById("camera-mode-label");
const lensSlider = document.getElementById("lens-slider");
const lensValue = document.getElementById("lens-value");
const cameraHeightSlider = document.getElementById("camera-height");
const cameraHeightValue = document.getElementById("camera-height-value");
const focusHeightSlider = document.getElementById("focus-height");
const focusHeightValue = document.getElementById("focus-height-value");
const focusScreenYSlider = document.getElementById("focus-screen-y");
const focusScreenYValue = document.getElementById("focus-screen-y-value");
const cameraClipStartSlider = document.getElementById("camera-clip-start");
const cameraClipStartValue = document.getElementById("camera-clip-start-value");
const focusDistMinSlider = document.getElementById("focus-dist-min");
const focusDistMinValue = document.getElementById("focus-dist-min-value");
const focusDistMaxSlider = document.getElementById("focus-dist-max");
const focusDistMaxValue = document.getElementById("focus-dist-max-value");
const orthoZoomMinSlider = document.getElementById("ortho-zoom-min");
const orthoZoomMinValue = document.getElementById("ortho-zoom-min-value");
const orthoZoomMaxSlider = document.getElementById("ortho-zoom-max");
const orthoZoomMaxValue = document.getElementById("ortho-zoom-max-value");
const focusLiftSlider = document.getElementById("focus-lift");
const focusLiftValue = document.getElementById("focus-lift-value");
const clockScaleSlider = document.getElementById("clock-scale");
const clockScaleValue = document.getElementById("clock-scale-value");
const markerArrowYSlider = document.getElementById("marker-arrow-y");
const markerArrowYValue = document.getElementById("marker-arrow-y-value");
const lowerFogSlider = document.getElementById("lower-fog");
const lowerFogValue = document.getElementById("lower-fog-value");
const lowerFogColorInput = document.getElementById("lower-fog-color");
const lowerFogColorValue = document.getElementById("lower-fog-color-value");
const shadowAngleSlider = document.getElementById("shadow-angle");
const shadowAngleValue = document.getElementById("shadow-angle-value");
const saveCameraButton = document.getElementById("save-camera");
const clearCameraButton = document.getElementById("clear-camera");
const cameraDataField = document.getElementById("camera-data");
const gridSizeSlider = document.getElementById("grid-size");
const gridSizeValue = document.getElementById("grid-size-value");
const cellSpacingSlider = document.getElementById("cell-spacing");
const cellSpacingValue = document.getElementById("cell-spacing-value");
const rockScaleSlider = document.getElementById("rock-scale");
const rockScaleValue = document.getElementById("rock-scale-value");
const randomMinSlider = document.getElementById("random-min");
const randomMinValue = document.getElementById("random-min-value");
const spacingSlider = document.getElementById("spacing");
const spacingValue = document.getElementById("spacing-value");
const pillarMaxSlider = document.getElementById("pillar-max");
const pillarMaxValue = document.getElementById("pillar-max-value");
const rotationMaxSlider = document.getElementById("rotation-max");
const rotationMaxValue = document.getElementById("rotation-max-value");
const noiseSlider = document.getElementById("noise");
const noiseValue = document.getElementById("noise-value");
const stairInsetSlider = document.getElementById("stair-inset");
const stairInsetValue = document.getElementById("stair-inset-value");
const stairYSlider = document.getElementById("stair-y");
const stairYValue = document.getElementById("stair-y-value");
const stairZSlider = document.getElementById("stair-z");
const stairZValue = document.getElementById("stair-z-value");
const routeTopYSlider = document.getElementById("route-top-y");
const routeTopYValue = document.getElementById("route-top-y-value");
const routeXSlider = document.getElementById("route-x");
const routeXValue = document.getElementById("route-x-value");
const routeYSlider = document.getElementById("route-y");
const routeYValue = document.getElementById("route-y-value");
const routeZSlider = document.getElementById("route-z");
const routeZValue = document.getElementById("route-z-value");
const stairCountSlider = document.getElementById("stair-count");
const stairCountValue = document.getElementById("stair-count-value");
const stairHeightSlider = document.getElementById("stair-height");
const stairHeightValue = document.getElementById("stair-height-value");
const stairNoiseSlider = document.getElementById("stair-noise");
const stairNoiseValue = document.getElementById("stair-noise-value");
const chickenCountInput = document.getElementById("chicken-count");
const chickenCountValue = document.getElementById("chicken-count-value");
const chickenScaleSlider = document.getElementById("chicken-scale");
const chickenScaleValue = document.getElementById("chicken-scale-value");
const chickenAnimSpeedSlider = document.getElementById("chicken-anim-speed");
const chickenAnimSpeedValue = document.getElementById("chicken-anim-speed-value");
const chickenPivotYSlider = document.getElementById("chicken-pivot-y");
const chickenPivotYValue = document.getElementById("chicken-pivot-y-value");
const saveSettingsButton = document.getElementById("save-settings");
const clearSettingsButton = document.getElementById("clear-settings");
const settingsDataField = document.getElementById("settings-data");
const focusClock = document.getElementById("focus-clock");
const focusClockTimeField = document.getElementById("focus-clock-time");
const focusClockAmPmField = document.getElementById("focus-clock-ampm");

const textureLoader = new THREE.TextureLoader();
const sharedMaps = {
  map: textureLoader.load(TEXTURE_PATHS.map),
  normalMap: textureLoader.load(TEXTURE_PATHS.normalMap),
  roughnessMap: textureLoader.load(TEXTURE_PATHS.roughnessMap)
};
const stairMaps = {
  map: textureLoader.load(STAIR_TEXTURE_PATHS.map),
  normalMap: textureLoader.load(STAIR_TEXTURE_PATHS.normalMap),
  roughnessMap: textureLoader.load(STAIR_TEXTURE_PATHS.roughnessMap)
};
sharedMaps.map.colorSpace = THREE.SRGBColorSpace;
stairMaps.map.colorSpace = THREE.SRGBColorSpace;
for (const texture of [...Object.values(sharedMaps), ...Object.values(stairMaps)]) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
}

let rockTemplate = null;
const rockTemplateSize = new THREE.Vector3(1, 1, 1);
let rockTopSurfaceY = PLATFORM_THICKNESS;
let stairTemplate = null;
const stairTemplateSize = new THREE.Vector3(1, 1, 1);
let chickenTemplate = null;
let chickenAnimations = [];
const cells = [];
const cellMap = new Map();
const graph = new Map();
const routeMap = new Map();
const chickens = [];
let sceneBuilt = false;
const focusState = {
  active: false,
  currentChicken: null,
  fromPosition: new THREE.Vector3(),
  toPosition: new THREE.Vector3(),
  fromTarget: new THREE.Vector3(),
  toTarget: new THREE.Vector3(),
  cameraOffset: new THREE.Vector3(),
  targetLift: 0,
  elapsed: 0,
  duration: 1.8,
  holdTimer: 0,
  nextSwitchIn: 0,
  fromOrthoZoom: 1,
  toOrthoZoom: 1,
  fromPerspectiveFov: DEFAULT_CAMERA_POSE.fov,
  toPerspectiveFov: DEFAULT_CAMERA_POSE.fov
};

wireUi();
loadSavedSettings();
loadSavedSettingsFromFile();
applyCameraPose(DEFAULT_CAMERA_POSE);
loadSavedCameraPose();
syncUi();
applyClockUiScale();
applyLowerFogStyle();
applyCameraClipStart();
applyShadowLightAngle();
loadAssets();
animate();

function wireUi() {
  if (cameraModeSelect) {
    cameraModeSelect.addEventListener("change", () => setCameraMode(cameraModeSelect.value));
  }
  if (lensSlider) {
    lensSlider.addEventListener("input", () => {
      perspectiveCamera.fov = Number(lensSlider.value);
      perspectiveCamera.updateProjectionMatrix();
      lensValue.textContent = lensSlider.value;
    });
  }
  if (cameraHeightSlider) {
    cameraHeightSlider.addEventListener("input", () => setCameraHeight(Number(cameraHeightSlider.value)));
  }
  if (focusHeightSlider) {
    focusHeightSlider.addEventListener("input", () => setFocusHeight(Number(focusHeightSlider.value)));
  }
  if (focusScreenYSlider) {
    focusScreenYSlider.addEventListener("input", () => {
      focusScreenYOffset = Number(focusScreenYSlider.value);
      syncCameraUi();
    });
  }
  if (cameraClipStartSlider) {
    cameraClipStartSlider.addEventListener("input", () => {
      cameraClipStart = Number(cameraClipStartSlider.value);
      applyCameraClipStart();
      syncCameraUi();
    });
  }
  if (focusDistMinSlider) {
    focusDistMinSlider.addEventListener("input", () => {
      focusDistanceMin = Number(focusDistMinSlider.value);
      if (focusDistanceMax < focusDistanceMin) {
        focusDistanceMax = focusDistanceMin;
      }
      syncCameraUi();
    });
  }
  if (focusDistMaxSlider) {
    focusDistMaxSlider.addEventListener("input", () => {
      focusDistanceMax = Number(focusDistMaxSlider.value);
      if (focusDistanceMax < focusDistanceMin) {
        focusDistanceMin = focusDistanceMax;
      }
      syncCameraUi();
    });
  }
  if (orthoZoomMinSlider) {
    orthoZoomMinSlider.addEventListener("input", () => {
      orthoZoomMin = Number(orthoZoomMinSlider.value);
      if (orthoZoomMax < orthoZoomMin) {
        orthoZoomMax = orthoZoomMin;
      }
      syncCameraUi();
    });
  }
  if (orthoZoomMaxSlider) {
    orthoZoomMaxSlider.addEventListener("input", () => {
      orthoZoomMax = Number(orthoZoomMaxSlider.value);
      if (orthoZoomMax < orthoZoomMin) {
        orthoZoomMin = orthoZoomMax;
      }
      syncCameraUi();
    });
  }
  if (focusLiftSlider) {
    focusLiftSlider.addEventListener("input", () => {
      focusLiftOffset = Number(focusLiftSlider.value);
      syncCameraUi();
    });
  }
  if (clockScaleSlider) {
    clockScaleSlider.addEventListener("input", () => {
      clockUiScale = Number(clockScaleSlider.value);
      applyClockUiScale();
      syncUi();
    });
  }
  if (markerArrowYSlider) {
    markerArrowYSlider.addEventListener("input", () => {
      markerArrowYOffset = Number(markerArrowYSlider.value);
      syncUi();
    });
  }
  if (lowerFogSlider) {
    lowerFogSlider.addEventListener("input", () => {
      lowerFogOpacity = Number(lowerFogSlider.value);
      applyLowerFogStyle();
      syncUi();
    });
  }
  if (lowerFogColorInput) {
    lowerFogColorInput.addEventListener("input", () => {
      lowerFogColorHex = lowerFogColorInput.value;
      applyLowerFogStyle();
      syncUi();
    });
  }
  if (shadowAngleSlider) {
    shadowAngleSlider.addEventListener("input", () => {
      shadowLightAngleDeg = Number(shadowAngleSlider.value);
      applyShadowLightAngle();
      syncUi();
    });
  }
  if (saveCameraButton) {
    saveCameraButton.addEventListener("click", saveCameraPose);
  }
  if (clearCameraButton) {
    clearCameraButton.addEventListener("click", () => {
      localStorage.removeItem(CAMERA_STORAGE_KEY);
      cameraDataField.value = JSON.stringify(DEFAULT_CAMERA_POSE, null, 2);
      applyCameraPose(DEFAULT_CAMERA_POSE);
    });
  }
  if (gridSizeSlider) {
    gridSizeSlider.addEventListener("input", () => {
      gridSize = Number(gridSizeSlider.value);
      updateGridLabel();
    });
    gridSizeSlider.addEventListener("change", () => {
      gridSize = Number(gridSizeSlider.value);
      regenerateFullMap();
    });
  }
  if (cellSpacingSlider) {
    cellSpacingSlider.addEventListener("input", () => {
      cellSpacing = Number(cellSpacingSlider.value);
      cellSpacingValue.textContent = cellSpacing.toFixed(2);
    });
    cellSpacingSlider.addEventListener("change", () => {
      cellSpacing = Number(cellSpacingSlider.value);
      regenerateFullMap();
    });
  }
  if (rockScaleSlider) {
    rockScaleSlider.addEventListener("input", () => {
      globalRockScale = Number(rockScaleSlider.value);
      rockScaleValue.textContent = globalRockScale.toFixed(2);
      applyPillarTransforms();
    });
  }
  if (randomMinSlider) {
    randomMinSlider.addEventListener("input", () => {
      randomScaleMin = Number(randomMinSlider.value);
      randomMinValue.textContent = randomScaleMin.toFixed(2);
      reseedPillarRocks();
      applyPillarTransforms();
    });
  }
  if (spacingSlider) {
    spacingSlider.addEventListener("input", () => {
      pillarVerticalGap = Number(spacingSlider.value);
      spacingValue.textContent = pillarVerticalGap.toFixed(2);
    });
    spacingSlider.addEventListener("change", () => {
      pillarVerticalGap = Number(spacingSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (pillarMaxSlider) {
    pillarMaxSlider.addEventListener("input", () => {
      pillarLevelMax = Number(pillarMaxSlider.value);
      pillarMaxValue.textContent = String(pillarLevelMax);
    });
    pillarMaxSlider.addEventListener("change", () => {
      pillarLevelMax = Number(pillarMaxSlider.value);
      regenerateFullMap();
    });
  }
  if (rotationMaxSlider) {
    rotationMaxSlider.addEventListener("input", () => {
      pillarRotationMaxDeg = Number(rotationMaxSlider.value);
      rotationMaxValue.textContent = formatDegrees(pillarRotationMaxDeg);
      applyPillarTransforms();
    });
  }
  if (noiseSlider) {
    noiseSlider.addEventListener("input", () => {
      pillarNoiseAmount = Number(noiseSlider.value);
      noiseValue.textContent = pillarNoiseAmount.toFixed(2);
      applyPillarTransforms();
    });
  }
  if (stairInsetSlider) {
    stairInsetSlider.addEventListener("input", () => {
      stairStartInset = Number(stairInsetSlider.value);
      stairInsetValue.textContent = stairStartInset.toFixed(2);
    });
    stairInsetSlider.addEventListener("change", () => {
      stairStartInset = Number(stairInsetSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (stairYSlider) {
    stairYSlider.addEventListener("input", () => {
      stairSurfaceYOffset = Number(stairYSlider.value);
      stairYValue.textContent = stairSurfaceYOffset.toFixed(2);
    });
    stairYSlider.addEventListener("change", () => {
      stairSurfaceYOffset = Number(stairYSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (stairZSlider) {
    stairZSlider.addEventListener("input", () => {
      stairOffsetZ = Number(stairZSlider.value);
      stairZValue.textContent = stairOffsetZ.toFixed(2);
    });
    stairZSlider.addEventListener("change", () => {
      stairOffsetZ = Number(stairZSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (routeTopYSlider) {
    routeTopYSlider.addEventListener("input", () => {
      routePillarTopYOffset = Number(routeTopYSlider.value);
      routeTopYValue.textContent = routePillarTopYOffset.toFixed(2);
    });
    routeTopYSlider.addEventListener("change", () => {
      routePillarTopYOffset = Number(routeTopYSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (routeXSlider) {
    routeXSlider.addEventListener("input", () => {
      routeOffsetX = Number(routeXSlider.value);
      routeXValue.textContent = routeOffsetX.toFixed(2);
    });
    routeXSlider.addEventListener("change", () => {
      routeOffsetX = Number(routeXSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (routeYSlider) {
    routeYSlider.addEventListener("input", () => {
      routeOffsetY = Number(routeYSlider.value);
      routeYValue.textContent = routeOffsetY.toFixed(2);
    });
    routeYSlider.addEventListener("change", () => {
      routeOffsetY = Number(routeYSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (routeZSlider) {
    routeZSlider.addEventListener("input", () => {
      routeOffsetZ = Number(routeZSlider.value);
      routeZValue.textContent = routeOffsetZ.toFixed(2);
    });
    routeZSlider.addEventListener("change", () => {
      routeOffsetZ = Number(routeZSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (stairCountSlider) {
    stairCountSlider.addEventListener("input", () => {
      stairStepCount = Number(stairCountSlider.value);
      stairCountValue.textContent = String(stairStepCount);
    });
    stairCountSlider.addEventListener("change", () => {
      stairStepCount = Number(stairCountSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (stairHeightSlider) {
    stairHeightSlider.addEventListener("input", () => {
      stairStepHeight = Number(stairHeightSlider.value);
      stairHeightValue.textContent = stairStepHeight.toFixed(2);
    });
    stairHeightSlider.addEventListener("change", () => {
      stairStepHeight = Number(stairHeightSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (stairNoiseSlider) {
    stairNoiseSlider.addEventListener("input", () => {
      stairNoiseAmountDeg = Number(stairNoiseSlider.value);
      stairNoiseValue.textContent = formatDegrees(stairNoiseAmountDeg);
    });
    stairNoiseSlider.addEventListener("change", () => {
      stairNoiseAmountDeg = Number(stairNoiseSlider.value);
      rebuildVisualMap(false);
    });
  }
  if (chickenCountInput) {
    chickenCountInput.addEventListener("change", () => {
      chickenCount = THREE.MathUtils.clamp(Math.round(Number(chickenCountInput.value) || DEFAULT_CHICKEN_COUNT), 1, 80);
      chickenCountInput.value = String(chickenCount);
      chickenCountValue.textContent = String(chickenCount);
      respawnChickenRoutes();
      resetCameraFocus();
      syncUi();
    });
  }
  if (chickenScaleSlider) {
    chickenScaleSlider.addEventListener("input", () => {
      chickenScale = Number(chickenScaleSlider.value);
      chickenScaleValue.textContent = chickenScale.toFixed(2);
      applyChickenScale();
    });
  }
  if (chickenAnimSpeedSlider) {
    chickenAnimSpeedSlider.addEventListener("input", () => {
      chickenAnimSpeed = Number(chickenAnimSpeedSlider.value);
      chickenAnimSpeedValue.textContent = chickenAnimSpeed.toFixed(2);
      applyChickenAnimationSpeed();
    });
  }
  if (chickenPivotYSlider) {
    chickenPivotYSlider.addEventListener("input", () => {
      chickenPivotYOffset = Number(chickenPivotYSlider.value);
      chickenPivotYValue.textContent = chickenPivotYOffset.toFixed(2);
      applyChickenPivotOffset();
    });
  }
  if (saveSettingsButton) {
    saveSettingsButton.addEventListener("click", saveCurrentSettings);
  }
  if (clearSettingsButton) {
    clearSettingsButton.addEventListener("click", clearSavedSettings);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onResize);
}

function onResize() {
  updateCameraProjection();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  if (!chickens.length) return;
  const key = event.key.toLowerCase();
  if (key === "d") {
    triggerGroupAction("dance");
  } else if (key === "s") {
    triggerGroupAction("strech");
  } else if (key === "w") {
    for (const chicken of chickens) {
      resumeWalking(chicken);
    }
  }
}

function updateCameraProjection() {
  const aspect = window.innerWidth / window.innerHeight;
  perspectiveCamera.aspect = aspect;
  perspectiveCamera.updateProjectionMatrix();
  orthographicCamera.left = -orthographicSize * aspect / 2;
  orthographicCamera.right = orthographicSize * aspect / 2;
  orthographicCamera.top = orthographicSize / 2;
  orthographicCamera.bottom = -orthographicSize / 2;
  orthographicCamera.updateProjectionMatrix();
}

function setCameraMode(mode) {
  if (mode === cameraMode) return;
  const previousCamera = camera;
  const nextCamera = mode === "orthographic" ? orthographicCamera : perspectiveCamera;
  nextCamera.position.copy(previousCamera.position);
  nextCamera.quaternion.copy(previousCamera.quaternion);
  camera = nextCamera;
  cameraMode = mode;
  controls.object = camera;
  syncCameraUi();
  updateCameraProjection();
  controls.update();
}

function setCameraHeight(height) {
  camera.position.y = height;
  orthographicCamera.position.y = height;
  perspectiveCamera.position.y = height;
  syncCameraUi();
  controls.update();
}

function setFocusHeight(height) {
  focusTargetYOffset = THREE.MathUtils.clamp(height, -20, 40);
  syncCameraUi();
}

function applyCameraClipStart() {
  perspectiveCamera.near = Math.max(0.001, cameraClipStart);
  orthographicCamera.near = Math.max(0.001, cameraClipStart);
  perspectiveCamera.updateProjectionMatrix();
  orthographicCamera.updateProjectionMatrix();
}

function syncUi() {
  updateGridLabel();
  if (cellSpacingSlider) cellSpacingSlider.value = String(cellSpacing);
  if (cellSpacingValue) cellSpacingValue.textContent = cellSpacing.toFixed(2);
  if (rockScaleSlider) rockScaleSlider.value = String(globalRockScale);
  if (rockScaleValue) rockScaleValue.textContent = globalRockScale.toFixed(2);
  if (randomMinSlider) randomMinSlider.value = String(randomScaleMin);
  if (randomMinValue) randomMinValue.textContent = randomScaleMin.toFixed(2);
  if (spacingSlider) spacingSlider.value = String(pillarVerticalGap);
  if (spacingValue) spacingValue.textContent = pillarVerticalGap.toFixed(2);
  pillarLevelMax = THREE.MathUtils.clamp(Math.round(pillarLevelMax), HEIGHT_LEVEL_MIN, 20);
  if (pillarMaxSlider) pillarMaxSlider.value = String(pillarLevelMax);
  if (pillarMaxValue) pillarMaxValue.textContent = String(pillarLevelMax);
  if (rotationMaxSlider) rotationMaxSlider.value = String(Math.round(pillarRotationMaxDeg));
  if (rotationMaxValue) rotationMaxValue.textContent = formatDegrees(pillarRotationMaxDeg);
  if (noiseSlider) noiseSlider.value = String(pillarNoiseAmount);
  if (noiseValue) noiseValue.textContent = pillarNoiseAmount.toFixed(2);
  if (stairInsetSlider) stairInsetSlider.value = String(stairStartInset);
  if (stairInsetValue) stairInsetValue.textContent = stairStartInset.toFixed(2);
  if (stairYSlider) stairYSlider.value = String(stairSurfaceYOffset);
  if (stairYValue) stairYValue.textContent = stairSurfaceYOffset.toFixed(2);
  if (stairZSlider) stairZSlider.value = String(stairOffsetZ);
  if (stairZValue) stairZValue.textContent = stairOffsetZ.toFixed(2);
  if (routeTopYSlider) routeTopYSlider.value = String(routePillarTopYOffset);
  if (routeTopYValue) routeTopYValue.textContent = routePillarTopYOffset.toFixed(2);
  if (routeXSlider) routeXSlider.value = String(routeOffsetX);
  if (routeXValue) routeXValue.textContent = routeOffsetX.toFixed(2);
  if (routeYSlider) routeYSlider.value = String(routeOffsetY);
  if (routeYValue) routeYValue.textContent = routeOffsetY.toFixed(2);
  if (routeZSlider) routeZSlider.value = String(routeOffsetZ);
  if (routeZValue) routeZValue.textContent = routeOffsetZ.toFixed(2);
  if (stairCountSlider) stairCountSlider.value = String(stairStepCount);
  if (stairCountValue) stairCountValue.textContent = String(stairStepCount);
  if (stairHeightSlider) stairHeightSlider.value = String(stairStepHeight);
  if (stairHeightValue) stairHeightValue.textContent = stairStepHeight.toFixed(2);
  if (stairNoiseSlider) stairNoiseSlider.value = String(Math.round(stairNoiseAmountDeg));
  if (stairNoiseValue) stairNoiseValue.textContent = formatDegrees(stairNoiseAmountDeg);
  if (chickenCountInput) chickenCountInput.value = String(chickenCount);
  if (chickenCountValue) chickenCountValue.textContent = String(chickenCount);
  if (chickenScaleSlider) chickenScaleSlider.value = String(chickenScale);
  if (chickenScaleValue) chickenScaleValue.textContent = chickenScale.toFixed(2);
  if (chickenAnimSpeedSlider) chickenAnimSpeedSlider.value = String(chickenAnimSpeed);
  if (chickenAnimSpeedValue) chickenAnimSpeedValue.textContent = chickenAnimSpeed.toFixed(2);
  if (chickenPivotYSlider) chickenPivotYSlider.value = String(chickenPivotYOffset);
  if (chickenPivotYValue) chickenPivotYValue.textContent = chickenPivotYOffset.toFixed(2);
  if (clockScaleSlider) clockScaleSlider.value = String(clockUiScale);
  if (clockScaleValue) clockScaleValue.textContent = clockUiScale.toFixed(2);
  if (lowerFogSlider) lowerFogSlider.value = String(lowerFogOpacity);
  if (lowerFogValue) lowerFogValue.textContent = lowerFogOpacity.toFixed(2);
  if (lowerFogColorInput) lowerFogColorInput.value = lowerFogColorHex;
  if (lowerFogColorValue) lowerFogColorValue.textContent = hexToRgbLabel(lowerFogColorHex);
  if (shadowAngleSlider) shadowAngleSlider.value = String(Math.round(shadowLightAngleDeg));
  if (shadowAngleValue) shadowAngleValue.textContent = formatShadowAngle(shadowLightAngleDeg);
  updateSettingsField();
  syncCameraUi();
}

function getSettingsData() {
  return {
    cameraMode,
    lensFov: round3(perspectiveCamera.fov),
    cameraHeight: round3(camera.position.y),
    focusHeight: round3(focusTargetYOffset),
    cameraClipStart: round3(cameraClipStart),
    focusDistanceMin: round3(focusDistanceMin),
    focusDistanceMax: round3(focusDistanceMax),
    orthoZoomMin: round3(orthoZoomMin),
    orthoZoomMax: round3(orthoZoomMax),
    focusLiftOffset: round3(focusLiftOffset),
    focusScreenYOffset: round3(focusScreenYOffset),
    markerArrowYOffset: round3(markerArrowYOffset),
    gridSize,
    cellSpacing: round3(cellSpacing),
    globalRockScale: round3(globalRockScale),
    randomScaleMin: round3(randomScaleMin),
    pillarVerticalGap: round3(pillarVerticalGap),
    pillarLevelMax,
    pillarRotationMaxDeg: round3(pillarRotationMaxDeg),
    pillarNoiseAmount: round3(pillarNoiseAmount),
    stairOffsetX: round3(stairStartInset),
    stairOffsetY: round3(stairSurfaceYOffset),
    stairOffsetZ: round3(stairOffsetZ),
    routeTopY: round3(routePillarTopYOffset),
    routeOffsetX: round3(routeOffsetX),
    routeOffsetY: round3(routeOffsetY),
    routeOffsetZ: round3(routeOffsetZ),
    stairCount: stairStepCount,
    stairHeight: round3(stairStepHeight),
    stairNoiseDeg: round3(stairNoiseAmountDeg),
    chickenCount,
    chickenScale: round3(chickenScale),
    chickenAnimSpeed: round3(chickenAnimSpeed),
    chickenPivotY: round3(chickenPivotYOffset),
    clockUiScale: round3(clockUiScale),
    lowerFogOpacity: round3(lowerFogOpacity),
    lowerFogColorHex,
    shadowLightAngleDeg: round3(shadowLightAngleDeg)
  };
}

function applySettingsData(data) {
  if (!data) return;
  if (typeof data.cameraMode === "string") setCameraMode(data.cameraMode);
  if (typeof data.lensFov === "number") {
    perspectiveCamera.fov = data.lensFov;
    perspectiveCamera.updateProjectionMatrix();
  }
  if (typeof data.cameraHeight === "number") setCameraHeight(data.cameraHeight);
  if (typeof data.focusHeight === "number") setFocusHeight(data.focusHeight);
  if (typeof data.cameraClipStart === "number") cameraClipStart = Math.max(0.001, data.cameraClipStart);
  if (typeof data.focusDistanceMin === "number") focusDistanceMin = data.focusDistanceMin;
  if (typeof data.focusDistanceMax === "number") focusDistanceMax = data.focusDistanceMax;
  if (typeof data.orthoZoomMin === "number") orthoZoomMin = data.orthoZoomMin;
  if (typeof data.orthoZoomMax === "number") orthoZoomMax = data.orthoZoomMax;
  if (typeof data.focusLiftOffset === "number") focusLiftOffset = data.focusLiftOffset;
  if (typeof data.focusScreenYOffset === "number") focusScreenYOffset = data.focusScreenYOffset;
  if (typeof data.markerArrowYOffset === "number") markerArrowYOffset = data.markerArrowYOffset;
  if (focusDistanceMax < focusDistanceMin) focusDistanceMax = focusDistanceMin;
  if (orthoZoomMax < orthoZoomMin) orthoZoomMax = orthoZoomMin;
  applyCameraClipStart();
  if (typeof data.gridSize === "number") gridSize = data.gridSize;
  if (typeof data.cellSpacing === "number") cellSpacing = data.cellSpacing;
  if (typeof data.globalRockScale === "number") globalRockScale = data.globalRockScale;
  if (typeof data.randomScaleMin === "number") randomScaleMin = data.randomScaleMin;
  if (typeof data.pillarVerticalGap === "number") pillarVerticalGap = data.pillarVerticalGap;
  if (typeof data.pillarLevelMax === "number") pillarLevelMax = THREE.MathUtils.clamp(Math.round(data.pillarLevelMax), HEIGHT_LEVEL_MIN, 20);
  if (typeof data.pillarRotationMaxDeg === "number") pillarRotationMaxDeg = data.pillarRotationMaxDeg;
  if (typeof data.pillarNoiseAmount === "number") pillarNoiseAmount = data.pillarNoiseAmount;
  if (typeof data.stairOffsetX === "number") stairStartInset = data.stairOffsetX;
  if (typeof data.stairOffsetY === "number") stairSurfaceYOffset = data.stairOffsetY;
  if (typeof data.stairOffsetZ === "number") stairOffsetZ = data.stairOffsetZ;
  if (typeof data.routeTopY === "number") routePillarTopYOffset = data.routeTopY;
  if (typeof data.routeOffsetX === "number") routeOffsetX = data.routeOffsetX;
  if (typeof data.routeOffsetY === "number") routeOffsetY = data.routeOffsetY;
  if (typeof data.routeOffsetZ === "number") routeOffsetZ = data.routeOffsetZ;
  if (typeof data.stairCount === "number") stairStepCount = data.stairCount;
  if (typeof data.stairHeight === "number") stairStepHeight = data.stairHeight;
  if (typeof data.stairNoiseDeg === "number") stairNoiseAmountDeg = data.stairNoiseDeg;
  if (typeof data.chickenCount === "number") chickenCount = THREE.MathUtils.clamp(Math.round(data.chickenCount), 1, 80);
  if (typeof data.chickenScale === "number") chickenScale = data.chickenScale;
  if (typeof data.chickenAnimSpeed === "number") chickenAnimSpeed = data.chickenAnimSpeed;
  if (typeof data.chickenPivotY === "number") chickenPivotYOffset = data.chickenPivotY;
  if (typeof data.clockUiScale === "number") clockUiScale = data.clockUiScale;
  if (typeof data.lowerFogOpacity === "number") lowerFogOpacity = THREE.MathUtils.clamp(data.lowerFogOpacity, 0, 0.18);
  if (typeof data.lowerFogColorHex === "string") lowerFogColorHex = data.lowerFogColorHex;
  if (typeof data.shadowLightAngleDeg === "number") shadowLightAngleDeg = data.shadowLightAngleDeg;
  applyShadowLightAngle();
}

function updateSettingsField() {
  if (!settingsDataField) return;
  settingsDataField.value = JSON.stringify(getSettingsData(), null, 2);
}

async function saveCurrentSettings() {
  const text = JSON.stringify(getSettingsData(), null, 2);
  localStorage.setItem(SETTINGS_STORAGE_KEY, text);
  if (settingsDataField) settingsDataField.value = text;
  await exportSettingsToTxt(text);
}

async function exportSettingsToTxt(text) {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: SETTINGS_FILE_NAME,
        types: [{
          description: "Text Files",
          accept: { "text/plain": [".txt"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
      console.warn("File picker save failed, using download fallback.", error);
    }
  }

  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = SETTINGS_FILE_NAME;
  link.click();
  URL.revokeObjectURL(url);
}

function clearSavedSettings() {
  localStorage.removeItem(SETTINGS_STORAGE_KEY);
  updateSettingsField();
}

function loadSavedSettings() {
  const text = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!text) {
    updateSettingsField();
    return;
  }
  try {
    applySettingsData(JSON.parse(text));
  } catch (error) {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  }
}

async function loadSavedSettingsFromFile() {
  try {
    const url = "./" + SETTINGS_FILE_NAME + "?t=" + Date.now();
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return;
    const text = await response.text();
    const data = JSON.parse(text);
    applySettingsData(data);
    syncUi();
    applyClockUiScale();
    applyLowerFogStyle();
    if (sceneBuilt) {
      regenerateFullMap();
    }
  } catch (error) {
    console.warn("saved_settings.txt load skipped", error);
  }
}

function updateGridLabel() {
  if (gridSizeSlider) gridSizeSlider.value = String(gridSize);
  if (gridSizeValue) gridSizeValue.textContent = `${gridSize} x ${gridSize}`;
}

function syncCameraUi() {
  if (lensSlider) lensSlider.value = String(Math.round(perspectiveCamera.fov));
  if (lensValue) lensValue.textContent = String(Math.round(perspectiveCamera.fov));
  if (cameraHeightSlider) cameraHeightSlider.value = String(Math.round(camera.position.y));
  if (cameraHeightValue) cameraHeightValue.textContent = String(Math.round(camera.position.y));
  if (focusHeightSlider) focusHeightSlider.value = String(Math.round(focusTargetYOffset));
  if (focusHeightValue) focusHeightValue.textContent = String(Math.round(focusTargetYOffset));
  if (cameraClipStartSlider) cameraClipStartSlider.value = String(cameraClipStart);
  if (cameraClipStartValue) cameraClipStartValue.textContent = cameraClipStart.toFixed(2);
  if (focusDistMinSlider) focusDistMinSlider.value = String(focusDistanceMin);
  if (focusDistMinValue) focusDistMinValue.textContent = focusDistanceMin.toFixed(2);
  if (focusDistMaxSlider) focusDistMaxSlider.value = String(focusDistanceMax);
  if (focusDistMaxValue) focusDistMaxValue.textContent = focusDistanceMax.toFixed(2);
  if (orthoZoomMinSlider) orthoZoomMinSlider.value = String(orthoZoomMin);
  if (orthoZoomMinValue) orthoZoomMinValue.textContent = orthoZoomMin.toFixed(2);
  if (orthoZoomMaxSlider) orthoZoomMaxSlider.value = String(orthoZoomMax);
  if (orthoZoomMaxValue) orthoZoomMaxValue.textContent = orthoZoomMax.toFixed(2);
  if (focusLiftSlider) focusLiftSlider.value = String(focusLiftOffset);
  if (focusLiftValue) focusLiftValue.textContent = focusLiftOffset.toFixed(2);
  if (focusScreenYSlider) focusScreenYSlider.value = String(focusScreenYOffset);
  if (focusScreenYValue) focusScreenYValue.textContent = focusScreenYOffset.toFixed(0);
  if (clockScaleSlider) clockScaleSlider.value = String(clockUiScale);
  if (markerArrowYSlider) markerArrowYSlider.value = String(markerArrowYOffset);
  if (markerArrowYValue) markerArrowYValue.textContent = markerArrowYOffset.toFixed(0);
  if (focusClock) focusClock.style.setProperty("--arrow-offset-y", markerArrowYOffset.toFixed(2) + "px");
  if (clockScaleValue) clockScaleValue.textContent = clockUiScale.toFixed(2);
  if (cameraModeSelect) cameraModeSelect.value = cameraMode;
  if (cameraModeLabel) cameraModeLabel.textContent = cameraMode === "orthographic" ? "Orthographic" : "Perspective";
}

function getCameraPoseData() {
  return {
    mode: cameraMode,
    fov: perspectiveCamera.fov,
    position: camera.position.toArray().map(round3),
    target: [round3(controls.target.x), round3(focusTargetYOffset), round3(controls.target.z)]
  };
}

function saveCameraPose() {
  const text = JSON.stringify(getCameraPoseData(), null, 2);
  localStorage.setItem(CAMERA_STORAGE_KEY, text);
  if (cameraDataField) cameraDataField.value = text;
}

function loadSavedCameraPose() {
  const text = localStorage.getItem(CAMERA_STORAGE_KEY);
  if (!text) {
    if (cameraDataField) cameraDataField.value = JSON.stringify(DEFAULT_CAMERA_POSE, null, 2);
    return;
  }
  try {
    const data = JSON.parse(text);
    applyCameraPose(data);
    if (cameraDataField) cameraDataField.value = text;
  } catch (error) {
    localStorage.removeItem(CAMERA_STORAGE_KEY);
    if (cameraDataField) cameraDataField.value = JSON.stringify(DEFAULT_CAMERA_POSE, null, 2);
  }
}

function applyClockUiScale() {
  if (!focusClock) return;
  focusClock.style.transform = "translate(-50%, -100%) scale(" + clockUiScale + ")";
}

function applyLowerFogStyle() {
  lowerFogMaterial.uniforms.uMaxAlpha.value = lowerFogOpacity;
  lowerFogMaterial.uniforms.uColor.value.set(lowerFogColorHex);
}

function updateClockUi() {
  const now = getKstDate();
  const hours24 = now.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const ampm = hours24 < 12 ? "AM" : "PM";

  if (focusClockTimeField) {
    focusClockTimeField.textContent = String(hours12).padStart(2, "0") + ":" + minutes;
  }
  if (focusClockAmPmField) {
    focusClockAmPmField.textContent = ampm;
  }

  if (!focusClock) return;
  const chicken = focusState.currentChicken || chickens[0] || null;
  if (!chicken || !chicken.root) {
    focusClock.style.display = "none";
    return;
  }

  const markerWorld = chicken.root.position.clone();
  markerWorld.y += Math.max(3.2, chickenScale * 1.8) + focusLiftOffset;
  const projected = markerWorld.project(camera);

  const isVisible = projected.z >= -1 && projected.z <= 1;
  if (!isVisible) {
    focusClock.style.display = "none";
    return;
  }

  const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const screenY = (-projected.y * 0.5 + 0.5) * window.innerHeight;

  const margin = 24;
  const clampedX = THREE.MathUtils.clamp(screenX, margin, window.innerWidth - margin);
  const clampedY = THREE.MathUtils.clamp(screenY + focusScreenYOffset + markerArrowYOffset - 10, margin, window.innerHeight - margin);

  focusClock.style.display = "block";
  focusClock.style.left = clampedX.toFixed(2) + "px";
  focusClock.style.top = clampedY.toFixed(2) + "px";
}

function applyCameraPose(data) {
  if (typeof data.fov === "number") {
    perspectiveCamera.fov = data.fov;
  }
  const mode = data.mode === "perspective" ? "perspective" : "orthographic";
  cameraMode = mode;
  camera = mode === "orthographic" ? orthographicCamera : perspectiveCamera;
  controls.object = camera;
  if (Array.isArray(data.position)) {
    perspectiveCamera.position.fromArray(data.position);
    orthographicCamera.position.fromArray(data.position);
  }
  if (Array.isArray(data.target)) {
    controls.target.fromArray(data.target);
  }
  syncCameraUi();
  updateCameraProjection();
  controls.update();
}

function loadAssets() {
  const loader = new GLTFLoader();
  const objLoader = new OBJLoader();
  new RGBELoader().load(
    HDRI_PATH,
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      scene.background = null;
      skyDome.material.map = texture;
      skyDome.material.needsUpdate = true;
      skyDome.visible = true;
      pmremGenerator.dispose();
    },
    undefined,
    (error) => {
      console.error("HDRI load failed", error);
      scene.background = new THREE.Color(0xe9eef8);
      skyDome.visible = false;
    }
  );
  objLoader.load(
    ROCK_MODEL_PATH,
    (object) => {
      rockTemplate = object;
      applyRockMaterials(rockTemplate);
      normalizePivotBottomCenter(rockTemplate);
      rockTemplate.updateMatrixWorld(true);
      const rockBounds = new THREE.Box3().setFromObject(rockTemplate);
      rockBounds.getSize(rockTemplateSize);
      rockTopSurfaceY = Math.max(rockBounds.max.y, 0);
      tryBuildScene();
    },
    undefined,
    (error) => {
      console.error("rock.obj load failed", error);
    }
  );
  objLoader.load(
    STAIR_MODEL_PATH,
    (object) => {
      stairTemplate = object;
      applyStairMaterials(stairTemplate);
      normalizePivotBottomCenter(stairTemplate);
      stairTemplate.updateMatrixWorld(true);
      const stairBounds = new THREE.Box3().setFromObject(stairTemplate);
      stairBounds.getSize(stairTemplateSize);
      stairTemplateSize.x = Math.max(stairTemplateSize.x, 0.001);
      stairTemplateSize.y = Math.max(stairTemplateSize.y, 0.001);
      stairTemplateSize.z = Math.max(stairTemplateSize.z, 0.001);
      tryBuildScene();
    },
    undefined,
    (error) => {
      console.error("stair_rock.obj load failed", error);
    }
  );
  loader.load(
    CHICKEN_MODEL_PATH,
    (gltf) => {
      chickenTemplate = gltf.scene;
      chickenAnimations = gltf.animations;
      tryBuildScene();
    },
    undefined,
    (error) => {
      console.error("chicken.glb load failed", error);
    }
  );
}

function tryBuildScene() {
  if (!rockTemplate || !stairTemplate || !chickenTemplate || sceneBuilt) return;
  sceneBuilt = true;
  regenerateFullMap();
}

function regenerateFullMap() {
  if (!sceneBuilt) return;
  generateMapData();
  rebuildVisualMap(true);
}

function generateMapData() {
  cells.length = 0;
  cellMap.clear();
  graph.clear();
  routeMap.clear();

  const offset = (gridSize - 1) * cellSpacing * 0.5;
  for (let gz = 0; gz < gridSize; gz++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const id = `${gx},${gz}`;
      const cell = {
        id,
        gx,
        gz,
        x: gx * cellSpacing - offset,
        z: gz * cellSpacing - offset,
        levelCount: randInt(HEIGHT_LEVEL_MIN, pillarLevelMax),
        topY: 0
      };
      cells.push(cell);
      cellMap.set(id, cell);
      graph.set(id, []);
    }
  }

  updateCellHeights();

  const visited = new Set();
  const stack = [cells[Math.floor(Math.random() * cells.length)]];
  visited.add(stack[0].id);

  while (stack.length) {
    const current = stack[stack.length - 1];
    const unvisitedNeighbors = getAdjacentCells(current).filter((neighbor) => !visited.has(neighbor.id));
    if (!unvisitedNeighbors.length) {
      stack.pop();
      continue;
    }
    shuffleInPlace(unvisitedNeighbors);
    const next = unvisitedNeighbors.find((neighbor) => degreeOf(current.id) < MAX_NODE_DEGREE && degreeOf(neighbor.id) < MAX_NODE_DEGREE) || unvisitedNeighbors[0];
    connectCells(current.id, next.id);
    visited.add(next.id);
    stack.push(next);
  }

  const neighborPairs = [];
  for (const cell of cells) {
    for (const neighbor of getAdjacentCells(cell)) {
      if (cell.id < neighbor.id) {
        neighborPairs.push([cell, neighbor]);
      }
    }
  }
  shuffleInPlace(neighborPairs);

  for (const [a, b] of neighborPairs) {
    if (hasConnection(a.id, b.id)) continue;
    if (degreeOf(a.id) >= MAX_NODE_DEGREE || degreeOf(b.id) >= MAX_NODE_DEGREE) continue;
    if (Math.random() < EXTRA_CONNECTION_CHANCE) {
      connectCells(a.id, b.id);
    }
  }

  for (const cell of cells) {
    if (degreeOf(cell.id) === 1) {
      const options = getAdjacentCells(cell).filter((neighbor) => !hasConnection(cell.id, neighbor.id) && degreeOf(neighbor.id) < MAX_NODE_DEGREE);
      if (options.length && Math.random() < 0.5) {
        connectCells(cell.id, options[Math.floor(Math.random() * options.length)].id);
      }
    }
  }

  buildRoutes();
}

function updateCellHeights() {
  for (const cell of cells) {
    cell.topY = rockTopSurfaceY + (cell.levelCount - 1) * pillarVerticalGap;
  }
}

function getAdjacentCells(cell) {
  const out = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];
  for (const [dx, dz] of dirs) {
    const neighbor = cellMap.get(`${cell.gx + dx},${cell.gz + dz}`);
    if (neighbor) out.push(neighbor);
  }
  return out;
}

function degreeOf(id) {
  return graph.get(id)?.length ?? 0;
}

function hasConnection(aId, bId) {
  return graph.get(aId)?.includes(bId);
}

function connectCells(aId, bId) {
  if (hasConnection(aId, bId)) return;
  graph.get(aId).push(bId);
  graph.get(bId).push(aId);
}

function buildRoutes() {
  routeMap.clear();
}

function createStairPathPoints(fromCell, toCell) {
  const start = new THREE.Vector3(fromCell.x, fromCell.topY + routePillarTopYOffset + ROUTE_SURFACE_LIFT, fromCell.z);
  const end = new THREE.Vector3(toCell.x, toCell.topY + routePillarTopYOffset + ROUTE_SURFACE_LIFT, toCell.z);
  const horizontal = new THREE.Vector3(toCell.x - fromCell.x, 0, toCell.z - fromCell.z);
  const dir = horizontal.clone().normalize();
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  const edgeInset = Math.min(Math.max(stairStartInset, 0), PLATFORM_SIZE * 0.5) + routeOffsetX;
  const lateralOffset = stairOffsetZ + routeOffsetZ;
  const edgeStart = start.clone().add(dir.clone().multiplyScalar(edgeInset)).add(right.clone().multiplyScalar(lateralOffset));
  const edgeEnd = end.clone().add(dir.clone().multiplyScalar(-edgeInset)).add(right.clone().multiplyScalar(lateralOffset));
  const startSurfaceY = fromCell.topY + stairSurfaceYOffset + routeOffsetY + ROUTE_SURFACE_LIFT;
  const endSurfaceY = toCell.topY + stairSurfaceYOffset + routeOffsetY + ROUTE_SURFACE_LIFT;
  const rise = endSurfaceY - startSurfaceY;
  const stepCount = Math.max(2, stairStepCount);
  const points = [start.clone(), new THREE.Vector3(edgeStart.x, startSurfaceY, edgeStart.z)];

  if (Math.abs(rise) < 0.01) {
    points.push(new THREE.Vector3(edgeEnd.x, startSurfaceY, edgeEnd.z));
    points.push(new THREE.Vector3(end.x, startSurfaceY, end.z));
    return points;
  }

  const stepCenters = [];
  for (let i = 0; i < stepCount; i++) {
    const topY = startSurfaceY + rise * ((i + 1) / stepCount);
    const center = edgeStart.clone().lerp(edgeEnd, (i + 0.5) / stepCount);
    center.y = topY;
    stepCenters.push(center);
  }

  const firstCenter = stepCenters[0];
  points.push(new THREE.Vector3(edgeStart.x, firstCenter.y, edgeStart.z));
  points.push(firstCenter.clone());

  for (let i = 1; i < stepCenters.length; i++) {
    const prev = stepCenters[i - 1];
    const current = stepCenters[i];
    points.push(new THREE.Vector3(prev.x, current.y, prev.z));
    points.push(current.clone());
  }

  const lastCenter = stepCenters[stepCenters.length - 1];
  points.push(new THREE.Vector3(edgeEnd.x, lastCenter.y, edgeEnd.z));
  points.push(new THREE.Vector3(end.x, lastCenter.y, end.z));
  return points;
}

function createRoutePoints(fromCell, toCell) {
  return createStairPathPoints(fromCell, toCell);
}

function rebuildVisualMap(respawnChickens) {
  if (!rockTemplate || !stairTemplate || !chickenTemplate) return;
  updateCellHeights();
  buildRoutes();
  clearGroup(stairGroup);
  clearGroup(pillarGroup);
  clearGroup(routeLineGroup);
  if (respawnChickens) {
    clearChickens();
  }
  updateGroundScale();
  buildMapScene();
  if (SHOW_ROUTE_LINES) buildRouteLines();
  if (respawnChickens) {
    spawnChickens();
  } else {
    respawnChickenRoutes();
  }
  resetCameraFocus();
  syncCameraUi();
}

function updateGroundScale() {
  const size = Math.max(120, gridSize * cellSpacing * 1.3);
  ground.scale.set(size, size, 1);
  updateLowerFogVolume(size);
}

function updateLowerFogVolume(size) {
  const fogHeight = THREE.MathUtils.clamp(getAverageTopHeight() * 0.58, 28, 72);
  lowerFogVolume.scale.set(size * 0.9, fogHeight, size * 0.9);
  lowerFogVolume.position.y = fogHeight * 0.5;
  lowerFogMaterial.uniforms.uHeight.value = fogHeight;
}

function buildRouteLines() {
  const material = new THREE.LineBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.82 });
  const builtEdges = new Set();
  for (const [key, points] of routeMap.entries()) {
    const parts = key.split("->");
    const fromId = parts[0];
    const toId = parts[1];
    const edgeKey = [fromId, toId].sort().join("|");
    if (builtEdges.has(edgeKey) || !points.length) continue;
    builtEdges.add(edgeKey);
    const raisedPoints = points.map((point) => point.clone().add(new THREE.Vector3(0, ROUTE_LINE_LIFT, 0)));
    const geometry = new THREE.BufferGeometry().setFromPoints(raisedPoints);
    const line = new THREE.Line(geometry, material);
    routeLineGroup.add(line);
  }
}

function buildMapScene() {
  for (const cell of cells) {
    const pillar = createRockPillar(cell);
    pillarGroup.add(pillar);
  }

  const builtEdges = new Set();
  for (const [fromId, neighbors] of graph.entries()) {
    for (const toId of neighbors) {
      const edgeKey = [fromId, toId].sort().join("|");
      if (builtEdges.has(edgeKey)) continue;
      builtEdges.add(edgeKey);
      buildStairBetween(cellMap.get(fromId), cellMap.get(toId));
    }
  }
}

function createRockPillar(cell) {
  const group = new THREE.Group();
  group.position.set(cell.x, 0, cell.z);
  for (let i = 0; i < cell.levelCount; i++) {
    const rock = createPillarRock(i);
    rock.position.y = i * pillarVerticalGap;
    group.add(rock);
  }
  return group;
}

function createPillarRock(index) {
  const rock = rockTemplate.clone(true);
  rock.userData.levelIndex = index;
  rock.userData.randomFactor = randomScaleMin + Math.random() * (1 - randomScaleMin);
  rock.userData.rotationStrength = THREE.MathUtils.lerp(0.72, 1, Math.random());
  rock.userData.noiseFactors = [Math.random() * 2 - 1, Math.random() * 2 - 1];
  applySingleRockTransform(rock);
  rock.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
  return rock;
}

function reseedPillarRocks() {
  pillarGroup.traverse((obj) => {
    if (!obj.userData || obj.userData.levelIndex == null) return;
    obj.userData.randomFactor = randomScaleMin + Math.random() * (1 - randomScaleMin);
    obj.userData.rotationStrength = THREE.MathUtils.lerp(0.72, 1, Math.random());
    obj.userData.noiseFactors = [Math.random() * 2 - 1, Math.random() * 2 - 1];
  });
}

function applyPillarTransforms() {
  pillarGroup.traverse((obj) => {
    if (!obj.userData || obj.userData.levelIndex == null) return;
    applySingleRockTransform(obj);
  });
}

function applySingleRockTransform(rock) {
  const randomFactor = rock.userData.randomFactor ?? 1;
  const rotationStrength = rock.userData.rotationStrength ?? 1;
  const noiseFactors = rock.userData.noiseFactors ?? [0, 0];
  const direction = (rock.userData.levelIndex ?? 0) % 2 === 0 ? 1 : -1;
  const rotationDeg = direction * pillarRotationMaxDeg * rotationStrength;
  rock.scale.setScalar(globalRockScale * randomFactor);
  rock.rotation.set(0, THREE.MathUtils.degToRad(rotationDeg), 0);
  rock.position.x = pillarNoiseAmount * noiseFactors[0];
  rock.position.z = pillarNoiseAmount * noiseFactors[1];
}

function buildStairBetween(cellA, cellB) {
  const pathPoints = createStairPathPoints(cellA, cellB);
  routeMap.set(`${cellA.id}->${cellB.id}`, pathPoints.map((point) => point.clone()));
  routeMap.set(`${cellB.id}->${cellA.id}`, pathPoints.map((point) => point.clone()).reverse());
  const start = new THREE.Vector3(cellA.x, cellA.topY, cellA.z);
  const end = new THREE.Vector3(cellB.x, cellB.topY, cellB.z);
  const horizontal = new THREE.Vector3(cellB.x - cellA.x, 0, cellB.z - cellA.z);
  const dir = horizontal.clone().normalize();
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  const edgeInset = Math.min(Math.max(stairStartInset, 0), PLATFORM_SIZE * 0.5);
  const edgeA = start.clone().add(dir.clone().multiplyScalar(edgeInset)).add(right.clone().multiplyScalar(stairOffsetZ));
  const edgeB = end.clone().add(dir.clone().multiplyScalar(-edgeInset)).add(right.clone().multiplyScalar(stairOffsetZ));
  const runLength = edgeA.distanceTo(edgeB);
  const startSurfaceY = cellA.topY + stairSurfaceYOffset;
  const endSurfaceY = cellB.topY + stairSurfaceYOffset;
  const rise = endSurfaceY - startSurfaceY;
  const treadThickness = stairStepHeight;

  if (Math.abs(rise) < 0.01) {
    const bridge = createStairInstance(STAIR_WIDTH, treadThickness, runLength + 0.2);
    bridge.position.copy(edgeA.clone().lerp(edgeB, 0.5));
    bridge.position.y = startSurfaceY - treadThickness;
    alignAlongDirection(bridge, dir);
    stairGroup.add(bridge);
    return;
  }

  const stepCount = Math.max(2, stairStepCount);
  const depth = runLength / stepCount + 0.08;

  for (let i = 0; i < stepCount; i++) {
    const nextTop = startSurfaceY + rise * ((i + 1) / stepCount);
    const center = edgeA.clone().lerp(edgeB, (i + 0.5) / stepCount);
    const step = createStairInstance(STAIR_WIDTH, treadThickness, depth);
    step.position.copy(center);
    step.position.y = nextTop - treadThickness;
    alignAlongDirection(step, dir);
    stairGroup.add(step);
  }
}

function createStairInstance(targetWidth, targetHeight, targetDepth) {
  const stair = stairTemplate.clone(true);
  const flipY = Math.random() < 0.5 ? -1 : 1;
  const randomYDeg = THREE.MathUtils.lerp(-stairNoiseAmountDeg, stairNoiseAmountDeg, Math.random());
  stair.userData.randomYaw = THREE.MathUtils.degToRad(randomYDeg);
  stair.scale.set(
    targetWidth / stairTemplateSize.x,
    (targetHeight / stairTemplateSize.y) * flipY,
    targetDepth / stairTemplateSize.z
  );
  if (flipY < 0) {
    stair.position.y += targetHeight;
  }
  stair.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return stair;
}

function alignAlongDirection(object, dir) {
  const baseYaw = Math.atan2(dir.x, dir.z);
  const randomYaw = object.userData.randomYaw ?? 0;
  object.rotation.y = baseYaw + randomYaw;
}

function applyRockMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.material = new THREE.MeshStandardMaterial({
      map: sharedMaps.map,
      normalMap: sharedMaps.normalMap,
      roughnessMap: sharedMaps.roughnessMap,
      roughness: 1,
      metalness: 0
    });
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function applyStairMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.material = new THREE.MeshStandardMaterial({
      map: stairMaps.map,
      normalMap: stairMaps.normalMap,
      roughnessMap: stairMaps.roughnessMap,
      roughness: 1,
      metalness: 0
    });
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function normalizePivotBottomCenter(root) {
  root.updateMatrixWorld(true);
  const bbox = new THREE.Box3().setFromObject(root);
  const center = bbox.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= bbox.min.y;
  root.updateMatrixWorld(true);
}

function spawnChickens() {
  const walkClip = findClip(/walking/i) || chickenAnimations[0];
  const sitClip = findClip(/sitting|sit/i);
  const clockClip = findClip(/^clock$/i) || findClip(/clock/i);
  const danceClips = chickenAnimations.filter((clip) => /dance|breakdance/i.test(clip.name));
  const strechClips = chickenAnimations.filter((clip) => /strech/i.test(clip.name) && !/del/i.test(clip.name));

  for (let i = 0; i < chickenCount; i++) {
    const root = new THREE.Group();
    const chicken = SkeletonUtils.clone(chickenTemplate);
    applyChickenBonePivot(chicken);
    chicken.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(CHICKEN_SHADOW_PLANE_SIZE.x, CHICKEN_SHADOW_PLANE_SIZE.z),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.22 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.04;
    shadowPlane.receiveShadow = true;
    shadowPlane.castShadow = false;
    root.add(shadowPlane);
    root.add(chicken);
    chicken.position.y += chickenPivotYOffset;
    root.scale.setScalar(chickenScale);
    chickenGroup.add(root);

    const mixer = new THREE.AnimationMixer(chicken);
    const actions = new Map();
    for (const clip of chickenAnimations) {
      actions.set(clip.name, mixer.clipAction(clip));
    }

    const watchHands = getWatchHands(chicken);
    const startCell = cells[Math.floor(Math.random() * cells.length)];
    root.position.set(startCell.x, startCell.topY, startCell.z);

    const chickenState = {
      root,
      model: chicken,
      mixer,
      actions,
      walkClip,
      sitClip,
      clockClip,
      danceClips,
      strechClips,
      currentCellId: startCell.id,
      previousCellId: null,
      targetCellId: null,
      routePoints: [],
      routeIndex: 0,
      progressOnSegment: 0,
      speed: 0,
      activeAction: null,
      mode: "walk",
      actionTimeLeft: 0,
      watchHands,
      scheduledMode: "walk",
      scheduledWindowEndMs: null,
      spawnIndex: i,
      sitPhase: null,
      sitHoldTimeLeft: 0,
      collisionCooldown: 0,
      manualOverrideMode: null,
      manualOverrideTimeLeft: 0,
      baseSpeed: THREE.MathUtils.lerp(3.1, 4.1, Math.random())
    };

    chickenState.speed = chickenState.baseSpeed;
    playLoop(chickenState, walkClip?.name);
    pickNextRoute(chickenState);
    syncChickenClock(chickenState);
    chickens.push(chickenState);
  }
}

function applyChickenBonePivot(modelRoot) {
  modelRoot.updateMatrixWorld(true);
  const hips = findFirstByRegex(modelRoot, /hips/i);
  if (!hips) {
    normalizePivotBottomCenter(modelRoot);
    modelRoot.userData.basePivotY = modelRoot.position.y;
    return;
  }
  const hipsPos = new THREE.Vector3();
  hips.getWorldPosition(hipsPos);
  modelRoot.position.sub(hipsPos);
  modelRoot.userData.basePivotY = modelRoot.position.y;
  modelRoot.updateMatrixWorld(true);
}

function getWatchHands(modelRoot) {
  const hour = findFirstByRegex(modelRoot, /^hour$/i);
  const minute = findFirstByRegex(modelRoot, /^(min|minit)$/i);
  const hands = {};
  if (hour) {
    hands.hour = hour;
    hands.hourBaseEuler = hour.rotation.clone();
  }
  if (minute) {
    hands.minute = minute;
    hands.minuteBaseEuler = minute.rotation.clone();
  }
  return hands;
}

function syncChickenClock(chicken) {
  const hands = chicken.watchHands;
  if (!hands) return;
  const now = getKstDate();
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  const minuteAngle = (minutes / 60) * Math.PI * 2;
  const hourAngle = (hours / 12) * Math.PI * 2;

  if (hands.minute && hands.minuteBaseEuler) {
    hands.minute.rotation.set(
      hands.minuteBaseEuler.x,
      hands.minuteBaseEuler.y,
      hands.minuteBaseEuler.z + minuteAngle,
      hands.minuteBaseEuler.order
    );
  }
  if (hands.hour && hands.hourBaseEuler) {
    hands.hour.rotation.set(
      hands.hourBaseEuler.x,
      hands.hourBaseEuler.y,
      hands.hourBaseEuler.z+ hourAngle,
      hands.hourBaseEuler.order
    );
  }
}

function getKstDate() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 9 * 60 * 60 * 1000);
}

function findFirstByRegex(root, regex) {
  let found = null;
  root.traverse((obj) => {
    if (!found && obj.name && regex.test(obj.name)) {
      found = obj;
    }
  });
  return found;
}

function clearChickens() {
  while (chickens.length) {
    const chicken = chickens.pop();
    chickenGroup.remove(chicken.root);
  }
  clearGroup(chickenGroup);
}

function getMsOfDayKst(date) {
  return (((date.getHours() * 60) + date.getMinutes()) * 60 + date.getSeconds()) * 1000 + date.getMilliseconds();
}

function getWindowMs(hours, minutes) {
  return (hours * 60 + minutes) * 60 * 1000;
}

function getScheduledBehavior(now) {
  const ms = getMsOfDayKst(now);

  for (const [hour, minute] of DAILY_DANCE_POINTS) {
    const start = getWindowMs(hour, minute);
    const end = start + SCHEDULE_ACTION_MS;
    if (ms >= start && ms < end) {
      return { mode: "dance", windowEndMs: end };
    }
  }

  for (const [startHour, startMinute, endHour, endMinute] of DAILY_STRETCH_WINDOWS) {
    const start = getWindowMs(startHour, startMinute);
    const end = getWindowMs(endHour, endMinute);
    if (ms < start || ms >= end) continue;
    if (ms >= end - SCHEDULE_ACTION_MS) {
      return { mode: "dance", windowEndMs: end };
    }
    const cycleMs = (ms - start) % SCHEDULE_CYCLE_MS;
    if (cycleMs < SCHEDULE_WALK_MS) {
      return { mode: "walk", windowEndMs: start + Math.floor((ms - start) / SCHEDULE_CYCLE_MS) * SCHEDULE_CYCLE_MS + SCHEDULE_WALK_MS };
    }
    return { mode: "stretch", windowEndMs: start + Math.floor((ms - start) / SCHEDULE_CYCLE_MS) * SCHEDULE_CYCLE_MS + SCHEDULE_CYCLE_MS };
  }

  return { mode: "walk", windowEndMs: null };
}

function pickScheduledClip(chicken, type) {
  const list = type === "dance" ? chicken.danceClips : chicken.strechClips;
  if (!list.length) return 0;
  const clip = list[Math.floor(Math.random() * list.length)];
  const duration = playOnce(chicken, clip.name);
  chicken.mode = type;
  chicken.actionTimeLeft = Math.max(0.1, duration / Math.max(chickenAnimSpeed, 0.0001));
  return chicken.actionTimeLeft;
}

function applyScheduledBehavior(chicken, now) {
  const schedule = getScheduledBehavior(now);
  const ms = getMsOfDayKst(now);
  chicken.scheduledMode = schedule.mode;
  chicken.scheduledWindowEndMs = schedule.windowEndMs;

  if (chicken.mode === "sit_collision") {
    return;
  }

  if (chicken.manualOverrideMode) {
    return;
  }

  if (schedule.mode === "walk") {
    if (chicken.mode !== "walk") {
      resumeWalking(chicken);
    }
    return;
  }

  if (chicken.mode !== schedule.mode) {
    pickScheduledClip(chicken, schedule.mode);
    return;
  }

  if (ms >= (schedule.windowEndMs ?? ms)) {
    resumeWalking(chicken);
    return;
  }

  if (chicken.actionTimeLeft <= 0) {
    pickScheduledClip(chicken, schedule.mode);
  }
}

function applyChickenScale() {
  for (const chicken of chickens) {
    chicken.root.scale.setScalar(chickenScale);
  }
}

function applyChickenAnimationSpeed() {
  for (const chicken of chickens) {
    chicken.mixer.timeScale = chickenAnimSpeed;
    chicken.speed = chicken.baseSpeed * chickenAnimSpeed;
  }
}

function applyChickenPivotOffset() {
  for (const chicken of chickens) {
    const basePivotY = chicken.model.userData.basePivotY ?? chicken.model.position.y;
    chicken.model.position.y = basePivotY + chickenPivotYOffset;
  }
}

function resetCameraFocus() {
  focusState.active = chickens.length > 0;
  focusState.currentChicken = null;
  focusState.holdTimer = 0;
  focusState.nextSwitchIn = 0;
  focusState.elapsed = focusState.duration;
  controls.target.set(0, getAverageTopHeight() * 0.5 + focusTargetYOffset, 0);
}

function chooseNextChickenFocus() {
  if (!chickens.length) return;
  const candidates = chickens.filter((chicken) => chicken !== focusState.currentChicken);
  const next = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : chickens[0];
  if (!next) return;

  const target = next.root.position.clone();
  const targetLift = Math.max(2.8, chickenScale * 1.5) + focusLiftOffset;
  target.y += targetLift + focusTargetYOffset;

  const structureCenter = new THREE.Vector3(0, getAverageTopHeight() * 0.4, 0);
  const outward = target.clone().sub(structureCenter);
  outward.y = 0;
  if (outward.lengthSq() < 0.0001) {
    outward.set(1, 0, 0);
  } else {
    outward.normalize();
  }

  const distance = THREE.MathUtils.lerp(focusDistanceMin, focusDistanceMax, Math.random());
  const heightOffset = THREE.MathUtils.lerp(34, 56, Math.random());
  const sideOffset = new THREE.Vector3(-outward.z, 0, outward.x).multiplyScalar(THREE.MathUtils.lerp(-4, 4, Math.random()));
  const cameraPos = target.clone()
    .add(outward.multiplyScalar(distance))
    .add(sideOffset)
    .add(new THREE.Vector3(0, heightOffset, 0));
  const cameraOffset = cameraPos.clone().sub(target);

  focusState.currentChicken = next;
  focusState.fromPosition.copy(camera.position);
  focusState.toPosition.copy(cameraPos);
  focusState.fromTarget.copy(controls.target);
  focusState.toTarget.copy(target);
  focusState.cameraOffset.copy(cameraOffset);
  focusState.targetLift = targetLift;
  focusState.elapsed = 0;
  focusState.duration = THREE.MathUtils.lerp(1.4, 2.4, Math.random());
  focusState.holdTimer = 0;
  focusState.nextSwitchIn = THREE.MathUtils.lerp(7, 15, Math.random());
  focusState.fromOrthoZoom = orthographicCamera.zoom;
  focusState.toOrthoZoom = THREE.MathUtils.lerp(orthoZoomMin, orthoZoomMax, Math.random());
  focusState.fromPerspectiveFov = perspectiveCamera.fov;
  focusState.toPerspectiveFov = THREE.MathUtils.lerp(24, 52, Math.random());
}

function updateCameraFocus(delta) {
  if (!focusState.active || !chickens.length) return;

  if (!focusState.currentChicken) {
    chooseNextChickenFocus();
  }

  if (focusState.elapsed < focusState.duration) {
    focusState.elapsed = Math.min(focusState.elapsed + delta, focusState.duration);
    const t = focusState.duration <= 0 ? 1 : focusState.elapsed / focusState.duration;
    const eased = t * t * (3 - 2 * t);
    camera.position.lerpVectors(focusState.fromPosition, focusState.toPosition, eased);
    controls.target.lerpVectors(focusState.fromTarget, focusState.toTarget, eased);

    if (cameraMode === "orthographic") {
      orthographicCamera.zoom = THREE.MathUtils.lerp(focusState.fromOrthoZoom, focusState.toOrthoZoom, eased);
      orthographicCamera.updateProjectionMatrix();
    } else {
      perspectiveCamera.fov = THREE.MathUtils.lerp(focusState.fromPerspectiveFov, focusState.toPerspectiveFov, eased);
      perspectiveCamera.updateProjectionMatrix();
    }
    return;
  }

  const trackedTarget = focusState.currentChicken.root.position.clone();
  trackedTarget.y += focusState.targetLift + focusTargetYOffset;
  const trackedCameraPos = trackedTarget.clone().add(focusState.cameraOffset);
  camera.position.lerp(trackedCameraPos, 1 - Math.exp(-delta * 4));
  controls.target.lerp(trackedTarget, 1 - Math.exp(-delta * 5));

  focusState.holdTimer += delta;
  if (focusState.holdTimer >= focusState.nextSwitchIn) {
    focusState.fromPosition.copy(camera.position);
    focusState.fromTarget.copy(controls.target);
    chooseNextChickenFocus();
  }
}

function respawnChickenRoutes() {
  clearChickens();
  spawnChickens();
}

function findClip(regex) {
  return chickenAnimations.find((clip) => regex.test(clip.name)) || null;
}

function stopClockAction(chicken) {
  if (!chicken.clockClip || !chicken.actions.has(chicken.clockClip.name)) return;
  const clockAction = chicken.actions.get(chicken.clockClip.name);
  clockAction.stop();
  clockAction.enabled = true;
  clockAction.timeScale = 1;
  clockAction.time = 0;
  clockAction.paused = true;
}

function playClockAction(chicken, reverse = false) {
  if (!chicken.clockClip || !chicken.actions.has(chicken.clockClip.name)) return 0;
  const action = chicken.actions.get(chicken.clockClip.name);
  action.reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.paused = false;
  action.enabled = true;
  if (reverse) {
    action.time = action.getClip().duration;
    action.timeScale = -CHICKEN_SIT_PLAYBACK_SPEED;
  } else {
    action.time = 0;
    action.timeScale = CHICKEN_SIT_PLAYBACK_SPEED;
  }
  action.play();
  return action.getClip().duration / CHICKEN_SIT_PLAYBACK_SPEED;
}

function playLoop(chicken, clipName) {
  if (!clipName || !chicken.actions.has(clipName)) return;
  stopClockAction(chicken);
  const action = chicken.actions.get(clipName);
  if (chicken.activeAction === action) return;
  for (const existing of chicken.actions.values()) {
    if (existing === action) continue;
    if (chicken.clockClip && existing === chicken.actions.get(chicken.clockClip.name)) continue;
    existing.fadeOut(0.18);
  }
  action.reset();
  action.timeScale = 1;
  action.paused = false;
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.clampWhenFinished = false;
  action.fadeIn(0.18).play();
  chicken.activeAction = action;
}

function playOnce(chicken, clipName) {
  if (!clipName || !chicken.actions.has(clipName)) return 0;
  stopClockAction(chicken);
  const action = chicken.actions.get(clipName);
  for (const existing of chicken.actions.values()) {
    if (existing === action) continue;
    if (chicken.clockClip && existing === chicken.actions.get(chicken.clockClip.name)) continue;
    existing.fadeOut(0.16);
  }
  action.reset();
  action.timeScale = 1;
  action.paused = false;
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.fadeIn(0.16).play();
  chicken.activeAction = action;
  return action.getClip().duration;
}

function playReverseOnce(chicken, clipName) {
  if (!clipName || !chicken.actions.has(clipName)) return 0;
  stopClockAction(chicken);
  const action = chicken.actions.get(clipName);
  for (const existing of chicken.actions.values()) {
    if (existing === action) continue;
    if (chicken.clockClip && existing === chicken.actions.get(chicken.clockClip.name)) continue;
    existing.fadeOut(0.16);
  }
  action.reset();
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.enabled = true;
  action.paused = false;
  action.time = action.getClip().duration;
  action.timeScale = -CHICKEN_SIT_PLAYBACK_SPEED;
  action.fadeIn(0.16).play();
  chicken.activeAction = action;
  return action.getClip().duration / CHICKEN_SIT_PLAYBACK_SPEED;
}

function startCollisionSit(chicken) {
  if (!chicken.sitClip) return;
  const sitAction = chicken.actions.get(chicken.sitClip.name);
  if (!sitAction) return;
  stopClockAction(chicken);
  for (const existing of chicken.actions.values()) {
    if (existing === sitAction) continue;
    if (chicken.clockClip && existing === chicken.actions.get(chicken.clockClip.name)) continue;
    existing.fadeOut(0.16);
  }
  sitAction.reset();
  sitAction.setLoop(THREE.LoopOnce, 1);
  sitAction.clampWhenFinished = true;
  sitAction.enabled = true;
  sitAction.paused = false;
  sitAction.time = 0;
  sitAction.timeScale = CHICKEN_SIT_PLAYBACK_SPEED;
  sitAction.fadeIn(0.16).play();
  chicken.activeAction = sitAction;
  const sitDuration = sitAction.getClip().duration / CHICKEN_SIT_PLAYBACK_SPEED;
  playClockAction(chicken, false);
  chicken.mode = "sit_collision";
  chicken.sitPhase = "down";
  chicken.actionTimeLeft = Math.max(0.1, sitDuration);
  chicken.sitHoldTimeLeft = CHICKEN_SIT_HOLD_SECONDS;
  chicken.speed = 0;
  chicken.collisionCooldown = CHICKEN_COLLISION_COOLDOWN;
}

function triggerCollisionSitIfNeeded() {
  for (let i = 0; i < chickens.length; i++) {
    const a = chickens[i];
    if (a.mode !== "walk" || a.scheduledMode !== "walk" || a.collisionCooldown > 0) continue;
    for (let j = i + 1; j < chickens.length; j++) {
      const b = chickens[j];
      if (b.mode !== "walk" || b.scheduledMode !== "walk" || b.collisionCooldown > 0) continue;
      if (a.root.position.distanceTo(b.root.position) > CHICKEN_COLLISION_DISTANCE) continue;
      const sitter = a.spawnIndex <= b.spawnIndex ? a : b;
      startCollisionSit(sitter);
      return;
    }
  }
}

function triggerGroupAction(type) {
  for (const chicken of chickens) {
    const list = type === "dance" ? chicken.danceClips : chicken.strechClips;
    if (!list.length) continue;
    const clip = list[Math.floor(Math.random() * list.length)];
    const duration = playOnce(chicken, clip.name);
    chicken.mode = type;
    chicken.sitPhase = null;
    chicken.actionTimeLeft = Math.max(0.1, duration / Math.max(chickenAnimSpeed, 0.0001));
    chicken.manualOverrideMode = type;
    chicken.manualOverrideTimeLeft = chicken.actionTimeLeft;
    chicken.speed = 0;
    chicken.routePoints = [];
    chicken.routeIndex = 0;
    chicken.progressOnSegment = 0;
  }
}

function resumeWalking(chicken) {
  chicken.mode = "walk";
  chicken.sitPhase = null;
  chicken.actionTimeLeft = 0;
  chicken.sitHoldTimeLeft = 0;
  chicken.manualOverrideMode = null;
  chicken.manualOverrideTimeLeft = 0;
  playLoop(chicken, chicken.walkClip?.name);
  if (!chicken.routePoints.length) {
    pickNextRoute(chicken);
  }
}

function pickNextRoute(chicken) {
  const neighbors = graph.get(chicken.currentCellId) || [];
  if (!neighbors.length) return;

  const weighted = neighbors.map((neighborId) => ({
    neighborId,
    weight: neighborId === chicken.previousCellId && neighbors.length > 1 ? 0.2 : 1
  }));

  let sum = 0;
  for (const item of weighted) sum += item.weight;
  let pick = Math.random() * sum;
  let chosen = weighted[weighted.length - 1].neighborId;
  for (const item of weighted) {
    pick -= item.weight;
    if (pick <= 0) {
      chosen = item.neighborId;
      break;
    }
  }

  chicken.targetCellId = chosen;
  chicken.routePoints = (routeMap.get(`${chicken.currentCellId}->${chosen}`) || []).map((point) => point.clone());
  chicken.routeIndex = 0;
  chicken.progressOnSegment = 0;
}

function updateChicken(chicken, delta) {
  const now = getKstDate();
  chicken.collisionCooldown = Math.max(0, chicken.collisionCooldown - delta);
  applyScheduledBehavior(chicken, now);
  chicken.mixer.timeScale = chickenAnimSpeed;
  chicken.speed = chicken.baseSpeed * chickenAnimSpeed;
  chicken.mixer.update(delta);
  syncChickenClock(chicken);

  if (chicken.mode === "sit_collision") {
    if (chicken.sitPhase === "down") {
      chicken.actionTimeLeft -= delta;
      if (chicken.actionTimeLeft <= 0) {
        chicken.sitPhase = "hold";
        chicken.actionTimeLeft = 0;
      }
      return;
    }
    if (chicken.sitPhase === "hold") {
      chicken.sitHoldTimeLeft -= delta;
      if (chicken.sitHoldTimeLeft <= 0) {
        const standDuration = playReverseOnce(chicken, chicken.sitClip?.name);
        playClockAction(chicken, true);
        chicken.sitPhase = "up";
        chicken.actionTimeLeft = Math.max(0.1, standDuration / Math.max(chickenAnimSpeed, 0.0001));
      }
      return;
    }
    if (chicken.sitPhase === "up") {
      chicken.actionTimeLeft -= delta;
      if (chicken.actionTimeLeft <= 0) {
        stopClockAction(chicken);
        resumeWalking(chicken);
      }
      return;
    }
  }

  if (chicken.mode !== "walk") {
    if (chicken.manualOverrideMode) {
      chicken.manualOverrideTimeLeft -= delta;
    }
    chicken.actionTimeLeft -= delta;
    if (chicken.actionTimeLeft <= 0) {
      if (chicken.manualOverrideMode && chicken.manualOverrideTimeLeft <= 0) {
        chicken.manualOverrideMode = null;
        chicken.manualOverrideTimeLeft = 0;
        applyScheduledBehavior(chicken, now);
        if (chicken.mode !== "walk") {
          return;
        }
        resumeWalking(chicken);
      } else {
        applyScheduledBehavior(chicken, now);
      }
    }
    return;
  }

  if (!chicken.routePoints.length) {
    pickNextRoute(chicken);
    if (!chicken.routePoints.length) return;
  }

  let remainingDistance = chicken.speed * delta;
  while (remainingDistance > 0 && chicken.routeIndex < chicken.routePoints.length - 1) {
    const from = chicken.routePoints[chicken.routeIndex];
    const to = chicken.routePoints[chicken.routeIndex + 1];
    const segmentLength = from.distanceTo(to);
    if (segmentLength < 0.0001) {
      chicken.routeIndex += 1;
      chicken.progressOnSegment = 0;
      continue;
    }

    const leftover = segmentLength - chicken.progressOnSegment;
    if (remainingDistance < leftover) {
      chicken.progressOnSegment += remainingDistance;
      remainingDistance = 0;
    } else {
      remainingDistance -= leftover;
      chicken.routeIndex += 1;
      chicken.progressOnSegment = 0;
    }

    const activeFrom = chicken.routePoints[chicken.routeIndex];
    const activeTo = chicken.routePoints[Math.min(chicken.routeIndex + 1, chicken.routePoints.length - 1)];
    const activeLength = activeFrom.distanceTo(activeTo);
    const t = activeLength > 0.0001 ? chicken.progressOnSegment / activeLength : 1;
    const pos = activeFrom.clone().lerp(activeTo, t);
    chicken.root.position.copy(pos);
    orientChicken(chicken, activeTo.clone().sub(activeFrom));
  }

  if (chicken.routeIndex >= chicken.routePoints.length - 1) {
    chicken.previousCellId = chicken.currentCellId;
    chicken.currentCellId = chicken.targetCellId;
    chicken.targetCellId = null;
    chicken.routePoints = [];
    chicken.routeIndex = 0;
    chicken.progressOnSegment = 0;
    pickNextRoute(chicken);
  }
}

function orientChicken(chicken, direction) {
  if (direction.lengthSq() < 0.00001) return;
  direction.y = 0;
  if (direction.lengthSq() < 0.00001) return;
  direction.normalize();
  chicken.root.rotation.y = Math.atan2(direction.x, direction.z);
}

function getAverageTopHeight() {
  if (!cells.length) return 18;
  let sum = 0;
  for (const cell of cells) sum += cell.topY;
  return sum / cells.length;
}

function clearGroup(group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    group.remove(child);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  for (const chicken of chickens) {
    updateChicken(chicken, delta);
  }
  triggerCollisionSitIfNeeded();
  updateCameraFocus(delta);
  updateClockUi();
  controls.update();
  renderer.render(scene, camera);
}

function formatDegrees(value) {
  return `${Math.round(value)} deg`;
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function round3(value) {
  return Number(value.toFixed(3));
}

function shuffleInPlace(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}




