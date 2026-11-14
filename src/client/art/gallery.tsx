// Review gallery: every drawing in a grid, gods first. Not wired to any route.
import { ART, Art, type ArtName } from './index';

const Cell = ({ name }: { name: ArtName }) => (
  <figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:6px">
    <Art name={name} class="art-gallery" />
    <figcaption style="font:12px/1 ui-monospace,monospace;opacity:.7;letter-spacing:.04em">{name}</figcaption>
  </figure>
);

export function ArtGallery() {
  const section = (title: string, names: readonly ArtName[]) => (
    <section style="margin:0 0 32px">
      <h2 style="font:600 13px/1 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin:0 0 14px">{title}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px">
        {names.map(n => <Cell key={n} name={n} />)}
      </div>
    </section>
  );
  return (
    <div style="padding:24px 16px;color:#c9a45c;background:#0d0c0a;min-height:100vh">
      <style>{'.art-gallery{width:100%;max-width:300px;height:auto;aspect-ratio:1}'}</style>
      {section('Gods', ART.gods)}
      {section('Culture', ART.culture)}
    </div>
  );
}
