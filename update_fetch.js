const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) walkDir(dirPath, callback);
    else callback(dirPath);
  });
}

walkDir('src/app', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace fetch('/api/...
    content = content.replace(/fetch\('(\/api\/[^']+)'/g, "fetch(\`${process.env.NEXT_PUBLIC_API_URL || ''}$1\`");
    
    // Replace fetch(`/api/...
    content = content.replace(/fetch\(`\/api\//g, "fetch(\`${process.env.NEXT_PUBLIC_API_URL || ''}/api/");
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated ' + filePath);
    }
  }
});
