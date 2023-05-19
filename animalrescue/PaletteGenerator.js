/*
    Sources:
    https://observablehq.com/@shan/oklab-color-wheel
    https://bottosson.github.io/posts/oklab/
*/


const gamma = x => (x >= 0.0031308 ? 1.055 * Math.pow(x, 1 / 2.4) - 0.055 : 12.92 * x);

const clamp = n => Math.min(Math.max(n, 0), 255);

const oklab = (L, a, b) => {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [ // updated matrix
    255 * gamma(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    255 * gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    255 * gamma(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
  ]
}

const oklch = function(lightness, chroma, hue) { // OKLCH -> OKLAB -> linear sRGB
    const h = 2 * Math.PI * (hue / 360);
    const C = chroma;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);

    return (oklab(lightness, a, b)).map(clamp);
}

function gcd(a,b) {
    // a>b
    let c = a%b;
    if (c===0){return b;};
    if (c===1){return 1;};
    return gcd(b,c);
}

function are_coprime(a,b) {
    const divisor = (a>b) ? gcd(a,b) : gcd(b,a);
    return (divisor===1) ? true : false;
}

class Palette {
    constructor(n, start = false) {
        this.n = n;
        // Make n evenly spaced colours beginning from start
        this.start = start;
        if (!start) {
            this.start = {
                mode: 'oklch',
                l: 0.6, //[0, 1], usable range below
                c: 0.25,   //[0, 0.4]
                h: 40   //[0,360)
            };
        }
        
        this.l_min = 0.35; // too muddy and indistinct below this
        this.l_max = 0.85; // too glaring above
        this.l_range = this.l_max - this.l_min;
        
        this.makePalette();
    }
    
    makePalette() {
        const minStep = 360 / this.n;
        // Need to find a step multiplier that is coprime with n
        // Want to start with reasonably big jumps
        let jump = 1;
        for (let i = Math.floor(this.n/2)-1; i > 0; i--) {
            if (are_coprime(this.n, i)) {
                jump = i;
                break;
            }
        }
        
        // Now for the luminance
        // We can try a straightforward step up
        
        let palette = Array.from({length: this.n}, (_, i) => {
            let newH = (minStep * jump * i + this.start.h) % 360 // Our new hue value
            let newL = ((this.start.l - this.l_min) + this.l_range*i*Math.floor(this.n/3)/this.n) % this.l_range + this.l_min;
            return oklch(newL, this.start.c,newH);
        });
        
        this.palette = palette.map(x => `rgb(${x[0]},${x[1]},${x[2]})`); // convert to svg-readable format
    }
}