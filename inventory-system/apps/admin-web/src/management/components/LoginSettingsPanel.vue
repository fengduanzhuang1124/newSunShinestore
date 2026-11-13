<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

// CR-025: the store's position, the allowed radius, and which staff accounts may sign in only inside the store.
type StoreLocation = { id: string; name: string; latitude: number | null; longitude: number | null; radius: number };
type Account = { id: string; username: string; displayName: string; inStoreOnly: boolean; administrator: boolean; roles: string[] };
type Settings = { store: StoreLocation; radiusOptions: number[]; users: Account[] };

const props = defineProps<{ storeId: string; request: <T>(path: string, init?: RequestInit) => Promise<T> }>();

const settings = ref<Settings | null>(null);
const loading = ref(false);
const saving = ref(false);
const locating = ref(false);
const failure = ref('');
const notice = ref('');
const latitude = ref('');
const longitude = ref('');
const radius = ref(300);
const accuracy = ref<number | null>(null);

const query = computed(() => `storeId=${encodeURIComponent(props.storeId)}`);
const located = computed(() => settings.value?.store.latitude !== null && settings.value?.store.latitude !== undefined);
const limitedCount = computed(() => settings.value?.users.filter((user) => user.inStoreOnly).length ?? 0);
const mapLink = computed(() => (located.value ? `https://www.google.com/maps?q=${settings.value!.store.latitude},${settings.value!.store.longitude}` : ''));

function fill(store: StoreLocation) {
  latitude.value = store.latitude === null ? '' : String(store.latitude);
  longitude.value = store.longitude === null ? '' : String(store.longitude);
  radius.value = store.radius;
}

async function load() {
  loading.value = true; failure.value = '';
  try {
    settings.value = await props.request<Settings>(`/management/login-settings?${query.value}`);
    fill(settings.value.store);
  } catch (reason) { failure.value = reason instanceof Error ? reason.message : '登录限制读取失败'; }
  finally { loading.value = false; }
}

