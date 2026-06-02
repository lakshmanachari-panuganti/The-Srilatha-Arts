import HomeHero from '@/components/marketing/HeroSlideshow'
import ShopByArtForm from '@/components/marketing/ShopByArtForm'
import FeaturedCreations from '@/components/marketing/FeaturedCreations'
import OurStoryTeaser from '@/components/marketing/OurStoryTeaser'
import BestSellers from '@/components/marketing/BestSellers'
import CustomOrderCTA from '@/components/marketing/CustomOrderCTA'
import Testimonials from '@/components/marketing/Testimonials'
import WhyChooseUs from '@/components/marketing/WhyChooseUs'
import ContactCTA from '@/components/marketing/ContactCTA'

export default function HomePage() {
  return (
    <>
      {/* 1. Hero — full-bleed slideshow with overlaid brand promise + CTAs.
            Negative top pulls the hero under the fixed Header (which reserves
            5rem / 7.5rem via its own spacer) so the photograph reaches the
            top of the viewport. The warm scrim already covers the area where
            the header sits, so contrast for the header glyphs is preserved. */}
      <div className="-mt-20 lg:-mt-28">
        <HomeHero />
      </div>

      {/* 2. Category Navigation (6 Distinct Entry Points) */}
      <ShopByArtForm />

      {/* 3. Featured Collections */}
      <FeaturedCreations />

      {/* 4. Custom Orders Section (3-Step Customization Process) */}
      <CustomOrderCTA />

      {/* 5. Why Choose Us & 6. Handmade Process */}
      <WhyChooseUs />

      {/* 7. Brand Story & Craft */}
      <OurStoryTeaser />

      {/* 8. Best Sellers */}
      <BestSellers />

      {/* 9. Real Testimonials */}
      <Testimonials />

      {/* 10. Contact / Inquiry CTA (WhatsApp Conversion) */}
      <ContactCTA />
    </>
  )
}
