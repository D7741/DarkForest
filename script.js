const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Light streak (reusable emphasis element) ----------
   Usage: createLightStreak(containerEl, { top: '40%', left: '10%', width: '60%', delay: 0 })
   Appends a one-shot animated streak, then removes itself when the animation ends. */
function createLightStreak(container, options = {}) {
  if (reducedMotion || !container) return null;
  const el = document.createElement('div');
  el.className = 'light-streak';
  el.style.top = options.top || '50%';
  el.style.left = options.left || '0%';
  el.style.width = options.width || '100%';
  if (options.delay) el.style.animationDelay = `${options.delay}ms`;
  el.addEventListener('animationend', () => el.remove());
  container.appendChild(el);
  return el;
}

/* ---------- Starfield ---------- */

(function starfield() {
  const canvas = document.getElementById('starfield');
  const ctx = canvas.getContext('2d');
  let stars = [];
  let width, height;

  const target = { x: 0, y: 0 };
  const offset = { x: 0, y: 0 };
  const maxShift = 18;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    const count = Math.min(320, Math.floor((width * height) / 4500));
    stars = new Array(count).fill(0).map((_, i) => {
      const r = Math.random() * 1.2 + 0.3;
      const featured = i % 32 === 0; // a handful of larger, glinting accent stars
      const tint = Math.random();
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: featured ? r + 1.4 : r,
        depth: 0.2 + (r - 0.3) / 1.2 * 0.8,
        baseAlpha: Math.random() * 0.5 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.6 + 0.2,
        featured,
        // subtle warm/cool variance instead of flat white
        color: tint < 0.15
          ? '199, 210, 255'
          : tint > 0.85
            ? '255, 240, 220'
            : '237, 239, 243',
      };
    });
  }

  function updatePointer(clientX, clientY) {
    target.x = (clientX / width) * 2 - 1;
    target.y = (clientY / height) * 2 - 1;
  }

  if (!reducedMotion) {
    window.addEventListener('pointermove', (e) => updatePointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener('pointerleave', () => { target.x = 0; target.y = 0; });
  }

  const driftSpeed = 95; // px/sec at full depth, right-to-left

  function draw(t) {
    if (!reducedMotion) {
      offset.x += (target.x - offset.x) * 0.04;
      offset.y += (target.y - offset.y) * 0.04;
    }

    ctx.clearRect(0, 0, width, height);

    // subtle vignette
    const vignette = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    vignette.addColorStop(0, 'rgba(5,7,13,0)');
    vignette.addColorStop(1, 'rgba(5,7,13,0.6)');

    for (const s of stars) {
      const twinkle = reducedMotion ? 0 : Math.sin(t * 0.001 * s.speed + s.phase) * 0.3;
      const alpha = Math.max(0, Math.min(1, s.baseAlpha + twinkle));

      let sx = s.x;
      if (!reducedMotion) {
        const drift = (t * 0.001 * driftSpeed * (0.25 + s.depth * 0.75)) % width;
        sx = ((s.x - drift) % width + width) % width;
      }
      const sy = s.y + offset.y * maxShift * s.depth;
      sx += offset.x * maxShift * s.depth;

      if (s.featured) {
        const glintAlpha = Math.max(0.4, alpha);
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(${s.color}, 0.9)`;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color}, ${glintAlpha})`;
        ctx.fill();
        ctx.shadowBlur = 0;

        const spikeLen = s.r * 3.2;
        ctx.strokeStyle = `rgba(${s.color}, ${glintAlpha * 0.55})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(sx - spikeLen, sy);
        ctx.lineTo(sx + spikeLen, sy);
        ctx.moveTo(sx, sy - spikeLen);
        ctx.lineTo(sx, sy + spikeLen);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color}, ${alpha})`;
        ctx.fill();
      }
    }

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  window.addEventListener('resize', resize);
  resize();

  window.__drawStarfield = draw;
})();

/* ---------- Hero WebGL shader ---------- */

