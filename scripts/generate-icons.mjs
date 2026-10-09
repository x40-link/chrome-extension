import fs from 'node:fs';
import sharp from 'sharp';

const source=fs.readFileSync('assets/icon.svg');
fs.mkdirSync('assets/icons',{recursive:true});
for(const size of [16,32,48,128]){
  await sharp(source).resize(size,size).png().toFile(`assets/icons/icon${size}.png`);
}
