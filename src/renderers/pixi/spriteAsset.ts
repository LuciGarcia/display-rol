import { Assets, Container, Sprite, Texture } from "pixi.js";
import type { ResolvedAsset } from "../../assets/types";

export type TextureLoader = (source: string) => Promise<Texture>;

// resolution: 2 para que el SVG no se vea borroso al hacer zoom
export const defaultTextureLoader: TextureLoader = (source) =>
  Assets.load<Texture>({ src: source, data: { resolution: 2 } });

export interface AssetBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Muestra el placeholder y lo reemplaza por el sprite cuando la textura carga.
// Si falla, queda el placeholder y el error se registra (no se oculta).
export function applyAsset(params: {
  container: Container;
  placeholder: Container;
  asset: ResolvedAsset;
  box: AssetBox;
  loadTexture: TextureLoader;
}): void {
  const { container, placeholder, asset, box, loadTexture } = params;
  if (asset.kind === "model") return; // 3D: fuera de alcance, queda el placeholder

  loadTexture(asset.source)
    .then((texture) => {
      if (container.destroyed) return;
      const sprite = new Sprite(texture);
      sprite.x = box.x;
      sprite.y = box.y;
      sprite.width = box.width;
      sprite.height = box.height;
      // El sprite ocupa el lugar del placeholder: lo que se dibujó antes (sombras) queda debajo
      const index = container.getChildIndex(placeholder);
      container.removeChild(placeholder);
      placeholder.destroy({ children: true });
      container.addChildAt(sprite, Math.min(index, container.children.length));
    })
    .catch((error) => {
      console.error(`No se pudo cargar el asset "${asset.assetId}":`, error);
    });
}
