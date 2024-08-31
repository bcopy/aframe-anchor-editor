import 'aframe';
import 'aframe-extras';
import * as THREE from 'three';
const NORMAL_INDICATOR_LENGTH = 0.5;  // Adjust this value to change the length of the normal indicator
const CONE_OFFSET = 0.9555;

AFRAME.registerComponent('custom-controls', {
  schema: {
    speed: {type: 'number', default: 2}
  },
  init: function (this: any) {
    this.moveVector = new THREE.Vector3(0, 0, 0);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
  },

  onKeyDown: function (this: any, event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW': this.moveVector.z = 1; break;
      case 'KeyS': this.moveVector.z = -1; break;
      case 'KeyA': this.moveVector.x = -1; break;
      case 'KeyD': this.moveVector.x = 1; break;
      case 'KeyQ': this.moveVector.y = 1; break;
      case 'KeyE': this.moveVector.y = -1; break;
    }
  },

  onKeyUp: function (this: any, event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyW':
      case 'KeyS': this.moveVector.z = 0; break;
      case 'KeyA':
      case 'KeyD': this.moveVector.x = 0; break;
      case 'KeyQ':
      case 'KeyE': this.moveVector.y = 0; break;
    }
  },

  tick: function (this: any, time: number, deltaTime: number) {
    if (!this.el.sceneEl.is('vr-mode')) {
      const movementSpeed = this.data.speed;
      const rotation = this.el.object3D.rotation;
      const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(1, 0, 0), rotation.x);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.y);
      
      const movement = new THREE.Vector3()
        .addScaledVector(forward, this.moveVector.z)
        .addScaledVector(right, this.moveVector.x)
        .addScaledVector(new THREE.Vector3(0, 1, 0), this.moveVector.y);

      movement.normalize().multiplyScalar(movementSpeed * (deltaTime / 1000));
      
      this.el.object3D.position.add(movement);
    }
  },

  remove: function (this: any) {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
  }
});

