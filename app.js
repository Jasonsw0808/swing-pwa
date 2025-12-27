const elFile = document.getElementById("file");
const elVideo = document.getElementById("video");
const elCanvas = document.getElementById("canvas");
const elAnalyze = document.getElementById("analyze");
const elClear = document.getElementById("clear");
const elLog = document.getElementById("log");
const elMeta = document.getElementById("meta");

const ev = document.getElementById("ev");
const la = document.getElementById("la");
const dist = document.getElementById("dist");
const impact = document.getElementById("impact");
const landing = document.getElementById("landing");

let currentObjectUrl = null;

function log(msg) {
  elLog.textContent += msg + "\n";
  elLog.scrollTop = elLog.scrollHeight;
}

function setMeta(msg) {
  elMeta.textContent = msg;
}

function resetStats() {
  ev.textContent = "—";
  la.textContent = "—";
  dist.textContent = "—";
  impact.textContent = "—";
  landing.textContent = "—";
}

function cleanupVideoUrl() {
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = null;
}

elFile.addEventListener("change", async (e) => {
  try {
    resetStats();
    elLog.textContent = "";
    const file = e.target.files?.[0];
    if (!file) return;

    log(`Selected: ${file.name} (${Math.round(file.size/1024/1024)} MB)`);
    cleanupVideoUrl();

    currentObjectUrl = URL.createObjectURL(file);
    elVideo.src = currentObjectUrl;
    elVideo.load();

    setMeta("Loading video metadata…");

    await once(elVideo, "loadedmetadata");
    setMeta(`Video loaded: ${elVideo.videoWidth}x${elVideo.videoHeight}, duration ${elVideo.duration.toFixed(2)}s`);
    log("loadedmetadata OK");

    elAnalyze.disabled = false;
    elClear.disabled = false;
  } catch (err) {
    log("ERROR loading video: " + (err?.message || err));
  }
});

elClear.addEventListener("click", () => {
  elFile.value = "";
  elVideo.removeAttribute("src");
  elVideo.load();
  cleanupVideoUrl();
  elAnalyze.disabled = true;
  elClear.disabled = true;
  setMeta("");
  elLog.textContent = "";
  resetStats();
});

elAnalyze.addEventListener("click", async () => {
  try {
    elAnalyze.disabled = true;
    log("Starting analysis…");

    // ⚠️ iPhone memory: keep it short.
    // For 240fps slo-mo, start by sampling fewer frames (e.g., 60 fps equivalent).
    const sampleFps = 60;
    const maxSecondsToProcess = Math.min(2.0, elVideo.duration); // start with 2 seconds
    log(`Sampling at ~${sampleFps} fps for up to ${maxSecondsToProcess}s`);

    const frames = await extractFrames(elVideo, elCanvas, sampleFps, maxSecondsToProcess);

    log(`Extracted frames: ${frames.length}`);
    log("Running placeholder analyzer…");

    // Placeholder analyzer: demonstrates you can compute something from frames.
    // Replace analyzeFrames(...) with your ball/bat/contact tracking or ML inference.
    const result = analyzeFramesPlaceholder(frames);

    ev.textContent = result.exitVelo;
    la.textContent = result.launchAngle;
    dist.textContent = result.distance;
    impact.textContent = result.impactPoint;
    landing.textContent = result.landing;

    log("Done.");
  } catch (err) {
    log("ERROR analyzing: " + (err?.message || err));
  } finally {
    elAnalyze.disabled = false;
  }
});

function once(target, eventName) {
  return new Promise((resolve) => {
    const handler = () => {
      target.removeEventListener(eventName, handler);
      resolve();
    };
    target.addEventListener(eventName, handler);
  });
}

async function extractFrames(videoEl, canvasEl, fps, maxSeconds) {
  // Ensure video can play frame-by-frame in Safari
  // (We don't need to actually "play" it, just seek)
  const ctx = canvasEl.getContext("2d", { willReadFrequently: true });
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;

  const frames = [];
  const dt = 1 / fps;
  const n = Math.floor(maxSeconds / dt);

  for (let i = 0; i <= n; i++) {
    const t = i * dt;
    await seek(videoEl, t);
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
    const img = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
    frames.push({ t, img });
    if (i % 10 === 0) log(`Frame ${i}/${n} @ t=${t.toFixed(3)}s`);
  }
  return frames;
}

function seek(videoEl, timeSec) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      videoEl.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onError = () => {
      videoEl.removeEventListener("error", onError);
      reject(new Error("Video seek error"));
    };
    videoEl.addEventListener("seeked", onSeeked);
    videoEl.addEventListener("error", onError, { once: true });
    videoEl.currentTime = Math.min(timeSec, Math.max(0, videoEl.duration - 0.001));
  });
}

function analyzeFramesPlaceholder(frames) {
  // This is NOT real baseball tracking yet.
  // It proves your pipeline works end-to-end (video -> frames -> output).

  // Example: compute average brightness change as a "motion proxy"
  // so you see values change when the clip changes.
  let sum = 0;
  for (let i = 1; i < frames.length; i++) {
    sum += frameDiff(frames[i-1].img.data, frames[i].img.data);
  }
  const motionScore = sum / Math.max(1, frames.length - 1);

  // Fake outputs for now:
  return {
    exitVelo: `(${motionScore.toFixed(1)}) demo`,
    launchAngle: `—`,
    distance: `—`,
    impactPoint: `—`,
    landing: `—`
  };
}

function frameDiff(a, b) {
  // downsample to reduce CPU
  let d = 0;
  const step = 40; // bigger step = faster
  for (let i = 0; i < a.length; i += 4 * step) {
    const ar = a[i], ag = a[i+1], ab = a[i+2];
    const br = b[i], bg = b[i+1], bb = b[i+2];
    d += Math.abs(ar - br) + Math.abs(ag - bg) + Math.abs(ab - bb);
  }
  return d / (a.length / (4 * step));
}
