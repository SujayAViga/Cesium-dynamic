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
        "streamName": "LeftCamTop",
        "streamLink": "./Videos/LeftTargetTop.mp4",
        "fov": 60.0,
        "near_plane": 0.3,
        "far_plane": 1000.0,
        "rotateY": 131.878,
        "rotateX": 2.727,
        "rotateZ": 0.0,
        "position": [
            -76.5,
            36.2,
            76.1
        ],
        "width": 1920.0,
        "height": 1080.0
    },
    {
        "streamName": "BackCamTop",
        "streamLink": "./Videos/BackTargetTop.mp4",
        "fov": 60.0,
        "near_plane": 0.3,
        "far_plane": 1000.0,
        "rotateY": 45.901,
        "rotateX": 0.0,
        "rotateZ": 0.0,
        "position": [
            -62.5,
            31.9,
            -63.7
        ],
        "width": 1920.0,
        "height": 1080.0
    },
    {
        "streamName": "RightCamTop",
        "streamLink": "./Videos/RightTargetTop.mp4",
        "fov": 60.0,
        "near_plane": 0.3,
        "far_plane": 1000.0,
        "rotateY": 0.0,
        "rotateX": 90.0,
        "rotateZ": 0.0,
        "position": [
            8.8,
            168.7,
            3.9
        ],
        "width": 1920.0,
        "height": 1080.0
    },
    {
        "streamName": "FrontCamTop",
        "streamLink": "./Videos/FrontTargetTop.mp4",
        "fov": 60.0,
        "near_plane": 0.3,
        "far_plane": 1000.0,
        "rotateY": 113.992,
        "rotateX": 0.0,
        "rotateZ": 0.0,
        "position": [
            -109.3156,
            31.7,
            32.72234
        ],
        "width": 1920.0,
        "height": 1080.0
    }
];

const data=JSON.parse(JSON.stringify(jsonData));

function addNewVideoElement(streamName,streamSrc){
    var video = document.createElement("video");
    video.id=streamName;
    video.autoplay=true;
    video.muted=true;
    video.controls=true;
    video.hidden=true;
    //video.style.display='none';
    video.preload=true;
    video.loop=true;
    document.body.appendChild(video);
    video.src=streamSrc
    //var videoSrc = streamSrc;
    //addHLS(video,videoSrc);
}

function addHLS(videoElement,videoSrc){
    if (Hls.isSupported()) {
        var hls=new Hls();
        hls.loadSource(videoSrc);
        hls.attachMedia(videoElement);
    } else if (
        videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = videoSrc;
    } 
}


for(let i=0;i<data.length;i++){
    addNewVideoElement(data[i].streamName,data[i].streamLink);
}