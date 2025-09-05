let audioCtx=null, masterGain=null, bounceCount=0;
const scaleSemitones=[0,3,5,7,10,12,15,17];
// Melodien mit Tonhöhe (semi) und Dauer (dur). semi=null markiert eine Pause.
const melodyEntchen=[
  {semi:3,  dur:0.28}, {semi:5,  dur:0.28}, {semi:7,  dur:0.28},
  {semi:8,  dur:0.28}, {semi:10, dur:0.28}, {semi:10, dur:0.56},
  {semi:null,dur:0.3},
  {semi:12, dur:0.28}, {semi:12, dur:0.28}, {semi:10, dur:0.28}, {semi:10, dur:0.28},
  {semi:8,  dur:0.28}, {semi:8,  dur:0.28}, {semi:7,  dur:0.56},
  {semi:null,dur:0.3},
  {semi:5,  dur:0.28}, {semi:5,  dur:0.28}, {semi:3,  dur:0.28}, {semi:3, dur:0.56}
];
const melodyBond=[
  {semi:7, dur:0.3}, {semi:8, dur:0.3}, {semi:7, dur:0.3}, {semi:6, dur:0.3}, {semi:7, dur:0.6},
  {semi:3, dur:0.3}, {semi:2, dur:0.3}, {semi:2, dur:0.6},
  {semi:null,dur:0.3},
  {semi:7, dur:0.3}, {semi:8, dur:0.3}, {semi:7, dur:0.3}, {semi:6, dur:0.3}, {semi:7, dur:0.6},
  {semi:10,dur:0.3}, {semi:9, dur:0.3}, {semi:9, dur:0.6}
];
const melodyState={idx:0};
const seqState={idx:0,dir:1};
function isMelodyMode(){
  const ui=globalThis.state.ui;
  const m=ui.toneOrder.value;
  return (m==='melody_entchen'||m==='melody_bond');
}
function currentMelodyArray(){
  return (globalThis.state.ui.toneOrder.value==='melody_entchen')?melodyEntchen:melodyBond;
}
export function resetToneSeq(){
  const ui=globalThis.state.ui;
  const N=scaleSemitones.length;
  if (ui.toneOrder.value==='downup'){ seqState.idx=N-1; seqState.dir=-1; }
  else { seqState.idx=0; seqState.dir=1; }
  melodyState.idx=0;
}
function nextScaleIndex(){
  const ui=globalThis.state.ui;
  const N=scaleSemitones.length;
  const mode=ui.toneOrder.value;
  if (mode==='random') return Math.floor(Math.random()*N);
  const out=seqState.idx;
  seqState.idx+=seqState.dir;
  if (seqState.idx>=N-1 || seqState.idx<=0) seqState.dir*=-1;
  return out;
}
export function initAudio(){
  if(!audioCtx){
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    masterGain=audioCtx.createGain(); masterGain.gain.value=0.18; masterGain.connect(audioCtx.destination);
  }
  if(audioCtx.state==='suspended') audioCtx.resume();
  globalThis.state.audioCtx=audioCtx;
  globalThis.state.masterGain=masterGain;
}
export function playBounce(){
  if(!audioCtx) return;
  const ui=globalThis.state.ui;
  const elBounces=globalThis.state.elBounces;
  const t=audioCtx.currentTime;
  const shift=parseInt(ui.pitchShift.value,10)||0;
  const baseDur=Math.max(0.22, Math.min(5, parseFloat(ui.toneDur.value)||0.22));
  const type=ui.toneType.value;
  let freq, dur=baseDur, rest=false;
  if (isMelodyMode()){
    const arr=currentMelodyArray();
    const note=arr[melodyState.idx % arr.length];
    melodyState.idx=(melodyState.idx+1)%arr.length;
    dur = note.dur || baseDur;
    if(note.semi==null){
      rest=true;
    } else {
      const semiAbs=note.semi+shift;
      freq=220*Math.pow(2, semiAbs/12);
    }
  } else {
    const idx=nextScaleIndex();
    const octave=(Math.floor(bounceCount/scaleSemitones.length))%2;
    const semi=scaleSemitones[idx]+12*octave+shift;
    freq=220*Math.pow(2, semi/12);
  }
  if(rest){ bounceCount++; elBounces.textContent=bounceCount; return; }
  if (type==='noise'){
    const len=Math.max(0.05, Math.min(5, dur)), sr=audioCtx.sampleRate;
    const buffer=audioCtx.createBuffer(1, Math.floor(sr*len), sr);
    const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1);
    const src=audioCtx.createBufferSource(); src.buffer=buffer;
    const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq; bp.Q.value=2.5;
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.4,t+0.01); g.gain.exponentialRampToValueAtTime(0.0008,t+len);
    src.connect(bp); bp.connect(g); g.connect(masterGain); src.start(t); src.stop(t+len);
  } else if (type==='horn'){
    const osc=audioCtx.createOscillator(); osc.type='sawtooth'; osc.frequency.setValueAtTime(freq,t);
    const lfo=audioCtx.createOscillator(); lfo.type='sine'; lfo.frequency.value=6; const lfoG=audioCtx.createGain(); lfoG.gain.value=8;
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.5,t+0.02); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    lfo.connect(lfoG); lfoG.connect(osc.frequency); osc.connect(g); g.connect(masterGain); osc.start(t); lfo.start(t); osc.stop(t+dur+0.02); lfo.stop(t+dur+0.02);
  } else if (type==='fart'){
    const osc=audioCtx.createOscillator(); osc.type='square';
    const f0=Math.max(40, Math.min(160, freq*0.35)); osc.frequency.setValueAtTime(f0,t); osc.frequency.exponentialRampToValueAtTime(40,t+dur*0.8);
    const lp=audioCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=280;
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.6,t+0.015); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    osc.connect(lp); lp.connect(g); g.connect(masterGain); osc.start(t); osc.stop(t+dur+0.02);
  } else if (type==='pluck'){
    const len=Math.max(0.1, Math.min(3, dur)), sr=audioCtx.sampleRate;
    const buffer=audioCtx.createBuffer(1, Math.floor(sr*len), sr); const data=buffer.getChannelData(0); for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1);
    const src=audioCtx.createBufferSource(); src.buffer=buffer;
    const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=freq*2; bp.Q.value=8;
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.7,t+0.003); g.gain.exponentialRampToValueAtTime(0.0006,t+len);
    src.connect(bp); bp.connect(g); g.connect(masterGain); src.start(t); src.stop(t+len);
  } else {
    const osc=audioCtx.createOscillator(); osc.type=type; osc.frequency.setValueAtTime(freq,t);
    const g=audioCtx.createGain(); g.gain.setValueAtTime(0.001,t); g.gain.exponentialRampToValueAtTime(0.35,t+0.012); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    osc.connect(g); g.connect(masterGain); osc.start(t); osc.stop(t+dur+0.02);
  }
  bounceCount++; elBounces.textContent=bounceCount;
}
