'use client'
import { MessageCircle, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { waLink } from '@/lib/site-config'

export default function ContactCTA() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="px-5 lg:px-8 py-16 sm:py-24 lg:py-32 max-w-7xl mx-auto border-t border-glass-border/30"
    >
      {/* Deep ink surface — warm espresso so white text is legible */}
      <div
        className="relative overflow-hidden p-8 sm:p-12 lg:p-20 text-center rounded-lg shadow-editorial"
        style={{ background: 'linear-gradient(135deg, #140E08 0%, #1E1710 40%, #2A1E12 70%, #1A1208 100%)' }}
      >
        {/* Gold radial shimmer — subtle warmth at the top */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(200,150,47,0.22) 0%, transparent 65%)',
          }}
        />
        {/* Kolam dot grid — barely-visible craft texture */}
        <div
          aria-hidden
          className="absolute inset-0 kolam-dots opacity-[0.04] pointer-events-none"
        />

        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="eyebrow justify-center mb-5"
            style={{ color: 'var(--accent)' }}
          >
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Get In Touch
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.25, duration: 0.8 }}
            className="display text-4xl sm:text-5xl lg:text-7xl mb-6 uppercase text-white"
          >
            Let&apos;s Craft Something{' '}
            <br className="hidden sm:block" />
            <em className="italic gold-text">Beautiful Together</em>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-white/70 text-lg lg:text-xl leading-relaxed mb-12 font-normal"
          >
            Whether you want Lippan wedding keepsakes, a custom resin tray for home decor,
            or a personalised gift set in Resin or Lippan art.
            Collaborate directly with our studio to bring your idea to life.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 max-w-md mx-auto"
          >
            <a
              href={waLink("Hi Srilatha Art, I'd like to ask about a custom order.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn w-full justify-center uppercase tracking-wider font-semibold text-sm px-8 py-4
                         text-white transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #0f766e 100%)',
                boxShadow: '0 4px 20px rgba(16,185,129,0.25)',
              }}
            >
              <MessageCircle className="w-5 h-5" aria-hidden />
              WhatsApp Us
            </a>
            <Link
              href="/custom-order"
              className="btn w-full justify-center uppercase tracking-wider font-semibold text-sm px-8 py-4
                         text-white transition-all duration-300"
              style={{
                border: '1.5px solid rgba(200,150,47,0.35)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,150,47,0.7)'; (e.currentTarget as HTMLElement).style.background = 'rgba(200,150,47,0.08)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,150,47,0.35)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              <FileText className="w-5 h-5" aria-hidden />
              Custom Order
            </Link>
          </motion.div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-widest text-white/40">
            <span>Response in under 2 hours</span>
            <span className="w-1 h-1 rounded-full bg-white/30" aria-hidden />
            <span>Free design consultation</span>
            <span className="w-1 h-1 rounded-full bg-white/30" aria-hidden />
            <span>Shipping India-wide</span>
          </div>
        </div>
      </div>
    </motion.section>
  )
}
