#! /bin/bash
echo "✨ Copying shaders..."
mkdir -p ./public/shaders
cp -r ./src/shaders/*.vert ./public/shaders/
cp -r ./src/shaders/*.frag ./public/shaders/
echo "✅ Shaders copied!"