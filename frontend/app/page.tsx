import Hero from '@/components/marketing/Hero'
import TrustStrip from '@/components/marketing/TrustStrip'
import ShopByArtForm from '@/components/marketing/ShopByArtForm'
import FeaturedCreations from '@/components/marketing/FeaturedCreations'
import ScrollStory from '@/components/marketing/ScrollStory'
import BestSellers from '@/components/marketing/BestSellers'
import OurStoryTeaser from '@/components/marketing/OurStoryTeaser'
import CustomOrderCTA from '@/components/marketing/CustomOrderCTA'
import Testimonials from '@/components/marketing/Testimonials'
import SectionDivider from '@/components/SectionDivider'

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustStrip />
      <ShopByArtForm />
      <FeaturedCreations />
      <SectionDivider />
      <ScrollStory />
      <BestSellers />
      <OurStoryTeaser />
      <CustomOrderCTA />
      <Testimonials />
    </>
  )
}
