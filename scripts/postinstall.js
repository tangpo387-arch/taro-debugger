/**
 * postinstall script
 * 移除 Monaco Editor loader.js 中無效的 sourceMappingURL 參考，
 * 避免瀏覽器 DevTools 產生 404 錯誤。
 * 參見: https://github.com/microsoft/monaco-editor/issues/1305
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs', 'loader.js'
);

if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const patched = content.replace(/\/\/# sourceMappingURL=.*\.map$/gm, '');
  fs.writeFileSync(filePath, patched, 'utf8');
  console.log('[postinstall] Stripped invalid sourceMappingURL from Monaco loader.js');
} else {
  console.log('[postinstall] Monaco loader.js not found, skipping.');
}
