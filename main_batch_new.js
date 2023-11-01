import * as THREE from 'three';
import { CesiumIonTilesRenderer } from '3d-tiles-renderer';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader';
import { Sphere,Vector3,Quaternion } from 'three';
import {PointerLockControls} from 'three/examples/jsm/controls/PointerLockControls';
import { Sky } from 'three/addons/objects/Sky.js';


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.3, 1000_000_000_000_000 );
// const camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, 1, 1000 );
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setClearColor( 0x151c1f );
document.body.appendChild( renderer.domElement );

//Get VERTEX and FRAGMENT Shader
// const vert_shader = await (await fetch('./shader_pers.vert')).text();
// const frag_shader = await (await fetch('./shader.frag')).text();

let vert_shader = `varying vec2 vUV;
varying vec2 vUV_depth;

uniform sampler2D colorMap;

//Attributes
attribute vec3 offset;
attribute float rotationY;
attribute float rotationX;
attribute float rotationZ;
attribute vec4 colorMap_crop;
attribute vec4 colorMap_depth_crop;

attribute float scalingFactor; 
attribute float near_plane;
attribute float far_plane;
attribute float FOV;
attribute float WIDTH;
attribute float HEIGHT;

//get z-depth data
float getDepth(vec2 uv_depth){
    vec4 rgba = texture2D(colorMap,uv_depth);
    return 1.0-rgba.r;
}

#define DEG_TO_RADIANS 0.01745329251

void main(){
    //liner interpolation formula for seperating the RGBD image from each other 
    vec2 customUV = uv * vec2(colorMap_crop.z - colorMap_crop.x, colorMap_crop.w - colorMap_crop.y) + 
        colorMap_crop.xy;

    vec2 customUV_depth = uv * vec2(colorMap_depth_crop.z - colorMap_depth_crop.x, colorMap_depth_crop.w - colorMap_depth_crop.y) + 
        colorMap_depth_crop.xy;
    
    //over to fragment shader
    vUV = customUV;
    vUV_depth = customUV_depth;


    //Calculate points screen space coordinates
    float aspect_ratio = (WIDTH/HEIGHT);
    float fov = (FOV/2.0)*DEG_TO_RADIANS;
    float z = getDepth(customUV_depth);

    float dim_z = near_plane + (far_plane-near_plane) * z;
    float dim_x = dim_z*tan(fov)*aspect_ratio;
    float dim_y = dim_z*tan(fov);

    vec3 new_pos = vec3((uv.x*2.0 - 1.0)*dim_x, (uv.y*2.0 - 1.0)*dim_y, -(dim_z));
    
    //Rotate the mesh
    //-->Y-Rotation
    mat4 rotationMatrixY = mat4(
    cos(rotationY), 0.0, sin(rotationY), 0.0,
    0.0, 1.0, 0.0, 0.0,
    -sin(rotationY), 0.0, cos(rotationY), 0.0,
    0.0, 0.0, 0.0, 1.0);

    //-->X-Rotation
    mat4 rotationMatrixX = mat4(
    1.0, 0.0, 0.0, 0.0,
    0.0, cos(rotationX), -sin(rotationX), 0.0,
    0.0, sin(rotationX), cos(rotationX), 0.0,
    0.0, 0.0, 0.0, 1.0);

    //-->Z-Rotation
    mat4 rotationMatrixZ = mat4(
    cos(rotationZ), -sin(rotationZ), 0.0, 0.0,
    sin(rotationZ), cos(rotationZ), 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0);


    new_pos=(rotationMatrixY*rotationMatrixX*rotationMatrixZ*vec4(new_pos,1.0)).xyz;

    //Reposition Mesh
    vec4 transformedPos=modelMatrix * vec4(new_pos+offset,1.0);

    gl_Position = projectionMatrix * viewMatrix * transformedPos;
    
    gl_PointSize = (100.0/length(gl_Position.xyz))+scalingFactor;
    
    
}`
let frag_shader = `uniform sampler2D colorMap;

varying vec2 vUV;
varying vec2 vUV_depth;

void make_kernel(inout vec4 n[9], sampler2D tex, vec2 coord)
{
	float w = 1.0 / 1000.;
	float h = 1.0 / 500.;

	n[0] = texture2D(tex, coord + vec2( -w, -h));
	n[1] = texture2D(tex, coord + vec2(0.0, -h));
	n[2] = texture2D(tex, coord + vec2(  w, -h));
	n[3] = texture2D(tex, coord + vec2( -w, 0.0));
	n[4] = texture2D(tex, coord);
	n[5] = texture2D(tex, coord + vec2(  w, 0.0));
	n[6] = texture2D(tex, coord + vec2( -w, h));
	n[7] = texture2D(tex, coord + vec2(0.0, h));
	n[8] = texture2D(tex, coord + vec2(  w, h));
}

void main(){
    if(texture2D(colorMap,vUV_depth).r < 0.01){
        discard;
    }
    else{

        vec4 n[9];
        make_kernel( n, colorMap, vUV_depth );
        vec4 sobel_edge_h = n[2] + (2.0*n[5]) + n[8] - (n[0] + (2.0*n[3]) + n[6]);
        vec4 sobel_edge_v = n[0] + (2.0*n[1]) + n[2] - (n[6] + (2.0*n[7]) + n[8]);
        vec4 sobel = sqrt((sobel_edge_h * sobel_edge_h) + (sobel_edge_v * sobel_edge_v));
        if(sobel.r > 0.2)
        {
            discard;
        }

        gl_FragColor = texture2D(colorMap,vUV);
    }
}`

    // sky
    let sky, sun;
	// Add Sky
	sky = new Sky();
	sky.scale.setScalar( 450000 );
	// scene.add( sky );

	sun = new THREE.Vector3();
	const effectController = {
		turbidity: 10,
		rayleigh: 3,
		mieCoefficient: 0.005,
		mieDirectionalG: 0.7,
		elevation: 2,
		azimuth: 180,
		exposure: renderer.toneMappingExposure
	};
	const uniforms = sky.material.uniforms;
					uniforms[ 'turbidity' ].value = effectController.turbidity;
					uniforms[ 'rayleigh' ].value = effectController.rayleigh;
					uniforms[ 'mieCoefficient' ].value = effectController.mieCoefficient;
					uniforms[ 'mieDirectionalG' ].value = effectController.mieDirectionalG;

					const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation );
					const theta = THREE.MathUtils.degToRad( effectController.azimuth );

					sun.setFromSphericalCoords( 1, phi, theta );

					uniforms[ 'sunPosition' ].value.copy( sun );

					renderer.toneMappingExposure = effectController.exposure;

