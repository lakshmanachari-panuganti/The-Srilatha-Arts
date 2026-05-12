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
