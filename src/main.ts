import './assets/css/main.scss';
import {SpotifyManager} from './SpotifyManager';
import {Particles} from './Particles';

require('file-loader?name=[name].[ext]!./index.html');

const app = document.getElementById('app');
// Creates the spotify manager
const config = require('./config.json');
const spotifyManager = new SpotifyManager(config.ClientId, config.RedirectUri, config.SocketServer);

const init = (): void => {

    spotifyManager.onTokenSet(() => {
        if (!spotifyManager.tokenExists()) {
            app.innerHTML = document.querySelector('#connect-template').innerHTML;
            document.querySelector('#connect-button').addEventListener('click', () => {
                spotifyManager.requestToken();
            });
        } else {
            app.innerHTML = document.querySelector('#app-template').innerHTML;

            spotifyManager.on('initial_state', (event) => {
                if (event.item)
                    setSongData(event.item);
                spotifyManager.setIsPlaying(event.is_playing);
                updateButton();
            });

            spotifyManager.on('connect_error', (event) => {
                console.log(event);
            });

            spotifyManager.on('track_change', (track) => {
                setSongData(track);
            });

            spotifyManager.getMe().then(e => setUserData(e));

            const button = document.getElementById('playPause');
            button.addEventListener('click', () => {
                spotifyManager.playPause();
                updateButton();
            });

            clock();
        }
    });
    Particles.create('particles');
};

const clock = () => {
    const today = new Date();

    document.getElementById('hour').innerHTML = today.getHours() < 10 ? '0' + today.getHours() : today.getHours() + '';
    document.getElementById('minutes').innerHTML = today.getMinutes() < 10 ? '0' + today.getMinutes() : today.getMinutes() + '';


    document.getElementById('day').innerHTML = today.getDate() + '';
    document.getElementById('month').innerHTML = today.toLocaleString('es-es', { month: 'long' });
    document.getElementById('year').innerHTML = today.getFullYear() + '';

    setTimeout(clock, 500);
};

const updateButton = () => {
    const button = document.getElementById('playPause');
    if (spotifyManager.getIsPlaying()) {
        button.innerHTML = '<i class="icon ion-md-pause"></i>';
    } else {
        button.innerHTML = '<i class="icon ion-md-play"></i>';
    }
};

const setSongData = (track: any) => {
    document.getElementById('background').style.backgroundImage = `url("${track.album.images[0].url}")`;
    document.getElementById('albumName').innerHTML = track.album.name;
    document.getElementById('songName').innerHTML = track.name;
    document.getElementById('authorName').innerHTML = track.artists[0].name;

};

const setUserData = (data: any) => {
    document.getElementById('userImg').style.backgroundImage = `url("${data.images[0].url}")`;
    document.getElementById('userName').innerHTML = data.display_name;
    document.getElementById('userFollowers').innerHTML = data.followers.total < 2 ? data.followers.total + ' seguidor' : data.followers.total + ' seguidores';
};


init();