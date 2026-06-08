'use client'
import Image, { type ImageProps } from 'next/image'

// Drop-in replacement for next/image that opportunistically serves the
// .webp companion produced by scripts/optimize-images.mjs.
//
// Why a wrapper and not next/image alone:
//   next.config.mjs sets `images.unoptimized: true` because the site
//   builds as a static export — there is no runtime image optimiser.
//   Without that, next/image just renders an <img> at the source URL,
//   so modern formats only kick in if the markup itself offers them.
//
// What this does:
//   For src ending in .jpg / .jpeg, render
//     <picture style="display:contents">
//       <source srcSet="<same>.webp" type="image/webp" />
//       <Image ... />   ← original JPEG fallback
//     </picture>
//   Browsers that support WebP (all evergreen browsers ~2020+) pick the
//   .webp; older browsers fall through to the JPEG. The wrapper picture
//   uses display:contents so it doesn't affect the fill / sizes
//   positioning that next/image already applies.
//
// Non-JPEG sources (PNG, SVG) bypass this and render plain next/image.
// Remote URLs (https://*.blob.core.windows.net product photos uploaded
// via the admin panel) also bypass — we only generate .webp companions
// for local JPGs under public/, and pointing a <source> at a remote
// .webp that doesn't exist would 404 silently and hide the fallback.

function jpegToWebp(src: string): string | null {
  if (typeof src !== 'string') return null
  // Local paths only — must start with '/' and not contain a protocol.
  if (!src.startsWith('/') || src.startsWith('//')) return null
  if (!/\.(jpe?g)(?:$|\?)/i.test(src)) return null
  return src.replace(/\.(jpe?g)/i, '.webp')
}

export default function PictureImage(props: ImageProps) {
  const { src } = props
  const webp = typeof src === 'string' ? jpegToWebp(src) : null
  if (!webp) return <Image {...props} />
  return (
    <picture style={{ display: 'contents' }}>
      <source srcSet={webp} type="image/webp" />
      <Image {...props} />
    </picture>
  )
}
