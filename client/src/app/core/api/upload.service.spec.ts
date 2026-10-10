import { cldUrl, fitWithin } from './upload.service';

describe('fitWithin', () => {
  it('scales the long edge down to 1600px keeping the aspect ratio', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1000, 5000)).toEqual({ width: 320, height: 1600 });
  });

  it('never upscales small images', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('cldUrl', () => {
  it('inserts a Cloudinary transformation', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/secret-santa/g/wishlist/abc.webp';
    expect(cldUrl(url, { w: 160, h: 160 })).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_160,h_160,q_auto,f_auto/v1/secret-santa/g/wishlist/abc.webp',
    );
  });
});
