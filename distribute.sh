unzip ai-sketch-transformer.zip 
git clone https://github.com/kstost/AISketchTransformer
mv AISketchTransformer/.git .
mv AISketchTransformer/vite.config.ts . 
mv AISketchTransformer/README.md . 
mv AISketchTransformer/distribute.sh . 
rm -rf AISketchTransformer ai-sketch-transformer.zip 
npm i
npm run build
git add .
git commit -m 'a'
git push
