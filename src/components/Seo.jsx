const SITE_URL = 'https://mjshoes.xyz';
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;
const DEFAULT_TITLE = 'MJ Shoes — Crafted for Everyday Excellence';

// React 19 hoists <title>/<meta>/<link> rendered anywhere in the tree into
// <head> automatically — no react-helmet needed. Render this once per page
// so every route gets its own title/description instead of sharing index.html's.
export default function Seo({ title, description, path = '', image = DEFAULT_IMAGE, noindex = false, jsonLd }) {
  const fullTitle = title ? `${title} | MJ Shoes` : DEFAULT_TITLE;
  const url = `${SITE_URL}${path}`;

  return (
    <>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </>
  );
}
