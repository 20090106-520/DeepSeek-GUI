const fs = require('fs');
const path = require('path');
const gsapPath = path.join(__dirname, 'src', 'main', 'public', 'gsap.min.js');
const splashPath = path.join(__dirname, 'src', 'main', 'public', 'splash.html');
const gsap = fs.readFileSync(gsapPath, 'utf8');
let splash = fs.readFileSync(splashPath, 'utf8');
const oldTag = '<script src="gsap.min.js"></script>';
const idx = splash.indexOf(oldTag);
console.log('Tag found at index:', idx);
if (idx >= 0) {
  splash = splash.replace(oldTag, '<script>\n' + gsap + '\n</script>');
  fs.writeFileSync(splashPath, splash);
  console.log('Replaced! New size:', splash.length, 'bytes');
} else {
  console.log('Tag not found!');
}