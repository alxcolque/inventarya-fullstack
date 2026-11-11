import { useSeo, type SeoOptions } from "@/hooks/useSeo";

export const Seo = (options: SeoOptions) => {
  useSeo(options);
  return null;
};
