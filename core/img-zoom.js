const chalk = require("chalk");
const sharp = require("sharp");
const fs = require("fs-extra");
const path = require("path");
const log4js = require("log4js");
const { formatSize } = require("../utils");
const log4 = log4js.getLogger('info');

const MAX_SIZE = 500 * 1024
const IMG_REG = /\.(png|jpg|jpeg|svg|bmp|webp)$/

class ImgZip {
    /** 图片质量 */
    quality = 90
    /** 输入目录 */
    inputDir = null
    /** 输出目录 */
    outPutDir = null
    /** 清理输出目录 */
    clearOutPutDir = false
    /** 复制目录中文件 */
    copyAllFile = false
    /** 处理结果 */
    result = {
        success: 0,
        error: 0,
        copy: 0
    }
    /** 失败图片信息 */
    zipErrImgs = []

    constructor({ quality, inputDir, outPutDir, clearOutPutDir, copyAllFile }) {
        this.quality = quality || this.quality
        this.inputDir = inputDir || this.inputDir
        this.outPutDir = outPutDir || this.outPutDir
        this.clearOutPutDir = Boolean(clearOutPutDir)
        this.copyAllFile = Boolean(copyAllFile)
    }

    async start() {
        const { inputDir, outPutDir, clearOutPutDir, result, zipErrImgs } = this
        const stat = fs.statSync(inputDir)
        console.log(chalk.bgHex('#384399')(' 源目录 '), inputDir);
        console.log(chalk.bgHex('#384399')(' 新目录 '), outPutDir, '\n');

        clearOutPutDir && fs.emptyDirSync(outPutDir)

        if (stat.isDirectory()) {
            await this.traversalFolder(inputDir, inputDir, outPutDir)
        } else if (stat.isFile() && IMG_REG.test(inputDir)) {
            await this.image(inputDir, inputDir.replace(/\\[^\\]*$/, ''), outPutDir, stat)
        } else {
            console.log('文件信息获取失败');
            return
        }

        console.log(`\n原大小 ${chalk.yellow(formatSize(this.oldSize))}`, `压缩后 ${chalk.green(formatSize(this.newSize))}`);
        console.log('成功', chalk.green(`(${result.success})`), '失败', chalk.red(`(${result.error})`), this.copyAllFile ? `复制 (${chalk.green(result.copy)})` : '', '\n');
        if (zipErrImgs.length) {
            console.log('\n失败图片文件');
            console.log(zipErrImgs.join('\n'));
        }
    }


    /**
     * 递归读取文件夹
     * @param {string} dir 需要遍历文件夹目录
     * @param {string} input 原始输入目录
     * @param {string} output 原始输出目录
     */
    async traversalFolder(dir, input, output) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                await this.traversalFolder(filePath, input, output)
            } else if (stat.isFile() && IMG_REG.test(file)) {
                await this.image(filePath, input, output, stat)
            } else if (stat.isFile() && this.copyAllFile) {
                const relativePath = filePath.replace(input, ''); // 文件相对路径
                const outPutPath = path.join(output, relativePath) // 输出路径
                this.copyFile(filePath, outPutPath)
            }
        }
    }

    /**
     * 文件复制
     * @param {string} filePath 
     * @param {string} outPutPath 
     */
    copyFile(filePath, outPutPath) {
        fs.copySync(filePath, outPutPath)
        this.result.copy++
    }

    /**
     * 图片处理
     * @param {string} imgpath 图片路径
     * @param {string} input 原始输入目录
     * @param {string} output 原始输出目录
     * @param {fs.Stats} stat 图片信息
     */
    async image(imgpath, input, output, stat) {
        const relativePath = imgpath.replace(input, ''); // 图片相对路径

        const outPutPath = path.join(output, relativePath) // 输出路径
        const outPutDirPath = outPutPath.replace(/\\[^\\]*$/, '\\') // 输出路径上一级目录

        fs.ensureDirSync(outPutDirPath)

        await this.compress(imgpath, outPutPath).then(path => {
            const val = fs.statSync(path)
            this.printInfo(val.size, stat.size, relativePath)
        })
    }


    /**
     * 图片压缩
     * @param {string} input 图片原路径
     * @param {string} output 图片输出路径
     * @returns 
     */
    async compress(input, output) {
        return new Promise(async (resolve, reject) => {
            try {
                const img = sharp(input)
                const meta = await img.metadata()
                // .resize({ width: 750 })
                img
                    .toFormat(meta.format, { quality: this.quality })
                    .toFile(output)
                    .then(() => {
                        resolve(output)
                        this.result.success++
                    })
            } catch (error) {
                reject()
                this.result.error++
                this.zipErrImgs.push(input)
            }
        })
    }

    oldSize = 0
    newSize = 0

    /**
     * 打印压缩信息
     * @param {*} newSize 新大小
     * @param {*} oldSize 原大小
     * @param {*} relativePath 路径信息
     */
    printInfo(newSize, oldSize, relativePath) {
        const size = formatSize(newSize)
        this.oldSize += oldSize
        this.newSize += newSize
        console.log(
            //
            chalk.bgHex('#384399')('  INFO  '),
            chalk.yellow(formatSize(oldSize)),
            '=>',
            newSize > MAX_SIZE ? chalk.red(size) : chalk.green(size),
            relativePath,
        );
    }
}

module.exports = ImgZip;