(function heroShader() {
  if (reducedMotion) return;

  const canvas = document.getElementById('hero-shader-canvas');
  if (!canvas) return;

  let gl;
  try {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
  } catch (e) {
    gl = null;
  }
  if (!gl) return;

  const vertexSrc = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

  // Adapted from a shader by Matthias Hurrle (@atzedent), recolored from
  // amber/fire tones to a cool deep-space palette.
  const fragmentSrc = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)
float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(in vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);float a=rnd(i),b=rnd(i+vec2(1,0)),c=rnd(i+vec2(0,1)),d=rnd(i+1.);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;mat2 m=mat2(1.,-.5,.2,1.2);for(int i=0;i<5;i++){t+=a*noise(p);p*=2.*m;a*=.5;}return t;}
float clouds(vec2 p){float d=1.,t=.0;for(float i=.0;i<3.;i++){float a=d*fbm(i*10.+p.x*.2+.2*(1.+i)*p.y+d+i*i+p);t=mix(t,d,a);d=a;p*=2./(i+1.);}return t;}
void main(void){
  vec2 uv=(FC-.5*R)/MN,st=uv*vec2(2,1);
  vec3 col=vec3(0);
  float bg=clouds(vec2(st.x+T*.5,-st.y));
  uv*=1.-.3*(sin(T*.2)*.5+.5);
  for(float i=1.;i<12.;i++){
    uv+=.1*cos(i*vec2(.1+.01*i,.8)+i*i+T*.5+.1*uv.x);
    vec2 p=uv;
    float d=length(p);
    col+=.00125/d*((cos(sin(i)*vec3(1,2,3))+1.)*vec3(0.7,0.82,1.0));
    float b=noise(i+p+bg*1.731);
    col+=.002*b/length(max(p,vec2(b*p.x*.02,p.y)))*vec3(0.75,0.85,1.0);
    col=mix(col,vec3(bg*.05,bg*.08,bg*.16),d);
  }
  float a=clamp(length(col)*1.15,0.1,0.92);
  O=vec4(col,a);
}`;

  function compile(shader, source) {
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return false;
    }
    return true;
  }

  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!compile(vs, vertexSrc) || !compile(fs, fragmentSrc)) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);

  const positionLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const resolutionLoc = gl.getUniformLocation(program, 'resolution');
  const timeLoc = gl.getUniformLocation(program, 'time');

  const dpr = Math.max(1, 0.5 * window.devicePixelRatio);

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  const minFade = 0.62; // nebula stays rich throughout, never washes out to plain stars

  function render(now) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    gl.uniform1f(timeLoc, now * 1e-3);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Cheap per-frame fade: a style write, not a shader/geometry recompute.
    const fade = Math.max(minFade, 1 - window.scrollY / (window.innerHeight * 3));
    canvas.style.opacity = fade;

    requestAnimationFrame(render);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(render);
})();

/* ---------- Cursor spotlight (reusable) ----------
   Soft glow that eases toward the cursor within a container. Used by the
   Sophon card and the chatboxes. */

function initSpotlight(card, glow) {
  if (!card || !glow || reducedMotion) return;

  let targetX = 0, targetY = 0, x = 0, y = 0, active = false;

  card.addEventListener('pointermove', (e) => {
    const rect = card.getBoundingClientRect();
    targetX = e.clientX - rect.left;
    targetY = e.clientY - rect.top;
    active = true;
  });
  card.addEventListener('pointerleave', () => { active = false; });

  function raf() {
    if (active) {
      x += (targetX - x) * 0.15;
      y += (targetY - y) * 0.15;
      glow.style.transform = `translate(${x - 190}px, ${y - 190}px)`;
    }
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

initSpotlight(document.getElementById('sophon-card'), document.getElementById('sophon-spotlight'));
initSpotlight(document.getElementById('chatbox-1'), document.getElementById('chatbox-1-spotlight'));
initSpotlight(document.getElementById('chatbox-2'), document.getElementById('chatbox-2-spotlight'));

/* ---------- Sophon card: unfolding-proton WebGL visual ---------- */

(function sophonShader() {
  if (reducedMotion) return;

  const canvas = document.getElementById('sophon-canvas');
  const container = canvas ? canvas.closest('.card-visual') : null;
  if (!canvas || !container) return;

  let gl;
  try {
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false });
  } catch (e) {
    gl = null;
  }
  if (!gl) return;

  const vertexSrc = `#version 300 es
