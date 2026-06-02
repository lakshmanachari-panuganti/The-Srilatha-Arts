# Studio Film - Production Plan

**Purpose:** Produce a 60-second cinematic documentary portrait of Srilatha and her handcrafted-art studio, to live on the homepage `<OurStoryTeaser />` block. This is the single highest-impact piece of trust-building content the brand can ship (see UI/UX audit Strategic Finding #1 - "There is no MAKER on this website").

**Owner:** Srilatha (subject) · Lucky (production lead)
**Status:** Pre-production
**Target landing:** `frontend/public/studio/srilatha-film.mp4` (component is already wired and waiting at [components/marketing/OurStoryTeaser.tsx](../frontend/components/marketing/OurStoryTeaser.tsx))
**Estimated production time:** 3–4 days of focused work
**Estimated cost:** ~₹2,500–4,000 in software / royalty fees (one-off + one month of subscriptions)

---

## 1. The story (what we're telling)

Srilatha's actual journey, as she described it:

> "I was passionate about painting. I did not start this thinking it would become a business. I started with just paint and canvas. Then slowly the work grew into resin, then lippan, then DOT mandala, and other creative art."

This is the **emotional spine** of the film. It is a far stronger story than "buy our wall art" because it positions Srilatha as an artist first and a seller second - which is exactly what premium handcrafted-brand buyers want to believe about who they're buying from.

The film should never explicitly say "buy our art". It should make the viewer want to be the kind of person who owns a piece Srilatha made.

---

## 2. Final voiceover script (60 seconds)

Read slowly. Pauses are intentional. Time markers are guide-pacing, not strict.

```
[0:00] I never planned this.

[0:04] Painting was just something I loved. Quiet
       evenings. One brush. One canvas at a time.

[0:14] Then one day, someone asked if I could try
       resin. I poured it once - and the way light
       moved inside it, I couldn't look away.

[0:26] Slowly the work grew. Clay and mirrors. Dots,
       thousands of them. Each piece teaching me
       something the last one did not.

[0:40] I still paint. But now I also make resin,
       lippan, mandalas - anything that asks to
       be made.

[0:50] Made by hand. Made with love.
       Made in Hyderabad.

[0:58] (silence - closing brand frame holds for 2s)
```

**Word count:** 86 words. Natural reading speed ~145 wpm = ~36s. Add deliberate pauses between sentences = ~58s. Perfect for a 60s film.

---

## 3. 🎙 Voice cloning workflow - record in your language, deliver in English

This is the most important section of the plan. **Srilatha records once in her natural language (Telugu or Hindi), and an AI voice-cloning tool reproduces her voice timbre speaking the English script.** The audience hears Srilatha's actual voice - not a synthetic narrator, not a voice actor - speaking English fluently.

This is what premium documentary filmmakers do when their subject is more comfortable speaking their native language. It is not "fake" - it is *Srilatha's voice*, the same way a translator works for a head-of-state interview.

### Recommended tool: **ElevenLabs**

The current best-in-class for cross-lingual voice cloning. Web-based, no install. Free tier exists; paid is ~₹450/month.

**URL:** https://elevenlabs.io

### Step-by-step workflow

#### Step A. Record the source sample (one time, ~30 minutes)

1. **Find a quiet room.** Close windows. Turn off fans / AC. Stand or sit away from hard walls (carpet or curtains absorb echo).
2. **Use the best mic available.** In order of preference:
   - A USB condenser mic (Blue Yeti, MAONO PM422, ~₹6,000)
   - An iPhone or recent Android phone, held 6 inches from mouth
   - A sock pulled loosely over the phone mic to reduce plosives ("p" and "b" pops)
3. **Open Voice Memos (iPhone) or any recording app.** Set quality to highest available (Lossless / WAV / 48kHz if offered).
4. **Record 90 seconds to 3 minutes of Srilatha speaking Telugu or Hindi naturally.** She should:
   - Just talk. Describe her work, her day, her studio, what she had for breakfast. Anything.
   - Speak with full natural emotional range - soft, slightly louder, contemplative pauses, occasional warm laugh.
   - Use her normal cadence - no "narrator voice", no slowing down artificially.
   - Avoid speaking too close to the mic (no "ear-eating" effect). 6-8 inches is right.
   - Re-record any takes with phone notifications, traffic, dog barks, etc.
5. **Save as WAV or M4A.** Send the file to a computer (Airdrop / Google Drive / WhatsApp Web).

**Tip:** The cleaner the source recording, the more convincingly the clone will sound like Srilatha in English. 60 seconds of clean audio beats 5 minutes of noisy audio.

#### Step B. Create the voice clone in ElevenLabs (~10 minutes)

1. Go to https://elevenlabs.io and sign up. Free tier is enough to test; Starter at $5/mo (₹420) is enough to ship the final film.
2. In the left sidebar click **Voices** → **My Voices** → **Add a new voice**.
3. Choose **Instant Voice Clone** (not Professional Voice Clone - that takes 4 weeks).
4. Upload the Telugu / Hindi audio file from Step A.
5. Name the voice **"Srilatha"**. Tick the consent box (Srilatha owns her voice, so consent is implicit).
6. Save. The clone is ready immediately - usually within 30 seconds.

#### Step C. Generate the English voiceover (~5 minutes)

1. In ElevenLabs, go to **Speech → Text to Speech**.
2. Voice: select **"Srilatha"** (your new clone).
3. Model: select **Eleven Multilingual v2** (this is the cross-lingual model - the one that takes a voice cloned from any language and renders it in any other supported language, including English).
4. Voice settings (these matter):
   - Stability: **40–50%** (lower = more emotional variance, higher = more flat). For documentary feel, 45% is the sweet spot.
   - Clarity + Similarity Enhancement: **75–85%** (stay close to the source voice).
   - Style exaggeration: **0–15%** (low - we want her natural cadence, not a performance).
   - Speaker boost: **on**.
5. Paste the English voiceover script from Section 2 above.
6. Click **Generate**.
7. Listen. If a line sounds off (wrong intonation, mispronounced word), regenerate just that line - ElevenLabs lets you edit and re-render individual lines.
8. When happy: **Download MP3**. Save as `srilatha-vo-english.mp3`.

**Quality check:** Play the result to Srilatha. Does it sound like her? If yes, ship it. If no, re-record the source sample in a quieter room with cleaner audio and try again - clone quality is bottlenecked by source quality.

#### Step D. (Optional but recommended) - Cross-check pronunciations

The cloned voice will say English words in Srilatha's accent (which is the point - that's authenticity). But it may stumble on:
- Specific Indian English words ("Hyderabad" - should sound like "Hai-der-aa-baad" not "High-der-uh-bad")
- Brand names

