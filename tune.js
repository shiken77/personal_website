/* Happy tune: an original loop synthesised in the browser (no audio file), shared by intro.html and index.html.
 *
 * <script src="tune.js" data-theme="dark" data-pos="bottom-left" data-auto="1"></script>
 *   data-auto="1"  start on the visitor's first click or key press (browsers block sound before that)
 *   otherwise      resume only if the tune was playing on the previous page of this visit
 * The loop position is kept in sessionStorage so the music carries on across pages.
 */
(function () {
  var script = document.currentScript || {dataset: {}};
  var dark = script.dataset.theme === 'dark', auto = script.dataset.auto === '1', left = script.dataset.pos === 'bottom-left';
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- button ---------- */
  var css = document.createElement('style');
  css.textContent =
    '.tune-btn{position:fixed;' + (left ? 'left' : 'right') + ':22px;bottom:22px;z-index:900;display:flex;align-items:center;gap:8px;height:42px;padding:0 15px 0 13px;border-radius:999px;' +
    'font:600 11.5px/1 ' + (dark ? "-apple-system,'Hiragino Sans','PingFang SC',system-ui,sans-serif" : 'var(--mono)') + ';letter-spacing:.5px;cursor:' + (dark ? 'pointer' : 'none') + ';' +
    (dark ? 'border:1px solid rgba(238,242,255,.35);background:rgba(17,26,53,.85);color:#eef2ff;' : 'border:1.5px solid var(--orange);background:var(--bg2);color:var(--orange);box-shadow:0 6px 20px rgba(160,121,90,.18);') +
    'transition:transform .2s,background .2s,color .2s}' +
    '.tune-btn:hover{transform:translateY(-2px)}' +
    '.tune-btn.on{' + (dark ? 'background:#eef2ff;color:#0b1124' : 'background:var(--orange);color:#fff') + '}' +
    '.tune-btn.wait{animation:tune-pulse 1.2s ease-in-out infinite}' +
    '@keyframes tune-pulse{50%{transform:scale(1.07)}}' +
    '.tune-bars{display:flex;align-items:flex-end;gap:2px;height:14px}' +
    '.tune-bars i{width:3px;height:4px;border-radius:2px;background:currentColor}' +
    '.tune-btn.on .tune-bars i{animation:tune-bounce .5s ease-in-out infinite alternate}' +
    '.tune-btn.on .tune-bars i:nth-child(2){animation-delay:.15s}.tune-btn.on .tune-bars i:nth-child(3){animation-delay:.3s}' +
    '@keyframes tune-bounce{from{height:3px}to{height:14px}}' +
    '@media(max-width:600px){.tune-btn .tune-label{display:none}.tune-btn{padding:0 13px;bottom:16px;' + (left ? 'left' : 'right') + ':16px}}';
  document.head.appendChild(css);
  var btn = document.createElement('button');
  btn.className = 'tune-btn'; btn.type = 'button';
  btn.innerHTML = '<span class="tune-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="tune-label"></span>';
  document.body.appendChild(btn);
  var LABEL = {
    en: {play: '♪ Happy tune', pause: '♪ Pause', wait: '♪ Tap to continue'},
    ja: {play: '♪ ハッピーな曲', pause: '♪ 一時停止', wait: '♪ タップで続きを再生'},
    zh: {play: '♪ 快乐小曲', pause: '♪ 暂停', wait: '♪ 点击继续播放'}
  };
  var waiting = false;
  function label() {
    var l = document.documentElement.lang || 'en', t = LABEL[l.slice(0, 2)] || LABEL.en;
    var text = waiting ? t.wait : playing ? t.pause : t.play;
    btn.querySelector('.tune-label').textContent = text;
    btn.setAttribute('aria-label', text);
    btn.setAttribute('aria-pressed', playing);
    btn.classList.toggle('on', playing);
    btn.classList.toggle('wait', waiting);
  }
  new MutationObserver(label).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});

  /* ---------- score: C major, I–V–vi–IV with a lifted second half; one entry per eighth note ---------- */
  var BPM = 128, EIGHTH = 30 / BPM, LOOP = 128;
  var N = {B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84, D6: 86};
  var MELODY = [
    'E5 G5 A5 G5 E5 D5 C5 D5', 'E5 D5 B4 D5 G5 - F5 E5', 'C5 E5 A5 G5 E5 C5 D5 E5', 'F5 A5 C6 A5 G5 F5 E5 D5',
    'E5 G5 C6 B5 A5 G5 E5 G5', 'D6 B5 G5 B5 A5 G5 F5 D5', 'C5 F5 A5 F5 G5 E5 C5 D5', 'B4 D5 G5 F5 E5 D5 C5 -'
  ].join(' ').split(' ').map(function (n) { return n === '-' ? null : N[n]; });
  var CHORDS = [[48, 60, 64, 67], [43, 59, 62, 67], [45, 60, 64, 69], [41, 60, 65, 69], [48, 60, 64, 67], [43, 59, 62, 67], [41, 60, 65, 69], [43, 59, 62, 65]];
  var STRUM = [1, 0, 0, 1, 1, 0, 1, 1]; // ukulele-style down, down-up, down-up

  /* ---------- synth ---------- */
  var ctx = null, master = null, noise = null, playing = false, step = 0, nextTime = 0, timer = null;
  var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  function voice(type, freq, t, dur, gain, attack) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + (attack || .005));
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + .05);
  }
  function pluck(m, t, gain) { // soft ukulele-like pluck: filtered saw with a quick decay
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz(m);
    f.type = 'lowpass'; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(500, t + .25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + .5);
  }
  function shaker(t, gain) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = 'highpass'; f.frequency.value = 6000;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + .08);
  }
  function play(i, t) {
    var bar = Math.floor(i / 8) % 8, beat = i % 8, pass = Math.floor(i / 64) % 2, m = MELODY[i % 64], ch = CHORDS[bar];
    if (m != null) {
      voice('triangle', hz(m), t, .32, .2);                    // marimba-ish lead
      voice('sine', hz(m + 12), t, .18, .05);                  // bright overtone
      if (pass === 1) voice('sine', hz(m + 24), t, .5, .025);  // glockenspiel sparkle on the second pass
    }
    if (STRUM[beat]) for (var k = 1; k < 4; k++) pluck(ch[k], t + k * .012, .045);
    if (beat === 0 || beat === 4) voice('triangle', hz(ch[0]), t, .4, .2, .01);
    if (beat === 6 && pass === 1) voice('triangle', hz(ch[0] + 7), t, .25, .12, .01);
    shaker(t, beat % 2 ? .05 : .025);
  }
  function schedule() {
    while (nextTime < ctx.currentTime + .12) { play(step % LOOP, nextTime); step++; nextTime += EIGHTH; }
  }
  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * .1, ctx.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function begin() {
    // carry on from where the loop would be if it had kept playing since it first started
    var t0 = +store.get('tuneT0');
    if (!t0) { t0 = Date.now(); store.set('tuneT0', t0); }
    step = Math.floor((Date.now() - t0) / 1000 / EIGHTH);
    nextTime = ctx.currentTime + .05;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(.55, ctx.currentTime + .8);
    clearInterval(timer);
    timer = setInterval(schedule, 25);
    playing = true; waiting = false;
    store.set('tuneOn', '1');
    label();
  }
  function start() {
    ensureCtx();
    if (ctx.state === 'running') { begin(); return; }
    ctx.resume().then(function () { if (ctx.state === 'running' && !playing) begin(); });
  }
  function stop() {
    clearInterval(timer);
    if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + .4);
    }
    playing = false; waiting = false;
    store.set('tuneOn', '0');
    label();
  }
  btn.addEventListener('click', function () { playing ? stop() : start(); });

  /* ---------- starting rules ---------- */
  var wanted = store.get('tuneOn');
  function onFirstGesture(e) {
    if (btn.contains(e.target)) return; // the button handles itself
    removeGesture();
    if (!playing && store.get('tuneOn') !== '0') start();
  }
  function removeGesture() { ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { removeEventListener(t, onFirstGesture, true); }); }
  function armGesture() { ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { addEventListener(t, onFirstGesture, true); }); }
  if (wanted === '1') {
    // the tune was playing on the previous page: try to continue at once, otherwise on the first tap
    ensureCtx();
    ctx.resume().then(function () { if (ctx.state === 'running' && !playing) begin(); });
    setTimeout(function () { if (!playing && store.get('tuneOn') === '1') { waiting = true; label(); armGesture(); } }, 400);
  } else if (auto && wanted !== '0') {
    armGesture();
  }
  label();
})();
