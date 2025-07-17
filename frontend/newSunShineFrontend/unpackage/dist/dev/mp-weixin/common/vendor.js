"use strict";
/**
* @vue/shared v3.4.21
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
function makeMap(str, expectsLowerCase) {
  const set2 = new Set(str.split(","));
  return expectsLowerCase ? (val) => set2.has(val.toLowerCase()) : (val) => set2.has(val);
}
const EMPTY_OBJ = Object.freeze({});
const EMPTY_ARR = Object.freeze([]);
const NOOP = () => {
};
const NO = () => false;
const isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
(key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
const isModelListener = (key) => key.startsWith("onUpdate:");
const extend = Object.assign;
const remove = (arr, el) => {
  const i = arr.indexOf(el);
  if (i > -1) {
    arr.splice(i, 1);
  }
};
const hasOwnProperty$1 = Object.prototype.hasOwnProperty;
const hasOwn = (val, key) => hasOwnProperty$1.call(val, key);
const isArray = Array.isArray;
const isMap = (val) => toTypeString(val) === "[object Map]";
const isSet = (val) => toTypeString(val) === "[object Set]";
const isFunction = (val) => typeof val === "function";
const isString = (val) => typeof val === "string";
const isSymbol = (val) => typeof val === "symbol";
const isObject = (val) => val !== null && typeof val === "object";
const isPromise = (val) => {
  return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
};
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const toRawType = (value) => {
  return toTypeString(value).slice(8, -1);
};
const isPlainObject = (val) => toTypeString(val) === "[object Object]";
const isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
const isReservedProp = /* @__PURE__ */ makeMap(
  // the leading comma is intentional so empty string "" is also included
  ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
);
const isBuiltInDirective = /* @__PURE__ */ makeMap(
  "bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo"
);
const cacheStringFunction = (fn) => {
  const cache = /* @__PURE__ */ Object.create(null);
  return (str) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  };
};
const camelizeRE = /-(\w)/g;
const camelize = cacheStringFunction((str) => {
  return str.replace(camelizeRE, (_, c) => c ? c.toUpperCase() : "");
});
const hyphenateRE = /\B([A-Z])/g;
const hyphenate = cacheStringFunction(
  (str) => str.replace(hyphenateRE, "-$1").toLowerCase()
);
const capitalize = cacheStringFunction((str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
});
const toHandlerKey = cacheStringFunction((str) => {
  const s = str ? `on${capitalize(str)}` : ``;
  return s;
});
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
const invokeArrayFns$1 = (fns, arg) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg);
  }
};
const def = (obj, key, value) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  });
};
const looseToNumber = (val) => {
  const n = parseFloat(val);
  return isNaN(n) ? val : n;
};
const toDisplayString = (val) => {
  return isString(val) ? val : val == null ? "" : isArray(val) || isObject(val) && (val.toString === objectToString || !isFunction(val.toString)) ? JSON.stringify(val, replacer, 2) : String(val);
};
const replacer = (_key, val) => {
  if (val && val.__v_isRef) {
    return replacer(_key, val.value);
  } else if (isMap(val)) {
    return {
      [`Map(${val.size})`]: [...val.entries()].reduce(
        (entries, [key, val2], i) => {
          entries[stringifySymbol(key, i) + " =>"] = val2;
          return entries;
        },
        {}
      )
    };
  } else if (isSet(val)) {
    return {
      [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v))
    };
  } else if (isSymbol(val)) {
    return stringifySymbol(val);
  } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
    return String(val);
  }
  return val;
};
const stringifySymbol = (v, i = "") => {
  var _a;
  return isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v;
};
const LOCALE_ZH_HANS = "zh-Hans";
const LOCALE_ZH_HANT = "zh-Hant";
const LOCALE_EN = "en";
const LOCALE_FR = "fr";
const LOCALE_ES = "es";
function include(str, parts) {
  return !!parts.find((part) => str.indexOf(part) !== -1);
}
function startsWith(str, parts) {
  return parts.find((part) => str.indexOf(part) === 0);
}
function normalizeLocale(locale, messages) {
  if (!locale) {
    return;
  }
  locale = locale.trim().replace(/_/g, "-");
  if (messages && messages[locale]) {
    return locale;
  }
  locale = locale.toLowerCase();
  if (locale === "chinese") {
    return LOCALE_ZH_HANS;
  }
  if (locale.indexOf("zh") === 0) {
    if (locale.indexOf("-hans") > -1) {
      return LOCALE_ZH_HANS;
    }
    if (locale.indexOf("-hant") > -1) {
      return LOCALE_ZH_HANT;
    }
    if (include(locale, ["-tw", "-hk", "-mo", "-cht"])) {
      return LOCALE_ZH_HANT;
    }
    return LOCALE_ZH_HANS;
  }
  let locales = [LOCALE_EN, LOCALE_FR, LOCALE_ES];
  if (messages && Object.keys(messages).length > 0) {
    locales = Object.keys(messages);
  }
  const lang = startsWith(locale, locales);
  if (lang) {
    return lang;
  }
}
const SLOT_DEFAULT_NAME = "d";
const ON_SHOW = "onShow";
const ON_HIDE = "onHide";
const ON_LAUNCH = "onLaunch";
const ON_ERROR = "onError";
const ON_THEME_CHANGE = "onThemeChange";
const ON_PAGE_NOT_FOUND = "onPageNotFound";
const ON_UNHANDLE_REJECTION = "onUnhandledRejection";
const ON_EXIT = "onExit";
const ON_LOAD = "onLoad";
const ON_READY = "onReady";
const ON_UNLOAD = "onUnload";
const ON_INIT = "onInit";
const ON_SAVE_EXIT_STATE = "onSaveExitState";
const ON_RESIZE = "onResize";
const ON_BACK_PRESS = "onBackPress";
const ON_PAGE_SCROLL = "onPageScroll";
const ON_TAB_ITEM_TAP = "onTabItemTap";
const ON_REACH_BOTTOM = "onReachBottom";
const ON_PULL_DOWN_REFRESH = "onPullDownRefresh";
const ON_SHARE_TIMELINE = "onShareTimeline";
const ON_SHARE_CHAT = "onShareChat";
const ON_ADD_TO_FAVORITES = "onAddToFavorites";
const ON_SHARE_APP_MESSAGE = "onShareAppMessage";
const ON_NAVIGATION_BAR_BUTTON_TAP = "onNavigationBarButtonTap";
const ON_NAVIGATION_BAR_SEARCH_INPUT_CLICKED = "onNavigationBarSearchInputClicked";
const ON_NAVIGATION_BAR_SEARCH_INPUT_CHANGED = "onNavigationBarSearchInputChanged";
const ON_NAVIGATION_BAR_SEARCH_INPUT_CONFIRMED = "onNavigationBarSearchInputConfirmed";
const ON_NAVIGATION_BAR_SEARCH_INPUT_FOCUS_CHANGED = "onNavigationBarSearchInputFocusChanged";
const VIRTUAL_HOST_STYLE = "virtualHostStyle";
const VIRTUAL_HOST_CLASS = "virtualHostClass";
const VIRTUAL_HOST_HIDDEN = "virtualHostHidden";
const VIRTUAL_HOST_ID = "virtualHostId";
function hasLeadingSlash(str) {
  return str.indexOf("/") === 0;
}
function addLeadingSlash(str) {
  return hasLeadingSlash(str) ? str : "/" + str;
}
const invokeArrayFns = (fns, arg) => {
  let ret;
  for (let i = 0; i < fns.length; i++) {
    ret = fns[i](arg);
  }
  return ret;
};
function once(fn, ctx = null) {
  let res;
  return (...args) => {
    if (fn) {
      res = fn.apply(ctx, args);
      fn = null;
    }
    return res;
  };
}
function getValueByDataPath(obj, path) {
  if (!isString(path)) {
    return;
  }
  path = path.replace(/\[(\d+)\]/g, ".$1");
  const parts = path.split(".");
  let key = parts[0];
  if (!obj) {
    obj = {};
  }
  if (parts.length === 1) {
    return obj[key];
  }
  return getValueByDataPath(obj[key], parts.slice(1).join("."));
}
function sortObject(obj) {
  let sortObj = {};
  if (isPlainObject(obj)) {
    Object.keys(obj).sort().forEach((key) => {
      const _key = key;
      sortObj[_key] = obj[_key];
    });
  }
  return !Object.keys(sortObj) ? obj : sortObj;
}
const customizeRE = /:/g;
function customizeEvent(str) {
  return camelize(str.replace(customizeRE, "-"));
}
const encode = encodeURIComponent;
function stringifyQuery(obj, encodeStr = encode) {
  const res = obj ? Object.keys(obj).map((key) => {
    let val = obj[key];
    if (typeof val === void 0 || val === null) {
      val = "";
    } else if (isPlainObject(val)) {
      val = JSON.stringify(val);
    }
    return encodeStr(key) + "=" + encodeStr(val);
  }).filter((x) => x.length > 0).join("&") : null;
  return res ? `?${res}` : "";
}
const PAGE_HOOKS = [
  ON_INIT,
  ON_LOAD,
  ON_SHOW,
  ON_HIDE,
  ON_UNLOAD,
  ON_BACK_PRESS,
  ON_PAGE_SCROLL,
  ON_TAB_ITEM_TAP,
  ON_REACH_BOTTOM,
  ON_PULL_DOWN_REFRESH,
  ON_SHARE_TIMELINE,
  ON_SHARE_APP_MESSAGE,
  ON_SHARE_CHAT,
  ON_ADD_TO_FAVORITES,
  ON_SAVE_EXIT_STATE,
  ON_NAVIGATION_BAR_BUTTON_TAP,
  ON_NAVIGATION_BAR_SEARCH_INPUT_CLICKED,
  ON_NAVIGATION_BAR_SEARCH_INPUT_CHANGED,
  ON_NAVIGATION_BAR_SEARCH_INPUT_CONFIRMED,
  ON_NAVIGATION_BAR_SEARCH_INPUT_FOCUS_CHANGED
];
function isRootHook(name) {
  return PAGE_HOOKS.indexOf(name) > -1;
}
const UniLifecycleHooks = [
  ON_SHOW,
  ON_HIDE,
  ON_LAUNCH,
  ON_ERROR,
  ON_THEME_CHANGE,
  ON_PAGE_NOT_FOUND,
  ON_UNHANDLE_REJECTION,
  ON_EXIT,
  ON_INIT,
  ON_LOAD,
  ON_READY,
  ON_UNLOAD,
  ON_RESIZE,
  ON_BACK_PRESS,
  ON_PAGE_SCROLL,
  ON_TAB_ITEM_TAP,
  ON_REACH_BOTTOM,
  ON_PULL_DOWN_REFRESH,
  ON_SHARE_TIMELINE,
  ON_ADD_TO_FAVORITES,
  ON_SHARE_APP_MESSAGE,
  ON_SHARE_CHAT,
  ON_SAVE_EXIT_STATE,
  ON_NAVIGATION_BAR_BUTTON_TAP,
  ON_NAVIGATION_BAR_SEARCH_INPUT_CLICKED,
  ON_NAVIGATION_BAR_SEARCH_INPUT_CHANGED,
  ON_NAVIGATION_BAR_SEARCH_INPUT_CONFIRMED,
  ON_NAVIGATION_BAR_SEARCH_INPUT_FOCUS_CHANGED
];
const MINI_PROGRAM_PAGE_RUNTIME_HOOKS = /* @__PURE__ */ (() => {
  return {
    onPageScroll: 1,
    onShareAppMessage: 1 << 1,
    onShareTimeline: 1 << 2
  };
})();
function isUniLifecycleHook(name, value, checkType = true) {
  if (checkType && !isFunction(value)) {
    return false;
  }
  if (UniLifecycleHooks.indexOf(name) > -1) {
    return true;
  } else if (name.indexOf("on") === 0) {
    return true;
  }
  return false;
}
let vueApp;
const createVueAppHooks = [];
function onCreateVueApp(hook) {
  if (vueApp) {
    return hook(vueApp);
  }
  createVueAppHooks.push(hook);
}
function invokeCreateVueAppHook(app) {
  vueApp = app;
  createVueAppHooks.forEach((hook) => hook(app));
}
const invokeCreateErrorHandler = once((app, createErrorHandler2) => {
  return createErrorHandler2(app);
});
const E = function() {
};
E.prototype = {
  _id: 1,
  on: function(name, callback, ctx) {
    var e = this.e || (this.e = {});
    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx,
      _id: this._id
    });
    return this._id++;
  },
  once: function(name, callback, ctx) {
    var self2 = this;
    function listener() {
      self2.off(name, listener);
      callback.apply(ctx, arguments);
    }
    listener._ = callback;
    return this.on(name, listener, ctx);
  },
  emit: function(name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;
    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }
    return this;
  },
  off: function(name, event) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];
    if (evts && event) {
      for (var i = evts.length - 1; i >= 0; i--) {
        if (evts[i].fn === event || evts[i].fn._ === event || evts[i]._id === event) {
          evts.splice(i, 1);
          break;
        }
      }
      liveEvents = evts;
    }
    liveEvents.length ? e[name] = liveEvents : delete e[name];
    return this;
  }
};
var E$1 = E;
/**
* @dcloudio/uni-mp-vue v3.4.21
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
function warn$2(msg, ...args) {
  console.warn(`[Vue warn] ${msg}`, ...args);
}
let activeEffectScope;
class EffectScope {
  constructor(detached = false) {
    this.detached = detached;
    this._active = true;
    this.effects = [];
    this.cleanups = [];
    this.parent = activeEffectScope;
    if (!detached && activeEffectScope) {
      this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
        this
      ) - 1;
    }
  }
  get active() {
    return this._active;
  }
  run(fn) {
    if (this._active) {
      const currentEffectScope = activeEffectScope;
      try {
        activeEffectScope = this;
        return fn();
      } finally {
        activeEffectScope = currentEffectScope;
      }
    } else {
      warn$2(`cannot run an inactive effect scope.`);
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    activeEffectScope = this;
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    activeEffectScope = this.parent;
  }
  stop(fromParent) {
    if (this._active) {
      let i, l;
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop();
      }
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]();
      }
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true);
        }
      }
      if (!this.detached && this.parent && !fromParent) {
        const last = this.parent.scopes.pop();
        if (last && last !== this) {
          this.parent.scopes[this.index] = last;
          last.index = this.index;
        }
      }
      this.parent = void 0;
      this._active = false;
    }
  }
}
function recordEffectScope(effect2, scope = activeEffectScope) {
  if (scope && scope.active) {
    scope.effects.push(effect2);
  }
}
function getCurrentScope() {
  return activeEffectScope;
}
let activeEffect;
class ReactiveEffect {
  constructor(fn, trigger2, scheduler, scope) {
    this.fn = fn;
    this.trigger = trigger2;
    this.scheduler = scheduler;
    this.active = true;
    this.deps = [];
    this._dirtyLevel = 4;
    this._trackId = 0;
    this._runnings = 0;
    this._shouldSchedule = false;
    this._depsLength = 0;
    recordEffectScope(this, scope);
  }
  get dirty() {
    if (this._dirtyLevel === 2 || this._dirtyLevel === 3) {
      this._dirtyLevel = 1;
      pauseTracking();
      for (let i = 0; i < this._depsLength; i++) {
        const dep = this.deps[i];
        if (dep.computed) {
          triggerComputed(dep.computed);
          if (this._dirtyLevel >= 4) {
            break;
          }
        }
      }
      if (this._dirtyLevel === 1) {
        this._dirtyLevel = 0;
      }
      resetTracking();
    }
    return this._dirtyLevel >= 4;
  }
  set dirty(v) {
    this._dirtyLevel = v ? 4 : 0;
  }
  run() {
    this._dirtyLevel = 0;
    if (!this.active) {
      return this.fn();
    }
    let lastShouldTrack = shouldTrack;
    let lastEffect = activeEffect;
    try {
      shouldTrack = true;
      activeEffect = this;
      this._runnings++;
      preCleanupEffect(this);
      return this.fn();
    } finally {
      postCleanupEffect(this);
      this._runnings--;
      activeEffect = lastEffect;
      shouldTrack = lastShouldTrack;
    }
  }
  stop() {
    var _a;
    if (this.active) {
      preCleanupEffect(this);
      postCleanupEffect(this);
      (_a = this.onStop) == null ? void 0 : _a.call(this);
      this.active = false;
    }
  }
}
function triggerComputed(computed2) {
  return computed2.value;
}
function preCleanupEffect(effect2) {
  effect2._trackId++;
  effect2._depsLength = 0;
}
function postCleanupEffect(effect2) {
  if (effect2.deps.length > effect2._depsLength) {
    for (let i = effect2._depsLength; i < effect2.deps.length; i++) {
      cleanupDepEffect(effect2.deps[i], effect2);
    }
    effect2.deps.length = effect2._depsLength;
  }
}
function cleanupDepEffect(dep, effect2) {
  const trackId = dep.get(effect2);
  if (trackId !== void 0 && effect2._trackId !== trackId) {
    dep.delete(effect2);
    if (dep.size === 0) {
      dep.cleanup();
    }
  }
}
let shouldTrack = true;
let pauseScheduleStack = 0;
const trackStack = [];
function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}
function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === void 0 ? true : last;
}
function pauseScheduling() {
  pauseScheduleStack++;
}
function resetScheduling() {
  pauseScheduleStack--;
  while (!pauseScheduleStack && queueEffectSchedulers.length) {
    queueEffectSchedulers.shift()();
  }
}
function trackEffect(effect2, dep, debuggerEventExtraInfo) {
  var _a;
  if (dep.get(effect2) !== effect2._trackId) {
    dep.set(effect2, effect2._trackId);
    const oldDep = effect2.deps[effect2._depsLength];
    if (oldDep !== dep) {
      if (oldDep) {
        cleanupDepEffect(oldDep, effect2);
      }
      effect2.deps[effect2._depsLength++] = dep;
    } else {
      effect2._depsLength++;
    }
    {
      (_a = effect2.onTrack) == null ? void 0 : _a.call(effect2, extend({ effect: effect2 }, debuggerEventExtraInfo));
    }
  }
}
const queueEffectSchedulers = [];
function triggerEffects(dep, dirtyLevel, debuggerEventExtraInfo) {
  var _a;
  pauseScheduling();
  for (const effect2 of dep.keys()) {
    let tracking;
    if (effect2._dirtyLevel < dirtyLevel && (tracking != null ? tracking : tracking = dep.get(effect2) === effect2._trackId)) {
      effect2._shouldSchedule || (effect2._shouldSchedule = effect2._dirtyLevel === 0);
      effect2._dirtyLevel = dirtyLevel;
    }
    if (effect2._shouldSchedule && (tracking != null ? tracking : tracking = dep.get(effect2) === effect2._trackId)) {
      {
        (_a = effect2.onTrigger) == null ? void 0 : _a.call(effect2, extend({ effect: effect2 }, debuggerEventExtraInfo));
      }
      effect2.trigger();
      if ((!effect2._runnings || effect2.allowRecurse) && effect2._dirtyLevel !== 2) {
        effect2._shouldSchedule = false;
        if (effect2.scheduler) {
          queueEffectSchedulers.push(effect2.scheduler);
        }
      }
    }
  }
  resetScheduling();
}
const createDep = (cleanup, computed2) => {
  const dep = /* @__PURE__ */ new Map();
  dep.cleanup = cleanup;
  dep.computed = computed2;
  return dep;
};
const targetMap = /* @__PURE__ */ new WeakMap();
const ITERATE_KEY = Symbol("iterate");
const MAP_KEY_ITERATE_KEY = Symbol("Map key iterate");
function track(target, type, key) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, dep = createDep(() => depsMap.delete(key)));
    }
    trackEffect(
      activeEffect,
      dep,
      {
        target,
        type,
        key
      }
    );
  }
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  let deps = [];
  if (type === "clear") {
    deps = [...depsMap.values()];
  } else if (key === "length" && isArray(target)) {
    const newLength = Number(newValue);
    depsMap.forEach((dep, key2) => {
      if (key2 === "length" || !isSymbol(key2) && key2 >= newLength) {
        deps.push(dep);
      }
    });
  } else {
    if (key !== void 0) {
      deps.push(depsMap.get(key));
    }
    switch (type) {
      case "add":
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        } else if (isIntegerKey(key)) {
          deps.push(depsMap.get("length"));
        }
        break;
      case "delete":
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        }
        break;
      case "set":
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
        }
        break;
    }
  }
  pauseScheduling();
  for (const dep of deps) {
    if (dep) {
      triggerEffects(
        dep,
        4,
        {
          target,
          type,
          key,
          newValue,
          oldValue,
          oldTarget
        }
      );
    }
  }
  resetScheduling();
}
const isNonTrackableKeys = /* @__PURE__ */ makeMap(`__proto__,__v_isRef,__isVue`);
const builtInSymbols = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol)
);
const arrayInstrumentations = /* @__PURE__ */ createArrayInstrumentations();
function createArrayInstrumentations() {
  const instrumentations = {};
  ["includes", "indexOf", "lastIndexOf"].forEach((key) => {
    instrumentations[key] = function(...args) {
      const arr = toRaw(this);
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, "get", i + "");
      }
      const res = arr[key](...args);
      if (res === -1 || res === false) {
        return arr[key](...args.map(toRaw));
      } else {
        return res;
      }
    };
  });
  ["push", "pop", "shift", "unshift", "splice"].forEach((key) => {
    instrumentations[key] = function(...args) {
      pauseTracking();
      pauseScheduling();
      const res = toRaw(this)[key].apply(this, args);
      resetScheduling();
      resetTracking();
      return res;
    };
  });
  return instrumentations;
}
function hasOwnProperty(key) {
  const obj = toRaw(this);
  track(obj, "has", key);
  return obj.hasOwnProperty(key);
}
class BaseReactiveHandler {
  constructor(_isReadonly = false, _isShallow = false) {
    this._isReadonly = _isReadonly;
    this._isShallow = _isShallow;
  }
  get(target, key, receiver) {
    const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
    if (key === "__v_isReactive") {
      return !isReadonly2;
    } else if (key === "__v_isReadonly") {
      return isReadonly2;
    } else if (key === "__v_isShallow") {
      return isShallow2;
    } else if (key === "__v_raw") {
      if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || // receiver is not the reactive proxy, but has the same prototype
      // this means the reciever is a user proxy of the reactive proxy
      Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
        return target;
      }
      return;
    }
    const targetIsArray = isArray(target);
    if (!isReadonly2) {
      if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      if (key === "hasOwnProperty") {
        return hasOwnProperty;
      }
    }
    const res = Reflect.get(target, key, receiver);
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }
    if (!isReadonly2) {
      track(target, "get", key);
    }
    if (isShallow2) {
      return res;
    }
    if (isRef(res)) {
      return targetIsArray && isIntegerKey(key) ? res : res.value;
    }
    if (isObject(res)) {
      return isReadonly2 ? readonly(res) : reactive(res);
    }
    return res;
  }
}
class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow2 = false) {
    super(false, isShallow2);
  }
  set(target, key, value, receiver) {
    let oldValue = target[key];
    if (!this._isShallow) {
      const isOldValueReadonly = isReadonly(oldValue);
      if (!isShallow(value) && !isReadonly(value)) {
        oldValue = toRaw(oldValue);
        value = toRaw(value);
      }
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        if (isOldValueReadonly) {
          return false;
        } else {
          oldValue.value = value;
          return true;
        }
      }
    }
    const hadKey = isArray(target) && isIntegerKey(key) ? Number(key) < target.length : hasOwn(target, key);
    const result = Reflect.set(target, key, value, receiver);
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        trigger(target, "add", key, value);
      } else if (hasChanged(value, oldValue)) {
        trigger(target, "set", key, value, oldValue);
      }
    }
    return result;
  }
  deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
      trigger(target, "delete", key, void 0, oldValue);
    }
    return result;
  }
  has(target, key) {
    const result = Reflect.has(target, key);
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, "has", key);
    }
    return result;
  }
  ownKeys(target) {
    track(
      target,
      "iterate",
      isArray(target) ? "length" : ITERATE_KEY
    );
    return Reflect.ownKeys(target);
  }
}
class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow2 = false) {
    super(true, isShallow2);
  }
  set(target, key) {
    {
      warn$2(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
    }
    return true;
  }
  deleteProperty(target, key) {
    {
      warn$2(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      );
    }
    return true;
  }
}
const mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler();
const readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler();
const shallowReactiveHandlers = /* @__PURE__ */ new MutableReactiveHandler(
  true
);
const shallowReadonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler(true);
const toShallow = (value) => value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function get(target, key, isReadonly2 = false, isShallow2 = false) {
  target = target["__v_raw"];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly2) {
    if (hasChanged(key, rawKey)) {
      track(rawTarget, "get", key);
    }
    track(rawTarget, "get", rawKey);
  }
  const { has: has2 } = getProto(rawTarget);
  const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
  if (has2.call(rawTarget, key)) {
    return wrap(target.get(key));
  } else if (has2.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey));
  } else if (target !== rawTarget) {
    target.get(key);
  }
}
function has$1(key, isReadonly2 = false) {
  const target = this["__v_raw"];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly2) {
    if (hasChanged(key, rawKey)) {
      track(rawTarget, "has", key);
    }
    track(rawTarget, "has", rawKey);
  }
  return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
}
function size(target, isReadonly2 = false) {
  target = target["__v_raw"];
  !isReadonly2 && track(toRaw(target), "iterate", ITERATE_KEY);
  return Reflect.get(target, "size", target);
}
function add(value) {
  value = toRaw(value);
  const target = toRaw(this);
  const proto = getProto(target);
  const hadKey = proto.has.call(target, value);
  if (!hadKey) {
    target.add(value);
    trigger(target, "add", value, value);
  }
  return this;
}
function set$1(key, value) {
  value = toRaw(value);
  const target = toRaw(this);
  const { has: has2, get: get2 } = getProto(target);
  let hadKey = has2.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has2.call(target, key);
  } else {
    checkIdentityKeys(target, has2, key);
  }
  const oldValue = get2.call(target, key);
  target.set(key, value);
  if (!hadKey) {
    trigger(target, "add", key, value);
  } else if (hasChanged(value, oldValue)) {
    trigger(target, "set", key, value, oldValue);
  }
  return this;
}
function deleteEntry(key) {
  const target = toRaw(this);
  const { has: has2, get: get2 } = getProto(target);
  let hadKey = has2.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has2.call(target, key);
  } else {
    checkIdentityKeys(target, has2, key);
  }
  const oldValue = get2 ? get2.call(target, key) : void 0;
  const result = target.delete(key);
  if (hadKey) {
    trigger(target, "delete", key, void 0, oldValue);
  }
  return result;
}
function clear() {
  const target = toRaw(this);
  const hadItems = target.size !== 0;
  const oldTarget = isMap(target) ? new Map(target) : new Set(target);
  const result = target.clear();
  if (hadItems) {
    trigger(target, "clear", void 0, void 0, oldTarget);
  }
  return result;
}
function createForEach(isReadonly2, isShallow2) {
  return function forEach(callback, thisArg) {
    const observed = this;
    const target = observed["__v_raw"];
    const rawTarget = toRaw(target);
    const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
    !isReadonly2 && track(rawTarget, "iterate", ITERATE_KEY);
    return target.forEach((value, key) => {
      return callback.call(thisArg, wrap(value), wrap(key), observed);
    });
  };
}
function createIterableMethod(method, isReadonly2, isShallow2) {
  return function(...args) {
    const target = this["__v_raw"];
    const rawTarget = toRaw(target);
    const targetIsMap = isMap(rawTarget);
    const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
    const isKeyOnly = method === "keys" && targetIsMap;
    const innerIterator = target[method](...args);
    const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive;
    !isReadonly2 && track(
      rawTarget,
      "iterate",
      isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
    );
    return {
      // iterator protocol
      next() {
        const { value, done } = innerIterator.next();
        return done ? { value, done } : {
          value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
          done
        };
      },
      // iterable protocol
      [Symbol.iterator]() {
        return this;
      }
    };
  };
}
function createReadonlyMethod(type) {
  return function(...args) {
    {
      const key = args[0] ? `on key "${args[0]}" ` : ``;
      warn$2(
        `${capitalize(type)} operation ${key}failed: target is readonly.`,
        toRaw(this)
      );
    }
    return type === "delete" ? false : type === "clear" ? void 0 : this;
  };
}
function createInstrumentations() {
  const mutableInstrumentations2 = {
    get(key) {
      return get(this, key);
    },
    get size() {
      return size(this);
    },
    has: has$1,
    add,
    set: set$1,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false)
  };
  const shallowInstrumentations2 = {
    get(key) {
      return get(this, key, false, true);
    },
    get size() {
      return size(this);
    },
    has: has$1,
    add,
    set: set$1,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true)
  };
  const readonlyInstrumentations2 = {
    get(key) {
      return get(this, key, true);
    },
    get size() {
      return size(this, true);
    },
    has(key) {
      return has$1.call(this, key, true);
    },
    add: createReadonlyMethod("add"),
    set: createReadonlyMethod("set"),
    delete: createReadonlyMethod("delete"),
    clear: createReadonlyMethod("clear"),
    forEach: createForEach(true, false)
  };
  const shallowReadonlyInstrumentations2 = {
    get(key) {
      return get(this, key, true, true);
    },
    get size() {
      return size(this, true);
    },
    has(key) {
      return has$1.call(this, key, true);
    },
    add: createReadonlyMethod("add"),
    set: createReadonlyMethod("set"),
    delete: createReadonlyMethod("delete"),
    clear: createReadonlyMethod("clear"),
    forEach: createForEach(true, true)
  };
  const iteratorMethods = [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ];
  iteratorMethods.forEach((method) => {
    mutableInstrumentations2[method] = createIterableMethod(method, false, false);
    readonlyInstrumentations2[method] = createIterableMethod(method, true, false);
    shallowInstrumentations2[method] = createIterableMethod(method, false, true);
    shallowReadonlyInstrumentations2[method] = createIterableMethod(
      method,
      true,
      true
    );
  });
  return [
    mutableInstrumentations2,
    readonlyInstrumentations2,
    shallowInstrumentations2,
    shallowReadonlyInstrumentations2
  ];
}
const [
  mutableInstrumentations,
  readonlyInstrumentations,
  shallowInstrumentations,
  shallowReadonlyInstrumentations
] = /* @__PURE__ */ createInstrumentations();
function createInstrumentationGetter(isReadonly2, shallow) {
  const instrumentations = shallow ? isReadonly2 ? shallowReadonlyInstrumentations : shallowInstrumentations : isReadonly2 ? readonlyInstrumentations : mutableInstrumentations;
  return (target, key, receiver) => {
    if (key === "__v_isReactive") {
      return !isReadonly2;
    } else if (key === "__v_isReadonly") {
      return isReadonly2;
    } else if (key === "__v_raw") {
      return target;
    }
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target ? instrumentations : target,
      key,
      receiver
    );
  };
}
const mutableCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(false, false)
};
const shallowCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(false, true)
};
const readonlyCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(true, false)
};
const shallowReadonlyCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(true, true)
};
function checkIdentityKeys(target, has2, key) {
  const rawKey = toRaw(key);
  if (rawKey !== key && has2.call(target, rawKey)) {
    const type = toRawType(target);
    warn$2(
      `Reactive ${type} contains both the raw and reactive versions of the same object${type === `Map` ? ` as keys` : ``}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`
    );
  }
}
const reactiveMap = /* @__PURE__ */ new WeakMap();
const shallowReactiveMap = /* @__PURE__ */ new WeakMap();
const readonlyMap = /* @__PURE__ */ new WeakMap();
const shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
function targetTypeMap(rawType) {
  switch (rawType) {
    case "Object":
    case "Array":
      return 1;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;
    default:
      return 0;
  }
}
function getTargetType(value) {
  return value["__v_skip"] || !Object.isExtensible(value) ? 0 : targetTypeMap(toRawType(value));
}
function reactive(target) {
  if (isReadonly(target)) {
    return target;
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  );
}
function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  );
}
function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  );
}
function shallowReadonly(target) {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  );
}
function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
  if (!isObject(target)) {
    {
      warn$2(`value cannot be made reactive: ${String(target)}`);
    }
    return target;
  }
  if (target["__v_raw"] && !(isReadonly2 && target["__v_isReactive"])) {
    return target;
  }
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  const targetType = getTargetType(target);
  if (targetType === 0) {
    return target;
  }
  const proxy = new Proxy(
    target,
    targetType === 2 ? collectionHandlers : baseHandlers
  );
  proxyMap.set(target, proxy);
  return proxy;
}
function isReactive(value) {
  if (isReadonly(value)) {
    return isReactive(value["__v_raw"]);
  }
  return !!(value && value["__v_isReactive"]);
}
function isReadonly(value) {
  return !!(value && value["__v_isReadonly"]);
}
function isShallow(value) {
  return !!(value && value["__v_isShallow"]);
}
function toRaw(observed) {
  const raw = observed && observed["__v_raw"];
  return raw ? toRaw(raw) : observed;
}
function markRaw(value) {
  if (Object.isExtensible(value)) {
    def(value, "__v_skip", true);
  }
  return value;
}
const toReactive = (value) => isObject(value) ? reactive(value) : value;
const toReadonly = (value) => isObject(value) ? readonly(value) : value;
const COMPUTED_SIDE_EFFECT_WARN = `Computed is still dirty after getter evaluation, likely because a computed is mutating its own dependency in its getter. State mutations in computed getters should be avoided.  Check the docs for more details: https://vuejs.org/guide/essentials/computed.html#getters-should-be-side-effect-free`;
class ComputedRefImpl {
  constructor(getter, _setter, isReadonly2, isSSR) {
    this.getter = getter;
    this._setter = _setter;
    this.dep = void 0;
    this.__v_isRef = true;
    this["__v_isReadonly"] = false;
    this.effect = new ReactiveEffect(
      () => getter(this._value),
      () => triggerRefValue(
        this,
        this.effect._dirtyLevel === 2 ? 2 : 3
      )
    );
    this.effect.computed = this;
    this.effect.active = this._cacheable = !isSSR;
    this["__v_isReadonly"] = isReadonly2;
  }
  get value() {
    const self2 = toRaw(this);
    if ((!self2._cacheable || self2.effect.dirty) && hasChanged(self2._value, self2._value = self2.effect.run())) {
      triggerRefValue(self2, 4);
    }
    trackRefValue(self2);
    if (self2.effect._dirtyLevel >= 2) {
      if (this._warnRecursive) {
        warn$2(COMPUTED_SIDE_EFFECT_WARN, `

getter: `, this.getter);
      }
      triggerRefValue(self2, 2);
    }
    return self2._value;
  }
  set value(newValue) {
    this._setter(newValue);
  }
  // #region polyfill _dirty for backward compatibility third party code for Vue <= 3.3.x
  get _dirty() {
    return this.effect.dirty;
  }
  set _dirty(v) {
    this.effect.dirty = v;
  }
  // #endregion
}
function computed$1(getterOrOptions, debugOptions, isSSR = false) {
  let getter;
  let setter;
  const onlyGetter = isFunction(getterOrOptions);
  if (onlyGetter) {
    getter = getterOrOptions;
    setter = () => {
      warn$2("Write operation failed: computed value is readonly");
    };
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  const cRef = new ComputedRefImpl(getter, setter, onlyGetter || !setter, isSSR);
  if (debugOptions && !isSSR) {
    cRef.effect.onTrack = debugOptions.onTrack;
    cRef.effect.onTrigger = debugOptions.onTrigger;
  }
  return cRef;
}
function trackRefValue(ref2) {
  var _a;
  if (shouldTrack && activeEffect) {
    ref2 = toRaw(ref2);
    trackEffect(
      activeEffect,
      (_a = ref2.dep) != null ? _a : ref2.dep = createDep(
        () => ref2.dep = void 0,
        ref2 instanceof ComputedRefImpl ? ref2 : void 0
      ),
      {
        target: ref2,
        type: "get",
        key: "value"
      }
    );
  }
}
function triggerRefValue(ref2, dirtyLevel = 4, newVal) {
  ref2 = toRaw(ref2);
  const dep = ref2.dep;
  if (dep) {
    triggerEffects(
      dep,
      dirtyLevel,
      {
        target: ref2,
        type: "set",
        key: "value",
        newValue: newVal
      }
    );
  }
}
function isRef(r2) {
  return !!(r2 && r2.__v_isRef === true);
}
function ref(value) {
  return createRef(value, false);
}
function createRef(rawValue, shallow) {
  if (isRef(rawValue)) {
    return rawValue;
  }
  return new RefImpl(rawValue, shallow);
}
class RefImpl {
  constructor(value, __v_isShallow) {
    this.__v_isShallow = __v_isShallow;
    this.dep = void 0;
    this.__v_isRef = true;
    this._rawValue = __v_isShallow ? value : toRaw(value);
    this._value = __v_isShallow ? value : toReactive(value);
  }
  get value() {
    trackRefValue(this);
    return this._value;
  }
  set value(newVal) {
    const useDirectValue = this.__v_isShallow || isShallow(newVal) || isReadonly(newVal);
    newVal = useDirectValue ? newVal : toRaw(newVal);
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal;
      this._value = useDirectValue ? newVal : toReactive(newVal);
      triggerRefValue(this, 4, newVal);
    }
  }
}
function unref(ref2) {
  return isRef(ref2) ? ref2.value : ref2;
}
const shallowUnwrapHandlers = {
  get: (target, key, receiver) => unref(Reflect.get(target, key, receiver)),
  set: (target, key, value, receiver) => {
    const oldValue = target[key];
    if (isRef(oldValue) && !isRef(value)) {
      oldValue.value = value;
      return true;
    } else {
      return Reflect.set(target, key, value, receiver);
    }
  }
};
function proxyRefs(objectWithRefs) {
  return isReactive(objectWithRefs) ? objectWithRefs : new Proxy(objectWithRefs, shallowUnwrapHandlers);
}
const stack = [];
function pushWarningContext(vnode) {
  stack.push(vnode);
}
function popWarningContext() {
  stack.pop();
}
function warn$1(msg, ...args) {
  pauseTracking();
  const instance = stack.length ? stack[stack.length - 1].component : null;
  const appWarnHandler = instance && instance.appContext.config.warnHandler;
  const trace = getComponentTrace();
  if (appWarnHandler) {
    callWithErrorHandling(
      appWarnHandler,
      instance,
      11,
      [
        msg + args.map((a) => {
          var _a, _b;
          return (_b = (_a = a.toString) == null ? void 0 : _a.call(a)) != null ? _b : JSON.stringify(a);
        }).join(""),
        instance && instance.proxy,
        trace.map(
          ({ vnode }) => `at <${formatComponentName(instance, vnode.type)}>`
        ).join("\n"),
        trace
      ]
    );
  } else {
    const warnArgs = [`[Vue warn]: ${msg}`, ...args];
    if (trace.length && // avoid spamming console during tests
    true) {
      warnArgs.push(`
`, ...formatTrace(trace));
    }
    console.warn(...warnArgs);
  }
  resetTracking();
}
function getComponentTrace() {
  let currentVNode = stack[stack.length - 1];
  if (!currentVNode) {
    return [];
  }
  const normalizedStack = [];
  while (currentVNode) {
    const last = normalizedStack[0];
    if (last && last.vnode === currentVNode) {
      last.recurseCount++;
    } else {
      normalizedStack.push({
        vnode: currentVNode,
        recurseCount: 0
      });
    }
    const parentInstance = currentVNode.component && currentVNode.component.parent;
    currentVNode = parentInstance && parentInstance.vnode;
  }
  return normalizedStack;
}
function formatTrace(trace) {
  const logs = [];
  trace.forEach((entry, i) => {
    logs.push(...i === 0 ? [] : [`
`], ...formatTraceEntry(entry));
  });
  return logs;
}
function formatTraceEntry({ vnode, recurseCount }) {
  const postfix = recurseCount > 0 ? `... (${recurseCount} recursive calls)` : ``;
  const isRoot = vnode.component ? vnode.component.parent == null : false;
  const open = ` at <${formatComponentName(
    vnode.component,
    vnode.type,
    isRoot
  )}`;
  const close = `>` + postfix;
  return vnode.props ? [open, ...formatProps(vnode.props), close] : [open + close];
}
function formatProps(props) {
  const res = [];
  const keys = Object.keys(props);
  keys.slice(0, 3).forEach((key) => {
    res.push(...formatProp(key, props[key]));
  });
  if (keys.length > 3) {
    res.push(` ...`);
  }
  return res;
}
function formatProp(key, value, raw) {
  if (isString(value)) {
    value = JSON.stringify(value);
    return raw ? value : [`${key}=${value}`];
  } else if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return raw ? value : [`${key}=${value}`];
  } else if (isRef(value)) {
    value = formatProp(key, toRaw(value.value), true);
    return raw ? value : [`${key}=Ref<`, value, `>`];
  } else if (isFunction(value)) {
    return [`${key}=fn${value.name ? `<${value.name}>` : ``}`];
  } else {
    value = toRaw(value);
    return raw ? value : [`${key}=`, value];
  }
}
const ErrorTypeStrings = {
  ["sp"]: "serverPrefetch hook",
  ["bc"]: "beforeCreate hook",
  ["c"]: "created hook",
  ["bm"]: "beforeMount hook",
  ["m"]: "mounted hook",
  ["bu"]: "beforeUpdate hook",
  ["u"]: "updated",
  ["bum"]: "beforeUnmount hook",
  ["um"]: "unmounted hook",
  ["a"]: "activated hook",
  ["da"]: "deactivated hook",
  ["ec"]: "errorCaptured hook",
  ["rtc"]: "renderTracked hook",
  ["rtg"]: "renderTriggered hook",
  [0]: "setup function",
  [1]: "render function",
  [2]: "watcher getter",
  [3]: "watcher callback",
  [4]: "watcher cleanup function",
  [5]: "native event handler",
  [6]: "component event handler",
  [7]: "vnode hook",
  [8]: "directive hook",
  [9]: "transition hook",
  [10]: "app errorHandler",
  [11]: "app warnHandler",
  [12]: "ref function",
  [13]: "async component loader",
  [14]: "scheduler flush. This is likely a Vue internals bug. Please open an issue at https://github.com/vuejs/core ."
};
function callWithErrorHandling(fn, instance, type, args) {
  try {
    return args ? fn(...args) : fn();
  } catch (err) {
    handleError(err, instance, type);
  }
}
function callWithAsyncErrorHandling(fn, instance, type, args) {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn, instance, type, args);
    if (res && isPromise(res)) {
      res.catch((err) => {
        handleError(err, instance, type);
      });
    }
    return res;
  }
  const values = [];
  for (let i = 0; i < fn.length; i++) {
    values.push(callWithAsyncErrorHandling(fn[i], instance, type, args));
  }
  return values;
}
function handleError(err, instance, type, throwInDev = true) {
  const contextVNode = instance ? instance.vnode : null;
  if (instance) {
    let cur = instance.parent;
    const exposedInstance = instance.proxy;
    const errorInfo = ErrorTypeStrings[type] || type;
    while (cur) {
      const errorCapturedHooks = cur.ec;
      if (errorCapturedHooks) {
        for (let i = 0; i < errorCapturedHooks.length; i++) {
          if (errorCapturedHooks[i](err, exposedInstance, errorInfo) === false) {
            return;
          }
        }
      }
      cur = cur.parent;
    }
    const appErrorHandler = instance.appContext.config.errorHandler;
    if (appErrorHandler) {
      callWithErrorHandling(
        appErrorHandler,
        null,
        10,
        [err, exposedInstance, errorInfo]
      );
      return;
    }
  }
  logError(err, type, contextVNode, throwInDev);
}
function logError(err, type, contextVNode, throwInDev = true) {
  {
    const info = ErrorTypeStrings[type] || type;
    if (contextVNode) {
      pushWarningContext(contextVNode);
    }
    warn$1(`Unhandled error${info ? ` during execution of ${info}` : ``}`);
    if (contextVNode) {
      popWarningContext();
    }
    if (throwInDev) {
      console.error(err);
    } else {
      console.error(err);
    }
  }
}
let isFlushing = false;
let isFlushPending = false;
const queue$1 = [];
let flushIndex = 0;
const pendingPostFlushCbs = [];
let activePostFlushCbs = null;
let postFlushIndex = 0;
const resolvedPromise = /* @__PURE__ */ Promise.resolve();
let currentFlushPromise = null;
const RECURSION_LIMIT = 100;
function nextTick$1(fn) {
  const p2 = currentFlushPromise || resolvedPromise;
  return fn ? p2.then(this ? fn.bind(this) : fn) : p2;
}
function findInsertionIndex(id) {
  let start = flushIndex + 1;
  let end = queue$1.length;
  while (start < end) {
    const middle = start + end >>> 1;
    const middleJob = queue$1[middle];
    const middleJobId = getId(middleJob);
    if (middleJobId < id || middleJobId === id && middleJob.pre) {
      start = middle + 1;
    } else {
      end = middle;
    }
  }
  return start;
}
function queueJob(job) {
  if (!queue$1.length || !queue$1.includes(
    job,
    isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex
  )) {
    if (job.id == null) {
      queue$1.push(job);
    } else {
      queue$1.splice(findInsertionIndex(job.id), 0, job);
    }
    queueFlush();
  }
}
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}
function hasQueueJob(job) {
  return queue$1.indexOf(job) > -1;
}
function invalidateJob(job) {
  const i = queue$1.indexOf(job);
  if (i > flushIndex) {
    queue$1.splice(i, 1);
  }
}
function queuePostFlushCb(cb) {
  if (!isArray(cb)) {
    if (!activePostFlushCbs || !activePostFlushCbs.includes(
      cb,
      cb.allowRecurse ? postFlushIndex + 1 : postFlushIndex
    )) {
      pendingPostFlushCbs.push(cb);
    }
  } else {
    pendingPostFlushCbs.push(...cb);
  }
  queueFlush();
}
function flushPreFlushCbs(instance, seen, i = isFlushing ? flushIndex + 1 : 0) {
  {
    seen = seen || /* @__PURE__ */ new Map();
  }
  for (; i < queue$1.length; i++) {
    const cb = queue$1[i];
    if (cb && cb.pre) {
      if (checkRecursiveUpdates(seen, cb)) {
        continue;
      }
      queue$1.splice(i, 1);
      i--;
      cb();
    }
  }
}
function flushPostFlushCbs(seen) {
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)].sort(
      (a, b) => getId(a) - getId(b)
    );
    pendingPostFlushCbs.length = 0;
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped);
      return;
    }
    activePostFlushCbs = deduped;
    {
      seen = seen || /* @__PURE__ */ new Map();
    }
    for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
      if (checkRecursiveUpdates(seen, activePostFlushCbs[postFlushIndex])) {
        continue;
      }
      activePostFlushCbs[postFlushIndex]();
    }
    activePostFlushCbs = null;
    postFlushIndex = 0;
  }
}
const getId = (job) => job.id == null ? Infinity : job.id;
const comparator = (a, b) => {
  const diff2 = getId(a) - getId(b);
  if (diff2 === 0) {
    if (a.pre && !b.pre)
      return -1;
    if (b.pre && !a.pre)
      return 1;
  }
  return diff2;
};
function flushJobs(seen) {
  isFlushPending = false;
  isFlushing = true;
  {
    seen = seen || /* @__PURE__ */ new Map();
  }
  queue$1.sort(comparator);
  const check = (job) => checkRecursiveUpdates(seen, job);
  try {
    for (flushIndex = 0; flushIndex < queue$1.length; flushIndex++) {
      const job = queue$1[flushIndex];
      if (job && job.active !== false) {
        if (check(job)) {
          continue;
        }
        callWithErrorHandling(job, null, 14);
      }
    }
  } finally {
    flushIndex = 0;
    queue$1.length = 0;
    flushPostFlushCbs(seen);
    isFlushing = false;
    currentFlushPromise = null;
    if (queue$1.length || pendingPostFlushCbs.length) {
      flushJobs(seen);
    }
  }
}
function checkRecursiveUpdates(seen, fn) {
  if (!seen.has(fn)) {
    seen.set(fn, 1);
  } else {
    const count = seen.get(fn);
    if (count > RECURSION_LIMIT) {
      const instance = fn.ownerInstance;
      const componentName = instance && getComponentName(instance.type);
      handleError(
        `Maximum recursive updates exceeded${componentName ? ` in component <${componentName}>` : ``}. This means you have a reactive effect that is mutating its own dependencies and thus recursively triggering itself. Possible sources include component template, render function, updated hook or watcher source function.`,
        null,
        10
      );
      return true;
    } else {
      seen.set(fn, count + 1);
    }
  }
}
let devtools;
let buffer = [];
let devtoolsNotInstalled = false;
function emit$1(event, ...args) {
  if (devtools) {
    devtools.emit(event, ...args);
  } else if (!devtoolsNotInstalled) {
    buffer.push({ event, args });
  }
}
function setDevtoolsHook(hook, target) {
  var _a, _b;
  devtools = hook;
  if (devtools) {
    devtools.enabled = true;
    buffer.forEach(({ event, args }) => devtools.emit(event, ...args));
    buffer = [];
  } else if (
    // handle late devtools injection - only do this if we are in an actual
    // browser environment to avoid the timer handle stalling test runner exit
    // (#4815)
    typeof window !== "undefined" && // some envs mock window but not fully
    window.HTMLElement && // also exclude jsdom
    !((_b = (_a = window.navigator) == null ? void 0 : _a.userAgent) == null ? void 0 : _b.includes("jsdom"))
  ) {
    const replay = target.__VUE_DEVTOOLS_HOOK_REPLAY__ = target.__VUE_DEVTOOLS_HOOK_REPLAY__ || [];
    replay.push((newHook) => {
      setDevtoolsHook(newHook, target);
    });
    setTimeout(() => {
      if (!devtools) {
        target.__VUE_DEVTOOLS_HOOK_REPLAY__ = null;
        devtoolsNotInstalled = true;
        buffer = [];
      }
    }, 3e3);
  } else {
    devtoolsNotInstalled = true;
    buffer = [];
  }
}
function devtoolsInitApp(app, version2) {
  emit$1("app:init", app, version2, {
    Fragment,
    Text,
    Comment,
    Static
  });
}
const devtoolsComponentAdded = /* @__PURE__ */ createDevtoolsComponentHook(
  "component:added"
  /* COMPONENT_ADDED */
);
const devtoolsComponentUpdated = /* @__PURE__ */ createDevtoolsComponentHook(
  "component:updated"
  /* COMPONENT_UPDATED */
);
const _devtoolsComponentRemoved = /* @__PURE__ */ createDevtoolsComponentHook(
  "component:removed"
  /* COMPONENT_REMOVED */
);
const devtoolsComponentRemoved = (component) => {
  if (devtools && typeof devtools.cleanupBuffer === "function" && // remove the component if it wasn't buffered
  !devtools.cleanupBuffer(component)) {
    _devtoolsComponentRemoved(component);
  }
};
/*! #__NO_SIDE_EFFECTS__ */
// @__NO_SIDE_EFFECTS__
function createDevtoolsComponentHook(hook) {
  return (component) => {
    emit$1(
      hook,
      component.appContext.app,
      component.uid,
      // fixed by xxxxxx
      // 为 0 是 App，无 parent 是 Page 指向 App
      component.uid === 0 ? void 0 : component.parent ? component.parent.uid : 0,
      component
    );
  };
}
const devtoolsPerfStart = /* @__PURE__ */ createDevtoolsPerformanceHook(
  "perf:start"
  /* PERFORMANCE_START */
);
const devtoolsPerfEnd = /* @__PURE__ */ createDevtoolsPerformanceHook(
  "perf:end"
  /* PERFORMANCE_END */
);
function createDevtoolsPerformanceHook(hook) {
  return (component, type, time) => {
    emit$1(hook, component.appContext.app, component.uid, component, type, time);
  };
}
function devtoolsComponentEmit(component, event, params) {
  emit$1(
    "component:emit",
    component.appContext.app,
    component,
    event,
    params
  );
}
function emit(instance, event, ...rawArgs) {
  if (instance.isUnmounted)
    return;
  const props = instance.vnode.props || EMPTY_OBJ;
  {
    const {
      emitsOptions,
      propsOptions: [propsOptions]
    } = instance;
    if (emitsOptions) {
      if (!(event in emitsOptions) && true) {
        if (!propsOptions || !(toHandlerKey(event) in propsOptions)) {
          warn$1(
            `Component emitted event "${event}" but it is neither declared in the emits option nor as an "${toHandlerKey(event)}" prop.`
          );
        }
      } else {
        const validator = emitsOptions[event];
        if (isFunction(validator)) {
          const isValid = validator(...rawArgs);
          if (!isValid) {
            warn$1(
              `Invalid event arguments: event validation failed for event "${event}".`
            );
          }
        }
      }
    }
  }
  let args = rawArgs;
  const isModelListener2 = event.startsWith("update:");
  const modelArg = isModelListener2 && event.slice(7);
  if (modelArg && modelArg in props) {
    const modifiersKey = `${modelArg === "modelValue" ? "model" : modelArg}Modifiers`;
    const { number, trim } = props[modifiersKey] || EMPTY_OBJ;
    if (trim) {
      args = rawArgs.map((a) => isString(a) ? a.trim() : a);
    }
    if (number) {
      args = rawArgs.map(looseToNumber);
    }
  }
  {
    devtoolsComponentEmit(instance, event, args);
  }
  {
    const lowerCaseEvent = event.toLowerCase();
    if (lowerCaseEvent !== event && props[toHandlerKey(lowerCaseEvent)]) {
      warn$1(
        `Event "${lowerCaseEvent}" is emitted in component ${formatComponentName(
          instance,
          instance.type
        )} but the handler is registered for "${event}". Note that HTML attributes are case-insensitive and you cannot use v-on to listen to camelCase events when using in-DOM templates. You should probably use "${hyphenate(
          event
        )}" instead of "${event}".`
      );
    }
  }
  let handlerName;
  let handler = props[handlerName = toHandlerKey(event)] || // also try camelCase event handler (#2249)
  props[handlerName = toHandlerKey(camelize(event))];
  if (!handler && isModelListener2) {
    handler = props[handlerName = toHandlerKey(hyphenate(event))];
  }
  if (handler) {
    callWithAsyncErrorHandling(
      handler,
      instance,
      6,
      args
    );
  }
  const onceHandler = props[handlerName + `Once`];
  if (onceHandler) {
    if (!instance.emitted) {
      instance.emitted = {};
    } else if (instance.emitted[handlerName]) {
      return;
    }
    instance.emitted[handlerName] = true;
    callWithAsyncErrorHandling(
      onceHandler,
      instance,
      6,
      args
    );
  }
}
function normalizeEmitsOptions(comp, appContext, asMixin = false) {
  const cache = appContext.emitsCache;
  const cached = cache.get(comp);
  if (cached !== void 0) {
    return cached;
  }
  const raw = comp.emits;
  let normalized = {};
  let hasExtends = false;
  if (!isFunction(comp)) {
    const extendEmits = (raw2) => {
      const normalizedFromExtend = normalizeEmitsOptions(raw2, appContext, true);
      if (normalizedFromExtend) {
        hasExtends = true;
        extend(normalized, normalizedFromExtend);
      }
    };
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendEmits);
    }
    if (comp.extends) {
      extendEmits(comp.extends);
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendEmits);
    }
  }
  if (!raw && !hasExtends) {
    if (isObject(comp)) {
      cache.set(comp, null);
    }
    return null;
  }
  if (isArray(raw)) {
    raw.forEach((key) => normalized[key] = null);
  } else {
    extend(normalized, raw);
  }
  if (isObject(comp)) {
    cache.set(comp, normalized);
  }
  return normalized;
}
function isEmitListener(options, key) {
  if (!options || !isOn(key)) {
    return false;
  }
  key = key.slice(2).replace(/Once$/, "");
  return hasOwn(options, key[0].toLowerCase() + key.slice(1)) || hasOwn(options, hyphenate(key)) || hasOwn(options, key);
}
let currentRenderingInstance = null;
function setCurrentRenderingInstance(instance) {
  const prev = currentRenderingInstance;
  currentRenderingInstance = instance;
  instance && instance.type.__scopeId || null;
  return prev;
}
const INITIAL_WATCHER_VALUE = {};
function watch(source, cb, options) {
  if (!isFunction(cb)) {
    warn$1(
      `\`watch(fn, options?)\` signature has been moved to a separate API. Use \`watchEffect(fn, options?)\` instead. \`watch\` now only supports \`watch(source, cb, options?) signature.`
    );
  }
  return doWatch(source, cb, options);
}
function doWatch(source, cb, {
  immediate,
  deep,
  flush,
  once: once2,
  onTrack,
  onTrigger
} = EMPTY_OBJ) {
  if (cb && once2) {
    const _cb = cb;
    cb = (...args) => {
      _cb(...args);
      unwatch();
    };
  }
  if (deep !== void 0 && typeof deep === "number") {
    warn$1(
      `watch() "deep" option with number value will be used as watch depth in future versions. Please use a boolean instead to avoid potential breakage.`
    );
  }
  if (!cb) {
    if (immediate !== void 0) {
      warn$1(
        `watch() "immediate" option is only respected when using the watch(source, callback, options?) signature.`
      );
    }
    if (deep !== void 0) {
      warn$1(
        `watch() "deep" option is only respected when using the watch(source, callback, options?) signature.`
      );
    }
    if (once2 !== void 0) {
      warn$1(
        `watch() "once" option is only respected when using the watch(source, callback, options?) signature.`
      );
    }
  }
  const warnInvalidSource = (s2) => {
    warn$1(
      `Invalid watch source: `,
      s2,
      `A watch source can only be a getter/effect function, a ref, a reactive object, or an array of these types.`
    );
  };
  const instance = currentInstance;
  const reactiveGetter = (source2) => deep === true ? source2 : (
    // for deep: false, only traverse root-level properties
    traverse(source2, deep === false ? 1 : void 0)
  );
  let getter;
  let forceTrigger = false;
  let isMultiSource = false;
  if (isRef(source)) {
    getter = () => source.value;
    forceTrigger = isShallow(source);
  } else if (isReactive(source)) {
    getter = () => reactiveGetter(source);
    forceTrigger = true;
  } else if (isArray(source)) {
    isMultiSource = true;
    forceTrigger = source.some((s2) => isReactive(s2) || isShallow(s2));
    getter = () => source.map((s2) => {
      if (isRef(s2)) {
        return s2.value;
      } else if (isReactive(s2)) {
        return reactiveGetter(s2);
      } else if (isFunction(s2)) {
        return callWithErrorHandling(s2, instance, 2);
      } else {
        warnInvalidSource(s2);
      }
    });
  } else if (isFunction(source)) {
    if (cb) {
      getter = () => callWithErrorHandling(source, instance, 2);
    } else {
      getter = () => {
        if (cleanup) {
          cleanup();
        }
        return callWithAsyncErrorHandling(
          source,
          instance,
          3,
          [onCleanup]
        );
      };
    }
  } else {
    getter = NOOP;
    warnInvalidSource(source);
  }
  if (cb && deep) {
    const baseGetter = getter;
    getter = () => traverse(baseGetter());
  }
  let cleanup;
  let onCleanup = (fn) => {
    cleanup = effect2.onStop = () => {
      callWithErrorHandling(fn, instance, 4);
      cleanup = effect2.onStop = void 0;
    };
  };
  let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
  const job = () => {
    if (!effect2.active || !effect2.dirty) {
      return;
    }
    if (cb) {
      const newValue = effect2.run();
      if (deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue)) || false) {
        if (cleanup) {
          cleanup();
        }
        callWithAsyncErrorHandling(cb, instance, 3, [
          newValue,
          // pass undefined as the old value when it's changed for the first time
          oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
          onCleanup
        ]);
        oldValue = newValue;
      }
    } else {
      effect2.run();
    }
  };
  job.allowRecurse = !!cb;
  let scheduler;
  if (flush === "sync") {
    scheduler = job;
  } else if (flush === "post") {
    scheduler = () => queuePostRenderEffect$1(job, instance && instance.suspense);
  } else {
    job.pre = true;
    if (instance)
      job.id = instance.uid;
    scheduler = () => queueJob(job);
  }
  const effect2 = new ReactiveEffect(getter, NOOP, scheduler);
  const scope = getCurrentScope();
  const unwatch = () => {
    effect2.stop();
    if (scope) {
      remove(scope.effects, effect2);
    }
  };
  {
    effect2.onTrack = onTrack;
    effect2.onTrigger = onTrigger;
  }
  if (cb) {
    if (immediate) {
      job();
    } else {
      oldValue = effect2.run();
    }
  } else if (flush === "post") {
    queuePostRenderEffect$1(
      effect2.run.bind(effect2),
      instance && instance.suspense
    );
  } else {
    effect2.run();
  }
  return unwatch;
}
function instanceWatch(source, value, options) {
  const publicThis = this.proxy;
  const getter = isString(source) ? source.includes(".") ? createPathGetter(publicThis, source) : () => publicThis[source] : source.bind(publicThis, publicThis);
  let cb;
  if (isFunction(value)) {
    cb = value;
  } else {
    cb = value.handler;
    options = value;
  }
  const reset = setCurrentInstance(this);
  const res = doWatch(getter, cb.bind(publicThis), options);
  reset();
  return res;
}
function createPathGetter(ctx, path) {
  const segments = path.split(".");
  return () => {
    let cur = ctx;
    for (let i = 0; i < segments.length && cur; i++) {
      cur = cur[segments[i]];
    }
    return cur;
  };
}
function traverse(value, depth, currentDepth = 0, seen) {
  if (!isObject(value) || value["__v_skip"]) {
    return value;
  }
  if (depth && depth > 0) {
    if (currentDepth >= depth) {
      return value;
    }
    currentDepth++;
  }
  seen = seen || /* @__PURE__ */ new Set();
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  if (isRef(value)) {
    traverse(value.value, depth, currentDepth, seen);
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, currentDepth, seen);
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v) => {
      traverse(v, depth, currentDepth, seen);
    });
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], depth, currentDepth, seen);
    }
  }
  return value;
}
function validateDirectiveName(name) {
  if (isBuiltInDirective(name)) {
    warn$1("Do not use built-in directive ids as custom directive id: " + name);
  }
}
function createAppContext() {
  return {
    app: null,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: void 0,
      warnHandler: void 0,
      compilerOptions: {}
    },
    mixins: [],
    components: {},
    directives: {},
    provides: /* @__PURE__ */ Object.create(null),
    optionsCache: /* @__PURE__ */ new WeakMap(),
    propsCache: /* @__PURE__ */ new WeakMap(),
    emitsCache: /* @__PURE__ */ new WeakMap()
  };
}
let uid$1 = 0;
function createAppAPI(render, hydrate) {
  return function createApp2(rootComponent, rootProps = null) {
    if (!isFunction(rootComponent)) {
      rootComponent = extend({}, rootComponent);
    }
    if (rootProps != null && !isObject(rootProps)) {
      warn$1(`root props passed to app.mount() must be an object.`);
      rootProps = null;
    }
    const context = createAppContext();
    const installedPlugins = /* @__PURE__ */ new WeakSet();
    const app = context.app = {
      _uid: uid$1++,
      _component: rootComponent,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,
      version,
      get config() {
        return context.config;
      },
      set config(v) {
        {
          warn$1(
            `app.config cannot be replaced. Modify individual options instead.`
          );
        }
      },
      use(plugin2, ...options) {
        if (installedPlugins.has(plugin2)) {
          warn$1(`Plugin has already been applied to target app.`);
        } else if (plugin2 && isFunction(plugin2.install)) {
          installedPlugins.add(plugin2);
          plugin2.install(app, ...options);
        } else if (isFunction(plugin2)) {
          installedPlugins.add(plugin2);
          plugin2(app, ...options);
        } else {
          warn$1(
            `A plugin must either be a function or an object with an "install" function.`
          );
        }
        return app;
      },
      mixin(mixin) {
        {
          if (!context.mixins.includes(mixin)) {
            context.mixins.push(mixin);
          } else {
            warn$1(
              "Mixin has already been applied to target app" + (mixin.name ? `: ${mixin.name}` : "")
            );
          }
        }
        return app;
      },
      component(name, component) {
        {
          validateComponentName(name, context.config);
        }
        if (!component) {
          return context.components[name];
        }
        if (context.components[name]) {
          warn$1(`Component "${name}" has already been registered in target app.`);
        }
        context.components[name] = component;
        return app;
      },
      directive(name, directive) {
        {
          validateDirectiveName(name);
        }
        if (!directive) {
          return context.directives[name];
        }
        if (context.directives[name]) {
          warn$1(`Directive "${name}" has already been registered in target app.`);
        }
        context.directives[name] = directive;
        return app;
      },
      // fixed by xxxxxx
      mount() {
      },
      // fixed by xxxxxx
      unmount() {
      },
      provide(key, value) {
        if (key in context.provides) {
          warn$1(
            `App already provides property with key "${String(key)}". It will be overwritten with the new value.`
          );
        }
        context.provides[key] = value;
        return app;
      },
      runWithContext(fn) {
        const lastApp = currentApp;
        currentApp = app;
        try {
          return fn();
        } finally {
          currentApp = lastApp;
        }
      }
    };
    return app;
  };
}
let currentApp = null;
function provide(key, value) {
  if (!currentInstance) {
    {
      warn$1(`provide() can only be used inside setup().`);
    }
  } else {
    let provides = currentInstance.provides;
    const parentProvides = currentInstance.parent && currentInstance.parent.provides;
    if (parentProvides === provides) {
      provides = currentInstance.provides = Object.create(parentProvides);
    }
    provides[key] = value;
    if (currentInstance.type.mpType === "app") {
      currentInstance.appContext.app.provide(key, value);
    }
  }
}
function inject(key, defaultValue, treatDefaultAsFactory = false) {
  const instance = currentInstance || currentRenderingInstance;
  if (instance || currentApp) {
    const provides = instance ? instance.parent == null ? instance.vnode.appContext && instance.vnode.appContext.provides : instance.parent.provides : currentApp._context.provides;
    if (provides && key in provides) {
      return provides[key];
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue) ? defaultValue.call(instance && instance.proxy) : defaultValue;
    } else {
      warn$1(`injection "${String(key)}" not found.`);
    }
  } else {
    warn$1(`inject() can only be used inside setup() or functional components.`);
  }
}
const isKeepAlive = (vnode) => vnode.type.__isKeepAlive;
function onActivated(hook, target) {
  registerKeepAliveHook(hook, "a", target);
}
function onDeactivated(hook, target) {
  registerKeepAliveHook(hook, "da", target);
}
function registerKeepAliveHook(hook, type, target = currentInstance) {
  const wrappedHook = hook.__wdc || (hook.__wdc = () => {
    let current = target;
    while (current) {
      if (current.isDeactivated) {
        return;
      }
      current = current.parent;
    }
    return hook();
  });
  injectHook(type, wrappedHook, target);
  if (target) {
    let current = target.parent;
    while (current && current.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        injectToKeepAliveRoot(wrappedHook, type, target, current);
      }
      current = current.parent;
    }
  }
}
function injectToKeepAliveRoot(hook, type, target, keepAliveRoot) {
  const injected = injectHook(
    type,
    hook,
    keepAliveRoot,
    true
    /* prepend */
  );
  onUnmounted(() => {
    remove(keepAliveRoot[type], injected);
  }, target);
}
function injectHook(type, hook, target = currentInstance, prepend = false) {
  if (target) {
    if (isRootHook(type)) {
      target = target.root;
    }
    const hooks = target[type] || (target[type] = []);
    const wrappedHook = hook.__weh || (hook.__weh = (...args) => {
      if (target.isUnmounted) {
        return;
      }
      pauseTracking();
      const reset = setCurrentInstance(target);
      const res = callWithAsyncErrorHandling(hook, target, type, args);
      reset();
      resetTracking();
      return res;
    });
    if (prepend) {
      hooks.unshift(wrappedHook);
    } else {
      hooks.push(wrappedHook);
    }
    return wrappedHook;
  } else {
    const apiName = toHandlerKey(
      (ErrorTypeStrings[type] || type.replace(/^on/, "")).replace(/ hook$/, "")
    );
    warn$1(
      `${apiName} is called when there is no active component instance to be associated with. Lifecycle injection APIs can only be used during execution of setup().`
    );
  }
}
const createHook = (lifecycle) => (hook, target = currentInstance) => (
  // post-create lifecycle registrations are noops during SSR (except for serverPrefetch)
  (!isInSSRComponentSetup || lifecycle === "sp") && injectHook(lifecycle, (...args) => hook(...args), target)
);
const onBeforeMount = createHook("bm");
const onMounted = createHook("m");
const onBeforeUpdate = createHook("bu");
const onUpdated = createHook("u");
const onBeforeUnmount = createHook("bum");
const onUnmounted = createHook("um");
const onServerPrefetch = createHook("sp");
const onRenderTriggered = createHook(
  "rtg"
);
const onRenderTracked = createHook(
  "rtc"
);
function onErrorCaptured(hook, target = currentInstance) {
  injectHook("ec", hook, target);
}
const getPublicInstance = (i) => {
  if (!i)
    return null;
  if (isStatefulComponent(i))
    return getExposeProxy(i) || i.proxy;
  return getPublicInstance(i.parent);
};
function getComponentInternalInstance(i) {
  return i;
}
const publicPropertiesMap = (
  // Move PURE marker to new line to workaround compiler discarding it
  // due to type annotation
  /* @__PURE__ */ extend(/* @__PURE__ */ Object.create(null), {
    // fixed by xxxxxx
    $: getComponentInternalInstance,
    // fixed by xxxxxx vue-i18n 在 dev 模式，访问了 $el，故模拟一个假的
    // $el: i => i.vnode.el,
    $el: (i) => i.__$el || (i.__$el = {}),
    $data: (i) => i.data,
    $props: (i) => shallowReadonly(i.props),
    $attrs: (i) => shallowReadonly(i.attrs),
    $slots: (i) => shallowReadonly(i.slots),
    $refs: (i) => shallowReadonly(i.refs),
    $parent: (i) => getPublicInstance(i.parent),
    $root: (i) => getPublicInstance(i.root),
    $emit: (i) => i.emit,
    $options: (i) => resolveMergedOptions(i),
    $forceUpdate: (i) => i.f || (i.f = () => {
      i.effect.dirty = true;
      queueJob(i.update);
    }),
    // $nextTick: i => i.n || (i.n = nextTick.bind(i.proxy!)),// fixed by xxxxxx
    $watch: (i) => instanceWatch.bind(i)
  })
);
const isReservedPrefix = (key) => key === "_" || key === "$";
const hasSetupBinding = (state, key) => state !== EMPTY_OBJ && !state.__isScriptSetup && hasOwn(state, key);
const PublicInstanceProxyHandlers = {
  get({ _: instance }, key) {
    const { ctx, setupState, data, props, accessCache, type, appContext } = instance;
    if (key === "__isVue") {
      return true;
    }
    let normalizedProps;
    if (key[0] !== "$") {
      const n2 = accessCache[key];
      if (n2 !== void 0) {
        switch (n2) {
          case 1:
            return setupState[key];
          case 2:
            return data[key];
          case 4:
            return ctx[key];
          case 3:
            return props[key];
        }
      } else if (hasSetupBinding(setupState, key)) {
        accessCache[key] = 1;
        return setupState[key];
      } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
        accessCache[key] = 2;
        return data[key];
      } else if (
        // only cache other properties when instance has declared (thus stable)
        // props
        (normalizedProps = instance.propsOptions[0]) && hasOwn(normalizedProps, key)
      ) {
        accessCache[key] = 3;
        return props[key];
      } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
        accessCache[key] = 4;
        return ctx[key];
      } else if (shouldCacheAccess) {
        accessCache[key] = 0;
      }
    }
    const publicGetter = publicPropertiesMap[key];
    let cssModule, globalProperties;
    if (publicGetter) {
      if (key === "$attrs") {
        track(instance, "get", key);
      } else if (key === "$slots") {
        track(instance, "get", key);
      }
      return publicGetter(instance);
    } else if (
      // css module (injected by vue-loader)
      (cssModule = type.__cssModules) && (cssModule = cssModule[key])
    ) {
      return cssModule;
    } else if (ctx !== EMPTY_OBJ && hasOwn(ctx, key)) {
      accessCache[key] = 4;
      return ctx[key];
    } else if (
      // global properties
      globalProperties = appContext.config.globalProperties, hasOwn(globalProperties, key)
    ) {
      {
        return globalProperties[key];
      }
    } else if (currentRenderingInstance && (!isString(key) || // #1091 avoid internal isRef/isVNode checks on component instance leading
    // to infinite warning loop
    key.indexOf("__v") !== 0)) {
      if (data !== EMPTY_OBJ && isReservedPrefix(key[0]) && hasOwn(data, key)) {
        warn$1(
          `Property ${JSON.stringify(
            key
          )} must be accessed via $data because it starts with a reserved character ("$" or "_") and is not proxied on the render context.`
        );
      } else if (instance === currentRenderingInstance) {
        warn$1(
          `Property ${JSON.stringify(key)} was accessed during render but is not defined on instance.`
        );
      }
    }
  },
  set({ _: instance }, key, value) {
    const { data, setupState, ctx } = instance;
    if (hasSetupBinding(setupState, key)) {
      setupState[key] = value;
      return true;
    } else if (setupState.__isScriptSetup && hasOwn(setupState, key)) {
      warn$1(`Cannot mutate <script setup> binding "${key}" from Options API.`);
      return false;
    } else if (data !== EMPTY_OBJ && hasOwn(data, key)) {
      data[key] = value;
      return true;
    } else if (hasOwn(instance.props, key)) {
      warn$1(`Attempting to mutate prop "${key}". Props are readonly.`);
      return false;
    }
    if (key[0] === "$" && key.slice(1) in instance) {
      warn$1(
        `Attempting to mutate public property "${key}". Properties starting with $ are reserved and readonly.`
      );
      return false;
    } else {
      if (key in instance.appContext.config.globalProperties) {
        Object.defineProperty(ctx, key, {
          enumerable: true,
          configurable: true,
          value
        });
      } else {
        ctx[key] = value;
      }
    }
    return true;
  },
  has({
    _: { data, setupState, accessCache, ctx, appContext, propsOptions }
  }, key) {
    let normalizedProps;
    return !!accessCache[key] || data !== EMPTY_OBJ && hasOwn(data, key) || hasSetupBinding(setupState, key) || (normalizedProps = propsOptions[0]) && hasOwn(normalizedProps, key) || hasOwn(ctx, key) || hasOwn(publicPropertiesMap, key) || hasOwn(appContext.config.globalProperties, key);
  },
  defineProperty(target, key, descriptor) {
    if (descriptor.get != null) {
      target._.accessCache[key] = 0;
    } else if (hasOwn(descriptor, "value")) {
      this.set(target, key, descriptor.value, null);
    }
    return Reflect.defineProperty(target, key, descriptor);
  }
};
{
  PublicInstanceProxyHandlers.ownKeys = (target) => {
    warn$1(
      `Avoid app logic that relies on enumerating keys on a component instance. The keys will be empty in production mode to avoid performance overhead.`
    );
    return Reflect.ownKeys(target);
  };
}
function createDevRenderContext(instance) {
  const target = {};
  Object.defineProperty(target, `_`, {
    configurable: true,
    enumerable: false,
    get: () => instance
  });
  Object.keys(publicPropertiesMap).forEach((key) => {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      get: () => publicPropertiesMap[key](instance),
      // intercepted by the proxy so no need for implementation,
      // but needed to prevent set errors
      set: NOOP
    });
  });
  return target;
}
function exposePropsOnRenderContext(instance) {
  const {
    ctx,
    propsOptions: [propsOptions]
  } = instance;
  if (propsOptions) {
    Object.keys(propsOptions).forEach((key) => {
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => instance.props[key],
        set: NOOP
      });
    });
  }
}
function exposeSetupStateOnRenderContext(instance) {
  const { ctx, setupState } = instance;
  Object.keys(toRaw(setupState)).forEach((key) => {
    if (!setupState.__isScriptSetup) {
      if (isReservedPrefix(key[0])) {
        warn$1(
          `setup() return property ${JSON.stringify(
            key
          )} should not start with "$" or "_" which are reserved prefixes for Vue internals.`
        );
        return;
      }
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => setupState[key],
        set: NOOP
      });
    }
  });
}
function normalizePropsOrEmits(props) {
  return isArray(props) ? props.reduce(
    (normalized, p2) => (normalized[p2] = null, normalized),
    {}
  ) : props;
}
function createDuplicateChecker() {
  const cache = /* @__PURE__ */ Object.create(null);
  return (type, key) => {
    if (cache[key]) {
      warn$1(`${type} property "${key}" is already defined in ${cache[key]}.`);
    } else {
      cache[key] = type;
    }
  };
}
let shouldCacheAccess = true;
function applyOptions$1(instance) {
  const options = resolveMergedOptions(instance);
  const publicThis = instance.proxy;
  const ctx = instance.ctx;
  shouldCacheAccess = false;
  if (options.beforeCreate) {
    callHook$1(options.beforeCreate, instance, "bc");
  }
  const {
    // state
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    // lifecycle
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    activated,
    deactivated,
    beforeDestroy,
    beforeUnmount,
    destroyed,
    unmounted,
    render,
    renderTracked,
    renderTriggered,
    errorCaptured,
    serverPrefetch,
    // public API
    expose,
    inheritAttrs,
    // assets
    components,
    directives,
    filters
  } = options;
  const checkDuplicateProperties = createDuplicateChecker();
  {
    const [propsOptions] = instance.propsOptions;
    if (propsOptions) {
      for (const key in propsOptions) {
        checkDuplicateProperties("Props", key);
      }
    }
  }
  function initInjections() {
    if (injectOptions) {
      resolveInjections(injectOptions, ctx, checkDuplicateProperties);
    }
  }
  {
    initInjections();
  }
  if (methods) {
    for (const key in methods) {
      const methodHandler = methods[key];
      if (isFunction(methodHandler)) {
        {
          Object.defineProperty(ctx, key, {
            value: methodHandler.bind(publicThis),
            configurable: true,
            enumerable: true,
            writable: true
          });
        }
        {
          checkDuplicateProperties("Methods", key);
        }
      } else {
        warn$1(
          `Method "${key}" has type "${typeof methodHandler}" in the component definition. Did you reference the function correctly?`
        );
      }
    }
  }
  if (dataOptions) {
    if (!isFunction(dataOptions)) {
      warn$1(
        `The data option must be a function. Plain object usage is no longer supported.`
      );
    }
    const data = dataOptions.call(publicThis, publicThis);
    if (isPromise(data)) {
      warn$1(
        `data() returned a Promise - note data() cannot be async; If you intend to perform data fetching before component renders, use async setup() + <Suspense>.`
      );
    }
    if (!isObject(data)) {
      warn$1(`data() should return an object.`);
    } else {
      instance.data = reactive(data);
      {
        for (const key in data) {
          checkDuplicateProperties("Data", key);
          if (!isReservedPrefix(key[0])) {
            Object.defineProperty(ctx, key, {
              configurable: true,
              enumerable: true,
              get: () => data[key],
              set: NOOP
            });
          }
        }
      }
    }
  }
  shouldCacheAccess = true;
  if (computedOptions) {
    for (const key in computedOptions) {
      const opt = computedOptions[key];
      const get2 = isFunction(opt) ? opt.bind(publicThis, publicThis) : isFunction(opt.get) ? opt.get.bind(publicThis, publicThis) : NOOP;
      if (get2 === NOOP) {
        warn$1(`Computed property "${key}" has no getter.`);
      }
      const set2 = !isFunction(opt) && isFunction(opt.set) ? opt.set.bind(publicThis) : () => {
        warn$1(
          `Write operation failed: computed property "${key}" is readonly.`
        );
      };
      const c2 = computed({
        get: get2,
        set: set2
      });
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => c2.value,
        set: (v) => c2.value = v
      });
      {
        checkDuplicateProperties("Computed", key);
      }
    }
  }
  if (watchOptions) {
    for (const key in watchOptions) {
      createWatcher(watchOptions[key], ctx, publicThis, key);
    }
  }
  function initProvides() {
    if (provideOptions) {
      const provides = isFunction(provideOptions) ? provideOptions.call(publicThis) : provideOptions;
      Reflect.ownKeys(provides).forEach((key) => {
        provide(key, provides[key]);
      });
    }
  }
  {
    initProvides();
  }
  {
    if (created) {
      callHook$1(created, instance, "c");
    }
  }
  function registerLifecycleHook(register, hook) {
    if (isArray(hook)) {
      hook.forEach((_hook) => register(_hook.bind(publicThis)));
    } else if (hook) {
      register(hook.bind(publicThis));
    }
  }
  registerLifecycleHook(onBeforeMount, beforeMount);
  registerLifecycleHook(onMounted, mounted);
  registerLifecycleHook(onBeforeUpdate, beforeUpdate);
  registerLifecycleHook(onUpdated, updated);
  registerLifecycleHook(onActivated, activated);
  registerLifecycleHook(onDeactivated, deactivated);
  registerLifecycleHook(onErrorCaptured, errorCaptured);
  registerLifecycleHook(onRenderTracked, renderTracked);
  registerLifecycleHook(onRenderTriggered, renderTriggered);
  registerLifecycleHook(onBeforeUnmount, beforeUnmount);
  registerLifecycleHook(onUnmounted, unmounted);
  registerLifecycleHook(onServerPrefetch, serverPrefetch);
  if (isArray(expose)) {
    if (expose.length) {
      const exposed = instance.exposed || (instance.exposed = {});
      expose.forEach((key) => {
        Object.defineProperty(exposed, key, {
          get: () => publicThis[key],
          set: (val) => publicThis[key] = val
        });
      });
    } else if (!instance.exposed) {
      instance.exposed = {};
    }
  }
  if (render && instance.render === NOOP) {
    instance.render = render;
  }
  if (inheritAttrs != null) {
    instance.inheritAttrs = inheritAttrs;
  }
  if (components)
    instance.components = components;
  if (directives)
    instance.directives = directives;
  if (instance.ctx.$onApplyOptions) {
    instance.ctx.$onApplyOptions(options, instance, publicThis);
  }
}
function resolveInjections(injectOptions, ctx, checkDuplicateProperties = NOOP) {
  if (isArray(injectOptions)) {
    injectOptions = normalizeInject(injectOptions);
  }
  for (const key in injectOptions) {
    const opt = injectOptions[key];
    let injected;
    if (isObject(opt)) {
      if ("default" in opt) {
        injected = inject(
          opt.from || key,
          opt.default,
          true
        );
      } else {
        injected = inject(opt.from || key);
      }
    } else {
      injected = inject(opt);
    }
    if (isRef(injected)) {
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => injected.value,
        set: (v) => injected.value = v
      });
    } else {
      ctx[key] = injected;
    }
    {
      checkDuplicateProperties("Inject", key);
    }
  }
}
function callHook$1(hook, instance, type) {
  callWithAsyncErrorHandling(
    isArray(hook) ? hook.map((h2) => h2.bind(instance.proxy)) : hook.bind(instance.proxy),
    instance,
    type
  );
}
function createWatcher(raw, ctx, publicThis, key) {
  const getter = key.includes(".") ? createPathGetter(publicThis, key) : () => publicThis[key];
  if (isString(raw)) {
    const handler = ctx[raw];
    if (isFunction(handler)) {
      watch(getter, handler);
    } else {
      warn$1(`Invalid watch handler specified by key "${raw}"`, handler);
    }
  } else if (isFunction(raw)) {
    watch(getter, raw.bind(publicThis));
  } else if (isObject(raw)) {
    if (isArray(raw)) {
      raw.forEach((r2) => createWatcher(r2, ctx, publicThis, key));
    } else {
      const handler = isFunction(raw.handler) ? raw.handler.bind(publicThis) : ctx[raw.handler];
      if (isFunction(handler)) {
        watch(getter, handler, raw);
      } else {
        warn$1(`Invalid watch handler specified by key "${raw.handler}"`, handler);
      }
    }
  } else {
    warn$1(`Invalid watch option: "${key}"`, raw);
  }
}
function resolveMergedOptions(instance) {
  const base = instance.type;
  const { mixins, extends: extendsOptions } = base;
  const {
    mixins: globalMixins,
    optionsCache: cache,
    config: { optionMergeStrategies }
  } = instance.appContext;
  const cached = cache.get(base);
  let resolved;
  if (cached) {
    resolved = cached;
  } else if (!globalMixins.length && !mixins && !extendsOptions) {
    {
      resolved = base;
    }
  } else {
    resolved = {};
    if (globalMixins.length) {
      globalMixins.forEach(
        (m2) => mergeOptions(resolved, m2, optionMergeStrategies, true)
      );
    }
    mergeOptions(resolved, base, optionMergeStrategies);
  }
  if (isObject(base)) {
    cache.set(base, resolved);
  }
  return resolved;
}
function mergeOptions(to, from, strats, asMixin = false) {
  const { mixins, extends: extendsOptions } = from;
  if (extendsOptions) {
    mergeOptions(to, extendsOptions, strats, true);
  }
  if (mixins) {
    mixins.forEach(
      (m2) => mergeOptions(to, m2, strats, true)
    );
  }
  for (const key in from) {
    if (asMixin && key === "expose") {
      warn$1(
        `"expose" option is ignored when declared in mixins or extends. It should only be declared in the base component itself.`
      );
    } else {
      const strat = internalOptionMergeStrats[key] || strats && strats[key];
      to[key] = strat ? strat(to[key], from[key]) : from[key];
    }
  }
  return to;
}
const internalOptionMergeStrats = {
  data: mergeDataFn,
  props: mergeEmitsOrPropsOptions,
  emits: mergeEmitsOrPropsOptions,
  // objects
  methods: mergeObjectOptions,
  computed: mergeObjectOptions,
  // lifecycle
  beforeCreate: mergeAsArray$1,
  created: mergeAsArray$1,
  beforeMount: mergeAsArray$1,
  mounted: mergeAsArray$1,
  beforeUpdate: mergeAsArray$1,
  updated: mergeAsArray$1,
  beforeDestroy: mergeAsArray$1,
  beforeUnmount: mergeAsArray$1,
  destroyed: mergeAsArray$1,
  unmounted: mergeAsArray$1,
  activated: mergeAsArray$1,
  deactivated: mergeAsArray$1,
  errorCaptured: mergeAsArray$1,
  serverPrefetch: mergeAsArray$1,
  // assets
  components: mergeObjectOptions,
  directives: mergeObjectOptions,
  // watch
  watch: mergeWatchOptions,
  // provide / inject
  provide: mergeDataFn,
  inject: mergeInject
};
function mergeDataFn(to, from) {
  if (!from) {
    return to;
  }
  if (!to) {
    return from;
  }
  return function mergedDataFn() {
    return extend(
      isFunction(to) ? to.call(this, this) : to,
      isFunction(from) ? from.call(this, this) : from
    );
  };
}
function mergeInject(to, from) {
  return mergeObjectOptions(normalizeInject(to), normalizeInject(from));
}
function normalizeInject(raw) {
  if (isArray(raw)) {
    const res = {};
    for (let i = 0; i < raw.length; i++) {
      res[raw[i]] = raw[i];
    }
    return res;
  }
  return raw;
}
function mergeAsArray$1(to, from) {
  return to ? [...new Set([].concat(to, from))] : from;
}
function mergeObjectOptions(to, from) {
  return to ? extend(/* @__PURE__ */ Object.create(null), to, from) : from;
}
function mergeEmitsOrPropsOptions(to, from) {
  if (to) {
    if (isArray(to) && isArray(from)) {
      return [.../* @__PURE__ */ new Set([...to, ...from])];
    }
    return extend(
      /* @__PURE__ */ Object.create(null),
      normalizePropsOrEmits(to),
      normalizePropsOrEmits(from != null ? from : {})
    );
  } else {
    return from;
  }
}
function mergeWatchOptions(to, from) {
  if (!to)
    return from;
  if (!from)
    return to;
  const merged = extend(/* @__PURE__ */ Object.create(null), to);
  for (const key in from) {
    merged[key] = mergeAsArray$1(to[key], from[key]);
  }
  return merged;
}
function initProps$1(instance, rawProps, isStateful, isSSR = false) {
  const props = {};
  const attrs = {};
  instance.propsDefaults = /* @__PURE__ */ Object.create(null);
  setFullProps(instance, rawProps, props, attrs);
  for (const key in instance.propsOptions[0]) {
    if (!(key in props)) {
      props[key] = void 0;
    }
  }
  {
    validateProps(rawProps || {}, props, instance);
  }
  if (isStateful) {
    instance.props = isSSR ? props : shallowReactive(props);
  } else {
    if (!instance.type.props) {
      instance.props = attrs;
    } else {
      instance.props = props;
    }
  }
  instance.attrs = attrs;
}
function isInHmrContext(instance) {
}
function updateProps(instance, rawProps, rawPrevProps, optimized) {
  const {
    props,
    attrs,
    vnode: { patchFlag }
  } = instance;
  const rawCurrentProps = toRaw(props);
  const [options] = instance.propsOptions;
  let hasAttrsChanged = false;
  if (
    // always force full diff in dev
    // - #1942 if hmr is enabled with sfc component
    // - vite#872 non-sfc component used by sfc component
    !isInHmrContext() && (optimized || patchFlag > 0) && !(patchFlag & 16)
  ) {
    if (patchFlag & 8) {
      const propsToUpdate = instance.vnode.dynamicProps;
      for (let i = 0; i < propsToUpdate.length; i++) {
        let key = propsToUpdate[i];
        if (isEmitListener(instance.emitsOptions, key)) {
          continue;
        }
        const value = rawProps[key];
        if (options) {
          if (hasOwn(attrs, key)) {
            if (value !== attrs[key]) {
              attrs[key] = value;
              hasAttrsChanged = true;
            }
          } else {
            const camelizedKey = camelize(key);
            props[camelizedKey] = resolvePropValue$1(
              options,
              rawCurrentProps,
              camelizedKey,
              value,
              instance,
              false
            );
          }
        } else {
          if (value !== attrs[key]) {
            attrs[key] = value;
            hasAttrsChanged = true;
          }
        }
      }
    }
  } else {
    if (setFullProps(instance, rawProps, props, attrs)) {
      hasAttrsChanged = true;
    }
    let kebabKey;
    for (const key in rawCurrentProps) {
      if (!rawProps || // for camelCase
      !hasOwn(rawProps, key) && // it's possible the original props was passed in as kebab-case
      // and converted to camelCase (#955)
      ((kebabKey = hyphenate(key)) === key || !hasOwn(rawProps, kebabKey))) {
        if (options) {
          if (rawPrevProps && // for camelCase
          (rawPrevProps[key] !== void 0 || // for kebab-case
          rawPrevProps[kebabKey] !== void 0)) {
            props[key] = resolvePropValue$1(
              options,
              rawCurrentProps,
              key,
              void 0,
              instance,
              true
            );
          }
        } else {
          delete props[key];
        }
      }
    }
    if (attrs !== rawCurrentProps) {
      for (const key in attrs) {
        if (!rawProps || !hasOwn(rawProps, key) && true) {
          delete attrs[key];
          hasAttrsChanged = true;
        }
      }
    }
  }
  if (hasAttrsChanged) {
    trigger(instance, "set", "$attrs");
  }
  {
    validateProps(rawProps || {}, props, instance);
  }
}
function setFullProps(instance, rawProps, props, attrs) {
  const [options, needCastKeys] = instance.propsOptions;
  let hasAttrsChanged = false;
  let rawCastValues;
  if (rawProps) {
    for (let key in rawProps) {
      if (isReservedProp(key)) {
        continue;
      }
      const value = rawProps[key];
      let camelKey;
      if (options && hasOwn(options, camelKey = camelize(key))) {
        if (!needCastKeys || !needCastKeys.includes(camelKey)) {
          props[camelKey] = value;
        } else {
          (rawCastValues || (rawCastValues = {}))[camelKey] = value;
        }
      } else if (!isEmitListener(instance.emitsOptions, key)) {
        if (!(key in attrs) || value !== attrs[key]) {
          attrs[key] = value;
          hasAttrsChanged = true;
        }
      }
    }
  }
  if (needCastKeys) {
    const rawCurrentProps = toRaw(props);
    const castValues = rawCastValues || EMPTY_OBJ;
    for (let i = 0; i < needCastKeys.length; i++) {
      const key = needCastKeys[i];
      props[key] = resolvePropValue$1(
        options,
        rawCurrentProps,
        key,
        castValues[key],
        instance,
        !hasOwn(castValues, key)
      );
    }
  }
  return hasAttrsChanged;
}
function resolvePropValue$1(options, props, key, value, instance, isAbsent) {
  const opt = options[key];
  if (opt != null) {
    const hasDefault = hasOwn(opt, "default");
    if (hasDefault && value === void 0) {
      const defaultValue = opt.default;
      if (opt.type !== Function && !opt.skipFactory && isFunction(defaultValue)) {
        const { propsDefaults } = instance;
        if (key in propsDefaults) {
          value = propsDefaults[key];
        } else {
          const reset = setCurrentInstance(instance);
          value = propsDefaults[key] = defaultValue.call(
            null,
            props
          );
          reset();
        }
      } else {
        value = defaultValue;
      }
    }
    if (opt[
      0
      /* shouldCast */
    ]) {
      if (isAbsent && !hasDefault) {
        value = false;
      } else if (opt[
        1
        /* shouldCastTrue */
      ] && (value === "" || value === hyphenate(key))) {
        value = true;
      }
    }
  }
  return value;
}
function normalizePropsOptions(comp, appContext, asMixin = false) {
  const cache = appContext.propsCache;
  const cached = cache.get(comp);
  if (cached) {
    return cached;
  }
  const raw = comp.props;
  const normalized = {};
  const needCastKeys = [];
  let hasExtends = false;
  if (!isFunction(comp)) {
    const extendProps = (raw2) => {
      hasExtends = true;
      const [props, keys] = normalizePropsOptions(raw2, appContext, true);
      extend(normalized, props);
      if (keys)
        needCastKeys.push(...keys);
    };
    if (!asMixin && appContext.mixins.length) {
      appContext.mixins.forEach(extendProps);
    }
    if (comp.extends) {
      extendProps(comp.extends);
    }
    if (comp.mixins) {
      comp.mixins.forEach(extendProps);
    }
  }
  if (!raw && !hasExtends) {
    if (isObject(comp)) {
      cache.set(comp, EMPTY_ARR);
    }
    return EMPTY_ARR;
  }
  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      if (!isString(raw[i])) {
        warn$1(`props must be strings when using array syntax.`, raw[i]);
      }
      const normalizedKey = camelize(raw[i]);
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ;
      }
    }
  } else if (raw) {
    if (!isObject(raw)) {
      warn$1(`invalid props options`, raw);
    }
    for (const key in raw) {
      const normalizedKey = camelize(key);
      if (validatePropName(normalizedKey)) {
        const opt = raw[key];
        const prop = normalized[normalizedKey] = isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt);
        if (prop) {
          const booleanIndex = getTypeIndex(Boolean, prop.type);
          const stringIndex = getTypeIndex(String, prop.type);
          prop[
            0
            /* shouldCast */
          ] = booleanIndex > -1;
          prop[
            1
            /* shouldCastTrue */
          ] = stringIndex < 0 || booleanIndex < stringIndex;
          if (booleanIndex > -1 || hasOwn(prop, "default")) {
            needCastKeys.push(normalizedKey);
          }
        }
      }
    }
  }
  const res = [normalized, needCastKeys];
  if (isObject(comp)) {
    cache.set(comp, res);
  }
  return res;
}
function validatePropName(key) {
  if (key[0] !== "$" && !isReservedProp(key)) {
    return true;
  } else {
    warn$1(`Invalid prop name: "${key}" is a reserved property.`);
  }
  return false;
}
function getType$1(ctor) {
  if (ctor === null) {
    return "null";
  }
  if (typeof ctor === "function") {
    return ctor.name || "";
  } else if (typeof ctor === "object") {
    const name = ctor.constructor && ctor.constructor.name;
    return name || "";
  }
  return "";
}
function isSameType(a, b) {
  return getType$1(a) === getType$1(b);
}
function getTypeIndex(type, expectedTypes) {
  if (isArray(expectedTypes)) {
    return expectedTypes.findIndex((t2) => isSameType(t2, type));
  } else if (isFunction(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1;
  }
  return -1;
}
function validateProps(rawProps, props, instance) {
  const resolvedValues = toRaw(props);
  const options = instance.propsOptions[0];
  for (const key in options) {
    let opt = options[key];
    if (opt == null)
      continue;
    validateProp$1(
      key,
      resolvedValues[key],
      opt,
      shallowReadonly(resolvedValues),
      !hasOwn(rawProps, key) && !hasOwn(rawProps, hyphenate(key))
    );
  }
}
function validateProp$1(name, value, prop, props, isAbsent) {
  const { type, required, validator, skipCheck } = prop;
  if (required && isAbsent) {
    warn$1('Missing required prop: "' + name + '"');
    return;
  }
  if (value == null && !required) {
    return;
  }
  if (type != null && type !== true && !skipCheck) {
    let isValid = false;
    const types = isArray(type) ? type : [type];
    const expectedTypes = [];
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType$1(value, types[i]);
      expectedTypes.push(expectedType || "");
      isValid = valid;
    }
    if (!isValid) {
      warn$1(getInvalidTypeMessage$1(name, value, expectedTypes));
      return;
    }
  }
  if (validator && !validator(value, props)) {
    warn$1('Invalid prop: custom validator check failed for prop "' + name + '".');
  }
}
const isSimpleType$1 = /* @__PURE__ */ makeMap(
  "String,Number,Boolean,Function,Symbol,BigInt"
);
function assertType$1(value, type) {
  let valid;
  const expectedType = getType$1(type);
  if (isSimpleType$1(expectedType)) {
    const t2 = typeof value;
    valid = t2 === expectedType.toLowerCase();
    if (!valid && t2 === "object") {
      valid = value instanceof type;
    }
  } else if (expectedType === "Object") {
    valid = isObject(value);
  } else if (expectedType === "Array") {
    valid = isArray(value);
  } else if (expectedType === "null") {
    valid = value === null;
  } else {
    valid = value instanceof type;
  }
  return {
    valid,
    expectedType
  };
}
function getInvalidTypeMessage$1(name, value, expectedTypes) {
  if (expectedTypes.length === 0) {
    return `Prop type [] for prop "${name}" won't match anything. Did you mean to use type Array instead?`;
  }
  let message = `Invalid prop: type check failed for prop "${name}". Expected ${expectedTypes.map(capitalize).join(" | ")}`;
  const expectedType = expectedTypes[0];
  const receivedType = toRawType(value);
  const expectedValue = styleValue$1(value, expectedType);
  const receivedValue = styleValue$1(value, receivedType);
  if (expectedTypes.length === 1 && isExplicable$1(expectedType) && !isBoolean$1(expectedType, receivedType)) {
    message += ` with value ${expectedValue}`;
  }
  message += `, got ${receivedType} `;
  if (isExplicable$1(receivedType)) {
    message += `with value ${receivedValue}.`;
  }
  return message;
}
function styleValue$1(value, type) {
  if (type === "String") {
    return `"${value}"`;
  } else if (type === "Number") {
    return `${Number(value)}`;
  } else {
    return `${value}`;
  }
}
function isExplicable$1(type) {
  const explicitTypes = ["string", "number", "boolean"];
  return explicitTypes.some((elem) => type.toLowerCase() === elem);
}
function isBoolean$1(...args) {
  return args.some((elem) => elem.toLowerCase() === "boolean");
}
let supported;
let perf;
function startMeasure(instance, type) {
  if (instance.appContext.config.performance && isSupported()) {
    perf.mark(`vue-${type}-${instance.uid}`);
  }
  {
    devtoolsPerfStart(instance, type, isSupported() ? perf.now() : Date.now());
  }
}
function endMeasure(instance, type) {
  if (instance.appContext.config.performance && isSupported()) {
    const startTag = `vue-${type}-${instance.uid}`;
    const endTag = startTag + `:end`;
    perf.mark(endTag);
    perf.measure(
      `<${formatComponentName(instance, instance.type)}> ${type}`,
      startTag,
      endTag
    );
    perf.clearMarks(startTag);
    perf.clearMarks(endTag);
  }
  {
    devtoolsPerfEnd(instance, type, isSupported() ? perf.now() : Date.now());
  }
}
function isSupported() {
  if (supported !== void 0) {
    return supported;
  }
  if (typeof window !== "undefined" && window.performance) {
    supported = true;
    perf = window.performance;
  } else {
    supported = false;
  }
  return supported;
}
const queuePostRenderEffect$1 = queuePostFlushCb;
const Fragment = Symbol.for("v-fgt");
const Text = Symbol.for("v-txt");
const Comment = Symbol.for("v-cmt");
const Static = Symbol.for("v-stc");
function isVNode(value) {
  return value ? value.__v_isVNode === true : false;
}
const emptyAppContext = createAppContext();
let uid = 0;
function createComponentInstance(vnode, parent, suspense) {
  const type = vnode.type;
  const appContext = (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
  const instance = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root: null,
    // to be immediately set
    next: null,
    subTree: null,
    // will be set synchronously right after creation
    effect: null,
    update: null,
    // will be set synchronously right after creation
    scope: new EffectScope(
      true
      /* detached */
    ),
    render: null,
    proxy: null,
    exposed: null,
    exposeProxy: null,
    withProxy: null,
    provides: parent ? parent.provides : Object.create(appContext.provides),
    accessCache: null,
    renderCache: [],
    // local resolved assets
    components: null,
    directives: null,
    // resolved props and emits options
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),
    // emit
    emit: null,
    // to be set immediately
    emitted: null,
    // props default value
    propsDefaults: EMPTY_OBJ,
    // inheritAttrs
    inheritAttrs: type.inheritAttrs,
    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    slots: EMPTY_OBJ,
    refs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,
    attrsProxy: null,
    slotsProxy: null,
    // suspense related
    suspense,
    suspenseId: suspense ? suspense.pendingId : 0,
    asyncDep: null,
    asyncResolved: false,
    // lifecycle hooks
    // not using enums here because it results in computed properties
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    um: null,
    bum: null,
    da: null,
    a: null,
    rtg: null,
    rtc: null,
    ec: null,
    sp: null,
    // fixed by xxxxxx 用于存储uni-app的元素缓存
    $uniElements: /* @__PURE__ */ new Map(),
    $templateUniElementRefs: [],
    $templateUniElementStyles: {},
    $eS: {},
    $eA: {}
  };
  {
    instance.ctx = createDevRenderContext(instance);
  }
  instance.root = parent ? parent.root : instance;
  instance.emit = emit.bind(null, instance);
  if (vnode.ce) {
    vnode.ce(instance);
  }
  return instance;
}
let currentInstance = null;
const getCurrentInstance = () => currentInstance || currentRenderingInstance;
let internalSetCurrentInstance;
let setInSSRSetupState;
{
  internalSetCurrentInstance = (i) => {
    currentInstance = i;
  };
  setInSSRSetupState = (v) => {
    isInSSRComponentSetup = v;
  };
}
const setCurrentInstance = (instance) => {
  const prev = currentInstance;
  internalSetCurrentInstance(instance);
  instance.scope.on();
  return () => {
    instance.scope.off();
    internalSetCurrentInstance(prev);
  };
};
const unsetCurrentInstance = () => {
  currentInstance && currentInstance.scope.off();
  internalSetCurrentInstance(null);
};
const isBuiltInTag = /* @__PURE__ */ makeMap("slot,component");
function validateComponentName(name, { isNativeTag }) {
  if (isBuiltInTag(name) || isNativeTag(name)) {
    warn$1(
      "Do not use built-in or reserved HTML elements as component id: " + name
    );
  }
}
function isStatefulComponent(instance) {
  return instance.vnode.shapeFlag & 4;
}
let isInSSRComponentSetup = false;
function setupComponent(instance, isSSR = false) {
  isSSR && setInSSRSetupState(isSSR);
  const {
    props
    /*, children*/
  } = instance.vnode;
  const isStateful = isStatefulComponent(instance);
  initProps$1(instance, props, isStateful, isSSR);
  const setupResult = isStateful ? setupStatefulComponent(instance, isSSR) : void 0;
  isSSR && setInSSRSetupState(false);
  return setupResult;
}
function setupStatefulComponent(instance, isSSR) {
  const Component2 = instance.type;
  {
    if (Component2.name) {
      validateComponentName(Component2.name, instance.appContext.config);
    }
    if (Component2.components) {
      const names = Object.keys(Component2.components);
      for (let i = 0; i < names.length; i++) {
        validateComponentName(names[i], instance.appContext.config);
      }
    }
    if (Component2.directives) {
      const names = Object.keys(Component2.directives);
      for (let i = 0; i < names.length; i++) {
        validateDirectiveName(names[i]);
      }
    }
    if (Component2.compilerOptions && isRuntimeOnly()) {
      warn$1(
        `"compilerOptions" is only supported when using a build of Vue that includes the runtime compiler. Since you are using a runtime-only build, the options should be passed via your build tool config instead.`
      );
    }
  }
  instance.accessCache = /* @__PURE__ */ Object.create(null);
  instance.proxy = markRaw(new Proxy(instance.ctx, PublicInstanceProxyHandlers));
  {
    exposePropsOnRenderContext(instance);
  }
  const { setup } = Component2;
  if (setup) {
    const setupContext = instance.setupContext = setup.length > 1 ? createSetupContext(instance) : null;
    const reset = setCurrentInstance(instance);
    pauseTracking();
    const setupResult = callWithErrorHandling(
      setup,
      instance,
      0,
      [
        shallowReadonly(instance.props),
        setupContext
      ]
    );
    resetTracking();
    reset();
    if (isPromise(setupResult)) {
      setupResult.then(unsetCurrentInstance, unsetCurrentInstance);
      {
        warn$1(
          `setup() returned a Promise, but the version of Vue you are using does not support it yet.`
        );
      }
    } else {
      handleSetupResult(instance, setupResult, isSSR);
    }
  } else {
    finishComponentSetup(instance, isSSR);
  }
}
function handleSetupResult(instance, setupResult, isSSR) {
  if (isFunction(setupResult)) {
    {
      instance.render = setupResult;
    }
  } else if (isObject(setupResult)) {
    if (isVNode(setupResult)) {
      warn$1(
        `setup() should not return VNodes directly - return a render function instead.`
      );
    }
    {
      instance.devtoolsRawSetupState = setupResult;
    }
    instance.setupState = proxyRefs(setupResult);
    {
      exposeSetupStateOnRenderContext(instance);
    }
  } else if (setupResult !== void 0) {
    warn$1(
      `setup() should return an object. Received: ${setupResult === null ? "null" : typeof setupResult}`
    );
  }
  finishComponentSetup(instance, isSSR);
}
let compile;
const isRuntimeOnly = () => !compile;
function finishComponentSetup(instance, isSSR, skipOptions) {
  const Component2 = instance.type;
  if (!instance.render) {
    instance.render = Component2.render || NOOP;
  }
  {
    const reset = setCurrentInstance(instance);
    pauseTracking();
    try {
      applyOptions$1(instance);
    } finally {
      resetTracking();
      reset();
    }
  }
  if (!Component2.render && instance.render === NOOP && !isSSR) {
    if (Component2.template) {
      warn$1(
        `Component provided template option but runtime compilation is not supported in this build of Vue. Configure your bundler to alias "vue" to "vue/dist/vue.esm-bundler.js".`
      );
    } else {
      warn$1(`Component is missing template or render function.`);
    }
  }
}
function getAttrsProxy(instance) {
  return instance.attrsProxy || (instance.attrsProxy = new Proxy(
    instance.attrs,
    {
      get(target, key) {
        track(instance, "get", "$attrs");
        return target[key];
      },
      set() {
        warn$1(`setupContext.attrs is readonly.`);
        return false;
      },
      deleteProperty() {
        warn$1(`setupContext.attrs is readonly.`);
        return false;
      }
    }
  ));
}
function getSlotsProxy(instance) {
  return instance.slotsProxy || (instance.slotsProxy = new Proxy(instance.slots, {
    get(target, key) {
      track(instance, "get", "$slots");
      return target[key];
    }
  }));
}
function createSetupContext(instance) {
  const expose = (exposed) => {
    {
      if (instance.exposed) {
        warn$1(`expose() should be called only once per setup().`);
      }
      if (exposed != null) {
        let exposedType = typeof exposed;
        if (exposedType === "object") {
          if (isArray(exposed)) {
            exposedType = "array";
          } else if (isRef(exposed)) {
            exposedType = "ref";
          }
        }
        if (exposedType !== "object") {
          warn$1(
            `expose() should be passed a plain object, received ${exposedType}.`
          );
        }
      }
    }
    instance.exposed = exposed || {};
  };
  {
    return Object.freeze({
      get attrs() {
        return getAttrsProxy(instance);
      },
      get slots() {
        return getSlotsProxy(instance);
      },
      get emit() {
        return (event, ...args) => instance.emit(event, ...args);
      },
      expose
    });
  }
}
function getExposeProxy(instance) {
  if (instance.exposed) {
    return instance.exposeProxy || (instance.exposeProxy = new Proxy(proxyRefs(markRaw(instance.exposed)), {
      get(target, key) {
        if (key in target) {
          return target[key];
        }
        return instance.proxy[key];
      },
      has(target, key) {
        return key in target || key in publicPropertiesMap;
      }
    }));
  }
}
const classifyRE = /(?:^|[-_])(\w)/g;
const classify = (str) => str.replace(classifyRE, (c2) => c2.toUpperCase()).replace(/[-_]/g, "");
function getComponentName(Component2, includeInferred = true) {
  return isFunction(Component2) ? Component2.displayName || Component2.name : Component2.name || includeInferred && Component2.__name;
}
function formatComponentName(instance, Component2, isRoot = false) {
  let name = getComponentName(Component2);
  if (!name && Component2.__file) {
    const match = Component2.__file.match(/([^/\\]+)\.\w+$/);
    if (match) {
      name = match[1];
    }
  }
  if (!name && instance && instance.parent) {
    const inferFromRegistry = (registry) => {
      for (const key in registry) {
        if (registry[key] === Component2) {
          return key;
        }
      }
    };
    name = inferFromRegistry(
      instance.components || instance.parent.type.components
    ) || inferFromRegistry(instance.appContext.components);
  }
  return name ? classify(name) : isRoot ? `App` : `Anonymous`;
}
const computed = (getterOrOptions, debugOptions) => {
  const c2 = computed$1(getterOrOptions, debugOptions, isInSSRComponentSetup);
  {
    const i = getCurrentInstance();
    if (i && i.appContext.config.warnRecursiveComputed) {
      c2._warnRecursive = true;
    }
  }
  return c2;
};
const version = "3.4.21";
const warn = warn$1;
function unwrapper(target) {
  return unref(target);
}
const ARRAYTYPE = "[object Array]";
const OBJECTTYPE = "[object Object]";
function diff(current, pre) {
  const result = {};
  syncKeys(current, pre);
  _diff(current, pre, "", result);
  return result;
}
function syncKeys(current, pre) {
  current = unwrapper(current);
  if (current === pre)
    return;
  const rootCurrentType = toTypeString(current);
  const rootPreType = toTypeString(pre);
  if (rootCurrentType == OBJECTTYPE && rootPreType == OBJECTTYPE) {
    for (let key in pre) {
      const currentValue = current[key];
      if (currentValue === void 0) {
        current[key] = null;
      } else {
        syncKeys(currentValue, pre[key]);
      }
    }
  } else if (rootCurrentType == ARRAYTYPE && rootPreType == ARRAYTYPE) {
    if (current.length >= pre.length) {
      pre.forEach((item, index2) => {
        syncKeys(current[index2], item);
      });
    }
  }
}
function _diff(current, pre, path, result) {
  current = unwrapper(current);
  if (current === pre)
    return;
  const rootCurrentType = toTypeString(current);
  const rootPreType = toTypeString(pre);
  if (rootCurrentType == OBJECTTYPE) {
    if (rootPreType != OBJECTTYPE || Object.keys(current).length < Object.keys(pre).length) {
      setResult(result, path, current);
    } else {
      for (let key in current) {
        const currentValue = unwrapper(current[key]);
        const preValue = pre[key];
        const currentType = toTypeString(currentValue);
        const preType = toTypeString(preValue);
        if (currentType != ARRAYTYPE && currentType != OBJECTTYPE) {
          if (currentValue != preValue) {
            setResult(
              result,
              (path == "" ? "" : path + ".") + key,
              currentValue
            );
          }
        } else if (currentType == ARRAYTYPE) {
          if (preType != ARRAYTYPE) {
            setResult(
              result,
              (path == "" ? "" : path + ".") + key,
              currentValue
            );
          } else {
            if (currentValue.length < preValue.length) {
              setResult(
                result,
                (path == "" ? "" : path + ".") + key,
                currentValue
              );
            } else {
              currentValue.forEach((item, index2) => {
                _diff(
                  item,
                  preValue[index2],
                  (path == "" ? "" : path + ".") + key + "[" + index2 + "]",
                  result
                );
              });
            }
          }
        } else if (currentType == OBJECTTYPE) {
          if (preType != OBJECTTYPE || Object.keys(currentValue).length < Object.keys(preValue).length) {
            setResult(
              result,
              (path == "" ? "" : path + ".") + key,
              currentValue
            );
          } else {
            for (let subKey in currentValue) {
              _diff(
                currentValue[subKey],
                preValue[subKey],
                (path == "" ? "" : path + ".") + key + "." + subKey,
                result
              );
            }
          }
        }
      }
    }
  } else if (rootCurrentType == ARRAYTYPE) {
    if (rootPreType != ARRAYTYPE) {
      setResult(result, path, current);
    } else {
      if (current.length < pre.length) {
        setResult(result, path, current);
      } else {
        current.forEach((item, index2) => {
          _diff(item, pre[index2], path + "[" + index2 + "]", result);
        });
      }
    }
  } else {
    setResult(result, path, current);
  }
}
function setResult(result, k, v) {
  result[k] = v;
}
function hasComponentEffect(instance) {
  return queue$1.includes(instance.update);
}
function flushCallbacks(instance) {
  const ctx = instance.ctx;
  const callbacks = ctx.__next_tick_callbacks;
  if (callbacks && callbacks.length) {
    const copies = callbacks.slice(0);
    callbacks.length = 0;
    for (let i = 0; i < copies.length; i++) {
      copies[i]();
    }
  }
}
function nextTick(instance, fn) {
  const ctx = instance.ctx;
  if (!ctx.__next_tick_pending && !hasComponentEffect(instance)) {
    return nextTick$1(fn && fn.bind(instance.proxy));
  }
  let _resolve;
  if (!ctx.__next_tick_callbacks) {
    ctx.__next_tick_callbacks = [];
  }
  ctx.__next_tick_callbacks.push(() => {
    if (fn) {
      callWithErrorHandling(
        fn.bind(instance.proxy),
        instance,
        14
      );
    } else if (_resolve) {
      _resolve(instance.proxy);
    }
  });
  return new Promise((resolve2) => {
    _resolve = resolve2;
  });
}
function clone(src, seen) {
  src = unwrapper(src);
  const type = typeof src;
  if (type === "object" && src !== null) {
    let copy = seen.get(src);
    if (typeof copy !== "undefined") {
      return copy;
    }
    if (isArray(src)) {
      const len = src.length;
      copy = new Array(len);
      seen.set(src, copy);
      for (let i = 0; i < len; i++) {
        copy[i] = clone(src[i], seen);
      }
    } else {
      copy = {};
      seen.set(src, copy);
      for (const name in src) {
        if (hasOwn(src, name)) {
          copy[name] = clone(src[name], seen);
        }
      }
    }
    return copy;
  }
  if (type !== "symbol") {
    return src;
  }
}
function deepCopy(src) {
  return clone(src, typeof WeakMap !== "undefined" ? /* @__PURE__ */ new WeakMap() : /* @__PURE__ */ new Map());
}
function getMPInstanceData(instance, keys) {
  const data = instance.data;
  const ret = /* @__PURE__ */ Object.create(null);
  keys.forEach((key) => {
    ret[key] = data[key];
  });
  return ret;
}
function patch(instance, data, oldData) {
  if (!data) {
    return;
  }
  data = deepCopy(data);
  data.$eS = instance.$eS || {};
  data.$eA = instance.$eA || {};
  const ctx = instance.ctx;
  const mpType = ctx.mpType;
  if (mpType === "page" || mpType === "component") {
    data.r0 = 1;
    const mpInstance = ctx.$scope;
    const keys = Object.keys(data);
    const diffData = diff(data, oldData || getMPInstanceData(mpInstance, keys));
    if (Object.keys(diffData).length) {
      ctx.__next_tick_pending = true;
      mpInstance.setData(diffData, () => {
        ctx.__next_tick_pending = false;
        flushCallbacks(instance);
      });
      flushPreFlushCbs();
    } else {
      flushCallbacks(instance);
    }
  }
}
function initAppConfig(appConfig) {
  appConfig.globalProperties.$nextTick = function $nextTick(fn) {
    return nextTick(this.$, fn);
  };
}
function onApplyOptions(options, instance, publicThis) {
  instance.appContext.config.globalProperties.$applyOptions(
    options,
    instance,
    publicThis
  );
  const computedOptions = options.computed;
  if (computedOptions) {
    const keys = Object.keys(computedOptions);
    if (keys.length) {
      const ctx = instance.ctx;
      if (!ctx.$computedKeys) {
        ctx.$computedKeys = [];
      }
      ctx.$computedKeys.push(...keys);
    }
  }
  delete instance.ctx.$onApplyOptions;
}
function setRef$1(instance, isUnmount = false) {
  const {
    setupState,
    $templateRefs,
    $templateUniElementRefs,
    ctx: { $scope, $mpPlatform }
  } = instance;
  if ($mpPlatform === "mp-alipay") {
    return;
  }
  if (!$scope || !$templateRefs && !$templateUniElementRefs) {
    return;
  }
  if (isUnmount) {
    $templateRefs && $templateRefs.forEach(
      (templateRef) => setTemplateRef(templateRef, null, setupState)
    );
    $templateUniElementRefs && $templateUniElementRefs.forEach(
      (templateRef) => setTemplateRef(templateRef, null, setupState)
    );
    return;
  }
  const check = $mpPlatform === "mp-baidu" || $mpPlatform === "mp-toutiao";
  const doSetByRefs = (refs) => {
    if (refs.length === 0) {
      return [];
    }
    const mpComponents = (
      // 字节小程序 selectAllComponents 可能返回 null
      // https://github.com/dcloudio/uni-app/issues/3954
      ($scope.selectAllComponents(".r") || []).concat(
        $scope.selectAllComponents(".r-i-f") || []
      )
    );
    return refs.filter((templateRef) => {
      const refValue = findComponentPublicInstance(mpComponents, templateRef.i);
      if (check && refValue === null) {
        return true;
      }
      setTemplateRef(templateRef, refValue, setupState);
      return false;
    });
  };
  const doSet = () => {
    if ($templateRefs) {
      const refs = doSetByRefs($templateRefs);
      if (refs.length && instance.proxy && instance.proxy.$scope) {
        instance.proxy.$scope.setData({ r1: 1 }, () => {
          doSetByRefs(refs);
        });
      }
    }
  };
  if ($templateUniElementRefs && $templateUniElementRefs.length) {
    nextTick(instance, () => {
      $templateUniElementRefs.forEach((templateRef) => {
        if (isArray(templateRef.v)) {
          templateRef.v.forEach((v) => {
            setTemplateRef(templateRef, v, setupState);
          });
        } else {
          setTemplateRef(templateRef, templateRef.v, setupState);
        }
      });
    });
  }
  if ($scope._$setRef) {
    $scope._$setRef(doSet);
  } else {
    nextTick(instance, doSet);
  }
}
function toSkip(value) {
  if (isObject(value)) {
    markRaw(value);
  }
  return value;
}
function findComponentPublicInstance(mpComponents, id) {
  const mpInstance = mpComponents.find(
    (com) => com && (com.properties || com.props).uI === id
  );
  if (mpInstance) {
    const vm = mpInstance.$vm;
    if (vm) {
      return getExposeProxy(vm.$) || vm;
    }
    return toSkip(mpInstance);
  }
  return null;
}
function setTemplateRef({ r: r2, f: f2 }, refValue, setupState) {
  if (isFunction(r2)) {
    r2(refValue, {});
  } else {
    const _isString = isString(r2);
    const _isRef = isRef(r2);
    if (_isString || _isRef) {
      if (f2) {
        if (!_isRef) {
          return;
        }
        if (!isArray(r2.value)) {
          r2.value = [];
        }
        const existing = r2.value;
        if (existing.indexOf(refValue) === -1) {
          existing.push(refValue);
          if (!refValue) {
            return;
          }
          if (refValue.$) {
            onBeforeUnmount(() => remove(existing, refValue), refValue.$);
          }
        }
      } else if (_isString) {
        if (hasOwn(setupState, r2)) {
          setupState[r2] = refValue;
        }
      } else if (isRef(r2)) {
        r2.value = refValue;
      } else {
        warnRef(r2);
      }
    } else {
      warnRef(r2);
    }
  }
}
function warnRef(ref2) {
  warn("Invalid template ref type:", ref2, `(${typeof ref2})`);
}
const queuePostRenderEffect = queuePostFlushCb;
function mountComponent(initialVNode, options) {
  const instance = initialVNode.component = createComponentInstance(initialVNode, options.parentComponent, null);
  instance.renderer = options.mpType ? options.mpType : "component";
  {
    instance.ctx.$onApplyOptions = onApplyOptions;
    instance.ctx.$children = [];
  }
  if (options.mpType === "app") {
    instance.render = NOOP;
  }
  if (options.onBeforeSetup) {
    options.onBeforeSetup(instance, options);
  }
  {
    pushWarningContext(initialVNode);
    startMeasure(instance, `mount`);
  }
  {
    startMeasure(instance, `init`);
  }
  setupComponent(instance);
  {
    endMeasure(instance, `init`);
  }
  {
    if (options.parentComponent && instance.proxy) {
      options.parentComponent.ctx.$children.push(getExposeProxy(instance) || instance.proxy);
    }
  }
  setupRenderEffect(instance);
  {
    popWarningContext();
    endMeasure(instance, `mount`);
  }
  return instance.proxy;
}
const getFunctionalFallthrough = (attrs) => {
  let res;
  for (const key in attrs) {
    if (key === "class" || key === "style" || isOn(key)) {
      (res || (res = {}))[key] = attrs[key];
    }
  }
  return res;
};
function renderComponentRoot(instance) {
  const {
    type: Component2,
    vnode,
    proxy,
    withProxy,
    props,
    propsOptions: [propsOptions],
    slots,
    attrs,
    emit: emit2,
    render,
    renderCache,
    data,
    setupState,
    ctx,
    uid: uid2,
    appContext: {
      app: {
        config: {
          globalProperties: { pruneComponentPropsCache: pruneComponentPropsCache2 }
        }
      }
    },
    inheritAttrs
  } = instance;
  instance.$uniElementIds = /* @__PURE__ */ new Map();
  instance.$templateRefs = [];
  instance.$templateUniElementRefs = [];
  instance.$templateUniElementStyles = {};
  instance.$ei = 0;
  pruneComponentPropsCache2(uid2);
  instance.__counter = instance.__counter === 0 ? 1 : 0;
  let result;
  const prev = setCurrentRenderingInstance(instance);
  try {
    if (vnode.shapeFlag & 4) {
      fallthroughAttrs(inheritAttrs, props, propsOptions, attrs);
      const proxyToUse = withProxy || proxy;
      result = render.call(
        proxyToUse,
        proxyToUse,
        renderCache,
        props,
        setupState,
        data,
        ctx
      );
    } else {
      fallthroughAttrs(
        inheritAttrs,
        props,
        propsOptions,
        Component2.props ? attrs : getFunctionalFallthrough(attrs)
      );
      const render2 = Component2;
      result = render2.length > 1 ? render2(props, { attrs, slots, emit: emit2 }) : render2(
        props,
        null
        /* we know it doesn't need it */
      );
    }
  } catch (err) {
    handleError(err, instance, 1);
    result = false;
  }
  setRef$1(instance);
  setCurrentRenderingInstance(prev);
  return result;
}
function fallthroughAttrs(inheritAttrs, props, propsOptions, fallthroughAttrs2) {
  if (props && fallthroughAttrs2 && inheritAttrs !== false) {
    const keys = Object.keys(fallthroughAttrs2).filter(
      (key) => key !== "class" && key !== "style"
    );
    if (!keys.length) {
      return;
    }
    if (propsOptions && keys.some(isModelListener)) {
      keys.forEach((key) => {
        if (!isModelListener(key) || !(key.slice(9) in propsOptions)) {
          props[key] = fallthroughAttrs2[key];
        }
      });
    } else {
      keys.forEach((key) => props[key] = fallthroughAttrs2[key]);
    }
  }
}
const updateComponentPreRender = (instance) => {
  pauseTracking();
  flushPreFlushCbs();
  resetTracking();
};
function componentUpdateScopedSlotsFn() {
  const scopedSlotsData = this.$scopedSlotsData;
  if (!scopedSlotsData || scopedSlotsData.length === 0) {
    return;
  }
  const mpInstance = this.ctx.$scope;
  const oldData = mpInstance.data;
  const diffData = /* @__PURE__ */ Object.create(null);
  scopedSlotsData.forEach(({ path, index: index2, data }) => {
    const oldScopedSlotData = getValueByDataPath(oldData, path);
    const diffPath = isString(index2) ? `${path}.${index2}` : `${path}[${index2}]`;
    if (typeof oldScopedSlotData === "undefined" || typeof oldScopedSlotData[index2] === "undefined") {
      diffData[diffPath] = data;
    } else {
      const diffScopedSlotData = diff(
        data,
        oldScopedSlotData[index2]
      );
      Object.keys(diffScopedSlotData).forEach((name) => {
        diffData[diffPath + "." + name] = diffScopedSlotData[name];
      });
    }
  });
  scopedSlotsData.length = 0;
  if (Object.keys(diffData).length) {
    mpInstance.setData(diffData);
  }
}
function toggleRecurse({ effect: effect2, update }, allowed) {
  effect2.allowRecurse = update.allowRecurse = allowed;
}
function setupRenderEffect(instance) {
  const updateScopedSlots = componentUpdateScopedSlotsFn.bind(
    instance
  );
  instance.$updateScopedSlots = () => nextTick$1(() => queueJob(updateScopedSlots));
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      onBeforeUnmount(() => {
        setRef$1(instance, true);
      }, instance);
      {
        startMeasure(instance, `patch`);
      }
      patch(instance, renderComponentRoot(instance));
      {
        endMeasure(instance, `patch`);
      }
      {
        devtoolsComponentAdded(instance);
      }
    } else {
      const { next, bu, u } = instance;
      {
        pushWarningContext(next || instance.vnode);
      }
      toggleRecurse(instance, false);
      updateComponentPreRender();
      if (bu) {
        invokeArrayFns$1(bu);
      }
      toggleRecurse(instance, true);
      {
        startMeasure(instance, `patch`);
      }
      patch(instance, renderComponentRoot(instance));
      {
        endMeasure(instance, `patch`);
      }
      if (u) {
        queuePostRenderEffect(u);
      }
      {
        devtoolsComponentUpdated(instance);
      }
      {
        popWarningContext();
      }
    }
  };
  const effect2 = instance.effect = new ReactiveEffect(
    componentUpdateFn,
    NOOP,
    () => queueJob(update),
    instance.scope
    // track it in component's effect scope
  );
  const update = instance.update = () => {
    if (effect2.dirty) {
      effect2.run();
    }
  };
  update.id = instance.uid;
  toggleRecurse(instance, true);
  {
    effect2.onTrack = instance.rtc ? (e2) => invokeArrayFns$1(instance.rtc, e2) : void 0;
    effect2.onTrigger = instance.rtg ? (e2) => invokeArrayFns$1(instance.rtg, e2) : void 0;
    update.ownerInstance = instance;
  }
  {
    update();
  }
}
function unmountComponent(instance) {
  const { bum, scope, update, um } = instance;
  if (bum) {
    invokeArrayFns$1(bum);
  }
  {
    const parentInstance = instance.parent;
    if (parentInstance) {
      const $children = parentInstance.ctx.$children;
      const target = getExposeProxy(instance) || instance.proxy;
      const index2 = $children.indexOf(target);
      if (index2 > -1) {
        $children.splice(index2, 1);
      }
    }
  }
  scope.stop();
  if (update) {
    update.active = false;
  }
  if (um) {
    queuePostRenderEffect(um);
  }
  queuePostRenderEffect(() => {
    instance.isUnmounted = true;
  });
  {
    devtoolsComponentRemoved(instance);
  }
}
const oldCreateApp = createAppAPI();
function getTarget() {
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  if (typeof my !== "undefined") {
    return my;
  }
}
function createVueApp(rootComponent, rootProps = null) {
  const target = getTarget();
  target.__VUE__ = true;
  {
    setDevtoolsHook(target.__VUE_DEVTOOLS_GLOBAL_HOOK__, target);
  }
  const app = oldCreateApp(rootComponent, rootProps);
  const appContext = app._context;
  initAppConfig(appContext.config);
  const createVNode2 = (initialVNode) => {
    initialVNode.appContext = appContext;
    initialVNode.shapeFlag = 6;
    return initialVNode;
  };
  const createComponent2 = function createComponent22(initialVNode, options) {
    return mountComponent(createVNode2(initialVNode), options);
  };
  const destroyComponent = function destroyComponent2(component) {
    return component && unmountComponent(component.$);
  };
  app.mount = function mount() {
    rootComponent.render = NOOP;
    const instance = mountComponent(
      createVNode2({ type: rootComponent }),
      {
        mpType: "app",
        mpInstance: null,
        parentComponent: null,
        slots: [],
        props: null
      }
    );
    app._instance = instance.$;
    {
      devtoolsInitApp(app, version);
    }
    instance.$app = app;
    instance.$createComponent = createComponent2;
    instance.$destroyComponent = destroyComponent;
    appContext.$appInstance = instance;
    return instance;
  };
  app.unmount = function unmount() {
    warn(`Cannot unmount an app.`);
  };
  return app;
}
function injectLifecycleHook(name, hook, publicThis, instance) {
  if (isFunction(hook)) {
    injectHook(name, hook.bind(publicThis), instance);
  }
}
function initHooks$1(options, instance, publicThis) {
  const mpType = options.mpType || publicThis.$mpType;
  if (!mpType || mpType === "component" || // instance.renderer 标识页面是否作为组件渲染
  mpType === "page" && instance.renderer === "component") {
    return;
  }
  Object.keys(options).forEach((name) => {
    if (isUniLifecycleHook(name, options[name], false)) {
      const hooks = options[name];
      if (isArray(hooks)) {
        hooks.forEach((hook) => injectLifecycleHook(name, hook, publicThis, instance));
      } else {
        injectLifecycleHook(name, hooks, publicThis, instance);
      }
    }
  });
}
function applyOptions$2(options, instance, publicThis) {
  initHooks$1(options, instance, publicThis);
}
function set(target, key, val) {
  return target[key] = val;
}
function $callMethod(method, ...args) {
  const fn = this[method];
  if (fn) {
    return fn(...args);
  }
  console.error(`method ${method} not found`);
  return null;
}
function createErrorHandler(app) {
  const userErrorHandler = app.config.errorHandler;
  return function errorHandler(err, instance, info) {
    if (userErrorHandler) {
      userErrorHandler(err, instance, info);
    }
    const appInstance = app._instance;
    if (!appInstance || !appInstance.proxy) {
      throw err;
    }
    if (appInstance[ON_ERROR]) {
      {
        appInstance.proxy.$callHook(ON_ERROR, err);
      }
    } else {
      logError(err, info, instance ? instance.$.vnode : null, false);
    }
  };
}
function mergeAsArray(to, from) {
  return to ? [...new Set([].concat(to, from))] : from;
}
function initOptionMergeStrategies(optionMergeStrategies) {
  UniLifecycleHooks.forEach((name) => {
    optionMergeStrategies[name] = mergeAsArray;
  });
}
let realAtob;
const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
const b64re = /^(?:[A-Za-z\d+/]{4})*?(?:[A-Za-z\d+/]{2}(?:==)?|[A-Za-z\d+/]{3}=?)?$/;
if (typeof atob !== "function") {
  realAtob = function(str) {
    str = String(str).replace(/[\t\n\f\r ]+/g, "");
    if (!b64re.test(str)) {
      throw new Error("Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.");
    }
    str += "==".slice(2 - (str.length & 3));
    var bitmap;
    var result = "";
    var r1;
    var r2;
    var i = 0;
    for (; i < str.length; ) {
      bitmap = b64.indexOf(str.charAt(i++)) << 18 | b64.indexOf(str.charAt(i++)) << 12 | (r1 = b64.indexOf(str.charAt(i++))) << 6 | (r2 = b64.indexOf(str.charAt(i++)));
      result += r1 === 64 ? String.fromCharCode(bitmap >> 16 & 255) : r2 === 64 ? String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255) : String.fromCharCode(bitmap >> 16 & 255, bitmap >> 8 & 255, bitmap & 255);
    }
    return result;
  };
} else {
  realAtob = atob;
}
function b64DecodeUnicode(str) {
  return decodeURIComponent(realAtob(str).split("").map(function(c2) {
    return "%" + ("00" + c2.charCodeAt(0).toString(16)).slice(-2);
  }).join(""));
}
function getCurrentUserInfo() {
  const token = index.getStorageSync("uni_id_token") || "";
  const tokenArr = token.split(".");
  if (!token || tokenArr.length !== 3) {
    return {
      uid: null,
      role: [],
      permission: [],
      tokenExpired: 0
    };
  }
  let userInfo;
  try {
    userInfo = JSON.parse(b64DecodeUnicode(tokenArr[1]));
  } catch (error) {
    throw new Error("获取当前用户信息出错，详细错误信息为：" + error.message);
  }
  userInfo.tokenExpired = userInfo.exp * 1e3;
  delete userInfo.exp;
  delete userInfo.iat;
  return userInfo;
}
function uniIdMixin(globalProperties) {
  globalProperties.uniIDHasRole = function(roleId) {
    const { role } = getCurrentUserInfo();
    return role.indexOf(roleId) > -1;
  };
  globalProperties.uniIDHasPermission = function(permissionId) {
    const { permission } = getCurrentUserInfo();
    return this.uniIDHasRole("admin") || permission.indexOf(permissionId) > -1;
  };
  globalProperties.uniIDTokenValid = function() {
    const { tokenExpired } = getCurrentUserInfo();
    return tokenExpired > Date.now();
  };
}
function initApp(app) {
  const appConfig = app.config;
  appConfig.errorHandler = invokeCreateErrorHandler(app, createErrorHandler);
  initOptionMergeStrategies(appConfig.optionMergeStrategies);
  const globalProperties = appConfig.globalProperties;
  {
    uniIdMixin(globalProperties);
  }
  {
    globalProperties.$set = set;
    globalProperties.$applyOptions = applyOptions$2;
    globalProperties.$callMethod = $callMethod;
  }
  {
    index.invokeCreateVueAppHook(app);
  }
}
const propsCaches = /* @__PURE__ */ Object.create(null);
function pruneComponentPropsCache(uid2) {
  delete propsCaches[uid2];
}
function findComponentPropsData(up) {
  if (!up) {
    return;
  }
  const [uid2, propsId] = up.split(",");
  if (!propsCaches[uid2]) {
    return;
  }
  return propsCaches[uid2][parseInt(propsId)];
}
var plugin = {
  install(app) {
    initApp(app);
    app.config.globalProperties.pruneComponentPropsCache = pruneComponentPropsCache;
    const oldMount = app.mount;
    app.mount = function mount(rootContainer) {
      const instance = oldMount.call(app, rootContainer);
      const createApp2 = getCreateApp();
      if (createApp2) {
        createApp2(instance);
      } else {
        if (typeof createMiniProgramApp !== "undefined") {
          createMiniProgramApp(instance);
        }
      }
      return instance;
    };
  }
};
function getCreateApp() {
  const method = "createApp";
  if (typeof global !== "undefined" && typeof global[method] !== "undefined") {
    return global[method];
  } else if (typeof my !== "undefined") {
    return my[method];
  }
}
function vOn(value, key) {
  const instance = getCurrentInstance();
  const ctx = instance.ctx;
  const extraKey = typeof key !== "undefined" && (ctx.$mpPlatform === "mp-weixin" || ctx.$mpPlatform === "mp-qq" || ctx.$mpPlatform === "mp-xhs") && (isString(key) || typeof key === "number") ? "_" + key : "";
  const name = "e" + instance.$ei++ + extraKey;
  const mpInstance = ctx.$scope;
  if (!value) {
    delete mpInstance[name];
    return name;
  }
  const existingInvoker = mpInstance[name];
  if (existingInvoker) {
    existingInvoker.value = value;
  } else {
    mpInstance[name] = createInvoker(value, instance);
  }
  return name;
}
function createInvoker(initialValue, instance) {
  const invoker = (e2) => {
    patchMPEvent(e2);
    let args = [e2];
    if (instance && instance.ctx.$getTriggerEventDetail) {
      if (typeof e2.detail === "number") {
        e2.detail = instance.ctx.$getTriggerEventDetail(e2.detail);
      }
    }
    if (e2.detail && e2.detail.__args__) {
      args = e2.detail.__args__;
    }
    const eventValue = invoker.value;
    const invoke = () => callWithAsyncErrorHandling(patchStopImmediatePropagation(e2, eventValue), instance, 5, args);
    const eventTarget = e2.target;
    const eventSync = eventTarget ? eventTarget.dataset ? String(eventTarget.dataset.eventsync) === "true" : false : false;
    if (bubbles.includes(e2.type) && !eventSync) {
      setTimeout(invoke);
    } else {
      const res = invoke();
      if (e2.type === "input" && (isArray(res) || isPromise(res))) {
        return;
      }
      return res;
    }
  };
  invoker.value = initialValue;
  return invoker;
}
const bubbles = [
  // touch事件暂不做延迟，否则在 Android 上会影响性能，比如一些拖拽跟手手势等
  // 'touchstart',
  // 'touchmove',
  // 'touchcancel',
  // 'touchend',
  "tap",
  "longpress",
  "longtap",
  "transitionend",
  "animationstart",
  "animationiteration",
  "animationend",
  "touchforcechange"
];
function patchMPEvent(event, instance) {
  if (event.type && event.target) {
    event.preventDefault = NOOP;
    event.stopPropagation = NOOP;
    event.stopImmediatePropagation = NOOP;
    if (!hasOwn(event, "detail")) {
      event.detail = {};
    }
    if (hasOwn(event, "markerId")) {
      event.detail = typeof event.detail === "object" ? event.detail : {};
      event.detail.markerId = event.markerId;
    }
    if (isPlainObject(event.detail) && hasOwn(event.detail, "checked") && !hasOwn(event.detail, "value")) {
      event.detail.value = event.detail.checked;
    }
    if (isPlainObject(event.detail)) {
      event.target = extend({}, event.target, event.detail);
    }
  }
}
function patchStopImmediatePropagation(e2, value) {
  if (isArray(value)) {
    const originalStop = e2.stopImmediatePropagation;
    e2.stopImmediatePropagation = () => {
      originalStop && originalStop.call(e2);
      e2._stopped = true;
    };
    return value.map((fn) => (e3) => !e3._stopped && fn(e3));
  } else {
    return value;
  }
}
function vFor(source, renderItem) {
  let ret;
  if (isArray(source) || isString(source)) {
    ret = new Array(source.length);
    for (let i = 0, l = source.length; i < l; i++) {
      ret[i] = renderItem(source[i], i, i);
    }
  } else if (typeof source === "number") {
    if (!Number.isInteger(source)) {
      warn(`The v-for range expect an integer value but got ${source}.`);
      return [];
    }
    ret = new Array(source);
    for (let i = 0; i < source; i++) {
      ret[i] = renderItem(i + 1, i, i);
    }
  } else if (isObject(source)) {
    if (source[Symbol.iterator]) {
      ret = Array.from(source, (item, i) => renderItem(item, i, i));
    } else {
      const keys = Object.keys(source);
      ret = new Array(keys.length);
      for (let i = 0, l = keys.length; i < l; i++) {
        const key = keys[i];
        ret[i] = renderItem(source[key], key, i);
      }
    }
  } else {
    ret = [];
  }
  return ret;
}
const o = (value, key) => vOn(value, key);
const f = (source, renderItem) => vFor(source, renderItem);
const t = (val) => toDisplayString(val);
function createApp$1(rootComponent, rootProps = null) {
  rootComponent && (rootComponent.mpType = "app");
  return createVueApp(rootComponent, rootProps).use(plugin);
}
const createSSRApp = createApp$1;
function getLocaleLanguage$1() {
  var _a;
  let localeLanguage = "";
  {
    const appBaseInfo = ((_a = wx.getAppBaseInfo) === null || _a === void 0 ? void 0 : _a.call(wx)) || wx.getSystemInfoSync();
    const language = appBaseInfo && appBaseInfo.language ? appBaseInfo.language : LOCALE_EN;
    localeLanguage = normalizeLocale(language) || LOCALE_EN;
  }
  return localeLanguage;
}
function validateProtocolFail(name, msg) {
  console.warn(`${name}: ${msg}`);
}
function validateProtocol(name, data, protocol, onFail) {
  if (!onFail) {
    onFail = validateProtocolFail;
  }
  for (const key in protocol) {
    const errMsg = validateProp(key, data[key], protocol[key], !hasOwn(data, key));
    if (isString(errMsg)) {
      onFail(name, errMsg);
    }
  }
}
function validateProtocols(name, args, protocol, onFail) {
  if (!protocol) {
    return;
  }
  if (!isArray(protocol)) {
    return validateProtocol(name, args[0] || /* @__PURE__ */ Object.create(null), protocol, onFail);
  }
  const len = protocol.length;
  const argsLen = args.length;
  for (let i = 0; i < len; i++) {
    const opts = protocol[i];
    const data = /* @__PURE__ */ Object.create(null);
    if (argsLen > i) {
      data[opts.name] = args[i];
    }
    validateProtocol(name, data, { [opts.name]: opts }, onFail);
  }
}
function validateProp(name, value, prop, isAbsent) {
  if (!isPlainObject(prop)) {
    prop = { type: prop };
  }
  const { type, required, validator } = prop;
  if (required && isAbsent) {
    return 'Missing required args: "' + name + '"';
  }
  if (value == null && !required) {
    return;
  }
  if (type != null) {
    let isValid = false;
    const types = isArray(type) ? type : [type];
    const expectedTypes = [];
    for (let i = 0; i < types.length && !isValid; i++) {
      const { valid, expectedType } = assertType(value, types[i]);
      expectedTypes.push(expectedType || "");
      isValid = valid;
    }
    if (!isValid) {
      return getInvalidTypeMessage(name, value, expectedTypes);
    }
  }
  if (validator) {
    return validator(value);
  }
}
const isSimpleType = /* @__PURE__ */ makeMap("String,Number,Boolean,Function,Symbol");
function assertType(value, type) {
  let valid;
  const expectedType = getType(type);
  if (isSimpleType(expectedType)) {
    const t2 = typeof value;
    valid = t2 === expectedType.toLowerCase();
    if (!valid && t2 === "object") {
      valid = value instanceof type;
    }
  } else if (expectedType === "Object") {
    valid = isObject(value);
  } else if (expectedType === "Array") {
    valid = isArray(value);
  } else {
    {
      valid = value instanceof type;
    }
  }
  return {
    valid,
    expectedType
  };
}
function getInvalidTypeMessage(name, value, expectedTypes) {
  let message = `Invalid args: type check failed for args "${name}". Expected ${expectedTypes.map(capitalize).join(", ")}`;
  const expectedType = expectedTypes[0];
  const receivedType = toRawType(value);
  const expectedValue = styleValue(value, expectedType);
  const receivedValue = styleValue(value, receivedType);
  if (expectedTypes.length === 1 && isExplicable(expectedType) && !isBoolean(expectedType, receivedType)) {
    message += ` with value ${expectedValue}`;
  }
  message += `, got ${receivedType} `;
  if (isExplicable(receivedType)) {
    message += `with value ${receivedValue}.`;
  }
  return message;
}
function getType(ctor) {
  const match = ctor && ctor.toString().match(/^\s*function (\w+)/);
  return match ? match[1] : "";
}
function styleValue(value, type) {
  if (type === "String") {
    return `"${value}"`;
  } else if (type === "Number") {
    return `${Number(value)}`;
  } else {
    return `${value}`;
  }
}
function isExplicable(type) {
  const explicitTypes = ["string", "number", "boolean"];
  return explicitTypes.some((elem) => type.toLowerCase() === elem);
}
function isBoolean(...args) {
  return args.some((elem) => elem.toLowerCase() === "boolean");
}
function tryCatch(fn) {
  return function() {
    try {
      return fn.apply(fn, arguments);
    } catch (e) {
      console.error(e);
    }
  };
}
let invokeCallbackId = 1;
const invokeCallbacks = {};
function addInvokeCallback(id, name, callback, keepAlive = false) {
  invokeCallbacks[id] = {
    name,
    keepAlive,
    callback
  };
  return id;
}
function invokeCallback(id, res, extras) {
  if (typeof id === "number") {
    const opts = invokeCallbacks[id];
    if (opts) {
      if (!opts.keepAlive) {
        delete invokeCallbacks[id];
      }
      return opts.callback(res, extras);
    }
  }
  return res;
}
const API_SUCCESS = "success";
const API_FAIL = "fail";
const API_COMPLETE = "complete";
function getApiCallbacks(args) {
  const apiCallbacks = {};
  for (const name in args) {
    const fn = args[name];
    if (isFunction(fn)) {
      apiCallbacks[name] = tryCatch(fn);
      delete args[name];
    }
  }
  return apiCallbacks;
}
function normalizeErrMsg(errMsg, name) {
  if (!errMsg || errMsg.indexOf(":fail") === -1) {
    return name + ":ok";
  }
  return name + errMsg.substring(errMsg.indexOf(":fail"));
}
function createAsyncApiCallback(name, args = {}, { beforeAll, beforeSuccess } = {}) {
  if (!isPlainObject(args)) {
    args = {};
  }
  const { success, fail, complete } = getApiCallbacks(args);
  const hasSuccess = isFunction(success);
  const hasFail = isFunction(fail);
  const hasComplete = isFunction(complete);
  const callbackId = invokeCallbackId++;
  addInvokeCallback(callbackId, name, (res) => {
    res = res || {};
    res.errMsg = normalizeErrMsg(res.errMsg, name);
    isFunction(beforeAll) && beforeAll(res);
    if (res.errMsg === name + ":ok") {
      isFunction(beforeSuccess) && beforeSuccess(res, args);
      hasSuccess && success(res);
    } else {
      hasFail && fail(res);
    }
    hasComplete && complete(res);
  });
  return callbackId;
}
const HOOK_SUCCESS = "success";
const HOOK_FAIL = "fail";
const HOOK_COMPLETE = "complete";
const globalInterceptors = {};
const scopedInterceptors = {};
function wrapperHook(hook, params) {
  return function(data) {
    return hook(data, params) || data;
  };
}
function queue(hooks, data, params) {
  let promise = false;
  for (let i = 0; i < hooks.length; i++) {
    const hook = hooks[i];
    if (promise) {
      promise = Promise.resolve(wrapperHook(hook, params));
    } else {
      const res = hook(data, params);
      if (isPromise(res)) {
        promise = Promise.resolve(res);
      }
      if (res === false) {
        return {
          then() {
          },
          catch() {
          }
        };
      }
    }
  }
  return promise || {
    then(callback) {
      return callback(data);
    },
    catch() {
    }
  };
}
function wrapperOptions(interceptors2, options = {}) {
  [HOOK_SUCCESS, HOOK_FAIL, HOOK_COMPLETE].forEach((name) => {
    const hooks = interceptors2[name];
    if (!isArray(hooks)) {
      return;
    }
    const oldCallback = options[name];
    options[name] = function callbackInterceptor(res) {
      queue(hooks, res, options).then((res2) => {
        return isFunction(oldCallback) && oldCallback(res2) || res2;
      });
    };
  });
  return options;
}
function wrapperReturnValue(method, returnValue) {
  const returnValueHooks = [];
  if (isArray(globalInterceptors.returnValue)) {
    returnValueHooks.push(...globalInterceptors.returnValue);
  }
  const interceptor = scopedInterceptors[method];
  if (interceptor && isArray(interceptor.returnValue)) {
    returnValueHooks.push(...interceptor.returnValue);
  }
  returnValueHooks.forEach((hook) => {
    returnValue = hook(returnValue) || returnValue;
  });
  return returnValue;
}
function getApiInterceptorHooks(method) {
  const interceptor = /* @__PURE__ */ Object.create(null);
  Object.keys(globalInterceptors).forEach((hook) => {
    if (hook !== "returnValue") {
      interceptor[hook] = globalInterceptors[hook].slice();
    }
  });
  const scopedInterceptor = scopedInterceptors[method];
  if (scopedInterceptor) {
    Object.keys(scopedInterceptor).forEach((hook) => {
      if (hook !== "returnValue") {
        interceptor[hook] = (interceptor[hook] || []).concat(scopedInterceptor[hook]);
      }
    });
  }
  return interceptor;
}
function invokeApi(method, api, options, params) {
  const interceptor = getApiInterceptorHooks(method);
  if (interceptor && Object.keys(interceptor).length) {
    if (isArray(interceptor.invoke)) {
      const res = queue(interceptor.invoke, options);
      return res.then((options2) => {
        return api(wrapperOptions(getApiInterceptorHooks(method), options2), ...params);
      });
    } else {
      return api(wrapperOptions(interceptor, options), ...params);
    }
  }
  return api(options, ...params);
}
function hasCallback(args) {
  if (isPlainObject(args) && [API_SUCCESS, API_FAIL, API_COMPLETE].find((cb) => isFunction(args[cb]))) {
    return true;
  }
  return false;
}
function handlePromise(promise) {
  return promise;
}
function promisify$1(name, fn) {
  return (args = {}, ...rest) => {
    if (hasCallback(args)) {
      return wrapperReturnValue(name, invokeApi(name, fn, extend({}, args), rest));
    }
    return wrapperReturnValue(name, handlePromise(new Promise((resolve, reject) => {
      invokeApi(name, fn, extend({}, args, { success: resolve, fail: reject }), rest);
    })));
  };
}
function formatApiArgs(args, options) {
  args[0];
  {
    return;
  }
}
function invokeSuccess(id, name, res) {
  const result = {
    errMsg: name + ":ok"
  };
  return invokeCallback(id, extend(res || {}, result));
}
function invokeFail(id, name, errMsg, errRes = {}) {
  const errMsgPrefix = name + ":fail";
  let apiErrMsg = "";
  if (!errMsg) {
    apiErrMsg = errMsgPrefix;
  } else if (errMsg.indexOf(errMsgPrefix) === 0) {
    apiErrMsg = errMsg;
  } else {
    apiErrMsg = errMsgPrefix + " " + errMsg;
  }
  {
    delete errRes.errCode;
  }
  let res = extend({ errMsg: apiErrMsg }, errRes);
  return invokeCallback(id, res);
}
function beforeInvokeApi(name, args, protocol, options) {
  {
    validateProtocols(name, args, protocol);
  }
  const errMsg = formatApiArgs(args);
  if (errMsg) {
    return errMsg;
  }
}
function parseErrMsg(errMsg) {
  if (!errMsg || isString(errMsg)) {
    return errMsg;
  }
  if (errMsg.stack) {
    if (typeof globalThis === "undefined" || !globalThis.harmonyChannel) {
      console.error(errMsg.message + "\n" + errMsg.stack);
    }
    return errMsg.message;
  }
  return errMsg;
}
function wrapperTaskApi(name, fn, protocol, options) {
  return (args) => {
    const id = createAsyncApiCallback(name, args, options);
    const errMsg = beforeInvokeApi(name, [args], protocol);
    if (errMsg) {
      return invokeFail(id, name, errMsg);
    }
    return fn(args, {
      resolve: (res) => invokeSuccess(id, name, res),
      reject: (errMsg2, errRes) => invokeFail(id, name, parseErrMsg(errMsg2), errRes)
    });
  };
}
function wrapperSyncApi(name, fn, protocol, options) {
  return (...args) => {
    const errMsg = beforeInvokeApi(name, args, protocol);
    if (errMsg) {
      throw new Error(errMsg);
    }
    return fn.apply(null, args);
  };
}
function wrapperAsyncApi(name, fn, protocol, options) {
  return wrapperTaskApi(name, fn, protocol, options);
}
function defineSyncApi(name, fn, protocol, options) {
  return wrapperSyncApi(name, fn, protocol);
}
function defineAsyncApi(name, fn, protocol, options) {
  return promisify$1(name, wrapperAsyncApi(name, fn, protocol, options));
}
const API_UPX2PX = "upx2px";
const Upx2pxProtocol = [
  {
    name: "upx",
    type: [Number, String],
    required: true
  }
];
const EPS = 1e-4;
const BASE_DEVICE_WIDTH = 750;
let isIOS = false;
let deviceWidth = 0;
let deviceDPR = 0;
function checkDeviceWidth() {
  var _a, _b;
  let windowWidth, pixelRatio, platform;
  {
    const windowInfo = ((_a = wx.getWindowInfo) === null || _a === void 0 ? void 0 : _a.call(wx)) || wx.getSystemInfoSync();
    const deviceInfo = ((_b = wx.getDeviceInfo) === null || _b === void 0 ? void 0 : _b.call(wx)) || wx.getSystemInfoSync();
    windowWidth = windowInfo.windowWidth;
    pixelRatio = windowInfo.pixelRatio;
    platform = deviceInfo.platform;
  }
  deviceWidth = windowWidth;
  deviceDPR = pixelRatio;
  isIOS = platform === "ios";
}
const upx2px = defineSyncApi(API_UPX2PX, (number, newDeviceWidth) => {
  if (deviceWidth === 0) {
    checkDeviceWidth();
  }
  number = Number(number);
  if (number === 0) {
    return 0;
  }
  let width = newDeviceWidth || deviceWidth;
  let result = number / BASE_DEVICE_WIDTH * width;
  if (result < 0) {
    result = -result;
  }
  result = Math.floor(result + EPS);
  if (result === 0) {
    if (deviceDPR === 1 || !isIOS) {
      result = 1;
    } else {
      result = 0.5;
    }
  }
  return number < 0 ? -result : result;
}, Upx2pxProtocol);
function __f__(type, filename, ...args) {
  if (filename) {
    args.push(filename);
  }
  console[type].apply(console, args);
}
const API_ADD_INTERCEPTOR = "addInterceptor";
const API_REMOVE_INTERCEPTOR = "removeInterceptor";
const AddInterceptorProtocol = [
  {
    name: "method",
    type: [String, Object],
    required: true
  }
];
const RemoveInterceptorProtocol = AddInterceptorProtocol;
function mergeInterceptorHook(interceptors2, interceptor) {
  Object.keys(interceptor).forEach((hook) => {
    if (isFunction(interceptor[hook])) {
      interceptors2[hook] = mergeHook(interceptors2[hook], interceptor[hook]);
    }
  });
}
function removeInterceptorHook(interceptors2, interceptor) {
  if (!interceptors2 || !interceptor) {
    return;
  }
  Object.keys(interceptor).forEach((name) => {
    const hooks = interceptors2[name];
    const hook = interceptor[name];
    if (isArray(hooks) && isFunction(hook)) {
      remove(hooks, hook);
    }
  });
}
function mergeHook(parentVal, childVal) {
  const res = childVal ? parentVal ? parentVal.concat(childVal) : isArray(childVal) ? childVal : [childVal] : parentVal;
  return res ? dedupeHooks(res) : res;
}
function dedupeHooks(hooks) {
  const res = [];
  for (let i = 0; i < hooks.length; i++) {
    if (res.indexOf(hooks[i]) === -1) {
      res.push(hooks[i]);
    }
  }
  return res;
}
const addInterceptor = defineSyncApi(API_ADD_INTERCEPTOR, (method, interceptor) => {
  if (isString(method) && isPlainObject(interceptor)) {
    mergeInterceptorHook(scopedInterceptors[method] || (scopedInterceptors[method] = {}), interceptor);
  } else if (isPlainObject(method)) {
    mergeInterceptorHook(globalInterceptors, method);
  }
}, AddInterceptorProtocol);
const removeInterceptor = defineSyncApi(API_REMOVE_INTERCEPTOR, (method, interceptor) => {
  if (isString(method)) {
    if (isPlainObject(interceptor)) {
      removeInterceptorHook(scopedInterceptors[method], interceptor);
    } else {
      delete scopedInterceptors[method];
    }
  } else if (isPlainObject(method)) {
    removeInterceptorHook(globalInterceptors, method);
  }
}, RemoveInterceptorProtocol);
const interceptors = {};
const API_ON = "$on";
const OnProtocol = [
  {
    name: "event",
    type: String,
    required: true
  },
  {
    name: "callback",
    type: Function,
    required: true
  }
];
const API_ONCE = "$once";
const OnceProtocol = OnProtocol;
const API_OFF = "$off";
const OffProtocol = [
  {
    name: "event",
    type: [String, Array]
  },
  {
    name: "callback",
    type: [Function, Number]
  }
];
const API_EMIT = "$emit";
const EmitProtocol = [
  {
    name: "event",
    type: String,
    required: true
  }
];
class EventBus {
  constructor() {
    this.$emitter = new E$1();
  }
  on(name, callback) {
    return this.$emitter.on(name, callback);
  }
  once(name, callback) {
    return this.$emitter.once(name, callback);
  }
  off(name, callback) {
    if (!name) {
      this.$emitter.e = {};
      return;
    }
    this.$emitter.off(name, callback);
  }
  emit(name, ...args) {
    this.$emitter.emit(name, ...args);
  }
}
const eventBus = new EventBus();
const $on = defineSyncApi(API_ON, (name, callback) => {
  eventBus.on(name, callback);
  return () => eventBus.off(name, callback);
}, OnProtocol);
const $once = defineSyncApi(API_ONCE, (name, callback) => {
  eventBus.once(name, callback);
  return () => eventBus.off(name, callback);
}, OnceProtocol);
const $off = defineSyncApi(API_OFF, (name, callback) => {
  if (!isArray(name))
    name = name ? [name] : [];
  name.forEach((n) => {
    eventBus.off(n, callback);
  });
}, OffProtocol);
const $emit = defineSyncApi(API_EMIT, (name, ...args) => {
  eventBus.emit(name, ...args);
}, EmitProtocol);
let cid;
let cidErrMsg;
let enabled;
function normalizePushMessage(message) {
  try {
    return JSON.parse(message);
  } catch (e) {
  }
  return message;
}
function invokePushCallback(args) {
  if (args.type === "enabled") {
    enabled = true;
  } else if (args.type === "clientId") {
    cid = args.cid;
    cidErrMsg = args.errMsg;
    invokeGetPushCidCallbacks(cid, args.errMsg);
  } else if (args.type === "pushMsg") {
    const message = {
      type: "receive",
      data: normalizePushMessage(args.message)
    };
    for (let i = 0; i < onPushMessageCallbacks.length; i++) {
      const callback = onPushMessageCallbacks[i];
      callback(message);
      if (message.stopped) {
        break;
      }
    }
  } else if (args.type === "click") {
    onPushMessageCallbacks.forEach((callback) => {
      callback({
        type: "click",
        data: normalizePushMessage(args.message)
      });
    });
  }
}
const getPushCidCallbacks = [];
function invokeGetPushCidCallbacks(cid2, errMsg) {
  getPushCidCallbacks.forEach((callback) => {
    callback(cid2, errMsg);
  });
  getPushCidCallbacks.length = 0;
}
const API_GET_PUSH_CLIENT_ID = "getPushClientId";
const getPushClientId = defineAsyncApi(API_GET_PUSH_CLIENT_ID, (_, { resolve, reject }) => {
  Promise.resolve().then(() => {
    if (typeof enabled === "undefined") {
      enabled = false;
      cid = "";
      cidErrMsg = "uniPush is not enabled";
    }
    getPushCidCallbacks.push((cid2, errMsg) => {
      if (cid2) {
        resolve({ cid: cid2 });
      } else {
        reject(errMsg);
      }
    });
    if (typeof cid !== "undefined") {
      invokeGetPushCidCallbacks(cid, cidErrMsg);
    }
  });
});
const onPushMessageCallbacks = [];
const onPushMessage = (fn) => {
  if (onPushMessageCallbacks.indexOf(fn) === -1) {
    onPushMessageCallbacks.push(fn);
  }
};
const offPushMessage = (fn) => {
  if (!fn) {
    onPushMessageCallbacks.length = 0;
  } else {
    const index2 = onPushMessageCallbacks.indexOf(fn);
    if (index2 > -1) {
      onPushMessageCallbacks.splice(index2, 1);
    }
  }
};
const SYNC_API_RE = /^\$|__f__|getLocale|setLocale|sendNativeEvent|restoreGlobal|requireGlobal|getCurrentSubNVue|getMenuButtonBoundingClientRect|^report|interceptors|Interceptor$|getSubNVueById|requireNativePlugin|upx2px|rpx2px|hideKeyboard|canIUse|^create|Sync$|Manager$|base64ToArrayBuffer|arrayBufferToBase64|getDeviceInfo|getAppBaseInfo|getWindowInfo|getSystemSetting|getAppAuthorizeSetting/;
const CONTEXT_API_RE = /^create|Manager$/;
const CONTEXT_API_RE_EXC = ["createBLEConnection"];
const TASK_APIS = ["request", "downloadFile", "uploadFile", "connectSocket"];
const ASYNC_API = ["createBLEConnection"];
const CALLBACK_API_RE = /^on|^off/;
function isContextApi(name) {
  return CONTEXT_API_RE.test(name) && CONTEXT_API_RE_EXC.indexOf(name) === -1;
}
function isSyncApi(name) {
  return SYNC_API_RE.test(name) && ASYNC_API.indexOf(name) === -1;
}
function isCallbackApi(name) {
  return CALLBACK_API_RE.test(name) && name !== "onPush";
}
function isTaskApi(name) {
  return TASK_APIS.indexOf(name) !== -1;
}
function shouldPromise(name) {
  if (isContextApi(name) || isSyncApi(name) || isCallbackApi(name)) {
    return false;
  }
  return true;
}
if (!Promise.prototype.finally) {
  Promise.prototype.finally = function(onfinally) {
    const promise = this.constructor;
    return this.then((value) => promise.resolve(onfinally && onfinally()).then(() => value), (reason) => promise.resolve(onfinally && onfinally()).then(() => {
      throw reason;
    }));
  };
}
function promisify(name, api) {
  if (!shouldPromise(name)) {
    return api;
  }
  if (!isFunction(api)) {
    return api;
  }
  return function promiseApi(options = {}, ...rest) {
    if (isFunction(options.success) || isFunction(options.fail) || isFunction(options.complete)) {
      return wrapperReturnValue(name, invokeApi(name, api, extend({}, options), rest));
    }
    return wrapperReturnValue(name, handlePromise(new Promise((resolve, reject) => {
      invokeApi(name, api, extend({}, options, {
        success: resolve,
        fail: reject
      }), rest);
    })));
  };
}
const CALLBACKS = ["success", "fail", "cancel", "complete"];
function initWrapper(protocols2) {
  function processCallback(methodName, method, returnValue) {
    return function(res) {
      return method(processReturnValue(methodName, res, returnValue));
    };
  }
  function processArgs(methodName, fromArgs, argsOption = {}, returnValue = {}, keepFromArgs = false) {
    if (isPlainObject(fromArgs)) {
      const toArgs = keepFromArgs === true ? fromArgs : {};
      if (isFunction(argsOption)) {
        argsOption = argsOption(fromArgs, toArgs) || {};
      }
      for (const key in fromArgs) {
        if (hasOwn(argsOption, key)) {
          let keyOption = argsOption[key];
          if (isFunction(keyOption)) {
            keyOption = keyOption(fromArgs[key], fromArgs, toArgs);
          }
          if (!keyOption) {
            console.warn(`微信小程序 ${methodName} 暂不支持 ${key}`);
          } else if (isString(keyOption)) {
            toArgs[keyOption] = fromArgs[key];
          } else if (isPlainObject(keyOption)) {
            toArgs[keyOption.name ? keyOption.name : key] = keyOption.value;
          }
        } else if (CALLBACKS.indexOf(key) !== -1) {
          const callback = fromArgs[key];
          if (isFunction(callback)) {
            toArgs[key] = processCallback(methodName, callback, returnValue);
          }
        } else {
          if (!keepFromArgs && !hasOwn(toArgs, key)) {
            toArgs[key] = fromArgs[key];
          }
        }
      }
      return toArgs;
    } else if (isFunction(fromArgs)) {
      if (isFunction(argsOption)) {
        argsOption(fromArgs, {});
      }
      fromArgs = processCallback(methodName, fromArgs, returnValue);
    }
    return fromArgs;
  }
  function processReturnValue(methodName, res, returnValue, keepReturnValue = false) {
    if (isFunction(protocols2.returnValue)) {
      res = protocols2.returnValue(methodName, res);
    }
    const realKeepReturnValue = keepReturnValue || false;
    return processArgs(methodName, res, returnValue, {}, realKeepReturnValue);
  }
  return function wrapper(methodName, method) {
    const hasProtocol = hasOwn(protocols2, methodName);
    if (!hasProtocol && typeof wx[methodName] !== "function") {
      return method;
    }
    const needWrapper = hasProtocol || isFunction(protocols2.returnValue) || isContextApi(methodName) || isTaskApi(methodName);
    const hasMethod = hasProtocol || isFunction(method);
    if (!hasProtocol && !method) {
      return function() {
        console.error(`微信小程序 暂不支持${methodName}`);
      };
    }
    if (!needWrapper || !hasMethod) {
      return method;
    }
    const protocol = protocols2[methodName];
    return function(arg1, arg2) {
      let options = protocol || {};
      if (isFunction(protocol)) {
        options = protocol(arg1);
      }
      arg1 = processArgs(methodName, arg1, options.args, options.returnValue);
      const args = [arg1];
      if (typeof arg2 !== "undefined") {
        args.push(arg2);
      }
      const returnValue = wx[options.name || methodName].apply(wx, args);
      if (isContextApi(methodName) || isTaskApi(methodName)) {
        if (returnValue && !returnValue.__v_skip) {
          returnValue.__v_skip = true;
        }
      }
      if (isSyncApi(methodName)) {
        return processReturnValue(methodName, returnValue, options.returnValue, isContextApi(methodName));
      }
      return returnValue;
    };
  };
}
const getLocale = () => {
  const app = isFunction(getApp) && getApp({ allowDefault: true });
  if (app && app.$vm) {
    return app.$vm.$locale;
  }
  return getLocaleLanguage$1();
};
const setLocale = (locale) => {
  const app = isFunction(getApp) && getApp();
  if (!app) {
    return false;
  }
  const oldLocale = app.$vm.$locale;
  if (oldLocale !== locale) {
    app.$vm.$locale = locale;
    onLocaleChangeCallbacks.forEach((fn) => fn({ locale }));
    return true;
  }
  return false;
};
const onLocaleChangeCallbacks = [];
const onLocaleChange = (fn) => {
  if (onLocaleChangeCallbacks.indexOf(fn) === -1) {
    onLocaleChangeCallbacks.push(fn);
  }
};
if (typeof global !== "undefined") {
  global.getLocale = getLocale;
}
const UUID_KEY = "__DC_STAT_UUID";
let deviceId;
function useDeviceId(global2 = wx) {
  return function addDeviceId(_, toRes) {
    deviceId = deviceId || global2.getStorageSync(UUID_KEY);
    if (!deviceId) {
      deviceId = Date.now() + "" + Math.floor(Math.random() * 1e7);
      wx.setStorage({
        key: UUID_KEY,
        data: deviceId
      });
    }
    toRes.deviceId = deviceId;
  };
}
function addSafeAreaInsets(fromRes, toRes) {
  if (fromRes.safeArea) {
    const safeArea = fromRes.safeArea;
    toRes.safeAreaInsets = {
      top: safeArea.top,
      left: safeArea.left,
      right: fromRes.windowWidth - safeArea.right,
      bottom: fromRes.screenHeight - safeArea.bottom
    };
  }
}
function getOSInfo(system, platform) {
  let osName = "";
  let osVersion = "";
  if (platform && false) {
    osName = platform;
    osVersion = system;
  } else {
    osName = system.split(" ")[0] || platform;
    osVersion = system.split(" ")[1] || "";
  }
  osName = osName.toLowerCase();
  switch (osName) {
    case "harmony":
    case "ohos":
    case "openharmony":
      osName = "harmonyos";
      break;
    case "iphone os":
      osName = "ios";
      break;
    case "mac":
    case "darwin":
      osName = "macos";
      break;
    case "windows_nt":
      osName = "windows";
      break;
  }
  return {
    osName,
    osVersion
  };
}
function populateParameters(fromRes, toRes) {
  const { brand = "", model = "", system = "", language = "", theme, version: version2, platform, fontSizeSetting, SDKVersion, pixelRatio, deviceOrientation } = fromRes;
  const { osName, osVersion } = getOSInfo(system, platform);
  let hostVersion = version2;
  let deviceType = getGetDeviceType(fromRes, model);
  let deviceBrand = getDeviceBrand(brand);
  let _hostName = getHostName(fromRes);
  let _deviceOrientation = deviceOrientation;
  let _devicePixelRatio = pixelRatio;
  let _SDKVersion = SDKVersion;
  const hostLanguage = (language || "").replace(/_/g, "-");
  const parameters = {
    appId: "__UNI__62F611F",
    appName: "newSunShineFrontend",
    appVersion: "1.0.0",
    appVersionCode: "100",
    appLanguage: getAppLanguage(hostLanguage),
    uniCompileVersion: "4.75",
    uniCompilerVersion: "4.75",
    uniRuntimeVersion: "4.75",
    uniPlatform: "mp-weixin",
    deviceBrand,
    deviceModel: model,
    deviceType,
    devicePixelRatio: _devicePixelRatio,
    deviceOrientation: _deviceOrientation,
    osName,
    osVersion,
    hostTheme: theme,
    hostVersion,
    hostLanguage,
    hostName: _hostName,
    hostSDKVersion: _SDKVersion,
    hostFontSizeSetting: fontSizeSetting,
    windowTop: 0,
    windowBottom: 0,
    // TODO
    osLanguage: void 0,
    osTheme: void 0,
    ua: void 0,
    hostPackageName: void 0,
    browserName: void 0,
    browserVersion: void 0,
    isUniAppX: false
  };
  extend(toRes, parameters);
}
function getGetDeviceType(fromRes, model) {
  let deviceType = fromRes.deviceType || "phone";
  {
    const deviceTypeMaps = {
      ipad: "pad",
      windows: "pc",
      mac: "pc"
    };
    const deviceTypeMapsKeys = Object.keys(deviceTypeMaps);
    const _model = model.toLowerCase();
    for (let index2 = 0; index2 < deviceTypeMapsKeys.length; index2++) {
      const _m = deviceTypeMapsKeys[index2];
      if (_model.indexOf(_m) !== -1) {
        deviceType = deviceTypeMaps[_m];
        break;
      }
    }
  }
  return deviceType;
}
function getDeviceBrand(brand) {
  let deviceBrand = brand;
  if (deviceBrand) {
    deviceBrand = deviceBrand.toLowerCase();
  }
  return deviceBrand;
}
function getAppLanguage(defaultLanguage) {
  return getLocale ? getLocale() : defaultLanguage;
}
function getHostName(fromRes) {
  const _platform = "WeChat";
  let _hostName = fromRes.hostName || _platform;
  {
    if (fromRes.environment) {
      _hostName = fromRes.environment;
    } else if (fromRes.host && fromRes.host.env) {
      _hostName = fromRes.host.env;
    }
  }
  return _hostName;
}
const getSystemInfo = {
  returnValue: (fromRes, toRes) => {
    addSafeAreaInsets(fromRes, toRes);
    useDeviceId()(fromRes, toRes);
    populateParameters(fromRes, toRes);
  }
};
const getSystemInfoSync = getSystemInfo;
const redirectTo = {};
const previewImage = {
  args(fromArgs, toArgs) {
    let currentIndex = parseInt(fromArgs.current);
    if (isNaN(currentIndex)) {
      return;
    }
    const urls = fromArgs.urls;
    if (!isArray(urls)) {
      return;
    }
    const len = urls.length;
    if (!len) {
      return;
    }
    if (currentIndex < 0) {
      currentIndex = 0;
    } else if (currentIndex >= len) {
      currentIndex = len - 1;
    }
    if (currentIndex > 0) {
      toArgs.current = urls[currentIndex];
      toArgs.urls = urls.filter((item, index2) => index2 < currentIndex ? item !== urls[currentIndex] : true);
    } else {
      toArgs.current = urls[0];
    }
    return {
      indicator: false,
      loop: false
    };
  }
};
const showActionSheet = {
  args(fromArgs, toArgs) {
    toArgs.alertText = fromArgs.title;
  }
};
const getDeviceInfo = {
  returnValue: (fromRes, toRes) => {
    const { brand, model, system = "", platform = "" } = fromRes;
    let deviceType = getGetDeviceType(fromRes, model);
    let deviceBrand = getDeviceBrand(brand);
    useDeviceId()(fromRes, toRes);
    const { osName, osVersion } = getOSInfo(system, platform);
    toRes = sortObject(extend(toRes, {
      deviceType,
      deviceBrand,
      deviceModel: model,
      osName,
      osVersion
    }));
  }
};
const getAppBaseInfo = {
  returnValue: (fromRes, toRes) => {
    const { version: version2, language, SDKVersion, theme } = fromRes;
    let _hostName = getHostName(fromRes);
    let hostLanguage = (language || "").replace(/_/g, "-");
    const parameters = {
      hostVersion: version2,
      hostLanguage,
      hostName: _hostName,
      hostSDKVersion: SDKVersion,
      hostTheme: theme,
      appId: "__UNI__62F611F",
      appName: "newSunShineFrontend",
      appVersion: "1.0.0",
      appVersionCode: "100",
      appLanguage: getAppLanguage(hostLanguage),
      isUniAppX: false,
      uniPlatform: "mp-weixin",
      uniCompileVersion: "4.75",
      uniCompilerVersion: "4.75",
      uniRuntimeVersion: "4.75"
    };
    extend(toRes, parameters);
  }
};
const getWindowInfo = {
  returnValue: (fromRes, toRes) => {
    addSafeAreaInsets(fromRes, toRes);
    toRes = sortObject(extend(toRes, {
      windowTop: 0,
      windowBottom: 0
    }));
  }
};
const getAppAuthorizeSetting = {
  returnValue: function(fromRes, toRes) {
    const { locationReducedAccuracy } = fromRes;
    toRes.locationAccuracy = "unsupported";
    if (locationReducedAccuracy === true) {
      toRes.locationAccuracy = "reduced";
    } else if (locationReducedAccuracy === false) {
      toRes.locationAccuracy = "full";
    }
  }
};
const onError = {
  args(fromArgs) {
    const app = getApp({ allowDefault: true }) || {};
    if (!app.$vm) {
      if (!wx.$onErrorHandlers) {
        wx.$onErrorHandlers = [];
      }
      wx.$onErrorHandlers.push(fromArgs);
    } else {
      injectHook(ON_ERROR, fromArgs, app.$vm.$);
    }
  }
};
const offError = {
  args(fromArgs) {
    const app = getApp({ allowDefault: true }) || {};
    if (!app.$vm) {
      if (!wx.$onErrorHandlers) {
        return;
      }
      const index2 = wx.$onErrorHandlers.findIndex((fn) => fn === fromArgs);
      if (index2 !== -1) {
        wx.$onErrorHandlers.splice(index2, 1);
      }
    } else if (fromArgs.__weh) {
      const onErrors = app.$vm.$[ON_ERROR];
      if (onErrors) {
        const index2 = onErrors.indexOf(fromArgs.__weh);
        if (index2 > -1) {
          onErrors.splice(index2, 1);
        }
      }
    }
  }
};
const onSocketOpen = {
  args() {
    if (wx.__uni_console__) {
      if (wx.__uni_console_warned__) {
        return;
      }
      wx.__uni_console_warned__ = true;
      console.warn(`开发模式下小程序日志回显会使用 socket 连接，为了避免冲突，建议使用 SocketTask 的方式去管理 WebSocket 或手动关闭日志回显功能。[详情](https://uniapp.dcloud.net.cn/tutorial/run/mp-log.html)`);
    }
  }
};
const onSocketMessage = onSocketOpen;
const baseApis = {
  $on,
  $off,
  $once,
  $emit,
  upx2px,
  rpx2px: upx2px,
  interceptors,
  addInterceptor,
  removeInterceptor,
  onCreateVueApp,
  invokeCreateVueAppHook,
  getLocale,
  setLocale,
  onLocaleChange,
  getPushClientId,
  onPushMessage,
  offPushMessage,
  invokePushCallback,
  __f__
};
function initUni(api, protocols2, platform = wx) {
  const wrapper = initWrapper(protocols2);
  const UniProxyHandlers = {
    get(target, key) {
      if (hasOwn(target, key)) {
        return target[key];
      }
      if (hasOwn(api, key)) {
        return promisify(key, api[key]);
      }
      if (hasOwn(baseApis, key)) {
        return promisify(key, baseApis[key]);
      }
      return promisify(key, wrapper(key, platform[key]));
    }
  };
  return new Proxy({}, UniProxyHandlers);
}
function initGetProvider(providers) {
  return function getProvider2({ service, success, fail, complete }) {
    let res;
    if (providers[service]) {
      res = {
        errMsg: "getProvider:ok",
        service,
        provider: providers[service]
      };
      isFunction(success) && success(res);
    } else {
      res = {
        errMsg: "getProvider:fail:服务[" + service + "]不存在"
      };
      isFunction(fail) && fail(res);
    }
    isFunction(complete) && complete(res);
  };
}
const objectKeys = [
  "qy",
  "env",
  "error",
  "version",
  "lanDebug",
  "cloud",
  "serviceMarket",
  "router",
  "worklet",
  "__webpack_require_UNI_MP_PLUGIN__"
];
const singlePageDisableKey = ["lanDebug", "router", "worklet"];
const launchOption = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : null;
function isWxKey(key) {
  if (launchOption && launchOption.scene === 1154 && singlePageDisableKey.includes(key)) {
    return false;
  }
  return objectKeys.indexOf(key) > -1 || typeof wx[key] === "function";
}
function initWx() {
  const newWx = {};
  for (const key in wx) {
    if (isWxKey(key)) {
      newWx[key] = wx[key];
    }
  }
  if (typeof globalThis !== "undefined" && typeof requireMiniProgram === "undefined") {
    globalThis.wx = newWx;
  }
  return newWx;
}
const mocks$1 = ["__route__", "__wxExparserNodeId__", "__wxWebviewId__"];
const getProvider = initGetProvider({
  oauth: ["weixin"],
  share: ["weixin"],
  payment: ["wxpay"],
  push: ["weixin"]
});
function initComponentMocks(component) {
  const res = /* @__PURE__ */ Object.create(null);
  mocks$1.forEach((name) => {
    res[name] = component[name];
  });
  return res;
}
function createSelectorQuery() {
  const query = wx$2.createSelectorQuery();
  const oldIn = query.in;
  query.in = function newIn(component) {
    if (component.$scope) {
      return oldIn.call(this, component.$scope);
    }
    return oldIn.call(this, initComponentMocks(component));
  };
  return query;
}
const wx$2 = initWx();
if (!wx$2.canIUse("getAppBaseInfo")) {
  wx$2.getAppBaseInfo = wx$2.getSystemInfoSync;
}
if (!wx$2.canIUse("getWindowInfo")) {
  wx$2.getWindowInfo = wx$2.getSystemInfoSync;
}
if (!wx$2.canIUse("getDeviceInfo")) {
  wx$2.getDeviceInfo = wx$2.getSystemInfoSync;
}
let baseInfo = wx$2.getAppBaseInfo && wx$2.getAppBaseInfo();
if (!baseInfo) {
  baseInfo = wx$2.getSystemInfoSync();
}
const host = baseInfo ? baseInfo.host : null;
const shareVideoMessage = host && host.env === "SAAASDK" ? wx$2.miniapp.shareVideoMessage : wx$2.shareVideoMessage;
var shims = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  createSelectorQuery,
  getProvider,
  shareVideoMessage
});
const compressImage = {
  args(fromArgs, toArgs) {
    if (fromArgs.compressedHeight && !toArgs.compressHeight) {
      toArgs.compressHeight = fromArgs.compressedHeight;
    }
    if (fromArgs.compressedWidth && !toArgs.compressWidth) {
      toArgs.compressWidth = fromArgs.compressedWidth;
    }
  }
};
var protocols = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  compressImage,
  getAppAuthorizeSetting,
  getAppBaseInfo,
  getDeviceInfo,
  getSystemInfo,
  getSystemInfoSync,
  getWindowInfo,
  offError,
  onError,
  onSocketMessage,
  onSocketOpen,
  previewImage,
  redirectTo,
  showActionSheet
});
const wx$1 = initWx();
var index = initUni(shims, protocols, wx$1);
function initRuntimeSocket(hosts, port, id) {
  if (hosts == "" || port == "" || id == "")
    return Promise.resolve(null);
  return hosts.split(",").reduce((promise, host2) => {
    return promise.then((socket) => {
      if (socket != null)
        return Promise.resolve(socket);
      return tryConnectSocket(host2, port, id);
    });
  }, Promise.resolve(null));
}
const SOCKET_TIMEOUT = 500;
function tryConnectSocket(host2, port, id) {
  return new Promise((resolve, reject) => {
    const socket = index.connectSocket({
      url: `ws://${host2}:${port}/${id}`,
      multiple: true,
      // 支付宝小程序 是否开启多实例
      fail() {
        resolve(null);
      }
    });
    const timer = setTimeout(() => {
      socket.close({
        code: 1006,
        reason: "connect timeout"
      });
      resolve(null);
    }, SOCKET_TIMEOUT);
    socket.onOpen((e) => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.onClose((e) => {
      clearTimeout(timer);
      resolve(null);
    });
    socket.onError((e) => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}
const CONSOLE_TYPES = ["log", "warn", "error", "info", "debug"];
const originalConsole = /* @__PURE__ */ CONSOLE_TYPES.reduce((methods, type) => {
  methods[type] = console[type].bind(console);
  return methods;
}, {});
let sendError = null;
const errorQueue = /* @__PURE__ */ new Set();
const errorExtra = {};
function sendErrorMessages(errors) {
  if (sendError == null) {
    errors.forEach((error) => {
      errorQueue.add(error);
    });
    return;
  }
  const data = errors.map((err) => {
    if (typeof err === "string") {
      return err;
    }
    const isPromiseRejection = err && "promise" in err && "reason" in err;
    const prefix = isPromiseRejection ? "UnhandledPromiseRejection: " : "";
    if (isPromiseRejection) {
      err = err.reason;
    }
    if (err instanceof Error && err.stack) {
      if (err.message && !err.stack.includes(err.message)) {
        return `${prefix}${err.message}
${err.stack}`;
      }
      return `${prefix}${err.stack}`;
    }
    if (typeof err === "object" && err !== null) {
      try {
        return prefix + JSON.stringify(err);
      } catch (err2) {
        return prefix + String(err2);
      }
    }
    return prefix + String(err);
  }).filter(Boolean);
  if (data.length > 0) {
    sendError(JSON.stringify(Object.assign({
      type: "error",
      data
    }, errorExtra)));
  }
}
function setSendError(value, extra = {}) {
  sendError = value;
  Object.assign(errorExtra, extra);
  if (value != null && errorQueue.size > 0) {
    const errors = Array.from(errorQueue);
    errorQueue.clear();
    sendErrorMessages(errors);
  }
}
function initOnError() {
  function onError2(error) {
    try {
      if (typeof PromiseRejectionEvent !== "undefined" && error instanceof PromiseRejectionEvent && error.reason instanceof Error && error.reason.message && error.reason.message.includes(`Cannot create property 'errMsg' on string 'taskId`)) {
        return;
      }
      if (true) {
        originalConsole.error(error);
      }
      sendErrorMessages([error]);
    } catch (err) {
      originalConsole.error(err);
    }
  }
  if (typeof index.onError === "function") {
    index.onError(onError2);
  }
  if (typeof index.onUnhandledRejection === "function") {
    index.onUnhandledRejection(onError2);
  }
  return function offError2() {
    if (typeof index.offError === "function") {
      index.offError(onError2);
    }
    if (typeof index.offUnhandledRejection === "function") {
      index.offUnhandledRejection(onError2);
    }
  };
}
function formatMessage(type, args) {
  try {
    return {
      type,
      args: formatArgs(args)
    };
  } catch (e) {
  }
  return {
    type,
    args: []
  };
}
function formatArgs(args) {
  return args.map((arg) => formatArg(arg));
}
function formatArg(arg, depth = 0) {
  if (depth >= 7) {
    return {
      type: "object",
      value: "[Maximum depth reached]"
    };
  }
  const type = typeof arg;
  switch (type) {
    case "string":
      return formatString(arg);
    case "number":
      return formatNumber(arg);
    case "boolean":
      return formatBoolean(arg);
    case "object":
      try {
        return formatObject(arg, depth);
      } catch (e) {
        return {
          type: "object",
          value: {
            properties: []
          }
        };
      }
    case "undefined":
      return formatUndefined();
    case "function":
      return formatFunction(arg);
    case "symbol": {
      return formatSymbol(arg);
    }
    case "bigint":
      return formatBigInt(arg);
  }
}
function formatFunction(value) {
  return {
    type: "function",
    value: `function ${value.name}() {}`
  };
}
function formatUndefined() {
  return {
    type: "undefined"
  };
}
function formatBoolean(value) {
  return {
    type: "boolean",
    value: String(value)
  };
}
function formatNumber(value) {
  return {
    type: "number",
    value: String(value)
  };
}
function formatBigInt(value) {
  return {
    type: "bigint",
    value: String(value)
  };
}
function formatString(value) {
  return {
    type: "string",
    value
  };
}
function formatSymbol(value) {
  return {
    type: "symbol",
    value: value.description
  };
}
function formatObject(value, depth) {
  if (value === null) {
    return {
      type: "null"
    };
  }
  {
    if (isComponentPublicInstance(value)) {
      return formatComponentPublicInstance(value, depth);
    }
    if (isComponentInternalInstance(value)) {
      return formatComponentInternalInstance(value, depth);
    }
    if (isUniElement(value)) {
      return formatUniElement(value, depth);
    }
    if (isCSSStyleDeclaration(value)) {
      return formatCSSStyleDeclaration(value, depth);
    }
  }
  if (Array.isArray(value)) {
    return {
      type: "object",
      subType: "array",
      value: {
        properties: value.map((v, i) => formatArrayElement(v, i, depth + 1))
      }
    };
  }
  if (value instanceof Set) {
    return {
      type: "object",
      subType: "set",
      className: "Set",
      description: `Set(${value.size})`,
      value: {
        entries: Array.from(value).map((v) => formatSetEntry(v, depth + 1))
      }
    };
  }
  if (value instanceof Map) {
    return {
      type: "object",
      subType: "map",
      className: "Map",
      description: `Map(${value.size})`,
      value: {
        entries: Array.from(value.entries()).map((v) => formatMapEntry(v, depth + 1))
      }
    };
  }
  if (value instanceof Promise) {
    return {
      type: "object",
      subType: "promise",
      value: {
        properties: []
      }
    };
  }
  if (value instanceof RegExp) {
    return {
      type: "object",
      subType: "regexp",
      value: String(value),
      className: "Regexp"
    };
  }
  if (value instanceof Date) {
    return {
      type: "object",
      subType: "date",
      value: String(value),
      className: "Date"
    };
  }
  if (value instanceof Error) {
    return {
      type: "object",
      subType: "error",
      value: value.message || String(value),
      className: value.name || "Error"
    };
  }
  let className = void 0;
  {
    const constructor = value.constructor;
    if (constructor) {
      if (constructor.get$UTSMetadata$) {
        className = constructor.get$UTSMetadata$().name;
      }
    }
  }
  let entries = Object.entries(value);
  if (isHarmonyBuilderParams(value)) {
    entries = entries.filter(([key]) => key !== "modifier" && key !== "nodeContent");
  }
  return {
    type: "object",
    className,
    value: {
      properties: entries.map((entry) => formatObjectProperty(entry[0], entry[1], depth + 1))
    }
  };
}
function isHarmonyBuilderParams(value) {
  return value.modifier && value.modifier._attribute && value.nodeContent;
}
function isComponentPublicInstance(value) {
  return value.$ && isComponentInternalInstance(value.$);
}
function isComponentInternalInstance(value) {
  return value.type && value.uid != null && value.appContext;
}
function formatComponentPublicInstance(value, depth) {
  return {
    type: "object",
    className: "ComponentPublicInstance",
    value: {
      properties: Object.entries(value.$.type).map(([name, value2]) => formatObjectProperty(name, value2, depth + 1))
    }
  };
}
function formatComponentInternalInstance(value, depth) {
  return {
    type: "object",
    className: "ComponentInternalInstance",
    value: {
      properties: Object.entries(value.type).map(([name, value2]) => formatObjectProperty(name, value2, depth + 1))
    }
  };
}
function isUniElement(value) {
  return value.style && value.tagName != null && value.nodeName != null;
}
function formatUniElement(value, depth) {
  return {
    type: "object",
    // 非 x 没有 UniElement 的概念
    // className: 'UniElement',
    value: {
      properties: Object.entries(value).filter(([name]) => [
        "id",
        "tagName",
        "nodeName",
        "dataset",
        "offsetTop",
        "offsetLeft",
        "style"
      ].includes(name)).map(([name, value2]) => formatObjectProperty(name, value2, depth + 1))
    }
  };
}
function isCSSStyleDeclaration(value) {
  return typeof value.getPropertyValue === "function" && typeof value.setProperty === "function" && value.$styles;
}
function formatCSSStyleDeclaration(style, depth) {
  return {
    type: "object",
    value: {
      properties: Object.entries(style.$styles).map(([name, value]) => formatObjectProperty(name, value, depth + 1))
    }
  };
}
function formatObjectProperty(name, value, depth) {
  const result = formatArg(value, depth);
  result.name = name;
  return result;
}
function formatArrayElement(value, index2, depth) {
  const result = formatArg(value, depth);
  result.name = `${index2}`;
  return result;
}
function formatSetEntry(value, depth) {
  return {
    value: formatArg(value, depth)
  };
}
function formatMapEntry(value, depth) {
  return {
    key: formatArg(value[0], depth),
    value: formatArg(value[1], depth)
  };
}
let sendConsole = null;
const messageQueue = [];
const messageExtra = {};
const EXCEPTION_BEGIN_MARK = "---BEGIN:EXCEPTION---";
const EXCEPTION_END_MARK = "---END:EXCEPTION---";
function sendConsoleMessages(messages) {
  if (sendConsole == null) {
    messageQueue.push(...messages);
    return;
  }
  sendConsole(JSON.stringify(Object.assign({
    type: "console",
    data: messages
  }, messageExtra)));
}
function setSendConsole(value, extra = {}) {
  sendConsole = value;
  Object.assign(messageExtra, extra);
  if (value != null && messageQueue.length > 0) {
    const messages = messageQueue.slice();
    messageQueue.length = 0;
    sendConsoleMessages(messages);
  }
}
const atFileRegex = /^\s*at\s+[\w/./-]+:\d+$/;
function rewriteConsole() {
  function wrapConsole(type) {
    return function(...args) {
      {
        const originalArgs = [...args];
        if (originalArgs.length) {
          const maybeAtFile = originalArgs[originalArgs.length - 1];
          if (typeof maybeAtFile === "string" && atFileRegex.test(maybeAtFile)) {
            originalArgs.pop();
          }
        }
        originalConsole[type](...originalArgs);
      }
      if (type === "error" && args.length === 1) {
        const arg = args[0];
        if (typeof arg === "string" && arg.startsWith(EXCEPTION_BEGIN_MARK)) {
          const startIndex = EXCEPTION_BEGIN_MARK.length;
          const endIndex = arg.length - EXCEPTION_END_MARK.length;
          sendErrorMessages([arg.slice(startIndex, endIndex)]);
          return;
        } else if (arg instanceof Error) {
          sendErrorMessages([arg]);
          return;
        }
      }
      sendConsoleMessages([formatMessage(type, args)]);
    };
  }
  if (isConsoleWritable()) {
    CONSOLE_TYPES.forEach((type) => {
      console[type] = wrapConsole(type);
    });
    return function restoreConsole() {
      CONSOLE_TYPES.forEach((type) => {
        console[type] = originalConsole[type];
      });
    };
  } else {
    {
      if (typeof index !== "undefined" && index.__f__) {
        const oldLog = index.__f__;
        if (oldLog) {
          index.__f__ = function(...args) {
            const [type, filename, ...rest] = args;
            oldLog(type, "", ...rest);
            sendConsoleMessages([formatMessage(type, [...rest, filename])]);
          };
          return function restoreConsole() {
            index.__f__ = oldLog;
          };
        }
      }
    }
  }
  return function restoreConsole() {
  };
}
function isConsoleWritable() {
  const value = console.log;
  const sym = Symbol();
  try {
    console.log = sym;
  } catch (ex) {
    return false;
  }
  const isWritable = console.log === sym;
  console.log = value;
  return isWritable;
}
function initRuntimeSocketService() {
  const hosts = "192.168.56.1,192.168.1.17,127.0.0.1";
  const port = "8090";
  const id = "mp-weixin_LIJyR9";
  const lazy = typeof swan !== "undefined";
  let restoreError = lazy ? () => {
  } : initOnError();
  let restoreConsole = lazy ? () => {
  } : rewriteConsole();
  return Promise.resolve().then(() => {
    if (lazy) {
      restoreError = initOnError();
      restoreConsole = rewriteConsole();
    }
    return initRuntimeSocket(hosts, port, id).then((socket) => {
      if (!socket) {
        restoreError();
        restoreConsole();
        originalConsole.error(wrapError("开发模式下日志通道建立 socket 连接失败。"));
        {
          originalConsole.error(wrapError("小程序平台，请勾选不校验合法域名配置。"));
        }
        originalConsole.error(wrapError("如果是运行到真机，请确认手机与电脑处于同一网络。"));
        return false;
      }
      {
        initMiniProgramGlobalFlag();
      }
      socket.onClose(() => {
        {
          originalConsole.error(wrapError("开发模式下日志通道 socket 连接关闭，请在 HBuilderX 中重新运行。"));
        }
        restoreError();
        restoreConsole();
      });
      setSendConsole((data) => {
        socket.send({
          data
        });
      });
      setSendError((data) => {
        socket.send({
          data
        });
      });
      return true;
    });
  });
}
const ERROR_CHAR = "‌";
function wrapError(error) {
  return `${ERROR_CHAR}${error}${ERROR_CHAR}`;
}
function initMiniProgramGlobalFlag() {
  if (typeof wx$1 !== "undefined") {
    wx$1.__uni_console__ = true;
  } else if (typeof my !== "undefined") {
    my.__uni_console__ = true;
  } else if (typeof tt !== "undefined") {
    tt.__uni_console__ = true;
  } else if (typeof swan !== "undefined") {
    swan.__uni_console__ = true;
  } else if (typeof qq !== "undefined") {
    qq.__uni_console__ = true;
  } else if (typeof ks !== "undefined") {
    ks.__uni_console__ = true;
  } else if (typeof jd !== "undefined") {
    jd.__uni_console__ = true;
  } else if (typeof xhs !== "undefined") {
    xhs.__uni_console__ = true;
  } else if (typeof has !== "undefined") {
    has.__uni_console__ = true;
  } else if (typeof qa !== "undefined") {
    qa.__uni_console__ = true;
  }
}
initRuntimeSocketService();
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
function initVueIds(vueIds, mpInstance) {
  if (!vueIds) {
    return;
  }
  const ids = vueIds.split(",");
  const len = ids.length;
  if (len === 1) {
    mpInstance._$vueId = ids[0];
  } else if (len === 2) {
    mpInstance._$vueId = ids[0];
    mpInstance._$vuePid = ids[1];
  }
}
const EXTRAS = ["externalClasses"];
function initExtraOptions(miniProgramComponentOptions, vueOptions) {
  EXTRAS.forEach((name) => {
    if (hasOwn(vueOptions, name)) {
      miniProgramComponentOptions[name] = vueOptions[name];
    }
  });
}
const WORKLET_RE = /_(.*)_worklet_factory_/;
function initWorkletMethods(mpMethods, vueMethods) {
  if (vueMethods) {
    Object.keys(vueMethods).forEach((name) => {
      const matches = name.match(WORKLET_RE);
      if (matches) {
        const workletName = matches[1];
        mpMethods[name] = vueMethods[name];
        mpMethods[workletName] = vueMethods[workletName];
      }
    });
  }
}
function initWxsCallMethods(methods, wxsCallMethods) {
  if (!isArray(wxsCallMethods)) {
    return;
  }
  wxsCallMethods.forEach((callMethod) => {
    methods[callMethod] = function(args) {
      return this.$vm[callMethod](args);
    };
  });
}
function selectAllComponents(mpInstance, selector, $refs) {
  const components = mpInstance.selectAllComponents(selector);
  components.forEach((component) => {
    const ref2 = component.properties.uR;
    $refs[ref2] = component.$vm || component;
  });
}
function initRefs(instance, mpInstance) {
  Object.defineProperty(instance, "refs", {
    get() {
      const $refs = {};
      selectAllComponents(mpInstance, ".r", $refs);
      const forComponents = mpInstance.selectAllComponents(".r-i-f");
      forComponents.forEach((component) => {
        const ref2 = component.properties.uR;
        if (!ref2) {
          return;
        }
        if (!$refs[ref2]) {
          $refs[ref2] = [];
        }
        $refs[ref2].push(component.$vm || component);
      });
      return $refs;
    }
  });
}
function findVmByVueId(instance, vuePid) {
  const $children = instance.$children;
  for (let i = $children.length - 1; i >= 0; i--) {
    const childVm = $children[i];
    if (childVm.$scope._$vueId === vuePid) {
      return childVm;
    }
  }
  let parentVm;
  for (let i = $children.length - 1; i >= 0; i--) {
    parentVm = findVmByVueId($children[i], vuePid);
    if (parentVm) {
      return parentVm;
    }
  }
}
function getLocaleLanguage() {
  var _a;
  let localeLanguage = "";
  {
    const appBaseInfo = ((_a = wx.getAppBaseInfo) === null || _a === void 0 ? void 0 : _a.call(wx)) || wx.getSystemInfoSync();
    const language = appBaseInfo && appBaseInfo.language ? appBaseInfo.language : LOCALE_EN;
    localeLanguage = normalizeLocale(language) || LOCALE_EN;
  }
  return localeLanguage;
}
const MP_METHODS = [
  "createSelectorQuery",
  "createIntersectionObserver",
  "selectAllComponents",
  "selectComponent"
];
function createEmitFn(oldEmit, ctx) {
  return function emit2(event, ...args) {
    const scope = ctx.$scope;
    if (scope && event) {
      const detail = { __args__: args };
      {
        scope.triggerEvent(event, detail);
      }
    }
    return oldEmit.apply(this, [event, ...args]);
  };
}
function initBaseInstance(instance, options) {
  const ctx = instance.ctx;
  ctx.mpType = options.mpType;
  ctx.$mpType = options.mpType;
  ctx.$mpPlatform = "mp-weixin";
  ctx.$scope = options.mpInstance;
  {
    Object.defineProperties(ctx, {
      // only id
      [VIRTUAL_HOST_ID]: {
        get() {
          const id = this.$scope.data[VIRTUAL_HOST_ID];
          return id === void 0 ? "" : id;
        }
      }
    });
  }
  ctx.$mp = {};
  {
    ctx._self = {};
  }
  instance.slots = {};
  if (isArray(options.slots) && options.slots.length) {
    options.slots.forEach((name) => {
      instance.slots[name] = true;
    });
    if (instance.slots[SLOT_DEFAULT_NAME]) {
      instance.slots.default = true;
    }
  }
  ctx.getOpenerEventChannel = function() {
    {
      return options.mpInstance.getOpenerEventChannel();
    }
  };
  ctx.$hasHook = hasHook;
  ctx.$callHook = callHook;
  instance.emit = createEmitFn(instance.emit, ctx);
}
function initComponentInstance(instance, options) {
  initBaseInstance(instance, options);
  const ctx = instance.ctx;
  MP_METHODS.forEach((method) => {
    ctx[method] = function(...args) {
      const mpInstance = ctx.$scope;
      if (mpInstance && mpInstance[method]) {
        return mpInstance[method].apply(mpInstance, args);
      }
    };
  });
}
function initMocks(instance, mpInstance, mocks2) {
  const ctx = instance.ctx;
  mocks2.forEach((mock) => {
    if (hasOwn(mpInstance, mock)) {
      instance[mock] = ctx[mock] = mpInstance[mock];
    }
  });
}
function hasHook(name) {
  const hooks = this.$[name];
  if (hooks && hooks.length) {
    return true;
  }
  return false;
}
function callHook(name, args) {
  if (name === "mounted") {
    callHook.call(this, "bm");
    this.$.isMounted = true;
    name = "m";
  }
  const hooks = this.$[name];
  return hooks && invokeArrayFns(hooks, args);
}
const PAGE_INIT_HOOKS = [
  ON_LOAD,
  ON_SHOW,
  ON_HIDE,
  ON_UNLOAD,
  ON_RESIZE,
  ON_TAB_ITEM_TAP,
  ON_REACH_BOTTOM,
  ON_PULL_DOWN_REFRESH,
  ON_ADD_TO_FAVORITES
  // 'onReady', // lifetimes.ready
  // 'onPageScroll', // 影响性能，开发者手动注册
  // 'onShareTimeline', // 右上角菜单，开发者手动注册
  // 'onShareAppMessage' // 右上角菜单，开发者手动注册
];
function findHooks(vueOptions, hooks = /* @__PURE__ */ new Set()) {
  if (vueOptions) {
    Object.keys(vueOptions).forEach((name) => {
      if (isUniLifecycleHook(name, vueOptions[name])) {
        hooks.add(name);
      }
    });
    {
      const { extends: extendsOptions, mixins } = vueOptions;
      if (mixins) {
        mixins.forEach((mixin) => findHooks(mixin, hooks));
      }
      if (extendsOptions) {
        findHooks(extendsOptions, hooks);
      }
    }
  }
  return hooks;
}
function initHook(mpOptions, hook, excludes) {
  if (excludes.indexOf(hook) === -1 && !hasOwn(mpOptions, hook)) {
    mpOptions[hook] = function(args) {
      return this.$vm && this.$vm.$callHook(hook, args);
    };
  }
}
const EXCLUDE_HOOKS = [ON_READY];
function initHooks(mpOptions, hooks, excludes = EXCLUDE_HOOKS) {
  hooks.forEach((hook) => initHook(mpOptions, hook, excludes));
}
function initUnknownHooks(mpOptions, vueOptions, excludes = EXCLUDE_HOOKS) {
  findHooks(vueOptions).forEach((hook) => initHook(mpOptions, hook, excludes));
}
function initRuntimeHooks(mpOptions, runtimeHooks) {
  if (!runtimeHooks) {
    return;
  }
  const hooks = Object.keys(MINI_PROGRAM_PAGE_RUNTIME_HOOKS);
  hooks.forEach((hook) => {
    if (runtimeHooks & MINI_PROGRAM_PAGE_RUNTIME_HOOKS[hook]) {
      initHook(mpOptions, hook, []);
    }
  });
}
const findMixinRuntimeHooks = /* @__PURE__ */ once(() => {
  const runtimeHooks = [];
  const app = isFunction(getApp) && getApp({ allowDefault: true });
  if (app && app.$vm && app.$vm.$) {
    const mixins = app.$vm.$.appContext.mixins;
    if (isArray(mixins)) {
      const hooks = Object.keys(MINI_PROGRAM_PAGE_RUNTIME_HOOKS);
      mixins.forEach((mixin) => {
        hooks.forEach((hook) => {
          if (hasOwn(mixin, hook) && !runtimeHooks.includes(hook)) {
            runtimeHooks.push(hook);
          }
        });
      });
    }
  }
  return runtimeHooks;
});
function initMixinRuntimeHooks(mpOptions) {
  initHooks(mpOptions, findMixinRuntimeHooks());
}
const HOOKS = [
  ON_SHOW,
  ON_HIDE,
  ON_ERROR,
  ON_THEME_CHANGE,
  ON_PAGE_NOT_FOUND,
  ON_UNHANDLE_REJECTION
];
function parseApp(instance, parseAppOptions) {
  const internalInstance = instance.$;
  const appOptions = {
    globalData: instance.$options && instance.$options.globalData || {},
    $vm: instance,
    // mp-alipay 组件 data 初始化比 onLaunch 早，提前挂载
    onLaunch(options) {
      this.$vm = instance;
      const ctx = internalInstance.ctx;
      if (this.$vm && ctx.$scope && ctx.$callHook) {
        return;
      }
      initBaseInstance(internalInstance, {
        mpType: "app",
        mpInstance: this,
        slots: []
      });
      ctx.globalData = this.globalData;
      instance.$callHook(ON_LAUNCH, options);
    }
  };
  const onErrorHandlers = wx.$onErrorHandlers;
  if (onErrorHandlers) {
    onErrorHandlers.forEach((fn) => {
      injectHook(ON_ERROR, fn, internalInstance);
    });
    onErrorHandlers.length = 0;
  }
  initLocale(instance);
  const vueOptions = instance.$.type;
  initHooks(appOptions, HOOKS);
  initUnknownHooks(appOptions, vueOptions);
  {
    const methods = vueOptions.methods;
    methods && extend(appOptions, methods);
  }
  return appOptions;
}
function initCreateApp(parseAppOptions) {
  return function createApp2(vm) {
    return App(parseApp(vm));
  };
}
function initCreateSubpackageApp(parseAppOptions) {
  return function createApp2(vm) {
    const appOptions = parseApp(vm);
    const app = isFunction(getApp) && getApp({
      allowDefault: true
    });
    if (!app)
      return;
    vm.$.ctx.$scope = app;
    const globalData = app.globalData;
    if (globalData) {
      Object.keys(appOptions.globalData).forEach((name) => {
        if (!hasOwn(globalData, name)) {
          globalData[name] = appOptions.globalData[name];
        }
      });
    }
    Object.keys(appOptions).forEach((name) => {
      if (!hasOwn(app, name)) {
        app[name] = appOptions[name];
      }
    });
    initAppLifecycle(appOptions, vm);
  };
}
function initAppLifecycle(appOptions, vm) {
  if (isFunction(appOptions.onLaunch)) {
    const args = wx.getLaunchOptionsSync && wx.getLaunchOptionsSync();
    appOptions.onLaunch(args);
  }
  if (isFunction(appOptions.onShow) && wx.onAppShow) {
    wx.onAppShow((args) => {
      vm.$callHook("onShow", args);
    });
  }
  if (isFunction(appOptions.onHide) && wx.onAppHide) {
    wx.onAppHide((args) => {
      vm.$callHook("onHide", args);
    });
  }
}
function initLocale(appVm) {
  const locale = ref(getLocaleLanguage());
  Object.defineProperty(appVm, "$locale", {
    get() {
      return locale.value;
    },
    set(v) {
      locale.value = v;
    }
  });
}
const builtInProps = [
  // 百度小程序,快手小程序自定义组件不支持绑定动态事件，动态dataset，故通过props传递事件信息
  // event-opts
  "eO",
  // 组件 ref
  "uR",
  // 组件 ref-in-for
  "uRIF",
  // 组件 id
  "uI",
  // 组件类型 m: 小程序组件
  "uT",
  // 组件 props
  "uP",
  // 小程序不能直接定义 $slots 的 props，所以通过 vueSlots 转换到 $slots
  "uS"
];
function initDefaultProps(options, isBehavior = false) {
  const properties = {};
  if (!isBehavior) {
    let observerSlots = function(newVal) {
      const $slots = /* @__PURE__ */ Object.create(null);
      newVal && newVal.forEach((slotName) => {
        $slots[slotName] = true;
      });
      this.setData({
        $slots
      });
    };
    builtInProps.forEach((name) => {
      properties[name] = {
        type: null,
        value: ""
      };
    });
    properties.uS = {
      type: null,
      value: []
    };
    {
      properties.uS.observer = observerSlots;
    }
  }
  if (options.behaviors) {
    if (options.behaviors.includes("wx://form-field")) {
      if (!options.properties || !options.properties.name) {
        properties.name = {
          type: null,
          value: ""
        };
      }
      if (!options.properties || !options.properties.value) {
        properties.value = {
          type: null,
          value: ""
        };
      }
    }
  }
  return properties;
}
function initVirtualHostProps(options) {
  const properties = {};
  {
    if (options && options.virtualHost) {
      properties[VIRTUAL_HOST_STYLE] = {
        type: null,
        value: ""
      };
      properties[VIRTUAL_HOST_CLASS] = {
        type: null,
        value: ""
      };
      properties[VIRTUAL_HOST_HIDDEN] = {
        type: null,
        value: ""
      };
      properties[VIRTUAL_HOST_ID] = {
        type: null,
        value: ""
      };
    }
  }
  return properties;
}
function initProps(mpComponentOptions) {
  if (!mpComponentOptions.properties) {
    mpComponentOptions.properties = {};
  }
  extend(mpComponentOptions.properties, initDefaultProps(mpComponentOptions), initVirtualHostProps(mpComponentOptions.options));
}
const PROP_TYPES = [String, Number, Boolean, Object, Array, null];
function parsePropType(type, defaultValue) {
  if (isArray(type) && type.length === 1) {
    return type[0];
  }
  return type;
}
function normalizePropType(type, defaultValue) {
  const res = parsePropType(type);
  return PROP_TYPES.indexOf(res) !== -1 ? res : null;
}
function initPageProps({ properties }, rawProps) {
  if (isArray(rawProps)) {
    rawProps.forEach((key) => {
      properties[key] = {
        type: String,
        value: ""
      };
    });
  } else if (isPlainObject(rawProps)) {
    Object.keys(rawProps).forEach((key) => {
      const opts = rawProps[key];
      if (isPlainObject(opts)) {
        let value = opts.default;
        if (isFunction(value)) {
          value = value();
        }
        const type = opts.type;
        opts.type = normalizePropType(type);
        properties[key] = {
          type: opts.type,
          value
        };
      } else {
        properties[key] = {
          type: normalizePropType(opts)
        };
      }
    });
  }
}
function findPropsData(properties, isPage2) {
  return (isPage2 ? findPagePropsData(properties) : findComponentPropsData(resolvePropValue(properties.uP))) || {};
}
function findPagePropsData(properties) {
  const propsData = {};
  if (isPlainObject(properties)) {
    Object.keys(properties).forEach((name) => {
      if (builtInProps.indexOf(name) === -1) {
        propsData[name] = resolvePropValue(properties[name]);
      }
    });
  }
  return propsData;
}
function initFormField(vm) {
  const vueOptions = vm.$options;
  if (isArray(vueOptions.behaviors) && vueOptions.behaviors.includes("uni://form-field")) {
    vm.$watch("modelValue", () => {
      vm.$scope && vm.$scope.setData({
        name: vm.name,
        value: vm.modelValue
      });
    }, {
      immediate: true
    });
  }
}
function resolvePropValue(prop) {
  return prop;
}
function initData(_) {
  return {};
}
function initPropsObserver(componentOptions) {
  const observe = function observe2() {
    const up = this.properties.uP;
    if (!up) {
      return;
    }
    if (this.$vm) {
      updateComponentProps(resolvePropValue(up), this.$vm.$);
    } else if (resolvePropValue(this.properties.uT) === "m") {
      updateMiniProgramComponentProperties(resolvePropValue(up), this);
    }
  };
  {
    if (!componentOptions.observers) {
      componentOptions.observers = {};
    }
    componentOptions.observers.uP = observe;
  }
}
function updateMiniProgramComponentProperties(up, mpInstance) {
  const prevProps = mpInstance.properties;
  const nextProps = findComponentPropsData(up) || {};
  if (hasPropsChanged(prevProps, nextProps, false)) {
    mpInstance.setData(nextProps);
  }
}
function updateComponentProps(up, instance) {
  const prevProps = toRaw(instance.props);
  const nextProps = findComponentPropsData(up) || {};
  if (hasPropsChanged(prevProps, nextProps)) {
    updateProps(instance, nextProps, prevProps, false);
    if (hasQueueJob(instance.update)) {
      invalidateJob(instance.update);
    }
    {
      instance.update();
    }
  }
}
function hasPropsChanged(prevProps, nextProps, checkLen = true) {
  const nextKeys = Object.keys(nextProps);
  if (checkLen && nextKeys.length !== Object.keys(prevProps).length) {
    return true;
  }
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    if (nextProps[key] !== prevProps[key]) {
      return true;
    }
  }
  return false;
}
function initBehaviors(vueOptions) {
  const vueBehaviors = vueOptions.behaviors;
  let vueProps = vueOptions.props;
  if (!vueProps) {
    vueOptions.props = vueProps = [];
  }
  const behaviors = [];
  if (isArray(vueBehaviors)) {
    vueBehaviors.forEach((behavior) => {
      behaviors.push(behavior.replace("uni://", "wx://"));
      if (behavior === "uni://form-field") {
        if (isArray(vueProps)) {
          vueProps.push("name");
          vueProps.push("modelValue");
        } else {
          vueProps.name = {
            type: String,
            default: ""
          };
          vueProps.modelValue = {
            type: [String, Number, Boolean, Array, Object, Date],
            default: ""
          };
        }
      }
    });
  }
  return behaviors;
}
function applyOptions(componentOptions, vueOptions) {
  componentOptions.data = initData();
  componentOptions.behaviors = initBehaviors(vueOptions);
}
function parseComponent(vueOptions, { parse, mocks: mocks2, isPage: isPage2, isPageInProject, initRelation: initRelation2, handleLink: handleLink2, initLifetimes: initLifetimes2 }) {
  vueOptions = vueOptions.default || vueOptions;
  const options = {
    multipleSlots: true,
    // styleIsolation: 'apply-shared',
    addGlobalClass: true,
    pureDataPattern: /^uP$/
  };
  if (isArray(vueOptions.mixins)) {
    vueOptions.mixins.forEach((item) => {
      if (isObject(item.options)) {
        extend(options, item.options);
      }
    });
  }
  if (vueOptions.options) {
    extend(options, vueOptions.options);
  }
  const mpComponentOptions = {
    options,
    lifetimes: initLifetimes2({ mocks: mocks2, isPage: isPage2, initRelation: initRelation2, vueOptions }),
    pageLifetimes: {
      show() {
        this.$vm && this.$vm.$callHook("onPageShow");
      },
      hide() {
        this.$vm && this.$vm.$callHook("onPageHide");
      },
      resize(size2) {
        this.$vm && this.$vm.$callHook("onPageResize", size2);
      }
    },
    methods: {
      __l: handleLink2
    }
  };
  {
    applyOptions(mpComponentOptions, vueOptions);
  }
  initProps(mpComponentOptions);
  initPropsObserver(mpComponentOptions);
  initExtraOptions(mpComponentOptions, vueOptions);
  initWxsCallMethods(mpComponentOptions.methods, vueOptions.wxsCallMethods);
  {
    initWorkletMethods(mpComponentOptions.methods, vueOptions.methods);
  }
  if (parse) {
    parse(mpComponentOptions, { handleLink: handleLink2 });
  }
  return mpComponentOptions;
}
function initCreateComponent(parseOptions2) {
  return function createComponent2(vueComponentOptions) {
    return Component(parseComponent(vueComponentOptions, parseOptions2));
  };
}
let $createComponentFn;
let $destroyComponentFn;
function getAppVm() {
  return getApp().$vm;
}
function $createComponent(initialVNode, options) {
  if (!$createComponentFn) {
    $createComponentFn = getAppVm().$createComponent;
  }
  const proxy = $createComponentFn(initialVNode, options);
  return getExposeProxy(proxy.$) || proxy;
}
function $destroyComponent(instance) {
  if (!$destroyComponentFn) {
    $destroyComponentFn = getAppVm().$destroyComponent;
  }
  return $destroyComponentFn(instance);
}
function parsePage(vueOptions, parseOptions2) {
  const { parse, mocks: mocks2, isPage: isPage2, initRelation: initRelation2, handleLink: handleLink2, initLifetimes: initLifetimes2 } = parseOptions2;
  const miniProgramPageOptions = parseComponent(vueOptions, {
    mocks: mocks2,
    isPage: isPage2,
    isPageInProject: true,
    initRelation: initRelation2,
    handleLink: handleLink2,
    initLifetimes: initLifetimes2
  });
  initPageProps(miniProgramPageOptions, (vueOptions.default || vueOptions).props);
  const methods = miniProgramPageOptions.methods;
  methods.onLoad = function(query) {
    {
      this.options = query;
    }
    this.$page = {
      fullPath: addLeadingSlash(this.route + stringifyQuery(query))
    };
    return this.$vm && this.$vm.$callHook(ON_LOAD, query);
  };
  initHooks(methods, PAGE_INIT_HOOKS);
  {
    initUnknownHooks(methods, vueOptions);
  }
  initRuntimeHooks(methods, vueOptions.__runtimeHooks);
  initMixinRuntimeHooks(methods);
  parse && parse(miniProgramPageOptions, { handleLink: handleLink2 });
  return miniProgramPageOptions;
}
function initCreatePage(parseOptions2) {
  return function createPage2(vuePageOptions) {
    return Component(parsePage(vuePageOptions, parseOptions2));
  };
}
function initCreatePluginApp(parseAppOptions) {
  return function createApp2(vm) {
    initAppLifecycle(parseApp(vm), vm);
  };
}
const MPPage = Page;
const MPComponent = Component;
function initTriggerEvent(mpInstance) {
  const oldTriggerEvent = mpInstance.triggerEvent;
  const newTriggerEvent = function(event, ...args) {
    return oldTriggerEvent.apply(mpInstance, [
      customizeEvent(event),
      ...args
    ]);
  };
  try {
    mpInstance.triggerEvent = newTriggerEvent;
  } catch (error) {
    mpInstance._triggerEvent = newTriggerEvent;
  }
}
function initMiniProgramHook(name, options, isComponent) {
  const oldHook = options[name];
  if (!oldHook) {
    options[name] = function() {
      initTriggerEvent(this);
    };
  } else {
    options[name] = function(...args) {
      initTriggerEvent(this);
      return oldHook.apply(this, args);
    };
  }
}
Page = function(options) {
  initMiniProgramHook(ON_LOAD, options);
  return MPPage(options);
};
Component = function(options) {
  initMiniProgramHook("created", options);
  const isVueComponent = options.properties && options.properties.uP;
  if (!isVueComponent) {
    initProps(options);
    initPropsObserver(options);
  }
  return MPComponent(options);
};
function initLifetimes({ mocks: mocks2, isPage: isPage2, initRelation: initRelation2, vueOptions }) {
  return {
    attached() {
      let properties = this.properties;
      initVueIds(properties.uI, this);
      const relationOptions = {
        vuePid: this._$vuePid
      };
      initRelation2(this, relationOptions);
      const mpInstance = this;
      const isMiniProgramPage = isPage2(mpInstance);
      let propsData = properties;
      this.$vm = $createComponent({
        type: vueOptions,
        props: findPropsData(propsData, isMiniProgramPage)
      }, {
        mpType: isMiniProgramPage ? "page" : "component",
        mpInstance,
        slots: properties.uS || {},
        // vueSlots
        parentComponent: relationOptions.parent && relationOptions.parent.$,
        onBeforeSetup(instance, options) {
          initRefs(instance, mpInstance);
          initMocks(instance, mpInstance, mocks2);
          initComponentInstance(instance, options);
        }
      });
      if (!isMiniProgramPage) {
        initFormField(this.$vm);
      }
    },
    ready() {
      if (this.$vm) {
        {
          this.$vm.$callHook("mounted");
          this.$vm.$callHook(ON_READY);
        }
      }
    },
    detached() {
      if (this.$vm) {
        pruneComponentPropsCache(this.$vm.$.uid);
        $destroyComponent(this.$vm);
      }
    }
  };
}
const mocks = ["__route__", "__wxExparserNodeId__", "__wxWebviewId__"];
function isPage(mpInstance) {
  return !!mpInstance.route;
}
function initRelation(mpInstance, detail) {
  mpInstance.triggerEvent("__l", detail);
}
function handleLink(event) {
  const detail = event.detail || event.value;
  const vuePid = detail.vuePid;
  let parentVm;
  if (vuePid) {
    parentVm = findVmByVueId(this.$vm, vuePid);
  }
  if (!parentVm) {
    parentVm = this.$vm;
  }
  detail.parent = parentVm;
}
var parseOptions = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  handleLink,
  initLifetimes,
  initRelation,
  isPage,
  mocks
});
const createApp = initCreateApp();
const createPage = initCreatePage(parseOptions);
const createComponent = initCreateComponent(parseOptions);
const createPluginApp = initCreatePluginApp();
const createSubpackageApp = initCreateSubpackageApp();
{
  wx.createApp = global.createApp = createApp;
  wx.createPage = createPage;
  wx.createComponent = createComponent;
  wx.createPluginApp = global.createPluginApp = createPluginApp;
  wx.createSubpackageApp = global.createSubpackageApp = createSubpackageApp;
}
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var gtpushMin = { exports: {} };
/*! For license information please see gtpush-min.js.LICENSE.txt */
(function(module2, exports2) {
  (function t2(e, r) {
    module2.exports = r();
  })(self, () => (() => {
    var t2 = { 4736: (t22, e2, r2) => {
      t22 = r2.nmd(t22);
      var i2;
      var n = function(t3) {
        var e3 = 1e7, r3 = 7, i3 = 9007199254740992, s = d(i3), a = "0123456789abcdefghijklmnopqrstuvwxyz";
        var o2 = "function" === typeof BigInt;
        function u(t4, e4, r4, i4) {
          if ("undefined" === typeof t4)
            return u[0];
          if ("undefined" !== typeof e4)
            return 10 === +e4 && !r4 ? st(t4) : X(t4, e4, r4, i4);
          return st(t4);
        }
        function c(t4, e4) {
          this.value = t4;
          this.sign = e4;
          this.isSmall = false;
        }
        c.prototype = Object.create(u.prototype);
        function l(t4) {
          this.value = t4;
          this.sign = t4 < 0;
          this.isSmall = true;
        }
        l.prototype = Object.create(u.prototype);
        function f2(t4) {
          this.value = t4;
        }
        f2.prototype = Object.create(u.prototype);
        function h(t4) {
          return -i3 < t4 && t4 < i3;
        }
        function d(t4) {
          if (t4 < 1e7)
            return [t4];
          if (t4 < 1e14)
            return [t4 % 1e7, Math.floor(t4 / 1e7)];
          return [t4 % 1e7, Math.floor(t4 / 1e7) % 1e7, Math.floor(t4 / 1e14)];
        }
        function v(t4) {
          p(t4);
          var r4 = t4.length;
          if (r4 < 4 && N(t4, s) < 0)
            switch (r4) {
              case 0:
                return 0;
              case 1:
                return t4[0];
              case 2:
                return t4[0] + t4[1] * e3;
              default:
                return t4[0] + (t4[1] + t4[2] * e3) * e3;
            }
          return t4;
        }
        function p(t4) {
          var e4 = t4.length;
          while (0 === t4[--e4])
            ;
          t4.length = e4 + 1;
        }
        function g(t4) {
          var e4 = new Array(t4);
          var r4 = -1;
          while (++r4 < t4)
            e4[r4] = 0;
          return e4;
        }
        function y(t4) {
          if (t4 > 0)
            return Math.floor(t4);
          return Math.ceil(t4);
        }
        function m(t4, r4) {
          var i4 = t4.length, n2 = r4.length, s2 = new Array(i4), a2 = 0, o22 = e3, u2, c2;
          for (c2 = 0; c2 < n2; c2++) {
            u2 = t4[c2] + r4[c2] + a2;
            a2 = u2 >= o22 ? 1 : 0;
            s2[c2] = u2 - a2 * o22;
          }
          while (c2 < i4) {
            u2 = t4[c2] + a2;
            a2 = u2 === o22 ? 1 : 0;
            s2[c2++] = u2 - a2 * o22;
          }
          if (a2 > 0)
            s2.push(a2);
          return s2;
        }
        function w(t4, e4) {
          if (t4.length >= e4.length)
            return m(t4, e4);
          return m(e4, t4);
        }
        function S(t4, r4) {
          var i4 = t4.length, n2 = new Array(i4), s2 = e3, a2, o22;
          for (o22 = 0; o22 < i4; o22++) {
            a2 = t4[o22] - s2 + r4;
            r4 = Math.floor(a2 / s2);
            n2[o22] = a2 - r4 * s2;
            r4 += 1;
          }
          while (r4 > 0) {
            n2[o22++] = r4 % s2;
            r4 = Math.floor(r4 / s2);
          }
          return n2;
        }
        c.prototype.add = function(t4) {
          var e4 = st(t4);
          if (this.sign !== e4.sign)
            return this.subtract(e4.negate());
          var r4 = this.value, i4 = e4.value;
          if (e4.isSmall)
            return new c(S(r4, Math.abs(i4)), this.sign);
          return new c(w(r4, i4), this.sign);
        };
        c.prototype.plus = c.prototype.add;
        l.prototype.add = function(t4) {
          var e4 = st(t4);
          var r4 = this.value;
          if (r4 < 0 !== e4.sign)
            return this.subtract(e4.negate());
          var i4 = e4.value;
          if (e4.isSmall) {
            if (h(r4 + i4))
              return new l(r4 + i4);
            i4 = d(Math.abs(i4));
          }
          return new c(S(i4, Math.abs(r4)), r4 < 0);
        };
        l.prototype.plus = l.prototype.add;
        f2.prototype.add = function(t4) {
          return new f2(this.value + st(t4).value);
        };
        f2.prototype.plus = f2.prototype.add;
        function _(t4, r4) {
          var i4 = t4.length, n2 = r4.length, s2 = new Array(i4), a2 = 0, o22 = e3, u2, c2;
          for (u2 = 0; u2 < n2; u2++) {
            c2 = t4[u2] - a2 - r4[u2];
            if (c2 < 0) {
              c2 += o22;
              a2 = 1;
            } else
              a2 = 0;
            s2[u2] = c2;
          }
          for (u2 = n2; u2 < i4; u2++) {
            c2 = t4[u2] - a2;
            if (c2 < 0)
              c2 += o22;
            else {
              s2[u2++] = c2;
              break;
            }
            s2[u2] = c2;
          }
          for (; u2 < i4; u2++)
            s2[u2] = t4[u2];
          p(s2);
          return s2;
        }
        function b(t4, e4, r4) {
          var i4;
          if (N(t4, e4) >= 0)
            i4 = _(t4, e4);
          else {
            i4 = _(e4, t4);
            r4 = !r4;
          }
          i4 = v(i4);
          if ("number" === typeof i4) {
            if (r4)
              i4 = -i4;
            return new l(i4);
          }
          return new c(i4, r4);
        }
        function E2(t4, r4, i4) {
          var n2 = t4.length, s2 = new Array(n2), a2 = -r4, o22 = e3, u2, f22;
          for (u2 = 0; u2 < n2; u2++) {
            f22 = t4[u2] + a2;
            a2 = Math.floor(f22 / o22);
            f22 %= o22;
            s2[u2] = f22 < 0 ? f22 + o22 : f22;
          }
          s2 = v(s2);
          if ("number" === typeof s2) {
            if (i4)
              s2 = -s2;
            return new l(s2);
          }
          return new c(s2, i4);
        }
        c.prototype.subtract = function(t4) {
          var e4 = st(t4);
          if (this.sign !== e4.sign)
            return this.add(e4.negate());
          var r4 = this.value, i4 = e4.value;
          if (e4.isSmall)
            return E2(r4, Math.abs(i4), this.sign);
          return b(r4, i4, this.sign);
        };
        c.prototype.minus = c.prototype.subtract;
        l.prototype.subtract = function(t4) {
          var e4 = st(t4);
          var r4 = this.value;
          if (r4 < 0 !== e4.sign)
            return this.add(e4.negate());
          var i4 = e4.value;
          if (e4.isSmall)
            return new l(r4 - i4);
          return E2(i4, Math.abs(r4), r4 >= 0);
        };
        l.prototype.minus = l.prototype.subtract;
        f2.prototype.subtract = function(t4) {
          return new f2(this.value - st(t4).value);
        };
        f2.prototype.minus = f2.prototype.subtract;
        c.prototype.negate = function() {
          return new c(this.value, !this.sign);
        };
        l.prototype.negate = function() {
          var t4 = this.sign;
          var e4 = new l(-this.value);
          e4.sign = !t4;
          return e4;
        };
        f2.prototype.negate = function() {
          return new f2(-this.value);
        };
        c.prototype.abs = function() {
          return new c(this.value, false);
        };
        l.prototype.abs = function() {
          return new l(Math.abs(this.value));
        };
        f2.prototype.abs = function() {
          return new f2(this.value >= 0 ? this.value : -this.value);
        };
        function D(t4, r4) {
          var i4 = t4.length, n2 = r4.length, s2 = i4 + n2, a2 = g(s2), o22 = e3, u2, c2, l2, f22, h2;
          for (l2 = 0; l2 < i4; ++l2) {
            f22 = t4[l2];
            for (var d2 = 0; d2 < n2; ++d2) {
              h2 = r4[d2];
              u2 = f22 * h2 + a2[l2 + d2];
              c2 = Math.floor(u2 / o22);
              a2[l2 + d2] = u2 - c2 * o22;
              a2[l2 + d2 + 1] += c2;
            }
          }
          p(a2);
          return a2;
        }
        function M(t4, r4) {
          var i4 = t4.length, n2 = new Array(i4), s2 = e3, a2 = 0, o22, u2;
          for (u2 = 0; u2 < i4; u2++) {
            o22 = t4[u2] * r4 + a2;
            a2 = Math.floor(o22 / s2);
            n2[u2] = o22 - a2 * s2;
          }
          while (a2 > 0) {
            n2[u2++] = a2 % s2;
            a2 = Math.floor(a2 / s2);
          }
          return n2;
        }
        function T(t4, e4) {
          var r4 = [];
          while (e4-- > 0)
            r4.push(0);
          return r4.concat(t4);
        }
        function I(t4, e4) {
          var r4 = Math.max(t4.length, e4.length);
          if (r4 <= 30)
            return D(t4, e4);
          r4 = Math.ceil(r4 / 2);
          var i4 = t4.slice(r4), n2 = t4.slice(0, r4), s2 = e4.slice(r4), a2 = e4.slice(0, r4);
          var o22 = I(n2, a2), u2 = I(i4, s2), c2 = I(w(n2, i4), w(a2, s2));
          var l2 = w(w(o22, T(_(_(c2, o22), u2), r4)), T(u2, 2 * r4));
          p(l2);
          return l2;
        }
        function A(t4, e4) {
          return -0.012 * t4 - 0.012 * e4 + 15e-6 * t4 * e4 > 0;
        }
        c.prototype.multiply = function(t4) {
          var r4 = st(t4), i4 = this.value, n2 = r4.value, s2 = this.sign !== r4.sign, a2;
          if (r4.isSmall) {
            if (0 === n2)
              return u[0];
            if (1 === n2)
              return this;
            if (-1 === n2)
              return this.negate();
            a2 = Math.abs(n2);
            if (a2 < e3)
              return new c(M(i4, a2), s2);
            n2 = d(a2);
          }
          if (A(i4.length, n2.length))
            return new c(I(i4, n2), s2);
          return new c(D(i4, n2), s2);
        };
        c.prototype.times = c.prototype.multiply;
        function x(t4, r4, i4) {
          if (t4 < e3)
            return new c(M(r4, t4), i4);
          return new c(D(r4, d(t4)), i4);
        }
        l.prototype._multiplyBySmall = function(t4) {
          if (h(t4.value * this.value))
            return new l(t4.value * this.value);
          return x(Math.abs(t4.value), d(Math.abs(this.value)), this.sign !== t4.sign);
        };
        c.prototype._multiplyBySmall = function(t4) {
          if (0 === t4.value)
            return u[0];
          if (1 === t4.value)
            return this;
          if (-1 === t4.value)
            return this.negate();
          return x(Math.abs(t4.value), this.value, this.sign !== t4.sign);
        };
        l.prototype.multiply = function(t4) {
          return st(t4)._multiplyBySmall(this);
        };
        l.prototype.times = l.prototype.multiply;
        f2.prototype.multiply = function(t4) {
          return new f2(this.value * st(t4).value);
        };
        f2.prototype.times = f2.prototype.multiply;
        function R(t4) {
          var r4 = t4.length, i4 = g(r4 + r4), n2 = e3, s2, a2, o22, u2, c2;
          for (o22 = 0; o22 < r4; o22++) {
            u2 = t4[o22];
            a2 = 0 - u2 * u2;
            for (var l2 = o22; l2 < r4; l2++) {
              c2 = t4[l2];
              s2 = 2 * (u2 * c2) + i4[o22 + l2] + a2;
              a2 = Math.floor(s2 / n2);
              i4[o22 + l2] = s2 - a2 * n2;
            }
            i4[o22 + r4] = a2;
          }
          p(i4);
          return i4;
        }
        c.prototype.square = function() {
          return new c(R(this.value), false);
        };
        l.prototype.square = function() {
          var t4 = this.value * this.value;
          if (h(t4))
            return new l(t4);
          return new c(R(d(Math.abs(this.value))), false);
        };
        f2.prototype.square = function(t4) {
          return new f2(this.value * this.value);
        };
        function B(t4, r4) {
          var i4 = t4.length, n2 = r4.length, s2 = e3, a2 = g(r4.length), o22 = r4[n2 - 1], u2 = Math.ceil(s2 / (2 * o22)), c2 = M(t4, u2), l2 = M(r4, u2), f22, h2, d2, p2, y2, m2, w2;
          if (c2.length <= i4)
            c2.push(0);
          l2.push(0);
          o22 = l2[n2 - 1];
          for (h2 = i4 - n2; h2 >= 0; h2--) {
            f22 = s2 - 1;
            if (c2[h2 + n2] !== o22)
              f22 = Math.floor((c2[h2 + n2] * s2 + c2[h2 + n2 - 1]) / o22);
            d2 = 0;
            p2 = 0;
            m2 = l2.length;
            for (y2 = 0; y2 < m2; y2++) {
              d2 += f22 * l2[y2];
              w2 = Math.floor(d2 / s2);
              p2 += c2[h2 + y2] - (d2 - w2 * s2);
              d2 = w2;
              if (p2 < 0) {
                c2[h2 + y2] = p2 + s2;
                p2 = -1;
              } else {
                c2[h2 + y2] = p2;
                p2 = 0;
              }
            }
            while (0 !== p2) {
              f22 -= 1;
              d2 = 0;
              for (y2 = 0; y2 < m2; y2++) {
                d2 += c2[h2 + y2] - s2 + l2[y2];
                if (d2 < 0) {
                  c2[h2 + y2] = d2 + s2;
                  d2 = 0;
                } else {
                  c2[h2 + y2] = d2;
                  d2 = 1;
                }
              }
              p2 += d2;
            }
            a2[h2] = f22;
          }
          c2 = k(c2, u2)[0];
          return [v(a2), v(c2)];
        }
        function O(t4, r4) {
          var i4 = t4.length, n2 = r4.length, s2 = [], a2 = [], o22 = e3, u2, c2, l2, f22, h2;
          while (i4) {
            a2.unshift(t4[--i4]);
            p(a2);
            if (N(a2, r4) < 0) {
              s2.push(0);
              continue;
            }
            c2 = a2.length;
            l2 = a2[c2 - 1] * o22 + a2[c2 - 2];
            f22 = r4[n2 - 1] * o22 + r4[n2 - 2];
            if (c2 > n2)
              l2 = (l2 + 1) * o22;
            u2 = Math.ceil(l2 / f22);
            do {
              h2 = M(r4, u2);
              if (N(h2, a2) <= 0)
                break;
              u2--;
            } while (u2);
            s2.push(u2);
            a2 = _(a2, h2);
          }
          s2.reverse();
          return [v(s2), v(a2)];
        }
        function k(t4, r4) {
          var i4 = t4.length, n2 = g(i4), s2 = e3, a2, o22, u2, c2;
          u2 = 0;
          for (a2 = i4 - 1; a2 >= 0; --a2) {
            c2 = u2 * s2 + t4[a2];
            o22 = y(c2 / r4);
            u2 = c2 - o22 * r4;
            n2[a2] = 0 | o22;
          }
          return [n2, 0 | u2];
        }
        function C(t4, r4) {
          var i4, n2 = st(r4);
          if (o2)
            return [new f2(t4.value / n2.value), new f2(t4.value % n2.value)];
          var s2 = t4.value, a2 = n2.value;
          var h2;
          if (0 === a2)
            throw new Error("Cannot divide by zero");
          if (t4.isSmall) {
            if (n2.isSmall)
              return [new l(y(s2 / a2)), new l(s2 % a2)];
            return [u[0], t4];
          }
          if (n2.isSmall) {
            if (1 === a2)
              return [t4, u[0]];
            if (-1 == a2)
              return [t4.negate(), u[0]];
            var p2 = Math.abs(a2);
            if (p2 < e3) {
              i4 = k(s2, p2);
              h2 = v(i4[0]);
              var g2 = i4[1];
              if (t4.sign)
                g2 = -g2;
              if ("number" === typeof h2) {
                if (t4.sign !== n2.sign)
                  h2 = -h2;
                return [new l(h2), new l(g2)];
              }
              return [new c(h2, t4.sign !== n2.sign), new l(g2)];
            }
            a2 = d(p2);
          }
          var m2 = N(s2, a2);
          if (-1 === m2)
            return [u[0], t4];
          if (0 === m2)
            return [u[t4.sign === n2.sign ? 1 : -1], u[0]];
          if (s2.length + a2.length <= 200)
            i4 = B(s2, a2);
          else
            i4 = O(s2, a2);
          h2 = i4[0];
          var w2 = t4.sign !== n2.sign, S2 = i4[1], _2 = t4.sign;
          if ("number" === typeof h2) {
            if (w2)
              h2 = -h2;
            h2 = new l(h2);
          } else
            h2 = new c(h2, w2);
          if ("number" === typeof S2) {
            if (_2)
              S2 = -S2;
            S2 = new l(S2);
          } else
            S2 = new c(S2, _2);
          return [h2, S2];
        }
        c.prototype.divmod = function(t4) {
          var e4 = C(this, t4);
          return { quotient: e4[0], remainder: e4[1] };
        };
        f2.prototype.divmod = l.prototype.divmod = c.prototype.divmod;
        c.prototype.divide = function(t4) {
          return C(this, t4)[0];
        };
        f2.prototype.over = f2.prototype.divide = function(t4) {
          return new f2(this.value / st(t4).value);
        };
        l.prototype.over = l.prototype.divide = c.prototype.over = c.prototype.divide;
        c.prototype.mod = function(t4) {
          return C(this, t4)[1];
        };
        f2.prototype.mod = f2.prototype.remainder = function(t4) {
          return new f2(this.value % st(t4).value);
        };
        l.prototype.remainder = l.prototype.mod = c.prototype.remainder = c.prototype.mod;
        c.prototype.pow = function(t4) {
          var e4 = st(t4), r4 = this.value, i4 = e4.value, n2, s2, a2;
          if (0 === i4)
            return u[1];
          if (0 === r4)
            return u[0];
          if (1 === r4)
            return u[1];
          if (-1 === r4)
            return e4.isEven() ? u[1] : u[-1];
          if (e4.sign)
            return u[0];
          if (!e4.isSmall)
            throw new Error("The exponent " + e4.toString() + " is too large.");
          if (this.isSmall) {
            if (h(n2 = Math.pow(r4, i4)))
              return new l(y(n2));
          }
          s2 = this;
          a2 = u[1];
          while (true) {
            if (i4 & true) {
              a2 = a2.times(s2);
              --i4;
            }
            if (0 === i4)
              break;
            i4 /= 2;
            s2 = s2.square();
          }
          return a2;
        };
        l.prototype.pow = c.prototype.pow;
        f2.prototype.pow = function(t4) {
          var e4 = st(t4);
          var r4 = this.value, i4 = e4.value;
          var n2 = BigInt(0), s2 = BigInt(1), a2 = BigInt(2);
          if (i4 === n2)
            return u[1];
          if (r4 === n2)
            return u[0];
          if (r4 === s2)
            return u[1];
          if (r4 === BigInt(-1))
            return e4.isEven() ? u[1] : u[-1];
          if (e4.isNegative())
            return new f2(n2);
          var o22 = this;
          var c2 = u[1];
          while (true) {
            if ((i4 & s2) === s2) {
              c2 = c2.times(o22);
              --i4;
            }
            if (i4 === n2)
              break;
            i4 /= a2;
            o22 = o22.square();
          }
          return c2;
        };
        c.prototype.modPow = function(t4, e4) {
          t4 = st(t4);
          e4 = st(e4);
          if (e4.isZero())
            throw new Error("Cannot take modPow with modulus 0");
          var r4 = u[1], i4 = this.mod(e4);
          if (t4.isNegative()) {
            t4 = t4.multiply(u[-1]);
            i4 = i4.modInv(e4);
          }
          while (t4.isPositive()) {
            if (i4.isZero())
              return u[0];
            if (t4.isOdd())
              r4 = r4.multiply(i4).mod(e4);
            t4 = t4.divide(2);
            i4 = i4.square().mod(e4);
          }
          return r4;
        };
        f2.prototype.modPow = l.prototype.modPow = c.prototype.modPow;
        function N(t4, e4) {
          if (t4.length !== e4.length)
            return t4.length > e4.length ? 1 : -1;
          for (var r4 = t4.length - 1; r4 >= 0; r4--)
            if (t4[r4] !== e4[r4])
              return t4[r4] > e4[r4] ? 1 : -1;
          return 0;
        }
        c.prototype.compareAbs = function(t4) {
          var e4 = st(t4), r4 = this.value, i4 = e4.value;
          if (e4.isSmall)
            return 1;
          return N(r4, i4);
        };
        l.prototype.compareAbs = function(t4) {
          var e4 = st(t4), r4 = Math.abs(this.value), i4 = e4.value;
          if (e4.isSmall) {
            i4 = Math.abs(i4);
            return r4 === i4 ? 0 : r4 > i4 ? 1 : -1;
          }
          return -1;
        };
        f2.prototype.compareAbs = function(t4) {
          var e4 = this.value;
          var r4 = st(t4).value;
          e4 = e4 >= 0 ? e4 : -e4;
          r4 = r4 >= 0 ? r4 : -r4;
          return e4 === r4 ? 0 : e4 > r4 ? 1 : -1;
        };
        c.prototype.compare = function(t4) {
          if (t4 === 1 / 0)
            return -1;
          if (t4 === -1 / 0)
            return 1;
          var e4 = st(t4), r4 = this.value, i4 = e4.value;
          if (this.sign !== e4.sign)
            return e4.sign ? 1 : -1;
          if (e4.isSmall)
            return this.sign ? -1 : 1;
          return N(r4, i4) * (this.sign ? -1 : 1);
        };
        c.prototype.compareTo = c.prototype.compare;
        l.prototype.compare = function(t4) {
          if (t4 === 1 / 0)
            return -1;
          if (t4 === -1 / 0)
            return 1;
          var e4 = st(t4), r4 = this.value, i4 = e4.value;
          if (e4.isSmall)
            return r4 == i4 ? 0 : r4 > i4 ? 1 : -1;
          if (r4 < 0 !== e4.sign)
            return r4 < 0 ? -1 : 1;
          return r4 < 0 ? 1 : -1;
        };
        l.prototype.compareTo = l.prototype.compare;
        f2.prototype.compare = function(t4) {
          if (t4 === 1 / 0)
            return -1;
          if (t4 === -1 / 0)
            return 1;
          var e4 = this.value;
          var r4 = st(t4).value;
          return e4 === r4 ? 0 : e4 > r4 ? 1 : -1;
        };
        f2.prototype.compareTo = f2.prototype.compare;
        c.prototype.equals = function(t4) {
          return 0 === this.compare(t4);
        };
        f2.prototype.eq = f2.prototype.equals = l.prototype.eq = l.prototype.equals = c.prototype.eq = c.prototype.equals;
        c.prototype.notEquals = function(t4) {
          return 0 !== this.compare(t4);
        };
        f2.prototype.neq = f2.prototype.notEquals = l.prototype.neq = l.prototype.notEquals = c.prototype.neq = c.prototype.notEquals;
        c.prototype.greater = function(t4) {
          return this.compare(t4) > 0;
        };
        f2.prototype.gt = f2.prototype.greater = l.prototype.gt = l.prototype.greater = c.prototype.gt = c.prototype.greater;
        c.prototype.lesser = function(t4) {
          return this.compare(t4) < 0;
        };
        f2.prototype.lt = f2.prototype.lesser = l.prototype.lt = l.prototype.lesser = c.prototype.lt = c.prototype.lesser;
        c.prototype.greaterOrEquals = function(t4) {
          return this.compare(t4) >= 0;
        };
        f2.prototype.geq = f2.prototype.greaterOrEquals = l.prototype.geq = l.prototype.greaterOrEquals = c.prototype.geq = c.prototype.greaterOrEquals;
        c.prototype.lesserOrEquals = function(t4) {
          return this.compare(t4) <= 0;
        };
        f2.prototype.leq = f2.prototype.lesserOrEquals = l.prototype.leq = l.prototype.lesserOrEquals = c.prototype.leq = c.prototype.lesserOrEquals;
        c.prototype.isEven = function() {
          return 0 === (1 & this.value[0]);
        };
        l.prototype.isEven = function() {
          return 0 === (1 & this.value);
        };
        f2.prototype.isEven = function() {
          return (this.value & BigInt(1)) === BigInt(0);
        };
        c.prototype.isOdd = function() {
          return 1 === (1 & this.value[0]);
        };
        l.prototype.isOdd = function() {
          return 1 === (1 & this.value);
        };
        f2.prototype.isOdd = function() {
          return (this.value & BigInt(1)) === BigInt(1);
        };
        c.prototype.isPositive = function() {
          return !this.sign;
        };
        l.prototype.isPositive = function() {
          return this.value > 0;
        };
        f2.prototype.isPositive = l.prototype.isPositive;
        c.prototype.isNegative = function() {
          return this.sign;
        };
        l.prototype.isNegative = function() {
          return this.value < 0;
        };
        f2.prototype.isNegative = l.prototype.isNegative;
        c.prototype.isUnit = function() {
          return false;
        };
        l.prototype.isUnit = function() {
          return 1 === Math.abs(this.value);
        };
        f2.prototype.isUnit = function() {
          return this.abs().value === BigInt(1);
        };
        c.prototype.isZero = function() {
          return false;
        };
        l.prototype.isZero = function() {
          return 0 === this.value;
        };
        f2.prototype.isZero = function() {
          return this.value === BigInt(0);
        };
        c.prototype.isDivisibleBy = function(t4) {
          var e4 = st(t4);
          if (e4.isZero())
            return false;
          if (e4.isUnit())
            return true;
          if (0 === e4.compareAbs(2))
            return this.isEven();
          return this.mod(e4).isZero();
        };
        f2.prototype.isDivisibleBy = l.prototype.isDivisibleBy = c.prototype.isDivisibleBy;
        function P(t4) {
          var e4 = t4.abs();
          if (e4.isUnit())
            return false;
          if (e4.equals(2) || e4.equals(3) || e4.equals(5))
            return true;
          if (e4.isEven() || e4.isDivisibleBy(3) || e4.isDivisibleBy(5))
            return false;
          if (e4.lesser(49))
            return true;
        }
        function V(t4, e4) {
          var r4 = t4.prev(), i4 = r4, s2 = 0, a2, u2, c2;
          while (i4.isEven())
            i4 = i4.divide(2), s2++;
          t:
            for (u2 = 0; u2 < e4.length; u2++) {
              if (t4.lesser(e4[u2]))
                continue;
              c2 = n(e4[u2]).modPow(i4, t4);
              if (c2.isUnit() || c2.equals(r4))
                continue;
              for (a2 = s2 - 1; 0 != a2; a2--) {
                c2 = c2.square().mod(t4);
                if (c2.isUnit())
                  return false;
                if (c2.equals(r4))
                  continue t;
              }
              return false;
            }
          return true;
        }
        c.prototype.isPrime = function(e4) {
          var r4 = P(this);
          if (r4 !== t3)
            return r4;
          var i4 = this.abs();
          var s2 = i4.bitLength();
          if (s2 <= 64)
            return V(i4, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]);
          var a2 = Math.log(2) * s2.toJSNumber();
          var o22 = Math.ceil(true === e4 ? 2 * Math.pow(a2, 2) : a2);
          for (var u2 = [], c2 = 0; c2 < o22; c2++)
            u2.push(n(c2 + 2));
          return V(i4, u2);
        };
        f2.prototype.isPrime = l.prototype.isPrime = c.prototype.isPrime;
        c.prototype.isProbablePrime = function(e4, r4) {
          var i4 = P(this);
          if (i4 !== t3)
            return i4;
          var s2 = this.abs();
          var a2 = e4 === t3 ? 5 : e4;
          for (var o22 = [], u2 = 0; u2 < a2; u2++)
            o22.push(n.randBetween(2, s2.minus(2), r4));
          return V(s2, o22);
        };
        f2.prototype.isProbablePrime = l.prototype.isProbablePrime = c.prototype.isProbablePrime;
        c.prototype.modInv = function(t4) {
          var e4 = n.zero, r4 = n.one, i4 = st(t4), s2 = this.abs(), a2, o22, u2;
          while (!s2.isZero()) {
            a2 = i4.divide(s2);
            o22 = e4;
            u2 = i4;
            e4 = r4;
            i4 = s2;
            r4 = o22.subtract(a2.multiply(r4));
            s2 = u2.subtract(a2.multiply(s2));
          }
          if (!i4.isUnit())
            throw new Error(this.toString() + " and " + t4.toString() + " are not co-prime");
          if (-1 === e4.compare(0))
            e4 = e4.add(t4);
          if (this.isNegative())
            return e4.negate();
          return e4;
        };
        f2.prototype.modInv = l.prototype.modInv = c.prototype.modInv;
        c.prototype.next = function() {
          var t4 = this.value;
          if (this.sign)
            return E2(t4, 1, this.sign);
          return new c(S(t4, 1), this.sign);
        };
        l.prototype.next = function() {
          var t4 = this.value;
          if (t4 + 1 < i3)
            return new l(t4 + 1);
          return new c(s, false);
        };
        f2.prototype.next = function() {
          return new f2(this.value + BigInt(1));
        };
        c.prototype.prev = function() {
          var t4 = this.value;
          if (this.sign)
            return new c(S(t4, 1), true);
          return E2(t4, 1, this.sign);
        };
        l.prototype.prev = function() {
          var t4 = this.value;
          if (t4 - 1 > -i3)
            return new l(t4 - 1);
          return new c(s, true);
        };
        f2.prototype.prev = function() {
          return new f2(this.value - BigInt(1));
        };
        var L = [1];
        while (2 * L[L.length - 1] <= e3)
          L.push(2 * L[L.length - 1]);
        var H = L.length, U = L[H - 1];
        function K(t4) {
          return Math.abs(t4) <= e3;
        }
        c.prototype.shiftLeft = function(t4) {
          var e4 = st(t4).toJSNumber();
          if (!K(e4))
            throw new Error(String(e4) + " is too large for shifting.");
          if (e4 < 0)
            return this.shiftRight(-e4);
          var r4 = this;
          if (r4.isZero())
            return r4;
          while (e4 >= H) {
            r4 = r4.multiply(U);
            e4 -= H - 1;
          }
          return r4.multiply(L[e4]);
        };
        f2.prototype.shiftLeft = l.prototype.shiftLeft = c.prototype.shiftLeft;
        c.prototype.shiftRight = function(t4) {
          var e4;
          var r4 = st(t4).toJSNumber();
          if (!K(r4))
            throw new Error(String(r4) + " is too large for shifting.");
          if (r4 < 0)
            return this.shiftLeft(-r4);
          var i4 = this;
          while (r4 >= H) {
            if (i4.isZero() || i4.isNegative() && i4.isUnit())
              return i4;
            e4 = C(i4, U);
            i4 = e4[1].isNegative() ? e4[0].prev() : e4[0];
            r4 -= H - 1;
          }
          e4 = C(i4, L[r4]);
          return e4[1].isNegative() ? e4[0].prev() : e4[0];
        };
        f2.prototype.shiftRight = l.prototype.shiftRight = c.prototype.shiftRight;
        function j(t4, e4, r4) {
          e4 = st(e4);
          var i4 = t4.isNegative(), s2 = e4.isNegative();
          var a2 = i4 ? t4.not() : t4, o22 = s2 ? e4.not() : e4;
          var u2 = 0, c2 = 0;
          var l2 = null, f22 = null;
          var h2 = [];
          while (!a2.isZero() || !o22.isZero()) {
            l2 = C(a2, U);
            u2 = l2[1].toJSNumber();
            if (i4)
              u2 = U - 1 - u2;
            f22 = C(o22, U);
            c2 = f22[1].toJSNumber();
            if (s2)
              c2 = U - 1 - c2;
            a2 = l2[0];
            o22 = f22[0];
            h2.push(r4(u2, c2));
          }
          var d2 = 0 !== r4(i4 ? 1 : 0, s2 ? 1 : 0) ? n(-1) : n(0);
          for (var v2 = h2.length - 1; v2 >= 0; v2 -= 1)
            d2 = d2.multiply(U).add(n(h2[v2]));
          return d2;
        }
        c.prototype.not = function() {
          return this.negate().prev();
        };
        f2.prototype.not = l.prototype.not = c.prototype.not;
        c.prototype.and = function(t4) {
          return j(this, t4, function(t5, e4) {
            return t5 & e4;
          });
        };
        f2.prototype.and = l.prototype.and = c.prototype.and;
        c.prototype.or = function(t4) {
          return j(this, t4, function(t5, e4) {
            return t5 | e4;
          });
        };
        f2.prototype.or = l.prototype.or = c.prototype.or;
        c.prototype.xor = function(t4) {
          return j(this, t4, function(t5, e4) {
            return t5 ^ e4;
          });
        };
        f2.prototype.xor = l.prototype.xor = c.prototype.xor;
        var q = 1 << 30, F = (e3 & -e3) * (e3 & -e3) | q;
        function z(t4) {
          var r4 = t4.value, i4 = "number" === typeof r4 ? r4 | q : "bigint" === typeof r4 ? r4 | BigInt(q) : r4[0] + r4[1] * e3 | F;
          return i4 & -i4;
        }
        function G(t4, e4) {
          if (e4.compareTo(t4) <= 0) {
            var r4 = G(t4, e4.square(e4));
            var i4 = r4.p;
            var s2 = r4.e;
            var a2 = i4.multiply(e4);
            return a2.compareTo(t4) <= 0 ? { p: a2, e: 2 * s2 + 1 } : { p: i4, e: 2 * s2 };
          }
          return { p: n(1), e: 0 };
        }
        c.prototype.bitLength = function() {
          var t4 = this;
          if (t4.compareTo(n(0)) < 0)
            t4 = t4.negate().subtract(n(1));
          if (0 === t4.compareTo(n(0)))
            return n(0);
          return n(G(t4, n(2)).e).add(n(1));
        };
        f2.prototype.bitLength = l.prototype.bitLength = c.prototype.bitLength;
        function Y(t4, e4) {
          t4 = st(t4);
          e4 = st(e4);
          return t4.greater(e4) ? t4 : e4;
        }
        function W(t4, e4) {
          t4 = st(t4);
          e4 = st(e4);
          return t4.lesser(e4) ? t4 : e4;
        }
        function J(t4, e4) {
          t4 = st(t4).abs();
          e4 = st(e4).abs();
          if (t4.equals(e4))
            return t4;
          if (t4.isZero())
            return e4;
          if (e4.isZero())
            return t4;
          var r4 = u[1], i4, n2;
          while (t4.isEven() && e4.isEven()) {
            i4 = W(z(t4), z(e4));
            t4 = t4.divide(i4);
            e4 = e4.divide(i4);
            r4 = r4.multiply(i4);
          }
          while (t4.isEven())
            t4 = t4.divide(z(t4));
          do {
            while (e4.isEven())
              e4 = e4.divide(z(e4));
            if (t4.greater(e4)) {
              n2 = e4;
              e4 = t4;
              t4 = n2;
            }
            e4 = e4.subtract(t4);
          } while (!e4.isZero());
          return r4.isUnit() ? t4 : t4.multiply(r4);
        }
        function Z(t4, e4) {
          t4 = st(t4).abs();
          e4 = st(e4).abs();
          return t4.divide(J(t4, e4)).multiply(e4);
        }
        function $(t4, r4, i4) {
          t4 = st(t4);
          r4 = st(r4);
          var n2 = i4 || Math.random;
          var s2 = W(t4, r4), a2 = Y(t4, r4);
          var o22 = a2.subtract(s2).add(1);
          if (o22.isSmall)
            return s2.add(Math.floor(n2() * o22));
          var c2 = et(o22, e3).value;
          var l2 = [], f22 = true;
          for (var h2 = 0; h2 < c2.length; h2++) {
            var d2 = f22 ? c2[h2] + (h2 + 1 < c2.length ? c2[h2 + 1] / e3 : 0) : e3;
            var v2 = y(n2() * d2);
            l2.push(v2);
            if (v2 < c2[h2])
              f22 = false;
          }
          return s2.add(u.fromArray(l2, e3, false));
        }
        var X = function(t4, e4, r4, i4) {
          r4 = r4 || a;
          t4 = String(t4);
          if (!i4) {
            t4 = t4.toLowerCase();
            r4 = r4.toLowerCase();
          }
          var n2 = t4.length;
          var s2;
          var o22 = Math.abs(e4);
          var u2 = {};
          for (s2 = 0; s2 < r4.length; s2++)
            u2[r4[s2]] = s2;
          for (s2 = 0; s2 < n2; s2++) {
            var c2 = t4[s2];
            if ("-" === c2)
              continue;
            if (c2 in u2) {
              if (u2[c2] >= o22) {
                if ("1" === c2 && 1 === o22)
                  continue;
                throw new Error(c2 + " is not a valid digit in base " + e4 + ".");
              }
            }
          }
          e4 = st(e4);
          var l2 = [];
          var f22 = "-" === t4[0];
          for (s2 = f22 ? 1 : 0; s2 < t4.length; s2++) {
            var c2 = t4[s2];
            if (c2 in u2)
              l2.push(st(u2[c2]));
            else if ("<" === c2) {
              var h2 = s2;
              do {
                s2++;
              } while (">" !== t4[s2] && s2 < t4.length);
              l2.push(st(t4.slice(h2 + 1, s2)));
            } else
              throw new Error(c2 + " is not a valid character");
          }
          return Q(l2, e4, f22);
        };
        function Q(t4, e4, r4) {
          var i4 = u[0], n2 = u[1], s2;
          for (s2 = t4.length - 1; s2 >= 0; s2--) {
            i4 = i4.add(t4[s2].times(n2));
            n2 = n2.times(e4);
          }
          return r4 ? i4.negate() : i4;
        }
        function tt2(t4, e4) {
          e4 = e4 || a;
          if (t4 < e4.length)
            return e4[t4];
          return "<" + t4 + ">";
        }
        function et(t4, e4) {
          e4 = n(e4);
          if (e4.isZero()) {
            if (t4.isZero())
              return { value: [0], isNegative: false };
            throw new Error("Cannot convert nonzero numbers to base 0.");
          }
          if (e4.equals(-1)) {
            if (t4.isZero())
              return { value: [0], isNegative: false };
            if (t4.isNegative())
              return { value: [].concat.apply([], Array.apply(null, Array(-t4.toJSNumber())).map(Array.prototype.valueOf, [1, 0])), isNegative: false };
            var r4 = Array.apply(null, Array(t4.toJSNumber() - 1)).map(Array.prototype.valueOf, [0, 1]);
            r4.unshift([1]);
            return { value: [].concat.apply([], r4), isNegative: false };
          }
          var i4 = false;
          if (t4.isNegative() && e4.isPositive()) {
            i4 = true;
            t4 = t4.abs();
          }
          if (e4.isUnit()) {
            if (t4.isZero())
              return { value: [0], isNegative: false };
            return { value: Array.apply(null, Array(t4.toJSNumber())).map(Number.prototype.valueOf, 1), isNegative: i4 };
          }
          var s2 = [];
          var a2 = t4, o22;
          while (a2.isNegative() || a2.compareAbs(e4) >= 0) {
            o22 = a2.divmod(e4);
            a2 = o22.quotient;
            var u2 = o22.remainder;
            if (u2.isNegative()) {
              u2 = e4.minus(u2).abs();
              a2 = a2.next();
            }
            s2.push(u2.toJSNumber());
          }
          s2.push(a2.toJSNumber());
          return { value: s2.reverse(), isNegative: i4 };
        }
        function rt(t4, e4, r4) {
          var i4 = et(t4, e4);
          return (i4.isNegative ? "-" : "") + i4.value.map(function(t5) {
            return tt2(t5, r4);
          }).join("");
        }
        c.prototype.toArray = function(t4) {
          return et(this, t4);
        };
        l.prototype.toArray = function(t4) {
          return et(this, t4);
        };
        f2.prototype.toArray = function(t4) {
          return et(this, t4);
        };
        c.prototype.toString = function(e4, r4) {
          if (e4 === t3)
            e4 = 10;
          if (10 !== e4)
            return rt(this, e4, r4);
          var i4 = this.value, n2 = i4.length, s2 = String(i4[--n2]), a2 = "0000000", o22;
          while (--n2 >= 0) {
            o22 = String(i4[n2]);
            s2 += a2.slice(o22.length) + o22;
          }
          var u2 = this.sign ? "-" : "";
          return u2 + s2;
        };
        l.prototype.toString = function(e4, r4) {
          if (e4 === t3)
            e4 = 10;
          if (10 != e4)
            return rt(this, e4, r4);
          return String(this.value);
        };
        f2.prototype.toString = l.prototype.toString;
        f2.prototype.toJSON = c.prototype.toJSON = l.prototype.toJSON = function() {
          return this.toString();
        };
        c.prototype.valueOf = function() {
          return parseInt(this.toString(), 10);
        };
        c.prototype.toJSNumber = c.prototype.valueOf;
        l.prototype.valueOf = function() {
          return this.value;
        };
        l.prototype.toJSNumber = l.prototype.valueOf;
        f2.prototype.valueOf = f2.prototype.toJSNumber = function() {
          return parseInt(this.toString(), 10);
        };
        function it(t4) {
          if (h(+t4)) {
            var e4 = +t4;
            if (e4 === y(e4))
              return o2 ? new f2(BigInt(e4)) : new l(e4);
            throw new Error("Invalid integer: " + t4);
          }
          var i4 = "-" === t4[0];
          if (i4)
            t4 = t4.slice(1);
          var n2 = t4.split(/e/i);
          if (n2.length > 2)
            throw new Error("Invalid integer: " + n2.join("e"));
          if (2 === n2.length) {
            var s2 = n2[1];
            if ("+" === s2[0])
              s2 = s2.slice(1);
            s2 = +s2;
            if (s2 !== y(s2) || !h(s2))
              throw new Error("Invalid integer: " + s2 + " is not a valid exponent.");
            var a2 = n2[0];
            var u2 = a2.indexOf(".");
            if (u2 >= 0) {
              s2 -= a2.length - u2 - 1;
              a2 = a2.slice(0, u2) + a2.slice(u2 + 1);
            }
            if (s2 < 0)
              throw new Error("Cannot include negative exponent part for integers");
            a2 += new Array(s2 + 1).join("0");
            t4 = a2;
          }
          var d2 = /^([0-9][0-9]*)$/.test(t4);
          if (!d2)
            throw new Error("Invalid integer: " + t4);
          if (o2)
            return new f2(BigInt(i4 ? "-" + t4 : t4));
          var v2 = [], g2 = t4.length, m2 = r3, w2 = g2 - m2;
          while (g2 > 0) {
            v2.push(+t4.slice(w2, g2));
            w2 -= m2;
            if (w2 < 0)
              w2 = 0;
            g2 -= m2;
          }
          p(v2);
          return new c(v2, i4);
        }
        function nt(t4) {
          if (o2)
            return new f2(BigInt(t4));
          if (h(t4)) {
            if (t4 !== y(t4))
              throw new Error(t4 + " is not an integer.");
            return new l(t4);
          }
          return it(t4.toString());
        }
        function st(t4) {
          if ("number" === typeof t4)
            return nt(t4);
          if ("string" === typeof t4)
            return it(t4);
          if ("bigint" === typeof t4)
            return new f2(t4);
          return t4;
        }
        for (var at = 0; at < 1e3; at++) {
          u[at] = st(at);
          if (at > 0)
            u[-at] = st(-at);
        }
        u.one = u[1];
        u.zero = u[0];
        u.minusOne = u[-1];
        u.max = Y;
        u.min = W;
        u.gcd = J;
        u.lcm = Z;
        u.isInstance = function(t4) {
          return t4 instanceof c || t4 instanceof l || t4 instanceof f2;
        };
        u.randBetween = $;
        u.fromArray = function(t4, e4, r4) {
          return Q(t4.map(st), st(e4 || 10), r4);
        };
        return u;
      }();
      if (t22.hasOwnProperty("exports"))
        t22.exports = n;
      i2 = (function() {
        return n;
      }).call(e2, r2, e2, t22), void 0 !== i2 && (t22.exports = i2);
    }, 452: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(8269), r2(8214), r2(888), r2(5109));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.BlockCipher;
          var n = e3.algo;
          var s = [];
          var a = [];
          var o2 = [];
          var u = [];
          var c = [];
          var l = [];
          var f2 = [];
          var h = [];
          var d = [];
          var v = [];
          (function() {
            var t4 = [];
            for (var e4 = 0; e4 < 256; e4++)
              if (e4 < 128)
                t4[e4] = e4 << 1;
              else
                t4[e4] = e4 << 1 ^ 283;
            var r4 = 0;
            var i3 = 0;
            for (var e4 = 0; e4 < 256; e4++) {
              var n2 = i3 ^ i3 << 1 ^ i3 << 2 ^ i3 << 3 ^ i3 << 4;
              n2 = n2 >>> 8 ^ 255 & n2 ^ 99;
              s[r4] = n2;
              a[n2] = r4;
              var p2 = t4[r4];
              var g2 = t4[p2];
              var y = t4[g2];
              var m = 257 * t4[n2] ^ 16843008 * n2;
              o2[r4] = m << 24 | m >>> 8;
              u[r4] = m << 16 | m >>> 16;
              c[r4] = m << 8 | m >>> 24;
              l[r4] = m;
              var m = 16843009 * y ^ 65537 * g2 ^ 257 * p2 ^ 16843008 * r4;
              f2[n2] = m << 24 | m >>> 8;
              h[n2] = m << 16 | m >>> 16;
              d[n2] = m << 8 | m >>> 24;
              v[n2] = m;
              if (!r4)
                r4 = i3 = 1;
              else {
                r4 = p2 ^ t4[t4[t4[y ^ p2]]];
                i3 ^= t4[t4[i3]];
              }
            }
          })();
          var p = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
          var g = n.AES = i2.extend({ _doReset: function() {
            var t4;
            if (this._nRounds && this._keyPriorReset === this._key)
              return;
            var e4 = this._keyPriorReset = this._key;
            var r4 = e4.words;
            var i3 = e4.sigBytes / 4;
            var n2 = this._nRounds = i3 + 6;
            var a2 = 4 * (n2 + 1);
            var o22 = this._keySchedule = [];
            for (var u2 = 0; u2 < a2; u2++)
              if (u2 < i3)
                o22[u2] = r4[u2];
              else {
                t4 = o22[u2 - 1];
                if (!(u2 % i3)) {
                  t4 = t4 << 8 | t4 >>> 24;
                  t4 = s[t4 >>> 24] << 24 | s[t4 >>> 16 & 255] << 16 | s[t4 >>> 8 & 255] << 8 | s[255 & t4];
                  t4 ^= p[u2 / i3 | 0] << 24;
                } else if (i3 > 6 && u2 % i3 == 4)
                  t4 = s[t4 >>> 24] << 24 | s[t4 >>> 16 & 255] << 16 | s[t4 >>> 8 & 255] << 8 | s[255 & t4];
                o22[u2] = o22[u2 - i3] ^ t4;
              }
            var c2 = this._invKeySchedule = [];
            for (var l2 = 0; l2 < a2; l2++) {
              var u2 = a2 - l2;
              if (l2 % 4)
                var t4 = o22[u2];
              else
                var t4 = o22[u2 - 4];
              if (l2 < 4 || u2 <= 4)
                c2[l2] = t4;
              else
                c2[l2] = f2[s[t4 >>> 24]] ^ h[s[t4 >>> 16 & 255]] ^ d[s[t4 >>> 8 & 255]] ^ v[s[255 & t4]];
            }
          }, encryptBlock: function(t4, e4) {
            this._doCryptBlock(t4, e4, this._keySchedule, o2, u, c, l, s);
          }, decryptBlock: function(t4, e4) {
            var r4 = t4[e4 + 1];
            t4[e4 + 1] = t4[e4 + 3];
            t4[e4 + 3] = r4;
            this._doCryptBlock(t4, e4, this._invKeySchedule, f2, h, d, v, a);
            var r4 = t4[e4 + 1];
            t4[e4 + 1] = t4[e4 + 3];
            t4[e4 + 3] = r4;
          }, _doCryptBlock: function(t4, e4, r4, i3, n2, s2, a2, o22) {
            var u2 = this._nRounds;
            var c2 = t4[e4] ^ r4[0];
            var l2 = t4[e4 + 1] ^ r4[1];
            var f22 = t4[e4 + 2] ^ r4[2];
            var h2 = t4[e4 + 3] ^ r4[3];
            var d2 = 4;
            for (var v2 = 1; v2 < u2; v2++) {
              var p2 = i3[c2 >>> 24] ^ n2[l2 >>> 16 & 255] ^ s2[f22 >>> 8 & 255] ^ a2[255 & h2] ^ r4[d2++];
              var g2 = i3[l2 >>> 24] ^ n2[f22 >>> 16 & 255] ^ s2[h2 >>> 8 & 255] ^ a2[255 & c2] ^ r4[d2++];
              var y = i3[f22 >>> 24] ^ n2[h2 >>> 16 & 255] ^ s2[c2 >>> 8 & 255] ^ a2[255 & l2] ^ r4[d2++];
              var m = i3[h2 >>> 24] ^ n2[c2 >>> 16 & 255] ^ s2[l2 >>> 8 & 255] ^ a2[255 & f22] ^ r4[d2++];
              c2 = p2;
              l2 = g2;
              f22 = y;
              h2 = m;
            }
            var p2 = (o22[c2 >>> 24] << 24 | o22[l2 >>> 16 & 255] << 16 | o22[f22 >>> 8 & 255] << 8 | o22[255 & h2]) ^ r4[d2++];
            var g2 = (o22[l2 >>> 24] << 24 | o22[f22 >>> 16 & 255] << 16 | o22[h2 >>> 8 & 255] << 8 | o22[255 & c2]) ^ r4[d2++];
            var y = (o22[f22 >>> 24] << 24 | o22[h2 >>> 16 & 255] << 16 | o22[c2 >>> 8 & 255] << 8 | o22[255 & l2]) ^ r4[d2++];
            var m = (o22[h2 >>> 24] << 24 | o22[c2 >>> 16 & 255] << 16 | o22[l2 >>> 8 & 255] << 8 | o22[255 & f22]) ^ r4[d2++];
            t4[e4] = p2;
            t4[e4 + 1] = g2;
            t4[e4 + 2] = y;
            t4[e4 + 3] = m;
          }, keySize: 256 / 32 });
          e3.AES = i2._createHelper(g);
        })();
        return t3.AES;
      });
    }, 5109: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(888));
      })(this, function(t3) {
        t3.lib.Cipher || function(e3) {
          var r3 = t3;
          var i2 = r3.lib;
          var n = i2.Base;
          var s = i2.WordArray;
          var a = i2.BufferedBlockAlgorithm;
          var o2 = r3.enc;
          o2.Utf8;
          var c = o2.Base64;
          var l = r3.algo;
          var f2 = l.EvpKDF;
          var h = i2.Cipher = a.extend({ cfg: n.extend(), createEncryptor: function(t4, e4) {
            return this.create(this._ENC_XFORM_MODE, t4, e4);
          }, createDecryptor: function(t4, e4) {
            return this.create(this._DEC_XFORM_MODE, t4, e4);
          }, init: function(t4, e4, r4) {
            this.cfg = this.cfg.extend(r4);
            this._xformMode = t4;
            this._key = e4;
            this.reset();
          }, reset: function() {
            a.reset.call(this);
            this._doReset();
          }, process: function(t4) {
            this._append(t4);
            return this._process();
          }, finalize: function(t4) {
            if (t4)
              this._append(t4);
            var e4 = this._doFinalize();
            return e4;
          }, keySize: 128 / 32, ivSize: 128 / 32, _ENC_XFORM_MODE: 1, _DEC_XFORM_MODE: 2, _createHelper: /* @__PURE__ */ function() {
            function t4(t5) {
              if ("string" == typeof t5)
                return T;
              else
                return E2;
            }
            return function(e4) {
              return { encrypt: function(r4, i3, n2) {
                return t4(i3).encrypt(e4, r4, i3, n2);
              }, decrypt: function(r4, i3, n2) {
                return t4(i3).decrypt(e4, r4, i3, n2);
              } };
            };
          }() });
          i2.StreamCipher = h.extend({ _doFinalize: function() {
            var t4 = this._process(true);
            return t4;
          }, blockSize: 1 });
          var v = r3.mode = {};
          var p = i2.BlockCipherMode = n.extend({ createEncryptor: function(t4, e4) {
            return this.Encryptor.create(t4, e4);
          }, createDecryptor: function(t4, e4) {
            return this.Decryptor.create(t4, e4);
          }, init: function(t4, e4) {
            this._cipher = t4;
            this._iv = e4;
          } });
          var g = v.CBC = function() {
            var t4 = p.extend();
            t4.Encryptor = t4.extend({ processBlock: function(t5, e4) {
              var i3 = this._cipher;
              var n2 = i3.blockSize;
              r4.call(this, t5, e4, n2);
              i3.encryptBlock(t5, e4);
              this._prevBlock = t5.slice(e4, e4 + n2);
            } });
            t4.Decryptor = t4.extend({ processBlock: function(t5, e4) {
              var i3 = this._cipher;
              var n2 = i3.blockSize;
              var s2 = t5.slice(e4, e4 + n2);
              i3.decryptBlock(t5, e4);
              r4.call(this, t5, e4, n2);
              this._prevBlock = s2;
            } });
            function r4(t5, r5, i3) {
              var n2;
              var s2 = this._iv;
              if (s2) {
                n2 = s2;
                this._iv = e3;
              } else
                n2 = this._prevBlock;
              for (var a2 = 0; a2 < i3; a2++)
                t5[r5 + a2] ^= n2[a2];
            }
            return t4;
          }();
          var y = r3.pad = {};
          var m = y.Pkcs7 = { pad: function(t4, e4) {
            var r4 = 4 * e4;
            var i3 = r4 - t4.sigBytes % r4;
            var n2 = i3 << 24 | i3 << 16 | i3 << 8 | i3;
            var a2 = [];
            for (var o22 = 0; o22 < i3; o22 += 4)
              a2.push(n2);
            var u = s.create(a2, i3);
            t4.concat(u);
          }, unpad: function(t4) {
            var e4 = 255 & t4.words[t4.sigBytes - 1 >>> 2];
            t4.sigBytes -= e4;
          } };
          i2.BlockCipher = h.extend({ cfg: h.cfg.extend({ mode: g, padding: m }), reset: function() {
            var t4;
            h.reset.call(this);
            var e4 = this.cfg;
            var r4 = e4.iv;
            var i3 = e4.mode;
            if (this._xformMode == this._ENC_XFORM_MODE)
              t4 = i3.createEncryptor;
            else {
              t4 = i3.createDecryptor;
              this._minBufferSize = 1;
            }
            if (this._mode && this._mode.__creator == t4)
              this._mode.init(this, r4 && r4.words);
            else {
              this._mode = t4.call(i3, this, r4 && r4.words);
              this._mode.__creator = t4;
            }
          }, _doProcessBlock: function(t4, e4) {
            this._mode.processBlock(t4, e4);
          }, _doFinalize: function() {
            var t4;
            var e4 = this.cfg.padding;
            if (this._xformMode == this._ENC_XFORM_MODE) {
              e4.pad(this._data, this.blockSize);
              t4 = this._process(true);
            } else {
              t4 = this._process(true);
              e4.unpad(t4);
            }
            return t4;
          }, blockSize: 128 / 32 });
          var S = i2.CipherParams = n.extend({ init: function(t4) {
            this.mixIn(t4);
          }, toString: function(t4) {
            return (t4 || this.formatter).stringify(this);
          } });
          var _ = r3.format = {};
          var b = _.OpenSSL = { stringify: function(t4) {
            var e4;
            var r4 = t4.ciphertext;
            var i3 = t4.salt;
            if (i3)
              e4 = s.create([1398893684, 1701076831]).concat(i3).concat(r4);
            else
              e4 = r4;
            return e4.toString(c);
          }, parse: function(t4) {
            var e4;
            var r4 = c.parse(t4);
            var i3 = r4.words;
            if (1398893684 == i3[0] && 1701076831 == i3[1]) {
              e4 = s.create(i3.slice(2, 4));
              i3.splice(0, 4);
              r4.sigBytes -= 16;
            }
            return S.create({ ciphertext: r4, salt: e4 });
          } };
          var E2 = i2.SerializableCipher = n.extend({ cfg: n.extend({ format: b }), encrypt: function(t4, e4, r4, i3) {
            i3 = this.cfg.extend(i3);
            var n2 = t4.createEncryptor(r4, i3);
            var s2 = n2.finalize(e4);
            var a2 = n2.cfg;
            return S.create({ ciphertext: s2, key: r4, iv: a2.iv, algorithm: t4, mode: a2.mode, padding: a2.padding, blockSize: t4.blockSize, formatter: i3.format });
          }, decrypt: function(t4, e4, r4, i3) {
            i3 = this.cfg.extend(i3);
            e4 = this._parse(e4, i3.format);
            var n2 = t4.createDecryptor(r4, i3).finalize(e4.ciphertext);
            return n2;
          }, _parse: function(t4, e4) {
            if ("string" == typeof t4)
              return e4.parse(t4, this);
            else
              return t4;
          } });
          var D = r3.kdf = {};
          var M = D.OpenSSL = { execute: function(t4, e4, r4, i3) {
            if (!i3)
              i3 = s.random(64 / 8);
            var n2 = f2.create({ keySize: e4 + r4 }).compute(t4, i3);
            var a2 = s.create(n2.words.slice(e4), 4 * r4);
            n2.sigBytes = 4 * e4;
            return S.create({ key: n2, iv: a2, salt: i3 });
          } };
          var T = i2.PasswordBasedCipher = E2.extend({ cfg: E2.cfg.extend({ kdf: M }), encrypt: function(t4, e4, r4, i3) {
            i3 = this.cfg.extend(i3);
            var n2 = i3.kdf.execute(r4, t4.keySize, t4.ivSize);
            i3.iv = n2.iv;
            var s2 = E2.encrypt.call(this, t4, e4, n2.key, i3);
            s2.mixIn(n2);
            return s2;
          }, decrypt: function(t4, e4, r4, i3) {
            i3 = this.cfg.extend(i3);
            e4 = this._parse(e4, i3.format);
            var n2 = i3.kdf.execute(r4, t4.keySize, t4.ivSize, e4.salt);
            i3.iv = n2.iv;
            var s2 = E2.decrypt.call(this, t4, e4, n2.key, i3);
            return s2;
          } });
        }();
      });
    }, 8249: function(t22, e2, r2) {
      (function(r3, i2) {
        t22.exports = i2();
      })(this, function() {
        var t3 = t3 || function(t4, e3) {
          var i2;
          if ("undefined" !== typeof window && window.crypto)
            i2 = window.crypto;
          if ("undefined" !== typeof self && self.crypto)
            i2 = self.crypto;
          if ("undefined" !== typeof globalThis && globalThis.crypto)
            i2 = globalThis.crypto;
          if (!i2 && "undefined" !== typeof window && window.msCrypto)
            i2 = window.msCrypto;
          if (!i2 && "undefined" !== typeof r2.g && r2.g.crypto)
            i2 = r2.g.crypto;
          if (!i2 && true)
            try {
              i2 = r2(2480);
            } catch (t5) {
            }
          var n = function() {
            if (i2) {
              if ("function" === typeof i2.getRandomValues)
                try {
                  return i2.getRandomValues(new Uint32Array(1))[0];
                } catch (t5) {
                }
              if ("function" === typeof i2.randomBytes)
                try {
                  return i2.randomBytes(4).readInt32LE();
                } catch (t5) {
                }
            }
            throw new Error("Native crypto module could not be used to get secure random number.");
          };
          var s = Object.create || /* @__PURE__ */ function() {
            function t5() {
            }
            return function(e4) {
              var r3;
              t5.prototype = e4;
              r3 = new t5();
              t5.prototype = null;
              return r3;
            };
          }();
          var a = {};
          var o2 = a.lib = {};
          var u = o2.Base = /* @__PURE__ */ function() {
            return { extend: function(t5) {
              var e4 = s(this);
              if (t5)
                e4.mixIn(t5);
              if (!e4.hasOwnProperty("init") || this.init === e4.init)
                e4.init = function() {
                  e4.$super.init.apply(this, arguments);
                };
              e4.init.prototype = e4;
              e4.$super = this;
              return e4;
            }, create: function() {
              var t5 = this.extend();
              t5.init.apply(t5, arguments);
              return t5;
            }, init: function() {
            }, mixIn: function(t5) {
              for (var e4 in t5)
                if (t5.hasOwnProperty(e4))
                  this[e4] = t5[e4];
              if (t5.hasOwnProperty("toString"))
                this.toString = t5.toString;
            }, clone: function() {
              return this.init.prototype.extend(this);
            } };
          }();
          var c = o2.WordArray = u.extend({ init: function(t5, r3) {
            t5 = this.words = t5 || [];
            if (r3 != e3)
              this.sigBytes = r3;
            else
              this.sigBytes = 4 * t5.length;
          }, toString: function(t5) {
            return (t5 || f2).stringify(this);
          }, concat: function(t5) {
            var e4 = this.words;
            var r3 = t5.words;
            var i3 = this.sigBytes;
            var n2 = t5.sigBytes;
            this.clamp();
            if (i3 % 4)
              for (var s2 = 0; s2 < n2; s2++) {
                var a2 = r3[s2 >>> 2] >>> 24 - s2 % 4 * 8 & 255;
                e4[i3 + s2 >>> 2] |= a2 << 24 - (i3 + s2) % 4 * 8;
              }
            else
              for (var o22 = 0; o22 < n2; o22 += 4)
                e4[i3 + o22 >>> 2] = r3[o22 >>> 2];
            this.sigBytes += n2;
            return this;
          }, clamp: function() {
            var e4 = this.words;
            var r3 = this.sigBytes;
            e4[r3 >>> 2] &= 4294967295 << 32 - r3 % 4 * 8;
            e4.length = t4.ceil(r3 / 4);
          }, clone: function() {
            var t5 = u.clone.call(this);
            t5.words = this.words.slice(0);
            return t5;
          }, random: function(t5) {
            var e4 = [];
            for (var r3 = 0; r3 < t5; r3 += 4)
              e4.push(n());
            return new c.init(e4, t5);
          } });
          var l = a.enc = {};
          var f2 = l.Hex = { stringify: function(t5) {
            var e4 = t5.words;
            var r3 = t5.sigBytes;
            var i3 = [];
            for (var n2 = 0; n2 < r3; n2++) {
              var s2 = e4[n2 >>> 2] >>> 24 - n2 % 4 * 8 & 255;
              i3.push((s2 >>> 4).toString(16));
              i3.push((15 & s2).toString(16));
            }
            return i3.join("");
          }, parse: function(t5) {
            var e4 = t5.length;
            var r3 = [];
            for (var i3 = 0; i3 < e4; i3 += 2)
              r3[i3 >>> 3] |= parseInt(t5.substr(i3, 2), 16) << 24 - i3 % 8 * 4;
            return new c.init(r3, e4 / 2);
          } };
          var h = l.Latin1 = { stringify: function(t5) {
            var e4 = t5.words;
            var r3 = t5.sigBytes;
            var i3 = [];
            for (var n2 = 0; n2 < r3; n2++) {
              var s2 = e4[n2 >>> 2] >>> 24 - n2 % 4 * 8 & 255;
              i3.push(String.fromCharCode(s2));
            }
            return i3.join("");
          }, parse: function(t5) {
            var e4 = t5.length;
            var r3 = [];
            for (var i3 = 0; i3 < e4; i3++)
              r3[i3 >>> 2] |= (255 & t5.charCodeAt(i3)) << 24 - i3 % 4 * 8;
            return new c.init(r3, e4);
          } };
          var d = l.Utf8 = { stringify: function(t5) {
            try {
              return decodeURIComponent(escape(h.stringify(t5)));
            } catch (t6) {
              throw new Error("Malformed UTF-8 data");
            }
          }, parse: function(t5) {
            return h.parse(unescape(encodeURIComponent(t5)));
          } };
          var v = o2.BufferedBlockAlgorithm = u.extend({ reset: function() {
            this._data = new c.init();
            this._nDataBytes = 0;
          }, _append: function(t5) {
            if ("string" == typeof t5)
              t5 = d.parse(t5);
            this._data.concat(t5);
            this._nDataBytes += t5.sigBytes;
          }, _process: function(e4) {
            var r3;
            var i3 = this._data;
            var n2 = i3.words;
            var s2 = i3.sigBytes;
            var a2 = this.blockSize;
            var o22 = 4 * a2;
            var u2 = s2 / o22;
            if (e4)
              u2 = t4.ceil(u2);
            else
              u2 = t4.max((0 | u2) - this._minBufferSize, 0);
            var l2 = u2 * a2;
            var f22 = t4.min(4 * l2, s2);
            if (l2) {
              for (var h2 = 0; h2 < l2; h2 += a2)
                this._doProcessBlock(n2, h2);
              r3 = n2.splice(0, l2);
              i3.sigBytes -= f22;
            }
            return new c.init(r3, f22);
          }, clone: function() {
            var t5 = u.clone.call(this);
            t5._data = this._data.clone();
            return t5;
          }, _minBufferSize: 0 });
          o2.Hasher = v.extend({ cfg: u.extend(), init: function(t5) {
            this.cfg = this.cfg.extend(t5);
            this.reset();
          }, reset: function() {
            v.reset.call(this);
            this._doReset();
          }, update: function(t5) {
            this._append(t5);
            this._process();
            return this;
          }, finalize: function(t5) {
            if (t5)
              this._append(t5);
            var e4 = this._doFinalize();
            return e4;
          }, blockSize: 512 / 32, _createHelper: function(t5) {
            return function(e4, r3) {
              return new t5.init(r3).finalize(e4);
            };
          }, _createHmacHelper: function(t5) {
            return function(e4, r3) {
              return new g.HMAC.init(t5, r3).finalize(e4);
            };
          } });
          var g = a.algo = {};
          return a;
        }(Math);
        return t3;
      });
    }, 8269: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.WordArray;
          var n = e3.enc;
          n.Base64 = { stringify: function(t4) {
            var e4 = t4.words;
            var r4 = t4.sigBytes;
            var i3 = this._map;
            t4.clamp();
            var n2 = [];
            for (var s = 0; s < r4; s += 3) {
              var a2 = e4[s >>> 2] >>> 24 - s % 4 * 8 & 255;
              var o2 = e4[s + 1 >>> 2] >>> 24 - (s + 1) % 4 * 8 & 255;
              var u = e4[s + 2 >>> 2] >>> 24 - (s + 2) % 4 * 8 & 255;
              var c = a2 << 16 | o2 << 8 | u;
              for (var l = 0; l < 4 && s + 0.75 * l < r4; l++)
                n2.push(i3.charAt(c >>> 6 * (3 - l) & 63));
            }
            var f2 = i3.charAt(64);
            if (f2)
              while (n2.length % 4)
                n2.push(f2);
            return n2.join("");
          }, parse: function(t4) {
            var e4 = t4.length;
            var r4 = this._map;
            var i3 = this._reverseMap;
            if (!i3) {
              i3 = this._reverseMap = [];
              for (var n2 = 0; n2 < r4.length; n2++)
                i3[r4.charCodeAt(n2)] = n2;
            }
            var s = r4.charAt(64);
            if (s) {
              var o2 = t4.indexOf(s);
              if (-1 !== o2)
                e4 = o2;
            }
            return a(t4, e4, i3);
          }, _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=" };
          function a(t4, e4, r4) {
            var n2 = [];
            var s = 0;
            for (var a2 = 0; a2 < e4; a2++)
              if (a2 % 4) {
                var o2 = r4[t4.charCodeAt(a2 - 1)] << a2 % 4 * 2;
                var u = r4[t4.charCodeAt(a2)] >>> 6 - a2 % 4 * 2;
                var c = o2 | u;
                n2[s >>> 2] |= c << 24 - s % 4 * 8;
                s++;
              }
            return i2.create(n2, s);
          }
        })();
        return t3.enc.Base64;
      });
    }, 3786: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.WordArray;
          var n = e3.enc;
          n.Base64url = { stringify: function(t4, e4 = true) {
            var r4 = t4.words;
            var i3 = t4.sigBytes;
            var n2 = e4 ? this._safe_map : this._map;
            t4.clamp();
            var s = [];
            for (var a2 = 0; a2 < i3; a2 += 3) {
              var o2 = r4[a2 >>> 2] >>> 24 - a2 % 4 * 8 & 255;
              var u = r4[a2 + 1 >>> 2] >>> 24 - (a2 + 1) % 4 * 8 & 255;
              var c = r4[a2 + 2 >>> 2] >>> 24 - (a2 + 2) % 4 * 8 & 255;
              var l = o2 << 16 | u << 8 | c;
              for (var f2 = 0; f2 < 4 && a2 + 0.75 * f2 < i3; f2++)
                s.push(n2.charAt(l >>> 6 * (3 - f2) & 63));
            }
            var h = n2.charAt(64);
            if (h)
              while (s.length % 4)
                s.push(h);
            return s.join("");
          }, parse: function(t4, e4 = true) {
            var r4 = t4.length;
            var i3 = e4 ? this._safe_map : this._map;
            var n2 = this._reverseMap;
            if (!n2) {
              n2 = this._reverseMap = [];
              for (var s = 0; s < i3.length; s++)
                n2[i3.charCodeAt(s)] = s;
            }
            var o2 = i3.charAt(64);
            if (o2) {
              var u = t4.indexOf(o2);
              if (-1 !== u)
                r4 = u;
            }
            return a(t4, r4, n2);
          }, _map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", _safe_map: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_" };
          function a(t4, e4, r4) {
            var n2 = [];
            var s = 0;
            for (var a2 = 0; a2 < e4; a2++)
              if (a2 % 4) {
                var o2 = r4[t4.charCodeAt(a2 - 1)] << a2 % 4 * 2;
                var u = r4[t4.charCodeAt(a2)] >>> 6 - a2 % 4 * 2;
                var c = o2 | u;
                n2[s >>> 2] |= c << 24 - s % 4 * 8;
                s++;
              }
            return i2.create(n2, s);
          }
        })();
        return t3.enc.Base64url;
      });
    }, 298: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.WordArray;
          var n = e3.enc;
          n.Utf16 = n.Utf16BE = { stringify: function(t4) {
            var e4 = t4.words;
            var r4 = t4.sigBytes;
            var i3 = [];
            for (var n2 = 0; n2 < r4; n2 += 2) {
              var s = e4[n2 >>> 2] >>> 16 - n2 % 4 * 8 & 65535;
              i3.push(String.fromCharCode(s));
            }
            return i3.join("");
          }, parse: function(t4) {
            var e4 = t4.length;
            var r4 = [];
            for (var n2 = 0; n2 < e4; n2++)
              r4[n2 >>> 1] |= t4.charCodeAt(n2) << 16 - n2 % 2 * 16;
            return i2.create(r4, 2 * e4);
          } };
          n.Utf16LE = { stringify: function(t4) {
            var e4 = t4.words;
            var r4 = t4.sigBytes;
            var i3 = [];
            for (var n2 = 0; n2 < r4; n2 += 2) {
              var s = a(e4[n2 >>> 2] >>> 16 - n2 % 4 * 8 & 65535);
              i3.push(String.fromCharCode(s));
            }
            return i3.join("");
          }, parse: function(t4) {
            var e4 = t4.length;
            var r4 = [];
            for (var n2 = 0; n2 < e4; n2++)
              r4[n2 >>> 1] |= a(t4.charCodeAt(n2) << 16 - n2 % 2 * 16);
            return i2.create(r4, 2 * e4);
          } };
          function a(t4) {
            return t4 << 8 & 4278255360 | t4 >>> 8 & 16711935;
          }
        })();
        return t3.enc.Utf16;
      });
    }, 888: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(2783), r2(9824));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.Base;
          var n = r3.WordArray;
          var s = e3.algo;
          var a = s.MD5;
          var o2 = s.EvpKDF = i2.extend({ cfg: i2.extend({ keySize: 128 / 32, hasher: a, iterations: 1 }), init: function(t4) {
            this.cfg = this.cfg.extend(t4);
          }, compute: function(t4, e4) {
            var r4;
            var i3 = this.cfg;
            var s2 = i3.hasher.create();
            var a2 = n.create();
            var o22 = a2.words;
            var u = i3.keySize;
            var c = i3.iterations;
            while (o22.length < u) {
              if (r4)
                s2.update(r4);
              r4 = s2.update(t4).finalize(e4);
              s2.reset();
              for (var l = 1; l < c; l++) {
                r4 = s2.finalize(r4);
                s2.reset();
              }
              a2.concat(r4);
            }
            a2.sigBytes = 4 * u;
            return a2;
          } });
          e3.EvpKDF = function(t4, e4, r4) {
            return o2.create(r4).compute(t4, e4);
          };
        })();
        return t3.EvpKDF;
      });
    }, 2209: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        (function(e3) {
          var r3 = t3;
          var i2 = r3.lib;
          var n = i2.CipherParams;
          var s = r3.enc;
          var a = s.Hex;
          var o2 = r3.format;
          o2.Hex = { stringify: function(t4) {
            return t4.ciphertext.toString(a);
          }, parse: function(t4) {
            var e4 = a.parse(t4);
            return n.create({ ciphertext: e4 });
          } };
        })();
        return t3.format.Hex;
      });
    }, 9824: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.Base;
          var n = e3.enc;
          var s = n.Utf8;
          var a = e3.algo;
          a.HMAC = i2.extend({ init: function(t4, e4) {
            t4 = this._hasher = new t4.init();
            if ("string" == typeof e4)
              e4 = s.parse(e4);
            var r4 = t4.blockSize;
            var i3 = 4 * r4;
            if (e4.sigBytes > i3)
              e4 = t4.finalize(e4);
            e4.clamp();
            var n2 = this._oKey = e4.clone();
            var a2 = this._iKey = e4.clone();
            var o2 = n2.words;
            var u = a2.words;
            for (var c = 0; c < r4; c++) {
              o2[c] ^= 1549556828;
              u[c] ^= 909522486;
            }
            n2.sigBytes = a2.sigBytes = i3;
            this.reset();
          }, reset: function() {
            var t4 = this._hasher;
            t4.reset();
            t4.update(this._iKey);
          }, update: function(t4) {
            this._hasher.update(t4);
            return this;
          }, finalize: function(t4) {
            var e4 = this._hasher;
            var r4 = e4.finalize(t4);
            e4.reset();
            var i3 = e4.finalize(this._oKey.clone().concat(r4));
            return i3;
          } });
        })();
      });
    }, 1354: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(4938), r2(4433), r2(298), r2(8269), r2(3786), r2(8214), r2(2783), r2(2153), r2(7792), r2(34), r2(7460), r2(3327), r2(706), r2(9824), r2(2112), r2(888), r2(5109), r2(8568), r2(4242), r2(9968), r2(7660), r2(1148), r2(3615), r2(2807), r2(1077), r2(6475), r2(6991), r2(2209), r2(452), r2(4253), r2(1857), r2(4454), r2(3974));
      })(this, function(t3) {
        return t3;
      });
    }, 4433: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function() {
          if ("function" != typeof ArrayBuffer)
            return;
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.WordArray;
          var n = i2.init;
          var s = i2.init = function(t4) {
            if (t4 instanceof ArrayBuffer)
              t4 = new Uint8Array(t4);
            if (t4 instanceof Int8Array || "undefined" !== typeof Uint8ClampedArray && t4 instanceof Uint8ClampedArray || t4 instanceof Int16Array || t4 instanceof Uint16Array || t4 instanceof Int32Array || t4 instanceof Uint32Array || t4 instanceof Float32Array || t4 instanceof Float64Array)
              t4 = new Uint8Array(t4.buffer, t4.byteOffset, t4.byteLength);
            if (t4 instanceof Uint8Array) {
              var e4 = t4.byteLength;
              var r4 = [];
              for (var i3 = 0; i3 < e4; i3++)
                r4[i3 >>> 2] |= t4[i3] << 24 - i3 % 4 * 8;
              n.call(this, r4, e4);
            } else
              n.apply(this, arguments);
          };
          s.prototype = i2;
        })();
        return t3.lib.WordArray;
      });
    }, 8214: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function(e3) {
          var r3 = t3;
          var i2 = r3.lib;
          var n = i2.WordArray;
          var s = i2.Hasher;
          var a = r3.algo;
          var o2 = [];
          (function() {
            for (var t4 = 0; t4 < 64; t4++)
              o2[t4] = 4294967296 * e3.abs(e3.sin(t4 + 1)) | 0;
          })();
          var u = a.MD5 = s.extend({ _doReset: function() {
            this._hash = new n.init([1732584193, 4023233417, 2562383102, 271733878]);
          }, _doProcessBlock: function(t4, e4) {
            for (var r4 = 0; r4 < 16; r4++) {
              var i3 = e4 + r4;
              var n2 = t4[i3];
              t4[i3] = 16711935 & (n2 << 8 | n2 >>> 24) | 4278255360 & (n2 << 24 | n2 >>> 8);
            }
            var s2 = this._hash.words;
            var a2 = t4[e4 + 0];
            var u2 = t4[e4 + 1];
            var d = t4[e4 + 2];
            var v = t4[e4 + 3];
            var p = t4[e4 + 4];
            var g = t4[e4 + 5];
            var y = t4[e4 + 6];
            var m = t4[e4 + 7];
            var w = t4[e4 + 8];
            var S = t4[e4 + 9];
            var _ = t4[e4 + 10];
            var b = t4[e4 + 11];
            var E2 = t4[e4 + 12];
            var D = t4[e4 + 13];
            var M = t4[e4 + 14];
            var T = t4[e4 + 15];
            var I = s2[0];
            var A = s2[1];
            var x = s2[2];
            var R = s2[3];
            I = c(I, A, x, R, a2, 7, o2[0]);
            R = c(R, I, A, x, u2, 12, o2[1]);
            x = c(x, R, I, A, d, 17, o2[2]);
            A = c(A, x, R, I, v, 22, o2[3]);
            I = c(I, A, x, R, p, 7, o2[4]);
            R = c(R, I, A, x, g, 12, o2[5]);
            x = c(x, R, I, A, y, 17, o2[6]);
            A = c(A, x, R, I, m, 22, o2[7]);
            I = c(I, A, x, R, w, 7, o2[8]);
            R = c(R, I, A, x, S, 12, o2[9]);
            x = c(x, R, I, A, _, 17, o2[10]);
            A = c(A, x, R, I, b, 22, o2[11]);
            I = c(I, A, x, R, E2, 7, o2[12]);
            R = c(R, I, A, x, D, 12, o2[13]);
            x = c(x, R, I, A, M, 17, o2[14]);
            A = c(A, x, R, I, T, 22, o2[15]);
            I = l(I, A, x, R, u2, 5, o2[16]);
            R = l(R, I, A, x, y, 9, o2[17]);
            x = l(x, R, I, A, b, 14, o2[18]);
            A = l(A, x, R, I, a2, 20, o2[19]);
            I = l(I, A, x, R, g, 5, o2[20]);
            R = l(R, I, A, x, _, 9, o2[21]);
            x = l(x, R, I, A, T, 14, o2[22]);
            A = l(A, x, R, I, p, 20, o2[23]);
            I = l(I, A, x, R, S, 5, o2[24]);
            R = l(R, I, A, x, M, 9, o2[25]);
            x = l(x, R, I, A, v, 14, o2[26]);
            A = l(A, x, R, I, w, 20, o2[27]);
            I = l(I, A, x, R, D, 5, o2[28]);
            R = l(R, I, A, x, d, 9, o2[29]);
            x = l(x, R, I, A, m, 14, o2[30]);
            A = l(A, x, R, I, E2, 20, o2[31]);
            I = f2(I, A, x, R, g, 4, o2[32]);
            R = f2(R, I, A, x, w, 11, o2[33]);
            x = f2(x, R, I, A, b, 16, o2[34]);
            A = f2(A, x, R, I, M, 23, o2[35]);
            I = f2(I, A, x, R, u2, 4, o2[36]);
            R = f2(R, I, A, x, p, 11, o2[37]);
            x = f2(x, R, I, A, m, 16, o2[38]);
            A = f2(A, x, R, I, _, 23, o2[39]);
            I = f2(I, A, x, R, D, 4, o2[40]);
            R = f2(R, I, A, x, a2, 11, o2[41]);
            x = f2(x, R, I, A, v, 16, o2[42]);
            A = f2(A, x, R, I, y, 23, o2[43]);
            I = f2(I, A, x, R, S, 4, o2[44]);
            R = f2(R, I, A, x, E2, 11, o2[45]);
            x = f2(x, R, I, A, T, 16, o2[46]);
            A = f2(A, x, R, I, d, 23, o2[47]);
            I = h(I, A, x, R, a2, 6, o2[48]);
            R = h(R, I, A, x, m, 10, o2[49]);
            x = h(x, R, I, A, M, 15, o2[50]);
            A = h(A, x, R, I, g, 21, o2[51]);
            I = h(I, A, x, R, E2, 6, o2[52]);
            R = h(R, I, A, x, v, 10, o2[53]);
            x = h(x, R, I, A, _, 15, o2[54]);
            A = h(A, x, R, I, u2, 21, o2[55]);
            I = h(I, A, x, R, w, 6, o2[56]);
            R = h(R, I, A, x, T, 10, o2[57]);
            x = h(x, R, I, A, y, 15, o2[58]);
            A = h(A, x, R, I, D, 21, o2[59]);
            I = h(I, A, x, R, p, 6, o2[60]);
            R = h(R, I, A, x, b, 10, o2[61]);
            x = h(x, R, I, A, d, 15, o2[62]);
            A = h(A, x, R, I, S, 21, o2[63]);
            s2[0] = s2[0] + I | 0;
            s2[1] = s2[1] + A | 0;
            s2[2] = s2[2] + x | 0;
            s2[3] = s2[3] + R | 0;
          }, _doFinalize: function() {
            var t4 = this._data;
            var r4 = t4.words;
            var i3 = 8 * this._nDataBytes;
            var n2 = 8 * t4.sigBytes;
            r4[n2 >>> 5] |= 128 << 24 - n2 % 32;
            var s2 = e3.floor(i3 / 4294967296);
            var a2 = i3;
            r4[(n2 + 64 >>> 9 << 4) + 15] = 16711935 & (s2 << 8 | s2 >>> 24) | 4278255360 & (s2 << 24 | s2 >>> 8);
            r4[(n2 + 64 >>> 9 << 4) + 14] = 16711935 & (a2 << 8 | a2 >>> 24) | 4278255360 & (a2 << 24 | a2 >>> 8);
            t4.sigBytes = 4 * (r4.length + 1);
            this._process();
            var o22 = this._hash;
            var u2 = o22.words;
            for (var c2 = 0; c2 < 4; c2++) {
              var l2 = u2[c2];
              u2[c2] = 16711935 & (l2 << 8 | l2 >>> 24) | 4278255360 & (l2 << 24 | l2 >>> 8);
            }
            return o22;
          }, clone: function() {
            var t4 = s.clone.call(this);
            t4._hash = this._hash.clone();
            return t4;
          } });
          function c(t4, e4, r4, i3, n2, s2, a2) {
            var o22 = t4 + (e4 & r4 | ~e4 & i3) + n2 + a2;
            return (o22 << s2 | o22 >>> 32 - s2) + e4;
          }
          function l(t4, e4, r4, i3, n2, s2, a2) {
            var o22 = t4 + (e4 & i3 | r4 & ~i3) + n2 + a2;
            return (o22 << s2 | o22 >>> 32 - s2) + e4;
          }
          function f2(t4, e4, r4, i3, n2, s2, a2) {
            var o22 = t4 + (e4 ^ r4 ^ i3) + n2 + a2;
            return (o22 << s2 | o22 >>> 32 - s2) + e4;
          }
          function h(t4, e4, r4, i3, n2, s2, a2) {
            var o22 = t4 + (r4 ^ (e4 | ~i3)) + n2 + a2;
            return (o22 << s2 | o22 >>> 32 - s2) + e4;
          }
          r3.MD5 = s._createHelper(u);
          r3.HmacMD5 = s._createHmacHelper(u);
        })(Math);
        return t3.MD5;
      });
    }, 8568: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.mode.CFB = function() {
          var e3 = t3.lib.BlockCipherMode.extend();
          e3.Encryptor = e3.extend({ processBlock: function(t4, e4) {
            var i2 = this._cipher;
            var n = i2.blockSize;
            r3.call(this, t4, e4, n, i2);
            this._prevBlock = t4.slice(e4, e4 + n);
          } });
          e3.Decryptor = e3.extend({ processBlock: function(t4, e4) {
            var i2 = this._cipher;
            var n = i2.blockSize;
            var s = t4.slice(e4, e4 + n);
            r3.call(this, t4, e4, n, i2);
            this._prevBlock = s;
          } });
          function r3(t4, e4, r4, i2) {
            var n;
            var s = this._iv;
            if (s) {
              n = s.slice(0);
              this._iv = void 0;
            } else
              n = this._prevBlock;
            i2.encryptBlock(n, 0);
            for (var a = 0; a < r4; a++)
              t4[e4 + a] ^= n[a];
          }
          return e3;
        }();
        return t3.mode.CFB;
      });
    }, 9968: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.mode.CTRGladman = function() {
          var e3 = t3.lib.BlockCipherMode.extend();
          function r3(t4) {
            if (255 === (t4 >> 24 & 255)) {
              var e4 = t4 >> 16 & 255;
              var r4 = t4 >> 8 & 255;
              var i3 = 255 & t4;
              if (255 === e4) {
                e4 = 0;
                if (255 === r4) {
                  r4 = 0;
                  if (255 === i3)
                    i3 = 0;
                  else
                    ++i3;
                } else
                  ++r4;
              } else
                ++e4;
              t4 = 0;
              t4 += e4 << 16;
              t4 += r4 << 8;
              t4 += i3;
            } else
              t4 += 1 << 24;
            return t4;
          }
          function i2(t4) {
            if (0 === (t4[0] = r3(t4[0])))
              t4[1] = r3(t4[1]);
            return t4;
          }
          var n = e3.Encryptor = e3.extend({ processBlock: function(t4, e4) {
            var r4 = this._cipher;
            var n2 = r4.blockSize;
            var s = this._iv;
            var a = this._counter;
            if (s) {
              a = this._counter = s.slice(0);
              this._iv = void 0;
            }
            i2(a);
            var o2 = a.slice(0);
            r4.encryptBlock(o2, 0);
            for (var u = 0; u < n2; u++)
              t4[e4 + u] ^= o2[u];
          } });
          e3.Decryptor = n;
          return e3;
        }();
        return t3.mode.CTRGladman;
      });
    }, 4242: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.mode.CTR = function() {
          var e3 = t3.lib.BlockCipherMode.extend();
          var r3 = e3.Encryptor = e3.extend({ processBlock: function(t4, e4) {
            var r4 = this._cipher;
            var i2 = r4.blockSize;
            var n = this._iv;
            var s = this._counter;
            if (n) {
              s = this._counter = n.slice(0);
              this._iv = void 0;
            }
            var a = s.slice(0);
            r4.encryptBlock(a, 0);
            s[i2 - 1] = s[i2 - 1] + 1 | 0;
            for (var o2 = 0; o2 < i2; o2++)
              t4[e4 + o2] ^= a[o2];
          } });
          e3.Decryptor = r3;
          return e3;
        }();
        return t3.mode.CTR;
      });
    }, 1148: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.mode.ECB = function() {
          var e3 = t3.lib.BlockCipherMode.extend();
          e3.Encryptor = e3.extend({ processBlock: function(t4, e4) {
            this._cipher.encryptBlock(t4, e4);
          } });
          e3.Decryptor = e3.extend({ processBlock: function(t4, e4) {
            this._cipher.decryptBlock(t4, e4);
          } });
          return e3;
        }();
        return t3.mode.ECB;
      });
    }, 7660: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.mode.OFB = function() {
          var e3 = t3.lib.BlockCipherMode.extend();
          var r3 = e3.Encryptor = e3.extend({ processBlock: function(t4, e4) {
            var r4 = this._cipher;
            var i2 = r4.blockSize;
            var n = this._iv;
            var s = this._keystream;
            if (n) {
              s = this._keystream = n.slice(0);
              this._iv = void 0;
            }
            r4.encryptBlock(s, 0);
            for (var a = 0; a < i2; a++)
              t4[e4 + a] ^= s[a];
          } });
          e3.Decryptor = r3;
          return e3;
        }();
        return t3.mode.OFB;
      });
    }, 3615: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.pad.AnsiX923 = { pad: function(t4, e3) {
          var r3 = t4.sigBytes;
          var i2 = 4 * e3;
          var n = i2 - r3 % i2;
          var s = r3 + n - 1;
          t4.clamp();
          t4.words[s >>> 2] |= n << 24 - s % 4 * 8;
          t4.sigBytes += n;
        }, unpad: function(t4) {
          var e3 = 255 & t4.words[t4.sigBytes - 1 >>> 2];
          t4.sigBytes -= e3;
        } };
        return t3.pad.Ansix923;
      });
    }, 2807: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.pad.Iso10126 = { pad: function(e3, r3) {
          var i2 = 4 * r3;
          var n = i2 - e3.sigBytes % i2;
          e3.concat(t3.lib.WordArray.random(n - 1)).concat(t3.lib.WordArray.create([n << 24], 1));
        }, unpad: function(t4) {
          var e3 = 255 & t4.words[t4.sigBytes - 1 >>> 2];
          t4.sigBytes -= e3;
        } };
        return t3.pad.Iso10126;
      });
    }, 1077: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.pad.Iso97971 = { pad: function(e3, r3) {
          e3.concat(t3.lib.WordArray.create([2147483648], 1));
          t3.pad.ZeroPadding.pad(e3, r3);
        }, unpad: function(e3) {
          t3.pad.ZeroPadding.unpad(e3);
          e3.sigBytes--;
        } };
        return t3.pad.Iso97971;
      });
    }, 6991: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.pad.NoPadding = { pad: function() {
        }, unpad: function() {
        } };
        return t3.pad.NoPadding;
      });
    }, 6475: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(5109));
      })(this, function(t3) {
        t3.pad.ZeroPadding = { pad: function(t4, e3) {
          var r3 = 4 * e3;
          t4.clamp();
          t4.sigBytes += r3 - (t4.sigBytes % r3 || r3);
        }, unpad: function(t4) {
          var e3 = t4.words;
          var r3 = t4.sigBytes - 1;
          for (var r3 = t4.sigBytes - 1; r3 >= 0; r3--)
            if (e3[r3 >>> 2] >>> 24 - r3 % 4 * 8 & 255) {
              t4.sigBytes = r3 + 1;
              break;
            }
        } };
        return t3.pad.ZeroPadding;
      });
    }, 2112: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(2783), r2(9824));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.Base;
          var n = r3.WordArray;
          var s = e3.algo;
          var a = s.SHA1;
          var o2 = s.HMAC;
          var u = s.PBKDF2 = i2.extend({ cfg: i2.extend({ keySize: 128 / 32, hasher: a, iterations: 1 }), init: function(t4) {
            this.cfg = this.cfg.extend(t4);
          }, compute: function(t4, e4) {
            var r4 = this.cfg;
            var i3 = o2.create(r4.hasher, t4);
            var s2 = n.create();
            var a2 = n.create([1]);
            var u2 = s2.words;
            var c = a2.words;
            var l = r4.keySize;
            var f2 = r4.iterations;
            while (u2.length < l) {
              var h = i3.update(e4).finalize(a2);
              i3.reset();
              var d = h.words;
              var v = d.length;
              var p = h;
              for (var g = 1; g < f2; g++) {
                p = i3.finalize(p);
                i3.reset();
                var y = p.words;
                for (var m = 0; m < v; m++)
                  d[m] ^= y[m];
              }
              s2.concat(h);
              c[0]++;
            }
            s2.sigBytes = 4 * l;
            return s2;
          } });
          e3.PBKDF2 = function(t4, e4, r4) {
            return u.create(r4).compute(t4, e4);
          };
        })();
        return t3.PBKDF2;
      });
    }, 3974: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(8269), r2(8214), r2(888), r2(5109));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.StreamCipher;
          var n = e3.algo;
          var s = [];
          var a = [];
          var o2 = [];
          var u = n.RabbitLegacy = i2.extend({ _doReset: function() {
            var t4 = this._key.words;
            var e4 = this.cfg.iv;
            var r4 = this._X = [t4[0], t4[3] << 16 | t4[2] >>> 16, t4[1], t4[0] << 16 | t4[3] >>> 16, t4[2], t4[1] << 16 | t4[0] >>> 16, t4[3], t4[2] << 16 | t4[1] >>> 16];
            var i3 = this._C = [t4[2] << 16 | t4[2] >>> 16, 4294901760 & t4[0] | 65535 & t4[1], t4[3] << 16 | t4[3] >>> 16, 4294901760 & t4[1] | 65535 & t4[2], t4[0] << 16 | t4[0] >>> 16, 4294901760 & t4[2] | 65535 & t4[3], t4[1] << 16 | t4[1] >>> 16, 4294901760 & t4[3] | 65535 & t4[0]];
            this._b = 0;
            for (var n2 = 0; n2 < 4; n2++)
              c.call(this);
            for (var n2 = 0; n2 < 8; n2++)
              i3[n2] ^= r4[n2 + 4 & 7];
            if (e4) {
              var s2 = e4.words;
              var a2 = s2[0];
              var o22 = s2[1];
              var u2 = 16711935 & (a2 << 8 | a2 >>> 24) | 4278255360 & (a2 << 24 | a2 >>> 8);
              var l = 16711935 & (o22 << 8 | o22 >>> 24) | 4278255360 & (o22 << 24 | o22 >>> 8);
              var f2 = u2 >>> 16 | 4294901760 & l;
              var h = l << 16 | 65535 & u2;
              i3[0] ^= u2;
              i3[1] ^= f2;
              i3[2] ^= l;
              i3[3] ^= h;
              i3[4] ^= u2;
              i3[5] ^= f2;
              i3[6] ^= l;
              i3[7] ^= h;
              for (var n2 = 0; n2 < 4; n2++)
                c.call(this);
            }
          }, _doProcessBlock: function(t4, e4) {
            var r4 = this._X;
            c.call(this);
            s[0] = r4[0] ^ r4[5] >>> 16 ^ r4[3] << 16;
            s[1] = r4[2] ^ r4[7] >>> 16 ^ r4[5] << 16;
            s[2] = r4[4] ^ r4[1] >>> 16 ^ r4[7] << 16;
            s[3] = r4[6] ^ r4[3] >>> 16 ^ r4[1] << 16;
            for (var i3 = 0; i3 < 4; i3++) {
              s[i3] = 16711935 & (s[i3] << 8 | s[i3] >>> 24) | 4278255360 & (s[i3] << 24 | s[i3] >>> 8);
              t4[e4 + i3] ^= s[i3];
            }
          }, blockSize: 128 / 32, ivSize: 64 / 32 });
          function c() {
            var t4 = this._X;
            var e4 = this._C;
            for (var r4 = 0; r4 < 8; r4++)
              a[r4] = e4[r4];
            e4[0] = e4[0] + 1295307597 + this._b | 0;
            e4[1] = e4[1] + 3545052371 + (e4[0] >>> 0 < a[0] >>> 0 ? 1 : 0) | 0;
            e4[2] = e4[2] + 886263092 + (e4[1] >>> 0 < a[1] >>> 0 ? 1 : 0) | 0;
            e4[3] = e4[3] + 1295307597 + (e4[2] >>> 0 < a[2] >>> 0 ? 1 : 0) | 0;
            e4[4] = e4[4] + 3545052371 + (e4[3] >>> 0 < a[3] >>> 0 ? 1 : 0) | 0;
            e4[5] = e4[5] + 886263092 + (e4[4] >>> 0 < a[4] >>> 0 ? 1 : 0) | 0;
            e4[6] = e4[6] + 1295307597 + (e4[5] >>> 0 < a[5] >>> 0 ? 1 : 0) | 0;
            e4[7] = e4[7] + 3545052371 + (e4[6] >>> 0 < a[6] >>> 0 ? 1 : 0) | 0;
            this._b = e4[7] >>> 0 < a[7] >>> 0 ? 1 : 0;
            for (var r4 = 0; r4 < 8; r4++) {
              var i3 = t4[r4] + e4[r4];
              var n2 = 65535 & i3;
              var s2 = i3 >>> 16;
              var u2 = ((n2 * n2 >>> 17) + n2 * s2 >>> 15) + s2 * s2;
              var c2 = ((4294901760 & i3) * i3 | 0) + ((65535 & i3) * i3 | 0);
              o2[r4] = u2 ^ c2;
            }
            t4[0] = o2[0] + (o2[7] << 16 | o2[7] >>> 16) + (o2[6] << 16 | o2[6] >>> 16) | 0;
            t4[1] = o2[1] + (o2[0] << 8 | o2[0] >>> 24) + o2[7] | 0;
            t4[2] = o2[2] + (o2[1] << 16 | o2[1] >>> 16) + (o2[0] << 16 | o2[0] >>> 16) | 0;
            t4[3] = o2[3] + (o2[2] << 8 | o2[2] >>> 24) + o2[1] | 0;
            t4[4] = o2[4] + (o2[3] << 16 | o2[3] >>> 16) + (o2[2] << 16 | o2[2] >>> 16) | 0;
            t4[5] = o2[5] + (o2[4] << 8 | o2[4] >>> 24) + o2[3] | 0;
            t4[6] = o2[6] + (o2[5] << 16 | o2[5] >>> 16) + (o2[4] << 16 | o2[4] >>> 16) | 0;
            t4[7] = o2[7] + (o2[6] << 8 | o2[6] >>> 24) + o2[5] | 0;
          }
          e3.RabbitLegacy = i2._createHelper(u);
        })();
        return t3.RabbitLegacy;
      });
    }, 4454: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(8269), r2(8214), r2(888), r2(5109));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.StreamCipher;
          var n = e3.algo;
          var s = [];
          var a = [];
          var o2 = [];
          var u = n.Rabbit = i2.extend({ _doReset: function() {
            var t4 = this._key.words;
            var e4 = this.cfg.iv;
            for (var r4 = 0; r4 < 4; r4++)
              t4[r4] = 16711935 & (t4[r4] << 8 | t4[r4] >>> 24) | 4278255360 & (t4[r4] << 24 | t4[r4] >>> 8);
            var i3 = this._X = [t4[0], t4[3] << 16 | t4[2] >>> 16, t4[1], t4[0] << 16 | t4[3] >>> 16, t4[2], t4[1] << 16 | t4[0] >>> 16, t4[3], t4[2] << 16 | t4[1] >>> 16];
            var n2 = this._C = [t4[2] << 16 | t4[2] >>> 16, 4294901760 & t4[0] | 65535 & t4[1], t4[3] << 16 | t4[3] >>> 16, 4294901760 & t4[1] | 65535 & t4[2], t4[0] << 16 | t4[0] >>> 16, 4294901760 & t4[2] | 65535 & t4[3], t4[1] << 16 | t4[1] >>> 16, 4294901760 & t4[3] | 65535 & t4[0]];
            this._b = 0;
            for (var r4 = 0; r4 < 4; r4++)
              c.call(this);
            for (var r4 = 0; r4 < 8; r4++)
              n2[r4] ^= i3[r4 + 4 & 7];
            if (e4) {
              var s2 = e4.words;
              var a2 = s2[0];
              var o22 = s2[1];
              var u2 = 16711935 & (a2 << 8 | a2 >>> 24) | 4278255360 & (a2 << 24 | a2 >>> 8);
              var l = 16711935 & (o22 << 8 | o22 >>> 24) | 4278255360 & (o22 << 24 | o22 >>> 8);
              var f2 = u2 >>> 16 | 4294901760 & l;
              var h = l << 16 | 65535 & u2;
              n2[0] ^= u2;
              n2[1] ^= f2;
              n2[2] ^= l;
              n2[3] ^= h;
              n2[4] ^= u2;
              n2[5] ^= f2;
              n2[6] ^= l;
              n2[7] ^= h;
              for (var r4 = 0; r4 < 4; r4++)
                c.call(this);
            }
          }, _doProcessBlock: function(t4, e4) {
            var r4 = this._X;
            c.call(this);
            s[0] = r4[0] ^ r4[5] >>> 16 ^ r4[3] << 16;
            s[1] = r4[2] ^ r4[7] >>> 16 ^ r4[5] << 16;
            s[2] = r4[4] ^ r4[1] >>> 16 ^ r4[7] << 16;
            s[3] = r4[6] ^ r4[3] >>> 16 ^ r4[1] << 16;
            for (var i3 = 0; i3 < 4; i3++) {
              s[i3] = 16711935 & (s[i3] << 8 | s[i3] >>> 24) | 4278255360 & (s[i3] << 24 | s[i3] >>> 8);
              t4[e4 + i3] ^= s[i3];
            }
          }, blockSize: 128 / 32, ivSize: 64 / 32 });
          function c() {
            var t4 = this._X;
            var e4 = this._C;
            for (var r4 = 0; r4 < 8; r4++)
              a[r4] = e4[r4];
            e4[0] = e4[0] + 1295307597 + this._b | 0;
            e4[1] = e4[1] + 3545052371 + (e4[0] >>> 0 < a[0] >>> 0 ? 1 : 0) | 0;
            e4[2] = e4[2] + 886263092 + (e4[1] >>> 0 < a[1] >>> 0 ? 1 : 0) | 0;
            e4[3] = e4[3] + 1295307597 + (e4[2] >>> 0 < a[2] >>> 0 ? 1 : 0) | 0;
            e4[4] = e4[4] + 3545052371 + (e4[3] >>> 0 < a[3] >>> 0 ? 1 : 0) | 0;
            e4[5] = e4[5] + 886263092 + (e4[4] >>> 0 < a[4] >>> 0 ? 1 : 0) | 0;
            e4[6] = e4[6] + 1295307597 + (e4[5] >>> 0 < a[5] >>> 0 ? 1 : 0) | 0;
            e4[7] = e4[7] + 3545052371 + (e4[6] >>> 0 < a[6] >>> 0 ? 1 : 0) | 0;
            this._b = e4[7] >>> 0 < a[7] >>> 0 ? 1 : 0;
            for (var r4 = 0; r4 < 8; r4++) {
              var i3 = t4[r4] + e4[r4];
              var n2 = 65535 & i3;
              var s2 = i3 >>> 16;
              var u2 = ((n2 * n2 >>> 17) + n2 * s2 >>> 15) + s2 * s2;
              var c2 = ((4294901760 & i3) * i3 | 0) + ((65535 & i3) * i3 | 0);
              o2[r4] = u2 ^ c2;
            }
            t4[0] = o2[0] + (o2[7] << 16 | o2[7] >>> 16) + (o2[6] << 16 | o2[6] >>> 16) | 0;
            t4[1] = o2[1] + (o2[0] << 8 | o2[0] >>> 24) + o2[7] | 0;
            t4[2] = o2[2] + (o2[1] << 16 | o2[1] >>> 16) + (o2[0] << 16 | o2[0] >>> 16) | 0;
            t4[3] = o2[3] + (o2[2] << 8 | o2[2] >>> 24) + o2[1] | 0;
            t4[4] = o2[4] + (o2[3] << 16 | o2[3] >>> 16) + (o2[2] << 16 | o2[2] >>> 16) | 0;
            t4[5] = o2[5] + (o2[4] << 8 | o2[4] >>> 24) + o2[3] | 0;
            t4[6] = o2[6] + (o2[5] << 16 | o2[5] >>> 16) + (o2[4] << 16 | o2[4] >>> 16) | 0;
            t4[7] = o2[7] + (o2[6] << 8 | o2[6] >>> 24) + o2[5] | 0;
          }
          e3.Rabbit = i2._createHelper(u);
        })();
        return t3.Rabbit;
      });
    }, 1857: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(8269), r2(8214), r2(888), r2(5109));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.StreamCipher;
          var n = e3.algo;
          var s = n.RC4 = i2.extend({ _doReset: function() {
            var t4 = this._key;
            var e4 = t4.words;
            var r4 = t4.sigBytes;
            var i3 = this._S = [];
            for (var n2 = 0; n2 < 256; n2++)
              i3[n2] = n2;
            for (var n2 = 0, s2 = 0; n2 < 256; n2++) {
              var a2 = n2 % r4;
              var o22 = e4[a2 >>> 2] >>> 24 - a2 % 4 * 8 & 255;
              s2 = (s2 + i3[n2] + o22) % 256;
              var u = i3[n2];
              i3[n2] = i3[s2];
              i3[s2] = u;
            }
            this._i = this._j = 0;
          }, _doProcessBlock: function(t4, e4) {
            t4[e4] ^= a.call(this);
          }, keySize: 256 / 32, ivSize: 0 });
          function a() {
            var t4 = this._S;
            var e4 = this._i;
            var r4 = this._j;
            var i3 = 0;
            for (var n2 = 0; n2 < 4; n2++) {
              e4 = (e4 + 1) % 256;
              r4 = (r4 + t4[e4]) % 256;
              var s2 = t4[e4];
              t4[e4] = t4[r4];
              t4[r4] = s2;
              i3 |= t4[(t4[e4] + t4[r4]) % 256] << 24 - 8 * n2;
            }
            this._i = e4;
            this._j = r4;
            return i3;
          }
          e3.RC4 = i2._createHelper(s);
          var o2 = n.RC4Drop = s.extend({ cfg: s.cfg.extend({ drop: 192 }), _doReset: function() {
            s._doReset.call(this);
            for (var t4 = this.cfg.drop; t4 > 0; t4--)
              a.call(this);
          } });
          e3.RC4Drop = i2._createHelper(o2);
        })();
        return t3.RC4;
      });
    }, 706: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function(e3) {
          var r3 = t3;
          var i2 = r3.lib;
          var n = i2.WordArray;
          var s = i2.Hasher;
          var a = r3.algo;
          var o2 = n.create([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13]);
          var u = n.create([5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11]);
          var c = n.create([11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6]);
          var l = n.create([8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11]);
          var f2 = n.create([0, 1518500249, 1859775393, 2400959708, 2840853838]);
          var h = n.create([1352829926, 1548603684, 1836072691, 2053994217, 0]);
          var d = a.RIPEMD160 = s.extend({ _doReset: function() {
            this._hash = n.create([1732584193, 4023233417, 2562383102, 271733878, 3285377520]);
          }, _doProcessBlock: function(t4, e4) {
            for (var r4 = 0; r4 < 16; r4++) {
              var i3 = e4 + r4;
              var n2 = t4[i3];
              t4[i3] = 16711935 & (n2 << 8 | n2 >>> 24) | 4278255360 & (n2 << 24 | n2 >>> 8);
            }
            var s2 = this._hash.words;
            var a2 = f2.words;
            var d2 = h.words;
            var S = o2.words;
            var _ = u.words;
            var b = c.words;
            var E2 = l.words;
            var D, M, T, I, A;
            var x, R, B, O, k;
            x = D = s2[0];
            R = M = s2[1];
            B = T = s2[2];
            O = I = s2[3];
            k = A = s2[4];
            var C;
            for (var r4 = 0; r4 < 80; r4 += 1) {
              C = D + t4[e4 + S[r4]] | 0;
              if (r4 < 16)
                C += v(M, T, I) + a2[0];
              else if (r4 < 32)
                C += p(M, T, I) + a2[1];
              else if (r4 < 48)
                C += g(M, T, I) + a2[2];
              else if (r4 < 64)
                C += y(M, T, I) + a2[3];
              else
                C += m(M, T, I) + a2[4];
              C |= 0;
              C = w(C, b[r4]);
              C = C + A | 0;
              D = A;
              A = I;
              I = w(T, 10);
              T = M;
              M = C;
              C = x + t4[e4 + _[r4]] | 0;
              if (r4 < 16)
                C += m(R, B, O) + d2[0];
              else if (r4 < 32)
                C += y(R, B, O) + d2[1];
              else if (r4 < 48)
                C += g(R, B, O) + d2[2];
              else if (r4 < 64)
                C += p(R, B, O) + d2[3];
              else
                C += v(R, B, O) + d2[4];
              C |= 0;
              C = w(C, E2[r4]);
              C = C + k | 0;
              x = k;
              k = O;
              O = w(B, 10);
              B = R;
              R = C;
            }
            C = s2[1] + T + O | 0;
            s2[1] = s2[2] + I + k | 0;
            s2[2] = s2[3] + A + x | 0;
            s2[3] = s2[4] + D + R | 0;
            s2[4] = s2[0] + M + B | 0;
            s2[0] = C;
          }, _doFinalize: function() {
            var t4 = this._data;
            var e4 = t4.words;
            var r4 = 8 * this._nDataBytes;
            var i3 = 8 * t4.sigBytes;
            e4[i3 >>> 5] |= 128 << 24 - i3 % 32;
            e4[(i3 + 64 >>> 9 << 4) + 14] = 16711935 & (r4 << 8 | r4 >>> 24) | 4278255360 & (r4 << 24 | r4 >>> 8);
            t4.sigBytes = 4 * (e4.length + 1);
            this._process();
            var n2 = this._hash;
            var s2 = n2.words;
            for (var a2 = 0; a2 < 5; a2++) {
              var o22 = s2[a2];
              s2[a2] = 16711935 & (o22 << 8 | o22 >>> 24) | 4278255360 & (o22 << 24 | o22 >>> 8);
            }
            return n2;
          }, clone: function() {
            var t4 = s.clone.call(this);
            t4._hash = this._hash.clone();
            return t4;
          } });
          function v(t4, e4, r4) {
            return t4 ^ e4 ^ r4;
          }
          function p(t4, e4, r4) {
            return t4 & e4 | ~t4 & r4;
          }
          function g(t4, e4, r4) {
            return (t4 | ~e4) ^ r4;
          }
          function y(t4, e4, r4) {
            return t4 & r4 | e4 & ~r4;
          }
          function m(t4, e4, r4) {
            return t4 ^ (e4 | ~r4);
          }
          function w(t4, e4) {
            return t4 << e4 | t4 >>> 32 - e4;
          }
          r3.RIPEMD160 = s._createHelper(d);
          r3.HmacRIPEMD160 = s._createHmacHelper(d);
        })();
        return t3.RIPEMD160;
      });
    }, 2783: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.WordArray;
          var n = r3.Hasher;
          var s = e3.algo;
          var a = [];
          var o2 = s.SHA1 = n.extend({ _doReset: function() {
            this._hash = new i2.init([1732584193, 4023233417, 2562383102, 271733878, 3285377520]);
          }, _doProcessBlock: function(t4, e4) {
            var r4 = this._hash.words;
            var i3 = r4[0];
            var n2 = r4[1];
            var s2 = r4[2];
            var o22 = r4[3];
            var u = r4[4];
            for (var c = 0; c < 80; c++) {
              if (c < 16)
                a[c] = 0 | t4[e4 + c];
              else {
                var l = a[c - 3] ^ a[c - 8] ^ a[c - 14] ^ a[c - 16];
                a[c] = l << 1 | l >>> 31;
              }
              var f2 = (i3 << 5 | i3 >>> 27) + u + a[c];
              if (c < 20)
                f2 += (n2 & s2 | ~n2 & o22) + 1518500249;
              else if (c < 40)
                f2 += (n2 ^ s2 ^ o22) + 1859775393;
              else if (c < 60)
                f2 += (n2 & s2 | n2 & o22 | s2 & o22) - 1894007588;
              else
                f2 += (n2 ^ s2 ^ o22) - 899497514;
              u = o22;
              o22 = s2;
              s2 = n2 << 30 | n2 >>> 2;
              n2 = i3;
              i3 = f2;
            }
            r4[0] = r4[0] + i3 | 0;
            r4[1] = r4[1] + n2 | 0;
            r4[2] = r4[2] + s2 | 0;
            r4[3] = r4[3] + o22 | 0;
            r4[4] = r4[4] + u | 0;
          }, _doFinalize: function() {
            var t4 = this._data;
            var e4 = t4.words;
            var r4 = 8 * this._nDataBytes;
            var i3 = 8 * t4.sigBytes;
            e4[i3 >>> 5] |= 128 << 24 - i3 % 32;
            e4[(i3 + 64 >>> 9 << 4) + 14] = Math.floor(r4 / 4294967296);
            e4[(i3 + 64 >>> 9 << 4) + 15] = r4;
            t4.sigBytes = 4 * e4.length;
            this._process();
            return this._hash;
          }, clone: function() {
            var t4 = n.clone.call(this);
            t4._hash = this._hash.clone();
            return t4;
          } });
          e3.SHA1 = n._createHelper(o2);
          e3.HmacSHA1 = n._createHmacHelper(o2);
        })();
        return t3.SHA1;
      });
    }, 7792: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(2153));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.WordArray;
          var n = e3.algo;
          var s = n.SHA256;
          var a = n.SHA224 = s.extend({ _doReset: function() {
            this._hash = new i2.init([3238371032, 914150663, 812702999, 4144912697, 4290775857, 1750603025, 1694076839, 3204075428]);
          }, _doFinalize: function() {
            var t4 = s._doFinalize.call(this);
            t4.sigBytes -= 4;
            return t4;
          } });
          e3.SHA224 = s._createHelper(a);
          e3.HmacSHA224 = s._createHmacHelper(a);
        })();
        return t3.SHA224;
      });
    }, 2153: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function(e3) {
          var r3 = t3;
          var i2 = r3.lib;
          var n = i2.WordArray;
          var s = i2.Hasher;
          var a = r3.algo;
          var o2 = [];
          var u = [];
          (function() {
            function t4(t5) {
              var r5 = e3.sqrt(t5);
              for (var i4 = 2; i4 <= r5; i4++)
                if (!(t5 % i4))
                  return false;
              return true;
            }
            function r4(t5) {
              return 4294967296 * (t5 - (0 | t5)) | 0;
            }
            var i3 = 2;
            var n2 = 0;
            while (n2 < 64) {
              if (t4(i3)) {
                if (n2 < 8)
                  o2[n2] = r4(e3.pow(i3, 1 / 2));
                u[n2] = r4(e3.pow(i3, 1 / 3));
                n2++;
              }
              i3++;
            }
          })();
          var c = [];
          var l = a.SHA256 = s.extend({ _doReset: function() {
            this._hash = new n.init(o2.slice(0));
          }, _doProcessBlock: function(t4, e4) {
            var r4 = this._hash.words;
            var i3 = r4[0];
            var n2 = r4[1];
            var s2 = r4[2];
            var a2 = r4[3];
            var o22 = r4[4];
            var l2 = r4[5];
            var f2 = r4[6];
            var h = r4[7];
            for (var d = 0; d < 64; d++) {
              if (d < 16)
                c[d] = 0 | t4[e4 + d];
              else {
                var v = c[d - 15];
                var p = (v << 25 | v >>> 7) ^ (v << 14 | v >>> 18) ^ v >>> 3;
                var g = c[d - 2];
                var y = (g << 15 | g >>> 17) ^ (g << 13 | g >>> 19) ^ g >>> 10;
                c[d] = p + c[d - 7] + y + c[d - 16];
              }
              var m = o22 & l2 ^ ~o22 & f2;
              var w = i3 & n2 ^ i3 & s2 ^ n2 & s2;
              var S = (i3 << 30 | i3 >>> 2) ^ (i3 << 19 | i3 >>> 13) ^ (i3 << 10 | i3 >>> 22);
              var _ = (o22 << 26 | o22 >>> 6) ^ (o22 << 21 | o22 >>> 11) ^ (o22 << 7 | o22 >>> 25);
              var b = h + _ + m + u[d] + c[d];
              var E2 = S + w;
              h = f2;
              f2 = l2;
              l2 = o22;
              o22 = a2 + b | 0;
              a2 = s2;
              s2 = n2;
              n2 = i3;
              i3 = b + E2 | 0;
            }
            r4[0] = r4[0] + i3 | 0;
            r4[1] = r4[1] + n2 | 0;
            r4[2] = r4[2] + s2 | 0;
            r4[3] = r4[3] + a2 | 0;
            r4[4] = r4[4] + o22 | 0;
            r4[5] = r4[5] + l2 | 0;
            r4[6] = r4[6] + f2 | 0;
            r4[7] = r4[7] + h | 0;
          }, _doFinalize: function() {
            var t4 = this._data;
            var r4 = t4.words;
            var i3 = 8 * this._nDataBytes;
            var n2 = 8 * t4.sigBytes;
            r4[n2 >>> 5] |= 128 << 24 - n2 % 32;
            r4[(n2 + 64 >>> 9 << 4) + 14] = e3.floor(i3 / 4294967296);
            r4[(n2 + 64 >>> 9 << 4) + 15] = i3;
            t4.sigBytes = 4 * r4.length;
            this._process();
            return this._hash;
          }, clone: function() {
            var t4 = s.clone.call(this);
            t4._hash = this._hash.clone();
            return t4;
          } });
          r3.SHA256 = s._createHelper(l);
          r3.HmacSHA256 = s._createHmacHelper(l);
        })(Math);
        return t3.SHA256;
      });
    }, 3327: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(4938));
      })(this, function(t3) {
        (function(e3) {
          var r3 = t3;
          var i2 = r3.lib;
          var n = i2.WordArray;
          var s = i2.Hasher;
          var a = r3.x64;
          var o2 = a.Word;
          var u = r3.algo;
          var c = [];
          var l = [];
          var f2 = [];
          (function() {
            var t4 = 1, e4 = 0;
            for (var r4 = 0; r4 < 24; r4++) {
              c[t4 + 5 * e4] = (r4 + 1) * (r4 + 2) / 2 % 64;
              var i3 = e4 % 5;
              var n2 = (2 * t4 + 3 * e4) % 5;
              t4 = i3;
              e4 = n2;
            }
            for (var t4 = 0; t4 < 5; t4++)
              for (var e4 = 0; e4 < 5; e4++)
                l[t4 + 5 * e4] = e4 + (2 * t4 + 3 * e4) % 5 * 5;
            var s2 = 1;
            for (var a2 = 0; a2 < 24; a2++) {
              var u2 = 0;
              var h2 = 0;
              for (var d2 = 0; d2 < 7; d2++) {
                if (1 & s2) {
                  var v = (1 << d2) - 1;
                  if (v < 32)
                    h2 ^= 1 << v;
                  else
                    u2 ^= 1 << v - 32;
                }
                if (128 & s2)
                  s2 = s2 << 1 ^ 113;
                else
                  s2 <<= 1;
              }
              f2[a2] = o2.create(u2, h2);
            }
          })();
          var h = [];
          (function() {
            for (var t4 = 0; t4 < 25; t4++)
              h[t4] = o2.create();
          })();
          var d = u.SHA3 = s.extend({ cfg: s.cfg.extend({ outputLength: 512 }), _doReset: function() {
            var t4 = this._state = [];
            for (var e4 = 0; e4 < 25; e4++)
              t4[e4] = new o2.init();
            this.blockSize = (1600 - 2 * this.cfg.outputLength) / 32;
          }, _doProcessBlock: function(t4, e4) {
            var r4 = this._state;
            var i3 = this.blockSize / 2;
            for (var n2 = 0; n2 < i3; n2++) {
              var s2 = t4[e4 + 2 * n2];
              var a2 = t4[e4 + 2 * n2 + 1];
              s2 = 16711935 & (s2 << 8 | s2 >>> 24) | 4278255360 & (s2 << 24 | s2 >>> 8);
              a2 = 16711935 & (a2 << 8 | a2 >>> 24) | 4278255360 & (a2 << 24 | a2 >>> 8);
              var o22 = r4[n2];
              o22.high ^= a2;
              o22.low ^= s2;
            }
            for (var u2 = 0; u2 < 24; u2++) {
              for (var d2 = 0; d2 < 5; d2++) {
                var v = 0, p = 0;
                for (var g = 0; g < 5; g++) {
                  var o22 = r4[d2 + 5 * g];
                  v ^= o22.high;
                  p ^= o22.low;
                }
                var y = h[d2];
                y.high = v;
                y.low = p;
              }
              for (var d2 = 0; d2 < 5; d2++) {
                var m = h[(d2 + 4) % 5];
                var w = h[(d2 + 1) % 5];
                var S = w.high;
                var _ = w.low;
                var v = m.high ^ (S << 1 | _ >>> 31);
                var p = m.low ^ (_ << 1 | S >>> 31);
                for (var g = 0; g < 5; g++) {
                  var o22 = r4[d2 + 5 * g];
                  o22.high ^= v;
                  o22.low ^= p;
                }
              }
              for (var b = 1; b < 25; b++) {
                var v;
                var p;
                var o22 = r4[b];
                var E2 = o22.high;
                var D = o22.low;
                var M = c[b];
                if (M < 32) {
                  v = E2 << M | D >>> 32 - M;
                  p = D << M | E2 >>> 32 - M;
                } else {
                  v = D << M - 32 | E2 >>> 64 - M;
                  p = E2 << M - 32 | D >>> 64 - M;
                }
                var T = h[l[b]];
                T.high = v;
                T.low = p;
              }
              var I = h[0];
              var A = r4[0];
              I.high = A.high;
              I.low = A.low;
              for (var d2 = 0; d2 < 5; d2++)
                for (var g = 0; g < 5; g++) {
                  var b = d2 + 5 * g;
                  var o22 = r4[b];
                  var x = h[b];
                  var R = h[(d2 + 1) % 5 + 5 * g];
                  var B = h[(d2 + 2) % 5 + 5 * g];
                  o22.high = x.high ^ ~R.high & B.high;
                  o22.low = x.low ^ ~R.low & B.low;
                }
              var o22 = r4[0];
              var O = f2[u2];
              o22.high ^= O.high;
              o22.low ^= O.low;
            }
          }, _doFinalize: function() {
            var t4 = this._data;
            var r4 = t4.words;
            8 * this._nDataBytes;
            var s2 = 8 * t4.sigBytes;
            var a2 = 32 * this.blockSize;
            r4[s2 >>> 5] |= 1 << 24 - s2 % 32;
            r4[(e3.ceil((s2 + 1) / a2) * a2 >>> 5) - 1] |= 128;
            t4.sigBytes = 4 * r4.length;
            this._process();
            var o22 = this._state;
            var u2 = this.cfg.outputLength / 8;
            var c2 = u2 / 8;
            var l2 = [];
            for (var f22 = 0; f22 < c2; f22++) {
              var h2 = o22[f22];
              var d2 = h2.high;
              var v = h2.low;
              d2 = 16711935 & (d2 << 8 | d2 >>> 24) | 4278255360 & (d2 << 24 | d2 >>> 8);
              v = 16711935 & (v << 8 | v >>> 24) | 4278255360 & (v << 24 | v >>> 8);
              l2.push(v);
              l2.push(d2);
            }
            return new n.init(l2, u2);
          }, clone: function() {
            var t4 = s.clone.call(this);
            var e4 = t4._state = this._state.slice(0);
            for (var r4 = 0; r4 < 25; r4++)
              e4[r4] = e4[r4].clone();
            return t4;
          } });
          r3.SHA3 = s._createHelper(d);
          r3.HmacSHA3 = s._createHmacHelper(d);
        })(Math);
        return t3.SHA3;
      });
    }, 7460: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(4938), r2(34));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.x64;
          var i2 = r3.Word;
          var n = r3.WordArray;
          var s = e3.algo;
          var a = s.SHA512;
          var o2 = s.SHA384 = a.extend({ _doReset: function() {
            this._hash = new n.init([new i2.init(3418070365, 3238371032), new i2.init(1654270250, 914150663), new i2.init(2438529370, 812702999), new i2.init(355462360, 4144912697), new i2.init(1731405415, 4290775857), new i2.init(2394180231, 1750603025), new i2.init(3675008525, 1694076839), new i2.init(1203062813, 3204075428)]);
          }, _doFinalize: function() {
            var t4 = a._doFinalize.call(this);
            t4.sigBytes -= 16;
            return t4;
          } });
          e3.SHA384 = a._createHelper(o2);
          e3.HmacSHA384 = a._createHmacHelper(o2);
        })();
        return t3.SHA384;
      });
    }, 34: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(4938));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.Hasher;
          var n = e3.x64;
          var s = n.Word;
          var a = n.WordArray;
          var o2 = e3.algo;
          function u() {
            return s.create.apply(s, arguments);
          }
          var c = [u(1116352408, 3609767458), u(1899447441, 602891725), u(3049323471, 3964484399), u(3921009573, 2173295548), u(961987163, 4081628472), u(1508970993, 3053834265), u(2453635748, 2937671579), u(2870763221, 3664609560), u(3624381080, 2734883394), u(310598401, 1164996542), u(607225278, 1323610764), u(1426881987, 3590304994), u(1925078388, 4068182383), u(2162078206, 991336113), u(2614888103, 633803317), u(3248222580, 3479774868), u(3835390401, 2666613458), u(4022224774, 944711139), u(264347078, 2341262773), u(604807628, 2007800933), u(770255983, 1495990901), u(1249150122, 1856431235), u(1555081692, 3175218132), u(1996064986, 2198950837), u(2554220882, 3999719339), u(2821834349, 766784016), u(2952996808, 2566594879), u(3210313671, 3203337956), u(3336571891, 1034457026), u(3584528711, 2466948901), u(113926993, 3758326383), u(338241895, 168717936), u(666307205, 1188179964), u(773529912, 1546045734), u(1294757372, 1522805485), u(1396182291, 2643833823), u(1695183700, 2343527390), u(1986661051, 1014477480), u(2177026350, 1206759142), u(2456956037, 344077627), u(2730485921, 1290863460), u(2820302411, 3158454273), u(3259730800, 3505952657), u(3345764771, 106217008), u(3516065817, 3606008344), u(3600352804, 1432725776), u(4094571909, 1467031594), u(275423344, 851169720), u(430227734, 3100823752), u(506948616, 1363258195), u(659060556, 3750685593), u(883997877, 3785050280), u(958139571, 3318307427), u(1322822218, 3812723403), u(1537002063, 2003034995), u(1747873779, 3602036899), u(1955562222, 1575990012), u(2024104815, 1125592928), u(2227730452, 2716904306), u(2361852424, 442776044), u(2428436474, 593698344), u(2756734187, 3733110249), u(3204031479, 2999351573), u(3329325298, 3815920427), u(3391569614, 3928383900), u(3515267271, 566280711), u(3940187606, 3454069534), u(4118630271, 4000239992), u(116418474, 1914138554), u(174292421, 2731055270), u(289380356, 3203993006), u(460393269, 320620315), u(685471733, 587496836), u(852142971, 1086792851), u(1017036298, 365543100), u(1126000580, 2618297676), u(1288033470, 3409855158), u(1501505948, 4234509866), u(1607167915, 987167468), u(1816402316, 1246189591)];
          var l = [];
          (function() {
            for (var t4 = 0; t4 < 80; t4++)
              l[t4] = u();
          })();
          var f2 = o2.SHA512 = i2.extend({ _doReset: function() {
            this._hash = new a.init([new s.init(1779033703, 4089235720), new s.init(3144134277, 2227873595), new s.init(1013904242, 4271175723), new s.init(2773480762, 1595750129), new s.init(1359893119, 2917565137), new s.init(2600822924, 725511199), new s.init(528734635, 4215389547), new s.init(1541459225, 327033209)]);
          }, _doProcessBlock: function(t4, e4) {
            var r4 = this._hash.words;
            var i3 = r4[0];
            var n2 = r4[1];
            var s2 = r4[2];
            var a2 = r4[3];
            var o22 = r4[4];
            var u2 = r4[5];
            var f22 = r4[6];
            var h = r4[7];
            var d = i3.high;
            var v = i3.low;
            var p = n2.high;
            var g = n2.low;
            var y = s2.high;
            var m = s2.low;
            var w = a2.high;
            var S = a2.low;
            var _ = o22.high;
            var b = o22.low;
            var E2 = u2.high;
            var D = u2.low;
            var M = f22.high;
            var T = f22.low;
            var I = h.high;
            var A = h.low;
            var x = d;
            var R = v;
            var B = p;
            var O = g;
            var k = y;
            var C = m;
            var N = w;
            var P = S;
            var V = _;
            var L = b;
            var H = E2;
            var U = D;
            var K = M;
            var j = T;
            var q = I;
            var F = A;
            for (var z = 0; z < 80; z++) {
              var G;
              var Y;
              var W = l[z];
              if (z < 16) {
                Y = W.high = 0 | t4[e4 + 2 * z];
                G = W.low = 0 | t4[e4 + 2 * z + 1];
              } else {
                var J = l[z - 15];
                var Z = J.high;
                var $ = J.low;
                var X = (Z >>> 1 | $ << 31) ^ (Z >>> 8 | $ << 24) ^ Z >>> 7;
                var Q = ($ >>> 1 | Z << 31) ^ ($ >>> 8 | Z << 24) ^ ($ >>> 7 | Z << 25);
                var tt2 = l[z - 2];
                var et = tt2.high;
                var rt = tt2.low;
                var it = (et >>> 19 | rt << 13) ^ (et << 3 | rt >>> 29) ^ et >>> 6;
                var nt = (rt >>> 19 | et << 13) ^ (rt << 3 | et >>> 29) ^ (rt >>> 6 | et << 26);
                var st = l[z - 7];
                var at = st.high;
                var ot = st.low;
                var ut = l[z - 16];
                var ct = ut.high;
                var lt = ut.low;
                G = Q + ot;
                Y = X + at + (G >>> 0 < Q >>> 0 ? 1 : 0);
                G += nt;
                Y = Y + it + (G >>> 0 < nt >>> 0 ? 1 : 0);
                G += lt;
                Y = Y + ct + (G >>> 0 < lt >>> 0 ? 1 : 0);
                W.high = Y;
                W.low = G;
              }
              var ft = V & H ^ ~V & K;
              var ht = L & U ^ ~L & j;
              var dt = x & B ^ x & k ^ B & k;
              var vt = R & O ^ R & C ^ O & C;
              var pt = (x >>> 28 | R << 4) ^ (x << 30 | R >>> 2) ^ (x << 25 | R >>> 7);
              var gt = (R >>> 28 | x << 4) ^ (R << 30 | x >>> 2) ^ (R << 25 | x >>> 7);
              var yt = (V >>> 14 | L << 18) ^ (V >>> 18 | L << 14) ^ (V << 23 | L >>> 9);
              var mt = (L >>> 14 | V << 18) ^ (L >>> 18 | V << 14) ^ (L << 23 | V >>> 9);
              var wt = c[z];
              var St = wt.high;
              var _t = wt.low;
              var bt = F + mt;
              var Et = q + yt + (bt >>> 0 < F >>> 0 ? 1 : 0);
              var bt = bt + ht;
              var Et = Et + ft + (bt >>> 0 < ht >>> 0 ? 1 : 0);
              var bt = bt + _t;
              var Et = Et + St + (bt >>> 0 < _t >>> 0 ? 1 : 0);
              var bt = bt + G;
              var Et = Et + Y + (bt >>> 0 < G >>> 0 ? 1 : 0);
              var Dt = gt + vt;
              var Mt = pt + dt + (Dt >>> 0 < gt >>> 0 ? 1 : 0);
              q = K;
              F = j;
              K = H;
              j = U;
              H = V;
              U = L;
              L = P + bt | 0;
              V = N + Et + (L >>> 0 < P >>> 0 ? 1 : 0) | 0;
              N = k;
              P = C;
              k = B;
              C = O;
              B = x;
              O = R;
              R = bt + Dt | 0;
              x = Et + Mt + (R >>> 0 < bt >>> 0 ? 1 : 0) | 0;
            }
            v = i3.low = v + R;
            i3.high = d + x + (v >>> 0 < R >>> 0 ? 1 : 0);
            g = n2.low = g + O;
            n2.high = p + B + (g >>> 0 < O >>> 0 ? 1 : 0);
            m = s2.low = m + C;
            s2.high = y + k + (m >>> 0 < C >>> 0 ? 1 : 0);
            S = a2.low = S + P;
            a2.high = w + N + (S >>> 0 < P >>> 0 ? 1 : 0);
            b = o22.low = b + L;
            o22.high = _ + V + (b >>> 0 < L >>> 0 ? 1 : 0);
            D = u2.low = D + U;
            u2.high = E2 + H + (D >>> 0 < U >>> 0 ? 1 : 0);
            T = f22.low = T + j;
            f22.high = M + K + (T >>> 0 < j >>> 0 ? 1 : 0);
            A = h.low = A + F;
            h.high = I + q + (A >>> 0 < F >>> 0 ? 1 : 0);
          }, _doFinalize: function() {
            var t4 = this._data;
            var e4 = t4.words;
            var r4 = 8 * this._nDataBytes;
            var i3 = 8 * t4.sigBytes;
            e4[i3 >>> 5] |= 128 << 24 - i3 % 32;
            e4[(i3 + 128 >>> 10 << 5) + 30] = Math.floor(r4 / 4294967296);
            e4[(i3 + 128 >>> 10 << 5) + 31] = r4;
            t4.sigBytes = 4 * e4.length;
            this._process();
            var n2 = this._hash.toX32();
            return n2;
          }, clone: function() {
            var t4 = i2.clone.call(this);
            t4._hash = this._hash.clone();
            return t4;
          }, blockSize: 1024 / 32 });
          e3.SHA512 = i2._createHelper(f2);
          e3.HmacSHA512 = i2._createHmacHelper(f2);
        })();
        return t3.SHA512;
      });
    }, 4253: function(t22, e2, r2) {
      (function(i2, n, s) {
        t22.exports = n(r2(8249), r2(8269), r2(8214), r2(888), r2(5109));
      })(this, function(t3) {
        (function() {
          var e3 = t3;
          var r3 = e3.lib;
          var i2 = r3.WordArray;
          var n = r3.BlockCipher;
          var s = e3.algo;
          var a = [57, 49, 41, 33, 25, 17, 9, 1, 58, 50, 42, 34, 26, 18, 10, 2, 59, 51, 43, 35, 27, 19, 11, 3, 60, 52, 44, 36, 63, 55, 47, 39, 31, 23, 15, 7, 62, 54, 46, 38, 30, 22, 14, 6, 61, 53, 45, 37, 29, 21, 13, 5, 28, 20, 12, 4];
          var o2 = [14, 17, 11, 24, 1, 5, 3, 28, 15, 6, 21, 10, 23, 19, 12, 4, 26, 8, 16, 7, 27, 20, 13, 2, 41, 52, 31, 37, 47, 55, 30, 40, 51, 45, 33, 48, 44, 49, 39, 56, 34, 53, 46, 42, 50, 36, 29, 32];
          var u = [1, 2, 4, 6, 8, 10, 12, 14, 15, 17, 19, 21, 23, 25, 27, 28];
          var c = [{ 0: 8421888, 268435456: 32768, 536870912: 8421378, 805306368: 2, 1073741824: 512, 1342177280: 8421890, 1610612736: 8389122, 1879048192: 8388608, 2147483648: 514, 2415919104: 8389120, 2684354560: 33280, 2952790016: 8421376, 3221225472: 32770, 3489660928: 8388610, 3758096384: 0, 4026531840: 33282, 134217728: 0, 402653184: 8421890, 671088640: 33282, 939524096: 32768, 1207959552: 8421888, 1476395008: 512, 1744830464: 8421378, 2013265920: 2, 2281701376: 8389120, 2550136832: 33280, 2818572288: 8421376, 3087007744: 8389122, 3355443200: 8388610, 3623878656: 32770, 3892314112: 514, 4160749568: 8388608, 1: 32768, 268435457: 2, 536870913: 8421888, 805306369: 8388608, 1073741825: 8421378, 1342177281: 33280, 1610612737: 512, 1879048193: 8389122, 2147483649: 8421890, 2415919105: 8421376, 2684354561: 8388610, 2952790017: 33282, 3221225473: 514, 3489660929: 8389120, 3758096385: 32770, 4026531841: 0, 134217729: 8421890, 402653185: 8421376, 671088641: 8388608, 939524097: 512, 1207959553: 32768, 1476395009: 8388610, 1744830465: 2, 2013265921: 33282, 2281701377: 32770, 2550136833: 8389122, 2818572289: 514, 3087007745: 8421888, 3355443201: 8389120, 3623878657: 0, 3892314113: 33280, 4160749569: 8421378 }, { 0: 1074282512, 16777216: 16384, 33554432: 524288, 50331648: 1074266128, 67108864: 1073741840, 83886080: 1074282496, 100663296: 1073758208, 117440512: 16, 134217728: 540672, 150994944: 1073758224, 167772160: 1073741824, 184549376: 540688, 201326592: 524304, 218103808: 0, 234881024: 16400, 251658240: 1074266112, 8388608: 1073758208, 25165824: 540688, 41943040: 16, 58720256: 1073758224, 75497472: 1074282512, 92274688: 1073741824, 109051904: 524288, 125829120: 1074266128, 142606336: 524304, 159383552: 0, 176160768: 16384, 192937984: 1074266112, 209715200: 1073741840, 226492416: 540672, 243269632: 1074282496, 260046848: 16400, 268435456: 0, 285212672: 1074266128, 301989888: 1073758224, 318767104: 1074282496, 335544320: 1074266112, 352321536: 16, 369098752: 540688, 385875968: 16384, 402653184: 16400, 419430400: 524288, 436207616: 524304, 452984832: 1073741840, 469762048: 540672, 486539264: 1073758208, 503316480: 1073741824, 520093696: 1074282512, 276824064: 540688, 293601280: 524288, 310378496: 1074266112, 327155712: 16384, 343932928: 1073758208, 360710144: 1074282512, 377487360: 16, 394264576: 1073741824, 411041792: 1074282496, 427819008: 1073741840, 444596224: 1073758224, 461373440: 524304, 478150656: 0, 494927872: 16400, 511705088: 1074266128, 528482304: 540672 }, { 0: 260, 1048576: 0, 2097152: 67109120, 3145728: 65796, 4194304: 65540, 5242880: 67108868, 6291456: 67174660, 7340032: 67174400, 8388608: 67108864, 9437184: 67174656, 10485760: 65792, 11534336: 67174404, 12582912: 67109124, 13631488: 65536, 14680064: 4, 15728640: 256, 524288: 67174656, 1572864: 67174404, 2621440: 0, 3670016: 67109120, 4718592: 67108868, 5767168: 65536, 6815744: 65540, 7864320: 260, 8912896: 4, 9961472: 256, 11010048: 67174400, 12058624: 65796, 13107200: 65792, 14155776: 67109124, 15204352: 67174660, 16252928: 67108864, 16777216: 67174656, 17825792: 65540, 18874368: 65536, 19922944: 67109120, 20971520: 256, 22020096: 67174660, 23068672: 67108868, 24117248: 0, 25165824: 67109124, 26214400: 67108864, 27262976: 4, 28311552: 65792, 29360128: 67174400, 30408704: 260, 31457280: 65796, 32505856: 67174404, 17301504: 67108864, 18350080: 260, 19398656: 67174656, 20447232: 0, 21495808: 65540, 22544384: 67109120, 23592960: 256, 24641536: 67174404, 25690112: 65536, 26738688: 67174660, 27787264: 65796, 28835840: 67108868, 29884416: 67109124, 30932992: 67174400, 31981568: 4, 33030144: 65792 }, { 0: 2151682048, 65536: 2147487808, 131072: 4198464, 196608: 2151677952, 262144: 0, 327680: 4198400, 393216: 2147483712, 458752: 4194368, 524288: 2147483648, 589824: 4194304, 655360: 64, 720896: 2147487744, 786432: 2151678016, 851968: 4160, 917504: 4096, 983040: 2151682112, 32768: 2147487808, 98304: 64, 163840: 2151678016, 229376: 2147487744, 294912: 4198400, 360448: 2151682112, 425984: 0, 491520: 2151677952, 557056: 4096, 622592: 2151682048, 688128: 4194304, 753664: 4160, 819200: 2147483648, 884736: 4194368, 950272: 4198464, 1015808: 2147483712, 1048576: 4194368, 1114112: 4198400, 1179648: 2147483712, 1245184: 0, 1310720: 4160, 1376256: 2151678016, 1441792: 2151682048, 1507328: 2147487808, 1572864: 2151682112, 1638400: 2147483648, 1703936: 2151677952, 1769472: 4198464, 1835008: 2147487744, 1900544: 4194304, 1966080: 64, 2031616: 4096, 1081344: 2151677952, 1146880: 2151682112, 1212416: 0, 1277952: 4198400, 1343488: 4194368, 1409024: 2147483648, 1474560: 2147487808, 1540096: 64, 1605632: 2147483712, 1671168: 4096, 1736704: 2147487744, 1802240: 2151678016, 1867776: 4160, 1933312: 2151682048, 1998848: 4194304, 2064384: 4198464 }, { 0: 128, 4096: 17039360, 8192: 262144, 12288: 536870912, 16384: 537133184, 20480: 16777344, 24576: 553648256, 28672: 262272, 32768: 16777216, 36864: 537133056, 40960: 536871040, 45056: 553910400, 49152: 553910272, 53248: 0, 57344: 17039488, 61440: 553648128, 2048: 17039488, 6144: 553648256, 10240: 128, 14336: 17039360, 18432: 262144, 22528: 537133184, 26624: 553910272, 30720: 536870912, 34816: 537133056, 38912: 0, 43008: 553910400, 47104: 16777344, 51200: 536871040, 55296: 553648128, 59392: 16777216, 63488: 262272, 65536: 262144, 69632: 128, 73728: 536870912, 77824: 553648256, 81920: 16777344, 86016: 553910272, 90112: 537133184, 94208: 16777216, 98304: 553910400, 102400: 553648128, 106496: 17039360, 110592: 537133056, 114688: 262272, 118784: 536871040, 122880: 0, 126976: 17039488, 67584: 553648256, 71680: 16777216, 75776: 17039360, 79872: 537133184, 83968: 536870912, 88064: 17039488, 92160: 128, 96256: 553910272, 100352: 262272, 104448: 553910400, 108544: 0, 112640: 553648128, 116736: 16777344, 120832: 262144, 124928: 537133056, 129024: 536871040 }, { 0: 268435464, 256: 8192, 512: 270532608, 768: 270540808, 1024: 268443648, 1280: 2097152, 1536: 2097160, 1792: 268435456, 2048: 0, 2304: 268443656, 2560: 2105344, 2816: 8, 3072: 270532616, 3328: 2105352, 3584: 8200, 3840: 270540800, 128: 270532608, 384: 270540808, 640: 8, 896: 2097152, 1152: 2105352, 1408: 268435464, 1664: 268443648, 1920: 8200, 2176: 2097160, 2432: 8192, 2688: 268443656, 2944: 270532616, 3200: 0, 3456: 270540800, 3712: 2105344, 3968: 268435456, 4096: 268443648, 4352: 270532616, 4608: 270540808, 4864: 8200, 5120: 2097152, 5376: 268435456, 5632: 268435464, 5888: 2105344, 6144: 2105352, 6400: 0, 6656: 8, 6912: 270532608, 7168: 8192, 7424: 268443656, 7680: 270540800, 7936: 2097160, 4224: 8, 4480: 2105344, 4736: 2097152, 4992: 268435464, 5248: 268443648, 5504: 8200, 5760: 270540808, 6016: 270532608, 6272: 270540800, 6528: 270532616, 6784: 8192, 7040: 2105352, 7296: 2097160, 7552: 0, 7808: 268435456, 8064: 268443656 }, { 0: 1048576, 16: 33555457, 32: 1024, 48: 1049601, 64: 34604033, 80: 0, 96: 1, 112: 34603009, 128: 33555456, 144: 1048577, 160: 33554433, 176: 34604032, 192: 34603008, 208: 1025, 224: 1049600, 240: 33554432, 8: 34603009, 24: 0, 40: 33555457, 56: 34604032, 72: 1048576, 88: 33554433, 104: 33554432, 120: 1025, 136: 1049601, 152: 33555456, 168: 34603008, 184: 1048577, 200: 1024, 216: 34604033, 232: 1, 248: 1049600, 256: 33554432, 272: 1048576, 288: 33555457, 304: 34603009, 320: 1048577, 336: 33555456, 352: 34604032, 368: 1049601, 384: 1025, 400: 34604033, 416: 1049600, 432: 1, 448: 0, 464: 34603008, 480: 33554433, 496: 1024, 264: 1049600, 280: 33555457, 296: 34603009, 312: 1, 328: 33554432, 344: 1048576, 360: 1025, 376: 34604032, 392: 33554433, 408: 34603008, 424: 0, 440: 34604033, 456: 1049601, 472: 1024, 488: 33555456, 504: 1048577 }, { 0: 134219808, 1: 131072, 2: 134217728, 3: 32, 4: 131104, 5: 134350880, 6: 134350848, 7: 2048, 8: 134348800, 9: 134219776, 10: 133120, 11: 134348832, 12: 2080, 13: 0, 14: 134217760, 15: 133152, 2147483648: 2048, 2147483649: 134350880, 2147483650: 134219808, 2147483651: 134217728, 2147483652: 134348800, 2147483653: 133120, 2147483654: 133152, 2147483655: 32, 2147483656: 134217760, 2147483657: 2080, 2147483658: 131104, 2147483659: 134350848, 2147483660: 0, 2147483661: 134348832, 2147483662: 134219776, 2147483663: 131072, 16: 133152, 17: 134350848, 18: 32, 19: 2048, 20: 134219776, 21: 134217760, 22: 134348832, 23: 131072, 24: 0, 25: 131104, 26: 134348800, 27: 134219808, 28: 134350880, 29: 133120, 30: 2080, 31: 134217728, 2147483664: 131072, 2147483665: 2048, 2147483666: 134348832, 2147483667: 133152, 2147483668: 32, 2147483669: 134348800, 2147483670: 134217728, 2147483671: 134219808, 2147483672: 134350880, 2147483673: 134217760, 2147483674: 134219776, 2147483675: 0, 2147483676: 133120, 2147483677: 2080, 2147483678: 131104, 2147483679: 134350848 }];
          var l = [4160749569, 528482304, 33030144, 2064384, 129024, 8064, 504, 2147483679];
          var f2 = s.DES = n.extend({ _doReset: function() {
            var t4 = this._key;
            var e4 = t4.words;
            var r4 = [];
            for (var i3 = 0; i3 < 56; i3++) {
              var n2 = a[i3] - 1;
              r4[i3] = e4[n2 >>> 5] >>> 31 - n2 % 32 & 1;
            }
            var s2 = this._subKeys = [];
            for (var c2 = 0; c2 < 16; c2++) {
              var l2 = s2[c2] = [];
              var f22 = u[c2];
              for (var i3 = 0; i3 < 24; i3++) {
                l2[i3 / 6 | 0] |= r4[(o2[i3] - 1 + f22) % 28] << 31 - i3 % 6;
                l2[4 + (i3 / 6 | 0)] |= r4[28 + (o2[i3 + 24] - 1 + f22) % 28] << 31 - i3 % 6;
              }
              l2[0] = l2[0] << 1 | l2[0] >>> 31;
              for (var i3 = 1; i3 < 7; i3++)
                l2[i3] = l2[i3] >>> 4 * (i3 - 1) + 3;
              l2[7] = l2[7] << 5 | l2[7] >>> 27;
            }
            var h2 = this._invSubKeys = [];
            for (var i3 = 0; i3 < 16; i3++)
              h2[i3] = s2[15 - i3];
          }, encryptBlock: function(t4, e4) {
            this._doCryptBlock(t4, e4, this._subKeys);
          }, decryptBlock: function(t4, e4) {
            this._doCryptBlock(t4, e4, this._invSubKeys);
          }, _doCryptBlock: function(t4, e4, r4) {
            this._lBlock = t4[e4];
            this._rBlock = t4[e4 + 1];
            h.call(this, 4, 252645135);
            h.call(this, 16, 65535);
            d.call(this, 2, 858993459);
            d.call(this, 8, 16711935);
            h.call(this, 1, 1431655765);
            for (var i3 = 0; i3 < 16; i3++) {
              var n2 = r4[i3];
              var s2 = this._lBlock;
              var a2 = this._rBlock;
              var o22 = 0;
              for (var u2 = 0; u2 < 8; u2++)
                o22 |= c[u2][((a2 ^ n2[u2]) & l[u2]) >>> 0];
              this._lBlock = a2;
              this._rBlock = s2 ^ o22;
            }
            var f22 = this._lBlock;
            this._lBlock = this._rBlock;
            this._rBlock = f22;
            h.call(this, 1, 1431655765);
            d.call(this, 8, 16711935);
            d.call(this, 2, 858993459);
            h.call(this, 16, 65535);
            h.call(this, 4, 252645135);
            t4[e4] = this._lBlock;
            t4[e4 + 1] = this._rBlock;
          }, keySize: 64 / 32, ivSize: 64 / 32, blockSize: 64 / 32 });
          function h(t4, e4) {
            var r4 = (this._lBlock >>> t4 ^ this._rBlock) & e4;
            this._rBlock ^= r4;
            this._lBlock ^= r4 << t4;
          }
          function d(t4, e4) {
            var r4 = (this._rBlock >>> t4 ^ this._lBlock) & e4;
            this._lBlock ^= r4;
            this._rBlock ^= r4 << t4;
          }
          e3.DES = n._createHelper(f2);
          var v = s.TripleDES = n.extend({ _doReset: function() {
            var t4 = this._key;
            var e4 = t4.words;
            if (2 !== e4.length && 4 !== e4.length && e4.length < 6)
              throw new Error("Invalid key length - 3DES requires the key length to be 64, 128, 192 or >192.");
            var r4 = e4.slice(0, 2);
            var n2 = e4.length < 4 ? e4.slice(0, 2) : e4.slice(2, 4);
            var s2 = e4.length < 6 ? e4.slice(0, 2) : e4.slice(4, 6);
            this._des1 = f2.createEncryptor(i2.create(r4));
            this._des2 = f2.createEncryptor(i2.create(n2));
            this._des3 = f2.createEncryptor(i2.create(s2));
          }, encryptBlock: function(t4, e4) {
            this._des1.encryptBlock(t4, e4);
            this._des2.decryptBlock(t4, e4);
            this._des3.encryptBlock(t4, e4);
          }, decryptBlock: function(t4, e4) {
            this._des3.decryptBlock(t4, e4);
            this._des2.encryptBlock(t4, e4);
            this._des1.decryptBlock(t4, e4);
          }, keySize: 192 / 32, ivSize: 64 / 32, blockSize: 64 / 32 });
          e3.TripleDES = n._createHelper(v);
        })();
        return t3.TripleDES;
      });
    }, 4938: function(t22, e2, r2) {
      (function(i2, n) {
        t22.exports = n(r2(8249));
      })(this, function(t3) {
        (function(e3) {
          var r3 = t3;
          var i2 = r3.lib;
          var n = i2.Base;
          var s = i2.WordArray;
          var a = r3.x64 = {};
          a.Word = n.extend({ init: function(t4, e4) {
            this.high = t4;
            this.low = e4;
          } });
          a.WordArray = n.extend({ init: function(t4, r4) {
            t4 = this.words = t4 || [];
            if (r4 != e3)
              this.sigBytes = r4;
            else
              this.sigBytes = 8 * t4.length;
          }, toX32: function() {
            var t4 = this.words;
            var e4 = t4.length;
            var r4 = [];
            for (var i3 = 0; i3 < e4; i3++) {
              var n2 = t4[i3];
              r4.push(n2.high);
              r4.push(n2.low);
            }
            return s.create(r4, this.sigBytes);
          }, clone: function() {
            var t4 = n.clone.call(this);
            var e4 = t4.words = this.words.slice(0);
            var r4 = e4.length;
            for (var i3 = 0; i3 < r4; i3++)
              e4[i3] = e4[i3].clone();
            return t4;
          } });
        })();
        return t3;
      });
    }, 4198: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      e2.ErrorCode = void 0;
      (function(t3) {
        t3[t3["SUCCESS"] = 0] = "SUCCESS";
        t3[t3["CLIENT_ID_NOT_FOUND"] = 1] = "CLIENT_ID_NOT_FOUND";
        t3[t3["OPERATION_TOO_OFTEN"] = 2] = "OPERATION_TOO_OFTEN";
        t3[t3["REPEAT_MESSAGE"] = 3] = "REPEAT_MESSAGE";
        t3[t3["TIME_OUT"] = 4] = "TIME_OUT";
      })(e2.ErrorCode || (e2.ErrorCode = {}));
    }, 9021: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      const n = i2(r2(6893));
      const s = i2(r2(7555));
      const a = i2(r2(6379));
      const o2 = i2(r2(529));
      var u;
      (function(t3) {
        function e3(t4) {
          o2.default.debugMode = t4;
          o2.default.info(`setDebugMode: ${t4}`);
        }
        t3.setDebugMode = e3;
        function r3(t4) {
          try {
            s.default.init(t4);
          } catch (t5) {
            o2.default.error(`init error`, t5);
          }
        }
        t3.init = r3;
        function i3(t4) {
          try {
            if (!t4.url)
              throw new Error("invalid url");
            if (!t4.key || !t4.keyId)
              throw new Error("invalid key or keyId");
            a.default.socketUrl = t4.url;
            a.default.publicKeyId = t4.keyId;
            a.default.publicKey = t4.key;
          } catch (t5) {
            o2.default.error(`setSocketServer error`, t5);
          }
        }
        t3.setSocketServer = i3;
        function u2(t4) {
          try {
            s.default.enableSocket(t4);
          } catch (t5) {
            o2.default.error(`enableSocket error`, t5);
          }
        }
        t3.enableSocket = u2;
        function c() {
          return n.default.SDK_VERSION;
        }
        t3.getVersion = c;
      })(u || (u = {}));
      t22.exports = u;
    }, 9478: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(529));
      const s = i2(r2(496));
      const a = i2(r2(3555));
      const o2 = i2(r2(1929));
      const u = i2(r2(4379));
      const c = i2(r2(6899));
      const l = i2(r2(776));
      const f2 = i2(r2(2002));
      const h = i2(r2(5807));
      const d = i2(r2(9704));
      const v = i2(r2(6545));
      const p = i2(r2(3680));
      const g = i2(r2(7706));
      const y = i2(r2(4486));
      const m = i2(r2(5867));
      const w = i2(r2(7006));
      var S;
      (function(t3) {
        let e3;
        let r3;
        let i3;
        function S2() {
          let t4;
          try {
            if ("undefined" != typeof index) {
              e3 = new v.default();
              r3 = new p.default();
              i3 = new g.default();
            } else if ("undefined" != typeof tt) {
              e3 = new f2.default();
              r3 = new h.default();
              i3 = new d.default();
            } else if ("undefined" != typeof my) {
              e3 = new s.default();
              r3 = new a.default();
              i3 = new o2.default();
            } else if ("undefined" != typeof wx$1) {
              e3 = new y.default();
              r3 = new m.default();
              i3 = new w.default();
            } else if ("undefined" != typeof window) {
              e3 = new u.default();
              r3 = new c.default();
              i3 = new l.default();
            }
          } catch (e4) {
            n.default.error(`init am error: ${e4}`);
            t4 = e4;
          }
          if (!e3 || !r3 || !i3) {
            if ("undefined" != typeof window) {
              e3 = new u.default();
              r3 = new c.default();
              i3 = new l.default();
            }
          }
          if (!e3 || !r3 || !i3)
            throw new Error(`init am error: no api impl found, ${t4}`);
        }
        function _() {
          if (!e3)
            S2();
          return e3;
        }
        t3.getDevice = _;
        function b() {
          if (!r3)
            S2();
          return r3;
        }
        t3.getStorage = b;
        function E2() {
          if (!i3)
            S2();
          return i3;
        }
        t3.getWebSocket = E2;
      })(S || (S = {}));
      e2["default"] = S;
    }, 4685: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(9478));
      var s;
      (function(t3) {
        function e3() {
          return n.default.getDevice().os();
        }
        t3.os = e3;
        function r3() {
          return n.default.getDevice().osVersion();
        }
        t3.osVersion = r3;
        function i3() {
          return n.default.getDevice().model();
        }
        t3.model = i3;
        function s2() {
          return n.default.getDevice().brand();
        }
        t3.brand = s2;
        function a() {
          return n.default.getDevice().platform();
        }
        t3.platform = a;
        function o2() {
          return n.default.getDevice().platformVersion();
        }
        t3.platformVersion = o2;
        function u() {
          return n.default.getDevice().platformId();
        }
        t3.platformId = u;
        function c() {
          return n.default.getDevice().language();
        }
        t3.language = c;
        function l() {
          let t4 = n.default.getDevice().userAgent;
          if (t4)
            return t4();
          return "";
        }
        t3.userAgent = l;
        function f2(t4) {
          n.default.getDevice().getNetworkType(t4);
        }
        t3.getNetworkType = f2;
        function h(t4) {
          n.default.getDevice().onNetworkStatusChange(t4);
        }
        t3.onNetworkStatusChange = h;
      })(s || (s = {}));
      e2["default"] = s;
    }, 7002: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(6379));
      const s = i2(r2(1386));
      const a = i2(r2(4054));
      const o2 = r2(2918);
      const u = i2(r2(7167));
      const c = i2(r2(529));
      const l = i2(r2(9478));
      const f2 = i2(r2(8506));
      var h;
      (function(t3) {
        let e3;
        let r3 = false;
        let i3 = false;
        let h2 = false;
        let d = [];
        const v = 10;
        let p = 0;
        t3.allowReconnect = true;
        function g() {
          return r3 && i3;
        }
        t3.isAvailable = g;
        function y(e4) {
          let r4 = (/* @__PURE__ */ new Date()).getTime();
          if (r4 - p < 1e3) {
            c.default.warn(`enableSocket ${e4} fail: this function can only be called once a second`);
            return;
          }
          p = r4;
          t3.allowReconnect = e4;
          if (e4)
            t3.reconnect(10);
          else
            t3.close(`enableSocket ${e4}`);
        }
        t3.enableSocket = y;
        function m(e4 = 0) {
          if (!t3.allowReconnect)
            return;
          if (!_())
            return;
          setTimeout(function() {
            w();
          }, e4);
        }
        t3.reconnect = m;
        function w() {
          t3.allowReconnect = true;
          if (!_())
            return;
          if (!b())
            return;
          h2 = true;
          let r4 = n.default.socketUrl;
          try {
            let t4 = f2.default.getSync(f2.default.KEY_REDIRECT_SERVER, "");
            if (t4) {
              let e4 = o2.RedirectServerData.parse(t4);
              let i4 = e4.addressList[0].split(",");
              let n2 = i4[0];
              let s2 = Number(i4[1]);
              let a2 = (/* @__PURE__ */ new Date()).getTime();
              if (a2 - e4.time < 1e3 * s2)
                r4 = n2;
            }
          } catch (t4) {
          }
          e3 = l.default.getWebSocket().connect({ url: r4, success: function() {
            i3 = true;
            S();
          }, fail: function() {
            i3 = false;
            M();
            m(100);
          } });
          e3.onOpen(T);
          e3.onClose(x);
          e3.onError(A);
          e3.onMessage(I);
        }
        t3.connect = w;
        function S() {
          if (i3 && r3) {
            h2 = false;
            s.default.create().send();
            u.default.getInstance().start();
          }
        }
        function _() {
          if (!n.default.networkConnected) {
            c.default.error(`connect failed, network is not available`);
            return false;
          }
          if (h2) {
            c.default.warn(`connecting`);
            return false;
          }
          if (g()) {
            c.default.warn(`already connected`);
            return false;
          }
          return true;
        }
        function b() {
          var t4 = d.length;
          let e4 = (/* @__PURE__ */ new Date()).getTime();
          if (t4 > 0) {
            for (var r4 = t4 - 1; r4 >= 0; r4--)
              if (e4 - d[r4] > 5e3) {
                d.splice(0, r4 + 1);
                break;
              }
          }
          t4 = d.length;
          d.push(e4);
          if (t4 >= v) {
            c.default.error("connect failed, connection limit reached");
            return false;
          }
          return true;
        }
        function E2(t4 = "") {
          null === e3 || void 0 === e3 || e3.close({ code: 1e3, reason: t4, success: function(t5) {
          }, fail: function(t5) {
          } });
          M();
        }
        t3.close = E2;
        function D(t4) {
          if (r3 && r3)
            null === e3 || void 0 === e3 || e3.send({ data: t4, success: function(t5) {
            }, fail: function(t5) {
            } });
          else
            throw new Error(`socket not connect`);
        }
        t3.send = D;
        function M(t4) {
          var e4;
          i3 = false;
          r3 = false;
          h2 = false;
          u.default.getInstance().cancel();
          if (n.default.online) {
            n.default.online = false;
            null === (e4 = n.default.onlineState) || void 0 === e4 || e4.call(n.default.onlineState, { online: n.default.online });
          }
        }
        let T = function(t4) {
          r3 = true;
          S();
        };
        let I = function(t4) {
          try {
            t4.data;
            u.default.getInstance().refresh();
            a.default.receiveMessage(t4.data);
          } catch (t5) {
          }
        };
        let A = function(t4) {
          E2(`socket error`);
        };
        let x = function(t4) {
          M();
        };
      })(h || (h = {}));
      e2["default"] = h;
    }, 8506: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(9478));
      var s;
      (function(t3) {
        t3.KEY_APPID = "getui_appid";
        t3.KEY_CID = "getui_cid";
        t3.KEY_SESSION = "getui_session";
        t3.KEY_REGID = "getui_regid";
        t3.KEY_SOCKET_URL = "getui_socket_url";
        t3.KEY_DEVICE_ID = "getui_deviceid";
        t3.KEY_ADD_PHONE_INFO_TIME = "getui_api_time";
        t3.KEY_BIND_ALIAS_TIME = "getui_ba_time";
        t3.KEY_SET_TAG_TIME = "getui_st_time";
        t3.KEY_REDIRECT_SERVER = "getui_redirect_server";
        t3.KEY_LAST_CONNECT_TIME = "getui_last_connect_time";
        function e3(t4) {
          n.default.getStorage().set(t4);
        }
        t3.set = e3;
        function r3(t4, e4) {
          n.default.getStorage().setSync(t4, e4);
        }
        t3.setSync = r3;
        function i3(t4) {
          n.default.getStorage().get(t4);
        }
        t3.get = i3;
        function s2(t4, e4) {
          let r4 = n.default.getStorage().getSync(t4);
          return r4 ? r4 : e4;
        }
        t3.getSync = s2;
      })(s || (s = {}));
      e2["default"] = s;
    }, 496: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      const n = i2(r2(3854));
      class s {
        constructor() {
          this.systemInfo = my.getSystemInfoSync();
        }
        os() {
          return n.default.getStr(this.systemInfo, "platform");
        }
        osVersion() {
          return n.default.getStr(this.systemInfo, "system");
        }
        model() {
          return n.default.getStr(this.systemInfo, "model");
        }
        brand() {
          return n.default.getStr(this.systemInfo, "brand");
        }
        platform() {
          return "MP-ALIPAY";
        }
        platformVersion() {
          return n.default.getStr(this.systemInfo, "app") + " " + n.default.getStr(this.systemInfo, "version");
        }
        platformId() {
          return my.getAppIdSync();
        }
        language() {
          return n.default.getStr(this.systemInfo, "language");
        }
        getNetworkType(t3) {
          my.getNetworkType({ success: (e3) => {
            var r3;
            null === (r3 = t3.success) || void 0 === r3 || r3.call(t3.success, { networkType: e3.networkType });
          }, fail: () => {
            var e3;
            null === (e3 = t3.fail) || void 0 === e3 || e3.call(t3.fail, "");
          } });
        }
        onNetworkStatusChange(t3) {
          my.onNetworkStatusChange(t3);
        }
      }
      t22.exports = s;
    }, 3555: (t22) => {
      class e2 {
        set(t3) {
          my.setStorage({ key: t3.key, data: t3.data, success: t3.success, fail: t3.fail });
        }
        setSync(t3, e3) {
          my.setStorageSync({ key: t3, data: e3 });
        }
        get(t3) {
          my.getStorage({ key: t3.key, success: t3.success, fail: t3.fail, complete: t3.complete });
        }
        getSync(t3) {
          return my.getStorageSync({ key: t3 }).data;
        }
      }
      t22.exports = e2;
    }, 1929: (t22) => {
      class e2 {
        connect(t3) {
          my.connectSocket({ url: t3.url, header: t3.header, method: t3.method, success: t3.success, fail: t3.fail, complete: t3.complete });
          return { onOpen: my.onSocketOpen, send: my.sendSocketMessage, onMessage: (t4) => {
            my.onSocketMessage.call(my.onSocketMessage, (e3) => {
              t4.call(t4, { data: e3 ? e3.data : "" });
            });
          }, onError: my.onSocketError, onClose: my.onSocketClose, close: my.closeSocket };
        }
      }
      t22.exports = e2;
    }, 4379: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        os() {
          let t3 = window.navigator.userAgent.toLowerCase();
          if (t3.indexOf("android") > 0 || t3.indexOf("adr") > 0)
            return "android";
          if (!!t3.match(/\(i[^;]+;( u;)? cpu.+mac os x/))
            return "ios";
          if (t3.indexOf("windows") > 0 || t3.indexOf("win32") > 0 || t3.indexOf("win64") > 0)
            return "windows";
          if (t3.indexOf("macintosh") > 0 || t3.indexOf("mac os") > 0)
            return "mac os";
          if (t3.indexOf("linux") > 0)
            return "linux";
          if (t3.indexOf("unix") > 0)
            return "linux";
          return "other";
        }
        osVersion() {
          let t3 = window.navigator.userAgent.toLowerCase();
          let e3 = t3.substring(t3.indexOf(";") + 1).trim();
          if (e3.indexOf(";") > 0)
            return e3.substring(0, e3.indexOf(";")).trim();
          return e3.substring(0, e3.indexOf(")")).trim();
        }
        model() {
          return "";
        }
        brand() {
          return "";
        }
        platform() {
          return "H5";
        }
        platformVersion() {
          return "";
        }
        platformId() {
          return "";
        }
        language() {
          return window.navigator.language;
        }
        userAgent() {
          return window.navigator.userAgent;
        }
        getNetworkType(t3) {
          var e3;
          null === (e3 = t3.success) || void 0 === e3 || e3.call(t3.success, { networkType: window.navigator.onLine ? "unknown" : "none" });
        }
        onNetworkStatusChange(t3) {
        }
      }
      e2["default"] = r2;
    }, 6899: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        set(t3) {
          var e3;
          window.localStorage.setItem(t3.key, t3.data);
          null === (e3 = t3.success) || void 0 === e3 || e3.call(t3.success, "");
        }
        setSync(t3, e3) {
          window.localStorage.setItem(t3, e3);
        }
        get(t3) {
          var e3;
          let r3 = window.localStorage.getItem(t3.key);
          null === (e3 = t3.success) || void 0 === e3 || e3.call(t3.success, r3);
        }
        getSync(t3) {
          return window.localStorage.getItem(t3);
        }
      }
      e2["default"] = r2;
    }, 776: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        connect(t3) {
          let e3 = new WebSocket(t3.url);
          return { send: (t4) => {
            var r3, i2;
            try {
              e3.send(t4.data);
              null === (r3 = t4.success) || void 0 === r3 || r3.call(t4.success, { errMsg: "" });
            } catch (e4) {
              null === (i2 = t4.fail) || void 0 === i2 || i2.call(t4.fail, { errMsg: e4 + "" });
            }
          }, close: (t4) => {
            var r3, i2;
            try {
              e3.close(t4.code, t4.reason);
              null === (r3 = t4.success) || void 0 === r3 || r3.call(t4.success, { errMsg: "" });
            } catch (e4) {
              null === (i2 = t4.fail) || void 0 === i2 || i2.call(t4.fail, { errMsg: e4 + "" });
            }
          }, onOpen: (r3) => {
            e3.onopen = (e4) => {
              var i2;
              null === (i2 = t3.success) || void 0 === i2 || i2.call(t3.success, "");
              r3({ header: "" });
            };
          }, onError: (r3) => {
            e3.onerror = (e4) => {
              var i2;
              null === (i2 = t3.fail) || void 0 === i2 || i2.call(t3.fail, "");
              r3({ errMsg: "" });
            };
          }, onMessage: (t4) => {
            e3.onmessage = (e4) => {
              t4({ data: e4.data });
            };
          }, onClose: (t4) => {
            e3.onclose = (e4) => {
              t4(e4);
            };
          } };
        }
      }
      e2["default"] = r2;
    }, 2002: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(3854));
      class s {
        constructor() {
          this.systemInfo = tt.getSystemInfoSync();
        }
        os() {
          return n.default.getStr(this.systemInfo, "platform");
        }
        osVersion() {
          return n.default.getStr(this.systemInfo, "system");
        }
        model() {
          return n.default.getStr(this.systemInfo, "model");
        }
        brand() {
          return n.default.getStr(this.systemInfo, "brand");
        }
        platform() {
          return "MP-TOUTIAO";
        }
        platformVersion() {
          return n.default.getStr(this.systemInfo, "appName") + " " + n.default.getStr(this.systemInfo, "version");
        }
        language() {
          return "";
        }
        platformId() {
          return "";
        }
        getNetworkType(t3) {
          tt.getNetworkType(t3);
        }
        onNetworkStatusChange(t3) {
          tt.onNetworkStatusChange(t3);
        }
      }
      e2["default"] = s;
    }, 5807: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        set(t3) {
          tt.setStorage(t3);
        }
        setSync(t3, e3) {
          tt.setStorageSync(t3, e3);
        }
        get(t3) {
          tt.getStorage(t3);
        }
        getSync(t3) {
          return tt.getStorageSync(t3);
        }
      }
      e2["default"] = r2;
    }, 9704: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        connect(t3) {
          let e3 = tt.connectSocket({ url: t3.url, header: t3.header, protocols: t3.protocols, success: t3.success, fail: t3.fail, complete: t3.complete });
          return { onOpen: e3.onOpen, send: e3.send, onMessage: e3.onMessage, onError: e3.onError, onClose: e3.onClose, close: e3.close };
        }
      }
      e2["default"] = r2;
    }, 6545: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(3854));
      class s {
        constructor() {
          try {
            this.systemInfo = index.getSystemInfoSync();
            this.accountInfo = index.getAccountInfoSync();
          } catch (t3) {
          }
        }
        os() {
          return n.default.getStr(this.systemInfo, "platform");
        }
        model() {
          return n.default.getStr(this.systemInfo, "model");
        }
        brand() {
          return n.default.getStr(this.systemInfo, "brand");
        }
        osVersion() {
          return n.default.getStr(this.systemInfo, "system");
        }
        platform() {
          let t3 = "";
          t3 = "MP-WEIXIN";
          return t3;
        }
        platformVersion() {
          return this.systemInfo ? this.systemInfo.version : "";
        }
        platformId() {
          return this.accountInfo ? this.accountInfo.miniProgram.appId : "";
        }
        language() {
          var t3;
          return (null === (t3 = this.systemInfo) || void 0 === t3 ? void 0 : t3.language) ? this.systemInfo.language : "";
        }
        userAgent() {
          return window ? window.navigator.userAgent : "";
        }
        getNetworkType(t3) {
          index.getNetworkType(t3);
        }
        onNetworkStatusChange(t3) {
          index.onNetworkStatusChange(t3);
        }
      }
      e2["default"] = s;
    }, 3680: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        set(t3) {
          index.setStorage(t3);
        }
        setSync(t3, e3) {
          index.setStorageSync(t3, e3);
        }
        get(t3) {
          index.getStorage(t3);
        }
        getSync(t3) {
          return index.getStorageSync(t3);
        }
      }
      e2["default"] = r2;
    }, 7706: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        connect(t3) {
          let e3 = index.connectSocket(t3);
          return { send: (t4) => {
            null === e3 || void 0 === e3 || e3.send(t4);
          }, close: (t4) => {
            null === e3 || void 0 === e3 || e3.close(t4);
          }, onOpen: (t4) => {
            null === e3 || void 0 === e3 || e3.onOpen(t4);
          }, onError: (t4) => {
            null === e3 || void 0 === e3 || e3.onError(t4);
          }, onMessage: (t4) => {
            null === e3 || void 0 === e3 || e3.onMessage(t4);
          }, onClose: (t4) => {
            null === e3 || void 0 === e3 || e3.onClose(t4);
          } };
        }
      }
      e2["default"] = r2;
    }, 4486: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(3854));
      class s {
        constructor() {
          this.systemInfo = wx$1.getSystemInfoSync();
        }
        os() {
          return n.default.getStr(this.systemInfo, "platform");
        }
        osVersion() {
          return n.default.getStr(this.systemInfo, "system");
        }
        model() {
          return n.default.getStr(this.systemInfo, "model");
        }
        brand() {
          return n.default.getStr(this.systemInfo, "brand");
        }
        platform() {
          return "MP-WEIXIN";
        }
        platformVersion() {
          return n.default.getStr(this.systemInfo, "version");
        }
        language() {
          return n.default.getStr(this.systemInfo, "language");
        }
        platformId() {
          if (wx$1.canIUse("getAccountInfoSync"))
            return wx$1.getAccountInfoSync().miniProgram.appId;
          return "";
        }
        getNetworkType(t3) {
          wx$1.getNetworkType({ success: (e3) => {
            var r3;
            null === (r3 = t3.success) || void 0 === r3 || r3.call(t3.success, { networkType: e3.networkType });
          }, fail: t3.fail });
        }
        onNetworkStatusChange(t3) {
          wx$1.onNetworkStatusChange(t3);
        }
      }
      e2["default"] = s;
    }, 5867: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        set(t3) {
          wx$1.setStorage(t3);
        }
        setSync(t3, e3) {
          wx$1.setStorageSync(t3, e3);
        }
        get(t3) {
          wx$1.getStorage(t3);
        }
        getSync(t3) {
          return wx$1.getStorageSync(t3);
        }
      }
      e2["default"] = r2;
    }, 7006: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        connect(t3) {
          let e3 = wx$1.connectSocket({ url: t3.url, header: t3.header, protocols: t3.protocols, success: t3.success, fail: t3.fail, complete: t3.complete });
          return { onOpen: e3.onOpen, send: e3.send, onMessage: e3.onMessage, onError: e3.onError, onClose: e3.onClose, close: e3.close };
        }
      }
      e2["default"] = r2;
    }, 6893: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      var r2;
      (function(t3) {
        t3.SDK_VERSION = "GTMP-2.0.4.dcloud";
        t3.DEFAULT_SOCKET_URL = "wss://wshzn.gepush.com:5223/nws";
        t3.SOCKET_PROTOCOL_VERSION = "1.0";
        t3.SERVER_PUBLIC_KEY = "MHwwDQYJKoZIhvcNAQEBBQADawAwaAJhAJp1rROuvBF7sBSnvLaesj2iFhMcY8aXyLvpnNLKs2wjL3JmEnyr++SlVa35liUlzi83tnAFkn3A9GB7pHBNzawyUkBh8WUhq5bnFIkk2RaDa6+5MpG84DEv52p7RR+aWwIDAQAB";
        t3.SERVER_PUBLIC_KEY_ID = "69d747c4b9f641baf4004be4297e9f3b";
        t3.ID_U_2_G = true;
      })(r2 || (r2 = {}));
      e2["default"] = r2;
    }, 7555: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(7002));
      const s = i2(r2(529));
      const a = i2(r2(6379));
      class o2 {
        static init(t3) {
          var e3;
          if (this.inited)
            return;
          try {
            this.checkAppid(t3.appid);
            this.inited = true;
            s.default.info(`init: appid=${t3.appid}`);
            a.default.init(t3);
            n.default.connect();
          } catch (r3) {
            this.inited = false;
            null === (e3 = t3.onError) || void 0 === e3 || e3.call(t3.onError, { error: r3 });
            throw r3;
          }
        }
        static enableSocket(t3) {
          this.checkInit();
          n.default.enableSocket(t3);
        }
        static checkInit() {
          if (!this.inited)
            throw new Error(`not init, please invoke init method firstly`);
        }
        static checkAppid(t3) {
          if (null == t3 || void 0 == t3 || "" == t3.trim())
            throw new Error(`invalid appid ${t3}`);
        }
      }
      o2.inited = false;
      e2["default"] = o2;
    }, 6379: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(6667));
      const s = i2(r2(8506));
      const a = i2(r2(6893));
      const o2 = i2(r2(7002));
      const u = i2(r2(529));
      const c = i2(r2(4685));
      const l = i2(r2(2323));
      class f2 {
        static init(t3) {
          var e3;
          if (a.default.ID_U_2_G)
            this.appid = l.default.to_getui(t3.appid);
          else
            this.appid = t3.appid;
          this.onError = t3.onError;
          this.onClientId = t3.onClientId;
          this.onlineState = t3.onlineState;
          this.onPushMsg = t3.onPushMsg;
          if (this.appid != s.default.getSync(s.default.KEY_APPID, this.appid)) {
            u.default.info("appid changed, clear session and cid");
            s.default.setSync(s.default.KEY_CID, "");
            s.default.setSync(s.default.KEY_SESSION, "");
          }
          s.default.setSync(s.default.KEY_APPID, this.appid);
          this.cid = s.default.getSync(s.default.KEY_CID, this.cid);
          if (this.cid)
            null === (e3 = this.onClientId) || void 0 === e3 || e3.call(this.onClientId, { cid: f2.cid });
          this.session = s.default.getSync(s.default.KEY_SESSION, this.session);
          this.deviceId = s.default.getSync(s.default.KEY_DEVICE_ID, this.deviceId);
          this.regId = s.default.getSync(s.default.KEY_REGID, this.regId);
          if (!this.regId) {
            this.regId = this.createRegId();
            s.default.set({ key: s.default.KEY_REGID, data: this.regId });
          }
          this.socketUrl = s.default.getSync(s.default.KEY_SOCKET_URL, this.socketUrl);
          let r3 = this;
          c.default.getNetworkType({ success: (t4) => {
            r3.networkType = t4.networkType;
            r3.networkConnected = "none" != r3.networkType && "" != r3.networkType;
          } });
          c.default.onNetworkStatusChange((t4) => {
            r3.networkConnected = t4.isConnected;
            r3.networkType = t4.networkType;
            if (r3.networkConnected)
              o2.default.reconnect(100);
          });
        }
        static createRegId() {
          return `M-V${n.default.md5Hex(this.getUuid())}-${(/* @__PURE__ */ new Date()).getTime()}`;
        }
        static getUuid() {
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(t3) {
            let e3 = 16 * Math.random() | 0, r3 = "x" === t3 ? e3 : 3 & e3 | 8;
            return r3.toString(16);
          });
        }
      }
      f2.appid = "";
      f2.cid = "";
      f2.regId = "";
      f2.session = "";
      f2.deviceId = "";
      f2.packetId = 1;
      f2.online = false;
      f2.socketUrl = a.default.DEFAULT_SOCKET_URL;
      f2.publicKeyId = a.default.SERVER_PUBLIC_KEY_ID;
      f2.publicKey = a.default.SERVER_PUBLIC_KEY;
      f2.lastAliasTime = 0;
      f2.networkConnected = true;
      f2.networkType = "none";
      e2["default"] = f2;
    }, 9586: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      var n, s;
      Object.defineProperty(e2, "__esModule", { value: true });
      const a = i2(r2(661));
      const o2 = r2(4198);
      const u = i2(r2(6379));
      class c extends a.default {
        constructor() {
          super(...arguments);
          this.actionMsgData = new l();
        }
        static initActionMsg(t3, ...e3) {
          super.initMsg(t3);
          t3.command = a.default.Command.CLIENT_MSG;
          t3.data = t3.actionMsgData = l.create();
          return t3;
        }
        static parseActionMsg(t3, e3) {
          super.parseMsg(t3, e3);
          t3.actionMsgData = l.parse(t3.data);
          return t3;
        }
        send() {
          setTimeout(() => {
            var t3;
            if (c.waitingLoginMsgMap.has(this.actionMsgData.msgId) || c.waitingResponseMsgMap.has(this.actionMsgData.msgId)) {
              c.waitingLoginMsgMap.delete(this.actionMsgData.msgId);
              c.waitingResponseMsgMap.delete(this.actionMsgData.msgId);
              null === (t3 = this.callback) || void 0 === t3 || t3.call(this.callback, { resultCode: o2.ErrorCode.TIME_OUT, message: "waiting time out" });
            }
          }, 1e4);
          if (!u.default.online) {
            c.waitingLoginMsgMap.set(this.actionMsgData.msgId, this);
            return;
          }
          if (this.actionMsgData.msgAction != c.ClientAction.RECEIVED)
            c.waitingResponseMsgMap.set(this.actionMsgData.msgId, this);
          super.send();
        }
        receive() {
        }
        static sendWaitingMessages() {
          let t3 = this.waitingLoginMsgMap.keys();
          let e3;
          while (e3 = t3.next(), !e3.done) {
            let t4 = this.waitingLoginMsgMap.get(e3.value);
            this.waitingLoginMsgMap.delete(e3.value);
            null === t4 || void 0 === t4 || t4.send();
          }
        }
        static getWaitingResponseMessage(t3) {
          return c.waitingResponseMsgMap.get(t3);
        }
        static removeWaitingResponseMessage(t3) {
          let e3 = c.waitingResponseMsgMap.get(t3);
          if (e3)
            c.waitingResponseMsgMap.delete(t3);
          return e3;
        }
      }
      c.ServerAction = (n = class {
      }, n.PUSH_MESSAGE = "pushmessage", n.REDIRECT_SERVER = "redirect_server", n.ADD_PHONE_INFO_RESULT = "addphoneinfo", n.SET_MODE_RESULT = "set_mode_result", n.SET_TAG_RESULT = "settag_result", n.BIND_ALIAS_RESULT = "response_bind", n.UNBIND_ALIAS_RESULT = "response_unbind", n.FEED_BACK_RESULT = "pushmessage_feedback", n.RECEIVED = "received", n);
      c.ClientAction = (s = class {
      }, s.ADD_PHONE_INFO = "addphoneinfo", s.SET_MODE = "set_mode", s.FEED_BACK = "pushmessage_feedback", s.SET_TAGS = "set_tag", s.BIND_ALIAS = "bind_alias", s.UNBIND_ALIAS = "unbind_alias", s.RECEIVED = "received", s);
      c.waitingLoginMsgMap = /* @__PURE__ */ new Map();
      c.waitingResponseMsgMap = /* @__PURE__ */ new Map();
      class l {
        constructor() {
          this.appId = "";
          this.cid = "";
          this.msgId = "";
          this.msgAction = "";
          this.msgData = "";
          this.msgExtraData = "";
        }
        static create() {
          let t3 = new l();
          t3.appId = u.default.appid;
          t3.cid = u.default.cid;
          t3.msgId = (2147483647 & (/* @__PURE__ */ new Date()).getTime()).toString();
          return t3;
        }
        static parse(t3) {
          let e3 = new l();
          let r3 = JSON.parse(t3);
          e3.appId = r3.appId;
          e3.cid = r3.cid;
          e3.msgId = r3.msgId;
          e3.msgAction = r3.msgAction;
          e3.msgData = r3.msgData;
          e3.msgExtraData = r3.msgExtraData;
          return e3;
        }
      }
      e2["default"] = c;
    }, 4516: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(4685));
      const s = i2(r2(8506));
      const a = i2(r2(6893));
      const o2 = r2(4198);
      const u = i2(r2(9586));
      const c = i2(r2(6379));
      class l extends u.default {
        constructor() {
          super(...arguments);
          this.addPhoneInfoData = new f2();
        }
        static create() {
          let t3 = new l();
          super.initActionMsg(t3);
          t3.callback = (e3) => {
            if (e3.resultCode != o2.ErrorCode.SUCCESS && e3.resultCode != o2.ErrorCode.REPEAT_MESSAGE)
              setTimeout(function() {
                t3.send();
              }, 30 * 1e3);
            else
              s.default.set({ key: s.default.KEY_ADD_PHONE_INFO_TIME, data: (/* @__PURE__ */ new Date()).getTime() });
          };
          t3.actionMsgData.msgAction = u.default.ClientAction.ADD_PHONE_INFO;
          t3.addPhoneInfoData = f2.create();
          t3.actionMsgData.msgData = JSON.stringify(t3.addPhoneInfoData);
          return t3;
        }
        send() {
          let t3 = (/* @__PURE__ */ new Date()).getTime();
          let e3 = s.default.getSync(s.default.KEY_ADD_PHONE_INFO_TIME, 0);
          if (t3 - e3 < 24 * 60 * 60 * 1e3)
            return;
          super.send();
        }
      }
      class f2 {
        constructor() {
          this.model = "";
          this.brand = "";
          this.system_version = "";
          this.version = "";
          this.deviceid = "";
          this.type = "";
        }
        static create() {
          let t3 = new f2();
          t3.model = n.default.model();
          t3.brand = n.default.brand();
          t3.system_version = n.default.osVersion();
          t3.version = a.default.SDK_VERSION;
          t3.device_token = "";
          t3.imei = "";
          t3.oaid = "";
          t3.mac = "";
          t3.idfa = "";
          t3.type = "MINIPROGRAM";
          t3.deviceid = `${t3.type}-${c.default.deviceId}`;
          t3.extra = { os: n.default.os(), platform: n.default.platform(), platformVersion: n.default.platformVersion(), platformId: n.default.platformId(), language: n.default.language(), userAgent: n.default.userAgent() };
          return t3;
        }
      }
      e2["default"] = l;
    }, 8723: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      var n, s;
      Object.defineProperty(e2, "__esModule", { value: true });
      const a = i2(r2(6379));
      const o2 = r2(4198);
      const u = i2(r2(9586));
      class c extends u.default {
        constructor() {
          super(...arguments);
          this.feedbackData = new l();
        }
        static create(t3, e3) {
          let r3 = new c();
          super.initActionMsg(r3);
          r3.callback = (t4) => {
            if (t4.resultCode != o2.ErrorCode.SUCCESS && t4.resultCode != o2.ErrorCode.REPEAT_MESSAGE)
              setTimeout(function() {
                r3.send();
              }, 30 * 1e3);
          };
          r3.feedbackData = l.create(t3, e3);
          r3.actionMsgData.msgAction = u.default.ClientAction.FEED_BACK;
          r3.actionMsgData.msgData = JSON.stringify(r3.feedbackData);
          return r3;
        }
        send() {
          super.send();
        }
      }
      c.ActionId = (n = class {
      }, n.RECEIVE = "0", n.MP_RECEIVE = "210000", n.WEB_RECEIVE = "220000", n.BEGIN = "1", n);
      c.RESULT = (s = class {
      }, s.OK = "ok", s);
      class l {
        constructor() {
          this.messageid = "";
          this.appkey = "";
          this.appid = "";
          this.taskid = "";
          this.actionid = "";
          this.result = "";
          this.timestamp = "";
        }
        static create(t3, e3) {
          let r3 = new l();
          r3.messageid = t3.pushMessageData.messageid;
          r3.appkey = t3.pushMessageData.appKey;
          r3.appid = a.default.appid;
          r3.taskid = t3.pushMessageData.taskId;
          r3.actionid = e3;
          r3.result = c.RESULT.OK;
          r3.timestamp = (/* @__PURE__ */ new Date()).getTime().toString();
          return r3;
        }
      }
      e2["default"] = c;
    }, 6362: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(661));
      class s extends n.default {
        static create() {
          let t3 = new s();
          super.initMsg(t3);
          t3.command = n.default.Command.HEART_BEAT;
          return t3;
        }
      }
      e2["default"] = s;
    }, 1386: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(6667));
      const s = i2(r2(6379));
      const a = i2(r2(661));
      class o2 extends a.default {
        constructor() {
          super(...arguments);
          this.keyNegotiateData = new u();
        }
        static create() {
          let t3 = new o2();
          super.initMsg(t3);
          t3.command = a.default.Command.KEY_NEGOTIATE;
          n.default.resetKey();
          t3.data = t3.keyNegotiateData = u.create();
          return t3;
        }
        send() {
          super.send();
        }
      }
      class u {
        constructor() {
          this.appId = "";
          this.rsaPublicKeyId = "";
          this.algorithm = "";
          this.secretKey = "";
          this.iv = "";
        }
        static create() {
          let t3 = new u();
          t3.appId = s.default.appid;
          t3.rsaPublicKeyId = s.default.publicKeyId;
          t3.algorithm = "AES";
          t3.secretKey = n.default.getEncryptedSecretKey();
          t3.iv = n.default.getEncryptedIV();
          return t3;
        }
      }
      e2["default"] = o2;
    }, 1280: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(661));
      const s = i2(r2(6667));
      const a = i2(r2(8858));
      const o2 = i2(r2(529));
      const u = i2(r2(6379));
      class c extends n.default {
        constructor() {
          super(...arguments);
          this.keyNegotiateResultData = new l();
        }
        static parse(t3) {
          let e3 = new c();
          super.parseMsg(e3, t3);
          e3.keyNegotiateResultData = l.parse(e3.data);
          return e3;
        }
        receive() {
          var t3, e3;
          if (0 != this.keyNegotiateResultData.errorCode) {
            o2.default.error(`key negotiate fail: ${this.data}`);
            null === (t3 = u.default.onError) || void 0 === t3 || t3.call(u.default.onError, { error: `key negotiate fail: ${this.data}` });
            return;
          }
          let r3 = this.keyNegotiateResultData.encryptType.split("/");
          if (!s.default.algorithmMap.has(r3[0].trim().toLowerCase()) || !s.default.modeMap.has(r3[1].trim().toLowerCase()) || !s.default.paddingMap.has(r3[2].trim().toLowerCase())) {
            o2.default.error(`key negotiate fail: ${this.data}`);
            null === (e3 = u.default.onError) || void 0 === e3 || e3.call(u.default.onError, { error: `key negotiate fail: ${this.data}` });
            return;
          }
          s.default.setEncryptParams(r3[0].trim().toLowerCase(), r3[1].trim().toLowerCase(), r3[2].trim().toLowerCase());
          a.default.create().send();
        }
      }
      class l {
        constructor() {
          this.errorCode = -1;
          this.errorMsg = "";
          this.encryptType = "";
        }
        static parse(t3) {
          let e3 = new l();
          let r3 = JSON.parse(t3);
          e3.errorCode = r3.errorCode;
          e3.errorMsg = r3.errorMsg;
          e3.encryptType = r3.encryptType;
          return e3;
        }
      }
      e2["default"] = c;
    }, 8858: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(6379));
      const s = i2(r2(6667));
      const a = i2(r2(661));
      const o2 = i2(r2(4534));
      class u extends a.default {
        constructor() {
          super(...arguments);
          this.loginData = new c();
        }
        static create() {
          let t3 = new u();
          super.initMsg(t3);
          t3.command = a.default.Command.LOGIN;
          t3.data = t3.loginData = c.create();
          return t3;
        }
        send() {
          if (!this.loginData.session || n.default.cid != s.default.md5Hex(this.loginData.session)) {
            o2.default.create().send();
            return;
          }
          super.send();
        }
      }
      class c {
        constructor() {
          this.appId = "";
          this.session = "";
        }
        static create() {
          let t3 = new c();
          t3.appId = n.default.appid;
          t3.session = n.default.session;
          return t3;
        }
      }
      e2["default"] = u;
    }, 1606: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(8506));
      const s = i2(r2(661));
      const a = i2(r2(6379));
      const o2 = i2(r2(9586));
      const u = i2(r2(4516));
      const c = i2(r2(8858));
      class l extends s.default {
        constructor() {
          super(...arguments);
          this.loginResultData = new f2();
        }
        static parse(t3) {
          let e3 = new l();
          super.parseMsg(e3, t3);
          e3.loginResultData = f2.parse(e3.data);
          return e3;
        }
        receive() {
          var t3;
          if (0 != this.loginResultData.errorCode) {
            this.data;
            a.default.session = a.default.cid = "";
            n.default.setSync(n.default.KEY_CID, "");
            n.default.setSync(n.default.KEY_SESSION, "");
            c.default.create().send();
            return;
          }
          if (!a.default.online) {
            a.default.online = true;
            null === (t3 = a.default.onlineState) || void 0 === t3 || t3.call(a.default.onlineState, { online: a.default.online });
          }
          o2.default.sendWaitingMessages();
          u.default.create().send();
        }
      }
      class f2 {
        constructor() {
          this.errorCode = -1;
          this.errorMsg = "";
          this.session = "";
        }
        static parse(t3) {
          let e3 = new f2();
          let r3 = JSON.parse(t3);
          e3.errorCode = r3.errorCode;
          e3.errorMsg = r3.errorMsg;
          e3.session = r3.session;
          return e3;
        }
      }
      e2["default"] = l;
    }, 661: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      var n;
      Object.defineProperty(e2, "__esModule", { value: true });
      const s = i2(r2(9593));
      const a = i2(r2(7002));
      const o2 = i2(r2(6893));
      const u = i2(r2(6379));
      class c {
        constructor() {
          this.version = "";
          this.command = 0;
          this.packetId = 0;
          this.timeStamp = 0;
          this.data = "";
          this.signature = "";
        }
        static initMsg(t3, ...e3) {
          t3.version = o2.default.SOCKET_PROTOCOL_VERSION;
          t3.command = 0;
          t3.timeStamp = (/* @__PURE__ */ new Date()).getTime();
          return t3;
        }
        static parseMsg(t3, e3) {
          let r3 = JSON.parse(e3);
          t3.version = r3.version;
          t3.command = r3.command;
          t3.packetId = r3.packetId;
          t3.timeStamp = r3.timeStamp;
          t3.data = r3.data;
          t3.signature = r3.signature;
          return t3;
        }
        stringify() {
          return JSON.stringify(this, ["version", "command", "packetId", "timeStamp", "data", "signature"]);
        }
        send() {
          if (!a.default.isAvailable())
            return;
          this.packetId = u.default.packetId++;
          if (this.temp)
            this.data = this.temp;
          else
            this.temp = this.data;
          this.data = JSON.stringify(this.data);
          this.stringify();
          if (this.command != c.Command.HEART_BEAT) {
            s.default.sign(this);
            if (this.data && this.command != c.Command.KEY_NEGOTIATE)
              s.default.encrypt(this);
          }
          a.default.send(this.stringify());
        }
      }
      c.Command = (n = class {
      }, n.HEART_BEAT = 0, n.KEY_NEGOTIATE = 1, n.KEY_NEGOTIATE_RESULT = 16, n.REGISTER = 2, n.REGISTER_RESULT = 32, n.LOGIN = 3, n.LOGIN_RESULT = 48, n.LOGOUT = 4, n.LOGOUT_RESULT = 64, n.CLIENT_MSG = 5, n.SERVER_MSG = 80, n.SERVER_CLOSE = 96, n.REDIRECT_SERVER = 112, n);
      e2["default"] = c;
    }, 9593: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(6667));
      var s;
      (function(t3) {
        function e3(t4) {
          t4.data = n.default.encrypt(t4.data);
        }
        t3.encrypt = e3;
        function r3(t4) {
          t4.data = n.default.decrypt(t4.data);
        }
        t3.decrypt = r3;
        function i3(t4) {
          t4.signature = n.default.sha256(`${t4.timeStamp}${t4.packetId}${t4.command}${t4.data}`);
        }
        t3.sign = i3;
        function s2(t4) {
          let e4 = n.default.sha256(`${t4.timeStamp}${t4.packetId}${t4.command}${t4.data}`);
          if (t4.signature != e4)
            throw new Error(`msg signature vierfy failed`);
        }
        t3.verify = s2;
      })(s || (s = {}));
      e2["default"] = s;
    }, 4054: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(1280));
      const s = i2(r2(1606));
      const a = i2(r2(661));
      const o2 = i2(r2(1277));
      const u = i2(r2(910));
      const c = i2(r2(9538));
      const l = i2(r2(9479));
      const f2 = i2(r2(6755));
      const h = i2(r2(2918));
      const d = i2(r2(9586));
      const v = i2(r2(9510));
      const p = i2(r2(4626));
      const g = i2(r2(7562));
      const y = i2(r2(9593));
      const m = i2(r2(9586));
      const w = i2(r2(9519));
      const S = i2(r2(8947));
      class _ {
        static receiveMessage(t3) {
          let e3 = a.default.parseMsg(new a.default(), t3);
          if (e3.command == a.default.Command.HEART_BEAT)
            return;
          if (e3.command != a.default.Command.KEY_NEGOTIATE_RESULT && e3.command != a.default.Command.SERVER_CLOSE && e3.command != a.default.Command.REDIRECT_SERVER)
            y.default.decrypt(e3);
          if (e3.command != a.default.Command.SERVER_CLOSE && e3.command != a.default.Command.REDIRECT_SERVER)
            y.default.verify(e3);
          switch (e3.command) {
            case a.default.Command.KEY_NEGOTIATE_RESULT:
              n.default.parse(e3.stringify()).receive();
              break;
            case a.default.Command.REGISTER_RESULT:
              o2.default.parse(e3.stringify()).receive();
              break;
            case a.default.Command.LOGIN_RESULT:
              s.default.parse(e3.stringify()).receive();
              break;
            case a.default.Command.SERVER_MSG:
              this.receiveActionMsg(e3.stringify());
              break;
            case a.default.Command.SERVER_CLOSE:
              S.default.parse(e3.stringify()).receive();
              break;
            case a.default.Command.REDIRECT_SERVER:
              h.default.parse(e3.stringify()).receive();
              break;
          }
        }
        static receiveActionMsg(t3) {
          let e3 = m.default.parseActionMsg(new m.default(), t3);
          if (e3.actionMsgData.msgAction != d.default.ServerAction.RECEIVED && e3.actionMsgData.msgAction != d.default.ServerAction.REDIRECT_SERVER) {
            let t4 = JSON.parse(e3.actionMsgData.msgData);
            w.default.create(t4.id).send();
          }
          switch (e3.actionMsgData.msgAction) {
            case d.default.ServerAction.PUSH_MESSAGE:
              f2.default.parse(t3).receive();
              break;
            case d.default.ServerAction.ADD_PHONE_INFO_RESULT:
              u.default.parse(t3).receive();
              break;
            case d.default.ServerAction.SET_MODE_RESULT:
              v.default.parse(t3).receive();
              break;
            case d.default.ServerAction.SET_TAG_RESULT:
              p.default.parse(t3).receive();
              break;
            case d.default.ServerAction.BIND_ALIAS_RESULT:
              c.default.parse(t3).receive();
              break;
            case d.default.ServerAction.UNBIND_ALIAS_RESULT:
              g.default.parse(t3).receive();
              break;
            case d.default.ServerAction.FEED_BACK_RESULT:
              l.default.parse(t3).receive();
              break;
            case d.default.ServerAction.RECEIVED:
              w.default.parse(t3).receive();
              break;
          }
        }
      }
      e2["default"] = _;
    }, 9519: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = r2(4198);
      const s = i2(r2(6379));
      const a = i2(r2(9586));
      class o2 extends a.default {
        constructor() {
          super(...arguments);
          this.receivedData = new u();
        }
        static create(t3) {
          let e3 = new o2();
          super.initActionMsg(e3);
          e3.callback = (t4) => {
            if (t4.resultCode != n.ErrorCode.SUCCESS && t4.resultCode != n.ErrorCode.REPEAT_MESSAGE)
              setTimeout(function() {
                e3.send();
              }, 3 * 1e3);
          };
          e3.actionMsgData.msgAction = a.default.ClientAction.RECEIVED;
          e3.receivedData = u.create(t3);
          e3.actionMsgData.msgData = JSON.stringify(e3.receivedData);
          return e3;
        }
        static parse(t3) {
          let e3 = new o2();
          super.parseActionMsg(e3, t3);
          e3.receivedData = u.parse(e3.data);
          return e3;
        }
        receive() {
          var t3;
          let e3 = a.default.getWaitingResponseMessage(this.actionMsgData.msgId);
          if (e3 && e3.actionMsgData.msgAction == a.default.ClientAction.ADD_PHONE_INFO || e3 && e3.actionMsgData.msgAction == a.default.ClientAction.FEED_BACK) {
            a.default.removeWaitingResponseMessage(e3.actionMsgData.msgId);
            null === (t3 = e3.callback) || void 0 === t3 || t3.call(e3.callback, { resultCode: n.ErrorCode.SUCCESS, message: "received" });
          }
        }
        send() {
          super.send();
        }
      }
      class u {
        constructor() {
          this.msgId = "";
          this.cid = "";
        }
        static create(t3) {
          let e3 = new u();
          e3.cid = s.default.cid;
          e3.msgId = t3;
          return e3;
        }
        static parse(t3) {
          let e3 = new u();
          let r3 = JSON.parse(t3);
          e3.cid = r3.cid;
          e3.msgId = r3.msgId;
          return e3;
        }
      }
      e2["default"] = o2;
    }, 2918: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      e2.RedirectServerData = void 0;
      const n = i2(r2(7002));
      const s = i2(r2(8506));
      const a = i2(r2(661));
      class o2 extends a.default {
        constructor() {
          super(...arguments);
          this.redirectServerData = new u();
        }
        static parse(t3) {
          let e3 = new o2();
          super.parseMsg(e3, t3);
          e3.redirectServerData = u.parse(e3.data);
          return e3;
        }
        receive() {
          this.redirectServerData;
          s.default.setSync(s.default.KEY_REDIRECT_SERVER, JSON.stringify(this.redirectServerData));
          n.default.close("redirect server");
          n.default.reconnect(this.redirectServerData.delay);
        }
      }
      class u {
        constructor() {
          this.addressList = [];
          this.delay = 0;
          this.loc = "";
          this.conf = "";
          this.time = 0;
        }
        static parse(t3) {
          let e3 = new u();
          let r3 = JSON.parse(t3);
          e3.addressList = r3.addressList;
          e3.delay = r3.delay;
          e3.loc = r3.loc;
          e3.conf = r3.conf;
          e3.time = r3.time ? r3.time : (/* @__PURE__ */ new Date()).getTime();
          return e3;
        }
      }
      e2.RedirectServerData = u;
      e2["default"] = o2;
    }, 4534: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(6379));
      const s = i2(r2(661));
      class a extends s.default {
        constructor() {
          super(...arguments);
          this.registerData = new o2();
        }
        static create() {
          let t3 = new a();
          super.initMsg(t3);
          t3.command = s.default.Command.REGISTER;
          t3.data = t3.registerData = o2.create();
          return t3;
        }
        send() {
          super.send();
        }
      }
      class o2 {
        constructor() {
          this.appId = "";
          this.regId = "";
        }
        static create() {
          let t3 = new o2();
          t3.appId = n.default.appid;
          t3.regId = n.default.regId;
          return t3;
        }
      }
      e2["default"] = a;
    }, 1277: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(661));
      const s = i2(r2(8506));
      const a = i2(r2(6379));
      const o2 = i2(r2(8858));
      const u = i2(r2(529));
      class c extends n.default {
        constructor() {
          super(...arguments);
          this.registerResultData = new l();
        }
        static parse(t3) {
          let e3 = new c();
          super.parseMsg(e3, t3);
          e3.registerResultData = l.parse(e3.data);
          return e3;
        }
        receive() {
          var t3, e3;
          if (0 != this.registerResultData.errorCode || !this.registerResultData.cid || !this.registerResultData.session) {
            u.default.error(`register fail: ${this.data}`);
            null === (t3 = a.default.onError) || void 0 === t3 || t3.call(a.default.onError, { error: `register fail: ${this.data}` });
            return;
          }
          if (a.default.cid != this.registerResultData.cid)
            s.default.setSync(s.default.KEY_ADD_PHONE_INFO_TIME, 0);
          a.default.cid = this.registerResultData.cid;
          null === (e3 = a.default.onClientId) || void 0 === e3 || e3.call(a.default.onClientId, { cid: a.default.cid });
          s.default.set({ key: s.default.KEY_CID, data: a.default.cid });
          a.default.session = this.registerResultData.session;
          s.default.set({ key: s.default.KEY_SESSION, data: a.default.session });
          a.default.deviceId = this.registerResultData.deviceId;
          s.default.set({ key: s.default.KEY_DEVICE_ID, data: a.default.deviceId });
          o2.default.create().send();
        }
      }
      class l {
        constructor() {
          this.errorCode = -1;
          this.errorMsg = "";
          this.cid = "";
          this.session = "";
          this.deviceId = "";
          this.regId = "";
        }
        static parse(t3) {
          let e3 = new l();
          let r3 = JSON.parse(t3);
          e3.errorCode = r3.errorCode;
          e3.errorMsg = r3.errorMsg;
          e3.cid = r3.cid;
          e3.session = r3.session;
          e3.deviceId = r3.deviceId;
          e3.regId = r3.regId;
          return e3;
        }
      }
      e2["default"] = c;
    }, 8947: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(7002));
      const s = i2(r2(529));
      const a = i2(r2(661));
      class o2 extends a.default {
        constructor() {
          super(...arguments);
          this.serverCloseData = new u();
        }
        static parse(t3) {
          let e3 = new o2();
          super.parseMsg(e3, t3);
          e3.serverCloseData = u.parse(e3.data);
          return e3;
        }
        receive() {
          JSON.stringify(this.serverCloseData);
          let t3 = `server close ${this.serverCloseData.code}`;
          if (20 == this.serverCloseData.code || 23 == this.serverCloseData.code || 24 == this.serverCloseData.code) {
            n.default.allowReconnect = false;
            n.default.close(t3);
          } else if (21 == this.serverCloseData.code)
            this.safeClose21(t3);
          else {
            n.default.allowReconnect = true;
            n.default.close(t3);
            n.default.reconnect(10);
          }
        }
        safeClose21(t3) {
          try {
            if ("undefined" != typeof document) {
              if (document.hasFocus() && "visible" == document.visibilityState) {
                n.default.allowReconnect = true;
                n.default.close(t3);
                n.default.reconnect(10);
                return;
              }
            }
            n.default.allowReconnect = false;
            n.default.close(t3);
          } catch (e3) {
            s.default.error(`ServerClose t1`, e3);
            n.default.allowReconnect = false;
            n.default.close(`${t3} error`);
          }
        }
      }
      class u {
        constructor() {
          this.code = -1;
          this.msg = "";
        }
        static parse(t3) {
          let e3 = new u();
          let r3 = JSON.parse(t3);
          e3.code = r3.code;
          e3.msg = r3.msg;
          return e3;
        }
      }
      e2["default"] = o2;
    }, 910: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(8506));
      const s = i2(r2(9586));
      class a extends s.default {
        constructor() {
          super(...arguments);
          this.addPhoneInfoResultData = new o2();
        }
        static parse(t3) {
          let e3 = new a();
          super.parseActionMsg(e3, t3);
          e3.addPhoneInfoResultData = o2.parse(e3.actionMsgData.msgData);
          return e3;
        }
        receive() {
          var t3;
          this.addPhoneInfoResultData;
          let e3 = s.default.removeWaitingResponseMessage(this.actionMsgData.msgId);
          if (e3)
            null === (t3 = e3.callback) || void 0 === t3 || t3.call(e3.callback, { resultCode: this.addPhoneInfoResultData.errorCode, message: this.addPhoneInfoResultData.errorMsg });
          n.default.set({ key: n.default.KEY_ADD_PHONE_INFO_TIME, data: (/* @__PURE__ */ new Date()).getTime() });
        }
      }
      class o2 {
        constructor() {
          this.errorCode = -1;
          this.errorMsg = "";
        }
        static parse(t3) {
          let e3 = new o2();
          let r3 = JSON.parse(t3);
          e3.errorCode = r3.errorCode;
          e3.errorMsg = r3.errorMsg;
          return e3;
        }
      }
      e2["default"] = a;
    }, 9538: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(8506));
      const s = i2(r2(529));
      const a = i2(r2(9586));
      class o2 extends a.default {
        constructor() {
          super(...arguments);
          this.bindAliasResultData = new u();
        }
        static parse(t3) {
          let e3 = new o2();
          super.parseActionMsg(e3, t3);
          e3.bindAliasResultData = u.parse(e3.actionMsgData.msgData);
          return e3;
        }
        receive() {
          var t3;
          s.default.info(`bind alias result`, this.bindAliasResultData);
          let e3 = a.default.removeWaitingResponseMessage(this.actionMsgData.msgId);
          if (e3)
            null === (t3 = e3.callback) || void 0 === t3 || t3.call(e3.callback, { resultCode: this.bindAliasResultData.errorCode, message: this.bindAliasResultData.errorMsg });
          n.default.set({ key: n.default.KEY_BIND_ALIAS_TIME, data: (/* @__PURE__ */ new Date()).getTime() });
        }
      }
      class u {
        constructor() {
          this.errorCode = -1;
          this.errorMsg = "";
        }
        static parse(t3) {
          let e3 = new u();
          let r3 = JSON.parse(t3);
          e3.errorCode = r3.errorCode;
          e3.errorMsg = r3.errorMsg;
          return e3;
        }
      }
      e2["default"] = o2;
    }, 9479: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = r2(4198);
      const s = i2(r2(9586));
      class a extends s.default {
        constructor() {
          super(...arguments);
          this.feedbackResultData = new o2();
        }
        static parse(t3) {
          let e3 = new a();
          super.parseActionMsg(e3, t3);
          e3.feedbackResultData = o2.parse(e3.actionMsgData.msgData);
          return e3;
        }
        receive() {
          var t3;
          this.feedbackResultData;
          let e3 = s.default.removeWaitingResponseMessage(this.actionMsgData.msgId);
          if (e3)
            null === (t3 = e3.callback) || void 0 === t3 || t3.call(e3.callback, { resultCode: n.ErrorCode.SUCCESS, message: "received" });
        }
      }
      class o2 {
        constructor() {
          this.actionId = "";
          this.taskId = "";
          this.result = "";
        }
        static parse(t3) {
          let e3 = new o2();
          let r3 = JSON.parse(t3);
          e3.actionId = r3.actionId;
          e3.taskId = r3.taskId;
          e3.result = r3.result;
          return e3;
        }
      }
      e2["default"] = a;
    }, 6755: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      var n;
      Object.defineProperty(e2, "__esModule", { value: true });
      const s = i2(r2(6379));
      const a = i2(r2(9586));
      const o2 = i2(r2(8723));
      class u extends a.default {
        constructor() {
          super(...arguments);
          this.pushMessageData = new c();
        }
        static parse(t3) {
          let e3 = new u();
          super.parseActionMsg(e3, t3);
          e3.pushMessageData = c.parse(e3.actionMsgData.msgData);
          return e3;
        }
        receive() {
          var t3;
          this.pushMessageData;
          if (this.pushMessageData.appId != s.default.appid || !this.pushMessageData.messageid || !this.pushMessageData.taskId)
            this.stringify();
          o2.default.create(this, o2.default.ActionId.RECEIVE).send();
          o2.default.create(this, o2.default.ActionId.MP_RECEIVE).send();
          if (this.actionMsgData.msgExtraData && s.default.onPushMsg)
            null === (t3 = s.default.onPushMsg) || void 0 === t3 || t3.call(s.default.onPushMsg, { message: this.actionMsgData.msgExtraData });
        }
      }
      class c {
        constructor() {
          this.id = "";
          this.appKey = "";
          this.appId = "";
          this.messageid = "";
          this.taskId = "";
          this.actionChain = [];
          this.cdnType = "";
        }
        static parse(t3) {
          let e3 = new c();
          let r3 = JSON.parse(t3);
          e3.id = r3.id;
          e3.appKey = r3.appKey;
          e3.appId = r3.appId;
          e3.messageid = r3.messageid;
          e3.taskId = r3.taskId;
          e3.actionChain = r3.actionChain;
          e3.cdnType = r3.cdnType;
          return e3;
        }
      }
      n = class {
      }, n.GO_TO = "goto", n.TRANSMIT = "transmit";
      e2["default"] = u;
    }, 9510: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(9586));
      class s extends n.default {
        constructor() {
          super(...arguments);
          this.setModeResultData = new a();
        }
        static parse(t3) {
          let e3 = new s();
          super.parseActionMsg(e3, t3);
          e3.setModeResultData = a.parse(e3.actionMsgData.msgData);
          return e3;
        }
        receive() {
          var t3;
          this.setModeResultData;
          let e3 = n.default.removeWaitingResponseMessage(this.actionMsgData.msgId);
          if (e3)
            null === (t3 = e3.callback) || void 0 === t3 || t3.call(e3.callback, { resultCode: this.setModeResultData.errorCode, message: this.setModeResultData.errorMsg });
        }
      }
      class a {
        constructor() {
          this.errorCode = -1;
          this.errorMsg = "";
        }
        static parse(t3) {
          let e3 = new a();
          let r3 = JSON.parse(t3);
          e3.errorCode = r3.errorCode;
          e3.errorMsg = r3.errorMsg;
          return e3;
        }
      }
      e2["default"] = s;
    }, 4626: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(8506));
      const s = i2(r2(529));
      const a = i2(r2(9586));
      class o2 extends a.default {
        constructor() {
          super(...arguments);
          this.setTagResultData = new u();
        }
        static parse(t3) {
          let e3 = new o2();
          super.parseActionMsg(e3, t3);
          e3.setTagResultData = u.parse(e3.actionMsgData.msgData);
          return e3;
        }
        receive() {
          var t3;
          s.default.info(`set tag result`, this.setTagResultData);
          let e3 = a.default.removeWaitingResponseMessage(this.actionMsgData.msgId);
          if (e3)
            null === (t3 = e3.callback) || void 0 === t3 || t3.call(e3.callback, { resultCode: this.setTagResultData.errorCode, message: this.setTagResultData.errorMsg });
          n.default.set({ key: n.default.KEY_SET_TAG_TIME, data: (/* @__PURE__ */ new Date()).getTime() });
        }
      }
      class u {
        constructor() {
          this.errorCode = 0;
          this.errorMsg = "";
        }
        static parse(t3) {
          let e3 = new u();
          let r3 = JSON.parse(t3);
          e3.errorCode = r3.errorCode;
          e3.errorMsg = r3.errorMsg;
          return e3;
        }
      }
      e2["default"] = o2;
    }, 7562: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(8506));
      const s = i2(r2(529));
      const a = i2(r2(9586));
      class o2 extends a.default {
        constructor() {
          super(...arguments);
          this.unbindAliasResultData = new u();
        }
        static parse(t3) {
          let e3 = new o2();
          super.parseActionMsg(e3, t3);
          e3.unbindAliasResultData = u.parse(e3.actionMsgData.msgData);
          return e3;
        }
        receive() {
          var t3;
          s.default.info(`unbind alias result`, this.unbindAliasResultData);
          let e3 = a.default.removeWaitingResponseMessage(this.actionMsgData.msgId);
          if (e3)
            null === (t3 = e3.callback) || void 0 === t3 || t3.call(e3.callback, { resultCode: this.unbindAliasResultData.errorCode, message: this.unbindAliasResultData.errorMsg });
          n.default.set({ key: n.default.KEY_BIND_ALIAS_TIME, data: (/* @__PURE__ */ new Date()).getTime() });
        }
      }
      class u {
        constructor() {
          this.errorCode = -1;
          this.errorMsg = "";
        }
        static parse(t3) {
          let e3 = new u();
          let r3 = JSON.parse(t3);
          e3.errorCode = r3.errorCode;
          e3.errorMsg = r3.errorMsg;
          return e3;
        }
      }
      e2["default"] = o2;
    }, 8227: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        constructor(t3) {
          this.delay = 10;
          this.delay = t3;
        }
        start() {
          this.cancel();
          let t3 = this;
          this.timer = setInterval(function() {
            t3.run();
          }, this.delay);
        }
        cancel() {
          if (this.timer)
            clearInterval(this.timer);
        }
      }
      e2["default"] = r2;
    }, 7167: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      var n;
      Object.defineProperty(e2, "__esModule", { value: true });
      const s = i2(r2(6362));
      const a = i2(r2(8227));
      class o2 extends a.default {
        static getInstance() {
          return o2.InstanceHolder.instance;
        }
        run() {
          s.default.create().send();
        }
        refresh() {
          this.delay = 60 * 1e3;
          this.start();
        }
      }
      o2.INTERVAL = 60 * 1e3;
      o2.InstanceHolder = (n = class {
      }, n.instance = new o2(o2.INTERVAL), n);
      e2["default"] = o2;
    }, 2323: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(4736));
      const s = i2(r2(6667));
      var a;
      (function(t3) {
        let e3 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        let r3 = (0, n.default)("9223372036854775808");
        function i3(t4) {
          let e4 = a2(t4);
          let r4 = o2(e4);
          let i4 = r4[1];
          let n2 = r4[0];
          return u(i4) + u(n2);
        }
        t3.to_getui = i3;
        function a2(t4) {
          let e4 = s.default.md5Hex(t4);
          let r4 = c(e4);
          r4[6] &= 15;
          r4[6] |= 48;
          r4[8] &= 63;
          r4[8] |= 128;
          return r4;
        }
        function o2(t4) {
          let e4 = (0, n.default)(0);
          let r4 = (0, n.default)(0);
          for (let r5 = 0; r5 < 8; r5++)
            e4 = e4.multiply(256).plus((0, n.default)(255 & t4[r5]));
          for (let e5 = 8; e5 < 16; e5++)
            r4 = r4.multiply(256).plus((0, n.default)(255 & t4[e5]));
          return [e4, r4];
        }
        function u(t4) {
          if (t4 >= r3)
            t4 = r3.multiply(2).minus(t4);
          let i4 = "";
          for (; t4 > (0, n.default)(0); t4 = t4.divide(62))
            i4 += e3.charAt(Number(t4.divmod(62).remainder));
          return i4;
        }
        function c(t4) {
          let e4 = t4.length;
          if (e4 % 2 != 0)
            return [];
          let r4 = new Array();
          for (let i4 = 0; i4 < e4; i4 += 2)
            r4.push(parseInt(t4.substring(i4, i4 + 2), 16));
          return r4;
        }
      })(a || (a = {}));
      e2["default"] = a;
    }, 6667: function(t22, e2, r2) {
      var i2 = this && this.__importDefault || function(t3) {
        return t3 && t3.__esModule ? t3 : { default: t3 };
      };
      Object.defineProperty(e2, "__esModule", { value: true });
      const n = i2(r2(2620));
      const s = i2(r2(1354));
      const a = i2(r2(6379));
      var o2;
      (function(t3) {
        let e3;
        let r3;
        let i3;
        let o22;
        let u = new n.default();
        let c = s.default.mode.CBC;
        let l = s.default.pad.Pkcs7;
        let f2 = s.default.AES;
        t3.algorithmMap = /* @__PURE__ */ new Map([["aes", s.default.AES]]);
        t3.modeMap = /* @__PURE__ */ new Map([["cbc", s.default.mode.CBC], ["cfb", s.default.mode.CFB], ["cfb128", s.default.mode.CFB], ["ecb", s.default.mode.ECB], ["ofb", s.default.mode.OFB]]);
        t3.paddingMap = /* @__PURE__ */ new Map([["nopadding", s.default.pad.NoPadding], ["pkcs7", s.default.pad.Pkcs7]]);
        function h() {
          e3 = s.default.MD5((/* @__PURE__ */ new Date()).getTime().toString());
          r3 = s.default.MD5(e3);
          u.setPublicKey(a.default.publicKey);
          e3.toString(s.default.enc.Hex);
          r3.toString(s.default.enc.Hex);
          i3 = u.encrypt(e3.toString(s.default.enc.Hex));
          o22 = u.encrypt(r3.toString(s.default.enc.Hex));
        }
        t3.resetKey = h;
        function d(e4, r4, i4) {
          f2 = t3.algorithmMap.get(e4);
          c = t3.modeMap.get(r4);
          l = t3.paddingMap.get(i4);
        }
        t3.setEncryptParams = d;
        function v(t4) {
          return f2.encrypt(t4, e3, { iv: r3, mode: c, padding: l }).toString();
        }
        t3.encrypt = v;
        function p(t4) {
          return f2.decrypt(t4, e3, { iv: r3, mode: c, padding: l }).toString(s.default.enc.Utf8);
        }
        t3.decrypt = p;
        function g(t4) {
          return s.default.SHA256(t4).toString(s.default.enc.Base64);
        }
        t3.sha256 = g;
        function y(t4) {
          return s.default.MD5(t4).toString(s.default.enc.Hex);
        }
        t3.md5Hex = y;
        function m() {
          return i3 ? i3 : "";
        }
        t3.getEncryptedSecretKey = m;
        function w() {
          return o22 ? o22 : "";
        }
        t3.getEncryptedIV = w;
      })(o2 || (o2 = {}));
      e2["default"] = o2;
    }, 529: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        static info(...t3) {
          if (this.debugMode)
            console.info(`[GtPush]`, t3);
        }
        static warn(...t3) {
          console.warn(`[GtPush]`, t3);
        }
        static error(...t3) {
          console.error(`[GtPush]`, t3);
        }
      }
      r2.debugMode = false;
      e2["default"] = r2;
    }, 3854: (t22, e2) => {
      Object.defineProperty(e2, "__esModule", { value: true });
      class r2 {
        static getStr(t3, e3) {
          try {
            if (!t3 || void 0 === t3[e3])
              return "";
            return t3[e3];
          } catch (t4) {
          }
          return "";
        }
      }
      e2["default"] = r2;
    }, 2620: (t22, e2, r2) => {
      r2.r(e2);
      r2.d(e2, { JSEncrypt: () => wt, default: () => St });
      var i2 = "0123456789abcdefghijklmnopqrstuvwxyz";
      function n(t3) {
        return i2.charAt(t3);
      }
      function s(t3, e3) {
        return t3 & e3;
      }
      function a(t3, e3) {
        return t3 | e3;
      }
      function o2(t3, e3) {
        return t3 ^ e3;
      }
      function u(t3, e3) {
        return t3 & ~e3;
      }
      function c(t3) {
        if (0 == t3)
          return -1;
        var e3 = 0;
        if (0 == (65535 & t3)) {
          t3 >>= 16;
          e3 += 16;
        }
        if (0 == (255 & t3)) {
          t3 >>= 8;
          e3 += 8;
        }
        if (0 == (15 & t3)) {
          t3 >>= 4;
          e3 += 4;
        }
        if (0 == (3 & t3)) {
          t3 >>= 2;
          e3 += 2;
        }
        if (0 == (1 & t3))
          ++e3;
        return e3;
      }
      function l(t3) {
        var e3 = 0;
        while (0 != t3) {
          t3 &= t3 - 1;
          ++e3;
        }
        return e3;
      }
      var f2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
      var h = "=";
      function d(t3) {
        var e3;
        var r3;
        var i3 = "";
        for (e3 = 0; e3 + 3 <= t3.length; e3 += 3) {
          r3 = parseInt(t3.substring(e3, e3 + 3), 16);
          i3 += f2.charAt(r3 >> 6) + f2.charAt(63 & r3);
        }
        if (e3 + 1 == t3.length) {
          r3 = parseInt(t3.substring(e3, e3 + 1), 16);
          i3 += f2.charAt(r3 << 2);
        } else if (e3 + 2 == t3.length) {
          r3 = parseInt(t3.substring(e3, e3 + 2), 16);
          i3 += f2.charAt(r3 >> 2) + f2.charAt((3 & r3) << 4);
        }
        while ((3 & i3.length) > 0)
          i3 += h;
        return i3;
      }
      function v(t3) {
        var e3 = "";
        var r3;
        var i3 = 0;
        var s2 = 0;
        for (r3 = 0; r3 < t3.length; ++r3) {
          if (t3.charAt(r3) == h)
            break;
          var a2 = f2.indexOf(t3.charAt(r3));
          if (a2 < 0)
            continue;
          if (0 == i3) {
            e3 += n(a2 >> 2);
            s2 = 3 & a2;
            i3 = 1;
          } else if (1 == i3) {
            e3 += n(s2 << 2 | a2 >> 4);
            s2 = 15 & a2;
            i3 = 2;
          } else if (2 == i3) {
            e3 += n(s2);
            e3 += n(a2 >> 2);
            s2 = 3 & a2;
            i3 = 3;
          } else {
            e3 += n(s2 << 2 | a2 >> 4);
            e3 += n(15 & a2);
            i3 = 0;
          }
        }
        if (1 == i3)
          e3 += n(s2 << 2);
        return e3;
      }
      var g;
      var y = { decode: function(t3) {
        var e3;
        if (void 0 === g) {
          var r3 = "0123456789ABCDEF";
          var i3 = " \f\n\r	 \u2028\u2029";
          g = {};
          for (e3 = 0; e3 < 16; ++e3)
            g[r3.charAt(e3)] = e3;
          r3 = r3.toLowerCase();
          for (e3 = 10; e3 < 16; ++e3)
            g[r3.charAt(e3)] = e3;
          for (e3 = 0; e3 < i3.length; ++e3)
            g[i3.charAt(e3)] = -1;
        }
        var n2 = [];
        var s2 = 0;
        var a2 = 0;
        for (e3 = 0; e3 < t3.length; ++e3) {
          var o22 = t3.charAt(e3);
          if ("=" == o22)
            break;
          o22 = g[o22];
          if (-1 == o22)
            continue;
          if (void 0 === o22)
            throw new Error("Illegal character at offset " + e3);
          s2 |= o22;
          if (++a2 >= 2) {
            n2[n2.length] = s2;
            s2 = 0;
            a2 = 0;
          } else
            s2 <<= 4;
        }
        if (a2)
          throw new Error("Hex encoding incomplete: 4 bits missing");
        return n2;
      } };
      var m;
      var w = { decode: function(t3) {
        var e3;
        if (void 0 === m) {
          var r3 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
          var i3 = "= \f\n\r	 \u2028\u2029";
          m = /* @__PURE__ */ Object.create(null);
          for (e3 = 0; e3 < 64; ++e3)
            m[r3.charAt(e3)] = e3;
          m["-"] = 62;
          m["_"] = 63;
          for (e3 = 0; e3 < i3.length; ++e3)
            m[i3.charAt(e3)] = -1;
        }
        var n2 = [];
        var s2 = 0;
        var a2 = 0;
        for (e3 = 0; e3 < t3.length; ++e3) {
          var o22 = t3.charAt(e3);
          if ("=" == o22)
            break;
          o22 = m[o22];
          if (-1 == o22)
            continue;
          if (void 0 === o22)
            throw new Error("Illegal character at offset " + e3);
          s2 |= o22;
          if (++a2 >= 4) {
            n2[n2.length] = s2 >> 16;
            n2[n2.length] = s2 >> 8 & 255;
            n2[n2.length] = 255 & s2;
            s2 = 0;
            a2 = 0;
          } else
            s2 <<= 6;
        }
        switch (a2) {
          case 1:
            throw new Error("Base64 encoding incomplete: at least 2 bits missing");
          case 2:
            n2[n2.length] = s2 >> 10;
            break;
          case 3:
            n2[n2.length] = s2 >> 16;
            n2[n2.length] = s2 >> 8 & 255;
            break;
        }
        return n2;
      }, re: /-----BEGIN [^-]+-----([A-Za-z0-9+\/=\s]+)-----END [^-]+-----|begin-base64[^\n]+\n([A-Za-z0-9+\/=\s]+)====/, unarmor: function(t3) {
        var e3 = w.re.exec(t3);
        if (e3)
          if (e3[1])
            t3 = e3[1];
          else if (e3[2])
            t3 = e3[2];
          else
            throw new Error("RegExp out of sync");
        return w.decode(t3);
      } };
      var S = 1e13;
      var _ = function() {
        function t3(t4) {
          this.buf = [+t4 || 0];
        }
        t3.prototype.mulAdd = function(t4, e3) {
          var r3 = this.buf;
          var i3 = r3.length;
          var n2;
          var s2;
          for (n2 = 0; n2 < i3; ++n2) {
            s2 = r3[n2] * t4 + e3;
            if (s2 < S)
              e3 = 0;
            else {
              e3 = 0 | s2 / S;
              s2 -= e3 * S;
            }
            r3[n2] = s2;
          }
          if (e3 > 0)
            r3[n2] = e3;
        };
        t3.prototype.sub = function(t4) {
          var e3 = this.buf;
          var r3 = e3.length;
          var i3;
          var n2;
          for (i3 = 0; i3 < r3; ++i3) {
            n2 = e3[i3] - t4;
            if (n2 < 0) {
              n2 += S;
              t4 = 1;
            } else
              t4 = 0;
            e3[i3] = n2;
          }
          while (0 === e3[e3.length - 1])
            e3.pop();
        };
        t3.prototype.toString = function(t4) {
          if (10 != (t4 || 10))
            throw new Error("only base 10 is supported");
          var e3 = this.buf;
          var r3 = e3[e3.length - 1].toString();
          for (var i3 = e3.length - 2; i3 >= 0; --i3)
            r3 += (S + e3[i3]).toString().substring(1);
          return r3;
        };
        t3.prototype.valueOf = function() {
          var t4 = this.buf;
          var e3 = 0;
          for (var r3 = t4.length - 1; r3 >= 0; --r3)
            e3 = e3 * S + t4[r3];
          return e3;
        };
        t3.prototype.simplify = function() {
          var t4 = this.buf;
          return 1 == t4.length ? t4[0] : this;
        };
        return t3;
      }();
      var b = "…";
      var E2 = /^(\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])(?:([0-5]\d)(?:([0-5]\d)(?:[.,](\d{1,3}))?)?)?(Z|[-+](?:[0]\d|1[0-2])([0-5]\d)?)?$/;
      var D = /^(\d\d\d\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])(?:([0-5]\d)(?:([0-5]\d)(?:[.,](\d{1,3}))?)?)?(Z|[-+](?:[0]\d|1[0-2])([0-5]\d)?)?$/;
      function M(t3, e3) {
        if (t3.length > e3)
          t3 = t3.substring(0, e3) + b;
        return t3;
      }
      var T = function() {
        function t3(e3, r3) {
          this.hexDigits = "0123456789ABCDEF";
          if (e3 instanceof t3) {
            this.enc = e3.enc;
            this.pos = e3.pos;
          } else {
            this.enc = e3;
            this.pos = r3;
          }
        }
        t3.prototype.get = function(t4) {
          if (void 0 === t4)
            t4 = this.pos++;
          if (t4 >= this.enc.length)
            throw new Error("Requesting byte offset " + t4 + " on a stream of length " + this.enc.length);
          return "string" === typeof this.enc ? this.enc.charCodeAt(t4) : this.enc[t4];
        };
        t3.prototype.hexByte = function(t4) {
          return this.hexDigits.charAt(t4 >> 4 & 15) + this.hexDigits.charAt(15 & t4);
        };
        t3.prototype.hexDump = function(t4, e3, r3) {
          var i3 = "";
          for (var n2 = t4; n2 < e3; ++n2) {
            i3 += this.hexByte(this.get(n2));
            if (true !== r3)
              switch (15 & n2) {
                case 7:
                  i3 += "  ";
                  break;
                case 15:
                  i3 += "\n";
                  break;
                default:
                  i3 += " ";
              }
          }
          return i3;
        };
        t3.prototype.isASCII = function(t4, e3) {
          for (var r3 = t4; r3 < e3; ++r3) {
            var i3 = this.get(r3);
            if (i3 < 32 || i3 > 176)
              return false;
          }
          return true;
        };
        t3.prototype.parseStringISO = function(t4, e3) {
          var r3 = "";
          for (var i3 = t4; i3 < e3; ++i3)
            r3 += String.fromCharCode(this.get(i3));
          return r3;
        };
        t3.prototype.parseStringUTF = function(t4, e3) {
          var r3 = "";
          for (var i3 = t4; i3 < e3; ) {
            var n2 = this.get(i3++);
            if (n2 < 128)
              r3 += String.fromCharCode(n2);
            else if (n2 > 191 && n2 < 224)
              r3 += String.fromCharCode((31 & n2) << 6 | 63 & this.get(i3++));
            else
              r3 += String.fromCharCode((15 & n2) << 12 | (63 & this.get(i3++)) << 6 | 63 & this.get(i3++));
          }
          return r3;
        };
        t3.prototype.parseStringBMP = function(t4, e3) {
          var r3 = "";
          var i3;
          var n2;
          for (var s2 = t4; s2 < e3; ) {
            i3 = this.get(s2++);
            n2 = this.get(s2++);
            r3 += String.fromCharCode(i3 << 8 | n2);
          }
          return r3;
        };
        t3.prototype.parseTime = function(t4, e3, r3) {
          var i3 = this.parseStringISO(t4, e3);
          var n2 = (r3 ? E2 : D).exec(i3);
          if (!n2)
            return "Unrecognized time: " + i3;
          if (r3) {
            n2[1] = +n2[1];
            n2[1] += +n2[1] < 70 ? 2e3 : 1900;
          }
          i3 = n2[1] + "-" + n2[2] + "-" + n2[3] + " " + n2[4];
          if (n2[5]) {
            i3 += ":" + n2[5];
            if (n2[6]) {
              i3 += ":" + n2[6];
              if (n2[7])
                i3 += "." + n2[7];
            }
          }
          if (n2[8]) {
            i3 += " UTC";
            if ("Z" != n2[8]) {
              i3 += n2[8];
              if (n2[9])
                i3 += ":" + n2[9];
            }
          }
          return i3;
        };
        t3.prototype.parseInteger = function(t4, e3) {
          var r3 = this.get(t4);
          var i3 = r3 > 127;
          var n2 = i3 ? 255 : 0;
          var s2;
          var a2 = "";
          while (r3 == n2 && ++t4 < e3)
            r3 = this.get(t4);
          s2 = e3 - t4;
          if (0 === s2)
            return i3 ? -1 : 0;
          if (s2 > 4) {
            a2 = r3;
            s2 <<= 3;
            while (0 == (128 & (+a2 ^ n2))) {
              a2 = +a2 << 1;
              --s2;
            }
            a2 = "(" + s2 + " bit)\n";
          }
          if (i3)
            r3 -= 256;
          var o22 = new _(r3);
          for (var u2 = t4 + 1; u2 < e3; ++u2)
            o22.mulAdd(256, this.get(u2));
          return a2 + o22.toString();
        };
        t3.prototype.parseBitString = function(t4, e3, r3) {
          var i3 = this.get(t4);
          var n2 = (e3 - t4 - 1 << 3) - i3;
          var s2 = "(" + n2 + " bit)\n";
          var a2 = "";
          for (var o22 = t4 + 1; o22 < e3; ++o22) {
            var u2 = this.get(o22);
            var c2 = o22 == e3 - 1 ? i3 : 0;
            for (var l2 = 7; l2 >= c2; --l2)
              a2 += u2 >> l2 & 1 ? "1" : "0";
            if (a2.length > r3)
              return s2 + M(a2, r3);
          }
          return s2 + a2;
        };
        t3.prototype.parseOctetString = function(t4, e3, r3) {
          if (this.isASCII(t4, e3))
            return M(this.parseStringISO(t4, e3), r3);
          var i3 = e3 - t4;
          var n2 = "(" + i3 + " byte)\n";
          r3 /= 2;
          if (i3 > r3)
            e3 = t4 + r3;
          for (var s2 = t4; s2 < e3; ++s2)
            n2 += this.hexByte(this.get(s2));
          if (i3 > r3)
            n2 += b;
          return n2;
        };
        t3.prototype.parseOID = function(t4, e3, r3) {
          var i3 = "";
          var n2 = new _();
          var s2 = 0;
          for (var a2 = t4; a2 < e3; ++a2) {
            var o22 = this.get(a2);
            n2.mulAdd(128, 127 & o22);
            s2 += 7;
            if (!(128 & o22)) {
              if ("" === i3) {
                n2 = n2.simplify();
                if (n2 instanceof _) {
                  n2.sub(80);
                  i3 = "2." + n2.toString();
                } else {
                  var u2 = n2 < 80 ? n2 < 40 ? 0 : 1 : 2;
                  i3 = u2 + "." + (n2 - 40 * u2);
                }
              } else
                i3 += "." + n2.toString();
              if (i3.length > r3)
                return M(i3, r3);
              n2 = new _();
              s2 = 0;
            }
          }
          if (s2 > 0)
            i3 += ".incomplete";
          return i3;
        };
        return t3;
      }();
      var I = function() {
        function t3(t4, e3, r3, i3, n2) {
          if (!(i3 instanceof A))
            throw new Error("Invalid tag value.");
          this.stream = t4;
          this.header = e3;
          this.length = r3;
          this.tag = i3;
          this.sub = n2;
        }
        t3.prototype.typeName = function() {
          switch (this.tag.tagClass) {
            case 0:
              switch (this.tag.tagNumber) {
                case 0:
                  return "EOC";
                case 1:
                  return "BOOLEAN";
                case 2:
                  return "INTEGER";
                case 3:
                  return "BIT_STRING";
                case 4:
                  return "OCTET_STRING";
                case 5:
                  return "NULL";
                case 6:
                  return "OBJECT_IDENTIFIER";
                case 7:
                  return "ObjectDescriptor";
                case 8:
                  return "EXTERNAL";
                case 9:
                  return "REAL";
                case 10:
                  return "ENUMERATED";
                case 11:
                  return "EMBEDDED_PDV";
                case 12:
                  return "UTF8String";
                case 16:
                  return "SEQUENCE";
                case 17:
                  return "SET";
                case 18:
                  return "NumericString";
                case 19:
                  return "PrintableString";
                case 20:
                  return "TeletexString";
                case 21:
                  return "VideotexString";
                case 22:
                  return "IA5String";
                case 23:
                  return "UTCTime";
                case 24:
                  return "GeneralizedTime";
                case 25:
                  return "GraphicString";
                case 26:
                  return "VisibleString";
                case 27:
                  return "GeneralString";
                case 28:
                  return "UniversalString";
                case 30:
                  return "BMPString";
              }
              return "Universal_" + this.tag.tagNumber.toString();
            case 1:
              return "Application_" + this.tag.tagNumber.toString();
            case 2:
              return "[" + this.tag.tagNumber.toString() + "]";
            case 3:
              return "Private_" + this.tag.tagNumber.toString();
          }
        };
        t3.prototype.content = function(t4) {
          if (void 0 === this.tag)
            return null;
          if (void 0 === t4)
            t4 = 1 / 0;
          var e3 = this.posContent();
          var r3 = Math.abs(this.length);
          if (!this.tag.isUniversal()) {
            if (null !== this.sub)
              return "(" + this.sub.length + " elem)";
            return this.stream.parseOctetString(e3, e3 + r3, t4);
          }
          switch (this.tag.tagNumber) {
            case 1:
              return 0 === this.stream.get(e3) ? "false" : "true";
            case 2:
              return this.stream.parseInteger(e3, e3 + r3);
            case 3:
              return this.sub ? "(" + this.sub.length + " elem)" : this.stream.parseBitString(e3, e3 + r3, t4);
            case 4:
              return this.sub ? "(" + this.sub.length + " elem)" : this.stream.parseOctetString(e3, e3 + r3, t4);
            case 6:
              return this.stream.parseOID(e3, e3 + r3, t4);
            case 16:
            case 17:
              if (null !== this.sub)
                return "(" + this.sub.length + " elem)";
              else
                return "(no elem)";
            case 12:
              return M(this.stream.parseStringUTF(e3, e3 + r3), t4);
            case 18:
            case 19:
            case 20:
            case 21:
            case 22:
            case 26:
              return M(this.stream.parseStringISO(e3, e3 + r3), t4);
            case 30:
              return M(this.stream.parseStringBMP(e3, e3 + r3), t4);
            case 23:
            case 24:
              return this.stream.parseTime(e3, e3 + r3, 23 == this.tag.tagNumber);
          }
          return null;
        };
        t3.prototype.toString = function() {
          return this.typeName() + "@" + this.stream.pos + "[header:" + this.header + ",length:" + this.length + ",sub:" + (null === this.sub ? "null" : this.sub.length) + "]";
        };
        t3.prototype.toPrettyString = function(t4) {
          if (void 0 === t4)
            t4 = "";
          var e3 = t4 + this.typeName() + " @" + this.stream.pos;
          if (this.length >= 0)
            e3 += "+";
          e3 += this.length;
          if (this.tag.tagConstructed)
            e3 += " (constructed)";
          else if (this.tag.isUniversal() && (3 == this.tag.tagNumber || 4 == this.tag.tagNumber) && null !== this.sub)
            e3 += " (encapsulates)";
          e3 += "\n";
          if (null !== this.sub) {
            t4 += "  ";
            for (var r3 = 0, i3 = this.sub.length; r3 < i3; ++r3)
              e3 += this.sub[r3].toPrettyString(t4);
          }
          return e3;
        };
        t3.prototype.posStart = function() {
          return this.stream.pos;
        };
        t3.prototype.posContent = function() {
          return this.stream.pos + this.header;
        };
        t3.prototype.posEnd = function() {
          return this.stream.pos + this.header + Math.abs(this.length);
        };
        t3.prototype.toHexString = function() {
          return this.stream.hexDump(this.posStart(), this.posEnd(), true);
        };
        t3.decodeLength = function(t4) {
          var e3 = t4.get();
          var r3 = 127 & e3;
          if (r3 == e3)
            return r3;
          if (r3 > 6)
            throw new Error("Length over 48 bits not supported at position " + (t4.pos - 1));
          if (0 === r3)
            return null;
          e3 = 0;
          for (var i3 = 0; i3 < r3; ++i3)
            e3 = 256 * e3 + t4.get();
          return e3;
        };
        t3.prototype.getHexStringValue = function() {
          var t4 = this.toHexString();
          var e3 = 2 * this.header;
          var r3 = 2 * this.length;
          return t4.substr(e3, r3);
        };
        t3.decode = function(e3) {
          var r3;
          if (!(e3 instanceof T))
            r3 = new T(e3, 0);
          else
            r3 = e3;
          var i3 = new T(r3);
          var n2 = new A(r3);
          var s2 = t3.decodeLength(r3);
          var a2 = r3.pos;
          var o22 = a2 - i3.pos;
          var u2 = null;
          var c2 = function() {
            var e4 = [];
            if (null !== s2) {
              var i4 = a2 + s2;
              while (r3.pos < i4)
                e4[e4.length] = t3.decode(r3);
              if (r3.pos != i4)
                throw new Error("Content size is not correct for container starting at offset " + a2);
            } else
              try {
                for (; ; ) {
                  var n3 = t3.decode(r3);
                  if (n3.tag.isEOC())
                    break;
                  e4[e4.length] = n3;
                }
                s2 = a2 - r3.pos;
              } catch (t4) {
                throw new Error("Exception while decoding undefined length content: " + t4);
              }
            return e4;
          };
          if (n2.tagConstructed)
            u2 = c2();
          else if (n2.isUniversal() && (3 == n2.tagNumber || 4 == n2.tagNumber))
            try {
              if (3 == n2.tagNumber) {
                if (0 != r3.get())
                  throw new Error("BIT STRINGs with unused bits cannot encapsulate.");
              }
              u2 = c2();
              for (var l2 = 0; l2 < u2.length; ++l2)
                if (u2[l2].tag.isEOC())
                  throw new Error("EOC is not supposed to be actual content.");
            } catch (t4) {
              u2 = null;
            }
          if (null === u2) {
            if (null === s2)
              throw new Error("We can't skip over an invalid tag with undefined length at offset " + a2);
            r3.pos = a2 + Math.abs(s2);
          }
          return new t3(i3, o22, s2, n2, u2);
        };
        return t3;
      }();
      var A = function() {
        function t3(t4) {
          var e3 = t4.get();
          this.tagClass = e3 >> 6;
          this.tagConstructed = 0 !== (32 & e3);
          this.tagNumber = 31 & e3;
          if (31 == this.tagNumber) {
            var r3 = new _();
            do {
              e3 = t4.get();
              r3.mulAdd(128, 127 & e3);
            } while (128 & e3);
            this.tagNumber = r3.simplify();
          }
        }
        t3.prototype.isUniversal = function() {
          return 0 === this.tagClass;
        };
        t3.prototype.isEOC = function() {
          return 0 === this.tagClass && 0 === this.tagNumber;
        };
        return t3;
      }();
      var x;
      var R = 244837814094590;
      var B = 15715070 == (16777215 & R);
      var O = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997];
      var k = (1 << 26) / O[O.length - 1];
      var C = function() {
        function t3(t4, e3, r3) {
          if (null != t4)
            if ("number" == typeof t4)
              this.fromNumber(t4, e3, r3);
            else if (null == e3 && "string" != typeof t4)
              this.fromString(t4, 256);
            else
              this.fromString(t4, e3);
        }
        t3.prototype.toString = function(t4) {
          if (this.s < 0)
            return "-" + this.negate().toString(t4);
          var e3;
          if (16 == t4)
            e3 = 4;
          else if (8 == t4)
            e3 = 3;
          else if (2 == t4)
            e3 = 1;
          else if (32 == t4)
            e3 = 5;
          else if (4 == t4)
            e3 = 2;
          else
            return this.toRadix(t4);
          var r3 = (1 << e3) - 1;
          var i3;
          var s2 = false;
          var a2 = "";
          var o22 = this.t;
          var u2 = this.DB - o22 * this.DB % e3;
          if (o22-- > 0) {
            if (u2 < this.DB && (i3 = this[o22] >> u2) > 0) {
              s2 = true;
              a2 = n(i3);
            }
            while (o22 >= 0) {
              if (u2 < e3) {
                i3 = (this[o22] & (1 << u2) - 1) << e3 - u2;
                i3 |= this[--o22] >> (u2 += this.DB - e3);
              } else {
                i3 = this[o22] >> (u2 -= e3) & r3;
                if (u2 <= 0) {
                  u2 += this.DB;
                  --o22;
                }
              }
              if (i3 > 0)
                s2 = true;
              if (s2)
                a2 += n(i3);
            }
          }
          return s2 ? a2 : "0";
        };
        t3.prototype.negate = function() {
          var e3 = H();
          t3.ZERO.subTo(this, e3);
          return e3;
        };
        t3.prototype.abs = function() {
          return this.s < 0 ? this.negate() : this;
        };
        t3.prototype.compareTo = function(t4) {
          var e3 = this.s - t4.s;
          if (0 != e3)
            return e3;
          var r3 = this.t;
          e3 = r3 - t4.t;
          if (0 != e3)
            return this.s < 0 ? -e3 : e3;
          while (--r3 >= 0)
            if (0 != (e3 = this[r3] - t4[r3]))
              return e3;
          return 0;
        };
        t3.prototype.bitLength = function() {
          if (this.t <= 0)
            return 0;
          return this.DB * (this.t - 1) + W(this[this.t - 1] ^ this.s & this.DM);
        };
        t3.prototype.mod = function(e3) {
          var r3 = H();
          this.abs().divRemTo(e3, null, r3);
          if (this.s < 0 && r3.compareTo(t3.ZERO) > 0)
            e3.subTo(r3, r3);
          return r3;
        };
        t3.prototype.modPowInt = function(t4, e3) {
          var r3;
          if (t4 < 256 || e3.isEven())
            r3 = new P(e3);
          else
            r3 = new V(e3);
          return this.exp(t4, r3);
        };
        t3.prototype.clone = function() {
          var t4 = H();
          this.copyTo(t4);
          return t4;
        };
        t3.prototype.intValue = function() {
          if (this.s < 0) {
            if (1 == this.t)
              return this[0] - this.DV;
            else if (0 == this.t)
              return -1;
          } else if (1 == this.t)
            return this[0];
          else if (0 == this.t)
            return 0;
          return (this[1] & (1 << 32 - this.DB) - 1) << this.DB | this[0];
        };
        t3.prototype.byteValue = function() {
          return 0 == this.t ? this.s : this[0] << 24 >> 24;
        };
        t3.prototype.shortValue = function() {
          return 0 == this.t ? this.s : this[0] << 16 >> 16;
        };
        t3.prototype.signum = function() {
          if (this.s < 0)
            return -1;
          else if (this.t <= 0 || 1 == this.t && this[0] <= 0)
            return 0;
          else
            return 1;
        };
        t3.prototype.toByteArray = function() {
          var t4 = this.t;
          var e3 = [];
          e3[0] = this.s;
          var r3 = this.DB - t4 * this.DB % 8;
          var i3;
          var n2 = 0;
          if (t4-- > 0) {
            if (r3 < this.DB && (i3 = this[t4] >> r3) != (this.s & this.DM) >> r3)
              e3[n2++] = i3 | this.s << this.DB - r3;
            while (t4 >= 0) {
              if (r3 < 8) {
                i3 = (this[t4] & (1 << r3) - 1) << 8 - r3;
                i3 |= this[--t4] >> (r3 += this.DB - 8);
              } else {
                i3 = this[t4] >> (r3 -= 8) & 255;
                if (r3 <= 0) {
                  r3 += this.DB;
                  --t4;
                }
              }
              if (0 != (128 & i3))
                i3 |= -256;
              if (0 == n2 && (128 & this.s) != (128 & i3))
                ++n2;
              if (n2 > 0 || i3 != this.s)
                e3[n2++] = i3;
            }
          }
          return e3;
        };
        t3.prototype.equals = function(t4) {
          return 0 == this.compareTo(t4);
        };
        t3.prototype.min = function(t4) {
          return this.compareTo(t4) < 0 ? this : t4;
        };
        t3.prototype.max = function(t4) {
          return this.compareTo(t4) > 0 ? this : t4;
        };
        t3.prototype.and = function(t4) {
          var e3 = H();
          this.bitwiseTo(t4, s, e3);
          return e3;
        };
        t3.prototype.or = function(t4) {
          var e3 = H();
          this.bitwiseTo(t4, a, e3);
          return e3;
        };
        t3.prototype.xor = function(t4) {
          var e3 = H();
          this.bitwiseTo(t4, o2, e3);
          return e3;
        };
        t3.prototype.andNot = function(t4) {
          var e3 = H();
          this.bitwiseTo(t4, u, e3);
          return e3;
        };
        t3.prototype.not = function() {
          var t4 = H();
          for (var e3 = 0; e3 < this.t; ++e3)
            t4[e3] = this.DM & ~this[e3];
          t4.t = this.t;
          t4.s = ~this.s;
          return t4;
        };
        t3.prototype.shiftLeft = function(t4) {
          var e3 = H();
          if (t4 < 0)
            this.rShiftTo(-t4, e3);
          else
            this.lShiftTo(t4, e3);
          return e3;
        };
        t3.prototype.shiftRight = function(t4) {
          var e3 = H();
          if (t4 < 0)
            this.lShiftTo(-t4, e3);
          else
            this.rShiftTo(t4, e3);
          return e3;
        };
        t3.prototype.getLowestSetBit = function() {
          for (var t4 = 0; t4 < this.t; ++t4)
            if (0 != this[t4])
              return t4 * this.DB + c(this[t4]);
          if (this.s < 0)
            return this.t * this.DB;
          return -1;
        };
        t3.prototype.bitCount = function() {
          var t4 = 0;
          var e3 = this.s & this.DM;
          for (var r3 = 0; r3 < this.t; ++r3)
            t4 += l(this[r3] ^ e3);
          return t4;
        };
        t3.prototype.testBit = function(t4) {
          var e3 = Math.floor(t4 / this.DB);
          if (e3 >= this.t)
            return 0 != this.s;
          return 0 != (this[e3] & 1 << t4 % this.DB);
        };
        t3.prototype.setBit = function(t4) {
          return this.changeBit(t4, a);
        };
        t3.prototype.clearBit = function(t4) {
          return this.changeBit(t4, u);
        };
        t3.prototype.flipBit = function(t4) {
          return this.changeBit(t4, o2);
        };
        t3.prototype.add = function(t4) {
          var e3 = H();
          this.addTo(t4, e3);
          return e3;
        };
        t3.prototype.subtract = function(t4) {
          var e3 = H();
          this.subTo(t4, e3);
          return e3;
        };
        t3.prototype.multiply = function(t4) {
          var e3 = H();
          this.multiplyTo(t4, e3);
          return e3;
        };
        t3.prototype.divide = function(t4) {
          var e3 = H();
          this.divRemTo(t4, e3, null);
          return e3;
        };
        t3.prototype.remainder = function(t4) {
          var e3 = H();
          this.divRemTo(t4, null, e3);
          return e3;
        };
        t3.prototype.divideAndRemainder = function(t4) {
          var e3 = H();
          var r3 = H();
          this.divRemTo(t4, e3, r3);
          return [e3, r3];
        };
        t3.prototype.modPow = function(t4, e3) {
          var r3 = t4.bitLength();
          var i3;
          var n2 = Y(1);
          var s2;
          if (r3 <= 0)
            return n2;
          else if (r3 < 18)
            i3 = 1;
          else if (r3 < 48)
            i3 = 3;
          else if (r3 < 144)
            i3 = 4;
          else if (r3 < 768)
            i3 = 5;
          else
            i3 = 6;
          if (r3 < 8)
            s2 = new P(e3);
          else if (e3.isEven())
            s2 = new L(e3);
          else
            s2 = new V(e3);
          var a2 = [];
          var o22 = 3;
          var u2 = i3 - 1;
          var c2 = (1 << i3) - 1;
          a2[1] = s2.convert(this);
          if (i3 > 1) {
            var l2 = H();
            s2.sqrTo(a2[1], l2);
            while (o22 <= c2) {
              a2[o22] = H();
              s2.mulTo(l2, a2[o22 - 2], a2[o22]);
              o22 += 2;
            }
          }
          var f22 = t4.t - 1;
          var h2;
          var d2 = true;
          var v2 = H();
          var p;
          r3 = W(t4[f22]) - 1;
          while (f22 >= 0) {
            if (r3 >= u2)
              h2 = t4[f22] >> r3 - u2 & c2;
            else {
              h2 = (t4[f22] & (1 << r3 + 1) - 1) << u2 - r3;
              if (f22 > 0)
                h2 |= t4[f22 - 1] >> this.DB + r3 - u2;
            }
            o22 = i3;
            while (0 == (1 & h2)) {
              h2 >>= 1;
              --o22;
            }
            if ((r3 -= o22) < 0) {
              r3 += this.DB;
              --f22;
            }
            if (d2) {
              a2[h2].copyTo(n2);
              d2 = false;
            } else {
              while (o22 > 1) {
                s2.sqrTo(n2, v2);
                s2.sqrTo(v2, n2);
                o22 -= 2;
              }
              if (o22 > 0)
                s2.sqrTo(n2, v2);
              else {
                p = n2;
                n2 = v2;
                v2 = p;
              }
              s2.mulTo(v2, a2[h2], n2);
            }
            while (f22 >= 0 && 0 == (t4[f22] & 1 << r3)) {
              s2.sqrTo(n2, v2);
              p = n2;
              n2 = v2;
              v2 = p;
              if (--r3 < 0) {
                r3 = this.DB - 1;
                --f22;
              }
            }
          }
          return s2.revert(n2);
        };
        t3.prototype.modInverse = function(e3) {
          var r3 = e3.isEven();
          if (this.isEven() && r3 || 0 == e3.signum())
            return t3.ZERO;
          var i3 = e3.clone();
          var n2 = this.clone();
          var s2 = Y(1);
          var a2 = Y(0);
          var o22 = Y(0);
          var u2 = Y(1);
          while (0 != i3.signum()) {
            while (i3.isEven()) {
              i3.rShiftTo(1, i3);
              if (r3) {
                if (!s2.isEven() || !a2.isEven()) {
                  s2.addTo(this, s2);
                  a2.subTo(e3, a2);
                }
                s2.rShiftTo(1, s2);
              } else if (!a2.isEven())
                a2.subTo(e3, a2);
              a2.rShiftTo(1, a2);
            }
            while (n2.isEven()) {
              n2.rShiftTo(1, n2);
              if (r3) {
                if (!o22.isEven() || !u2.isEven()) {
                  o22.addTo(this, o22);
                  u2.subTo(e3, u2);
                }
                o22.rShiftTo(1, o22);
              } else if (!u2.isEven())
                u2.subTo(e3, u2);
              u2.rShiftTo(1, u2);
            }
            if (i3.compareTo(n2) >= 0) {
              i3.subTo(n2, i3);
              if (r3)
                s2.subTo(o22, s2);
              a2.subTo(u2, a2);
            } else {
              n2.subTo(i3, n2);
              if (r3)
                o22.subTo(s2, o22);
              u2.subTo(a2, u2);
            }
          }
          if (0 != n2.compareTo(t3.ONE))
            return t3.ZERO;
          if (u2.compareTo(e3) >= 0)
            return u2.subtract(e3);
          if (u2.signum() < 0)
            u2.addTo(e3, u2);
          else
            return u2;
          if (u2.signum() < 0)
            return u2.add(e3);
          else
            return u2;
        };
        t3.prototype.pow = function(t4) {
          return this.exp(t4, new N());
        };
        t3.prototype.gcd = function(t4) {
          var e3 = this.s < 0 ? this.negate() : this.clone();
          var r3 = t4.s < 0 ? t4.negate() : t4.clone();
          if (e3.compareTo(r3) < 0) {
            var i3 = e3;
            e3 = r3;
            r3 = i3;
          }
          var n2 = e3.getLowestSetBit();
          var s2 = r3.getLowestSetBit();
          if (s2 < 0)
            return e3;
          if (n2 < s2)
            s2 = n2;
          if (s2 > 0) {
            e3.rShiftTo(s2, e3);
            r3.rShiftTo(s2, r3);
          }
          while (e3.signum() > 0) {
            if ((n2 = e3.getLowestSetBit()) > 0)
              e3.rShiftTo(n2, e3);
            if ((n2 = r3.getLowestSetBit()) > 0)
              r3.rShiftTo(n2, r3);
            if (e3.compareTo(r3) >= 0) {
              e3.subTo(r3, e3);
              e3.rShiftTo(1, e3);
            } else {
              r3.subTo(e3, r3);
              r3.rShiftTo(1, r3);
            }
          }
          if (s2 > 0)
            r3.lShiftTo(s2, r3);
          return r3;
        };
        t3.prototype.isProbablePrime = function(t4) {
          var e3;
          var r3 = this.abs();
          if (1 == r3.t && r3[0] <= O[O.length - 1]) {
            for (e3 = 0; e3 < O.length; ++e3)
              if (r3[0] == O[e3])
                return true;
            return false;
          }
          if (r3.isEven())
            return false;
          e3 = 1;
          while (e3 < O.length) {
            var i3 = O[e3];
            var n2 = e3 + 1;
            while (n2 < O.length && i3 < k)
              i3 *= O[n2++];
            i3 = r3.modInt(i3);
            while (e3 < n2)
              if (i3 % O[e3++] == 0)
                return false;
          }
          return r3.millerRabin(t4);
        };
        t3.prototype.copyTo = function(t4) {
          for (var e3 = this.t - 1; e3 >= 0; --e3)
            t4[e3] = this[e3];
          t4.t = this.t;
          t4.s = this.s;
        };
        t3.prototype.fromInt = function(t4) {
          this.t = 1;
          this.s = t4 < 0 ? -1 : 0;
          if (t4 > 0)
            this[0] = t4;
          else if (t4 < -1)
            this[0] = t4 + this.DV;
          else
            this.t = 0;
        };
        t3.prototype.fromString = function(e3, r3) {
          var i3;
          if (16 == r3)
            i3 = 4;
          else if (8 == r3)
            i3 = 3;
          else if (256 == r3)
            i3 = 8;
          else if (2 == r3)
            i3 = 1;
          else if (32 == r3)
            i3 = 5;
          else if (4 == r3)
            i3 = 2;
          else {
            this.fromRadix(e3, r3);
            return;
          }
          this.t = 0;
          this.s = 0;
          var n2 = e3.length;
          var s2 = false;
          var a2 = 0;
          while (--n2 >= 0) {
            var o22 = 8 == i3 ? 255 & +e3[n2] : G(e3, n2);
            if (o22 < 0) {
              if ("-" == e3.charAt(n2))
                s2 = true;
              continue;
            }
            s2 = false;
            if (0 == a2)
              this[this.t++] = o22;
            else if (a2 + i3 > this.DB) {
              this[this.t - 1] |= (o22 & (1 << this.DB - a2) - 1) << a2;
              this[this.t++] = o22 >> this.DB - a2;
            } else
              this[this.t - 1] |= o22 << a2;
            a2 += i3;
            if (a2 >= this.DB)
              a2 -= this.DB;
          }
          if (8 == i3 && 0 != (128 & +e3[0])) {
            this.s = -1;
            if (a2 > 0)
              this[this.t - 1] |= (1 << this.DB - a2) - 1 << a2;
          }
          this.clamp();
          if (s2)
            t3.ZERO.subTo(this, this);
        };
        t3.prototype.clamp = function() {
          var t4 = this.s & this.DM;
          while (this.t > 0 && this[this.t - 1] == t4)
            --this.t;
        };
        t3.prototype.dlShiftTo = function(t4, e3) {
          var r3;
          for (r3 = this.t - 1; r3 >= 0; --r3)
            e3[r3 + t4] = this[r3];
          for (r3 = t4 - 1; r3 >= 0; --r3)
            e3[r3] = 0;
          e3.t = this.t + t4;
          e3.s = this.s;
        };
        t3.prototype.drShiftTo = function(t4, e3) {
          for (var r3 = t4; r3 < this.t; ++r3)
            e3[r3 - t4] = this[r3];
          e3.t = Math.max(this.t - t4, 0);
          e3.s = this.s;
        };
        t3.prototype.lShiftTo = function(t4, e3) {
          var r3 = t4 % this.DB;
          var i3 = this.DB - r3;
          var n2 = (1 << i3) - 1;
          var s2 = Math.floor(t4 / this.DB);
          var a2 = this.s << r3 & this.DM;
          for (var o22 = this.t - 1; o22 >= 0; --o22) {
            e3[o22 + s2 + 1] = this[o22] >> i3 | a2;
            a2 = (this[o22] & n2) << r3;
          }
          for (var o22 = s2 - 1; o22 >= 0; --o22)
            e3[o22] = 0;
          e3[s2] = a2;
          e3.t = this.t + s2 + 1;
          e3.s = this.s;
          e3.clamp();
        };
        t3.prototype.rShiftTo = function(t4, e3) {
          e3.s = this.s;
          var r3 = Math.floor(t4 / this.DB);
          if (r3 >= this.t) {
            e3.t = 0;
            return;
          }
          var i3 = t4 % this.DB;
          var n2 = this.DB - i3;
          var s2 = (1 << i3) - 1;
          e3[0] = this[r3] >> i3;
          for (var a2 = r3 + 1; a2 < this.t; ++a2) {
            e3[a2 - r3 - 1] |= (this[a2] & s2) << n2;
            e3[a2 - r3] = this[a2] >> i3;
          }
          if (i3 > 0)
            e3[this.t - r3 - 1] |= (this.s & s2) << n2;
          e3.t = this.t - r3;
          e3.clamp();
        };
        t3.prototype.subTo = function(t4, e3) {
          var r3 = 0;
          var i3 = 0;
          var n2 = Math.min(t4.t, this.t);
          while (r3 < n2) {
            i3 += this[r3] - t4[r3];
            e3[r3++] = i3 & this.DM;
            i3 >>= this.DB;
          }
          if (t4.t < this.t) {
            i3 -= t4.s;
            while (r3 < this.t) {
              i3 += this[r3];
              e3[r3++] = i3 & this.DM;
              i3 >>= this.DB;
            }
            i3 += this.s;
          } else {
            i3 += this.s;
            while (r3 < t4.t) {
              i3 -= t4[r3];
              e3[r3++] = i3 & this.DM;
              i3 >>= this.DB;
            }
            i3 -= t4.s;
          }
          e3.s = i3 < 0 ? -1 : 0;
          if (i3 < -1)
            e3[r3++] = this.DV + i3;
          else if (i3 > 0)
            e3[r3++] = i3;
          e3.t = r3;
          e3.clamp();
        };
        t3.prototype.multiplyTo = function(e3, r3) {
          var i3 = this.abs();
          var n2 = e3.abs();
          var s2 = i3.t;
          r3.t = s2 + n2.t;
          while (--s2 >= 0)
            r3[s2] = 0;
          for (s2 = 0; s2 < n2.t; ++s2)
            r3[s2 + i3.t] = i3.am(0, n2[s2], r3, s2, 0, i3.t);
          r3.s = 0;
          r3.clamp();
          if (this.s != e3.s)
            t3.ZERO.subTo(r3, r3);
        };
        t3.prototype.squareTo = function(t4) {
          var e3 = this.abs();
          var r3 = t4.t = 2 * e3.t;
          while (--r3 >= 0)
            t4[r3] = 0;
          for (r3 = 0; r3 < e3.t - 1; ++r3) {
            var i3 = e3.am(r3, e3[r3], t4, 2 * r3, 0, 1);
            if ((t4[r3 + e3.t] += e3.am(r3 + 1, 2 * e3[r3], t4, 2 * r3 + 1, i3, e3.t - r3 - 1)) >= e3.DV) {
              t4[r3 + e3.t] -= e3.DV;
              t4[r3 + e3.t + 1] = 1;
            }
          }
          if (t4.t > 0)
            t4[t4.t - 1] += e3.am(r3, e3[r3], t4, 2 * r3, 0, 1);
          t4.s = 0;
          t4.clamp();
        };
        t3.prototype.divRemTo = function(e3, r3, i3) {
          var n2 = e3.abs();
          if (n2.t <= 0)
            return;
          var s2 = this.abs();
          if (s2.t < n2.t) {
            if (null != r3)
              r3.fromInt(0);
            if (null != i3)
              this.copyTo(i3);
            return;
          }
          if (null == i3)
            i3 = H();
          var a2 = H();
          var o22 = this.s;
          var u2 = e3.s;
          var c2 = this.DB - W(n2[n2.t - 1]);
          if (c2 > 0) {
            n2.lShiftTo(c2, a2);
            s2.lShiftTo(c2, i3);
          } else {
            n2.copyTo(a2);
            s2.copyTo(i3);
          }
          var l2 = a2.t;
          var f22 = a2[l2 - 1];
          if (0 == f22)
            return;
          var h2 = f22 * (1 << this.F1) + (l2 > 1 ? a2[l2 - 2] >> this.F2 : 0);
          var d2 = this.FV / h2;
          var v2 = (1 << this.F1) / h2;
          var p = 1 << this.F2;
          var g2 = i3.t;
          var y2 = g2 - l2;
          var m2 = null == r3 ? H() : r3;
          a2.dlShiftTo(y2, m2);
          if (i3.compareTo(m2) >= 0) {
            i3[i3.t++] = 1;
            i3.subTo(m2, i3);
          }
          t3.ONE.dlShiftTo(l2, m2);
          m2.subTo(a2, a2);
          while (a2.t < l2)
            a2[a2.t++] = 0;
          while (--y2 >= 0) {
            var w2 = i3[--g2] == f22 ? this.DM : Math.floor(i3[g2] * d2 + (i3[g2 - 1] + p) * v2);
            if ((i3[g2] += a2.am(0, w2, i3, y2, 0, l2)) < w2) {
              a2.dlShiftTo(y2, m2);
              i3.subTo(m2, i3);
              while (i3[g2] < --w2)
                i3.subTo(m2, i3);
            }
          }
          if (null != r3) {
            i3.drShiftTo(l2, r3);
            if (o22 != u2)
              t3.ZERO.subTo(r3, r3);
          }
          i3.t = l2;
          i3.clamp();
          if (c2 > 0)
            i3.rShiftTo(c2, i3);
          if (o22 < 0)
            t3.ZERO.subTo(i3, i3);
        };
        t3.prototype.invDigit = function() {
          if (this.t < 1)
            return 0;
          var t4 = this[0];
          if (0 == (1 & t4))
            return 0;
          var e3 = 3 & t4;
          e3 = e3 * (2 - (15 & t4) * e3) & 15;
          e3 = e3 * (2 - (255 & t4) * e3) & 255;
          e3 = e3 * (2 - ((65535 & t4) * e3 & 65535)) & 65535;
          e3 = e3 * (2 - t4 * e3 % this.DV) % this.DV;
          return e3 > 0 ? this.DV - e3 : -e3;
        };
        t3.prototype.isEven = function() {
          return 0 == (this.t > 0 ? 1 & this[0] : this.s);
        };
        t3.prototype.exp = function(e3, r3) {
          if (e3 > 4294967295 || e3 < 1)
            return t3.ONE;
          var i3 = H();
          var n2 = H();
          var s2 = r3.convert(this);
          var a2 = W(e3) - 1;
          s2.copyTo(i3);
          while (--a2 >= 0) {
            r3.sqrTo(i3, n2);
            if ((e3 & 1 << a2) > 0)
              r3.mulTo(n2, s2, i3);
            else {
              var o22 = i3;
              i3 = n2;
              n2 = o22;
            }
          }
          return r3.revert(i3);
        };
        t3.prototype.chunkSize = function(t4) {
          return Math.floor(Math.LN2 * this.DB / Math.log(t4));
        };
        t3.prototype.toRadix = function(t4) {
          if (null == t4)
            t4 = 10;
          if (0 == this.signum() || t4 < 2 || t4 > 36)
            return "0";
          var e3 = this.chunkSize(t4);
          var r3 = Math.pow(t4, e3);
          var i3 = Y(r3);
          var n2 = H();
          var s2 = H();
          var a2 = "";
          this.divRemTo(i3, n2, s2);
          while (n2.signum() > 0) {
            a2 = (r3 + s2.intValue()).toString(t4).substr(1) + a2;
            n2.divRemTo(i3, n2, s2);
          }
          return s2.intValue().toString(t4) + a2;
        };
        t3.prototype.fromRadix = function(e3, r3) {
          this.fromInt(0);
          if (null == r3)
            r3 = 10;
          var i3 = this.chunkSize(r3);
          var n2 = Math.pow(r3, i3);
          var s2 = false;
          var a2 = 0;
          var o22 = 0;
          for (var u2 = 0; u2 < e3.length; ++u2) {
            var c2 = G(e3, u2);
            if (c2 < 0) {
              if ("-" == e3.charAt(u2) && 0 == this.signum())
                s2 = true;
              continue;
            }
            o22 = r3 * o22 + c2;
            if (++a2 >= i3) {
              this.dMultiply(n2);
              this.dAddOffset(o22, 0);
              a2 = 0;
              o22 = 0;
            }
          }
          if (a2 > 0) {
            this.dMultiply(Math.pow(r3, a2));
            this.dAddOffset(o22, 0);
          }
          if (s2)
            t3.ZERO.subTo(this, this);
        };
        t3.prototype.fromNumber = function(e3, r3, i3) {
          if ("number" == typeof r3)
            if (e3 < 2)
              this.fromInt(1);
            else {
              this.fromNumber(e3, i3);
              if (!this.testBit(e3 - 1))
                this.bitwiseTo(t3.ONE.shiftLeft(e3 - 1), a, this);
              if (this.isEven())
                this.dAddOffset(1, 0);
              while (!this.isProbablePrime(r3)) {
                this.dAddOffset(2, 0);
                if (this.bitLength() > e3)
                  this.subTo(t3.ONE.shiftLeft(e3 - 1), this);
              }
            }
          else {
            var n2 = [];
            var s2 = 7 & e3;
            n2.length = (e3 >> 3) + 1;
            r3.nextBytes(n2);
            if (s2 > 0)
              n2[0] &= (1 << s2) - 1;
            else
              n2[0] = 0;
            this.fromString(n2, 256);
          }
        };
        t3.prototype.bitwiseTo = function(t4, e3, r3) {
          var i3;
          var n2;
          var s2 = Math.min(t4.t, this.t);
          for (i3 = 0; i3 < s2; ++i3)
            r3[i3] = e3(this[i3], t4[i3]);
          if (t4.t < this.t) {
            n2 = t4.s & this.DM;
            for (i3 = s2; i3 < this.t; ++i3)
              r3[i3] = e3(this[i3], n2);
            r3.t = this.t;
          } else {
            n2 = this.s & this.DM;
            for (i3 = s2; i3 < t4.t; ++i3)
              r3[i3] = e3(n2, t4[i3]);
            r3.t = t4.t;
          }
          r3.s = e3(this.s, t4.s);
          r3.clamp();
        };
        t3.prototype.changeBit = function(e3, r3) {
          var i3 = t3.ONE.shiftLeft(e3);
          this.bitwiseTo(i3, r3, i3);
          return i3;
        };
        t3.prototype.addTo = function(t4, e3) {
          var r3 = 0;
          var i3 = 0;
          var n2 = Math.min(t4.t, this.t);
          while (r3 < n2) {
            i3 += this[r3] + t4[r3];
            e3[r3++] = i3 & this.DM;
            i3 >>= this.DB;
          }
          if (t4.t < this.t) {
            i3 += t4.s;
            while (r3 < this.t) {
              i3 += this[r3];
              e3[r3++] = i3 & this.DM;
              i3 >>= this.DB;
            }
            i3 += this.s;
          } else {
            i3 += this.s;
            while (r3 < t4.t) {
              i3 += t4[r3];
              e3[r3++] = i3 & this.DM;
              i3 >>= this.DB;
            }
            i3 += t4.s;
          }
          e3.s = i3 < 0 ? -1 : 0;
          if (i3 > 0)
            e3[r3++] = i3;
          else if (i3 < -1)
            e3[r3++] = this.DV + i3;
          e3.t = r3;
          e3.clamp();
        };
        t3.prototype.dMultiply = function(t4) {
          this[this.t] = this.am(0, t4 - 1, this, 0, 0, this.t);
          ++this.t;
          this.clamp();
        };
        t3.prototype.dAddOffset = function(t4, e3) {
          if (0 == t4)
            return;
          while (this.t <= e3)
            this[this.t++] = 0;
          this[e3] += t4;
          while (this[e3] >= this.DV) {
            this[e3] -= this.DV;
            if (++e3 >= this.t)
              this[this.t++] = 0;
            ++this[e3];
          }
        };
        t3.prototype.multiplyLowerTo = function(t4, e3, r3) {
          var i3 = Math.min(this.t + t4.t, e3);
          r3.s = 0;
          r3.t = i3;
          while (i3 > 0)
            r3[--i3] = 0;
          for (var n2 = r3.t - this.t; i3 < n2; ++i3)
            r3[i3 + this.t] = this.am(0, t4[i3], r3, i3, 0, this.t);
          for (var n2 = Math.min(t4.t, e3); i3 < n2; ++i3)
            this.am(0, t4[i3], r3, i3, 0, e3 - i3);
          r3.clamp();
        };
        t3.prototype.multiplyUpperTo = function(t4, e3, r3) {
          --e3;
          var i3 = r3.t = this.t + t4.t - e3;
          r3.s = 0;
          while (--i3 >= 0)
            r3[i3] = 0;
          for (i3 = Math.max(e3 - this.t, 0); i3 < t4.t; ++i3)
            r3[this.t + i3 - e3] = this.am(e3 - i3, t4[i3], r3, 0, 0, this.t + i3 - e3);
          r3.clamp();
          r3.drShiftTo(1, r3);
        };
        t3.prototype.modInt = function(t4) {
          if (t4 <= 0)
            return 0;
          var e3 = this.DV % t4;
          var r3 = this.s < 0 ? t4 - 1 : 0;
          if (this.t > 0)
            if (0 == e3)
              r3 = this[0] % t4;
            else
              for (var i3 = this.t - 1; i3 >= 0; --i3)
                r3 = (e3 * r3 + this[i3]) % t4;
          return r3;
        };
        t3.prototype.millerRabin = function(e3) {
          var r3 = this.subtract(t3.ONE);
          var i3 = r3.getLowestSetBit();
          if (i3 <= 0)
            return false;
          var n2 = r3.shiftRight(i3);
          e3 = e3 + 1 >> 1;
          if (e3 > O.length)
            e3 = O.length;
          var s2 = H();
          for (var a2 = 0; a2 < e3; ++a2) {
            s2.fromInt(O[Math.floor(Math.random() * O.length)]);
            var o22 = s2.modPow(n2, this);
            if (0 != o22.compareTo(t3.ONE) && 0 != o22.compareTo(r3)) {
              var u2 = 1;
              while (u2++ < i3 && 0 != o22.compareTo(r3)) {
                o22 = o22.modPowInt(2, this);
                if (0 == o22.compareTo(t3.ONE))
                  return false;
              }
              if (0 != o22.compareTo(r3))
                return false;
            }
          }
          return true;
        };
        t3.prototype.square = function() {
          var t4 = H();
          this.squareTo(t4);
          return t4;
        };
        t3.prototype.gcda = function(t4, e3) {
          var r3 = this.s < 0 ? this.negate() : this.clone();
          var i3 = t4.s < 0 ? t4.negate() : t4.clone();
          if (r3.compareTo(i3) < 0) {
            var n2 = r3;
            r3 = i3;
            i3 = n2;
          }
          var s2 = r3.getLowestSetBit();
          var a2 = i3.getLowestSetBit();
          if (a2 < 0) {
            e3(r3);
            return;
          }
          if (s2 < a2)
            a2 = s2;
          if (a2 > 0) {
            r3.rShiftTo(a2, r3);
            i3.rShiftTo(a2, i3);
          }
          var o22 = function() {
            if ((s2 = r3.getLowestSetBit()) > 0)
              r3.rShiftTo(s2, r3);
            if ((s2 = i3.getLowestSetBit()) > 0)
              i3.rShiftTo(s2, i3);
            if (r3.compareTo(i3) >= 0) {
              r3.subTo(i3, r3);
              r3.rShiftTo(1, r3);
            } else {
              i3.subTo(r3, i3);
              i3.rShiftTo(1, i3);
            }
            if (!(r3.signum() > 0)) {
              if (a2 > 0)
                i3.lShiftTo(a2, i3);
              setTimeout(function() {
                e3(i3);
              }, 0);
            } else
              setTimeout(o22, 0);
          };
          setTimeout(o22, 10);
        };
        t3.prototype.fromNumberAsync = function(e3, r3, i3, n2) {
          if ("number" == typeof r3)
            if (e3 < 2)
              this.fromInt(1);
            else {
              this.fromNumber(e3, i3);
              if (!this.testBit(e3 - 1))
                this.bitwiseTo(t3.ONE.shiftLeft(e3 - 1), a, this);
              if (this.isEven())
                this.dAddOffset(1, 0);
              var s2 = this;
              var o22 = function() {
                s2.dAddOffset(2, 0);
                if (s2.bitLength() > e3)
                  s2.subTo(t3.ONE.shiftLeft(e3 - 1), s2);
                if (s2.isProbablePrime(r3))
                  setTimeout(function() {
                    n2();
                  }, 0);
                else
                  setTimeout(o22, 0);
              };
              setTimeout(o22, 0);
            }
          else {
            var u2 = [];
            var c2 = 7 & e3;
            u2.length = (e3 >> 3) + 1;
            r3.nextBytes(u2);
            if (c2 > 0)
              u2[0] &= (1 << c2) - 1;
            else
              u2[0] = 0;
            this.fromString(u2, 256);
          }
        };
        return t3;
      }();
      var N = function() {
        function t3() {
        }
        t3.prototype.convert = function(t4) {
          return t4;
        };
        t3.prototype.revert = function(t4) {
          return t4;
        };
        t3.prototype.mulTo = function(t4, e3, r3) {
          t4.multiplyTo(e3, r3);
        };
        t3.prototype.sqrTo = function(t4, e3) {
          t4.squareTo(e3);
        };
        return t3;
      }();
      var P = function() {
        function t3(t4) {
          this.m = t4;
        }
        t3.prototype.convert = function(t4) {
          if (t4.s < 0 || t4.compareTo(this.m) >= 0)
            return t4.mod(this.m);
          else
            return t4;
        };
        t3.prototype.revert = function(t4) {
          return t4;
        };
        t3.prototype.reduce = function(t4) {
          t4.divRemTo(this.m, null, t4);
        };
        t3.prototype.mulTo = function(t4, e3, r3) {
          t4.multiplyTo(e3, r3);
          this.reduce(r3);
        };
        t3.prototype.sqrTo = function(t4, e3) {
          t4.squareTo(e3);
          this.reduce(e3);
        };
        return t3;
      }();
      var V = function() {
        function t3(t4) {
          this.m = t4;
          this.mp = t4.invDigit();
          this.mpl = 32767 & this.mp;
          this.mph = this.mp >> 15;
          this.um = (1 << t4.DB - 15) - 1;
          this.mt2 = 2 * t4.t;
        }
        t3.prototype.convert = function(t4) {
          var e3 = H();
          t4.abs().dlShiftTo(this.m.t, e3);
          e3.divRemTo(this.m, null, e3);
          if (t4.s < 0 && e3.compareTo(C.ZERO) > 0)
            this.m.subTo(e3, e3);
          return e3;
        };
        t3.prototype.revert = function(t4) {
          var e3 = H();
          t4.copyTo(e3);
          this.reduce(e3);
          return e3;
        };
        t3.prototype.reduce = function(t4) {
          while (t4.t <= this.mt2)
            t4[t4.t++] = 0;
          for (var e3 = 0; e3 < this.m.t; ++e3) {
            var r3 = 32767 & t4[e3];
            var i3 = r3 * this.mpl + ((r3 * this.mph + (t4[e3] >> 15) * this.mpl & this.um) << 15) & t4.DM;
            r3 = e3 + this.m.t;
            t4[r3] += this.m.am(0, i3, t4, e3, 0, this.m.t);
            while (t4[r3] >= t4.DV) {
              t4[r3] -= t4.DV;
              t4[++r3]++;
            }
          }
          t4.clamp();
          t4.drShiftTo(this.m.t, t4);
          if (t4.compareTo(this.m) >= 0)
            t4.subTo(this.m, t4);
        };
        t3.prototype.mulTo = function(t4, e3, r3) {
          t4.multiplyTo(e3, r3);
          this.reduce(r3);
        };
        t3.prototype.sqrTo = function(t4, e3) {
          t4.squareTo(e3);
          this.reduce(e3);
        };
        return t3;
      }();
      var L = function() {
        function t3(t4) {
          this.m = t4;
          this.r2 = H();
          this.q3 = H();
          C.ONE.dlShiftTo(2 * t4.t, this.r2);
          this.mu = this.r2.divide(t4);
        }
        t3.prototype.convert = function(t4) {
          if (t4.s < 0 || t4.t > 2 * this.m.t)
            return t4.mod(this.m);
          else if (t4.compareTo(this.m) < 0)
            return t4;
          else {
            var e3 = H();
            t4.copyTo(e3);
            this.reduce(e3);
            return e3;
          }
        };
        t3.prototype.revert = function(t4) {
          return t4;
        };
        t3.prototype.reduce = function(t4) {
          t4.drShiftTo(this.m.t - 1, this.r2);
          if (t4.t > this.m.t + 1) {
            t4.t = this.m.t + 1;
            t4.clamp();
          }
          this.mu.multiplyUpperTo(this.r2, this.m.t + 1, this.q3);
          this.m.multiplyLowerTo(this.q3, this.m.t + 1, this.r2);
          while (t4.compareTo(this.r2) < 0)
            t4.dAddOffset(1, this.m.t + 1);
          t4.subTo(this.r2, t4);
          while (t4.compareTo(this.m) >= 0)
            t4.subTo(this.m, t4);
        };
        t3.prototype.mulTo = function(t4, e3, r3) {
          t4.multiplyTo(e3, r3);
          this.reduce(r3);
        };
        t3.prototype.sqrTo = function(t4, e3) {
          t4.squareTo(e3);
          this.reduce(e3);
        };
        return t3;
      }();
      function H() {
        return new C(null);
      }
      function U(t3, e3) {
        return new C(t3, e3);
      }
      var K = "undefined" !== typeof navigator;
      if (K && B && "Microsoft Internet Explorer" == navigator.appName) {
        C.prototype.am = function t3(e3, r3, i3, n2, s2, a2) {
          var o22 = 32767 & r3;
          var u2 = r3 >> 15;
          while (--a2 >= 0) {
            var c2 = 32767 & this[e3];
            var l2 = this[e3++] >> 15;
            var f22 = u2 * c2 + l2 * o22;
            c2 = o22 * c2 + ((32767 & f22) << 15) + i3[n2] + (1073741823 & s2);
            s2 = (c2 >>> 30) + (f22 >>> 15) + u2 * l2 + (s2 >>> 30);
            i3[n2++] = 1073741823 & c2;
          }
          return s2;
        };
        x = 30;
      } else if (K && B && "Netscape" != navigator.appName) {
        C.prototype.am = function t3(e3, r3, i3, n2, s2, a2) {
          while (--a2 >= 0) {
            var o22 = r3 * this[e3++] + i3[n2] + s2;
            s2 = Math.floor(o22 / 67108864);
            i3[n2++] = 67108863 & o22;
          }
          return s2;
        };
        x = 26;
      } else {
        C.prototype.am = function t3(e3, r3, i3, n2, s2, a2) {
          var o22 = 16383 & r3;
          var u2 = r3 >> 14;
          while (--a2 >= 0) {
            var c2 = 16383 & this[e3];
            var l2 = this[e3++] >> 14;
            var f22 = u2 * c2 + l2 * o22;
            c2 = o22 * c2 + ((16383 & f22) << 14) + i3[n2] + s2;
            s2 = (c2 >> 28) + (f22 >> 14) + u2 * l2;
            i3[n2++] = 268435455 & c2;
          }
          return s2;
        };
        x = 28;
      }
      C.prototype.DB = x;
      C.prototype.DM = (1 << x) - 1;
      C.prototype.DV = 1 << x;
      var j = 52;
      C.prototype.FV = Math.pow(2, j);
      C.prototype.F1 = j - x;
      C.prototype.F2 = 2 * x - j;
      var q = [];
      var F;
      var z;
      F = "0".charCodeAt(0);
      for (z = 0; z <= 9; ++z)
        q[F++] = z;
      F = "a".charCodeAt(0);
      for (z = 10; z < 36; ++z)
        q[F++] = z;
      F = "A".charCodeAt(0);
      for (z = 10; z < 36; ++z)
        q[F++] = z;
      function G(t3, e3) {
        var r3 = q[t3.charCodeAt(e3)];
        return null == r3 ? -1 : r3;
      }
      function Y(t3) {
        var e3 = H();
        e3.fromInt(t3);
        return e3;
      }
      function W(t3) {
        var e3 = 1;
        var r3;
        if (0 != (r3 = t3 >>> 16)) {
          t3 = r3;
          e3 += 16;
        }
        if (0 != (r3 = t3 >> 8)) {
          t3 = r3;
          e3 += 8;
        }
        if (0 != (r3 = t3 >> 4)) {
          t3 = r3;
          e3 += 4;
        }
        if (0 != (r3 = t3 >> 2)) {
          t3 = r3;
          e3 += 2;
        }
        if (0 != (r3 = t3 >> 1)) {
          t3 = r3;
          e3 += 1;
        }
        return e3;
      }
      C.ZERO = Y(0);
      C.ONE = Y(1);
      var J = function() {
        function t3() {
          this.i = 0;
          this.j = 0;
          this.S = [];
        }
        t3.prototype.init = function(t4) {
          var e3;
          var r3;
          var i3;
          for (e3 = 0; e3 < 256; ++e3)
            this.S[e3] = e3;
          r3 = 0;
          for (e3 = 0; e3 < 256; ++e3) {
            r3 = r3 + this.S[e3] + t4[e3 % t4.length] & 255;
            i3 = this.S[e3];
            this.S[e3] = this.S[r3];
            this.S[r3] = i3;
          }
          this.i = 0;
          this.j = 0;
        };
        t3.prototype.next = function() {
          var t4;
          this.i = this.i + 1 & 255;
          this.j = this.j + this.S[this.i] & 255;
          t4 = this.S[this.i];
          this.S[this.i] = this.S[this.j];
          this.S[this.j] = t4;
          return this.S[t4 + this.S[this.i] & 255];
        };
        return t3;
      }();
      function Z() {
        return new J();
      }
      var $ = 256;
      var X;
      var Q = null;
      var tt2;
      if (null == Q) {
        Q = [];
        tt2 = 0;
      }
      function nt() {
        if (null == X) {
          X = Z();
          while (tt2 < $) {
            var t3 = Math.floor(65536 * Math.random());
            Q[tt2++] = 255 & t3;
          }
          X.init(Q);
          for (tt2 = 0; tt2 < Q.length; ++tt2)
            Q[tt2] = 0;
          tt2 = 0;
        }
        return X.next();
      }
      var st = function() {
        function t3() {
        }
        t3.prototype.nextBytes = function(t4) {
          for (var e3 = 0; e3 < t4.length; ++e3)
            t4[e3] = nt();
        };
        return t3;
      }();
      function at(t3, e3) {
        if (e3 < t3.length + 22) {
          console.error("Message too long for RSA");
          return null;
        }
        var r3 = e3 - t3.length - 6;
        var i3 = "";
        for (var n2 = 0; n2 < r3; n2 += 2)
          i3 += "ff";
        var s2 = "0001" + i3 + "00" + t3;
        return U(s2, 16);
      }
      function ot(t3, e3) {
        if (e3 < t3.length + 11) {
          console.error("Message too long for RSA");
          return null;
        }
        var r3 = [];
        var i3 = t3.length - 1;
        while (i3 >= 0 && e3 > 0) {
          var n2 = t3.charCodeAt(i3--);
          if (n2 < 128)
            r3[--e3] = n2;
          else if (n2 > 127 && n2 < 2048) {
            r3[--e3] = 63 & n2 | 128;
            r3[--e3] = n2 >> 6 | 192;
          } else {
            r3[--e3] = 63 & n2 | 128;
            r3[--e3] = n2 >> 6 & 63 | 128;
            r3[--e3] = n2 >> 12 | 224;
          }
        }
        r3[--e3] = 0;
        var s2 = new st();
        var a2 = [];
        while (e3 > 2) {
          a2[0] = 0;
          while (0 == a2[0])
            s2.nextBytes(a2);
          r3[--e3] = a2[0];
        }
        r3[--e3] = 2;
        r3[--e3] = 0;
        return new C(r3);
      }
      var ut = function() {
        function t3() {
          this.n = null;
          this.e = 0;
          this.d = null;
          this.p = null;
          this.q = null;
          this.dmp1 = null;
          this.dmq1 = null;
          this.coeff = null;
        }
        t3.prototype.doPublic = function(t4) {
          return t4.modPowInt(this.e, this.n);
        };
        t3.prototype.doPrivate = function(t4) {
          if (null == this.p || null == this.q)
            return t4.modPow(this.d, this.n);
          var e3 = t4.mod(this.p).modPow(this.dmp1, this.p);
          var r3 = t4.mod(this.q).modPow(this.dmq1, this.q);
          while (e3.compareTo(r3) < 0)
            e3 = e3.add(this.p);
          return e3.subtract(r3).multiply(this.coeff).mod(this.p).multiply(this.q).add(r3);
        };
        t3.prototype.setPublic = function(t4, e3) {
          if (null != t4 && null != e3 && t4.length > 0 && e3.length > 0) {
            this.n = U(t4, 16);
            this.e = parseInt(e3, 16);
          } else
            console.error("Invalid RSA public key");
        };
        t3.prototype.encrypt = function(t4) {
          var e3 = this.n.bitLength() + 7 >> 3;
          var r3 = ot(t4, e3);
          if (null == r3)
            return null;
          var i3 = this.doPublic(r3);
          if (null == i3)
            return null;
          var n2 = i3.toString(16);
          var s2 = n2.length;
          for (var a2 = 0; a2 < 2 * e3 - s2; a2++)
            n2 = "0" + n2;
          return n2;
        };
        t3.prototype.setPrivate = function(t4, e3, r3) {
          if (null != t4 && null != e3 && t4.length > 0 && e3.length > 0) {
            this.n = U(t4, 16);
            this.e = parseInt(e3, 16);
            this.d = U(r3, 16);
          } else
            console.error("Invalid RSA private key");
        };
        t3.prototype.setPrivateEx = function(t4, e3, r3, i3, n2, s2, a2, o22) {
          if (null != t4 && null != e3 && t4.length > 0 && e3.length > 0) {
            this.n = U(t4, 16);
            this.e = parseInt(e3, 16);
            this.d = U(r3, 16);
            this.p = U(i3, 16);
            this.q = U(n2, 16);
            this.dmp1 = U(s2, 16);
            this.dmq1 = U(a2, 16);
            this.coeff = U(o22, 16);
          } else
            console.error("Invalid RSA private key");
        };
        t3.prototype.generate = function(t4, e3) {
          var r3 = new st();
          var i3 = t4 >> 1;
          this.e = parseInt(e3, 16);
          var n2 = new C(e3, 16);
          for (; ; ) {
            for (; ; ) {
              this.p = new C(t4 - i3, 1, r3);
              if (0 == this.p.subtract(C.ONE).gcd(n2).compareTo(C.ONE) && this.p.isProbablePrime(10))
                break;
            }
            for (; ; ) {
              this.q = new C(i3, 1, r3);
              if (0 == this.q.subtract(C.ONE).gcd(n2).compareTo(C.ONE) && this.q.isProbablePrime(10))
                break;
            }
            if (this.p.compareTo(this.q) <= 0) {
              var s2 = this.p;
              this.p = this.q;
              this.q = s2;
            }
            var a2 = this.p.subtract(C.ONE);
            var o22 = this.q.subtract(C.ONE);
            var u2 = a2.multiply(o22);
            if (0 == u2.gcd(n2).compareTo(C.ONE)) {
              this.n = this.p.multiply(this.q);
              this.d = n2.modInverse(u2);
              this.dmp1 = this.d.mod(a2);
              this.dmq1 = this.d.mod(o22);
              this.coeff = this.q.modInverse(this.p);
              break;
            }
          }
        };
        t3.prototype.decrypt = function(t4) {
          var e3 = U(t4, 16);
          var r3 = this.doPrivate(e3);
          if (null == r3)
            return null;
          return ct(r3, this.n.bitLength() + 7 >> 3);
        };
        t3.prototype.generateAsync = function(t4, e3, r3) {
          var i3 = new st();
          var n2 = t4 >> 1;
          this.e = parseInt(e3, 16);
          var s2 = new C(e3, 16);
          var a2 = this;
          var o22 = function() {
            var e4 = function() {
              if (a2.p.compareTo(a2.q) <= 0) {
                var t5 = a2.p;
                a2.p = a2.q;
                a2.q = t5;
              }
              var e5 = a2.p.subtract(C.ONE);
              var i4 = a2.q.subtract(C.ONE);
              var n3 = e5.multiply(i4);
              if (0 == n3.gcd(s2).compareTo(C.ONE)) {
                a2.n = a2.p.multiply(a2.q);
                a2.d = s2.modInverse(n3);
                a2.dmp1 = a2.d.mod(e5);
                a2.dmq1 = a2.d.mod(i4);
                a2.coeff = a2.q.modInverse(a2.p);
                setTimeout(function() {
                  r3();
                }, 0);
              } else
                setTimeout(o22, 0);
            };
            var u2 = function() {
              a2.q = H();
              a2.q.fromNumberAsync(n2, 1, i3, function() {
                a2.q.subtract(C.ONE).gcda(s2, function(t5) {
                  if (0 == t5.compareTo(C.ONE) && a2.q.isProbablePrime(10))
                    setTimeout(e4, 0);
                  else
                    setTimeout(u2, 0);
                });
              });
            };
            var c2 = function() {
              a2.p = H();
              a2.p.fromNumberAsync(t4 - n2, 1, i3, function() {
                a2.p.subtract(C.ONE).gcda(s2, function(t5) {
                  if (0 == t5.compareTo(C.ONE) && a2.p.isProbablePrime(10))
                    setTimeout(u2, 0);
                  else
                    setTimeout(c2, 0);
                });
              });
            };
            setTimeout(c2, 0);
          };
          setTimeout(o22, 0);
        };
        t3.prototype.sign = function(t4, e3, r3) {
          var i3 = ht(r3);
          var n2 = i3 + e3(t4).toString();
          var s2 = at(n2, this.n.bitLength() / 4);
          if (null == s2)
            return null;
          var a2 = this.doPrivate(s2);
          if (null == a2)
            return null;
          var o22 = a2.toString(16);
          if (0 == (1 & o22.length))
            return o22;
          else
            return "0" + o22;
        };
        t3.prototype.verify = function(t4, e3, r3) {
          var i3 = U(e3, 16);
          var n2 = this.doPublic(i3);
          if (null == n2)
            return null;
          var s2 = n2.toString(16).replace(/^1f+00/, "");
          var a2 = dt(s2);
          return a2 == r3(t4).toString();
        };
        t3.prototype.encryptLong = function(t4) {
          var e3 = this;
          var r3 = "";
          var i3 = (this.n.bitLength() + 7 >> 3) - 11;
          var n2 = this.setSplitChn(t4, i3);
          n2.forEach(function(t5) {
            r3 += e3.encrypt(t5);
          });
          return r3;
        };
        t3.prototype.decryptLong = function(t4) {
          var e3 = "";
          var r3 = this.n.bitLength() + 7 >> 3;
          var i3 = 2 * r3;
          if (t4.length > i3) {
            var n2 = t4.match(new RegExp(".{1," + i3 + "}", "g")) || [];
            var s2 = [];
            for (var a2 = 0; a2 < n2.length; a2++) {
              var o22 = U(n2[a2], 16);
              var u2 = this.doPrivate(o22);
              if (null == u2)
                return null;
              s2.push(u2);
            }
            e3 = lt(s2, r3);
          } else
            e3 = this.decrypt(t4);
          return e3;
        };
        t3.prototype.setSplitChn = function(t4, e3, r3) {
          if (void 0 === r3)
            r3 = [];
          var i3 = t4.split("");
          var n2 = 0;
          for (var s2 = 0; s2 < i3.length; s2++) {
            var a2 = i3[s2].charCodeAt(0);
            if (a2 <= 127)
              n2 += 1;
            else if (a2 <= 2047)
              n2 += 2;
            else if (a2 <= 65535)
              n2 += 3;
            else
              n2 += 4;
            if (n2 > e3) {
              var o22 = t4.substring(0, s2);
              r3.push(o22);
              return this.setSplitChn(t4.substring(s2), e3, r3);
            }
          }
          r3.push(t4);
          return r3;
        };
        return t3;
      }();
      function ct(t3, e3) {
        var r3 = t3.toByteArray();
        var i3 = 0;
        while (i3 < r3.length && 0 == r3[i3])
          ++i3;
        if (r3.length - i3 != e3 - 1 || 2 != r3[i3])
          return null;
        ++i3;
        while (0 != r3[i3])
          if (++i3 >= r3.length)
            return null;
        var n2 = "";
        while (++i3 < r3.length) {
          var s2 = 255 & r3[i3];
          if (s2 < 128)
            n2 += String.fromCharCode(s2);
          else if (s2 > 191 && s2 < 224) {
            n2 += String.fromCharCode((31 & s2) << 6 | 63 & r3[i3 + 1]);
            ++i3;
          } else {
            n2 += String.fromCharCode((15 & s2) << 12 | (63 & r3[i3 + 1]) << 6 | 63 & r3[i3 + 2]);
            i3 += 2;
          }
        }
        return n2;
      }
      function lt(t3, e3) {
        var r3 = [];
        for (var i3 = 0; i3 < t3.length; i3++) {
          var n2 = t3[i3];
          var s2 = n2.toByteArray();
          var a2 = 0;
          while (a2 < s2.length && 0 == s2[a2])
            ++a2;
          if (s2.length - a2 != e3 - 1 || 2 != s2[a2])
            return null;
          ++a2;
          while (0 != s2[a2])
            if (++a2 >= s2.length)
              return null;
          r3 = r3.concat(s2.slice(a2 + 1));
        }
        var o22 = r3;
        var u2 = -1;
        var c2 = "";
        while (++u2 < o22.length) {
          var l2 = 255 & o22[u2];
          if (l2 < 128)
            c2 += String.fromCharCode(l2);
          else if (l2 > 191 && l2 < 224) {
            c2 += String.fromCharCode((31 & l2) << 6 | 63 & o22[u2 + 1]);
            ++u2;
          } else {
            c2 += String.fromCharCode((15 & l2) << 12 | (63 & o22[u2 + 1]) << 6 | 63 & o22[u2 + 2]);
            u2 += 2;
          }
        }
        return c2;
      }
      var ft = { md2: "3020300c06082a864886f70d020205000410", md5: "3020300c06082a864886f70d020505000410", sha1: "3021300906052b0e03021a05000414", sha224: "302d300d06096086480165030402040500041c", sha256: "3031300d060960864801650304020105000420", sha384: "3041300d060960864801650304020205000430", sha512: "3051300d060960864801650304020305000440", ripemd160: "3021300906052b2403020105000414" };
      function ht(t3) {
        return ft[t3] || "";
      }
      function dt(t3) {
        for (var e3 in ft)
          if (ft.hasOwnProperty(e3)) {
            var r3 = ft[e3];
            var i3 = r3.length;
            if (t3.substr(0, i3) == r3)
              return t3.substr(i3);
          }
        return t3;
      }
      var vt = {};
      vt.lang = { extend: function(t3, e3, r3) {
        if (!e3 || !t3)
          throw new Error("YAHOO.lang.extend failed, please check that all dependencies are included.");
        var i3 = function() {
        };
        i3.prototype = e3.prototype;
        t3.prototype = new i3();
        t3.prototype.constructor = t3;
        t3.superclass = e3.prototype;
        if (e3.prototype.constructor == Object.prototype.constructor)
          e3.prototype.constructor = e3;
        if (r3) {
          var n2;
          for (n2 in r3)
            t3.prototype[n2] = r3[n2];
          var s2 = function() {
          }, a2 = ["toString", "valueOf"];
          try {
            if (/MSIE/.test(navigator.userAgent))
              s2 = function(t4, e4) {
                for (n2 = 0; n2 < a2.length; n2 += 1) {
                  var r4 = a2[n2], i4 = e4[r4];
                  if ("function" === typeof i4 && i4 != Object.prototype[r4])
                    t4[r4] = i4;
                }
              };
          } catch (t4) {
          }
          s2(t3.prototype, r3);
        }
      } };
      var pt = {};
      if ("undefined" == typeof pt.asn1 || !pt.asn1)
        pt.asn1 = {};
      pt.asn1.ASN1Util = new function() {
        this.integerToByteHex = function(t3) {
          var e3 = t3.toString(16);
          if (e3.length % 2 == 1)
            e3 = "0" + e3;
          return e3;
        };
        this.bigIntToMinTwosComplementsHex = function(t3) {
          var e3 = t3.toString(16);
          if ("-" != e3.substr(0, 1)) {
            if (e3.length % 2 == 1)
              e3 = "0" + e3;
            else if (!e3.match(/^[0-7]/))
              e3 = "00" + e3;
          } else {
            var r3 = e3.substr(1);
            var i3 = r3.length;
            if (i3 % 2 == 1)
              i3 += 1;
            else if (!e3.match(/^[0-7]/))
              i3 += 2;
            var n2 = "";
            for (var s2 = 0; s2 < i3; s2++)
              n2 += "f";
            var a2 = new C(n2, 16);
            var o22 = a2.xor(t3).add(C.ONE);
            e3 = o22.toString(16).replace(/^-/, "");
          }
          return e3;
        };
        this.getPEMStringFromHex = function(t3, e3) {
          return hextopem(t3, e3);
        };
        this.newObject = function(t3) {
          var e3 = pt, r3 = e3.asn1, i3 = r3.DERBoolean, n2 = r3.DERInteger, s2 = r3.DERBitString, a2 = r3.DEROctetString, o22 = r3.DERNull, u2 = r3.DERObjectIdentifier, c2 = r3.DEREnumerated, l2 = r3.DERUTF8String, f22 = r3.DERNumericString, h2 = r3.DERPrintableString, d2 = r3.DERTeletexString, v2 = r3.DERIA5String, p = r3.DERUTCTime, g2 = r3.DERGeneralizedTime, y2 = r3.DERSequence, m2 = r3.DERSet, w2 = r3.DERTaggedObject, S2 = r3.ASN1Util.newObject;
          var _2 = Object.keys(t3);
          if (1 != _2.length)
            throw "key of param shall be only one.";
          var b2 = _2[0];
          if (-1 == ":bool:int:bitstr:octstr:null:oid:enum:utf8str:numstr:prnstr:telstr:ia5str:utctime:gentime:seq:set:tag:".indexOf(":" + b2 + ":"))
            throw "undefined key: " + b2;
          if ("bool" == b2)
            return new i3(t3[b2]);
          if ("int" == b2)
            return new n2(t3[b2]);
          if ("bitstr" == b2)
            return new s2(t3[b2]);
          if ("octstr" == b2)
            return new a2(t3[b2]);
          if ("null" == b2)
            return new o22(t3[b2]);
          if ("oid" == b2)
            return new u2(t3[b2]);
          if ("enum" == b2)
            return new c2(t3[b2]);
          if ("utf8str" == b2)
            return new l2(t3[b2]);
          if ("numstr" == b2)
            return new f22(t3[b2]);
          if ("prnstr" == b2)
            return new h2(t3[b2]);
          if ("telstr" == b2)
            return new d2(t3[b2]);
          if ("ia5str" == b2)
            return new v2(t3[b2]);
          if ("utctime" == b2)
            return new p(t3[b2]);
          if ("gentime" == b2)
            return new g2(t3[b2]);
          if ("seq" == b2) {
            var E22 = t3[b2];
            var D2 = [];
            for (var M2 = 0; M2 < E22.length; M2++) {
              var T2 = S2(E22[M2]);
              D2.push(T2);
            }
            return new y2({ array: D2 });
          }
          if ("set" == b2) {
            var E22 = t3[b2];
            var D2 = [];
            for (var M2 = 0; M2 < E22.length; M2++) {
              var T2 = S2(E22[M2]);
              D2.push(T2);
            }
            return new m2({ array: D2 });
          }
          if ("tag" == b2) {
            var I2 = t3[b2];
            if ("[object Array]" === Object.prototype.toString.call(I2) && 3 == I2.length) {
              var A2 = S2(I2[2]);
              return new w2({ tag: I2[0], explicit: I2[1], obj: A2 });
            } else {
              var x2 = {};
              if (void 0 !== I2.explicit)
                x2.explicit = I2.explicit;
              if (void 0 !== I2.tag)
                x2.tag = I2.tag;
              if (void 0 === I2.obj)
                throw "obj shall be specified for 'tag'.";
              x2.obj = S2(I2.obj);
              return new w2(x2);
            }
          }
        };
        this.jsonToASN1HEX = function(t3) {
          var e3 = this.newObject(t3);
          return e3.getEncodedHex();
        };
      }();
      pt.asn1.ASN1Util.oidHexToInt = function(t3) {
        var e3 = "";
        var r3 = parseInt(t3.substr(0, 2), 16);
        var i3 = Math.floor(r3 / 40);
        var n2 = r3 % 40;
        var e3 = i3 + "." + n2;
        var s2 = "";
        for (var a2 = 2; a2 < t3.length; a2 += 2) {
          var o22 = parseInt(t3.substr(a2, 2), 16);
          var u2 = ("00000000" + o22.toString(2)).slice(-8);
          s2 += u2.substr(1, 7);
          if ("0" == u2.substr(0, 1)) {
            var c2 = new C(s2, 2);
            e3 = e3 + "." + c2.toString(10);
            s2 = "";
          }
        }
        return e3;
      };
      pt.asn1.ASN1Util.oidIntToHex = function(t3) {
        var e3 = function(t4) {
          var e4 = t4.toString(16);
          if (1 == e4.length)
            e4 = "0" + e4;
          return e4;
        };
        var r3 = function(t4) {
          var r4 = "";
          var i4 = new C(t4, 10);
          var n3 = i4.toString(2);
          var s3 = 7 - n3.length % 7;
          if (7 == s3)
            s3 = 0;
          var a3 = "";
          for (var o22 = 0; o22 < s3; o22++)
            a3 += "0";
          n3 = a3 + n3;
          for (var o22 = 0; o22 < n3.length - 1; o22 += 7) {
            var u2 = n3.substr(o22, 7);
            if (o22 != n3.length - 7)
              u2 = "1" + u2;
            r4 += e3(parseInt(u2, 2));
          }
          return r4;
        };
        if (!t3.match(/^[0-9.]+$/))
          throw "malformed oid string: " + t3;
        var i3 = "";
        var n2 = t3.split(".");
        var s2 = 40 * parseInt(n2[0]) + parseInt(n2[1]);
        i3 += e3(s2);
        n2.splice(0, 2);
        for (var a2 = 0; a2 < n2.length; a2++)
          i3 += r3(n2[a2]);
        return i3;
      };
      pt.asn1.ASN1Object = function() {
        var n2 = "";
        this.getLengthHexFromValue = function() {
          if ("undefined" == typeof this.hV || null == this.hV)
            throw "this.hV is null or undefined.";
          if (this.hV.length % 2 == 1)
            throw "value hex must be even length: n=" + n2.length + ",v=" + this.hV;
          var t3 = this.hV.length / 2;
          var e3 = t3.toString(16);
          if (e3.length % 2 == 1)
            e3 = "0" + e3;
          if (t3 < 128)
            return e3;
          else {
            var r3 = e3.length / 2;
            if (r3 > 15)
              throw "ASN.1 length too long to represent by 8x: n = " + t3.toString(16);
            var i3 = 128 + r3;
            return i3.toString(16) + e3;
          }
        };
        this.getEncodedHex = function() {
          if (null == this.hTLV || this.isModified) {
            this.hV = this.getFreshValueHex();
            this.hL = this.getLengthHexFromValue();
            this.hTLV = this.hT + this.hL + this.hV;
            this.isModified = false;
          }
          return this.hTLV;
        };
        this.getValueHex = function() {
          this.getEncodedHex();
          return this.hV;
        };
        this.getFreshValueHex = function() {
          return "";
        };
      };
      pt.asn1.DERAbstractString = function(t3) {
        pt.asn1.DERAbstractString.superclass.constructor.call(this);
        this.getString = function() {
          return this.s;
        };
        this.setString = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.s = t4;
          this.hV = stohex(this.s);
        };
        this.setStringHex = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.s = null;
          this.hV = t4;
        };
        this.getFreshValueHex = function() {
          return this.hV;
        };
        if ("undefined" != typeof t3) {
          if ("string" == typeof t3)
            this.setString(t3);
          else if ("undefined" != typeof t3["str"])
            this.setString(t3["str"]);
          else if ("undefined" != typeof t3["hex"])
            this.setStringHex(t3["hex"]);
        }
      };
      vt.lang.extend(pt.asn1.DERAbstractString, pt.asn1.ASN1Object);
      pt.asn1.DERAbstractTime = function(t3) {
        pt.asn1.DERAbstractTime.superclass.constructor.call(this);
        this.localDateToUTC = function(t4) {
          utc = t4.getTime() + 6e4 * t4.getTimezoneOffset();
          var e3 = new Date(utc);
          return e3;
        };
        this.formatDate = function(t4, e3, r3) {
          var i3 = this.zeroPadding;
          var n2 = this.localDateToUTC(t4);
          var s2 = String(n2.getFullYear());
          if ("utc" == e3)
            s2 = s2.substr(2, 2);
          var a2 = i3(String(n2.getMonth() + 1), 2);
          var o22 = i3(String(n2.getDate()), 2);
          var u2 = i3(String(n2.getHours()), 2);
          var c2 = i3(String(n2.getMinutes()), 2);
          var l2 = i3(String(n2.getSeconds()), 2);
          var f22 = s2 + a2 + o22 + u2 + c2 + l2;
          if (true === r3) {
            var h2 = n2.getMilliseconds();
            if (0 != h2) {
              var d2 = i3(String(h2), 3);
              d2 = d2.replace(/[0]+$/, "");
              f22 = f22 + "." + d2;
            }
          }
          return f22 + "Z";
        };
        this.zeroPadding = function(t4, e3) {
          if (t4.length >= e3)
            return t4;
          return new Array(e3 - t4.length + 1).join("0") + t4;
        };
        this.getString = function() {
          return this.s;
        };
        this.setString = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.s = t4;
          this.hV = stohex(t4);
        };
        this.setByDateValue = function(t4, e3, r3, i3, n2, s2) {
          var a2 = new Date(Date.UTC(t4, e3 - 1, r3, i3, n2, s2, 0));
          this.setByDate(a2);
        };
        this.getFreshValueHex = function() {
          return this.hV;
        };
      };
      vt.lang.extend(pt.asn1.DERAbstractTime, pt.asn1.ASN1Object);
      pt.asn1.DERAbstractStructured = function(t3) {
        pt.asn1.DERAbstractString.superclass.constructor.call(this);
        this.setByASN1ObjectArray = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.asn1Array = t4;
        };
        this.appendASN1Object = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.asn1Array.push(t4);
        };
        this.asn1Array = new Array();
        if ("undefined" != typeof t3) {
          if ("undefined" != typeof t3["array"])
            this.asn1Array = t3["array"];
        }
      };
      vt.lang.extend(pt.asn1.DERAbstractStructured, pt.asn1.ASN1Object);
      pt.asn1.DERBoolean = function() {
        pt.asn1.DERBoolean.superclass.constructor.call(this);
        this.hT = "01";
        this.hTLV = "0101ff";
      };
      vt.lang.extend(pt.asn1.DERBoolean, pt.asn1.ASN1Object);
      pt.asn1.DERInteger = function(t3) {
        pt.asn1.DERInteger.superclass.constructor.call(this);
        this.hT = "02";
        this.setByBigInteger = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.hV = pt.asn1.ASN1Util.bigIntToMinTwosComplementsHex(t4);
        };
        this.setByInteger = function(t4) {
          var e3 = new C(String(t4), 10);
          this.setByBigInteger(e3);
        };
        this.setValueHex = function(t4) {
          this.hV = t4;
        };
        this.getFreshValueHex = function() {
          return this.hV;
        };
        if ("undefined" != typeof t3) {
          if ("undefined" != typeof t3["bigint"])
            this.setByBigInteger(t3["bigint"]);
          else if ("undefined" != typeof t3["int"])
            this.setByInteger(t3["int"]);
          else if ("number" == typeof t3)
            this.setByInteger(t3);
          else if ("undefined" != typeof t3["hex"])
            this.setValueHex(t3["hex"]);
        }
      };
      vt.lang.extend(pt.asn1.DERInteger, pt.asn1.ASN1Object);
      pt.asn1.DERBitString = function(t3) {
        if (void 0 !== t3 && "undefined" !== typeof t3.obj) {
          var e3 = pt.asn1.ASN1Util.newObject(t3.obj);
          t3.hex = "00" + e3.getEncodedHex();
        }
        pt.asn1.DERBitString.superclass.constructor.call(this);
        this.hT = "03";
        this.setHexValueIncludingUnusedBits = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.hV = t4;
        };
        this.setUnusedBitsAndHexValue = function(t4, e4) {
          if (t4 < 0 || 7 < t4)
            throw "unused bits shall be from 0 to 7: u = " + t4;
          var r3 = "0" + t4;
          this.hTLV = null;
          this.isModified = true;
          this.hV = r3 + e4;
        };
        this.setByBinaryString = function(t4) {
          t4 = t4.replace(/0+$/, "");
          var e4 = 8 - t4.length % 8;
          if (8 == e4)
            e4 = 0;
          for (var r3 = 0; r3 <= e4; r3++)
            t4 += "0";
          var i3 = "";
          for (var r3 = 0; r3 < t4.length - 1; r3 += 8) {
            var n2 = t4.substr(r3, 8);
            var s2 = parseInt(n2, 2).toString(16);
            if (1 == s2.length)
              s2 = "0" + s2;
            i3 += s2;
          }
          this.hTLV = null;
          this.isModified = true;
          this.hV = "0" + e4 + i3;
        };
        this.setByBooleanArray = function(t4) {
          var e4 = "";
          for (var r3 = 0; r3 < t4.length; r3++)
            if (true == t4[r3])
              e4 += "1";
            else
              e4 += "0";
          this.setByBinaryString(e4);
        };
        this.newFalseArray = function(t4) {
          var e4 = new Array(t4);
          for (var r3 = 0; r3 < t4; r3++)
            e4[r3] = false;
          return e4;
        };
        this.getFreshValueHex = function() {
          return this.hV;
        };
        if ("undefined" != typeof t3) {
          if ("string" == typeof t3 && t3.toLowerCase().match(/^[0-9a-f]+$/))
            this.setHexValueIncludingUnusedBits(t3);
          else if ("undefined" != typeof t3["hex"])
            this.setHexValueIncludingUnusedBits(t3["hex"]);
          else if ("undefined" != typeof t3["bin"])
            this.setByBinaryString(t3["bin"]);
          else if ("undefined" != typeof t3["array"])
            this.setByBooleanArray(t3["array"]);
        }
      };
      vt.lang.extend(pt.asn1.DERBitString, pt.asn1.ASN1Object);
      pt.asn1.DEROctetString = function(t3) {
        if (void 0 !== t3 && "undefined" !== typeof t3.obj) {
          var e3 = pt.asn1.ASN1Util.newObject(t3.obj);
          t3.hex = e3.getEncodedHex();
        }
        pt.asn1.DEROctetString.superclass.constructor.call(this, t3);
        this.hT = "04";
      };
      vt.lang.extend(pt.asn1.DEROctetString, pt.asn1.DERAbstractString);
      pt.asn1.DERNull = function() {
        pt.asn1.DERNull.superclass.constructor.call(this);
        this.hT = "05";
        this.hTLV = "0500";
      };
      vt.lang.extend(pt.asn1.DERNull, pt.asn1.ASN1Object);
      pt.asn1.DERObjectIdentifier = function(t3) {
        var e3 = function(t4) {
          var e4 = t4.toString(16);
          if (1 == e4.length)
            e4 = "0" + e4;
          return e4;
        };
        var r3 = function(t4) {
          var r4 = "";
          var i3 = new C(t4, 10);
          var n2 = i3.toString(2);
          var s2 = 7 - n2.length % 7;
          if (7 == s2)
            s2 = 0;
          var a2 = "";
          for (var o22 = 0; o22 < s2; o22++)
            a2 += "0";
          n2 = a2 + n2;
          for (var o22 = 0; o22 < n2.length - 1; o22 += 7) {
            var u2 = n2.substr(o22, 7);
            if (o22 != n2.length - 7)
              u2 = "1" + u2;
            r4 += e3(parseInt(u2, 2));
          }
          return r4;
        };
        pt.asn1.DERObjectIdentifier.superclass.constructor.call(this);
        this.hT = "06";
        this.setValueHex = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.s = null;
          this.hV = t4;
        };
        this.setValueOidString = function(t4) {
          if (!t4.match(/^[0-9.]+$/))
            throw "malformed oid string: " + t4;
          var i3 = "";
          var n2 = t4.split(".");
          var s2 = 40 * parseInt(n2[0]) + parseInt(n2[1]);
          i3 += e3(s2);
          n2.splice(0, 2);
          for (var a2 = 0; a2 < n2.length; a2++)
            i3 += r3(n2[a2]);
          this.hTLV = null;
          this.isModified = true;
          this.s = null;
          this.hV = i3;
        };
        this.setValueName = function(t4) {
          var e4 = pt.asn1.x509.OID.name2oid(t4);
          if ("" !== e4)
            this.setValueOidString(e4);
          else
            throw "DERObjectIdentifier oidName undefined: " + t4;
        };
        this.getFreshValueHex = function() {
          return this.hV;
        };
        if (void 0 !== t3) {
          if ("string" === typeof t3)
            if (t3.match(/^[0-2].[0-9.]+$/))
              this.setValueOidString(t3);
            else
              this.setValueName(t3);
          else if (void 0 !== t3.oid)
            this.setValueOidString(t3.oid);
          else if (void 0 !== t3.hex)
            this.setValueHex(t3.hex);
          else if (void 0 !== t3.name)
            this.setValueName(t3.name);
        }
      };
      vt.lang.extend(pt.asn1.DERObjectIdentifier, pt.asn1.ASN1Object);
      pt.asn1.DEREnumerated = function(t3) {
        pt.asn1.DEREnumerated.superclass.constructor.call(this);
        this.hT = "0a";
        this.setByBigInteger = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.hV = pt.asn1.ASN1Util.bigIntToMinTwosComplementsHex(t4);
        };
        this.setByInteger = function(t4) {
          var e3 = new C(String(t4), 10);
          this.setByBigInteger(e3);
        };
        this.setValueHex = function(t4) {
          this.hV = t4;
        };
        this.getFreshValueHex = function() {
          return this.hV;
        };
        if ("undefined" != typeof t3) {
          if ("undefined" != typeof t3["int"])
            this.setByInteger(t3["int"]);
          else if ("number" == typeof t3)
            this.setByInteger(t3);
          else if ("undefined" != typeof t3["hex"])
            this.setValueHex(t3["hex"]);
        }
      };
      vt.lang.extend(pt.asn1.DEREnumerated, pt.asn1.ASN1Object);
      pt.asn1.DERUTF8String = function(t3) {
        pt.asn1.DERUTF8String.superclass.constructor.call(this, t3);
        this.hT = "0c";
      };
      vt.lang.extend(pt.asn1.DERUTF8String, pt.asn1.DERAbstractString);
      pt.asn1.DERNumericString = function(t3) {
        pt.asn1.DERNumericString.superclass.constructor.call(this, t3);
        this.hT = "12";
      };
      vt.lang.extend(pt.asn1.DERNumericString, pt.asn1.DERAbstractString);
      pt.asn1.DERPrintableString = function(t3) {
        pt.asn1.DERPrintableString.superclass.constructor.call(this, t3);
        this.hT = "13";
      };
      vt.lang.extend(pt.asn1.DERPrintableString, pt.asn1.DERAbstractString);
      pt.asn1.DERTeletexString = function(t3) {
        pt.asn1.DERTeletexString.superclass.constructor.call(this, t3);
        this.hT = "14";
      };
      vt.lang.extend(pt.asn1.DERTeletexString, pt.asn1.DERAbstractString);
      pt.asn1.DERIA5String = function(t3) {
        pt.asn1.DERIA5String.superclass.constructor.call(this, t3);
        this.hT = "16";
      };
      vt.lang.extend(pt.asn1.DERIA5String, pt.asn1.DERAbstractString);
      pt.asn1.DERUTCTime = function(t3) {
        pt.asn1.DERUTCTime.superclass.constructor.call(this, t3);
        this.hT = "17";
        this.setByDate = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.date = t4;
          this.s = this.formatDate(this.date, "utc");
          this.hV = stohex(this.s);
        };
        this.getFreshValueHex = function() {
          if ("undefined" == typeof this.date && "undefined" == typeof this.s) {
            this.date = /* @__PURE__ */ new Date();
            this.s = this.formatDate(this.date, "utc");
            this.hV = stohex(this.s);
          }
          return this.hV;
        };
        if (void 0 !== t3) {
          if (void 0 !== t3.str)
            this.setString(t3.str);
          else if ("string" == typeof t3 && t3.match(/^[0-9]{12}Z$/))
            this.setString(t3);
          else if (void 0 !== t3.hex)
            this.setStringHex(t3.hex);
          else if (void 0 !== t3.date)
            this.setByDate(t3.date);
        }
      };
      vt.lang.extend(pt.asn1.DERUTCTime, pt.asn1.DERAbstractTime);
      pt.asn1.DERGeneralizedTime = function(t3) {
        pt.asn1.DERGeneralizedTime.superclass.constructor.call(this, t3);
        this.hT = "18";
        this.withMillis = false;
        this.setByDate = function(t4) {
          this.hTLV = null;
          this.isModified = true;
          this.date = t4;
          this.s = this.formatDate(this.date, "gen", this.withMillis);
          this.hV = stohex(this.s);
        };
        this.getFreshValueHex = function() {
          if (void 0 === this.date && void 0 === this.s) {
            this.date = /* @__PURE__ */ new Date();
            this.s = this.formatDate(this.date, "gen", this.withMillis);
            this.hV = stohex(this.s);
          }
          return this.hV;
        };
        if (void 0 !== t3) {
          if (void 0 !== t3.str)
            this.setString(t3.str);
          else if ("string" == typeof t3 && t3.match(/^[0-9]{14}Z$/))
            this.setString(t3);
          else if (void 0 !== t3.hex)
            this.setStringHex(t3.hex);
          else if (void 0 !== t3.date)
            this.setByDate(t3.date);
          if (true === t3.millis)
            this.withMillis = true;
        }
      };
      vt.lang.extend(pt.asn1.DERGeneralizedTime, pt.asn1.DERAbstractTime);
      pt.asn1.DERSequence = function(t3) {
        pt.asn1.DERSequence.superclass.constructor.call(this, t3);
        this.hT = "30";
        this.getFreshValueHex = function() {
          var t4 = "";
          for (var e3 = 0; e3 < this.asn1Array.length; e3++) {
            var r3 = this.asn1Array[e3];
            t4 += r3.getEncodedHex();
          }
          this.hV = t4;
          return this.hV;
        };
      };
      vt.lang.extend(pt.asn1.DERSequence, pt.asn1.DERAbstractStructured);
      pt.asn1.DERSet = function(t3) {
        pt.asn1.DERSet.superclass.constructor.call(this, t3);
        this.hT = "31";
        this.sortFlag = true;
        this.getFreshValueHex = function() {
          var t4 = new Array();
          for (var e3 = 0; e3 < this.asn1Array.length; e3++) {
            var r3 = this.asn1Array[e3];
            t4.push(r3.getEncodedHex());
          }
          if (true == this.sortFlag)
            t4.sort();
          this.hV = t4.join("");
          return this.hV;
        };
        if ("undefined" != typeof t3) {
          if ("undefined" != typeof t3.sortflag && false == t3.sortflag)
            this.sortFlag = false;
        }
      };
      vt.lang.extend(pt.asn1.DERSet, pt.asn1.DERAbstractStructured);
      pt.asn1.DERTaggedObject = function(t3) {
        pt.asn1.DERTaggedObject.superclass.constructor.call(this);
        this.hT = "a0";
        this.hV = "";
        this.isExplicit = true;
        this.asn1Object = null;
        this.setASN1Object = function(t4, e3, r3) {
          this.hT = e3;
          this.isExplicit = t4;
          this.asn1Object = r3;
          if (this.isExplicit) {
            this.hV = this.asn1Object.getEncodedHex();
            this.hTLV = null;
            this.isModified = true;
          } else {
            this.hV = null;
            this.hTLV = r3.getEncodedHex();
            this.hTLV = this.hTLV.replace(/^../, e3);
            this.isModified = false;
          }
        };
        this.getFreshValueHex = function() {
          return this.hV;
        };
        if ("undefined" != typeof t3) {
          if ("undefined" != typeof t3["tag"])
            this.hT = t3["tag"];
          if ("undefined" != typeof t3["explicit"])
            this.isExplicit = t3["explicit"];
          if ("undefined" != typeof t3["obj"]) {
            this.asn1Object = t3["obj"];
            this.setASN1Object(this.isExplicit, this.hT, this.asn1Object);
          }
        }
      };
      vt.lang.extend(pt.asn1.DERTaggedObject, pt.asn1.ASN1Object);
      var gt = /* @__PURE__ */ function() {
        var t3 = function(e3, r3) {
          t3 = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(t4, e4) {
            t4.__proto__ = e4;
          } || function(t4, e4) {
            for (var r4 in e4)
              if (Object.prototype.hasOwnProperty.call(e4, r4))
                t4[r4] = e4[r4];
          };
          return t3(e3, r3);
        };
        return function(e3, r3) {
          if ("function" !== typeof r3 && null !== r3)
            throw new TypeError("Class extends value " + String(r3) + " is not a constructor or null");
          t3(e3, r3);
          function i3() {
            this.constructor = e3;
          }
          e3.prototype = null === r3 ? Object.create(r3) : (i3.prototype = r3.prototype, new i3());
        };
      }();
      var yt = function(t3) {
        gt(e3, t3);
        function e3(r3) {
          var i3 = t3.call(this) || this;
          if (r3) {
            if ("string" === typeof r3)
              i3.parseKey(r3);
            else if (e3.hasPrivateKeyProperty(r3) || e3.hasPublicKeyProperty(r3))
              i3.parsePropertiesFrom(r3);
          }
          return i3;
        }
        e3.prototype.parseKey = function(t4) {
          try {
            var e4 = 0;
            var r3 = 0;
            var i3 = /^\s*(?:[0-9A-Fa-f][0-9A-Fa-f]\s*)+$/;
            var n2 = i3.test(t4) ? y.decode(t4) : w.unarmor(t4);
            var s2 = I.decode(n2);
            if (3 === s2.sub.length)
              s2 = s2.sub[2].sub[0];
            if (9 === s2.sub.length) {
              e4 = s2.sub[1].getHexStringValue();
              this.n = U(e4, 16);
              r3 = s2.sub[2].getHexStringValue();
              this.e = parseInt(r3, 16);
              var a2 = s2.sub[3].getHexStringValue();
              this.d = U(a2, 16);
              var o22 = s2.sub[4].getHexStringValue();
              this.p = U(o22, 16);
              var u2 = s2.sub[5].getHexStringValue();
              this.q = U(u2, 16);
              var c2 = s2.sub[6].getHexStringValue();
              this.dmp1 = U(c2, 16);
              var l2 = s2.sub[7].getHexStringValue();
              this.dmq1 = U(l2, 16);
              var f22 = s2.sub[8].getHexStringValue();
              this.coeff = U(f22, 16);
            } else if (2 === s2.sub.length) {
              var h2 = s2.sub[1];
              var d2 = h2.sub[0];
              e4 = d2.sub[0].getHexStringValue();
              this.n = U(e4, 16);
              r3 = d2.sub[1].getHexStringValue();
              this.e = parseInt(r3, 16);
            } else
              return false;
            return true;
          } catch (t5) {
            return false;
          }
        };
        e3.prototype.getPrivateBaseKey = function() {
          var t4 = { array: [new pt.asn1.DERInteger({ int: 0 }), new pt.asn1.DERInteger({ bigint: this.n }), new pt.asn1.DERInteger({ int: this.e }), new pt.asn1.DERInteger({ bigint: this.d }), new pt.asn1.DERInteger({ bigint: this.p }), new pt.asn1.DERInteger({ bigint: this.q }), new pt.asn1.DERInteger({ bigint: this.dmp1 }), new pt.asn1.DERInteger({ bigint: this.dmq1 }), new pt.asn1.DERInteger({ bigint: this.coeff })] };
          var e4 = new pt.asn1.DERSequence(t4);
          return e4.getEncodedHex();
        };
        e3.prototype.getPrivateBaseKeyB64 = function() {
          return d(this.getPrivateBaseKey());
        };
        e3.prototype.getPublicBaseKey = function() {
          var t4 = new pt.asn1.DERSequence({ array: [new pt.asn1.DERObjectIdentifier({ oid: "1.2.840.113549.1.1.1" }), new pt.asn1.DERNull()] });
          var e4 = new pt.asn1.DERSequence({ array: [new pt.asn1.DERInteger({ bigint: this.n }), new pt.asn1.DERInteger({ int: this.e })] });
          var r3 = new pt.asn1.DERBitString({ hex: "00" + e4.getEncodedHex() });
          var i3 = new pt.asn1.DERSequence({ array: [t4, r3] });
          return i3.getEncodedHex();
        };
        e3.prototype.getPublicBaseKeyB64 = function() {
          return d(this.getPublicBaseKey());
        };
        e3.wordwrap = function(t4, e4) {
          e4 = e4 || 64;
          if (!t4)
            return t4;
          var r3 = "(.{1," + e4 + "})( +|$\n?)|(.{1," + e4 + "})";
          return t4.match(RegExp(r3, "g")).join("\n");
        };
        e3.prototype.getPrivateKey = function() {
          var t4 = "-----BEGIN RSA PRIVATE KEY-----\n";
          t4 += e3.wordwrap(this.getPrivateBaseKeyB64()) + "\n";
          t4 += "-----END RSA PRIVATE KEY-----";
          return t4;
        };
        e3.prototype.getPublicKey = function() {
          var t4 = "-----BEGIN PUBLIC KEY-----\n";
          t4 += e3.wordwrap(this.getPublicBaseKeyB64()) + "\n";
          t4 += "-----END PUBLIC KEY-----";
          return t4;
        };
        e3.hasPublicKeyProperty = function(t4) {
          t4 = t4 || {};
          return t4.hasOwnProperty("n") && t4.hasOwnProperty("e");
        };
        e3.hasPrivateKeyProperty = function(t4) {
          t4 = t4 || {};
          return t4.hasOwnProperty("n") && t4.hasOwnProperty("e") && t4.hasOwnProperty("d") && t4.hasOwnProperty("p") && t4.hasOwnProperty("q") && t4.hasOwnProperty("dmp1") && t4.hasOwnProperty("dmq1") && t4.hasOwnProperty("coeff");
        };
        e3.prototype.parsePropertiesFrom = function(t4) {
          this.n = t4.n;
          this.e = t4.e;
          if (t4.hasOwnProperty("d")) {
            this.d = t4.d;
            this.p = t4.p;
            this.q = t4.q;
            this.dmp1 = t4.dmp1;
            this.dmq1 = t4.dmq1;
            this.coeff = t4.coeff;
          }
        };
        return e3;
      }(ut);
      const mt = { i: "3.2.1" };
      var wt = function() {
        function t3(t4) {
          if (void 0 === t4)
            t4 = {};
          t4 = t4 || {};
          this.default_key_size = t4.default_key_size ? parseInt(t4.default_key_size, 10) : 1024;
          this.default_public_exponent = t4.default_public_exponent || "010001";
          this.log = t4.log || false;
          this.key = null;
        }
        t3.prototype.setKey = function(t4) {
          if (this.log && this.key)
            console.warn("A key was already set, overriding existing.");
          this.key = new yt(t4);
        };
        t3.prototype.setPrivateKey = function(t4) {
          this.setKey(t4);
        };
        t3.prototype.setPublicKey = function(t4) {
          this.setKey(t4);
        };
        t3.prototype.decrypt = function(t4) {
          try {
            return this.getKey().decrypt(t4);
          } catch (t5) {
            return false;
          }
        };
        t3.prototype.encrypt = function(t4) {
          try {
            return this.getKey().encrypt(t4);
          } catch (t5) {
            return false;
          }
        };
        t3.prototype.encryptLong = function(t4) {
          try {
            return d(this.getKey().encryptLong(t4));
          } catch (t5) {
            return false;
          }
        };
        t3.prototype.decryptLong = function(t4) {
          try {
            return this.getKey().decryptLong(t4);
          } catch (t5) {
            return false;
          }
        };
        t3.prototype.sign = function(t4, e3, r3) {
          try {
            return d(this.getKey().sign(t4, e3, r3));
          } catch (t5) {
            return false;
          }
        };
        t3.prototype.verify = function(t4, e3, r3) {
          try {
            return this.getKey().verify(t4, v(e3), r3);
          } catch (t5) {
            return false;
          }
        };
        t3.prototype.getKey = function(t4) {
          if (!this.key) {
            this.key = new yt();
            if (t4 && "[object Function]" === {}.toString.call(t4)) {
              this.key.generateAsync(this.default_key_size, this.default_public_exponent, t4);
              return;
            }
            this.key.generate(this.default_key_size, this.default_public_exponent);
          }
          return this.key;
        };
        t3.prototype.getPrivateKey = function() {
          return this.getKey().getPrivateKey();
        };
        t3.prototype.getPrivateKeyB64 = function() {
          return this.getKey().getPrivateBaseKeyB64();
        };
        t3.prototype.getPublicKey = function() {
          return this.getKey().getPublicKey();
        };
        t3.prototype.getPublicKeyB64 = function() {
          return this.getKey().getPublicBaseKeyB64();
        };
        t3.version = mt.i;
        return t3;
      }();
      const St = wt;
    }, 2480: () => {
    } };
    var e = {};
    function r(i2) {
      var n = e[i2];
      if (void 0 !== n)
        return n.exports;
      var s = e[i2] = { id: i2, loaded: false, exports: {} };
      t2[i2].call(s.exports, s, s.exports, r);
      s.loaded = true;
      return s.exports;
    }
    (() => {
      r.d = (t22, e2) => {
        for (var i2 in e2)
          if (r.o(e2, i2) && !r.o(t22, i2))
            Object.defineProperty(t22, i2, { enumerable: true, get: e2[i2] });
      };
    })();
    (() => {
      r.g = function() {
        if ("object" === typeof globalThis)
          return globalThis;
        try {
          return this || new Function("return this")();
        } catch (t22) {
          if ("object" === typeof window)
            return window;
        }
      }();
    })();
    (() => {
      r.o = (t22, e2) => Object.prototype.hasOwnProperty.call(t22, e2);
    })();
    (() => {
      r.r = (t22) => {
        if ("undefined" !== typeof Symbol && Symbol.toStringTag)
          Object.defineProperty(t22, Symbol.toStringTag, { value: "Module" });
        Object.defineProperty(t22, "__esModule", { value: true });
      };
    })();
    (() => {
      r.nmd = (t22) => {
        t22.paths = [];
        if (!t22.children)
          t22.children = [];
        return t22;
      };
    })();
    var i = r(9021);
    return i;
  })());
})(gtpushMin);
var gtpushMinExports = gtpushMin.exports;
var GtPush = /* @__PURE__ */ getDefaultExportFromCjs(gtpushMinExports);
index.invokePushCallback({
  type: "enabled"
});
const appid = "__UNI__62F611F";
{
  if (typeof index.onAppShow === "function") {
    index.onAppShow(() => {
      GtPush.enableSocket(true);
    });
  }
  GtPush.init({
    appid,
    onError: (res) => {
      console.error(res.error);
      const data = {
        type: "clientId",
        cid: "",
        errMsg: res.error
      };
      index.invokePushCallback(data);
    },
    onClientId: (res) => {
      const data = {
        type: "clientId",
        cid: res.cid
      };
      index.invokePushCallback(data);
    },
    onlineState: (res) => {
      const data = {
        type: "lineState",
        online: res.online
      };
      index.invokePushCallback(data);
    },
    onPushMsg: (res) => {
      const data = {
        type: "pushMsg",
        message: res.message
      };
      index.invokePushCallback(data);
    }
  });
}
exports._export_sfc = _export_sfc;
exports.createSSRApp = createSSRApp;
exports.f = f;
exports.index = index;
exports.o = o;
exports.t = t;
//# sourceMappingURL=../../.sourcemap/mp-weixin/common/vendor.js.map
