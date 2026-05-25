import HeroSlideshow from '@/components/marketing/HeroSlideshow'
import Hero from '@/components/marketing/Hero'
import ShopByArtForm from '@/components/marketing/ShopByArtForm'
import FeaturedCreations from '@/components/marketing/FeaturedCreations'
import OurStoryTeaser from '@/components/marketing/OurStoryTeaser'
import BestSellers from '@/components/marketing/BestSellers'
import CustomOrderCTA from '@/components/marketing/CustomOrderCTA'
import Testimonials from '@/components/marketing/Testimonials'

export default function HomePage() {
  return (
    <>
      {/* Slideshow is the primary above-the-fold hero — five curated
          collection slides from /public/Slideshow. <Hero /> below provides
          the brand-voice headline + CTAs + trust strip that turn the
          slideshow's visual impact into conversion intent. */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <HeroSlideshow />
      </div>
      <Hero />
      <ShopByArtForm />
      <FeaturedCreations />
      <OurStoryTeaser />
      <BestSellers />
      <CustomOrderCTA />
      <Testimonials />
    </>
  )
}
