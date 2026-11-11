import { useEffect } from "react";
import { isCentral } from "@/utils/tenant";

type StructuredData = Record<string, unknown> | Array<Record<string, unknown>>;

export interface SeoOptions {
  title: string;
  description: string;
  path?: string;
  siteName?: string;
  image?: string | null;
  type?: "website" | "article" | "product";
  noIndex?: boolean;
  structuredData?: StructuredData;
}

const upsertMeta = (
  attribute: "name" | "property",
  key: string,
  content: string,
): HTMLMetaElement => {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.content = content;
  return element;
};

const upsertLink = (rel: string, href: string, hrefLang?: string): HTMLLinkElement => {
  const selector = hrefLang
    ? `link[rel="${rel}"][hreflang="${hrefLang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  let element = document.head.querySelector<HTMLLinkElement>(selector);

  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    if (hrefLang) element.hreflang = hrefLang;
    document.head.appendChild(element);
  }

  element.href = href;
  return element;
};

const toAbsoluteUrl = (value: string, origin: string): string => {
  try {
    return new URL(value, `${origin}/`).toString();
  } catch {
    return `${origin}/`;
  }
};

export const useSeo = ({
  title,
  description,
  path,
  siteName = "Inventarya",
  image,
  type = "website",
  noIndex = false,
  structuredData,
}: SeoOptions): void => {
  const structuredDataJson = structuredData ? JSON.stringify(structuredData) : "";

  useEffect(() => {
    const configuredOrigin = String(import.meta.env.VITE_SITE_URL || "").trim();
    const origin = (isCentral() && configuredOrigin ? configuredOrigin : window.location.origin)
      .replace(/\/$/, "");
    const canonicalPath = path || window.location.pathname || "/";
    const canonicalUrl = toAbsoluteUrl(canonicalPath, origin);
    const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
    const robots = noIndex
      ? "noindex, nofollow, noarchive"
      : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

    document.documentElement.lang = "es";
    document.title = fullTitle;

    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", robots);
    upsertMeta("name", "googlebot", robots);
    upsertMeta("name", "application-name", siteName);

    upsertMeta("property", "og:locale", "es_BO");
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:site_name", siteName);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonicalUrl);

    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);

    if (image) {
      const absoluteImage = toAbsoluteUrl(image, origin);
      upsertMeta("property", "og:image", absoluteImage);
      upsertMeta("property", "og:image:alt", `${siteName} - ${title}`);
      upsertMeta("name", "twitter:image", absoluteImage);
    }

    upsertLink("canonical", canonicalUrl);
    upsertLink("alternate", canonicalUrl, "es-BO");
    upsertLink("alternate", canonicalUrl, "x-default");

    const scriptId = "page-structured-data";
    document.getElementById(scriptId)?.remove();

    if (structuredDataJson) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      script.textContent = structuredDataJson;
      document.head.appendChild(script);
    }
  }, [description, image, noIndex, path, siteName, structuredDataJson, title, type]);
};
