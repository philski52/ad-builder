$(document).ready(function () {
    function deviceVideoControlsOn() {
        var videoHeight = 562;
        var needsVisibleControls = true;
        // var needsVisibleControls = false;

        //Define Video
        var theVideo = document.getElementsByTagName("video")[0];
        var calculatedVideoHeight = theVideo.offsetHeight;
        var volumeControlsVisible = false;

        //Define Controls
        var theCSS = document.createElement("link");
        var videoControls = document.createElement("div");
        var playButton = document.createElement("img");
        var pauseButton = document.createElement("img");
        var elapsedTime = document.createElement("span");
        var totalTime = document.createElement("span");
        var elapsedBar = document.createElement("div");
        var progressBar = document.createElement("input");
        var volumeButton = document.createElement("img");
        var volumeControls = document.createElement("div");
        var volumeBar = document.createElement("input");
        var setVolumeBar = document.createElement("div");
        var progressBarProgress;
        var tempProgress = 0;

        theCSS.rel  = "stylesheet";
        theCSS.type = "text/css";
        theCSS.href = "controls/ixr-7-controls.css";
        videoControls.id = "ixrVideoControls";
        playButton.id = "playButton";
        pauseButton.id = "pauseButton";
        elapsedTime.id = "elapsedTime";
        totalTime.id = "totalTime";
        progressBar.id = "progressBar";
        progressBar.type = "range";
        progressBar.min = 0;
        progressBar.max = 1000;
        elapsedBar.id = "elapsedBar";
        volumeButton.id = "volumeButton";
        volumeControls.id = "ixrVolumeControls";
        volumeBar.id = "volumeBar";
        volumeBar.type = "range";
        volumeBar.min = 0;
        volumeBar.max = 100;
        volumeBar.value = 100;
        setVolumeBar.id = "setVolumeBar";

        playButton.src = "controls/PlayArrowFilled.png";
        pauseButton.src = "controls/PauseFilled.png";
        volumeButton.src = "controls/VolumeUpFilled.png";

        //Calculate Controls Position
        if (typeof calculatedVideoHeight !== "undefined" && calculatedVideoHeight > 0) {
            videoControls.style.top = 562 + 'px';
            volumeControls.style.top = 614 + 'px';
        } else {
            videoControls.style.top = videoHeight + 'px';
            volumeControls.style.top = videoHeight + 50 + 'px';
        }

        //Duration Logic
        setInterval(function(){
            var seconds = Math.floor(theVideo.currentTime);
            var minutes = 0;
            
            if (seconds > 59) {
                minutes = Math.floor(seconds / 60);
                seconds = seconds - (60 * minutes);
            }

            if (minutes < 10) {
                minutes = "0" + minutes;
            }

            if (seconds < 10) {
                seconds = "0" + seconds;
            }

            elapsedTime.innerHTML = minutes + ":" + seconds;
        }, 100);

        function displayDuration() {
            var durationSeconds = Math.floor(theVideo.duration);
            var durationMinutes = 0;

            if (durationSeconds > 59) {
                durationMinutes = Math.floor(durationSeconds / 60);
                durationSeconds = durationSeconds - (60 * durationMinutes);
            }

            if (durationMinutes < 10) {
                durationMinutes = "0" + durationMinutes;
            }

            if (durationSeconds < 10) {
                durationSeconds = "0" + durationSeconds;
            }

            return durationMinutes + ":" + durationSeconds;
        }

        theVideo.onloadedmetadata = function() {
            totalTime.innerHTML = displayDuration();

            progressBarProgress = setInterval(function(){
                progressBar.value = (theVideo.currentTime / theVideo.duration) * 1000;
            }, 40);

            setInterval(function(){
                progressBar.style = "background: linear-gradient(to right, #fa6400 " + progressBar.value / 10 + "%, rgb(204, 204, 204) " + progressBar.value / 10 +"%)";
                elapsedBar.style = "background: linear-gradient(to right, #fa6400 " + progressBar.value / 10 + "%, rgb(204, 204, 204, 0) " + progressBar.value / 10 +"%)";

                if (theVideo.currentTime === theVideo.duration) {
                    pauseButton.style.display = "none";
                    playButton.style.display = "block";
                }
            }, 40);
        }
       
        //ControlActions
        function ixrVideoPlay() {
            playButton.style.display = "none";
            pauseButton.style.display = "block";
            if (theVideo.currentTime === theVideo.duration) {
                progressBar.value = 0;
            }
            theVideo.play();
        }

        function ixrVideoPause() {
            pauseButton.style.display = "none";
            playButton.style.display = "block";
            theVideo.pause();
        }

        function ixrVideoFastForward() {
            clearInterval(progressBarProgress);
            tempProgress = progressBar.value * 0.001 * theVideo.duration;
        }

        function ixrVolumeDisplay() {
            if (volumeControlsVisible === false) {
                volumeControls.style.display = "block";
                volumeControlsVisible = true;
            } else {
                volumeControls.style.display = "none";
                volumeControlsVisible = false;
            }
        }

        function ixrVolumeAdjustment() {
            theVideo.volume = volumeBar.value / 100;
            volumeBar.style = "background: linear-gradient(to right, #fa6400 " + volumeBar.value + "%, rgb(204, 204, 204) " + volumeBar.value +"%)";
            setVolumeBar.style = "background: linear-gradient(to right, #fa6400 " + volumeBar.value + "%, rgb(204, 204, 204, 0) " + volumeBar.value +"%)";
        }

        ixrVolumeAdjustment();

        theVideo.addEventListener("play", ixrVideoPlay);
        theVideo.addEventListener("pause", ixrVideoPause);
        playButton.addEventListener("click", ixrVideoPlay);
        pauseButton.addEventListener("click", ixrVideoPause);
        progressBar.addEventListener("input", ixrVideoFastForward);
        volumeButton.addEventListener("click", ixrVolumeDisplay);
        volumeBar.addEventListener("input", ixrVolumeAdjustment);

        progressBar.onchange = function(){
            theVideo.currentTime = tempProgress;

            progressBarProgress = setInterval(function(){
                progressBar.value = (theVideo.currentTime / theVideo.duration) * 1000;
            }, 40);
        }

        //Append Controls
        videoControls.appendChild(playButton);
        videoControls.appendChild(pauseButton);
        videoControls.appendChild(elapsedTime);
        videoControls.appendChild(totalTime);
        videoControls.appendChild(elapsedBar);
        videoControls.appendChild(progressBar);
        videoControls.appendChild(volumeButton);
        volumeControls.appendChild(setVolumeBar);
        volumeControls.appendChild(volumeBar);

        document.head.appendChild(theCSS);
        if (navigator.userAgent.includes("Chrome/69")) {
            if (typeof appHost !== 'undefined') {
                appHost.requestVideoControls("videoId", needsVisibleControls);
            } else {
                theVideo.parentNode.appendChild(videoControls);
                theVideo.parentNode.appendChild(volumeControls);
            }
        } else {
            theVideo.parentNode.appendChild(videoControls);
            theVideo.parentNode.appendChild(volumeControls);
            appHost.requestVideoControls("videoId", needsVisibleControls);
        }
    }

    deviceVideoControlsOn();
});