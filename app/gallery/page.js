import { siteData } from "@/data/siteData";
import { getHomepageMedia } from "@/lib/media-repo";

export const dynamic = "force-dynamic";

function sortGalleryImages(items) {
  return [...items].sort((left, right) => {
    if (left.featuredHome !== right.featuredHome) {
      return left.featuredHome ? -1 : 1;
    }

    const leftSlot = left.homeSlot == null ? Number.MAX_SAFE_INTEGER : left.homeSlot;
    const rightSlot = right.homeSlot == null ? Number.MAX_SAFE_INTEGER : right.homeSlot;
    if (leftSlot !== rightSlot) {
      return leftSlot - rightSlot;
    }

    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function buildStaticGalleryItems() {
  return (siteData.mediaGallery || []).map((item, index) => ({
    id: `static-gallery-${index}`,
    title: item.tag || `Photo ${index + 1}`,
    description: item.alt || "Featured Brooke photo",
    thumbnailUrl: item.src,
    posterUrl: item.src,
    featuredHome: true,
    homeSlot: index + 1,
    active: true,
    isHidden: false,
    moderationStatus: "approved"
  }));
}

export default async function GalleryPage() {
  let galleryItems = buildStaticGalleryItems();

  try {
    const media = await getHomepageMedia();
    const eligibleImages = (media.images || []).filter(
      (item) =>
        item.kind === "image" &&
        item.active !== false &&
        item.isHidden !== true &&
        item.moderationStatus !== "rejected" &&
        (item.thumbnailUrl || item.posterUrl || item.publicUrl || item.url)
    );

    if (eligibleImages.length) {
      galleryItems = sortGalleryImages(eligibleImages);
    }
  } catch {
    galleryItems = buildStaticGalleryItems();
  }

  return (
    <main className="page-shell">
      <style>{`
        .gallery-page {
          display: grid;
          gap: 1.5rem;
        }

        .gallery-page__hero {
          display: grid;
          gap: 1rem;
        }

        .gallery-page__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.85rem;
        }

        .gallery-page__back {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 0 1.1rem;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          text-decoration: none;
        }

        .gallery-page__grid {
          display: grid;
          gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .gallery-page__card {
          display: grid;
          gap: 0;
          overflow: hidden;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(7, 12, 27, 0.72);
          backdrop-filter: blur(12px);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
        }

        .gallery-page__card img {
          width: 100%;
          aspect-ratio: 4 / 5;
          object-fit: cover;
          background: #05070f;
        }

        .gallery-page__copy {
          display: grid;
          gap: 0.5rem;
          padding: 1rem 1rem 1.15rem;
        }

        .gallery-page__copy p,
        .gallery-page__copy span {
          margin: 0;
        }

        .gallery-page__copy p {
          font-size: 1rem;
          font-weight: 700;
        }

        .gallery-page__copy span {
          color: rgba(255, 255, 255, 0.68);
          line-height: 1.55;
        }
      `}</style>

      <section className="section gallery-page">
        <div className="gallery-page__hero">
          <div className="section-heading">
            <span>Gallery</span>
            <h1>Photo thumbnails, all in one place.</h1>
            <p>Browse Brooke's image gallery separately from the homepage video stack.</p>
          </div>

          <div className="gallery-page__actions">
            <a className="gallery-page__back" href="/">
              Back to home
            </a>
          </div>
        </div>

        <div className="gallery-page__grid">
          {galleryItems.map((item) => {
            const src = item.thumbnailUrl || item.posterUrl || item.publicUrl || item.url;

            return (
              <article key={item.id} className="gallery-page__card">
                <img src={src} alt={item.title || "Brooke gallery photo"} loading="lazy" decoding="async" />
                <div className="gallery-page__copy">
                  <p>{item.title || "Gallery image"}</p>
                  <span>{item.description || "Featured Brooke photo"}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
