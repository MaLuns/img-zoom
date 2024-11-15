const chalk = require("chalk");
const sharp = require("sharp");
const fs = require("fs-extra");
const path = require("path");
const log4js = require("log4js");
const { formatSize, slash } = require("../utils");
const log4 = log4js.getLogger('info');

const IMG_REG = /\.(png|jpg|jpeg|svg|bmp|webp)$/;

class ImgZoom {
    /** 图片质量 */
    quality = 90;
    /** 输入目录 */
    inputDir = '';
    /** 输出目录 */
    outPutDir = '';
    /** 清理输出目录 */
    clearOutPutDir = false;
    /** 复制目录中文件 */
    copyAllFile = false;
    /** 压缩尺寸调整 */
    resize = { w: undefined, h: undefined };
    /** 处理结果 */
    result = { success: 0, error: 0, copy: 0 };
    /** 失败图片信息 */
    zipErrImgs = [];
    /** 提醒阈值 */
    maxSize = 1024 * 1024;
    /** 原始大小 */
    oldSize = 0;
    /** 压缩后大小 */
    newSize = 0;
    /** 压缩类型 0 文件 1 文件夹 */
    type = 0;

    constructor({ quality, inputDir, outPutDir, clearOutPutDir = false, copyAllFile = false, resize = '', maxSize = 1024 * 1024 }) {
        const [w, h] = [...resize.matchAll(/[0-9]+/g)].map(item => Number(item[0]));
        this.quality = quality || this.quality;
        this.inputDir = slash(inputDir || this.inputDir);
        this.outPutDir = slash(outPutDir || this.outPutDir);
        this.clearOutPutDir = Boolean(clearOutPutDir);
        this.copyAllFile = Boolean(copyAllFile);
        this.resize.w = w || this.resize.w;
        this.resize.h = h || this.resize.h;
        this.maxSize = maxSize;
    }

    async start() {
        const { inputDir, outPutDir, clearOutPutDir, result, zipErrImgs } = this;
        const start = process.hrtime.bigint();
        const stat = fs.statSync(inputDir);

        console.log(chalk.bgHex('#384399')(' 源目录 '), inputDir);
        console.log(chalk.bgHex('#384399')(' 新目录 '), outPutDir, '\n');
        log4.info('源目录', inputDir);
        log4.info('新目录', outPutDir);

        if (stat.isDirectory()) {
            this.type = 1;
            clearOutPutDir && fs.emptyDirSync(outPutDir);
            await this.traversalFolder(inputDir, inputDir, outPutDir);
        } else if (stat.isFile() && IMG_REG.test(inputDir)) {
            this.type = 0;
            await this.image(inputDir, inputDir.replace(/\/[^\/]*$/, ''), outPutDir, stat);
        } else {
            log4.error('文件信息获取失败');
            return;
        }

        const end = process.hrtime.bigint();
        console.log(`\n原大小 ${chalk.yellow(formatSize(this.oldSize))}`, `压缩后 ${chalk.green(formatSize(this.newSize))}`);
        console.log('成功', chalk.green(`(${result.success})`), '失败', chalk.red(`(${result.error})`), this.copyAllFile ? `复制 (${chalk.green(result.copy)})` : '');
        console.log(`处理耗时 ${chalk.green(BigInt(end - start) / 1000n / 1000n / 1000n)} s`, '\n');

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
        return Promise.all(
            fs.readdirSync(dir).map(async (file) => {
                const filePath = slash(path.join(dir, file));
                const stat = fs.statSync(filePath);
                if (stat.isDirectory()) {
                    return this.traversalFolder(filePath, input, output);
                } else if (stat.isFile() && IMG_REG.test(file)) {
                    return this.image(filePath, input, output, stat);
                } else if (stat.isFile() && this.copyAllFile) {
                    const relativePath = filePath.replace(input, ''); // 文件相对路径
                    const outPutPath = path.join(output, relativePath); // 输出路径
                    this.copyFile(filePath, outPutPath);
                }
            })
        );

        // const files = fs.readdirSync(dir);
        // for (const file of files) {
        //     const filePath = path.join(dir, file);
        //     const stat = fs.statSync(filePath);
        //     if (stat.isDirectory()) {
        //         await this.traversalFolder(filePath, input, output);
        //     } else if (stat.isFile() && IMG_REG.test(file)) {
        //         await this.image(filePath, input, output, stat);
        //     } else if (stat.isFile() && this.copyAllFile) {
        //         const relativePath = filePath.replace(input, ''); // 文件相对路径
        //         const outPutPath = path.join(output, relativePath); // 输出路径
        //         this.copyFile(filePath, outPutPath);
        //     }
        // }
    }

    /**
     * 文件复制
     * @param {string} filePath 
     * @param {string} outPutPath 
     */
    copyFile(filePath, outPutPath) {
        fs.copySync(filePath, outPutPath);
        this.result.copy++;
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
        if (this.type === 1) {
            output = slash(path.join(output, relativePath)); // 输出路径
            const outPutDirPath = output.replace(/\/[^\/]*$/, '\/'); // 输出路径上一级目录
            fs.ensureDirSync(outPutDirPath);
        }

        await this.compress(imgpath, output).then(path => {
            const val = fs.statSync(path);
            this.printInfo(val.size, stat.size, relativePath);
        });
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
                const img = sharp(input);
                const meta = await img.metadata();
                img
                    .resize({ width: this.resize.w, height: this.resize.h })
                    .toFormat(meta.format, { quality: this.quality })
                    .toFile(output)
                    .then(() => {
                        resolve(output);
                        this.result.success++;
                    });
            } catch (error) {
                reject();
                this.result.error++;
                this.zipErrImgs.push(input);
                log4.error(input, error);
            }
        });
    }

    /**
     * 打印压缩信息
     * @param {*} newSize 新大小
     * @param {*} oldSize 原大小
     * @param {*} relativePath 路径信息
     */
    printInfo(newSize, oldSize, relativePath) {
        const size = formatSize(newSize);
        this.oldSize += oldSize;
        this.newSize += newSize;
        log4.info(`[${relativePath}]`, formatSize(oldSize), '=>', size);
        console.log(
            //
            chalk.bgHex('#384399')('  INFO  '),
            chalk.yellow(formatSize(oldSize)),
            '=>',
            newSize > this.maxSize ? chalk.red(size) : chalk.green(size),
            relativePath,
        );
    }
}

module.exports = ImgZoom;