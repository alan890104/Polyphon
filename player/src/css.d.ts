// Lets style objects set CSS custom properties, as in style={{ '--hue': 210 }}.

import 'react';

declare module 'react' {
  interface CSSProperties {
    [property: `--${string}`]: string | number;
  }
}
