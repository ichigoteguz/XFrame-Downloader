import { useEffect, useRef, useState } from 'react';
import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny';
import { DEFAULT_SETTINGS, LIMITS, type Post } from './types';
import { PostFrameView } from './PostCard';
import { captureFrame } from './render';
import { createBenchmarkSource } from './benchmark';
import { exportVideo, inspectVideo, verifyAudioPassthrough } from './video';

const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="40" fill="#d6f675"/><text x="40" y="53" text-anchor="middle" font-family="Arial" font-size="36" fill="#161d0a">P</text></svg>');
const post: Post = { id:'qa', url:'https://x.com/postframe/status/20', author:{ name:'XFrame Downloader Studio', handle:'postframe', avatar, verified:true }, text:'Keep the motion. Keep the context.\n\nThe complete video, with its original audio, inside a static post frame. 🎬', facets:[], createdAt:'2026-11-09T17:00:00Z', media:[{id:'qa-video',type:'video',url:'',thumbnail:avatar,width:1280,height:720,formats:[]}], quote:{id:'quote',url:'https://x.com/postframe/status/21',author:{name:'The detail matters',handle:'studio',avatar,verified:false},text:'Rounded video edges. Sharp text. The whole post stays with you.',facets:[],createdAt:'2026-11-09T16:00:00Z',media:[]} };
const settings = {...DEFAULT_SETTINGS,theme:'dark' as const};
const selection = { postId:'qa', mediaId:'qa-video' };

