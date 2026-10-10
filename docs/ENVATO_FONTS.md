# Envato web fonts for rizwan3d.xyz

This **public Git repository contains font configuration only**, not the licensed binaries. Fonts must be obtained from your own licensed Envato Elements downloads and installed separately. Web-font embedding is allowed by the Envato Elements license for web-enabled fonts, subject to its restrictions. Do not redistribute the font ZIPs or standalone font files via GitHub.

- **Code and syntax highlighting:** AOT Serial Mono (Envato: https://elements.envato.com/aot-serial-mono-modern-and-clean-monospace-font-XPSLKZ4)
- **All other site typography:** GC Tenwork (Envato: https://elements.envato.com/tenwork-modern-tech-sans-NUMMUKD)

## Required paths on the deployed site

The CSS looks for these exact files at the site's `/assets/fonts/` URL. Copy **only WOFF and WOFF2** from the downloaded ZIPs:

| Source in your ZIP | Destination relative to the website root |
| --- | --- |
| `GC Tenwork/WOFF/GC Tenwork.woff2` | `assets/fonts/tenwork/GC-Tenwork.woff2` |
| `GC Tenwork/WOFF/GC Tenwork.woff` | `assets/fonts/tenwork/GC-Tenwork.woff` |
| `Web-TT/AOTSerialMono-Light.woff2` and `.woff` | `assets/fonts/aot-serial-mono/AOTSerialMono-Light.woff2` and `.woff` |
| `Web-TT/AOTSerialMono-Regular.woff2` and `.woff` | `assets/fonts/aot-serial-mono/AOTSerialMono-Regular.woff2` and `.woff` |
| `Web-TT/AOTSerialMono-Medium.woff2` and `.woff` | `assets/fonts/aot-serial-mono/AOTSerialMono-Medium.woff2` and `.woff` |
| `Web-TT/AOTSerialMono-SemiBold.woff2` and `.woff` | `assets/fonts/aot-serial-mono/AOTSerialMono-SemiBold.woff2` and `.woff` |
| `Web-TT/AOTSerialMono-Bold.woff2` and `.woff` | `assets/fonts/aot-serial-mono/AOTSerialMono-Bold.woff2` and `.woff` |

The GC Tenwork ZIP contains **only Regular (400)**, so browsers may synthesize heavier weights for headings. AOT Serial Mono has real 300, 400, 500, 600, and 700 files.

## Namecheap production deployment

The GitHub Actions workflow deploys `dist/` to `/home/growmtdy/rizwan3d.xyz/` by SCP. Upload the font files using your hosting account's file manager, SFTP, or SSH to the following directories:

- `/home/growmtdy/rizwan3d.xyz/assets/fonts/tenwork/`
- `/home/growmtdy/rizwan3d.xyz/assets/fonts/aot-serial-mono/`

**Do not add the binaries to Git.** The existing `scp -r ./dist/.` deployment copies files without deleting additional files in the remote directory, so subsequent pushes should leave manually uploaded fonts in place.

For local development only, you can place the files under `src/assets/fonts/` with the same subdirectories; that path is ignored by Git, and `npm run build` will copy local files to `dist/assets/fonts/`.

## Verify

1. Open a page and a blog post with a code block.
2. In browser DevTools > Network, filter for `woff`: all font requests should return HTTP 200, not 404.
3. In DevTools > Computed/Fonts, verify **GC Tenwork** on body/headings and **AOT Serial Mono** on code blocks.
4. Until the font files exist on the host, the browser uses the previous system font fallbacks.

**Licensing:** The ZIPs contained no separate license documentation; refer to your subscription license and any usage restrictions on the Envato font item pages. Webfonts are naturally downloadable by browsers as part of rendering; do not provide standalone download links or otherwise facilitate extraction or redistribution.