For any word that sounds wrong, ElevenLabs accepts **phonetic spelling** inline. Example: replace `Hyderabad` with `Hai-deh-rah-baad` in the script just for that sentence. Re-generate. The output spelling is unchanged for the listener, only pronunciation changes.

### Alternative tools (if ElevenLabs is unavailable)

| Tool | Strength | Weakness |
| --- | --- | --- |
| **Cartesia Sonic** | Lower latency, more languages | Newer, less polished cross-lingual quality |
| **PlayHT** | Many languages, good Indian English | More expensive at scale |
| **Resemble AI** | Strong API, custom training | Pro-tier pricing, more setup |

ElevenLabs is the recommended primary. The others are worth knowing exist if ElevenLabs blocks Srilatha's account or her source recording for any reason.

### Plan B - if voice clone doesn't sound right

If the cloned English voice feels uncanny or wrong, the dignified fallback is:
1. Use Srilatha's **actual Telugu/Hindi voice** (the source recording, re-cut to match the visual pacing) as the audio.
2. Overlay **English subtitles** on the video.

This is what high-end documentary films do (think Netflix originals about international artists). It preserves total authenticity. The trade-off: viewers must read; engagement drops slightly on mobile. But it is *better* than a cloned voice that sounds wrong.

Decide after hearing the clone output. Both paths are valid.

---

## 4. Visual storyboard - 6 shots × ~10 seconds each