function checkCanceled(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Benchmark canceled.', 'AbortError');
}
async function save(name:string, data:Blob|string, signal?: AbortSignal) {
  checkCanceled(signal);
  const response = await fetch(`${import.meta.env.BASE_URL}__qa/${name}`, {method:'POST',body:data,signal});
  if (!response.ok) throw new Error(`Could not save QA artifact ${name}`);
}
function waitForVideo(video: HTMLVideoElement, event: 'loadeddata' | 'seeked', signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const clean = () => { clearTimeout(timeout); video.removeEventListener(event, ready); video.removeEventListener('error', fail); signal.removeEventListener('abort', cancel); };
    const ready = () => { clean(); resolve(); };
    const fail = () => { clean(); reject(new Error(`Export playback failed while waiting for ${event}.`)); };
    const cancel = () => { clean(); reject(new DOMException('Benchmark canceled.', 'AbortError')); };
    const timeout = setTimeout(() => { clean(); reject(new Error(`Export playback timed out while waiting for ${event}.`)); }, 30_000);
    video.addEventListener(event, ready, { once: true });
    video.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
  });
}
async function stillAt(blob:Blob, time:number, signal: AbortSignal) {
  checkCanceled(signal);
  const video = document.createElement('video'); const url = URL.createObjectURL(blob);
  let playback: { duration: number; target: number; currentTime: number; readyState: number; seekable: number[][] };
  try {
    video.muted = true; video.preload = 'auto';
    const loaded = waitForVideo(video, 'loadeddata', signal);
    video.src = url;
    await loaded;
    const seeked = waitForVideo(video, 'seeked', signal);
    const target = Math.max(0, Math.min(time, video.duration - .1));
    video.currentTime = target;
    await seeked;
    checkCanceled(signal);
    playback = { duration: video.duration, target, currentTime: video.currentTime, readyState: video.readyState, seekable: Array.from({ length: video.seekable.length }, (_, i) => [video.seekable.start(i), video.seekable.end(i)]) };
    if (!Number.isFinite(video.duration) || video.duration <= 0 || Math.abs(video.currentTime - time) > .1) throw new Error(`Browser seek did not reach requested timestamp ${time}; reached ${video.currentTime}.`);
  } finally {video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
  // A seeked event does not prove the canvas sees the newly presented texture.
  // Decode by timestamp for canonical stills; keep browser seek diagnostics separate.
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const cancelDecode = () => input.dispose();
  signal.addEventListener('abort', cancelDecode, { once: true });
  try {
    checkCanceled(signal);
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('Export has no video track to decode.');
    const decoded = await new CanvasSink(track).getCanvas(time);
    checkCanceled(signal);
    if (!decoded || !Number.isFinite(decoded.timestamp) || !Number.isFinite(decoded.duration) || decoded.duration < 0 || decoded.timestamp > time + .01 || time - decoded.timestamp > Math.max(decoded.duration, 1 / 30) + .01) throw new Error(`Decoded frame does not match requested timestamp ${time}.`);
    const canvas = document.createElement('canvas');
    canvas.width = decoded.canvas.width; canvas.height = decoded.canvas.height;
    canvas.getContext('2d')!.drawImage(decoded.canvas, 0, 0);
    const png = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No screenshot')),'image/png'));
    checkCanceled(signal);
    return { blob: png, details: { requestedTimestamp: time, decodedTimestamp: decoded.timestamp, decodedDuration: decoded.duration, browserSeek: playback } };
  } finally { signal.removeEventListener('abort', cancelDecode); input.dispose(); }
}

async function saveStills(blob: Blob, seconds: number, signal: AbortSignal) {
  const frames = [];
  for (const [label, time] of [['first', Math.min(.1, seconds / 4)], ['middle', seconds / 2], ['final', Math.max(0, seconds - .2)]] as const) {
    const still = await stillAt(blob, time, signal);
    await save(`decoded-${label}.png`, still.blob, signal);
    frames.push({ label, artifact: `decoded-${label}.png`, ...still.details });
  }
  return frames;
}

export default function Benchmark() {
  const root=useRef<HTMLDivElement>(null); const abort=useRef<AbortController|null>(null);
  const [status,setStatus]=useState('Ready');const [busy,setBusy]=useState(false); const [result,setResult]=useState('');const [output,setOutput]=useState('');
  const [duration, setDuration] = useState(Math.min(600, LIMITS.videoSeconds));
  const [existingFile, setExistingFile] = useState<File | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output); }, [output]);
  async function run(seconds:number) {
    if (busy) return;
    setBusy(true);setResult('');setOutput('');abort.current=new AbortController();
    const signal = abort.current.signal;
    const report:Record<string,unknown>={browser:navigator.userAgent,seconds,started:new Date().toISOString(),limits:LIMITS};
    const started = performance.now();
    try {
      setStatus(`Generating ${seconds}-second 1280×720 H.264/AAC source…`);
      const source=await createBenchmarkSource(seconds,{signal,onProgress:p=>setStatus(`Generating ${seconds}-second source: ${Math.round(p*100)}%`)});report.sourceGenerationMs=Math.round(performance.now()-started);report.sourceBytes=source.size;report.source=await inspectVideo(source);
      checkCanceled(signal);
      setStatus('Capturing static dark post + quote…');
      const frame=await captureFrame(root.current!,settings,{videoMode:true,videoSize:{width:1280,height:720}});report.frame={width:frame.width,height:frame.height,aperture:frame.aperture};
      await save('frame.png',frame.blob,signal);
      // Cancel after real encoding work, then retry the same full-length source.
      // Long runs exercise worker cleanup without encoding the complete file twice.
      setStatus('Checking cancellation after encoding starts…');
      const cancel=new AbortController();let canceled=false;let canceledProgress=0;
      const cancelStarted=performance.now();
      const cancelFromUser=()=>cancel.abort();signal.addEventListener('abort',cancelFromUser,{once:true});
      try {
        await exportVideo(source,frame,{signal:cancel.signal,onProgress:p=>{canceledProgress=p;if(p>=.05)cancel.abort();}});
      } catch(error) { canceled=error instanceof DOMException&&error.name==='AbortError'; }
      finally { signal.removeEventListener('abort',cancelFromUser); }
      checkCanceled(signal);
      if(!canceled||canceledProgress<.05)throw new Error('Cancellation after encoding starts did not reject with AbortError');
      report.cancellation={ok:true,progress:canceledProgress,elapsedMs:Math.round(performance.now()-cancelStarted)};
      setStatus('Retrying complete framed MP4 export…');const encodeStart=performance.now();
      const encoded=await exportVideo(source,frame,{signal,onProgress:p=>setStatus(`Encoding framed MP4: ${Math.round(p*100)}%`)});
      report.encodeMs=Math.round(performance.now()-encodeStart);report.outputBytes=encoded.size;report.output=await inspectVideo(encoded,{output:true});
      const meta=report.output as Awaited<ReturnType<typeof inspectVideo>>;
      if (!meta.hasAudio || Math.abs(meta.duration-seconds)>.1 || meta.width!==frame.width || meta.height!==frame.height) throw new Error('Output metadata failed acceptance check');
      report.retryAfterCancellation=true;
      checkCanceled(signal);
      report.audioPassthrough=await verifyAudioPassthrough(source,encoded,signal);
      checkCanceled(signal);
      if(!(report.audioPassthrough as {identical:boolean}).identical)throw new Error('AAC packet passthrough changed audio');
      setStatus('Verifying playback and saving first/middle/final frames…');
      // The dev artifact endpoint accepts 150 MiB. Keep larger results in the
      // playback element and retain metadata/stills without copying a giant MP4.
      if(encoded.size<=128*1024*1024){await save('output.mp4',encoded,signal);report.outputArtifact='output.mp4';}
      else report.outputArtifact='Not saved: above 128 MiB artifact threshold; playback and metadata still verified.';
      report.frames = await saveStills(encoded, seconds, signal);
      if(seconds===3){
        setStatus('Checking silent video, repeat export, PNG and JPEG…');
        const silent=await createBenchmarkSource(2,{signal,audio:false,width:720,height:1280});
        const silentResult=await exportVideo(silent,frame,{signal});
        const silentInfo=await inspectVideo(silentResult,{output:true});if(silentInfo.hasAudio)throw new Error('Silent source gained an audio track');report.silentPortrait=silentInfo;
        const repeated=await exportVideo(source,frame,{signal});report.repeat=(await inspectVideo(repeated,{output:true})).duration;
        checkCanceled(signal);
        const png=await captureFrame(root.current!,{...settings,format:'png'});const jpg=await captureFrame(root.current!,{...settings,format:'jpg'});
        if(png.blob.type!=='image/png'||jpg.blob.type!=='image/jpeg')throw new Error('Static format MIME check failed');report.staticFormats={png:png.blob.type,jpg:jpg.blob.type};
        await save('static.png',png.blob,signal);await save('static.jpg',jpg.blob,signal);
      }
      checkCanceled(signal);setOutput(URL.createObjectURL(encoded));
      report.ok=true;setStatus('PASS — framed MP4 plays with audio and correct duration');
    } catch(error) {
      if(signal.aborted){report.canceled=true;setStatus('CANCELED — resources released; ready for another run');}
      else {report.ok=false;report.error=String(error);setStatus(`FAIL — ${String(error)}`);}
    }
    finally {report.totalMs=Math.round(performance.now()-started);setResult(JSON.stringify(report,null,2));await save('report.json',JSON.stringify(report,null,2)).catch(()=>{});setBusy(false);abort.current=null;}
  }
  async function verifyExisting(file: File) {
    if (busy) return;
    setBusy(true); setResult(''); setOutput(''); abort.current = new AbortController();
    const signal = abort.current.signal;
    const report: Record<string, unknown> = { verificationOnly: true, fileName: file.name, outputBytes: file.size, browser: navigator.userAgent, started: new Date().toISOString(), audioPassthrough: 'Not compared: original source is not supplied. Audio synchronization is not measured.' };
    const started = performance.now();
    try {
      setStatus('Inspecting existing MP4 without generating or converting…');
      const metadata = await inspectVideo(file, { output: true }); report.output = metadata;
      checkCanceled(signal);
      setStatus('Checking browser seeks and decoding first/middle/final frames…');
      report.frames = await saveStills(file, metadata.duration, signal);
      checkCanceled(signal); setOutput(URL.createObjectURL(file));
      report.ok = true; setStatus('PASS — existing MP4 seeks and decoded frames match requested timestamps; source audio not compared');
    } catch (error) {
      if (signal.aborted) { report.canceled = true; setStatus('CANCELED — existing-file verification stopped'); }
      else { report.ok = false; report.error = String(error); setStatus(`FAIL — ${String(error)}`); }
    } finally {
      report.totalMs = Math.round(performance.now() - started);
      setResult(JSON.stringify(report, null, 2));
      await save('verification-report.json', JSON.stringify(report, null, 2)).catch(() => {});
      setBusy(false); abort.current = null;
    }
  }
  return <main style={{maxWidth:1050,margin:'40px auto',padding:24,color:'var(--ink)',fontFamily:'Arial'}}><h1>XFrame Downloader export acceptance test</h1><p>Development-only test: synthetic moving 720p video + AAC audio, static dark frame and quote. Each run cancels an active export, retries it, and checks duration, audio packets, dimensions and playback.</p><div style={{display:'flex',gap:12,flexWrap:'wrap',margin:'20px 0'}}><button disabled={busy} onClick={()=>run(3)}>Run 3-second smoke test</button><button disabled={busy} onClick={()=>run(120)}>Run two-minute acceptance test</button><label>Long test seconds <input aria-label="Long test seconds" type="number" min={1} max={LIMITS.videoSeconds} step={1} value={duration} disabled={busy} onChange={event=>setDuration(Number(event.target.value))}/></label><button disabled={busy||!Number.isInteger(duration)||duration<1||duration>LIMITS.videoSeconds} onClick={()=>run(duration)}>Run long-video acceptance test</button><button disabled={!busy} onClick={()=>abort.current?.abort()}>Cancel export</button></div><fieldset disabled={busy} style={{marginBottom:20}}><legend>Verify an existing MP4 without converting</legend><p>Checks output metadata, browser seeking, and canonical decoded frames. Original source audio is not compared; synchronization is not measured.</p><label>Existing MP4 <input aria-label="Existing MP4" type="file" accept="video/mp4,.mp4" onChange={event=>setExistingFile(event.target.files?.[0] || null)}/></label><button disabled={busy||!existingFile} onClick={()=>{if(existingFile)void verifyExisting(existingFile);}}>Verify existing MP4</button></fieldset><p role="status">{status}</p><pre style={{whiteSpace:'pre-wrap'}}>{result}</pre>{output&&<video src={output} controls style={{maxWidth:750,width:'100%'}}/>}<div style={{position:'absolute',left:-10000,top:0,width:600}}><PostFrameView ref={root} post={post} settings={settings} selection={selection} blankVideo /></div></main>;
}
