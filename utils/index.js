const fs = require("fs-extra")

const accessSync = (path) => {
    try {
        fs.accessSync(path, fs.constants.F_OK)
        return true
    } catch (err) {
        return false
    }
}

const findPath = (paths) => {
    return paths.find(path => accessSync(path))
}

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
}


module.exports = {
    accessSync,
    findPath,
    formatSize
};