scene.add(sky)
//FPS controller
const FPScontrols = new PointerLockControls(camera,renderer.domElement);
document.addEventListener('click',function(){FPScontrols.lock();})
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const onKeyDown = function ( event ) {

    switch ( event.code ) {

        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;

        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;

        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;

        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;

        case 'Space':
            if ( canJump === true ) velocity.y += 350;
            canJump = false;
            break;

    }

};

const onKeyUp = function ( event ) {

    switch ( event.code ) {

        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;

        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;

        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;

        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;

    }

};
document.addEventListener( 'keydown', onKeyDown );
document.addEventListener( 'keyup', onKeyUp );

function updateFPSControls(){
    const time = performance.now();
    const delta = ( time - prevTime ) / 1000;

	velocity.x -= velocity.x * 10.0 * delta;
	velocity.z -= velocity.z * 10.0 * delta;

	velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

	direction.z = Number( moveForward ) - Number( moveBackward );
	direction.x = Number( moveRight ) - Number( moveLeft );
	direction.normalize(); // this ensures consistent movements in all directions

	if ( moveForward || moveBackward ) velocity.z -= direction.z * 4000.0 * delta;//intial value 300
	if ( moveLeft || moveRight ) velocity.x -= direction.x * 4000.0 * delta;//initial value 300

  FPScontrols.moveRight( - velocity.x * delta );
	FPScontrols.moveForward( - velocity.z * delta );
    
    prevTime = time;
}

//Set Ambient light to see model
//Ambient Light
const light = new THREE.AmbientLight( 0x404040 ,1);
scene.add(light);
const directionalLight = new THREE.DirectionalLight( 0xffffff, 1 );

directionalLight.position.x = 100
directionalLight.position.y = 500
scene.add( directionalLight );

