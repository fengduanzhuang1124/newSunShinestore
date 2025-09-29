<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
// 主应用组件
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #f5f5f5;
}

#app {
  height: 100vh;
  display: flex;
  width: 100%;
}

/* 确保Element Plus容器能够充分利用空间 */
.el-container {
  width: 100% !important;
  max-width: none !important;
}

.el-main {
  width: 100% !important;
  max-width: none !important;
}
</style>
