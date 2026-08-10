# X Reels ++ Enhanced

Turns your X (Twitter) timeline into a TikTok-style, full-screen media player.

The script collects the videos, GIFs and images in your feed and plays them in a cinema-mode
overlay — no replies, no ads, no sidebar trends. Just the media, one item at a time.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open [`XReelsPlusPlus.user.js`](XReelsPlusPlus.user.js) and click **Raw** — your manager will offer to install it.
3. Open [x.com](https://x.com) and press **X** to start.

Or install from [Greasy Fork](https://greasyfork.org/en/scripts/539679-x-reels-enhanced).

## Features

- **Full-screen cinema mode** — tweet media on a dark background, at full quality.
- **Smart auto-scroll** — videos play to the end before advancing; images hold for ~3s.
  Fixed timers (5s, 10s, …) are still there if you prefer them.
- **Follow without losing your place** — press **F** and the script navigates to the author,
  follows, and returns you to exactly where you were in the feed.
- **Real player controls** — custom seek bar, playback speed (0.25x–2x), volume slider.
- **Fit modes and zoom** — contain/cover fitting with working pan.

## Controls

### Navigation
| | |
|---|---|
| **↑ / ↓** | Previous / next tweet with media |
| **← / →** | Cycle a tweet's gallery |

### Actions
| | |
|---|---|
| **L** | Like / unlike |
| **F** | Follow author, then return to the feed |

### Playback
| | |
|---|---|
| **Space** | Play / pause |
| **,** or **<** | Back 5s |
| **.** or **>** | Forward 5s |
| **Double-click** | Mute / unmute |

### General
| | |
|---|---|
| **X** | Toggle X Reels on / off |
| **Q** | Exit |

Floating on-screen buttons cover like, follow and navigation, and a dropdown picks the
auto-scroll mode.

## Applies to

`x.com`, `twitter.com`

## License

MIT — see [LICENSE](LICENSE).
