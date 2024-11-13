/**
 * @type import('chalk').default
 */
const chalk = require("chalk");
const fs = require("fs-extra");
const path = require("path");
const prompts = require("prompts");
const log4js = require("log4js");
const ImgZoom = require("./core/img-zoom");
const { slash, canCreatePath } = require("./utils");

let isCancel = false;
let type = 0;
let logpath;
prompts(
  [
    {
      type: "text",
      name: "inputDir",
      message: "请输入需要压缩目录",
      initial: slash(process.cwd()),
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
      initial(prev, val, prompt) {
        const stat = fs.statSync(val.inputDir);
        if (stat.isDirectory()) {
          type = 1;
          const outPutDir = canCreatePath(val.inputDir);
          logpath = path.join(outPutDir, "img.log");
          return outPutDir;
        } else if (stat.isFile()) {
          type = 0;
          const extname = path.extname(val.inputDir);
          logpath = path.join(val.inputDir.replace(new RegExp(`${extname}$`), ".log"));
          return val.inputDir.replace(new RegExp(`${extname}$`), `_${Math.random().toString(36).slice(-6)}${extname}`);
        }
        throw new Error("无效目录，请检查需要压缩目录的路径是否正确");
      }
    },
    {
      type: "number",
      name: "quality",
      message: "请设置压缩质量",
      min: 0,
      max: 100,
      initial: 80
    },
    {
      type: "text",
      name: "resize",
      message: "压缩尺寸宽度设置",
    },
    {
      type: "select",
      name: "clearOutPutDir",
      message: (prev, values) => `是否清空输出目录 <${values.outPutDir}> ?`,
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
    {
      type: "number",
      name: "maxSize",
      min: 0.1,
      message: "压缩后超过尺寸提示 (单位 mb)",
      initial: 2
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
    inputDir: res.inputDir?.trim(),
    outPutDir: res?.outPutDir?.trim(),
    quality: res.quality,
    resize: res.resize?.trim(),
    clearOutPutDir: res.clearOutPutDir,
    copyAllFile: res.copyAllFile,
    maxSize: (res.maxSize ?? 1) * 1024 * 1024
  });

  log4js.configure({
    appenders: {
      out: { type: "stdout" },
      info: { type: "file", filename: logpath },
    },
    categories: {
      default: { appenders: ["out"], level: "info" },
      info: { appenders: ["info"], level: "info" },
    },
  });

  const log4 = log4js.getLogger("info");

  console.log("\n扫描压缩开始\n");
  imgZoom.start().catch((err) => {
    console.log(err);
    log4.error(chalk.red(`处理过程中出现错误: ${err.message}`));
  });
});
