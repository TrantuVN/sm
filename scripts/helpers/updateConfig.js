const fs = require('fs');
const path = require('path');

function updateConfig(variableName, contractAddress) {
    const configPath = path.join(__dirname, '../../addressConfig.js');
    let content = fs.readFileSync(configPath, 'utf8');
  
    const regex = new RegExp(`(const ${variableName} = ')(.*?)(';)`, 'g');
    const match = regex.test(content);
  
    if (match) {
      content = content.replace(regex, `$1${contractAddress}$3`);
      fs.writeFileSync(configPath, content, 'utf8');
      console.log(`${variableName} updated in addressConfig.js`);
    } else {
      console.log(`${variableName} not found in addressConfig.js.`);
    }
  }

module.exports = { updateConfig };