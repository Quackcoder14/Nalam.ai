const fs = require('fs');
let f = fs.readFileSync('src/lib/i18n.tsx', 'utf-8');

f = f.replace(
  /(\s*)('dashboard\.consent': 'Consent',)/,
  "$1$2$1'rook.connectWatch': '🔗 Connect Watch',$1'rook.watchConnected': '✓ Watch Connected',$1'rook.connecting': 'Connecting...',$1'rook.disconnect': 'Disconnect',$1'rook.selectDevice': 'Select your device:',$1'rook.cancel': 'Cancel',"
);

f = f.replace(
  /(\s*)('dashboard\.consent': 'ஒப்புதல்',)/,
  "$1$2$1'rook.connectWatch': '🔗 கடிகாரத்தை இணைக்க',$1'rook.watchConnected': '✓ கடிகாரம் இணைக்கப்பட்டது',$1'rook.connecting': 'இணைக்கிறது...',$1'rook.disconnect': 'இணைப்பை துண்டிக்க',$1'rook.selectDevice': 'உங்கள் சாதனத்தை தேர்ந்தெடுக்கவும்:',$1'rook.cancel': 'ரத்து செய்',"
);

fs.writeFileSync('src/lib/i18n.tsx', f);
console.log('Translations updated.');
