import * as io from 'socket.io-client';
import * as SpotifyApi from 'spotify-web-api-js';

const Spotify = require('spotify-web-api-js');
const queryString = require('querystring');
const ls = require('local-storage');

interface AccessTokenResponse {
    error?: string;
    access_token?: string;
    refresh_token?: string;
}

export class SpotifyManager {

    private socket: SocketIOClient.Socket;
    private tokenSetCallback: Function;
    private spotifyApi: SpotifyApi.default.SpotifyWebApiJs;
    private isPlaying: boolean;

    public static generateRandomString(length: number): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public constructor(private clientId: string, private redirectUri: string, private socketServer: string) {
        this.socket = io.connect(this.socketServer + '/connect');
        this.spotifyApi = new Spotify();

        this.setToken().then((data) => {
            if (ls('access_token')) {
                this.socket.emit('initiate', {accessToken: ls('access_token')});
                this.spotifyApi.setAccessToken(ls('access_token'));
            }
            if (this.tokenSetCallback) this.tokenSetCallback();
        });

        setInterval(() => {
            this.refreshToken().then(() => {
                console.log('token refreshed via autorefresh');
            });
        }, 30 * 60 * 1000);

    }

    public setIsPlaying(bool: boolean) {
        if (bool !== null)
            this.isPlaying = bool;
    }

    public getIsPlaying(): boolean {
        return this.isPlaying;
    }

    public playPause(): void {
        if (this.isPlaying) {
            this.socket.emit('pause');
            this.isPlaying = false;
        } else {
            this.socket.emit('play');
            this.isPlaying = true;
        }
    }

    public async getMe(): Promise<any> {
        return await this.spotifyApi.getMe();
    }

    public on(eventName: string, callback: (res: any) => void) {
        this.socket.on(eventName, callback);
    }

    public onTokenSet(callback: (res: any) => void) {
        this.tokenSetCallback = callback;
    }

    public isTokenExpired(): boolean {
        return Math.abs(Date.now() - ls('last_token_request')) / 36e5 >= 1;
    }

    public tokenExists(): boolean {
        return ls('last_token_request') !== null;
    }

    private async setToken() {
        let data = await this.checkUrlForSpotifyAccessToken();
        if (data && !data.error) {
            ls('last_token_request', Date.now());
            ls('access_token', data.access_token);
            ls('refresh_token', data.refresh_token);
        } else if (this.tokenExists() && this.isTokenExpired()) {
            data = await this.refreshToken();
        }
        return data;
    }

    public requestToken(): void {
        ls.remove('access_token');
        ls.remove('refresh_token');

        window.open('https://accounts.spotify.com/authorize?' +
            queryString.stringify({
                response_type: 'code',
                client_id: this.clientId,
                scope: [
                    'user-read-playback-state',
                    'user-library-modify',
                    'streaming',
                    'user-read-private',
                    'user-follow-modify',
                    'user-library-read',
                    'user-read-birthdate',
                    'playlist-modify-public',
                    'user-read-currently-playing',
                    'user-modify-playback-state',
                    'user-follow-read',
                    'playlist-read-collaborative',
                    'playlist-read-private',
                    'app-remote-control',
                    'user-read-email',
                    'user-read-recently-played',
                    'playlist-modify-private'
                ],
                redirect_uri: this.redirectUri,
                state: SpotifyManager.generateRandomString(16)
            })
            , '_self');
    }

    private async refreshToken(): Promise<AccessTokenResponse> {

        console.log('Refreshing token..');

        if (!ls('refresh_token')) return new Promise<AccessTokenResponse>((resolve, reject) => {
            reject({
                error: 'There is not token to refresh'
            });
        });

        let requestHeaders: HeadersInit = new Headers();
        requestHeaders.set('Content-Type', 'application/json');

        const response = await fetch(this.socketServer + '/refresh_token', {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify({refresh_token: ls('refresh_token')})
        });

        const jsonResponse = await response.json();

        if (jsonResponse && !jsonResponse.error) {
            ls('last_token_request', Date.now());
            ls('access_token', jsonResponse.access_token);
            this.socket.emit('access_token', {accessToken: ls('access_token')});

            return jsonResponse;
        }

        return new Promise<AccessTokenResponse>((resolve, reject) => reject(
            {
                error: 'Error while refreshing token'
            }
        ));
    }

    private async checkUrlForSpotifyAccessToken(): Promise<AccessTokenResponse> {
        const params = SpotifyManager.getHashParams();
        const code = params.code;

        // If code wasn't found we return
        if (!code)
            return new Promise((resolve, reject) => {
                resolve({
                    error: 'No code found.'
                });
            });

        let body = {
            code: code,
            redirect_uri: this.redirectUri,
            grant_type: 'authorization_code'
        };


        let requestHeaders: HeadersInit = new Headers();
        requestHeaders.set('Content-Type', 'application/json');

        const response = await fetch(this.socketServer + '/token', {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(body)
        });

        return await response.json();
    }

    private static getHashParams() {
        // helper function to parse the query string that spotify sends back when you log in
        let hashParams: any = {};
        let e, r = /([^&;=]+)=?([^&;]*)/g,
            q = window.location.search.substring(1);
        // eslint-disable-next-line
        while (e = r.exec(q)) {
            hashParams[e[1]] = decodeURIComponent(e[2]);
        }
        return hashParams;
    }

}