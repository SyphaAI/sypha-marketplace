---
name: youtube-downloader
description: >-
  Download YouTube videos with configurable quality and format options. Use this
  skill when the user asks to download, save, or grab YouTube videos. Supports
  various quality settings (best, 1080p, 720p, 480p, 360p), multiple formats
  (mp4, webm, mkv), and audio-only downloads as MP3.
metadata:
  category: creative-media
  source:
    repository: 'https://github.com/ComposioHQ/awesome-claude-skills'
    path: video-downloader
    commit: 92568c1edaff1bde5371154f036d959346c145a8
license: NOASSERTION
---

# YouTube Video Downloader

Download YouTube videos with complete control over quality and format settings.

## Quick Start

The most straightforward way to download a video:

```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

This retrieves the video at the best available quality as MP4 and saves it to `/mnt/user-data/outputs/`.

## Options

### Quality Settings

Use `-q` or `--quality` to set the desired video quality:

- `best` (default): Highest quality available
- `1080p`: Full HD
- `720p`: HD
- `480p`: Standard definition
- `360p`: Lower quality
- `worst`: Lowest quality available

Example:
```bash
python scripts/download_video.py "URL" -q 720p
```

### Format Options

Use `-f` or `--format` to choose the output format (video downloads only):

- `mp4` (default): Most compatible
- `webm`: Modern format
- `mkv`: Matroska container

Example:
```bash
python scripts/download_video.py "URL" -f webm
```

### Audio Only

Use `-a` or `--audio-only` to extract and save audio as MP3:

```bash
python scripts/download_video.py "URL" -a
```

### Custom Output Directory

Use `-o` or `--output` to write the file to a different directory:

```bash
python scripts/download_video.py "URL" -o /path/to/directory
```

## Complete Examples

1. Download video in 1080p as MP4:
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -q 1080p
```

2. Download audio only as MP3:
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -a
```

3. Download in 720p as WebM to custom directory:
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -q 720p -f webm -o /custom/path
```

## How It Works

The skill relies on `yt-dlp`, a reliable YouTube downloader that:
- Automatically installs itself when not already present
- Retrieves video metadata before starting the download
- Picks the best available streams that match your specified criteria
- Combines video and audio streams when necessary
- Handles a broad range of YouTube video formats

## Important Notes

- Downloads are saved to `/mnt/user-data/outputs/` by default
- The output filename is derived automatically from the video title
- Installation of yt-dlp is handled by the script without manual intervention
- Only individual videos are downloaded (playlists are skipped by default)
- Higher quality videos may require more time to download and consume more disk space
