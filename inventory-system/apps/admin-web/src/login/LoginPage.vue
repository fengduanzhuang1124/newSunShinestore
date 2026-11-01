<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

// Staff sign-in (CR-012). Only account + password is live; SMS sign-in and registration are shown but not open yet.
const username = defineModel<string>('username', { required: true });
const password = defineModel<string>('password', { required: true });
defineProps<{ loading: boolean; error: string; theme: 'light' | 'dark' }>();
const emit = defineEmits<{ submit: []; 'toggle-theme': [] }>();

const REMEMBER_KEY = 'sunshine_login_remembered_username';
// The lead line is white, the promise line violet.
const SLOGANS = [
  [{ text: '让阳光特产', tone: 'lead' }, { text: '再次伟大', tone: 'promise' }],
  [{ text: '阳光特产', tone: 'lead' }, { text: '一站式澳新好物专家', tone: 'promise' }],
];
const FEATURES = [
  { title: '库存管理', note: '扫码入库 · 盘点 · 临期', icon: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8' },
  { title: '管理端平台', note: '销售 · 进货 · 市场分析', icon: 'M4 19V9M10 19V5M16 19v-7M22 19H2' },
  { title: 'AI 智能助手', note: '阳光小助手 · 客服回复', icon: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' },
];

// Omega-3 / DHA / EPA loop over and under the capsule on an orbit tilted against it, so the two cross. The half
// facing away passes behind the capsule.
const NUTRIENTS = ['Omega-3', 'DHA', 'EPA'];
const ORBIT = { cx: 200, cy: 250, radius: 178, side: Math.sin((42 * Math.PI) / 180), tilt: (-38 * Math.PI) / 180, seconds: 12 };
const angle = ref(0);
const bubbles = computed(() => NUTRIENTS.map((label, index) => {
  const a = angle.value + (index * 2 * Math.PI) / NUTRIENTS.length;
  const depth = Math.sin(a);
  const dx = ORBIT.radius * ORBIT.side * depth;
  const dy = -ORBIT.radius * Math.cos(a);
  return {
    label,
    x: ORBIT.cx + dx * Math.cos(ORBIT.tilt) - dy * Math.sin(ORBIT.tilt),
    y: ORBIT.cy + dx * Math.sin(ORBIT.tilt) + dy * Math.cos(ORBIT.tilt),
    scale: 0.82 + 0.2 * depth,
    fade: 0.6 + 0.4 * (depth + 1) / 2,
    front: depth > 0,
  };
}));
// Glowing links between neighbouring bubbles, so the three nutrients read as one connected triangle; a link
// touching a front bubble belongs to the front layer.
const links = computed(() => bubbles.value.map((bubble, index) => {
  const next = bubbles.value[(index + 1) % bubbles.value.length];
  return { key: `${bubble.label}-${next.label}`, x1: bubble.x, y1: bubble.y, x2: next.x, y2: next.y, fade: (bubble.fade + next.fade) / 2, front: bubble.front || next.front };
}));
// Drawing order: bubbles and links behind the capsule first, then the capsule, then everything in front of it.
const layers = computed(() => (['back', 'front'] as const).map((name) => ({
  name,
  links: links.value.filter((link) => link.front === (name === 'front')),
  bubbles: bubbles.value.filter((bubble) => bubble.front === (name === 'front')),
})));
let frame = 0;
let started = 0;
function spin(now: number) {
  if (!started) started = now;
  angle.value = ((now - started) / 1000 / ORBIT.seconds) * 2 * Math.PI;
  frame = requestAnimationFrame(spin);
}
onMounted(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || typeof requestAnimationFrame !== 'function') return;
  frame = requestAnimationFrame(spin);
});
onBeforeUnmount(() => cancelAnimationFrame(frame));