//Setup Cesium
//Setup CESIUM ION
const params = {
    'errorTarget': 800,
	'ionAssetId': '2336825',
	'ionAccessToken': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyZjk1OTU2My1mNDBhLTQzYzEtOTcxMS01MzNiOWIxMDZiYTMiLCJpZCI6MTY2MDkxLCJpYXQiOjE2OTQ1NDMyOTN9.rHxFqNMZ26EFHwHYUJ-xW0fDZtjamHXiM-4HR6YIHXY',
	'reload': reinstantiateTiles,

};
//-------------CESIUM ION tiles setup-----------------//
let tiles;
function rotationBetweenDirections( dir1, dir2 ) {

	const rotation = new Quaternion();
	const a = new Vector3().crossVectors( dir1, dir2 );
	rotation.x = a.x;
	rotation.y = a.y;
	rotation.z = a.z;
	rotation.w = 1 + dir1.clone().dot( dir2 );
	rotation.normalize();

	return rotation;

}

function setupTiles() {

	tiles.fetchOptions.mode = 'cors';

	// Note the DRACO compression files need to be supplied via an explicit source.
	// We use unpkg here but in practice should be provided by the application.
	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath( 'https://unpkg.com/three@0.153.0/examples/jsm/libs/draco/gltf/' );

	const loader = new GLTFLoader( tiles.manager );
	loader.setDRACOLoader( dracoLoader );

	tiles.manager.addHandler( /\.gltf$/, loader );
	scene.add( tiles.group );
}

function reinstantiateTiles() {

	if ( tiles ) {

		scene.remove( tiles.group );
		tiles.dispose();
		tiles = null;

	}

	tiles = new CesiumIonTilesRenderer( params.ionAssetId, params.ionAccessToken );
	tiles.onLoadTileSet = () => {

		// because ion examples typically are positioned on the planet surface we can orient
		// it such that up is Y+ and center the model
		const sphere = new Sphere();
		tiles.getBoundingSphere( sphere );
        tiles.lruCache.maxSize = 600;
		tiles.lruCache.minSize = 400;
		tiles.lruCache.unloadPercent = 1
		const position = sphere.center.clone();
		const distanceToEllipsoidCenter = position.length();

		const surfaceDirection = position.normalize();
		const up = new Vector3( 0, 1, 0 );
		const rotationToNorthPole = rotationBetweenDirections( surfaceDirection, up );

		tiles.group.quaternion.x = rotationToNorthPole.x;
		tiles.group.quaternion.y = rotationToNorthPole.y;
		tiles.group.quaternion.z = rotationToNorthPole.z;
		tiles.group.quaternion.w = rotationToNorthPole.w;

		tiles.group.position.y = - distanceToEllipsoidCenter+90;
		tiles.group.position.x = 254;
		tiles.group.position.z = 536;
	};

	setupTiles();

}
//-------------CESIUM ION tiles setup-----------------//

//NEEEEWWWWW
var offset=[];
var rotationY=[];
var rotationX=[];
var rotationZ=[];
var far_plane=[];
var near_plane=[];
var FOV=[];
var render_width=[];
var render_height=[];
var scaling_factor=[];

var colorMap_crop=[];
var colorMap_depth_crop=[];

var MESH=[];
var HELPER_MESH=[];

