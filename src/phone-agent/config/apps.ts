/**
 * App name to package name mapping for supported applications.
 */

export const APP_PACKAGES: Record<string, string> = {
  // Social & Messaging
  "微信": "com.tencent.mm",
  "QQ": "com.tencent.mobileqq",
  "微博": "com.sina.weibo",
  // E-commerce
  "淘宝": "com.taobao.taobao",
  "京东": "com.jingdong.app.mall",
  "拼多多": "com.xunmeng.pinduoduo",
  "淘宝闪购": "com.taobao.taobao",
  "京东秒送": "com.jingdong.app.mall",
  // Lifestyle & Social
  "小红书": "com.xingin.xhs",
  "豆瓣": "com.douban.frodo",
  "知乎": "com.zhihu.android",
  // Maps & Navigation
  "高德地图": "com.autonavi.minimap",
  "百度地图": "com.baidu.BaiduMap",
  // Food & Services
  "美团": "com.sankuai.meituan",
  "大众点评": "com.dianping.v1",
  "饿了么": "me.ele",
  "肯德基": "com.yek.android.kfc.activitys",
  // Travel
  "携程": "ctrip.android.view",
  "铁路12306": "com.MobileTicket",
  "12306": "com.MobileTicket",
  "去哪儿": "com.Qunar",
  "去哪儿旅行": "com.Qunar",
  "滴滴出行": "com.sdu.did.psnger",
  // Video & Entertainment
  "bilibili": "tv.danmaku.bili",
  "抖音": "com.ss.android.ugc.aweme",
  "快手": "com.smile.gifmaker",
  "腾讯视频": "com.tencent.qqlive",
  "爱奇艺": "com.qiyi.video",
  "优酷视频": "com.youku.phone",
  "芒果TV": "com.hunantv.imgo.activity",
  "红果短剧": "com.phoenix.read",
  // Music & Audio
  "网易云音乐": "com.netease.cloudmusic",
  "QQ音乐": "com.tencent.qqmusic",
  "汽水音乐": "com.luna.music",
  "喜马拉雅": "com.ximalaya.ting.android",
  // Reading
  "番茄小说": "com.dragon.read",
  "番茄免费小说": "com.dragon.read",
  "七猫免费小说": "com.kmxs.reader",
  // Finance
  "支付宝": "com.eg.android.AlipayGphone",
  "微信支付": "com.tencent.mm",
  "中国工商银行": "com.icbc",
  "招商银行": "com.cmbchina.ccb.pluto.cmbActivity",
  "中国建设银行": "com.ccb.zxing",
  // Shopping
  "天猫": "com.tmall.wireless",
  "唯品会": "com.ipeidai.vip",
  "云集": "com.yunji.moments",
  "网易严选": "com.netease.kaola",
  // Tools
  "百度网盘": "com.baidu.netdisk",
  "腾讯文档": "com.tencent.wedoc",
  "石墨文档": "com.shimo.folders",
  "WPS Office": "cn.wps.moffice_eng",
  // News
  "今日头条": "com.ss.android.article.top",
  "网易新闻": "com.netease.newsreader.activity",
  "腾讯新闻": "com.tencent.news",
  "新浪新闻": "com.sina.news",
  // Health & Sports
  "Keep": "com.gotokeep.keep",
  "薄荷健康": "com.maikebaba.mohe",
  "咕咚": "com.codoon.gps",
  "FitTime": "com.zhengtu.sport",
  // Photography
  "美图秀秀": "com.mt.mtxx.mtxx",
  "轻颜相机": "com.ss.android.ugc.aweme.lite",
  "B612": "com.linecorp.b612",
  "醒图": "com.ss.android.ugc.aweme",
  // Education
  "作业帮": "com.xiaoman.cn",
  "猿辅导": "com.fenbi.android.sat",
  "学而思": "com.xueersi.parentsmeeting",
  "有道词典": "com.youdao.dict",
  "扇贝单词": "com.shanbay.dict",
  // Office
  "钉钉": "com.lark",
  "企业微信": "com.tencent.wework",
  "飞书": "com.ss.android.lark",
  "Slack": "com.tinyspeck.slackmdm",
  // Others
  "QQ浏览器": "com.tencent.mtt",
  "UC浏览器": "com.UCMobile",
  "Chrome": "com.android.chrome",
  "QQ邮箱": "com.tencent.wemeet.mail",
  "网易邮箱": "com.netease.mail",
  "Gmail": "com.google.android.gm",
};

export function listSupportedApps(): string[] {
  return Object.keys(APP_PACKAGES);
}

export function getAppPackage(appName: string): string | undefined {
  return APP_PACKAGES[appName];
}
