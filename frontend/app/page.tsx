import HeroSlideshow from '@/components/marketing/HeroSlideshow'
import Hero from '@/components/marketing/Hero'
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
      {/* 1. Hero Section */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <HeroSlideshow />
      </div>
      <Hero />

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
