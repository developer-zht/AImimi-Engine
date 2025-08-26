#! /bin/bash
echo "✨ Copying shaders..."
mkdir -p ./public/shaders
cp -r ./src/shaders/*.glsl ./public/shaders/
echo "✅ Shaders copied!"