precision highp float;
in vec4 position;
void main(){gl_Position=position;}`;

  const fragmentSrc = `#version 300 es
precision highp float;
out vec4 O;
uniform vec2 resolution;
uniform float time;
#define FC gl_FragCoord.xy
#define T time
#define R resolution
#define MN min(R.x,R.y)
float rnd(vec2 p){p=fract(p*vec2(12.9898,78.233));p+=dot(p,p+34.56);return fract(p.x*p.y);}
float noise(in vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);float a=rnd(i),b=rnd(i+vec2(1,0)),c=rnd(i+vec2(0,1)),d=rnd(i+1.);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm(vec2 p){float t=.0,a=1.;mat2 m=mat2(1.,-.5,.2,1.2);for(int i=0;i<5;i++){t+=a*noise(p);p*=2.*m;a*=.5;}return t;}
void main(void){
  vec2 uv=(FC-.5*R)/MN;
  float r=length(uv);
  float ang=atan(uv.y,uv.x);

  float rot=T*0.25;
  float lon=sin(ang*6.0+rot*3.0+r*8.0);
  float lat=cos(r*18.0-T*0.8);
  float grid=smoothstep(0.94,1.0,max(abs(lon),abs(lat)));

  float sphere=smoothstep(0.62,0.6,r);
  float rim=smoothstep(0.62,0.58,r)-smoothstep(0.6,0.56,r);
  float haze=fbm(uv*3.0+T*0.15);

  vec3 base=vec3(0.55,0.68,0.95);
  vec3 col=vec3(0.0);
  col+=grid*sphere*base*0.8;
  col+=rim*base*1.4;
  col+=haze*0.05*base;
  col+=exp(-r*3.5)*0.6*base;

  float a=clamp(length(col)*1.1,0.0,0.95);
  O=vec4(col,a);
}`;

  function compile(shader, source) {
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return false;
    }
    return true;
  }

  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  if (!compile(vs, vertexSrc) || !compile(fs, fragmentSrc)) return;

  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, -1, -1, 1, 1, 1, -1]), gl.STATIC_DRAW);

  const positionLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const resolutionLoc = gl.getUniformLocation(program, 'resolution');
  const timeLoc = gl.getUniformLocation(program, 'time');

  const dpr = Math.max(1, 0.5 * window.devicePixelRatio);

  function resize() {
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(now) {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
    gl.uniform1f(timeLoc, now * 1e-3);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(render);
})();

/* ---------- Chat sequence ---------- */

(function chatSequence() {
  const chatbox1 = document.getElementById('chatbox-1');
  const chatbox2 = document.getElementById('chatbox-2');
  const record = document.getElementById('record');
  const confirmBtn = document.getElementById('confirm-btn');
  const negotiate = document.getElementById('negotiate');
  const reasonInput = document.getElementById('reason-input');
  const demandInput = document.getElementById('demand-input');
  const transmitBtn = document.getElementById('transmit-btn');
  const exchange = document.getElementById('exchange');
  const humanLine = document.getElementById('human-line');
  const typedReply = document.getElementById('typed-reply');
  if (!chatbox1 || !chatbox2 || !record || !confirmBtn || !negotiate
    || !reasonInput || !demandInput || !transmitBtn || !exchange || !humanLine || !typedReply) return;

  const messages = {
    'chat-1': "hi human... sorry to bother you. our three suns keep destroying our planet and we've been looking for a new home for a while now. earth looks nice. we don't need much — just, uh, the whole planet, if that's okay? any support helps 🙏",
    'chat-2': "one more thing, sorry. turns out interstellar petrol isn't cheap and our fleet account is basically empty. we've been coasting on fumes since the last chaotic era. even one dollar would help top off the tank. no pressure. really. just, uh, please 🙏",
  };

  const replyTemplates = [
    'oh hahaha, yes. we will absolutely do that, right after we take the earth 🙏',
    'haha noted: "{demand}". huge fan of that idea. very doable. right after the invasion paperwork clears.',
    'yes! 100%. "{demand}" is at the very top of the list. a very long list. right after we take earth.',
    'hah, love the honesty. "{demand}" — absolutely, we will circle back on that the moment the planet is ours.',
    'oh that\'s a good one. "{demand}", noted. filed under: things we will definitely remember to do, probably.',
  ];

  function type(el, message, onDone) {
    const box = el.closest('.chatbox');
    if (reducedMotion) {
      el.textContent = message;
      if (onDone) onDone();
      return;
    }
    if (window.__waveformTalking) window.__waveformTalking();
    if (box) box.classList.add('is-transmitting');
    let i = 0;
    const interval = setInterval(() => {
      const ch = message[i];
      el.textContent += ch;

      if (window.__waveformPulse) {
        if (ch === '.' && message[i + 1] === '.') {
          // mid-run of an ellipsis — wait for the closing dot
        } else if (ch === '.' && message[i - 1] === '.' && message[i - 2] === '.') {
          window.__waveformPulse('ellipsis');
        } else if (ch === ',') {
          window.__waveformPulse('comma');
        } else if (ch === '.') {
          window.__waveformPulse('period');
        }
      }

      i++;
      if (i >= message.length) {
        clearInterval(interval);
        if (window.__waveformSettle) window.__waveformSettle();
        if (box) box.classList.remove('is-transmitting');
        if (onDone) onDone();
      }
    }, 26);
  }

  const typed1 = chatbox1.querySelector('[data-message="chat-1"]');
  const typed2 = chatbox2.querySelector('[data-message="chat-2"]');

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        setTimeout(() => {
          type(typed1, messages['chat-1'], () => {
            setTimeout(() => record.classList.add('is-visible'), reducedMotion ? 0 : 300);
          });
        }, reducedMotion ? 0 : 500);
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.3 });

  io.observe(chatbox1);

  function revealChatbox2() {
    chatbox2.classList.add('is-active');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chatbox2.classList.add('is-visible');
        chatbox2.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
        setTimeout(() => type(typed2, messages['chat-2']), reducedMotion ? 0 : 600);
      });
    });
  }

  confirmBtn.addEventListener('click', () => {
    if (confirmBtn.disabled) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = '> DOMICILE_CONFIRMED';

    negotiate.classList.add('is-visible');
    setTimeout(() => reasonInput.focus(), reducedMotion ? 0 : 650);
  }, { once: true });

  function transmit() {
    if (transmitBtn.disabled) return;
    const reason = reasonInput.value.trim() || 'no particular reason';
    const demand = demandInput.value.trim() || 'your request';

    reasonInput.disabled = true;
    demandInput.disabled = true;
    transmitBtn.disabled = true;
    transmitBtn.textContent = '> TRANSMITTED';

    if (window.__incrementTransmissionCount) window.__incrementTransmissionCount();

    exchange.classList.add('is-visible');

    const humanText = `> REASON: "${reason}"\n> DEMAND: "${demand}"`;

    setTimeout(() => {
      type(humanLine, humanText, () => {
        const template = replyTemplates[Math.floor(Math.random() * replyTemplates.length)];
        const reply = template.replace('{demand}', demand);
        setTimeout(() => {
          type(typedReply, reply, () => {
            setTimeout(revealChatbox2, reducedMotion ? 0 : 800);
          });
        }, reducedMotion ? 0 : 500);
      });
    }, reducedMotion ? 0 : 300);
  }

  transmitBtn.addEventListener('click', transmit, { once: true });

  [reasonInput, demandInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        transmit();
      }
    });
  });
})();

/* ---------- Transmission counter (simulated, frontend-only) ----------
   Cosmetic counter for the fictional site. Stored per-visitor in
   localStorage — not a real shared count and makes no network request.
   Between visits it grows by a small, time-based simulated amount; the
   current visitor's own successful transmission adds exactly +1. */

(function transmissionCounter() {
  const COUNT_KEY = 'df_transmission_count';
  const TS_KEY = 'df_transmission_ts';
  const MIN_START = 18000;
  const MAX_START = 30000;
  const SECONDS_PER_TRANSMISSION = 40;
  const MAX_GROWTH_PER_VISIT = 1500;

  const valueEl = document.getElementById('transmission-counter-value');
  if (!valueEl) return;

  function formatCount(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  function save(count, ts) {
    try {
      localStorage.setItem(COUNT_KEY, String(count));
      localStorage.setItem(TS_KEY, String(ts));
    } catch (e) {}
  }

  let count = 0;
  let storedTs = 0;
  try {
    count = Number(localStorage.getItem(COUNT_KEY));
    storedTs = Number(localStorage.getItem(TS_KEY));
  } catch (e) {}

  const now = Date.now();

  if (!count || !storedTs) {
    count = Math.floor(MIN_START + Math.random() * (MAX_START - MIN_START));
  } else {
    const elapsedSeconds = Math.max(0, (now - storedTs) / 1000);
    const expected = elapsedSeconds / SECONDS_PER_TRANSMISSION;
    const jitter = 0.7 + Math.random() * 0.6;
    count += Math.min(Math.round(expected * jitter), MAX_GROWTH_PER_VISIT);
  }

  save(count, now);
  valueEl.textContent = formatCount(count);

  let incremented = false;
  window.__incrementTransmissionCount = function () {
    if (incremented) return;
    incremented = true;
    count += 1;
    save(count, Date.now());
    valueEl.textContent = formatCount(count);
  };
})();

/* ---------- Waveform ----------
   Replaces the alien avatar. Bars glide toward periodically-rerolled
   targets (not updated every frame) so motion looks like inertia, not
   jitter. `talking`/`pulse` hooks are called from the chat typewriter
   to sync perceived energy with the text being revealed. */

const updateWaveform = (function waveform() {
  const waveforms = Array.from(document.querySelectorAll('.waveform'));
  if (!waveforms.length) return () => {};

  const bars = waveforms.map((wf) => Array.from(wf.querySelectorAll('.wf-bar')));
  const barCount = bars[0] ? bars[0].length : 0;
  const center = (barCount - 1) / 2;

  // Tapered silhouette: center bars get more amplitude than edge bars.
  const barFactor = new Array(barCount).fill(0).map((_, i) => {
    const d = Math.abs(i - center) / (center || 1);
    return Math.max(0.28, Math.cos(d * Math.PI * 0.5));
  });

  const MAX_H = 30; // px, matches .wf-bar's intrinsic height
  const IDLE_H = 1.8;

  if (reducedMotion) {
    waveforms.forEach((wf, wi) => {
      bars[wi].forEach((bar, i) => {
        const h = IDLE_H + barFactor[i] * 3;
        bar.style.transform = `scaleY(${(h / MAX_H).toFixed(3)})`;
      });
    });
    return () => {};
  }

  let energy = 0.05;
  let targetEnergy = 0.05;
  let quiet = false;
  let lastReroll = 0;
  const rerollInterval = 110; // ms — how often bar targets change; frame-to-frame motion is just easing toward them

  const current = bars.map((set) => set.map(() => IDLE_H));
  const target = bars.map((set) => set.map(() => IDLE_H));

  function talking() {
    quiet = false;
    targetEnergy = 0.75 + Math.random() * 0.25;
  }

  function settle() {
    targetEnergy = 0.05;
  }

  function pulse(kind) {
    if (kind === 'comma') {
      targetEnergy = 0.2;
      setTimeout(() => { if (!quiet) targetEnergy = 0.7 + Math.random() * 0.3; }, 90);
    } else if (kind === 'period') {
      targetEnergy = 0.08;
      setTimeout(() => { if (!quiet) targetEnergy = 0.65 + Math.random() * 0.3; }, 220);
    } else if (kind === 'ellipsis') {
      quiet = true;
      targetEnergy = 0.14;
      setTimeout(() => { quiet = false; }, 520);
    }
  }

  window.__waveformTalking = talking;
  window.__waveformSettle = settle;
  window.__waveformPulse = pulse;

  return function update(t) {
    if (t - lastReroll > rerollInterval) {
      lastReroll = t;
      const burst = 0.5 + Math.random() * 0.5;
      for (let wi = 0; wi < bars.length; wi++) {
        for (let i = 0; i < barCount; i++) {
          const amp = (IDLE_H + burst * energy * (MAX_H - IDLE_H) * barFactor[i]) * (0.55 + Math.random() * 0.45);
          target[wi][i] = Math.min(MAX_H, Math.max(IDLE_H * 0.6, amp));
        }
      }
    }

    energy += (targetEnergy - energy) * 0.06;

    for (let wi = 0; wi < bars.length; wi++) {
      for (let i = 0; i < barCount; i++) {
        current[wi][i] += (target[wi][i] - current[wi][i]) * 0.18;
        bars[wi][i].style.transform = `scaleY(${(current[wi][i] / MAX_H).toFixed(3)})`;
      }
    }
  };
})();

/* ---------- Single animation loop ---------- */

(function mainLoop() {
  function frame(t) {
    if (window.__drawStarfield) window.__drawStarfield(t);
    updateWaveform(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ---------- Decrypt text ---------- */

function decryptText(el, options = {}) {
  if (!el || el.dataset.decrypted === 'true') return;
  el.dataset.decrypted = 'true';

  const speed = options.speed ?? 40;
  const stagger = options.stagger ?? 38;
  const startDelay = options.startDelay ?? 0;
  const jitter = options.jitter ?? 90;
  const pool = options.pool ?? '#%&@$?!*+=/{}[]<>~^';

  const text = el.textContent;

  if (reducedMotion) {
    el.textContent = text;
    return;
  }

  el.textContent = '';
  const chars = Array.from(text).map((ch) => {
    const span = document.createElement('span');
    span.className = 'dchar';
    span.textContent = ch;
    el.appendChild(span);
    return { span, ch };
  });

  const lockAt = chars.map((_, i) => startDelay + i * stagger + (Math.random() * 2 - 1) * jitter);
  const nextAt = new Array(chars.length).fill(0);
  const locked = chars.map((c) => c.ch === ' ');

  chars.forEach((c, i) => {
    if (!locked[i]) c.span.classList.add('is-scrambling');
  });

  const t0 = performance.now();

  function frame(now) {
    const elapsed = now - t0;
    let done = true;
    for (let i = 0; i < chars.length; i++) {
      if (locked[i]) continue;
      done = false;
      const { span, ch } = chars[i];
      if (elapsed >= lockAt[i]) {
        span.textContent = ch;
        span.classList.remove('is-scrambling');
        span.classList.add('is-locking');
        locked[i] = true;
      } else if (elapsed >= nextAt[i]) {
        span.textContent = pool.charAt(Math.floor(Math.random() * pool.length));
        nextAt[i] = elapsed + speed + Math.random() * 35;
      }
    }
    if (!done) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

(function decryptTriggers() {
  const targets = document.querySelectorAll('[data-decrypt]');
  if (!targets.length) return;

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        decryptText(entry.target);
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.4 });

  targets.forEach((t) => io.observe(t));
})();

/* ---------- Marquee ---------- */

(function initMarquees() {
  document.querySelectorAll('.marquee[data-speed]').forEach((el) => {
    const speed = parseFloat(el.dataset.speed);
    if (!isNaN(speed)) el.style.setProperty('--marquee-duration', `${speed}s`);
  });
})();

/* ---------- Scroll reveals ---------- */

(function reveals() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.2 });

  targets.forEach((t) => io.observe(t));
})();
