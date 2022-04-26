let channel = null;
let agentIsOnline = false;
let waitingGame = true;
let fieldData = {};
let isPlayingVideo = false;

const pingVideo = "https://league-of-memes.s3.eu-central-1.amazonaws.com/videos/chuck_approves.mp4";
const logSuffix = '[League of Memes]';

window.addEventListener('onEventReceived', function (obj) {
    console.log(logSuffix, 'received something!', obj);

    if (obj.detail.listener === 'event:test') {
        const currentEvent = obj.detail.event;
        console.log(logSuffix, 'received test event!', currentEvent);

        if (currentEvent && currentEvent.type === 'ping') {
            agentIsOnline = true;
        }
        if (currentEvent && currentEvent.type === 'test_event') {
            agentIsOnline = true;
            onVideoReceived(pingVideo);
        }
        if (currentEvent && currentEvent.type === 'new_game') {
            waitingGame = false;
        }
        if (currentEvent && currentEvent.type === 'waiting_game') {
            waitingGame = true;
        }
        if (currentEvent && currentEvent.type === 'video' && !!currentEvent.value && fieldData[currentEvent.value] !== 'undefined') {
            onVideoReceived(fieldData[currentEvent.value]);
        }

        updateView();
    }
});

window.addEventListener('onWidgetLoad', function (obj) {
    console.log(logSuffix, 'has Started!', obj);
    fieldData = obj.detail.fieldData;
    updateView();
});

function updateView() {
    $('.main-container .offline-agent').toggle(!agentIsOnline);
    $('.main-container .online-agent').toggle(agentIsOnline);
    $('.main-container .waiting-game').toggle(waitingGame);
}

function onVideoReceived(src) {
    if (isPlayingVideo) {
        return;
    }

    isPlayingVideo = true;

    let source = document.createElement('source');
    source.src = src;
    source.type = 'video/mp4';

    let video = document.createElement("video");
    video.style.width = "100%";
    video.style.height = "100%";
    video.autoplay = false;
    video.onended = function() {
        console.log('video ended');
        isPlayingVideo = false;
        $('.main-container .online-agent .video').html('');
    };
    video.addEventListener('error', function(event) {
        console.log('video error', event);
        isPlayingVideo = false;
        $('.main-container .online-agent .video').html('');
    }, true);

    video.appendChild(source);
    $('.main-container .online-agent .video').html(video);

    setTimeout(function () {
        console.log('will play the video');
        video.play().then(r => {
            console.log('video played');
        }).catch(e => {
            console.log('video error', e);
            isPlayingVideo = false;
            $('.main-container .online-agent .video').html('');
        });
    }, 500);
}