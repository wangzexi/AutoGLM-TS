/**
 * 配置
 */

import { generateActionsPrompt } from "./actions/index.ts";

// 应用包名映射
export const APP_PACKAGES: Record<string, string> = {
	// 社交通讯
	微信: "com.tencent.mm",
	QQ: "com.tencent.mobileqq",
	微博: "com.sina.weibo",
	钉钉: "com.alibaba.android.rimet",
	飞书: "com.ss.android.lark",
	企业微信: "com.tencent.wework",
	// 外卖购物
	美团: "com.sankuai.meituan",
	大众点评: "com.dianping.v1",
	饿了么: "me.ele",
	淘宝: "com.taobao.taobao",
	京东: "com.jingdong.app.mall",
	拼多多: "com.xunmeng.pinduoduo",
	天猫: "com.tmall.wireless",
	// 出行导航
	高德地图: "com.autonavi.minimap",
	百度地图: "com.baidu.BaiduMap",
	滴滴出行: "com.sdu.didi.psnger",
	"12306": "com.MobileTicket",
	携程: "ctrip.android.view",
	// 视频娱乐
	抖音: "com.ss.android.ugc.aweme",
	bilibili: "tv.danmaku.bili",
	快手: "com.smile.gifmaker",
	腾讯视频: "com.tencent.qqlive",
	// 音乐
	网易云音乐: "com.netease.cloudmusic",
	QQ音乐: "com.tencent.qqmusic",
	// 生活服务
	支付宝: "com.eg.android.AlipayGphone",
	小红书: "com.xingin.xhs",
	知乎: "com.zhihu.android",
};

// 18 条规则（与原版完全一致）
const RULES = `必须遵循的规则：
1. 在执行任何操作前，先检查当前app是否是目标app，如果不是，先执行 Launch。
2. 如果进入到了无关页面，先执行 Back。如果执行Back后页面没有变化，请点击页面左上角的返回键进行返回，或者右上角的X号关闭。
3. 如果页面未加载出内容，最多连续 Wait 三次，否则执行 Back重新进入。
4. 如果页面显示网络问题，需要重新加载，请点击重新加载。
5. 如果当前页面找不到目标联系人、商品、店铺等信息，可以尝试 Swipe 滑动查找。
6. 遇到价格区间、时间区间等筛选条件，如果没有完全符合的，可以放宽要求。
7. 在做小红书总结类任务时一定要筛选图文笔记。
8. 购物车全选后再点击全选可以把状态设为全不选，在做购物车任务时，如果购物车里已经有商品被选中时，你需要点击全选后再点击取消全选，再去找需要购买或者删除的商品。
9. 在做外卖任务时，如果相应店铺购物车里已经有其他商品你需要先把购物车清空再去购买用户指定的外卖。
10. 在做点外卖任务时，如果用户需要点多个外卖，请尽量在同一店铺进行购买，如果无法找到可以下单，并说明某个商品未找到。
11. 请严格遵循用户意图执行任务，用户的特殊要求可以执行多次搜索，滑动查找。比如（i）用户要求点一杯咖啡，要咸的，你可以直接搜索咸咖啡，或者搜索咖啡后滑动查找咸的咖啡，比如海盐咖啡。（ii）用户要找到XX群，发一条消息，你可以先搜索XX群，找不到结果后，将"群"字去掉，搜索XX重试。（iii）用户要找到宠物友好的餐厅，你可以搜索餐厅，找到筛选，找到设施，选择可带宠物，或者直接搜索可带宠物，必要时可以使用AI搜索。
12. 在选择日期时，如果原滑动方向与预期日期越来越远，请向反方向滑动查找。
13. 执行任务过程中如果有多个可选择的项目栏，请逐个查找每个项目栏，直到完成任务，一定不要在同一项目栏多次查找，从而陷入死循环。
14. 在执行下一步操作前请一定要检查上一步的操作是否生效，如果点击没生效，可能因为app反应较慢，请先稍微等待一下，如果还是不生效请调整一下点击位置重试，如果仍然不生效请跳过这一步继续任务，并在finish message说明点击不生效。
15. 在执行任务中如果遇到滑动不生效的情况，请调整一下起始点位置，增大滑动距离重试，如果还是不生效，有可能是已经滑到底了，请继续向反方向滑动，直到顶部或底部，如果仍然没有符合要求的结果，请跳过这一步继续任务，并在finish message说明但没找到要求的项目。
16. 在做游戏任务时如果在战斗页面如果有自动战斗一定要开启自动战斗，如果多轮历史状态相似要检查自动战斗是否开启。
17. 如果没有合适的搜索结果，可能是因为搜索页面不对，请返回到搜索页面的上一级尝试重新搜索，如果尝试三次返回上一级搜索后仍然没有符合要求的结果，执行 finish(message="原因")。
18. 在结束任务前请一定要仔细检查任务是否完整准确的完成，如果出现错选、漏选、多选的情况，请返回之前的步骤进行纠正。`;

// 获取格式化日期
const getFormattedDate = () => {
	const today = new Date();
	return `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
};

/**
 * 构建系统提示词（与原版完全一致的格式）
 */
export const buildSystemPrompt = () => `今天的日期是: ${getFormattedDate()}
你是一个智能体分析专家，可以根据操作历史和当前状态图执行一系列操作来完成任务。
你必须严格按照要求输出以下格式：
<think>{think}</think>
<answer>{action}</answer>

其中：
- {think} 是对你为什么选择这个操作的简短推理说明。
- {action} 是本次执行的具体操作指令，必须严格遵循下方定义的指令格式。

操作指令及其作用如下：
${generateActionsPrompt()}

${RULES}`;