function useCurrentPosition() {
  failure.value = ''; notice.value = '';
  if (!window.isSecureContext || !navigator.geolocation) { failure.value = '当前地址不能定位，请用 https 地址打开系统后再试'; return; }
  locating.value = true;
  navigator.geolocation.getCurrentPosition((position) => {
    locating.value = false;
    latitude.value = position.coords.latitude.toFixed(6);
    longitude.value = position.coords.longitude.toFixed(6);
    accuracy.value = Math.round(position.coords.accuracy);
    notice.value = `已取得当前位置（误差约 ${accuracy.value} 米），确认在店内后点“保存门店位置”。`;
  }, (reason) => {
    locating.value = false;
    failure.value = reason.code === reason.PERMISSION_DENIED ? '没有定位权限，请在浏览器设置中允许本网站使用位置' : '定位失败，请打开手机定位后重试，或手工填写经纬度';
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
}

async function saveStore(clear = false) {
  if (!settings.value) return;
  saving.value = true; failure.value = ''; notice.value = '';
  const coordinate = (value: string) => (clear || !value.trim() ? null : Number(value));
  try {
    const store = await props.request<StoreLocation>(`/management/login-settings/store?${query.value}`, { method: 'POST', body: JSON.stringify({ latitude: coordinate(latitude.value), longitude: coordinate(longitude.value), radius: radius.value }) });
    settings.value.store = store; fill(store); accuracy.value = null;
    notice.value = clear ? '门店位置已清除，开启限制的账号将无法登录，请尽快重新设置。' : '门店位置已保存。';
  } catch (reason) { failure.value = reason instanceof Error ? reason.message : '门店位置保存失败'; }
  finally { saving.value = false; }
}

async function toggle(user: Account) {
  saving.value = true; failure.value = ''; notice.value = '';
  try {
    const result = await props.request<{ inStoreOnly: boolean }>(`/management/login-settings/user?${query.value}`, { method: 'POST', body: JSON.stringify({ userId: user.id, inStoreOnly: !user.inStoreOnly }) });
    user.inStoreOnly = result.inStoreOnly;
    notice.value = `${user.displayName}（${user.username}）${result.inStoreOnly ? '已设置为仅限店内登录，下次登录时生效' : '已取消店内登录限制'}。`;
  } catch (reason) { failure.value = reason instanceof Error ? reason.message : '账号设置保存失败'; }
  finally { saving.value = false; }
}

onMounted(load);
</script>

<template>
  <section class="login-settings">
    <p v-if="loading" class="system-empty" role="status">正在读取登录限制…</p>
    <p v-if="failure" class="management-alert error" role="alert"><strong>未完成</strong><span>{{ failure }}</span></p>
    <p v-if="notice" class="management-alert inventory-source" role="status"><strong>提示</strong><span>{{ notice }}</span></p>
    <template v-if="settings">
      <section class="system-card login-settings-card">
        <div class="card-title"><div><h3>门店位置</h3><p>开启“仅限店内登录”的账号，只有手机定位在这个范围内才能登录</p></div><span v-if="!located">未设置</span></div>
        <div class="login-location-grid">
          <label>纬度<input v-model="latitude" type="text" inputmode="decimal" placeholder="例如 -37.787000" /></label>
          <label>经度<input v-model="longitude" type="text" inputmode="decimal" placeholder="例如 175.279000" /></label>
          <label>允许范围<select v-model.number="radius"><option v-for="option in settings.radiusOptions" :key="option" :value="option">{{ option >= 1000 ? `${option / 1000} 公里` : `${option} 米` }}</option></select></label>
        </div>
        <div class="login-location-actions">
          <button class="secondary" type="button" :disabled="locating || saving" @click="useCurrentPosition">{{ locating ? '正在定位…' : '用当前位置' }}</button>
          <button type="button" :disabled="saving || !latitude.trim() || !longitude.trim()" @click="saveStore()">保存门店位置</button>
          <button v-if="located" class="text-action" type="button" :disabled="saving" @click="saveStore(true)">清除位置</button>
          <a v-if="mapLink" class="text-action" :href="mapLink" target="_blank" rel="noopener">在地图上查看</a>
        </div>
        <p class="login-settings-note">请在店内用手机点“用当前位置”再保存；室内定位常有几十米误差，范围建议 300 米。也可以在地图上长按门店位置，复制经纬度填入。</p>
      </section>
      <section class="system-card login-settings-card">
        <div class="card-title"><div><h3>账号</h3><p>开启后该账号只能在门店范围内登录；管理员账号不能开启</p></div><span>{{ limitedCount }} 个已限制</span></div>
        <ul class="login-account-list">
          <li v-for="user in settings.users" :key="user.id">
            <span><strong>{{ user.displayName }}</strong><small>{{ user.username }} · {{ user.roles.join('、') }}</small></span>
            <em v-if="user.administrator">管理员不限制</em>
            <label v-else class="login-switch"><input type="checkbox" :checked="user.inStoreOnly" :disabled="saving" :aria-label="`${user.displayName} 仅限店内登录`" @change="toggle(user)" /><span>仅限店内登录</span></label>
          </li>
        </ul>
        <p class="login-settings-note">只在登录时检查位置：店内登录后会话 8 小时内有效。需要立即停止某账号使用时，请修改该账号密码。</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.login-settings{display:grid;gap:16px}
.login-settings-card{display:grid;gap:14px}
.login-location-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.login-location-grid label{display:grid;gap:6px;font-size:12px;font-weight:800;opacity:.85}
.login-location-grid input,.login-location-grid select{min-height:40px;padding:0 12px;border:1px solid rgb(128 145 170 / 35%);border-radius:10px;font:inherit}
.login-location-actions{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.login-location-actions button:not(.text-action){min-height:40px;padding:0 18px;border:0;border-radius:10px;color:#fff;background:linear-gradient(135deg,#18b6ef,#3769f3);font-weight:800}
.login-location-actions button.secondary{color:inherit;background:transparent;border:1px solid rgb(128 145 170 / 45%)}
.login-location-actions button:disabled{opacity:.5}
.login-settings-note{margin:0;font-size:12px;line-height:1.6;opacity:.7}
.login-account-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.login-account-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid rgb(128 145 170 / 25%);border-radius:12px}
.login-account-list li>span{display:grid;gap:3px;min-width:0}
.login-account-list small{opacity:.7}
.login-account-list em{font-size:12px;font-style:normal;opacity:.6}
.login-switch{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;cursor:pointer}
.login-switch input{width:18px;height:18px}
@media(max-width:720px){.login-location-grid{grid-template-columns:1fr}.login-account-list li{align-items:flex-start;flex-direction:column}}
</style>
