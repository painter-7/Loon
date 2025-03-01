# 两步路助手全能插件 v2.1
# 功能：自动Cookie捕获 + 定时签到 + 凭证维护
# 更新时间：2024-02-20

[Script]
# 自动捕获Cookie
http-request ^https?:\/\/www\.2bulu\.com\/user\/sign_in\.htm script-path=
https://raw.githubusercontent.com/painter-7/Loon/main/Plugin/2bulu_sign_loon.js,timeout=30,enable=true

# 每日定时签到
cron "5 9 * * *" script-path=https://raw.githubusercontent.com/painter-7/Loon/main/Plugin/2bulu_sign_loon.js, timeout=30, enable=true

[MITM]
hostname = www.2bulu.com

[Script Code]
// 两步路核心逻辑代码
const $ = new API("2bulu");
const CONFIG = {
  HOST: "www.2bulu.com",
  KEY: "两步路Cookie",
  SIGN_API: "/user/sign_in.htm"
};

if (typeof $request !== "undefined") {
  handleRequest($request);
} else {
  executeSign();
}

function handleRequest(req) {
  try {
    if (req.url.includes(CONFIG.SIGN_API)) {
      const cookie = req.headers?.Cookie || req.headers?.cookie;
      if (!cookie) return;
      
      const oldCookie = $.read(CONFIG.KEY);
      if (cookie !== oldCookie) {
        $.write(cookie, CONFIG.KEY);
        $.notify("🍪 凭证更新", "", "检测到新Cookie");
        verifyCookie(cookie);
      }
    }
  } catch (e) {
    $.log(`处理请求异常: ${e}`);
  }
  $done();
}

async function executeSign() {
  const cookie = $.read(CONFIG.KEY);
  if (!cookie) return $.notify("⚠️ 凭证缺失", "请手动签到一次");

  try {
    const resp = await $.post({
      url: `https://${CONFIG.HOST}${CONFIG.SIGN_API}`,
      headers: { Cookie: cookie }
    });
    parseResult(resp);
  } catch (e) {
    $.notify("🚨 签到失败", `错误: ${e}`);
  }
  $done();
}

function parseResult(resp) {
  let title = "", msg = "";
  switch (resp.status) {
    case 200:
      try {
        const data = JSON.parse(resp.body);
        title = data.result ? "✅ 签到成功" : "⏸️ 已签到";
        msg = data.result ? `累计签到 ${data.data} 天` : "今日无需重复";
      } catch (e) {
        msg = "响应解析失败";
      }
      break;
    case 401:
      msg = "Cookie已失效";
      $.write(null, CONFIG.KEY);
      break;
    default:
      msg = `HTTP ${resp.status} 错误`;
  }
  $.notify(title, msg);
}

function verifyCookie(cookie) {
  $.post({
    url: `https://${CONFIG.HOST}${CONFIG.SIGN_API}`,
    headers: { Cookie: cookie }
  }, (err, resp) => {
    if (err) return;
    let msg = resp.status === 200 ? "凭证验证通过" : "验证失败";
    $.log(`Cookie验证结果: ${msg}`);
  });
}

/***** Loon API Wrapper *****/
function API(name) {
  this.name = name;
  this.read = key => $persistentStore.read(key);
  this.write = (val, key) => $persistentStore.write(val, key);
  this.notify = (title, subtitle, content) => 
    $notification.post(title, subtitle, content);
  this.post = options => new Promise((resolve, reject) => {
    $httpClient.post(options, (err, resp, body) => 
      err ? reject(err) : resolve({status: resp.status, body}));
  });
}