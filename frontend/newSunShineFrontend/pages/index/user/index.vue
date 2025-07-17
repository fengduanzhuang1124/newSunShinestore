<template>
  <view>
    <button @click="getUsers">加载用户数据</button>
    <view v-for="(user, index) in users" :key="index">
      用户名: {{ user.username }}
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      users: []
    };
  },
  methods: {
    getUsers() {
      console.log('按钮被点击了');
      uni.request({
        url: 'http://192.168.1.17:3000/api/users',
        method: 'GET',
        success: (res) => {
          console.log('获取用户成功:', res.data);
          this.users = res.data;
        },
        fail: (err) => {
          console.error('请求失败', err);
        }
      });
      console.log('按钮被点击了');
    }
  } 
}
</script>