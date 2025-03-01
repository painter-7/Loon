# 两步路极简稳定版插件 v3.0
# 修复已知运行问题 | 最低兼容Loon 2.1+

[Plugin]
name = 两步路签到修复版
desc = 基础签到功能+增强错误提示
author = Loon助手
version = 3.0
icon = https://statics.2bulu.com/favicon.ico
enable = true

[MITM]
hostname = www.2bulu.com

[Script]
# 简化版Cookie捕获 (无复杂验证)
http-request ^https:\/\/www\.2bulu\.com\/user\/sign_in\.htm script-path=https://raw.githubusercontent.com/painter-7/Loon/main/Plugin/2bulu.js,timeout=30,enable=true

# 基础签到任务
cron "5 9 * * *" script-path=https://raw.githubusercontent.com/painter-7/Loon/main/Plugin/2bulu.js, enable=true

[Script Code]
// 极简核心代码 - 仅保留必要功能
const $ = new API('2bulu');

// 主入口判断
typeof $request !== 'undefined' ? captureCookie($request) : doSign();

// Cookie捕获函数
function captureCookie(req) {
  try {
    const cookie = req.headers?.Cookie || req.headers?.cookie;
    if (!cookie) return;
    
    // 持久化存储
    $persistentStore.write(cookie, '两步路Cookie');
    $notification.post('🍪 捕获成功', '请手动执行签到验证');
    $done();
  } catch (e) {
    handleError('捕获异常', e);
  }
}

// 签到执行函数
function doSign() {
  const cookie = $persistentStore.read('两步路Cookie');
  if (!cookie) return notifyError('❌ 未配置Cookie');
  
  $httpClient.post({
    url: 'https://www.2bulu.com/user/sign_in.htm',
    headers: {
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
    }
  }, (error, resp, data) => {
    if (error) return notifyError('网络请求失败', error);
    
    try {
      const result = JSON.parse(data);
      if (result.result === true) {
        $notification.post('✅ 签到成功', `累计签到 ${result.data} 天`);
      } else {
        $notification.post('⏸ 无需重复', '今日已签到');
      }
    } catch(e) {
      notifyError('响应解析失败', data);
    }
  });
}

// 错误处理统一入口
function handleError(type, error) {
  console.log(`[2bulu ERROR] ${type}: ${error}`);
  $notification.post('⚠️ 运行异常', type, error.message);
  $done();
}

// 通知封装函数
function notifyError(title, subtitle='') {
  $notification.post(title, subtitle, '请检查插件配置');
}