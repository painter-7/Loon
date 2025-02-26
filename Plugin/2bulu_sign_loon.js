/*
[Script]
# Cookie 捕获规则
http-request ^https:\/\/user\.2bulu\.com\/login\/login\.do script-path=https://example.com/2bulu_sign_loon.js,requires-body=true,timeout=10,tag=两步路Cookie获取

# 定时签到任务（每日7点、12点、18点执行）
cron "0 7,12,18 * * *" script-path=https://example.com/2bulu_sign_loon.js,timeout=120,tag=两步路签到

[MITM]
hostname = user.2bulu.com, api.2bulu.com
*/

// ====================
// 核心配置区域
// ====================
const CONFIG = {
  STORAGE_KEY: "twostep_data",    // 持久化存储键名
  ACCOUNT_SPLITOR: "\n",         // 多账号分隔符（换行符）
  NOTIFY_ENABLED: true,          // 是否启用通知
  API_HOST: "https://api.2bulu.com",
  USER_AGENT: "2bulu/4.4.4 (iPhone; iOS 15.4; Scale/3.00)"
};

// ====================
// 工具函数区域
// ====================
// 生成随机延迟（1~3秒）
const randomDelay = () => Math.floor(Math.random() * 2000) + 1000;

// 格式化时间戳
const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}小时${m}分钟`;
};

// ====================
// 用户类封装
// ====================
class TwoStepUser {
  constructor(account, password) {
    this.account = account;
    this.password = password;
    this.authToken = null;
  }

  // 统一请求方法
  async request(method, path, body = null, headers = {}) {
    const url = `${CONFIG.API_HOST}${path}`;
    await new Promise(resolve => setTimeout(resolve, randomDelay()));

    return new Promise((resolve) => {
      $httpClient[method.toLowerCase()]({
        url,
        headers: {
          'User-Agent': CONFIG.USER_AGENT,
          'Authorization': this.authToken ? `Bearer ${this.authToken}` : '',
          ...headers
        },
        body
      }, (error, response, data) => {
        if (error || !response) {
          CONFIG.NOTIFY_ENABLED && $notification.post('请求失败', url, error || '无响应');
          resolve(null);
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
  }

  // 登录获取 Token
  async login() {
    const result = await this.request('POST', '/v2/user/login', {
      account: this.account,
      password: this.password,
      loginType: 1
    });

    if (result?.code === 200) {
      this.authToken = result.data.token;
      return true;
    }
    return false;
  }

  // 执行签到
  async sign() {
    const result = await this.request('POST', '/v3/sign/sign', null, {
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    if (result?.code === 200) {
      return result.data.rewards[0];
    }
    return null;
  }
}

// ====================
// 主逻辑流程
// ====================
async function main() {
  // 读取存储数据
  const rawData = $persistentStore.read(CONFIG.STORAGE_KEY);
  if (!rawData) {
    $notification.post('配置错误', '', '请先通过登录接口捕获 Cookie');
    return $done();
  }

  // 初始化用户列表
  const users = rawData.split(CONFIG.ACCOUNT_SPLITOR)
    .filter(x => x.includes(':'))
    .map(x => {
      const [account, password] = x.split(':');
      return new TwoStepUser(account, password);
    });

  // 处理每个账号
  const notifyMessages = [];
  for (const user of users) {
    let log = `账号 ${user.account}：`;
    
    try {
      if (!await user.login()) {
        log += '❌ 登录失败';
        notifyMessages.push(log);
        continue;
      }

      const reward = await user.sign();
      if (reward) {
        log += `🎉 签到成功 ${reward.name}x${reward.amount}`;
      } else {
        log += '⛔ 签到失败';
      }
    } catch (e) {
      log += `⚠️ 异常: ${e.message}`;
    }
    
    notifyMessages.push(log);
  }

  // 发送聚合通知
  if (CONFIG.NOTIFY_ENABLED && notifyMessages.length > 0) {
    $notification.post('两步路签到结果', '', notifyMessages.join('\n'));
  }
  $done();
}

// ====================
// 执行入口判断
// ====================
if (typeof $request !== 'undefined') {
  // Cookie 捕获逻辑
  const isLoginRequest = $request.url.includes('/login');
  const account = $request.body?.account?.trim();
  const password = $request.body?.password?.trim();

  if (isLoginRequest && account && password) {
    const existing = $persistentStore.read(CONFIG.STORAGE_KEY) || '';
    const newData = existing ? `${existing}\n${account}:${password}` : `${account}:${password}`;
    $persistentStore.write(newData);
    $notification.post('两步路账号已保存', account, '');
  }
  $done();
} else {
  main();
}
