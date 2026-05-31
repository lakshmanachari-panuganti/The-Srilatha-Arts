'use client'
import { ArrowRight, MessageCircle, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { whatsappLink } from '@/lib/site-config'

export default function ContactCTA() {
  return (
    <section className="px-5 lg:px-8 py-16 sm:py-24 lg:py-32 max-w-7xl mx-auto border-t border-glass-border/30">
      <div className="relative overflow-hidden p-8 sm:p-12 lg:p-20 text-center rounded-4xl bg-gradient-to-br from-ivory via-ivory-soft to-ivory-mute shadow-glass">
        {/* Shimmer overlay decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(167,139,250,0.2),transparent_55%)]" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="eyebrow text-lavender-soft justify-center mb-5">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Get In Touch
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
          </span>
          <h2 className="display text-4xl sm:text-5xl lg:text-7xl mb-6 uppercase text-white">
            Let&apos;s Craft Something <br />
            <em className="italic text-lavender-soft">Beautiful Together</em>
          </h2>
          <p className="text-plum-warm/80 text-lg lg:text-xl leading-relaxed mb-12 font-normal">
            Whether you want Lippan wedding keepsakes, a custom resin tray for home decor,
            or a personalised gift set in Resin or Lippan art.
            Collaborate directly with our studio to bring your idea to life.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 max-w-md mx-auto">
            <a
              href={whatsappLink("Hi Srilatha Art, I'd like to ask about a custom order.")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-dark w-full justify-center uppercase tracking-wider font-semibold text-sm px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 border-none shadow-emerald-950/20"
              style={{ boxShadow: '0 4px 20px rgba(16,185,129,0.3)' }}
            >
              <MessageCircle className="w-5 h-5" aria-hidden />
              WhatsApp Us
            </a>
            <Link
              href="/custom-order"
              className="btn w-full justify-center uppercase tracking-wider font-semibold text-sm px-8 py-4 border border-white/20 hover:border-white/50 text-white hover:bg-white/10 transition-all duration-300"
            >
              <FileText className="w-5 h-5" aria-hidden />
              Bespoke Request
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-widest text-plum-warm/60">
            <span>Response in under 2 hours</span>
            <span className="w-1 h-1 rounded-full bg-lavender-soft/40" aria-hidden />
            <span>Free design consultation</span>
            <span className="w-1 h-1 rounded-full bg-lavender-soft/40" aria-hidden />
            <span>Shipping India-wide</span>
          </div>
        </div>
      </div>
    </section>
  )
}
