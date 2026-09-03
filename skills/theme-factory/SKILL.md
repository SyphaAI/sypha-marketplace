---
name: theme-factory
description: >-
  Toolkit for applying a theme to artifacts such as slides, docs, reports, HTML
  landing pages, and more. Includes 10 pre-set themes with color palettes and
  font pairings that can be applied to any existing artifact, or a new theme can
  be generated on-the-fly.
metadata:
  category: creative-media
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: theme-factory
    license_path: theme-factory/LICENSE.txt
    commit: 92568c1edaff1bde5371154f036d959346c145a8
---


# Theme Factory Skill

This skill offers a curated collection of professional font and color themes, each featuring a carefully chosen color palette and complementary font pairings. Once a theme is selected, it can be applied to any artifact.

## Purpose

Use this skill to apply consistent, professional styling to presentation slide decks and other artifacts. Every theme includes:
- A cohesive color palette with hex codes
- Complementary font pairings for headers and body text
- A distinct visual identity suited to different contexts and audiences

## Usage Instructions

To style a slide deck or other artifact:

1. **Show the theme showcase**: Present the `theme-showcase.pdf` file so users can preview all available themes visually. Do not make any modifications to it; display it as-is for viewing only.
2. **Ask for their choice**: Prompt the user to select which theme to apply to the artifact
3. **Wait for selection**: Obtain explicit confirmation of the chosen theme
4. **Apply the theme**: After a theme is confirmed, apply its colors and fonts consistently throughout the deck/artifact

## Themes Available

The following 10 themes are available, each showcased in `theme-showcase.pdf`:

1. **Ocean Depths** - Professional and calming maritime theme
2. **Sunset Boulevard** - Warm and vibrant sunset colors
3. **Forest Canopy** - Natural and grounded earth tones
4. **Modern Minimalist** - Clean and contemporary grayscale
5. **Golden Hour** - Rich and warm autumnal palette
6. **Arctic Frost** - Cool and crisp winter-inspired theme
7. **Desert Rose** - Soft and sophisticated dusty tones
8. **Tech Innovation** - Bold and modern tech aesthetic
9. **Botanical Garden** - Fresh and organic garden colors
10. **Midnight Galaxy** - Dramatic and cosmic deep tones

## Theme Details

Each theme is defined in the `themes/` directory with full specifications that include:
- A cohesive color palette with hex codes
- Complementary font pairings for headers and body text
- A distinct visual identity suited to different contexts and audiences

## Application Process

Once the user has selected a theme:
1. Read the corresponding theme file from the `themes/` directory
2. Apply the specified colors and fonts consistently across the entire deck
3. Verify adequate contrast and readability throughout
4. Preserve the theme's visual identity on every slide

## Create your Own Theme
When none of the existing themes suit a particular artifact, create a custom theme. Using the inputs provided, generate a new theme that follows the same format as the existing ones. Assign it a descriptive name that reflects what the font and color combination conveys. Use any basic description supplied to guide color and font selection. Present the theme for review and confirmation before applying it as described above.
