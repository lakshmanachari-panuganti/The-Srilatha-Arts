'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'

const slides = [
  {
    image: '/images/slideshow/01-resin.jpg',
    title: 'Resin Art',
    tagline: 'Bright poured gloss & crystals',
    href: '/shop/resin',
    num: '01'
  },
  {
    image: '/images/slideshow/02-dot-mandala.jpg',
    title: 'Dot Mandala',
    tagline: 'Symmetric meditative patterns',
    href: '/shop/dot-mandala',
    num: '02'
  },
  {
    image: '/images/slideshow/03-lippan.jpg',
    title: 'Lippan Art',
    tagline: 'Traditional clay work & mirrors',
    href: '/shop/lippan',
    num: '03'
  },
  {
    image: '/images/slideshow/04-kolam.jpg',
    title: 'Kolam Art',
    tagline: 'Permanent wall rangoli lines',
    href: '/shop/kolam',
    num: '04'
  },
  {
    image: '/images/slideshow/05-wedding-decoratives.jpg',
    title: 'Wedding & Festive Decor',
    tagline: 'Auspicious traditional ornaments',
    href: '/shop/pichwai',
    num: '05'
  }
]

export default function Hero() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center bg-plum/20">
      {/* Dreamy ambient glow orbs */}
      <div
        aria-hidden
        className="absolute -top-40 -right-32 w-[600px] h-[600px] rounded-full
                   bg-gradient-to-br from-lavender-soft/20 via-lavender-pastel/15 to-transparent blur-[120px]
                   animate-glow-pulse"
      />
      <div
        aria-hidden
        className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full
                   bg-gradient-to-br from-lavender/15 via-plum-warm to-transparent blur-[100px]
                   animate-glow-pulse [animation-delay:2s]"
      />

      {/* Subtle mandala-inspired decorative circle behind text */}
      <div
        aria-hidden
        className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] lg:w-[700px] lg:h-[700px]
                   opacity-[0.03] animate-gentle-rotate pointer-events-none"
      >
        <svg viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <circle cx="400" cy="400" r="380" stroke="#C8B6FF" strokeWidth="0.5" strokeDasharray="8 12" />
          <circle cx="400" cy="400" r="300" stroke="#C8B6FF" strokeWidth="0.5" strokeDasharray="4 8" />
          <circle cx="400" cy="400" r="220" stroke="#C8B6FF" strokeWidth="0.5" strokeDasharray="3 6" />
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i / 12) * Math.PI * 2
            const x = 400 + Math.cos(angle) * 340
            const y = 400 + Math.sin(angle) * 340
            return <circle key={i} cx={x} cy={y} r="4" fill="#C8B6FF" />
          })}
        </svg>
      </div>

      <div className="relative max-w-6xl mx-auto px-5 lg:px-8 py-12 lg:py-20 z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Premium Editorial Content */}
          <div className="lg:col-span-7 text-left flex flex-col justify-center">
            {/* Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="eyebrow text-lavender-pastel mb-5 inline-flex items-center"
            >
              <Sparkles className="w-3.5 h-3.5 mr-2 animate-pulse" />
              <span>Made in Hyderabad · since 2020</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1 }}
              className="display text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 font-serif leading-[1.05]"
            >
              Handmade Indian
              <br />
              art for your{' '}
              <span className="relative inline-block italic font-serif">
                <span className="gold-text">home</span>
                <svg
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  className="absolute -bottom-2 left-0 w-full h-3 text-lavender-soft"
                  aria-hidden
                >
                  <path
                    d="M2 8 Q 50 2, 100 6 T 198 5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="text-ivory-soft text-base lg:text-lg max-w-xl mb-8 lg:mb-10 leading-relaxed font-sans"
            >
              Beautiful, texturized wall art in five authentic styles — Resin Art, Dot Mandala, 
              Lippan Clay work, Wedding Decoratives and Kolam. Each piece is individually hand-painted 
              and framed in our Hyderabad studio.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 items-start mb-12 lg:mb-16"
            >
              <Link href="/shop" className="btn-dark w-full sm:w-auto text-center justify-center">
                Shop all art
                <ArrowRight className="w-4 h-4" aria-hidden />
              </Link>
              <Link href="/custom-order" className="btn-outline w-full sm:w-auto text-center justify-center">
                Order a custom piece
              </Link>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.4 }}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] tracking-[0.2em] uppercase text-ivory-mute border-t border-glass-border pt-6 max-w-xl"
            >
              <span>Free shipping above ₹2,999</span>
              <span className="w-1.5 h-1.5 rounded-full bg-lavender-soft/40" aria-hidden />
              <span>100% Handcrafted</span>
              <span className="w-1.5 h-1.5 rounded-full bg-lavender-soft/40" aria-hidden />
              <span>Safe Delivery Guarantee</span>
            </motion.div>
          </div>

          {/* Right Column: Dynamic Art Slideshow Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="lg:col-span-5 w-full flex justify-center items-center"
          >
            <div 
              className="relative w-full aspect-[4/5] max-w-sm lg:max-w-none overflow-hidden
                         border border-glass-border shadow-lavender-glow-lg bg-gradient-to-b from-plum-warm/30 to-plum/10"
              style={{ borderRadius: '32px' }}
            >
              {/* Image Transition Slider */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: 'easeInOut' }}
                  className="absolute inset-0 w-full h-full"
                >
                  <motion.div
                    initial={{ scale: 1 }}
                    animate={{ scale: 1.05 }}
                    transition={{ duration: 4.5, ease: 'linear' }}
                    className="absolute inset-0 w-full h-full"
                  >
                    <Image
                      src={slides[index].image}
                      alt={slides[index].title}
                      fill
                      priority
                      className="object-cover"
                    />
                  </motion.div>
                </motion.div>
              </AnimatePresence>

              {/* Glassmorphic Caption Plate */}
              <div className="absolute bottom-5 inset-x-5 z-20">
                <div 
                  className="p-5 backdrop-blur-xl border border-white/20 bg-glass-surface"
                  style={{ borderRadius: '24px' }}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <span className="text-[9px] uppercase tracking-[0.25em] font-semibold text-lavender-pastel block mb-1">
                        Style {slides[index].num}
                      </span>
                      <h3 className="font-serif text-xl lg:text-2xl text-ivory font-semibold leading-tight">
                        {slides[index].title}
                      </h3>
                      <p className="text-xs text-ivory-soft leading-normal mt-0.5">
                        {slides[index].tagline}
                      </p>
                    </div>
                    
                    <Link
                      href={slides[index].href}
                      aria-label={`View ${slides[index].title} collections`}
                      className="shrink-0 w-11 h-11 rounded-full bg-lavender text-white
                                 hover:bg-lavender-pastel transition-colors duration-500
                                 flex items-center justify-center shadow-soft"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>

                  {/* Horizontal Progress Bars */}
                  <div className="flex gap-1.5 mt-4">
                    {slides.map((_, i) => (
                      <div
                        key={i}
                        className="h-1 rounded-full flex-1 bg-white/20 overflow-hidden"
                      >
                        {i === index && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 4.5, ease: 'linear' }}
                            className="h-full bg-lavender"
                          />
                        )}
                        {i < index && <div className="h-full w-full bg-lavender" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Soft Ambient Vignette Overlay */}
              <div 
                className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" 
                aria-hidden 
              />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
