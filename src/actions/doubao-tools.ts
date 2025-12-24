/**
 * 豆包工具定义 - 将所有动作转换为豆包可调用的工具
 */

import { z } from "zod";
import type { ToolDefinition } from "../llm.ts";

// 工具定义数组
export const DOUBAO_TOOLS: ToolDefinition[] = [
  // 1. Launch - 启动应用
  {
    type: 'function',
    name: 'launch_app',
    description: '启动指定的应用。参数：app - 应用包名（如 "com.tencent.mm" 表示微信）',
    parameters: (() => {
      const schema = z.object({
        app: z.string().describe('应用包名，如 com.tencent.mm')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '启动应用的参数'
      return jsonSchema
    })()
  },

  // 2. Tap - 点击屏幕
  {
    type: 'function',
    name: 'tap_screen',
    description: '点击屏幕指定位置。坐标范围 0-1000，原点左上角。参数：x, y - 点击坐标',
    parameters: (() => {
      const schema = z.object({
        x: z.number().min(0).max(1000).describe('x坐标，范围 0-1000'),
        y: z.number().min(0).max(1000).describe('y坐标，范围 0-1000')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '点击屏幕的参数'
      return jsonSchema
    })()
  },

  // 3. Type - 输入文本
  {
    type: 'function',
    name: 'type_text',
    description: '在当前聚焦的输入框中输入文本。参数：text - 要输入的文本内容',
    parameters: (() => {
      const schema = z.object({
        text: z.string().describe('要输入的文本内容')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '输入文本的参数'
      return jsonSchema
    })()
  },

  // 4. Type_Name - 输入人名
  {
    type: 'function',
    name: 'type_name',
    description: '输入人名的操作，基本功能同 type_text。参数：text - 要输入的人名',
    parameters: (() => {
      const schema = z.object({
        text: z.string().describe('要输入的人名')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '输入人名的参数'
      return jsonSchema
    })()
  },

  // 5. Interact - 交互
  {
    type: 'function',
    name: 'interact',
    description: '当有多个满足条件的选项时而触发的交互操作，询问用户如何选择。无参数。',
    parameters: (() => {
      const schema = z.object({})
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '交互操作的参数（无参数）'
      return jsonSchema
    })()
  },

  // 6. Swipe - 滑动
  {
    type: 'function',
    name: 'swipe_screen',
    description: '从起始坐标滑动到结束坐标。参数：start_x, start_y - 起始坐标；end_x, end_y - 结束坐标。坐标范围 0-1000',
    parameters: (() => {
      const schema = z.object({
        start_x: z.number().min(0).max(1000).describe('起始点 x 坐标，范围 0-1000'),
        start_y: z.number().min(0).max(1000).describe('起始点 y 坐标，范围 0-1000'),
        end_x: z.number().min(0).max(1000).describe('结束点 x 坐标，范围 0-1000'),
        end_y: z.number().min(0).max(1000).describe('结束点 y 坐标，范围 0-1000'),
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '滑动屏幕的参数'
      return jsonSchema
    })()
  },

  // 7. Long_Press - 长按
  {
    type: 'function',
    name: 'long_press',
    description: '在屏幕指定位置长按。参数：x, y - 长按坐标。坐标范围 0-1000',
    parameters: (() => {
      const schema = z.object({
        x: z.number().min(0).max(1000).describe('x坐标，范围 0-1000'),
        y: z.number().min(0).max(1000).describe('y坐标，范围 0-1000')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '长按屏幕的参数'
      return jsonSchema
    })()
  },

  // 8. Double_Tap - 双击
  {
    type: 'function',
    name: 'double_tap',
    description: '在屏幕指定位置双击。参数：x, y - 双击坐标。坐标范围 0-1000',
    parameters: (() => {
      const schema = z.object({
        x: z.number().min(0).max(1000).describe('x坐标，范围 0-1000'),
        y: z.number().min(0).max(1000).describe('y坐标，范围 0-1000')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '双击屏幕的参数'
      return jsonSchema
    })()
  },

  // 9. Back - 返回
  {
    type: 'function',
    name: 'back',
    description: '导航返回到上一个屏幕或关闭当前对话框。相当于按下 Android 的返回按钮。无参数。',
    parameters: (() => {
      const schema = z.object({})
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '返回操作的参数（无参数）'
      return jsonSchema
    })()
  },

  // 10. Home - 主页
  {
    type: 'function',
    name: 'home',
    description: '回到系统桌面。相当于按下 Android 主屏幕按钮。无参数。',
    parameters: (() => {
      const schema = z.object({})
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '回到主页操作的参数（无参数）'
      return jsonSchema
    })()
  },

  // 11. Wait - 等待
  {
    type: 'function',
    name: 'wait',
    description: '等待页面加载。参数：duration - 等待的秒数（1-30秒）',
    parameters: (() => {
      const schema = z.object({
        duration: z.number().min(1).max(30).describe('等待的秒数，范围 1-30')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '等待操作的参数'
      return jsonSchema
    })()
  },

  // 12. Take_over - 接管
  {
    type: 'function',
    name: 'take_over',
    description: '表示在登录和验证阶段需要用户协助。参数：message - 接管提示信息',
    parameters: (() => {
      const schema = z.object({
        message: z.string().describe('接管提示信息')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '接管操作的参数'
      return jsonSchema
    })()
  },

  // 13. Note - 记录
  {
    type: 'function',
    name: 'note',
    description: '记录当前页面内容以便后续总结。参数：content - 记录的内容',
    parameters: (() => {
      const schema = z.object({
        content: z.string().describe('记录的内容')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '记录操作的参数'
      return jsonSchema
    })()
  },

  // 14. Call_API - 调用 API
  {
    type: 'function',
    name: 'call_api',
    description: '总结或评论当前页面或已记录的内容。参数：instruction - API 调用指令',
    parameters: (() => {
      const schema = z.object({
        instruction: z.string().describe('API 调用指令')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = 'API 调用操作的参数'
      return jsonSchema
    })()
  },

  // 15. Finish - 完成任务
  {
    type: 'function',
    name: 'finish',
    description: '完成任务。参数：message - 完成任务的信息',
    parameters: (() => {
      const schema = z.object({
        message: z.string().describe('完成任务的信息')
      })
      const jsonSchema = schema.toJSONSchema()
      jsonSchema.description = '完成任务操作的参数'
      return jsonSchema
    })()
  }
];
