const { copyFileSync, existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const candidates = [path.join(root, 'desktop-config.env'), path.join(root, '.env')];
const source = candidates.find(existsSync);
if (!source) {
  console.error('Crie desktop-config.env a partir de desktop-config.example.env antes de gerar o instalador.');
  process.exit(1);
}
const destinationDir = path.join(root, 'build-resources');
mkdirSync(destinationDir, { recursive: true });
copyFileSync(source, path.join(destinationDir, 'desktop-config.env'));
console.log('Configuração de distribuição preparada.');
