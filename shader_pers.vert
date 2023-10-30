varying vec2 vUV;
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
    
    
}