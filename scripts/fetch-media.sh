#!/usr/bin/env bash
# Download the exercise images (JPG) and animations (GIF) into ./media.
# Required prior to running `scripts/upload-media-to-appwrite.mjs` for self-hosted instances.
# Source: hasaneyldrm/exercises-dataset (CC).
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git clone --depth 1 https://github.com/hasaneyldrm/exercises-dataset "$tmp"
mkdir -p media/img media/gif
cp "$tmp"/images/*.jpg media/img/
cp "$tmp"/videos/*.gif media/gif/
echo "✓ $(ls media/img | wc -l) images, $(ls media/gif | wc -l) GIFs"