Most AI video tools (Veo 3 / Gemini Omni, Sora, Runway) generate 5–15 second clips at a time. We will generate 6 short cinematic clips and stitch them with the voiceover in Step 6.

Each clip below has a copy-paste prompt for Veo 3 / Gemini Omni.

### Shot 1 - Opening (0:00–0:10) - "I never planned this"

```
Extreme macro close-up of a single paintbrush dipping into a small
ceramic dish of deep purple pigment, then lifting in slow motion as
one drop falls back into the dish, blooming outward. Soft warm window
light from the left, with golden hour quality. Shallow depth of field
at f/2.0, 35mm cinematic look, slight film grain. Lavender flowers
and a small brass diya softly out of focus in the background. Quiet,
contemplative mood. No music. 10 seconds. 16:9 aspect ratio.
```

### Shot 2 - Resin discovery (0:10–0:20) - "The way light moved inside it"

```
Slow overhead shot of an Indian woman artist's hands pouring clear
resin onto a circular wooden disk. Lavender, gold and turquoise
pigment swirls catch the warm afternoon light, moving like liquid
glass in slow motion. Her face partially in frame, focused, calm,
the corner of her mouth lifted slightly in quiet concentration. Late
afternoon golden light from one window. Shallow depth of field.
Camera slowly dollies in by 15 percent. Cinematic 35mm film grain.
10 seconds. 16:9 aspect ratio.
```

### Shot 3 - Lippan mirrors (0:20–0:30) - "Clay and mirrors"

```
Tight macro close-up of an Indian woman's fingers carefully pressing
tiny silver mirror chips into wet white clay arranged in a
traditional Lippan mandala pattern. Each mirror catches a tiny
pinpoint of warm directional light. Shallow depth of field with very
soft warm shadows, slow gentle hand movements. Earthy clay tones
contrast with the bright mirror sparkle. No music - only the soft
sound of clay being shaped. 10 seconds. 16:9 aspect ratio.
```

### Shot 4 - Dot mandala (0:30–0:40) - "Dots, thousands of them"

```
Macro shot of an Indian woman's hand holding a fine dotting tool,
placing one perfect dot of vibrant magenta paint at a time on a deep
black circular plate, building up an intricate mandala pattern.
Dozens of dots accumulate in subtle time-lapse, expanding outward in
concentric rings. Warm golden side light, shallow depth of field,
slight 35mm film grain. Slow, meditative pace. The mandala glows
softly against the dark plate. 10 seconds. 16:9 aspect ratio.
```

### Shot 5 - Finished pieces in the studio (0:40–0:50) - "Each piece takes its time"

```
Slow dolly shot through a small artist's home studio in Hyderabad,
late afternoon. A wooden bench is covered in completed handmade art:
a resin tray with ocean wave patterns, a Lippan wall piece with
mirrors catching the light, a vibrant dot mandala plate, a small
preserved-flower keepsake. Lavender-painted walls, golden window
light, dried lavender stems and marigolds in a terracotta pot. A
small brass diya glows in the corner. No people in frame. Cinematic
slow movement, premium documentary feel. 10 seconds. 16:9 aspect.
```

### Shot 6 - Artist portrait + brand frame (0:50–1:00) - "Made by hand. Made with love."

```
Medium shot of an Indian woman artist in her late 30s, wearing a
simple muted plum cotton sari with subtle gold border. She steps
back from her work-table, dusts her hands lightly on her apron,
looks up slowly and gives a soft, unforced smile - not at the camera
but past it, catching the warm late-afternoon window light. Her
hands have small fingertip pigment stains - she has been working.
Shallow depth of field, gentle film grain. The shot holds for 7
seconds, then crossfades to a brand title card on lavender
background: "Srilatha Art" written in elegant deep-purple cursive
script, "Handmade with love · Hyderabad" in thin serif beneath, with
delicate gold filigree corners. Title card holds for 3 seconds.
Total 10 seconds. 16:9 aspect ratio.
```

---

## 5. Master prompt (if Veo 3 supports a single 60-second generation)