AFRAME.registerComponent('anchor-point-editor', {
  init: function (this: any) {
    this.anchorPoints = [];
    this.tempAnchor = null;
    this.el.addEventListener('click', this.onModelClick.bind(this));
    this.createUI();
    this.modelOrigin = new THREE.Vector3();

    this.el.addEventListener('model-loaded', () => {
      console.log('Model loaded');
      this.centerCameraOnModel();
    });
  },

  centerCameraOnModel: function (this: any) {
    const mesh = this.el.getObject3D('mesh');
    if (mesh) {
      const bbox = new THREE.Box3().setFromObject(mesh);
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.el.sceneEl.camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 2.5;

      const camera = document.getElementById('rig');
      camera?.setAttribute('position', `${center.x} ${center.y + (size.y / 4)} ${center.z + cameraZ}`);
      
      const lookControls = document.querySelector('[camera]')?.components['look-controls'];
      if (lookControls) {
        lookControls.pitchObject.rotation.x = -Math.PI / 10;
        lookControls.yawObject.rotation.y = 0;
      }
    }
  },

  onModelClick: function (this: any, event: any) {
    const intersection = event.detail.intersection;
    if (intersection) {
      this.showTempAnchor(intersection.point, intersection.face.normal);
    }
  },

  createPointVisualization: function(point: THREE.Vector3 | {x: number, y: number, z: number}, 
    normal: THREE.Vector3 | {x: number, y: number, z: number}, 
    sphereColor: string, 
    coneColor: string): HTMLElement {
    const anchorEl = document.createElement('a-entity');
    const pointVector = point instanceof THREE.Vector3 ? point : new THREE.Vector3(point.x, point.y, point.z);
    const normalVector = normal instanceof THREE.Vector3 ? normal : new THREE.Vector3(normal.x, normal.y, normal.z);

    anchorEl.setAttribute('position', pointVector);
    anchorEl.setAttribute('geometry', {primitive: 'sphere', radius: 0.02});
    anchorEl.setAttribute('material', {color: sphereColor});

    const normalIndicator = document.createElement('a-entity');
    normalIndicator.setAttribute('geometry', {
    primitive: 'cone', 
    radiusBottom: 0.08, 
    radiusTop: 0.01, 
    height: NORMAL_INDICATOR_LENGTH
    });
    normalIndicator.setAttribute('material', {color: coneColor});

    // Position the cone so its base is closer to the anchor point
    const conePosition = new THREE.Vector3().addVectors(
      pointVector,
      normalVector.clone().multiplyScalar(CONE_OFFSET + NORMAL_INDICATOR_LENGTH / 2)
    );
    normalIndicator.setAttribute('position', conePosition);
    
    // Orient the cone to align with the normal, pointing outward from the surface
    const lookAtPoint = new THREE.Vector3().addVectors(conePosition, normalVector);
    normalIndicator.object3D.lookAt(lookAtPoint);
    normalIndicator.object3D.rotateX(Math.PI / 2);
    
    anchorEl.appendChild(normalIndicator);
    return anchorEl;
  },
  confirmAnchorPoint: function (this: any, point: THREE.Vector3 | {x: number, y: number, z: number}, 
    normal: THREE.Vector3 | {x: number, y: number, z: number}) {
    const anchorEl = this.createPointVisualization(point, normal, 'red', 'green');
    this.el.sceneEl.appendChild(anchorEl);

    const relativePosition = this.getRelativePosition(point instanceof THREE.Vector3 ? point : new THREE.Vector3(point.x, point.y, point.z));
    this.anchorPoints.push({position: point, normal: normal, relativePosition: relativePosition});

    if (this.tempAnchor) {
    this.tempAnchor.parentNode.removeChild(this.tempAnchor);
    this.tempAnchor = null;
    }

    this.updateUI();
  },

  showTempAnchor: function (this: any, point: THREE.Vector3 | {x: number, y: number, z: number}, 
    normal: THREE.Vector3 | {x: number, y: number, z: number}) {
    if (this.tempAnchor) {
    this.tempAnchor.parentNode.removeChild(this.tempAnchor);
    }

    this.tempAnchor = this.createPointVisualization(point, normal, 'yellow', 'blue');
    this.el.sceneEl.appendChild(this.tempAnchor);

    this.updateUI(point, normal);
  },

  getRelativePosition: function (this: any, point: THREE.Vector3) {
      const modelPosition = this.el.object3D.position;
      return {
        x: point.x - modelPosition.x,
        y: point.y - modelPosition.y,
        z: point.z - modelPosition.z
      };
  },

  generateRandomAnchors: function (this: any, count: number) {
    const mesh = this.el.getObject3D('mesh');
    if (!mesh) return;

    const geometry = mesh.geometry;
    const positionAttribute = geometry.attributes.position;
    const normalAttribute = geometry.attributes.normal;

    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * positionAttribute.count);
      const position = new THREE.Vector3();
      const normal = new THREE.Vector3();

      position.fromBufferAttribute(positionAttribute, randomIndex);
      normal.fromBufferAttribute(normalAttribute, randomIndex);

      position.applyMatrix4(mesh.matrixWorld);
      normal.applyMatrix4(mesh.matrixWorld).normalize();

      this.confirmAnchorPoint(position, normal);
    }
  },

  createUI: function (this: any) {
    const ui = document.createElement('div');
    ui.style.position = 'absolute';
    ui.style.top = '10px';
    ui.style.left = '10px';
    ui.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    ui.style.color = 'white';
    ui.style.padding = '10px';
    ui.innerHTML = `
      <h3>Anchor Point Editor</h3>
      <div id="anchorList"></div>
      <div id="confirmButton"></div>
      <button id="generateButton">Generate 10 Random Anchors</button>
      <div style="margin-top: 10px;">
        <h4>Controls:</h4>
        <p>WASD: Move | Q: Up, E: Down | Mouse: Look | Click: Place Temp Anchor</p>
      </div>
      <div style="margin-top: 10px;">
        <label for="speedSlider">Movement Speed: </label>
        <input type="range" id="speedSlider" min="0.1" max="10" step="0.5" value="2">
        <span id="speedValue">2</span>
      </div>
    `;
    document.body.appendChild(ui);

    document.getElementById('generateButton')?.addEventListener('click', () => this.generateRandomAnchors(10));

    const slider = document.getElementById('speedSlider') as HTMLInputElement;
    const speedValue = document.getElementById('speedValue');
    const rig = document.getElementById('rig');

    slider?.addEventListener('input', function() {
      const speed = parseFloat(this.value);
      if (speedValue) speedValue.textContent = speed.toFixed(1);
      if (rig) {
        rig.setAttribute('custom-controls', 'speed: '+speed.toFixed(1));
      }
    });
  },

  updateUI: function (this: any, point?: THREE.Vector3, normal?: THREE.Vector3) {
    const anchorList = document.getElementById('anchorList');
    if (anchorList) {
      anchorList.innerHTML = '<pre>' + JSON.stringify(this.anchorPoints, null, 2) + '</pre>';
    }
  
    const confirmButton = document.getElementById('confirmButton');
    if (confirmButton) {
      if (point && normal) {
        confirmButton.innerHTML = `<button onclick='document.querySelector("[anchor-point-editor]").components["anchor-point-editor"].confirmAnchorPoint(${JSON.stringify({x: point.x, y: point.y, z: point.z})}, ${JSON.stringify({x: normal.x, y: normal.y, z: normal.z})})'>Confirm Anchor Point</button>`;
      } else {
        confirmButton.innerHTML = '';
      }
    }
  }
});