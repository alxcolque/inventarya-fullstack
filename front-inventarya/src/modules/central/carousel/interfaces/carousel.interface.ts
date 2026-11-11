export interface ICarousel {
  id: number;
  title: string;
  link: string | null;
  description: string | null;
  visible_btn: boolean;
  title_btn: string | null;
  color_btn: string | null;
  position_btn: 'left' | 'center' | 'right' | null;
  image: string | null;
  image_key: string | null;
  display_order: number;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface ICarouselFormValues {
  title: string;
  description: string;
  link: string;
  visible_btn: boolean;
  title_btn: string;
  color_btn: string;
  position_btn: 'left' | 'center' | 'right';
  display_order: number;
  status: 'active' | 'inactive';
}