// Fixed scatter of breathing particles (deterministic, so the layout never jumps between renders).
const PARTICLES = Array.from({ length: 40 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${4 + ((index * 53) % 92)}%`,
  size: `${2 + (index % 4)}px`,
  delay: `${-((index * 0.7) % 6).toFixed(1)}s`,
  duration: `${3 + (index % 4)}s`,
}));

const slogan = ref(0);
const tab = ref<'password' | 'code'>('password');
const showPassword = ref(false);
const notice = ref('');
const remember = ref(false);
try {
  const saved = localStorage.getItem(REMEMBER_KEY);
  if (saved) {
    remember.value = true;
    if (!username.value) username.value = saved;
  }
} catch { /* storage unavailable: nothing remembered */ }

// Only the account name is remembered, never the password.
function submit() {
  try {
    if (remember.value && username.value.trim()) localStorage.setItem(REMEMBER_KEY, username.value.trim());
    else localStorage.removeItem(REMEMBER_KEY);
  } catch { /* storage unavailable */ }
  emit('submit');
}
</script>

<template>
  <section class="lg" :class="theme">
    <i class="lg-glow a" aria-hidden="true"></i><i class="lg-glow b" aria-hidden="true"></i>
    <i class="lg-floor" aria-hidden="true"></i>
    <div class="lg-frame">
      <div class="lg-top">
        <img src="/sunshine-health-horizontal-logo.webp" alt="阳光特产 Sunshine Health" />
        <button class="lg-theme" type="button" :aria-label="theme === 'light' ? '切换到深色模式' : '切换到浅色模式'" @click="emit('toggle-theme')">
          <span aria-hidden="true">{{ theme === 'light' ? '☾' : '☀' }}</span>{{ theme === 'light' ? 'Dark' : 'Light' }}
        </button>
      </div>

      <div class="lg-body">
        <div class="lg-copy">
          <div class="lg-title">
            <Transition name="lg-swap" mode="out-in">
              <h1 :key="slogan"><span v-for="line in SLOGANS[slogan]" :key="line.text" :class="line.tone">{{ line.text }}</span></h1>
            </Transition>
            <button class="lg-switch" :class="{ wink: slogan === 1 }" type="button" aria-label="切换标语" title="切换标语" @click="slogan = (slogan + 1) % SLOGANS.length">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9 9.5v1.2" /><path class="eye-r" d="M15 9.5v1.2" /><path d="M8 14.2c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4" /></svg>
            </button>
          </div>
          <p class="lg-lead">库存管理、经营分析、AI 智能助手，门店日常一站完成</p>
          <ul class="lg-features">
            <li v-for="feature in FEATURES" :key="feature.title">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="feature.icon" /></svg>
              <strong>{{ feature.title }}</strong>
              <small>{{ feature.note }}</small>
            </li>
          </ul>
        </div>

        <div class="lg-scene" aria-hidden="true">
          <i v-for="(dot, index) in PARTICLES" :key="index" class="lg-dot" :style="{ left: dot.left, top: dot.top, width: dot.size, height: dot.size, animationDelay: dot.delay, animationDuration: dot.duration }"></i>
          <svg viewBox="0 0 400 520">
            <defs>
              <radialGradient id="lg-bubble" cx=".36" cy=".3" r=".75">
                <stop offset="0" class="stop-gold-0" />
                <stop offset=".55" class="stop-gold-1" />
                <stop offset="1" class="stop-gold-2" />
              </radialGradient>
              <linearGradient id="lg-bubble-rim" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" class="stop-white" />
                <stop offset=".5" class="stop-gold-2" />
                <stop offset="1" class="stop-white" />
              </linearGradient>
              <radialGradient id="lg-pool" cx=".5" cy=".5" r=".5">
                <stop offset="0" class="stop-c1" stop-opacity=".7" />
                <stop offset=".5" class="stop-c2" stop-opacity=".35" />
                <stop offset="1" class="stop-c2" stop-opacity="0" />
              </radialGradient>
              <linearGradient id="lg-beam" x1="0" x2="1">
                <stop offset="0" class="stop-c2" stop-opacity="0" />
                <stop offset=".6" class="stop-c1" stop-opacity=".7" />
                <stop offset="1" class="stop-white" />
              </linearGradient>
            </defs>

            <g class="lg-beams">
              <rect x="-360" y="472" width="560" height="2.5" rx="1.25" fill="url(#lg-beam)" transform="rotate(-6 200 474)" />
              <rect x="-360" y="474" width="560" height="1.5" rx=".75" fill="url(#lg-beam)" transform="rotate(5 200 474)" />
              <rect x="-300" y="473" width="500" height="1" fill="url(#lg-beam)" />
            </g>
            <g class="lg-rings"><circle cx="200" cy="250" r="150" /><circle cx="200" cy="250" r="200" /><circle cx="200" cy="250" r="245" /></g>
            <ellipse class="lg-pool" cx="200" cy="474" rx="160" ry="30" fill="url(#lg-pool)" />
            <g class="lg-ripples"><ellipse cx="200" cy="474" rx="64" ry="12" /><ellipse cx="200" cy="474" rx="64" ry="12" /><ellipse cx="200" cy="474" rx="64" ry="12" /></g>
            <polygon class="lg-tri-fill" :points="bubbles.map((bubble) => `${bubble.x},${bubble.y}`).join(' ')" />
            <line v-for="bubble in bubbles" :key="`line-${bubble.label}`" class="lg-link-line" x1="200" y1="250" :x2="bubble.x" :y2="bubble.y" :style="{ opacity: bubble.fade * 0.7 }" />
            <template v-for="layer in layers" :key="layer.name">
              <g v-if="layer.name === 'front'" class="lg-capsule"><image href="/login-fish-oil.webp" x="115" y="112" width="170" height="276" /></g>
              <line v-for="link in layer.links" :key="link.key" class="lg-tri-line" :x1="link.x1" :y1="link.y1" :x2="link.x2" :y2="link.y2" :style="{ opacity: 0.45 + 0.55 * link.fade }" />
              <g v-for="bubble in layer.bubbles" :key="bubble.label" class="lg-bubble" :transform="`translate(${bubble.x} ${bubble.y}) scale(${bubble.scale})`" :style="{ opacity: bubble.fade }">
                <circle r="38" fill="url(#lg-bubble)" /><circle r="38" class="lg-bubble-rim" /><circle r="33" class="lg-bubble-inner" /><ellipse cx="-12" cy="-17" rx="11" ry="6" class="lg-spec" /><path class="lg-glint" d="M26 -30l2.5 7 7 2.5-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5z" />
                <text y="5">{{ bubble.label }}</text>
              </g>
            </template>
          </svg>
        </div>

        <div class="lg-card">
          <h2>欢迎登录阳光特产</h2>
          <div class="lg-tabs" role="tablist" aria-label="登录方式">
            <button type="button" role="tab" :aria-selected="tab === 'password'" @click="tab = 'password'; notice = ''">密码登录</button>
            <button type="button" role="tab" :aria-selected="tab === 'code'" @click="tab = 'code'; notice = ''">验证码登录</button>
            <i class="lg-tab-bar" :class="tab"></i>
          </div>

          <form v-if="tab === 'password'" class="lg-form" @submit.prevent="submit">
            <label class="lg-field">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6" /></svg>
              <input v-model="username" autocomplete="username" autofocus placeholder="员工账号" aria-label="员工账号" />
            </label>
            <label class="lg-field">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></svg>
              <input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" placeholder="请输入密码" aria-label="密码" />
              <button class="lg-eye" type="button" :aria-label="showPassword ? '隐藏密码' : '显示密码'" @click="showPassword = !showPassword">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path v-if="!showPassword" d="M4 4l16 16" /></svg>
              </button>
            </label>
            <div class="lg-row">
              <label class="lg-check"><input v-model="remember" type="checkbox" />记住我</label>
              <button class="lg-link" type="button" @click="notice = '请联系管理员重置密码'">忘记密码</button>
            </div>
            <p v-if="error" class="lg-error" role="alert">{{ error }}</p>
            <button class="lg-submit" type="submit" :disabled="loading">{{ loading ? '登录中…' : '立即登录' }}</button>
          </form>

          <div v-else class="lg-form">
            <label class="lg-field disabled">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8v18H8zM11 18h2" /></svg>
              <input disabled placeholder="手机号" aria-label="手机号" />
            </label>
            <label class="lg-field disabled">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></svg>
              <input disabled placeholder="验证码" aria-label="验证码" />
              <button class="lg-link" type="button" disabled>获取验证码</button>
            </label>
            <p class="lg-note">验证码登录暂未开放，请使用账号密码登录。</p>
            <button class="lg-submit" type="button" @click="tab = 'password'">改用密码登录</button>
          </div>

          <p v-if="notice" class="lg-note" role="status">{{ notice }}</p>
          <p class="lg-foot">还没有账号？<button class="lg-link" type="button" @click="notice = '请联系管理员开通员工账号'">立即注册</button></p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Every colour comes from these tokens; the light theme (the pre-redesign login palette) only redefines them. */
@property --lg-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
.lg {
  /* Dark: layered charcoal (never pure black), white → #a0a0a0 → #6e6e6e text levels, colour kept for the CTA,
     selection and the hero. */
  --c1: 120 200 255;
  --c2: 110 140 255;
  --c3: 170 140 255;
  --page: radial-gradient(50% 45% at 42% 45%, rgb(70 90 190 / 20%), transparent 70%), radial-gradient(35% 35% at 88% 12%, rgb(130 100 220 / 14%), transparent 70%), linear-gradient(160deg, #1a1b22, #121318 55%, #16161d);
  --frame: linear-gradient(150deg, rgb(44 46 60 / 62%), rgb(28 28 34 / 74%) 50%, rgb(36 34 52 / 66%));
  --frame-edge: rgb(255 255 255 / 9%);
  --frame-light: rgb(255 255 255 / 10%);
  --shimmer: conic-gradient(from var(--lg-angle), transparent 0 58%, rgb(var(--c1)) 70%, #fff 75%, rgb(var(--c3)) 82%, transparent 92%);
  --ink: #ffffff;
  --muted: #a0a0a0;
  --disabled: #6e6e6e;
  --t-lead: rgb(255 255 255 / 94%);
  --t-promise: rgb(190 166 255 / 86%);
  --t-outline: transparent;
  --t-depth: 0 1px 0 rgb(200 210 255 / 55%), 0 2px 0 rgb(120 130 200 / 45%), 0 3px 0 rgb(70 76 130 / 50%), 0 4px 0 rgb(40 44 80 / 55%), 0 10px 18px rgb(0 0 0 / 45%);
  --frame-depth: 0 2px 0 rgb(150 160 230 / 22%), 0 5px 0 rgb(70 76 130 / 32%), 0 8px 0 rgb(30 32 60 / 50%);
  --card: rgb(30 31 38 / 46%);
  --line: rgb(255 255 255 / 9%);
  --field: rgb(255 255 255 / 4%);
  --accent: #8eaaff;
  --icon: rgb(120 200 255);
  --submit: linear-gradient(90deg, #a6ecfa, #c0adf7);
  --submit-ink: #15182a;
  --radius-control: 11px;
  --shadow: rgb(0 0 0 / 40%);
  --gold-0: #fffbef;
  --gold-1: rgb(255 214 120 / 55%);
  --gold-2: #d9a03a;
  --gold-ink: #9a6420;
  --tri: rgb(255 236 190 / 85%);
  position: fixed;
  z-index: 5;
  inset: 0;
  display: grid;
  padding: clamp(14px, 4vw, 56px);
  overflow: hidden auto;
  color: var(--ink);
  background: var(--page);
  perspective: 2200px;
}
.lg.light {
  /* Light: clear glass over a soft pink → lavender → sky wash (#fcaec1, #fcd1db, #b7a8d6, #add9f3), violet text. */
  --c1: 173 217 243;
  --c2: 183 168 214;
  --c3: 252 174 193;
  --page: radial-gradient(40% 45% at 6% 6%, rgb(252 174 193 / 55%), transparent 70%), radial-gradient(45% 50% at 96% 92%, rgb(173 217 243 / 65%), transparent 70%), radial-gradient(40% 40% at 60% 20%, rgb(183 168 214 / 30%), transparent 70%), linear-gradient(135deg, #f6eef4, #efedf7 45%, #e9eff8);
  --frame: radial-gradient(60% 55% at 0% 0%, rgb(252 209 219 / 30%), transparent 70%), radial-gradient(55% 55% at 100% 100%, rgb(173 217 243 / 28%), transparent 70%), linear-gradient(165deg, rgb(255 255 255 / 34%), rgb(255 255 255 / 16%));
  --frame-edge: rgb(255 255 255 / 70%);
  --frame-light: rgb(255 255 255 / 95%);
  --shimmer: conic-gradient(from var(--lg-angle), transparent 0 58%, #fcaec1 68%, #ffffff 74%, #b7a8d6 80%, #add9f3 86%, transparent 94%);
  --ink: #5d4b8e;
  --muted: #8c84a8;
  --disabled: #b8b1cc;
  --t-lead: rgb(255 255 255 / 96%);
  --t-promise: rgb(132 104 206 / 82%);
  --t-outline: rgb(140 112 205 / 55%);
  --t-depth: 0 1px 0 rgb(196 178 238 / 95%), 0 2px 0 rgb(168 146 224 / 90%), 0 3px 0 rgb(144 120 208 / 80%), 0 4px 0 rgb(124 100 192 / 65%), 0 10px 18px rgb(110 80 170 / 32%);
  --frame-depth: 0 2px 0 rgb(255 255 255 / 80%), 0 5px 0 rgb(226 216 244 / 70%), 0 8px 0 rgb(196 182 230 / 45%);
  --card: rgb(255 255 255 / 26%);
  --line: rgb(183 168 214 / 35%);
  --field: rgb(255 255 255 / 42%);
  --accent: #8a6fc8;
  --icon: #9a84d4;
  --submit: linear-gradient(90deg, #c4b3ea, #a996d8);
  --submit-ink: #fff;
  --radius-control: 999px;
  --shadow: rgb(140 110 190 / 20%);
  --gold-ink: #a8742e;
  --tri: rgb(255 255 255 / 95%);
}
.stop-white { stop-color: #fff; }
.stop-c1 { stop-color: rgb(var(--c1)); }
.stop-c2 { stop-color: rgb(var(--c2)); }
.stop-gold-0 { stop-color: var(--gold-0); }
.stop-gold-1 { stop-color: var(--gold-1); }
.stop-gold-2 { stop-color: var(--gold-2); }

.lg-glow { position: absolute; z-index: 0; border-radius: 50%; filter: blur(90px); pointer-events: none; animation: lg-breathe 3s ease-in-out infinite; }
.lg-glow.a { top: 18%; left: 22%; width: 34vw; height: 34vw; background: rgb(var(--c2) / 22%); }
.lg-glow.b { right: 8%; bottom: 10%; width: 26vw; height: 26vw; background: rgb(var(--c3) / 16%); animation-delay: -1.5s; }
@keyframes lg-breathe { 0%, 100% { opacity: .55; transform: scale(.96); } 50% { opacity: 1; transform: scale(1.04); } }

/* A thick glass slab centred on the screen, turned slightly towards the viewer and floating gently; a bright arc
   keeps running around its edge and a pool of light sits on the floor beneath it. */
.lg-frame {
  position: relative;
  z-index: 1;
  display: grid;
  width: min(1240px, 100%);
  margin: auto;
  overflow: hidden;
  border: 1px solid var(--frame-edge);
  border-radius: 28px;
  background: var(--frame);
  backdrop-filter: blur(20px) saturate(1.3);
  transform: rotateX(3deg) rotateY(-4deg);
  animation: lg-frame 3s ease-in-out infinite;
}
.lg-frame::before {
  position: absolute;
  inset: 0;
  padding: 1.5px;
  border-radius: inherit;
  content: "";
  background: var(--shimmer);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  pointer-events: none;
  animation: lg-spin 6s linear infinite;
}
@keyframes lg-spin { to { --lg-angle: 360deg; } }
@keyframes lg-frame {
  0%, 100% { transform: rotateX(3deg) rotateY(-4deg) translateY(0); box-shadow: inset 0 1px 0 var(--frame-light), inset 0 -1px 0 rgb(0 0 0 / 12%), var(--frame-depth), 0 34px 70px var(--shadow); }
  50% { transform: rotateX(3deg) rotateY(-4deg) translateY(-6px); box-shadow: inset 0 1px 0 var(--frame-light), inset 0 -1px 0 rgb(0 0 0 / 12%), var(--frame-depth), 0 42px 80px var(--shadow), 0 0 46px rgb(var(--c2) / 24%); }
}
.lg-floor { position: absolute; z-index: 0; right: 0; bottom: 3%; left: 0; width: min(1100px, 86vw); margin-inline: auto; height: 120px; border-radius: 50%; background: radial-gradient(50% 50% at 50% 50%, rgb(var(--c2) / 40%), rgb(var(--c3) / 14%) 50%, transparent 75%); filter: blur(18px); pointer-events: none; animation: lg-breathe 3s ease-in-out infinite; }

.lg-top { display: flex; align-items: center; justify-content: space-between; padding: 22px clamp(18px, 3vw, 44px) 0; }
.lg-top img { width: clamp(150px, 13vw, 200px); height: auto; filter: drop-shadow(0 4px 14px var(--shadow)); }
.lg-theme { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; color: var(--ink); border: 1px solid var(--line); border-radius: 999px; background: var(--field); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }

.lg-body {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(260px, .9fr) minmax(340px, 400px);
  align-items: center;
  gap: clamp(16px, 2.5vw, 40px);
  width: 100%;
  padding: 8px clamp(18px, 3vw, 44px) 36px;
}

.lg-title { display: flex; align-items: flex-start; gap: 14px; min-height: 2.5em; font-size: clamp(30px, 3vw, 46px); }
/* Raised lettering: a stack of 1px offsets gives the words depth; the lead line and the promise take different colours. */
.lg-title h1 { display: grid; margin: 0; font-size: 1em; font-weight: 900; line-height: 1.28; letter-spacing: .03em; text-shadow: var(--t-depth); }
.lg-title h1 span { white-space: nowrap; }
.lg-title h1 .lead { color: var(--t-lead); -webkit-text-stroke: .6px var(--t-outline); }
.lg-title h1 .promise { color: var(--t-promise); }
/* Smiley switch: breathes softly, winks while the second slogan shows. */
.lg-switch { display: grid; flex: none; width: 40px; height: 40px; margin-top: .2em; place-items: center; padding: 0; color: var(--icon); border: 1px solid var(--line); border-radius: 50%; background: rgb(var(--c2) / 14%); cursor: pointer; animation: lg-ring 2.4s ease-in-out infinite; transition: transform .35s cubic-bezier(.3, 1.6, .5, 1), background .2s; }
.lg-switch:hover { background: rgb(var(--c2) / 24%); transform: scale(1.08) rotate(-8deg); }
.lg-switch:active { transform: scale(.92); }
.lg-switch svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
.lg-switch .eye-r { transition: d .3s; }
.lg-switch.wink .eye-r { d: path("M14 10.4h2"); }
@keyframes lg-ring { 0%, 100% { box-shadow: 0 0 0 0 rgb(var(--c2) / 0%); } 50% { box-shadow: 0 0 18px 2px rgb(var(--c2) / 45%); } }
.lg-swap-enter-active, .lg-swap-leave-active { transition: opacity .45s ease, filter .45s ease, transform .45s ease; }
.lg-swap-enter-from { opacity: 0; filter: blur(6px); transform: translateY(10px); }
.lg-swap-leave-to { opacity: 0; filter: blur(6px); transform: translateY(-10px); }
.lg-lead { margin: 22px 0 28px; color: var(--muted); font-size: 15px; }
.lg-features { display: grid; grid-template-columns: repeat(3, max-content); gap: 34px; margin: 0; padding: 0; list-style: none; }
.lg-features li { display: grid; gap: 4px; }
.lg-features svg { width: 24px; height: 24px; margin-bottom: 6px; fill: none; stroke: var(--icon); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; animation: lg-icon 3s ease-in-out infinite; }
.lg-features li:nth-child(2) svg { animation-delay: -1s; }
.lg-features li:nth-child(3) svg { animation-delay: -2s; }
@keyframes lg-icon { 0%, 100% { opacity: .7; filter: drop-shadow(0 0 2px rgb(var(--c2) / 30%)); } 50% { opacity: 1; filter: drop-shadow(0 0 8px rgb(var(--c2) / 70%)); } }
.lg-features strong { color: var(--ink); font-size: 14px; }
.lg-features small { color: var(--muted); font-size: 12px; }

/* Fish-oil capsule with gold nutrient bubbles looping over and under it, light beams and breathing particles. */
.lg-copy { position: relative; z-index: 2; }
/* Decorative only: it never takes clicks, so a wide slogan's switch button stays reachable. */
.lg-scene { position: relative; z-index: 1; align-self: stretch; min-height: 440px; pointer-events: none; }
.lg-scene svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.lg-dot { position: absolute; border-radius: 50%; background: rgb(var(--c1)); box-shadow: 0 0 8px rgb(var(--c2) / 90%); opacity: 0; animation: lg-dot 4s ease-in-out infinite; }
@keyframes lg-dot { 0%, 100% { opacity: 0; transform: translateY(6px) scale(.6); } 50% { opacity: .9; transform: translateY(-10px) scale(1); } }
.lg-beams rect { animation: lg-fade 3s ease-in-out infinite; }
.lg-beams rect:nth-child(2) { animation-delay: -1s; }
.lg-beams rect:nth-child(3) { animation-delay: -2s; }
.lg-rings circle { fill: none; stroke: rgb(var(--c2) / 18%); stroke-width: 1; animation: lg-fade 3s ease-in-out infinite; }
.lg-rings circle:nth-child(2) { animation-delay: -1s; }
.lg-rings circle:nth-child(3) { animation-delay: -2s; }
@keyframes lg-fade { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
.lg-pool { transform-box: fill-box; transform-origin: center; animation: lg-breathe 3s ease-in-out infinite; }
.lg-ripples ellipse { fill: none; stroke: rgb(var(--c1) / 75%); stroke-width: 1.2; transform-box: fill-box; transform-origin: center; opacity: 0; animation: lg-ripple 3s ease-out infinite; }
.lg-ripples ellipse:nth-child(2) { animation-delay: 1s; }
.lg-ripples ellipse:nth-child(3) { animation-delay: 2s; }
@keyframes lg-ripple { 0% { transform: scale(.4); opacity: 0; } 20% { opacity: .8; } 100% { transform: scale(2.3); opacity: 0; } }
.lg-link-line { stroke: var(--gold-1); stroke-width: 1; stroke-dasharray: 2 5; }
.lg-capsule { transform-box: view-box; transform-origin: 200px 250px; animation: lg-float 3s ease-in-out infinite alternate; filter: drop-shadow(0 0 26px rgb(255 190 80 / 38%)) drop-shadow(0 18px 30px var(--shadow)); }
@keyframes lg-float { from { transform: rotate(-2deg) translateY(-6px); } to { transform: rotate(2deg) translateY(6px); } }
.lg-bubble { filter: drop-shadow(0 0 10px rgb(255 200 90 / 50%)); }
.lg-bubble-rim { fill: none; stroke: url(#lg-bubble-rim); stroke-width: 1.8; }
.lg-spec { fill: #fff; opacity: .85; }
.lg-bubble-inner { fill: none; stroke: rgb(255 255 255 / 55%); stroke-width: 1; }
.lg-glint { fill: #fff; transform-box: fill-box; transform-origin: center; animation: lg-glint 2.4s ease-in-out infinite; }
@keyframes lg-glint { 0%, 100% { opacity: .2; transform: scale(.5) rotate(0deg); } 50% { opacity: 1; transform: scale(1.1) rotate(45deg); } }
.lg-tri-line { stroke: var(--tri); stroke-width: 2; stroke-linecap: round; filter: drop-shadow(0 0 6px rgb(255 214 120 / 90%)); }
.lg-tri-fill { fill: rgb(255 214 120 / 7%); stroke: none; animation: lg-fade 3s ease-in-out infinite; }
.lg-bubble text { fill: var(--gold-ink); font-size: 13px; font-weight: 800; text-anchor: middle; letter-spacing: .02em; }

/* Login card: clear frosted glass with a rim light that breathes; a band of light sweeps across it now and then. */
.lg-card {
  position: relative;
  z-index: 2;
  display: grid;
  overflow: hidden;
  gap: 18px;
  padding: 30px 30px 24px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--card);
  backdrop-filter: blur(22px) saturate(1.2);
  animation: lg-card 2.6s ease-in-out infinite;
}
@keyframes lg-card {
  0%, 100% { box-shadow: inset 1px 1px 0 var(--frame-light), inset -1px -1px 0 rgb(0 0 0 / 8%), 0 24px 50px var(--shadow); }
  50% { box-shadow: inset 1px 1px 0 var(--frame-light), inset -1px -1px 0 rgb(0 0 0 / 8%), 0 24px 50px var(--shadow), 0 0 30px rgb(var(--c2) / 24%); }
}
.lg-card::after { position: absolute; inset: -40% auto -40% -60%; width: 40%; content: ""; background: linear-gradient(100deg, transparent, rgb(255 255 255 / 22%) 45%, rgb(255 255 255 / 38%) 50%, rgb(255 255 255 / 22%) 55%, transparent); transform: rotate(12deg); pointer-events: none; animation: lg-sweep 5s ease-in-out infinite; }
@keyframes lg-sweep { 0%, 55% { left: -60%; opacity: 0; } 60% { opacity: 1; } 90% { opacity: 1; } 100% { left: 130%; opacity: 0; } }
.lg-card h2 { margin: 0; color: var(--ink); font-size: 22px; font-weight: 700; }
.lg-tabs { position: relative; display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--line); }
.lg-tabs button { padding: 10px 0 12px; color: var(--muted); border: 0; background: transparent; font: inherit; font-size: 14px; cursor: pointer; transition: color .2s; }
.lg-tabs button[aria-selected="true"] { color: var(--ink); font-weight: 700; }
.lg-tab-bar { position: absolute; bottom: -2px; left: 25%; width: 40px; height: 3px; margin-left: -20px; border-radius: 3px; background: linear-gradient(90deg, rgb(var(--c1)), rgb(var(--c2))); transition: left .35s cubic-bezier(.2, .8, .2, 1); }
.lg-tab-bar.code { left: 75%; }
.lg-form { display: grid; gap: 14px; }
.lg-field { display: flex; align-items: center; gap: 10px; min-height: 46px; padding: 0 16px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--field); transition: border-color .2s, box-shadow .2s; }
.lg-field:focus-within { border-color: rgb(var(--c2) / 70%); box-shadow: 0 0 0 3px rgb(var(--c2) / 16%); }
.lg-field.disabled { color: var(--disabled); opacity: .6; }
.lg-field > svg, .lg-eye svg { flex: none; width: 18px; height: 18px; fill: none; stroke: var(--muted); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.lg .lg-field input { flex: 1; min-width: 0; min-height: 44px; padding: 0; color: var(--ink); border: 0; outline: none; background: transparent; box-shadow: none; font: inherit; font-size: 14px; }
.lg .lg-field input::placeholder { color: var(--muted); }
.lg-eye { display: grid; padding: 4px; border: 0; background: transparent; cursor: pointer; }
.lg-row { display: flex; align-items: center; justify-content: space-between; }
.lg-check { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; cursor: pointer; }
.lg-check input { width: 15px; height: 15px; margin: 0; accent-color: var(--accent); }
.lg-link { padding: 0; color: var(--accent); border: 0; background: transparent; font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
.lg-link:disabled { color: var(--muted); cursor: not-allowed; }
.lg-submit { position: relative; overflow: hidden; min-height: 46px; color: var(--submit-ink); border: 0; border-radius: var(--radius-control); background: var(--submit); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; animation: lg-button 2s ease-in-out infinite; transition: filter .2s, transform .2s; }
.lg-submit:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.lg-submit:disabled { opacity: .65; cursor: wait; }
/* Click feedback: a soft glow spreads from the button after each press. */
.lg-submit::after { position: absolute; inset: 0; content: ""; background: radial-gradient(circle, rgb(255 255 255 / 60%), transparent 60%); opacity: 0; transform: scale(.3); transition: transform .6s ease, opacity .7s ease; pointer-events: none; }
.lg-submit:active::after { opacity: 1; transform: scale(1.6); transition: none; }
@keyframes lg-button { 0%, 100% { box-shadow: 0 6px 18px rgb(var(--c2) / 18%); } 50% { box-shadow: 0 8px 30px rgb(var(--c3) / 42%); } }
.lg-error { margin: 0; padding: 9px 12px; color: #ff9f9f; border: 1px solid rgb(255 110 110 / 30%); border-radius: 9px; background: rgb(255 90 90 / 10%); font-size: 13px; }
.lg-note, .lg-foot { margin: 0; color: var(--muted); font-size: 13px; text-align: center; }

/* Narrower screens: the capsule moves under the headline, the card keeps the right column. */
@media (max-width: 1100px) {
  .lg-body { grid-template-columns: minmax(0, 1fr) minmax(320px, 380px); grid-template-areas: "copy card" "scene card"; }
  .lg-copy { grid-area: copy; }
  .lg-scene { grid-area: scene; min-height: 340px; }
  .lg-card { grid-area: card; }
}
@media (max-width: 760px) {
  .lg { padding: 8px; }
  .lg-frame { border-radius: 22px; transform: none; animation: none; box-shadow: inset 0 1px 0 var(--frame-light), var(--frame-depth), 0 24px 50px var(--shadow); }
  .lg-floor { display: none; }
  .lg-top { padding-top: 14px; }
  .lg-body { grid-template-columns: minmax(0, 1fr); grid-template-areas: "copy" "scene" "card"; gap: 12px; padding: 12px 14px 22px; }
  .lg-title { font-size: clamp(24px, 7.4vw, 32px); }
  .lg-lead { margin: 12px 0 0; font-size: 14px; }
  .lg-features { display: none; }
  .lg-scene { min-height: 300px; }
  .lg-card { padding: 22px 18px 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .lg *, .lg *::before, .lg *::after { animation: none !important; transition: none !important; }
  .lg-dot { opacity: .5; }
  .lg-ripples ellipse { opacity: 0; }
}
</style>
