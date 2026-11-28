import {
  letterheadLogoDrawMm,
  letterheadSourceCropRect,
} from './destination-rate-quotation-pdf';

describe('letterheadSourceCropRect', () => {
  it('no recorta logos horizontales o cuadrados', () => {
    expect(letterheadSourceCropRect(400, 380)).toEqual({
      sx: 0,
      sy: 0,
      sw: 400,
      sh: 380,
    });
  });

  it('recorta bandas arriba y abajo en foto de perfil', () => {
    const crop = letterheadSourceCropRect(300, 600);
    expect(crop.sw).toBe(300);
    expect(crop.sh).toBe(300);
    expect(crop.sy).toBe(150);
  });
});

describe('letterheadLogoDrawMm', () => {
  it('escala al máximo dentro de la caja del membrete', () => {
    const { widthMm, heightMm } = letterheadLogoDrawMm(300, 300);
    expect(widthMm).toBe(28);
    expect(heightMm).toBe(28);
  });
});