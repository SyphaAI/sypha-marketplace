---
name: image-enhancer
description: >-
  Upgrades image quality — especially screenshots — by boosting resolution,
  sharpness, and visual clarity. Ideal for preparing images for
  presentations, documentation, or social media posts.
metadata:
  category: creative-media
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: image-enhancer
    commit: 92568c1edaff1bde5371154f036d959346c145a8
license: NOASSERTION
---

# Image Enhancer

This skill processes your images and screenshots to produce sharper, clearer, and more polished results.

## When to Use This Skill

- Raising screenshot quality for blog posts or documentation
- Improving images before posting on social media
- Getting images ready for presentations or reports
- Upscaling low-resolution images
- Sharpening blurry photos
- Removing artifacts from compressed images

## What This Skill Does

1. **Analyzes Image Quality**: Evaluates resolution, sharpness, and compression artifacts
2. **Enhances Resolution**: Upscales images using intelligent processing
3. **Improves Sharpness**: Brings out edges and fine details
4. **Reduces Artifacts**: Removes compression artifacts and visual noise
5. **Optimizes for Use Case**: Tailors output based on the intended destination (web, print, social media)

## How to Use

### Basic Enhancement

```
Improve the image quality of screenshot.png
```

```
Enhance all images in this folder
```

### Specific Improvements

```
Upscale this image to 4K resolution
```

```
Sharpen this blurry screenshot
```

```
Reduce compression artifacts in this image
```

### Batch Processing

```
Improve the quality of all PNG files in this directory
```

## Example

**User**: "Improve the image quality of screenshot-2024.png"

**Output**:
```
Analyzing screenshot-2024.png...

Current specs:
- Resolution: 1920x1080
- Format: PNG
- Quality: Good, but slight blur

Enhancements applied:
✓ Upscaled to 2560x1440 (retina)
✓ Sharpened edges
✓ Enhanced text clarity
✓ Optimized file size

Saved as: screenshot-2024-enhanced.png
Original preserved as: screenshot-2024-original.png
```

**Inspired by:** Lenny Rachitsky's workflow from his newsletter - used for screenshots in his articles

## Tips

- Original files are always preserved as a backup
- Performs best on screenshots and digitally created images
- Supports batch processing across entire folders
- Specify an output format when needed (PNG for highest quality, JPG for smaller file size)
- When targeting social media, name the platform so sizing can be optimized accordingly

## Common Use Cases

- **Blog Posts**: Polish screenshots before they go live
- **Documentation**: Produce crisp, legible UI screenshots
- **Social Media**: Size and optimize images for Twitter, LinkedIn, Instagram
- **Presentations**: Upscale images to look sharp on large displays
- **Print Materials**: Boost resolution for use in physical media
