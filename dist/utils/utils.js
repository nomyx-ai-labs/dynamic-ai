"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execPromise = void 0;
async function execPromise(cmd) {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}
exports.execPromise = execPromise;
//# sourceMappingURL=utils.js.map