function addMeshFromStream(video_element_id,near_plane_val,far_plane_val,fov,rotateY,rotateX,rotateZ,position,     image_width,image_height,atlas_width,atlas_height,posX,posY){
  offset=[];
  rotationY=[];
  rotationX=[];
  rotationZ=[];
  far_plane=[];
  near_plane=[];
  FOV=[];
  render_width=[];
  render_height=[];
  scaling_factor=[];

  colorMap_crop=[];
  colorMap_depth_crop=[];

  const video=document.getElementById(video_element_id);
  video.onloadeddata=function(){video.play();}

  const texture=new THREE.VideoTexture(video);
  texture.needsUpdate = true;

  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  const shader_mat=new THREE.ShaderMaterial({
    uniforms:{
      colorMap:{value:texture}},
    vertexShader:vert_shader,
    fragmentShader:frag_shader,
    side:THREE.FrontSide,
  });
  shader_mat.needsUpdate=true;

  const geometry=new THREE.PlaneGeometry(1,1,2000,1000);
  geometry.scale(image_width/fov,image_height/fov,1);

  const instancedGeometry=new THREE.InstancedBufferGeometry();
  instancedGeometry.index=geometry.index;
  instancedGeometry.attributes.position=geometry.attributes.position;
  instancedGeometry.attributes.uv=geometry.attributes.uv;

  addNewMeshFromImageData(instancedGeometry,near_plane_val,far_plane_val,fov,rotateY,rotateX,rotateZ,position,     image_width,image_height,atlas_width,atlas_height,posX,posY);
  const mesh=new THREE.Points(instancedGeometry,shader_mat);
  scene.add(mesh);
  MESH.push(mesh);
  //Add Helper Mesh
  const helperMesh=new THREE.Mesh(new THREE.BoxGeometry(1000,1000,1000),new THREE.MeshBasicMaterial({color: 0xffff00, wireframe:true}));
  helperMesh.position.x=position.x;
  helperMesh.position.y=position.y;
  helperMesh.position.z=position.z;
  HELPER_MESH.push(helperMesh);
  scene.add(helperMesh);
  helperMesh.visible=false;
}

function addNewMeshFromImageData(instancedGeometry,near_plane_val,far_plane_val,fov,rotateY,rotateX,rotateZ,position,     image_width,image_height,atlas_width,atlas_height,posX,posY){
  meshPositionData(near_plane_val,far_plane_val,fov,image_width,image_height,(rotateY)* (Math.PI / 180.0),(rotateX)* (Math.PI / 180.0),(rotateZ)* (Math.PI / 180.0),position);
  imageCropData(image_width,image_height,atlas_width,atlas_height,posX,posY);
  
  //set the Attributes for the Instanced Buffer Geometry
  var offsetAttr=new THREE.InstancedBufferAttribute(new Float32Array(offset),3,false);
  var rotationYAttr=new THREE.InstancedBufferAttribute(new Float32Array(rotationY),1);
  var rotationXAttr=new THREE.InstancedBufferAttribute(new Float32Array(rotationX),1);
  var rotationZAttr=new THREE.InstancedBufferAttribute(new Float32Array(rotationZ),1);
  var farPlaneAttr=new THREE.InstancedBufferAttribute(new Float32Array(far_plane),1);
  var nearPlaneAttr=new THREE.InstancedBufferAttribute(new Float32Array(near_plane),1);
  var fovAttr=new THREE.InstancedBufferAttribute(new Float32Array(FOV),1);
  var renderWidthAttr=new THREE.InstancedBufferAttribute(new Float32Array(render_width),1);
  var renderHeightAttr=new THREE.InstancedBufferAttribute(new Float32Array(render_height),1);
  var scalingFactorAttr=new THREE.InstancedBufferAttribute(new Float32Array(scaling_factor),1);

  var colorMap_cropAttr=new THREE.InstancedBufferAttribute(new Float32Array(colorMap_crop),4);
  var colorMap_depth_cropAttr=new THREE.InstancedBufferAttribute(new Float32Array(colorMap_depth_crop),4);

  instancedGeometry.setAttribute("offset",offsetAttr);
  instancedGeometry.setAttribute("rotationY",rotationYAttr);
  instancedGeometry.setAttribute("rotationX",rotationXAttr);
  instancedGeometry.setAttribute("rotationZ",rotationZAttr);
  instancedGeometry.setAttribute("near_plane",nearPlaneAttr);
  instancedGeometry.setAttribute("far_plane",farPlaneAttr);
  instancedGeometry.setAttribute("FOV",fovAttr);
  instancedGeometry.setAttribute("WIDTH",renderWidthAttr);
  instancedGeometry.setAttribute("HEIGHT",renderHeightAttr);
  instancedGeometry.setAttribute("scalingFactor",scalingFactorAttr);
  instancedGeometry.setAttribute("colorMap_crop",colorMap_cropAttr);
  instancedGeometry.setAttribute("colorMap_depth_crop",colorMap_depth_cropAttr);
}

