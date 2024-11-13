const fs = require("fs-extra");

/**
 * 判断文件是否存在
 * @param {string} path 
 * @returns 
 */
const accessSync = (path) => {
    try {
        fs.accessSync(path, fs.constants.F_OK);
        return true;
    } catch (err) {
        return false;
    }
};

/**
 * 寻找可用文件
 * @param {string[]} paths 
 * @returns 
 */
const findPath = (paths) => paths.find(path => accessSync(path));

/**
 * 
 * @param {string} p 
 * @returns 
 */
const slash = (p) => p.replace(/\\/g, '/');

/**
 * 格式化字节大小
 * @param {number} bytes 
 * @returns 
 */
const formatSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const sizeUnits = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, index)).toFixed(2);
    return `${size} ${sizeUnits[index]}`;
};

/**
 * 生成一个新路径
 * @param {string} p 
 * @returns 
 */
const canCreatePath = (p) => {
    const np = slash(`${p}_${Math.random().toString(36).slice(-6)}`);
    if (accessSync(np)) {
        return canCreatePath(p);
    } else {
        return np;
    }
};

module.exports = {
    accessSync,
    findPath,
    formatSize,
    slash,
    canCreatePath
};