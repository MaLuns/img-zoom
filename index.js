/**
 * @type import('chalk').default
 */
const chalk = require("chalk");
const fs = require("fs-extra");
const path = require("path");
const prompts = require("prompts");
const log4js = require("log4js");
const homeDir = require("os").homedir();
const desktopDir = `${homeDir}\\Desktop\\img_${Math.random().toString(36).slice(-6)}`;
const ImgZoom = require("./core/img-zoom");

let isCancel = false;
prompts(
  [
    {
      type: "text",
      name: "inputDir",
      message: "请输入需要压缩目录",
      validate: (value) => {
        try {
          fs.accessSync(value.trim(), fs.constants.F_OK);
          return true;
        } catch (err) {
          return `未找到目录 ${value}`;
        }
      },
    },
    {
      type: "text",
      name: "outPutDir",
      message: "请输入输出目录",
    },
    {
      type: "number",
      name: "quality",
      message: "请设置压缩质量",
    },
    {
      type: "text",
      name: "resize",
      message: "压缩尺寸宽度设置",
    },
    {
      type: "select",
      name: "clearOutPutDir",
      message: (prev, values) => `是否清空目录 <${values.outPutDir ? values.outPutDir : desktopDir}> ?`,
      initial: false,
      choices: [
        { title: "否", value: false },
        { title: "是", value: true },
      ],
    },
    {
      type: "select",
      name: "copyAllFile",
      message: "是否从源目录 Copy 所有文件",
      initial: false,
      choices: [
        { title: "否", value: false },
        { title: "是", value: true },
      ],
    },
  ],
  {
    onCancel() {
      isCancel = true;
      return false;
    },
  }
).then((res) => {
  if (isCancel) {
    console.log("\n🐟 bye！！！\n");
    return;
  }

  const imgZoom = new ImgZoom({
    quality: res.quality,
    inputDir: res.inputDir?.trim(),
    outPutDir: res?.outPutDir?.trim() || desktopDir,
    resize: res.resize?.trim(),
    clearOutPutDir: res.clearOutPutDir,
    copyAllFile: res.copyAllFile,
  });

  log4js.configure({
    appenders: {
      out: { type: "stdout" },
      info: { type: "file", filename: path.join(imgZoom.outPutDir, "img.log") },
    },
    categories: {
      default: { appenders: ["out"], level: "info" },
      info: { appenders: ["info"], level: "info" },
    },
  });

  const log4 = log4js.getLogger("info");

  console.log("\n扫描压缩开始\n");
  imgZoom.start().catch((err) => log4.error(chalk.red(`处理过程中出现错误: ${err.message}`)));
});
