# Mascot branding and Android build

The existing approved mascot is the source of truth again. The intro puts GlitchRadar above the crossed-arms mascot in static radar rings. A single native-driven 350 ms glitch and a stylized eyelid overlay precede dismissal after 1.8 seconds. Reduced-motion preferences skip the animation. The eyelid placement is provisional until visually reviewed on an actual device; this is not a newly drawn or verified wink sprite.

The historic logo-mark.png filename remains for compatibility with the ticker and regression tests, but the build generator replaces its artwork with crossed.webp. Neutral mascot artwork replaces the launcher icon, favicon, app image and full brand/stamp image. The native splash uses crossed.webp. No billing, backend or app identifier changes are included.

Before a local Expo run or a manual EAS submission, install Pillow 11.3.0 and run `python scripts/render_logo.py` from frontend. This regenerates the tracked PNG/SVG working-tree files; the old binary artwork is NOT removed from Git history or automatically committed by CI. The GitHub EAS workflow runs the generator automatically before export and submission, so its EAS source upload includes the regenerated files. Existing store screenshots are not regenerated.

Pushes matching the workflow paths on main run the existing beta regression suite, TypeScript and an Android JS export before submitting an EAS preview APK. Manual workflow dispatch can still select production AAB. EXPO_TOKEN and available EAS quota are required. Submission is asynchronous: a completed GitHub job is not proof of a completed EAS build. The EAS JSON reference and generated images are uploaded as workflow artifacts. No Play Store submission occurs.

This change has not yet passed CI or an on-device visual check. Do not describe it as tested or as a completed APK until those results exist.