Some video models (Veo 3 long-form, Sora 2) can render a full 60s film as one generation. Try this single prompt first. If the output is poor quality or the tool caps at shorter durations, fall back to the 6-shot approach above.

```
A 60-second cinematic documentary portrait of Srilatha, an Indian
woman artist in her late 30s, working alone in her sunlit Hyderabad
home studio. The film follows the arc of an artist who began with
painting and slowly discovered resin art, Lippan clay-and-mirror
work, and dot mandalas - without ever planning a business.

The film is divided into six unhurried 10-second beats:

[0–10s] OPENING: Extreme macro of a brush dipping into deep purple
pigment, a drop falling in slow motion. Pull back to reveal her
hands holding a half-finished canvas in soft window light.

[10–20s] DISCOVERY: She pours clear resin onto a circular wooden
disk. Lavender, gold and turquoise pigments swirl in the resin,
catching warm window light.

[20–30s] LIPPAN: Tight close-up of her fingers pressing silver
mirror chips into wet white clay in a traditional Lippan pattern.

[30–40s] MANDALA: Macro of her hand placing dots of vibrant paint
on a black mandala plate. Dozens of dots accumulate in slow time-
lapse.

[40–50s] FINISHED WORK: Slow dolly through her studio showing
completed pieces - resin tray, Lippan, mandala plate, keepsakes -
on a wooden bench in late afternoon golden light. Dried lavender,
marigolds, a small brass diya.

[50–58s] PORTRAIT: She steps back from her work, dusts her hands
on her apron, looks up slowly and gives a soft unforced smile,
catching the warm window light.

[58–60s] BRAND FRAME: Slow fade to a lavender title card: "Srilatha
Art" in deep-purple cursive script, "Handmade with love · Hyderabad"
in thin serif, gold filigree corners.

SUBJECT: Simple muted plum cotton sari with subtle gold border. No
heavy jewellery. Hair tied back simply. Small fingertip pigment
stains on her hands.

LOCATION: Small home studio with one large window casting warm
directional light. Wooden work-table with art supplies. Lavender-
painted walls. Marigolds and dried lavender in a terracotta pot.

CINEMATOGRAPHY: 35mm equivalent, shallow depth of field f/2.0.
Slow dolly and pan only. No handheld shake, no fast cuts, no zooms.
Long lingering takes. Warm color grading with vivid accents on resin
and mandala colors. Subtle film grain. 16:9 cinematic.

MOOD: Intimate, soulful, unhurried, handcrafted, warm, premium.
Reference: a Le Labo perfume film crossed with an Aman resorts
brand film. NOT a craft tutorial, NOT a fast-cut Reel.

AVOID: Stock-footage feel. Bright neon color grading. Multiple
people in frame. Cliché Indian visual tropes (no temple bells, no
spinning chakras). Quick cuts. Drone shots. On-screen text except
the final brand frame.
```

---

## 6. Music

Music is licensed separately. AI video tools rarely match music to mood reliably, and royalty-free is essential for ecommerce use.

