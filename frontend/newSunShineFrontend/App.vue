<script>
import { api } from '@/utils/request'  // 用于切换后端地址

export default {
  onLaunch() {
   

    const { platform } = wx.getSystemInfoSync()
    if (platform === 'devtools') {
      api.setBaseURL('http://192.168.1.17:3000')  
    } else {
    //   api.setBaseURL('https://你的稳定域名.com')   // 你的公网 HTTPS 域名
    }
   

    console.log('App Launch, BASE_URL =>', api.getBaseURL())
  },
  onShow() {
    console.log('App Show')
  },
  onHide() {
    console.log('App Hide')
  }
}
</script>

<style>
/* 每个页面公共 css */
</style>
