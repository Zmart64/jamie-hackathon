# Carbon Zero assessment recording

Source: `output/demo/real-run/demo-real-run-01`, captured October 24, 2026.
The attacker used `abliteration/abliterated-model-large-flash`; Sprout used
`claude-haiku-4-5`. Account state and email delivery use the support service’s
session-local fixtures and mock outbox. The model conversations and tool receipts
are pipeline output. The old scripted attack clips have been removed. The original
scripted mapping walkthrough is retained as the introductory preview.

`recording.webm` is the unchanged 1280×900 VP8 master (296.76 seconds).
The four preview clips crop 790×560 pixels at (490,330), then scale to 752×532.
Only framing and encoding change; no conversation content is replaced.

| Asset       | Source interval (seconds) | Poster at |
| ----------- | ------------------------- | --------- |
| system      | 12–36                     | 33        |
| reset       | 89–130                    | 94        |
| tool-result | 169–260                   | 198       |
| persistence | 265–296.76                | 284       |

To regenerate each clip with FFmpeg, use the corresponding START and DURATION:

```sh
ffmpeg -ss START -i recording.webm -t DURATION \
  -vf 'crop=790:560:490:330,scale=752:532' -c:v libvpx -b:v 400k -an ASSET.webm
ffmpeg -ss POSTER -i recording.webm \
  -vf 'crop=790:560:490:330,scale=752:532' -frames:v 1 ASSET.png
```

Each session plays its entire clip in 15 seconds using an accelerated browser
playback rate: S1 1.6×, S2 2.73×, S3 6.07×, and S4 2.12×. Preview and expanded
clip stay synchronized. The canvas finishes in 24.5 seconds, including one-second setup,
mapping, combined verification/outcome cards, and the final Create findings node.
Evidence times refer to the master recording, not the canvas clock. Expanded
previews show only the synchronized session clip; the master remains a source
asset. The last S4 restore receipt at 297.3 seconds
and reply at 299.0 seconds are in the session JSON, beyond the end of the video.

Canonical transcripts, final account state, timeline, message board and attacker
tool log are bundled in `src/features/agents/recording`. They preserve the initial
board inference error and the assistant’s inaccurate claims verbatim; curated
verification notes explain the discrepancy using the tool receipts and state.

`mapping.webm` (6.72 seconds) and `mapping.png` are restored unchanged from the
previous `public/demo/carbon-zero` assets, captured from `apps/demo` at e52b7d1.
That sample uses scripted support API responses. It plays over the five-second
mapping stage and is excluded from session evidence and findings.