**Recommended source:** [Artlist.io](https://artlist.io) (₹1,300/month annual) or [Epidemic Sound](https://www.epidemicsound.com) (₹1,000/month).

**Search terms (in order of preference):**
1. `tabla harmonium contemplative slow 60bpm`
2. `Indian instrumental meditation`
3. `sitar minimal soft ambient`
4. `acoustic Indian fusion calm`

**Target characteristics:**
- Tempo: ~60–70 BPM (heartbeat pace)
- Instrumentation: tabla brushed gently, harmonium drone, occasional sitar or bansuri (flute)
- Mood: contemplative, never melancholic, never upbeat-commercial
- No vocals (would compete with Srilatha's voiceover)
- Should build subtly over the 60s - slightly fuller at 30s, softening at 50s

**Free alternative:** YouTube Audio Library → filter `Genre: Ambient` + `Mood: Calm`. Quality is lower but workable. Search "Indian classical instrumental" + "Calm".

---

## 7. Editing - assembling the final 60-second film

### Tool recommendation: **CapCut** (free, web + desktop)

Why CapCut over Premiere Rush or DaVinci Resolve: it's free, runs on any laptop, exports in 1080p with no watermark, and has built-in audio ducking (automatically lowers music when voiceover plays).

**Alternative for advanced users:** DaVinci Resolve Free (more powerful color grading), Adobe Premiere Rush (₹800/month).

### Editing checklist

```
[ ] 1. Create new project. Set timeline to 1920×1080 30fps.
[ ] 2. Import all 6 video clips, the voiceover MP3, and the music
      track.
[ ] 3. Drop clips on the video track in order: 1 → 2 → 3 → 4 → 5 → 6.
[ ] 4. Drop the voiceover on Audio Track 1.
[ ] 5. Drop the music on Audio Track 2.
[ ] 6. Trim each clip to align with the voiceover timing in Section
      2 (drag clip ends).
[ ] 7. Add 500ms cross-fades between clips (right-click clip boundary
      → Transition → Fade).
[ ] 8. Music volume: -18 to -22 dB (just below the voiceover). Enable
      "audio ducking" so music auto-lowers when voice speaks.
[ ] 9. Voiceover volume: peaks around -6 dB. No compression needed
      if recorded well.
[ ] 10. Color grading pass: bump shadows slightly warmer, lift mid-
       tones gently, leave highlights alone. Subtle.
[ ] 11. Add 1-second fade-in at the start and 1-second fade-out at
       the end (both video and audio).
[ ] 12. Preview the full 60 seconds twice. Watch on phone too.
[ ] 13. Export as MP4 H.264, 1080p, ~10 Mbps. File should be ~50–80 MB.
[ ] 14. Save as `srilatha-film.mp4`.
[ ] 15. Generate a thumbnail: pause the playhead at the most beautiful
       frame of Shot 6 (the artist portrait). Export still frame as
       `srilatha-film-thumb.jpg` (1920×1080).
```

---

## 8. Derivative cuts (ship for free with the same assets)

### 8a. 30-second Instagram Reels version (vertical, 9:16)

Re-export the same edit with these changes:
- Crop to 9:16 vertical (1080×1920). Re-center each clip on the artist's hands or face.
- Trim to 30 seconds - drop Shots 1 and 5, keep Shots 2, 3, 4, 6.
- Trim voiceover to: *"I never planned this. I just loved to paint. Then one day, I tried resin… clay… mirrors… dots. Each piece, taking its time. Made by hand. Made in Hyderabad."*
- Save as `srilatha-film-reels.mp4`.

This drives Instagram discovery - the audit's biggest gap was no organic top-of-funnel.

### 8b. 15-second teaser (homepage hover or pre-roll)

Same edit again, but:
- Use only Shots 2, 4, 6 (5 seconds each).
- Voiceover trimmed to: *"I never planned this. Made by hand. Made in Hyderabad."*
- Same 9:16 vertical works for stories; same 16:9 works for the homepage.
- Save as `srilatha-film-teaser.mp4`.

---

## 9. Delivery - where to drop the files

When all cuts are ready, place them at:

```
frontend/public/studio/
├── srilatha-film.mp4         # Main 60s cut (16:9)
├── srilatha-film-thumb.jpg   # Poster frame for the homepage placeholder
├── srilatha-film-reels.mp4   # 30s vertical for Instagram
└── srilatha-film-teaser.mp4  # 15s teaser
```

The `<OurStoryTeaser />` component is already wired and waiting. Once the files land, I (Claude) will swap the placeholder configuration in **one short edit**:

- `VIDEO_THUMBNAIL` constant → point at the new poster jpg
- Add `VIDEO_URL` constant → point at the new mp4
- Wrap the placeholder div in a `<video>` element with `poster`, `playsInline`, `muted`, and a `<source>` tag
- The "Coming soon" pill auto-removes when `VIDEO_URL` is defined

No other component changes needed. Total wiring time: under 5 minutes.

---

## 10. Cost estimate

| Item | One-off | Recurring | Notes |
| --- | --- | --- | --- |
| ElevenLabs Starter | - | $5/mo (~₹420) | One month is enough to ship the film. Cancel after. |
| Veo 3 / Gemini Omni access | - | $20/mo (~₹1,700) | Google AI Pro. One month is enough. |
| Artlist.io (music) | - | ₹1,300/mo billed annually, OR pay-per-track ~₹2,500 single track | One annual track license is fine for a single film. |
| CapCut (editing) | - | Free | Web + desktop, no watermark on free tier. |
| USB mic (optional) | ₹3,000–6,000 | - | Skip if iPhone with sock works for the source recording. |
| **Total one-month outlay** | - | **~₹2,500–4,500** | Cancel subscriptions after the film ships. |

This is materially cheaper than commissioning a videographer for a brand film (typical ₹40,000–₹1,50,000 in India). The trade-off: time investment is 3–4 focused days vs. 1 day with a hired crew.

---

## 11. Production timeline (3–4 days of focused work)

| Day | What | Hours |
| --- | --- | --- |
| **Day 1 (morning)** | Record source voice sample (Telugu / Hindi). Set up ElevenLabs. Create voice clone. Generate English voiceover. Quality check with Srilatha. | 2 hours |
| **Day 1 (afternoon)** | Sign up for Veo 3. Generate Shot 1 and Shot 2. Iterate on the prompt language if results are not on-brand. | 3 hours |
| **Day 2 (morning)** | Generate Shots 3, 4, 5. Iterate. Approve. | 3 hours |
| **Day 2 (afternoon)** | Generate Shot 6 (portrait + brand frame). Brand frame may need to be made as a still image in Canva / Figma instead and edited in. | 2 hours |
| **Day 3 (morning)** | License music. Listen to 10 candidates, pick 1. | 1 hour |
| **Day 3 (afternoon)** | Edit + assemble the 60s film in CapCut. Watch back twice. Revise. | 3 hours |
| **Day 4 (morning)** | Export final 60s cut. Export 30s Reels cut. Export 15s teaser. Export thumbnail. | 2 hours |
| **Day 4 (afternoon)** | Drop all four files into `frontend/public/studio/`. Ping the dev to wire it live. | 30 minutes |

**Total focused time:** ~16 hours over 4 days. Realistically 1 week with breaks and review cycles.

---

## 12. Quality bar - what "done" looks like

The film is done when **all three** of these are true:

1. **Srilatha watches the finished cut and says "yes, that's me"** (the voice, the visuals, the pacing). If she winces, fix what makes her wince.
2. **A first-time visitor who has never heard of Srilatha Art can watch the 60s and would feel comfortable spending ₹5,000 on a piece.** Trust + emotional connection.
3. **The film holds attention for the full 60 seconds on a mobile screen without sound.** Visuals alone should be strong enough. (60% of Indian D2C traffic watches videos muted.)

If any of these three fails, revise. Don't ship a film that fails 1 - that's worse than no film.

---

## 13. What I (Claude) will do once the files land

1. Wire the MP4 + thumbnail into `<OurStoryTeaser />` as documented in Section 9 (~5 min edit).
2. Add lazy-loading + `playsInline` + `muted` attributes so the video doesn't autoplay with sound (critical for mobile UX and SEO).
3. Add a Schema.org `VideoObject` JSON-LD block to the homepage so Google indexes it as video content (small SEO win).
4. Add a sitemap entry for the video file.
5. Test on iOS Safari, Android Chrome, desktop Safari, desktop Chrome before declaring done.

---

## 14. Open questions for Srilatha to decide

Before recording begins:

- [ ] **Language for the source recording.** Telugu or Hindi? Whichever she's more comfortable in.
- [ ] **Sari color for filming.** The script suggests muted plum with gold border. Alternative: ivory with subtle purple. Whichever she has and feels good in.
- [ ] **Studio setting.** Is her actual studio film-ready, or does it need 1 hour of tidy / declutter first?
- [ ] **Comfort with the script.** Does the wording feel authentic? Edit anything that doesn't sound like her.
- [ ] **Plan B preference.** If the cloned voice sounds off, is she okay with English subtitles over her native-language audio?

---

*Document version 1.0 · Authored 2026-05-26 · Living document; update as production progresses.*
