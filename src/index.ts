import 'aframe';
import 'aframe-extras';
import * as THREE from 'three';

AFRAME.registerComponent('custom-controls', {
  schema: {
    speed: {type: 'number', default: 0.3}
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
      case 'KeyQ': this.moveVector.y = 1; break;
      case 'KeyE': this.moveVector.y = -1; break;
    }
  },
  onKeyUp: function (this: any, event: KeyboardEvent) {
    switch (event.code) {
      case 'KeyQ':
      case 'KeyE':
        this.moveVector.y = 0;
        break;
    }
  },
  tick: function (this: any) {
    const movementSpeed = this.data.speed;
    const displacement = this.moveVector.clone().multiplyScalar(movementSpeed);
    this.el.object3D.position.add(displacement);
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

  showTempAnchor: function (this: any, point: THREE.Vector3, normal: THREE.Vector3) {
    if (this.tempAnchor) {
      this.tempAnchor.parentNode.removeChild(this.tempAnchor);
    }
    
    this.tempAnchor = document.createElement('a-entity');
    this.tempAnchor.setAttribute('position', point);
    this.tempAnchor.setAttribute('geometry', {primitive: 'sphere', radius: 0.02});
    this.tempAnchor.setAttribute('material', {color: 'yellow'});
    
    const normalIndicator = document.createElement('a-entity');
    normalIndicator.setAttribute('geometry', {primitive: 'cylinder', radius: 0.005, height: 0.05});
    normalIndicator.setAttribute('material', {color: 'blue'});
    normalIndicator.setAttribute('position', {x: 0, y: 0.025, z: 0});
    
    const rotationTo = new THREE.Matrix4().lookAt(new THREE.Vector3(), normal, new THREE.Vector3(0, 1, 0));
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotationTo);
    normalIndicator.object3D.quaternion.copy(quaternion);
    
    this.tempAnchor.appendChild(normalIndicator);
    this.el.sceneEl.appendChild(this.tempAnchor);
    
    this.updateUI(point, normal);
  },
  confirmAnchorPoint: function (this: any, point: THREE.Vector3, normal: THREE.Vector3) {
    const anchorEl = document.createElement('a-entity');
    anchorEl.setAttribute('position', point);
    anchorEl.setAttribute('geometry', {primitive: 'sphere', radius: 0.02});
    anchorEl.setAttribute('material', {color: 'red'});
    
    const normalIndicator = document.createElement('a-entity');
    normalIndicator.setAttribute('geometry', {primitive: 'cylinder', radius: 0.005, height: 0.05});
    normalIndicator.setAttribute('material', {color: 'green'});
    normalIndicator.setAttribute('position', {x: 0, y: 0.025, z: 0});
    
    const rotationTo = new THREE.Matrix4().lookAt(new THREE.Vector3(), normal, new THREE.Vector3(0, 1, 0));
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotationTo);
    normalIndicator.object3D.quaternion.copy(quaternion);
    
    anchorEl.appendChild(normalIndicator);
    this.el.sceneEl.appendChild(anchorEl);
    
    const relativePosition = this.getRelativePosition(point);
    this.anchorPoints.push({position: point, normal: normal, relativePosition: relativePosition});
    
    if (this.tempAnchor) {
      this.tempAnchor.parentNode.removeChild(this.tempAnchor);
      this.tempAnchor = null;
    }

    this.updateUI();
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
        <input type="range" id="speedSlider" min="0.1" max="1" step="0.1" value="0.3">
        <span id="speedValue">0.3</span>
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