function meshPositionData(near_plane_val,far_plane_val,fov,width,height,rotateY,rotateX,rotateZ,position){
  offset.push(position.x,position.y,position.z);

  rotationY.push(rotateY);
  rotationX.push(rotateX);
  rotationZ.push(rotateZ);

  far_plane.push(far_plane_val);
  near_plane.push(near_plane_val);

  FOV.push(fov);
  render_width.push(width);
  render_height.push(height);

  scaling_factor.push(1.0);
}

function imageCropData(image_width,image_height,atlas_width,atlas_height,posX,posY){
  const img_color_bottom = new THREE.Vector2((image_width*posX)/atlas_width,((image_height*posY)+(image_height/2))/atlas_height);
  const img_color_top_right = new THREE.Vector2(((image_width*posX)+image_width)/atlas_width,((image_height*posY)+image_height)/atlas_height);

  const depth_color_bottom = new THREE.Vector2((image_width*posX)/atlas_width,(image_height*posY)/atlas_height);
  const depth_color_top_right = new THREE.Vector2(((image_width*posX)+image_width)/atlas_width,((image_height*posY)+(image_height/2))/atlas_height);

  colorMap_crop.push(img_color_bottom.x,img_color_bottom.y,img_color_top_right.x,img_color_top_right.y);
  colorMap_depth_crop.push(depth_color_bottom.x,depth_color_bottom.y,depth_color_top_right.x,depth_color_top_right.y);
}

function loadMeshOnFrustum(){
  camera.updateMatrix();
  camera.updateMatrixWorld();
  var frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    )
  );

  for(let i=0;i<MESH.length;i++){
    if(frustum.intersectsObject(HELPER_MESH[i])){
      MESH[i].frustumCulled=false;
      HELPER_MESH.frustumCulled=false;
    }else{
      MESH[i].frustumCulled=true;
      HELPER_MESH.frustumCulled=true;
    }
  }
}

const jsonData=[
  {
      "streamName": "FrontCam",
      "streamLink": "./Videos/FrontTarget.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 0.0,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          17.8,
          36.6,
          -125
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "BackCam",
      "streamLink": "./Videos/BackTarget.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": -180.0,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          1.9,
          40.4,
          142.3
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "LeftCam",
      "streamLink": "./Videos/LeftTarget.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 90.0,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          -100.5,
          29.2,
          0.0
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "RightCam",
      "streamLink": "./Videos/RightTarget.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": -90,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          125.5,
          41.1,
          0.0
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "FrontTopCam",
      "streamLink": "./Videos/FrontTragetTop.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 180,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          -350,
          35,
          362
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "BackTopCam",
      "streamLink": "./Videos/BackTargetTop.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": 0.0,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          -353,
          35,
          104
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "LeftTopCam",
      "streamLink": "./Videos/LeftTargetTop.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1500.0,
      "rotateY": 90.0,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          -486.7,
          35,
          214
      ],
      "width": 1920.0,
      "height": 1080.0
  },
  {
      "streamName": "RightTopCam",
      "streamLink": "./Videos/RightTargetTop.mp4",
      "fov": 60.0,
      "near_plane": 0.3,
      "far_plane": 1000.0,
      "rotateY": -90.0,
      "rotateX": 0.0,
      "rotateZ": 0.0,
      "position": [
          -227,
          35,
          228
      ],
      "width": 1920.0,
      "height": 1080.0
  }
];

const data=JSON.parse(JSON.stringify(jsonData));

for(let i=0;i<data.length;i++){
  addMeshFromStream(data[i].streamName,data[i].near_plane,data[i].far_plane,data[i].fov,data[i].rotateY,data[i].rotateX,data[i].rotateZ,new THREE.Vector3(data[i].position[0],data[i].position[1],data[i].position[2]*(-1)),data[i].width,data[i].height,data[i].width,data[i].height,0,0);
}

//ADD Cesium Ion Tile
reinstantiateTiles();

camera.position.y=30
camera.position.x=50
camera.position.z=200

function animate() {
	requestAnimationFrame( animate );
    updateFPSControls();

  if ( ! tiles ) return;
    tiles.errorTarget = params.errorTarget;
	tiles.setCamera( camera );
	tiles.setResolutionFromRenderer( camera, renderer );
	// update tiles
	tiles.update();
	renderer.render( scene, camera );
    loadMeshOnFrustum();
}

animate();