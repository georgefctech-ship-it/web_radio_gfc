import { io, Socket } from 'socket.io-client';

export interface DeckState {
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  name: string;
}

export class BroadcasterEngine {
  private audioCtx: AudioContext;
  private deck1: HTMLAudioElement;
  private deck2: HTMLAudioElement;
  private deck1Source: MediaElementAudioSourceNode;
  private deck2Source: MediaElementAudioSourceNode;
  private deck1Gain: GainNode;
  private deck2Gain: GainNode;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode;
  private masterGain: GainNode;
  private destination: MediaStreamAudioDestinationNode;
  private analyser: AnalyserNode;
  private mediaRecorder: MediaRecorder | null = null;
  private socket: Socket;
  
  private crossfadeValue: number = 0.5; // 0 = Deck 1, 1 = Deck 2
  
  constructor(socket: Socket) {
    this.socket = socket;
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Decks
    this.deck1 = new Audio();
    this.deck1.crossOrigin = "anonymous";
    this.deck2 = new Audio();
    this.deck2.crossOrigin = "anonymous";
    
    this.deck1Source = this.audioCtx.createMediaElementSource(this.deck1);
    this.deck2Source = this.audioCtx.createMediaElementSource(this.deck2);
    
    this.deck1Gain = this.audioCtx.createGain();
    this.deck2Gain = this.audioCtx.createGain();
    this.micGain = this.audioCtx.createGain();
    this.masterGain = this.audioCtx.createGain();
    
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    
    this.destination = this.audioCtx.createMediaStreamDestination();
    
    // Connections
    this.deck1Source.connect(this.deck1Gain);
    this.deck2Source.connect(this.deck2Gain);
    
    this.deck1Gain.connect(this.masterGain);
    this.deck2Gain.connect(this.masterGain);
    this.micGain.connect(this.masterGain);
    
    this.masterGain.connect(this.analyser);
    this.masterGain.connect(this.destination);
    
    // Default volumes
    this.updateCrossfade(0.5);
    this.micGain.gain.value = 0; // Mic off by default
  }

  async startMic() {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          sampleRate: 48000
        } 
      });
      this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
      this.micSource.connect(this.micGain);
      return true;
    } catch (err) {
      console.error("Error accessing microphone:", err);
      return false;
    }
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
  }

  setMicVolume(volume: number) {
    this.micGain.gain.setTargetAtTime(volume, this.audioCtx.currentTime, 0.01);
  }

  loadDeck(deckNum: 1 | 2, url: string, name: string) {
    const deck = deckNum === 1 ? this.deck1 : this.deck2;
    deck.src = url;
    deck.load();
  }

  playDeck(deckNum: 1 | 2) {
    const deck = deckNum === 1 ? this.deck1 : this.deck2;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    deck.play();
  }

  pauseDeck(deckNum: 1 | 2) {
    const deck = deckNum === 1 ? this.deck1 : this.deck2;
    deck.pause();
  }

  updateCrossfade(value: number) {
    this.crossfadeValue = value;
    // Equal power crossfade
    const gain1 = Math.cos(value * 0.5 * Math.PI);
    const gain2 = Math.cos((1.0 - value) * 0.5 * Math.PI);
    
    this.deck1Gain.gain.setTargetAtTime(gain1, this.audioCtx.currentTime, 0.01);
    this.deck2Gain.gain.setTargetAtTime(gain2, this.audioCtx.currentTime, 0.01);
  }

  getLevels() {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    return average / 255; // 0 to 1
  }

  startStreaming() {
    if (this.mediaRecorder) return;
    
    const stream = this.destination.stream;
    // Use Opus if available
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
      ? 'audio/webm;codecs=opus' 
      : 'audio/webm';
      
    this.mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond: 96000
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.socket.emit('live:stream-data', event.data);
      }
    };

    this.mediaRecorder.start(200); // 200ms chunks for low latency
    this.socket.emit('live:start');
  }

  stopStreaming() {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }
    this.socket.emit('live:stop');
  }

  getDeckState(deckNum: 1 | 2): DeckState {
    const deck = deckNum === 1 ? this.deck1 : this.deck2;
    return {
      isPlaying: !deck.paused,
      volume: deckNum === 1 ? this.deck1Gain.gain.value : this.deck2Gain.gain.value,
      progress: deck.currentTime,
      duration: deck.duration || 0,
      name: deck.src.split('/').pop() || ''
    };
  }
  
  destroy() {
    this.stopStreaming();
    this.stopMic();
    this.deck1.pause();
    this.deck2.pause();
    this.audioCtx.close();
  }
}
